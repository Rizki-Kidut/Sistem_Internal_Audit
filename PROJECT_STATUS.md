# PROJECT_STATUS.md — CertiTrack Internal Audit Module

## Documentation Policy and Current Snapshot

`PROJECT_STATUS.md` is the canonical source of truth for project history, current implementation
state, PR/merge lineage, runtime and browser verification, migration/security evidence, known issues,
and deferred scope. `PROJECT_PLAN.md` remains the forward-looking roadmap, `AGENTS.md` contains
engineering-agent operating rules, and `Readme.md` remains the repository landing page.

This documentation snapshot starts from `main` commit
`9e4f0eadf01dcf1412b19b45a789bfb0d3d314dc`, the squash merge of PR #16 (Batch 7e).
The next active slice is Batch 7f — Admin/QMS LTP final decision.

## Batch 7f — Admin/QMS LTP Final Decision — 31 Aug 2026

**Status:** `IMPLEMENTED_UNVERIFIED — STAGING/RUNTIME/BROWSER PENDING`

- [x] Added the hardened Admin/QMS decision design: `ADMIN_REVIEW → AUDITOR_RETURNED` for mandatory-comment Return and `ADMIN_REVIEW → CLOSED` for final Approve after Auditor `CLOSE`. No new LTP status was introduced.
- [x] Extended the authoritative Auditor RPC and blockers for both `AUDITOR_REVIEW` and `AUDITOR_RETURNED`. Eligible annual/global Auditors retain the existing OPEN/CLOSE semantics, and both Auditor notification types are closed after a successful decision.
- [x] Added immutable cumulative Admin workflow events, Auditor-return and terminal LTP notifications, Admin permissions/blockers in the LTP context, Section 8 returned-state feedback, Section 9 Admin controls/read-only history, and Indonesian timeline/worklist labels.
- [x] Admin authority remains database-enforced as authenticated + active `ADMIN`; Auditor authority remains active `AUDITOR` plus `auditor_user_can_receive_finding`. Direct table-write/RLS policy behavior is unchanged.
- [x] Repository migration: `20260831010000_add_ltp_admin_final_decision.sql`; SHA-256 `8433c355ddf6c6d6c6a2fde5c8b18b1135f29403c76e3a12a82aae3575d79bdc`.
- [ ] Staging migration ledger version/name and applied status are pending because no authenticated Supabase/Staging connection is available in this workspace.
- [ ] The rollback-only 21-case runtime matrix, notification fan-out verification, event immutability re-check, and Security Advisor run are pending Staging access. Security Advisor cleanliness is not claimed.
- [x] Static validation passed: `npm run typecheck`, `npm run build`, changed-file ESLint, and `git diff --check`. Build retained only the existing Browserslist and bundle-size advisories.
- [ ] Vercel deployment and user-driven browser smoke are pending. The reserved fixture must remain `ADMIN_REVIEW`, revision 14, Auditor result `CLOSE`, eight events, latest `AUDITOR_VERIFIED_CLOSE_TO_ADMIN`, while its Finding remains `Open / LEGACY_ESTABLISHED` until the user performs the browser route.
- [x] Finding synchronization is intentionally deferred to Batch 7g. Batch 7f never mutates `findings.status`, `findings.review_status`, or `findings.car_id`, including when the LTP reaches `CLOSED`.
- [x] Existing applied migrations and the nested `/project` snapshot remain untouched.

Changed files: `PROJECT_STATUS.md`, `src/lib/ltpWorkflowTypes.ts`, `src/lib/enums.ts`,
`src/services/ltpService.ts`, `src/components/pages/LtpPage.tsx`,
`src/components/pages/ltp/LtpAuditorReview.tsx`, `src/components/pages/ltp/LtpWorkflowHistory.tsx`, new
`src/components/pages/ltp/LtpAdminReview.tsx`, and the single additive migration above.

## Batch 7e — LTP Auditor Verification — 30 Aug 2026

**Status:** `VERIFIED_COMPLETE — MERGED`

Merged through PR #16. Approved PR head: `1ff6c89680654f2d5403483b1e059422fa6316b8`;
squash merge commit: `9e4f0eadf01dcf1412b19b45a789bfb0d3d314dc`.

- [x] Added controlled Auditor verification using the existing annual-access authority
      `auditor_user_can_receive_finding(auth.uid(), finding_id)`. Normal Team Auditors require an
      active annual Plan/Team assignment; the company Lead Auditor retains global authority. Admin,
      Auditee, Section Manager, inactive-assignment Auditors, and outsider Auditors fail closed.
- [x] `OPEN` requires a non-empty Auditor comment and atomically transitions
      `AUDITOR_REVIEW → AUDITEE_RETURNED`, stores latest result `OPEN`, increments the revision once,
      appends `AUDITOR_VERIFIED_OPEN_TO_AUDITEE`, closes every pending Auditor-review notification,
      and notifies the active matching Auditee with an explicit `Catatan Auditor`. Revised content
      continues through Auditee → Section Manager → Auditor; `AUDITOR_RETURNED` is not used.
- [x] `CLOSE` atomically transitions `AUDITOR_REVIEW → ADMIN_REVIEW`, stores latest result `CLOSE`,
      increments the revision once, appends `AUDITOR_VERIFIED_CLOSE_TO_ADMIN`, closes every pending
      Auditor-review notification, and creates `LTP_ADMIN_REVIEW` for every active Admin identity.
      It does not set LTP `CLOSED` or alter the Finding lifecycle.
- [x] Added Section 8 Auditor controls/history. Extracted `Riwayat Review & Persetujuan` into one
      global cumulative component rendered after the workflow-stage cards, with oldest-to-newest
      multi-cycle Manager/Auditor history and graceful omission of unknown future events.
- [x] Section 7 now derives its read-only historical result from the latest authoritative Manager
      workflow event rather than the current global LTP status. It remains visible after Manager
      participation, including Auditor return and Admin-review stages; controls remain limited to an
      authorized current `MANAGER_REVIEW`.
- [x] The immutable repository migration is
      `20260830010000_add_ltp_auditor_verification.sql`, SHA-256
      `5b2dbfa000dfb002db2518f2263b755d2217c8cb718b89ee3c09e43c7ac68a5b`.
      The independently verified Staging migration ledger records the applied migration separately as
      `20260830150924 · add_ltp_auditor_verification`; the repository filename is not represented as an
      identical ledger version.
- [x] Rollback-only runtime verification passed: active annual normal Auditor; inactive annual denial;
      outsider denial; global company Lead; Admin/Auditee/Manager denial; mandatory OPEN comment;
      stale revision; OPEN/CLOSE transitions; exactly one revision/event; next-recipient notification;
      all-Auditor notification cleanup; second-decision rejection; missing Auditee/Admin blockers;
      immutable event UPDATE/DELETE; and unchanged Finding status/review/link state. Cleanup checks
      found zero `B7E-RUNTIME` Findings and zero rollback identity profiles.
- [x] Function ACL verification passed: the blocker helper is unavailable to `anon` and
      `authenticated`; the mutation RPC is unavailable to `anon` and intentionally executable by
      `authenticated`, with identity/annual ownership checks enforced internally.
- [x] Security Advisor reports the existing authenticated-callable `SECURITY DEFINER` warning class,
      including the intentionally exposed `auditor_verify_ltp` RPC, plus the existing leaked-password
      protection warning. Complete Security Advisor cleanliness is not claimed. Remediation reference:
      https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- [x] `npm run typecheck`, `npm run build`, changed-file ESLint, and `git diff --check` passed. Build
      output contained only the existing Browserslist-data and bundle-size advisories.
- [x] Final real-browser fixture `QA-9910/MFG/2099/001` (car
      `0d59f75f-04b8-4dfe-bf0f-5d43f0943afe`) is at `ADMIN_REVIEW`, revision `14`, latest Auditor
      result `CLOSE`, with eight workflow events and latest event
      `AUDITOR_VERIFIED_CLOSE_TO_ADMIN`. Its Finding remains `Open / LEGACY_ESTABLISHED`.
      `tl@gmail.com` remains a normal active `AUDITOR`, company Lead false, active on Plan 2099 /
      `B6B-SMOKE-TEAM`, and Team Leader true.
- [x] Vercel Preview deployment for the implementation commit completed successfully.

### Real-browser workflow — PASS

The controlled browser sequence used normal annual Auditor `tl@gmail.com`, Auditee
`auditee@gmail.com`, Section Manager `manager@gmail.com`, and Admin `rizkihidayat1994@gmail.com`.

- [x] **Initial Auditor review:** at `AUDITOR_REVIEW`, revision `9`, result `NULL`, Section 7 retained
      the latest Manager approval, Section 8 exposed the eligible Auditor controls, OPEN enforced a
      comment, CLOSE was available, and the global history showed the existing four events in order.
- [x] **Auditor OPEN:** comment `Bukti tindakan korektif perlu diperjelas dan diverifikasi kembali.`
      produced `AUDITOR_REVIEW → AUDITEE_RETURNED`, revision `9 → 10`, result `OPEN`, and exactly one
      `AUDITOR_VERIFIED_OPEN_TO_AUDITEE` event. Section 7 retained the prior Manager approval, Section 8
      became historical/read-only, all earlier history remained visible, the Finding was unchanged,
      and the Auditee notification identified `Catatan Auditor` with the exact comment.
- [x] **Browser-found return-banner correction:** the initial Auditee banner incorrectly selected only
      `MANAGER_RETURNED_TO_AUDITEE`, so it displayed the old Manager return and comment after Auditor
      OPEN. The correction in PR #16 selects the newest authoritative return event from
      `MANAGER_RETURNED_TO_AUDITEE` or `AUDITOR_VERIFIED_OPEN_TO_AUDITEE`. Browser re-test passed:
      Auditor return displays `LTP dikembalikan oleh Auditor untuk diperbaiki kembali.`, `Catatan
      Auditor`, and the correct comment; Manager return retains Section Manager wording and `Catatan
      Manager`; unknown/legacy return data uses neutral wording without inventing an actor.
- [x] **Auditee rework/resubmit:** Draft save incremented revision `10 → 11`; submit produced
      `AUDITEE_RETURNED → MANAGER_REVIEW`, revision `11 → 12`, retained result `OPEN`, and event count
      six with latest `AUDITEE_SUBMITTED_TO_MANAGER`. The form became read-only, Section 7 returned to
      active Manager review, the prior Auditor OPEN remained visible in Section 8/history, a new Manager
      notification was created, and the Auditee return notification became read.
- [x] **Manager reapproval:** `MANAGER_REVIEW → AUDITOR_REVIEW` incremented revision `12 → 13`, retained
      result `OPEN`, and produced event count seven with latest `MANAGER_APPROVED_TO_AUDITOR`. Section 7
      returned to historical Approved state, Section 8 became active, the prior OPEN remained visible,
      and a fresh `LTP_AUDITOR_REVIEW` notification was created for `tl@gmail.com`.
- [x] **Auditor CLOSE:** comment `Sudah sesuai` produced `AUDITOR_REVIEW → ADMIN_REVIEW`, revision
      `13 → 14`, result `CLOSE`, event count eight, and latest event
      `AUDITOR_VERIFIED_CLOSE_TO_ADMIN`. The prior OPEN remained permanently in history, Section 8
      showed Close/actor/timestamp/comment and `Dikirim ke Admin/QMS`, obsolete Auditor notifications
      became read, active Admins received `LTP_ADMIN_REVIEW`, and the Finding remained
      `Open / LEGACY_ESTABLISHED`.
- [x] **Admin receive/read-only:** `rizkihidayat1994@gmail.com` opened the Admin/QMS notification and
      read the LTP at `ADMIN_REVIEW`. Section 7 showed the latest Manager approval; Section 8 showed
      Close, Auditor `B6B Smoke Auditor Lead`, comment `Sudah sesuai`, and `Dikirim ke Admin/QMS`;
      cumulative history remained visible; no Admin decision controls existed; and the notification
      became read.

