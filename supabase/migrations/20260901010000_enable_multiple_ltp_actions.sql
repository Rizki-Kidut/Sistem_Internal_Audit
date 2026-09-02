-- Batch 7h: multiple independently evidenced actions of the same semantic type.
-- Existing action UUIDs and evidence ownership are preserved; action UUID remains the evidence-set identity.

CREATE TEMP TABLE ltp_7h_backfill_audit AS
SELECT
  (SELECT count(*) FROM public.car_actions) AS action_count,
  (SELECT count(*) FROM public.car_action_evidence) AS evidence_count;

ALTER TABLE public.car_actions ADD COLUMN sort_order integer;

WITH ranked AS (
  SELECT id,row_number() OVER (
    PARTITION BY car_id,action_type ORDER BY created_at,id
  )::integer AS canonical_order
  FROM public.car_actions
)
UPDATE public.car_actions a
SET sort_order=ranked.canonical_order
FROM ranked
WHERE ranked.id=a.id;

ALTER TABLE public.car_actions ALTER COLUMN sort_order SET NOT NULL;
ALTER TABLE public.car_actions
  ADD CONSTRAINT car_actions_sort_order_positive CHECK (sort_order>0);
ALTER TABLE public.car_actions
  DROP CONSTRAINT car_actions_car_id_action_type_key;
ALTER TABLE public.car_actions
  ADD CONSTRAINT car_actions_car_type_sort_order_key
  UNIQUE (car_id,action_type,sort_order) DEFERRABLE INITIALLY DEFERRED;

