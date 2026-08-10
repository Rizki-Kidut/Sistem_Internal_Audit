/*
# CertiTrack — Modul Pelaksanaan Internal Audit: Batch 2 Tables

## Overview
Creates tables for "Program Internal Audit" — SOP document per audit round (berkala/khusus),
created from an Approved Rencana Audit Tahunan (Batch 1). Includes 7-step template seeding,
distribution (seksi × manager), risk/opportunity register, and dynamic schedule steps.

## 1. New Tables

### audit_programs
Header program internal audit. Created from an approved audit_plans row.
- id (uuid PK)
- plan_id (uuid FK → audit_plans.id ON DELETE CASCADE) — sumber rencana audit
- jenis_ronde (text, CHECK 'Berkala'|'Khusus')
- nomor_ke (int, default 1) — nomor ronde ke berapa
- tahun (int)
- tanggal_dibuat (date)
- tanggal_revisi (date, nullable)
- no_revisi (int, default 0)
- penanggung_jawab_qms (text)
- management (text)
- tujuan (text)
- poin_perhatian (text)
- periode_label (jsonb, default '["Periode 1","Periode 2","Periode 3","Periode 4"]') — dynamic labels, bisa diubah bebas jumlah
- status (text, CHECK 'Draft'|'Approved', default 'Draft')
- kode_dokumen (text, default 'Q-120-ISE-001-FORM-002-REV.1')
- created_at, updated_at (timestamptz)

### audit_program_distribusi
Tujuan distribusi audit per seksi. nama_section_manager auto-terisi dari seksi.kepala_seksi
saat seksi dicentang, tapi bisa di-override manual.
- id (uuid PK)
- program_id (uuid FK → audit_programs.id ON DELETE CASCADE)
- seksi_id (uuid FK → seksi.id ON DELETE CASCADE)
- nama_section_manager (text) — auto-filled from seksi.kepala_seksi, overrideable
- created_at (timestamptz)
- UNIQUE (program_id, seksi_id)

### audit_program_risiko
Risiko & peluang register per program.
- id (uuid PK)
- program_id (uuid FK → audit_programs.id ON DELETE CASCADE)
- nomor (text)
- risiko_peluang (text)
- control_action (text)
- created_at, updated_at (timestamptz)

### audit_program_steps
Schedule dasar — 7 langkah baku (auto-copied from template saat program baru dibuat).
Auditor bisa edit periode_target, pic, bebas tambah/hapus baris.
- id (uuid PK)
- program_id (uuid FK → audit_programs.id ON DELETE CASCADE)
- nomor (int) — urutan langkah
- item_pelaksanaan (text)
- prosedur_pelaksanaan (text)
- periode_target (jsonb, default '[]') — array of boolean sepanjang periode_label program
- pic (text)
- created_at, updated_at (timestamptz)

### audit_program_step_template
Master 7 langkah baku. SEED data saat pertama kali load. Tabel ini statis (tidak dihapus).
- id (uuid PK)
- nomor (int, unique) — 1-7
- item_pelaksanaan (text)
- prosedur_pelaksanaan (text)
- pic (text)
- created_at (timestamptz)

## 2. Seed Data
7 baris audit_program_step_template:
1. Penerbitan rencana audit — PIC: Audit Team Leader
2. Penerbitan checklist audit — PIC: Audit Team Leader
3. Pelaksanaan audit — PIC: Audit Team
4. Pembuatan laporan internal audit — PIC: Audit Team
5. Pembuatan rencana tindakan perbaikan (jika ada) — PIC: Manager Proses / Sekretaris Auditee
6. Pelaksanaan audit follow-up dan pengiriman laporan tindakan perbaikan — PIC: Audit Team
7. Notifikasi audit selesai — PIC: QMS Representative

## 3. Indexes
- audit_programs: (plan_id), (tahun)
- audit_program_distribusi: (program_id)
- audit_program_risiko: (program_id)
- audit_program_steps: (program_id, nomor)

## 4. Security
- RLS enabled on all tables.
- Single-tenant no-auth app: all policies TO anon, authenticated with USING (true).
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
*/

-- ============================================================
-- AUDIT_PROGRAMS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES audit_plans(id) ON DELETE CASCADE,
  jenis_ronde text NOT NULL CHECK (jenis_ronde IN ('Berkala','Khusus')),
  nomor_ke int NOT NULL DEFAULT 1,
  tahun int NOT NULL,
  tanggal_dibuat date NOT NULL,
  tanggal_revisi date,
  no_revisi int NOT NULL DEFAULT 0,
  penanggung_jawab_qms text,
  management text,
  tujuan text,
  poin_perhatian text,
  periode_label jsonb NOT NULL DEFAULT '["Periode 1","Periode 2","Periode 3","Periode 4"]'::jsonb,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Approved')),
  kode_dokumen text NOT NULL DEFAULT 'Q-120-ISE-001-FORM-002-REV.1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_programs_plan ON audit_programs (plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_programs_tahun ON audit_programs (tahun);

