-- Batch 9b Staging hardening: dispatch Final immutability triggers by table
-- before referencing table-specific OLD/NEW fields.

CREATE OR REPLACE FUNCTION public.protect_form014_final()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'rangkuman_hasil_audit_reports' THEN
    IF OLD.status = 'Final' THEN
      RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
    END IF;
  ELSIF TG_TABLE_NAME IN ('rangkuman_hasil_audit_groups','rangkuman_hasil_audit_items') THEN
    IF EXISTS (
      SELECT 1
      FROM public.rangkuman_hasil_audit_reports r
      WHERE r.id = OLD.report_id
        AND r.status = 'Final'
    ) THEN
      RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
    END IF;
  ELSIF TG_TABLE_NAME = 'rangkuman_hasil_audit_group_rows' THEN
    IF EXISTS (
      SELECT 1
      FROM public.rangkuman_hasil_audit_groups g
      JOIN public.rangkuman_hasil_audit_reports r ON r.id = g.report_id
      WHERE g.id = OLD.group_id
        AND r.status = 'Final'
    ) THEN
      RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END
$$;

CREATE OR REPLACE FUNCTION public.protect_form014_final_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_TABLE_NAME IN ('rangkuman_hasil_audit_groups','rangkuman_hasil_audit_items') THEN
    IF EXISTS (
      SELECT 1
      FROM public.rangkuman_hasil_audit_reports r
      WHERE r.id = NEW.report_id
        AND r.status = 'Final'
    ) THEN
      RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
    END IF;
  ELSIF TG_TABLE_NAME = 'rangkuman_hasil_audit_group_rows' THEN
    IF EXISTS (
      SELECT 1
      FROM public.rangkuman_hasil_audit_groups g
      JOIN public.rangkuman_hasil_audit_reports r ON r.id = g.report_id
      WHERE g.id = NEW.group_id
        AND r.status = 'Final'
    ) THEN
      RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';
    END IF;
  END IF;

  RETURN NEW;
END
$$;
