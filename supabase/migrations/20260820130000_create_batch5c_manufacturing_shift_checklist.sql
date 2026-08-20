-- Batch 5c: Checklist Audit Manufaktur dan Shift.

CREATE TABLE public.checklist_manufaktur_shift (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES public.audit_instruction_rows(id) ON DELETE CASCADE,
  kode_audit text NOT NULL,
  jenis_checklist jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(jenis_checklist) = 'array'),
  nama_seksi text,
  manager_proses_line_leader text,
  tanggal_audit date,
  auditor jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(auditor) = 'array'),
  nama_part text,
  nomor_part text,
  nomor_line text,
  control_plan_no text,
  p_fmea_no text,
  customer text,
  jumlah_operator integer CHECK (jumlah_operator IS NULL OR jumlah_operator >= 0),
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Selesai')),
  kode_dokumen text NOT NULL DEFAULT 'Q-120-ISE-001-FORM-007',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_manufaktur_bank_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bagian text NOT NULL,
  nomor text NOT NULL,
  klausul text,
  item_pemeriksaan text,
  urutan_tampil integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Nonaktif')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_checklist_manufaktur_bank_bagian_nomor UNIQUE (bagian, nomor)
);

CREATE TABLE public.checklist_manufaktur_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.checklist_manufaktur_shift(id) ON DELETE CASCADE,
  bank_item_id uuid REFERENCES public.checklist_manufaktur_bank_items(id) ON DELETE SET NULL,
  no_proses_dicek text,
  hasil_pengamatan text,
  hasil text CHECK (hasil IS NULL OR hasil IN ('O', 'A', 'B', 'C', 'N-A')),
  finding_id uuid,
  urutan_tampil integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_checklist_manufaktur_bank_item UNIQUE (checklist_id, bank_item_id)
);

CREATE INDEX idx_checklist_manufaktur_shift_row_id ON public.checklist_manufaktur_shift(row_id);
CREATE INDEX idx_checklist_manufaktur_shift_kode_audit ON public.checklist_manufaktur_shift(kode_audit);
CREATE INDEX idx_checklist_manufaktur_items_checklist_id ON public.checklist_manufaktur_items(checklist_id);
CREATE INDEX idx_checklist_manufaktur_items_bank_item_id ON public.checklist_manufaktur_items(bank_item_id);

CREATE TRIGGER set_checklist_manufaktur_shift_updated_at BEFORE UPDATE ON public.checklist_manufaktur_shift
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_checklist_manufaktur_bank_updated_at BEFORE UPDATE ON public.checklist_manufaktur_bank_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_checklist_manufaktur_items_updated_at BEFORE UPDATE ON public.checklist_manufaktur_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Atomic header creation and active-bank snapshot initialization. Plant/Shift names are retained
-- with their IDs so later master renames do not make saved checklist labels unreadable.
CREATE FUNCTION public.create_manufacturing_checklist_from_row(p_row_id uuid) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_row public.audit_instruction_rows%ROWTYPE; v_id uuid; v_jenis jsonb; v_nama_seksi text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('manufacturing-checklist'), hashtext(p_row_id::text));
  SELECT * INTO v_row FROM public.audit_instruction_rows WHERE id = p_row_id;
  IF NOT FOUND OR v_row.tipe_baris NOT IN ('AuditManufaktur', 'AuditShift') THEN
    RAISE EXCEPTION 'Checklist Manufaktur/Shift hanya dapat dibuat dari baris AuditManufaktur atau AuditShift';
  END IF;
  SELECT id INTO v_id FROM public.checklist_manufaktur_shift WHERE row_id = p_row_id ORDER BY created_at LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'plant_id', m->>'plant_id', 'plant_nama', p.nama,
    'shift_id', m->>'shift_id', 'shift_nama', s.nama) ORDER BY p.urutan_tampil, s.urutan_tampil), '[]'::jsonb)
    INTO v_jenis FROM jsonb_array_elements(v_row.matriks_manufaktur_shift_marks) m
    LEFT JOIN public.plants p ON p.id = (m->>'plant_id')::uuid
    LEFT JOIN public.shifts s ON s.id = (m->>'shift_id')::uuid AND s.plant_id = p.id;
  SELECT max(sec.nama) INTO v_nama_seksi
    FROM jsonb_array_elements(v_row.seksi_marks) mark
    JOIN public.seksi sec ON sec.id = (mark->>'seksi_id')::uuid
    WHERE mark->>'tipe' = 'target'
    HAVING count(*) = 1;
  INSERT INTO public.checklist_manufaktur_shift(
    row_id, kode_audit, jenis_checklist, nama_seksi, manager_proses_line_leader,
    tanggal_audit, auditor, status, kode_dokumen)
  VALUES (v_row.id, v_row.kode_audit, v_jenis, v_nama_seksi, v_row.pemilik_proses,
    v_row.tanggal_pelaksanaan_audit, v_row.auditor, 'Draft', 'Q-120-ISE-001-FORM-007')
  RETURNING id INTO v_id;
  INSERT INTO public.checklist_manufaktur_items(checklist_id, bank_item_id, urutan_tampil)
    SELECT v_id, id, urutan_tampil FROM public.checklist_manufaktur_bank_items
    WHERE status = 'Aktif' ORDER BY urutan_tampil, bagian, nomor;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.assert_checklist_manufaktur_draft(p_checklist_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.checklist_manufaktur_shift WHERE id = p_checklist_id AND status = 'Selesai') THEN
    RAISE EXCEPTION 'Checklist Manufaktur/Shift sudah Selesai. Kembalikan ke Draft sebelum mengubah data.';
  END IF;
