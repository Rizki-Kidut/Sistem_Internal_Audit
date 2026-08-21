-- Batch 5d UX hardening: atomically persist one complete Draft Agenda document.
CREATE FUNCTION public.save_audit_agenda_draft(
  p_agenda_id uuid,
  p_tanggal_terbit date,
  p_tujuan_lingkup_audit text,
  p_item_lain_yang_dicek text,
  p_dokumen_dikirim_di_awal text,
  p_dokumen_dipersiapkan_hari_audit text,
  p_asisten_auditor_pendamping jsonb,
  p_catatan_khusus text,
  p_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_agenda public.audit_agendas%ROWTYPE; v_result jsonb;
BEGIN
  SELECT * INTO v_agenda FROM public.audit_agendas WHERE id=p_agenda_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agenda Internal Audit tidak ditemukan'; END IF;
  IF v_agenda.status<>'Draft' THEN RAISE EXCEPTION 'Hanya Agenda Draft yang dapat disimpan'; END IF;
  IF p_tanggal_terbit IS NULL THEN RAISE EXCEPTION 'Tanggal Terbit wajib diisi'; END IF;
  IF jsonb_typeof(COALESCE(p_asisten_auditor_pendamping,'[]'::jsonb))<>'array' THEN
    RAISE EXCEPTION 'Data Asisten Auditor Pendamping tidak valid';
  END IF;
  IF jsonb_typeof(COALESCE(p_items,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'Data Timeline Audit tidak valid'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) x
    WHERE jsonb_typeof(x)<>'object' OR nullif(x->>'tanggal','') IS NULL
      OR nullif(x->>'jam_mulai','') IS NULL OR nullif(x->>'jam_selesai','') IS NULL
      OR nullif(btrim(x->>'detail_audit_proses_persyaratan'),'') IS NULL) THEN
    RAISE EXCEPTION 'Setiap kegiatan wajib memiliki tanggal, waktu, dan Detail Audit';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) x
    WHERE (x->>'jam_selesai')::time <= (x->>'jam_mulai')::time) THEN
    RAISE EXCEPTION 'Jam Selesai harus lebih akhir dari Jam Mulai';
  END IF;

  UPDATE public.audit_agendas SET tanggal_terbit=p_tanggal_terbit,
    tujuan_lingkup_audit=p_tujuan_lingkup_audit,item_lain_yang_dicek=p_item_lain_yang_dicek,
    dokumen_dikirim_di_awal=p_dokumen_dikirim_di_awal,
    dokumen_dipersiapkan_hari_audit=p_dokumen_dipersiapkan_hari_audit,
    asisten_auditor_pendamping=COALESCE(p_asisten_auditor_pendamping,'[]'::jsonb),
    catatan_khusus=p_catatan_khusus WHERE id=p_agenda_id RETURNING * INTO v_agenda;

  DELETE FROM public.audit_agenda_items WHERE agenda_id=p_agenda_id;
  INSERT INTO public.audit_agenda_items(agenda_id,tanggal,jam_mulai,jam_selesai,detail_audit_proses_persyaratan,lokasi,urutan)
    SELECT p_agenda_id,(x.value->>'tanggal')::date,(x.value->>'jam_mulai')::time,
      (x.value->>'jam_selesai')::time,btrim(x.value->>'detail_audit_proses_persyaratan'),
      nullif(btrim(x.value->>'lokasi'),''),x.ordinality::integer
    FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) WITH ORDINALITY AS x(value,ordinality)
    ORDER BY x.ordinality;

  SELECT jsonb_build_object('agenda',to_jsonb(v_agenda),'items',COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.urutan),'[]'::jsonb))
    INTO v_result FROM public.audit_agenda_items i WHERE i.agenda_id=p_agenda_id;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_audit_agenda_draft(uuid,date,text,text,text,text,jsonb,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_audit_agenda_draft(uuid,date,text,text,text,text,jsonb,text,jsonb) TO anon,authenticated;
