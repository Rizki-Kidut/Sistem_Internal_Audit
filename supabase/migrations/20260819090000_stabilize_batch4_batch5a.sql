-- Stabilization pass: make the already implemented Batch 4/5a source reproducible.
-- This migration is additive and safe for databases where some tables were created manually.

CREATE TABLE IF NOT EXISTS plants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nama text NOT NULL,
  urutan_tampil integer NOT NULL DEFAULT 0, aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS target_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  nama text NOT NULL, urutan_tampil integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plant_id uuid NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  nama text NOT NULL, urutan_tampil integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_instructions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid REFERENCES audit_programs(id) ON DELETE SET NULL,
  tahun_fiskal integer NOT NULL, tujuan_audit text, tanggal_buat date DEFAULT current_date,
  tanggal_revisi date, no_revisi integer NOT NULL DEFAULT 0,
  kode_dokumen text NOT NULL DEFAULT 'Q-120-ISE-001-FORM-003', prefix_nomor_audit text NOT NULL DEFAULT 'QA-',
  approval_pembuatan jsonb NOT NULL DEFAULT '{"dibuat_oleh_qms":null,"disetujui_oleh_direktur":null}'::jsonb,
  approval_selesai jsonb NOT NULL DEFAULT '{"dibuat_oleh_qms":null,"disetujui_oleh_direktur":null}'::jsonb,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Berjalan','Selesai')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_instruction_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), instruction_id uuid NOT NULL REFERENCES audit_instructions(id) ON DELETE CASCADE,
  kode_audit text NOT NULL, team text, proses_id uuid REFERENCES proses(id) ON DELETE SET NULL, pemilik_proses text,
  seksi_marks jsonb NOT NULL DEFAULT '[]', auditor jsonb NOT NULL DEFAULT '[]',
  tipe_baris text NOT NULL DEFAULT 'Reguler' CHECK (tipe_baris IN ('Reguler','AuditProduk','AuditManufaktur','AuditShift')),
  matriks_produk_marks jsonb NOT NULL DEFAULT '[]', matriks_manufaktur_shift_marks jsonb NOT NULL DEFAULT '[]',
  tanggal_audit_produk date, nama_auditor_produk text, kualifikasi text, item_lain_diperiksa text,
  tanggal_plan_audit date, tanggal_pelaksanaan_audit date, cek_selesai boolean NOT NULL DEFAULT false,
  urutan_tampil integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), row_id uuid NOT NULL REFERENCES audit_instruction_rows(id) ON DELETE CASCADE,
  kode_audit text NOT NULL, judul_checklist text NOT NULL, seksi_auditee jsonb NOT NULL DEFAULT '[]',
  section_manager text, tanggal_dibuat date NOT NULL DEFAULT current_date, dibuat_oleh text,
  penanggung_jawab_qms text, kode_dokumen text NOT NULL DEFAULT 'Q-120-ISE-001-FORM-005',
  pic_proses text, item_monitoring_jelas text, kondisi_pencapaian_target text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), checklist_id uuid NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  bank_item_id uuid REFERENCES checklist_bank_items(id) ON DELETE SET NULL, sub_proses text NOT NULL,
  kelompok_ipo text NOT NULL CHECK (kelompok_ipo IN ('Input Proses','Method Proses','Output Proses')),
  nomor text NOT NULL, klausul text, pertanyaan_utama text NOT NULL, sub_pertanyaan jsonb NOT NULL DEFAULT '[]',
  metode_verifikasi text NOT NULL CHECK (metode_verifikasi IN ('Observasi','Wawancara','Dokumen','Sampling')),
  hasil text CHECK (hasil IS NULL OR hasil IN ('O','A','B','C','N-A')), komentar_auditor text,
  finding_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instruction_program ON audit_instructions(program_id);
