# FORM-014 grouping decision

The former grouping blocker is resolved by the authoritative business rules confirmed for Batch 9b.

- Manufacturing: one QA / `audit_instruction_row` is one Plant + one Shift execution context. A Finding inherits that context through `instruction_row_id`. A completed QA with no formal Finding remains represented as `ZERO FINDING`; zero or multiple unique Plant/Shift contexts are invalid source data and block generation/finalization.
- Product: one QA / `audit_instruction_row` is one Plant/Factory execution context. Findings inherit that context through `instruction_row_id`. A completed zero-Finding QA remains represented; zero or multiple unique Plants are invalid source data.
- System: rows are grouped by authoritative `proses_id`.

FORM-014 never guesses the first matrix mark, duplicates Findings, or adds Plant/Shift fields to Findings. Formal population is isolated by exact Instruction row, audit type, and `PUBLISHED`/`LEGACY_ESTABLISHED` status.
