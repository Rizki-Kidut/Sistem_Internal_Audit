-- Read-only, identity-scoped command-center projection. No dashboard-owned data is persisted.
CREATE OR REPLACE FUNCTION public.dashboard_can_access_instruction_row(p_row_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.is_admin_identity() OR public.current_auditor_is_lead_auditor()
 OR (public.current_identity_type()='AUDITOR' AND public.auditor_can_access_instruction_row(p_row_id))
 OR (public.current_identity_type()='SECTION_MANAGER' AND (public.manager_can_access_instruction_row(p_row_id) OR EXISTS(
   SELECT 1 FROM public.findings f JOIN public.cars c ON c.finding_id=f.id
   WHERE f.instruction_row_id=p_row_id AND public.car_accessible_to_current_identity(c.id))))
 OR (public.current_identity_type()='AUDITEE' AND EXISTS(
   SELECT 1 FROM public.findings f JOIN public.cars c ON c.finding_id=f.id
   WHERE f.instruction_row_id=p_row_id AND public.car_accessible_to_current_identity(c.id)))
$$;

CREATE OR REPLACE FUNCTION public.get_internal_audit_dashboard(
 p_fiscal_year integer DEFAULT NULL,p_audit_type text DEFAULT NULL,p_process_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_identity text;v_full boolean;v_year integer;v_result jsonb;v_today date:=current_date;
BEGIN
 v_identity:=public.current_identity_type();
 IF auth.uid() IS NULL OR v_identity IS NULL THEN RAISE EXCEPTION 'Identitas aktif diperlukan.';END IF;
 IF p_audit_type IS NOT NULL AND p_audit_type NOT IN('ChecklistSistem','ChecklistProduk','ChecklistManufakturShift') THEN RAISE EXCEPTION 'Jenis audit Dashboard tidak valid.';END IF;
 v_full:=public.is_admin_identity() OR public.current_auditor_is_lead_auditor();
 SELECT COALESCE(p_fiscal_year,
   CASE WHEN EXISTS(SELECT 1 FROM public.audit_plans p WHERE p.tahun=CASE WHEN extract(month from v_today)>=4 THEN extract(year from v_today)::integer ELSE extract(year from v_today)::integer-1 END)
     AND (v_full OR EXISTS(SELECT 1 FROM public.audit_instruction_rows r JOIN public.audit_instructions i ON i.id=r.instruction_id WHERE i.tahun_fiskal=CASE WHEN extract(month from v_today)>=4 THEN extract(year from v_today)::integer ELSE extract(year from v_today)::integer-1 END AND public.dashboard_can_access_instruction_row(r.id)))
    THEN CASE WHEN extract(month from v_today)>=4 THEN extract(year from v_today)::integer ELSE extract(year from v_today)::integer-1 END END,
   (SELECT max(i.tahun_fiskal) FROM public.audit_instruction_rows r JOIN public.audit_instructions i ON i.id=r.instruction_id WHERE public.dashboard_can_access_instruction_row(r.id)),
   CASE WHEN extract(month from v_today)>=4 THEN extract(year from v_today)::integer ELSE extract(year from v_today)::integer-1 END)
 INTO v_year;
 WITH base_rows AS (
  SELECT r.*,i.tahun_fiskal,p.nama_proses,
   CASE WHEN r.tipe_baris='Reguler' THEN 'ChecklistSistem' WHEN r.tipe_baris='AuditProduk' THEN 'ChecklistProduk' ELSE 'ChecklistManufakturShift' END audit_type,
   CASE WHEN r.tipe_baris='AuditProduk' THEN COALESCE(r.tanggal_audit_produk,r.tanggal_pelaksanaan_audit) ELSE r.tanggal_pelaksanaan_audit END execution_date,
   public.annual_actual_checklist_complete(r) checklist_complete
  FROM public.audit_instruction_rows r JOIN public.audit_instructions i ON i.id=r.instruction_id LEFT JOIN public.proses p ON p.id=r.proses_id
  WHERE i.tahun_fiskal=v_year AND public.dashboard_can_access_instruction_row(r.id)
   AND (p_audit_type IS NULL OR CASE WHEN r.tipe_baris='Reguler' THEN 'ChecklistSistem' WHEN r.tipe_baris='AuditProduk' THEN 'ChecklistProduk' ELSE 'ChecklistManufakturShift' END=p_audit_type)
 ), rows AS (
  SELECT * FROM base_rows WHERE p_process_id IS NULL OR proses_id=p_process_id
 ), finding_scope AS (
  SELECT f.*,r.proses_id,r.nama_proses FROM public.findings f JOIN rows r ON r.id=f.instruction_row_id
  WHERE f.review_status<>'ANNULLED' AND (v_full OR v_identity='AUDITOR' OR EXISTS(
    SELECT 1 FROM public.cars authorized_car WHERE authorized_car.finding_id=f.id AND public.car_accessible_to_current_identity(authorized_car.id)))
 ), car_scope AS (
  SELECT c.*,f.proses_id,f.nama_proses FROM public.cars c JOIN finding_scope f ON f.id=c.finding_id
  WHERE v_full OR public.car_accessible_to_current_identity(c.id)
 ), action_rollup AS (
  SELECT c.id car_id,max(a.due_date) FILTER(WHERE a.action_type='TEMPORARY') temporary_due,
   max(a.due_date) FILTER(WHERE a.action_type IN('CORRECTIVE','PREVENTIVE')) permanent_due
  FROM car_scope c LEFT JOIN public.car_actions a ON a.car_id=c.id GROUP BY c.id
 ), established AS (
  SELECT r.id FROM rows r WHERE r.cek_selesai AND r.execution_date IS NOT NULL AND r.checklist_complete
   AND NOT EXISTS(SELECT 1 FROM public.findings f WHERE f.instruction_row_id=r.id AND f.source_type=r.audit_type AND f.review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED','ANNULLED'))
 ), row_execution_status AS (
  SELECT r.id,CASE
   WHEN e.id IS NOT NULL THEN 'Established'
   WHEN EXISTS(SELECT 1 FROM finding_scope f WHERE f.instruction_row_id=r.id AND f.review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED')) THEN 'Menunggu Finalisasi Finding'
   WHEN r.cek_selesai THEN 'Execution Selesai'
   WHEN r.execution_date IS NOT NULL THEN 'Berjalan'
   ELSE 'Belum Mulai' END status
  FROM rows r LEFT JOIN established e ON e.id=r.id
 ), current_plan AS (
  SELECT p.id,p.tahun FROM public.audit_plans p WHERE p.tahun=v_year ORDER BY p.no_revisi DESC,p.updated_at DESC,p.id DESC LIMIT 1
 ), plan_chart AS (
  SELECT s.bulan,count(*) FILTER(WHERE s.plan)::integer plan,count(*) FILTER(WHERE s.aktual)::integer actual
  FROM public.audit_plan_schedule s JOIN public.audit_plan_process pp ON pp.id=s.process_id JOIN current_plan cp ON cp.id=pp.plan_id
  WHERE p_audit_type IS NULL AND (p_process_id IS NULL OR pp.proses_master_id=p_process_id) AND (v_full OR EXISTS(SELECT 1 FROM base_rows r WHERE r.proses_id=pp.proses_master_id)) GROUP BY s.bulan
 ), months AS (SELECT x AS month_no,CASE x WHEN 4 THEN 'April' WHEN 5 THEN 'Mei' WHEN 6 THEN 'Juni' WHEN 7 THEN 'Juli' WHEN 8 THEN 'Agustus' WHEN 9 THEN 'September' WHEN 10 THEN 'Oktober' WHEN 11 THEN 'November' WHEN 12 THEN 'Desember' WHEN 1 THEN 'Januari' WHEN 2 THEN 'Februari' ELSE 'Maret' END label FROM unnest(ARRAY[4,5,6,7,8,9,10,11,12,1,2,3]) x),
 attention AS (
  SELECT count(*) FILTER(WHERE r.tanggal_plan_audit<v_today AND e.id IS NULL) plan_overdue,
   count(*) FILTER(WHERE r.cek_selesai AND e.id IS NULL) execution_not_established,
   count(DISTINCT r.id) FILTER(WHERE (r.tanggal_plan_audit<v_today OR r.cek_selesai) AND e.id IS NULL) unique_attention FROM rows r LEFT JOIN established e ON e.id=r.id
 ), latest_weakness AS (
  SELECT wr.id FROM public.weakness_analysis_reports wr
  WHERE wr.status='Final' AND (p_audit_type IS NULL OR wr.audit_type=p_audit_type)
   AND COALESCE(wr.periode_mulai,make_date(v_year,4,1))<=make_date(v_year+1,3,31)
   AND COALESCE(wr.periode_selesai,make_date(v_year+1,3,31))>=make_date(v_year,4,1)
   AND EXISTS(SELECT 1 FROM public.weakness_analysis_report_items wi JOIN finding_scope f ON f.id=wi.finding_id WHERE wi.report_id=wr.id)
  ORDER BY wr.finalized_at DESC,wr.id DESC LIMIT 1
 ), weaknesses AS (
  SELECT COALESCE(wi.final_problem_type,classification.approved_problem_type) label,count(*)::integer count
  FROM latest_weakness lw JOIN public.weakness_analysis_report_items wi ON wi.report_id=lw.id JOIN finding_scope f ON f.id=wi.finding_id
  LEFT JOIN public.ltp_analysis_classifications classification ON classification.car_id=wi.car_id
  WHERE COALESCE(wi.final_problem_type,classification.approved_problem_type) IS NOT NULL
  GROUP BY 1 ORDER BY 2 DESC,1 LIMIT 5
 ), recent AS (
  SELECT f.kode_audit label,e.event_type detail,e.created_at,'temuan'::text page FROM public.finding_review_events e JOIN finding_scope f ON f.id=e.finding_id
  UNION ALL SELECT f.kode_audit,e.event_type,e.created_at,'car' FROM public.car_workflow_events e JOIN car_scope c ON c.id=e.car_id JOIN finding_scope f ON f.id=c.finding_id
 ), process_stats AS (
  SELECT COALESCE(f.proses_id::text,'none') process_id,COALESCE(f.nama_proses,'Tanpa Proses') process_name,count(*)::integer total,
   count(*) FILTER(WHERE f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED') AND f.status<>'Closed')::integer open,
   count(DISTINCT c.id) FILTER(WHERE c.status<>'CLOSED' AND (ar.temporary_due<v_today OR ar.permanent_due<v_today))::integer overdue_ltp,
   count(DISTINCT wi.finding_id) FILTER(WHERE lw.id IS NOT NULL)::integer weakness
  FROM finding_scope f LEFT JOIN car_scope c ON c.finding_id=f.id LEFT JOIN action_rollup ar ON ar.car_id=c.id
  LEFT JOIN latest_weakness lw ON true LEFT JOIN public.weakness_analysis_report_items wi ON wi.report_id=lw.id AND wi.finding_id=f.id GROUP BY 1,2 ORDER BY 3 DESC,2 LIMIT 10
 )
 SELECT jsonb_build_object(
  'scope',jsonb_build_object('label',CASE WHEN v_full THEN 'Seluruh Internal Audit' ELSE 'Terbatas sesuai penugasan '||v_identity END,'full_organization',v_full),
  'fiscal_years',COALESCE((SELECT jsonb_agg(y ORDER BY y DESC) FROM(SELECT v_year y UNION SELECT p.tahun FROM public.audit_plans p WHERE v_full UNION SELECT DISTINCT i.tahun_fiskal FROM public.audit_instruction_rows r JOIN public.audit_instructions i ON i.id=r.instruction_id WHERE public.dashboard_can_access_instruction_row(r.id))q),'[]'::jsonb),'selected_fiscal_year',v_year,
  'processes',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',q.proses_id,'name',q.nama_proses)ORDER BY q.nama_proses) FROM (SELECT DISTINCT proses_id,nama_proses FROM base_rows WHERE proses_id IS NOT NULL)q),'[]'),
  'metrics',jsonb_build_array(
   jsonb_build_object('key','planned','label','Audit Direncanakan','value',(SELECT count(*) FROM rows WHERE tanggal_plan_audit IS NOT NULL),'description','Konteks QA dengan tanggal plan audit','page','instruksi-audit'),
   jsonb_build_object('key','established','label','Audit Established','value',(SELECT count(*) FROM established),'description','Sesuai semantik FORM-001 Actual','page','pelaksanaan'),
   jsonb_build_object('key','finding_open','label','Finding Open','value',(SELECT count(*) FROM finding_scope WHERE review_status IN('PUBLISHED','LEGACY_ESTABLISHED') AND status<>'Closed'),'description','Finding formal belum Closed','page','temuan'),
   jsonb_build_object('key','finding_pending','label','Finding Menunggu Review','value',(SELECT count(*) FROM finding_scope WHERE review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED')),'description','Finding aktif belum final','page','temuan'),
   jsonb_build_object('key','ltp_overdue','label','LTP / CAR Overdue','value',(SELECT count(*) FROM car_scope c JOIN action_rollup a ON a.car_id=c.id WHERE c.status<>'CLOSED' AND (a.temporary_due<v_today OR a.permanent_due<v_today)),'description','Target aksi lewat dan LTP belum Closed','page','car'),
   jsonb_build_object('key','attention','label','Audit Perlu Perhatian','value',(SELECT unique_attention FROM attention),'description','Plan lewat atau belum Established','page','pelaksanaan')),
  'plan_actual_available',p_audit_type IS NULL AND EXISTS(SELECT 1 FROM current_plan),
  'plan_actual_message',CASE WHEN p_audit_type IS NOT NULL THEN 'Plan vs Aktual FORM-001 tidak memiliki dimensi Jenis Audit.' WHEN NOT EXISTS(SELECT 1 FROM current_plan) THEN 'Belum ada Rencana Audit Tahunan untuk FY ini.' ELSE NULL END,
  'plan_actual',(SELECT jsonb_agg(jsonb_build_object('month',m.month_no,'label',m.label||' '||CASE WHEN m.month_no>=4 THEN v_year ELSE v_year+1 END,'plan',COALESCE(p.plan,0),'actual',COALESCE(p.actual,0))ORDER BY array_position(ARRAY[4,5,6,7,8,9,10,11,12,1,2,3],m.month_no))FROM months m LEFT JOIN plan_chart p ON p.bulan=m.month_no),
  'execution_status',jsonb_build_array(
   jsonb_build_object('label','Belum Mulai','value',(SELECT count(*) FROM row_execution_status WHERE status='Belum Mulai')),
   jsonb_build_object('label','Berjalan','value',(SELECT count(*) FROM row_execution_status WHERE status='Berjalan')),
   jsonb_build_object('label','Execution Selesai','value',(SELECT count(*) FROM row_execution_status WHERE status='Execution Selesai')),
   jsonb_build_object('label','Menunggu Finalisasi Finding','value',(SELECT count(*) FROM row_execution_status WHERE status='Menunggu Finalisasi Finding')),
   jsonb_build_object('label','Established','value',(SELECT count(*) FROM row_execution_status WHERE status='Established'))),
  'finding_health',jsonb_build_object('open',(SELECT count(*) FROM finding_scope WHERE review_status IN('PUBLISHED','LEGACY_ESTABLISHED') AND status<>'Closed'),'closed',(SELECT count(*) FROM finding_scope WHERE review_status IN('PUBLISHED','LEGACY_ESTABLISHED') AND status='Closed'),'pending_review',(SELECT count(*) FROM finding_scope WHERE review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED')),'categories',jsonb_build_object('A',(SELECT count(*) FROM finding_scope WHERE kategori='A'),'B',(SELECT count(*) FROM finding_scope WHERE kategori='B'),'C',(SELECT count(*) FROM finding_scope WHERE kategori='C'))),
  'ltp_health',jsonb_build_object('open',(SELECT count(*) FROM car_scope WHERE status<>'CLOSED'),'temporary_overdue',(SELECT count(*) FROM car_scope c JOIN action_rollup a ON a.car_id=c.id WHERE c.status<>'CLOSED' AND a.temporary_due<v_today),'permanent_overdue',(SELECT count(*) FROM car_scope c JOIN action_rollup a ON a.car_id=c.id WHERE c.status<>'CLOSED' AND a.permanent_due<v_today),'verification_pending',(SELECT count(*) FROM car_scope WHERE status IN('AUDITOR_REVIEW','AUDITOR_RETURNED'))),
  'process_findings',COALESCE((SELECT jsonb_agg(jsonb_build_object('process_id',process_id,'process_name',process_name,'total',total,'open',open,'overdue_ltp',overdue_ltp,'weakness',weakness))FROM process_stats),'[]'),
  'weaknesses',COALESCE((SELECT jsonb_agg(jsonb_build_object('label',label,'count',count))FROM weaknesses),'[]'),
  'attention',jsonb_build_array(jsonb_build_object('label','LTP melewati target','count',(SELECT count(*) FROM car_scope c JOIN action_rollup a ON a.car_id=c.id WHERE c.status<>'CLOSED' AND(a.temporary_due<v_today OR a.permanent_due<v_today)),'page','car'),jsonb_build_object('label','Finding masih menunggu review','count',(SELECT count(*) FROM finding_scope WHERE review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED')),'page','temuan'),jsonb_build_object('label','Audit selesai execution tetapi belum Established','count',(SELECT execution_not_established FROM attention),'page','pelaksanaan'),jsonb_build_object('label','Audit melewati tanggal plan','count',(SELECT plan_overdue FROM attention),'page','pelaksanaan')),
  'my_actions',CASE WHEN v_full THEN jsonb_build_array(jsonb_build_object('label','Review Finding tertunda','count',(SELECT count(*) FROM finding_scope WHERE review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED')),'page','temuan'),jsonb_build_object('label','Tindak lanjut LTP overdue','count',(SELECT count(*) FROM car_scope c JOIN action_rollup a ON a.car_id=c.id WHERE c.status<>'CLOSED' AND(a.temporary_due<v_today OR a.permanent_due<v_today)),'page','car')) WHEN v_identity='AUDITOR' THEN jsonb_build_array(jsonb_build_object('label','Audit penugasan belum selesai','count',(SELECT count(*) FROM rows WHERE NOT cek_selesai),'page','pelaksanaan'),jsonb_build_object('label','Verifikasi LTP menunggu','count',(SELECT count(*) FROM car_scope WHERE status IN('AUDITOR_REVIEW','AUDITOR_RETURNED')),'page','car')) WHEN v_identity='AUDITEE' THEN jsonb_build_array(jsonb_build_object('label','LTP memerlukan tindakan Auditee','count',(SELECT count(*) FROM car_scope WHERE status IN('AUDITEE_DRAFT','AUDITEE_RETURNED')),'page','car')) ELSE jsonb_build_array(jsonb_build_object('label','LTP menunggu review Section Manager','count',(SELECT count(*) FROM car_scope WHERE status='MANAGER_REVIEW'),'page','car')) END,
  'upcoming',COALESCE((SELECT jsonb_agg(jsonb_build_object('date',d,'label',label,'detail',detail,'page',page)ORDER BY d) FROM(SELECT tanggal_plan_audit d,kode_audit label,CASE WHEN tanggal_plan_audit<v_today THEN 'Rencana audit overdue' ELSE 'Audit dijadwalkan' END detail,'instruksi-audit' page FROM rows WHERE tanggal_plan_audit IS NOT NULL ORDER BY abs(tanggal_plan_audit-v_today) LIMIT 6)q),'[]'),
  'recent_activity',COALESCE((SELECT jsonb_agg(jsonb_build_object('label',label,'detail',detail,'date',created_at::date,'page',page)ORDER BY created_at DESC)FROM(SELECT * FROM recent ORDER BY created_at DESC LIMIT 8)q),'[]')
 ) INTO v_result;
 RETURN v_result;
END $$;
COMMENT ON FUNCTION public.get_internal_audit_dashboard(integer,text,uuid) IS 'Read-only identity-scoped dashboard. Audit Direncanakan counts accessible QA contexts with tanggal_plan_audit; attention counts unique QA contexts; Finding/CAR aggregates are independently CAR-authorized for Auditee/Manager; execution statuses are mutually exclusive; verification pending is AUDITOR_REVIEW or AUDITOR_RETURNED; Plan/Actual is unavailable under Audit Type filters or without an Annual Plan; Established delegates checklist semantics to annual_actual_checklist_complete. LTP overdue means max applicable action target is before today while CAR is not CLOSED.';
REVOKE ALL ON FUNCTION public.dashboard_can_access_instruction_row(uuid),public.get_internal_audit_dashboard(integer,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_internal_audit_dashboard(integer,text,uuid) TO authenticated;