CREATE INDEX IF NOT EXISTS idx_instruction_rows_instruction ON audit_instruction_rows(instruction_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT kode_audit FROM audit_instruction_rows GROUP BY kode_audit HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_instruction_rows_kode_audit ON audit_instruction_rows(kode_audit);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_checklists_row ON checklists(row_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_target_models_plant ON target_models(plant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_plant ON shifts(plant_id);

-- One database sequence is the sole allocator of central QA identifiers. Existing values are retained.
CREATE SEQUENCE IF NOT EXISTS qa_audit_code_seq;
DO $$
DECLARE current_max bigint;
BEGIN
  SELECT COALESCE(max((regexp_match(kode_audit, '^QA-([0-9]+)$'))[1]::bigint), 0)
    INTO current_max FROM audit_instruction_rows WHERE kode_audit ~ '^QA-[0-9]+$';
  IF current_max > 0 THEN
    PERFORM setval('qa_audit_code_seq', GREATEST(current_max, (SELECT last_value FROM qa_audit_code_seq)), true);
  END IF;
END $$;
CREATE OR REPLACE FUNCTION next_qa_audit_code() RETURNS text LANGUAGE sql VOLATILE
AS $$ SELECT 'QA-' || lpad(nextval('qa_audit_code_seq')::text, 2, '0') $$;
GRANT USAGE, SELECT ON SEQUENCE qa_audit_code_seq TO anon, authenticated;
GRANT EXECUTE ON FUNCTION next_qa_audit_code() TO anon, authenticated;

CREATE OR REPLACE FUNCTION protect_qa_audit_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('central-qa-code'));
  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM audit_instruction_rows WHERE kode_audit=NEW.kode_audit) THEN
    RAISE EXCEPTION 'Nomor audit QA % sudah digunakan', NEW.kode_audit;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.kode_audit IS DISTINCT FROM OLD.kode_audit THEN
    RAISE EXCEPTION 'Nomor audit QA tidak dapat diubah setelah dibuat';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_protect_qa_audit_code ON audit_instruction_rows;
CREATE TRIGGER trg_protect_qa_audit_code BEFORE INSERT OR UPDATE ON audit_instruction_rows
FOR EACH ROW EXECUTE FUNCTION protect_qa_audit_code();

-- A completed grid row creates missing session scope/team in the same row-save transaction.
CREATE OR REPLACE FUNCTION sync_instruction_row_scope_team() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_schedule uuid; v_lead uuid; v_members uuid[]; v_program uuid; v_plan uuid;
DECLARE v_tahun integer; v_area text; v_target_seksi uuid; v_pic text;
BEGIN
  SELECT schedule_id INTO v_schedule FROM audit_scopes WHERE kode_audit=NEW.kode_audit ORDER BY created_at LIMIT 1;
  SELECT (x->>'auditor_id')::uuid INTO v_lead FROM jsonb_array_elements(NEW.auditor) x
    WHERE COALESCE((x->>'is_lead')::boolean,false) LIMIT 1;
  SELECT COALESCE(array_agg((x->>'auditor_id')::uuid),'{}') INTO v_members
    FROM jsonb_array_elements(NEW.auditor) x WHERE NOT COALESCE((x->>'is_lead')::boolean,false);
  IF v_schedule IS NULL AND NEW.proses_id IS NOT NULL AND (v_lead IS NOT NULL OR cardinality(v_members) > 0) THEN
    SELECT i.program_id,i.tahun_fiskal,p.plan_id INTO v_program,v_tahun,v_plan
      FROM audit_instructions i LEFT JOIN audit_programs p ON p.id=i.program_id WHERE i.id=NEW.instruction_id;
    IF v_program IS NULL THEN RETURN NEW; END IF;
    SELECT id INTO v_schedule FROM audit_schedules WHERE program_id=v_program ORDER BY created_at LIMIT 1;
    IF v_schedule IS NULL THEN
      INSERT INTO audit_schedules(kode_audit,plan_id,program_id,jenis_audit,status)
      VALUES('IA-'||v_tahun||'-'||lpad((1 + COALESCE((SELECT max((regexp_match(kode_audit, '^IA-'||v_tahun||'-([0-9]+)$'))[1]::integer) FROM audit_schedules WHERE kode_audit ~ ('^IA-'||v_tahun||'-[0-9]+$')),0))::text,3,'0'),v_plan,v_program,'Internal','Draft')
      RETURNING id INTO v_schedule;
    END IF;
    SELECT nama_proses INTO v_area FROM proses WHERE id=NEW.proses_id;
    SELECT (m->>'seksi_id')::uuid INTO v_target_seksi FROM jsonb_array_elements(NEW.seksi_marks) m
      WHERE m->>'tipe'='target' LIMIT 1;
    SELECT kepala_seksi INTO v_pic FROM seksi WHERE id=v_target_seksi;
    INSERT INTO audit_scopes(schedule_id,kode_audit,area,seksi_terkait,proses_terkait,pic_area)
    VALUES(v_schedule,NEW.kode_audit,COALESCE(v_area,NEW.kode_audit),v_target_seksi,jsonb_build_array(NEW.proses_id),v_pic);
  END IF;
  IF v_schedule IS NULL THEN RETURN NEW; END IF;
  INSERT INTO audit_teams(schedule_id,lead_auditor_id,member_ids)
  VALUES(v_schedule,v_lead,v_members)
  ON CONFLICT(schedule_id) DO UPDATE SET lead_auditor_id=excluded.lead_auditor_id, member_ids=excluded.member_ids;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sync_instruction_row_team ON audit_instruction_rows;
DROP TRIGGER IF EXISTS trg_sync_instruction_row_scope_team ON audit_instruction_rows;
CREATE TRIGGER trg_sync_instruction_row_scope_team AFTER INSERT OR UPDATE ON audit_instruction_rows
FOR EACH ROW EXECUTE FUNCTION sync_instruction_row_scope_team();

-- Generate header, rows, and propagation to existing scopes in one transaction.
CREATE OR REPLACE FUNCTION generate_instruction_from_program(p_program_id uuid, p_tahun integer)
RETURNS TABLE(instruction_id uuid, rows_created integer) LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE v_instruction uuid; v_plan uuid; v_tujuan text; v_count integer := 0;
DECLARE rec record; v_code text; v_marks jsonb; v_auditors jsonb; v_scope_ids uuid[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('generate-instruction'), hashtext(p_program_id::text));
  SELECT plan_id, tujuan INTO v_plan, v_tujuan FROM audit_programs WHERE id=p_program_id;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'Program atau rencana sumber tidak ditemukan'; END IF;
  IF EXISTS (SELECT 1 FROM audit_instructions WHERE program_id=p_program_id) THEN
    RAISE EXCEPTION 'Instruksi untuk program ini sudah pernah dibuat';
  END IF;
  INSERT INTO audit_instructions(program_id,tahun_fiskal,tujuan_audit)
  VALUES(p_program_id,p_tahun,v_tujuan) RETURNING id INTO v_instruction;

  FOR rec IN SELECT app.id, app.proses_master_id, app.nama_proses,
      (SELECT min(aps.bulan) FROM audit_plan_schedule aps WHERE aps.process_id=app.id AND aps.plan) first_month
    FROM audit_plan_process app WHERE app.plan_id=v_plan ORDER BY app.urutan_tampil, app.created_at
  LOOP
    v_code := next_qa_audit_code();
    SELECT COALESCE(jsonb_agg(jsonb_build_object('seksi_id',l.seksi_id,'tipe',CASE WHEN l.peran='utama' THEN 'target' ELSE 'terkait' END)) FILTER (WHERE l.peran IS NOT NULL),'[]')
      INTO v_marks FROM audit_plan_seksi_link l WHERE l.process_id=rec.id;
    SELECT array_agg(id) INTO v_scope_ids FROM audit_scopes
      WHERE schedule_id IN (SELECT id FROM audit_schedules WHERE program_id=p_program_id)
        AND proses_terkait ? rec.proses_master_id::text;
    IF v_scope_ids IS NOT NULL THEN
      UPDATE audit_scopes SET kode_audit=v_code WHERE id=ANY(v_scope_ids);
    END IF;
    IF v_scope_ids IS NULL THEN v_auditors := '[]'::jsonb; ELSE
      SELECT COALESCE(jsonb_agg(x),'[]') INTO v_auditors FROM (
      SELECT jsonb_build_object('auditor_id',t.lead_auditor_id,'is_lead',true) x FROM audit_teams t WHERE t.schedule_id=(SELECT schedule_id FROM audit_scopes WHERE id=v_scope_ids[1]) AND t.lead_auditor_id IS NOT NULL
      UNION ALL SELECT jsonb_build_object('auditor_id',m,'is_lead',false) FROM audit_teams t, unnest(t.member_ids) m WHERE t.schedule_id=(SELECT schedule_id FROM audit_scopes WHERE id=v_scope_ids[1]) AND m IS DISTINCT FROM t.lead_auditor_id
      ) q;
    END IF;
    INSERT INTO audit_instruction_rows(instruction_id,kode_audit,proses_id,pemilik_proses,seksi_marks,auditor,tanggal_plan_audit,urutan_tampil)
    SELECT v_instruction,v_code,rec.proses_master_id,s.kepala_seksi,v_marks,v_auditors,
      CASE WHEN rec.first_month IS NULL THEN NULL ELSE make_date(p_tahun,rec.first_month,15) END,v_count+1
    FROM (SELECT 1) d LEFT JOIN seksi s ON s.id=(SELECT (m->>'seksi_id')::uuid FROM jsonb_array_elements(v_marks) m WHERE m->>'tipe'='target' LIMIT 1);
    v_count := v_count+1;
  END LOOP;
  RETURN QUERY SELECT v_instruction,v_count;
END $$;

-- RLS follows the existing application policy model without widening access beyond these new tables.
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['plants','target_models','shifts','audit_instructions','audit_instruction_rows','checklists','checklist_items'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('DROP POLICY IF EXISTS anon_select_%s ON %I',t,t);
  EXECUTE format('CREATE POLICY anon_select_%s ON %I FOR SELECT TO anon, authenticated USING (true)',t,t);
  EXECUTE format('DROP POLICY IF EXISTS anon_insert_%s ON %I',t,t);
  EXECUTE format('CREATE POLICY anon_insert_%s ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)',t,t);
  EXECUTE format('DROP POLICY IF EXISTS anon_update_%s ON %I',t,t);
  EXECUTE format('CREATE POLICY anon_update_%s ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)',t,t);
  EXECUTE format('DROP POLICY IF EXISTS anon_delete_%s ON %I',t,t);
  EXECUTE format('CREATE POLICY anon_delete_%s ON %I FOR DELETE TO anon, authenticated USING (true)',t,t);
END LOOP; END $$;
