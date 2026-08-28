# Batch 7d — Section Manager LTP Decision

Status: `IMPLEMENTED_PENDING_BROWSER_VERIFICATION`

## Scope implemented

- Section Manager may decide an LTP only while it is in `MANAGER_REVIEW` and only for an actively assigned matching section.
- `Setujui` transitions `MANAGER_REVIEW → AUDITOR_REVIEW`.
- `Kembalikan` transitions `MANAGER_REVIEW → AUDITEE_RETURNED`.
- Return requires a non-empty Section Manager comment.
- Both decisions use row locking plus fail-closed optimistic `revision_version` checking.
- Each successful decision increments `revision_version` exactly once and writes one immutable workflow event.
- Auditee content stays read-only for Section Manager.
- A returned LTP becomes editable again through the existing `auditee_can_edit_ltp` rule and displays the latest Manager comment.
- Returning to the worklist reloads LTP rows and LTP notifications so status/unread state does not stay stale in the browser.

## Decision routing and fail-closed recipient gates

### Return to Auditee

Requires an active `AUDITEE` profile with active matching `AUDIT_PIC` section assignment.

Successful return:

- event: `MANAGER_RETURNED_TO_AUDITEE`;
- status: `AUDITEE_RETURNED`;
- closes unread `LTP_MANAGER_REVIEW` notifications;
- creates `LTP_AUDITEE_RETURNED` for the active Auditee;
- stores the Manager comment in immutable workflow history and in the notification message.

### Approve to Auditor

Requires at least one active authenticated Auditor recipient whose active auditor master is either:

- the company Lead Auditor; or
- a member of the Team Audit assigned to the related Finding / Instruction row.

Successful approval:

- event: `MANAGER_APPROVED_TO_AUDITOR`;
- status: `AUDITOR_REVIEW`;
- closes unread `LTP_MANAGER_REVIEW` notifications;
- creates `LTP_AUDITOR_REVIEW` for eligible Auditor identities.

This gate deliberately prevents an LTP from entering `AUDITOR_REVIEW` when no authenticated Auditor can receive and access it.

## Auditee resubmit behavior

When an `AUDITEE_RETURNED` LTP is corrected and resubmitted through the existing submit RPC:

- old unread `LTP_AUDITEE_RETURNED` notifications are closed;
- the LTP returns to `MANAGER_REVIEW`;
- a fresh `LTP_MANAGER_REVIEW` notification is created for the active matching Section Manager.

## Applied Staging migration

`20260828005908_add_ltp_manager_decision.sql`

This migration has been applied to CertiTrack-Staging and is now immutable. Any correction must use a new additive migration.

## Runtime verification — PASS

All mutation assertions below were executed inside transactions and rolled back.

- non-Section-Manager decision attempt rejected;
- stale `expected_revision` rejected with `LTP_STALE_REVISION`;
- Return without comment rejected with `LTP_MANAGER_RETURN_COMMENT_REQUIRED`;
- valid Return changed `MANAGER_REVIEW → AUDITEE_RETURNED`;
- Return incremented revision exactly once;
- Return wrote exactly the expected workflow event/comment;
- Return created an unread Auditee notification;
- Return closed the Manager notification;
- Approve with no eligible Auditor recipient failed closed with `LTP_MANAGER_APPROVE_BLOCKED`;
- rollback-only Auditor fixture removed the blocker;
- valid Approve changed `MANAGER_REVIEW → AUDITOR_REVIEW`;
- Approve incremented revision exactly once;
- Approve wrote the expected workflow event/comment;
- Approve created an unread Auditor review notification;
- Approve closed the Manager notification;
- Return followed by Auditee resubmit returned the LTP to `MANAGER_REVIEW`, closed the obsolete Auditee-return notification, and created a fresh Manager-review notification.

After rollback verification, the real smoke LTP remains `MANAGER_REVIEW`, revision `5`. No Auditor fixture or `user_auditor_links` row persisted.

