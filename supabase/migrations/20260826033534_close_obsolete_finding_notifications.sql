-- Batch 7 browser-smoke correction:
-- close actionable Finding notifications when the workflow state they refer to is no longer active.

CREATE OR REPLACE FUNCTION public.close_obsolete_finding_notifications()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public
AS $$
BEGIN
  IF NEW.event_type IN ('REVISION_REQUESTED','APPROVED','ANNULLED') THEN
    UPDATE public.notifications
       SET read_at = COALESCE(read_at, NEW.created_at)
     WHERE finding_id = NEW.finding_id
       AND notification_type IN ('LEAD_REVIEW','RESUBMITTED')
       AND read_at IS NULL;
  ELSIF NEW.event_type = 'TEAM_RESUBMITTED' THEN
    UPDATE public.notifications
       SET read_at = COALESCE(read_at, NEW.created_at)
     WHERE finding_id = NEW.finding_id
       AND notification_type = 'REVISION_REQUIRED'
       AND read_at IS NULL;
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.close_obsolete_finding_notifications()
FROM PUBLIC,anon,authenticated;

CREATE TRIGGER trg_close_obsolete_finding_notifications
AFTER INSERT ON public.finding_review_events
FOR EACH ROW
EXECUTE FUNCTION public.close_obsolete_finding_notifications();

UPDATE public.notifications n
SET read_at = COALESCE(n.read_at, now())
FROM public.findings f
WHERE f.id = n.finding_id
  AND n.read_at IS NULL
  AND (
    (
      n.notification_type IN ('LEAD_REVIEW','RESUBMITTED')
      AND f.review_status <> 'LEAD_REVIEW'
    )
    OR
    (
      n.notification_type = 'REVISION_REQUIRED'
      AND f.review_status <> 'REVISION_REQUIRED'
    )
  );