END;
$$;

CREATE FUNCTION public.protect_completed_checklist_manufaktur_header() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.assert_checklist_manufaktur_draft(OLD.id); RETURN OLD; END IF;
  IF OLD.status = 'Selesai' AND (
    NEW.status <> 'Draft'
    OR (to_jsonb(NEW) - ARRAY['status', 'updated_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'updated_at'])
  ) THEN
    RAISE EXCEPTION 'Kembalikan checklist ke Draft terlebih dahulu sebelum mengubah header.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_completed_checklist_manufaktur_header
BEFORE UPDATE OR DELETE ON public.checklist_manufaktur_shift FOR EACH ROW
EXECUTE FUNCTION public.protect_completed_checklist_manufaktur_header();

CREATE FUNCTION public.validate_checklist_manufaktur_row() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.audit_instruction_rows r
    WHERE r.id = NEW.row_id AND r.kode_audit = NEW.kode_audit
      AND r.tipe_baris IN ('AuditManufaktur', 'AuditShift')
  ) THEN
    RAISE EXCEPTION 'Checklist harus memakai row_id dan kode QA dari baris AuditManufaktur/AuditShift yang sama';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.row_id IS DISTINCT FROM OLD.row_id OR NEW.kode_audit IS DISTINCT FROM OLD.kode_audit) THEN
    RAISE EXCEPTION 'Relasi baris dan kode QA Checklist Manufaktur/Shift tidak dapat diubah';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_checklist_manufaktur_row
BEFORE INSERT OR UPDATE ON public.checklist_manufaktur_shift FOR EACH ROW
EXECUTE FUNCTION public.validate_checklist_manufaktur_row();

CREATE FUNCTION public.protect_completed_checklist_manufaktur_item() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN PERFORM public.assert_checklist_manufaktur_draft(OLD.checklist_id); END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN PERFORM public.assert_checklist_manufaktur_draft(NEW.checklist_id); END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_completed_checklist_manufaktur_item
BEFORE INSERT OR UPDATE OR DELETE ON public.checklist_manufaktur_items FOR EACH ROW
EXECUTE FUNCTION public.protect_completed_checklist_manufaktur_item();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['checklist_manufaktur_shift','checklist_manufaktur_bank_items','checklist_manufaktur_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY anon_select_%s ON public.%I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY anon_insert_%s ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY anon_update_%s ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY anon_delete_%s ON public.%I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION public.create_manufacturing_checklist_from_row(uuid) TO anon, authenticated;

-- Structural seed only: the approved question and clause mapping is intentionally unavailable.
INSERT INTO public.checklist_manufaktur_bank_items(bagian, nomor, item_pemeriksaan, urutan_tampil)
SELECT 'A', n::text, NULL, n FROM generate_series(1, 19) n
UNION ALL
SELECT 'B', n::text, NULL, 19 + n FROM generate_series(1, 3) n
ON CONFLICT (bagian, nomor) DO NOTHING;
