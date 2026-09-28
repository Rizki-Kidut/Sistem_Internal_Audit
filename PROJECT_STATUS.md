# PROJECT_STATUS.md — CertiTrack Internal Audit Module

## Documentation Policy and Current Snapshot

`PROJECT_STATUS.md` is the canonical source of truth for project history, current implementation
state, PR/merge lineage, runtime and browser verification, migration/security evidence, known issues,
and deferred scope. `PROJECT_PLAN.md` remains the forward-looking roadmap, `AGENTS.md` contains
engineering-agent operating rules, and `Readme.md` remains the repository landing page.

This documentation snapshot starts from current `main` commit
`2141204d0e65d3c5be08b8b3dd5597d2f17dcdd9`, the squash merge of PR #22 (Batch 8b2a).
The active controlled feature slice is Batch 8b2 — Internal Audit Report Finalization & Official Layout.


## Batch 7g — Finding/LTP Final Synchronization — 1 Sep 2026

**Status:** `VERIFIED_COMPLETE — MERGED` (implementation, migration, Staging, runtime, real-browser,
terminology re-test, Vercel, and static verification PASS.)

PR #18, **Batch 7g: Finding/LTP final synchronization**, was approved at head
`2eb0e41fe57452b70d68df167965b25dbc5f2a1f` and squash-merged to `main` as
`35d61194b34bea62f4bc722f1d9848d92aa7ce6d`. Its authoritative branch was
`codex/implement-batch-7g-synchronization-feature`; the browser-tested pre-documentation head was
`219882c678a1ac9d4a0dfceacbf8cd4d9bafb4b7`.

### Implementation and migration — VERIFIED ON STAGING

- [x] The additive migration implements exactly one one-way terminal rule: a valid LTP `CLOSED` by
      authoritative Admin/QMS approval closes the related Finding operational `status`. It deliberately
      defines no intermediate LTP-to-Finding status mapping because those semantics were never formally
      established.
- [x] Finding `review_status` remains independent and unchanged. Only established Findings in
      `PUBLISHED` or `LEGACY_ESTABLISHED` are eligible. The legacy `findings.car_id` remains unchanged;
      the canonical active relationship is unique `cars.finding_id`.
- [x] `protect_finding_update()` retains the existing source-sync, Finding-workflow, and PLOR-save
      branches. Its dedicated `certitrack.finding_ltp_final_sync` branch permits only nonterminal Finding
      operational status to `Closed`, exactly one Finding revision increment, and trigger-managed
      `updated_at`; every other Finding field remains protected.
- [x] Private `SECURITY DEFINER` helper `sync_finding_closed_from_ltp(uuid)` locks the LTP and Finding,
      validates terminal status/result/event evidence and established Finding review state, returns `false`
      without mutation when already Closed, and has `EXECUTE=false` for both `anon` and `authenticated`.
      `admin_decide_ltp(...)` remains authenticated-executable and internally Admin-guarded as verified in
      Batch 7f.
- [x] Future Admin APPROVE updates the LTP, appends the existing `ADMIN_APPROVED_LTP` event, and invokes
      final Finding synchronization before notification processing in the same transaction. Admin RETURN,
      Auditor decisions, existing `LTP_CLOSED` fan-out, and terminal read-only behavior remain unchanged;
      no duplicate Finding notification or Finding-review event was added.
- [x] Repository migration filename:
      `20260831020000_sync_closed_ltp_finding.sql`. Preserved repository SHA-256:
      `dbab53040fbaf5a670ef54defc404897ed9d3627af1769ebea2656f1bb9d5c1a`.
- [x] CertiTrack-Staging successfully applied the migration under the separate ledger entry
      `20260901004334 · sync_closed_ltp_finding`. Repository filename and Staging ledger identity are
      recorded separately. The applied migration is now immutable.
- [x] No frontend/application change was required: the active Temuan worklist/detail already reads and
      displays `findings.status`, including `Closed`, independently from Finding review status.

### One-time backfill and retained QA-9910 fixture — PASS

- [x] The pre-migration authoritative terminal mismatch count was exactly **1**, the retained QA-9910
      browser fixture. Before migration, its LTP was `CLOSED`, revision `17`, Auditor result `CLOSE`, with
      11 events and latest `ADMIN_APPROVED_LTP`; its Finding was `Open / LEGACY_ESTABLISHED`, revision
      `1`, with `car_id=NULL`.
- [x] The migration backfill changed only the Finding to `Closed`, revision `1 → 2` exactly once. The
      Finding retained `review_status=LEGACY_ESTABLISHED` and `car_id=NULL`.
- [x] The LTP remained `CLOSED`, revision `17`, result `CLOSE`, with 11 events and latest
      `ADMIN_APPROVED_LTP`. No synchronization event #12 was added. Existing `LTP_CLOSED` notifications
      remained exactly three; no duplicate terminal notification was created.
- [x] PLOR/business fields and the source Checklist record remained unchanged. The retained QA-9910
      source Checklist was also compared before and after an idempotent helper invocation and was
      unchanged.

### Staging ACL, mutation denial, and rollback runtime verification — PASS

- [x] Helper ACL passed: `sync_finding_closed_from_ltp(uuid)` has anon `EXECUTE=false` and authenticated
      `EXECUTE=false`; it is not callable by normal clients.
- [x] Direct authenticated Finding operational-status mutation was denied for Admin, Auditor, Auditee,
      and Section Manager. Depending on RLS visibility, denial correctly appeared as a permission/trigger
      rejection or zero affected rows. No normal actor can arbitrarily run an effective
      `UPDATE findings SET status='Closed'`.
- [x] Preconditions passed: the helper rejected a non-`CLOSED` LTP, a `CLOSED` LTP without Auditor result
      `CLOSE`, a `CLOSED`/`CLOSE` LTP without same-car `ADMIN_APPROVED_LTP` evidence, and a Finding with
      a non-established review status. Only `PUBLISHED` and `LEGACY_ESTABLISHED` Findings were eligible.
- [x] A `PUBLISHED`/`Open` Finding created through the official Finding review workflow synchronized
      `Open → Closed`, incremented its revision exactly once, preserved review status and `car_id`, and
      left PLOR/business fields and source Checklist data unchanged. A repeated helper call returned the
      idempotent no-change result without another revision increment. LTP revision, LTP event count, and
      `LTP_CLOSED` notification count were unchanged.
- [x] Future Admin APPROVE atomicity passed with a rollback-only established fixture:
      `ADMIN_REVIEW → CLOSED` committed together with Finding `→ Closed`, returned the correct LTP
      revision, incremented the Finding revision once, created exactly one `ADMIN_APPROVED_LTP`, preserved
      `LEGACY_ESTABLISHED`, and produced the existing stakeholder fan-out for the eligible recipient set.
- [x] Atomic failure rollback passed with a deliberately non-established `DRAFT` Finding. Final-sync
      validation rejected Admin APPROVE; afterward the LTP remained `ADMIN_REVIEW` at its prior revision,
      the Finding remained `Open`, and no `ADMIN_APPROVED_LTP` event or `LTP_CLOSED` notification was
      committed. No partial `LTP=CLOSED / Finding!=Closed` state persisted.
- [x] Admin RETURN regression passed: `ADMIN_REVIEW → AUDITOR_RETURNED`, while the Finding remained
      `Open`. Auditor OPEN after Admin Return also passed: `AUDITOR_RETURNED → AUDITEE_RETURNED`, while
      the Finding remained `Open`.
- [x] A fresh SQL re-execution of the Auditor CLOSE regression subpath was attempted but blocked by the
      execution tool's safety gate, so Batch 7g does **not** claim a fresh execution of that subpath.
      PR #18 does not modify `auditor_verify_ltp`; Auditor CLOSE from `AUDITOR_RETURNED` remains an
      inherited unchanged guarantee from Batch 7f, where it passed both runtime and real-browser testing.
- [x] Immutable-history and terminal protections passed: `finding_review_events` UPDATE/DELETE and
      `car_workflow_events` UPDATE/DELETE were rejected, and Admin could not issue another LTP decision
      after `CLOSED`. Batch 7g did not weaken existing history protections.
- [x] Rollback cleanup passed: zero B7G runtime Findings and zero B7G runtime LTPs remain. Retained
      QA-9907 and QA-9910 fixtures were not persistently changed by rollback-only verification; QA-9910's
      intended migration backfill state remains intact.

### Security, deployment, static validation, and browser handoff

- [x] Security Advisor was run after migration and is **not clean**. The existing
      `authenticated_security_definer_function_executable` warning remains for intentionally exposed,
      internally guarded RPCs such as `admin_decide_ltp(...)`, `auditor_verify_ltp(...)`, and other existing
      authenticated `SECURITY DEFINER` functions. The existing **Leaked Password Protection Disabled**
      warning also remains. The private `sync_finding_closed_from_ltp(uuid)` does not appear as an
      authenticated-executable warning, and runtime access control passed. Remediation reference:
      https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- [x] Vercel reported **SUCCESS** for final browser-tested PR head
      `219882c678a1ac9d4a0dfceacbf8cd4d9bafb4b7`.
- [x] Static validation remains PASS: `npm run typecheck`, `npm run build`, changed-file ESLint for the
      terminology correction, and `git diff --check`. Build emitted only the existing non-blocking
      Browserslist and bundle-size advisories. Repository-wide lint retains 24 pre-existing unused-symbol
      errors in untouched root source and `/project`; Batch 7g did not introduce them.

### Real-browser synchronization and terminology verification — PASS

- [x] **A — Temuan/PLOR worklist:** Finding `QA-9910/MFG/2099/001`, No. Audit `QA-9910`, displayed
      Review Status `LEGACY_ESTABLISHED`, Finding / CAR Status `Closed`, and PLOR `Lengkap`. This proves
      terminal synchronization is visible in the active worklist.
- [x] **B — Finding detail:** the same Finding displayed Review Status `LEGACY_ESTABLISHED` and Finding /
      CAR Status `Closed`, plus `Pelaksanaan audit ini sudah selesai.` Identity and Checklist-source
      sections remained read-only, Sections 3–5 were functionally locked, PLOR content remained intact,
      and Review & Approval remained unchanged. Final synchronization created no Finding-review event.
- [x] **C — LTP cross-module consistency:** the LTP remained internally `CLOSED` and retained exactly 11
      cumulative workflow events, ending with `Admin/QMS menyetujui dan menutup LTP`. No synchronization
      event #12 appeared. The original browser pass exposed only a display inconsistency: Temuan/PLOR used
      `Closed`, while the LTP worklist/detail used `Ditutup` / `LTP Ditutup`.
- [x] The same-PR display-only correction standardized terminal user-facing terminology as `Closed`:
      `LTP_STATUS_LABEL.CLOSED` changed `Ditutup → Closed`, and the Admin terminal decision status changed
      `LTP Ditutup → Closed`. This covers the LTP worklist badge, detail badge, filter option, and Admin/QMS
      terminal card. Finding terminology remained `Closed`; internal values remain Finding `Closed` and LTP
      `CLOSED`. The natural-language event sentence `Admin/QMS menyetujui dan menutup LTP` was not changed.
- [x] **Terminology browser re-test:** after deployment and hard refresh, the QA-9910 LTP worklist showed
      Status `Closed`. Detail Section 9 showed Keputusan `Disetujui`, Status `Closed`, actor **Admin Browser
      Smoke**, and retained comment `Disetujui dan LTP dapat ditutup.` Sections 7 and 8 remained historical;
      Section 8 retained Hasil Verifikasi `Close`. PLOR and LTP terminal UI now both display `Closed`.
- [x] Final read-only Staging verification after browser smoke found no backend mutation: LTP `CLOSED`,
      revision `17`, Auditor result `CLOSE`, 11 events, latest `ADMIN_APPROVED_LTP`; Finding `Closed`,
      `LEGACY_ESTABLISHED`, revision `2`, `car_id=NULL`. No browser action created event #12, incremented the
      LTP revision, changed review status, or populated the legacy Finding relation.
- [x] Batch 7g browser verification is complete. SQL/RPC/RLS, the immutable applied migration,
      notifications, workflow transitions/history wording, Finding synchronization, `PROJECT_PLAN.md`,
      `AGENTS.md`, `Readme.md`, and nested `/project` remain untouched by this final documentation closeout.
      PR #18 is merged at the documented squash commit; its verified implementation and evidence remain preserved.

## Batch 7h — Multiple LTP Actions with Evidence per Action — 1 Sep 2026

**Status:** `VERIFIED_COMPLETE — MERGED` (Staging, runtime, real-browser, Vercel, security,
and static verification PASS.)

PR #19, **Batch 7h: Multiple LTP actions with per-action evidence**, was approved at final head
`50597ef2e0537cf001e9ee38c81f5e1a03b14436` and squash-merged to `main` as
`8ba3a432ead18aca49737e33318a37532b7a5b3b`. Its authoritative branch was
`codex/implement-multiple-ltp-actions-feature`; the browser-tested/pre-closeout PR head was
`aa63d8172555a4aef86963d5f28d47f3a9d169a2`.

### Implementation and immutable Staging migration — PASS

- [x] The principle remains **one action = one evidence set** without a second evidence model. Evidence
      continues to be grouped by stable `car_actions.id`, with multiple files supported independently in
      `BEFORE`, `AFTER`, and `BEFORE_AFTER` for each action UUID.
- [x] Repository migration `20260901010000_enable_multiple_ltp_actions.sql` has repository SHA-256
      `02d848b3caed33fd4c9ab5d18b933c42e9f1bf0acd25fbd84b36cf60d5e2c6a8`. CertiTrack-Staging applied it
      under the separate actual ledger entry `20260901061215 · enable_multiple_ltp_actions`. Repository
      filename and Staging ledger identity are intentionally recorded separately; the applied migration is
      now immutable.
- [x] Live schema verification passed: `car_actions.sort_order` is `integer NOT NULL` with
      `CHECK (sort_order > 0)`; old constraint `car_actions_car_id_action_type_key` is absent; active
      `car_actions_car_type_sort_order_key` is `UNIQUE (car_id, action_type, sort_order) DEFERRABLE
      INITIALLY DEFERRED`. There are no invalid orders or duplicate business keys. Migration assertions
      passed. Current retained global counts are `car_actions=6` and `car_action_evidence=18`; the migration
      itself asserted both counts remained unchanged during backfill.

### QA-9910 backward compatibility — PASS

- [x] Retained terminal fixture `QA-9910/MFG/2099/001` remains LTP `CLOSED`, revision `17`, Auditor result
      `CLOSE`, with 11 workflow events. Its Finding remains `Closed / LEGACY_ESTABLISHED`, with legacy
      `finding.car_id=NULL`.
- [x] The same action UUIDs survived: Temporary `6068174a-3b8e-43a1-871c-24675644ef90`, Corrective
      `5b54f382-8876-4315-a205-8fd4711eb715`, and Preventive
      `74044233-b74b-4c0b-9453-b8aad870ac8a`. Each now has `sort_order=1` and retains its original three
      evidence rows under the same UUID. No evidence ownership, LTP revision, Finding field, or notification
      changed, and no workflow event #12 was created.

### Multi-action draft reconciliation — PASS

- [x] A rollback-only Category C fixture based on editable `QA-9907/SYS/2099/002`, authorized as
      `auditee@gmail.com`, saved Corrective #1 and #2 in one Draft operation. Two distinct action UUIDs with
      independent descriptions and orders `[1,2]` were produced; LTP revision advanced exactly once `1 → 2`,
      status remained `AUDITEE_DRAFT`, and zero workflow events were created.
- [x] UUID edit isolation passed. With evidence on Corrective #1, editing only Corrective #2 preserved #1's
      UUID, description, PIC, Due Date, order, and evidence count; #2 retained its UUID and changed only the
      requested fields. The save incremented revision exactly once, proving identity is UUID—not action type.
- [x] Deletion/renumbering passed with three Corrective actions: evidence-free old #2 was removed, old #1
      remained UUID-stable as #1, and evidence-backed old #3 remained UUID-stable while becoming #2. Its
      evidence remained attached to the same UUID, and the LTP revision incremented once.
- [x] Evidence-backed deletion failed atomically with the expected message: `Tindakan yang memiliki evidence
      tidak dapat dihapus. Hapus evidence pada tindakan tersebut terlebih dahulu.` Revision, Dampak, other
      action content, the protected action, and its evidence all remained unchanged.
- [x] Fail-closed guards passed independently: stale revision returned `LTP_STALE_REVISION`; a duplicate
      persistent ID, an action ID owned by another LTP, and a Section Manager attempting an Auditee draft save
      were rejected. Each rejection retained the prior LTP revision and action state with no partial mutation.

### Per-action blockers, evidence, and compatibility — PASS

