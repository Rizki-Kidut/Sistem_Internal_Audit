-- Batch 7b: controlled Auditee LTP Draft authoring. Workflow transitions remain out of scope.

CREATE OR REPLACE FUNCTION public.safe_uuid(p_value text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
  RETURN p_value::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.safe_date(p_value text) RETURNS date
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog AS $$
BEGIN
  IF NULLIF(btrim(p_value),'') IS NULL THEN RETURN NULL; END IF;
  RETURN p_value::date;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN
  RAISE EXCEPTION 'Due Date tindakan tidak valid';
END $$;

CREATE OR REPLACE FUNCTION public.auditee_can_edit_ltp(p_car_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT public.current_identity_type()='AUDITEE' AND EXISTS (
    SELECT 1 FROM public.cars c
    JOIN public.section_identity_assignments a
      ON a.user_id=auth.uid() AND a.seksi_id=c.seksi_auditee_id
     AND a.assignment_type='AUDIT_PIC' AND a.status='Aktif'
    WHERE c.id=p_car_id AND c.status IN ('AUDITEE_DRAFT','AUDITEE_RETURNED')
  )
$$;

-- Harden the Batch 7a target-section parser without changing eligibility or creation semantics.
CREATE OR REPLACE FUNCTION public.create_ltp_for_eligible_finding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_target_count integer; v_target_id uuid;
BEGIN
  IF NEW.review_status NOT IN ('PUBLISHED','LEGACY_ESTABLISHED') OR NEW.kode_temuan IS NULL
    OR NOT public.ltp_finding_has_complete_plor(NEW) THEN RETURN NEW; END IF;
  SELECT count(DISTINCT s.id),(array_agg(DISTINCT s.id))[1] INTO v_target_count,v_target_id
  FROM public.audit_instruction_rows r
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]'::jsonb)) mark
  JOIN public.seksi s ON s.id=public.safe_uuid(mark->>'seksi_id')
  WHERE r.id=NEW.instruction_row_id AND mark->>'tipe'='target';
  INSERT INTO public.cars(finding_id,kode_car,seksi_auditee_id)
  VALUES(NEW.id,NEW.kode_temuan,CASE WHEN v_target_count=1 THEN v_target_id END)
  ON CONFLICT (finding_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.ltp_evidence_car_id(p_path text) RETURNS uuid
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE WHEN cardinality(storage.foldername(p_path))=4 AND (storage.foldername(p_path))[1]='ltp'
    THEN public.safe_uuid((storage.foldername(p_path))[2]) END
$$;
CREATE OR REPLACE FUNCTION public.ltp_evidence_action_id(p_path text) RETURNS uuid
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,public AS $$
  SELECT CASE WHEN cardinality(storage.foldername(p_path))=4 AND (storage.foldername(p_path))[1]='ltp'
    THEN public.safe_uuid((storage.foldername(p_path))[3]) END
$$;
CREATE OR REPLACE FUNCTION public.ltp_evidence_state(p_path text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT CASE WHEN cardinality(storage.foldername(p_path))=4 AND (storage.foldername(p_path))[1]='ltp'
    AND (storage.foldername(p_path))[4] IN ('BEFORE','AFTER') THEN (storage.foldername(p_path))[4] END
$$;
CREATE OR REPLACE FUNCTION public.ltp_evidence_path_matches(p_path text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT public.ltp_evidence_car_id(p_path) IS NOT NULL
    AND public.ltp_evidence_action_id(p_path) IS NOT NULL
    AND public.ltp_evidence_state(p_path) IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.car_actions a
      WHERE a.id=public.ltp_evidence_action_id(p_path) AND a.car_id=public.ltp_evidence_car_id(p_path))
$$;

CREATE UNIQUE INDEX idx_car_action_evidence_path ON public.car_action_evidence(path);

CREATE OR REPLACE FUNCTION public.save_ltp_auditee_draft(
  p_car_id uuid,p_expected_revision integer,p_dampak_temuan text,p_manfaat_perbaikan text,
  p_why_analysis jsonb,p_actions jsonb,p_system_revisions jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_car public.cars%ROWTYPE; v_category text; v_item jsonb; v_type text; v_description text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autentikasi diperlukan'; END IF;
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id FOR UPDATE;
  IF NOT FOUND OR NOT public.auditee_can_edit_ltp(p_car_id) THEN RAISE EXCEPTION 'Auditee tidak diizinkan mengubah LTP ini'; END IF;
  IF v_car.revision_version<>p_expected_revision THEN RAISE EXCEPTION 'LTP_STALE_REVISION'; END IF;
  IF jsonb_typeof(COALESCE(p_why_analysis,'[]'))<>'array' OR jsonb_typeof(COALESCE(p_actions,'[]'))<>'array'
    OR jsonb_typeof(COALESCE(p_system_revisions,'[]'))<>'array' THEN RAISE EXCEPTION 'Payload Draft LTP tidak valid'; END IF;
  SELECT f.kategori INTO v_category FROM public.findings f WHERE f.id=v_car.finding_id;
  IF v_category='C' AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_why_analysis,'[]')) x WHERE btrim(x->>'teks')<>'')
    THEN RAISE EXCEPTION 'Kategori C tidak boleh memiliki analisa Why-Why'; END IF;

  UPDATE public.cars SET dampak_temuan=NULLIF(btrim(p_dampak_temuan),''),manfaat_perbaikan=NULLIF(btrim(p_manfaat_perbaikan),'') WHERE id=p_car_id;
  DELETE FROM public.car_why_analysis WHERE car_id=p_car_id;
  IF v_category IN ('A','B') THEN
    INSERT INTO public.car_why_analysis(car_id,level,teks)
    SELECT p_car_id,row_number() OVER (ORDER BY ord)::integer,btrim(value->>'teks')
    FROM jsonb_array_elements(COALESCE(p_why_analysis,'[]')) WITH ORDINALITY q(value,ord)
    WHERE btrim(value->>'teks')<>'';
  END IF;

  CREATE TEMP TABLE ltp_action_payload(action_type text PRIMARY KEY,description text,pic text,due_date date) ON COMMIT DROP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_actions,'[]')) LOOP
    v_type:=v_item->>'action_type'; v_description:=btrim(v_item->>'description');
    IF v_type NOT IN ('TEMPORARY','CORRECTIVE','PREVENTIVE') THEN RAISE EXCEPTION 'Jenis tindakan LTP tidak valid'; END IF;
    IF v_description='' THEN CONTINUE; END IF;
    INSERT INTO ltp_action_payload VALUES(v_type,v_description,NULLIF(btrim(v_item->>'pic'),''),public.safe_date(v_item->>'due_date'));
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.car_actions a WHERE a.car_id=p_car_id AND NOT EXISTS(SELECT 1 FROM ltp_action_payload x WHERE x.action_type=a.action_type)
    AND EXISTS(SELECT 1 FROM public.car_action_evidence e WHERE e.action_id=a.id)) THEN
    RAISE EXCEPTION 'Tindakan yang memiliki bukti tidak dapat dikosongkan';
  END IF;
  DELETE FROM public.car_actions a WHERE a.car_id=p_car_id AND NOT EXISTS(SELECT 1 FROM ltp_action_payload x WHERE x.action_type=a.action_type);
  INSERT INTO public.car_actions(car_id,action_type,description,pic,due_date)
  SELECT p_car_id,action_type,description,pic,due_date FROM ltp_action_payload
  ON CONFLICT(car_id,action_type) DO UPDATE SET description=EXCLUDED.description,pic=EXCLUDED.pic,due_date=EXCLUDED.due_date;

  DELETE FROM public.car_system_revisions WHERE car_id=p_car_id;
  INSERT INTO public.car_system_revisions(car_id,kategori,nama_dokumen)
  SELECT p_car_id,value->>'kategori',btrim(value->>'nama_dokumen')
  FROM jsonb_array_elements(COALESCE(p_system_revisions,'[]'))
  WHERE btrim(value->>'nama_dokumen')<>'' AND value->>'kategori' IN ('Peraturan ISE','Dokumen Standard','Dokumen Lainnya');
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_system_revisions,'[]')) x
    WHERE btrim(x->>'nama_dokumen')<>'' AND x->>'kategori' NOT IN ('Peraturan ISE','Dokumen Standard','Dokumen Lainnya'))
    THEN RAISE EXCEPTION 'Kategori revisi sistem tidak valid'; END IF;
  UPDATE public.cars SET revision_version=revision_version+1 WHERE id=p_car_id RETURNING revision_version INTO p_expected_revision;
  RETURN p_expected_revision;
