-- Batch 7.0: replace historical anonymous/application-wide policies with identity ownership.
DO $$ DECLARE t text; p record; BEGIN
 FOREACH t IN ARRAY ARRAY['seksi','audit_plans','audit_plan_process','audit_plan_seksi_link','audit_plan_schedule','checklist_bank_items','proses','proses_seksi','auditors','audit_teams','audit_schedules','audit_scopes','audit_programs','audit_program_distribusi','audit_program_risiko','audit_program_steps','audit_program_step_template','plants','target_models','shifts','audit_instructions','audit_instruction_rows','audit_team_masters','audit_team_master_members','checklists','checklist_items','checklist_produk','checklist_produk_fase','checklist_produk_items','checklist_manufaktur_shift','checklist_manufaktur_bank_items','checklist_manufaktur_items','audit_agendas','audit_agenda_items','findings','clause_keyword_map'] LOOP
  IF to_regclass('public.'||t) IS NOT NULL THEN
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',p.policyname,t); END LOOP;
   EXECUTE format('REVOKE ALL ON public.%I FROM anon',t);
  END IF;
 END LOOP;
END $$;
DO $$ DECLARE f regprocedure; s text; BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon',f); END LOOP;
 FOR s IN SELECT sequencename FROM pg_sequences WHERE schemaname='public' LOOP EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon',s); END LOOP;
END $$;

-- Preparation/master data remains fully available only to the active Admin identity.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['audit_plans','audit_plan_process','audit_plan_seksi_link','audit_plan_schedule','checklist_bank_items','proses_seksi','audit_teams','audit_schedules','audit_scopes','audit_programs','audit_program_distribusi','audit_program_risiko','audit_program_steps','audit_program_step_template','plants','target_models','shifts','clause_keyword_map','checklist_manufaktur_bank_items'] LOOP
 EXECUTE format('CREATE POLICY admin_all ON public.%I FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity())',t);
END LOOP; END $$;
CREATE POLICY seksi_authenticated_read ON public.seksi FOR SELECT TO authenticated USING(public.current_identity_type() IS NOT NULL);
CREATE POLICY seksi_admin_write ON public.seksi FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY proses_authenticated_read ON public.proses FOR SELECT TO authenticated USING(public.current_identity_type() IS NOT NULL);
CREATE POLICY proses_admin_write ON public.proses FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY auditors_admin_all ON public.auditors FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY auditors_assigned_read ON public.auditors FOR SELECT TO authenticated USING(id=public.current_auditor_id() OR public.current_auditor_is_peer(id));

CREATE POLICY instruction_rows_admin_all ON public.audit_instruction_rows FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY instruction_rows_auditor_read ON public.audit_instruction_rows FOR SELECT TO authenticated USING(public.auditor_can_access_instruction_row(id));
CREATE POLICY instruction_rows_manager_read ON public.audit_instruction_rows FOR SELECT TO authenticated USING(public.manager_can_access_instruction_row(id));
CREATE POLICY instruction_rows_auditor_completion ON public.audit_instruction_rows FOR UPDATE TO authenticated USING(public.current_identity_type()='AUDITOR' AND public.auditor_can_access_instruction_row(id)) WITH CHECK(public.auditor_can_access_instruction_row(id));
CREATE POLICY instructions_admin_all ON public.audit_instructions FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY instructions_context_read ON public.audit_instructions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.audit_instruction_rows r WHERE r.instruction_id=audit_instructions.id AND (public.auditor_can_access_instruction_row(r.id) OR public.manager_can_access_instruction_row(r.id))));

CREATE POLICY team_masters_admin_all ON public.audit_team_masters FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY team_masters_member_read ON public.audit_team_masters FOR SELECT TO authenticated USING(public.current_auditor_belongs_to_team(id));
CREATE POLICY team_members_admin_all ON public.audit_team_master_members FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY team_members_team_read ON public.audit_team_master_members FOR SELECT TO authenticated USING(public.current_auditor_belongs_to_team(team_id));

