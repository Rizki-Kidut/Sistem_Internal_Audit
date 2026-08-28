-- Batch 7c refinement: notify scoped Section Manager when an Auditee submits an LTP.
-- Reuses the existing private, recipient-scoped notifications table used by Finding review.

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

  SELECT f.kode_audit INTO v_kode_audit
  FROM public.findings f
  WHERE f.id=v_car.finding_id;

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

  FOR v_recipient IN
    SELECT DISTINCT a.user_id
    FROM public.section_identity_assignments a
    JOIN public.user_profiles p ON p.id=a.user_id
    WHERE a.seksi_id=v_car.seksi_auditee_id
      AND a.assignment_type='SECTION_MANAGER'
      AND a.status='Aktif'
      AND p.identity_type='SECTION_MANAGER'
      AND p.status='Aktif'
  LOOP
    INSERT INTO public.notifications(
      recipient_user_id,finding_id,notification_type,title,message
    ) VALUES (
      v_recipient.user_id,
      v_car.finding_id,
      'LTP_MANAGER_REVIEW',
      'LTP menunggu review',
      v_kode_audit||' · '||v_car.kode_car
    );
  END LOOP;

  RETURN v_new_revision;
END
$$;

REVOKE ALL ON FUNCTION public.submit_ltp_to_manager(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.submit_ltp_to_manager(uuid,integer) TO authenticated;

-- Backfill pending Manager-review LTPs submitted before this refinement.
INSERT INTO public.notifications(
  recipient_user_id,finding_id,notification_type,title,message
)
SELECT DISTINCT
  a.user_id,
  c.finding_id,
  'LTP_MANAGER_REVIEW',
  'LTP menunggu review',
  f.kode_audit||' · '||c.kode_car
FROM public.cars c
JOIN public.findings f ON f.id=c.finding_id
JOIN public.section_identity_assignments a
  ON a.seksi_id=c.seksi_auditee_id
 AND a.assignment_type='SECTION_MANAGER'
 AND a.status='Aktif'
JOIN public.user_profiles p
  ON p.id=a.user_id
 AND p.identity_type='SECTION_MANAGER'
 AND p.status='Aktif'
WHERE c.status='MANAGER_REVIEW'
  AND NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.recipient_user_id=a.user_id
      AND n.finding_id=c.finding_id
      AND n.notification_type='LTP_MANAGER_REVIEW'
  );
