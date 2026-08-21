-- Batch 5d: one Agenda Internal Audit per QA / Instruction row.
-- Inherited instruction, process, section, manager, and Team data deliberately remain live.

CREATE TABLE public.audit_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_row_id uuid NOT NULL UNIQUE REFERENCES public.audit_instruction_rows(id) ON DELETE RESTRICT,
  tanggal_terbit date NOT NULL DEFAULT current_date,
  tujuan_lingkup_audit text,
  item_lain_yang_dicek text,
  dokumen_dikirim_di_awal text,
  dokumen_dipersiapkan_hari_audit text,
  asisten_auditor_pendamping jsonb NOT NULL DEFAULT '[]'::jsonb,
  catatan_khusus text,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Final')),
  kode_dokumen text NOT NULL DEFAULT 'Q-120-ISE-001-FORM-004',
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_agendas_assistants_array CHECK (jsonb_typeof(asisten_auditor_pendamping) = 'array')
);

CREATE TABLE public.audit_agenda_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agenda_id uuid NOT NULL REFERENCES public.audit_agendas(id) ON DELETE CASCADE,
  tanggal date NOT NULL,
  jam_mulai time NOT NULL,
  jam_selesai time NOT NULL,
  detail_audit_proses_persyaratan text NOT NULL,
  lokasi text,
  urutan integer NOT NULL CHECK (urutan > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_agenda_items_valid_time CHECK (jam_selesai > jam_mulai),
  CONSTRAINT audit_agenda_items_agenda_order_key UNIQUE (agenda_id, urutan)
);

CREATE INDEX idx_audit_agenda_items_agenda_date_time
  ON public.audit_agenda_items(agenda_id, tanggal, jam_mulai, jam_selesai);

