# PROJECT_STATUS.md — CertiTrack Internal Audit Module

## Stabilization Pass — 19 Aug 2026

**Status:** `IMPLEMENTED_UNVERIFIED`

The stabilization gate was implemented against the repository-root application only. Batch 5b was
not started and the nested `project/` snapshot was not modified.

### Completed

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
- [x] Added dynamic period-label editing (add, rename, remove) and keeps every step's
      `periode_target` array aligned with the labels.
- [x] Enforced Scheduled scope prerequisites inside `saveAuditSchedule()`, rather than only in UI.
- [x] Enforced required independence justification inside `upsertTeam()` in addition to UI.
- [x] Added required checklist header/item validation in the checklist service.
- [x] Enabled Detail Sesi Audit → Checklist and reused the existing Checklist Sistem component and
      `checklists`/`checklist_items` records by resolving instruction rows through propagated QA codes.
      No parallel checklist storage was introduced.
- [x] Added transactional synchronization from instruction-grid auditor assignments to the related
      schedule team.

### Validation result

- [x] `npm run typecheck` passed.
- [x] `npm run build` passed.
- [ ] `npm run lint` remains blocked by 26 pre-existing unused-import/function errors, including
      errors inside the protected nested `project/` snapshot. A detached worktree comparison against
      the base commit produced the same 26 errors, so this stabilization diff introduces none.
- [ ] Supabase migrations/RPCs require clean-database and existing-data integration verification
      against a real project; no Supabase credentials or local CLI stack are present in this export.
- [ ] Browser screenshot automation is unavailable in the current container, so the perceptible
      Program/Detail Sesi UI changes were verified by typecheck/build only.

### Remaining blockers / decisions

- The local `auditors` table remains a temporary compatibility proxy. Tim Audit and Instruksi must
  move behind an adapter when the real Training module source/schema is supplied; no external schema
  was invented and the proxy was not expanded.
- Existing duplicate QA values, if present in a live database, are preserved and reported by the
  conditional uniqueness setup; they must be audited before a unique index can be added there.
- Process-master reorder/schema divergence and the Program document-code difference remain product
  decisions outside this smallest safe stabilization change.
- Batch 5b and all later batches remain `NOT_STARTED`.

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
- `IMPLEMENTED_UNVERIFIED` — implementation appears complete by static review but runtime/build/integration verification is unavailable
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

The repository defines:

```text
npm run build
npm run lint
npm run typecheck
```

A dependency installation was attempted in the audit environment.

The environment could not reach `registry.npmjs.org` (`EAI_AGAIN`), leaving an incomplete temporary
`node_modules` in the audit workspace. Because of that:

- production build could not be reliably executed;
- lint could not be reliably executed;
- typecheck could not be reliably executed.

This is recorded as an **audit-environment limitation**, not proof that the repository itself fails.

A clean local/Codex environment with dependency access must rerun:

```bash
npm ci
npm run typecheck
npm run lint
npm run build
```

No test script is currently defined in `package.json`.

---

# 3. Cross-Cutting Findings

## 3.1 Missing version-controlled migrations for current source

Root source references:

```text
audit_instructions
audit_instruction_rows
plants
target_models
shifts
checklists
checklist_items
```

but the uploaded root `supabase/migrations/` contains migrations only through the Batch 3b auditor/team
foundation plus earlier fixes.

**Impact:** the current source tree is not fully reproducible from version-controlled migrations.

**Priority:** HIGH

---

## 3.2 `proses_seksi` RLS SELECT policy migration bug

Migration:

```text
supabase/migrations/20260805020305_create_proses_master_tables.sql
```

drops `anon_select_proses_seksi` from `proses_seksi`, but then creates that policy on table `proses`.

**Impact:** `proses_seksi` may not receive the intended SELECT policy after a clean migration.

**Priority:** HIGH

Use a new corrective migration if the original migration may already be applied.

---

## 3.3 QA identifier generation is duplicated and inconsistent

QA generation logic exists in multiple places:

```text
src/lib/codeGenerator.ts
src/services/auditInstructionService.ts
generateFromProgram() inline sequence
```

`generateFromProgram()` currently starts:

```text
QA-01
```

again for each generated instruction because its loop sequence begins from 1.

**Impact:** duplicate central `kode_audit` values are possible across programs/instructions unless the
database happens to reject them.

**Priority:** CRITICAL before later cross-document linking.

---

## 3.4 Generate-from-Program is not fully atomic

`generateFromProgram()`:

1. creates instruction;
2. batch-inserts rows;
3. updates related scopes one by one;
4. on error, deletes the instruction.

If a scope update succeeds and a later scope update fails, deleting the instruction does not restore
the already changed `audit_scopes.kode_audit`.

**Impact:** partial cross-document state can remain.

**Priority:** HIGH

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
- [ ] RLS SELECT policy for `proses_seksi` has a migration bug
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
- [x] dynamic rendering of period columns based on `periode_label`
- [x] step period toggles
- [x] step reorder
- [x] Draft / Approved handling

### Missing / divergent

- [ ] no UI was found to change the **number or names** of `periode_label`
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
- [ ] independence justification requirement is not enforced in `auditTeamService` save/domain logic
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

### Missing / risks

- [ ] no root migration exists for `audit_instructions`
- [ ] no root migration exists for `audit_instruction_rows`
- [ ] no root migration exists for `plants`
- [ ] no root migration exists for `target_models`
- [ ] no root migration exists for `shifts`
- [ ] immutability of generated QA code is mostly protected by UI flow, not clearly enforced at domain/database level
- [ ] code generation is duplicated across helpers/services
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

### Missing / incorrect

- [ ] **critical:** generated QA sequence restarts at `QA-01` inside every `generateFromProgram()` call
- [ ] generator is not centralized; multiple QA generation implementations exist
- [ ] Generate button is on the Instruksi Audit flow, not the Program Internal Audit page requested in the plan
- [ ] if schedule/team does not exist, filling the instruction grid does **not** create a corresponding
      `auditScope` + `auditTeam`
- [ ] atomicity is incomplete; already propagated scope updates are not reverted by deleting the instruction
- [ ] only the first matched scope is used per process for team/propagation logic
- [ ] missing Batch 4 database migrations prevents reproducible setup

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

### Missing / incorrect

- [ ] no root migration exists for `checklists`
- [ ] no root migration exists for `checklist_items`
- [ ] target plan says Checklist belongs in **Detail Sesi Audit → Checklist tab**; current implementation is
      inside **Instruksi Internal Audit detail**
- [ ] `JadwalAuditPage` still marks Checklist tab as `(segera)` / disabled
- [ ] save-layer validation for required checklist/item fields is incomplete
- [ ] non-Regular checklist types remain placeholders as expected until 5b/5c
- [ ] no runtime verification

### Key files

```text
src/components/pages/instruksi-audit/ChecklistTab.tsx
src/services/checklistService.ts
src/lib/types.ts
src/lib/enums.ts
```

---

## Batch 5b — Checklist Audit Produk

**Status:** `NOT_STARTED`

No Product Checklist data model/service/component matching Batch 5b was found.

---

## Batch 5c — Checklist Audit Manufaktur & Shift

**Status:** `NOT_STARTED`

No Manufacturing/Shift Checklist implementation matching Batch 5c was found.

---

## Batch 5d — Agenda Internal Audit

**Status:** `NOT_STARTED`

Agenda remains a disabled/soon tab in Detail Sesi Audit.

---

## Batch 6a — Temuan / PLOR

**Status:** `NOT_STARTED`

Scaffolding exists only in the form of:

- finding category constants
- `finding_id` placeholder fields

No Finding/PLOR model, service, trigger, narrative formatter, or Temuan page implementation was found.

---

## Batch 6b — Pelaksanaan

**Status:** `NOT_STARTED`

Pelaksanaan remains a disabled/soon tab.

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

The repository is **not a clean "Batch 5a complete → start 5b" state**.

The practical handoff is:

```text
Batch 1     IN_PROGRESS
Batch 2     IN_PROGRESS
Batch 3a    IN_PROGRESS
Batch 3b    BLOCKED (external Training integration)
Batch 4a    IN_PROGRESS
Batch 4b    IN_PROGRESS
Batch 5a    IN_PROGRESS
Batch 5b+   NOT_STARTED
```

