-- Batch 7 runtime correction: validate identity mappings without referencing fields
-- that do not exist on the trigger's current table.
-- Applied additively because the Batch 7 identity foundation is already on Staging.
CREATE OR REPLACE FUNCTION public.validate_identity_mapping()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_type text;
BEGIN
  SELECT identity_type
  INTO v_type
  FROM public.user_profiles
  WHERE id=NEW.user_id;

  IF TG_TABLE_NAME='user_auditor_links' THEN
    IF v_type<>'AUDITOR' THEN
      RAISE EXCEPTION 'Link Auditor hanya untuk identitas AUDITOR';
    END IF;
    IF NEW.is_lead_auditor
       AND NOT EXISTS(
         SELECT 1
         FROM public.auditors a
         WHERE a.id=NEW.auditor_id
           AND a.status='Aktif'
       ) THEN
      RAISE EXCEPTION 'Lead Auditor perusahaan harus menggunakan Auditor aktif';
    END IF;
  ELSIF TG_TABLE_NAME='section_identity_assignments' THEN
    IF (NEW.assignment_type='AUDIT_PIC' AND v_type<>'AUDITEE')
       OR (NEW.assignment_type='SECTION_MANAGER' AND v_type<>'SECTION_MANAGER') THEN
      RAISE EXCEPTION 'Tipe penugasan seksi tidak sesuai identitas';
    END IF;
  ELSE
    RAISE EXCEPTION 'validate_identity_mapping dipanggil dari tabel yang tidak didukung: %', TG_TABLE_NAME;
  END IF;

  RETURN NEW;
END $$;

-- Trigger helpers are private implementation details, not browser RPCs.
REVOKE ALL ON FUNCTION public.validate_identity_mapping() FROM PUBLIC,anon,authenticated;
