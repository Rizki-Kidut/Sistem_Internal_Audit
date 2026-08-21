-- Batch 6a: formal Temuan/PLOR generated authoritatively from Checklist results.

CREATE TABLE public.findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_row_id uuid NOT NULL REFERENCES public.audit_instruction_rows(id) ON DELETE RESTRICT,
  kode_audit text NOT NULL,
  kode_temuan text NOT NULL UNIQUE,
  nomor_urut_temuan integer NOT NULL CHECK (nomor_urut_temuan > 0),
  source_type text NOT NULL CHECK (source_type IN ('ChecklistSistem','ChecklistProduk','ChecklistManufakturShift')),
  source_item_id uuid NOT NULL,
  kategori text NOT NULL CHECK (kategori IN ('A','B','C')),
  klasifikasi_dis text CHECK (klasifikasi_dis IS NULL OR klasifikasi_dis IN ('Dokumen','Implementasi','Sistem')),
  problem text, location text, objective_evidence text, reference text, saran_perbaikan text,
  auditor_penemu_id uuid REFERENCES public.auditors(id) ON DELETE RESTRICT,
  auditee_area text,
  tanggal_temuan date NOT NULL,
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','CAR Submitted','Verifikasi','Closed','Overdue')),
  car_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_findings_source UNIQUE(source_type, source_item_id),
  CONSTRAINT uq_findings_qa_sequence UNIQUE(kode_audit, nomor_urut_temuan)
);
CREATE INDEX idx_findings_instruction_row ON public.findings(instruction_row_id);
CREATE INDEX idx_findings_kode_audit ON public.findings(kode_audit);
CREATE INDEX idx_findings_auditor ON public.findings(auditor_penemu_id);

ALTER TABLE public.checklist_produk_items
  ADD COLUMN finding_id uuid REFERENCES public.findings(id) ON DELETE RESTRICT,
  ADD COLUMN finding_kategori text CHECK (finding_kategori IS NULL OR finding_kategori IN ('A','B','C'));
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_finding_fk
  FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE RESTRICT;
ALTER TABLE public.checklist_manufaktur_items ADD CONSTRAINT checklist_manufaktur_items_finding_fk
  FOREIGN KEY (finding_id) REFERENCES public.findings(id) ON DELETE RESTRICT;
CREATE INDEX idx_checklist_produk_items_finding ON public.checklist_produk_items(finding_id);

CREATE TABLE public.clause_keyword_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), keyword text NOT NULL UNIQUE, klausul text NOT NULL,
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Nonaktif')),
  prioritas integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.clause_keyword_map(keyword,klausul,prioritas) VALUES
  ('kalibrasi','7.1.5',30),('kompetensi','7.2',20),('dokumen tidak terkendali','7.5',10);

