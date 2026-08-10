/*
# CertiTrack — Modul Pelaksanaan Internal Audit: Batch 1 Tables

## Overview
Creates the foundation tables for the Internal Audit module: master organisasi (seksi),
Rencana Audit Tahunan (header + process + seksi link + monthly schedule), and Bank Checklist.
This is a single-tenant internal QMS app with no sign-in screen, so all policies use
TO anon, authenticated with USING (true) — the data is intentionally shared across users.

## 1. New Tables

### seksi
Master organisasi. `kepala_seksi` will be reused as default PIC in later batches.
- id (uuid PK)
- nama (text, not null) — nama seksi/department
- kepala_seksi (text) — nama kepala seksi, nullable, reusable as default PIC
- urutan_tampil (int, default 0) — urutan tampil di UI
- aktif (boolean, default true) — soft-active flag
- created_at, updated_at (timestamptz)

### audit_plans
Header rencana audit tahunan. Revision history is preserved as separate rows
(no in-place overwrite); "Buat Revisi Baru" creates a new row with incremented no_revisi.
- id (uuid PK)
- tahun (int, not null)
- tanggal_berlaku (date, not null)
- no_revisi (int, not null, default 0)
- kode_dokumen (text, not null)
- penanggung_jawab_qms (text)
- disetujui_oleh (text)
- status (text, default 'Draft') — CHECK in ('Draft','Approved')
- seksi_terlibat (jsonb, default '[]') — array of seksi IDs included in this plan
- created_at, updated_at (timestamptz)

### audit_plan_process
Flat list of processes per plan (no category grouping). Order is editable via drag-and-drop
(urutan_tampil).
- id (uuid PK)
- plan_id (uuid FK → audit_plans.id ON DELETE CASCADE)
- nama_proses (text, not null)
- catatan_kaki (text)
- urutan_tampil (int, default 0)
- created_at, updated_at (timestamptz)

### audit_plan_seksi_link
Matrix cell: process × seksi toggle. Unique per (process_id, seksi_id).
- id (uuid PK)
- process_id (uuid FK → audit_plan_process.id ON DELETE CASCADE)
- seksi_id (uuid FK → seksi.id ON DELETE CASCADE)
- terkait (boolean, default false)
- created_at (timestamptz)
- UNIQUE (process_id, seksi_id)

### audit_plan_schedule
Matrix cell: process × month with Plan/Aktual sub-rows. One row per process per month.
schedule_id is nullable now — will link to Jadwal Audit records in Batch 3.
- id (uuid PK)
- process_id (uuid FK → audit_plan_process.id ON DELETE CASCADE)
- bulan (int, not null, CHECK 1..12)
- plan (boolean, default false)
- aktual (boolean, default false)
- schedule_id (uuid, nullable) — FK to jadwal audit (Batch 3, column prepared)
- created_at (timestamptz)
- UNIQUE (process_id, bulan)

### checklist_bank_items
Master checklist bank, 3-level structure (Proses → Sub-Proses → Kelompok IPO → Pertanyaan).
Soft-delete via status = 'Nonaktif' to preserve history for checklists already using the item.
- id (uuid PK)
- proses (text, not null)
- sub_proses (text, not null)
- pic_sub_proses (text) — PIC baku, e.g. "PIC: PRC"
- kelompok_ipo (text, not null) — CHECK in ('Input Proses','Method Proses','Output Proses')
- nomor (text, not null) — nomor pertanyaan within kelompok
- klausul (text)
- pertanyaan_utama (text, not null)
- sub_pertanyaan (jsonb, default '[]') — array of {teks: text}
- metode_verifikasi_default (text, default 'Observasi') — CHECK in ('Observasi','Wawancara','Dokumen','Sampling')
- status (text, default 'Aktif') — CHECK in ('Aktif','Nonaktif')
- created_at, updated_at (timestamptz)

## 2. Indexes
- audit_plans: (tahun) for yearly lookups
- audit_plan_process: (plan_id, urutan_tampil) for ordered list per plan
- audit_plan_seksi_link: (process_id) for matrix queries
- audit_plan_schedule: (process_id) for matrix queries
- checklist_bank_items: (proses, sub_proses, kelompok_ipo) for 3-level navigation

## 3. Security
- RLS enabled on all tables.
- Single-tenant no-auth app: all policies use TO anon, authenticated with USING (true).
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
*/

-- ============================================================
-- SEKSI
-- ============================================================
CREATE TABLE IF NOT EXISTS seksi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  kepala_seksi text,
  urutan_tampil int NOT NULL DEFAULT 0,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seksi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_seksi" ON seksi;
CREATE POLICY "anon_select_seksi" ON seksi FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_seksi" ON seksi;
CREATE POLICY "anon_insert_seksi" ON seksi FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_seksi" ON seksi;
CREATE POLICY "anon_update_seksi" ON seksi FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_seksi" ON seksi;
CREATE POLICY "anon_delete_seksi" ON seksi FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tahun int NOT NULL,
  tanggal_berlaku date NOT NULL,
  no_revisi int NOT NULL DEFAULT 0,
  kode_dokumen text NOT NULL,
  penanggung_jawab_qms text,
  disetujui_oleh text,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Approved')),
  seksi_terlibat jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_plans_tahun ON audit_plans (tahun);

