-- Batch 8b1: report-owned Internal Audit Report draft data.
-- Upstream audit, team, agenda, checklist, and finding facts remain live/computed.

CREATE TABLE public.audit_internal_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_row_id uuid NOT NULL REFERENCES public.audit_instruction_rows(id) ON DELETE RESTRICT,
  tanggal_terbit date NOT NULL DEFAULT current_date,
  auditee_hadir jsonb NOT NULL DEFAULT '[]'::jsonb,
  nama_customer text,
  nama_produk text,
  nama_line text,
  sub_leader_auditor_id uuid REFERENCES public.auditors(id) ON DELETE RESTRICT,
  hasil_pengamatan text NOT NULL DEFAULT '',
  evaluasi text NOT NULL DEFAULT '',
  follow_up_required boolean,
  follow_up_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  catatan text,
  status text NOT NULL DEFAULT 'Draft',
  kode_dokumen text NOT NULL DEFAULT 'Q-120-ISE-001-FORM-015',
  revision_version integer NOT NULL DEFAULT 1,
  finalized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_internal_reports_instruction_row_key UNIQUE (instruction_row_id),
  CONSTRAINT audit_internal_reports_attendees_array CHECK (jsonb_typeof(auditee_hadir) = 'array'),
  CONSTRAINT audit_internal_reports_follow_up_array CHECK (jsonb_typeof(follow_up_items) = 'array'),
  CONSTRAINT audit_internal_reports_follow_up_consistency CHECK (
    follow_up_required IS TRUE OR jsonb_array_length(follow_up_items) = 0
  ),
  CONSTRAINT audit_internal_reports_status_check CHECK (status IN ('Draft','Final')),
  CONSTRAINT audit_internal_reports_revision_positive CHECK (revision_version > 0)
);

CREATE INDEX audit_internal_reports_sub_leader_idx
  ON public.audit_internal_reports(sub_leader_auditor_id)
  WHERE sub_leader_auditor_id IS NOT NULL;

CREATE TRIGGER set_audit_internal_reports_updated_at
  BEFORE UPDATE ON public.audit_internal_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.audit_internal_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_internal_reports_admin_select
  ON public.audit_internal_reports FOR SELECT TO authenticated
  USING (public.is_admin_identity());

REVOKE ALL ON public.audit_internal_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.audit_internal_reports TO authenticated;