- [x] With Corrective #1 complete and #2 incomplete, blockers specifically returned `Tindakan Korektif #2
      belum memiliki PIC.`, `Tindakan Korektif #2 belum memiliki Due Date.`, and `Tindakan Korektif #2 wajib
      memiliki Evidence Before dan Evidence After, atau satu Before vs After.`
- [x] Corrective #2 evidence matrix passed: none, `BEFORE` only, and `AFTER` only were blocked; `BEFORE +
      AFTER`, one `BEFORE_AFTER`, and multiple `BEFORE_AFTER` files passed the evidence gate. Evidence on #1
      did not satisfy #2, and multiple files per evidence state remain supported.
- [x] Multiple Temporary and multiple Preventive actions were accepted. `get_ltp_context` returned the
      deterministic sequence Temporary #1, Temporary #2, Corrective #1, Preventive #1, Preventive #2, with
      evidence nested under its owning UUID. Removing every Corrective retained `Tindakan Korektif wajib
      diisi.`
- [x] Traditional one-Corrective payload compatibility passed: one row at `sort_order=1`, exactly one revision
      increment, and no workflow event from Draft save.

### Role context and full workflow regression — PASS

- [x] A rollback-only two-action context returned both actions read-only in every downstream state.
      `MANAGER_REVIEW` exposed only `can_review_manager`; `AUDITOR_REVIEW` exposed only
      `can_review_auditor`; `ADMIN_REVIEW` exposed only `can_review_admin`; `CLOSED` exposed no mutation or
      review permission. `can_edit_auditee` was false throughout these downstream states.
- [x] A fresh rollback-only Category C terminal path passed with two complete, independently evidenced
      Corrective actions: `AUDITEE_DRAFT → MANAGER_REVIEW → AUDITOR_REVIEW → ADMIN_REVIEW → CLOSED` through
      Auditee Submit, Manager APPROVE, Auditor CLOSE, and Admin APPROVE. Final pre-rollback state was LTP
      `CLOSED`, revision `5`, result `CLOSE`, and Finding `Closed`. Both action UUIDs remained distinct;
      Corrective #1 retained one `BEFORE_AFTER` row and #2 retained separate `BEFORE + AFTER` rows. This
      freshly reconfirms Batch 7g terminal Finding synchronization.
- [x] The original 50-point plan is not represented as “50/50 independently re-executed SQL cases” because it
      mixes database, frontend-only, browser-only, and inherited regression behavior. Database/schema/runtime
      core, the complete CLOSE terminal path, and Manager/Auditor/Admin read-only context passed. Frontend UX
      was subsequently verified in the real browser. Unchanged RETURN and Auditor OPEN mutation functions were
      not separately rerun in Batch 7h because this slice does not alter them.

### Security, history, cleanup, deployment, and browser handoff

- [x] Authenticated direct DML remains denied: INSERT/UPDATE/DELETE privileges are false on both
      `car_actions` and `car_action_evidence`; mutations remain guarded-RPC controlled. Runtime authorization
      tests passed.
- [x] Draft action saves created zero workflow events. Direct UPDATE of an existing QA-9910 workflow event was
      rejected by the immutable-history trigger with `Riwayat review/disposisi bersifat permanen`; QA-9910
      retained exactly 11 events.
- [x] Runtime cleanup passed: all action/evidence verification mutations were rollback-only; final runtime
      action and evidence residue were both zero. QA-9910 and all retained fixtures remained unchanged.
- [x] Security Advisor was run and is **not clean**. Existing
      `authenticated_security_definer_function_executable` warnings remain for intentional internally guarded
      RPCs including `save_ltp_auditee_draft`, `submit_ltp_to_manager`, `manager_decide_ltp`,
      `auditor_verify_ltp`, `admin_decide_ltp`, evidence register/delete, `get_ltp_context`, and other existing
      guarded/helper functions. **Leaked Password Protection Disabled** also remains. Runtime authorization
      passed. Remediation reference:
      https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- [x] Vercel reported **SUCCESS** for browser-tested/pre-closeout PR head
      `aa63d8172555a4aef86963d5f28d47f3a9d169a2`.
- [x] Retained static verification: `npm run typecheck`, `npm run build`, changed-file ESLint for
      `src/lib/types.ts`, `src/services/ltpService.ts`, and `src/components/pages/ltp/LtpAuditeeForm.tsx`, plus
      `git diff --check`, all passed. Known Browserslist and bundle-size advisories remain non-blocking.

### Real-browser multi-action and terminal workflow verification — PASS

- [x] The actual persistent browser fixture was `QA-9907/SYS/2099/001`. The similarly named
      `QA-9907/SYS/2099/002` was used only for rollback/runtime verification and was not the real-browser fixture.
- [x] Repeatable `+ Tambah Tindakan` passed. A blank added Temporary action was not persisted. Corrective #2
      was created as UUID `75620bf4-d1e1-4360-9e24-22d7ff1cd453`, `sort_order=2`, Description
      `Browser Smoke Corrective 2`, PIC `PIC Corrective 2`, and Due Date `2026-09-04`.
- [x] Save-first evidence behavior passed. Before Corrective #2 evidence was complete, the UI returned the
      specific blocker `Tindakan Korektif #2 wajib memiliki Evidence Before dan Evidence After, atau satu
      Before vs After.` The blockers cleared after its independent evidence set was completed.
- [x] Evidence isolation passed. Corrective #1 UUID `0021d8bf-31fc-47a6-b8bb-b92cafe88f98` remained
      `sort_order=1` with three evidence rows. Corrective #2 UUID
      `75620bf4-d1e1-4360-9e24-22d7ff1cd453` remained `sort_order=2` with four evidence rows: two `BEFORE`,
      one `AFTER`, and one `BEFORE_AFTER`. Neither action displayed or consumed the other's evidence.
- [x] Auditee Submit passed. Manager saw all actions/evidence read-only and APPROVE passed; Auditor saw them
      read-only and CLOSE passed; Admin saw them read-only and final APPROVE passed. Final browser Section 9
      displayed `Keputusan = Disetujui` and `Status = Closed`.
- [x] Final live backend for `QA-9907/SYS/2099/001`: LTP `CLOSED`, revision `10`,
      `auditor_verification_result=CLOSE`, six workflow events, latest `ADMIN_APPROVED_LTP`; Finding `Closed /
      LEGACY_ESTABLISHED`, revision `2`, legacy `car_id=NULL`.
- [x] Final live actions remained independently identified and evidenced: Temporary #1 UUID
      `6e140fa1-9236-42b3-800f-6d2a5f512793`, order 1, evidence 3; Corrective #1 UUID
      `0021d8bf-31fc-47a6-b8bb-b92cafe88f98`, order 1, evidence 3; Corrective #2 UUID
      `75620bf4-d1e1-4360-9e24-22d7ff1cd453`, order 2, evidence 4; Preventive #1 UUID
      `d15a0c26-f03a-4918-aa31-4892a1427935`, order 1, evidence 3.
- [x] Batch 7h browser verification is complete. Staging, runtime, browser, Vercel, authorization, immutable
      history, cleanup, and static gates pass. PR #19 is merged at the documented squash commit.


## Batch 7f — Admin/QMS LTP Final Decision — 31 Aug 2026

**Status:** `VERIFIED_COMPLETE — MERGED` (Staging, runtime, browser, and Vercel PASS.)

PR #17, **Batch 7f: Admin/QMS LTP final decision**, was approved at head
`afa83c7fe49b80713b8b444586a4441a242a4db5` and squash-merged to `main` as
`1e9c32a05e475f21c7c557a94b42ae5cc5a6c168`. Its implementation branch was
`codex/implement-batch-7f-admin/qms-final-decision`.

### Implementation and migration — VERIFIED

- [x] Admin/QMS RETURN atomically transitions `ADMIN_REVIEW → AUDITOR_RETURNED`, requires a non-empty
      Admin comment, increments the revision exactly once, appends one
      `ADMIN_RETURNED_TO_AUDITOR` event, closes obsolete `LTP_ADMIN_REVIEW` notifications, and notifies
      every currently eligible Auditor under the existing annual/global authority model.
- [x] The existing Auditor mutation supports both `AUDITOR_REVIEW` and `AUDITOR_RETURNED`. OPEN moves
      to `AUDITEE_RETURNED` with a mandatory comment; CLOSE moves to `ADMIN_REVIEW`. Authorization
      remains active `AUDITOR` plus `auditor_user_can_receive_finding(auth.uid(), finding_id)`.
- [x] Admin/QMS APPROVE atomically transitions `ADMIN_REVIEW → CLOSED` only when
      `auditor_verification_result = CLOSE`, increments the revision exactly once, appends one
      `ADMIN_APPROVED_LTP` event, closes obsolete Admin-review notifications, and sends deduplicated
      `LTP_CLOSED` notifications. `CLOSED` closes only the LTP workflow.
- [x] Admin mutation authority remains database-enforced as authenticated plus active identity
      `ADMIN`. No new status or QMS identity was introduced. Workflow events remain the authoritative,
      cumulative Manager/Auditor/Admin history; Section 8 supports Admin-returned re-verification and
      Section 9 remains readable after Return, re-review, and final Close.
- [x] Repository migration filename:
      `20260831010000_add_ltp_admin_final_decision.sql`. Preserved repository SHA-256:
      `8433c355ddf6c6d6c6a2fde5c8b18b1135f29403c76e3a12a82aae3575d79bdc`.
- [x] CertiTrack-Staging applied the migration under the distinct ledger entry
      `20260831042009 · add_ltp_admin_final_decision`. The repository timestamp and Staging ledger
      timestamp are intentionally recorded as separate facts. The applied migration is immutable.

### Function ACL and runtime verification — PASS

- [x] Function ACLs passed after migration:
      `ltp_admin_decision_blockers(uuid,text)` has anon `EXECUTE=false` and authenticated
      `EXECUTE=false`; `admin_decide_ltp(uuid,integer,text,text)` has anon `EXECUTE=false` and
      authenticated `EXECUTE=true`; `auditor_verify_ltp(uuid,integer,text,text)` has anon
      `EXECUTE=false` and authenticated `EXECUTE=true`. The mutation RPCs remain `SECURITY DEFINER`
      with identity/authority enforced internally.
- [x] All **21/21 rollback-only runtime cases passed**:
  1. Active Admin can RETURN.
  2. Auditor is denied the Admin mutation.
  3. Auditee is denied the Admin mutation.
  4. Section Manager is denied the Admin mutation.
  5. Admin RETURN without comment is rejected with `LTP_ADMIN_RETURN_COMMENT_REQUIRED`.
  6. Admin RETURN without an eligible Auditor is blocked with `LTP_ADMIN_RETURN_BLOCKED`.
  7. RETURN produces exactly `ADMIN_REVIEW → AUDITOR_RETURNED`, one revision increment, one
     `ADMIN_RETURNED_TO_AUDITOR` event, an eligible-Auditor notification, and closes the prior
     `LTP_ADMIN_REVIEW` notification.
  8. A stale Admin revision is rejected with `LTP_STALE_REVISION`.
  9. A second Admin decision after the first transition is rejected.
  10. A normal Auditor with an active annual assignment can act from `AUDITOR_RETURNED`.
  11. The same normal Auditor is denied after the annual assignment is inactive.
  12. The company Lead Auditor can act globally from `AUDITOR_RETURNED` without annual assignment.
  13. Auditor OPEN produces `AUDITOR_RETURNED → AUDITEE_RETURNED`, revision +1, result `OPEN`, exactly
      one `AUDITOR_VERIFIED_OPEN_TO_AUDITEE` event, and an Auditee notification.
  14. Auditor CLOSE produces `AUDITOR_RETURNED → ADMIN_REVIEW`, revision +1, result `CLOSE`, exactly
      one `AUDITOR_VERIFIED_CLOSE_TO_ADMIN` event, and an Admin notification.
  15. Pending `LTP_AUDITOR_RETURNED` notifications become read after the Auditor decision.
  16. Admin APPROVE is rejected unless `auditor_verification_result = CLOSE`.
  17. APPROVE produces `ADMIN_REVIEW → CLOSED`, revision +1, exactly one `ADMIN_APPROVED_LTP` event,
      and closes the pending Admin-review notification.
  18. `LTP_CLOSED` fan-out reached the matching Auditee, matching Section Manager, and eligible
      Auditor with three notifications for three distinct recipients. A separate fixture lacking
      Auditee/Manager recipient classes still approved and reached `CLOSED`; missing notification
      recipients do not block approval.
  19. No further Admin or Auditor decision is possible after `CLOSED`.
  20. `car_workflow_events` UPDATE and DELETE remain rejected; history remains immutable.
  21. Finding lifecycle fields remained unchanged for every runtime fixture.
- [x] Rollback cleanup passed: zero `B7F-RUNTIME` Findings and zero `B7F-RUNTIME` LTPs remain.

### Real-browser verification — PASS

The controlled browser workflow used LTP `QA-9910/MFG/2099/001` (car
`0d59f75f-04b8-4dfe-bf0f-5d43f0943afe`, Finding
`0beddfb1-cb7f-4af6-836b-f87c3c2d6f03`). Actors were Admin
`rizkihidayat1994@gmail.com` / **Admin Browser Smoke**, normal annual Auditor `tl@gmail.com` /
**B6B Smoke Auditor Lead**, Auditee `auditee@gmail.com`, and Section Manager `manager@gmail.com`.
The Auditor identity was `AUDITOR`, company Lead false, with an active annual assignment; this smoke
therefore verified normal annual authority rather than global Lead authority.

- [x] **A — Initial Admin review:** at `ADMIN_REVIEW`, revision `14`, result `CLOSE`, and eight events,
      Section 7 retained the Manager approval; Section 8 retained Auditor Close and comment `Sudah
      sesuai`; Section 9 showed `Menunggu Keputusan Admin/QMS`, its textarea, both decision buttons,
      `can_review_admin=true`, and empty Return/Approve blockers. All eight prior events remained.
- [x] **B — Admin RETURN:** comment `Mohon verifikasi ulang efektivitas tindakan dan bukti pendukung.`
      produced `ADMIN_REVIEW → AUDITOR_RETURNED`, revision `14 → 15`, retained the prior result `CLOSE`,
      and appended event #9 `ADMIN_RETURNED_TO_AUDITOR`. Section 8 showed the returned state, previous
      Close, and exact Admin feedback. Section 9 became historical/read-only with decision
      `Dikembalikan ke Auditor`, actor **Admin Browser Smoke**, and the exact comment.
      `LTP_AUDITOR_RETURNED` reached `tl@gmail.com` with title `LTP dikembalikan Admin/QMS ke Auditor`
      and the exact Admin comment; previous `LTP_ADMIN_REVIEW` notifications became read.
- [x] **C — Auditor re-verification:** the worklist showed `Dikembalikan ke Auditor`; the return
      notification was visible and became read on open. Section 8 was interactive, retained the
      previous Close and Admin feedback, and exposed both OPEN/CLOSE controls; Section 9 retained the
      historical Admin Return. CLOSE with comment `Verifikasi ulang telah dilakukan dan hasil tetap
      sesuai.` produced `AUDITOR_RETURNED → ADMIN_REVIEW`, revision `15 → 16`, result `CLOSE`, and
      event #10 `AUDITOR_VERIFIED_CLOSE_TO_ADMIN`. Section 8 retained the new Close/comment and Section
      9 became interactive again while showing its concise previous Return context. Fresh
      `LTP_ADMIN_REVIEW` notifications were created.
- [x] **Browser-found empty-card correction:** at revision 16, an empty Auditee action card appeared
      between Sections 6 and 7 because `LtpAuditeeForm` rendered the outer card unconditionally while
      all children were status-conditional. Correction commit
      `daa1fce0efc9bfe38853e31317521a2258a16b4c` (**Hide empty Auditee action card**) gates the card with
      `showAuditeeActionCard`: editable Auditee state, `MANAGER_REVIEW`, or `AUDITOR_REVIEW` only.
      Existing Draft/Returned/Manager/Auditor behavior remains; no placeholder or database/workflow
      change was introduced. Deployment and browser re-test passed: the visual order is now Sections
      6 → 7 → 8 → 9, with no empty card at `AUDITOR_RETURNED`, `ADMIN_REVIEW`, or `CLOSED`.
- [x] **D — Admin final APPROVE:** from `ADMIN_REVIEW`, revision 16, result `CLOSE`, and ten events,
      comment `Disetujui dan LTP dapat ditutup.` produced `ADMIN_REVIEW → CLOSED`, revision `16 → 17`,
      retained result `CLOSE`, and appended event #11 `ADMIN_APPROVED_LTP`. Section 9 displayed
      `Disetujui`, `LTP Ditutup`, actor **Admin Browser Smoke**, and the exact comment. Sections 7 and
      8 retained their historical Manager/Auditor content, including the re-verification comment.
- [x] **Terminal read-only:** worklist status is `Ditutup`; Sections 7, 8, and 9 remain readable; no
      Auditee, Manager, Auditor, or Admin controls remain; and the empty action card does not reappear.
      Final permissions are all false: `can_edit_auditee`, `can_submit_auditee`,
      `can_review_manager`, `can_review_auditor`, and `can_review_admin`.

Final LTP state is `CLOSED`, revision `17`, Auditor result `CLOSE`, eleven workflow events, and latest
`ADMIN_APPROVED_LTP`. The Finding deliberately remains `Open / LEGACY_ESTABLISHED` with `car_id=NULL`:
Batch 7f closes only the LTP; controlled Finding/LTP synchronization remains Batch 7g.

All eleven cumulative browser events remain visible oldest-to-newest:

1. Auditee mengirim LTP ke Section Manager
2. Section Manager mengembalikan LTP ke Auditee
3. Auditee mengirim ulang LTP ke Section Manager
4. Section Manager menyetujui LTP dan mengirim ke Auditor
5. Auditor memverifikasi Open dan mengembalikan LTP ke Auditee
6. Auditee mengirim ulang LTP ke Section Manager
7. Section Manager menyetujui LTP dan mengirim ke Auditor
8. Auditor memverifikasi Close dan mengirim LTP ke Admin/QMS
9. Admin/QMS mengembalikan LTP ke Auditor
10. Auditor memverifikasi Close dan mengirim LTP ke Admin/QMS
11. Admin/QMS menyetujui dan menutup LTP

This proves cumulative, immutable history across Manager Return/Approve, Auditor Open/Close, Admin
Return, Auditor re-verification, and Admin approval. Final `LTP_CLOSED` notifications reached
`auditee@gmail.com`, `manager@gmail.com`, and `tl@gmail.com`; all carried
`QA-9910 · QA-9910/MFG/2099/001 · LTP telah disetujui dan ditutup.` This states only that the LTP was
closed, not the Finding.

### Security, deployment, static validation, and remaining boundary

- [x] Security Advisor was run after migration and is **not clean**. The expected
      `authenticated_security_definer_function_executable` warning remains for the intentionally
      authenticated `public.admin_decide_ltp(...)`, existing `auditor_verify_ltp(...)`,
      `manager_decide_ltp(...)`, and other guarded RPC/helper functions. Runtime/internal authority
      checks passed despite this intentional exposure. The existing **Leaked Password Protection
      Disabled** Auth warning also remains. Remediation reference:
      https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- [x] Vercel reported **SUCCESS** for corrected remote PR head
      `daa1fce0efc9bfe38853e31317521a2258a16b4c`.
- [x] Static validation remains PASS: `npm run typecheck`, `npm run build`, changed-file ESLint, and
      `git diff --check`. Build emitted only the existing non-blocking Browserslist and bundle-size
      advisories.
- [x] Batch 7f does not update `findings.status`, `findings.review_status`, or `findings.car_id`.
      Finding/LTP synchronization remains explicitly deferred to Batch 7g, even after Admin APPROVE
      closes the LTP.
- [x] Existing applied migrations, application/source files, and nested `/project` remained untouched by
      the final documentation-only closeout. PR #17 was subsequently approved and squash-merged. The
      active controlled slice is Batch 7g — Finding/LTP final synchronization. Handoff state before the
      Batch 7g migration: LTP `CLOSED`; Finding `Open / LEGACY_ESTABLISHED`, `car_id=NULL`.

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

### FORM-001 browser print/export — 22 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`; static presentation checks pass, but authenticated Staging and
authoritative Chrome A3 Landscape Print Preview acceptance remain pending. Production was not changed.

- Added the read-only `Q-120-ISE-001-FORM-001` preview and browser `window.print()` action to the existing
  Rencana Audit Tahunan detail. It reuses the loaded Annual Plan header, plan-process rows, selected active
  Sections, normalized annual-plan process/Section links, and annual-plan monthly schedule records; it does
  not persist or duplicate print data.
- The current schema owns a calendar `tahun` plus schedule `bulan` values 1–12 and has no fiscal-period start
  field. Accordingly the print view generates January–December dynamically for the selected plan year rather
  than guessing an April–March period. Plan and Aktual marks come only from `audit_plan_schedule.plan` and
  `.aktual`.
- Deterministic pagination uses 13 two-row Process slots per physical sheet. Every rendered page repeats the
  complete header, legends, vertical Section/month headings, matrix, notes, document code, and calculated
  `Hal: current/total`. The final page fills unused slots with a full-grid, vertically labelled `Lainnya`
  region instead of stretching real rows.
- Process order follows `audit_plan_process.urutan_tampil`. Master Process rows marked
  `diaudit_tahun_ini=false` remain visible and receive a CSS bottom-left-to-top-right diagonal in every
  Section and schedule cell on both Plan/Aktual rows. Inactive master rows not historically synchronized to
  the plan are appended by stable master code for controlled-form visibility without inserting plan rows.
- Page 1 approval cells show `penanggung_jawab_qms` and `disetujui_oleh`; continuation pages retain role and
  cell geometry but replace both names with CSS diagonals. `tanggal_berlaku`, `no_revisi`, and
  `kode_dokumen` provide the remaining controlled metadata. No image logo asset exists in active root source,
  so the header reuses the existing textual CertiTrack brand rather than inventing a company logo.
- Fixed controlled footnotes are centralized in the print helper because no equivalent Annual Plan storage
  exists. Explicit buffered A3 geometry is `418mm × min-height 294mm` within `@page A3 landscape`, and print
  rules hide the application shell/UI while preserving one complete React section per physical sheet.
- Files changed: `src/components/pages/RencanaAuditPage.tsx`,
  `src/components/pages/AnnualAuditPlanPrintView.tsx`,
  `src/components/pages/annualAuditPlanPrint.css`, `src/lib/annualAuditPrint.ts`,
  `tests/form001-presentation.cjs`, and `PROJECT_STATUS.md`. No migration, dependency, backend, RLS,
  FORM-010/FORM-014, Production, or nested `/project` file changed.
- Validation passed: `node tests/form001-presentation.cjs`, `npm run typecheck`, targeted ESLint,
  `npm run build`, and `git diff --check`. Full-repository `npm run lint` remains red on pre-existing unused
  imports in active and legacy snapshot files; the FORM-001 touched TypeScript files pass targeted ESLint.
  No browser executable/authenticated Staging session is available in this environment, so no screenshot or
  Chrome physical pagination PASS is claimed.