END $$;

CREATE OR REPLACE FUNCTION public.register_ltp_action_evidence(p_action_id uuid,p_evidence_state text,p_file_name text,p_path text,p_mime_type text,p_size_bytes bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_car_id uuid; v_id uuid;
BEGIN
  SELECT car_id INTO v_car_id FROM public.car_actions WHERE id=p_action_id;
  IF v_car_id IS NULL THEN RAISE EXCEPTION 'Tindakan LTP tidak ditemukan'; END IF;
  PERFORM 1 FROM public.cars WHERE id=v_car_id FOR UPDATE;
  IF NOT public.auditee_can_edit_ltp(v_car_id) THEN RAISE EXCEPTION 'Bukti LTP tidak dapat diubah'; END IF;
  IF p_evidence_state NOT IN ('BEFORE','AFTER') OR NOT public.ltp_evidence_path_matches(p_path)
    OR public.ltp_evidence_car_id(p_path)<>v_car_id OR public.ltp_evidence_action_id(p_path)<>p_action_id
    OR public.ltp_evidence_state(p_path)<>p_evidence_state THEN RAISE EXCEPTION 'Path bukti LTP tidak valid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='audit-evidence' AND o.name=p_path)
    THEN RAISE EXCEPTION 'File bukti LTP tidak ditemukan di Storage'; END IF;
  INSERT INTO public.car_action_evidence(action_id,evidence_state,file_name,path,mime_type,size_bytes)
  VALUES(p_action_id,p_evidence_state,btrim(p_file_name),p_path,NULLIF(p_mime_type,''),p_size_bytes) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.delete_ltp_action_evidence(p_evidence_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_car_id uuid; v_path text;
BEGIN
  SELECT a.car_id,e.path INTO v_car_id,v_path FROM public.car_action_evidence e JOIN public.car_actions a ON a.id=e.action_id WHERE e.id=p_evidence_id;
  IF v_car_id IS NULL THEN RAISE EXCEPTION 'Bukti LTP tidak ditemukan'; END IF;
  PERFORM 1 FROM public.cars WHERE id=v_car_id FOR UPDATE;
  IF NOT public.auditee_can_edit_ltp(v_car_id) THEN RAISE EXCEPTION 'Bukti LTP tidak dapat dihapus'; END IF;
  DELETE FROM public.car_action_evidence WHERE id=p_evidence_id;
  RETURN v_path;
END $$;

CREATE OR REPLACE FUNCTION public.get_ltp_context(p_car_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object(
    'ltp',jsonb_build_object('id',c.id,'finding_id',c.finding_id,'kode_ltp',c.kode_car,'status',c.status,'seksi_auditee_id',c.seksi_auditee_id,'revision_version',c.revision_version,'dampak_temuan',c.dampak_temuan,'manfaat_perbaikan',c.manfaat_perbaikan,'auditor_verification_result',c.auditor_verification_result,'created_at',c.created_at),
    'finding',jsonb_build_object('kode_audit',f.kode_audit,'kode_temuan',f.kode_temuan,'kategori',f.kategori,'problem',f.problem,'location',f.location,'objective_evidence',f.objective_evidence,'reference',f.reference,'saran_perbaikan',f.saran_perbaikan,'auditee_area',f.auditee_area,'tanggal_temuan',f.tanggal_temuan),
    'section',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'nama',s.nama,'kepala_seksi',s.kepala_seksi) END,
    'process',CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'nama',p.nama_proses) END,
    'team',CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'kode',t.kode_tim,'nama',t.nama_tim) END,
    'team_leader',CASE WHEN lead.id IS NULL THEN NULL ELSE jsonb_build_object('id',lead.id,'nama',lead.nama) END,
    'permissions',jsonb_build_object('can_edit_auditee',public.auditee_can_edit_ltp(c.id)),
    'why_analysis',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',w.id,'level',w.level,'teks',w.teks) ORDER BY w.level) FROM public.car_why_analysis w WHERE w.car_id=c.id),'[]'),
    'actions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'action_type',a.action_type,'description',a.description,'pic',a.pic,'due_date',a.due_date,'evidence',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'action_id',e.action_id,'evidence_state',e.evidence_state,'file_name',e.file_name,'path',e.path,'mime_type',e.mime_type,'size_bytes',e.size_bytes,'uploaded_at',e.uploaded_at) ORDER BY e.uploaded_at) FROM public.car_action_evidence e WHERE e.action_id=a.id),'[]')) ORDER BY CASE a.action_type WHEN 'TEMPORARY' THEN 1 WHEN 'CORRECTIVE' THEN 2 ELSE 3 END) FROM public.car_actions a WHERE a.car_id=c.id),'[]'),
    'system_revisions',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',sr.id,'kategori',sr.kategori,'nama_dokumen',sr.nama_dokumen,'created_at',sr.created_at) ORDER BY sr.created_at) FROM public.car_system_revisions sr WHERE sr.car_id=c.id),'[]')
  ) FROM public.cars c JOIN public.findings f ON f.id=c.finding_id JOIN public.audit_instruction_rows r ON r.id=f.instruction_row_id
  LEFT JOIN public.seksi s ON s.id=c.seksi_auditee_id LEFT JOIN public.proses p ON p.id=r.proses_id
  LEFT JOIN public.audit_team_masters t ON t.id=r.team_master_id LEFT JOIN public.audit_team_master_members lm ON lm.team_id=t.id AND lm.is_team_leader LEFT JOIN public.auditors lead ON lead.id=lm.auditor_id
  WHERE c.id=p_car_id AND public.car_accessible_to_current_identity(c.id)
