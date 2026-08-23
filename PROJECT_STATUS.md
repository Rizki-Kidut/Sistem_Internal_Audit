# PROJECT_STATUS.md — CertiTrack Internal Audit Module

## Batch 7.0 — Identity & Access Foundation — 23 Aug 2026

**Status:** `IMPLEMENTED_UNVERIFIED`

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
- [x] Added `AUTH_IDENTITY_SETUP.md` with trusted bootstrap, separate-persona provisioning, mappings,
      future LTP contract, and a runtime/RLS verification plan. No credentials or Auth users are included.
- [ ] Runtime Supabase, Staging, browser, Team-isolation, and Storage signed-URL verification remain pending.
      No migration was applied and no Staging account/data was created in this implementation pass.
- [x] Static validation previously passed for `npm run typecheck`, `npm run build`, and diff whitespace checks.
      Repository-wide lint remains at the pre-existing unused-symbol baseline: 24 errors and zero
      warnings. The current correction pass still requires remote build/runtime verification.
- [x] PR #9 static-review corrections scope own-profile loading by `auth.uid`, require a current active
      Manager identity, reject incompatible profile identity changes, scope process/section/
      Manufacturing-bank/Team reference reads, and preserve Manager Agenda Team context.
- [x] Agenda read-only identities receive Print only (no reopen control), token refresh updates the
      session without unmounting the current page, malformed evidence paths are rejected safely, and
      authenticated table privileges are normalized to SELECT/INSERT/UPDATE/DELETE (RLS remains the
      per-identity authority; TRUNCATE/REFERENCES/TRIGGER are not granted).
- [x] Findings are the deliberate privilege exception: authenticated identities, including Admin,
      receive only SELECT/UPDATE with matching RLS. Direct INSERT/DELETE remains unavailable and the
      existing Batch 6a SECURITY DEFINER source triggers remain the sole automatic Finding lifecycle authority.

New migrations: `20260823010000_create_identity_access_foundation.sql` and
`20260823020000_enforce_identity_scoped_audit_access.sql`.

### Finding review static implementation

- [x] Added explicit Team Leader and Lead Auditor responsibilities without new Auth identity types.
- [x] Added Draft → Lead Review → Revision Required / Ready for Release / Annulled → Published RPC
      transitions, Team/Lead/Admin separation, mandatory PLOR checks, and concurrency-safe official numbering.
- [x] Added append-only review/change events, per-recipient notifications, optimistic PLOR versioning,
      immutable `created_at`, and normalized initial/effective source disposition for annulment.
- [x] Admin may auditably edit Draft/Revision Required PLOR and release approved Findings, but cannot
      submit/resubmit, approve/annul, mutate execution results, complete/reopen execution, or hard-delete.
- [x] Product evidence authorization additionally verifies that the path phase belongs to its checklist.
- [x] Preserved every legacy Finding number, operational status, CAR relationship, PLOR, source link,
      and timestamp. Publication uses separate `review_status` without fake historical approval events.
- [x] Legacy numbered Findings are now classified conservatively: completed/progressed legacy records
      become `LEGACY_ESTABLISHED`, while numbered Findings on unfinished audits remain `DRAFT`-compatible
      so the Team can finish PLOR and submit them through Team Leader/Lead review without replacing the
      pre-workflow official number.
- [x] A numbered legacy Draft cannot be silently auto-deleted through source correction; cancellation
      must use controlled Lead Auditor annulment so the legacy number remains traceable.
- [x] Lead approval allocates a new official number only when `kode_temuan` is null. Legacy numbered
      Drafts retain their existing number when approved.
- [x] Lead annulment atomically captures the actual initial judgement, applies the conforming result
      to the authoritative source, retains its Finding link, appends immutable disposition/review history,
      and changes only `review_status`. Normal source sync is locked after submission.
- [x] Pelaksanaan shows effective/original annulment results with reason, reviewer, and time. Admin can
      view all Pelaksanaan data but receives no execution editor or Complete/Reopen control.
- [x] Checklist Audit now also shows annulment traceability for the selected QA: effective result,
      original result, reason, reviewer, timestamp, source type, and Finding reference. Normal source
      fields continue to show the authoritative effective O/OK result.
- [ ] Draft display references may still be reused after deletion of a never-submitted new Draft; UUID
      remains authoritative. This is a non-blocking hardening item for a later pass if needed.
- [ ] Migration-chain execution, RLS/RPC role matrix, notification delivery, concurrency, browser workflow,
      Storage, Security Advisor, and Staging verification remain pending.

New Finding workflow migration: `20260823030000_create_finding_review_workflow.sql`. Batch 7 LTP/CAR, Agenda
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
      rejected.
- [x] Audit Team UI now distinguishes current annual Team Masters from legacy compatibility rows.

## Batch 6b — Pelaksanaan Audit — 20 Aug 2026

**Status:** `VERIFIED_COMPLETE`

- [x] Added Pelaksanaan worklist based on the same live QA / `audit_instruction_rows` source used by
      Checklist, Agenda, and Temuan.
- [x] Added type-specific execution panels for System, Product, and Manufacturing/Shift without
      duplicating Checklist preparation data.
- [x] Added DB-authoritative execution mutation guards and completion blockers.
- [x] Added `audit_execution_blockers()`, `complete_audit_execution()`, and
      `reopen_audit_execution()` as `SECURITY INVOKER` RPCs.
- [x] `cek_selesai` remains the completion authority and locks execution/source checklist/PLOR.
- [x] Reopen preserves data and sets `cek_selesai=false`.
- [x] Batch 6a source triggers continue to own automatic Finding lifecycle.
- [x] Staging migration and browser/runtime verification completed before PR #8 merge.

## Batch 6a — Temuan / PLOR — 20 Aug 2026

**Status:** `VERIFIED_COMPLETE`

- [x] Findings are generated authoritatively from System/Product/Manufacturing source checklist results.
- [x] Formal PLOR remains separate from checklist observation text.
- [x] Finding source types map to System, Product, and Manufacturing/Shift contexts.
- [x] Existing Batch 6a operational lifecycle remains `Open → CAR Submitted → Verifikasi → Closed/Overdue`.
- [x] Direct normal INSERT/DELETE of Findings remains blocked; source synchronization functions own
      automatic draft creation/removal behavior.
- [x] PLOR update protection preserves Finding identity and source relationship.

## Batch 5d — Agenda Audit — 20 Aug 2026

**Status:** `VERIFIED_COMPLETE`

- [x] Agenda Audit uses the same live QA / Instruction row context.
- [x] Admin can prepare/finalize/reopen Agenda.
- [x] Auditor/Manager read-only behavior is preserved by the identity foundation in PR #9.

## Batch 5c — Checklist Audit Manufaktur / Shift

**Status:** `VERIFIED_COMPLETE`

- [x] Manufacturing/Shift checklist preparation is linked to the live Instruction row.
- [x] Bank-driven and manual checklist structure supported.
- [x] Execution results remain separated from preparation structure.

## Batch 5b — Checklist Audit Produk

**Status:** `VERIFIED_COMPLETE`

- [x] Product checklist preparation, phase structure, evidence, and execution fields implemented.
- [x] Product evidence Storage path and phase/checklist relationship are hardened by PR #9.

## Batch 5a — Checklist Audit Sistem

**Status:** `VERIFIED_COMPLETE`

- [x] System checklist preparation uses the live QA and Checklist Bank.
- [x] Execution results remain separated from preparation structure.

## Earlier verified batches

Batches prior to 5a remain `VERIFIED_COMPLETE` as previously recorded in repository history.