The real workflow retained all eight events oldest-to-newest:

1. Auditee mengirim LTP ke Section Manager
2. Section Manager mengembalikan LTP ke Auditee
3. Auditee mengirim ulang LTP ke Section Manager
4. Section Manager menyetujui LTP dan mengirim ke Auditor
5. Auditor memverifikasi Open dan mengembalikan LTP ke Auditee
6. Auditee mengirim ulang LTP ke Section Manager
7. Section Manager menyetujui LTP dan mengirim ke Auditor
8. Auditor memverifikasi Close dan mengirim LTP ke Admin/QMS

This confirms that Manager and Auditor history remains cumulative across repeated rework cycles;
the earlier Auditor OPEN remains preserved after the later CLOSE.

- [ ] **Batch 7f deferred:** Admin/QMS final decision, Admin/QMS return to Auditor using reserved status
      `AUDITOR_RETURNED`, and final Admin approval.
- [ ] **Later final synchronization deferred:** LTP `CLOSED` and Finding operational-status/final-close
      synchronization as appropriate.

Changed files: `PROJECT_STATUS.md`, `src/lib/ltpWorkflowTypes.ts`, `src/services/ltpService.ts`,
`src/components/pages/LtpPage.tsx`, `src/components/pages/ltp/LtpManagerReview.tsx`, new
`src/components/pages/ltp/LtpAuditorReview.tsx`, new
`src/components/pages/ltp/LtpWorkflowHistory.tsx`, and the single additive migration above.

## PR #14 — Admin User Management and Annual Auditor Access — 30 Aug 2026

**Status:** `VERIFIED_COMPLETE — MERGED`

Merged into `main` through PR #14. Approved PR head before merge:
`7faffcf06795c81a9d9843192642943b6849799d`; squash merge commit:
`5727f32acac35f4e973b799bf1b7aa590181bf46`.

### Direct user provisioning — PASS

- [x] The active flow is **Admin → Manage User → Tambah User → email/name/NIK → role + mapping →
      Simpan**. `admin-create-user` creates the Supabase Auth user server-side with confirmed email,
      after which the CertiTrack role/mapping is active immediately.
- [x] CertiTrack-Staging runs `admin-create-user` version 2 as ACTIVE with JWT verification enabled.
      Its Auth Admin call is `admin.auth.admin.createUser({ email, email_confirm: true })`.
- [x] No password or `password_hash` is created, and no invitation or email-verification workflow is
      used. Current provisioning creates an Auth UUID, confirmed email identity, and CertiTrack
      role/mapping only. Corporate email/SSO authentication remains separate future scope and is not
      implemented by this PR.
- [x] The original invitation flow was removed from the React application. The remotely deployed
      `admin-invite-user` remains temporarily available but is deprecated and unused; the active
      application function is `admin-create-user`.

### Real-browser provisioning and duplicate rejection — PASS

- [x] Real-browser provisioning created `auditee2@gmail.com` as Rizki / NIK `9999`, role Auditee,
      Section Quality Control. Manage User displayed Auditee, Aktif, Quality Control, and Auth
      **Terdaftar**.
- [x] Supabase Auth UUID is `7db7f3e8-5cf0-44b5-931c-ab87ac20c2d3` and
      `email_confirmed_at` is populated. Auth logged `user_signedup` through `POST /admin/users`; the
      v2 Edge Function returned HTTP 201. No new `invite` / `mail.send` event accompanied this
      successful creation.
- [x] This successful direct-provisioning record is distinct from the older invited Auth fixture for
      the same email. The deprecated-flow fixture was deleted; the current UUID above was created
      through `/admin/users`.
- [x] A second creation attempt for `auditee2@gmail.com` was rejected with HTTP 409 and the expected
      browser guidance: **Email sudah terdaftar di Auth. Cari dan edit user tersebut dari Manage
      User.** Exactly one Auth user remained and no duplicate identity was created.

### Real-browser role-transition matrix — PASS

- [x] **AUDITEE → SECTION_MANAGER:** Section Manager / Quality Control became active with no Auditor
      mapping or annual Auditor assignment.
- [x] **SECTION_MANAGER → AUDITOR:** Auditor Master was linked with `is_lead_auditor = false`; active
      assignment became Plan 2099 / `B6B-SMOKE-PLAN-2099`, Team `B6B-SMOKE-TEAM`; the Section
      assignment was removed/inactivated. The selected Auditor Master was not Team Leader, and Manage
      User correctly displayed `2099 · B6B-SMOKE-TEAM` without a Team Leader suffix.
- [x] **AUDITOR → LEAD_AUDITOR:** persisted identity remained `AUDITOR`,
      `is_lead_auditor = true`, Auditor Master remained linked, effective scope became Global, and
      annual and Section assignments became Nonaktif. Annual Plan/Team are not required for company
      Lead Auditor.
- [x] **LEAD_AUDITOR → ADMIN:** `identity_type = ADMIN`, scope Global, `auditor_id = null`, and
      `is_lead_auditor = null`; prior annual and Section assignments remain historical but Nonaktif.
      Role-transition cleanup therefore passed.
- [x] Team Leader (`audit_team_master_members.is_team_leader`) and company Lead Auditor
      (`user_auditor_links.is_lead_auditor`) remained independent concepts throughout.

### Authorization and annual Auditor access — PASS

- [x] A real-browser non-Admin login did not show Manage User. Source-level page authorization also
      places `user-management` only in the Admin allowed-page list, and `App.tsx` calls
      `canAccessPage(identityType, currentPage)` before rendering. The UI/page authorization gate
      passed and is not sidebar-hiding only.
- [x] The Edge Function retains its server-side active-Admin check. An authenticated non-Admin direct
      POST to `admin-create-user` was **not separately browser-tested** and is not claimed PASS.
      Previously verified Admin RPC denial/runtime checks remain valid.
- [x] Normal Auditor access requires a linked Auditor Master plus an active annual Plan/Team
      assignment. Team roster alone does not grant new-year access; explicit annual assignment does,
      and deactivation removes scoped access. Company Lead Auditor remains global; Team Leader remains
      roster-derived. Notification delivery and LTP Manager → Auditor recipient availability use the
      same annual access gate.
- [x] Existing smoke Team Leader `tl@gmail.com` remains a normal `AUDITOR`, Team Leader on
      `B6B-SMOKE-TEAM`, active on Annual Plan 2099, and `is_lead_auditor = false`. This fixture was
      not changed by the PR #14 closeout.

### Static, deployment, and migration verification — PASS

- [x] `npm run typecheck`, `npm run build`, and `git diff --check` passed. Only the non-blocking
      Browserslist/caniuse-lite and bundle-size advisories remain.
- [x] Vercel implementation deployment passed. `admin-create-user` version 2 is ACTIVE with JWT
      verification enabled.
- [x] Applied staging migration
      `20260828055425_add_admin_user_management_and_annual_auditor_access.sql` remains immutable and
      unchanged. Verified SHA-256:
      `15f53adb08a90ef3d3bdc3107a95d6fb581f4752ccd8ed4d428493c3a6d2b02d`.
- [x] The nested `/project` snapshot remains untouched.

Implementation files in PR #14 are the previously recorded Manage User UI/types/service,
`admin-create-user` Edge Function, authorization/annual-access integration, and the single immutable
migration. The PR is merged and its implementation/runtime evidence above is final; this later
documentation consolidation changes no application, service, Edge Function, migration, Supabase
configuration, or `/project` file.

## Batch 7d — Section Manager LTP Decision — 29 Aug 2026

**Status:** `VERIFIED_COMPLETE — MERGED`

Merged through PR #13 with merge commit `5d46218c4f1625d7dc628b49a0eae4c18d3f5ebd`.

- [x] Corrected `7. Review Section Manager` so it remains visible after a Manager Return or Approve decision.
- [x] `AUDITEE_RETURNED` now shows the latest `MANAGER_RETURNED_TO_AUDITEE` actor, timestamp, and Manager comment as read-only workflow history.
- [x] `AUDITOR_REVIEW` now shows the latest `MANAGER_APPROVED_TO_AUDITOR` actor, timestamp, and optional Manager comment as read-only workflow history.
- [x] Interactive Manager controls remain restricted to `MANAGER_REVIEW`; workflow events remain database-authoritative and no notification, service, schema, or migration behavior changed.
- [x] Added a cumulative chronological `Riwayat Review & Persetujuan` timeline beneath the unchanged current-state area. It distinguishes initial Auditee Submit from Resubmit through authoritative status transitions and shows actor, timestamp, and only non-empty comments.
- [x] Unknown future workflow events fail gracefully without exposing raw internal event names or breaking Section 7.
- [x] Real-browser Manager Return passed for `QA-9910/MFG/2099/001`: mandatory comment enforcement, `MANAGER_REVIEW → AUDITEE_RETURNED`, retained post-decision Section 7 status, authoritative Manager actor/timestamp/comment, Auditee Return notification, visible feedback, and restored Auditee editing all passed.
- [x] Real-browser Auditee Resubmit passed: `AUDITEE_RETURNED → MANAGER_REVIEW` produced a fresh Manager-review state and notification.
- [x] Real-browser Manager Approve passed: `MANAGER_REVIEW → AUDITOR_REVIEW`; retained post-decision Section 7 status and the Manager actor/timestamp passed. The existing authenticated smoke Auditor / Team Leader satisfied the annual assignment gate and received the Auditor-review notification.
- [x] Cumulative `Riwayat Review & Persetujuan` passed at `AUDITOR_REVIEW`, retaining all four authoritative events oldest-to-newest with Indonesian labels/timestamps, actors, the multi-line Return comment, and no raw internal enums. Initial submit and resubmit were correctly distinguished from `from_status` / `to_status`.
- [x] Latest implementation head `39834fa31874d285a32306f08d91f01fbb2568bd` passed `npm run typecheck`, `npm run build`, and `git diff --check`; Vercel Preview deployment completed successfully. The build reported only the existing Browserslist-data and bundle-size advisories.
- [x] Runtime/database rollback and ACL/security verification remain valid, including fail-closed missing-Auditor approval and the expected authenticated-callable `SECURITY DEFINER` Security Advisor warning class; Security Advisor is not claimed completely clean.
- [ ] Auditor verification / Return / approval / close, Admin/QMS final LTP approval/rejection, Finding operational-status synchronization, and final LTP `CLOSED` transition remain deferred.
- [x] PR #13 was merged after explicit approval; its verified implementation and evidence are now on
      `main` at merge commit `5d46218c4f1625d7dc628b49a0eae4c18d3f5ebd`.

Historical PR #13 implementation changed the Manager review component and its consolidated status
record; no migration was added or changed by the final browser-history refinement.

## Batch 7c — Auditee Submit to Section Manager Review — 28 Aug 2026

**Status:** `VERIFIED_COMPLETE`

- [x] Auditee Submit moves a complete `AUDITEE_DRAFT` / `AUDITEE_RETURNED` LTP to
      `MANAGER_REVIEW` with row locking, fail-closed `revision_version` concurrency, exactly one
      revision increment, and one immutable `AUDITEE_SUBMITTED_TO_MANAGER` event.
- [x] Database-authoritative submit gates require Dampak Temuan, Manfaat Perbaikan, at least three
      persisted Why levels for A/B (none for C), Tindakan Korektif, PIC and Due Date for every action,
      required BEFORE/AFTER or BEFORE_AFTER evidence, and an active matching Section Manager.
- [x] Submit creates recipient-scoped `LTP_MANAGER_REVIEW` notifications; the Manager worklist can
      mark a notification read and open the matching LTP. Auditee content becomes read-only after
      submission, while Manager access remains section-scoped.
- [x] Applied Staging migrations
      `20260827090527_add_ltp_submit_manager_review_foundation.sql` and
      `20260828004515_notify_section_manager_on_ltp_submit.sql` are immutable; later corrections must
      be additive.