CREATE TRIGGER set_audit_agendas_updated_at BEFORE UPDATE ON public.audit_agendas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_audit_agenda_items_updated_at BEFORE UPDATE ON public.audit_agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION public.validate_audit_agenda_creation_context(p_row_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_row public.audit_instruction_rows%ROWTYPE; v_team public.audit_team_masters%ROWTYPE;
  v_plan_id uuid;
BEGIN
  SELECT * INTO v_row FROM public.audit_instruction_rows WHERE id=p_row_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baris Instruksi Audit tidak ditemukan'; END IF;
  IF nullif(btrim(v_row.kode_audit),'') IS NULL THEN RAISE EXCEPTION 'No. Audit QA pada Instruksi wajib tersedia'; END IF;
  IF v_row.team_master_id IS NULL THEN RAISE EXCEPTION 'Pilih Tim Audit pada Instruksi Internal Audit sebelum membuat Agenda'; END IF;
  SELECT * INTO v_team FROM public.audit_team_masters WHERE id=v_row.team_master_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tim Audit Instruksi tidak ditemukan'; END IF;
  IF v_team.status<>'Aktif' OR NOT v_team.is_locked THEN
    RAISE EXCEPTION 'Tim Audit Instruksi harus aktif dan terkunci sebelum membuat Agenda';
  END IF;
  v_plan_id:=public.resolve_instruction_plan_id(p_row_id);
  IF v_team.plan_id IS DISTINCT FROM v_plan_id THEN
    RAISE EXCEPTION 'Tim Audit harus berasal dari Rencana Audit Tahunan yang sama dengan Instruksi';
  END IF;
  IF (SELECT count(*) FROM public.audit_team_master_members WHERE team_id=v_team.id AND peran='Lead')<>1
     OR NOT EXISTS(SELECT 1 FROM public.audit_team_master_members WHERE team_id=v_team.id) THEN
    RAISE EXCEPTION 'Tim Audit harus memiliki tepat satu Lead dan minimal satu auditor';
  END IF;
  IF EXISTS(SELECT 1 FROM public.audit_team_master_members m LEFT JOIN public.auditors a ON a.id=m.auditor_id
            WHERE m.team_id=v_team.id AND (a.id IS NULL OR a.status<>'Aktif')) THEN
    RAISE EXCEPTION 'Semua anggota Tim Audit harus merupakan auditor aktif';
  END IF;
END;
$$;

CREATE FUNCTION public.validate_audit_agenda_insert() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM public.validate_audit_agenda_creation_context(NEW.instruction_row_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_audit_agenda_insert BEFORE INSERT ON public.audit_agendas
  FOR EACH ROW EXECUTE FUNCTION public.validate_audit_agenda_insert();

CREATE FUNCTION public.validate_audit_agenda_assistants() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'Draft' THEN
    RAISE EXCEPTION 'Agenda baru harus berstatus Draft';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.asisten_auditor_pendamping) assistant
    WHERE jsonb_typeof(assistant) <> 'object'
       OR nullif(btrim(assistant->>'nama'), '') IS NULL
       OR nullif(btrim(assistant->>'seksi'), '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Asisten Auditor Pendamping harus berisi nama dan seksi yang valid';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_audit_agenda_assistants BEFORE INSERT OR UPDATE OF asisten_auditor_pendamping
  ON public.audit_agendas FOR EACH ROW EXECUTE FUNCTION public.validate_audit_agenda_assistants();

CREATE FUNCTION public.protect_final_audit_agenda() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.instruction_row_id IS DISTINCT FROM OLD.instruction_row_id THEN
    RAISE EXCEPTION 'Agenda Internal Audit tidak dapat dipindahkan ke baris Instruksi Audit lain.';
  END IF;
  IF NEW.status='Draft' AND NEW.finalized_at IS NOT NULL THEN
    RAISE EXCEPTION 'Agenda Draft tidak boleh memiliki waktu finalisasi.';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.status = 'Final' THEN
    RAISE EXCEPTION 'Agenda Final tidak dapat dihapus. Kembalikan ke Draft terlebih dahulu.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'Final'
     AND current_setting('app.audit_agenda_reopen_id', true) IS DISTINCT FROM OLD.id::text THEN
    RAISE EXCEPTION 'Agenda Final tidak dapat diubah. Kembalikan ke Draft terlebih dahulu.';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'Draft' AND NEW.status = 'Final'
     AND current_setting('app.audit_agenda_finalize_id', true) IS DISTINCT FROM OLD.id::text THEN
    RAISE EXCEPTION 'Agenda hanya dapat difinalkan melalui aksi Finalkan Agenda';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_final_audit_agenda BEFORE INSERT OR UPDATE OR DELETE ON public.audit_agendas
  FOR EACH ROW EXECUTE FUNCTION public.protect_final_audit_agenda();

CREATE FUNCTION public.protect_final_audit_agenda_item() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_agenda_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.agenda_id IS DISTINCT FROM OLD.agenda_id THEN
    RAISE EXCEPTION 'Item Timeline tidak dapat dipindahkan ke Agenda lain.';
  END IF;
  v_agenda_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.agenda_id ELSE NEW.agenda_id END;
  IF EXISTS (SELECT 1 FROM public.audit_agendas WHERE id = v_agenda_id AND status = 'Final') THEN
    RAISE EXCEPTION 'Timeline Agenda Final tidak dapat diubah. Kembalikan ke Draft terlebih dahulu.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_final_audit_agenda_item BEFORE INSERT OR UPDATE OR DELETE ON public.audit_agenda_items
  FOR EACH ROW EXECUTE FUNCTION public.protect_final_audit_agenda_item();

CREATE FUNCTION public.validate_audit_agenda_item_overlap() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.audit_agenda_items item
    WHERE item.agenda_id = NEW.agenda_id AND item.tanggal = NEW.tanggal
      AND item.id IS DISTINCT FROM NEW.id
      AND NEW.jam_mulai < item.jam_selesai AND NEW.jam_selesai > item.jam_mulai
  ) THEN
    RAISE EXCEPTION 'Waktu kegiatan Agenda tumpang tindih dengan kegiatan lain pada tanggal yang sama';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_audit_agenda_item_overlap BEFORE INSERT OR UPDATE OF agenda_id, tanggal, jam_mulai, jam_selesai
  ON public.audit_agenda_items FOR EACH ROW EXECUTE FUNCTION public.validate_audit_agenda_item_overlap();

CREATE FUNCTION public.create_audit_agenda_from_row(p_row_id uuid) RETURNS public.audit_agendas
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_agenda public.audit_agendas%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('create-audit-agenda'), hashtext(p_row_id::text));
  SELECT * INTO v_agenda FROM public.audit_agendas WHERE instruction_row_id = p_row_id;
  IF FOUND THEN RETURN v_agenda; END IF;
  PERFORM public.validate_audit_agenda_creation_context(p_row_id);
  INSERT INTO public.audit_agendas(instruction_row_id) VALUES(p_row_id) RETURNING * INTO v_agenda;
  RETURN v_agenda;