CREATE FUNCTION public.create_internal_audit_report(p_instruction_row_id uuid)
RETURNS public.audit_internal_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_report public.audit_internal_reports%ROWTYPE;
  v_customer_values text[];
  v_product_values text[];
  v_line_values text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;
  IF NOT public.is_admin_identity() THEN
    RAISE EXCEPTION 'Hanya Admin yang dapat membuat Laporan Internal Audit.';
  END IF;

  -- Serialize creation for one Instruction row and make all eligibility checks authoritative.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_instruction_row_id::text, 0));
  IF NOT EXISTS (SELECT 1 FROM public.audit_instruction_rows WHERE id=p_instruction_row_id) THEN
    RAISE EXCEPTION 'Baris Instruksi Audit tidak ditemukan.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_internal_reports WHERE instruction_row_id=p_instruction_row_id) THEN
    RAISE EXCEPTION 'Laporan Internal Audit untuk No. Audit ini sudah ada.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_agendas WHERE instruction_row_id=p_instruction_row_id)
     OR NOT (
       EXISTS (SELECT 1 FROM public.checklists WHERE row_id=p_instruction_row_id)
       OR EXISTS (SELECT 1 FROM public.checklist_produk WHERE row_id=p_instruction_row_id)
       OR EXISTS (SELECT 1 FROM public.checklist_manufaktur_shift WHERE row_id=p_instruction_row_id)
     ) THEN
    RAISE EXCEPTION 'Laporan hanya dapat dibuat setelah Agenda dan minimal satu Checklist tersedia.';
  END IF;

  SELECT array_agg(value ORDER BY value) INTO v_customer_values FROM (
    SELECT DISTINCT btrim(customer) value FROM public.checklist_manufaktur_shift
    WHERE row_id=p_instruction_row_id AND NULLIF(btrim(customer),'') IS NOT NULL
  ) valueset;
  SELECT array_agg(value ORDER BY value) INTO v_product_values FROM (
    SELECT DISTINCT btrim(nama_part) value FROM public.checklist_manufaktur_shift
    WHERE row_id=p_instruction_row_id AND NULLIF(btrim(nama_part),'') IS NOT NULL
    UNION
    SELECT DISTINCT btrim(part_name) value FROM public.checklist_produk
    WHERE row_id=p_instruction_row_id AND NULLIF(btrim(part_name),'') IS NOT NULL
  ) valueset;
  SELECT array_agg(value ORDER BY value) INTO v_line_values FROM (
    SELECT DISTINCT btrim(nomor_line) value FROM public.checklist_manufaktur_shift
    WHERE row_id=p_instruction_row_id AND NULLIF(btrim(nomor_line),'') IS NOT NULL
  ) valueset;

  INSERT INTO public.audit_internal_reports(
    instruction_row_id,tanggal_terbit,nama_customer,nama_produk,nama_line,
    sub_leader_auditor_id,status,kode_dokumen,revision_version
  ) VALUES (
    p_instruction_row_id,current_date,
    CASE WHEN cardinality(v_customer_values)=1 THEN v_customer_values[1] END,
    CASE WHEN cardinality(v_product_values)=1 THEN v_product_values[1] END,
    CASE WHEN cardinality(v_line_values)=1 THEN v_line_values[1] END,
    NULL,'Draft','Q-120-ISE-001-FORM-015',1
  ) RETURNING * INTO v_report;
  RETURN v_report;
END $$;

CREATE FUNCTION public.save_internal_audit_report_draft(
  p_report_id uuid,
  p_expected_revision integer,
  p_tanggal_terbit date,
  p_auditee_hadir jsonb,
  p_nama_customer text,
  p_nama_produk text,
  p_nama_line text,
  p_sub_leader_auditor_id uuid,
  p_hasil_pengamatan text,
  p_evaluasi text,
  p_follow_up_required boolean,
  p_follow_up_items jsonb,
  p_catatan text
) RETURNS public.audit_internal_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_report public.audit_internal_reports%ROWTYPE;
  v_team_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autentikasi diperlukan.';
  END IF;
  IF NOT public.is_admin_identity() THEN
    RAISE EXCEPTION 'Hanya Admin yang dapat menyimpan Draft Laporan Internal Audit.';
  END IF;

  SELECT * INTO v_report FROM public.audit_internal_reports WHERE id=p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Laporan Internal Audit tidak ditemukan.'; END IF;
  IF v_report.status<>'Draft' THEN RAISE EXCEPTION 'Hanya laporan berstatus Draft yang dapat disimpan.'; END IF;
  IF v_report.revision_version IS DISTINCT FROM p_expected_revision THEN
    RAISE EXCEPTION 'Laporan sudah berubah. Muat ulang data sebelum menyimpan kembali.';
  END IF;
  IF p_tanggal_terbit IS NULL THEN RAISE EXCEPTION 'Tanggal Terbit wajib diisi.'; END IF;
  IF p_auditee_hadir IS NULL OR jsonb_typeof(p_auditee_hadir)<>'array' THEN
    RAISE EXCEPTION 'Auditee Hadir harus berupa array JSON.';
  END IF;
  IF p_follow_up_items IS NULL OR jsonb_typeof(p_follow_up_items)<>'array' THEN
    RAISE EXCEPTION 'Daftar follow-up harus berupa array JSON.';
  END IF;

  IF p_sub_leader_auditor_id IS NOT NULL THEN
    SELECT team_master_id INTO v_team_id FROM public.audit_instruction_rows WHERE id=v_report.instruction_row_id;
    IF v_team_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.audit_team_master_members member
      WHERE member.team_id=v_team_id
        AND member.auditor_id=p_sub_leader_auditor_id
        AND member.peran='Member'
        AND member.is_team_leader=false
    ) THEN
      RAISE EXCEPTION 'Sub Leader harus merupakan Member Auditor dari Team Audit yang sama.';
    END IF;
  END IF;

  UPDATE public.audit_internal_reports SET
    tanggal_terbit=p_tanggal_terbit,
    auditee_hadir=p_auditee_hadir,
    nama_customer=NULLIF(btrim(COALESCE(p_nama_customer,'')),''),
    nama_produk=NULLIF(btrim(COALESCE(p_nama_produk,'')),''),
    nama_line=NULLIF(btrim(COALESCE(p_nama_line,'')),''),
    sub_leader_auditor_id=p_sub_leader_auditor_id,
    hasil_pengamatan=btrim(COALESCE(p_hasil_pengamatan,'')),
    evaluasi=btrim(COALESCE(p_evaluasi,'')),
    follow_up_required=p_follow_up_required,
    follow_up_items=CASE
      WHEN p_follow_up_required IS TRUE THEN p_follow_up_items
      ELSE '[]'::jsonb
    END,
    catatan=NULLIF(btrim(COALESCE(p_catatan,'')),''),
    revision_version=v_report.revision_version+1
  WHERE id=p_report_id
  RETURNING * INTO v_report;
  RETURN v_report;