- [x] Rollback runtime verification passed blocker derivation, stale-revision and double-submit
      rejection, single revision/event mutation, Finding lifecycle preservation, scoped Manager
      access, outsider denial, notification backfill/creation, recipient RLS, and read-at-only
      notification mutation.
- [x] Browser verification passed with `QA-9910/MFG/2099/001`: the LTP reached
      `MANAGER_REVIEW`, became read-only for the Auditee, appeared for the matching Manager, displayed
      submission actor/time, and opened correctly from the LTP notification.

## Batch 7b — Auditee LTP Authoring — 26 Aug 2026

**Status:** `VERIFIED_COMPLETE`

- [x] Added authorized Auditee Draft authoring for `AUDITEE_DRAFT` / `AUDITEE_RETURNED`, with
      database-derived edit authority and read-only response views for other authorized identities.
- [x] Added one atomic Draft RPC with row locking, optimistic `revision_version` concurrency, exactly
      one revision increment, and synchronized Why, action, and system-revision children. Save Draft
      permits partial content and does not change LTP/Finding lifecycle state.
- [x] Added A/B Why-Why editing with contiguous non-empty persistence; category C hides Why and the
      database rejects a non-empty Why payload.
- [x] Added Temporary, Corrective, and Preventive action authoring. Category C locally initializes an
      absent Corrective action from `finding.saran_perbaikan` only for an authorized editable Auditee;
      read-only identities see only persisted LTP responses, and the Finding is never modified.
- [x] Added private `audit-evidence` action evidence under the isolated `ltp/<car>/<action>/<state>/`
      namespace, controlled metadata RPCs, BEFORE/AFTER/BEFORE_AFTER uploads, signed viewing, and
      editable-state delete. The aligned migration
      `20260827031020_enable_ltp_before_after_evidence.sql` was applied to CertiTrack-Staging.
      Runtime verification confirmed that BEFORE, AFTER, and BEFORE_AFTER parse correctly; malformed or
      unsupported states fail closed; and authorized scoped Auditee BEFORE_AFTER read, insert, and delete
      predicates pass. Storage remains private and the existing authorization/path matching remains intact.
      Storage policies expose only high-level identity-aware predicates; low-level path parsers remain
      private, and DELETE permits authorized orphan cleanup without requiring the action row to survive.
- [x] Browser smoke identified confusing dirty evidence UX. Final verified behavior disables evidence Upload
      and Delete while the Auditee has unsaved Draft changes and displays: “Simpan Draft terlebih dahulu
      sebelum mengubah bukti agar perubahan form tidak hilang.” Evidence View/Open and Simpan Draft remain
      available. The service/handler dirty guard remains as defense-in-depth. This correction is UI-only,
      with no migration, RLS, Storage policy, or service change; the latest Vercel deployment succeeded and
      the user confirmed the browser behavior matches expectation.
- [x] Added editable system revisions using the three existing categories.
- [x] Hardened Batch 7a LTP target-section parsing with a safe UUID helper in the new additive migration;
      the applied Batch 7a migration remains unchanged.
- [x] Source validation passed: `npm run typecheck`, `npm run build`, changed-file ESLint, and
      `git diff --check`. The build reported only the existing bundle-size/Browserslist advisories. No new
      test run is claimed for the final UI-only dirty-state refinement; its latest Vercel deployment succeeded.
- [x] Initial Batch 7b migration was applied to CertiTrack-Staging as `20260826134353`; positive A/B
      and category-C rollback runtime checks passed, and the Storage predicate matrix passed.
- [x] Runtime verification found that a NULL `expected_revision` bypassed the original nullable
      comparison. Additive migration `20260826140536_fix_ltp_draft_revision_guard.sql` replaces only
      that comparison with fail-closed `IS DISTINCT FROM` optimistic concurrency.
- [x] The additive concurrency correction was applied successfully to CertiTrack-Staging. Runtime verification
      rejected both NULL and stale numeric `expected_revision` values with `LTP_STALE_REVISION`; a matching
      revision saved successfully and incremented exactly once; and Admin/non-Auditee mutation was rejected.
      No LTP status or Finding lifecycle change occurred.
- [x] Real deployed-browser Auditee smoke passed for the editable Draft form; Dampak Temuan / Manfaat
      Perbaikan; A/B Why-Why authoring; Temporary, Corrective, and Preventive actions; PIC and Due Date;
      system revision entry; Save Draft persistence; and the three separate Bukti Sebelum, Bukti Sesudah,
      and Perbandingan Before vs After evidence surfaces. Real uploads to all three states appeared in the
      correct group; signed evidence open/view and delete worked; and refresh confirmed deleted evidence
      stayed deleted.
- [x] Post-browser database verification confirmed evidence metadata paths matched their states, uploaded
      Storage objects existed, deleted metadata and its Storage object were removed, no orphan LTP Storage
      object remained, and remaining evidence stayed intact. The LTP remained `AUDITEE_DRAFT`, Finding
      operational status remained Open, `findings.car_id` remained NULL, and zero `car_workflow_events` were
      created. Database-side read verification also confirmed Admin can read the authored LTP context while
      receiving `can_edit_auditee = false`; no Admin browser smoke is claimed.
- [ ] Submit ke Section Manager, Manager approve/reject, Auditor verification, Admin/QMS final approve/reject,
      notifications, LTP Closed transition, and any later-approved Finding compatibility/status synchronization
      remain pending future controlled slices. This `VERIFIED_COMPLETE` status is limited deliberately to
      Batch 7b Auditee Draft authoring and does not mark those later workflow stages complete.

Changed files: `PROJECT_STATUS.md`, `src/components/pages/LtpPage.tsx`,
`src/components/pages/ltp/LtpAuditeeForm.tsx`, `src/services/ltpService.ts`, `src/lib/enums.ts`,
`src/lib/types.ts`, `supabase/migrations/20260826134353_add_ltp_auditee_authoring.sql`,
`supabase/migrations/20260826140536_fix_ltp_draft_revision_guard.sql`, and
`supabase/migrations/20260827031020_enable_ltp_before_after_evidence.sql`.

## Batch 7a — LTP Foundation — 26 Aug 2026

**Status:** `VERIFIED_COMPLETE`

- [x] User-facing terminology is **LTP — Laporan Tindakan Perbaikan**; historical internal names
      (`cars`, `car_id`, and `kode_car`) remain for backward compatibility without a broad rename.
- [x] Added the Finding `1 : 0..1` LTP relationship through `cars.finding_id UNIQUE`; No. LTP is
      exactly the published Finding `kode_temuan` and has no independent sequence.
- [x] Added normalized foundation tables for LTP headers, unlimited Why analysis levels, typed actions,
      action-evidence metadata, system revisions, and append-only workflow events.
- [x] Eligible `PUBLISHED` / `LEGACY_ESTABLISHED` Findings with complete PLOR create LTP idempotently.
      Target section is assigned only when exactly one valid `seksi_marks` target exists.
- [x] Added identity-scoped RLS and SELECT-only authenticated browser privileges: Admin and company
      Lead Auditor read globally, Auditor reads Team-owned LTP, and Auditee/Section Manager read only
      through their active matching section assignment. Anonymous access is denied.
- [x] Added the authorized LTP worklist and read-only derived context RPCs, service layer, enabled LTP
      menu for all four identities, worklist/search/status filter, and read-only LTP/PLOR detail.
- [x] CertiTrack-Staging migration applied successfully and recorded as
      `20260826064707 create_ltp_foundation`; the Git migration filename is aligned to
      `20260826064707_create_ltp_foundation.sql` without changing the SQL blob.
- [x] Staging backfill produced exactly 3 eligible LTP rows, all starting at `AUDITEE_DRAFT`; all three
      preserve `kode_car = findings.kode_temuan`, derive the expected target section, and leave
      `findings.car_id` / operational `findings.status` untouched.
- [x] Runtime/RLS identity verification passed **8/8** with rollback-only fixtures: Admin, Team Auditor,
      company Lead Auditor, scoped Auditee, and scoped Section Manager receive the intended LTP visibility;
      outsider Auditor and out-of-scope Auditee/Manager receive zero rows. Worklist/context RPCs and all
      normalized child-table SELECT boundaries matched the same ownership rules.
- [x] Security/integrity checks passed: anonymous table/RPC access is denied; authenticated browser roles
      remain SELECT-only on LTP tables; duplicate `cars.finding_id` is rejected; workflow-event UPDATE is
      rejected; rollback cleanup left zero temporary Auth/profile/mapping/Auditor/child fixtures.
- [x] Deployed-browser Auditee smoke confirmed the LTP landing/worklist and read-only detail page against
      CertiTrack-Staging, including the expected 3 section-scoped LTP records. Mutable authoring is
      intentionally not part of this foundation slice.
- [x] Source validation passed: `npm run typecheck`, `npm run build`, changed-file ESLint, and
      `git diff --check`. Vercel deployment status for the verified branch head is successful.
- [ ] Mutable LTP editor, Why-Why/action evidence operations, and Manager → Auditor → Admin workflow
      remain pending for subsequent controlled slices.

Changed files: `PROJECT_STATUS.md`, `src/App.tsx`, `src/components/layout/Sidebar.tsx`,
`src/components/pages/LtpPage.tsx`, `src/lib/auth.ts`, `src/lib/enums.ts`, `src/lib/types.ts`,
`src/services/ltpService.ts`, and
`supabase/migrations/20260826064707_create_ltp_foundation.sql`.

## Batch 7.0 — Identity & Access Foundation — 23 Aug 2026

**Status:** `VERIFIED_COMPLETE`

Merged through PR #9 on 26 Aug 2026.

- [x] Added persisted Supabase Auth session restoration, email/password login, logout, profile loading,
      missing/inactive-profile gates, and protection against protected-content flash.
- [x] Added one-identity-per-account profiles for Admin, Auditor, Auditee, and Section Manager; Auditor
      identities link to the existing temporary Training proxy `auditors` master rather than duplicating it.
- [x] Added validated Auditee/Manager section assignments, role-aware navigation, central page access,
      and restricted authenticated landing behavior for Auditee.
- [x] Added additive RLS hardening for anonymous rejection, Admin global access, Auditor Team ownership,
      Manager target-section Agenda visibility, direct-record isolation, execution-only Auditor updates,
      PLOR isolation, read-only Agenda access, and private Product evidence scoping.
- [x] Existing Finding synchronization, final execution lock, and public completion/reopen/blocker RPC
      architecture are retained; the three Batch 6b RPCs are explicitly kept `SECURITY INVOKER`.
- [x] Identity architecture uses one active CertiTrack identity per Auth account; multi-responsibility
      people use separate accounts rather than an in-session role switch. The first Admin is bootstrapped
      through trusted Supabase administration; subsequent identity/profile/mapping administration is
      Admin-only. The browser uses only the publishable/anon key and a normal Auth session.
- [x] Auditor ownership resolves `auth.uid()` → `user_auditor_links` → existing `auditors` proxy →
      Annual Team membership → Instruction row. Auditee and Section Manager scope resolves through active,
      type-compatible `section_identity_assignments`; incompatible mappings must be deactivated before a
      role transition so history is retained rather than silently deleted.
- [x] CertiTrack-Staging migration-chain, RLS/RPC authorization, Team isolation, Finding workflow,
      transactional Product annulment, notification isolation, Storage RLS boundary, concurrency stale-version,
      and fail-closed missing-company-Lead verification passed using rollback-only runtime fixtures.
      No temporary Auth/profile/mapping/notification/review/disposition fixtures remain after verification.
- [x] Real deployed-browser Auth/UI smoke passed with confirmed Supabase email/password users for Admin,
      Team Leader, Member, company Lead Auditor, outsider Auditor, Section Manager, and Auditee. Login,
      session restoration, logout, role-aware menus/page guards, Team isolation, Finding action visibility,
      notification UI, Admin correction, Team submit, Lead approval, and Admin release were verified.
      The private evidence bucket contained no real object for a browser signed-URL click test; the Batch 7
      Storage authorization boundary itself passed with rollback-only metadata fixtures and remains non-blocking.