END;
$$;

CREATE FUNCTION public.finalize_audit_agenda(p_agenda_id uuid) RETURNS public.audit_agendas
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_agenda public.audit_agendas%ROWTYPE; v_row public.audit_instruction_rows%ROWTYPE;
  v_team public.audit_team_masters%ROWTYPE; v_plan_id uuid; v_item record; v_location text; v_count integer := 0;
BEGIN
  SELECT * INTO v_agenda FROM public.audit_agendas WHERE id=p_agenda_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agenda Internal Audit tidak ditemukan'; END IF;
  IF v_agenda.status='Final' THEN RETURN v_agenda; END IF;
  SELECT * INTO v_row FROM public.audit_instruction_rows WHERE id=v_agenda.instruction_row_id;
  IF NOT FOUND OR nullif(btrim(v_row.kode_audit),'') IS NULL THEN RAISE EXCEPTION 'Baris Instruksi atau No. Audit QA tidak tersedia'; END IF;
  IF v_row.team_master_id IS NULL THEN RAISE EXCEPTION 'Pilih Tim Audit pada Instruksi sebelum finalisasi Agenda'; END IF;
  SELECT * INTO v_team FROM public.audit_team_masters WHERE id=v_row.team_master_id;
  IF NOT FOUND OR v_team.status<>'Aktif' OR NOT v_team.is_locked THEN RAISE EXCEPTION 'Tim Audit harus aktif dan terkunci'; END IF;
  v_plan_id := public.resolve_instruction_plan_id(v_row.id);
  IF v_team.plan_id IS DISTINCT FROM v_plan_id THEN RAISE EXCEPTION 'Tim Audit tidak berasal dari Rencana Audit Tahunan yang sama'; END IF;
  IF (SELECT count(*) FROM public.audit_team_master_members WHERE team_id=v_team.id AND peran='Lead')<>1
     OR NOT EXISTS (SELECT 1 FROM public.audit_team_master_members WHERE team_id=v_team.id) THEN
    RAISE EXCEPTION 'Tim Audit harus memiliki tepat satu Lead dan minimal satu auditor';
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_team_master_members m LEFT JOIN public.auditors a ON a.id=m.auditor_id
             WHERE m.team_id=v_team.id AND (a.id IS NULL OR a.status<>'Aktif')) THEN
    RAISE EXCEPTION 'Agenda tidak dapat difinalkan karena terdapat auditor Tim Audit yang sudah tidak aktif.';
  END IF;
  IF nullif(btrim(v_agenda.tujuan_lingkup_audit),'') IS NULL THEN RAISE EXCEPTION 'Tujuan dan Lingkup Audit wajib diisi'; END IF;
  IF nullif(btrim(v_agenda.item_lain_yang_dicek),'') IS NULL THEN RAISE EXCEPTION 'Item Lain yang Dicek wajib diisi'; END IF;
  IF nullif(btrim(v_agenda.dokumen_dikirim_di_awal),'') IS NULL THEN RAISE EXCEPTION 'Dokumen yang Dikirim di Awal wajib diisi'; END IF;
  IF nullif(btrim(v_agenda.dokumen_dipersiapkan_hari_audit),'') IS NULL THEN RAISE EXCEPTION 'Dokumen yang Dipersiapkan di Hari Audit wajib diisi'; END IF;
  FOR v_item IN SELECT * FROM public.audit_agenda_items WHERE agenda_id=p_agenda_id ORDER BY urutan,id LOOP
    v_count := v_count + 1;
    IF nullif(btrim(v_item.detail_audit_proses_persyaratan),'') IS NULL THEN RAISE EXCEPTION 'Detail setiap kegiatan Timeline wajib diisi'; END IF;
    IF v_item.jam_selesai <= v_item.jam_mulai THEN RAISE EXCEPTION 'Jam Selesai harus lebih akhir dari Jam Mulai'; END IF;
    IF nullif(btrim(v_item.lokasi),'') IS NOT NULL THEN v_location := btrim(v_item.lokasi); END IF;
    IF v_location IS NULL THEN RAISE EXCEPTION 'Lokasi efektif kegiatan pertama Timeline wajib diisi'; END IF;
  END LOOP;
  IF v_count=0 THEN RAISE EXCEPTION 'Minimal satu kegiatan Timeline Audit wajib tersedia'; END IF;
  IF EXISTS (SELECT 1 FROM public.audit_agenda_items a JOIN public.audit_agenda_items b
      ON a.agenda_id=b.agenda_id AND a.tanggal=b.tanggal AND a.id<b.id
      AND a.jam_mulai<b.jam_selesai AND a.jam_selesai>b.jam_mulai WHERE a.agenda_id=p_agenda_id) THEN
    RAISE EXCEPTION 'Timeline memiliki rentang waktu yang tumpang tindih';
  END IF;
  PERFORM set_config('app.audit_agenda_finalize_id',p_agenda_id::text,true);
  UPDATE public.audit_agendas SET status='Final',finalized_at=now() WHERE id=p_agenda_id RETURNING * INTO v_agenda;
  RETURN v_agenda;
