-- Batch 9b pre-Staging rollback-safe regression. Run only after applying the unapplied migration to an isolated Staging transaction.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.assert_true(ok boolean,message text)RETURNS void LANGUAGE plpgsql AS $$BEGIN IF NOT COALESCE(ok,false)THEN RAISE EXCEPTION 'B9B ASSERT: %',message;END IF;END$$;

-- Schema, identity isolation, controlled code and grants.
SELECT pg_temp.assert_true(EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.rangkuman_hasil_audit_reports'::regclass AND contype='u'),'report identity unique constraint missing');
SELECT pg_temp.assert_true((SELECT column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='rangkuman_hasil_audit_reports' AND column_name='kode_dokumen') LIKE '%Q-120-ISE-001-FORM-014-REV.1%','document code mismatch');
SELECT pg_temp.assert_true(NOT has_table_privilege('anon','public.rangkuman_hasil_audit_reports','SELECT'),'anon report read must be denied');
SELECT pg_temp.assert_true(NOT has_table_privilege('authenticated','public.rangkuman_hasil_audit_items','INSERT'),'authenticated direct item insert must be denied');
SELECT pg_temp.assert_true(has_function_privilege('authenticated','public.create_rangkuman_hasil_audit(uuid,text)','EXECUTE'),'guarded create RPC grant missing');

-- Source-contract guards cover audit-type isolation, formal population, grouping, owner/sections,
-- completion/context/date/membership drift, deterministic ordering, LTP mapping and immutability.
WITH source AS(SELECT pg_get_functiondef('public.form014_refresh_population(uuid)'::regprocedure) body)
SELECT pg_temp.assert_true(body LIKE '%f.source_type=r.audit_type%' AND body LIKE '%PUBLISHED%' AND body LIKE '%LEGACY_ESTABLISHED%','formal audit-type population guard missing')FROM source;
WITH source AS(SELECT pg_get_functiondef('public.form014_refresh_population(uuid)'::regprocedure) body)
SELECT pg_temp.assert_true(body LIKE '%form014_group_owner%' AND body LIKE '%form014_group_sections%' AND body LIKE '%PARTITION BY i.group_id%','owner/sections/global group ordering missing')FROM source;
WITH source AS(SELECT pg_get_functiondef('public.form014_validate_context(public.audit_instruction_rows,text)'::regprocedure) body)
SELECT pg_temp.assert_true(body LIKE '%satu QA Manufaktur = satu Plant + satu Shift%' AND body LIKE '%satu QA Produk = satu Plant%','invalid matrix blockers missing')FROM source;
WITH source AS(SELECT pg_get_functiondef('public.finalize_rangkuman_hasil_audit(uuid,integer)'::regprocedure) body)
SELECT pg_temp.assert_true(body LIKE '%NOT ir.cek_selesai%' AND body LIKE '%form014_source_state(r.id) IS DISTINCT FROM r.source_state_snapshot%' AND body LIKE '%audit_date_start%' AND body LIKE '%audit_date_end%','authoritative drift guards missing')FROM source;
WITH source AS(SELECT pg_get_functiondef('public.finalize_rangkuman_hasil_audit(uuid,integer)'::regprocedure) body)
SELECT pg_temp.assert_true(body LIKE '%AUDITOR_VERIFIED_CLOSE_TO_ADMIN%' AND body LIKE '%TEMPORARY%' AND body LIKE '%CORRECTIVE%' AND body LIKE '%PREVENTIVE%' AND body NOT LIKE '%AUDITOR_VERIFIED_OPEN_TO_AUDITEE%','LTP snapshot mapping mismatch')FROM source;
WITH source AS(SELECT pg_get_functiondef('public.protect_form014_final()'::regprocedure) body)
SELECT pg_temp.assert_true(body LIKE '%Final bersifat immutable%' AND body LIKE '%rangkuman_hasil_audit_group_rows%','Final child immutability guard missing')FROM source;

-- Operational fixture matrix to execute on Staging after reviewer approval:
-- Admin/Lead allowed; ordinary Auditor/Auditee/Manager denied; three audit types unique/isolated;
-- System multi-row grouping; Manufacturing/Product distinct QA grouping and invalid matrices;
-- completed ZERO FINDING and incomplete Final denial; owner and target+terkait section union;
-- completion, Plant, Shift, process, section, date and represented-membership drift denial;
-- added/removed formal Finding denial; stale revision; Final report/group/item UPDATE/DELETE,
-- Final regenerate/save denial; and post-Final live-source mutation snapshot stability.
-- Fixtures must use SET LOCAL ROLE/auth claims and are deliberately kept transaction-local.
ROLLBACK;