- [x] Reconstruction and company-Lead correction validation gate: `npm run typecheck` and production
      `npm run build` pass; changed-file ESLint is clean. Repository-wide lint remains exactly at the known
      pre-existing baseline of 24 unused-symbol errors and zero warnings. Batch 7 migrations are applied on
      CertiTrack-Staging and Git migration filenames are aligned with the recorded Staging migration versions.
- [x] PR #9 static-review corrections now scope own-profile loading by `auth.uid`, require a current
      active Manager identity, reject incompatible profile identity changes, scope process/section/
      Manufacturing-bank/Team reference reads, and preserve Manager Agenda Team context.
- [x] Agenda read-only identities now receive Print only (no reopen control), token refresh updates the
      session without unmounting the current page, malformed evidence paths are rejected safely, and
      authenticated table privileges are normalized to SELECT/INSERT/UPDATE/DELETE (RLS remains the
      per-identity authority; TRUNCATE/REFERENCES/TRIGGER are not granted).
- [x] Findings are the deliberate privilege exception: authenticated identities, including Admin,
      receive only SELECT/UPDATE with matching RLS. Direct INSERT/DELETE remains unavailable and the
      existing Batch 6a SECURITY DEFINER source triggers remain the sole Finding lifecycle authority.

Batch 7 migrations applied and aligned with CertiTrack-Staging history:
`20260825155950_create_identity_access_foundation.sql`,
`20260825160109_enforce_identity_scoped_audit_access.sql`,
`20260825170649_create_finding_review_workflow.sql`,
`20260825181042_fix_identity_mapping_trigger.sql`,
`20260825182444_harden_identity_execution_trigger.sql`, and
`20260826033534_close_obsolete_finding_notifications.sql`.

### Finding review static implementation

> Terminology note: older Batch 3/5 historical entries that say “Lead Auditor” refer to the legacy
> Team-level `peran='Lead'` coordinator. In Batch 7 authority terminology that role is **Team Leader**;
> **Lead Auditor** means the single company-wide reviewer capability.

- [x] Corrected Team/Lead authority model without adding a new Auth identity type: every active Audit Team
      has exactly one Team Leader (`is_team_leader`; legacy `peran='Lead'` backfills this once), while the
      single company Lead Auditor is an independent `user_auditor_links.is_lead_auditor` capability and may
      review/approve/annul Findings from every Team even when not assigned to any Team.
- [x] Added Draft → Lead Review → Revision Required / Ready for Release / Annulled → Published RPC
      transitions, Team/Lead/Admin separation, mandatory PLOR checks, and concurrency-safe official numbering.
- [x] Added append-only review/change events, per-recipient notifications, optimistic PLOR versioning,
      immutable `created_at`, and normalized initial/effective source disposition for annulment.
- [x] Admin/QMS PLOR correction is explicitly a controlled exception: only Draft/Revision Required may be
      corrected through `save_finding_plor`, with a minimum ten-non-whitespace-character reason and immutable
      actor/reason/changed-fields/before/after `PLOR_EDITED` audit trail. The UI labels this action `Koreksi PLOR
      (Admin/QMS)`. It cannot alter Checklist/source judgement or execution state and does not bypass Team Leader
      → company Lead Auditor review; Admin may release approved Findings but cannot submit/resubmit,
      approve/annul, complete/reopen execution, direct-update ordinary PLOR fields, or hard-delete.
- [x] Product evidence authorization additionally verifies that the path phase belongs to its checklist.
- [x] Preserved every legacy Finding number, operational status, CAR relationship, PLOR, source link,
      and timestamp. Publication now uses separate `review_status`; existing numbered rows receive the
      non-historical `LEGACY_ESTABLISHED` compatibility marker without fake approval events.
- [x] Lead annulment now atomically captures the actual initial judgement, applies the conforming result
      to the authoritative source, retains its Finding link, appends immutable disposition/review history,
      and changes only `review_status`. Normal source sync is locked after submission.
- [x] Checklist/Pelaksanaan traceability resolves the exact RLS-scoped source item/question plus effective/
      original annulment results, reason, reviewer, and time. Admin receives no execution editor or
      Complete/Reopen control. Company Lead Auditor has company-wide review-context read access, while
      `can_execute` remains true only for Audit Teams where that Auditor is actually assigned.
- [x] Function ACL hardening revokes inherited application-function EXECUTE from `PUBLIC`/`anon`, keeps
      sensitive trigger/source-sync helpers private, and preserves the Batch 6b blocker/complete/reopen RPCs
      as authenticated-callable `SECURITY INVOKER` functions.
- [x] Staging migration chain and Git-history alignment passed. Release/workflow authorization matrix passed
      23/23; transactional Product annulment passed 5/5; stale optimistic-concurrency version was rejected;
      missing Company Lead Submit failed closed and rolled back; notification and Storage RLS isolation passed.
- [x] Supabase Security Advisor was reviewed after Batch 7 DDL. Remaining WARN notices are the expected
      authenticated-callable `SECURITY DEFINER` RPC/helper class; tested authority boundaries remained enforced.
- [x] Final deployed-browser/Auth UI smoke passed. Browser testing additionally found and corrected two
      concrete issues before merge: the shared Login button defaulted to `type="button"` instead of submitting
      the form, and completed Lead review left obsolete actionable notifications unread. The login submit fix
      is deployed, and the additive notification-lifecycle trigger now closes `LEAD_REVIEW` / `RESUBMITTED`
      after Lead decisions and `REVISION_REQUIRED` after Team resubmission.
- [x] Persistent browser-smoke cleanup passed: seven temporary Auth users, profiles, Auditor links, section
      assignments, two temporary Auditor masters, QA-9909 smoke notifications, and QA-9909 smoke review events
      were removed. QA-9909 was restored exactly to its pre-smoke `DRAFT`, revision version 1 baseline.

New Finding workflow migration: `20260825170649_create_finding_review_workflow.sql`. Batch 7 LTP/CAR, Agenda
approval, Auditor LTP verification, Section Manager LTP approval, and Admin final LTP approval remain
out of scope. The local `auditors` table remains a compatibility proxy pending the real Training adapter.

## Annual Team Audit Refinement — 20 Aug 2026

**Status:** `VERIFIED_COMPLETE`

- [x] Scoped normal Team Masters to an Annual Audit Plan with per-plan codes; existing NULL-plan
      records remain compatibility-only and are hidden from normal selection.
- [x] Added searchable Lead and searchable Member multi-select with chips, annual plan filtering,
      live Instruksi roster preview, and explicit Team lock/unlock lifecycle.
- [x] Team Master members are now authoritative for new QA workflow; legacy row/checklist auditor
      columns remain preserved but are no longer populated or used as current roster authority.
- [x] Added plan-matched locked-Team assignment, dynamic competency/independence checks, checklist
      prerequisites, locked-roster protection, and checklist-based assignment/unlock locks.
- [x] Final integrity correction makes locked Team headers/deletes database-stable and saves the
      complete Instruction row context plus Team assignment through one atomic RPC.
- [x] Relocking validates the live roster against every referenced QA's plan, execution-date
      competency, and independence/justification; referenced Teams cannot be deactivated.
- [x] Migrations `20260820160000_scope_team_master_by_annual_plan.sql` and
      `20260820170000_allow_unlocked_team_planning_updates.sql` were applied and runtime verified on
      CertiTrack-Staging.
- [x] Annual-plan scoping, reuse of the same Team code across plans, and cross-plan assignment
      rejection passed.
- [x] Locked header/roster/delete/deactivation protection, all-referenced-QA competency relock,
      independence/justification relock, and same-Team unlocked planning repair passed.
- [x] Atomic Instruction row/Team save passed; invalid Add Baris Audit left no orphan row.
- [x] Checklist creation required a valid locked Team, and Team unlock after checklist creation was
      rejected. Normal workflow created zero new legacy IA schedules.
- [x] Supabase Security Advisor reported zero security lints; final manual browser smoke passed.
      Annual Plan 2095/2096 and QA-970..QA-973 fixtures were cleaned, with no temporary Product
      evidence remaining.

The Workflow Architecture Refactor, Annual Team Audit Refinement, Batch 5b, and Batch 5c are
`VERIFIED_COMPLETE`; Batch 5d and later remain `NOT_STARTED`.

## Workflow Architecture Refactor — Instruksi / Team / Checklist — 20 Aug 2026

**Status:** `VERIFIED_COMPLETE`

- [x] Removed Jadwal & Tim Audit from normal navigation while retaining its legacy page/services and
      database tables for compatibility.
- [x] Added an additive migration that disables automatic legacy schedule/scope/team creation and
      replaces Generate-from-Program without legacy schedule dependencies.
- [x] Added reusable Team Audit master/member schema, atomic master save, one-Lead enforcement, RLS,
      and normalized indexes.
- [x] Added Team selection, competency/independence checks, justification, and checklist locking;
      the annual refinement above supersedes this pass's former QA snapshot authority.
- [x] Added the active central Checklist Audit worklist/router and removed the full editor tab from
      Instruksi in favor of row-level `Buka Checklist` navigation.
- [x] QA remains the primary identifier; IA schedules/scopes/teams are legacy and receive no new
      writes from normal Instruksi workflow.

The centralized Checklist Audit and annual Team workflows passed CertiTrack-Staging runtime and
manual browser verification. QA remains the primary identifier, normal workflow created zero new
legacy IA schedules, and Reguler/AuditProduk/AuditManufaktur/AuditShift routing passed. Batch 5b and
Batch 5c are `VERIFIED_COMPLETE`; Batch 5d and later remain `NOT_STARTED`.

New migration: `supabase/migrations/20260820140000_centralize_checklist_and_team_master.sql`.
Changed application areas: App/sidebar navigation, Instruksi rows, central Checklist workspace, Team
master page/service, checklist creation guards, centralized types/enums, and project documentation.
Static validation completed with typecheck/build/diff checks; lint remains at the known 26-error,
zero-warning unused-symbol baseline.

## Batch 5c — Checklist Audit Manufaktur & Shift — 20 Aug 2026

**Status:** `VERIFIED_COMPLETE`

### Implemented

- [x] Preserves persisted Plant/Shift selections alongside current matrix suggestions; legacy auditor
      JSON remains readable, while the annual Team master now drives the current roster display.
- [x] Added one additive migration for `checklist_manufaktur_shift`,
      `checklist_manufaktur_bank_items`, and `checklist_manufaktur_items`, including foreign keys,
      required indexes, updated-at triggers, current anon/authenticated RLS policies, and safe
      `search_path = pg_catalog, public` functions.
- [x] Added an atomic database function that creates a header from an `AuditManufaktur` or
      `AuditShift` instruction row and initializes its active bank items. It uses the instruction
      `row_id` and QA code, so Instruksi Audit and Jadwal Audit open the same persisted record.
- [x] Seeded only the known structural bank entries A-1 through A-19 and B-1 through B-3. Klausul
      and `item_pemeriksaan` remain null because no authoritative item-to-clause/question mapping is
      available and PROJECT_PLAN explicitly permits the full text to be completed later.
- [x] Added centralized Manufacturing/Shift types, structured multi-value Plant/Shift JSON entries,
      status/document constants, and reused the existing O/A/B/C/N-A result constants.
- [x] Added a dedicated service for header/item CRUD, atomic row-based creation, active-bank item
      initialization, bank editing/soft deactivation, relationship/result/numeric validation, and
      service-level Draft/Selesai mutation protection.
- [x] Added an Indonesian Manufacturing/Shift Checklist panel with inherited read-only QA code,
      manager, date, and auditors; Plant/Shift suggestions; editable operational header fields;
      item table; result editing; explicit return-to-Draft lifecycle; and compact bank management.
- [x] Routed both `AuditManufaktur` and `AuditShift` through the shared Checklist tab. `Reguler` and
      `AuditProduk` routing remains unchanged, and no placeholder remains for the four supported row
      types.
