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
- [x] Static validation passed for `npm run typecheck`, `npm run build`, and diff whitespace checks.
      Repository-wide lint remains at the pre-existing unused-symbol baseline: 24 errors and zero
      warnings; the Batch 7.0 changed files add no lint finding. A browser screenshot could not be
      produced because this environment has neither configured Supabase frontend variables nor an
      installed browser runtime.
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
      and timestamp. Publication now uses separate `review_status`; existing numbered rows receive the
      non-historical `LEGACY_ESTABLISHED` compatibility marker without fake approval events.
- [x] Lead annulment now atomically captures the actual initial judgement, applies the conforming result
      to the authoritative source, retains its Finding link, appends immutable disposition/review history,
      and changes only `review_status`. Normal source sync is locked after submission.
- [x] Pelaksanaan shows effective/original annulment results with reason, reviewer, and time. Admin can
      view all Pelaksanaan data but receives no execution editor or Complete/Reopen control.
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
  move behind an adapter when the real Training module source/schema is supplied; no external schema
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

**Status:** `IMPLEMENTED_UNVERIFIED`


### Checklist/Pelaksanaan separation refinement (PR #8 working state)

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
does not replace the SECURITY INVOKER completion RPCs or blocker and has not been applied to Staging.

Additive migration `20260822110000_refine_batch6b_checklist_execution_separation.sql` expands the
Elemen Proses constraints, makes retained method columns optional, and replaces the database completion
blocker with per-item observation/judgement messages for System, Product, and Manufacturing/Shift. It
explicitly preserves `SECURITY INVOKER` for the blocker and complete/reopen RPCs. This migration is
applied on Staging and is now immutable. The new 12:00 guard correction still requires Staging runtime,
security, and browser verification; therefore Batch 6b remains `IMPLEMENTED_UNVERIFIED`.

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

Implementasi dan static checks lokal telah dilakukan, tetapi status tetap
`IMPLEMENTED_UNVERIFIED` sampai migration diterapkan ke Staging, runtime suite 22 skenario,
Security Advisor, Vercel Preview/browser smoke desktop-mobile, serta cleanup fixture selesai.

---

## Batch 7a — CAR Major / Minor

**Status:** `NOT_STARTED`

No CAR implementation found.

---

## Batch 7b — CAR OFI + CAR Tracker

**Status:** `NOT_STARTED`

Sidebar entry exists as disabled, but no implementation was found.

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

The stabilization database foundation and implemented audit-execution batches through Batch 6a have
completed their required verification gates. Batch 6a is now `VERIFIED_COMPLETE`.

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
Batch 6b    IMPLEMENTED_UNVERIFIED
Batch 7+    NOT_STARTED
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