CREATE FUNCTION public.finding_source_context(p_type text, p_item uuid)
RETURNS TABLE(instruction_row_id uuid,kode_audit text,note text,reference_suggestion text,auditee_area text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT c.row_id,c.kode_audit,i.komentar_auditor,i.klausul,
         concat_ws(' / ',p.nama_proses,NULLIF(c.seksi_auditee::text,'{}'))
  FROM public.checklist_items i JOIN public.checklists c ON c.id=i.checklist_id
  LEFT JOIN public.audit_instruction_rows r ON r.id=c.row_id LEFT JOIN public.proses p ON p.id=r.proses_id
  WHERE p_type='ChecklistSistem' AND i.id=p_item
  UNION ALL
  SELECT c.row_id,c.kode_audit,i.hasil_pengamatan,b.klausul,concat_ws(' / ',p.nama_proses,c.nama_seksi)
  FROM public.checklist_manufaktur_items i JOIN public.checklist_manufaktur_shift c ON c.id=i.checklist_id
  LEFT JOIN public.checklist_manufaktur_bank_items b ON b.id=i.bank_item_id
  LEFT JOIN public.audit_instruction_rows r ON r.id=c.row_id LEFT JOIN public.proses p ON p.id=r.proses_id
  WHERE p_type='ChecklistManufakturShift' AND i.id=p_item
  UNION ALL
  SELECT c.row_id,c.kode_audit,i.hasil_pemeriksaan,i.standar_kriteria,concat_ws(' / ',p.nama_proses,f.nama_fase)
  FROM public.checklist_produk_items i JOIN public.checklist_produk_fase f ON f.id=i.fase_id
  JOIN public.checklist_produk c ON c.id=f.checklist_produk_id
  LEFT JOIN public.audit_instruction_rows r ON r.id=c.row_id LEFT JOIN public.proses p ON p.id=r.proses_id
  WHERE p_type='ChecklistProduk' AND i.id=p_item
$$;

CREATE FUNCTION public.sync_checklist_finding(p_type text,p_item uuid,p_category text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_ctx record; v_row record; v_f public.findings%ROWTYPE; v_id uuid; v_seq integer; v_prefix text; v_lead uuid; v_previous_sync text;
BEGIN
  SELECT * INTO v_ctx FROM public.finding_source_context(p_type,p_item);
  IF NOT FOUND THEN RAISE EXCEPTION 'Sumber Checklist Temuan tidak ditemukan'; END IF;
  SELECT r.*,i.tahun_fiskal INTO v_row FROM public.audit_instruction_rows r
    JOIN public.audit_instructions i ON i.id=r.instruction_id WHERE r.id=v_ctx.instruction_row_id FOR UPDATE OF r;
  IF v_row.kode_audit IS DISTINCT FROM v_ctx.kode_audit THEN RAISE EXCEPTION 'Sumber Checklist tidak dimiliki No. Audit yang sama'; END IF;
  SELECT * INTO v_f FROM public.findings WHERE source_type=p_type AND source_item_id=p_item;
  IF p_category IS NULL THEN
    IF v_f.id IS NULL THEN RETURN NULL; END IF;
    IF v_f.status <> 'Open' OR v_f.car_id IS NOT NULL OR
       COALESCE(btrim(v_f.klasifikasi_dis),'')<>'' OR COALESCE(btrim(v_f.problem),'')<>'' OR
       COALESCE(btrim(v_f.location),'')<>'' OR COALESCE(btrim(v_f.objective_evidence),'')<>'' OR
       COALESCE(btrim(v_f.reference),'')<>'' OR COALESCE(btrim(v_f.saran_perbaikan),'')<>'' THEN
      RAISE EXCEPTION 'Temuan sudah memiliki data PLOR dan tidak dapat dibatalkan otomatis. Kosongkan data PLOR terlebih dahulu jika hasil checklist memang akan dikoreksi.';
    END IF;
    v_previous_sync:=current_setting('certitrack.finding_sync',true);
    PERFORM set_config('certitrack.finding_sync','1',true);
    BEGIN
      IF p_type='ChecklistSistem' THEN
        UPDATE public.checklist_items SET finding_id=NULL WHERE id=p_item AND finding_id=v_f.id;
      ELSIF p_type='ChecklistManufakturShift' THEN
        UPDATE public.checklist_manufaktur_items SET finding_id=NULL WHERE id=p_item AND finding_id=v_f.id;
      ELSE
        UPDATE public.checklist_produk_items SET finding_id=NULL,finding_kategori=NULL WHERE id=p_item AND finding_id=v_f.id;
      END IF;
      DELETE FROM public.findings WHERE id=v_f.id;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
      RAISE;
    END;
    PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
    RETURN NULL;
  END IF;
  IF p_category NOT IN ('A','B','C') THEN RAISE EXCEPTION 'Kategori Temuan tidak valid'; END IF;
  IF v_f.id IS NOT NULL THEN
    v_previous_sync:=current_setting('certitrack.finding_sync',true);
    PERFORM set_config('certitrack.finding_sync','1',true);
    BEGIN
      UPDATE public.findings SET kategori=p_category WHERE id=v_f.id AND kategori IS DISTINCT FROM p_category;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
      RAISE;
    END;
    PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
    RETURN v_f.id;
  END IF;
  SELECT COALESCE(MAX(nomor_urut_temuan),0)+1 INTO v_seq FROM public.findings WHERE kode_audit=v_ctx.kode_audit;
  v_prefix:=CASE p_type WHEN 'ChecklistSistem' THEN 'SYS' WHEN 'ChecklistProduk' THEN 'PRD' ELSE 'MFG' END;
  SELECT m.auditor_id INTO v_lead FROM public.audit_team_master_members m
    WHERE m.team_id=v_row.team_master_id AND m.peran='Lead' LIMIT 1;
  INSERT INTO public.findings(instruction_row_id,kode_audit,kode_temuan,nomor_urut_temuan,source_type,source_item_id,kategori,auditor_penemu_id,auditee_area,tanggal_temuan)
  VALUES(v_ctx.instruction_row_id,v_ctx.kode_audit,v_ctx.kode_audit||'/'||v_prefix||'/'||v_row.tahun_fiskal||'/'||lpad(v_seq::text,3,'0'),v_seq,p_type,p_item,p_category,v_lead,NULLIF(v_ctx.auditee_area,''),COALESCE(v_row.tanggal_pelaksanaan_audit,current_date)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.protect_finding_update() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF COALESCE(current_setting('certitrack.finding_sync',true),'')='1' THEN RETURN NEW; END IF;
  IF (NEW.instruction_row_id,NEW.kode_audit,NEW.kode_temuan,NEW.nomor_urut_temuan,NEW.source_type,NEW.source_item_id,NEW.kategori,NEW.status,NEW.car_id)
    IS DISTINCT FROM (OLD.instruction_row_id,OLD.kode_audit,OLD.kode_temuan,OLD.nomor_urut_temuan,OLD.source_type,OLD.source_item_id,OLD.kategori,OLD.status,OLD.car_id)
  THEN RAISE EXCEPTION 'Identitas, kategori, status, dan relasi Temuan dikelola sistem dan tidak dapat diubah'; END IF;
  IF NEW.auditor_penemu_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.audit_instruction_rows r JOIN public.audit_team_master_members m ON m.team_id=r.team_master_id WHERE r.id=NEW.instruction_row_id AND m.auditor_id=NEW.auditor_penemu_id)
  THEN RAISE EXCEPTION 'Auditor Penemu harus merupakan anggota Tim Audit No. Audit ini'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_protect_finding_update BEFORE UPDATE ON public.findings FOR EACH ROW EXECUTE FUNCTION public.protect_finding_update();
CREATE TRIGGER set_findings_updated_at BEFORE UPDATE ON public.findings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_clause_keyword_map_updated_at BEFORE UPDATE ON public.clause_keyword_map FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION public.sync_system_finding() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid; v_previous_sync text;
BEGIN
 IF COALESCE(current_setting('certitrack.finding_sync',true),'')='1' THEN RETURN NEW; END IF;
 IF (TG_OP='INSERT' AND NEW.finding_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.finding_id IS DISTINCT FROM OLD.finding_id) THEN RAISE EXCEPTION 'finding_id dikelola otomatis oleh sistem'; END IF;
 IF NEW.hasil IN ('A','B','C') AND COALESCE(btrim(NEW.komentar_auditor),'')='' THEN RAISE EXCEPTION 'Catatan Auditor wajib diisi untuk hasil A, B, atau C'; END IF;
 v_id:=public.sync_checklist_finding('ChecklistSistem',NEW.id,CASE WHEN NEW.hasil IN ('A','B','C') THEN NEW.hasil END);
 IF NEW.finding_id IS DISTINCT FROM v_id THEN
   v_previous_sync:=current_setting('certitrack.finding_sync',true); PERFORM set_config('certitrack.finding_sync','1',true);
   BEGIN UPDATE public.checklist_items SET finding_id=v_id WHERE id=NEW.id;
   EXCEPTION WHEN OTHERS THEN PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true); RAISE; END;
   PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.sync_manufacturing_finding() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid; v_previous_sync text;
BEGIN
 IF COALESCE(current_setting('certitrack.finding_sync',true),'')='1' THEN RETURN NEW; END IF;
 IF (TG_OP='INSERT' AND NEW.finding_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.finding_id IS DISTINCT FROM OLD.finding_id) THEN RAISE EXCEPTION 'finding_id dikelola otomatis oleh sistem'; END IF;
 IF NEW.hasil IN ('A','B','C') AND COALESCE(btrim(NEW.hasil_pengamatan),'')='' THEN RAISE EXCEPTION 'Hasil Pengamatan wajib diisi untuk hasil A, B, atau C'; END IF;
 v_id:=public.sync_checklist_finding('ChecklistManufakturShift',NEW.id,CASE WHEN NEW.hasil IN ('A','B','C') THEN NEW.hasil END);
 IF NEW.finding_id IS DISTINCT FROM v_id THEN
   v_previous_sync:=current_setting('certitrack.finding_sync',true); PERFORM set_config('certitrack.finding_sync','1',true);
   BEGIN UPDATE public.checklist_manufaktur_items SET finding_id=v_id WHERE id=NEW.id;
   EXCEPTION WHEN OTHERS THEN PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true); RAISE; END;
   PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION public.sync_product_finding() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid; v_previous_sync text; v_desired_category text;