- [x] Database triggers reject completed-checklist header mutation/deletion and all child item
      mutation until the header is explicitly returned to Draft. `finding_id` is reserved only;
      no Finding/PLOR generation was added.

### CertiTrack-Staging verification

- [x] Migration `20260820130000_create_batch5c_manufacturing_shift_checklist.sql` applied
      successfully; database runtime, safe `search_path`, and security verification passed.
- [x] The live annual Team roster is authoritative; legacy Manufacturing auditor JSON remained
      empty for new records.
- [x] AuditManufaktur and AuditShift browser routes passed. QA-972 and QA-973 each created FORM-007
      with exactly 22 items.
- [x] Team unlock after checklist creation was rejected, no legacy IA schedule was created, and all
      final fixtures were cleaned.

Batch 5b remains `VERIFIED_COMPLETE`. Batch 5d and all later batches remain `NOT_STARTED`.

## PR #3 Refinement — 20 Aug 2026

- Instruksi Audit Matriks Seksi retains complete, non-wrapping `-90deg` labels and now anchors their
  lower end 10px above the bottom header border while preserving dynamic height and column widths.
- Program Internal Audit Schedule Dasar now uses `Tanggal Awal` / `Tanggal Akhir` instead of period
  checkbox columns. The Label Periode editor is no longer exposed in Program detail.
- `audit_program_steps.tanggal_awal` and `tanggal_akhir` are added through a new additive migration,
  with service and database validation that rejects an inverted date range.
- Existing `audit_programs.periode_label` and `audit_program_steps.periode_target` fields are retained
  unchanged for historical/backward compatibility only.
- Schedule Dasar permits a same-day range. The centralized `formatRentangTanggal()` helper is ready
  for future Program print/export output and collapses equal dates to one Indonesian date.
- Completed Product Checklists are immutable at service and database layers: checklist deletion and
  all phase/item/evidence mutations require returning the checklist to Draft first.
- Batch 5b and Batch 5c are `VERIFIED_COMPLETE`; Batch 5d and later remain `NOT_STARTED`.

## Batch 5b — Checklist Audit Produk — 20 Aug 2026

**Status:** `VERIFIED_COMPLETE`

### Implemented

- [x] Added the additive `checklist_produk`, `checklist_produk_fase`, and
      `checklist_produk_items` schema with foreign keys, lookup indexes, updated-at triggers, RLS,
      and database-level completion protection.
- [x] Added private Supabase Storage bucket configuration for `audit-evidence`, bucket-scoped access
      policies matching the current anon/authenticated application model, signed URL access, and
      product-checklist evidence metadata stored in `dokumen_bukti` (never binary/base64 data).
- [x] Added centralized Product Checklist status, judgment, document-code constants, and snake_case
      domain types.
- [x] Added a dedicated Product Checklist service for header/phase/item CRUD, inherited creation from
      an `AuditProduk` instruction row, evidence upload/delete/signed URLs, numeric/judgment
      validation, and completion evidence validation.
- [x] Added the Product Checklist UI with inherited read-only inspector details, editable product
      header, phase cards, evidence warnings/actions, item tables, OK/NG badges, and Draft/Selesai
      editing behavior.
- [x] Refactored the shared Checklist tab router: Reguler continues to use Checklist Sistem,
      AuditProduk uses Checklist Audit Produk, and AuditManufaktur/AuditShift remain Batch 5c
      placeholders. Both Instruksi Audit and Detail Sesi Audit resolve records by the same instruction
      `row_id`, so no duplicate page-specific Product Checklist data is created.
- [x] Static checks passed: `npm run typecheck`, `npm run build`, and `git diff --check`.

### CertiTrack-Staging runtime verification

- [x] Both Batch 5b migrations, `create_batch5b_product_checklist` and
      `add_program_step_date_range`, applied successfully.
- [x] **13/13 core database scenarios passed**, including acceptance of a same-day Schedule Dasar
      range and rejection of an inverted range.
- [x] Draft completion protection passed: zero phases and phases without evidence were rejected,
      while a checklist whose phases all contained evidence could become Selesai.
- [x] Completed-checklist immutability passed: checklist deletion, phase update/delete, and item
      insert/update/delete were rejected until the checklist returned from Selesai to Draft.
- [x] Returning Selesai → Draft restored allowed child editing.
- [x] Product Checklist RLS and intended anon application access were verified.
- [x] The `audit-evidence` bucket was verified private; its Storage policies were present and scoped
      only to that bucket.
- [x] All new Product Checklist functions use `search_path = pg_catalog, public`; Supabase Security
      Advisor reported zero security lints.
- [x] Manual real-browser smoke testing passed on the PR #3 Vercel Preview connected to
      CertiTrack-Staging, and the user confirmed the branch functions normally. This was manual
      real-browser smoke testing, not automated E2E testing.
- [x] Program Internal Audit displayed Tanggal Awal / Tanggal Akhir, accepted a same-day range, and
      `formatRentangTanggal()` collapsed equal dates to one displayed/exported date. Legacy
      `periode_label` / `periode_target` remained compatibility-only database fields.
- [x] Instruksi Audit Matriks Seksi vertical labels were bottom-aligned as requested.
- [x] Temporary `2097`, `QA-995`, and `IA-2097-995` fixtures were removed from Staging, and no
      temporary Product Checklist evidence objects remain.

Batch 5c is `VERIFIED_COMPLETE`; Batch 5d and all later batches remain `NOT_STARTED`. The stabilization status below remains
`VERIFIED_COMPLETE`.

## Stabilization Pass — 19 Aug 2026

**Status:** `VERIFIED_COMPLETE`

The stabilization gate was implemented against the repository-root application only. Batch 5b was
not started and the nested `project/` snapshot was not modified.

### Completed

- [x] Corrected Instruksi Audit Matriks Seksi headers to rotate each complete, non-wrapping section
      name bottom-to-top, with bounded dynamic header height and matching compact header/body widths.
- [x] Added additive, version-controlled schemas, indexes, RLS policies, and relationships for
      `audit_instructions`, `audit_instruction_rows`, `plants`, `target_models`, `shifts`,
      `checklists`, and `checklist_items`.
- [x] Added a separate corrective migration that moves the misplaced `anon_select_proses_seksi`
      policy to `proses_seksi` without changing the historical migration or application data.
- [x] Centralized QA allocation in the database `qa_audit_code_seq` / `next_qa_audit_code()` path.
      Existing values seed the sequence; QA codes are immutable; new duplicate inserts are rejected.
      A unique index is added when existing data has no duplicates, so an existing-data upgrade does
      not destructively rewrite duplicate historical values.
- [x] Replaced the per-program `QA-01` loop with the transactional
      `generate_instruction_from_program()` RPC. Header, all rows, matching scope propagation, and
      QA allocation now commit or roll back together. When no session exists yet, completing the
      instruction grid creates its schedule/scope/team in the same row-save transaction.
- [x] Added the specified **Generate dari Program** entry point to Program Internal Audit while
      retaining the existing Instruksi Audit entry point for compatibility.
- [x] Dynamic period-label editing was implemented and verified during stabilization; it has since
      been intentionally superseded by the Schedule Dasar date-range decision documented above.
- [x] Enforced Scheduled scope prerequisites inside `saveAuditSchedule()`, rather than only in UI.
- [x] Enforced required independence justification inside `upsertTeam()` in addition to UI.
- [x] Added required checklist header/item validation in the checklist service.
- [x] Enabled Detail Sesi Audit → Checklist and reused the existing Checklist Sistem component and
      `checklists`/`checklist_items` records by resolving instruction rows through propagated QA codes.
      No parallel checklist storage was introduced.
- [x] Added transactional synchronization from instruction-grid auditor assignments to the related
      schedule team.

### Real Supabase verification result

#### Migration and data preservation

- [x] A fresh Supabase project passed the initial clean chain of **11/11** migrations and then
      successfully applied `20260819211000_harden_functions_and_index_foreign_keys.sql`.
- [x] A separate `CertiTrack-Upgrade-Test` project first received only the nine historical migrations,
      representative pre-stabilization records, UUID snapshots, row counts, and content hashes.
- [x] All three stabilization migrations then applied successfully. Existing row counts, UUIDs,
      relationships, and hashes for section, process, plan, program, schedule, scope, and team data
      remained identical.

#### Security and performance hardening

- [x] The five functions reported for mutable search paths now have explicit
      `search_path = pg_catalog, public`; Supabase Security Advisor reports **zero warnings**.
- [x] Covering indexes exist for `audit_instruction_rows.proses_id`,
      `audit_plan_seksi_link.seksi_id`, `audit_program_distribusi.seksi_id`, and
      `checklist_items.bank_item_id`.
- [x] Remaining Performance Advisor messages are unused-index INFO notices expected on a new/test
      database and are not stabilization blockers. No existing index was removed.

#### QA allocation and protection

- [x] Direct sequential allocation returned `QA-01`, `QA-02`, and `QA-03`.
- [x] Generate-from-Program continued globally across programs: Program A received `QA-04` and
      `QA-05`; Program B received `QA-06` and `QA-07`. The sequence did not restart per program.
- [x] A duplicate QA insert was rejected, and changing an existing
      `audit_instruction_rows.kode_audit` was rejected. Database-level uniqueness and immutability
      protections are working.

#### Transactional generation and grid synchronization

- [x] Successful generation created one header and two rows for Program A. Two scopes matching the
      same process both received `QA-04`, and the other process scope received `QA-05`.
- [x] A deliberate collision on the second generated row rolled back the already-processed first row:
      no header, rows, or temporary `QA-08` persisted, and the changed scope reverted to its original
      code. Header, rows, and scope propagation are therefore atomic.
- [x] Re-generating an already generated program was rejected.
- [x] Completing a generated row for a program without a schedule created the IA schedule, matching
      QA scope, and audit team with the correct lead/member in the row-save transaction.

#### Checklist routing and post-upgrade compatibility

- [x] Database routing through both instruction-row and schedule/scope QA paths returned the same
      checklist ID and instruction row ID. No parallel or copied Checklist Sistem record was created.
- [x] After the existing-data upgrade, Generate-from-Program reused the representative schedule,
      scope, and team; created one instruction row; shared `QA-01` with the existing scope; propagated
      the existing lead/member; and created no duplicate schedule, scope, or team.

#### Repository checks

- [x] `npm run typecheck` passed.
- [x] `npm run build` passed.
- [x] `npm run lint` confirms the unchanged baseline of 26 pre-existing unused-symbol errors, including
      errors inside the protected nested `project/` snapshot. A detached worktree comparison against
      the base commit produced the same 26 errors, so stabilization introduced no new lint regression.
      These errors remain non-blocking technical debt.
- [x] **TRUE SIMULTANEOUS MULTI-SESSION DATABASE CONCURRENCY — VERIFIED PASS.** A real two-session
      test ran in the isolated `CertiTrack-Upgrade-Test` Supabase project using separate `pg_cron`
      PostgreSQL sessions. The two Generate-from-Program executions started approximately 2.7 ms
      apart, overlapped in execution time, both succeeded, and generated distinct central QA codes
      `QA-02` and `QA-03` with no duplicate QA code. The next scheduled executions were both rejected
      because the instruction had already been generated, reconfirming duplicate-generation protection.
- [x] **Browser/UI smoke test — VERIFIED PASS.** Manual real-browser smoke testing was performed
      against the Vercel Preview deployment connected to `CertiTrack-Staging`. The implemented
      stabilization workflow was manually exercised and no stabilization-blocking functional issue
      was found. This was **MANUAL REAL-BROWSER SMOKE TESTING**, not automated E2E testing.

The overall stabilization state is `VERIFIED_COMPLETE`.

### Remaining blockers / decisions

- The local `auditors` table remains a temporary compatibility proxy. Tim Audit and Instruksi must
  move behind an adapter when the real Training integration source/schema is supplied; no external schema
  was invented and the proxy was not expanded.
