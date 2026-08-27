# Batch 7c — Auditee Submit → Section Manager Review Foundation

Status: `IMPLEMENTED_PENDING_BROWSER_VERIFICATION`

## Scope implemented

- Auditee submits a saved, complete LTP from `AUDITEE_DRAFT` / `AUDITEE_RETURNED` to `MANAGER_REVIEW`.
- Submit is optimistic-concurrency guarded by `revision_version` and row locking.
- Successful submit increments the LTP revision exactly once and appends immutable `AUDITEE_SUBMITTED_TO_MANAGER` workflow history.
- Section Manager access remains section-scoped through active `SECTION_MANAGER` assignment.
- `MANAGER_REVIEW` is read-only in this slice; Manager Setujui/Kembalikan is deliberately deferred.
- Finding lifecycle/status, `findings.car_id`, notifications, Auditor review, Admin/QMS final approval, and LTP Closed are not changed.

## Submit gate

- Dampak Temuan required.
- Manfaat Perbaikan required.
- Category A/B requires at least 3 persisted Why-Why levels.
- Category C does not use Why-Why.
- Tindakan Korektif required.
- Every persisted action requires PIC and Due Date.
- Every persisted action requires either:
  - both BEFORE and AFTER evidence, or
  - one BEFORE_AFTER evidence.
- An active Section Manager identity and matching active section assignment must exist.

## Staging verification completed

Applied migration:

`20260827090527_add_ltp_submit_manager_review_foundation.sql`

Rollback-only runtime assertions passed for:

- current blocker derivation;
- stale `expected_revision` rejection;
- successful matching-revision submit;
- exactly one revision increment;
- `AUDITEE_DRAFT → MANAGER_REVIEW` transition;
- Auditee edit authority removed after submit;
- exactly one `AUDITEE_SUBMITTED_TO_MANAGER` workflow event;
- Finding status and compatibility `findings.car_id` unchanged;
- double-submit rejection;
- scoped Section Manager review/read access;
- outsider Section Manager denial;
- rollback fixture cleanup.

ACL verification:

- `authenticated` may execute `submit_ltp_to_manager`;
- `anon` may not execute submit;
- internal blocker/manager helper functions are not directly executable by `authenticated`.

Supabase Security Advisor was reviewed after the DDL. The submit RPC appears in the expected authenticated-callable `SECURITY DEFINER` warning class; its authority checks were verified by the runtime matrix. Existing unrelated advisor warnings remain unchanged.

## Source/deployment verification

- Vercel production-style branch build/deployment: PASS on branch head after implementation.
- Net diff is scoped to Batch 7c LTP files and the one additive migration; `/project` is untouched.
- `npm run typecheck` is still pending because the current execution environment cannot run the repository locally and Vercel `build` is `vite build` only.

## Browser verification still required

Negative-path browser smoke can verify blocker display and disabled submit immediately.

Positive submit/review browser smoke requires a real active Section Manager Auth identity with a matching `SECTION_MANAGER` assignment for the Auditee section. CertiTrack-Staging currently has no persisted active Section Manager identity, so no real credentials are created as part of this implementation.