#### FORM-001 correction pass — 22 Sep 2026

- Section marks now preserve both authoritative `audit_plan_seksi_link` flags after the relationship symbol:
  `◎`/`○`, optionally followed by `*1`, `*2`, or `*1*2`. Flags without a `peran` relationship remain blank.
- FORM-001 Section resolution now reads the complete Section master through `getSeksiList()` and filters it by
  the selected plan's `seksi_terlibat`. A selected historical Section therefore remains printed after its
  master becomes inactive, while an inactive Section not owned by the plan remains absent. The normal editor
  continues using `getSeksiAktif()` for new selections, and print columns retain `urutan_tampil` order.
- Corrected the controlled table heading from `Process` to `Proses`.
- Print actions are now explicit: `Preview FORM-001` toggles the committed screen preview; only the separately
  visible `Cetak / Simpan PDF` button invokes `window.print()`. No pre-render print side effect remains.
- Extended the FORM-001 presentation regression for every relationship/flag combination, the no-relationship
  flag guard, selected inactive/unselected inactive Section behavior, and the corrected Indonesian label.
  No geometry, pagination capacity, slash behavior, filler behavior, schema, RLS, Production, other form, or
  legacy `/project` file changed. Browser A3 Print Preview remains pending.

#### FORM-001 fiscal month-order correction — 22 Sep 2026

- FORM-001 now presents its 12 schedule columns in the authoritative fiscal order April–March. For plan year
  2026 the labels are April–December 2026 followed by January–March 2027.
- This is presentation-only: each rendered column retains its real calendar `bulan` key (`4..12,1..3`) when
  reading `audit_plan_schedule`; the database model and stored schedule values are unchanged.
- Regression coverage asserts the exact Indonesian label sequence, year rollover, and calendar month-number
  lookup sequence. No migration or other FORM-001 behavior changed; Chrome A3 browser UAT remains pending.

#### FORM-001 authoritative Actual synchronization — 22 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`; code/static validation is complete, but the additive migration and
rollback-only SQL regression have not been applied or executed on CertiTrack-Staging. Production is untouched.

- Added additive migration `20260922120000_automate_annual_plan_actual.sql`. The existing
  `audit_plan_schedule.aktual` column remains the effective/materialized value consumed by the editor and
  FORM-001. New provenance stores computed `aktual_auto` plus an optional active Admin override, reason,
  actor, and timestamp.
- Automatic reconciliation resolves QA → Instruction → Program → Annual Plan → the unique
  `audit_plan_process.proses_master_id`; it never matches process-name text. It qualifies completed rows only
  when the applicable Checklist is complete, an authoritative execution date exists, and every applicable
  non-ANNULLED Finding is `PUBLISHED` or `LEGACY_ESTABLISHED`. ZERO FINDING is explicitly valid.
- Product uses `tanggal_audit_produk` with `tanggal_pelaksanaan_audit` fallback; System, Manufacturing, and
  Shift use `tanggal_pelaksanaan_audit`. Calendar month keys remain 1–12 despite the April–March print order.
- Reconciliation is aggregate per Annual Plan Process + month, so one reopened QA cannot clear Actual while
  another qualifying QA remains. Row completion/reopen/date changes and Finding insert/delete/review-state
  changes invoke the centralized reconciler. An active Admin override wins without preventing the underlying
  automatic value from being refreshed.
- `override_annual_plan_actual` is an authenticated, guarded RPC that rechecks `is_admin_identity()`. Set and
  Clear require a nonblank reason and record `auth.uid()`/timestamp; Return to Automatic clears override state
  and reconciles immediately. Direct mutation of Actual/provenance is rejected by a database trigger.
- Append-only `audit_plan_actual_override_events` records schedule/process/month, previous effective value,
  override/result values, action, reason, actor, and timestamp. Ordinary authenticated users have no
  UPDATE/DELETE grant or RLS policy. Historical `aktual=true` values are conservatively retained as explicit
  `LEGACY_PRESERVED` overrides with an unavailable-actor explanation; historical false/default cells enter
  automatic mode and are reconciled from current authoritative evidence.
- Rencana Audit UI keeps Plan editing unchanged. Actual is read-only for non-Admin identities with the required
  automatic-completion tooltip. Admin Actual cells open a reasoned Set/Clear/Return-to-Automatic modal and
  show screen-only manual provenance; FORM-001 continues printing only `●` or blank.
- Added rollback-only `supabase/tests/form001_actual_regression.sql` covering ZERO FINDING, pending/established/
  ANNULLED Findings, reopen aggregation, Product/System/Manufacturing date ownership, real fiscal month keys,
  authorization, Set/Clear/Return override behavior, override precedence, blank reasons, and immutable history.
- Files changed in this pass: `supabase/migrations/20260922120000_automate_annual_plan_actual.sql`,
  `supabase/tests/form001_actual_regression.sql`, `src/lib/types.ts`, `src/services/auditPlanService.ts`,
  `src/components/pages/audit-plan/AuditMatrix.tsx`, `src/components/pages/RencanaAuditPage.tsx`, and
  `PROJECT_STATUS.md`. No FORM-001 print geometry/content, QA numbering, Checklist content, Finding semantics,
  LTP, FORM-010, FORM-014, Production, or nested `/project` file changed.

##### Standalone Instruction compatibility correction — 22 Sep 2026

- Actual resolution now mirrors the established Instruction behavior: an Instruction with `program_id` uses
  `audit_programs.plan_id`; a standalone Instruction uses its `tahun_fiskal` only when exactly one Annual Plan
  exists for that year. The selected Plan must then contain exactly one `audit_plan_process` matching the
  structured `proses_master_id`; process names remain irrelevant.
- Trigger-facing resolvers are intentionally nullable. Missing/ambiguous Annual Plans and missing/ambiguous
  Annual Plan Process mappings now no-op without creating/changing Actual and without aborting audit
  completion, reopen, date update, or Finding workflow. The explicit process/month reconciler remains strict
  for invalid direct targets.
- The rollback regression now covers Program-linked resolution plus standalone unique, missing, ambiguous,
  and unmapped Plan cases, including successful completion/Finding mutations for unresolved cases.
- Screen provenance now distinguishes `AUTO`, `MANUAL ADMIN`, and migrated `LEGACY PRESERVED` based on the
  existing nullable override actor. FORM-001 remains unchanged and prints only `●` or blank.
- Migration and rollback regression remain unapplied/unexecuted on Staging pending code review. Production
  remains untouched.

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

## Batch 8a — Daftar Ketidaksesuaian — 3 Sep 2026

**Status:** `VERIFIED_COMPLETE — MERGED` (PR #20 approved at head
`553f50a54a4429d174dc1ef700e643e08b06d918` and squash-merged to `main` as
`109250c3f2554bc1de2ad4ee8b671bf07a6775cf`; prior static, Vercel, and real-browser verification PASS.)

- [x] Implemented the central Admin-only **Daftar Ketidaksesuaian** workspace as a computed, read-only
      report. The existing sidebar item is enabled and routed to the new page; the existing authorization
      boundary remains unchanged (`ADMIN` only).
- [x] The eligible population is the inner match of authorized `listLtpWorklist()` rows and formal
      `listFindings()` records by Finding ID. Only audits with at least one accessible Finding-backed LTP
      appear, options and report rows are deterministic, and no checklist item table supplies report content.
- [x] A selected No. Audit loads `getFindingContext()` once from one eligible Finding after validating that
      every report Finding belongs to the same Instruction row. The header shows only current Team Master
      `kode_tim`, intentionally omitting the long Team name. **Dibuat** uses the Team Master member marked
      `is_team_leader`; this is the Team Leader and must not be confused with the company Lead Auditor.
- [x] No persistent report/snapshot table exists. The source architecture reuses the existing authorized
      cars/LTP worklist, formal Findings, and existing Finding context / Team Master. Batch 8a adds no
      migration, RPC change, RLS change, workflow mutation, or package dependency, and it does not expand
      the existing Admin-only authorization boundary.

### Real-browser report and classification verification — PASS

- [x] Manual browser smoke used `QA-9907`, which contained exactly two eligible Findings with LTP:
      Finding #1 had `nomor_urut_temuan=1`, Category B; Finding #2 had `nomor_urut_temuan=2`, Category C.
      The report rendered both in deterministic order `1`, `2`.
- [x] Header data passed: **No. Audit** displayed `QA-9907`; **Audit team** displayed only
      `B6B-SMOKE-TEAM`; and **Dibuat** displayed `B6B Smoke Auditor Lead`, the Team Master Team Leader.
      The document title is **DAFTAR KETIDAKSESUAIAN / PELUANG PERBAIKAN**.
- [x] The upper form header uses a centered title in the left column and a horizontal four-column/two-row
      metadata table in the right column. The metadata headings are **No. audit**, **Audit team**,
      **Tgl. pembuatan**, and **Dibuat**, with values directly beneath. The title is horizontally and
      vertically centered inside its left header column.
- [x] Document code `Q-120-ISE-001-FORM-008` appears alone, without a `Kode Dokumen:` prefix, after the
      complete table and right-aligned at the bottom-right of the form.
- [x] Final visible table columns are **NO**, **NO. PERSYARATAN + ITEM**, **SEKSI LOKASI**,
      **KETIDAKSESUAIAN (TANDA O)** grouped over **MAJOR** and **MINOR**, and
      **PELUANG IMPROVEMENT**. The fixed colgroup is `6% / 48% / 14% / 7% / 7% / 18%`, totaling 100%.
- [x] All table headers are centered: NO, NO. PERSYARATAN + ITEM, SEKSI LOKASI, the grouped
      classification heading, MAJOR, MINOR, and PELUANG IMPROVEMENT. Body NO, SEKSI LOKASI, and
      classification markers are centered; the PLOR narrative remains left-aligned. MAJOR and MINOR
      remain on one line in print.
- [x] The official classification marker is `O`, not a check mark or `X`. Category A maps to Major `O`,
      Category B maps to Minor `O`, and Category C maps to Peluang Improvement `O`, with all other marker
      cells blank. In the `QA-9907` smoke, Finding #1 showed Minor `O` and Finding #2 showed Peluang
      Improvement `O`.
- [x] The report reuses the existing `formatFindingNarrative()` helper and renders `row.narrative`; it does
      not duplicate narrative formatting and does not separately render `row.reference`. Klausul/Acuan
      remains naturally embedded in the formal PLOR narrative. For Category C, the recommendation remains
      inside the PLOR narrative rather than the Peluang Improvement marker column.

### Print/PDF, deployment, and static verification — PASS

- [x] Final browser print was manually verified as a clean, single-page A4 Portrait output for the short
      two-Finding `QA-9907` report. The application uses deterministic geometry: `@page` sets `A4 portrait`
      and `margin: 0`; browser/application outer print geometry is reset; and the report root applies Excel
      Normal margins internally: top/bottom `19.05 mm` and left/right `17.78 mm`.
- [x] Verified browser settings were Paper **A4**, Layout **Portrait**, Scale **100%**, Margins **None**, and
      **Headers and footers OFF**. Disabling the browser setting removed browser-generated date/time, title,
      URL, and page number; the application does not claim to disable those browser decorations
      programmatically.
- [x] Print-only filler rows remain blank bordered rows visible only in print. They create no report data,
      make no database mutation, and kept the two-Finding report body proportional and visually balanced.
- [x] Static checks passed: `npm run typecheck`, `npm run build`, changed-file ESLint, and
      `git diff --check`. Build emitted only the known non-blocking Browserslist-data and bundle-size
      advisories. No migration or package file changed, and nested `/project` remained untouched.
- [x] Vercel reported **SUCCESS** for browser-tested PR head
      `980385b7249a9ac38282fd41b17bc0db18cfeb8c`.
- [x] PR #20, **Batch 8a: Daftar Ketidaksesuaian computed report**, was approved at final head
      `553f50a54a4429d174dc1ef700e643e08b06d918` and squash-merged to `main` as
      `109250c3f2554bc1de2ad4ee8b671bf07a6775cf`.

---

## Batch 8b1 — Internal Audit Report Foundation & Draft — 5–6 Sep 2026

