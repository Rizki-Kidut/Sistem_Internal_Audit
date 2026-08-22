-- Batch 6b security hardening after staging advisor review.
-- API-facing execution RPCs run as SECURITY INVOKER so RLS/table privileges remain authoritative.
-- The blocker helper is also SECURITY INVOKER because the public RPC calls it under the caller role.

ALTER FUNCTION public.audit_execution_blockers(uuid) SECURITY INVOKER;
ALTER FUNCTION public.complete_audit_execution(uuid) SECURITY INVOKER;
ALTER FUNCTION public.reopen_audit_execution(uuid) SECURITY INVOKER;

REVOKE ALL PRIVILEGES ON FUNCTION public.audit_execution_blockers(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_execution_blockers(uuid)
  TO anon, authenticated;

REVOKE ALL PRIVILEGES ON FUNCTION public.complete_audit_execution(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.reopen_audit_execution(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_audit_execution(uuid)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_audit_execution(uuid)
  TO anon, authenticated;
