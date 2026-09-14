-- Batch 8b2: atomic finalization and historical FORM-015 signatory identity.
-- All upstream audit context remains computed; only selected/snapshotted signatory identity is report-owned.

ALTER TABLE public.audit_internal_reports
  ADD COLUMN leader_signatory_auditor_id uuid REFERENCES public.auditors(id) ON DELETE RESTRICT,
  ADD COLUMN manager_signatory_name text;

CREATE INDEX audit_internal_reports_leader_signatory_idx
  ON public.audit_internal_reports(leader_signatory_auditor_id)
  WHERE leader_signatory_auditor_id IS NOT NULL;

CREATE FUNCTION public.save_internal_audit_report_draft(
  p_report_id uuid, p_expected_revision integer, p_tanggal_terbit date,
  p_auditee_hadir jsonb, p_nama_customer text, p_nama_produk text, p_nama_line text,
  p_sub_leader_auditor_id uuid, p_leader_signatory_auditor_id uuid,
  p_hasil_pengamatan text, p_evaluasi text, p_follow_up_required boolean,
  p_follow_up_items jsonb, p_catatan text
) RETURNS public.audit_internal_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_report public.audit_internal_reports%ROWTYPE; v_team_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autentikasi diperlukan.'; END IF;
 IF NOT public.is_admin_identity() THEN RAISE EXCEPTION 'Hanya Admin yang dapat menyimpan Draft Laporan Internal Audit.'; END IF;
 SELECT * INTO v_report FROM public.audit_internal_reports WHERE id=p_report_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Laporan Internal Audit tidak ditemukan.'; END IF;
 IF v_report.status<>'Draft' THEN RAISE EXCEPTION 'Hanya laporan berstatus Draft yang dapat disimpan.'; END IF;
 IF v_report.revision_version IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Laporan sudah berubah. Muat ulang data sebelum menyimpan kembali.'; END IF;
 IF p_tanggal_terbit IS NULL THEN RAISE EXCEPTION 'Tanggal Terbit wajib diisi.'; END IF;
 IF jsonb_typeof(COALESCE(p_auditee_hadir,'null'))<>'array' THEN RAISE EXCEPTION 'Auditee Hadir harus berupa array JSON.'; END IF;
 IF jsonb_typeof(COALESCE(p_follow_up_items,'null'))<>'array' THEN RAISE EXCEPTION 'Daftar follow-up harus berupa array JSON.'; END IF;
 SELECT team_master_id INTO v_team_id FROM public.audit_instruction_rows WHERE id=v_report.instruction_row_id;
 IF p_sub_leader_auditor_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.audit_team_master_members m WHERE m.team_id=v_team_id
   AND m.auditor_id=p_sub_leader_auditor_id AND m.peran='Member' AND NOT m.is_team_leader
 ) THEN RAISE EXCEPTION 'Sub Leader harus merupakan Member Auditor dari Team Audit yang sama.'; END IF;
 IF p_leader_signatory_auditor_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.audit_team_master_members m WHERE m.team_id=v_team_id
   AND m.auditor_id=p_leader_signatory_auditor_id
   AND (m.is_team_leader OR m.auditor_id=p_sub_leader_auditor_id)
 ) THEN RAISE EXCEPTION 'Penanda tangan Leader harus Team Leader atau Sub Leader terpilih.'; END IF;
 UPDATE public.audit_internal_reports SET tanggal_terbit=p_tanggal_terbit,auditee_hadir=p_auditee_hadir,
   nama_customer=NULLIF(btrim(COALESCE(p_nama_customer,'')),''),nama_produk=NULLIF(btrim(COALESCE(p_nama_produk,'')),''),
   nama_line=NULLIF(btrim(COALESCE(p_nama_line,'')),''),sub_leader_auditor_id=p_sub_leader_auditor_id,
   leader_signatory_auditor_id=p_leader_signatory_auditor_id,hasil_pengamatan=btrim(COALESCE(p_hasil_pengamatan,'')),
   evaluasi=btrim(COALESCE(p_evaluasi,'')),follow_up_required=p_follow_up_required,
   follow_up_items=CASE WHEN p_follow_up_required IS TRUE THEN p_follow_up_items ELSE '[]'::jsonb END,
   catatan=NULLIF(btrim(COALESCE(p_catatan,'')),''),revision_version=v_report.revision_version+1
 WHERE id=p_report_id RETURNING * INTO v_report; RETURN v_report;
END $$;