$$;

CREATE POLICY ltp_evidence_authorized_select ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='audit-evidence' AND public.ltp_evidence_path_matches(name) AND public.car_accessible_to_current_identity(public.ltp_evidence_car_id(name)));
CREATE POLICY ltp_evidence_auditee_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='audit-evidence' AND public.ltp_evidence_path_matches(name) AND public.auditee_can_edit_ltp(public.ltp_evidence_car_id(name)));
CREATE POLICY ltp_evidence_auditee_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='audit-evidence' AND public.ltp_evidence_path_matches(name) AND public.auditee_can_edit_ltp(public.ltp_evidence_car_id(name)));

REVOKE ALL ON FUNCTION public.safe_uuid(text),public.safe_date(text),public.auditee_can_edit_ltp(uuid),public.ltp_evidence_car_id(text),public.ltp_evidence_action_id(text),public.ltp_evidence_state(text),public.ltp_evidence_path_matches(text),public.save_ltp_auditee_draft(uuid,integer,text,text,jsonb,jsonb,jsonb),public.register_ltp_action_evidence(uuid,text,text,text,text,bigint),public.delete_ltp_action_evidence(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.safe_uuid(text),public.safe_date(text),public.ltp_evidence_car_id(text),public.ltp_evidence_action_id(text),public.ltp_evidence_state(text),public.ltp_evidence_path_matches(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auditee_can_edit_ltp(uuid),public.save_ltp_auditee_draft(uuid,integer,text,text,jsonb,jsonb,jsonb),public.register_ltp_action_evidence(uuid,text,text,text,text,bigint),public.delete_ltp_action_evidence(uuid) TO authenticated;