END $$;

REVOKE ALL ON FUNCTION public.create_internal_audit_report(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_internal_audit_report_draft(uuid,integer,date,jsonb,text,text,text,uuid,text,text,boolean,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_internal_audit_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_internal_audit_report_draft(uuid,integer,date,jsonb,text,text,text,uuid,text,text,boolean,jsonb,text) TO authenticated;

-- Migration invariants: fail the migration if a security- or data-contract guarantee regresses.
DO $$
DECLARE v_default text;
BEGIN
  IF to_regclass('public.audit_internal_reports') IS NULL THEN RAISE EXCEPTION 'audit_internal_reports was not created'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.audit_internal_reports'::regclass AND contype='u' AND conname='audit_internal_reports_instruction_row_key') THEN RAISE EXCEPTION 'missing instruction-row uniqueness'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.audit_internal_reports'::regclass AND conname='audit_internal_reports_revision_positive') THEN RAISE EXCEPTION 'missing positive revision constraint'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.audit_internal_reports'::regclass AND conname='audit_internal_reports_status_check') THEN RAISE EXCEPTION 'missing status constraint'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.audit_internal_reports'::regclass AND conname='audit_internal_reports_follow_up_consistency') THEN RAISE EXCEPTION 'missing follow-up consistency constraint'; END IF;
  SELECT column_default INTO v_default FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_internal_reports' AND column_name='auditee_hadir';
  IF v_default IS NULL OR v_default NOT LIKE '%[]%' THEN RAISE EXCEPTION 'invalid attendee default'; END IF;
  SELECT column_default INTO v_default FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_internal_reports' AND column_name='follow_up_items';
  IF v_default IS NULL OR v_default NOT LIKE '%[]%' THEN RAISE EXCEPTION 'invalid follow-up default'; END IF;
  IF (SELECT is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_internal_reports' AND column_name='sub_leader_auditor_id')<>'YES' THEN RAISE EXCEPTION 'Sub Leader must remain nullable'; END IF;
  IF has_table_privilege('authenticated','public.audit_internal_reports','INSERT')
     OR has_table_privilege('authenticated','public.audit_internal_reports','UPDATE')
     OR has_table_privilege('authenticated','public.audit_internal_reports','DELETE') THEN
    RAISE EXCEPTION 'authenticated direct report DML must remain revoked';
  END IF;
END $$;
