# Batch 7c — Auditee Submit → Section Manager Review Foundation

Status: `IMPLEMENTED_PENDING_NOTIFICATION_BROWSER_VERIFICATION`

## Scope implemented

- Auditee submits a saved, complete LTP from `AUDITEE_DRAFT` / `AUDITEE_RETURNED` to `MANAGER_REVIEW`.
- Submit is optimistic-concurrency guarded by `revision_version` and row locking.
- Successful submit increments the LTP revision exactly once and appends immutable `AUDITEE_SUBMITTED_TO_MANAGER` workflow history.
- Section Manager access remains section-scoped through active `SECTION_MANAGER` assignment.
- `MANAGER_REVIEW` is read-only in this slice; Manager Setujui/Kembalikan is deliberately deferred.
- Submit now creates an actionable `LTP_MANAGER_REVIEW` notification for every active matching Section Manager, reusing the existing recipient-scoped `notifications` infrastructure used by Finding review.
- The LTP worklist shows unread notifications in a `Notifikasi LTP` card. Clicking an item marks it read and opens the matching LTP detail.
- Finding lifecycle/status, `findings.car_id`, Auditor review, Admin/QMS final approval, and LTP Closed are not changed.

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

## Staging migrations

Applied migrations:

- `20260827090527_add_ltp_submit_manager_review_foundation.sql`
- `20260828004515_notify_section_manager_on_ltp_submit.sql`

Both applied migrations are immutable. Any later correction must be additive.

## Runtime verification completed

Rollback-only Staging assertions passed for:

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

Notification refinement verification passed for:

- a pending `MANAGER_REVIEW` LTP submitted before the notification refinement was backfilled exactly once for its active matching Section Manager;
- the real smoke-test Section Manager received unread `LTP_MANAGER_REVIEW` notification `LTP menunggu review` for `QA-9910 · QA-9910/MFG/2099/001`;
- a rollback-only future submit created exactly one Section Manager notification atomically together with the `MANAGER_REVIEW` transition;
- notification ownership remains protected by the existing `notifications` RLS and only `read_at` is mutable through the existing notification update guard.

ACL verification:

- `authenticated` may execute `submit_ltp_to_manager`;
- `anon` may not execute submit;
- internal blocker/manager helper functions are not directly executable by `authenticated`.

Supabase Security Advisor was reviewed after the initial Batch 7c DDL. The submit RPC is in the expected authenticated-callable `SECURITY DEFINER` warning class; its authority checks were verified by the runtime matrix. Existing unrelated advisor warnings remain unchanged.

## Browser verification completed

Real deployed-browser smoke passed for the core Batch 7c transition:

- Auditee successfully submitted `QA-9910/MFG/2099/001`.
- The LTP status became `MANAGER_REVIEW` / `Menunggu Section Manager`.
- The Auditee response became read-only immediately after submit.
- A real active Section Manager identity scoped to `Quality Assurance System` could see the submitted LTP in its worklist.
- The Section Manager detail displayed `7. Review Section Manager`, submission actor/time, and remained intentionally read-only.

The real Section Manager smoke identity is now provisioned and assigned to the same section. No password or credential is stored in this repository or verification document.

## Source/deployment verification

- Vercel production-style branch deployment passed on the pre-notification Batch 7c implementation head.
- The notification refinement adds only the additive notification migration and LTP notification UI/service/type changes; `/project` remains untouched.
- Final notification-refinement deployment status must be rechecked on the latest branch head.
- `npm run typecheck` is not claimed from the tool environment because repository `build` is `vite build`; a Codespace typecheck remains the independent compiler gate.

## Browser verification still required

Final notification UX smoke remains:

1. Log in as the scoped Section Manager and open the LTP worklist.
2. Confirm the `Notifikasi LTP` card shows `LTP menunggu review` and `QA-9910 · QA-9910/MFG/2099/001`.
3. Click the notification and confirm it opens the matching LTP detail.
4. Return to the worklist and confirm the notification is no longer shown as unread.

Manager Setujui/Kembalikan remains deliberately deferred to the next controlled workflow slice.
