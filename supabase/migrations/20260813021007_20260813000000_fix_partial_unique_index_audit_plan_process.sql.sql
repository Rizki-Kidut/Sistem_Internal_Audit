/*
# Fix ON CONFLICT failure on audit_plan_process

## Why
`syncProcessesFromMaster` calls `.upsert(rows, { onConflict: 'plan_id,proses_master_id' })`.
PostgREST translates this to `INSERT ... ON CONFLICT (plan_id, proses_master_id)`.
The existing unique index `uq_audit_plan_process_plan_master` is a PARTIAL index
(`WHERE proses_master_id IS NOT NULL`). PostgreSQL cannot match an `ON CONFLICT`
clause to a partial index unless the statement includes the same predicate — which
PostgREST does not send. Result: error 42P10 "there is no unique or exclusion
constraint matching the ON CONFLICT specification" every time the Rencana Audit
page loads, blocking the matrix from rendering.

## Changes
1. Drop the partial unique index `uq_audit_plan_process_plan_master`.
2. Create a full (non-partial) unique index on (plan_id, proses_master_id).
   PostgreSQL treats NULL values as distinct in unique indexes, so multiple
   manual rows with proses_master_id = NULL are still allowed — the constraint
   only enforces uniqueness for non-NULL proses_master_id, which is exactly the
   desired behavior.
3. Keep the existing non-unique helper index `idx_audit_plan_process_plan_master`
   unchanged (it does no harm and supports queries).

## Notes
- No data is deleted or modified.
- RLS policies are unchanged.
- The unique constraint semantics are identical to before for non-NULL rows.
  For NULL rows, behavior is also identical: multiple NULLs allowed.
*/

DROP INDEX IF EXISTS uq_audit_plan_process_plan_master;

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_plan_process_plan_master
  ON audit_plan_process (plan_id, proses_master_id);
