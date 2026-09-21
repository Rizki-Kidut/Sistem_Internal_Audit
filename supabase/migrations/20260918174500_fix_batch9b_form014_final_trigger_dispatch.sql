-- Batch 9b follow-up: make Final immutability trigger dispatch table-safe.
-- The original Batch 9b migration is already applied on Staging and must remain immutable.

CREATE OR REPLACE FUNCTION public.protect_form014_final()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public
AS $$
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'rangkuman_hasil_audit_reports' THEN
      IF OLD.status='Final' THEN
        RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
      END IF;
    WHEN 'rangkuman_hasil_audit_groups', 'rangkuman_hasil_audit_items' THEN
      IF EXISTS(
        SELECT 1
        FROM public.rangkuman_hasil_audit_reports r
        WHERE r.id=OLD.report_id
          AND r.status='Final'
      ) THEN
        RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
      END IF;
    WHEN 'rangkuman_hasil_audit_group_rows' THEN
      IF EXISTS(
        SELECT 1
        FROM public.rangkuman_hasil_audit_groups g
        JOIN public.rangkuman_hasil_audit_reports r ON r.id=g.report_id
        WHERE g.id=OLD.group_id
          AND r.status='Final'
      ) THEN
        RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Tabel FORM-014 tidak dikenali: %',TG_TABLE_NAME;
  END CASE;

  IF TG_OP='DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.protect_form014_final_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public
AS $$
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'rangkuman_hasil_audit_groups', 'rangkuman_hasil_audit_items' THEN
      IF EXISTS(
        SELECT 1
        FROM public.rangkuman_hasil_audit_reports r
        WHERE r.id=NEW.report_id
          AND r.status='Final'
      ) THEN
        RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
      END IF;
    WHEN 'rangkuman_hasil_audit_group_rows' THEN
      IF EXISTS(
        SELECT 1
        FROM public.rangkuman_hasil_audit_groups g
        JOIN public.rangkuman_hasil_audit_reports r ON r.id=g.report_id
        WHERE g.id=NEW.group_id
          AND r.status='Final'
      ) THEN
        RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Tabel child FORM-014 tidak dikenali: %',TG_TABLE_NAME;
  END CASE;

  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.protect_form014_final(),public.protect_form014_final_insert()
FROM PUBLIC,anon,authenticated;
