/*
# Store audit scope symbols per matrix cell

1. Purpose
- Move the *1 and *2 choices from the process master record to each process–section cell in the Annual Audit Plan matrix.
- This lets users mark only the sections that need each audit scope.

2. Modified tables
- `audit_plan_seksi_link`
- Add `flag_audit_proses_shift_produk` (boolean, default false): displays *1 for this process–section cell.
- Add `flag_lingkup_pdca` (boolean, default false): displays *2 for this process–section cell.

3. Data safety
- Existing rows are preserved.
- Both new columns default to false, so existing matrix symbols keep their current appearance until selected.

4. Security
- The existing RLS and shared single-tenant policies remain unchanged.
*/

ALTER TABLE audit_plan_seksi_link
  ADD COLUMN IF NOT EXISTS flag_audit_proses_shift_produk boolean NOT NULL DEFAULT false;

ALTER TABLE audit_plan_seksi_link
  ADD COLUMN IF NOT EXISTS flag_lingkup_pdca boolean NOT NULL DEFAULT false;
