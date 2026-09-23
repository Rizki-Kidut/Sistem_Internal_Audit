-- Dashboard follow-up hardening after Staging privilege regression.
-- Keep the public Dashboard RPC authenticated-executable while the row-scope helper remains private.
REVOKE ALL ON FUNCTION public.dashboard_can_access_instruction_row(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_internal_audit_dashboard(integer,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_internal_audit_dashboard(integer,text,uuid) TO authenticated;

COMMENT ON FUNCTION public.dashboard_can_access_instruction_row(uuid)
IS 'Private Dashboard row-scope authorization helper. Not directly executable by authenticated clients.';

NOTIFY pgrst,'reload schema';