**Status:** `VERIFIED_COMPLETE — MERGED` (PR #21 squash-merged to `main` as `752d503e116186812201692d57aa77278088634b`; immutable Staging migration and browser verification remain recorded below.)

### Implemented scope and architecture

- [x] Implemented the Admin-only **Laporan Internal Audit** foundation and Draft workspace for official
      document `Q-120-ISE-001-FORM-015`.
- [x] Enforced at most one report per Instruction row. Persistence contains report-owned manual Draft fields
      only; No. Audit, process, target sections/managers, Agenda scope/timeline, Team, Checklist presence,
      Findings, counts, and references remain computed live from their upstream sources.
- [x] Creation eligibility remains Agenda plus at least one supported System, Product, or Manufacturing/Shift
      Checklist. Agenda Final is not required, and a clean audit with zero Findings remains valid.
- [x] Batch 8b1 deliberately provides no Final transition, signature/approval workflow, approval routing,
      or final print/PDF layout.

### Immutable migration and security/runtime verification — PASS

- [x] Repository migration:
      `supabase/migrations/20260905010000_create_batch8b1_internal_audit_report_foundation.sql`.
      Final immutable SHA-256:
      `e19918fce10d4dbc886ec570f4b8c2844755d9ca128d110971e4de1af43564f2`.
- [x] CertiTrack-Staging applied the migration successfully under ledger entry
      `20260905041814 · create_batch8b1_internal_audit_report_foundation`. The migration is now immutable
      and was not changed after Staging application.
- [x] Verified `audit_internal_reports` exists with the one-report-per-Instruction-row unique constraint,
      positive revision constraint, JSON-array constraints, follow-up consistency constraint, and nullable
      `sub_leader_auditor_id`.
- [x] Verified authenticated direct `INSERT`, `UPDATE`, and `DELETE` are revoked; Admin SELECT RLS is active.
      Create and Save Draft RPCs are guarded, both use `SECURITY DEFINER` with locked `search_path`, and an
      unauthenticated create attempt was rejected.
- [x] Successful Draft saves increment `revision_version` exactly once. The authoritative direct Staging
      stale-write probe used current revision `8` with `p_expected_revision=7`; the RPC rejected it with
      **“Laporan sudah berubah. Muat ulang data sebelum menyimpan kembali.”** and committed no mutation,
      leaving revision `8`. The duplicate-browser-tab experiment is not treated as stale-write proof because
      refreshed browser state made both writes valid sequential saves.

### QA-9907 eligibility, creation, and computed context — FULL PASS

- [x] Initial fixture state had a System Checklist, no Agenda, and no report. The worklist showed Agenda
      **Belum Dibuat**, Checklist **Sistem**, Major `0`, Minor `1`, Peluang Improvement `1`, and Report
      **Belum Dibuat**. **Buat Laporan** remained visible but disabled, with **Agenda belum dibuat.** shown.
- [x] After creating an Agenda Draft, the worklist showed Agenda **Draft**, retained Checklist **Sistem** and
      Report **Belum Dibuat**, removed the blocker, and enabled **Buat Laporan**. Agenda Final was not required.
- [x] Draft creation passed with official code `Q-120-ISE-001-FORM-015`. Computed process, Section Manager,
      Agenda objective/scope, Agenda-item audit date/time, Team code `B6B-SMOKE-TEAM`, and Team Leader
      `B6B Smoke Auditor Lead` all passed.
- [x] Repeatable Auditee Hadir rows, including multiple browser-fixture attendees, saved and reloaded correctly.

### Optional Sub Leader and Member presentation — FULL PASS

- [x] Sub Leader remains optional; no Team Master Sub-Leader role exists. Initial
      `sub_leader_auditor_id=NULL` displayed **Tidak ada Sub Leader**.
- [x] Fixture Team Leader was `B6B Smoke Auditor Lead` and Member was `B6B Smoke Auditor Member`. With
      Sub Leader `NULL`, Member Audit displayed the Member. Selecting that same-Team Member as Sub Leader
      made Member Audit empty/`-`; Save plus reload retained the selection.
- [x] Returning the selector to **Tidak ada Sub Leader** restored `B6B Smoke Auditor Member`; Save plus reload
      retained `NULL`. Server-side same-Team, non-Team-Leader Member validation remains authoritative.

### Follow-up consistency — FULL PASS

- [x] `follow_up_required=TRUE` with a repeatable follow-up row saved and survived reload. Changing
      `TRUE → FALSE` cleared UI rows immediately; Save and reload retained `FALSE`, while the database retained
      `follow_up_required=false` and `follow_up_items=[]`.
- [x] Server normalization and the database follow-up consistency constraint both passed.

### Draft generation and final browser refinements — FULL PASS

- [x] Generate Evaluasi used unique, trimmed, deterministic nonblank Finding references. QA-9907 included
      `9.2.2` and `Klausal IATF 7.2 - Kompetesi`; no Finding narrative was duplicated.
- [x] QA-9907 stored `nama_customer="-"`, `nama_produk="-"`, and `nama_line="-"`. The original generated
      prose incorrectly included `produk -` and `customer -`. The final refinement treats `NULL`, blank,
      whitespace, `-`, and `—` as absent only when generating prose and does not mutate those report fields.
- [x] Final browser recheck generated and saved:
      **“Telah dilakukan audit pada proses Rencana Bisnis dan Management Review. Berdasarkan hasil audit,
      ditemukan 0 ketidaksesuaian Major, 1 ketidaksesuaian Minor, dan 1 Peluang Improvement.”**
- [x] Final browser verification confirmed ineligible **Buat Laporan** buttons remain visible, clearly
      gray/muted, disabled, and accompanied by their blocker reason. Eligibility logic was unchanged.

### Final verified QA-9907 state

```text
status = Draft
revision_version = 9
nama_customer = "-"
nama_produk = "-"
nama_line = "-"
sub_leader_auditor_id = NULL
follow_up_required = false
follow_up_items = []
```

Hasil Pengamatan contains the corrected placeholder-free generated text above.

### Static, deployment, and PR status — PASS / MERGED

- [x] `npm run typecheck`, `npm run build`, changed-file ESLint, and `git diff --check` passed. No package
      files, nested `/project`, historical migrations, or post-application migration content changed.
- [x] Vercel reported **SUCCESS** on browser-tested implementation head
      `664b22eb10b7d7890565d1393ae10565df7370b9`.
- [x] QA-9907 completed final real-browser verification, including both final UI refinements, at that head.
- [x] PR #21, **Batch 8b1: Internal Audit Report foundation**, was squash-merged to `main` as `752d503e116186812201692d57aa77278088634b`.

### Deferred beyond Batch 8b1

- [ ] Batch 8b2: Final transition; pixel-perfect official `Q-120-ISE-001-FORM-015` print layout; final
      Finding-summary printed table; signature selections; approval workflow; report routing; Management
      Representative approval; and print/PDF.
- [ ] Batch 9: Weakness Analysis and subsequent Batch 9 scope.


## Batch 8b2a — Section-Scoped Internal Audit Report Foundation — 7–11 Sep 2026

**Status:** `VERIFIED_COMPLETE — MERGED` (implementation, immutable migration, Staging
security/runtime verification, Vercel deployment, static validation, and real-browser verification PASS.
PR #22 was squash-merged to `main` as `2141204d0e65d3c5be08b8b3dd5597d2f17dcdd9` after explicit user approval.)

### Authoritative architecture and migration — VERIFIED

- [x] One Instruction row / QA may own N reports, with at most one report per QA + Section. Every distinct
      `target` and `terkait` Section in `audit_instruction_rows.seksi_marks` is a report candidate, including
      Sections with zero Findings. The partial unique index on `(instruction_row_id, seksi_id)` where
      `seksi_id IS NOT NULL` enforces the scoped maximum.
- [x] Structured organizational ownership is `findings.seksi_auditee_id`; report ownership is
      `audit_internal_reports.seksi_id`. Both reference `seksi`. Free-text `location` and `auditee_area`
      remain occurrence/display information and are not Section authority keys.
- [x] Formal report counts and summaries include only `PUBLISHED` and `LEGACY_ESTABLISHED` Findings and
      exclude `ANNULLED`. Other review states remain pending: they do not count formally and block a
      clean-audit conclusion for their own Section. Any active Finding without `seksi_auditee_id` blocks
      report generators across that QA until its ownership is resolved.
- [x] Repository migration:
      `supabase/migrations/20260907150000_create_batch8b2a_section_scoped_reports.sql`.
      Final immutable SHA-256:
      `822c97450d069dce081c0163ebc584721dced8b9dead61650f6ae70bbbdf8b43`.
- [x] The first Staging apply attempt failed on an assertion that incorrectly expected authenticated Finding
      UPDATE to be revoked and rolled back atomically. Complete rollback was confirmed: neither new Section
      column nor a Batch 8b2a ledger entry remained. The assertion was aligned with the established Finding
      security envelope—authenticated UPDATE under RLS, Admin/Auditor UPDATE policies, and enabled mutation
      triggers—while direct INSERT/DELETE remain unavailable.
- [x] The corrected migration subsequently applied successfully to CertiTrack-Staging under ledger entry
      `20260908060655 · create_batch8b2a_section_scoped_reports`. It is now **APPLIED and IMMUTABLE**;
      every later database correction must use a new additive migration.
- [x] Trigger-safe normalization used the dedicated transaction-local
      `certitrack.finding_section_backfill` context, preserved Finding revisions, emitted no `PLOR_EDITED`
      event, accepted only NULL-to-valid-scope ownership, and retained CAR/scope/contradiction assertions.
      Completed-audit protection now also locks `seksi_auditee_id`.

### Backward compatibility — QA-9907 PASS

- [x] Batch 8b2a backfill succeeded for QA-9907. Its two established Findings remain valid and are owned by
      **Quality Assurance System**. The existing Batch 8b1 Draft report was scoped to that same Section,
      remained at revision `9`, and was neither copied nor duplicated; report-owned content was preserved.

### QA-0101 controlled fixture and Team repair

- [x] Smoke process **Rencana Bisnis dan Management Review** covers three Sections: **BOD & Management
      Representative** (`terkait`), **Quality Assurance System** (`target`), and **Quality Control**
      (`terkait`). Findings `QA-0101/SYS/2026/001` (B) and `QA-0101/SYS/2026/002` (C) both remain
      `DRAFT`, revision `2`, and are explicitly owned by **Quality Assurance System**.
- [x] Formal Level-2 semantics passed: BOD = `0/0/0 · Sesuai`; QAS = `0/0/0 · Pending 2 · Menunggu
      Finalisasi Temuan`; Quality Control = `0/0/0 · Sesuai`.
- [x] Team `B8B2A-QA0101` / **B8B2A QA-0101 Smoke Team**, Plan 2026, is Aktif + Locked. Team Leader is
      **B8B2A Smoke Auditor Lead** and Member is **B8B2A Smoke Auditor Member**.
- [x] QA-0101 had a pre-existing invalid Team state despite an existing Checklist. The user explicitly
      approved a controlled Staging-only repair; Checklist and Findings remained intact, and every temporarily
      bypassed `audit_team_masters` trigger was restored **ENABLED** afterward.
- [ ] Existing `validate_team_responsibilities()` / `trg_validate_team_header_responsibilities` behavior can
      fail during normal Team creation. This is unrelated to Batch 8b2a and must be addressed, if needed, in
      a separately scoped future change and new migration; the applied Batch 8b2a migration must not change.

### Section report browser verification — PASS

- [x] **BOD clean-audit report:** Draft revision `3`; Section-specific Manager, Team Leader, and optional
      Sub Leader displays passed. Selecting **B8B2A Smoke Auditor Member** as Sub Leader persisted after
      reload, and Member Audit displayed `-`, proving the selected Sub Leader was removed from remaining
      Members. `follow_up_required=false` and `follow_up_items=[]` persisted.
- [x] BOD clean Hasil persisted exactly as:
      **“Telah dilakukan Internal Audit pada proses Rencana Bisnis dan Management Review pada Seksi BOD &
      Management Representative. Berdasarkan hasil verifikasi, pelaksanaan proses Rencana Bisnis dan
      Management Review pada Seksi BOD & Management Representative telah sesuai dengan ketentuan yang berlaku.”**
- [x] BOD clean Evaluasi persisted exactly as:
      **“Pelaksanaan pada Seksi BOD & Management Representative telah memenuhi persyaratan yang diperiksa.
      Pertahankan penerapan dan pemantauan yang sudah berjalan.”**
- [x] **QAS pending-Finding report:** Draft revision `1`; formal Major/Minor/Peluang Improvement remained
      `0/0/0`, Pending displayed `2`, and **“Masih terdapat Temuan yang belum selesai direview.”** appeared.
      Both Generate Draft buttons were disabled; database Hasil and Evaluasi remained empty. This proves
      pending Findings do not count formally and prevent a false clean-audit conclusion.
- [x] **Quality Control zero-Finding report:** Draft revision `2`; established `0`, pending `0`, Sub Leader
      `NULL`, `follow_up_required=false`, and `follow_up_items=[]`. Both clean generators passed and persisted.
      Its free-text Catatan fixture was deliberately left unchanged.
- [x] Quality Control Hasil persisted exactly as:
      **“Telah dilakukan Internal Audit pada proses Rencana Bisnis dan Management Review pada Seksi Quality
      Control. Berdasarkan hasil verifikasi, pelaksanaan proses Rencana Bisnis dan Management Review pada
      Seksi Quality Control telah sesuai dengan ketentuan yang berlaku.”**
- [x] Quality Control Evaluasi persisted exactly as:
      **“Pelaksanaan pada Seksi Quality Control telah memenuhi persyaratan yang diperiksa. Pertahankan
      penerapan dan pemantauan yang sudah berjalan.”**
- [x] Duplicate creation for QA-0101 + Quality Control was rejected with **“Laporan Internal Audit untuk No.
      Audit dan Seksi ini sudah ada.”** Exactly one Quality Control report remained at revision `2`.

### Static, deployment, PR, and deferred scope

- [x] `npm run typecheck`, `npm run build`, targeted changed-file ESLint, and `git diff --check` passed.
- [x] Vercel reported **SUCCESS** for authoritative implementation head
      `a4ccd487566588a698116a4e3f093350045547d0`.
- [x] Staging migration/security/runtime and the BOD, QAS pending-Finding, Quality Control zero-Finding,
      Sub Leader, follow-up, clean-generator, and duplicate-scope browser checks passed.
- [x] PR #22, **Batch 8b2a: Section-scoped Internal Audit Reports**, was squash-merged to `main` as `2141204d0e65d3c5be08b8b3dd5597d2f17dcdd9` after explicit user approval.
- [ ] Final transition, official `Q-120-ISE-001-FORM-015` layout, final printed Finding-summary table,
      signatures, approval workflow, report routing, Management Representative approval, and PDF/print remain
      deferred to the later Batch 8b2 scope.

## Batch 8b2 — Internal Audit Report Finalization & Official Layout

**Status:** `NOT_STARTED`

Final transition, signature/approval workflow, official form layout, final finding-summary table, and
print/PDF remain deferred to the separately controlled Batch 8b2 scope.

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

The stabilization database foundation and audit-execution batches through Batch 8b2a have completed their
applicable verification gates. PR #22 is squash-merged as current `main`
`2141204d0e65d3c5be08b8b3dd5597d2f17dcdd9`. Batch 8b2a is `VERIFIED_COMPLETE — MERGED`;
the next deferred controlled slice is Batch 8b2 — Internal Audit Report Finalization & Official Layout.

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
Batch 7e    VERIFIED_COMPLETE — MERGED (Auditor verification; PR #16)
Batch 7f    VERIFIED_COMPLETE — MERGED (Admin/QMS final decision; PR #17)
Batch 7g    VERIFIED_COMPLETE — MERGED (Finding/LTP final synchronization; PR #18)
Batch 7h    VERIFIED_COMPLETE — MERGED (multi-action evidence; PR #19; squash merge
            8ba3a432ead18aca49737e33318a37532b7a5b3b)
PR #14      VERIFIED_COMPLETE — MERGED (Admin user management + annual Auditor access;
            squash merge 5727f32acac35f4e973b799bf1b7aa590181bf46)
Batch 8a    VERIFIED_COMPLETE — MERGED (PR #20; approved head 553f50a54a4429d174dc1ef700e643e08b06d918;
            squash merge 109250c3f2554bc1de2ad4ee8b671bf07a6775cf)
Batch 8b1   VERIFIED_COMPLETE — MERGED (PR #21; squash merge 752d503e116186812201692d57aa77278088634b)
Batch 8b2a  VERIFIED_COMPLETE — MERGED (PR #22; squash merge 2141204d0e65d3c5be08b8b3dd5597d2f17dcdd9)
Batch 8b2   IMPLEMENTED_UNVERIFIED
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

---

## Batch 8b2 — Internal Audit Report Finalization & Official FORM-015 — 11 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED` (base `956e77519f12be300ecb92def1ac181bc2572544`; Staging migration/runtime and real-browser A4 print smoke remain required.)

### Implementation

- [x] Added the single additive migration `supabase/migrations/20260911120000_finalize_batch8b2_internal_audit_reports.sql` (SHA-256 `566a930ed44bbeb51255dc91bfb50d2022ee4e49b92b681eaf3452ece1ff8c44`). Historical Batch 8b1 and Batch 8b2a migrations remain unchanged.
- [x] The database-authoritative `finalize_internal_audit_report(report_id, expected_revision)` RPC authenticates an Admin, locks the report `FOR UPDATE`, accepts only Draft at the expected revision, and atomically transitions that same row to `Final`, records `finalized_at`, snapshots the authoritative scoped Manager name when available, and increments the revision exactly once.
- [x] Finalization rejects a missing/out-of-scope Section, active unassigned QA Finding, pending scoped Finding, blank Hasil Pengamatan, blank Evaluasi, unspecified follow-up decision, inconsistent empty/nonempty follow-up data, incomplete follow-up Section/context, implementing Section or schedule, and a missing/invalid Leader signatory when the Team source exists. Formal Findings remain only `PUBLISHED` / `LEGACY_ESTABLISHED`; `ANNULLED` is excluded.
- [x] Final report-owned fields are immutable through the existing/new Draft save guards. Final reports open directly in the read-only document view and expose no Generate, edit, Save Draft, or Final action. Draft finalization is disabled until current edits have been saved, preserving optimistic revision semantics.
- [x] Added report-owned historical signatory fields only for selected Team Leader/Sub Leader identity and the scoped Manager-name snapshot. The Leader selector is restricted in both UI and database to the Team Leader or selected same-Team Sub Leader. The Manager is derived only from `report.seksi_id`. No repository evidence establishes an authoritative Management Representative identity: its official box remains `-`, and no employee master or inferred QMS equivalence was invented.
- [x] Added a dedicated responsive/A4 `InternalAuditReportPrintView` and print stylesheet for the FORM-015 title/header, audit context, Auditee/Product context, Team, persisted Hasil/Evaluasi, formal Section-scoped Finding summary, follow-up, Catatan/signatures, route diagram, and highlighted Dokumen lainnya section. The finding preview/print consumes the existing `groupInternalAuditReportFindings()` result, preserves zero-Finding reports, and excludes pending/annulled Findings through the existing service semantics.
- [x] Follow-up Draft controls now edit all three required values (`seksi`, `seksi_pelaksana_follow_up`, and `jadwal_follow_up`) and the print view renders every persisted item with Indonesian dates. Checklist marks in Dokumen lainnya are computed from actual System, Manufacturing/Shift, and Product checklist presence.
- [x] Draft reports provide a clearly watermarked FORM-015 preview; Final reports provide the clean persisted view. `Cetak / Simpan PDF` uses `window.print()` with `@page A4 portrait`, application chrome suppression, internal document margins, repeating Finding table headers, and break-safe formal sections without a PDF dependency.
- [x] PR #24 review corrections preserve authenticated access to the established 13-argument Draft-save RPC during staged rollout; make explicit Muat Ulang replace local report/form state with the authoritative revision after a stale-write conflict; restore Level-1 eligibility explanations; clear a signer when switching to a different Sub Leader; keep live scoped Manager context separate from the final signature snapshot; validate follow-up schedules as ISO dates; reset application content wrappers for print; and allow the Finding table (but not its rows) to split with repeated headers. The migration remains unapplied to Staging.

### Verification remaining

- [x] Static verification: `npm run typecheck`, changed-file ESLint, `npm run build`, and `git diff --check` passed locally (build advisories, if any, are recorded in the PR report).
- [ ] Apply and exercise the new migration/RPC on Staging, including every blocker and stale-revision rollback.
- [ ] Complete real-browser Draft/Final/read-only and A4 Portrait 100% print/Save-as-PDF smoke against representative zero-, one-, and multi-page Finding reports.

Batch 8b2 is no longer `NOT_STARTED`; only the Staging/runtime and browser/print verification above prevents `VERIFIED_COMPLETE`.

---

## Batch 9a — Weakness Analysis and AI-assisted classification — 14 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED` (base `c3028cbf086708231bb13fa645cbcc1c919a343a`).

### Implemented repository scope

- Added the single additive migration `supabase/migrations/20260914120000_create_batch9a_weakness_analysis.sql`
  (corrected pre-application SHA-256 `57eee2d2c124ad9fc82600a445bebda4218b29f8ef44dce3b8441a144c58220d`; the former hash is obsolete). It adds normalized report, persisted population, reusable
  approved LTP classification, append-only AI suggestion, systemic Why 1–4, and multi-action tables.
- Batch 9a database access is exactly `public.is_admin_identity() OR
  public.current_auditor_is_lead_auditor()` through `can_manage_weakness_analysis()`. RLS limits reads to
  that capability, authenticated table mutation is revoked, and guarded RPCs re-check authorization.
  Ordinary Auditors, Team Master leaders without company capability, Sub Leaders, Auditees, Section
  Managers, and inactive identities receive no Batch 9a authority from team membership.
- Added guarded create/populate, classification approval, optimistic Draft save, and atomic Finalize RPCs.
  Finalization locks the report, checks expected revision and Draft state, validates population/current
  Finding-LTP relations, requires every LTP Closed and every taxonomy approved, requires a conclusion,
  validates any existing Why/Action structures, snapshots approved classifications/signatory display
  values, and increments the revision once. Final report-owned content and population are immutable.
- Enabled the capability-aware `analisa` route/sidebar without granting every AUDITOR. Added list/create,
  four-tab workspace, manual/AI Accepted/AI Edited classification, bounded-concurrency AI actions, five
  deterministic chart views, robust IATF clause parsing, deterministic conclusion helper, systemic Why
  and multiple Actions, blocker display, and Draft/Final controls.
- Added dedicated A3 Landscape FORM-010 preview/print rendering with `DRAFT / PREVIEW` watermark only for
  Draft, controlled document code `Q-120-ISE-001-FORM-010-REV.0`, sections A/B/C, break-safe rows, and
  browser print. Native deterministic 2D bars were used because the requested Chart.js packages could not
  be fetched in this environment (registry returned HTTP 403); no dependency/lockfile change was committed.
- Added `supabase/functions/weakness-ai-classify/index.ts`. It authenticates the caller, resolves the
  database capability rather than trusting browser flags, fetches authoritative text context server-side,
  defends against prompt injection, calls the OpenAI Responses API with strict JSON Schema, hashes normalized
  inputs for compatible-result reuse, and appends model/prompt/hash/result/token/request metadata. It reads
  only server secrets `OPENAI_API_KEY`, optionally `OPENAI_MODEL_FAST` (default `gpt-5.6-luna`),
  `OPENAI_MODEL_DEEP` (default `gpt-5.6-terra`), and `OPENAI_PROMPT_VERSION` (default `batch9a-v1`).
  No OpenAI secret is stored in the repository or a `VITE_*` variable.
- Prepared the required Staging authorization/finalization/AI runtime matrix in
  `docs/batch-9a-authorization-matrix.md`.

### Known limitations and verification remaining

- The migration is intentionally unapplied and the Edge Function intentionally undeployed. Staging schema,
  constraints, RLS, the full authorization matrix, transactional blockers/stale revision, manual/AI Accepted/
  AI Edited flows, real OpenAI request, and browser A3 pagination/no-watermark behavior remain unverified.
- The correction pass replaced the invalid `audit_programs.nama_program` query with the established
  `jenis_ronde`, `nomor_ke`, `tahun`, `status`, and `penanggung_jawab_qms` DTO and a TypeScript label such as
  `Berkala ke-1 · FY2026`. Program reports no longer display a raw UUID.
- Team Leader candidates now resolve uniquely through persisted report Finding → Instruction row → Team
  Master member `is_team_leader` → Auditor. PJ QMS candidates resolve from Programs represented by persisted
  population. Draft-save and Finalize validate both candidate sets in the database; zero candidates normalize
  to NULL, one auto-selects in the UI, and multiple candidates use restricted selectors.
- Classification approval is scoped by a Draft report-item ID. The database validates an optional suggestion
  against that report/canonical LTP and derives `MANUAL`, `AI_ACCEPTED`, or `AI_EDITED`; client-supplied
  provenance was removed. Finding `seksi_auditee_id` now resolves to `seksi.nama` for UI and AI context.
- FORM-010 screen and print share deterministic chart components: Process-stacked Major/Minor/OFI with totals,
  SVG donut distributions for clause/DIS/4M+1E, and an A–E bar chart with legend. Why rows persist only 1–4
  nonblank contiguous levels, allowing unused trailing Why columns.
- OpenAI documentation lookup was unavailable from the environment (documentation tooling/web access returned
  authorization failure); the Responses API payload therefore requires deployment smoke verification.
- Batch 9b was not implemented. Historical migrations and nested `/project` were not changed.

## Batch 9a — FORM-010 ECharts presentation pass — 15 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`. Continues PR #27 from remote head
`fa9cfa688935e7efbd2bc452e152708fbfaf8d06`; Batch 9a is not `VERIFIED_COMPLETE`.

- Migrated all five shared FORM-010 chart views to installed Apache ECharts **6.1.0**,
  using modular BarChart, PieChart, GridComponent, LegendComponent, and SVGRenderer registration.
  Every chart uses **SVG**, with animation disabled; no extra dependency or lockfile update.
- Added a reusable wrapper with positive-size initialization, option updates, ResizeObserver,
  immediate beforeprint and print-media resize, deferred follow-up resize, afterprint recovery,
  and complete listener/observer/instance cleanup for hidden layouts and React StrictMode.
- Chart #1 is a vertical stacked column: OFI blue / Minor orange / Major red, bottom to top,
  integer count axis, every Process label at 45 degrees, positive segment labels, and retained HTML totals.
- Charts #2–#4 now use restrained full **2D pies**, replacing faux-3D donuts. Printed HTML legends
  beside each pie include category, authoritative count, and rounded percentage, including single slices.
- Chart #5 remains vertical A–E columns with integer labels, zero categories retained when populated,
  and the existing explanatory taxonomy below. Empty charts show plain contextual text without shapes.
- Order remains **1 / (2,3) / (5,4)**. `buildWeaknessCharts`, clause grouping, approved-only classification
  inputs for Charts #3–#5, Finding/LTP, AI, authorization, and finalization semantics are unchanged.
- Improved A3 full-height composition using a flex page/main section, proportional chart grid rows,
  and proportionally stretched Why-Why/Action sections. Preserved the safe **419mm × 296mm** minimum
  sheet footprint, conclusion/footer order, approval design, and Draft-only watermark. Sparse one-page
  pagination, clipping, and populated overflow still require real-browser acceptance.
- The circular overlay was confirmed externally as the **Vercel Toolbar**, resolved by disabling that
  Toolbar. No application/CSS workaround was added. **QR approval remains deferred**; Batch 9b excluded.
- Files changed: `src/components/pages/WeaknessCharts.tsx`, new
  `src/components/pages/WeaknessEChart.tsx`, `src/components/pages/weaknessCharts.css`,
  `src/components/pages/weaknessAnalysisPrint.css`, and `PROJECT_STATUS.md`.
  `WeaknessAnalysisPrintView.tsx` is unchanged and included in targeted lint.
- Validation: typecheck, production build, targeted ESLint, and `git diff --check` passed.
  Build retains non-blocking >500 kB chunk and outdated Browserslist advisories; no application-wide
  chunking or dependency updates. No migration, Edge Function, package manifest/lockfile, or nested
  `/project` changes against the supplied head.
- Required manual gates: browser visual review, one-page sparse A3 Landscape Print Preview,
  Save as PDF, Draft watermark, Final no-watermark, and populated/overflow report testing.

## Batch 9a — FORM-010 beveled pie refinement — 15 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`; browser acceptance remains required. Base:
`0e91ac5c84f2f20ad20661257986b0a956792964`, existing PR #27.

- Charts #2–#4 now use a print-oriented pseudo-3D / beveled donut treatment instead of flat pies:
  one ECharts pie series, thick centered annulus, restrained palette-matched SVG linear gradients,
  narrow top highlight, darker lower edge, thin white slice borders, and slightly rounded corners.
  No duplicate stacked pies, perspective distortion, raster layer, blur filter, or new modules.
- Single-category datasets retain the same centered 36%/78% inner/outer radius and bevel,
  avoiding an oversized solid circle. Count/percentage legends remain the primary explanation.
  Plain text empty states and existing legend/data ordering are unchanged.
- Apache ECharts **6.1.0**, **SVGRenderer**, `animation: false`, print resize handling, and exact
  print-color CSS remain in use. Charts #1/#5, card sizes, A3 page structure, chart order
  **1 / (2,3) / (5,4)**, approval structure, and watermark behavior are unchanged.
- No aggregation/business logic, approved classification sourcing, dependency, DB, migration,
  Edge Function, AI, auth, Finding/LTP workflow, or finalization changes. QR approval remains
  deferred. No Vercel Toolbar workaround. Nested `/project` is untouched.
- Files changed: `src/components/pages/WeaknessCharts.tsx` and `PROJECT_STATUS.md` only.
- Validation: `npm run typecheck`, `npm run build`, targeted ESLint for `WeaknessCharts.tsx`,
  and `git diff --check` passed. Backend/package baseline diff is empty. Build retains the
  non-blocking >500 kB chunk and outdated Browserslist advisories.
- Required manual gates: browser visual review (including one-slice/multi-slice bevel acceptance),
  sparse one-page A3 Print Preview, Save as PDF, Draft watermark, Final no-watermark,
  and populated/overflow report testing. No browser/PDF acceptance is claimed by this pass.

## Batch 9a — FORM-010 Pareto and audit-context presentation — 16 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`; existing PR #27 remains open/unmerged. Base:
`28884e08ea3e6276bc5043ec338a02edbeb4bfcc`. Browser acceptance is still required.

- Chart #1 is now a Pareto chart: a copied presentation array sorts processes descending by
  Major + Minor + OFI; original blue OFI / orange Minor / red Major stacked columns, numeric
  labels, and compact totals remain. A green cumulative percentage line uses a secondary right
  axis fixed at 0–100%; the last populated point is 100%. No 80% or other reference line was added.
- Added only modular LineChart registration. Installed Apache ECharts remains **6.1.0**, with
  **SVGRenderer** and `animation: false`. Charts #2–#4 retain their pseudo-3D / beveled SVG gradients;
  Chart #5 and order **1 / (2,3) / (5,4)** are unchanged. Aggregation/counting semantics are unchanged.
- The formal title is now a full-header-width centered 14pt/700 h1 (previously inherited 9pt bold),
  with no title wrapping. Context and approval table remain beneath it in the header. The A3
  landscape 419mm × 296mm minimum sheet, flexible chart area, plain text empty states, and
  Draft-only watermark are retained; browser pagination is not claimed as verified.
- Fixed the hidden screen preview (`display:none` previously applied outside print): the existing
  Preview FORM-010 tab now shows a horizontally scrollable sheet, with overflow reset for print.
- Reviewed `analisa` routing/sidebar, list/create/load services, Findings source types, and existing
  population RPC read-only. No System-only route/query filter exists. Each report ID owns its
  persisted population, Why/Actions and conclusion; the existing program/date-range scope is retained.
  Replaced the hard-coded “A. Hasil Audit Sistem” with headings derived from persisted Findings:
  **Audit Sistem**, **Audit Proses Manufaktur** (including Shift), and **Audit Produk**. All three
  use the same FORM-010 preview/print structure. The report's own title is also displayed as context.
- Scope limitation: programs/date ranges can contain more than one audit type, and the current
  report schema/RPC has no persisted audit-type selector. Existing mixed populations are labeled
  with their actual types, never silently filtered or newly merged. Separate reports for existing
  single-type program/date contexts are supported. Strict separate type-specific persisted reports
  inside a mixed program would require a separately authorized model/RPC change; this pass does
  not claim to provide that capability. Empty populations use the neutral “Internal Audit” heading.
- No DB/schema/migration/RPC/RLS, AI classification/cache/provenance/ZDR, auth, Edge Function,
  Finding/LTP workflow, package, or nested `/project` changes. No service change was necessary.
  QR approval remains deferred; Batch 9b excluded; no Vercel Toolbar workaround.
- Files changed: `src/components/pages/WeaknessCharts.tsx`,
  `src/components/pages/WeaknessEChart.tsx`, `src/components/pages/WeaknessAnalysisPrintView.tsx`,
  `src/components/pages/weaknessAnalysisPrint.css`, and `PROJECT_STATUS.md`.
- Validation: typecheck, build, requested four-file ESLint (including unchanged
  `src/services/weaknessAnalysisService.ts`), and `git diff --check` passed. An in-memory component
  check passed descending ordering, cumulative 62.5/87.5/100%, right axis, input nonmutation,
  absence of markLine, empty text, and all three audit-type headings with Draft/Final watermark
  markup. These are not browser/SVG layout acceptance tests. Build retains non-blocking outdated
  Browserslist and >500 kB chunk advisories. Backend/package baseline diff is empty; nested
  `/project` remains untouched.
- Remaining manual gates: browser visual review; sparse one-page A3 Landscape Print Preview;
  Save as PDF; Draft watermark; Final no-watermark; populated/overflow reports for **each** of
  Audit Sistem, Audit Proses Manufaktur, and Audit Produk.

## Batch 9a — Explicit audit family and authoritative execution dates — 16 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`. Continues PR #27 from
`77f1efbdff4926487df0cece7d3970777a5befe1`. Implementation and the Staging SQL matrix passed; real-browser acceptance remains pending.

- Supersedes the prior program-only scope limitation: new reports explicitly persist one of
  `ChecklistSistem`, `ChecklistManufakturShift`, or `ChecklistProduk`. Existing legacy reports
  retain NULL type and their original populations and are presented read-only.
- New additive migration: `supabase/migrations/20260916021204_scope_form010_audit_type_dates.sql`.
  Adds audit_type, audit_execution_dates (normalized distinct sorted date[]), audit_date_start,
  audit_date_end, typed Program uniqueness, and checklist-context population/signatory/Final rules.
- System and Manufacturing dates come only from represented Instruction execution dates. Product
  uses tanggal_audit_produk first, falling back only to that same row's tanggal_pelaksanaan_audit.
  Date-range scope uses these same family-specific dates. Final snapshots never refresh from live dates.
- Zero-Finding Draft requires actual checklist context; Final additionally requires every represented
  row's authoritative cek_selesai and exact current population validation. No LTP/classification/AI
  is fabricated. Empty analysis content uses '-', while real metadata is retained.
- Frontend creation requires audit type; list/workspace expose type and dates; the FORM-010 header
  reads report identity/snapshot directly. Exact-date formatting groups only contiguous dates.
- Pareto #1, no reference line, beveled #2–#4, vertical #5, SVGRenderer, ECharts 6.1.0, centered 14pt
  title, A3 sheet structure and watermark behavior remain. QR approval is deferred. The external
  ZDR production gate is unchanged. Browser/Print Preview/PDF acceptance is still required.
- Static checks so far: typecheck and all changed TS/TSX-file ESLint passed. Migration SHA256,
  actual Staging ledger entry, full test matrix, final static/build results and file list follow below.


### Audit-family correction — applied migration and verification closeout

- Exactly one new additive migration was applied successfully to **CertiTrack-Staging**
  (`wlsmqufirefmscjwaoka`): `20260916021204_scope_form010_audit_type_dates.sql`.
  Repository SHA256: `4d857f3592210af972d303c1b1da34475edcd9f9917a4481738b46e5f864d631`.
  Actual Staging ledger: **20260916023952 · scope_form010_audit_type_dates**.
  The file is immutable after this application. Both earlier applied migration files remain
  byte-for-byte unchanged from `77f1efbdff4926487df0cece7d3970777a5befe1`.
- Four nullable columns were added to `weakness_analysis_reports`: `audit_type text`,
  `audit_date_start date`, `audit_date_end date`, `audit_execution_dates date[]`.
  Type CHECK accepts only `ChecklistSistem`, `ChecklistManufakturShift`, `ChecklistProduk` when
  non-null. Typed rows require normalized, distinct, sorted, non-null date arrays (empty array
  permitted when dates are unavailable), with start/end matching the first/last dates.
  Partial unique index `weakness_program_audit_type_unique` prevents another typed Draft/Final
  for the same Program. Legacy NULL rows are excluded; no archive/reissue lifecycle was invented.
- `create_weakness_analysis` requires explicit `p_audit_type`, validates scope and real checklist
  context, and atomically inserts/populates/snapshots the report. Its old five-argument signature
  now safely rejects stale clients. `populate_weakness_report` uses only formal
  PUBLISHED/LEGACY_ESTABLISHED Findings of that family and the canonical `cars.finding_id` link.
  The helper resolves checklists / checklist_manufaktur_shift / checklist_produk through row_id,
  never through the presence of Findings. Date-range scoping uses the same authoritative date.
- `weakness_team_leader_candidates` derives the Team Master leaders of the exact represented
  checklist rows, including zero-Finding rows. PJ QMS remains Program-authoritative, with
  date-range candidates derived from represented Programs. The company management capability
  remains exactly `is_admin_identity() OR current_auditor_is_lead_auditor()`; no RLS was changed.
- Draft assertions lock and recheck report state and reject legacy edits. Save retains revision,
  signatory and Why/Action validation; empty reports save '-' and no systemic children. Final
  retains all non-zero CLOSED-LTP/classification/structural blockers, validates exact population
  membership (including omitted Findings and missing canonical LTPs), rejects changed dates until
  explicit regeneration, and requires all exact audit-context rows completed for zero Findings.
  Classification provenance is unchanged; the approval RPC adds only the locked Draft assertion.
- Legacy report `31f59999-8a79-4b60-90aa-91bb586404ab` and the other legacy Draft were preserved.
  Before/after legacy-column and population hashes match. Protected fixture hashes:
  report `407fb4ff830224af9b65766813c63ef5`, population `41959f6003f01e6a35b3b81f3d1cb711`.
  The UI labels legacy reports read-only instead of guessing a family or rewriting their items.
- `tests/form010-audit-type-staging.sql`: **32 grouped Staging checks PASS** in a rolled-back
  transaction with newly generated synthetic programs, teams, checklist contexts and Findings.
  Seeded prerequisite workflow states are synthetic; this is a FORM-010 RPC/constraint test, not
  a repeat of the complete Finding/LTP workflow. Execution completion for zero-Finding rows used
  the existing guarded `complete_audit_execution` RPC with triggers enabled.
  The same-Program scenario uses synthetic FY2097 metadata and the exact requested September
  2026 execution dates; no old mixed FY2099 fixture supplies the test population.

| Staging verification | Result |
| --- | --- |
| System with Findings: create, manual approval, save, Final | PASS |
| System zero Findings: incomplete blocker, completion RPC, Final | PASS |
| Manufacturing with Findings: isolated population, save, Final | PASS |
| Manufacturing zero Findings: incomplete blocker, completion RPC, Final | PASS |
| Product with Findings: dedicated dates, isolated population, save, Final | PASS |
| Product zero Findings: incomplete blocker, completion RPC, Final | PASS |
| Same Program: System 7–11 Sep / Manufacturing 9–10 Sep / Product 11 Sep | PASS |
| Manufacturing non-contiguous exact snapshot [9 Sep, 11 Sep] | PASS |
| Product DATE_RANGE primary date; same-row fallback; generic-date exclusion | PASS |
| All six cross-family exclusions and injected cross-family Final rejection | PASS |
| Missing audit context: create and Final rejected | PASS |
| Non-CLOSED LTP, unapproved classification, stale revision blockers | PASS |
| Omitted population cannot masquerade as zero | PASS |
| Draft date drift blocks Final; explicit regeneration refreshes dates | PASS |
| Type-specific Team Leader candidates; arbitrary signer rejection | PASS |
| Duplicate Program + type; authenticated direct mutation denied | PASS |
| Final report/type/dates/signatory, population, Why/levels/Actions immutable | PASS |
| Later upstream date changes and later Draft classification approval preserve Final snapshots | PASS |
| Legacy regenerate/Final rejected without mutation | PASS |
| Admin / Company Lead accepted; ordinary Auditor and inactive Company Lead denied | PASS |

- Post-test cleanup queries returned zero synthetic profiles, auditors and typed test reports.
  All five Weakness tables retain RLS, internal helpers are not executable by authenticated users,
  and the new create RPC is not executable by anon. Security Advisor reports the intentional
  guarded authenticated SECURITY DEFINER RPC category (50 functions across the application),
  plus disabled leaked-password protection; no policy or Auth configuration was changed.
  References: [guarded function exposure advisory](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
  and [password-protection advisory](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- `tests/form010-presentation.cjs` passed nine exact-date cases, all three families with both
  Draft/Final and empty/populated markup, '-' result content, real metadata, chart order,
  Pareto 100%/no reference line, beveled SVG-option geometry and A–E bars. Runs in UTC/default,
  Asia/Jakarta and America/Los_Angeles passed. A timezone test caught and corrected only the
  FORM-010 approval-date call site to parse its date-only value locally before formatting.
- Final static validation: typecheck, production build, targeted ESLint for all six changed
  TS/TSX files, and `git diff --check` passed. Build retains the existing outdated Browserslist
  and >500 kB chunk advisories. No new dependency, package/lockfile, Edge Function, historical
  migration, Instruksi UI, or nested `/project` change. WeaknessEChart.tsx and both chart/print
  stylesheets remain unchanged in this pass; ECharts 6.1.0 and SVGRenderer remain in use.
- Changed files: `src/lib/enums.ts`, `src/lib/utils.ts`,
  `src/services/weaknessAnalysisService.ts`, `src/components/pages/WeaknessAnalysisPage.tsx`,
  `src/components/pages/WeaknessAnalysisPrintView.tsx`, `src/components/pages/WeaknessCharts.tsx`,
  the one new migration above, `tests/form010-audit-type-staging.sql`,
  `tests/form010-presentation.cjs`, and `PROJECT_STATUS.md`.
- Remaining acceptance: real browser visual review and access/create/save flows for all three
  types; sparse one-page A3 Landscape Print Preview; Save as PDF; Draft watermark; Final
  no-watermark; populated/overflow report tests for each type. SQL/markup tests do not establish
  browser pagination. Batch 9a remains **IMPLEMENTED_UNVERIFIED**, PR #27 open/unmerged.
  QR approval remains deferred; external production ZDR eligibility/approval remains a gate
  and is not established by this correction. AI/privacy/Edge Function behavior is unchanged.

## Batch 9a — Why-Why and action auto-growing editors — 16 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`. Continues open/unmerged PR #27 from authoritative remote head
`0b55d35afa498083d44c85dacc2d1c132eeb959c`; browser/PDF visual acceptance remains pending.

- Added a controlled reusable `AutoGrowTextarea` that starts at one row, resets its height to auto,
  then measures `scrollHeight` whenever its value changes. It grows downward for added content and
  shrinks after deletion without a fixed maximum height. Width remains constrained to its grid cell,
  both overflow axes are hidden, and long unbroken text wraps with `overflow-wrap: anywhere` plus
  `word-break: break-word`. Disabled/read-only behavior continues through native textarea props.
- Converted only the narrative Weakness fields: Problem, Why 1–4, Akar Permasalahan, and Rencana
  Tindakan. PIC, Due Date, and Status remain their existing single-line Input/date Input/Select.
  Why and Action grids now align controls at the top as narrative rows grow.
- Why/Action state, persistence payloads, Draft/Final behavior, contiguous Why validation, maximum
  Why depth 4, and existing add/remove handlers are unchanged. Tab switching still retains the same
  workspace state, and Final mode renders the full controlled text in disabled auto-growing editors.
- FORM-010 Why and Action body cells now explicitly use `white-space: pre-wrap`,
  `overflow-wrap: anywhere`, `word-break: break-word`, and top alignment. The fixed table layout and
  existing 419mm × 296mm A3 page definition remain unchanged; rows may grow vertically to preserve
  all narrative text.
- Files changed: `src/components/pages/WeaknessAnalysisPage.tsx`,
  `src/components/pages/weaknessAnalysisPrint.css`, `src/components/ui/Field.tsx`, and
  `PROJECT_STATUS.md`.
- Static validation passed: `npm run typecheck`, `npm run build`, targeted ESLint for both changed
  TS/TSX files, and `git diff --check`. Build retained only the existing outdated Browserslist and
  >500 kB chunk advisories. Backend, migrations, Edge Functions, packages/lockfile, and nested
  `/project` are untouched.

## Batch 9a — FORM-010 intrinsic narrative row sizing — 16 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`. Continues open/unmerged PR #27 from authoritative remote head
`3210dafacbb7fcbd88ab86a70c52967f0226ce2a`; real-browser Preview/Print acceptance remains pending.

- Corrected the FORM-010 Why-Why and Action tables so they retain intrinsic height instead of growing
  to consume the full grid-section allocation. Surplus section height now remains section whitespace
  rather than being distributed into populated narrative rows.
- Populated rows remain content-driven with the existing compact 3px cell padding, top alignment,
  `white-space: pre-wrap`, `overflow-wrap: anywhere`, and `word-break: break-word`. Long narrative text
  can still wrap and grow vertically without clipping, fixed heights, or overflow suppression.
- Existing blank template rows retain their controlled `12mm` Why and `11mm` Action heights. The
  419mm × 296mm A3 landscape page, charts, header, approval table, conclusion, watermark, and screen
  `AutoGrowTextarea` implementation are unchanged.
- Files changed: `src/components/pages/weaknessAnalysisPrint.css` and `PROJECT_STATUS.md`. No TS/TSX,
  backend, migration, Edge Function, package/lockfile, or nested `/project` file changed.
- Static validation passed: `npm run typecheck`, `npm run build`, the existing
  `tests/form010-presentation.cjs` regression check, and `git diff --check`. Build retained only the
  existing outdated Browserslist and >500 kB chunk advisories. Targeted ESLint was not applicable
  because no TS/TSX file changed.

## Batch 9a — FORM-010 A3 chart and blank-row balance — 16 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`. Continues open/unmerged PR #27 from authoritative remote head
`027b0bcfaf47a36aa6ac0adadd5e78a0e85162ad`; authoritative Chrome Print Preview acceptance remains pending.

- Reduced only the FORM-010 Preview/Print chart-grid minimums from `65/55/55mm` to
  `56/45/45mm`, retaining flexible proportions at `1.15fr/1fr/1fr`. The normal Analysis-tab chart
  grid remains unchanged at `280/230/230px`; chart components, ECharts SVG rendering, Pareto data,
  cumulative axis, beveled donuts, vertical taxonomy, legends, and aggregation logic are unchanged.
- Balanced the right column at approximately 60% Why-Why and 40% Actions. Each section now has an
  intrinsic data table containing content-driven populated rows and the existing controlled minimum
  blank rows, followed by one border-aligned flexible filler table row. Only that empty filler absorbs
  available section height; populated narrative rows remain `height:auto` and cannot receive flex growth.
- Existing minimum template behavior remains four total Why rows and three total Action rows before
  the dedicated filler. Blank Why rows retain `12mm`; blank Action rows retain `11mm`. Zero-Finding
  content continues to render `-` without creating fake Why or Action data.
- Narrative wrapping remains `white-space: pre-wrap`, `overflow-wrap: anywhere`,
  `word-break: break-word`, and top-aligned, with no clipping or maximum height. A3 remains landscape
  at the safe `419mm × 296mm` footprint; conclusion, footer, watermark, header, and approval structure
  are unchanged. Genuinely excessive content may still continue naturally rather than being hidden.
- Files changed: `src/components/pages/WeaknessAnalysisPrintView.tsx`,
  `src/components/pages/weaknessAnalysisPrint.css`, `src/components/pages/weaknessCharts.css`,
  `tests/form010-presentation.cjs`, and `PROJECT_STATUS.md`. No backend, migration, Edge Function,
  package/lockfile, or nested `/project` file changed.
- Static validation passed: `npm run typecheck`, `npm run build`, targeted ESLint for
  `WeaknessAnalysisPrintView.tsx`, the extended `tests/form010-presentation.cjs`, and
  `git diff --check`. Build retained only the existing outdated Browserslist and >500 kB chunk
  advisories. The automated regression verifies markup and CSS invariants, not Chrome pagination;
  authoritative one-page A3 Print Preview and sparse zero-Finding visual acceptance remain required.

## Batch 9a — FORM-010 equal blank rows and bounded print charts — 16 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`. Continues open/unmerged PR #27 from authoritative remote head
`f205da73ddc50626ce5d74f0bd3aa93b60564e21`; authoritative Chrome Print Preview acceptance remains pending.

- Removed the one-row flexible filler table introduced by the prior presentation pass. Why-Why and
  Action now keep an intrinsic table for headers and actual data only, followed by a CSS Grid template
  area whose existing minimum blank rows divide all remaining section height equally. Matching
  seven-column Why and six-column Action grids preserve the table border/column structure.
- The minimum remains four total visible Why rows and three total visible Action rows: one real Why
  produces three equal blank tracks, while one real Action produces two. Each blank track uses
  `minmax(8mm, 1fr)`; no extra rows are measured or dynamically added, and no fake data is created.
  Populated rows remain explicit `height:auto`, outside the flexible blank grid.
- FORM-010 chart rows are now deterministic and bounded at `52mm / 41mm / 41mm`, with
  `flex: 0 0 auto` and no `fr` tracks. This supersedes the expandable `minmax(56mm,1.15fr) /
  minmax(45mm,1fr) / minmax(45mm,1fr)` sizing that could still consume the full page height.
  The normal Analysis-tab chart grid remains unchanged at `280/230/230px`.
- Narrative wrapping, the 60/40 Why/Action ratio, A3 landscape `419mm × 296mm` geometry,
  conclusion/footer spacing, Draft watermark, approval header, title, and all chart semantics remain
  unchanged. Full real content is never clipped; genuinely excessive content may continue naturally.
- Files changed: `src/components/pages/WeaknessAnalysisPrintView.tsx`,
  `src/components/pages/weaknessAnalysisPrint.css`, `src/components/pages/weaknessCharts.css`,
  `tests/form010-presentation.cjs`, and `PROJECT_STATUS.md`. No backend, migration, Edge Function,
  package/lockfile, or nested `/project` file changed.
- Static validation passed: the presentation regression suite in default, Asia/Jakarta, and
  America/Los_Angeles time zones; `npm run typecheck`; `npm run build`; targeted ESLint for
  `WeaknessAnalysisPrintView.tsx`; and `git diff --check`. Build retained only the existing outdated
  Browserslist and >500 kB chunk advisories. These checks verify markup/CSS invariants, not Chrome
  pagination; one-page A3 Print Preview remains the manual authority.

## Batch 9a — FORM-010 parent-bounded chart balance — 16 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`. Continues open/unmerged PR #27 from authoritative remote head
`592bcefb60b63c7036f82a38452bb34ce9e4140d`; authoritative Chrome Print Preview acceptance remains pending.

- Replaced the undersized fixed FORM-010 chart rows (`52mm / 41mm / 41mm`) with parent-bounded
  `minmax(0, 1.25fr) / minmax(0, 1fr) / minmax(0, 1fr)` tracks. The chart grid now uses
  `flex: 1 1 0`, `height: 100%`, and `min-height: 0`, so it shares only the vertical allocation
  already owned by `.form010-grid` instead of adding intrinsic millimetre minimum pressure.
- Completed the zero-minimum height chain by adding `min-height: 0` to both FORM-010 analysis columns;
  `.form010-grid`, chart cards, ECharts containers, chart sub-layouts, and the existing flexible right
  sections already retain their zero-minimum safeguards. Chart #1 remains dominant at roughly 38.5%,
  while the two secondary rows each receive roughly 30.75% before gaps.
- The normal Analysis-tab chart grid remains `280/230/230px`. The accepted intrinsic narrative rows,
  equal Why/Action blank-grid tracks, 60/40 section ratio, conclusion/footer spacing, A3 landscape
  `419mm × 296mm` geometry, title, approval header, and watermark are unchanged.
- Pareto sorting/stacks/cumulative axis, the 100% endpoint and absence of an 80% reference line,
  beveled donut charts, vertical A–E chart, legends, ECharts SVGRenderer, resize safeguards, and all
  data semantics remain unchanged. Zero-Finding cards use the same balanced geometry.
- Files changed: `src/components/pages/weaknessCharts.css`,
  `src/components/pages/weaknessAnalysisPrint.css`, `tests/form010-presentation.cjs`, and
  `PROJECT_STATUS.md`. No TS/TSX, backend, migration, Edge Function, package/lockfile, or nested
  `/project` file changed.
- Static validation passed: the presentation suite in default, Asia/Jakarta, and America/Los_Angeles
  time zones; `npm run typecheck`; `npm run build`; and `git diff --check`. Build retained only the
  existing outdated Browserslist and >500 kB chunk advisories. Targeted ESLint was not applicable
  because no TS/TSX file changed. These checks do not replace authoritative Chrome Print Preview.

## Batch 9a — FORM-010 phantom print-page safety buffer — 16 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`. Continues open/unmerged PR #27 from authoritative remote head
`099b30ccfe75cd8213d5709406e00e0446b88fa5`; authoritative Chrome Print Preview acceptance remains pending.

- Real Chrome showed every FORM-010 element, including the footer, on page 1 while still reporting an
  empty page 2. Investigation found only a 1mm physical buffer inside A3 (`419mm × 296mm`) plus an
  application-shell `min-h-screen` on `#root > div`, with no FORM-010-specific print height reset.
  No actual content-overflow or forced FORM-010 page-break rule was found.
- Added a conservative physical rounding buffer by changing only the sheet footprint to
  `418mm × min-height:294mm`, leaving 2mm horizontal and 3mm vertical safety inside A3 landscape.
  The page remains content-growing rather than fixed-height; 6mm padding, footer margin, conclusion,
  chart proportions, and all accepted content layout remain unchanged. No overflow clipping was added.
- Added a FORM-010-scoped print override that clears `height`/`min-height` pressure on `html`, `body`,
  `#root`, the `min-h-screen` app-shell child, `main`, and its content wrapper. The FORM-010 page itself
  is deliberately excluded. The local print rule also explicitly hides the Sidebar `aside` alongside
  existing no-print/navigation elements.
- Parent-bounded `1.25fr / 1fr / 1fr` charts, normal `280/230/230px` screen charts, intrinsic populated
  Why/Action rows, equal blank-row grids, header, approval table, title, conclusion, footer, and Draft
  watermark are unchanged. `break-after:auto` / `page-break-after:auto` remain in force.
- Files changed: `src/components/pages/weaknessAnalysisPrint.css`,
  `tests/form010-presentation.cjs`, and `PROJECT_STATUS.md`. No chart/component logic, TS/TSX, backend,
  migration, Edge Function, package/lockfile, or nested `/project` file changed.
- Static validation passed: the presentation suite in default, Asia/Jakarta, and America/Los_Angeles
  time zones; `npm run typecheck`; `npm run build`; and `git diff --check`. Build retained only the
  existing outdated Browserslist and >500 kB chunk advisories. Targeted ESLint was not applicable
  because no TS/TSX file changed. Chrome Print Preview remains the page-count authority.


## Batch 9a — Final chart-input snapshot hardening — 18 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED`; pre-merge blocker correction on open/unmerged PR #27.

- Added exactly one additive migration:
  `supabase/migrations/20260918094500_snapshot_form010_chart_inputs.sql`.
  Previously applied Batch 9a migrations remain byte-for-byte untouched.
- Added Final-only snapshot fields on `weakness_analysis_report_items`:
  `final_process_name`, `final_category`, and `final_reference`.
  Together with the existing `final_4m1e`, `final_dis`, and `final_problem_type`,
  all five FORM-010 chart inputs are now frozen at Finalization.
- `finalize_weakness_analysis` snapshots Process display name, Finding A/B/C category,
  Finding reference/clause, and the three approved classification taxonomies in the same
  transaction immediately before the report becomes Final.
- Draft reports continue to use current live source data. New Final reports prefer the frozen
  chart fields. Existing Final reports created before this migration retain NULL values in the
  new fields and use the intentional legacy live-data fallback; no immutable historical Final
  row is rewritten or bypassed.
- Screen Analysis and printed FORM-010 now use the snapshot marker
  `final_process_name IS NOT NULL` to distinguish new frozen Final items from Draft/legacy items,
  allowing a legitimately NULL `final_reference` to remain frozen as NULL rather than falling
  back to later live data.
- Staging migration application succeeded. The existing rollback-only FORM-010 audit-type suite
  passed all 32 grouped checks after migration application.
- Regression tests were extended to require Process/category/reference plus 4M1E/DIS/problem-type
  snapshots and immutable Final report items.
- No authorization, RLS, AI/ZDR behavior, audit-type population semantics, page geometry,
  chart presentation, package dependency, or nested `/project` scope was changed.

## Batch 9b — Rangkuman Hasil Internal Audit (FORM-014) — 18 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED` on local base `bcc96bfb6d2a9cd1f68cc3c12ee7db13cba04d3f`; remote PR #28 content was unavailable in this checkout.

- Added additive migration `20260918120000_create_batch9b_form014.sql`: report/group/group-row/item records, canonical Instruction + Audit Type uniqueness, guarded Admin/Company Lead Auditor RPCs, exact formal Finding population, QA-bound Manufacturing/Product validation, System process grouping, Draft regeneration preserving Keterangan/Catatan, optimistic revision checks, Final source snapshots, final immutability, and read-only capability-scoped RLS.
- Added the authorized `Rangkuman Hasil Audit` navigation immediately after Analisa Weakness Point and a service-backed Indonesian workspace for Generate, Regenerate, Draft editing, Finalization, preview, and browser printing.
- FORM-014 consumes Finding PLOR through the shared `formatFindingNarrative()` helper. LTP uses canonical `cars.finding_id`, maximum Temporary and Corrective/Preventive due dates, latest `AUDITOR_VERIFIED_CLOSE_TO_ADMIN`, and Closed/Open rendering; missing CAR retains the Finding as Open.
- System groups use process identity. Manufacturing uses one QA = one Plant + Shift. Product uses one QA = one Plant. Invalid matrix contexts block rather than guess or duplicate. Completed empty contexts print `ZERO FINDING`; incomplete contexts never claim zero Finding and block Final.
- Explicit A3 landscape pages use a conservative deterministic narrative-length heuristic (not DOM measurement), keep each next group on a fresh page, and repeat the full shell. Only physical page 1 renders the global report-wide summary, Catatan, and approval names; later pages retain roles and use a CSS diagonal approval-body line.
- Staging migration, rollback SQL regression, and real-browser/print acceptance remain required. The local environment had no Git remote or Staging credentials, so no hosted system was modified.

### Batch 9b pre-Staging correction — 18 Sep 2026

- Process Owner and target/related Section displays are now derived, deduplicated, deterministically ordered, and refreshed from structured master relations. Finalization compares a null-safe authoritative source-state snapshot covering membership, process/context labels, completion, owners, Sections, and effective dates before freezing the report.
- Draft CAR loading now follows Finding → `cars.finding_id` in batched queries; Draft signatories resolve through a guarded read RPC; Finding order is ranked once across every represented row in a group.
- Pagination remains a conservative deterministic narrative-length heuristic with CSS row-break protection and no clipping; real DOM measurement is not claimed. Short/medium/very-long browser print acceptance remains required.
- Added rollback-safe pre-Staging SQL contract/regression file `supabase/tests/batch9b_form014_regression.sql`. Static validation is separate from database/runtime validation. The migration and SQL suite remain unapplied/unexecuted on Staging by instruction.

### Batch 9b correction pass 2 — 18 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED — PRE-STAGING CORRECTIONS COMPLETE` after static validation; hosted migration/runtime/browser verification remains pending.

- Optimistic revision checks now use `IS DISTINCT FROM`, including fail-closed NULL rejection. Final UI confirms, saves current Catatan/Keterangan first, finalizes with the returned revision, prevents repeat submission, and reloads after success or partial save/finalize failure.
- Manufacturing context validation now checks every raw deduplicated Plant/Shift pair, valid UUID/master rows, and Shift ownership by the selected Plant. Product checks every raw Plant mark while allowing multiple Target Models under one valid Plant.
- Source state now includes authoritative Fiscal Year and normalized Product/Manufacturing context. Regeneration refreshes Draft FY; Finalization never refreshes its snapshot and rejects null-safe source drift.
- DATE fields and verification timestamptz use separate formatters; verification uses explicit `Asia/Jakarta`. TGL AUDIT uses the compact controlled Indonesian range format.
- Page-2+ approval geometry now separates role headers from the body and draws a true bottom-left-to-top-right CSS gradient line. Print CSS resets application shell pressure, hides navigation, keeps overflow visible, and uses buffered A3 dimensions.
- `supabase/tests/batch9b_form014_regression.sql` now creates rollback-only identities and domain fixtures and executes real authorization, identity, grouping, zero-Finding, optimistic revision, fail-closed context, completion, and FY-drift paths. It remains intentionally unexecuted until the migration is approved for an isolated database.
- Pagination remains a conservative deterministic heuristic; Chrome A3 visual acceptance with short, medium, and very long narratives is still required. No hosted Staging or Production mutation occurred.

### Batch 9b correction pass 3 — 18 Sep 2026

**Status remains:** `IMPLEMENTED_UNVERIFIED — PRE-STAGING CORRECTIONS COMPLETE`.

- Draft preview and Finalization now share private `form014_active_company_lead_auditor()`, matching the global capability semantics: linked Lead, active profile, `identity_type='AUDITOR'`, and active Auditor master. The regression fixture exercises valid Lead creation plus inactive profile, inactive Auditor master, and non-Auditor linked-profile Final blockers.
- Manufacturing source-state comparison now stores a deduplicated, deterministically Plant/Shift-sorted context instead of raw JSON order. Product unique Plants remain deterministically sorted. A rollback fixture asserts duplicate/reordered equivalent Manufacturing marks do not create false drift.
- The rollback SQL suite now uses explicit `RESET ROLE` boundaries around privileged fixture mutations, exercises active Lead RPC success, real formal/non-formal and cross-type Finding filtering, and actual Product/Manufacturing report generation with distinct zero-Finding groups.
- The suite is still not exhaustive for every requested mutation: Keterangan add/remove-transfer, multi-action LTP snapshots, the full individual source-drift matrix, every Final child operation, and post-Final upstream snapshot-stability mutations remain for the hosted pre-merge regression expansion. No claim of full runtime coverage is made.
- Static checks pass locally. The unapplied migration and regression SQL could not be parsed/executed locally because PostgreSQL/Supabase CLI is unavailable. Hosted Staging and Production remain untouched; Chrome A3 acceptance remains pending.


### Batch 9b Staging database verification — 18 Sep 2026

**Status:** `STAGING_DB_VERIFIED — BROWSER_ACCEPTANCE_PENDING`.

- Batch 9b FORM-014 is applied to **CertiTrack-Staging only**. Production remains untouched.
- Staging already contained an earlier Batch 9b schema state before this verification. Because all FORM-014 report/group/group-row/item tables were empty, Staging was reconciled to the exact PR implementation and then hardened only through additive follow-up migrations. The applied base migration is now treated as immutable.
- Current Staging Batch 9b ledger entries are:
  - `20260918103925 create_batch9b_form014`
  - `20260918104838 fix_batch9b_form014_final_trigger_dispatch`
  - `20260918105641 harden_batch9b_form014_private_helper`
  - `20260918110736 create_batch9b_form014` (Staging reconciliation)
  - `20260918110931 harden_batch9b_form014_lead_resolver`
  - `20260918111158 fix_batch9b_form014_final_trigger_dispatch_v2`
- Repository follow-up migration files use unique versions and preserve the applied base migration:
  - `20260918174500_fix_batch9b_form014_final_trigger_dispatch.sql`
  - `20260918175000_harden_batch9b_form014_lead_resolver.sql`
  - `20260918175500_fix_batch9b_form014_final_trigger_dispatch.sql`
  - `20260918181500_harden_batch9b_form014_private_helper.sql`
- The first Staging runtime smoke exposed a real Final-child INSERT trigger dispatch bug (`NEW.group_id` referenced for the wrong trigger table). The correction was delivered additively; the original applied migration was not edited.
- Privilege verification also exposed the project default function ACL granting direct `authenticated` execution to the private Company Lead resolver. Follow-up hardening now makes `form014_active_company_lead_auditor()` non-executable by `authenticated` while keeping the guarded public FORM-014 RPCs callable.
- `supabase/tests/batch9b_form014_regression.sql` was corrected so fixture completion does not conflict with unrelated audit-execution workflow guards, then executed successfully on Staging inside a transaction ending with `ROLLBACK`.
- The successful rollback suite covers real Admin/Company Lead authorization, denial of ordinary identities, formal Finding filtering, System/Manufacturing/Product grouping, ZERO FINDING representation, fail-closed revision checks, Plant/Shift validation, normalized source-state comparison, completion/FY drift rejection, Keterangan preservation, LTP target/verification snapshots, Final child immutability, and post-Final frozen snapshot stability.
- Additional transaction-local smoke checks independently passed:
  - System Generate → Save Draft → Final with frozen Lead/PJ-QMS snapshots.
  - Product one-QA-one-Plant and Manufacturing one-QA-one-Plant+Shift grouping.
  - completed zero-Finding Product/Manufacturing groups remain represented.
- Post-regression verification confirmed **0** FORM-014 report rows and **0** synthetic Batch 9b profile/row/Finding/Plant fixtures remain.
- Current privilege check: private Lead helper = not executable by `authenticated`; guarded create RPC = executable; direct authenticated report INSERT and item UPDATE = denied.
- Supabase Security Advisor still reports the project-wide generic warning for intentionally exposed guarded `SECURITY DEFINER` RPCs. Performance Advisor also reports several unindexed foreign keys, including some Batch 9b child FKs; these are performance advisories, not functional or authorization failures.
- CertiTrack-Staging currently has no persistent linked user with `is_lead_auditor=true`. Real-data Finalization therefore requires Company Lead Auditor configuration before UI acceptance; the rollback suite verifies Finalization with a transaction-local valid Lead fixture.
- Vercel deployment for PR #29 is Ready, but authenticated Chrome/Vercel A3 Preview/Print acceptance is still pending because this environment cannot open the authenticated Preview interactively.
- Before merge, manually verify System/Manufacturing/Product pages, ZERO FINDING, short/medium/very-long narratives, continuation pages, page-1-only summary/Catatan/signatories, page-2+ approval diagonal, and A3 page count/geometry.


## Batch 9b — FORM-014 final Staging/UAT closeout — 21 Sep 2026

**Status:** `STAGING_UAT_VERIFIED — PRE-MERGE REVIEW COMPLETE; MERGE REQUIRES EXPLICIT APPROVAL`.

- PR #29 remains open and unmerged. Authoritative reviewed head before this documentation closeout was
  `75c318660b9b725e43b2dad10e4d7fdb55093f38`. Production remains untouched.
- FORM-014 controlled output is **A4 landscape**, superseding the earlier A3 pre-Staging notes. The accepted
  screen and Chrome Print Preview layout uses the 11-column controlled table, adaptive Excel-style filler
  rows, compact header/footer typography, and normal-cell ZERO FINDING rendering with `ZERO FINDING`
  only in the Temuan column.
- Real Staging browser/UAT acceptance passed for:
  - System report with two established Closed Findings;
  - Product completed ZERO FINDING context;
  - Manufacturing report with one established Closed Finding and authoritative Plant + Shift context;
  - very-long Finding narratives / continuation pages using the isolated `QA-9911`
    `FORM-014 Pagination UAT` fixture;
  - screen versus Print Preview A4 geometry and continuation-shell behavior.
- Real Finalization UAT passed on Manufacturing report
  `281f7c04-905a-47df-a209-d2acaf162ce1`: status became `Final`, revision advanced to 4,
  Company Lead snapshot is `Company Lead Auditor`, PJ-QMS snapshot is `B6B Smoke QMS`, and the
  Finding/LTP target, verification, and `CLOSED` snapshots were frozen.
- Final immutability was re-verified after the browser action: Regenerate, Save Draft, and direct Final-child
  UPDATE were rejected by the authoritative guards.
- The full Batch 9b SQL regression was re-run against Staging in a rollback-only transaction and passed.
  Because Staging now has a persistent real Company Lead, the regression temporarily cleared that Lead flag
  **inside the same rollback-only transaction** so its synthetic Lead fixture could satisfy the existing
  single-Lead unique constraint. Post-test verification confirmed the real Company Lead remained active and
  zero regression `b9...` fixtures persisted.
- Current persistent Staging UAT data is intentionally **not** zero: the accepted System/Product/
  Manufacturing reports, the configured Company Lead, the Product/Manufacturing execution-context fixtures,
  and `QA-9911` pagination fixture are retained until Batch 9b closeout/cleanup. This supersedes the earlier
  post-regression statement that referred only to transaction-local synthetic regression fixtures.
- Vercel was SUCCESS on implementation head
  `75c318660b9b725e43b2dad10e4d7fdb55093f38`. No unresolved GitHub review threads were present during
  pre-merge review.
- Known project-wide Supabase advisor warnings remain: authenticated-executable, internally guarded
  `SECURITY DEFINER` RPCs and several unindexed foreign keys/performance advisories. The private
  `form014_active_company_lead_auditor()` helper remains non-executable by normal authenticated users;
  Batch 9b authorization/runtime regression passed.
- Staging migration-ledger timestamps differ from repository migration filenames, consistent with the
  existing project-wide MCP migration-application history. Do not attempt a Batch-9b-only ledger rewrite.


## FORM-001 Actual automation — Staging DB verification — 22 Sep 2026

**Status:** `STAGING_DB_VERIFIED — BROWSER A3 UAT PENDING`.

- PR #30 remains open and unmerged. Production remains untouched.
- Applied to CertiTrack-Staging:
  - `automate_annual_plan_actual`
  - `fix_execution_insert_guard_dispatch`
  - `backfill_annual_plan_actual`
- Automatic Actual now uses the authoritative execution state, checklist completeness,
  established Finding states, execution-date ownership, aggregate multi-QA reconciliation,
  and Admin override precedence.
- Standalone Instructions are supported: Program-linked Instructions resolve through
  `audit_programs.plan_id`; standalone Instructions resolve by fiscal year only when exactly
  one Annual Plan exists. Unresolved/ambiguous trigger contexts safely no-op and do not block
  audit execution or Finding workflows.
- The Staging run exposed a pre-existing heterogeneous trigger-dispatch defect in
  `guard_identity_execution_insert()`: the shared trigger referenced table-specific NEW fields
  directly. A small compatibility migration now dispatches through `to_jsonb(NEW)`, preserving
  all existing preparation rules without cross-table record-field errors.
- Regression fixtures were aligned with the current locked-Team and preparation/execution guards;
  the rollback-only `supabase/tests/form001_actual_regression.sql` now passes on Staging.
- Post-regression cleanup verified zero `f1...` auth users, plans, instruction rows, teams,
  and override events remained.
- Backfill verification on the existing FY2099 UAT data proved that a previously completed,
  qualifying audit context now materializes `aktual=true` / `aktual_auto=true` for the
  Annual Plan revision that owns the audit Program. Non-qualifying completed contexts remain false.
- Browser/Chrome A3 landscape pagination and visual acceptance are still pending.


## FORM-001 visual correction after A3 UAT — 22 Sep 2026

**Status:** `IMPLEMENTED ON PR #30 — RE-TEST PENDING`.

- Real Staging visual UAT confirmed the overall A3 FORM-001 layout is close to the controlled reference.
- Removed CertiTrack/Internal Audit branding from the print header while retaining the bordered left header cell and centered title geometry.
- Moved dynamic physical-page numbering (`Hal: current/total`) from the bottom-right footer to the right-side header directly below the approval/signature block.
- The bottom footer now keeps only the controlled notes and authoritative document code.
- For active processes, when at least one effective monthly `audit_plan_schedule.aktual=true` exists, the Actual row now renders `●` in every related Section cell that has an authoritative `audit_plan_seksi_link.peran`. Plan-row `◎/○/*1/*2` rendering is unchanged.
- Processes without any Actual month keep the Actual Section row blank. Inactive processes retain the diagonal slash on both Plan and Actual rows.
- Presentation regression coverage was extended for the neutral header, header page numbering, footer placement, Actual Section dots, no-Actual blank behavior, and inactive-process slashes.
- No database migration, RLS, Actual automation/override logic, A3 pagination rule, filler behavior, FORM-010, FORM-014, Production data, or nested `/project` scope changed in this correction.
- Authenticated Chrome A3 re-test remains required before merge.


## FORM-001 Actual symbol/alignment correction — 22 Sep 2026

**Status:** `IMPLEMENTED ON PR #30 — A3 RE-TEST PENDING`.

- Based on the latest real visual UAT, Actual-row Section marks now mirror the same authoritative Plan relationship and suffix semantics instead of rendering a generic black dot.
- Controlled mapping is:
  - `◎ → ◉`, `○ → ●`
  - `◎*1 → ◉*1`, `○*1 → ●*1`
  - `◎*2 → ◉*2`, `○*2 → ●*2`
  - `◎*1*2 → ◉*1*2`, `○*1*2 → ●*1*2`.
- Actual Section marks appear only when the active Process has at least one effective Actual schedule month. No-Actual Processes remain blank; inactive Processes remain slashed. Month Actual cells remain plain `●`.
- Added centralized `formatAnnualAuditActualSectionMark()`, derived from the same Plan formatter so relationship and *1/*2 suffix semantics cannot drift.
- Section header cells under `Seksi yang diaudit` now use a dedicated `form001-section-header` class and absolute bottom anchoring (`bottom: 1mm`) so every vertical Section name is consistently bottom-aligned. Month-header behavior and overall table geometry are unchanged.
- Presentation regression now covers all eight Plan→Actual mappings, rendered utama/terkait Actual marks, no-Actual blanks, inactive slashes, and the bottom-alignment CSS contract.
- No migration, database logic, Actual automation/Admin override behavior, Production, FORM-010, FORM-014, or nested `/project` scope changed.
- Authenticated Chrome A3 visual re-test remains required before merge.


## FORM-001 page-number placement correction — 22 Sep 2026

**Status:** `IMPLEMENTED ON PR #30 — A3 RE-TEST PENDING`.

- Real visual UAT showed that the physical-page indicator was still visually attached to the approval block.
- `Hal: current/total` is now removed from the approval/control box entirely.
- The page indicator is rendered on the separate legend row, immediately to the right of the `Plan: ○  Aktual: ●` legend and aligned toward the far-right edge.
- Approval geometry/signature slash behavior is unchanged.
- Footer placement remains unchanged: controlled notes at left and document code at right.
- Presentation regression now asserts that no `Hal:` appears inside the approval block and that the page number is rendered inside the right-side legend group.
- No database, migration, RLS, Actual automation/Admin override behavior, Production, FORM-010, FORM-014, or nested `/project` change was made.
- Chrome A3 visual re-test remains required before merge.


## FORM-001 final Staging/UAT closeout — 22 Sep 2026

**Status:** `STAGING_DB_VERIFIED + VISUAL_UAT_ACCEPTED — PRE-MERGE REVIEW COMPLETE; MERGE REQUIRES EXPLICIT APPROVAL`.

- PR #30 remains open and unmerged. Production remains untouched.
- Final reviewed functional scope includes:
  - controlled A3-landscape FORM-001 browser preview/print;
  - April→March fiscal presentation;
  - deterministic 13-process pagination with continuation pages and final-page `Lainnya` filler;
  - inactive-process slash rendering;
  - continuation-page approval slash;
  - Plan Section semantics `◎/○/*1/*2`;
  - Actual Section semantics mirroring Plan as `◉/●` with the same `*1/*2` suffixes;
  - bottom-aligned Section headers;
  - page numbering outside the approval box, beside the Plan/Aktual legend;
  - neutral blank left header cell with no CertiTrack branding.
- Real authenticated visual UAT was accepted by the user on the retained FY2098 Rev.7 Staging fixture.
  The accepted output covered two physical pages, inactive rows, continuation approval behavior,
  Actual month/Section marks, long Process wrapping, filler rows, page numbering, and the final header alignment.
- Automatic Actual materialization remains authoritative:
  completed execution + complete applicable checklist + no blocking non-final Finding + authoritative execution date.
  ZERO FINDING is valid; ANNULLED Finding does not block.
- Product uses `tanggal_audit_produk` with fallback to `tanggal_pelaksanaan_audit`;
  System/Manufacturing/Shift use `tanggal_pelaksanaan_audit`.
- Admin-only controlled override remains available through guarded RPC:
  Set Actual, Clear Actual, and Return to Automatic, with mandatory reason for Set/Clear and append-only history.
- Standalone Instructions resolve by fiscal year only when exactly one Annual Plan exists;
  unresolved/ambiguous trigger contexts safely no-op rather than blocking audit execution/Finding workflow.
- Staging migrations applied and retained:
  - `automate_annual_plan_actual`
  - `fix_execution_insert_guard_dispatch`
  - `backfill_annual_plan_actual`
- Final pre-merge rerun of rollback-only `supabase/tests/form001_actual_regression.sql` passed.
  Post-run verification confirmed zero synthetic regression auth users, plans, Instruction rows,
  teams, and override events remained.
- Authorization re-check:
  `override_annual_plan_actual` is authenticated-executable by design and internally Admin-guarded;
  private reconciliation/resolver functions are not executable by `authenticated`;
  override-event RLS and immutability/materialization protection triggers remain enabled.
- GitHub pre-merge checks found no inline review threads or submitted reviews requiring action.
  PR #30 was mergeable and 0 commits behind `main` at the reviewed implementation head.
- Supabase Advisor still reports the expected generic SECURITY DEFINER warning for the intentionally
  authenticated-executable, internally guarded Admin override RPC. Performance-only INFO notices remain
  for missing covering indexes on two override-event foreign keys and the currently unused schedule-history index;
  these are non-blocking for correctness/authorization.
- The persistent FY2098 visual-UAT fixture is intentionally retained on Staging until post-merge cleanup/release preparation.


## FORM-001 deterministic Section-header alignment correction — 23 Sep 2026

**Status:** `IMPLEMENTED ON PR #30 — VISUAL RE-TEST PENDING`.

- Root cause of the remaining visual mismatch was overlapping CSS ownership:
  Section labels matched both the generic vertical-header span rule and the Section-specific span rule,
  leaving part of their geometry dependent on intrinsic content size.
- Every Section header now uses one explicit structure:
  `<th className="form001-section-header"><span className="form001-section-header-label">...</span></th>`.
  The fallback/empty Section header uses the same dedicated label class.
- Section labels now have one deterministic positioning system:
  absolute positioning, `left:50%`, `bottom:1mm`, `writing-mode:vertical-rl`,
  and `translateX(-50%) rotate(180deg)`.
- Month labels are intentionally isolated under
  `.form001-vertical-headers > th:not(.form001-section-header) > span`
  so they keep their prior behavior and no longer compete with Section-specific rules.
- Presentation regression now covers both a short and a long Section name, verifies the dedicated
  header/label classes on every rendered physical page, checks the deterministic bottom anchor,
  and asserts the old competing generic Section selectors are absent.
- No database migration, Actual automation/Admin override behavior, A3 pagination logic,
  Production, FORM-010, FORM-014, or nested `/project` scope changed.
- Authenticated Chrome A3 visual re-test remains required before merge.


## FORM-001 Section-header flex baseline correction — 23 Sep 2026

**Status:** `IMPLEMENTED ON PR #30 — VISUAL RE-TEST PENDING`.

- The previous absolute-positioning correction still showed inconsistent visual bottoms in Chrome for Section labels with different wrapped heights.
- The Section header implementation now uses a fixed-height inner wrapper instead of absolute positioning:
  `form001-section-header-box` is 40mm high, full-width, `display:flex`,
  `align-items:flex-end`, `justify-content:center`, with a fixed 1mm bottom padding.
- The vertical label itself remains `writing-mode:vertical-rl` + `rotate(180deg)`,
  but no longer owns absolute bottom positioning. This makes the physical bottom edge come from one
  shared flex container rather than each label's intrinsic/wrapped box.
- Every Section header, including the fallback cell, uses the same wrapper structure.
- Month headers remain on their existing independent vertical-label selector and were not changed.
- Regression assertions now require the fixed wrapper on every Section header and reject reintroduction
  of absolute positioning on `form001-section-header-label`.
- No database, migration, Actual automation/Admin override behavior, A3 pagination, Production,
  FORM-010, FORM-014, or nested `/project` change was made.
- Chrome A3 visual re-test is required before merge.


## FORM-001 transform-free Section baseline + vector inactive slash — 23 Sep 2026

**Status:** `IMPLEMENTED ON PR #30 — VISUAL/PRINT RE-TEST PENDING`.

- The previous fixed-height flex wrapper still produced different visual bottoms because the Section text itself used
  `writing-mode:vertical-rl` plus `rotate(180deg)`. A transformed element's visual bottom does not correspond
  to the pre-transform flex bottom, so different wrapped heights could still look misaligned.
- Section labels now remove the transform entirely and use native vertical flow:
  `writing-mode:vertical-rl`, `direction:rtl`, `text-orientation:mixed`, `transform:none`.
  The existing common 40mm flex wrapper can therefore bottom-align the actual visual box rather than its pre-transform box.
- Month headers intentionally retain their previous independent rotated rendering.
- Inactive-process slash rendering was changed from a CSS diagonal `linear-gradient` to an inline SVG vector line
  running bottom-left to top-right. The line uses `vector-effect:non-scaling-stroke` so it remains sharp in browser/PDF print output.
- `form001-inactive-cell` no longer paints the diagonal as a rasterized CSS gradient.
- Presentation regression now requires the native transform-free Section rule, the SVG slash markup/vector styling,
  and rejects reintroduction of the inactive-cell gradient.
- No database, migration, Actual automation/Admin override behavior, pagination, Production, FORM-010, FORM-014,
  or nested `/project` change was made.
- Authenticated screen + Chrome A3 Print Preview re-test is required before merge.


## FORM-001 shared Section/month vertical-header alignment — 23 Sep 2026

**Status:** `IMPLEMENTED ON PR #30 — VISUAL RE-TEST PENDING`.

- Latest visual UAT confirmed that the month headers already had the desired orientation and bottom alignment, while the Section headers still differed because they were being rendered through a separate wrapper/positioning system.
- The Section-specific wrapper/classes were removed entirely. Section headers now use the exact same simple `<th><span>...</span></th>` structure as month headers.
- The CSS is now unified under one selector:
  `.form001-vertical-headers > th > span`
  with the same `writing-mode:vertical-rl`, `rotate(180deg)`, and `vertical-align:bottom` behavior for both Sections and months.
- All special Section header rules (`form001-section-header`, `form001-section-header-box`, `form001-section-header-label`) were removed so there is no second alignment/orientation system.
- The SVG vector slash for inactive processes is retained unchanged to preserve sharp Print Preview/PDF output.
- Presentation regression now asserts that Section-specific header classes/rules are absent and that both Section and month headers share the same generic vertical-header styling.
- No database, migration, Actual automation/Admin override behavior, pagination, Production, FORM-010, FORM-014, or nested `/project` change was made.
- Authenticated screen + Chrome A3 Print Preview re-test remains required before merge.


## FORM-001 wrapped vertical-header baseline correction — 23 Sep 2026

**Status:** `IMPLEMENTED ON PR #30 — VISUAL RE-TEST PENDING`.

- Latest visual UAT showed that short month labels were bottom-aligned correctly while several long Section labels, especially the Staging-only UAT Sections (33–50 characters), wrapped into multiple vertical columns and appeared visually centered.
- Root cause: the shared vertical-header rule used intrinsic height plus `max-height:40mm`. Wrapped vertical text therefore created partial columns whose visual start point differed by content length.
- The shared Section/month header rule now uses a fixed 40mm content box:
  `display:block; width:100%; height:40mm; writing-mode:vertical-rl; transform:rotate(180deg); text-align:start`.
  Because the pre-rotation inline start maps to the visual bottom after 180° rotation, all single- and multi-column vertical labels now start from the same bottom baseline.
- Section and month headers still use one shared CSS rule; no Section-specific positioning system was reintroduced.
- The SVG vector slash for inactive-process cells remains unchanged.
- Presentation regression now requires the fixed-height/text-align-start vertical-header contract.
- No database, migration, Actual automation/Admin override behavior, pagination, Production, FORM-010, FORM-014, or nested `/project` change was made.
- Authenticated screen + Chrome A3 Print Preview re-test remains required before merge.


## FORM-001 vertical-header center correction — 23 Sep 2026

**Status:** `IMPLEMENTED ON PR #30 — VISUAL RE-TEST PENDING`.

- Latest visual UAT confirmed the fixed 40mm vertical header height successfully anchored Section/month labels to the bottom, but the shared span used `width:100%`, which caused the transformed text box to occupy the full cell width and appear visually right-aligned.
- The shared Section/month header rule now keeps the fixed 40mm height for bottom anchoring but uses:
  `display:inline-block; width:auto; max-width:100%; vertical-align:bottom`.
- Header cells explicitly use `text-align:center`, so the intrinsic-width vertical label box is horizontally centered within every Section/month column while preserving the same visual bottom baseline.
- Section and month headers still use one shared CSS rule.
- SVG vector inactive-process slashes remain unchanged.
- Presentation regression now requires both `vertical-align:bottom;text-align:center` on the header cells and the intrinsic-width inline-block label contract.
- No database, migration, Actual automation/Admin override behavior, pagination, Production, FORM-010, FORM-014, or nested `/project` change was made.
- Authenticated screen + Chrome A3 Print Preview re-test remains required before merge.


## FORM-001 final visual acceptance — 23 Sep 2026

**Status:** `FINAL_VISUAL_UAT_ACCEPTED — READY FOR MERGE WITH EXPLICIT APPROVAL`.

- The final authenticated Staging visual re-test was accepted by the user after the last vertical-header centering correction.
- Final accepted vertical-header behavior:
  - Section and month headers share the same CSS mechanism;
  - fixed 40mm vertical text height preserves a common bottom baseline;
  - intrinsic-width `inline-block` labels plus `text-align:center` on the header cell provide horizontal centering;
  - orientation remains consistent with the month headers.
- Inactive-process slashes remain SVG vector lines and are retained for sharper Chrome Print Preview / PDF rendering.
- All previously accepted FORM-001 behavior remains unchanged:
  A3 landscape, April→March ordering, deterministic 13-process pagination, continuation approval slash,
  final-page `Lainnya` filler, Plan/Actual Section symbols and flags, page number beside the Plan/Aktual legend,
  neutral header, and browser print isolation.
- The latest correction is presentation-only; no database migration, Actual automation/Admin override logic,
  RLS, Production data, FORM-010, FORM-014, or nested `/project` scope changed after the last Staging DB regression PASS.
- PR #30 remains open and unmerged pending explicit merge approval.

## Dashboard Internal Audit command center — 23 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED — DATABASE MIGRATION/UAT PENDING`.

- Added `dashboard` as the default authenticated landing page and first navigation item for ADMIN, AUDITOR, AUDITEE, and SECTION_MANAGER; active Company Lead Auditor access follows the existing AUDITOR capability model.
- Added a read-only responsive command center with global FY (April–March), audit-type, and Process filters; six operational KPIs; FORM-001 Plan/Aktual chart; execution, Finding, and LTP health; Process concentration; latest relevant Final Weakness summary; attention, role-aware task, due-date, and authoritative activity panels.
- Added one reusable TypeScript dashboard service and an SVG ECharts lifecycle wrapper. React does not query Supabase tables or redefine KPI rules.
- Added migration `20260923120000_add_internal_audit_dashboard.sql` with authenticated, identity-scoped `get_internal_audit_dashboard(...)` and `dashboard_can_access_instruction_row(...)` helpers. Full-company scope is limited to Admin and active Company Lead Auditor. Restricted roles reuse authoritative team, section, and CAR access helpers; no display-name ownership inference is used.
- `Audit Direncanakan` counts accessible QA / Instruction row contexts in the selected FY. Plan-vs-Actual separately counts schedule marks from only the highest Annual Plan revision. `Audit Established` reuses `annual_actual_checklist_complete(...)` plus the same completion/date/non-final-Finding rule as FORM-001 Actual. LTP overdue uses the maximum TEMPORARY or CORRECTIVE/PREVENTIVE action due date and excludes `CLOSED` CARs.
- Weakness content comes only from the latest relevant Final Weakness report with accessible Findings; raw Findings are not converted into synthetic Weakness classifications.
- No dashboard-owned tables, generic activity log, new persisted business status, new dependency, Production change, or nested `/project` change was made.
- Validation: root TypeScript typecheck and production build pass. Repository-wide lint remains blocked by pre-existing unused imports in active and legacy snapshot files; the only initially reported Dashboard lint issue was removed. Database migration execution, authorization regression against Supabase, and authenticated browser visual UAT remain pending.

## Dashboard Internal Audit correctness/security correction — 23 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED — LOCAL/STAGING DATABASE REGRESSION PENDING`.

- Corrected Top Weakness Point to aggregate authoritative `final_problem_type` snapshots with the accepted legacy fallback to approved classification data; UI labels reuse `WEAKNESS_PROBLEM_LABEL`.
- Replaced the fake constant Process Weakness value with the count of accessible Findings belonging to the latest relevant Final Weakness report.
- Made every Dashboard drill-down capability-aware through `canAccessPage`; disallowed cards, rows, and panel links are non-actionable instead of navigating to Access Denied.
- Process filter options now come from the accessible FY/audit-type population independently of the selected Process, so selecting one Process does not collapse the selector.
- Kept the scope helper private and exposed only `get_internal_audit_dashboard(...)` to authenticated clients.
- Added rollback-only `supabase/tests/dashboard_regression.sql` covering role isolation, Established/Finding/CAR semantics, FY revision/filter behavior, no-data output, personal-task scoping, and function privileges. It was not applied to Staging or Production per instruction.
- Added dependency-free `tests/dashboard-presentation.cjs` for navigation, landing, April–March ordering, empty states, selector stability, permission-aware actions, and finite chart values. This is a structural presentation regression, not browser UAT.

## Dashboard Internal Audit semantic correction follow-up — 23 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED — DB REGRESSION PENDING STAGING`.

- Split the RPC scope into `base_rows` (identity + FY + Audit Type) and Process-filtered `rows`; Process choices remain switchable after a selection.
- Full-scope fiscal-year options now union Annual Plan years and authorized Instruction years; restricted identities receive only authorized-context years, and the selected FY is always present.
- FORM-001 Plan/Aktual is returned only without an Audit Type filter. A selected Audit Type now produces `plan_actual_available=false` and the explicit message that FORM-001 has no Audit Type dimension; no schedule values are inferred by Process membership.
- `Audit Direncanakan` now counts only accessible QA contexts with `tanggal_plan_audit`; `Audit Perlu Perhatian` counts distinct QA contexts satisfying one or more alert conditions.
- Finding review activity now targets Temuan semantically, subject to the existing frontend capability guard.
- Filter changes clear the prior payload before loading, preventing old metrics from appearing under new filter controls. RPC failures now provide an in-page `Coba Lagi` action.
- Extended both Dashboard regressions for the corrected FY, Plan/Aktual availability, planned-date, unique-attention, stale-data, retry, and activity-destination contracts. The rollback-only SQL remains unapplied pending Staging authorization.

## Dashboard Internal Audit final backend scope correction — 23 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED — DB REGRESSION PENDING STAGING`.

- Hardened Finding aggregation for Auditee and Section Manager identities: an authorized QA row no longer grants access to every Finding on that row. Each Finding must have a canonical CAR allowed by `car_accessible_to_current_identity`, while Admin/Company Lead retain full scope and Auditor findings remain constrained by authorized Team rows.
- Hardened `car_scope` independently through `car_accessible_to_current_identity` for every restricted identity. A shared QA containing Findings for different Sections therefore exposes only each identity's own canonical Finding/CAR aggregates, activity, Weakness data, attention items, and tasks.
- Added one mutually exclusive `row_execution_status` precedence: Established → Menunggu Finalisasi Finding → Execution Selesai → Berjalan → Belum Mulai. The regression asserts the five-category sum equals the Dashboard row population.
- Corrected Verification Pending and Auditor verification tasks to count exactly `AUDITOR_REVIEW` plus `AUDITOR_RETURNED`; `ADMIN_REVIEW` and `CLOSED` are excluded.
- FORM-001 Plan/Aktual availability now additionally requires a current Annual Plan. An authorized Instruction FY without a Plan returns `plan_actual_available=false` and `Belum ada Rencana Audit Tahunan untuk FY ini.` rather than an all-zero pseudo-plan.
- Expanded the rollback-only SQL regression with shared-row two-Section Finding/CAR isolation for both Auditees and Managers, all five execution states, four LTP workflow states, and an authorized no-Plan FY. It remains unapplied pending explicit Staging approval.


## Dashboard Internal Audit Staging migration + regression — 23 Sep 2026

**Status:** `STAGING DB PASS — AUTHENTICATED BROWSER UAT PENDING`.

- Applied the Dashboard read-model migration to `CertiTrack-Staging` only. Production remained untouched.
- Staging migration ledger:
  - `20260923072638 add_internal_audit_dashboard`
  - `20260923073719 harden_internal_audit_dashboard_helper`
- The initial Dashboard migration source required one pre-application PostgreSQL syntax correction: the internal fiscal-month CTE alias `month` was renamed to `month_no`. The migration had not been recorded/applied before this correction, so the repository migration remained safe to correct in place before first application.
- Hosted Staging privilege regression found one real security hardening issue: Supabase default privileges left `dashboard_can_access_instruction_row(uuid)` executable by `authenticated`. A new additive migration `20260923140500_harden_internal_audit_dashboard_helper.sql` explicitly revokes that private helper from `PUBLIC`, `anon`, and `authenticated`, while retaining authenticated EXECUTE on the public `get_internal_audit_dashboard(...)` RPC.
- Final privilege verification:
  - `get_internal_audit_dashboard(integer,text,uuid)`: authenticated EXECUTE = yes; anon EXECUTE = no.
  - `dashboard_can_access_instruction_row(uuid)`: authenticated EXECUTE = no; anon EXECUTE = no.
- Updated the rollback-only `supabase/tests/dashboard_regression.sql` fixture harness for the current hosted schema/lifecycle: existing Lead uniqueness, Team lock RPC, annual Auditor assignments, checklist completion ordering, required CAR action ordering, valid Finding event types, and owner-level fixture mutations after role simulation.
- Final hosted Staging execution of `dashboard_regression.sql` passed and rolled back successfully.
- Post-run cleanup verification found zero synthetic Dashboard auth users, profiles, plans, Instruction rows, Findings, and CARs; the existing single Company Lead Auditor link was restored.
- Real-data Admin sanity call succeeded: full-organization scope, six KPI metrics, five mutually exclusive execution statuses, 12 April→March Plan/Aktual points, and accessible FY options were returned without error.
- Supabase Security Advisor reports the expected generic warning for the intentionally authenticated-executable `SECURITY DEFINER` public Dashboard RPC. The private Dashboard scope helper is no longer exposed. No Dashboard-specific performance advisory was reported.
- Existing project-wide advisor findings remain outside this Dashboard change (generic SECURITY DEFINER warnings, leaked-password protection setting, unindexed foreign keys, auth RLS initplan, unused indexes, and multiple permissive policies).
- PR #31 remains open and unmerged. Authenticated browser UAT by role is the remaining gate before final pre-merge review.


## Dashboard Status Pelaksanaan chart refinement — 23 Sep 2026

**Status:** `IMPLEMENTED ON PR #31 — AUTHENTICATED VISUAL UAT PENDING`.

- Replaced the previous single stacked Status Pelaksanaan composition with five separate horizontal category bars.
- Preserved the authoritative mutually-exclusive execution-status order and semantics:
  Belum Mulai → Berjalan → Execution Selesai → Menunggu Finalisasi Finding → Established.
- The chart now uses one non-stacked ECharts bar series with direct category labels on the left and numeric values at the end of each bar; the legend is no longer required.
- All five categories are explicitly materialized in the frontend and missing values normalize to zero, so zero-value statuses remain structurally present.
- When all five values are zero, the card renders `Belum ada status pelaksanaan untuk filter ini.` instead of an empty chart.
- Existing status colors are retained: gray, blue, amber, orange, and green.
- No backend SQL, RPC shape, service contract, execution-status precedence, KPI, filter, authorization, Staging schema, or Production state changed.
- Dashboard presentation regression now rejects stacked execution bars and requires all five ordered categories plus the all-zero empty state.


## Dashboard Top 5 klausul Finding — 28 Sep 2026

**Status:** `IMPLEMENTED ON PR #31 — STAGING MIGRATION/DB REGRESSION + AUTHENTICATED VISUAL UAT PENDING`.

- Added a compact `Klausul Terbanyak` panel that shows only the Top 5 normalized clause numbers, proportional horizontal bars, and visible Finding counts.
- Finding clause analytics remain read-only. The original Finding `reference` text is not mutated; dotted numeric clause tokens such as `6.1.2`, `7.2`, and `8.5.1.1` are extracted from the stored reference text for Dashboard aggregation only.
- Repeated occurrences of the same clause within one Finding are deduplicated through `DISTINCT finding_id + clause`; multiple different clauses in one Finding contribute once to each distinct clause.
- Only finalized formal Findings in `PUBLISHED` or `LEGACY_ESTABLISHED` contribute. Draft/review and `ANNULLED` Findings do not contribute.
- Aggregation is performed over the existing authorization/filter-scoped `finding_scope`, so Fiscal Year, Audit Type, Process, Auditor assignment, Auditee, and Section Manager isolation remain unchanged.
- Results are ordered by Finding count descending, then clause ascending, and limited to five rows. Empty result renders `Belum ada data klausul untuk filter ini.`.
- The existing applied Dashboard migration `20260923120000_add_internal_audit_dashboard.sql` remains frozen. The new backend behavior is isolated in additive migration `20260928080000_add_dashboard_top_clauses.sql`, which replaces only the public Dashboard read-model RPC and preserves its existing authenticated-only privilege contract.
- Dashboard service now exposes and finite-normalizes `top_clauses: { clause, count }[]`.
- The analytics layout keeps `Temuan per Proses` as a dedicated panel and places `Klausul Terbanyak` beside `Top Weakness Point` for compact comparison of requirement concentration versus systemic weakness.
- Rollback SQL regression now covers descriptive clause text, repeated clause deduplication, multi-clause Findings, finalized-only inclusion, Top-5 limiting/order, and Auditee authorization isolation.
- Presentation regression covers panel title, empty state, compact bar renderer, service payload, finalized Finding scope, deduplication, normalization, deterministic Top-5 limit, and RPC payload exposure.
- Production remains untouched. Additive migration has not yet been applied to Staging; DB regression and authenticated visual UAT for this new panel remain pending.


## Dashboard Top 5 klausul — Staging verification — 28 Sep 2026

**Status:** `STAGING DB PASS — AUTHENTICATED VISUAL UAT PENDING`.

- Applied additive migration `20260928080000_add_dashboard_top_clauses.sql` to `CertiTrack-Staging` only. Production remained untouched.
- Staging ledger recorded the migration as `20260928015351 add_dashboard_top_clauses` (MCP ledger timestamp differs from repository filename, consistent with prior project migration history).
- The migration replaces only the existing read-only `get_internal_audit_dashboard(integer,text,uuid)` RPC and preserves the already-hardened privilege model.
- Final privilege verification after apply:
  - public Dashboard RPC: authenticated EXECUTE = yes;
  - public Dashboard RPC: anon EXECUTE = no;
  - private `dashboard_can_access_instruction_row(uuid)`: authenticated EXECUTE = no.
- Hosted rollback-only `supabase/tests/dashboard_regression.sql` passed after the Top-Clause additions.
- Regression cleanup verification found zero synthetic Dashboard auth users, profiles, Instruction rows, Findings, and CARs after rollback.
- Real-data Admin sanity check:
  - FY2026 currently returns an empty `top_clauses` array because there are no finalized FY2026 Findings with clause data;
  - FY2099 returns five clause rows from existing Staging data:
    `10.2.1`, `7.2`, `7.2.3`, `7.5.3.2.2`, and `9.2.2`, each count 1.
- This confirms the Dashboard RPC now emits the new `top_clauses` payload correctly. Browser visual UAT should use FY2099 to verify rendering until FY2026 has finalized Finding clause data.
- PR #31 remains open and unmerged.


## Dashboard Top Klausul numeric tie-break — 28 Sep 2026

**Status:** `STAGING PASS — VISUAL RE-TEST PENDING`.

- Refined only the secondary ordering for `Klausul Terbanyak`: Finding count descending remains the primary rank, while equal-count clauses now sort by numeric/hierarchical dotted-clause order instead of plain text order.
- Example equal-count ordering is now: `7.2 → 7.2.3 → 7.5.3.2.2 → 9.2.2 → 10.2.1`.
- Implemented through additive migration `20260928093000_sort_dashboard_top_clauses_numeric.sql`; previously applied Dashboard migrations remain frozen.
- The RPC uses `string_to_array(clause,'.')::integer[]` as the tie-break key after count descending. Clause text remains an additional deterministic final tie-break.
- Staging ledger entry: `20260928022303 sort_dashboard_top_clauses_numeric`.
- Hosted rollback-only Dashboard regression passed after updating the equal-count ordering assertion.
- Post-regression cleanup verified zero synthetic Dashboard auth/Finding/CAR fixtures.
- Real-data FY2099 sanity check now returns, in order: `7.2`, `7.2.3`, `7.5.3.2.2`, `9.2.2`, `10.2.1`, each count 1.
- Production remains untouched. PR #31 remains open and unmerged.


## Dashboard Internal Audit final pre-merge review — 28 Sep 2026

**Status:** `READY FOR MERGE — EXPLICIT MERGE APPROVAL REQUIRED`.

- Final review performed on PR #31 after authenticated visual acceptance of the Dashboard, separate Status Pelaksanaan bars, Top 5 Klausul panel, and numeric/hierarchical clause tie ordering.
- PR is open, non-draft, mergeable, and not behind `main`. No unresolved review thread remains.
- Vercel preview is successful on the reviewed implementation head.
- Final Staging migration chain for this PR is fully applied:
  - repository `20260923120000_add_internal_audit_dashboard.sql` → ledger `20260923072638 add_internal_audit_dashboard`;
  - repository `20260923140500_harden_internal_audit_dashboard_helper.sql` → ledger `20260923073719 harden_internal_audit_dashboard_helper`;
  - repository `20260928080000_add_dashboard_top_clauses.sql` → ledger `20260928015351 add_dashboard_top_clauses`;
  - repository `20260928093000_sort_dashboard_top_clauses_numeric.sql` → ledger `20260928022303 sort_dashboard_top_clauses_numeric`.
- Latest rollback-only hosted Staging Dashboard regression passed after the final clause-order migration; post-run synthetic Dashboard fixtures were clean.
- Final privilege verification:
  - `get_internal_audit_dashboard(integer,text,uuid)` is `SECURITY DEFINER` with explicit `search_path=pg_catalog, public`;
  - authenticated EXECUTE = yes;
  - anon EXECUTE = no;
  - private `dashboard_can_access_instruction_row(uuid)`: authenticated/anon EXECUTE = no.
- Supabase Security Advisor retains the expected generic warning for the intentionally authenticated-executable public Dashboard `SECURITY DEFINER` RPC. Its authorization/scoping behavior is covered by the hosted regression. No Dashboard-specific performance advisory is reported.
- Existing project-wide Advisor warnings unrelated to this Dashboard PR remain deferred and are not introduced by PR #31.
- Final accepted Dashboard scope includes: role-aware landing/navigation, centralized read model, KPI cards, FORM-001 Plan vs Aktual, mutually-exclusive execution status, Finding/LTP health, Temuan per Proses, Top Weakness Point, Perlu Perhatian, Tugas Saya, Upcoming/Overdue, Recent Activity, and Top 5 normalized Finding clauses.
- Production has not been modified during this PR workflow. PR #31 remains unmerged pending explicit approval.


## FORM-015 portrait print isolation — 28 Sep 2026

**Status:** `IMPLEMENTED ON NEW PR — BROWSER PRINT UAT PENDING`.

- Latest browser print showed `Laporan Internal Audit` (FORM-015) being printed in landscape even though its own CSS declared `A4 portrait`.
- Root cause: multiple print modules are statically bundled and publish global `@page` rules. FORM-001 / FORM-010 / FORM-014 include landscape page rules, so browser cascade/order can override another module's unqualified `@page`.
- FORM-015 now uses a named page:
  `@page form015-report { size: A4 portrait; margin: 0; }`.
- Every printable FORM-015 article binds explicitly with:
  `page: form015-report;`.
- The previous bare/unqualified FORM-015 `@page` rule was removed, so FORM-015 no longer participates in global page-orientation contention.
- Existing FORM-015 physical geometry remains `210mm × min-height 297mm`; content layout, pagination, findings, signatures, footer, watermark, and report data are unchanged.
- No database/RPC/migration/authorization/Production change is involved.
- Added dependency-free regression `tests/form015-print-orientation.cjs` requiring the named A4 portrait page binding and rejecting a bare FORM-015 global `@page`.
- Authenticated Chrome Print Preview / Save-as-PDF visual re-test remains required before merge.
