-- Align checklist-level Selesai with "Siap Pelaksanaan": preparation is locked,
-- while execution-only fields remain writable until the QA execution is completed.

CREATE OR REPLACE FUNCTION public.protect_ready_checklist_produk_header()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status = 'Selesai' AND (
    NEW.status <> 'Draft'
    OR (to_jsonb(NEW) - ARRAY['status','updated_at'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','updated_at'])
  ) THEN
    RAISE EXCEPTION 'Checklist Produk sudah siap untuk pelaksanaan. Kembalikan ke Draft sebelum mengubah header persiapan.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_ready_checklist_produk_header ON public.checklist_produk;
CREATE TRIGGER trg_protect_ready_checklist_produk_header
BEFORE UPDATE ON public.checklist_produk
FOR EACH ROW EXECUTE FUNCTION public.protect_ready_checklist_produk_header();

CREATE OR REPLACE FUNCTION public.protect_completed_checklist_produk_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_finding_sync boolean := COALESCE(current_setting('certitrack.finding_sync', true), '') = '1';
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT c.status INTO v_old_status
    FROM public.checklist_produk_fase f
    JOIN public.checklist_produk c ON c.id = f.checklist_produk_id
    WHERE f.id = OLD.fase_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT c.status INTO v_new_status
    FROM public.checklist_produk_fase f
    JOIN public.checklist_produk c ON c.id = f.checklist_produk_id
    WHERE f.id = NEW.fase_id;
  END IF;

  IF TG_OP = 'UPDATE' AND v_finding_sync THEN
    IF (to_jsonb(NEW) - ARRAY['finding_id','finding_kategori','updated_at'])
      IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['finding_id','finding_kategori','updated_at']) THEN
      RAISE EXCEPTION 'Sinkronisasi Temuan Produk hanya boleh mengubah relasi Temuan.';
    END IF;
  ELSIF TG_OP = 'INSERT' AND v_new_status = 'Draft'
    AND (NEW.jumlah_sampel IS NOT NULL
      OR NEW.hasil_pemeriksaan IS NOT NULL
      OR NEW.judgment IS NOT NULL
      OR NEW.finding_kategori IS NOT NULL
      OR NEW.finding_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Checklist Produk masih Draft. Hasil pelaksanaan hanya dapat diisi setelah Checklist Siap Pelaksanaan.';
  ELSIF TG_OP = 'UPDATE' AND v_old_status = 'Draft' AND v_new_status = 'Draft'
    AND (NEW.jumlah_sampel, NEW.hasil_pemeriksaan, NEW.judgment, NEW.finding_kategori)
      IS DISTINCT FROM
        (OLD.jumlah_sampel, OLD.hasil_pemeriksaan, OLD.judgment, OLD.finding_kategori) THEN
    RAISE EXCEPTION 'Checklist Produk masih Draft. Hasil pelaksanaan hanya dapat diisi setelah Checklist Siap Pelaksanaan.';
  ELSIF TG_OP = 'INSERT' AND v_new_status = 'Selesai' THEN
    RAISE EXCEPTION 'Checklist Produk sudah siap untuk pelaksanaan. Kembalikan ke Draft sebelum menambah struktur persiapan.';
  ELSIF TG_OP = 'DELETE' AND v_old_status = 'Selesai' THEN
    RAISE EXCEPTION 'Checklist Produk sudah siap untuk pelaksanaan. Kembalikan ke Draft sebelum menghapus struktur persiapan.';
  ELSIF TG_OP = 'UPDATE' AND (v_old_status = 'Selesai' OR v_new_status = 'Selesai')
    AND (to_jsonb(NEW) - ARRAY['jumlah_sampel','hasil_pemeriksaan','judgment','finding_kategori','finding_id','updated_at'])
      IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['jumlah_sampel','hasil_pemeriksaan','judgment','finding_kategori','finding_id','updated_at']) THEN
    RAISE EXCEPTION 'Checklist Produk sudah siap untuk pelaksanaan. Kembalikan ke Draft sebelum mengubah struktur persiapan.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_completed_checklist_manufaktur_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_old_status text;
  v_new_status text;
  v_finding_sync boolean := COALESCE(current_setting('certitrack.finding_sync', true), '') = '1';
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT status INTO v_old_status FROM public.checklist_manufaktur_shift WHERE id = OLD.checklist_id;
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT status INTO v_new_status FROM public.checklist_manufaktur_shift WHERE id = NEW.checklist_id;
  END IF;

  IF TG_OP = 'UPDATE' AND v_finding_sync THEN
    IF (to_jsonb(NEW) - ARRAY['finding_id','updated_at'])
      IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['finding_id','updated_at']) THEN
      RAISE EXCEPTION 'Sinkronisasi Temuan Manufaktur/Shift hanya boleh mengubah relasi Temuan.';
    END IF;
  ELSIF TG_OP = 'INSERT' AND v_new_status = 'Draft'
    AND (NEW.hasil_pengamatan IS NOT NULL OR NEW.hasil IS NOT NULL OR NEW.finding_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Checklist Manufaktur/Shift masih Draft. Hasil pelaksanaan hanya dapat diisi setelah Checklist Siap Pelaksanaan.';
  ELSIF TG_OP = 'UPDATE' AND v_old_status = 'Draft' AND v_new_status = 'Draft'
    AND (NEW.hasil_pengamatan, NEW.hasil)
      IS DISTINCT FROM
        (OLD.hasil_pengamatan, OLD.hasil) THEN
    RAISE EXCEPTION 'Checklist Manufaktur/Shift masih Draft. Hasil pelaksanaan hanya dapat diisi setelah Checklist Siap Pelaksanaan.';
  ELSIF TG_OP = 'INSERT' AND v_new_status = 'Selesai' THEN
    RAISE EXCEPTION 'Checklist Manufaktur/Shift sudah siap untuk pelaksanaan. Kembalikan ke Draft sebelum menambah struktur persiapan.';
  ELSIF TG_OP = 'DELETE' AND v_old_status = 'Selesai' THEN
    RAISE EXCEPTION 'Checklist Manufaktur/Shift sudah siap untuk pelaksanaan. Kembalikan ke Draft sebelum menghapus struktur persiapan.';
  ELSIF TG_OP = 'UPDATE' AND (v_old_status = 'Selesai' OR v_new_status = 'Selesai')
    AND (to_jsonb(NEW) - ARRAY['hasil_pengamatan','hasil','finding_id','updated_at'])
      IS DISTINCT FROM
        (to_jsonb(OLD) - ARRAY['hasil_pengamatan','hasil','finding_id','updated_at']) THEN
    RAISE EXCEPTION 'Checklist Manufaktur/Shift sudah siap untuk pelaksanaan. Kembalikan ke Draft sebelum mengubah struktur persiapan.';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- Trigger helpers are private; their existing table triggers remain authoritative.
REVOKE ALL PRIVILEGES ON FUNCTION public.protect_ready_checklist_produk_header() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.protect_completed_checklist_produk_item() FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.protect_completed_checklist_manufaktur_item() FROM PUBLIC, anon, authenticated;