ALTER TABLE audit_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_plans" ON audit_plans;
CREATE POLICY "anon_select_audit_plans" ON audit_plans FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit_plans" ON audit_plans;
CREATE POLICY "anon_insert_audit_plans" ON audit_plans FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_audit_plans" ON audit_plans;
CREATE POLICY "anon_update_audit_plans" ON audit_plans FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_audit_plans" ON audit_plans;
CREATE POLICY "anon_delete_audit_plans" ON audit_plans FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_PLAN_PROCESS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_plan_process (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
  nama_proses text NOT NULL,
  catatan_kaki text,
  urutan_tampil int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_plan_process_plan ON audit_plan_process (plan_id, urutan_tampil);

ALTER TABLE audit_plan_process ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_plan_process" ON audit_plan_process;
CREATE POLICY "anon_select_audit_plan_process" ON audit_plan_process FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit_plan_process" ON audit_plan_process;
CREATE POLICY "anon_insert_audit_plan_process" ON audit_plan_process FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_audit_plan_process" ON audit_plan_process;
CREATE POLICY "audit_plan_process_update" ON audit_plan_process FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_audit_plan_process" ON audit_plan_process;
CREATE POLICY "anon_delete_audit_plan_process" ON audit_plan_process FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_PLAN_SEKSI_LINK
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_plan_seksi_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES audit_plan_process(id) ON DELETE CASCADE,
  seksi_id uuid NOT NULL REFERENCES seksi(id) ON DELETE CASCADE,
  terkait boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (process_id, seksi_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_plan_seksi_link_process ON audit_plan_seksi_link (process_id);

ALTER TABLE audit_plan_seksi_link ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_plan_seksi_link" ON audit_plan_seksi_link;
CREATE POLICY "anon_select_audit_plan_seksi_link" ON audit_plan_seksi_link FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit_plan_seksi_link" ON audit_plan_seksi_link;
CREATE POLICY "anon_insert_audit_plan_seksi_link" ON audit_plan_seksi_link FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_audit_plan_seksi_link" ON audit_plan_seksi_link;
CREATE POLICY "anon_update_audit_plan_seksi_link" ON audit_plan_seksi_link FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_audit_plan_seksi_link" ON audit_plan_seksi_link;
CREATE POLICY "anon_delete_audit_plan_seksi_link" ON audit_plan_seksi_link FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_PLAN_SCHEDULE
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_plan_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid NOT NULL REFERENCES audit_plan_process(id) ON DELETE CASCADE,
  bulan int NOT NULL CHECK (bulan >= 1 AND bulan <= 12),
  plan boolean NOT NULL DEFAULT false,
  aktual boolean NOT NULL DEFAULT false,
  schedule_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (process_id, bulan)
);

CREATE INDEX IF NOT EXISTS idx_audit_plan_schedule_process ON audit_plan_schedule (process_id);

ALTER TABLE audit_plan_schedule ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_plan_schedule" ON audit_plan_schedule;
CREATE POLICY "anon_select_audit_plan_schedule" ON audit_plan_schedule FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_audit_plan_schedule" ON audit_plan_schedule;
CREATE POLICY "anon_insert_audit_plan_schedule" ON audit_plan_schedule FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_audit_plan_schedule" ON audit_plan_schedule;
CREATE POLICY "anon_update_audit_plan_schedule" ON audit_plan_schedule FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_audit_plan_schedule" ON audit_plan_schedule;
CREATE POLICY "anon_delete_audit_plan_schedule" ON audit_plan_schedule FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- CHECKLIST_BANK_ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_bank_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proses text NOT NULL,
  sub_proses text NOT NULL,
  pic_sub_proses text,
  kelompok_ipo text NOT NULL CHECK (kelompok_ipo IN ('Input Proses','Method Proses','Output Proses')),
  nomor text NOT NULL,
  klausul text,
  pertanyaan_utama text NOT NULL,
  sub_pertanyaan jsonb NOT NULL DEFAULT '[]'::jsonb,
  metode_verifikasi_default text NOT NULL DEFAULT 'Observasi' CHECK (metode_verifikasi_default IN ('Observasi','Wawancara','Dokumen','Sampling')),
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Nonaktif')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_bank_items_nav ON checklist_bank_items (proses, sub_proses, kelompok_ipo);

ALTER TABLE checklist_bank_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_checklist_bank_items" ON checklist_bank_items;
CREATE POLICY "anon_select_checklist_bank_items" ON checklist_bank_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_checklist_bank_items" ON checklist_bank_items;
CREATE POLICY "anon_insert_checklist_bank_items" ON checklist_bank_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_checklist_bank_items" ON checklist_bank_items;
CREATE POLICY "anon_update_checklist_bank_items" ON checklist_bank_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_checklist_bank_items" ON checklist_bank_items;
CREATE POLICY "anon_delete_checklist_bank_items" ON checklist_bank_items FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- updated_at trigger function (reusable)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_seksi_updated ON seksi;
CREATE TRIGGER trg_seksi_updated BEFORE UPDATE ON seksi
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_audit_plans_updated ON audit_plans;
CREATE TRIGGER trg_audit_plans_updated BEFORE UPDATE ON audit_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_audit_plan_process_updated ON audit_plan_process;
CREATE TRIGGER trg_audit_plan_process_updated BEFORE UPDATE ON audit_plan_process
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_checklist_bank_items_updated ON checklist_bank_items;
CREATE TRIGGER trg_checklist_bank_items_updated BEFORE UPDATE ON checklist_bank_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();