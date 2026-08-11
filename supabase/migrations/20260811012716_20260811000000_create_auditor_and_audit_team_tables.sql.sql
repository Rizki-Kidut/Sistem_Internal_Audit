/*
# CertiTrack — Batch 3b: Tim Audit & Master Auditor

## Deskripsi
Menambahkan modul Training/Auditor master dan Tim Audit per jadwal audit.
Auditor memiliki data kompetensi (kualifikasi, masa berlaku) yang dipakai untuk
validasi otomatis saat penyusunan tim audit. Tim Audit terdiri dari lead auditor,
member, dan auditee area owner.

## New Tables

### auditors (Master Auditor / Training)
- id (uuid, PK)
- nama (text, not null) — nama auditor
- nip (text) — nomor induk pegawai
- departemen (text) — departemen/section auditor
- jabatan (text) — jabatan auditor
- kualifikasi (text[]) — array kualifikasi (mis. "Lead Auditor ISO 9001", "Internal Auditor IATF")
- tanggal_sertifikasi (date) — tanggal perolehan sertifikasi
- tanggal_berlaku (date) — tanggal berakhir masa berlaku sertifikasi
- status (text, default 'Aktif') — Aktif/Nonaktif
- catatan (text) — catatan tambahan
- created_at, updated_at (timestamptz)

### audit_teams (Tim Audit per jadwal)
- id (uuid, PK)
- schedule_id (uuid, FK → audit_schedules.id ON DELETE CASCADE)
- lead_auditor_id (uuid, FK → auditors.id) — ketua tim audit
- member_ids (uuid[]) — array of auditor id untuk anggota tim
- auditee_area_owner_ids (uuid[]) — array of auditor/person id untuk auditee area owner
- catatan_justifikasi (text) — catatan justifikasi jika ada konflik independensi
- created_at, updated_at (timestamptz)

## Indexes
- auditors: (status), (departemen)
- audit_teams: (schedule_id), (lead_auditor_id)

## Security
- Enable RLS on all new tables.
- Anon + authenticated CRUD (single-tenant, no auth screen).
- Policies follow the same pattern as audit_schedules/audit_scopes.

## Important Notes
1. Satu schedule punya maksimal satu audit_teams row (enforced by unique constraint on schedule_id).
2. Auditor kompetensi validation dilakukan di frontend berdasarkan tanggal_berlaku vs tanggal audit.
3. Conflict-of-independence check: auditor.departemen vs scope.seksi_terkait → jika sama, warning.
*/

-- ============================================================
-- AUDITORS (Master Auditor / Training)
-- ============================================================

CREATE TABLE IF NOT EXISTS auditors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  nip text,
  departemen text,
  jabatan text,
  kualifikasi text[] DEFAULT '{}',
  tanggal_sertifikasi date,
  tanggal_berlaku date,
  status text NOT NULL DEFAULT 'Aktif',
  catatan text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditors_status ON auditors (status);
CREATE INDEX IF NOT EXISTS idx_auditors_departemen ON auditors (departemen);

ALTER TABLE auditors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_auditors" ON auditors;
CREATE POLICY "anon_select_auditors" ON auditors FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_auditors" ON auditors;
CREATE POLICY "anon_insert_auditors" ON auditors FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_auditors" ON auditors;
CREATE POLICY "anon_update_auditors" ON auditors FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_auditors" ON auditors;
CREATE POLICY "anon_delete_auditors" ON auditors FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_TEAMS (Tim Audit per jadwal)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL UNIQUE REFERENCES audit_schedules(id) ON DELETE CASCADE,
  lead_auditor_id uuid REFERENCES auditors(id) ON DELETE SET NULL,
  member_ids uuid[] DEFAULT '{}',
  auditee_area_owner_ids uuid[] DEFAULT '{}',
  catatan_justifikasi text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_teams_schedule ON audit_teams (schedule_id);
CREATE INDEX IF NOT EXISTS idx_audit_teams_lead ON audit_teams (lead_auditor_id);

ALTER TABLE audit_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_teams" ON audit_teams;
CREATE POLICY "anon_select_audit_teams" ON audit_teams FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit_teams" ON audit_teams;
CREATE POLICY "anon_insert_audit_teams" ON audit_teams FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_audit_teams" ON audit_teams;
CREATE POLICY "anon_update_audit_teams" ON audit_teams FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_audit_teams" ON audit_teams;
CREATE POLICY "anon_delete_audit_teams" ON audit_teams FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auditors_updated ON auditors;
CREATE TRIGGER trg_auditors_updated BEFORE UPDATE ON auditors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_audit_teams_updated ON audit_teams;
CREATE TRIGGER trg_audit_teams_updated BEFORE UPDATE ON audit_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
