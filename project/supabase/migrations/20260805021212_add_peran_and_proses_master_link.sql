-- Add proses_master_id FK to audit_plan_process so rows link to master proses table.
-- Existing manually-typed rows keep proses_master_id = NULL; new rows from sync will have it set.
ALTER TABLE audit_plan_process
  ADD COLUMN IF NOT EXISTS proses_master_id uuid REFERENCES proses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_audit_plan_process_proses_master
  ON audit_plan_process (proses_master_id);

-- Replace boolean terkait with peran enum in audit_plan_seksi_link.
-- peran NULL  = tidak terlibat
-- peran 'utama'   = ◎ seksi pemilik proses
-- peran 'terkait' = O seksi terkait
ALTER TABLE audit_plan_seksi_link
  ADD COLUMN IF NOT EXISTS peran text CHECK (peran IN ('utama','terkait'));

-- Back-fill: existing rows with terkait=true get peran='terkait'
UPDATE audit_plan_seksi_link SET peran = 'terkait' WHERE terkait = true AND peran IS NULL;