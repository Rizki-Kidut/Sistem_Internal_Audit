-- Batch 9a staging correction: make generic child immutability trigger safe across heterogeneous row types.
CREATE OR REPLACE FUNCTION public.protect_weakness_child()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new jsonb := CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE '{}'::jsonb END;
  v_old jsonb := CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  v_report_id uuid;
  v_why_id uuid;
BEGIN
  IF TG_TABLE_NAME IN ('weakness_analysis_report_items', 'weakness_why_analysis') THEN
    v_report_id := COALESCE(
      NULLIF(v_new->>'report_id', '')::uuid,
      NULLIF(v_old->>'report_id', '')::uuid
    );
  ELSIF TG_TABLE_NAME IN ('weakness_why_levels', 'weakness_actions') THEN
    v_why_id := COALESCE(
      NULLIF(v_new->>'why_analysis_id', '')::uuid,
      NULLIF(v_old->>'why_analysis_id', '')::uuid
    );
    SELECT report_id
      INTO v_report_id
      FROM public.weakness_why_analysis
     WHERE id = v_why_id;
  ELSE
    RAISE EXCEPTION 'Unsupported Weakness child table: %', TG_TABLE_NAME;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.weakness_analysis_reports
     WHERE id = v_report_id
       AND status = 'Final'
  ) THEN
    RAISE EXCEPTION 'FORM-010 Final bersifat immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