BEGIN
 IF COALESCE(current_setting('certitrack.finding_sync',true),'')='1' THEN RETURN NEW; END IF;
 IF (TG_OP='INSERT' AND NEW.finding_id IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.finding_id IS DISTINCT FROM OLD.finding_id) THEN RAISE EXCEPTION 'finding_id dikelola otomatis oleh sistem'; END IF;
 IF NEW.judgment='NG' AND COALESCE(btrim(NEW.hasil_pemeriksaan),'')='' THEN RAISE EXCEPTION 'Hasil Pemeriksaan wajib diisi untuk judgment NG'; END IF;
 IF NEW.judgment='NG' AND NEW.finding_kategori IS NULL THEN RAISE EXCEPTION 'Kategori Temuan wajib dipilih untuk judgment NG'; END IF;
 v_desired_category:=CASE WHEN NEW.judgment='NG' THEN NEW.finding_kategori END;
 v_id:=public.sync_checklist_finding('ChecklistProduk',NEW.id,v_desired_category);
 IF NEW.finding_id IS DISTINCT FROM v_id OR NEW.finding_kategori IS DISTINCT FROM v_desired_category THEN
   v_previous_sync:=current_setting('certitrack.finding_sync',true); PERFORM set_config('certitrack.finding_sync','1',true);
   BEGIN UPDATE public.checklist_produk_items SET finding_id=v_id,finding_kategori=v_desired_category WHERE id=NEW.id;
   EXCEPTION WHEN OTHERS THEN PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true); RAISE; END;
   PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER trg_sync_system_finding AFTER INSERT OR UPDATE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.sync_system_finding();
