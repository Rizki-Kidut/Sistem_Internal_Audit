/*
# CertiTrack — Master Data: Proses yang Diaudit

## Overview
Master data proses yang akan diaudit, ditampilkan sebagai matriks proses x seksi x tanggal.
Setiap proses punya pilihan diaudit tahun ini (active) atau tidak (inactive).
Setiap proses-seksi punya peran: 'utama' (pemilik proses, simbol ◎) atau 'terkait' (simbol O).
Proses bisa punya flag audit: *1 (audit proses + shift + produk) dan *2 (lingkup PDCA).

## Tables

### proses
- id (uuid PK)
- nama_proses (text) — nama proses yang diaudit
- kode_proses (text, unique) — kode unik proses
- diaudit_tahun_ini (bool, default true) — aktif untuk pengisian tahun ini
- tanggal_audit (date, nullable) — tanggal audit terjadwal
- flag_audit_proses_shift_produk (bool, default false) — *1
- flag_lingkup_pdca (bool, default false) — *2
- keterangan (text, nullable)
- created_at, updated_at (timestamptz)

### proses_seksi
- id (uuid PK)
- proses_id (uuid FK → proses.id ON DELETE CASCADE)
- seksi_id (uuid FK → seksi.id ON DELETE CASCADE)
- peran (text, CHECK 'utama'|'terkait') — ◎ atau O
- created_at (timestamptz)
- UNIQUE (proses_id, seksi_id)

## Security
- RLS enabled, all policies TO anon, authenticated USING (true) (no-auth app)
*/

CREATE TABLE IF NOT EXISTS proses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_proses text NOT NULL,
  kode_proses text UNIQUE NOT NULL,
  diaudit_tahun_ini boolean NOT NULL DEFAULT true,
  tanggal_audit date,
  flag_audit_proses_shift_produk boolean NOT NULL DEFAULT false,
  flag_lingkup_pdca boolean NOT NULL DEFAULT false,
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proses_diaudit ON proses (diaudit_tahun_ini);

ALTER TABLE proses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_proses" ON proses;
CREATE POLICY "anon_select_proses" ON proses FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_proses" ON proses;
CREATE POLICY "anon_insert_proses" ON proses FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_proses" ON proses;
CREATE POLICY "anon_update_proses" ON proses FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_proses" ON proses;
CREATE POLICY "anon_delete_proses" ON proses FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS proses_seksi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proses_id uuid NOT NULL REFERENCES proses(id) ON DELETE CASCADE,
  seksi_id uuid NOT NULL REFERENCES seksi(id) ON DELETE CASCADE,
  peran text NOT NULL DEFAULT 'terkait' CHECK (peran IN ('utama','terkait')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proses_id, seksi_id)
);

CREATE INDEX IF NOT EXISTS idx_proses_seksi_proses ON proses_seksi (proses_id);
CREATE INDEX IF NOT EXISTS idx_proses_seksi_seksi ON proses_seksi (seksi_id);

ALTER TABLE proses_seksi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_proses_seksi" ON proses_seksi;
CREATE POLICY "anon_select_proses_seksi" ON proses FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_proses_seksi" ON proses_seksi;
CREATE POLICY "anon_insert_proses_seksi" ON proses_seksi FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_proses_seksi" ON proses_seksi;
CREATE POLICY "anon_update_proses_seksi" ON proses_seksi FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_proses_seksi" ON proses_seksi;
CREATE POLICY "anon_delete_proses_seksi" ON proses_seksi FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS trg_proses_updated ON proses;
CREATE TRIGGER trg_proses_updated BEFORE UPDATE ON proses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();