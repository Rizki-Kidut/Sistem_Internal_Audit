# Batch 9a — Staging Verification

Date: 14 Sep 2026

Status: **STAGING_DB_VERIFIED — AI/API + browser print smoke still pending**

## Applied migrations in CertiTrack-Staging

Repository migration:

- `supabase/migrations/20260914120000_create_batch9a_weakness_analysis.sql`
- Repository SHA-256: `57eee2d2c124ad9fc82600a445bebda4218b29f8ef44dce3b8441a144c58220d`
- Staging ledger: `20260914111752 · create_batch9a_weakness_analysis`

During the first transactional runtime smoke, report creation exposed a trigger defect in the generic Final-child immutability trigger (`protect_weakness_child()`): PostgreSQL resolved row fields for heterogeneous trigger row types and raised `record "new" has no field "why_analysis_id"` while inserting report items.

Because the main Batch 9a migration had already been applied to Staging, it is immutable. The correction was therefore applied as a new additive migration:

- `supabase/migrations/20260914123000_fix_batch9a_child_immutability_trigger.sql`
- SHA-256: `1acc1dc73496325fe9dcc15b2a7fa54371303ddccc42c21902d8309d40581592`
- Staging ledger: `20260914112139 · fix_batch9a_child_immutability_trigger`

The correction resolves generic row fields through `to_jsonb(NEW/OLD)` and preserves Final immutability for report items, systemic Why rows/levels, and actions.

## Schema / RLS verification

PASS:

- All seven Batch 9a tables exist.
- RLS is enabled on every Batch 9a table.
- Authenticated users have SELECT-only direct table access.
- Normal authenticated table mutation is revoked; mutations go through guarded RPCs.
- AI suggestion history remains append-only.

Security advisor note: Supabase reports the generic `authenticated_security_definer_function_executable` warning for the guarded Batch 9a RPCs, as it also does for many established CertiTrack RPCs. Batch 9a RPCs intentionally remain callable by `authenticated` but re-check `can_manage_weakness_analysis()` internally. Runtime negative authorization tests below passed.

## Authorization runtime matrix

PASS:

- Active ADMIN -> `can_manage_weakness_analysis() = true` and report creation allowed.
- Active Company Lead Auditor -> allowed (verified transactionally by temporarily enabling the existing `user_auditor_links.is_lead_auditor` capability and rolling it back).
- Ordinary AUDITOR who is a Team Master Team Leader but is **not** Company Lead Auditor -> denied.
- AUDITEE -> denied / no report visibility.
- SECTION_MANAGER -> denied / no report visibility.
- Inactive Company Lead Auditor -> denied.
- Direct authenticated INSERT into Batch 9a report tables -> permission denied.

All identity/capability mutations used for the Lead Auditor test were enclosed in a transaction and rolled back.

## Transactional report lifecycle smoke

Using the existing 2099 smoke data and rolling all test report data back afterward:

PASS:

- Admin create report.
- DATE_RANGE population generated exactly one CLOSED LTP item for the selected date.
- FORM Audit Team Leader candidate resolved from Team Master.
- PJ QMS candidate resolved from the Program represented by the population.
- Manual classification persisted with DB provenance `MANUAL`.
- Draft save passed with one populated Why level (unused trailing Why columns allowed).
- Stale revision rejected with `WEAKNESS_STALE_REVISION`.
- Finalization succeeded when all blockers were satisfied.
- Final classification snapshot persisted as `METHOD / SISTEM / C`.
- Final Audit Team Leader and PJ QMS display snapshots persisted.
- Final report rejected later Draft mutation.
- Invalid Audit Team Leader candidate rejected.
- Invalid PJ QMS candidate rejected.
- PROGRAM population containing a non-CLOSED LTP rejected Finalization with `Masih terdapat LTP yang belum Closed.`
- Missing approved classification rejected Finalization with `Klasifikasi seluruh item wajib disetujui`.

## AI provenance database smoke

Using synthetic AI suggestion rows inside a rollback transaction:

PASS:

- Matching approved values + valid `suggestion_id` -> DB derives `AI_ACCEPTED`.
- Edited approved values + valid `suggestion_id` -> DB derives `AI_EDITED`.
- Suggestion belonging to another Weakness report -> rejected.
- Attempted UPDATE of AI suggestion history -> rejected as append-only.

No synthetic Weakness report, Why, Action, or AI suggestion test rows remain after the smoke tests.

## Edge Function deployment

`weakness-ai-classify` deployed to CertiTrack-Staging:

- status: ACTIVE
- version: 1
- `verify_jwt: true`
- deployed bundle SHA-256: `25dce06c3fc92f88a9967e53730a267225aaf3bbdedf1d70085c61eb34c1a9db`
- deployed source contains report-scoped AI cache reuse (`weakness_report_id`) and human-readable Section context.

## Remaining verification

Not yet complete:

1. Configure `OPENAI_API_KEY` as a Supabase Edge Function secret.
2. Optional server settings:
   - `OPENAI_MODEL_FAST=gpt-5.6-luna`
   - `OPENAI_MODEL_DEEP=gpt-5.6-terra`
   - `OPENAI_PROMPT_VERSION=batch9a-v1`
3. Real authenticated OpenAI smoke:
   - FAST suggestion
   - cache reuse within the same report
   - explicit Regenerate
   - Deep Analysis
   - AI Accepted / AI Edited through the browser
4. Browser verification of Admin + Company Lead Auditor navigation/access.
5. Browser A3 Landscape FORM-010 preview/print/Save-as-PDF, Draft watermark, and Final no-watermark behavior.

Until those remaining gates pass, Batch 9a must not be marked `VERIFIED_COMPLETE` and PR #27 must remain OPEN / UNMERGED.