## ACL verification — PASS

- `authenticated` may execute `manager_decide_ltp`;
- `anon` may not execute `manager_decide_ltp`;
- `authenticated` may not directly execute `ltp_manager_decision_blockers`.

The callable decision RPC performs its own identity, section, state, revision, comment, and downstream-recipient checks before mutation.

## Security Advisor

Supabase Security Advisor was rechecked after the DDL. `manager_decide_ltp` appears in the expected authenticated-callable `SECURITY DEFINER` warning class. Its authorization boundary is covered by the runtime matrix above. No new notification-specific RLS/schema warning appeared. Existing unrelated warnings remain outside Batch 7d scope.

Remediation reference for this advisor class:
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Source verification

- `/project` is untouched.
- Batch 7d changes are limited to one additive migration, LTP workflow types/service/UI, and this verification note.
- Browser-smoke correction validation passed: `npm run typecheck`, `npm run build`, and `git diff --check`. The build reported only the existing Browserslist-data and bundle-size advisories.
- Vercel branch deployment is checked separately on the latest head.

## Browser-smoke correction — Manager decision status card

- Real browser smoke found that `7. Review Section Manager` disappeared immediately after Return or Approve because the component rendered only for `MANAGER_REVIEW`.
- The card now remains visible as database-authoritative, read-only workflow status for `AUDITEE_RETURNED` and `AUDITOR_REVIEW`, using the latest corresponding Manager workflow event for actor, timestamp, and optional comment.
- Manager decision controls remain limited to `MANAGER_REVIEW`; no notification, service, RPC, migration, or schema behavior changed.
- Browser reverification of the corrected post-decision card is pending. Browser verification is not marked PASS.

## Browser-review refinement — cumulative workflow history

- Browser review identified a UX consistency requirement: LTP Section 7 must preserve cumulative approval and revision history, consistent with the permanent audit-trail principle used by PLOR Review & Approval.
- Section 7 now renders recognized `workflow_events` chronologically beneath the unchanged current-state summary/action area. Labels are derived from event type plus authoritative `from_status` / `to_status`, so initial Auditee Submit and Auditee Resubmit are distinct.
- Actor, localized timestamp, and non-empty multi-line comments are shown without exposing raw event names. Unknown future events are ignored safely.
- No notification, authorization, decision, service, schema, RLS, or migration behavior changed.

Required browser reverification sequence:

`AUDITEE_DRAFT → Auditee Submit → MANAGER_REVIEW → Manager Return → AUDITEE_RETURNED → Auditee Resubmit → MANAGER_REVIEW → Manager Approve → AUDITOR_REVIEW`

At the end, Section 7 must retain all four chronological events:

1. initial Auditee submit;
2. Manager return with its comment;
3. Auditee resubmit;
4. Manager approval.

Browser reverification is pending and is not marked PASS.

## Real browser verification still required

Current Staging has a real active Auditee and Section Manager for the smoke section, but no persisted active `AUDITOR` user profile / `user_auditor_links` mapping.

The immediately testable real-browser path is therefore:

1. Manager sees the decision controls.
2. `Setujui & Kirim ke Auditor` is disabled with the explicit missing-Auditor blocker.
3. `Kembalikan ke Auditee` stays disabled until a Manager comment is entered.
4. Manager returns the LTP and the status becomes `Dikembalikan ke Auditee`.
5. Auditee receives `LTP dikembalikan untuk revisi`, opens the LTP, sees the Manager comment, and can edit again.
6. Auditee saves and resubmits; the LTP returns to `Menunggu Section Manager` and a fresh Manager notification appears.

Positive real-browser `Setujui → AUDITOR_REVIEW` requires provisioning a real authenticated Auditor identity linked to an eligible active auditor master. No real credentials are created implicitly by this batch.

## Deferred

- Auditor verification / return / close decision UI and RPC.
- Admin/QMS final approval/rejection.
- Finding operational status synchronization.
- LTP `CLOSED` transition.