END;
$$;

CREATE FUNCTION public.return_audit_agenda_to_draft(p_agenda_id uuid) RETURNS public.audit_agendas
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_agenda public.audit_agendas%ROWTYPE;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.audit_agendas WHERE id=p_agenda_id) THEN RAISE EXCEPTION 'Agenda Internal Audit tidak ditemukan'; END IF;
  PERFORM set_config('app.audit_agenda_reopen_id',p_agenda_id::text,true);
  UPDATE public.audit_agendas SET status='Draft',finalized_at=NULL WHERE id=p_agenda_id RETURNING * INTO v_agenda;
  RETURN v_agenda;
END;
$$;

CREATE FUNCTION public.reorder_audit_agenda_items(p_agenda_id uuid,p_item_ids uuid[]) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_count integer;
BEGIN
  IF EXISTS(SELECT 1 FROM public.audit_agendas WHERE id=p_agenda_id AND status='Final') THEN RAISE EXCEPTION 'Timeline Agenda Final tidak dapat diubah'; END IF;
  SELECT count(*) INTO v_count FROM public.audit_agenda_items WHERE agenda_id=p_agenda_id;
  IF cardinality(p_item_ids)<>v_count OR (SELECT count(DISTINCT x.id) FROM unnest(p_item_ids) AS x(id))<>v_count
     OR EXISTS(SELECT 1 FROM unnest(p_item_ids) AS x(id) WHERE NOT EXISTS(SELECT 1 FROM public.audit_agenda_items i WHERE i.id=x.id AND i.agenda_id=p_agenda_id)) THEN
    RAISE EXCEPTION 'Urutan Timeline tidak valid';
  END IF;
  UPDATE public.audit_agenda_items SET urutan=urutan+1000000 WHERE agenda_id=p_agenda_id;
  UPDATE public.audit_agenda_items i SET urutan=x.position
    FROM unnest(p_item_ids) WITH ORDINALITY x(id,position) WHERE i.id=x.id AND i.agenda_id=p_agenda_id;
END;
$$;

ALTER TABLE public.audit_agendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_agenda_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_agendas_app_access ON public.audit_agendas FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);
CREATE POLICY audit_agenda_items_app_access ON public.audit_agenda_items FOR ALL TO anon,authenticated USING (true) WITH CHECK (true);

GRANT SELECT,INSERT,UPDATE,DELETE ON public.audit_agendas TO anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.audit_agenda_items TO anon,authenticated;
REVOKE ALL ON FUNCTION public.validate_audit_agenda_assistants() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_audit_agenda_creation_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_audit_agenda_insert() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_final_audit_agenda() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_final_audit_agenda_item() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_audit_agenda_item_overlap() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_audit_agenda_from_row(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_audit_agenda(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.return_audit_agenda_to_draft(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_audit_agenda_items(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_audit_agenda_from_row(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_audit_agenda(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.return_audit_agenda_to_draft(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_audit_agenda_items(uuid,uuid[]) TO anon,authenticated;
-- Required because create_audit_agenda_from_row remains SECURITY INVOKER and calls the shared validator.
GRANT EXECUTE ON FUNCTION public.validate_audit_agenda_creation_context(uuid) TO anon,authenticated;
