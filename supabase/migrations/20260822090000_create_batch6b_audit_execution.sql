-- Batch 6b: authoritative, QA-based audit execution completion.
-- This migration intentionally has no dependency on or write to legacy Jadwal tables.

CREATE FUNCTION public.audit_execution_blockers(p_row_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_row public.audit_instruction_rows%ROWTYPE; v_messages text[] := ARRAY[]::text[]; v_count integer; v_item record; v_f public.findings%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.audit_instruction_rows WHERE id=p_row_id;
  IF NOT FOUND THEN RETURN ARRAY['Audit belum dapat diselesaikan. Baris Instruksi Audit tidak ditemukan.']; END IF;

  IF v_row.tipe_baris='Reguler' THEN
    SELECT count(*) INTO v_count FROM public.checklists WHERE row_id=p_row_id;
    IF v_count=0 THEN v_messages:=array_append(v_messages,'Audit belum dapat diselesaikan. Checklist Sistem belum dibuat.');
    ELSE
      SELECT count(*) INTO v_count FROM public.checklist_items i JOIN public.checklists c ON c.id=i.checklist_id WHERE c.row_id=p_row_id;
      IF v_count=0 THEN v_messages:=array_append(v_messages,'Audit belum dapat diselesaikan. Checklist Sistem belum memiliki item.'); END IF;
      FOR v_item IN SELECT i.id,i.pertanyaan_utama AS label,i.hasil,i.finding_id FROM public.checklist_items i JOIN public.checklists c ON c.id=i.checklist_id WHERE c.row_id=p_row_id LOOP
        IF v_item.hasil IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Checklist %L belum dievaluasi.',v_item.label));
        ELSIF v_item.hasil IN ('A','B','C') AND v_item.finding_id IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Checklist %L kategori %s belum memiliki Temuan terhubung.',v_item.label,v_item.hasil)); END IF;
      END LOOP;
    END IF;
  ELSIF v_row.tipe_baris='AuditProduk' THEN
    SELECT count(*) INTO v_count FROM public.checklist_produk WHERE row_id=p_row_id;
    IF v_count=0 THEN v_messages:=array_append(v_messages,'Audit belum dapat diselesaikan. Checklist Produk belum dibuat.');
    ELSE
      IF EXISTS(SELECT 1 FROM public.checklist_produk WHERE row_id=p_row_id AND status<>'Selesai') THEN v_messages:=array_append(v_messages,'Audit belum dapat diselesaikan. Checklist Produk belum ditandai Selesai.'); END IF;
      SELECT count(*) INTO v_count FROM public.checklist_produk_items i JOIN public.checklist_produk_fase f ON f.id=i.fase_id JOIN public.checklist_produk c ON c.id=f.checklist_produk_id WHERE c.row_id=p_row_id;
      IF v_count=0 THEN v_messages:=array_append(v_messages,'Audit belum dapat diselesaikan. Checklist Produk belum memiliki item.'); END IF;
      FOR v_item IN SELECT i.id,i.item_pemeriksaan AS label,i.judgment,i.finding_kategori,i.finding_id FROM public.checklist_produk_items i JOIN public.checklist_produk_fase f ON f.id=i.fase_id JOIN public.checklist_produk c ON c.id=f.checklist_produk_id WHERE c.row_id=p_row_id LOOP
        IF v_item.judgment IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Produk %L belum dinilai.',v_item.label));
        ELSIF v_item.judgment='NG' AND (v_item.finding_kategori IS NULL OR v_item.finding_id IS NULL) THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Produk %L berstatus NG tetapi kategori/Temuan belum lengkap.',v_item.label)); END IF;
      END LOOP;
    END IF;
  ELSE
    SELECT count(*) INTO v_count FROM public.checklist_manufaktur_shift WHERE row_id=p_row_id;
    IF v_count=0 THEN v_messages:=array_append(v_messages,'Audit belum dapat diselesaikan. Checklist Manufaktur/Shift belum dibuat.');
    ELSE
      IF EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift WHERE row_id=p_row_id AND status<>'Selesai') THEN v_messages:=array_append(v_messages,'Audit belum dapat diselesaikan. Checklist Manufaktur/Shift belum ditandai Selesai.'); END IF;
      SELECT count(*) INTO v_count FROM public.checklist_manufaktur_items i JOIN public.checklist_manufaktur_shift c ON c.id=i.checklist_id WHERE c.row_id=p_row_id;
      IF v_count=0 THEN v_messages:=array_append(v_messages,'Audit belum dapat diselesaikan. Checklist Manufaktur/Shift belum memiliki item.'); END IF;
      FOR v_item IN SELECT i.id,COALESCE(b.item_pemeriksaan,i.no_proses_dicek,'Tanpa nama') AS label,i.hasil,i.finding_id FROM public.checklist_manufaktur_items i JOIN public.checklist_manufaktur_shift c ON c.id=i.checklist_id LEFT JOIN public.checklist_manufaktur_bank_items b ON b.id=i.bank_item_id WHERE c.row_id=p_row_id LOOP
        IF v_item.hasil IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Manufaktur/Shift %L belum dievaluasi.',v_item.label));
        ELSIF v_item.hasil IN ('A','B','C') AND v_item.finding_id IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Manufaktur/Shift %L kategori %s belum memiliki Temuan terhubung.',v_item.label,v_item.hasil)); END IF;
      END LOOP;
    END IF;
  END IF;

  FOR v_f IN SELECT * FROM public.findings WHERE instruction_row_id=p_row_id ORDER BY kode_temuan LOOP
    IF COALESCE(btrim(v_f.problem),'')='' THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Temuan %s belum memiliki Problem.',v_f.kode_temuan)); END IF;
    IF COALESCE(btrim(v_f.location),'')='' THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Temuan %s belum memiliki Location.',v_f.kode_temuan)); END IF;
    IF COALESCE(btrim(v_f.objective_evidence),'')='' THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Temuan %s belum memiliki Objective Evidence.',v_f.kode_temuan)); END IF;
    IF v_f.auditor_penemu_id IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Temuan %s belum memiliki Auditor Penemu.',v_f.kode_temuan)); END IF;
    IF v_f.tanggal_temuan IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Temuan %s belum memiliki Tanggal Temuan.',v_f.kode_temuan)); END IF;
    IF v_f.kategori='C' AND COALESCE(btrim(v_f.saran_perbaikan),'')='' THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Temuan %s kategori C belum memiliki Saran Perbaikan.',v_f.kode_temuan));
    ELSIF v_f.kategori IN ('A','B') AND COALESCE(btrim(v_f.reference),'')='' THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Temuan %s kategori %s belum memiliki Reference.',v_f.kode_temuan,v_f.kategori)); END IF;
  END LOOP;
  RETURN v_messages;
