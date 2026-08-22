-- Batch 6b refinement: separate Checklist preparation from Pelaksanaan execution.
-- Retained compatibility columns and historical values are intentionally preserved.

ALTER TABLE public.checklist_items DROP CONSTRAINT IF EXISTS checklist_items_kelompok_ipo_check;
ALTER TABLE public.checklist_items ADD CONSTRAINT checklist_items_kelompok_ipo_check CHECK (kelompok_ipo IN ('Input Proses','Method Proses','Output Proses','Resource','Analisa Risiko'));
ALTER TABLE public.checklist_items ALTER COLUMN metode_verifikasi DROP NOT NULL;

ALTER TABLE public.checklist_bank_items DROP CONSTRAINT IF EXISTS checklist_bank_items_kelompok_ipo_check;
ALTER TABLE public.checklist_bank_items ADD CONSTRAINT checklist_bank_items_kelompok_ipo_check CHECK (kelompok_ipo IN ('Input Proses','Method Proses','Output Proses','Resource','Analisa Risiko'));
ALTER TABLE public.checklist_bank_items ALTER COLUMN metode_verifikasi_default DROP NOT NULL;
ALTER TABLE public.checklist_bank_items ALTER COLUMN metode_verifikasi_default DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.audit_execution_blockers(p_row_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
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
      FOR v_item IN SELECT i.id,i.nomor,i.pertanyaan_utama AS label,i.hasil,i.komentar_auditor,i.finding_id FROM public.checklist_items i JOIN public.checklists c ON c.id=i.checklist_id WHERE c.row_id=p_row_id LOOP
        IF v_item.hasil IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Pertanyaan Checklist nomor %s belum memiliki Judgement.',COALESCE(v_item.nomor,'-')));
        END IF;
        IF COALESCE(btrim(v_item.komentar_auditor),'')='' THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Pertanyaan Checklist nomor %s belum memiliki Hasil Observasi.',COALESCE(v_item.nomor,'-')));
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
      FOR v_item IN SELECT i.id,i.item_pemeriksaan AS label,i.judgment,i.hasil_pemeriksaan,i.finding_kategori,i.finding_id FROM public.checklist_produk_items i JOIN public.checklist_produk_fase f ON f.id=i.fase_id JOIN public.checklist_produk c ON c.id=f.checklist_produk_id WHERE c.row_id=p_row_id LOOP
        IF v_item.judgment IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Produk %L belum memiliki Judgement.',v_item.label));
        END IF;
        IF COALESCE(btrim(v_item.hasil_pemeriksaan),'')='' THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Produk %L belum memiliki Hasil Pemeriksaan.',v_item.label));
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
      FOR v_item IN SELECT i.id,COALESCE(b.item_pemeriksaan,i.no_proses_dicek,'Tanpa nama') AS label,i.hasil,i.hasil_pengamatan,i.finding_id FROM public.checklist_manufaktur_items i JOIN public.checklist_manufaktur_shift c ON c.id=i.checklist_id LEFT JOIN public.checklist_manufaktur_bank_items b ON b.id=i.bank_item_id WHERE c.row_id=p_row_id LOOP
        IF v_item.hasil IS NULL THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Manufaktur/Shift %L belum memiliki Judgement.',v_item.label));
        END IF;
        IF COALESCE(btrim(v_item.hasil_pengamatan),'')='' THEN v_messages:=array_append(v_messages,format('Audit belum dapat diselesaikan. Item Manufaktur/Shift %L belum memiliki Hasil Pengamatan.',v_item.label));
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

-- Replacing the blocker must not undo the applied Batch 6b security hardening.
ALTER FUNCTION public.audit_execution_blockers(uuid) SECURITY INVOKER;
REVOKE ALL PRIVILEGES ON FUNCTION public.audit_execution_blockers(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_execution_blockers(uuid) TO anon, authenticated;
ALTER FUNCTION public.complete_audit_execution(uuid) SECURITY INVOKER;
ALTER FUNCTION public.reopen_audit_execution(uuid) SECURITY INVOKER;
