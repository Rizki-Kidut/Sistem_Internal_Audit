-- FORM-010: explicit checklist-family identity and exact execution-date snapshots.
-- Legacy rows deliberately retain NULL audit_type and their original population.
ALTER TABLE public.weakness_analysis_reports
  ADD COLUMN audit_type text,
  ADD COLUMN audit_date_start date,
  ADD COLUMN audit_date_end date,
  ADD COLUMN audit_execution_dates date[],
  ADD CONSTRAINT weakness_audit_type_check CHECK (
    audit_type IN ('ChecklistSistem','ChecklistManufakturShift','ChecklistProduk')
  );

-- No archived/superseded lifecycle exists. One typed report (Draft or Final) per Program.
-- NULL legacy identities are deliberately excluded, without guessing or rewriting them.
CREATE UNIQUE INDEX weakness_program_audit_type_unique
  ON public.weakness_analysis_reports(program_id,audit_type)
  WHERE source_mode='PROGRAM' AND audit_type IS NOT NULL;

CREATE FUNCTION public.normalize_weakness_audit_dates(p_dates date[])
RETURNS date[] LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT COALESCE(array_agg(DISTINCT d ORDER BY d) FILTER (WHERE d IS NOT NULL),ARRAY[]::date[])
  FROM unnest(p_dates) d
$$;
ALTER TABLE public.weakness_analysis_reports ADD CONSTRAINT weakness_audit_dates_check CHECK (
  audit_type IS NULL OR (
    audit_execution_dates IS NOT NULL
    AND audit_execution_dates=public.normalize_weakness_audit_dates(audit_execution_dates)
    AND audit_date_start IS NOT DISTINCT FROM audit_execution_dates[1]
    AND audit_date_end IS NOT DISTINCT FROM audit_execution_dates[cardinality(audit_execution_dates)]
  )
);

CREATE FUNCTION public.weakness_audit_context(p_report_id uuid)
RETURNS TABLE(row_id uuid,program_id uuid,team_master_id uuid,execution_date date,completed boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT ir.id,ai.program_id,ir.team_master_id,d.execution_date,ir.cek_selesai
  FROM public.weakness_analysis_reports r
  JOIN public.audit_instructions ai ON r.source_mode='DATE_RANGE' OR ai.program_id=r.program_id
  JOIN public.audit_instruction_rows ir ON ir.instruction_id=ai.id
  CROSS JOIN LATERAL (
    SELECT CASE WHEN r.audit_type='ChecklistProduk'
      THEN COALESCE(ir.tanggal_audit_produk,ir.tanggal_pelaksanaan_audit)
      ELSE ir.tanggal_pelaksanaan_audit END AS execution_date
  ) d
  WHERE r.id=p_report_id AND (
    r.audit_type='ChecklistSistem' AND EXISTS(SELECT 1 FROM public.checklists c WHERE c.row_id=ir.id)
    OR r.audit_type='ChecklistManufakturShift' AND EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift c WHERE c.row_id=ir.id)
    OR r.audit_type='ChecklistProduk' AND EXISTS(SELECT 1 FROM public.checklist_produk c WHERE c.row_id=ir.id)
  ) AND (r.source_mode='PROGRAM' OR d.execution_date BETWEEN r.periode_mulai AND r.periode_selesai)
$$;

CREATE FUNCTION public.protect_weakness_audit_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.audit_type IS NULL THEN
    RAISE EXCEPTION 'Jenis Audit Analisa wajib dipilih';
  END IF;
  IF TG_OP='UPDATE' AND (NEW.audit_type,NEW.source_mode,NEW.program_id,NEW.periode_mulai,NEW.periode_selesai)
    IS DISTINCT FROM (OLD.audit_type,OLD.source_mode,OLD.program_id,OLD.periode_mulai,OLD.periode_selesai) THEN
    RAISE EXCEPTION 'Identitas dan lingkup FORM-010 tidak dapat diubah';
  END IF;
  RETURN NEW;
END$$;
CREATE TRIGGER protect_weakness_audit_identity BEFORE INSERT OR UPDATE
ON public.weakness_analysis_reports FOR EACH ROW EXECUTE FUNCTION public.protect_weakness_audit_identity();

