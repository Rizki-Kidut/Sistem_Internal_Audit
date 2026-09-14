# Batch 9a authorization/runtime matrix

Run this matrix on CertiTrack-Staging **after** applying `20260914120000_create_batch9a_weakness_analysis.sql`
and deploying `weakness-ai-classify`. It was prepared in this PR but was not executed because this PR
must neither apply migrations nor deploy Edge Functions.

| Identity fixture | Expected | SELECT/list | Create | Draft/save/regenerate | Approve classification | Finalize | AI function |
|---|---:|---:|---:|---:|---:|---:|---:|
| active ADMIN | ALLOW | 200/data | success | success | success | success when complete | 200/config error if key absent |
| active company Lead Auditor | ALLOW | 200/data | success | success | success | success when complete | 200/config error if key absent |
| ordinary active AUDITOR | DENY | no rows | denied | denied | denied | denied | 403 |
| Team Master Team Leader, not company Lead Auditor | DENY | no rows | denied | denied | denied | denied | 403 |
| Sub Leader | DENY | no rows | denied | denied | denied | denied | 403 |
| AUDITEE | DENY | no rows | denied | denied | denied | denied | 403 |
| SECTION_MANAGER | DENY | no rows | denied | denied | denied | denied | 403 |
| inactive Lead Auditor identity/link target | DENY | no rows | denied | denied | denied | denied | 401/403 |

For each actor, verify `can_manage_weakness_analysis()` equals
`is_admin_identity() OR current_auditor_is_lead_auditor()`. Team membership must not affect the result.
Test direct table DML separately: authenticated INSERT/UPDATE/DELETE must be denied for every Batch 9a
table. Exercise guarded RPCs with both valid and invalid ownership/status inputs.

Finalization cases must include: missing report, unauthorized actor, non-Draft report, stale revision,
invalid source, empty population, broken Finding/LTP relation, non-Closed LTP, each missing taxonomy,
blank conclusion, incomplete Why row, invalid/missing Why level text, and incomplete Action. For every
failure, assert the report revision/status, item snapshots, Why rows, and Actions are unchanged.

AI cases must cover missing bearer token (401), denied identity (403), absent `OPENAI_API_KEY` (clean 503),
provider rate limit (429), provider failure (safe 502), compatible suggestion reuse, forced regeneration
creating a second history row, and proof that suggestion generation never writes an approved classification.