ALTER TABLE audit_programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_programs" ON audit_programs;
CREATE POLICY "anon_select_audit_programs" ON audit_programs FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_programs" ON audit_programs;
CREATE POLICY "anon_insert_audit_programs" ON audit_programs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_programs" ON audit_programs;
CREATE POLICY "anon_update_audit_programs" ON audit_programs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_programs" ON audit_programs;
CREATE POLICY "anon_delete_audit_programs" ON audit_programs FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_PROGRAM_DISTRIBUSI
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_program_distribusi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
  seksi_id uuid NOT NULL REFERENCES seksi(id) ON DELETE CASCADE,
  nama_section_manager text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (program_id, seksi_id)
);

CREATE INDEX IF NOT EXISTS idx_audit_program_distribusi_program ON audit_program_distribusi (program_id);

ALTER TABLE audit_program_distribusi ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_program_distribusi" ON audit_program_distribusi;
CREATE POLICY "anon_select_audit_program_distribusi" ON audit_program_distribusi FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_program_distribusi" ON audit_program_distribusi;
CREATE POLICY "anon_insert_audit_program_distribusi" ON audit_program_distribusi FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_program_distribusi" ON audit_program_distribusi;
CREATE POLICY "anon_update_audit_program_distribusi" ON audit_program_distribusi FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_program_distribusi" ON audit_program_distribusi;
CREATE POLICY "anon_delete_audit_program_distribusi" ON audit_program_distribusi FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_PROGRAM_RISIKO
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_program_risiko (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
  nomor text,
  risiko_peluang text,
  control_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_program_risiko_program ON audit_program_risiko (program_id);

ALTER TABLE audit_program_risiko ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_program_risiko" ON audit_program_risiko;
CREATE POLICY "anon_select_audit_program_risiko" ON audit_program_risiko FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_program_risiko" ON audit_program_risiko;
CREATE POLICY "anon_insert_audit_program_risiko" ON audit_program_risiko FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_program_risiko" ON audit_program_risiko;
CREATE POLICY "anon_update_audit_program_risiko" ON audit_program_risiko FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_program_risiko" ON audit_program_risiko;
CREATE POLICY "anon_delete_audit_program_risiko" ON audit_program_risiko FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_PROGRAM_STEPS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_program_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES audit_programs(id) ON DELETE CASCADE,
  nomor int NOT NULL DEFAULT 0,
  item_pelaksanaan text,
  prosedur_pelaksanaan text,
  periode_target jsonb NOT NULL DEFAULT '[]'::jsonb,
  pic text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_program_steps_program ON audit_program_steps (program_id, nomor);

ALTER TABLE audit_program_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_program_steps" ON audit_program_steps;
CREATE POLICY "anon_select_audit_program_steps" ON audit_program_steps FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_program_steps" ON audit_program_steps;
CREATE POLICY "anon_insert_audit_program_steps" ON audit_program_steps FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_program_steps" ON audit_program_steps;
CREATE POLICY "anon_update_audit_program_steps" ON audit_program_steps FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_program_steps" ON audit_program_steps;
CREATE POLICY "anon_delete_audit_program_steps" ON audit_program_steps FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_PROGRAM_STEP_TEMPLATE (master, statis)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_program_step_template (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomor int UNIQUE NOT NULL,
  item_pelaksanaan text NOT NULL,
  prosedur_pelaksanaan text,
  pic text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_program_step_template ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_program_step_template" ON audit_program_step_template;
CREATE POLICY "anon_select_audit_program_step_template" ON audit_program_step_template FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_program_step_template" ON audit_program_step_template;
CREATE POLICY "anon_insert_audit_program_step_template" ON audit_program_step_template FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_program_step_template" ON audit_program_step_template;
CREATE POLICY "anon_update_audit_program_step_template" ON audit_program_step_template FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_program_step_template" ON audit_program_step_template;
CREATE POLICY "anon_delete_audit_program_step_template" ON audit_program_step_template FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- SEED: 7 langkah baku
-- ============================================================
INSERT INTO audit_program_step_template (nomor, item_pelaksanaan, prosedur_pelaksanaan, pic)
VALUES
  (1, 'Penerbitan rencana audit', '', 'Audit Team Leader'),
  (2, 'Penerbitan checklist audit', '', 'Audit Team Leader'),
  (3, 'Pelaksanaan audit', '', 'Audit Team'),
  (4, 'Pembuatan laporan internal audit', '', 'Audit Team'),
  (5, 'Pembuatan rencana tindakan perbaikan (jika ada)', '', 'Manager Proses / Sekretaris Auditee'),
  (6, 'Pelaksanaan audit follow-up dan pengiriman laporan tindakan perbaikan', '', 'Audit Team'),
  (7, 'Notifikasi audit selesai', '', 'QMS Representative')
ON CONFLICT (nomor) DO NOTHING;

-- ============================================================
-- updated_at triggers
-- ============================================================
DROP TRIGGER IF EXISTS trg_audit_programs_updated ON audit_programs;
CREATE TRIGGER trg_audit_programs_updated BEFORE UPDATE ON audit_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_audit_program_risiko_updated ON audit_program_risiko;
CREATE TRIGGER trg_audit_program_risiko_updated BEFORE UPDATE ON audit_program_risiko
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_audit_program_steps_updated ON audit_program_steps;
CREATE TRIGGER trg_audit_program_steps_updated BEFORE UPDATE ON audit_program_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();