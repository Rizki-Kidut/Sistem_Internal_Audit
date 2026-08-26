-- Fail closed when the caller omits the optimistic-concurrency revision.
CREATE OR REPLACE FUNCTION public.save_ltp_auditee_draft(
  p_car_id uuid,p_expected_revision integer,p_dampak_temuan text,p_manfaat_perbaikan text,
  p_why_analysis jsonb,p_actions jsonb,p_system_revisions jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_car public.cars%ROWTYPE; v_category text; v_item jsonb; v_type text; v_description text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autentikasi diperlukan'; END IF;
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id FOR UPDATE;
  IF NOT FOUND OR NOT public.auditee_can_edit_ltp(p_car_id) THEN RAISE EXCEPTION 'Auditee tidak diizinkan mengubah LTP ini'; END IF;
  IF v_car.revision_version IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'LTP_STALE_REVISION'; END IF;
  IF jsonb_typeof(COALESCE(p_why_analysis,'[]'))<>'array' OR jsonb_typeof(COALESCE(p_actions,'[]'))<>'array'
    OR jsonb_typeof(COALESCE(p_system_revisions,'[]'))<>'array' THEN RAISE EXCEPTION 'Payload Draft LTP tidak valid'; END IF;
  SELECT f.kategori INTO v_category FROM public.findings f WHERE f.id=v_car.finding_id;
  IF v_category='C' AND EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_why_analysis,'[]')) x WHERE btrim(x->>'teks')<>'')
    THEN RAISE EXCEPTION 'Kategori C tidak boleh memiliki analisa Why-Why'; END IF;

  UPDATE public.cars SET dampak_temuan=NULLIF(btrim(p_dampak_temuan),''),manfaat_perbaikan=NULLIF(btrim(p_manfaat_perbaikan),'') WHERE id=p_car_id;
  DELETE FROM public.car_why_analysis WHERE car_id=p_car_id;
  IF v_category IN ('A','B') THEN
    INSERT INTO public.car_why_analysis(car_id,level,teks)
    SELECT p_car_id,row_number() OVER (ORDER BY ord)::integer,btrim(value->>'teks')
    FROM jsonb_array_elements(COALESCE(p_why_analysis,'[]')) WITH ORDINALITY q(value,ord)
    WHERE btrim(value->>'teks')<>'';
  END IF;

  CREATE TEMP TABLE ltp_action_payload(action_type text PRIMARY KEY,description text,pic text,due_date date) ON COMMIT DROP;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(p_actions,'[]')) LOOP
    v_type:=v_item->>'action_type'; v_description:=btrim(v_item->>'description');
    IF v_type NOT IN ('TEMPORARY','CORRECTIVE','PREVENTIVE') THEN RAISE EXCEPTION 'Jenis tindakan LTP tidak valid'; END IF;
    IF v_description='' THEN CONTINUE; END IF;
    INSERT INTO ltp_action_payload VALUES(v_type,v_description,NULLIF(btrim(v_item->>'pic'),''),public.safe_date(v_item->>'due_date'));
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.car_actions a WHERE a.car_id=p_car_id AND NOT EXISTS(SELECT 1 FROM ltp_action_payload x WHERE x.action_type=a.action_type)
    AND EXISTS(SELECT 1 FROM public.car_action_evidence e WHERE e.action_id=a.id)) THEN
    RAISE EXCEPTION 'Tindakan yang memiliki bukti tidak dapat dikosongkan';
  END IF;
  DELETE FROM public.car_actions a WHERE a.car_id=p_car_id AND NOT EXISTS(SELECT 1 FROM ltp_action_payload x WHERE x.action_type=a.action_type);
  INSERT INTO public.car_actions(car_id,action_type,description,pic,due_date)
  SELECT p_car_id,action_type,description,pic,due_date FROM ltp_action_payload
  ON CONFLICT(car_id,action_type) DO UPDATE SET description=EXCLUDED.description,pic=EXCLUDED.pic,due_date=EXCLUDED.due_date;

  DELETE FROM public.car_system_revisions WHERE car_id=p_car_id;
  INSERT INTO public.car_system_revisions(car_id,kategori,nama_dokumen)
  SELECT p_car_id,value->>'kategori',btrim(value->>'nama_dokumen')
  FROM jsonb_array_elements(COALESCE(p_system_revisions,'[]'))
  WHERE btrim(value->>'nama_dokumen')<>'' AND value->>'kategori' IN ('Peraturan ISE','Dokumen Standard','Dokumen Lainnya');
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(p_system_revisions,'[]')) x
    WHERE btrim(x->>'nama_dokumen')<>'' AND x->>'kategori' NOT IN ('Peraturan ISE','Dokumen Standard','Dokumen Lainnya'))
    THEN RAISE EXCEPTION 'Kategori revisi sistem tidak valid'; END IF;
  UPDATE public.cars SET revision_version=revision_version+1 WHERE id=p_car_id RETURNING revision_version INTO p_expected_revision;
  RETURN p_expected_revision;
END $$;