DO $$
DECLARE v_expected_actions bigint; v_expected_evidence bigint;
BEGIN
  SELECT action_count,evidence_count INTO v_expected_actions,v_expected_evidence FROM ltp_7h_backfill_audit;
  IF EXISTS (SELECT 1 FROM public.car_actions WHERE sort_order IS NULL OR sort_order<=0) THEN
    RAISE EXCEPTION 'Batch 7h backfill assertion failed: invalid sort_order';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.car_actions GROUP BY car_id,action_type,sort_order HAVING count(*)>1
  ) THEN RAISE EXCEPTION 'Batch 7h backfill assertion failed: duplicate action order'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.car_action_evidence e LEFT JOIN public.car_actions a ON a.id=e.action_id WHERE a.id IS NULL
  ) THEN RAISE EXCEPTION 'Batch 7h backfill assertion failed: orphan evidence'; END IF;
  IF (SELECT count(*) FROM public.car_actions)<>v_expected_actions THEN
    RAISE EXCEPTION 'Batch 7h backfill assertion failed: action count changed';
  END IF;
  IF (SELECT count(*) FROM public.car_action_evidence)<>v_expected_evidence THEN
    RAISE EXCEPTION 'Batch 7h backfill assertion failed: evidence count changed';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.save_ltp_auditee_draft(
  p_car_id uuid,p_expected_revision integer,p_dampak_temuan text,p_manfaat_perbaikan text,
  p_why_analysis jsonb,p_actions jsonb,p_system_revisions jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_car public.cars%ROWTYPE; v_category text; v_item jsonb; v_type text; v_description text;
  v_raw_id text; v_id uuid; v_payload_order integer:=0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autentikasi diperlukan'; END IF;
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id FOR UPDATE;
  IF NOT FOUND OR NOT public.auditee_can_edit_ltp(p_car_id) THEN RAISE EXCEPTION 'Auditee tidak diizinkan mengubah LTP ini'; END IF;
  IF v_car.revision_version IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'LTP_STALE_REVISION'; END IF;
  IF jsonb_typeof(COALESCE(p_why_analysis,'[]'))<>'array' OR jsonb_typeof(COALESCE(p_actions,'[]'))<>'array'
    OR jsonb_typeof(COALESCE(p_system_revisions,'[]'))<>'array' THEN RAISE EXCEPTION 'Payload Draft LTP tidak valid'; END IF;
  SELECT f.kategori INTO v_category FROM public.findings f WHERE f.id=v_car.finding_id;
  IF v_category='C' AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_why_analysis,'[]')) x WHERE btrim(x->>'teks')<>'')
    THEN RAISE EXCEPTION 'Kategori C tidak boleh memiliki analisa Why-Why'; END IF;

  CREATE TEMP TABLE ltp_action_payload(
    action_id uuid,action_type text,sort_order integer,payload_order integer,description text,pic text,due_date date
  ) ON COMMIT DROP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_actions,'[]')) LOOP
    v_payload_order:=v_payload_order+1;
    v_type:=v_item->>'action_type'; v_description:=btrim(COALESCE(v_item->>'description',''));
    IF v_type NOT IN ('TEMPORARY','CORRECTIVE','PREVENTIVE') THEN RAISE EXCEPTION 'Jenis tindakan LTP tidak valid'; END IF;
    v_raw_id:=NULLIF(btrim(COALESCE(v_item->>'id','')),'');
    v_id:=public.safe_uuid(v_raw_id);
    IF v_raw_id IS NOT NULL AND v_id IS NULL THEN RAISE EXCEPTION 'ID tindakan LTP tidak valid'; END IF;
    IF v_description='' THEN CONTINUE; END IF;
    IF v_id IS NOT NULL AND EXISTS(SELECT 1 FROM ltp_action_payload WHERE action_id=v_id) THEN
      RAISE EXCEPTION 'ID tindakan LTP duplikat dalam payload';
    END IF;
    INSERT INTO ltp_action_payload(action_id,action_type,sort_order,payload_order,description,pic,due_date)
    VALUES(v_id,v_type,1,v_payload_order,v_description,NULLIF(btrim(COALESCE(v_item->>'pic','')),''),public.safe_date(v_item->>'due_date'));
  END LOOP;

  WITH ordered AS (
    SELECT ctid,row_number() OVER (PARTITION BY action_type ORDER BY payload_order)::integer AS canonical_order
    FROM ltp_action_payload
  )
  UPDATE ltp_action_payload p SET sort_order=o.canonical_order FROM ordered o WHERE p.ctid=o.ctid;

  IF EXISTS (
    SELECT 1 FROM ltp_action_payload p
    LEFT JOIN public.car_actions a ON a.id=p.action_id
    WHERE p.action_id IS NOT NULL AND (a.id IS NULL OR a.car_id<>p_car_id OR a.action_type<>p.action_type)
  ) THEN RAISE EXCEPTION 'Tindakan tidak ditemukan, berasal dari LTP lain, atau jenis tindakan berubah'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.car_actions a
    WHERE a.car_id=p_car_id AND NOT EXISTS(SELECT 1 FROM ltp_action_payload p WHERE p.action_id=a.id)
      AND EXISTS(SELECT 1 FROM public.car_action_evidence e WHERE e.action_id=a.id)
  ) THEN
    RAISE EXCEPTION 'Tindakan yang memiliki evidence tidak dapat dihapus. Hapus evidence pada tindakan tersebut terlebih dahulu.';
  END IF;

  UPDATE public.cars SET dampak_temuan=NULLIF(btrim(p_dampak_temuan),''),manfaat_perbaikan=NULLIF(btrim(p_manfaat_perbaikan),'') WHERE id=p_car_id;
  DELETE FROM public.car_why_analysis WHERE car_id=p_car_id;
  IF v_category IN ('A','B') THEN
    INSERT INTO public.car_why_analysis(car_id,level,teks)
    SELECT p_car_id,row_number() OVER (ORDER BY ord)::integer,btrim(value->>'teks')
    FROM jsonb_array_elements(COALESCE(p_why_analysis,'[]')) WITH ORDINALITY q(value,ord)
    WHERE btrim(value->>'teks')<>'';
  END IF;

  DELETE FROM public.car_actions a
  WHERE a.car_id=p_car_id AND NOT EXISTS(SELECT 1 FROM ltp_action_payload p WHERE p.action_id=a.id);
  UPDATE public.car_actions a
  SET description=p.description,pic=p.pic,due_date=p.due_date,sort_order=p.sort_order
  FROM ltp_action_payload p WHERE p.action_id=a.id;
  INSERT INTO public.car_actions(car_id,action_type,sort_order,description,pic,due_date)
  SELECT p_car_id,action_type,sort_order,description,pic,due_date
  FROM ltp_action_payload WHERE action_id IS NULL;

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

CREATE OR REPLACE FUNCTION public.ltp_submit_blockers(p_car_id uuid)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE
  v_car public.cars%ROWTYPE; v_category text; v_blockers text[]:=ARRAY[]::text[];
  v_why_count integer; v_action record; v_label text; v_has_before boolean; v_has_after boolean; v_has_combined boolean;