CREATE POLICY checklists_admin_all ON public.checklists FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY checklists_auditor_read ON public.checklists FOR SELECT TO authenticated USING(public.auditor_can_access_instruction_row(row_id));
CREATE POLICY checklist_items_admin_all ON public.checklist_items FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY checklist_items_auditor_read ON public.checklist_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.checklists c WHERE c.id=checklist_id AND public.auditor_can_access_instruction_row(c.row_id)));
CREATE POLICY checklist_items_auditor_execute ON public.checklist_items FOR UPDATE TO authenticated USING(public.current_identity_type()='AUDITOR' AND EXISTS(SELECT 1 FROM public.checklists c WHERE c.id=checklist_id AND public.auditor_can_access_instruction_row(c.row_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.checklists c WHERE c.id=checklist_id AND public.auditor_can_access_instruction_row(c.row_id)));

CREATE POLICY product_admin_all ON public.checklist_produk FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY product_auditor_read ON public.checklist_produk FOR SELECT TO authenticated USING(public.auditor_can_access_instruction_row(row_id));
CREATE POLICY product_fase_admin_all ON public.checklist_produk_fase FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY product_fase_auditor_read ON public.checklist_produk_fase FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.checklist_produk c WHERE c.id=checklist_produk_id AND public.auditor_can_access_instruction_row(c.row_id)));
CREATE POLICY product_items_admin_all ON public.checklist_produk_items FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY product_items_auditor_read ON public.checklist_produk_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.checklist_produk_fase f JOIN public.checklist_produk c ON c.id=f.checklist_produk_id WHERE f.id=fase_id AND public.auditor_can_access_instruction_row(c.row_id)));
CREATE POLICY product_items_auditor_execute ON public.checklist_produk_items FOR UPDATE TO authenticated USING(public.current_identity_type()='AUDITOR' AND EXISTS(SELECT 1 FROM public.checklist_produk_fase f JOIN public.checklist_produk c ON c.id=f.checklist_produk_id WHERE f.id=fase_id AND c.status='Selesai' AND public.auditor_can_access_instruction_row(c.row_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.checklist_produk_fase f JOIN public.checklist_produk c ON c.id=f.checklist_produk_id WHERE f.id=fase_id AND c.status='Selesai' AND public.auditor_can_access_instruction_row(c.row_id)));

CREATE POLICY manufacturing_admin_all ON public.checklist_manufaktur_shift FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY manufacturing_auditor_read ON public.checklist_manufaktur_shift FOR SELECT TO authenticated USING(public.auditor_can_access_instruction_row(row_id));
CREATE POLICY manufacturing_items_admin_all ON public.checklist_manufaktur_items FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY manufacturing_items_auditor_read ON public.checklist_manufaktur_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift c WHERE c.id=checklist_id AND public.auditor_can_access_instruction_row(c.row_id)));
CREATE POLICY manufacturing_items_auditor_execute ON public.checklist_manufaktur_items FOR UPDATE TO authenticated USING(public.current_identity_type()='AUDITOR' AND EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift c WHERE c.id=checklist_id AND c.status='Selesai' AND public.auditor_can_access_instruction_row(c.row_id))) WITH CHECK(EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift c WHERE c.id=checklist_id AND c.status='Selesai' AND public.auditor_can_access_instruction_row(c.row_id)));

CREATE POLICY agendas_admin_all ON public.audit_agendas FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY agendas_scoped_read ON public.audit_agendas FOR SELECT TO authenticated USING(public.auditor_can_access_instruction_row(instruction_row_id) OR public.manager_can_access_instruction_row(instruction_row_id));
CREATE POLICY agenda_items_admin_all ON public.audit_agenda_items FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY agenda_items_scoped_read ON public.audit_agenda_items FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.audit_agendas a WHERE a.id=agenda_id AND (public.auditor_can_access_instruction_row(a.instruction_row_id) OR public.manager_can_access_instruction_row(a.instruction_row_id))));
CREATE POLICY findings_admin_all ON public.findings FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY findings_auditor_read ON public.findings FOR SELECT TO authenticated USING(public.auditor_can_access_instruction_row(instruction_row_id));
CREATE POLICY findings_auditor_update ON public.findings FOR UPDATE TO authenticated USING(public.current_identity_type()='AUDITOR' AND public.auditor_can_access_instruction_row(instruction_row_id)) WITH CHECK(public.auditor_can_access_instruction_row(instruction_row_id));
CREATE POLICY clause_keyword_active_identity_read ON public.clause_keyword_map FOR SELECT TO authenticated USING(public.current_identity_type() IS NOT NULL);
CREATE POLICY manufacturing_bank_active_identity_read ON public.checklist_manufaktur_bank_items FOR SELECT TO authenticated USING(public.current_identity_type() IS NOT NULL);