CREATE FUNCTION public.finalize_internal_audit_report(p_report_id uuid,p_expected_revision integer)
RETURNS public.audit_internal_reports
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_report public.audit_internal_reports%ROWTYPE; v_manager text; v_team_id uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autentikasi diperlukan.'; END IF;
 IF NOT public.is_admin_identity() THEN RAISE EXCEPTION 'Hanya Admin yang dapat memfinalkan Laporan Internal Audit.'; END IF;
 SELECT * INTO v_report FROM public.audit_internal_reports WHERE id=p_report_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Laporan Internal Audit tidak ditemukan.'; END IF;
 IF v_report.status<>'Draft' THEN RAISE EXCEPTION 'Hanya laporan berstatus Draft yang dapat difinalkan.'; END IF;
 IF v_report.revision_version IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Laporan sudah berubah. Muat ulang data sebelum finalisasi.'; END IF;
 IF v_report.seksi_id IS NULL THEN RAISE EXCEPTION 'Seksi laporan wajib ditentukan.'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.audit_instruction_rows r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]')) mark
   WHERE r.id=v_report.instruction_row_id AND mark->>'tipe' IN ('target','terkait') AND public.safe_uuid(mark->>'seksi_id')=v_report.seksi_id)
 THEN RAISE EXCEPTION 'Seksi laporan tidak lagi termasuk lingkup audit QA.'; END IF;
 IF EXISTS (SELECT 1 FROM public.findings f WHERE f.instruction_row_id=v_report.instruction_row_id
   AND f.review_status<>'ANNULLED' AND f.seksi_auditee_id IS NULL)
 THEN RAISE EXCEPTION 'Masih terdapat Temuan aktif tanpa Seksi Auditee pada QA ini.'; END IF;
 IF EXISTS (SELECT 1 FROM public.findings f WHERE f.instruction_row_id=v_report.instruction_row_id
   AND f.seksi_auditee_id=v_report.seksi_id AND f.review_status NOT IN ('PUBLISHED','LEGACY_ESTABLISHED','ANNULLED'))
 THEN RAISE EXCEPTION 'Masih terdapat Temuan Seksi yang belum selesai direview.'; END IF;
 IF NULLIF(btrim(v_report.hasil_pengamatan),'') IS NULL THEN RAISE EXCEPTION 'Hasil Pengamatan wajib diisi.'; END IF;
 IF NULLIF(btrim(v_report.evaluasi),'') IS NULL THEN RAISE EXCEPTION 'Evaluasi wajib diisi.'; END IF;
 IF v_report.follow_up_required IS NULL THEN RAISE EXCEPTION 'Saran perbaikan Ada/Tidak wajib ditentukan.'; END IF;
 IF NOT v_report.follow_up_required AND jsonb_array_length(v_report.follow_up_items)<>0 THEN RAISE EXCEPTION 'Daftar follow-up harus kosong ketika saran perbaikan Tidak.'; END IF;
 IF v_report.follow_up_required AND (jsonb_array_length(v_report.follow_up_items)=0 OR EXISTS (
   SELECT 1 FROM jsonb_array_elements(v_report.follow_up_items) item WHERE NULLIF(btrim(item->>'seksi'),'') IS NULL
   OR NULLIF(btrim(item->>'seksi_pelaksana_follow_up'),'') IS NULL OR NULLIF(btrim(item->>'jadwal_follow_up'),'') IS NULL
   OR CASE WHEN item->>'jadwal_follow_up' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN to_char((item->>'jadwal_follow_up')::date,'YYYY-MM-DD') IS DISTINCT FROM item->>'jadwal_follow_up'
      ELSE true END
 )) THEN RAISE EXCEPTION 'Setiap follow-up wajib memiliki Seksi, Seksi Pelaksana, dan Jadwal.'; END IF;
 SELECT r.team_master_id,s.kepala_seksi INTO v_team_id,v_manager FROM public.audit_instruction_rows r
   JOIN public.seksi s ON s.id=v_report.seksi_id WHERE r.id=v_report.instruction_row_id;
 IF EXISTS (SELECT 1 FROM public.audit_team_master_members WHERE team_id=v_team_id AND is_team_leader)
   AND v_report.leader_signatory_auditor_id IS NULL THEN RAISE EXCEPTION 'Penanda tangan Leader/Sub Leader wajib dipilih.'; END IF;
 IF v_report.leader_signatory_auditor_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM public.audit_team_master_members m WHERE m.team_id=v_team_id AND m.auditor_id=v_report.leader_signatory_auditor_id
   AND (m.is_team_leader OR m.auditor_id=v_report.sub_leader_auditor_id)
 ) THEN RAISE EXCEPTION 'Penanda tangan Leader tidak lagi valid untuk Team Audit.'; END IF;
 IF NULLIF(btrim(v_manager),'') IS NOT NULL THEN v_report.manager_signatory_name:=btrim(v_manager); END IF;
 UPDATE public.audit_internal_reports SET status='Final',finalized_at=now(),manager_signatory_name=v_report.manager_signatory_name,
   revision_version=v_report.revision_version+1 WHERE id=p_report_id AND revision_version=p_expected_revision RETURNING * INTO v_report;
 IF NOT FOUND THEN RAISE EXCEPTION 'Laporan sudah berubah. Muat ulang data sebelum finalisasi.'; END IF;
 RETURN v_report;
END $$;

-- Keep the established 13-argument Draft-save RPC executable during the staged frontend rollout.
-- It retains its original Draft/status/revision guards and does not bypass direct-table restrictions.
REVOKE ALL ON FUNCTION public.save_internal_audit_report_draft(uuid,integer,date,jsonb,text,text,text,uuid,uuid,text,text,boolean,jsonb,text),public.finalize_internal_audit_report(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_internal_audit_report_draft(uuid,integer,date,jsonb,text,text,text,uuid,uuid,text,text,boolean,jsonb,text),public.finalize_internal_audit_report(uuid,integer) TO authenticated;

DO $$ BEGIN
 IF has_table_privilege('authenticated','public.audit_internal_reports','UPDATE') THEN RAISE EXCEPTION 'Direct report UPDATE must remain revoked'; END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_internal_reports' AND column_name='leader_signatory_auditor_id') THEN RAISE EXCEPTION 'Missing leader signatory'; END IF;
END $$;