- The migration preserves historical duplicate QA values if a different live database contains them;
  the verified clean and representative upgrade projects contained no such duplicates.
- Process-master reorder/schema divergence and the Program document-code difference remain product
  decisions outside this smallest safe stabilization change.
- Remaining unused-index notices are informational only.
- Manual real-browser coverage does not provide automated E2E coverage.
- Batch 5b and Batch 5c are `VERIFIED_COMPLETE`; Batch 5d and later remain `NOT_STARTED`.

### Files changed in this pass

```text
src/lib/codeGenerator.ts
src/services/auditInstructionService.ts
src/services/auditScheduleService.ts
src/services/auditTeamService.ts
src/services/checklistService.ts
src/components/pages/ProgramAuditPage.tsx
src/components/pages/JadwalAuditPage.tsx
supabase/migrations/20260819090000_stabilize_batch4_batch5a.sql
supabase/migrations/20260819090100_fix_proses_seksi_select_policy.sql
supabase/migrations/20260819211000_harden_functions_and_index_foreign_keys.sql
PROJECT_STATUS.md
```

> **Repository audit performed from uploaded GitHub export: 19 Aug 2026**
>
> Audited source: repository-root `src/` and root `supabase/migrations/`.
> The nested `project/` directory is an older snapshot and is not treated as the current implementation.

## Status Legend

- `NOT_STARTED` — no meaningful implementation found
- `IN_PROGRESS` — meaningful implementation exists but one or more specified requirements are missing/incorrect
- `BLOCKED` — completion depends on a concrete missing external dependency or unresolved prerequisite
- `IMPLEMENTED_UNVERIFIED` — implementation exists and available checks may pass, but one or more
  required runtime, integration, concurrency, or browser verifications remain pending
- `VERIFIED_STAGING — READY_FOR_MERGE` — implementation and required staging/browser/static checks
  passed, but the active PR remains open until explicit merge approval
- `VERIFIED_COMPLETE` — specification and available technical verification both passed

---

# 1. Repository Audit Summary

**Audit status:** `COMPLETED_STATIC_REVIEW`

## Stack identified

- Vite
- React 18
- TypeScript
- Tailwind CSS
- Supabase
- Lucide React

## Active code location

```text
src/
supabase/migrations/
```

## Older duplicate snapshot

```text
project/
```

The root implementation is newer. Root-only functionality includes:

- Jadwal Audit
- Tim Audit
- Instruksi Internal Audit
- Plant/Model/Shift Admin
- Checklist Sistem

Do not develop both copies in parallel.

## Data-access architecture

**Good:** React components do not directly call Supabase.

Persistence calls are generally separated into:

```text
src/services/
```

No direct `localStorage` access was found in root `src/`.

## Existing module dependency

### Calibration

**State:** `EXTERNAL_OR_MISSING_FROM_THIS_EXPORT`

`src/App.tsx` routes Calibration to `ConstructionPlaceholder`.

The actual Calibration implementation is not in this GitHub export.

### Auditor Competency / Training

**State:** `EXTERNAL_INTEGRATION_MISSING`

The target project plan says auditor data should be read from the existing Training module.

In this export:

- Training is routed to `ConstructionPlaceholder`.
- A local `auditors` table was created in a Batch 3b migration.
- `auditorService.ts` reads/writes this local table.
- Tim Audit and Instruksi Audit depend on this local table.

Treat `auditors` as a temporary stand-in until the real Training data source is available.

---

# 2. Validation / Build Audit

The repository scripts `npm run typecheck` and `npm run build` pass after stabilization. The lint
command still reports the same 26 baseline unused-symbol errors found in a detached worktree at the
pre-stabilization commit; this diff introduced no new lint errors. No test script is defined.

Database verification is recorded in the real Supabase verification section above. The clean chain,
representative existing-data upgrade, successful/failed transactional generation, grid synchronization,
QA protection, database Checklist routing, true simultaneous-session concurrency, and manual
real-browser smoke testing all passed. The browser verification was manual, not automated E2E testing.

---

# 3. Cross-Cutting Findings

## 3.1 Batch 4/5a version-controlled migrations

**Resolution:** `RESOLVED_DATABASE_VERIFIED`

The missing tables (`audit_instructions`, `audit_instruction_rows`, `plants`, `target_models`,
`shifts`, `checklists`, and `checklist_items`) are now defined by the additive stabilization migration.
Both clean-chain and representative existing-data upgrade tests passed without changing existing row
counts, UUIDs, relationships, or audited content hashes.

---

## 3.2 `proses_seksi` RLS SELECT policy migration bug

**Resolution:** `RESOLVED_DATABASE_VERIFIED`

The historical migration remains unchanged. Corrective migration
`20260819090100_fix_proses_seksi_select_policy.sql` places the SELECT policy on `proses_seksi`; it
passed both clean and existing-data upgrade paths.

---

## 3.3 Central QA identifier

**Resolution:** `RESOLVED_DATABASE_VERIFIED`

QA allocation is centralized in the database sequence. Direct allocation returned `QA-01` through
`QA-03`, followed by `QA-04`/`QA-05` for Program A and `QA-06`/`QA-07` for Program B. Duplicate
insertion and mutation of an existing QA identifier were rejected. True simultaneous multi-session
generation also passed using separate PostgreSQL sessions.

---

## 3.4 Generate-from-Program atomicity

**Resolution:** `RESOLVED_DATABASE_VERIFIED`

The database RPC creates the header/rows and propagates every matching scope in one transaction.
Successful multi-scope propagation and deliberate second-row failure were tested. The failure left no
header or rows and restored the previously changed scope value, verifying rollback of partial work.

---

## 3.5 Schedule creation comment says atomic, implementation is not

`createScheduleWithScopes()` creates the schedule header first and then inserts scopes.

If scope insertion fails, the header remains.

This does not currently violate an explicit Batch 3 atomic requirement, but the code comment calling
it atomic is inaccurate and can mislead future maintenance.

**Priority:** MEDIUM

---

## 3.6 Naming differs from original Bolt prompt

Original target prompt uses conceptual `kodeAudit`, while repository implementation uses `kode_audit`.

This is now an established repository convention.

**Action:** do not bulk rename. Preserve snake_case and treat it as the same domain field.

---

# 4. Batch Progress

## Batch 1 — Kelola Proses + Rencana Audit Tahunan + Bank Checklist

**Status:** `IN_PROGRESS`

### Implemented

#### Kelola Proses

- [x] dedicated Kelola Proses page
- [x] process CRUD
- [x] active/inactive-style toggle via `diaudit_tahun_ini`
- [x] process is consumed by Rencana Audit matrix
- [x] automatic process code generation exists

#### Rencana Audit Tahunan

- [x] plan header
- [x] Draft / Approved
- [x] Approved read-only behavior in UI
- [x] Buat Revisi Baru creates a new record
- [x] previous revision is preserved
- [x] Seksi CRUD
- [x] process × section matrix
- [x] Plan/Aktual month matrix
- [x] active master processes are synced into plans when plan detail loads
- [x] direct grid interaction
- [x] process row reorder in annual-plan matrix
- [x] Salin dari Tahun Lalu exists
- [x] process/section role expansion (`utama` / `terkait`) exists
- [x] extra matrix flags `*1` and `*2` exist

#### Bank Checklist

- [x] process → sub-process → IPO navigation
- [x] CRUD
- [x] sub-questions
- [x] verification method
- [x] soft-delete by Aktif/Nonaktif

### Missing / divergent

- [ ] `prosesMaster` itself does not implement the requested `urutanTampil` reorder behavior
- [ ] process master schema differs materially from the target plan (`kode_proses`, `diaudit_tahun_ini`,
      `tanggal_audit`, flags instead of the simpler planned master)
- [x] RLS SELECT policy for `proses_seksi` corrected and database-verified
- [ ] inactive processes already synced into an existing annual plan are not clearly removed/hidden by the sync function
- [ ] "Salin dari Tahun Lalu" copies both section involvement and processes, while the supplied plan only explicitly
      required copying `seksiTerlibat`

### Key files

```text
src/components/pages/ProsesPage.tsx
src/components/pages/RencanaAuditPage.tsx
src/components/pages/BankChecklistPage.tsx
src/components/pages/SeksiPage.tsx
src/services/prosesService.ts
src/services/auditPlanService.ts
src/services/checklistBankService.ts
supabase/migrations/20260804133335_create_audit_module_batch1_tables.sql
supabase/migrations/20260805020305_create_proses_master_tables.sql
```

---

## Batch 2 — Program Internal Audit

**Status:** `IN_PROGRESS`

### Implemented

- [x] Program Internal Audit page
- [x] created from an Approved annual plan
- [x] Program header
- [x] Tujuan
- [x] Poin Perhatian
- [x] distribution table
- [x] manager auto-fill from `kepala_seksi`
- [x] manager override
- [x] Risiko/Peluang table
- [x] 7-step template table migration
- [x] seven standard steps seeded
- [x] steps copied into new program
- [x] Schedule Dasar renders Tanggal Awal / Tanggal Akhir and preserves legacy period fields only for compatibility
- [x] legacy `periode_target` remains compatible in schema/service; period toggle UI is intentionally removed
- [x] step reorder
- [x] Draft / Approved handling

### Missing / divergent

- [x] Label Periode editing is intentionally absent after the explicit date-range product decision
- [ ] repository constant is `Q-120-ISE-001-FORM-002-REV.1`, while supplied plan says
      `Q-120-ISE-001-FORM-002`
- [ ] full runtime verification not completed

### Key files

```text
src/components/pages/ProgramAuditPage.tsx
src/components/pages/audit-program/
src/services/auditProgramService.ts
supabase/migrations/20260805004742_create_audit_module_batch2_tables.sql
```

---

## Batch 3a — Jadwal Audit

**Status:** `IN_PROGRESS`

### Implemented

- [x] Jadwal Audit list
- [x] 2-step wizard
- [x] `IA-{tahun}-{NNN}` schedule identifier generator
- [x] date fields
- [x] audit type
- [x] multi-standard checkbox
- [x] area selection from process master
- [x] custom area
- [x] Section assignment
- [x] PIC default from `kepala_seksi`
- [x] wizard requires selected area + section
- [x] Detail Sesi Audit
- [x] Ruang Lingkup tab
- [x] editable scope records
- [x] Scheduled transition checks for at least one scope with a section in page flow

### Missing / divergent

- [ ] wizard-created schedules are not visibly linked to a selected `plan_id` / `program_id`
- [ ] Scheduled prerequisite is enforced by page handler, not by `saveAuditSchedule()` domain/service logic
- [ ] schedule creation is not actually atomic despite the service comment
- [ ] no full runtime verification

### Key files

```text
src/components/pages/JadwalAuditPage.tsx
src/components/pages/jadwal-audit/
src/services/auditScheduleService.ts
src/lib/codeGenerator.ts
supabase/migrations/20260807031800_20260807030000_create_audit_schedule_scope_tables.sql.sql
```

---

## Batch 3b — Tim Audit + Validasi

**Status:** `BLOCKED`

> UI/business behavior is substantially implemented, but the target integration cannot be considered complete
> because the real Auditor Competency/Training module is missing from this repository.

### Implemented locally

- [x] Tim Audit tab
- [x] Lead Auditor
- [x] Members
- [x] auditee area owner field
- [x] competency expiry check
- [x] ineligible auditor disabled
- [x] red "Tidak memenuhi syarat" badge
- [x] independence warning
- [x] conflicted auditor remains selectable
- [x] justification becomes required in UI
- [x] placeholder tabs for Checklist / Agenda / Pelaksanaan / Temuan
- [x] local `audit_teams` persistence

### Blocker / missing

- [ ] auditor source is **not** the existing Training module required by the target plan
- [ ] a duplicate/local `auditors` table was created as a stand-in
- [ ] Training page itself is only a placeholder
- [x] independence justification requirement is enforced in `auditTeamService` save/domain logic
- [ ] actual integration adapter to Training data is unavailable