-- Column-level execution separation for direct REST updates; existing lifecycle/finding triggers still run.
CREATE FUNCTION public.guard_identity_execution_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_identity text:=public.current_identity_type();
BEGIN
 IF v_identity='ADMIN' THEN RETURN NEW; END IF;
 IF v_identity<>'AUDITOR' THEN RAISE EXCEPTION 'Identitas ini tidak diizinkan mengubah pelaksanaan audit'; END IF;
 IF TG_TABLE_NAME='audit_instruction_rows' THEN
  IF NOT public.auditor_can_access_instruction_row(OLD.id) OR (to_jsonb(NEW)-'cek_selesai'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'cek_selesai'-'updated_at') THEN RAISE EXCEPTION 'Auditor hanya dapat menyelesaikan audit milik Tim'; END IF;
 ELSIF TG_TABLE_NAME='checklist_items' THEN
  IF (to_jsonb(NEW)-'hasil'-'komentar_auditor'-'finding_id'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'hasil'-'komentar_auditor'-'finding_id'-'updated_at') THEN RAISE EXCEPTION 'Auditor tidak dapat mengubah struktur Checklist Sistem'; END IF;
  IF NEW.finding_id IS DISTINCT FROM OLD.finding_id AND COALESCE(current_setting('certitrack.finding_sync',true),'')<>'1' THEN RAISE EXCEPTION 'finding_id dikelola sistem'; END IF;
 ELSIF TG_TABLE_NAME='checklist_produk_items' THEN
  IF (to_jsonb(NEW)-'jumlah_sampel'-'hasil_pemeriksaan'-'judgment'-'finding_kategori'-'finding_id'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'jumlah_sampel'-'hasil_pemeriksaan'-'judgment'-'finding_kategori'-'finding_id'-'updated_at') THEN RAISE EXCEPTION 'Auditor tidak dapat mengubah struktur Checklist Produk'; END IF;
  IF NEW.finding_id IS DISTINCT FROM OLD.finding_id AND COALESCE(current_setting('certitrack.finding_sync',true),'')<>'1' THEN RAISE EXCEPTION 'finding_id dikelola sistem'; END IF;
 ELSIF TG_TABLE_NAME='checklist_manufaktur_items' THEN
  IF (to_jsonb(NEW)-'hasil_pengamatan'-'hasil'-'finding_id'-'updated_at') IS DISTINCT FROM (to_jsonb(OLD)-'hasil_pengamatan'-'hasil'-'finding_id'-'updated_at') THEN RAISE EXCEPTION 'Auditor tidak dapat mengubah struktur Checklist Manufaktur'; END IF;
  IF NEW.finding_id IS DISTINCT FROM OLD.finding_id AND COALESCE(current_setting('certitrack.finding_sync',true),'')<>'1' THEN RAISE EXCEPTION 'finding_id dikelola sistem'; END IF;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_identity_instruction_completion BEFORE UPDATE ON public.audit_instruction_rows FOR EACH ROW EXECUTE FUNCTION public.guard_identity_execution_mutation();
CREATE TRIGGER trg_identity_system_execution BEFORE UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.guard_identity_execution_mutation();
CREATE TRIGGER trg_identity_product_execution BEFORE UPDATE ON public.checklist_produk_items FOR EACH ROW EXECUTE FUNCTION public.guard_identity_execution_mutation();
CREATE TRIGGER trg_identity_manufacturing_execution BEFORE UPDATE ON public.checklist_manufaktur_items FOR EACH ROW EXECUTE FUNCTION public.guard_identity_execution_mutation();
REVOKE ALL ON FUNCTION public.guard_identity_execution_mutation() FROM PUBLIC;

-- Evidence path is product-checklists/{checklist_id}/{fase_id}/{object}; objects are private and team scoped.
DROP POLICY IF EXISTS audit_evidence_select ON storage.objects; DROP POLICY IF EXISTS audit_evidence_insert ON storage.objects; DROP POLICY IF EXISTS audit_evidence_update ON storage.objects; DROP POLICY IF EXISTS audit_evidence_delete ON storage.objects;
CREATE POLICY audit_evidence_scoped_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='audit-evidence' AND (public.is_admin_identity() OR EXISTS(SELECT 1 FROM public.checklist_produk c WHERE c.id=(storage.foldername(name))[2]::uuid AND public.auditor_can_access_instruction_row(c.row_id))));
CREATE POLICY audit_evidence_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='audit-evidence' AND public.is_admin_identity());
CREATE POLICY audit_evidence_admin_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='audit-evidence' AND public.is_admin_identity()) WITH CHECK(bucket_id='audit-evidence' AND public.is_admin_identity());
CREATE POLICY audit_evidence_admin_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='audit-evidence' AND public.is_admin_identity());

REVOKE EXECUTE ON FUNCTION public.complete_audit_execution(uuid),public.reopen_audit_execution(uuid),public.audit_execution_blockers(uuid),public.create_audit_agenda_from_row(uuid),public.finalize_audit_agenda(uuid),public.return_audit_agenda_to_draft(uuid),public.reorder_audit_agenda_items(uuid,uuid[]) FROM anon;
ALTER FUNCTION public.complete_audit_execution(uuid) SECURITY INVOKER; ALTER FUNCTION public.reopen_audit_execution(uuid) SECURITY INVOKER; ALTER FUNCTION public.audit_execution_blockers(uuid) SECURITY INVOKER;
