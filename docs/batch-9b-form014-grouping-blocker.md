# Batch 9b — FORM-014 grouping blocker

## Status

Batch 9b implementation is intentionally **blocked before code/schema implementation** because the current repository cannot deterministically assign Product and Manufacturing Findings to one FORM-014 page group when an Instruction row contains multiple matrix marks.

This document records the blocker discovered during implementation review so the branch can be reviewed through a PR without introducing speculative schema or incorrect report behavior.

## Confirmed conflict

An `audit_instruction_rows` row can contain multiple values in:

- `matriks_produk_marks` — multiple Plant / Target Model pairs
- `matriks_manufaktur_shift_marks` — multiple Plant / Shift pairs

The Instruction UI permits multiple selections.

A formal Finding currently stores only the source linkage needed to reach the Instruction/checklist context, including:

- `instruction_row_id`
- `source_type`
- `source_item_id`

It does **not** persist an authoritative page-group context such as:

- Product `plant_id`
- Manufacturing `plant_id + shift_id`
- normalized matrix-mark identity
- execution-instance identity that resolves to one Plant / Shift or Plant

The current Product and Manufacturing Finding source paths ultimately resolve to the checklist / Instruction row, but not to one specific matrix mark.

Therefore, if one Instruction row contains multiple unique Product Plants or multiple unique Manufacturing Plant/Shift pairs, FORM-014 cannot determine which page group owns each Finding without either guessing or duplicating Findings.

Both behaviors are prohibited by the Batch 9b design.

## Required FORM-014 behavior

The planned FORM-014 design remains:

- one report = one Audit Instruction / audit round + one audit type
- Audit Sistem, Audit Manufaktur, and Audit Produk remain isolated
- System page groups use `proses.nama_proses`
- Manufacturing labels use `Audit Manufaktur {Shift} {Plant}`
- Product labels use `Audit Produk {Plant}`
- no Finding may be duplicated across ambiguous matrix groups
- no arbitrary "first" Plant / Shift may be chosen

## Safest resolution options

### Option 1 — add authoritative execution context upstream

Persist the executed matrix context on the source execution/checklist path so a Finding can inherit it through its existing source linkage.

Required minimum context:

- Manufacturing: one authoritative `plant_id + shift_id`
- Product: one authoritative `plant_id`

This keeps report-specific semantics out of `findings`.

### Option 2 — restrict one Instruction row to one unique execution context

Allow only one Product Plant or one Manufacturing Plant/Shift pair per applicable Instruction row before execution.

This is simpler but changes current Instruction semantics and may conflict with historical multi-mark rows.

### Option 3 — normalize execution instances per matrix mark

Keep planning rows multi-mark, but create separate execution/checklist instances for each matrix context.

Each execution instance owns exactly one:

- Manufacturing Plant/Shift pair, or
- Product Plant

Findings then inherit deterministic grouping through their source item / execution instance.

This is the strongest normalized model but requires the widest upstream change.

## Recommendation

Prefer **Option 1 or Option 3**, with normalized execution context upstream.

Do not implement FORM-014 grouping by guessing, taking the first matrix mark, or duplicating one Finding into every matrix page.

## Implementation state

No Batch 9b feature code, migration, or hosted database mutation has been applied as part of this blocker analysis.

The next implementation step must start only after the authoritative Product/Manufacturing execution-context model is selected.
