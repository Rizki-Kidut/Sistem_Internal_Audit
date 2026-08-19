# AGENTS.md — CertiTrack Internal Audit Module

## 1. Mandatory First Read

Before changing application code:

1. Read this `AGENTS.md`.
2. Read `PROJECT_PLAN.md`.
3. Read `PROJECT_STATUS.md`.
4. Inspect the relevant existing implementation.
5. Work from the verified current state, not from assumptions.
6. Update `PROJECT_STATUS.md` after every meaningful implementation task.

`PROJECT_PLAN.md` = intended final product behavior.

`PROJECT_STATUS.md` = audited state of this repository.

Existing code = source of truth for what is physically present today.

---

## 2. Active Repository Root

This GitHub export contains **two copies of the app**:

```text
/
├── src/                    ← ACTIVE / NEWER implementation
├── supabase/migrations/    ← ACTIVE / NEWER migrations
├── package.json
└── project/                ← OLDER snapshot
```

The root implementation has files for Jadwal Audit, Tim Audit, Instruksi Audit, Plant Admin,
and Checklist Sistem that do not exist in the nested `project/` snapshot.

### Rule

- Make normal development changes only in root `src/`, root config files, and root `supabase/migrations/`.
- Treat `project/` as an old snapshot/reference only.
- Do not maintain both copies in parallel.
- Do not delete `project/` unless the user explicitly asks for repository cleanup.

---

## 3. Current Stack

The audited repository uses:

- Vite
- React 18
- TypeScript
- Tailwind CSS
- Supabase
- Lucide React

Data access is already organized under:

```text
src/services/
```

Central domain helpers/constants are under:

```text
src/lib/
```

Continue this architecture.

UI components must not call Supabase or `localStorage` directly.

---

## 4. Existing External-Module Dependency

The target product specification says these modules already exist and must not be rebuilt:

- Calibration
- Auditor Competency / Training

However, **this exported repository does not contain their real implementation**.

`src/App.tsx` currently routes `kalibrasi` and `training` to `ConstructionPlaceholder`.

Batch 3b also contains a local table/service:

```text
auditors
src/services/auditorService.ts
```

This is currently functioning as a stand-in/proxy for the missing Training module.

### Rules

- Do not expand the local `auditors` table into a second permanent Training system.
- Do not delete it blindly, because current Tim Audit and Instruksi Audit code depends on it.
- When the real Training module/data source becomes available, integrate through an adapter/service
  and migrate callers safely.
- Do not invent the missing external Training schema.
- Record integration assumptions in `PROJECT_STATUS.md`.

Calibration is outside the current Internal Audit scope. Leave its placeholder untouched unless the
user supplies the actual Calibration implementation or explicitly asks for integration.

---

## 5. Naming Compatibility

The original Bolt prompt uses conceptual names such as:

```text
kodeAudit
programId
tanggalMulai
```

The actual repository consistently uses snake_case for Supabase-facing types:

```text
kode_audit
program_id
tanggal_mulai
```

### Rule

Preserve the repository's existing snake_case convention.

Do **not** bulk rename `kode_audit` to `kodeAudit`.

When `PROJECT_PLAN.md` says `kodeAudit`, map it conceptually to repository `kode_audit`.

Do not introduce additional aliases such as:

- `auditCode`
- `audit_code`
- `kodeAuditInternal`
- arbitrary duplicate fields

unless an explicit migration requires a separate semantic concept.

---

## 6. Two Different Audit Identifiers Exist Today

The repository currently uses:

```text
audit_schedules.kode_audit
→ IA-{tahun}-{NNN}
```

and later:

```text
audit_instruction_rows.kode_audit
→ QA-01, QA-02, ...
```

The **QA-xx value is the intended central cross-document Internal Audit identifier** for later
Checklist → Agenda → Finding → CAR → Report flow.

Treat the IA value as the existing schedule/session identifier.

Do not conflate these two concepts.

Do not perform a destructive column rename until all references and existing database data are audited.

---

## 7. Non-Negotiable Product Rules

### UI

Maintain the existing CertiTrack visual language:

