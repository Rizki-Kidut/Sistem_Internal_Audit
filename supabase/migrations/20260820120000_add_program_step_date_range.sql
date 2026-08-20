-- Replace the Schedule Dasar period-toggle UI with an explicit date range.
-- Legacy periode_target and periode_label columns remain for backward compatibility.

ALTER TABLE public.audit_program_steps
  ADD COLUMN IF NOT EXISTS tanggal_awal date,
  ADD COLUMN IF NOT EXISTS tanggal_akhir date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_audit_program_steps_date_range'
      AND conrelid = 'public.audit_program_steps'::regclass
  ) THEN
    ALTER TABLE public.audit_program_steps
      ADD CONSTRAINT chk_audit_program_steps_date_range
      CHECK (
        tanggal_awal IS NULL
        OR tanggal_akhir IS NULL
        OR tanggal_akhir >= tanggal_awal
      );
  END IF;
END
$$;