BEGIN
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id;
  IF NOT FOUND THEN RETURN ARRAY['LTP tidak ditemukan.']; END IF;
  SELECT f.kategori INTO v_category FROM public.findings f WHERE f.id=v_car.finding_id;
  IF v_car.seksi_auditee_id IS NULL THEN v_blockers:=array_append(v_blockers,'Seksi Auditee belum dapat ditentukan.');
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.section_identity_assignments a JOIN public.user_profiles p ON p.id=a.user_id
    WHERE a.seksi_id=v_car.seksi_auditee_id AND a.assignment_type='SECTION_MANAGER' AND a.status='Aktif'
      AND p.identity_type='SECTION_MANAGER' AND p.status='Aktif'
  ) THEN v_blockers:=array_append(v_blockers,'Belum ada Section Manager aktif untuk seksi Auditee ini.'); END IF;
  IF COALESCE(btrim(v_car.dampak_temuan),'')='' THEN v_blockers:=array_append(v_blockers,'Dampak Temuan wajib diisi.'); END IF;
  IF COALESCE(btrim(v_car.manfaat_perbaikan),'')='' THEN v_blockers:=array_append(v_blockers,'Manfaat Perbaikan wajib diisi.'); END IF;
  SELECT count(*)::integer INTO v_why_count FROM public.car_why_analysis WHERE car_id=p_car_id;
  IF v_category IN ('A','B') AND v_why_count<3 THEN v_blockers:=array_append(v_blockers,'Kategori A/B memerlukan minimal 3 tingkat Why-Why.');
  ELSIF v_category='C' AND v_why_count>0 THEN v_blockers:=array_append(v_blockers,'Kategori C tidak boleh memiliki analisa Why-Why.'); END IF;
  IF NOT EXISTS(SELECT 1 FROM public.car_actions WHERE car_id=p_car_id AND action_type='CORRECTIVE') THEN
    v_blockers:=array_append(v_blockers,'Tindakan Korektif wajib diisi.');
  END IF;
  FOR v_action IN SELECT * FROM public.car_actions WHERE car_id=p_car_id
    ORDER BY CASE action_type WHEN 'TEMPORARY' THEN 1 WHEN 'CORRECTIVE' THEN 2 ELSE 3 END,sort_order,id
  LOOP
    v_label:=CASE v_action.action_type WHEN 'TEMPORARY' THEN 'Tindakan Sementara' WHEN 'CORRECTIVE' THEN 'Tindakan Korektif' ELSE 'Tindakan Pencegahan' END||' #'||v_action.sort_order;
    IF COALESCE(btrim(v_action.pic),'')='' THEN v_blockers:=array_append(v_blockers,v_label||' belum memiliki PIC.'); END IF;
    IF v_action.due_date IS NULL THEN v_blockers:=array_append(v_blockers,v_label||' belum memiliki Due Date.'); END IF;
    SELECT bool_or(evidence_state='BEFORE'),bool_or(evidence_state='AFTER'),bool_or(evidence_state='BEFORE_AFTER')
      INTO v_has_before,v_has_after,v_has_combined FROM public.car_action_evidence WHERE action_id=v_action.id;
    IF NOT (COALESCE(v_has_combined,false) OR (COALESCE(v_has_before,false) AND COALESCE(v_has_after,false))) THEN
      v_blockers:=array_append(v_blockers,v_label||' wajib memiliki Evidence Before dan Evidence After, atau satu Before vs After.');
    END IF;
  END LOOP;
  RETURN v_blockers;
END $$;

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
      'can_review_auditor',c.status IN ('AUDITOR_REVIEW','AUDITOR_RETURNED')
        AND public.current_identity_type()='AUDITOR'
        AND public.auditor_user_can_receive_finding(auth.uid(),c.finding_id),
      'can_review_admin',c.status='ADMIN_REVIEW' AND public.current_identity_type()='ADMIN'
    ),
    'submit_blockers',public.ltp_submit_blockers(c.id),
    'manager_approve_blockers',public.ltp_manager_decision_blockers(c.id,'APPROVE'),
    'manager_return_blockers',public.ltp_manager_decision_blockers(c.id,'RETURN'),
    'auditor_open_blockers',public.ltp_auditor_verification_blockers(c.id,'OPEN'),
    'auditor_close_blockers',public.ltp_auditor_verification_blockers(c.id,'CLOSE'),
    'admin_return_blockers',public.ltp_admin_decision_blockers(c.id,'RETURN'),
    'admin_approve_blockers',public.ltp_admin_decision_blockers(c.id,'APPROVE'),
    'why_analysis',COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',w.id,'level',w.level,'teks',w.teks) ORDER BY w.level)
      FROM public.car_why_analysis w WHERE w.car_id=c.id
    ),'[]'::jsonb),
    'actions',COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',a.id,'action_type',a.action_type,'sort_order',a.sort_order,'description',a.description,'pic',a.pic,'due_date',a.due_date,
          'evidence',COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',e.id,'action_id',e.action_id,'evidence_state',e.evidence_state,
                'file_name',e.file_name,'path',e.path,'mime_type',e.mime_type,
                'size_bytes',e.size_bytes,'uploaded_at',e.uploaded_at
              ) ORDER BY e.uploaded_at
            ) FROM public.car_action_evidence e WHERE e.action_id=a.id
          ),'[]'::jsonb)
        ) ORDER BY CASE a.action_type WHEN 'TEMPORARY' THEN 1 WHEN 'CORRECTIVE' THEN 2 ELSE 3 END,a.sort_order,a.id
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


REVOKE ALL ON FUNCTION public.save_ltp_auditee_draft(uuid,integer,text,text,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_ltp_auditee_draft(uuid,integer,text,text,jsonb,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ltp_submit_blockers(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.get_ltp_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_ltp_context(uuid) TO authenticated;
