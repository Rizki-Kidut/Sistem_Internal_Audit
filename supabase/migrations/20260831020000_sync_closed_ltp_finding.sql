-- Batch 7g: synchronize only the terminal LTP state to the Finding operational status.

CREATE OR REPLACE FUNCTION public.protect_finding_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_identity text:=public.current_identity_type();
  v_changed jsonb;
  v_plor_context text:=COALESCE(current_setting('certitrack.finding_plor_save',true),'');
  v_reason text:=NULLIF(btrim(COALESCE(current_setting('certitrack.finding_plor_reason',true),'')),'');
BEGIN
 IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at Temuan tidak dapat diubah';END IF;
 IF COALESCE(current_setting('certitrack.finding_ltp_final_sync',true),'')='1' THEN
  IF OLD.status NOT IN('Open','CAR Submitted','Verifikasi','Overdue') OR NEW.status<>'Closed' THEN RAISE EXCEPTION 'Sinkronisasi final LTP hanya boleh menutup Finding nonterminal';END IF;
  IF NEW.revision_version<>OLD.revision_version+1 THEN RAISE EXCEPTION 'Versi Finding untuk sinkronisasi final LTP tidak valid';END IF;
  IF (to_jsonb(NEW)-ARRAY['status','revision_version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision_version','updated_at']) THEN RAISE EXCEPTION 'Sinkronisasi final LTP hanya boleh mengubah status Finding';END IF;
  RETURN NEW;
 END IF;
 IF COALESCE(current_setting('certitrack.finding_sync',true),'')='1' THEN
  IF OLD.review_status NOT IN('DRAFT','REVISION_REQUIRED') THEN RAISE EXCEPTION 'Kategori sumber terkunci setelah Finding dikirim untuk review';END IF;
  IF (to_jsonb(NEW)-ARRAY['kategori','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['kategori','updated_at']) THEN RAISE EXCEPTION 'Sinkronisasi sumber hanya boleh mengubah kategori Finding';END IF;RETURN NEW;
 END IF;
 IF COALESCE(current_setting('certitrack.finding_workflow',true),'')='1' THEN
  IF OLD.review_status='DRAFT' AND NEW.review_status='LEAD_REVIEW' AND public.current_auditor_is_team_leader(OLD.id) AND (to_jsonb(NEW)-ARRAY['review_status','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='REVISION_REQUIRED' AND NEW.review_status='LEAD_REVIEW' AND public.current_auditor_is_team_leader(OLD.id) AND (to_jsonb(NEW)-ARRAY['review_status','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='LEAD_REVIEW' AND NEW.review_status='REVISION_REQUIRED' AND public.current_auditor_is_lead_auditor() AND (to_jsonb(NEW)-ARRAY['review_status','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='LEAD_REVIEW' AND NEW.review_status='READY_FOR_RELEASE' AND public.current_auditor_is_lead_auditor() AND (to_jsonb(NEW)-ARRAY['kode_temuan','review_status','approved_at','approved_by','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['kode_temuan','review_status','approved_at','approved_by','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='LEAD_REVIEW' AND NEW.review_status='ANNULLED' AND public.current_auditor_is_lead_auditor() AND (to_jsonb(NEW)-ARRAY['review_status','annulled_at','annulled_by','annul_reason','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','annulled_at','annulled_by','annul_reason','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='READY_FOR_RELEASE' AND NEW.review_status='PUBLISHED' AND public.is_admin_identity() AND (to_jsonb(NEW)-ARRAY['review_status','released_at','released_by','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','released_at','released_by','revision_version','updated_at']) THEN RETURN NEW;END IF;
  RAISE EXCEPTION 'Mutasi workflow Finding tidak sesuai aksi/otoritas resmi';
 END IF;
 IF v_plor_context=OLD.id::text THEN
  IF OLD.review_status NOT IN('DRAFT','REVISION_REQUIRED') THEN RAISE EXCEPTION 'PLOR tidak dapat diedit pada status %',OLD.review_status;END IF;
  IF v_identity='AUDITOR' AND NOT public.auditor_can_access_instruction_row(OLD.instruction_row_id) THEN RAISE EXCEPTION 'Temuan bukan milik Tim Auditor';
  ELSIF v_identity<>'AUDITOR' AND v_identity<>'ADMIN' THEN RAISE EXCEPTION 'Identitas tidak diizinkan mengedit PLOR';END IF;
  IF v_identity='ADMIN' AND length(regexp_replace(COALESCE(v_reason,''),'[[:space:]]','','g'))<10 THEN RAISE EXCEPTION 'Alasan perubahan Admin/QMS wajib minimal 10 karakter non-spasi';END IF;
  IF (to_jsonb(NEW)-ARRAY['klasifikasi_dis','problem','location','objective_evidence','reference','saran_perbaikan','auditor_penemu_id','auditee_area','tanggal_temuan','revision_version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['klasifikasi_dis','problem','location','objective_evidence','reference','saran_perbaikan','auditor_penemu_id','auditee_area','tanggal_temuan','revision_version','updated_at']) THEN RAISE EXCEPTION 'save_finding_plor hanya boleh mengubah field PLOR yang disetujui';END IF;
  IF NEW.auditor_penemu_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.audit_instruction_rows r JOIN public.audit_team_master_members m ON m.team_id=r.team_master_id WHERE r.id=NEW.instruction_row_id AND m.auditor_id=NEW.auditor_penemu_id) THEN RAISE EXCEPTION 'Auditor Penemu harus anggota Tim Audit';END IF;
  IF NEW.revision_version<>OLD.revision_version THEN RAISE EXCEPTION 'Versi Temuan tidak valid';END IF;
  v_changed:=(SELECT COALESCE(jsonb_object_agg(k,v),'{}') FROM jsonb_each(to_jsonb(NEW)-ARRAY['updated_at','revision_version']) n(k,v) WHERE v IS DISTINCT FROM (to_jsonb(OLD)->k));
  NEW.revision_version:=OLD.revision_version+1;
  INSERT INTO public.finding_review_events(finding_id,event_type,actor_user_id,actor_identity_type,comment,changed_fields,before_values,after_values)
  VALUES(OLD.id,'PLOR_EDITED',auth.uid(),v_identity,v_reason,v_changed,to_jsonb(OLD),to_jsonb(NEW));
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'PLOR hanya dapat diubah melalui save_finding_plor';
END
$$;

CREATE OR REPLACE FUNCTION public.sync_finding_closed_from_ltp(p_car_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_car public.cars%ROWTYPE;
  v_finding public.findings%ROWTYPE;
  v_previous_context text:=current_setting('certitrack.finding_ltp_final_sync',true);
BEGIN
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LTP_FINAL_SYNC_CAR_NOT_FOUND'; END IF;

  SELECT * INTO v_finding FROM public.findings WHERE id=v_car.finding_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'LTP_FINAL_SYNC_FINDING_NOT_FOUND'; END IF;
  IF v_car.status<>'CLOSED' THEN RAISE EXCEPTION 'LTP_FINAL_SYNC_NOT_CLOSED'; END IF;
  IF v_car.auditor_verification_result IS DISTINCT FROM 'CLOSE' THEN RAISE EXCEPTION 'LTP_FINAL_SYNC_AUDITOR_NOT_CLOSE'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.car_workflow_events e
    WHERE e.car_id=v_car.id AND e.event_type='ADMIN_APPROVED_LTP'
      AND (e.from_status IS NULL OR e.from_status='ADMIN_REVIEW')
      AND (e.to_status IS NULL OR e.to_status='CLOSED')
  ) THEN RAISE EXCEPTION 'LTP_FINAL_SYNC_ADMIN_APPROVAL_NOT_FOUND'; END IF;
  IF v_finding.review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED') THEN RAISE EXCEPTION 'LTP_FINAL_SYNC_FINDING_NOT_ESTABLISHED'; END IF;
  IF v_finding.status='Closed' THEN RETURN false; END IF;
  IF v_finding.status NOT IN('Open','CAR Submitted','Verifikasi','Overdue') THEN RAISE EXCEPTION 'LTP_FINAL_SYNC_FINDING_STATUS_INVALID'; END IF;

  PERFORM set_config('certitrack.finding_ltp_final_sync','1',true);
  BEGIN
    UPDATE public.findings
    SET status='Closed',revision_version=revision_version+1
    WHERE id=v_finding.id;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('certitrack.finding_ltp_final_sync',COALESCE(v_previous_context,''),true);
    RAISE;
  END;
  PERFORM set_config('certitrack.finding_ltp_final_sync',COALESCE(v_previous_context,''),true);
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.sync_finding_closed_from_ltp(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_decide_ltp(p_car_id uuid,p_expected_revision integer,p_decision text,p_comment text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_car public.cars%ROWTYPE; v_decision text:=upper(btrim(COALESCE(p_decision,''))); v_comment text:=NULLIF(btrim(COALESCE(p_comment,'')),''); v_blockers text[]; v_target text; v_event text; v_revision integer; v_kode_audit text; v_recipient record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autentikasi diperlukan'; END IF;
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id FOR UPDATE;
  IF NOT FOUND OR v_car.status<>'ADMIN_REVIEW' OR public.current_identity_type()<>'ADMIN' THEN RAISE EXCEPTION 'Admin tidak diizinkan memutuskan LTP ini'; END IF;
  IF v_car.revision_version IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'LTP_STALE_REVISION'; END IF;
  IF v_decision NOT IN ('RETURN','APPROVE') THEN RAISE EXCEPTION 'Keputusan Admin/QMS tidak valid'; END IF;
  IF v_decision='RETURN' AND v_comment IS NULL THEN RAISE EXCEPTION 'LTP_ADMIN_RETURN_COMMENT_REQUIRED'; END IF;
  v_blockers:=public.ltp_admin_decision_blockers(p_car_id,v_decision);
  IF cardinality(v_blockers)>0 THEN
    IF v_decision='RETURN' THEN RAISE EXCEPTION 'LTP_ADMIN_RETURN_BLOCKED: %',array_to_string(v_blockers,' | '); ELSE RAISE EXCEPTION 'LTP_ADMIN_APPROVE_BLOCKED: %',array_to_string(v_blockers,' | '); END IF;
  END IF;
  IF v_decision='RETURN' THEN v_target:='AUDITOR_RETURNED'; v_event:='ADMIN_RETURNED_TO_AUDITOR'; ELSE v_target:='CLOSED'; v_event:='ADMIN_APPROVED_LTP'; END IF;
  SELECT kode_audit INTO v_kode_audit FROM public.findings WHERE id=v_car.finding_id;
  UPDATE public.cars SET status=v_target,revision_version=revision_version+1 WHERE id=p_car_id RETURNING revision_version INTO v_revision;
  INSERT INTO public.car_workflow_events(car_id,event_type,actor_user_id,actor_identity_type,comment,from_status,to_status) VALUES(p_car_id,v_event,auth.uid(),'ADMIN',v_comment,v_car.status,v_target);
  IF v_decision='APPROVE' THEN PERFORM public.sync_finding_closed_from_ltp(p_car_id); END IF;
  UPDATE public.notifications SET read_at=COALESCE(read_at,now()) WHERE finding_id=v_car.finding_id AND notification_type='LTP_ADMIN_REVIEW' AND read_at IS NULL;
  IF v_decision='RETURN' THEN
    FOR v_recipient IN SELECT DISTINCT p.id user_id FROM public.user_profiles p WHERE public.auditor_user_can_receive_finding(p.id,v_car.finding_id) LOOP
      INSERT INTO public.notifications(recipient_user_id,finding_id,notification_type,title,message) VALUES(v_recipient.user_id,v_car.finding_id,'LTP_AUDITOR_RETURNED','LTP dikembalikan Admin/QMS ke Auditor',v_kode_audit||' · '||v_car.kode_car||' · Catatan Admin/QMS: '||v_comment);
    END LOOP;
  ELSE
    FOR v_recipient IN
      SELECT DISTINCT user_id FROM (
        SELECT a.user_id FROM public.section_identity_assignments a JOIN public.user_profiles p ON p.id=a.user_id WHERE a.seksi_id=v_car.seksi_auditee_id AND a.status='Aktif' AND p.status='Aktif' AND ((a.assignment_type='AUDIT_PIC' AND p.identity_type='AUDITEE') OR (a.assignment_type='SECTION_MANAGER' AND p.identity_type='SECTION_MANAGER'))
        UNION SELECT p.id FROM public.user_profiles p WHERE public.auditor_user_can_receive_finding(p.id,v_car.finding_id)
      ) recipients
    LOOP
      INSERT INTO public.notifications(recipient_user_id,finding_id,notification_type,title,message) VALUES(v_recipient.user_id,v_car.finding_id,'LTP_CLOSED','LTP disetujui Admin/QMS',v_kode_audit||' · '||v_car.kode_car||' · LTP telah disetujui dan ditutup.');
    END LOOP;
  END IF;
  RETURN v_revision;
END $$;

REVOKE ALL ON FUNCTION public.admin_decide_ltp(uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_decide_ltp(uuid,integer,text,text) TO authenticated;

DO $$
DECLARE v_car_id uuid;
BEGIN
  FOR v_car_id IN
    SELECT c.id
    FROM public.cars c
    JOIN public.findings f ON f.id=c.finding_id
    WHERE c.status='CLOSED'
      AND c.auditor_verification_result='CLOSE'
      AND f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED')
      AND f.status<>'Closed'
      AND EXISTS (
        SELECT 1 FROM public.car_workflow_events e
        WHERE e.car_id=c.id AND e.event_type='ADMIN_APPROVED_LTP'
          AND (e.from_status IS NULL OR e.from_status='ADMIN_REVIEW')
          AND (e.to_status IS NULL OR e.to_status='CLOSED')
      )
  LOOP
    PERFORM public.sync_finding_closed_from_ltp(v_car_id);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM public.cars c
    JOIN public.findings f ON f.id=c.finding_id
    WHERE c.status='CLOSED'
      AND c.auditor_verification_result='CLOSE'
      AND f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED')
      AND f.status<>'Closed'
      AND EXISTS (SELECT 1 FROM public.car_workflow_events e WHERE e.car_id=c.id AND e.event_type='ADMIN_APPROVED_LTP')
  ) THEN RAISE EXCEPTION 'LTP_FINAL_SYNC_BACKFILL_INCOMPLETE'; END IF;
END
$$;
