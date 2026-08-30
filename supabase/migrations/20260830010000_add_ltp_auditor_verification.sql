-- Batch 7e: Auditor verification. OPEN returns through Auditee/Manager; CLOSE advances to Admin/QMS.

CREATE OR REPLACE FUNCTION public.ltp_auditor_verification_blockers(p_car_id uuid,p_result text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_car public.cars%ROWTYPE;
  v_result text:=upper(btrim(COALESCE(p_result,'')));
  v_blockers text[]:=ARRAY[]::text[];
BEGIN
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id;
  IF NOT FOUND THEN
    RETURN ARRAY['LTP tidak ditemukan.'];
  END IF;

  IF v_car.status<>'AUDITOR_REVIEW' THEN
    RETURN ARRAY['LTP tidak berada pada tahap verifikasi Auditor.'];
  END IF;

  IF v_result='OPEN' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.section_identity_assignments a
      JOIN public.user_profiles p ON p.id=a.user_id
      WHERE a.seksi_id=v_car.seksi_auditee_id
        AND a.assignment_type='AUDIT_PIC'
        AND a.status='Aktif'
        AND p.identity_type='AUDITEE'
        AND p.status='Aktif'
    ) THEN
      v_blockers:=array_append(v_blockers,'Belum ada Auditee aktif untuk menerima revisi LTP ini.');
    END IF;
  ELSIF v_result='CLOSE' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.identity_type='ADMIN' AND p.status='Aktif'
    ) THEN
      v_blockers:=array_append(v_blockers,'Belum ada Admin aktif untuk menerima approval LTP ini.');
    END IF;
  ELSE
    v_blockers:=array_append(v_blockers,'Hasil verifikasi Auditor tidak valid.');
  END IF;

  RETURN v_blockers;
END
$$;

CREATE OR REPLACE FUNCTION public.auditor_verify_ltp(
  p_car_id uuid,
  p_expected_revision integer,
  p_result text,
  p_comment text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_car public.cars%ROWTYPE;
  v_result text:=upper(btrim(COALESCE(p_result,'')));
  v_comment text:=NULLIF(btrim(COALESCE(p_comment,'')),'');
  v_blockers text[];
  v_target_status text;
  v_event_type text;
  v_new_revision integer;
  v_kode_audit text;
  v_recipient record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan';
  END IF;

  SELECT * INTO v_car
  FROM public.cars
  WHERE id=p_car_id
  FOR UPDATE;

  IF NOT FOUND OR v_car.status<>'AUDITOR_REVIEW' THEN
    RAISE EXCEPTION 'LTP tidak berada pada tahap verifikasi Auditor';
  END IF;

  IF public.current_identity_type()<>'AUDITOR'
     OR NOT public.auditor_user_can_receive_finding(auth.uid(),v_car.finding_id) THEN
    RAISE EXCEPTION 'Auditor tidak diizinkan memverifikasi LTP ini';
  END IF;

  IF v_car.revision_version IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'LTP_STALE_REVISION';
  END IF;

  IF v_result NOT IN ('OPEN','CLOSE') THEN
    RAISE EXCEPTION 'Hasil verifikasi Auditor tidak valid';
  END IF;

  IF v_result='OPEN' AND v_comment IS NULL THEN
    RAISE EXCEPTION 'LTP_AUDITOR_OPEN_COMMENT_REQUIRED';
  END IF;

  v_blockers:=public.ltp_auditor_verification_blockers(p_car_id,v_result);
  IF cardinality(v_blockers)>0 THEN
    IF v_result='OPEN' THEN
      RAISE EXCEPTION 'LTP_AUDITOR_OPEN_BLOCKED: %',array_to_string(v_blockers,' | ');
    ELSE
      RAISE EXCEPTION 'LTP_AUDITOR_CLOSE_BLOCKED: %',array_to_string(v_blockers,' | ');
    END IF;
  END IF;

  IF v_result='OPEN' THEN
    v_target_status:='AUDITEE_RETURNED';
    v_event_type:='AUDITOR_VERIFIED_OPEN_TO_AUDITEE';
  ELSE
    v_target_status:='ADMIN_REVIEW';
    v_event_type:='AUDITOR_VERIFIED_CLOSE_TO_ADMIN';
  END IF;

  SELECT f.kode_audit INTO v_kode_audit
  FROM public.findings f
  WHERE f.id=v_car.finding_id;

  UPDATE public.cars
  SET status=v_target_status,
      auditor_verification_result=v_result,
      revision_version=revision_version+1
  WHERE id=p_car_id
  RETURNING revision_version INTO v_new_revision;

  INSERT INTO public.car_workflow_events(
    car_id,event_type,actor_user_id,actor_identity_type,comment,from_status,to_status
  ) VALUES (
    p_car_id,v_event_type,auth.uid(),'AUDITOR',v_comment,v_car.status,v_target_status
  );

  UPDATE public.notifications
  SET read_at=COALESCE(read_at,now())
  WHERE finding_id=v_car.finding_id
    AND notification_type='LTP_AUDITOR_REVIEW'
    AND read_at IS NULL;

  IF v_result='OPEN' THEN
    FOR v_recipient IN
      SELECT DISTINCT a.user_id
      FROM public.section_identity_assignments a
      JOIN public.user_profiles p ON p.id=a.user_id
      WHERE a.seksi_id=v_car.seksi_auditee_id
        AND a.assignment_type='AUDIT_PIC'
        AND a.status='Aktif'
        AND p.identity_type='AUDITEE'
        AND p.status='Aktif'
    LOOP
      INSERT INTO public.notifications(
        recipient_user_id,finding_id,notification_type,title,message
      ) VALUES (
        v_recipient.user_id,v_car.finding_id,'LTP_AUDITEE_RETURNED',
        'LTP dikembalikan untuk revisi',
        v_kode_audit||' · '||v_car.kode_car||' · Catatan Auditor: '||v_comment
      );
    END LOOP;
  ELSE
    FOR v_recipient IN
      SELECT p.id AS user_id
      FROM public.user_profiles p
      WHERE p.identity_type='ADMIN' AND p.status='Aktif'
    LOOP
      INSERT INTO public.notifications(
        recipient_user_id,finding_id,notification_type,title,message
      ) VALUES (
        v_recipient.user_id,v_car.finding_id,'LTP_ADMIN_REVIEW',
        'LTP menunggu approval Admin/QMS',
        v_kode_audit||' · '||v_car.kode_car
      );
    END LOOP;
  END IF;

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
      'can_review_manager',public.section_manager_can_review_ltp(c.id),
      'can_review_auditor',c.status='AUDITOR_REVIEW'
        AND public.current_identity_type()='AUDITOR'
        AND public.auditor_user_can_receive_finding(auth.uid(),c.finding_id)
    ),
    'submit_blockers',public.ltp_submit_blockers(c.id),
    'manager_approve_blockers',public.ltp_manager_decision_blockers(c.id,'APPROVE'),
    'manager_return_blockers',public.ltp_manager_decision_blockers(c.id,'RETURN'),
    'auditor_open_blockers',public.ltp_auditor_verification_blockers(c.id,'OPEN'),
    'auditor_close_blockers',public.ltp_auditor_verification_blockers(c.id,'CLOSE'),
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
        ) ORDER BY e.created_at,e.id
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

REVOKE ALL ON FUNCTION public.ltp_auditor_verification_blockers(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.auditor_verify_ltp(uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.auditor_verify_ltp(uuid,integer,text,text) TO authenticated;
