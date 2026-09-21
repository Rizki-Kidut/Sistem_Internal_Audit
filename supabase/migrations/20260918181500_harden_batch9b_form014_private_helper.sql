-- Batch 9b follow-up: keep the Company Lead resolver private to guarded FORM-014 RPCs.
-- The helper is SECURITY DEFINER and is called internally by owner-executed functions only.

REVOKE ALL ON FUNCTION public.form014_active_company_lead_auditor()
FROM PUBLIC,anon,authenticated,service_role;
