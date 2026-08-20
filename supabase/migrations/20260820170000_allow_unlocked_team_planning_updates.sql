-- Allow an Instruction to be repaired while its already-selected annual Team is
-- unlocked for roster planning. New Team assignments and checklist execution
-- continue to require a fully valid locked Team.

CREATE OR REPLACE FUNCTION public.validate_live_instruction_team() RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_team public.audit_team_masters%ROWTYPE;
  v_plan_id uuid;
  v_names text;
  v_tahun integer;
  v_count integer;
  v_is_new_assignment boolean;
BEGIN
  v_is_new_assignment := TG_OP = 'INSERT';
  IF TG_OP = 'UPDATE' THEN
    v_is_new_assignment := NEW.team_master_id IS DISTINCT FROM OLD.team_master_id;
  END IF;

  IF NEW.team_master_id IS NULL THEN
    IF TG_OP = 'UPDATE'
      AND NEW.team_master_id IS DISTINCT FROM OLD.team_master_id
      AND current_setting('app.team_assignment_row_id', true) IS DISTINCT FROM NEW.id::text THEN
      RAISE EXCEPTION 'Tim Audit hanya dapat diubah melalui proses penugasan Tim Audit';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.team_master_id IS DISTINCT FROM OLD.team_master_id
    AND current_setting('app.team_assignment_row_id', true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'Tim Audit hanya dapat diubah melalui proses penugasan Tim Audit';
  END IF;

  SELECT * INTO v_team
  FROM public.audit_team_masters
  WHERE id = NEW.team_master_id;

  IF NOT FOUND OR v_team.status <> 'Aktif' OR v_team.plan_id IS NULL THEN
    RAISE EXCEPTION 'Pilih Tim Audit aktif dari Rencana Audit Tahunan yang sesuai';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT p.plan_id, i.tahun_fiskal INTO v_plan_id, v_tahun
    FROM public.audit_instructions i
    LEFT JOIN public.audit_programs p ON p.id = i.program_id
    WHERE i.id = NEW.instruction_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Instruksi Audit tidak ditemukan'; END IF;
    IF v_plan_id IS NULL THEN
      SELECT count(*) INTO v_count FROM public.audit_plans WHERE tahun = v_tahun;
      IF v_count <> 1 THEN RAISE EXCEPTION 'Rencana Audit Tahunan untuk Instruksi tidak dapat ditentukan secara unik'; END IF;
      SELECT id INTO v_plan_id FROM public.audit_plans WHERE tahun = v_tahun LIMIT 1;
    END IF;
  ELSE
    v_plan_id := public.resolve_instruction_plan_id(NEW.id);
  END IF;

  IF v_team.plan_id <> v_plan_id THEN
    RAISE EXCEPTION 'Tim Audit harus berasal dari Rencana Audit Tahunan yang sama dengan Instruksi';
  END IF;

  -- An existing reference may be edited while its Team is unlocked. This is a
  -- planning state; lock_audit_team_master remains the final all-QA validator.
  IF NOT v_is_new_assignment AND NOT v_team.is_locked THEN
    RETURN NEW;
  END IF;

  IF NOT v_team.is_locked THEN
    RAISE EXCEPTION 'Tim Audit baru harus dikunci sebelum ditugaskan ke Instruksi Audit';
  END IF;

  IF (SELECT count(*) FROM public.audit_team_master_members WHERE team_id = v_team.id AND peran = 'Lead') <> 1
    OR NOT EXISTS (SELECT 1 FROM public.audit_team_master_members WHERE team_id = v_team.id) THEN
    RAISE EXCEPTION 'Tim Audit harus memiliki tepat satu Lead dan minimal satu auditor';
  END IF;

  SELECT string_agg(COALESCE(a.nama, m.auditor_id::text), ', ' ORDER BY COALESCE(a.nama, m.auditor_id::text)) INTO v_names
  FROM public.audit_team_master_members m
  LEFT JOIN public.auditors a ON a.id = m.auditor_id
  WHERE m.team_id = v_team.id AND (a.id IS NULL OR a.status <> 'Aktif');
  IF v_names IS NOT NULL THEN RAISE EXCEPTION 'Tim Audit memiliki auditor yang sudah tidak aktif: %', v_names; END IF;

  SELECT string_agg(a.nama, ', ' ORDER BY a.nama) INTO v_names
  FROM public.audit_team_master_members m
  JOIN public.auditors a ON a.id = m.auditor_id
  WHERE m.team_id = v_team.id
    AND (a.tanggal_berlaku IS NULL OR a.tanggal_berlaku < COALESCE(NEW.tanggal_pelaksanaan_audit, CURRENT_DATE));
  IF v_names IS NOT NULL THEN RAISE EXCEPTION 'Auditor tidak memenuhi kompetensi pada tanggal pelaksanaan: %', v_names; END IF;

  SELECT string_agg(DISTINCT a.nama, ', ' ORDER BY a.nama) INTO v_names
  FROM public.audit_team_master_members m
  JOIN public.auditors a ON a.id = m.auditor_id
  JOIN jsonb_array_elements(NEW.seksi_marks) mark ON true
  JOIN public.seksi s ON s.id = (mark->>'seksi_id')::uuid
  WHERE m.team_id = v_team.id
    AND nullif(btrim(a.departemen), '') IS NOT NULL
    AND lower(s.nama) LIKE '%' || lower(a.departemen) || '%';
  IF v_names IS NOT NULL AND nullif(btrim(NEW.catatan_justifikasi_tim), '') IS NULL THEN
    RAISE EXCEPTION 'Auditor memiliki potensi konflik independensi dengan seksi yang diaudit: %. Catatan Justifikasi wajib diisi.', v_names;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_live_instruction_team() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_live_instruction_team() TO anon, authenticated;
