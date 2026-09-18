# Batch 9b — FORM-014 grouping decision

## Status

The authoritative grouping decisions for **Audit Manufaktur** and **Audit Produk** are now resolved.

Batch 9b implementation may proceed.

No report-specific Plant/Shift fields need to be added to `findings` solely for FORM-014.

## Manufacturing — resolved

Business invariant:

> One Manufacturing `audit_instruction_row` / QA number is the authoritative execution-context boundary and represents exactly one Plant + one Shift.

For Audit Manufaktur:

- one `audit_instruction_rows.id` = one Manufacturing QA execution context;
- `kode_audit` is the QA identity;
- that QA has its own checklist and Finding population;
- the row must resolve to exactly one deduplicated Plant + Shift pair;
- Findings belong to that QA through `findings.instruction_row_id`;
- no Plant/Shift fields need to be added to `findings` solely for FORM-014.

FORM-014 Manufacturing grouping:

`Finding → instruction_row_id → exact Manufacturing QA row → Plant + Shift context`

Display label:

`Audit Manufaktur {Shift} {Plant}`

Examples:

- QA 24 → Shift 1 + Fact 2 → `Audit Manufaktur Shift 1 Fact 2`
- QA 26 → Shift 2 + Fact 2 → `Audit Manufaktur Shift 2 Fact 2`

If one Manufacturing QA row unexpectedly resolves to zero or multiple unique Plant/Shift pairs, treat it as invalid source data for deterministic FORM-014 grouping and block generation/finalization with a clear validation error. Do not guess, choose the first mark, or duplicate Findings.

### Manufacturing ZERO FINDING

A completed Manufacturing QA remains represented even when it has no formal Findings.

If:

- the QA row is represented by the selected Manufacturing report scope;
- `audit_instruction_rows.cek_selesai = true`; and
- formal Finding count is zero;

then FORM-014 explicitly shows:

`ZERO FINDING`

Formal Finding population remains:

`review_status IN ('PUBLISHED','LEGACY_ESTABLISHED')`

A QA with `cek_selesai = false` must never be presented as ZERO FINDING and must block Finalization.

## Product — resolved

Business invariant:

> One Product `audit_instruction_row` / QA number is the authoritative execution-context boundary and represents exactly one Factory / Plant.

Actual operation is separated by QA number, for example:

- one QA for Audit Product Factory 1;
- another QA for Audit Product Factory 2.

Each Product QA has its own checklist and Finding population.

Therefore FORM-014 Product grouping follows the same QA-boundary principle as Manufacturing:

- one `audit_instruction_rows.id` = one Product QA execution context;
- `kode_audit` is the QA identity;
- Findings belong through `findings.instruction_row_id`;
- the Product QA row must resolve to exactly one unique Plant after deduplicating `matriks_produk_marks[].plant_id`;
- no Plant field needs to be added to `findings` solely for FORM-014.

FORM-014 Product grouping:

`Finding → instruction_row_id → exact Product QA row → Plant context`

Display label:

`Audit Produk {Plant}`

Examples:

- Product QA Factory 1 → `Audit Produk Fact 1` when the Plant master display name is `Fact 1`;
- Product QA Factory 2 → `Audit Produk Fact 2`.

Do not add another literal "Fact" prefix if `plants.nama` already contains it.

If one Product QA row unexpectedly resolves to zero or multiple unique Plants, treat it as invalid source data and block deterministic FORM-014 generation/finalization. Do not guess, choose the first Plant, or duplicate Findings.

### Product ZERO FINDING

The same completed-QA rule applies to Product.

A Product QA with:

- `cek_selesai = true`; and
- zero formal Product Findings

must still appear as a FORM-014 page and explicitly show:

`ZERO FINDING`

A Product QA with `cek_selesai = false` must never be represented as ZERO FINDING and must block Finalization.

## FORM-014 rules already confirmed

The Batch 9b implementation must preserve these rules:

- one FORM-014 = one Audit Instruction / audit round + one audit type;
- Audit Sistem, Audit Manufaktur, and Audit Produk remain isolated;
- one QA / process group starts on a new physical page;
- Temuan uses the authoritative Finding/PLOR through the existing `formatFindingNarrative()`;
- Verifikasi uses only the latest `AUDITOR_VERIFIED_CLOSE_TO_ADMIN`;
- Temporary target = latest TEMPORARY action due date;
- Permanent target = latest CORRECTIVE/PREVENTIVE due date;
- LTP `CLOSED` maps to Close; all other states map to Open;
- completed represented QA with zero formal Findings is explicitly shown as `ZERO FINDING`;
- one global Rangkuman Temuan appears only on physical page 1;
- Catatan content appears only on physical page 1;
- approval names appear only on physical page 1;
- all later pages use the diagonal approval-body slash;
- document code is `Q-120-ISE-001-FORM-014-REV.1`;
- sidebar location is Pelaksanaan Internal Audit → Rangkuman Hasil Audit;
- Final reports are immutable historical snapshots.

## Implementation state

The grouping decision is now complete.

Batch 9b feature implementation can resume on this branch/PR.

No Batch 9b database migration has yet been applied merely by recording this decision.

Nested `/project` and historical migrations remain untouched.
