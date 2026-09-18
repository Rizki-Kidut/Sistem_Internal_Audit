# Batch 9b — FORM-014 grouping blocker

## Status

Batch 9b implementation remains intentionally **blocked before code/schema implementation**, but only for **Audit Produk**.

The previous Manufacturing blocker is resolved by the clarified business rule:

> One Manufacturing `audit_instruction_row` / QA number is the authoritative execution-context boundary and represents exactly one Plant + one Shift.

No speculative FORM-014 feature implementation has been added while the Product grouping rule remains unresolved.

## Manufacturing — resolved

For Audit Manufaktur:

- one `audit_instruction_rows.id` = one Manufacturing QA execution context;
- `kode_audit` is the QA identity;
- that QA has its own checklist and Finding population;
- the row must resolve to exactly one deduplicated Plant + Shift pair;
- Findings belong to that QA through `findings.instruction_row_id`;
- no Plant/Shift fields need to be added to `findings` solely for FORM-014.

FORM-014 Manufacturing grouping therefore uses:

`Finding → instruction_row_id → exact Manufacturing QA row → Plant + Shift context`.

Display label:

`Audit Manufaktur {Shift} {Plant}`

Example:

- QA 24 → Shift 1 + Fact 2 → `Audit Manufaktur Shift 1 Fact 2`
- QA 26 → Shift 2 + Fact 2 → `Audit Manufaktur Shift 2 Fact 2`

If one Manufacturing QA row unexpectedly resolves to zero or multiple unique Plant/Shift pairs, that QA is invalid for deterministic FORM-014 grouping and must be blocked with a clear validation error. Do not guess, choose the first mark, or duplicate Findings.

### Manufacturing ZERO FINDING rule

A completed Manufacturing QA must remain represented even when it has no formal Findings.

If:

- the QA row is represented by the selected Manufacturing report scope;
- `audit_instruction_rows.cek_selesai = true`; and
- formal Finding count is zero;

then FORM-014 must explicitly show:

`ZERO FINDING`

Formal Finding population remains:

`review_status IN ('PUBLISHED','LEGACY_ESTABLISHED')`

A QA with `cek_selesai = false` must never be presented as ZERO FINDING and must block Finalization.

## Product — remaining blocker

The repository does not currently establish the equivalent invariant:

> one Product QA / `audit_instruction_row` = one Plant

An `audit_instruction_rows` Product row can structurally contain multiple entries in:

`matriks_produk_marks = [{ plant_id, target_model_id }, ...]`

The active Instruction UI permits multiple Product marks.

The Product execution path currently has:

- one Product checklist related through `checklist_produk.row_id`;
- Product phases/items without an authoritative `plant_id`;
- Findings related to the Instruction/source item but without a Product Plant execution context.

Therefore, for a Product QA whose matrix marks contain multiple unique Plants, FORM-014 cannot deterministically choose the required label:

`Audit Produk {Plant}`

without either:

- arbitrarily selecting one Plant; or
- duplicating Findings across Plant pages.

Both behaviors are prohibited.

## Decision required for Product

### Option A — business invariant: one Product QA = one unique Plant

If actual Product audit operations guarantee that every Product QA represents exactly one Plant, FORM-014 can use the same QA-boundary principle as Manufacturing:

- one Product `audit_instruction_row` = one Product page group;
- Findings belong through `instruction_row_id`;
- the row must resolve to exactly one unique Plant;
- historical rows with multiple Plants become a clear data-validation blocker;
- Product label becomes `Audit Produk {Plant}`.

### Option B — one Product QA may genuinely cover multiple Plants

If a Product QA may legitimately represent multiple Plants, an authoritative Product execution-context relationship must be added upstream before FORM-014 Product grouping can be implemented.

Do not add report-only guesswork to Findings.

## FORM-014 rules already confirmed

The eventual Batch 9b implementation must preserve these confirmed rules:

- one FORM-014 = one Audit Instruction / audit round + one audit type;
- Audit Sistem, Audit Manufaktur, and Audit Produk are isolated;
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
- each QA/process group starts on a new physical page;
- document code is `Q-120-ISE-001-FORM-014-REV.1`;
- sidebar location is Pelaksanaan Internal Audit → Rangkuman Hasil Audit;
- Final reports are immutable historical snapshots.

## Implementation state

No Batch 9b feature code or migration has been implemented yet.

No Staging or Production database mutation has been performed for Batch 9b.

Nested `/project` and historical migrations remain untouched.

Implementation should resume after the Product QA grouping invariant is confirmed.