The visible feature frontier is **Batch 5a**, but foundation corrections should happen first.

---

# 6. Recommended Next Work — Stabilization Pass

## Priority 0 — Preserve current work

- [ ] Work only in repository-root source
- [ ] Do not regenerate the app from scratch
- [ ] Do not delete existing working Batch 1–5a UI
- [ ] Do not modify nested `project/`

## Priority 1 — Database reproducibility

- [ ] inspect live Supabase schema if credentials/environment are available
- [ ] add missing migrations for:
  - `audit_instructions`
  - `audit_instruction_rows`
  - `plants`
  - `target_models`
  - `shifts`
  - `checklists`
  - `checklist_items`
- [ ] add corrective migration for `proses_seksi` SELECT RLS policy

## Priority 2 — Central QA identifier

- [ ] choose one reusable QA generator
- [ ] remove/retire duplicate unused generator paths safely
- [ ] make Generate-from-Program use the same generator
- [ ] ensure sequence does not restart per program
- [ ] add/verify database uniqueness appropriate to the intended scope
- [ ] preserve existing QA values

## Priority 3 — Batch 4b completeness

- [ ] make Generate-from-Program truly atomic
- [ ] ensure all relevant scope propagation is handled
- [ ] implement missing "grid creates scope/team when absent" behavior
- [ ] move/add Generate entry point to Program Internal Audit as specified

## Priority 4 — Complete earlier requirements

- [ ] add period-label editor to Batch 2
- [ ] add required service-layer Scheduled validation
- [ ] add required service-layer independence-justification validation
- [ ] review process-master reorder/schema divergence
- [ ] decide whether Program document code must be `FORM-002` or current `FORM-002-REV.1`

## Priority 5 — Finish Batch 5a integration

- [ ] provide Checklist Sistem through Detail Sesi Audit → Checklist
- [ ] reuse existing Checklist component/data rather than duplicate it
- [ ] keep Instruksi entry/access only if useful, but do not create parallel checklist data
- [ ] add save-layer validation for required checklist fields/items

## Priority 6 — Training integration decision

- [ ] obtain/identify actual Auditor Competency/Training source
- [ ] introduce an adapter interface if needed
- [ ] migrate Tim Audit and Instruksi readers from local proxy to real source
- [ ] only then deprecate/remove duplicate `auditors` storage if appropriate

---

# 7. Recommended First Codex Task

Use this before asking Codex to build Batch 5b:

```text
Read AGENTS.md, PROJECT_PLAN.md, and PROJECT_STATUS.md completely.

The repository has already been audited. Do not restart the project and do not reimplement completed UI.

Perform the Stabilization Pass described in PROJECT_STATUS.md, starting with database reproducibility and the central QA identifier.

First inspect the actual root source and root Supabase migrations and confirm the audit findings.

Then:
1. add safe corrective/missing migrations without destroying existing data;
2. centralize QA code generation and prevent QA-01 from restarting per generated program;
3. make Generate-from-Program atomic across instruction rows and scope propagation;
4. implement the missing Batch 4b scope/team creation behavior when no schedule/team exists;
5. add missing service-layer validation;
6. wire the existing Checklist Sistem implementation into Detail Sesi Audit without duplicating checklist data;
7. update PROJECT_STATUS.md.

Do not start Batch 5b yet.
Do not modify the nested project/ snapshot.
Run npm typecheck, lint, and build when dependencies are available.
Stop after reporting all changes and remaining blockers.
```

---

# 8. Verification Needed After Stabilization

- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] test clean Supabase migration path
- [ ] test existing-data upgrade path
- [ ] test annual plan
- [ ] test program creation
- [ ] test schedule + scope
- [ ] test team validation
- [ ] test instruction manual row
- [ ] test Generate from Program with multiple programs
- [ ] verify no duplicate `QA-xx`
- [ ] test Checklist Sistem from Detail Sesi Audit
- [ ] verify no regression in existing Batch 1–5a behavior

Only after this should Batch 5b be started.
