-- Batch 7c: Auditee submit -> Section Manager review foundation.
-- This migration adds only the controlled submit transition and manager review read foundation.
-- Manager approve/reject, Auditor/Admin workflow, notifications, Finding sync, and LTP close remain deferred.

CREATE OR REPLACE FUNCTION public.section_manager_can_review_ltp(p_car_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT public.current_identity_type()='SECTION_MANAGER' AND EXISTS (
    SELECT 1
    FROM public.cars c
    JOIN public.section_identity_assignments a
      ON a.user_id=auth.uid()
     AND a.seksi_id=c.seksi_auditee_id
     AND a.assignment_type='SECTION_MANAGER'
     AND a.status='Aktif'
    WHERE c.id=p_car_id
      AND c.status='MANAGER_REVIEW'
  )
$$;

CREATE OR REPLACE FUNCTION public.ltp_submit_blockers(p_car_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_car public.cars%ROWTYPE;
  v_category text;
  v_blockers text[] := ARRAY[]::text[];
  v_why_count integer;
BEGIN
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id;
  IF NOT FOUND THEN
    RETURN ARRAY['LTP tidak ditemukan.'];
  END IF;

  SELECT f.kategori INTO v_category
  FROM public.findings f
  WHERE f.id=v_car.finding_id;

  IF v_car.seksi_auditee_id IS NULL THEN
    v_blockers:=array_append(v_blockers,'Seksi Auditee belum dapat ditentukan.');
  ELSIF NOT EXISTS (
    SELECT 1
    FROM public.section_identity_assignments a
    JOIN public.user_profiles p ON p.id=a.user_id
    WHERE a.seksi_id=v_car.seksi_auditee_id
      AND a.assignment_type='SECTION_MANAGER'
      AND a.status='Aktif'
      AND p.identity_type='SECTION_MANAGER'
      AND p.status='Aktif'
  ) THEN
    v_blockers:=array_append(v_blockers,'Belum ada Section Manager aktif untuk seksi Auditee ini.');
  END IF;

  IF COALESCE(btrim(v_car.dampak_temuan),'')='' THEN
    v_blockers:=array_append(v_blockers,'Dampak Temuan wajib diisi.');
  END IF;
  IF COALESCE(btrim(v_car.manfaat_perbaikan),'')='' THEN
    v_blockers:=array_append(v_blockers,'Manfaat Perbaikan wajib diisi.');
  END IF;

  SELECT count(*)::integer INTO v_why_count
  FROM public.car_why_analysis w
  WHERE w.car_id=p_car_id;

  IF v_category IN ('A','B') AND v_why_count<3 THEN
    v_blockers:=array_append(v_blockers,'Kategori A/B memerlukan minimal 3 tingkat Why-Why.');
  ELSIF v_category='C' AND v_why_count>0 THEN
    v_blockers:=array_append(v_blockers,'Kategori C tidak boleh memiliki analisa Why-Why.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.car_actions a
    WHERE a.car_id=p_car_id AND a.action_type='CORRECTIVE'
  ) THEN
    v_blockers:=array_append(v_blockers,'Tindakan Korektif wajib diisi.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.car_actions a
    WHERE a.car_id=p_car_id AND COALESCE(btrim(a.pic),'')=''
  ) THEN
    v_blockers:=array_append(v_blockers,'Setiap tindakan yang diisi wajib memiliki PIC.');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.car_actions a
    WHERE a.car_id=p_car_id AND a.due_date IS NULL
  ) THEN
    v_blockers:=array_append(v_blockers,'Setiap tindakan yang diisi wajib memiliki Due Date.');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.car_actions a
    WHERE a.car_id=p_car_id
      AND NOT (
        EXISTS (
          SELECT 1 FROM public.car_action_evidence e
          WHERE e.action_id=a.id AND e.evidence_state='BEFORE_AFTER'
        )
        OR (
          EXISTS (
            SELECT 1 FROM public.car_action_evidence e
            WHERE e.action_id=a.id AND e.evidence_state='BEFORE'
          )
          AND EXISTS (
            SELECT 1 FROM public.car_action_evidence e
            WHERE e.action_id=a.id AND e.evidence_state='AFTER'
          )
        )
      )
  ) THEN
    v_blockers:=array_append(v_blockers,'Setiap tindakan yang diisi wajib memiliki Bukti Sebelum dan Bukti Sesudah, atau satu Perbandingan Before vs After.');
  END IF;

  RETURN v_blockers;
END
$$;

