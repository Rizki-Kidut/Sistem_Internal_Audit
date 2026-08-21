-- Batch 6a security hardening after the base migration was verified on Staging.
-- Trigger invocation does not require frontend roles to execute trigger functions directly.

REVOKE ALL PRIVILEGES ON TABLE public.findings FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.findings TO anon, authenticated;

REVOKE ALL PRIVILEGES ON TABLE public.clause_keyword_map FROM anon, authenticated;
GRANT SELECT ON TABLE public.clause_keyword_map TO anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.finding_source_context(text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.sync_checklist_finding(text, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.sync_system_finding()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.sync_manufacturing_finding()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.sync_product_finding()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.protect_finding_update()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.guard_source_finding_delete()
  FROM PUBLIC, anon, authenticated;