### Key files

```text
src/components/pages/jadwal-audit/TimAuditTab.tsx
src/services/auditorService.ts
src/services/auditTeamService.ts
supabase/migrations/20260811012716_20260811000000_create_auditor_and_audit_team_tables.sql.sql
```

---

## Batch 4a — Instruksi Internal Audit: Data

**Status:** `IN_PROGRESS`

### Implemented

- [x] Instruksi Internal Audit list
- [x] instruction detail
- [x] header model/types
- [x] manual instruction creation
- [x] manual row creation
- [x] QA prefix support
- [x] `kode_audit` stored on rows
- [x] process selector
- [x] process-owner auto derivation from target section
- [x] section marks
- [x] auditor assignments
- [x] row types:
  - Reguler
  - AuditProduk
  - AuditManufaktur
  - AuditShift
- [x] row-type exclusivity logic in UI save
- [x] Product matrix
- [x] Manufacturing/Shift matrix
- [x] product-auditor helper label
- [x] plan/execution dates
- [x] check-complete field
- [x] temporary `statusProgress = Belum Mulai`
- [x] Plant admin page
- [x] Target Model CRUD code
- [x] Shift CRUD code

### Remaining risks

- [x] root migrations exist and passed clean/existing-data upgrade tests for `audit_instructions`,
      `audit_instruction_rows`, `plants`, `target_models`, and `shifts`
- [x] generated QA immutability and duplicate protection are enforced and verified at database level
- [x] central QA allocation is shared by manual and Generate-from-Program paths
- [ ] current local auditor source is still the temporary proxy

### Key files

```text
src/components/pages/InstruksiAuditPage.tsx
src/components/pages/instruksi-audit/InstructionHeader.tsx
src/components/pages/instruksi-audit/RowsTable.tsx
src/components/pages/PlantAdminPage.tsx
src/services/auditInstructionService.ts
src/services/plantService.ts
src/lib/types.ts
src/lib/enums.ts
```

---

## Batch 4b — Instruksi Internal Audit: Generate + Grid

**Status:** `IN_PROGRESS`

### Implemented

- [x] Generate dari Program flow exists
- [x] creates one instruction header
- [x] generates one row per plan process
- [x] copies/converts section links into target/related marks
- [x] derives process owner
- [x] suggests plan date from first planned month
- [x] attempts to match existing scopes by process
- [x] attempts to load existing audit teams
- [x] copies team auditors into generated rows where match exists
- [x] propagates QA code to matched scope
- [x] instruction grid includes Product and Manufacturing/Shift matrices
- [x] special row badges exist

### Stabilization verification

- [x] generated QA sequence remains global across programs
- [x] generator is centralized and database-protected
- [x] Generate button is available from Program Internal Audit
- [x] completing a row without a schedule creates the required schedule, scope, and team atomically
- [x] header, rows, and all matching scope propagation roll back atomically on failure
- [x] multiple matching scopes receive the same row QA identifier
- [x] Batch 4 migrations passed clean and representative existing-data upgrade tests
- [x] true simultaneous multi-session generation passed with overlapping executions and distinct QA codes

### Key files

```text
src/services/auditInstructionService.ts
src/components/pages/InstruksiAuditPage.tsx
src/components/pages/instruksi-audit/RowsTable.tsx
```

---

## Batch 5a — Checklist Sistem

**Status:** `IN_PROGRESS`

### Implemented

- [x] Checklist types
- [x] Checklist Item types
- [x] `finding_id` placeholder field in code
- [x] Regular-row selection
- [x] Checklist creation from instruction row
- [x] `kode_audit` badge/context
- [x] auditee sections derived from target section marks
- [x] section manager derived from process owner
- [x] lead auditor derived for `dibuat_oleh`
- [x] active checklist bank items auto-copied
- [x] grouping by Sub-Proses → IPO
- [x] manual checklist items
- [x] bank-linked item indicator
- [x] O/A/B/C/N-A result choices
- [x] comments
- [x] sub-question result editing
- [x] Bank items can effectively be skipped/removed from generated checklist

### Remaining verification

- [x] root migrations exist and passed clean/existing-data upgrade tests for `checklists` and `checklist_items`
- [x] Checklist Sistem is available from **Detail Sesi Audit → Checklist** and reuses instruction-row data
- [x] `JadwalAuditPage` Checklist tab is enabled
- [x] save-layer validation exists for required checklist/item fields
- [x] instruction and session QA paths resolve the same checklist and instruction-row IDs
- [ ] non-Regular checklist types remain placeholders as expected until 5b/5c
- [x] manual real-browser smoke verification passed (not automated E2E testing)

### Key files

```text
src/components/pages/instruksi-audit/ChecklistTab.tsx
src/services/checklistService.ts
src/lib/types.ts
src/lib/enums.ts
```

---

## Batch 5b — Checklist Audit Produk

**Status:** `VERIFIED_COMPLETE`

The schema, private Storage evidence flow, service/domain validation, Product Checklist component,
shared Checklist-tab routing, database integrity protections, RLS/Storage access, and real-browser
workflow were verified on CertiTrack-Staging. Verification passed 13/13 core database scenarios and
manual real-browser smoke testing on the PR #3 Vercel Preview.

---

## Batch 5c — Checklist Audit Manufaktur & Shift

**Status:** `VERIFIED_COMPLETE`

Schema, structural bank seed, service/domain validation, shared row-based routing, Manufacturing/Shift
UI, and service/database completed-checklist protection were verified on CertiTrack-Staging. Official
bank question text remains intentionally incomplete.

---

## Batch 5d — Agenda Internal Audit

**Status:** `VERIFIED_COMPLETE`

Implemented as a central, QA-row-backed workspace with one Agenda per Instruction row, live
Instruction/section/manager/Annual Team roster context, Agenda-owned document fields, manual timeline,
location inheritance, and database-authoritative Draft/Final transitions and immutability. Added
`src/components/pages/AgendaAuditPage.tsx`, `src/services/auditAgendaService.ts`, centralized types and
constants, central sidebar navigation, and base migration
`20260821010000_create_batch5d_agenda_internal_audit.sql`. No Checklist relationship or legacy
schedule/scope/team write is introduced.

Static review hardening now allocates a new Timeline order from the current maximum `urutan` rather
than array length, so gaps after deletion cannot collide with the unique Agenda/order key. Finalization
also revalidates that the live Team has at least one member and that every referenced auditor still
exists with status `Aktif`; failures leave the Agenda in Draft without adding a roster snapshot.
Relational ownership is also database-immutable after insert: an Agenda cannot be reassigned to a
different Instruction row, and a Timeline item cannot be moved to another Agenda. Draft edits and the
controlled reorder RPC continue to update non-ownership fields normally.
Agenda creation context validation is centralized and enforced by both the idempotent creation RPC and
a `BEFORE INSERT` trigger, so direct table inserts cannot bypass QA/Team/plan/roster invariants. Draft
headers are also rejected when `finalized_at` is non-null.

Base migration is applied on CertiTrack-Staging as registry entry
`20260821010528 create_batch5d_agenda_internal_audit`; Security Advisor reports **0 security lints**
and the base database runtime suite passed **22/22**. Browser review found that Instruksi → Agenda
cross-navigation could open a null Agenda as a white page and that per-row Timeline Save reset unsaved
header fields. The superseding UX is central-workspace-only: Instruksi shortcuts are removed, Agenda
uses local multi-row Timeline editing with one Add button, and the complete Draft header + Timeline is
saved atomically by the new additive migration. Corrected browser smoke and additive migration runtime
verification remain pending.

Rekonsiliasi setelah PR #5 digabung: migration Agenda dasar telah diterapkan, Security Advisor
melaporkan 0 temuan, dan runtime dasar lulus 22/22. Migration atomic-save diterapkan sebagai registry
`20260821060833 add_atomic_agenda_draft_save` dan runtime atomic save lulus 12/12. Corrected browser
smoke lulus; workspace Agenda pusat, Timeline fleksibel, satu aksi Tambah Kegiatan, dan Simpan Agenda
atomik telah diverifikasi. Shortcut Checklist/Agenda dari Instruksi telah dihapus. PR #5 merged.

---

## Batch 6a — Temuan / PLOR

**Status:** `VERIFIED_COMPLETE`

Implemented additive `findings` and `clause_keyword_map` schema, Product Finding linkage/category,
database-authoritative source triggers for System/Product/Manufacturing-Shift, per-QA locked sequence,
idempotent category synchronization, safe empty cancellation, PLOR loss/delete/tamper guards, RLS,
central types/constants/helpers/service, narrative formatter, clause suggestions, central Temuan
worklist/detail editor, source-note separation, Checklist note validation, and Product NG category UI.
No legacy Jadwal tables are written and no Batch 6b+ feature is included.

### CertiTrack-Staging verification

- [x] Base migration applied as registry entry `20260821074725 create_batch6a_findings_plor`.
- [x] Additive permission hardening applied as registry entry
      `20260821081251 harden_batch6a_findings_permissions`.
- [x] Functional/integrity runtime verification passed **22/22**, including System,
      Manufacturing/Shift, and Product Finding triggers; source-note and Product category validation;
      idempotence; A/B/C category synchronization; empty cancellation; PLOR-loss and source-delete
      protection; multi-row synchronization; scoped `finding_sync` restoration; clause seeds; and
      zero legacy writes.
- [x] Permission hardening verified: frontend roles retain only `SELECT, UPDATE` on `findings`, only
      `SELECT` on `clause_keyword_map`, and cannot directly execute the seven private Batch 6a helper
      functions.
- [x] Runtime-role smoke confirmed normal Checklist updates still invoke internal Finding triggers
      after helper `EXECUTE` revocation, while authenticated PLOR updates remain allowed.
- [x] Supabase Security Advisor after hardening reports **0 security lints**.
- [x] Vercel Preview for the verified PR head succeeded.
- [x] Manual real-browser smoke passed for central Temuan/PLOR, PLOR save → worklist refresh + success
      feedback, OFI field order/completeness/narrative, valid A/B/C → A/B/C category changes, visible
      PLOR-loss rejection when changing a formal Finding to a non-Finding, and modal draft preservation
      plus successful retry behavior.
- [x] Final OFI semantics verified: A/B remain nonconformities using Problem → Location → Objective
      Evidence → Reference; C uses Kondisi/Peluang Peningkatan → Location → Objective Evidence →
      Saran Perbaikan → Reference/Acuan, with Saran required, Reference optional, and no
      ketidaksesuaian wording such as "tidak sesuai" in the OFI narrative.
- [x] Runtime fixtures QA-986/987/988 were cleaned after database verification. Browser fixtures
      QA-980/QA-981 and their Finding, Agenda, Checklist, Instruction, Program, Annual Plan, Team,
      fixture Process, fixture Section, and fixture Auditor records were also cleaned. Final fixture
      verification returned **0** for every checked marker.

Static validation on the Batch 6a branch passed TypeScript typecheck, production build, and diff
checks. ESLint remains at the established repository baseline of **26 errors / 0 warnings**, with no
Batch 6a regression. Protected Batch 5d migrations, applied Batch 6a migrations, and the nested
`project/` snapshot remain unchanged.

Formal PLOR remains owned only by `findings`; Checklist stores only the short source observation and
never auto-copies it into Problem, Location, Objective Evidence, Reference, or Saran Perbaikan.
Checklist save protection remains database-authoritative, while the UI now exposes rejection messages
inside System, Manufacturing/Shift, and Product edit flows. The optional compact Finding-code badge in
Checklist was intentionally treated as non-blocking and deferred.

Batch 6a has completed database, security, role-permission, deployment, browser, and cleanup gates and
is therefore `VERIFIED_COMPLETE`.

---

## Batch 6b — Pelaksanaan

**Status:** `VERIFIED_COMPLETE`

