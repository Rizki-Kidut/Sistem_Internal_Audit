-- Batch 9b Staging hardening: keep the Company Lead resolver private.
-- The base FORM-014 migration is already applied to Staging and is immutable.
REVOKE ALL ON FUNCTION public.form014_active_company_lead_auditor()
FROM PUBLIC, anon, authenticated;