- sidebar blue-800
- Inter font
- Tailwind
- Indonesian language
- Indonesian date presentation
- existing card/table/modal/form/badge patterns

### Auto-fill

If an upstream document already owns a value:

- derive/auto-fill it;
- show read-only when appropriate;
- do not force the user to type it again.

### Finding result categories

Allowed result values:

- `O` = Sesuai
- `A` = Major
- `B` = Minor
- `C` = OFI / Peluang Improvement
- `N-A` where supported

Rules:

- O does not create a finding.
- A/B/C create findings.
- Product `NG` requires category selection A/B/C.
- C requires `saranPerbaikan`.

### Workflow

Rencana Audit Tahunan
→ Program Internal Audit
→ Instruksi Internal Audit
→ Jadwal & Tim
→ Checklist
→ Agenda
→ Temuan / PLOR
→ CAR
→ Daftar Ketidaksesuaian / Laporan
→ Weakness Analysis
→ Rangkuman Hasil Audit

Do not create later-stage duplicate data when it can be derived from an upstream record.

---

## 8. Data-Access Rules

### Services

React components should call reusable functions in `src/services/`.

Do not put direct Supabase calls into UI components.

### Required validation

Required business validation must exist in the save/domain/service layer.

UI validation alone is not sufficient.

Examples:

- Scheduled requires a valid scope.
- independence justification when required.
- mandatory evidence uploads.
- completion prerequisites.

### Computed values

Keep computed values computed unless the specification explicitly requires a historical snapshot.

Examples:

- `statusProgress`
- report totals
- finding narrative
- report grouping
- inherited managers/team data

### Nullable relations

Use safe access/optional chaining for optional relations.

### Constants

Use centralized constants/enums for finite domain values.

Do not introduce new magic strings where a constant already exists.

---

## 9. Identifier Generation

Identifier generation must be centralized and safe under repeated use.

The audited repository currently contains duplicated QA identifier logic in:

```text
src/lib/codeGenerator.ts
src/services/auditInstructionService.ts
```

and `generateFromProgram()` contains another inline sequence.

### Required direction

Consolidate QA sequence generation into one reusable implementation.

The central QA number must not restart at `QA-01` for every new program/instruction if the identifier
is expected to be globally unique within the application's chosen scope.

Before changing sequence semantics, inspect existing production data and constraints.

### CAR

`kodeCAR` is **not** an independent sequence.

For a CAR related to a finding:

```text
kodeCAR === finding.kodeTemuan
```

---

## 10. Database Migration Discipline

Root `supabase/migrations/` is the version-controlled database history.

### Rules

- Every new table/column/index/policy required by application code must have a migration.
- Do not rely only on changes made manually in the hosted Supabase dashboard.
- Do not silently assume a table exists just because a service references it.
- Prefer adding a new corrective migration rather than rewriting an old migration that may already
  have been applied to a live environment.
- Never destroy production data to make a migration easier.
- Preserve revision/history records where required by the business rules.

### Important audited gap

Root source references these tables, but no matching root migration is present in the uploaded repo:

```text
audit_instructions
audit_instruction_rows
plants
target_models
shifts
checklists
checklist_items
```

Before building later batches on top of them, reconcile the database schema with the live Supabase
project or create the missing version-controlled migrations.

---

## 11. Atomic Operations

When `PROJECT_PLAN.md` marks an operation atomic, partial state is not acceptable.

Examples:

- Generate dari Program
- Generate Semua Proses

A manual "best effort rollback" is not equivalent to a transaction if other records can remain changed.

Prefer a Supabase/Postgres RPC/transaction or another mechanism that truly protects all affected rows.

---

## 12. Existing Migration Safety Issue

The audited migration:

```text
supabase/migrations/20260805020305_create_proses_master_tables.sql
```

contains a SELECT policy named for `proses_seksi` but creates it on table `proses`.

Do not edit the historical migration if it may already have been applied.

Add a corrective migration that:

1. removes the wrongly placed policy if necessary;
2. creates the intended SELECT policy on `proses_seksi`;
3. preserves existing data.

---

## 13. Batch Execution Policy