CREATE OR REPLACE FUNCTION public.assert_weakness_draft(p_report_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.weakness_analysis_reports%ROWTYPE;
BEGIN
  IF NOT public.can_manage_weakness_analysis() THEN RAISE EXCEPTION 'Akses Weakness Analysis ditolak'; END IF;
  SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=p_report_id FOR UPDATE;
  IF NOT FOUND OR r.status<>'Draft' THEN RAISE EXCEPTION 'Analisa tidak ditemukan atau sudah Final'; END IF;
  IF r.audit_type IS NULL THEN RAISE EXCEPTION 'Laporan legacy sebelum pemisahan jenis audit hanya dapat dibaca'; END IF;
END$$;

CREATE OR REPLACE FUNCTION public.populate_weakness_report(p_report_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.weakness_analysis_reports%ROWTYPE; v_n integer; v_dates date[];
BEGIN
  PERFORM public.assert_weakness_draft(p_report_id);
  SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=p_report_id;
  IF NOT EXISTS(SELECT 1 FROM public.weakness_audit_context(r.id)) THEN
    RAISE EXCEPTION 'Tidak ada konteks checklist untuk jenis audit dan lingkup yang dipilih';
  END IF;
  SELECT public.normalize_weakness_audit_dates(array_agg(execution_date)) INTO v_dates
    FROM public.weakness_audit_context(r.id);
  DELETE FROM public.weakness_analysis_report_items WHERE report_id=r.id;
  INSERT INTO public.weakness_analysis_report_items(report_id,finding_id,car_id,sort_order)
    SELECT r.id,f.id,c.id,row_number() OVER(ORDER BY ctx.execution_date,f.kode_temuan,f.id)
    FROM public.weakness_audit_context(r.id) ctx
    JOIN public.findings f ON f.instruction_row_id=ctx.row_id AND f.source_type=r.audit_type
    JOIN public.cars c ON c.finding_id=f.id
    WHERE f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED');
  GET DIAGNOSTICS v_n=ROW_COUNT;
  UPDATE public.weakness_analysis_reports SET audit_execution_dates=v_dates,
    audit_date_start=v_dates[1],audit_date_end=v_dates[cardinality(v_dates)],
    revision_version=revision_version+1 WHERE id=r.id;
  RETURN v_n;
END$$;

-- Keep the old signature only as a safe explicit failure for stale clients.
CREATE OR REPLACE FUNCTION public.create_weakness_analysis(p_judul text,p_source_mode text,p_periode_mulai date,p_periode_selesai date,p_program_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF NOT public.can_manage_weakness_analysis() THEN RAISE EXCEPTION 'Akses Weakness Analysis ditolak'; END IF;
  RAISE EXCEPTION 'Jenis Audit Analisa wajib dipilih; muat ulang aplikasi';
END$$;

CREATE FUNCTION public.create_weakness_analysis(p_judul text,p_source_mode text,p_periode_mulai date,p_periode_selesai date,p_program_id uuid,p_audit_type text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.can_manage_weakness_analysis() THEN RAISE EXCEPTION 'Akses Weakness Analysis ditolak'; END IF;
  IF p_audit_type IS NULL OR p_audit_type NOT IN ('ChecklistSistem','ChecklistManufakturShift','ChecklistProduk') THEN
    RAISE EXCEPTION 'Jenis Audit Analisa tidak valid';
  END IF;
  IF p_source_mode IS NULL OR NOT (
    p_source_mode='PROGRAM' AND p_program_id IS NOT NULL AND p_periode_mulai IS NULL AND p_periode_selesai IS NULL
    OR p_source_mode='DATE_RANGE' AND p_program_id IS NULL AND p_periode_mulai IS NOT NULL
      AND p_periode_selesai IS NOT NULL AND p_periode_selesai>=p_periode_mulai
  ) THEN RAISE EXCEPTION 'Lingkup Program atau rentang tanggal tidak valid'; END IF;
  BEGIN
    INSERT INTO public.weakness_analysis_reports(judul,source_mode,periode_mulai,periode_selesai,program_id,audit_type,audit_execution_dates,created_by)
    VALUES(btrim(p_judul),p_source_mode,p_periode_mulai,p_periode_selesai,p_program_id,p_audit_type,ARRAY[]::date[],auth.uid()) RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'FORM-010 untuk Program dan jenis audit ini sudah tersedia'; END;
  PERFORM public.populate_weakness_report(v_id);
  RETURN v_id;
END$$;

CREATE OR REPLACE FUNCTION public.weakness_team_leader_candidates(p_report_id uuid)
RETURNS TABLE(auditor_id uuid,nama text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT DISTINCT a.id,a.nama FROM public.weakness_audit_context(p_report_id) ctx
  JOIN public.audit_team_master_members m ON m.team_id=ctx.team_master_id AND m.is_team_leader
  JOIN public.auditors a ON a.id=m.auditor_id
  WHERE public.can_manage_weakness_analysis() ORDER BY a.nama,a.id
$$;
CREATE OR REPLACE FUNCTION public.weakness_pj_qms_candidates(p_report_id uuid)
RETURNS TABLE(pj_qms text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT DISTINCT btrim(ap.penanggung_jawab_qms)
  FROM public.weakness_analysis_reports r JOIN public.audit_programs ap ON (
    r.source_mode='PROGRAM' AND ap.id=r.program_id OR r.source_mode='DATE_RANGE' AND ap.id IN (
      SELECT ctx.program_id FROM public.weakness_audit_context(r.id) ctx
    )
  ) WHERE r.id=p_report_id AND nullif(btrim(ap.penanggung_jawab_qms),'') IS NOT NULL
    AND public.can_manage_weakness_analysis() ORDER BY 1
$$;

CREATE OR REPLACE FUNCTION public.approve_ltp_analysis_classification(p_report_item_id uuid,p_4m1e text,p_dis text,p_problem_type text,p_suggestion_id uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_item public.weakness_analysis_report_items%ROWTYPE;v_source text:='MANUAL';v_s public.ltp_ai_classification_suggestions%ROWTYPE;
BEGIN
 IF NOT public.can_manage_weakness_analysis() THEN RAISE EXCEPTION 'Akses Weakness Analysis ditolak';END IF;
 SELECT wi.* INTO v_item FROM public.weakness_analysis_report_items wi JOIN public.weakness_analysis_reports r ON r.id=wi.report_id WHERE wi.id=p_report_item_id AND r.status='Draft';
 IF NOT FOUND THEN RAISE EXCEPTION 'Item tidak berada pada Analisa Draft';END IF;
 PERFORM public.assert_weakness_draft(v_item.report_id);
 IF p_suggestion_id IS NOT NULL THEN
  SELECT * INTO v_s FROM public.ltp_ai_classification_suggestions WHERE id=p_suggestion_id AND car_id=v_item.car_id AND (weakness_report_id IS NULL OR weakness_report_id=v_item.report_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Suggestion AI tidak valid untuk item Analisa ini';END IF;
  v_source:=CASE WHEN (p_4m1e,p_dis,p_problem_type)=(v_s.suggested_4m1e,v_s.suggested_dis,v_s.suggested_problem_type) THEN 'AI_ACCEPTED' ELSE 'AI_EDITED' END;
 END IF;
 INSERT INTO public.ltp_analysis_classifications(car_id,approved_4m1e,approved_dis,approved_problem_type,approved_by,approved_at,approval_source)
 VALUES(v_item.car_id,p_4m1e,p_dis,p_problem_type,auth.uid(),now(),v_source)
 ON CONFLICT(car_id) DO UPDATE SET approved_4m1e=excluded.approved_4m1e,approved_dis=excluded.approved_dis,approved_problem_type=excluded.approved_problem_type,approved_by=auth.uid(),approved_at=now(),approval_source=excluded.approval_source;
END$$;

CREATE OR REPLACE FUNCTION public.save_weakness_analysis_draft(p_report_id uuid,p_expected_revision integer,p_kesimpulan text,p_leader uuid,p_pj_qms text,p_why jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_rev integer;v_leader_count integer;v_pj_count integer;w jsonb;v_wid uuid;l jsonb;a jsonb;v_levels integer[];
BEGIN
 PERFORM public.assert_weakness_draft(p_report_id);SELECT revision_version INTO v_rev FROM public.weakness_analysis_reports WHERE id=p_report_id FOR UPDATE;
 IF v_rev<>p_expected_revision THEN RAISE EXCEPTION 'WEAKNESS_STALE_REVISION';END IF;
 SELECT count(*) INTO v_leader_count FROM public.weakness_team_leader_candidates(p_report_id);
 IF v_leader_count=0 AND p_leader IS NOT NULL OR v_leader_count>0 AND (p_leader IS NULL OR NOT EXISTS(SELECT 1 FROM public.weakness_team_leader_candidates(p_report_id) c WHERE c.auditor_id=p_leader)) THEN RAISE EXCEPTION 'Audit Team Leader bukan kandidat otoritatif laporan';END IF;
 SELECT count(*) INTO v_pj_count FROM public.weakness_pj_qms_candidates(p_report_id);
 IF v_pj_count=0 AND nullif(btrim(p_pj_qms),'') IS NOT NULL OR v_pj_count>0 AND (nullif(btrim(p_pj_qms),'') IS NULL OR NOT EXISTS(SELECT 1 FROM public.weakness_pj_qms_candidates(p_report_id) c WHERE c.pj_qms=btrim(p_pj_qms))) THEN RAISE EXCEPTION 'PJ QMS bukan kandidat otoritatif laporan';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.weakness_analysis_report_items WHERE report_id=p_report_id) THEN
  IF COALESCE(p_why,'[]'::jsonb)<>'[]'::jsonb THEN RAISE EXCEPTION 'Analisa tanpa Finding tidak memerlukan Why-Why atau Tindakan'; END IF;
  p_kesimpulan:='-';
 END IF;
 UPDATE public.weakness_analysis_reports SET kesimpulan=p_kesimpulan,audit_team_leader_auditor_id=p_leader,pj_qms=nullif(btrim(p_pj_qms),''),revision_version=revision_version+1 WHERE id=p_report_id;
 DELETE FROM public.weakness_why_analysis WHERE report_id=p_report_id;
 FOR w IN SELECT * FROM jsonb_array_elements(COALESCE(p_why,'[]')) LOOP
  SELECT array_agg((x->>'level')::integer ORDER BY (x->>'level')::integer) INTO v_levels FROM jsonb_array_elements(COALESCE(w->'levels','[]')) x;
  IF coalesce(cardinality(v_levels),0) NOT BETWEEN 1 AND 4 OR v_levels<>ARRAY(SELECT generate_series(1,cardinality(v_levels))) OR EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(w->'levels','[]')) x WHERE nullif(btrim(x->>'teks'),'') IS NULL) THEN RAISE EXCEPTION 'Why harus berisi 1-4 level berurutan tanpa jeda';END IF;
  INSERT INTO public.weakness_why_analysis(report_id,nomor,problem,akar_permasalahan,sort_order) VALUES(p_report_id,(w->>'nomor')::integer,w->>'problem',w->>'akar_permasalahan',(w->>'sort_order')::integer) RETURNING id INTO v_wid;
  FOR l IN SELECT * FROM jsonb_array_elements(w->'levels') LOOP INSERT INTO public.weakness_why_levels(why_analysis_id,level,teks) VALUES(v_wid,(l->>'level')::integer,btrim(l->>'teks'));END LOOP;
  FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(w->'actions','[]')) LOOP INSERT INTO public.weakness_actions(why_analysis_id,sort_order,rencana_tindakan,pic,due_date,status) VALUES(v_wid,(a->>'sort_order')::integer,a->>'rencana_tindakan',a->>'pic',(a->>'due_date')::date,a->>'status');END LOOP;
 END LOOP;RETURN v_rev+1;
END$$;

CREATE OR REPLACE FUNCTION public.finalize_weakness_analysis(p_report_id uuid,p_expected_revision integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$DECLARE r public.weakness_analysis_reports%ROWTYPE; v_dates date[]; v_has_items boolean;BEGIN IF NOT public.can_manage_weakness_analysis() THEN RAISE EXCEPTION 'Akses Weakness Analysis ditolak';
END IF;
SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=p_report_id FOR UPDATE;
IF NOT FOUND THEN RAISE EXCEPTION 'Analisa tidak ditemukan';
END IF;

IF r.status<>'Draft' THEN RAISE EXCEPTION 'Analisa bukan Draft';
END IF;

IF r.revision_version<>p_expected_revision THEN RAISE EXCEPTION 'WEAKNESS_STALE_REVISION';
END IF;
PERFORM public.assert_weakness_draft(r.id);
-- Lock the represented Instruction rows against concurrent date/completion changes.
PERFORM 1 FROM public.audit_instruction_rows ir WHERE ir.id IN (SELECT row_id FROM public.weakness_audit_context(r.id)) FOR SHARE;
IF NOT EXISTS(SELECT 1 FROM public.weakness_audit_context(r.id)) THEN
 RAISE EXCEPTION 'Tidak ada konteks checklist untuk jenis audit dan lingkup yang dipilih';
END IF;
SELECT public.normalize_weakness_audit_dates(array_agg(execution_date)) INTO v_dates FROM public.weakness_audit_context(r.id);
IF r.audit_execution_dates IS DISTINCT FROM v_dates THEN RAISE EXCEPTION 'Tanggal audit berubah; Regenerate Populasi sebelum Final'; END IF;
-- Exact set equality prevents stale/omitted Findings from masquerading as an empty audit.
IF EXISTS(
 SELECT 1 FROM public.weakness_audit_context(r.id) ctx
 JOIN public.findings f ON f.instruction_row_id=ctx.row_id AND f.source_type=r.audit_type
 LEFT JOIN public.cars c ON c.finding_id=f.id
 LEFT JOIN public.weakness_analysis_report_items wi ON wi.report_id=r.id AND wi.finding_id=f.id AND wi.car_id=c.id
 WHERE f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED') AND (c.id IS NULL OR wi.id IS NULL)
) OR EXISTS(
 SELECT 1 FROM public.weakness_analysis_report_items wi
 JOIN public.findings f ON f.id=wi.finding_id
 WHERE wi.report_id=r.id AND (f.source_type<>r.audit_type OR NOT EXISTS(
   SELECT 1 FROM public.weakness_audit_context(r.id) ctx WHERE ctx.row_id=f.instruction_row_id
 ))
) THEN RAISE EXCEPTION 'Populasi tidak sesuai lingkup jenis audit; Regenerate Populasi sebelum Final'; END IF;
SELECT EXISTS(SELECT 1 FROM public.weakness_analysis_report_items WHERE report_id=r.id) INTO v_has_items;
IF NOT v_has_items AND EXISTS(SELECT 1 FROM public.weakness_audit_context(r.id) WHERE NOT completed) THEN
 RAISE EXCEPTION 'Audit tanpa Finding hanya dapat Final setelah seluruh konteks audit selesai';
END IF;
IF NOT v_has_items AND EXISTS(SELECT 1 FROM public.weakness_why_analysis WHERE report_id=r.id) THEN
 RAISE EXCEPTION 'Analisa tanpa Finding tidak memerlukan Why-Why atau Tindakan';
END IF;
IF (SELECT count(*) FROM public.weakness_team_leader_candidates(r.id))=0 AND r.audit_team_leader_auditor_id IS NOT NULL OR (SELECT count(*) FROM public.weakness_team_leader_candidates(r.id))>0 AND (r.audit_team_leader_auditor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.weakness_team_leader_candidates(r.id)c WHERE c.auditor_id=r.audit_team_leader_auditor_id)) THEN RAISE EXCEPTION 'Audit Team Leader bukan kandidat otoritatif laporan';
END IF;

IF (SELECT count(*) FROM public.weakness_pj_qms_candidates(r.id))=0 AND r.pj_qms IS NOT NULL OR (SELECT count(*) FROM public.weakness_pj_qms_candidates(r.id))>0 AND (r.pj_qms IS NULL OR NOT EXISTS(SELECT 1 FROM public.weakness_pj_qms_candidates(r.id)c WHERE c.pj_qms=r.pj_qms)) THEN RAISE EXCEPTION 'PJ QMS bukan kandidat otoritatif laporan';
END IF;

IF v_has_items AND btrim(COALESCE(r.kesimpulan,''))='' THEN RAISE EXCEPTION 'Kesimpulan wajib diisi';
END IF;

IF EXISTS(SELECT 1 FROM public.weakness_analysis_report_items x LEFT JOIN public.findings f ON f.id=x.finding_id AND f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED') LEFT JOIN public.cars c ON c.id=x.car_id AND c.finding_id=x.finding_id WHERE x.report_id=r.id AND(f.id IS NULL OR c.id IS NULL))THEN RAISE EXCEPTION 'Relasi Finding/LTP tidak lagi valid';
END IF;

IF EXISTS(SELECT 1 FROM public.weakness_analysis_report_items x JOIN public.cars c ON c.id=x.car_id WHERE x.report_id=r.id AND c.status<>'CLOSED')THEN RAISE EXCEPTION 'Masih terdapat LTP yang belum Closed.';
END IF;

IF EXISTS(SELECT 1 FROM public.weakness_analysis_report_items x LEFT JOIN public.ltp_analysis_classifications c ON c.car_id=x.car_id WHERE x.report_id=r.id AND(c.car_id IS NULL OR c.approved_4m1e IS NULL OR c.approved_dis IS NULL OR c.approved_problem_type IS NULL))THEN RAISE EXCEPTION 'Klasifikasi seluruh item wajib disetujui';
END IF;

IF EXISTS(SELECT 1 FROM public.weakness_why_analysis w WHERE w.report_id=r.id AND(btrim(w.problem)='' OR btrim(w.akar_permasalahan)='')) OR EXISTS(SELECT 1 FROM public.weakness_why_analysis w JOIN public.weakness_why_levels l ON l.why_analysis_id=w.id WHERE w.report_id=r.id AND(l.level NOT BETWEEN 1 AND 4 OR btrim(l.teks)='')) OR EXISTS(SELECT 1 FROM public.weakness_why_analysis w CROSS JOIN LATERAL(SELECT count(*)::integer n,array_agg(l.level ORDER BY l.level) levels FROM public.weakness_why_levels l WHERE l.why_analysis_id=w.id)x WHERE w.report_id=r.id AND(x.n NOT BETWEEN 1 AND 4 OR x.levels<>ARRAY(SELECT generate_series(1,x.n)))) OR EXISTS(SELECT 1 FROM public.weakness_why_analysis w JOIN public.weakness_actions a ON a.why_analysis_id=w.id WHERE w.report_id=r.id AND(btrim(a.rencana_tindakan)='' OR btrim(a.pic)='' OR a.due_date IS NULL)) THEN RAISE EXCEPTION 'Why-Why atau Tindakan belum lengkap';
END IF;
UPDATE public.weakness_analysis_report_items x SET final_4m1e=c.approved_4m1e,final_dis=c.approved_dis,final_problem_type=c.approved_problem_type FROM public.ltp_analysis_classifications c WHERE x.report_id=r.id AND c.car_id=x.car_id;
UPDATE public.weakness_analysis_reports SET status='Final',kesimpulan=CASE WHEN v_has_items THEN kesimpulan ELSE '-' END,finalized_at=now(),revision_version=revision_version+1,audit_team_leader_name_snapshot=(SELECT nama FROM public.auditors WHERE id=r.audit_team_leader_auditor_id),pj_qms_snapshot=r.pj_qms WHERE id=r.id;RETURN r.revision_version+1;END$$;


-- Helpers are internal; exposed RPCs retain the exact existing capability check.
REVOKE ALL ON FUNCTION public.normalize_weakness_audit_dates(date[]),public.weakness_audit_context(uuid),public.protect_weakness_audit_identity()
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.create_weakness_analysis(text,text,date,date,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_weakness_analysis(text,text,date,date,uuid,text) TO authenticated;
-- Replaced functions preserve their existing restricted grants; no RLS policy or capability change.
NOTIFY pgrst,'reload schema';
