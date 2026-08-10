/*
# CertiTrack — Batch 3a: Jadwal Audit & Ruang Lingkup (audit_schedules + audit_scopes)

## Overview
Creates tables for "Jadwal Audit" — wizard 2-langkah untuk membuat sesi audit teknis.
audit_schedules menyimpan info jadwal (kode, tanggal, jenis, standar, status).
audit_scopes menyimpan ruang lingkup per area yang diaudit (seksi, proses, klausul, PIC).

## 1. New Tables

### audit_schedules
Header jadwal audit teknis. kodeAudit auto-generate format "IA-{tahun}-{NNN}".
- id (uuid PK)
- kode_audit (text, unique) — mis. "IA-2026-001"
- plan_id (uuid, FK → audit_plans.id ON DELETE SET NULL, nullable) — sumber rencana audit
- program_id (uuid, FK → audit_programs.id ON DELETE SET NULL, nullable) — sumber program audit
- tanggal_mulai (date, nullable)
- tanggal_selesai (date, nullable)
- jenis_audit (text, CHECK 'Internal'|'Surveillance-prep'|'Follow-up', default 'Internal')
- standar (jsonb, default '[]') — array string: 'ISO 9001', 'IATF 16949'
- status (text, CHECK 'Draft'|'Scheduled'|'In Progress'|'Completed'|'Closed', default 'Draft')
- approved_by (text, nullable)
- created_at, updated_at (timestamptz)

### audit_scopes
Ruang lingkup audit per area. Satu schedule bisa punya banyak scope (area).
- id (uuid PK)
- schedule_id (uuid, FK → audit_schedules.id ON DELETE CASCADE)
- kode_audit (text, nullable) — diisi di Batch 4 (instruksi audit), siapkan kolomnya
- area (text) — nama area yang diaudit
- seksi_terkait (uuid, FK → seksi.id ON DELETE SET NULL, nullable) — seksi terkait
- proses_terkait (jsonb, default '[]') — array proses id
- klausul_standar (jsonb, default '[]') — array klausul
- dokumen_referensi (jsonb, default '[]') — array nama dokumen
- pic_area (text, nullable) — default dari seksi.kepala_seksi, bisa diganti
- created_at, updated_at (timestamptz)

## 2. Indexes
- audit_schedules: (plan_id), (program_id), (status)
- audit_scopes: (schedule_id), (seksi_terkait)

## 3. Security
- RLS enabled on all tables.
- Single-tenant no-auth app: all policies TO anon, authenticated with USING (true).
- 4 policies per table (SELECT, INSERT, UPDATE, DELETE).
*/

-- ============================================================
-- AUDIT_SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kode_audit text UNIQUE NOT NULL,
  plan_id uuid REFERENCES audit_plans(id) ON DELETE SET NULL,
  program_id uuid REFERENCES audit_programs(id) ON DELETE SET NULL,
  tanggal_mulai date,
  tanggal_selesai date,
  jenis_audit text NOT NULL DEFAULT 'Internal' CHECK (jenis_audit IN ('Internal','Surveillance-prep','Follow-up')),
  standar jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Scheduled','In Progress','Completed','Closed')),
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_schedules_plan ON audit_schedules (plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_schedules_program ON audit_schedules (program_id);
CREATE INDEX IF NOT EXISTS idx_audit_schedules_status ON audit_schedules (status);

ALTER TABLE audit_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_schedules" ON audit_schedules;
CREATE POLICY "anon_select_audit_schedules" ON audit_schedules FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_schedules" ON audit_schedules;
CREATE POLICY "anon_insert_audit_schedules" ON audit_schedules FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_schedules" ON audit_schedules;
CREATE POLICY "anon_update_audit_schedules" ON audit_schedules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_schedules" ON audit_schedules;
CREATE POLICY "anon_delete_audit_schedules" ON audit_schedules FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- AUDIT_SCOPES
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES audit_schedules(id) ON DELETE CASCADE,
  kode_audit text,
  area text NOT NULL,
  seksi_terkait uuid REFERENCES seksi(id) ON DELETE SET NULL,
  proses_terkait jsonb NOT NULL DEFAULT '[]'::jsonb,
  klausul_standar jsonb NOT NULL DEFAULT '[]'::jsonb,
  dokumen_referensi jsonb NOT NULL DEFAULT '[]'::jsonb,
  pic_area text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_scopes_schedule ON audit_scopes (schedule_id);
CREATE INDEX IF NOT EXISTS idx_audit_scopes_seksi ON audit_scopes (seksi_terkait);

ALTER TABLE audit_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_audit_scopes" ON audit_scopes;
CREATE POLICY "anon_select_audit_scopes" ON audit_scopes FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_audit_scopes" ON audit_scopes;
CREATE POLICY "anon_insert_audit_scopes" ON audit_scopes FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_audit_scopes" ON audit_scopes;
CREATE POLICY "anon_update_audit_scopes" ON audit_scopes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_audit_scopes" ON audit_scopes;
CREATE POLICY "anon_delete_audit_scopes" ON audit_scopes FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- updated_at triggers
-- ============================================================
DROP TRIGGER IF EXISTS trg_audit_schedules_updated ON audit_schedules;
CREATE TRIGGER trg_audit_schedules_updated BEFORE UPDATE ON audit_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_audit_scopes_updated ON audit_scopes;
CREATE TRIGGER trg_audit_scopes_updated BEFORE UPDATE ON audit_scopes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