CREATE TRIGGER trg_sync_manufacturing_finding AFTER INSERT OR UPDATE ON public.checklist_manufaktur_items FOR EACH ROW EXECUTE FUNCTION public.sync_manufacturing_finding();
CREATE TRIGGER trg_sync_product_finding AFTER INSERT OR UPDATE ON public.checklist_produk_items FOR EACH ROW EXECUTE FUNCTION public.sync_product_finding();

CREATE FUNCTION public.guard_source_finding_delete() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN IF OLD.finding_id IS NOT NULL THEN RAISE EXCEPTION 'Item Checklist masih memiliki Temuan yang terhubung.'; END IF; RETURN OLD; END $$;
CREATE TRIGGER trg_guard_system_finding_delete BEFORE DELETE ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.guard_source_finding_delete();
CREATE TRIGGER trg_guard_manufacturing_finding_delete BEFORE DELETE ON public.checklist_manufaktur_items FOR EACH ROW EXECUTE FUNCTION public.guard_source_finding_delete();
CREATE TRIGGER trg_guard_product_finding_delete BEFORE DELETE ON public.checklist_produk_items FOR EACH ROW EXECUTE FUNCTION public.guard_source_finding_delete();

ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.clause_keyword_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY findings_select ON public.findings FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY findings_update ON public.findings FOR UPDATE TO anon,authenticated USING(true) WITH CHECK(true);
CREATE POLICY clause_keyword_map_select ON public.clause_keyword_map FOR SELECT TO anon,authenticated USING(true);
GRANT SELECT,UPDATE ON public.findings TO anon,authenticated;
GRANT SELECT ON public.clause_keyword_map TO anon,authenticated;
REVOKE ALL ON FUNCTION public.finding_source_context(text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_checklist_finding(text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_finding_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_system_finding() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_manufacturing_finding() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_product_finding() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_source_finding_delete() FROM PUBLIC;
