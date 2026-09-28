-- Rollback-only structural/semantic regression for the FORM-003 read model.
-- Run only against an approved non-Production database after applying the additive migration.
BEGIN;

DO $$
DECLARE source text; public_source text;
BEGIN
 SELECT pg_get_functiondef('public.get_audit_instruction_print_data(uuid)'::regprocedure) INTO source;
 SELECT pg_get_functiondef('public.form003_can_access_instruction(uuid)'::regprocedure) INTO public_source;

 -- 1 Team code and 2 authoritative current roster (never row.team/row.auditor).
 IF source NOT LIKE '%t.kode_tim%' OR source NOT LIKE '%audit_team_master_members%' OR source LIKE '%r.team AS%'
 THEN RAISE EXCEPTION 'FORM003 regression 1/2: Team Master projection missing';END IF;
 -- 3/4 matrices remain sourced from Instruction JSON without transformation.
 IF source NOT LIKE '%to_jsonb(r)%' THEN RAISE EXCEPTION 'FORM003 regression 3/4: row matrices missing';END IF;
 -- 5 Product date; 6 System/Manufacturing date.
 IF source NOT LIKE '%r.tipe_baris=''AuditProduk'' THEN COALESCE(r.tanggal_audit_produk,r.tanggal_pelaksanaan_audit)%'
 THEN RAISE EXCEPTION 'FORM003 regression 5/6: execution-date ownership changed';END IF;
 -- 7 zero Finding; 8 formal Finding; ANNULLED/non-final are excluded.
 IF source NOT LIKE '%f.review_status IN(''PUBLISHED'',''LEGACY_ESTABLISHED'')%'
 THEN RAISE EXCEPTION 'FORM003 regression 7/8: formal Finding semantics changed';END IF;
 -- 9 all required Section reports Final.
 IF source NOT LIKE '%final_report_count=s.required_report_count%'
 THEN RAISE EXCEPTION 'FORM003 regression 9: report completeness changed';END IF;
 -- 10/11 draft/manager are non-submitted; 12 Auditor review is submitted.
 IF source NOT LIKE '%c.status IN(''AUDITOR_REVIEW'',''AUDITOR_RETURNED'',''ADMIN_REVIEW'',''CLOSED'')%'
 THEN RAISE EXCEPTION 'FORM003 regression 10-12: submitted LTP states changed';END IF;
 -- 13 Auditor CLOSE -> ADMIN_REVIEW and 16 CLOSED qualify.
 IF source NOT LIKE '%c.status IN(''ADMIN_REVIEW'',''CLOSED'')%'
 THEN RAISE EXCEPTION 'FORM003 regression 13/16: qualifying close states changed';END IF;
 -- 14 Admin Return invalidates; 15 later Auditor CLOSE restores (latest decision ordering).
 IF source NOT LIKE '%IN(''AUDITOR_VERIFIED_CLOSE_TO_ADMIN'',''ADMIN_RETURNED_TO_AUDITOR'')%'
    OR source NOT LIKE '%ORDER BY e.created_at DESC,e.id DESC LIMIT 1%'
 THEN RAISE EXCEPTION 'FORM003 regression 14/15: effective-close ordering changed';END IF;
 -- 17 multiple LTP completion takes the last effective close.
 IF source NOT LIKE '%max(c.latest_effective_close)%'
 THEN RAISE EXCEPTION 'FORM003 regression 17: maximum effective close missing';END IF;
 -- 18 zero-LTP fallback is latest Final report; 19 every row/report must complete.
 IF source NOT LIKE '%bool_and(established AND reports_final)%' OR source NOT LIKE '%max(latest_report_final)%'
 THEN RAISE EXCEPTION 'FORM003 regression 18/19: zero-LTP fallback changed';END IF;
 -- 20 authenticated public RPC/private helper and active identity authorization.
 IF public_source NOT LIKE '%auth.uid() IS NOT NULL%' OR public_source NOT LIKE '%dashboard_can_access_instruction_row%'
    OR has_function_privilege('anon','public.get_audit_instruction_print_data(uuid)','EXECUTE')
    OR NOT has_function_privilege('authenticated','public.get_audit_instruction_print_data(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.form003_can_access_instruction(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'FORM003 regression 20: authorization/privilege contract changed';END IF;
 -- 21 projection performs no business-table INSERT/UPDATE/DELETE.
 IF source ~* '[[:space:]](insert[[:space:]]+into|update[[:space:]]+public|delete[[:space:]]+from)'
 THEN RAISE EXCEPTION 'FORM003 regression 21: read model contains mutation';END IF;
END $$;

ROLLBACK;
