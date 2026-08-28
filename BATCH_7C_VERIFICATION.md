# Batch 7c — Auditee Submit → Section Manager Review Foundation

Status: `VERIFIED_COMPLETE`

## Scope implemented

- Auditee submits a saved, complete LTP from `AUDITEE_DRAFT` / `AUDITEE_RETURNED` to `MANAGER_REVIEW`.
- Submit is optimistic-concurrency guarded by `revision_version` and row locking.
- Successful submit increments the LTP revision exactly once and appends immutable `AUDITEE_SUBMITTED_TO_MANAGER` workflow history.
- Section Manager access remains section-scoped through active `SECTION_MANAGER` assignment.
- `MANAGER_REVIEW` is read-only in this slice; Manager Setujui/Kembalikan is deliberately deferred.
- Submit creates actionable `LTP_MANAGER_REVIEW` notifications for active matching Section Manager identities.
- The LTP worklist shows unread notifications in `Notifikasi LTP`; clicking an item marks it read and opens the matching LTP detail.
- Finding lifecycle/status, `findings.car_id`, Auditor review, Admin/QMS final approval, and LTP Closed are unchanged.

## Submit gate

- Dampak Temuan required.
- Manfaat Perbaikan required.
- Category A/B requires at least 3 persisted Why-Why levels.
- Category C does not use Why-Why.
- Tindakan Korektif required.
- Every persisted action requires PIC and Due Date.
- Every persisted action requires either BEFORE + AFTER evidence or one BEFORE_AFTER evidence.
- An active Section Manager identity and matching active section assignment must exist.

## Applied Staging migrations

- `20260827090527_add_ltp_submit_manager_review_foundation.sql`
- `20260828004515_notify_section_manager_on_ltp_submit.sql`

Both are applied and immutable. Any later correction must be additive.

## Runtime verification — PASS

Rollback-only Staging assertions passed for blocker derivation, stale revision rejection, matching-revision submit, exactly one revision increment, `AUDITEE_DRAFT → MANAGER_REVIEW`, Auditee edit lock after submit, exactly one submit workflow event, unchanged Finding operational status and compatibility link, double-submit rejection, scoped Manager access, outsider Manager denial, and cleanup.

Notification verification passed for backfill, one notification per active matching Manager, atomic notification creation on future submit, recipient-scoped RLS, and read-only-except-`read_at` mutation protection.

## Browser verification — PASS

- Auditee submitted `QA-9910/MFG/2099/001`.
- Status became `MANAGER_REVIEW` / `Menunggu Section Manager`.
- Auditee response became read-only.
- A real active Section Manager scoped to `Quality Assurance System` could see and open the submitted LTP.
- Detail displayed `7. Review Section Manager` with submission actor/time.
- `Notifikasi LTP` appeared for the Manager.
- Clicking `LTP menunggu review` opened the matching LTP/Why-Why Analysis detail successfully.

## Source / deployment

- `/project` is untouched.
- Notification refinement is limited to LTP UI/service/type, one additive migration, and this verification note.
- Vercel deployment passed on the implementation head before this documentation-only commit; the documentation head is rechecked separately before merge readiness.
- `npm run typecheck` is not claimed from the tool environment because repository `build` is `vite build`; Codespace typecheck remains the independent compiler gate.

## Deferred to next controlled slices

- Manager Setujui/Kembalikan.
- Auditor verification/return/close.
- Admin/QMS final approval/rejection.
- Finding status synchronization.
- LTP Closed transition.