CREATE OR REPLACE FUNCTION public.submit_ltp_to_manager(
  p_car_id uuid,
  p_expected_revision integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_car public.cars%ROWTYPE;
  v_blockers text[];
  v_new_revision integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan';
  END IF;

  SELECT * INTO v_car
  FROM public.cars
  WHERE id=p_car_id
  FOR UPDATE;

  IF NOT FOUND OR NOT public.auditee_can_edit_ltp(p_car_id) THEN
    RAISE EXCEPTION 'Auditee tidak diizinkan submit LTP ini';
  END IF;

  IF v_car.revision_version IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'LTP_STALE_REVISION';
  END IF;

  v_blockers:=public.ltp_submit_blockers(p_car_id);
  IF cardinality(v_blockers)>0 THEN
    RAISE EXCEPTION 'LTP_SUBMIT_BLOCKED: %',array_to_string(v_blockers,' | ');
  END IF;

  UPDATE public.cars
  SET status='MANAGER_REVIEW',
      revision_version=revision_version+1
  WHERE id=p_car_id
  RETURNING revision_version INTO v_new_revision;

  INSERT INTO public.car_workflow_events(
    car_id,event_type,actor_user_id,actor_identity_type,comment,from_status,to_status
  ) VALUES (
    p_car_id,'AUDITEE_SUBMITTED_TO_MANAGER',auth.uid(),public.current_identity_type(),NULL,v_car.status,'MANAGER_REVIEW'
  );

  RETURN v_new_revision;
END
$$;

CREATE OR REPLACE FUNCTION public.get_ltp_context(p_car_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT jsonb_build_object(
    'ltp',jsonb_build_object(
      'id',c.id,'finding_id',c.finding_id,'kode_ltp',c.kode_car,'status',c.status,
      'seksi_auditee_id',c.seksi_auditee_id,'revision_version',c.revision_version,
      'dampak_temuan',c.dampak_temuan,'manfaat_perbaikan',c.manfaat_perbaikan,
      'auditor_verification_result',c.auditor_verification_result,'created_at',c.created_at
    ),
    'finding',jsonb_build_object(
      'kode_audit',f.kode_audit,'kode_temuan',f.kode_temuan,'kategori',f.kategori,
      'problem',f.problem,'location',f.location,'objective_evidence',f.objective_evidence,
      'reference',f.reference,'saran_perbaikan',f.saran_perbaikan,
      'auditee_area',f.auditee_area,'tanggal_temuan',f.tanggal_temuan
    ),
    'section',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'nama',s.nama,'kepala_seksi',s.kepala_seksi) END,
    'process',CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'nama',p.nama_proses) END,
    'team',CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'kode',t.kode_tim,'nama',t.nama_tim) END,
    'team_leader',CASE WHEN lead.id IS NULL THEN NULL ELSE jsonb_build_object('id',lead.id,'nama',lead.nama) END,
    'permissions',jsonb_build_object(
      'can_edit_auditee',public.auditee_can_edit_ltp(c.id),
      'can_submit_auditee',public.auditee_can_edit_ltp(c.id),
      'can_review_manager',public.section_manager_can_review_ltp(c.id)
    ),
    'submit_blockers',public.ltp_submit_blockers(c.id),
    'why_analysis',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',w.id,'level',w.level,'teks',w.teks) ORDER BY w.level)
      FROM public.car_why_analysis w WHERE w.car_id=c.id
    ),'[]'::jsonb),
    'actions',COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',a.id,'action_type',a.action_type,'description',a.description,'pic',a.pic,'due_date',a.due_date,
          'evidence',COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',e.id,'action_id',e.action_id,'evidence_state',e.evidence_state,
                'file_name',e.file_name,'path',e.path,'mime_type',e.mime_type,
                'size_bytes',e.size_bytes,'uploaded_at',e.uploaded_at
              ) ORDER BY e.uploaded_at
            ) FROM public.car_action_evidence e WHERE e.action_id=a.id
          ),'[]'::jsonb)
        ) ORDER BY CASE a.action_type WHEN 'TEMPORARY' THEN 1 WHEN 'CORRECTIVE' THEN 2 ELSE 3 END
      ) FROM public.car_actions a WHERE a.car_id=c.id
    ),'[]'::jsonb),
    'system_revisions',COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id',sr.id,'kategori',sr.kategori,'nama_dokumen',sr.nama_dokumen,'created_at',sr.created_at)
        ORDER BY sr.created_at
      ) FROM public.car_system_revisions sr WHERE sr.car_id=c.id
    ),'[]'::jsonb),
    'workflow_events',COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',e.id,'event_type',e.event_type,'actor_user_id',e.actor_user_id,
          'actor_identity_type',e.actor_identity_type,'actor_name',up.display_name,
          'comment',e.comment,'from_status',e.from_status,'to_status',e.to_status,'created_at',e.created_at
        ) ORDER BY e.created_at
      )
      FROM public.car_workflow_events e
      LEFT JOIN public.user_profiles up ON up.id=e.actor_user_id
      WHERE e.car_id=c.id
    ),'[]'::jsonb)
  )
  FROM public.cars c
  JOIN public.findings f ON f.id=c.finding_id
  JOIN public.audit_instruction_rows r ON r.id=f.instruction_row_id
  LEFT JOIN public.seksi s ON s.id=c.seksi_auditee_id
  LEFT JOIN public.proses p ON p.id=r.proses_id
  LEFT JOIN public.audit_team_masters t ON t.id=r.team_master_id
  LEFT JOIN public.audit_team_master_members lm ON lm.team_id=t.id AND lm.is_team_leader
  LEFT JOIN public.auditors lead ON lead.id=lm.auditor_id
  WHERE c.id=p_car_id AND public.car_accessible_to_current_identity(c.id)
$$;

REVOKE ALL ON FUNCTION public.section_manager_can_review_ltp(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ltp_submit_blockers(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.submit_ltp_to_manager(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ltp_to_manager(uuid,integer) TO authenticated;
