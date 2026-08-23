# Finding Workflow Static Review Plan

**Status:** `IMPLEMENTED_UNVERIFIED`. Run this matrix only after independent migration review and explicit Staging approval.

## Legacy compatibility and state separation

- `findings.status` remains the established operational Finding/CAR lifecycle. The pre-publication
  state machine is stored separately in `findings.review_status`.
- Existing numbered Findings keep their official number, operational status, CAR relationship, PLOR,
  source relationship, and timestamps. A numbered Finding is marked `LEGACY_ESTABLISHED` only when its
  audit is already completed, its operational Finding status has progressed beyond `Open`, or it already
  has a CAR relationship. This compatibility marker does not manufacture a historical Lead Auditor approval.
- Existing numbered Findings on an unfinished audit remain `DRAFT`-compatible so the Team may finish PLOR
  and submit them through Team Leader → Lead Auditor review without losing or replacing the legacy number.
- New source-created Findings after this migration begin as `DRAFT` without an official number. A legacy
  numbered Draft cannot be silently auto-deleted by changing its source to conforming; cancellation must
  go through controlled Lead Auditor annulment so the already-issued number remains traceable.

## Annulment integrity

Lead annulment is one transaction: authorize and lock the Finding/source, capture the actual initial
result, apply `O` (System/Manufacturing) or `OK` (Product), retain the source link, append immutable
disposition/review history, and set `review_status = ANNULLED`. A narrow transaction-local Finding UUID
context prevents source synchronization from deleting or recreating the governed Finding.

The Checklist workspace must also expose annulment traceability for the selected QA: effective result,
initial result, reason, reviewer, timestamp, Finding reference, and source type. Normal source fields show
the effective/current value while the review card preserves the original judgement for external-audit review.

## Identity and Team matrix

- Team A Member: Team A SELECT/edit Draft or Revision Required; Team B receives zero rows; Submit/Resubmit/Lead decisions fail.
- Team A Team Leader: Submit Draft and Resubmit Revision Required succeed; cross-Team and wrong-state actions fail.
- Team A Lead Auditor: Request Revision/Approve/Annul in Lead Review succeed; required comment/reason and effective disposition are enforced; cross-Team actions fail.
- Admin: global SELECT; audited Draft/Revision Required PLOR edit; release Ready for Release; execution writes, complete/reopen, Team/Lead actions, and hard delete fail.
- Auditee/Section Manager: no pre-publication Finding access.

## Transaction and audit assertions

1. Two editors load version 5; first save increments to 6; second update matches zero rows and reports a stale-version error.
2. New source A/B/C or NG creates a Draft with UUID and draft reference but null official number.
3. Lead approval locks the Finding. New Drafts allocate one `{QA}/{source}/{year}/{NNN}` under an advisory transaction lock; legacy numbered Drafts retain their existing official number. Both append an approval event and notify Team/Admin.
4. Repeated revision cycles append events and never overwrite earlier comments.
5. Annul requires a reason, writes O/OK to the authoritative source, retains initial judgement/source link, and does not hard-delete the Finding.
6. Completion fails while a Finding is Draft, Lead Review, or Revision Required, including an unfinished legacy numbered Draft.
7. `created_at` mutation, event/disposition update/delete, Finding direct insert/delete, and private sync helper calls fail.
8. Revision notification recipients are all active mapped Team Auditors except the requesting Lead; each recipient can read/update only its own `read_at`.
9. Evidence paths fail closed unless prefix/count/UUIDs are valid and the phase belongs to the checklist.
10. Checklist UI displays annulled source history while the authoritative source carries the effective O/OK result.
11. Confirm execution/agenda RPCs remain SECURITY INVOKER and Batch 6a source triggers still create/remove only eligible new Draft Findings.
