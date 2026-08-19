-- Correct Supabase Security/Performance Advisor findings without changing data or function bodies.

ALTER FUNCTION public.update_updated_at()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.next_qa_audit_code()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.protect_qa_audit_code()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.sync_instruction_row_scope_team()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.generate_instruction_from_program(uuid, integer)
  SET search_path = pg_catalog, public;

CREATE INDEX IF NOT EXISTS idx_audit_instruction_rows_proses_id
  ON public.audit_instruction_rows (proses_id);
CREATE INDEX IF NOT EXISTS idx_audit_plan_seksi_link_seksi_id
  ON public.audit_plan_seksi_link (seksi_id);
CREATE INDEX IF NOT EXISTS idx_audit_program_distribusi_seksi_id
  ON public.audit_program_distribusi (seksi_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_bank_item_id
  ON public.checklist_items (bank_item_id);
