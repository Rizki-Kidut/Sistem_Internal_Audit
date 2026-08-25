-- Batch 7 runtime correction: harden multi-table execution guard.
-- Avoid referencing record fields from a different trigger table, and preserve
-- explicit separation: Admin/QMS cannot perform audit execution; company Lead
-- remains read/review-only unless independently assigned to the owning Team.
CREATE OR REPLACE FUNCTION public.guard_identity_execution_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_identity text:=public.current_identity_type();
  v_sync boolean:=COALESCE(current_setting('certitrack.finding_sync',true),'')='1';
  v_annul text:=COALESCE(current_setting('certitrack.finding_annul_source',true),'');
  v_review text;
BEGIN
  IF v_annul<>'' AND v_identity='AUDITOR' THEN
    IF TG_TABLE_NAME='checklist_items' THEN
      IF OLD.finding_id::text=v_annul
         AND NEW.finding_id=OLD.finding_id
         AND NEW.hasil='O'
         AND (to_jsonb(NEW)-ARRAY['hasil','updated_at'])
             IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['hasil','updated_at']) THEN
        RETURN NEW;
      END IF;
    ELSIF TG_TABLE_NAME='checklist_produk_items' THEN
      IF OLD.finding_id::text=v_annul
         AND NEW.finding_id=OLD.finding_id
         AND NEW.judgment='OK'
         AND NEW.finding_kategori IS NULL
         AND (to_jsonb(NEW)-ARRAY['judgment','finding_kategori','updated_at'])
             IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['judgment','finding_kategori','updated_at']) THEN
        RETURN NEW;
      END IF;
    ELSIF TG_TABLE_NAME='checklist_manufaktur_items' THEN
      IF OLD.finding_id::text=v_annul
         AND NEW.finding_id=OLD.finding_id
         AND NEW.hasil='O'
         AND (to_jsonb(NEW)-ARRAY['hasil','updated_at'])
             IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['hasil','updated_at']) THEN
        RETURN NEW;
      END IF;
    END IF;
    RAISE EXCEPTION 'Konteks annulment hanya boleh menerapkan hasil conforming pada sumber Finding yang sama';
  END IF;

  IF v_sync THEN
    IF TG_TABLE_NAME='checklist_items' THEN
      IF (to_jsonb(NEW)-ARRAY['finding_id','updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['finding_id','updated_at']) THEN
        RAISE EXCEPTION 'Sinkronisasi hanya boleh mengubah finding_id';
      END IF;
    ELSIF TG_TABLE_NAME='checklist_produk_items' THEN
      IF (to_jsonb(NEW)-ARRAY['finding_id','finding_kategori','updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['finding_id','finding_kategori','updated_at']) THEN
        RAISE EXCEPTION 'Sinkronisasi hanya boleh mengubah relasi Finding';
      END IF;
    ELSIF TG_TABLE_NAME='checklist_manufaktur_items' THEN
      IF (to_jsonb(NEW)-ARRAY['finding_id','updated_at'])
         IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['finding_id','updated_at']) THEN
        RAISE EXCEPTION 'Sinkronisasi hanya boleh mengubah finding_id';
      END IF;
    ELSE
      RAISE EXCEPTION 'Konteks sinkronisasi Finding tidak valid untuk tabel %',TG_TABLE_NAME;
    END IF;
    RETURN NEW;
  END IF;

  IF v_identity='ADMIN' THEN
    IF TG_TABLE_NAME='audit_instruction_rows' THEN
      IF NEW.cek_selesai IS DISTINCT FROM OLD.cek_selesai THEN
        RAISE EXCEPTION 'Admin tidak dapat menyelesaikan/membuka pelaksanaan';
      END IF;
    ELSIF TG_TABLE_NAME='checklist_items' THEN
      IF (NEW.hasil,NEW.komentar_auditor)
         IS DISTINCT FROM (OLD.hasil,OLD.komentar_auditor) THEN
        RAISE EXCEPTION 'Admin tidak dapat mengisi pelaksanaan Sistem';
      END IF;
    ELSIF TG_TABLE_NAME='checklist_produk_items' THEN
      IF (NEW.jumlah_sampel,NEW.hasil_pemeriksaan,NEW.judgment,NEW.finding_kategori)
         IS DISTINCT FROM (OLD.jumlah_sampel,OLD.hasil_pemeriksaan,OLD.judgment,OLD.finding_kategori) THEN
        RAISE EXCEPTION 'Admin tidak dapat mengisi pelaksanaan Produk';
      END IF;
    ELSIF TG_TABLE_NAME='checklist_manufaktur_items' THEN
      IF (NEW.hasil_pengamatan,NEW.hasil)
         IS DISTINCT FROM (OLD.hasil_pengamatan,OLD.hasil) THEN
        RAISE EXCEPTION 'Admin tidak dapat mengisi pelaksanaan Manufaktur';
      END IF;
    ELSE
      RAISE EXCEPTION 'Guard pelaksanaan tidak mendukung tabel %',TG_TABLE_NAME;
    END IF;
    RETURN NEW;
  END IF;

  IF v_identity<>'AUDITOR' THEN
    RAISE EXCEPTION 'Identitas tidak diizinkan mengubah pelaksanaan';
  END IF;

  IF TG_TABLE_NAME<>'audit_instruction_rows' THEN
    SELECT review_status INTO v_review
    FROM public.findings
    WHERE id=OLD.finding_id;

    IF v_review IS NOT NULL
       AND v_review NOT IN('DRAFT','REVISION_REQUIRED') THEN
      RAISE EXCEPTION 'Hasil sumber terkunci pada tahap review %',v_review;
    END IF;
  END IF;

  IF TG_TABLE_NAME='audit_instruction_rows' THEN
    IF NOT public.auditor_can_access_instruction_row(OLD.id)
       OR (to_jsonb(NEW)-'cek_selesai'-'updated_at')
          IS DISTINCT FROM (to_jsonb(OLD)-'cek_selesai'-'updated_at') THEN
      RAISE EXCEPTION 'Auditor hanya dapat menyelesaikan audit Tim';
    END IF;
  ELSIF TG_TABLE_NAME='checklist_items' THEN
    IF (to_jsonb(NEW)-ARRAY['hasil','komentar_auditor','finding_id','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['hasil','komentar_auditor','finding_id','updated_at']) THEN
      RAISE EXCEPTION 'Struktur Sistem tidak dapat diubah Auditor';
    END IF;
  ELSIF TG_TABLE_NAME='checklist_produk_items' THEN
    IF (to_jsonb(NEW)-ARRAY['jumlah_sampel','hasil_pemeriksaan','judgment','finding_kategori','finding_id','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['jumlah_sampel','hasil_pemeriksaan','judgment','finding_kategori','finding_id','updated_at']) THEN
      RAISE EXCEPTION 'Struktur Produk tidak dapat diubah Auditor';
    END IF;
  ELSIF TG_TABLE_NAME='checklist_manufaktur_items' THEN
    IF (to_jsonb(NEW)-ARRAY['hasil_pengamatan','hasil','finding_id','updated_at'])
       IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['hasil_pengamatan','hasil','finding_id','updated_at']) THEN
      RAISE EXCEPTION 'Struktur Manufaktur tidak dapat diubah Auditor';
    END IF;
  ELSE
    RAISE EXCEPTION 'Guard pelaksanaan tidak mendukung tabel %',TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END $$;

-- Trigger implementation detail: never expose as a browser RPC.
REVOKE ALL ON FUNCTION public.guard_identity_execution_mutation()
FROM PUBLIC,anon,authenticated;