Target order:

1. Batch 1 — Kelola Proses + Rencana Audit Tahunan + Bank Checklist
2. Batch 2 — Program Internal Audit
3. Batch 3a — Jadwal Audit
4. Batch 3b — Tim Audit + Validasi
5. Batch 4a — Instruksi Internal Audit: Data
6. Batch 4b — Instruksi Internal Audit: Generate + Grid
7. Batch 5a — Checklist Sistem
8. Batch 5b — Checklist Audit Produk
9. Batch 5c — Checklist Audit Manufaktur & Shift
10. Batch 5d — Agenda Internal Audit
11. Batch 6a — Temuan / PLOR
12. Batch 6b — Pelaksanaan
13. Batch 7a — CAR Major/Minor
14. Batch 7b — CAR OFI + Tracker
15. Batch 8a — Daftar Ketidaksesuaian
16. Batch 8b — Laporan Internal Audit
17. Batch 9a — Analisa Weakness Point
18. Batch 9b — Rangkuman Hasil Internal Audit
19. Final consistency review

Do not implement future batches merely because types/placeholders are easy to add.

---

## 14. Stabilization Gate Before Batch 5b

Based on the repository audit, do not treat Batch 5a as a clean handoff yet.

Unless the user explicitly instructs otherwise, address high-risk foundation issues before beginning Batch 5b:

1. reconcile missing migrations for Batch 4/5 tables;
2. fix the `proses_seksi` SELECT RLS policy through a corrective migration;
3. centralize/fix QA sequence generation;
4. make Generate-from-Program genuinely atomic;
5. implement the missing "fill grid creates scope/team" behavior from Batch 4b;
6. add service-layer validation where currently UI-only;
7. decide/document how the temporary `auditors` proxy will connect to the real Training module;
8. wire Checklist Sistem into the intended Detail Sesi Audit flow, not only Instruksi Audit detail;
9. complete missing Batch 2 dynamic period-label editing;
10. preserve all existing working functionality while doing the above.

Do not rewrite the app from scratch.

---

## 15. Change Discipline

Before a task:

1. locate the matching plan section;
2. inspect types, service, UI, migrations, and downstream dependencies;
3. check `PROJECT_STATUS.md`;
4. identify existing implementation and known deviations.

During a task:

- make the smallest coherent change;
- preserve working behavior;
- avoid unrelated refactors;
- reuse components/services;
- avoid unnecessary dependencies;
- do not alter the nested `project/` snapshot;
- do not change missing external modules by guessing their schema.

After a task:

Run only scripts that exist in `package.json`, preferably:

```bash
npm run typecheck
npm run lint
npm run build
```

Run tests if a test script exists.

If dependencies cannot be installed because of environment/network limitations, report that as an
environment verification limitation rather than pretending the build passed.

Update `PROJECT_STATUS.md` with:

- changed status,
- verified functionality,
- known issues,
- files changed,
- database migration added/changed,
- validation results.

---

## 16. Status Definitions

Use:

- `NOT_STARTED`
- `IN_PROGRESS`
- `BLOCKED`
- `IMPLEMENTED_UNVERIFIED`
- `VERIFIED_COMPLETE`

`VERIFIED_COMPLETE` requires implementation review **and** the relevant available checks/integration
verification. A visible menu or component alone is not enough.

---

## 17. Security / Repository Hygiene

- Never commit `.env`.
- Never commit Supabase service-role keys, passwords, tokens, or private credentials.
- Reuse `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` conventions unless architecture changes.
- Do not log secrets.
- Do not loosen RLS accidentally while adding migrations.
- Do not make destructive migrations without explicit need and data-preservation analysis.

---

## 18. Instruction Precedence

If instructions conflict:

1. user's latest explicit instruction;
2. `AGENTS.md` engineering/workflow rules;
3. `PROJECT_PLAN.md` target product behavior;
4. `PROJECT_STATUS.md` audited implementation state;
5. existing code for current technical reality.

If plan and code disagree, do not silently rewrite everything to match the plan.
Document the mismatch and implement the smallest safe migration toward the intended behavior.