END $$;

CREATE FUNCTION public.protect_audit_execution_completion() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.cek_selesai IS DISTINCT FROM OLD.cek_selesai AND COALESCE(current_setting('certitrack.execution_completion',true),'')<>'1' THEN
    RAISE EXCEPTION 'Status selesai dikelola melalui Pelaksanaan Audit.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_audit_execution_completion BEFORE UPDATE OF cek_selesai ON public.audit_instruction_rows FOR EACH ROW EXECUTE FUNCTION public.protect_audit_execution_completion();

CREATE FUNCTION public.complete_audit_execution(p_row_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_messages text[];
BEGIN
  PERFORM 1 FROM public.audit_instruction_rows WHERE id=p_row_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Audit belum dapat diselesaikan. Baris Instruksi Audit tidak ditemukan.'; END IF;
  v_messages:=public.audit_execution_blockers(p_row_id);
  IF cardinality(v_messages)>0 THEN RAISE EXCEPTION '%',array_to_string(v_messages,E'\n'); END IF;
  PERFORM set_config('certitrack.execution_completion','1',true);
  UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id=p_row_id;
END $$;

CREATE FUNCTION public.reopen_audit_execution(p_row_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM 1 FROM public.audit_instruction_rows WHERE id=p_row_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pelaksanaan Audit tidak ditemukan.'; END IF;
  PERFORM set_config('certitrack.execution_completion','1',true);
  UPDATE public.audit_instruction_rows SET cek_selesai=false WHERE id=p_row_id;
END $$;

REVOKE ALL ON FUNCTION public.audit_execution_blockers(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_audit_execution_completion() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_audit_execution(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_audit_execution(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_audit_execution(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_audit_execution(uuid) TO anon,authenticated;