Closed through PR #8, merged into `main` on 22 Aug 2026 at
`540c79dc151af87e89f55b7f6b04e4021367cb67` (verified implementation head before final
documentation: `6599fc4f07e762172c4081cd6446202792aab715`).

### Implemented architecture and historical refinement

Checklist Audit is now preparation-only for System questions and uses the existing `checklist_items`
rows: editable fields are limited to header and question structure. Its two-level Sub Proses → Elemen
Proses accordion exposes a table per element and supports unlimited Pertanyaan Utama and unlimited
text-only Sub Pertanyaan. The database compatibility name `kelompok_ipo` remains, while the UI and
validation use five Elemen Proses: Input Proses, Method Proses, Output Proses, Resource, and Analisa
Risiko. Active Metode Verifikasi UI and validation have been removed from System Checklist and Bank
Checklist without deleting compatibility columns or historical values.

Pelaksanaan uses dedicated execution panels for every active checklist type over the same source
records. System saves only `hasil` and `komentar_auditor`; Product saves only actual sample,
`hasil_pemeriksaan`, `judgment`, and `finding_kategori`; Manufacturing/Shift saves only
`hasil_pengamatan` and `hasil`. All preparation context is read-only during execution, judgements start
empty, and completed QA rows make every execution panel read-only until the existing reopen RPC succeeds.

Product Checklist preparation now excludes actual sample, inspection result, OK/NG, and Finding
category controls and uses a preparation-only payload that cannot overwrite historical execution or
Finding linkage. Manufacturing/Shift Checklist preparation similarly excludes observation and
judgement and uses a structural-only payload. Product and Manufacturing/Shift Pelaksanaan no longer
render `ChecklistTab`; their dedicated panels expose no header, phase, item, Bank, sync, or delete
controls. Product and Manufacturing/Shift counters and save validation require their existing
observation/judgement pairs without changing result models or Finding synchronization.

Checklist Product and Manufacturing/Shift now have an explicit two-stage lifecycle. Database status
`Draft` means preparation is editable. Database status `Selesai` is presented as **Siap Pelaksanaan**:
header, phase/evidence, Bank synchronization, and structural item changes are locked, while the dedicated
Pelaksanaan panels may still update only their execution fields. Final completion remains exclusively
`audit_instruction_rows.cek_selesai=true`; the existing Batch 6b source guard then locks preparation,
execution, and PLOR until reopen succeeds.

Additive migration `20260822120000_align_preparation_ready_execution_guards.sql` replaces only the
Product and Manufacturing/Shift checklist-status item guards. In ready state it permits the documented
execution fields, `finding_id`, and `updated_at`, but blocks structural updates plus insert/delete. It
does not replace the `SECURITY INVOKER` completion RPCs or blocker. It was applied to Staging as
`20260822085141 align_preparation_ready_execution_guards` and is immutable.

Additive migration `20260822110000_refine_batch6b_checklist_execution_separation.sql` expands the
Elemen Proses constraints, makes retained method columns optional, and replaces the database completion
blocker with per-item observation/judgement messages for System, Product, and Manufacturing/Shift. It
explicitly preserves `SECURITY INVOKER` for the blocker and complete/reopen RPCs. This migration was
applied on Staging as `20260822061814 refine_batch6b_checklist_execution_separation` and is immutable.

Pelaksanaan kini berupa worklist QA pusat dan detail responsif/mobile dengan panel eksekusi khusus
untuk Checklist Sistem, Produk, dan Manufaktur/Shift atas record sumber yang sama. Counter O/A/B/C
dan status `Belum Mulai` / `Berjalan` / `Ada NC` / `Tidak Ada NC` dihitung dari record sumber saat ini;
Product OK dipetakan ke O dan NG memakai `finding_kategori`, sementara N-A dikecualikan dari counter.

Migration additive `20260822090000_create_batch6b_audit_execution.sql` menambahkan RPC penyelesaian
dan buka-kembali yang atomik, validasi Checklist/PLOR database-authoritative dengan pesan blocker
spesifik, serta trigger yang mencegah perubahan langsung `cek_selesai`. Instruksi kini hanya
menampilkan status selesai read-only; satu-satunya aksi UI berada di Pelaksanaan. RPC dan service baru
tidak membaca atau menulis `audit_schedules`, `audit_scopes`, maupun `audit_teams`.

Static-review hardening mengunci seluruh entry point Checklist ketika QA telah selesai, baik melalui
mode read-only di Checklist Audit maupun trigger sumber database untuk Sistem, Produk (termasuk fase
dan metadata bukti), serta Manufaktur/Shift. Callback mutasi sukses dari editor Checklist kini memuat
ulang counter dan `statusProgress` Pelaksanaan tanpa polling, dan guard internal completion/reopen
selalu dikembalikan ke nilai sebelumnya pada jalur sukses maupun exception.
Final pre-Staging hardening juga memeriksa kepemilikan QA lama dan baru pada setiap UPDATE sumber,
mengunci field formal PLOR pada database dan UI selama pelaksanaan selesai, serta mencabut hak
eksekusi helper Batch 6b secara eksplisit dari `PUBLIC`, `anon`, dan `authenticated`.

### Final verification — PASS

- [x] Applied Staging migrations are immutable:
      `20260822004154 create_batch6b_audit_execution`,
      `20260822004455 harden_batch6b_execution_rpc_security`,
      `20260822061814 refine_batch6b_checklist_execution_separation` (repository file
      `20260822110000_refine_batch6b_checklist_execution_separation.sql`), and
      `20260822085141 align_preparation_ready_execution_guards` (repository file
      `20260822120000_align_preparation_ready_execution_guards.sql`).
- [x] Security Advisor reported 0 security lints after the final migration. The blocker, completion,
      and reopen functions remain `SECURITY INVOKER`; intended trigger helpers remain private.
- [x] Runtime verification passed for System, Product, and Manufacturing/Shift preparation/execution
      separation, required observation/judgement pairs, Draft/Siap Pelaksanaan guards, O/OK versus
      A/B/C Finding synchronization, completion locks, reopen, and source/Finding-link preservation.
- [x] Temporary runtime fixtures `QA-9911` and `QA-9912` were removed with zero residual Instruction,
      Product/Manufacturing checklist, or Finding rows.
- [x] Manual real-browser smoke passed all three checklist types and their execution-only panels,
      conscious empty judgement defaults, preparation locking, final completion/read-only behavior,
      and reopen without data loss.
- [x] Staging fixtures `QA-9907` (System A/B), `QA-9908` (System C/OFI), `QA-9909` (Product), and
      `QA-9910` (Manufacturing) were intentionally retained for later Batch 7 verification.

---

## Batch 7a — CAR Major / Minor

**Status:** `NOT_STARTED`

No CAR implementation found.

Historical target-plan snapshot; superseded by the controlled LTP slices documented at the top.

---

## Batch 7b — CAR OFI + CAR Tracker

**Status:** `NOT_STARTED`

Sidebar entry exists as disabled, but no implementation was found.

Historical target-plan snapshot; superseded by the controlled LTP slices documented at the top.

---

## Batch 8a — Daftar Ketidaksesuaian

**Status:** `NOT_STARTED`

Sidebar entry exists as disabled, but no implementation was found.

---

## Batch 8b — Laporan Internal Audit

**Status:** `NOT_STARTED`

Sidebar entry exists as disabled, but no implementation was found.

---

## Batch 9a — Analisa Weakness Point

**Status:** `NOT_STARTED`

Sidebar entry exists as disabled, but no implementation was found.

---

## Batch 9b — Rangkuman Hasil Internal Audit

**Status:** `NOT_STARTED`

No implementation found.

---

# 5. Current Handoff Point

The stabilization database foundation and implemented audit-execution batches through Batch 6b have
completed their required verification gates. Batch 7e Auditor verification has completed runtime,
security, static, deployment, and real-browser verification and is ready for merge. PR #16 remains
OPEN and UNMERGED; merge requires explicit user approval. The next controlled feature is Batch 7f —
Admin/QMS LTP final decision.

```text
Batch 1     IN_PROGRESS
Batch 2     IN_PROGRESS
Batch 3a    IN_PROGRESS
Batch 3b    BLOCKED (external Training integration)
Batch 4a    IN_PROGRESS (database foundation verified; broader UI workflow remains in progress)
Batch 4b    VERIFIED_COMPLETE (including simultaneous multi-session database verification)
Batch 5a    VERIFIED_COMPLETE (including manual real-browser smoke verification)
Batch 5b    VERIFIED_COMPLETE (CertiTrack-Staging database/security/browser verification)
Batch 5c    VERIFIED_COMPLETE
Batch 5d    VERIFIED_COMPLETE
Batch 6a    VERIFIED_COMPLETE
Batch 6b    VERIFIED_COMPLETE (PR #8; runtime/security/browser verification passed)
Batch 7.0   VERIFIED_COMPLETE (Identity & Access foundation; merged through PR #9)
Batch 7a    VERIFIED_COMPLETE (controlled LTP foundation slice)
Batch 7b    VERIFIED_COMPLETE (controlled Auditee LTP authoring slice)
Batch 7c    VERIFIED_COMPLETE (Auditee Submit → Section Manager Review)
Batch 7d    VERIFIED_COMPLETE — MERGED (Section Manager decision; PR #13)
Batch 7e    VERIFIED_STAGING — READY_FOR_MERGE (Auditor verification; PR #16 OPEN/UNMERGED)
PR #14      VERIFIED_COMPLETE — MERGED (Admin user management + annual Auditor access;
            squash merge 5727f32acac35f4e973b799bf1b7aa590181bf46)
Batch 8+    NOT_STARTED
```

Sequence allocation, advisory locking, duplicate protection, functional serialization, successful and
failed transaction behavior, multi-scope propagation, grid schedule/scope/team synchronization,
Checklist database record sharing, clean migration, existing-data upgrade, post-upgrade compatibility,
Agenda atomic save, formal Finding synchronization, Batch 6a permission hardening, and manual browser
smoke have all passed on the applicable real Supabase/Vercel staging paths.

---

# 6. Non-Blocking Follow-Ups After PR #1 Merge

- [ ] Replace the temporary local auditor proxy through an adapter when the real Training integration
      source and schema become available.
- [ ] Resolve the process-master divergence and Program document-code product decisions.
- [ ] Review unused-index INFO notices after representative production usage exists.
- [ ] Add automated E2E coverage; the completed browser verification was manual real-browser smoke testing.

The missing external Training integration, process-master divergence, and Program document-code
choice remain product follow-up items, but are not regressions introduced by this stabilization pass.

---

# 7. Verification Summary

- [x] clean Supabase migration path, including the hardening correction
- [x] representative existing-data upgrade with row/UUID/hash preservation
- [x] post-upgrade reuse of existing schedule, scope, and team
- [x] global QA sequence across separate programs
- [x] duplicate QA rejection and QA immutability
- [x] successful generation with multiple-scope propagation
- [x] deliberate second-row failure with complete transactional rollback
- [x] duplicate Generate-from-Program rejection
- [x] grid completion creation of schedule, scope, and team
- [x] Checklist database record sharing through instruction and session paths
- [x] Supabase Security Advisor: zero warnings after hardening
- [x] reported foreign-key indexes added; remaining unused-index notices are INFO only
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] stabilization diff introduces no lint errors relative to baseline
- [x] true simultaneous multi-session database concurrency
- [x] manual real-browser smoke test (not automated E2E testing)
- [x] Batch 5d base + atomic Agenda runtime/browser verification
- [x] Batch 6a functional/integrity runtime **22/22 PASS**
- [x] Batch 6a permission hardening + role-trigger smoke PASS
- [x] Batch 6a Security Advisor **0 lints**
- [x] Batch 6a manual browser smoke PASS
- [x] Batch 6a smoke-test fixture cleanup verified at **0**

The stabilization status, Batch 5b, Batch 5c, Batch 5d, and Batch 6a are `VERIFIED_COMPLETE` after the
recorded CertiTrack-Staging database, security, runtime, cleanup, and manual browser verification.
