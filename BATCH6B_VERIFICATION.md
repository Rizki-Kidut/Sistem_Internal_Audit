# Batch 6b Verification Record — Pelaksanaan Audit

Date: 22 Aug 2026

## Status

`VERIFIED_COMPLETE_PENDING_MERGE`

This record documents the final verification state of Batch 6b before PR #8 is merged to `main`.

## Verified architecture

- Checklist Audit is preparation-only for System, Product, and Manufacturing/Shift.
- Pelaksanaan Audit is execution-only and reuses the same source checklist records.
- Temuan (PLOR) remains the only formal Finding workspace.
- Product and Manufacturing/Shift use the two-stage preparation lifecycle:
  - `Draft` = preparation editable, execution blocked.
  - `Selesai` = user-facing `Siap Pelaksanaan`; preparation locked, execution allowed.
- Final audit completion remains exclusively `audit_instruction_rows.cek_selesai=true` through the Batch 6b completion RPC.
- Reopen preserves checklist source IDs, execution values, and Finding linkage.

## Applied Staging migrations

CertiTrack Staging project: `wlsmqufirefmscjwaoka`.

- `20260822004154 create_batch6b_audit_execution`
- `20260822004455 harden_batch6b_execution_rpc_security`
- `20260822061814 refine_batch6b_checklist_execution_separation`
  - repository migration: `supabase/migrations/20260822110000_refine_batch6b_checklist_execution_separation.sql`
- `20260822085141 align_preparation_ready_execution_guards`
  - repository migration: `supabase/migrations/20260822120000_align_preparation_ready_execution_guards.sql`

The applied migrations are immutable. Any future database correction must use a new additive migration.

## Security verification

- Supabase Security Advisor: 0 security lints after the final migration.
- `audit_execution_blockers(uuid)` remains `SECURITY INVOKER`.
- `complete_audit_execution(uuid)` remains `SECURITY INVOKER`.
- `reopen_audit_execution(uuid)` remains `SECURITY INVOKER`.
- Batch 6b trigger helpers remain private from `PUBLIC`, `anon`, and `authenticated` where intended.
- Existing RLS-authoritative frontend access remains in place.

## Runtime verification

### System

PASS:

- empty Judgement is not treated as `O`;
- Judgement and Hasil Observasi are required together;
- completion blockers report missing Hasil Observasi/Judgement;
- completion and reopen work through the public RPC under the frontend role;
- completed source rows are locked;
- reopened execution preserves source data.

### Product

PASS:

- `Draft` allows preparation changes but blocks execution changes;
- `Siap Pelaksanaan` allows only Product execution fields;
- structural changes are blocked while ready;
- OK does not generate a Finding;
- NG + A/B/C synchronizes the formal Finding link;
- Finding synchronization remains database-authoritative;
- final completion succeeds after execution + formal PLOR are complete;
- final `cek_selesai` lock blocks further source changes;
- reopen preserves execution and Finding linkage.

### Manufacturing/Shift

PASS:

- `Draft` allows preparation changes but blocks execution changes;
- `Siap Pelaksanaan` allows only Hasil Pengamatan + Judgement execution fields;
- structural changes are blocked while ready;
- O does not generate a Finding;
- A/B/C synchronizes a formal Finding;
- final completion succeeds after execution + formal PLOR are complete;
- final `cek_selesai` lock blocks source changes;
- reopen preserves execution and Finding linkage.

Temporary runtime fixtures QA-9911 and QA-9912 were cleaned after database verification with zero residual Instruction rows, Product/Manufacturing checklists, or Findings.

## Manual browser smoke

Manual real-browser smoke was completed against Staging and confirmed by the user.

PASS:

- System Checklist is preparation-only with five user-facing Elemen Proses.
- System Pelaksanaan exposes only per-question Hasil Observasi + Judgement.
- System Judgement defaults empty and stable question numbering is preserved across accordion state.
- Product Checklist is preparation-only.
- Product Pelaksanaan is disabled in Draft and enabled after `Siap Pelaksanaan`.
- Product execution exposes only actual sample, Hasil Pemeriksaan, OK/NG, and Finding category when NG.
- Manufacturing/Shift Checklist is preparation-only.
- Manufacturing/Shift Pelaksanaan is disabled in Draft and enabled after `Siap Pelaksanaan`.
- Manufacturing/Shift execution exposes only Hasil Pengamatan + Judgement and no Bank/header/structure controls.
- Completion makes source/PLOR read-only and reopen restores execution editing without losing prior data.

## Retained browser-smoke fixtures

The following Staging fixtures are intentionally retained for subsequent Batch 7 CAR verification:

- `QA-9907` — System A/B smoke
- `QA-9908` — System C/OFI smoke
- `QA-9909` — Product smoke
- `QA-9910` — Manufacturing smoke

These fixtures must not be cleaned during the Batch 6b closeout. They are intended to provide ready-made Findings for direct Temuan → CAR smoke testing after Batch 7 is implemented.

## PR #8

PR: `https://github.com/Rizki-Kidut/Sistem_Internal_Audit/pull/8`

Verified pre-merge head before this documentation commit:
`6599fc4f07e762172c4081cd6446202792aab715`

All Batch 6b implementation, database, security, runtime, Vercel Preview, and manual browser-smoke gates have passed. The remaining closeout action is merging PR #8 and recording the resulting merge commit.
