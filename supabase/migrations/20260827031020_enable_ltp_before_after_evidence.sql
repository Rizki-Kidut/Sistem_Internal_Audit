-- Complete the existing three-state LTP action-evidence model for Auditee authoring.

CREATE OR REPLACE FUNCTION public.ltp_evidence_state(p_path text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT CASE WHEN cardinality(storage.foldername(p_path))=4 AND (storage.foldername(p_path))[1]='ltp'
    AND (storage.foldername(p_path))[4] IN ('BEFORE','AFTER','BEFORE_AFTER') THEN (storage.foldername(p_path))[4] END
$$;

CREATE OR REPLACE FUNCTION public.register_ltp_action_evidence(p_action_id uuid,p_evidence_state text,p_file_name text,p_path text,p_mime_type text,p_size_bytes bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_car_id uuid; v_id uuid;
BEGIN
  SELECT car_id INTO v_car_id FROM public.car_actions WHERE id=p_action_id;
  IF v_car_id IS NULL THEN RAISE EXCEPTION 'Tindakan LTP tidak ditemukan'; END IF;
  PERFORM 1 FROM public.cars WHERE id=v_car_id FOR UPDATE;
  IF NOT public.auditee_can_edit_ltp(v_car_id) THEN RAISE EXCEPTION 'Bukti LTP tidak dapat diubah'; END IF;
  IF p_evidence_state NOT IN ('BEFORE','AFTER','BEFORE_AFTER') OR NOT public.ltp_evidence_path_matches(p_path)
    OR public.ltp_evidence_car_id(p_path)<>v_car_id OR public.ltp_evidence_action_id(p_path)<>p_action_id
    OR public.ltp_evidence_state(p_path)<>p_evidence_state THEN RAISE EXCEPTION 'Path bukti LTP tidak valid'; END IF;
  IF NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='audit-evidence' AND o.name=p_path)
    THEN RAISE EXCEPTION 'File bukti LTP tidak ditemukan di Storage'; END IF;
  INSERT INTO public.car_action_evidence(action_id,evidence_state,file_name,path,mime_type,size_bytes)
  VALUES(p_action_id,p_evidence_state,btrim(p_file_name),p_path,NULLIF(p_mime_type,''),p_size_bytes) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
