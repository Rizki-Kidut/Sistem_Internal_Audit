-- Batch 5b: Checklist Audit Produk and private evidence storage.

CREATE TABLE public.checklist_produk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES public.audit_instruction_rows(id) ON DELETE CASCADE,
  kode_audit text NOT NULL,
  nama_inspector text,
  kualifikasi_inspector text,
  part_name text,
  part_no text,
  control_plan_no text,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Selesai')),
  kode_dokumen text NOT NULL DEFAULT 'Q-120-ISE-001-FORM-006',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_produk_fase (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_produk_id uuid NOT NULL REFERENCES public.checklist_produk(id) ON DELETE CASCADE,
  nama_fase text NOT NULL,
  nama_proses text,
  inspection_result_chart boolean NOT NULL DEFAULT false,
  no_inspection_standard text,
  dokumen_bukti jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(dokumen_bukti) = 'array'),
  urutan_tampil integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.checklist_produk_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fase_id uuid NOT NULL REFERENCES public.checklist_produk_fase(id) ON DELETE CASCADE,
  kategori text,
  jumlah_sampel_minimal integer CHECK (jumlah_sampel_minimal IS NULL OR jumlah_sampel_minimal >= 0),
  item_pemeriksaan text NOT NULL,
  alat_pemeriksaan text,
  standar_kriteria text,
  jumlah_sampel integer CHECK (jumlah_sampel IS NULL OR jumlah_sampel >= 0),
  hasil_pemeriksaan text,
  judgment text CHECK (judgment IS NULL OR judgment IN ('OK', 'NG')),
  urutan_tampil integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_produk_row_id ON public.checklist_produk(row_id);
CREATE INDEX idx_checklist_produk_kode_audit ON public.checklist_produk(kode_audit);
CREATE INDEX idx_checklist_produk_fase_checklist_id ON public.checklist_produk_fase(checklist_produk_id);
CREATE INDEX idx_checklist_produk_items_fase_id ON public.checklist_produk_items(fase_id);

CREATE TRIGGER set_checklist_produk_updated_at BEFORE UPDATE ON public.checklist_produk
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_checklist_produk_fase_updated_at BEFORE UPDATE ON public.checklist_produk_fase
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_checklist_produk_items_updated_at BEFORE UPDATE ON public.checklist_produk_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION public.validate_checklist_produk_completion() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.status = 'Selesai' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NOT EXISTS (SELECT 1 FROM public.checklist_produk_fase f WHERE f.checklist_produk_id = NEW.id)
       OR EXISTS (
         SELECT 1 FROM public.checklist_produk_fase f
         WHERE f.checklist_produk_id = NEW.id AND jsonb_array_length(f.dokumen_bukti) = 0
       ) THEN
      RAISE EXCEPTION 'Checklist Audit Produk tidak dapat diselesaikan karena masih ada fase tanpa dokumen bukti';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_checklist_produk_completion
BEFORE INSERT OR UPDATE OF status ON public.checklist_produk
FOR EACH ROW EXECUTE FUNCTION public.validate_checklist_produk_completion();

CREATE FUNCTION public.assert_checklist_produk_draft(p_checklist_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.checklist_produk
    WHERE id = p_checklist_id AND status = 'Selesai'
  ) THEN
    RAISE EXCEPTION 'Checklist Audit Produk sudah Selesai. Kembalikan ke Draft sebelum mengubah data.';
  END IF;
END;
$$;

CREATE FUNCTION public.protect_completed_checklist_produk_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.assert_checklist_produk_draft(OLD.id);
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_protect_completed_checklist_produk_delete
BEFORE DELETE ON public.checklist_produk
FOR EACH ROW EXECUTE FUNCTION public.protect_completed_checklist_produk_delete();

CREATE FUNCTION public.protect_completed_checklist_produk_fase() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    PERFORM public.assert_checklist_produk_draft(OLD.checklist_produk_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND (TG_OP = 'INSERT' OR NEW.checklist_produk_id IS DISTINCT FROM OLD.checklist_produk_id) THEN
    PERFORM public.assert_checklist_produk_draft(NEW.checklist_produk_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_completed_checklist_produk_fase
BEFORE INSERT OR UPDATE OR DELETE ON public.checklist_produk_fase
FOR EACH ROW EXECUTE FUNCTION public.protect_completed_checklist_produk_fase();

CREATE FUNCTION public.protect_completed_checklist_produk_item() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  v_old_checklist_id uuid;
  v_new_checklist_id uuid;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT checklist_produk_id INTO v_old_checklist_id
    FROM public.checklist_produk_fase WHERE id = OLD.fase_id;
    PERFORM public.assert_checklist_produk_draft(v_old_checklist_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.fase_id IS DISTINCT FROM OLD.fase_id) THEN
    SELECT checklist_produk_id INTO v_new_checklist_id
    FROM public.checklist_produk_fase WHERE id = NEW.fase_id;
    PERFORM public.assert_checklist_produk_draft(v_new_checklist_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_completed_checklist_produk_item
BEFORE INSERT OR UPDATE OR DELETE ON public.checklist_produk_items
FOR EACH ROW EXECUTE FUNCTION public.protect_completed_checklist_produk_item();

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['checklist_produk','checklist_produk_fase','checklist_produk_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY anon_select_%s ON public.%I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY anon_insert_%s ON public.%I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY anon_update_%s ON public.%I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY anon_delete_%s ON public.%I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('audit-evidence', 'audit-evidence', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE POLICY audit_evidence_select ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'audit-evidence');
CREATE POLICY audit_evidence_insert ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'audit-evidence');
CREATE POLICY audit_evidence_update ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'audit-evidence') WITH CHECK (bucket_id = 'audit-evidence');
CREATE POLICY audit_evidence_delete ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'audit-evidence');
