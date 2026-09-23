-- Fix pre-existing heterogeneous trigger dispatch in guard_identity_execution_insert().
-- The same trigger function is attached to System, Product, and Manufacturing item tables.
-- Accessing NEW.<table-specific-column> directly causes PostgreSQL record-field errors on
-- the other tables even when the TG_TABLE_NAME branch is false. Dispatch through jsonb
-- preserves the existing business rules without cross-table record-field resolution.

CREATE OR REPLACE FUNCTION public.guard_identity_execution_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
BEGIN
  IF public.current_identity_type()<>'ADMIN' THEN
    RAISE EXCEPTION 'Hanya Admin dapat menambah struktur persiapan';
  END IF;

  IF TG_TABLE_NAME='checklist_items'
     AND (
       v_new->>'hasil' IS NOT NULL
       OR v_new->>'komentar_auditor' IS NOT NULL
       OR v_new->>'finding_id' IS NOT NULL
     )
  THEN
    RAISE EXCEPTION 'Item persiapan Sistem tidak boleh berisi hasil pelaksanaan';
  END IF;

  IF TG_TABLE_NAME='checklist_produk_items'
     AND (
       v_new->>'jumlah_sampel' IS NOT NULL
       OR v_new->>'hasil_pemeriksaan' IS NOT NULL
       OR v_new->>'judgment' IS NOT NULL
       OR v_new->>'finding_kategori' IS NOT NULL
       OR v_new->>'finding_id' IS NOT NULL
     )
  THEN
    RAISE EXCEPTION 'Item persiapan Produk tidak boleh berisi hasil pelaksanaan';
  END IF;

  IF TG_TABLE_NAME='checklist_manufaktur_items'
     AND (
       v_new->>'hasil_pengamatan' IS NOT NULL
       OR v_new->>'hasil' IS NOT NULL
       OR v_new->>'finding_id' IS NOT NULL
     )
  THEN
    RAISE EXCEPTION 'Item persiapan Manufaktur tidak boleh berisi hasil pelaksanaan';
  END IF;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.guard_identity_execution_insert() FROM PUBLIC, anon, authenticated;
