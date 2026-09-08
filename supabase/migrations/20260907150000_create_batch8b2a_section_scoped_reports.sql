-- Batch 8b2a: structured Finding ownership and section-scoped Internal Audit Reports.
ALTER TABLE public.findings ADD COLUMN seksi_auditee_id uuid REFERENCES public.seksi(id) ON DELETE RESTRICT;
CREATE INDEX findings_seksi_auditee_idx ON public.findings(seksi_auditee_id) WHERE seksi_auditee_id IS NOT NULL;
ALTER TABLE public.audit_internal_reports ADD COLUMN seksi_id uuid REFERENCES public.seksi(id) ON DELETE RESTRICT;
CREATE INDEX audit_internal_reports_seksi_idx ON public.audit_internal_reports(seksi_id) WHERE seksi_id IS NOT NULL;

-- Refuse contradictory structured history before any backfill.
DO $$ DECLARE v_ids text; BEGIN
 SELECT string_agg(f.id::text,', ' ORDER BY f.id::text) INTO v_ids
 FROM public.findings f
 JOIN public.cars c ON c.finding_id=f.id
 WHERE c.seksi_auditee_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
     FROM public.audit_instruction_rows r
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]'::jsonb)) mark
     WHERE r.id=f.instruction_row_id
       AND mark->>'tipe' IN('target','terkait')
       AND public.safe_uuid(mark->>'seksi_id')=c.seksi_auditee_id
   );
 IF v_ids IS NOT NULL THEN RAISE EXCEPTION 'LTP Section berada di luar lingkup QA: %',v_ids; END IF;

 SELECT string_agg(f.id::text,', ' ORDER BY f.id::text) INTO v_ids FROM public.findings f JOIN public.cars c ON c.finding_id=f.id WHERE f.seksi_auditee_id IS NOT NULL AND c.seksi_auditee_id IS NOT NULL AND f.seksi_auditee_id<>c.seksi_auditee_id;
 IF v_ids IS NOT NULL THEN RAISE EXCEPTION 'Finding/LTP Section contradiction: %',v_ids; END IF;
END $$;

-- Preserve the existing Finding guard and admit this one additional PLOR field.
CREATE OR REPLACE FUNCTION public.protect_finding_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_identity text:=public.current_identity_type();v_changed jsonb;v_plor_context text:=COALESCE(current_setting('certitrack.finding_plor_save',true),'');v_reason text:=NULLIF(btrim(COALESCE(current_setting('certitrack.finding_plor_reason',true),'')),'');
BEGIN
 IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at Temuan tidak dapat diubah';END IF;
 IF COALESCE(current_setting('certitrack.finding_section_backfill',true),'')='1' THEN
  IF OLD.seksi_auditee_id IS NOT NULL
     OR NEW.seksi_auditee_id IS NULL
     OR NEW.revision_version IS DISTINCT FROM OLD.revision_version
     OR (to_jsonb(NEW)-ARRAY['seksi_auditee_id','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['seksi_auditee_id','updated_at'])
     OR NOT EXISTS(
       SELECT 1 FROM public.audit_instruction_rows r
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]'::jsonb)) mark
       WHERE r.id=OLD.instruction_row_id AND mark->>'tipe' IN('target','terkait')
         AND public.safe_uuid(mark->>'seksi_id')=NEW.seksi_auditee_id
     )
  THEN RAISE EXCEPTION 'Finding Section backfill tidak valid';END IF;
  RETURN NEW;
 END IF;
 IF COALESCE(current_setting('certitrack.finding_ltp_final_sync',true),'')='1' THEN IF OLD.status NOT IN('Open','CAR Submitted','Verifikasi','Overdue') OR NEW.status<>'Closed' OR NEW.revision_version<>OLD.revision_version+1 OR (to_jsonb(NEW)-ARRAY['status','revision_version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','revision_version','updated_at']) THEN RAISE EXCEPTION 'Sinkronisasi final LTP tidak valid';END IF;RETURN NEW;END IF;
 IF COALESCE(current_setting('certitrack.finding_sync',true),'')='1' THEN IF OLD.review_status NOT IN('DRAFT','REVISION_REQUIRED') OR (to_jsonb(NEW)-ARRAY['kategori','updated_at']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['kategori','updated_at']) THEN RAISE EXCEPTION 'Sinkronisasi sumber Finding tidak valid';END IF;RETURN NEW;END IF;
 IF COALESCE(current_setting('certitrack.finding_workflow',true),'')='1' THEN
  IF OLD.review_status='DRAFT' AND NEW.review_status='LEAD_REVIEW' AND public.current_auditor_is_team_leader(OLD.id) AND (to_jsonb(NEW)-ARRAY['review_status','revision_version','updated_at']) IS NOT DISTINCT FROM(to_jsonb(OLD)-ARRAY['review_status','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='REVISION_REQUIRED' AND NEW.review_status='LEAD_REVIEW' AND public.current_auditor_is_team_leader(OLD.id) AND (to_jsonb(NEW)-ARRAY['review_status','revision_version','updated_at']) IS NOT DISTINCT FROM(to_jsonb(OLD)-ARRAY['review_status','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='LEAD_REVIEW' AND NEW.review_status='REVISION_REQUIRED' AND public.current_auditor_is_lead_auditor() AND (to_jsonb(NEW)-ARRAY['review_status','revision_version','updated_at']) IS NOT DISTINCT FROM(to_jsonb(OLD)-ARRAY['review_status','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='LEAD_REVIEW' AND NEW.review_status='READY_FOR_RELEASE' AND public.current_auditor_is_lead_auditor() AND (to_jsonb(NEW)-ARRAY['kode_temuan','review_status','approved_at','approved_by','revision_version','updated_at']) IS NOT DISTINCT FROM(to_jsonb(OLD)-ARRAY['kode_temuan','review_status','approved_at','approved_by','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='LEAD_REVIEW' AND NEW.review_status='ANNULLED' AND public.current_auditor_is_lead_auditor() AND (to_jsonb(NEW)-ARRAY['review_status','annulled_at','annulled_by','annul_reason','revision_version','updated_at']) IS NOT DISTINCT FROM(to_jsonb(OLD)-ARRAY['review_status','annulled_at','annulled_by','annul_reason','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='READY_FOR_RELEASE' AND NEW.review_status='PUBLISHED' AND public.is_admin_identity() AND (to_jsonb(NEW)-ARRAY['review_status','released_at','released_by','revision_version','updated_at']) IS NOT DISTINCT FROM(to_jsonb(OLD)-ARRAY['review_status','released_at','released_by','revision_version','updated_at']) THEN RETURN NEW;END IF;RAISE EXCEPTION 'Mutasi workflow Finding tidak sesuai aksi/otoritas resmi';
 END IF;
 IF v_plor_context=OLD.id::text THEN
  IF OLD.review_status NOT IN('DRAFT','REVISION_REQUIRED') THEN RAISE EXCEPTION 'PLOR tidak dapat diedit pada status %',OLD.review_status;END IF;
  IF v_identity='AUDITOR' AND NOT public.auditor_can_access_instruction_row(OLD.instruction_row_id) THEN RAISE EXCEPTION 'Temuan bukan milik Tim Auditor';ELSIF v_identity NOT IN('AUDITOR','ADMIN') THEN RAISE EXCEPTION 'Identitas tidak diizinkan mengedit PLOR';END IF;
  IF v_identity='ADMIN' AND length(regexp_replace(COALESCE(v_reason,''),'[[:space:]]','','g'))<10 THEN RAISE EXCEPTION 'Alasan perubahan Admin/QMS wajib minimal 10 karakter non-spasi';END IF;
  IF (to_jsonb(NEW)-ARRAY['klasifikasi_dis','problem','location','objective_evidence','reference','saran_perbaikan','auditor_penemu_id','auditee_area','seksi_auditee_id','tanggal_temuan','revision_version','updated_at']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['klasifikasi_dis','problem','location','objective_evidence','reference','saran_perbaikan','auditor_penemu_id','auditee_area','seksi_auditee_id','tanggal_temuan','revision_version','updated_at']) THEN RAISE EXCEPTION 'save_finding_plor hanya boleh mengubah field PLOR yang disetujui';END IF;
  IF NEW.seksi_auditee_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.audit_instruction_rows r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]')) mark WHERE r.id=NEW.instruction_row_id AND mark->>'tipe' IN('target','terkait') AND public.safe_uuid(mark->>'seksi_id')=NEW.seksi_auditee_id) THEN RAISE EXCEPTION 'Seksi Auditee tidak termasuk lingkup audit QA';END IF;
  IF NEW.auditor_penemu_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.audit_instruction_rows r JOIN public.audit_team_master_members m ON m.team_id=r.team_master_id WHERE r.id=NEW.instruction_row_id AND m.auditor_id=NEW.auditor_penemu_id) THEN RAISE EXCEPTION 'Auditor Penemu harus anggota Tim Audit';END IF;
  IF NEW.revision_version<>OLD.revision_version THEN RAISE EXCEPTION 'Versi Temuan tidak valid';END IF;v_changed:=(SELECT COALESCE(jsonb_object_agg(k,v),'{}') FROM jsonb_each(to_jsonb(NEW)-ARRAY['updated_at','revision_version']) n(k,v) WHERE v IS DISTINCT FROM(to_jsonb(OLD)->k));NEW.revision_version:=OLD.revision_version+1;INSERT INTO public.finding_review_events(finding_id,event_type,actor_user_id,actor_identity_type,comment,changed_fields,before_values,after_values) VALUES(OLD.id,'PLOR_EDITED',auth.uid(),v_identity,v_reason,v_changed,to_jsonb(OLD),to_jsonb(NEW));RETURN NEW;
 END IF;RAISE EXCEPTION 'PLOR hanya dapat diubah melalui save_finding_plor';END $$;

-- Snapshot revision values and run only the two conservative Finding backfills under a dedicated context.
CREATE TEMP TABLE finding_section_backfill_revisions ON COMMIT DROP AS
SELECT id,revision_version FROM public.findings;

DO $$
DECLARE v_previous_context text:=current_setting('certitrack.finding_section_backfill',true);
BEGIN
 PERFORM set_config('certitrack.finding_section_backfill','1',true);

 -- Strongest relationship first: an existing in-scope LTP/CAR Section.
 UPDATE public.findings f SET seksi_auditee_id=c.seksi_auditee_id FROM public.cars c
 WHERE c.finding_id=f.id AND c.seksi_auditee_id IS NOT NULL AND f.seksi_auditee_id IS NULL;

 -- Otherwise only an exactly-one-distinct-section QA is deterministic (target and terkait both count).
 WITH scoped AS (
  SELECT r.id row_id,(array_agg(DISTINCT public.safe_uuid(mark->>'seksi_id')))[1] seksi_id
  FROM public.audit_instruction_rows r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]')) mark
  WHERE mark->>'tipe' IN('target','terkait') AND public.safe_uuid(mark->>'seksi_id') IS NOT NULL
  GROUP BY r.id HAVING count(DISTINCT public.safe_uuid(mark->>'seksi_id'))=1
 ) UPDATE public.findings f SET seksi_auditee_id=s.seksi_id FROM scoped s
   WHERE f.instruction_row_id=s.row_id AND f.seksi_auditee_id IS NULL;

 PERFORM set_config('certitrack.finding_section_backfill',COALESCE(v_previous_context,''),true);
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('certitrack.finding_section_backfill',COALESCE(v_previous_context,''),true);
 RAISE;
END $$;

-- Completed audit execution also locks structured organizational ownership after normalization.
CREATE OR REPLACE FUNCTION public.protect_completed_audit_plor() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
  IF (NEW.problem,NEW.location,NEW.objective_evidence,NEW.reference,NEW.saran_perbaikan,
      NEW.auditor_penemu_id,NEW.auditee_area,NEW.tanggal_temuan,NEW.klasifikasi_dis,NEW.seksi_auditee_id)
     IS DISTINCT FROM
     (OLD.problem,OLD.location,OLD.objective_evidence,OLD.reference,OLD.saran_perbaikan,
      OLD.auditor_penemu_id,OLD.auditee_area,OLD.tanggal_temuan,OLD.klasifikasi_dis,OLD.seksi_auditee_id)
     AND EXISTS(SELECT 1 FROM public.audit_instruction_rows r WHERE r.id=OLD.instruction_row_id AND r.cek_selesai)
  THEN
    RAISE EXCEPTION 'Pelaksanaan audit ini sudah selesai. Buka kembali Pelaksanaan Audit sebelum mengubah PLOR.';
  END IF;
  RETURN NEW;
END $$;

-- A historical QA-wide report is scoped only when that scope is unambiguous. It is never copied.
WITH scoped AS (
 SELECT r.id row_id,(array_agg(DISTINCT public.safe_uuid(mark->>'seksi_id')))[1] seksi_id
 FROM public.audit_instruction_rows r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]')) mark
 WHERE mark->>'tipe' IN('target','terkait') AND public.safe_uuid(mark->>'seksi_id') IS NOT NULL
 GROUP BY r.id HAVING count(DISTINCT public.safe_uuid(mark->>'seksi_id'))=1
) UPDATE public.audit_internal_reports report SET seksi_id=s.seksi_id FROM scoped s WHERE report.instruction_row_id=s.row_id AND report.seksi_id IS NULL;
ALTER TABLE public.audit_internal_reports DROP CONSTRAINT audit_internal_reports_instruction_row_key;
CREATE UNIQUE INDEX audit_internal_reports_instruction_section_unique ON public.audit_internal_reports(instruction_row_id,seksi_id) WHERE seksi_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.assert_complete_plor(p_f public.findings) RETURNS void LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
BEGIN
 IF COALESCE(btrim(p_f.problem),'')='' OR COALESCE(btrim(p_f.location),'')='' OR COALESCE(btrim(p_f.objective_evidence),'')='' THEN RAISE EXCEPTION 'Problem, Location, dan Objective Evidence wajib dilengkapi';END IF;
 IF p_f.kategori IN('A','B') AND COALESCE(btrim(p_f.reference),'')='' THEN RAISE EXCEPTION 'Reference wajib diisi untuk kategori A/B';END IF;
 IF p_f.kategori='C' AND COALESCE(btrim(p_f.saran_perbaikan),'')='' THEN RAISE EXCEPTION 'Saran Perbaikan wajib diisi untuk kategori C';END IF;
 IF p_f.seksi_auditee_id IS NULL THEN RAISE EXCEPTION 'Seksi Auditee wajib ditentukan sebelum Finding dikirim untuk review';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.audit_instruction_rows r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]')) mark WHERE r.id=p_f.instruction_row_id AND mark->>'tipe' IN('target','terkait') AND public.safe_uuid(mark->>'seksi_id')=p_f.seksi_auditee_id) THEN RAISE EXCEPTION 'Seksi Auditee tidak termasuk lingkup audit QA';END IF;
END $$;

CREATE FUNCTION public.save_finding_plor_with_section(p_id uuid,p_expected_version integer,p_klasifikasi_dis text,p_problem text,p_location text,p_objective_evidence text,p_reference text,p_saran_perbaikan text,p_auditor_penemu_id uuid,p_auditee_area text,p_seksi_auditee_id uuid,p_tanggal_temuan date,p_reason text) RETURNS public.findings LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE f public.findings%ROWTYPE;v_identity text:=public.current_identity_type();v_result public.findings%ROWTYPE;
BEGIN SELECT * INTO f FROM public.findings WHERE id=p_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Temuan tidak ditemukan';END IF;IF f.review_status NOT IN('DRAFT','REVISION_REQUIRED') THEN RAISE EXCEPTION 'PLOR tidak dapat diedit pada status %',f.review_status;END IF;IF v_identity='AUDITOR' AND NOT public.auditor_can_access_instruction_row(f.instruction_row_id) THEN RAISE EXCEPTION 'Temuan bukan milik Tim Auditor';ELSIF v_identity NOT IN('AUDITOR','ADMIN') THEN RAISE EXCEPTION 'Identitas tidak diizinkan mengedit PLOR';END IF;IF f.revision_version<>p_expected_version THEN RAISE EXCEPTION 'Finding ini telah diperbarui anggota Tim lain. Muat ulang data terbaru sebelum menyimpan.';END IF;IF v_identity='ADMIN' AND length(regexp_replace(COALESCE(p_reason,''),'[[:space:]]','','g'))<10 THEN RAISE EXCEPTION 'Alasan perubahan Admin/QMS wajib minimal 10 karakter non-spasi';END IF;
 PERFORM set_config('certitrack.finding_plor_save',p_id::text,true);PERFORM set_config('certitrack.finding_plor_reason',COALESCE(p_reason,''),true);
 UPDATE public.findings SET klasifikasi_dis=p_klasifikasi_dis,problem=NULLIF(btrim(p_problem),''),location=NULLIF(btrim(p_location),''),objective_evidence=NULLIF(btrim(p_objective_evidence),''),reference=NULLIF(btrim(p_reference),''),saran_perbaikan=NULLIF(btrim(p_saran_perbaikan),''),auditor_penemu_id=p_auditor_penemu_id,auditee_area=NULLIF(btrim(p_auditee_area),''),seksi_auditee_id=p_seksi_auditee_id,tanggal_temuan=p_tanggal_temuan WHERE id=p_id AND revision_version=p_expected_version RETURNING * INTO v_result;IF NOT FOUND THEN RAISE EXCEPTION 'Finding ini telah diperbarui anggota Tim lain. Muat ulang data terbaru sebelum menyimpan.';END IF;RETURN v_result;END $$;

CREATE OR REPLACE FUNCTION public.create_ltp_for_eligible_finding() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_target_count integer;v_target_id uuid;BEGIN IF NEW.review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED') OR NEW.kode_temuan IS NULL OR NOT public.ltp_finding_has_complete_plor(NEW) THEN RETURN NEW;END IF;IF NEW.seksi_auditee_id IS NOT NULL THEN v_target_id:=NEW.seksi_auditee_id;ELSE SELECT count(DISTINCT public.safe_uuid(mark->>'seksi_id')),(array_agg(DISTINCT public.safe_uuid(mark->>'seksi_id')))[1] INTO v_target_count,v_target_id FROM public.audit_instruction_rows r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]')) mark WHERE r.id=NEW.instruction_row_id AND mark->>'tipe'='target' AND public.safe_uuid(mark->>'seksi_id') IS NOT NULL;IF v_target_count<>1 THEN v_target_id:=NULL;END IF;END IF;INSERT INTO public.cars(finding_id,kode_car,seksi_auditee_id) VALUES(NEW.id,NEW.kode_temuan,v_target_id) ON CONFLICT(finding_id) DO NOTHING;RETURN NEW;END $$;

CREATE FUNCTION public.create_internal_audit_report_for_section(p_instruction_row_id uuid,p_seksi_id uuid) RETURNS public.audit_internal_reports LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_report public.audit_internal_reports%ROWTYPE;v_customer_values text[];v_product_values text[];v_line_values text[];BEGIN IF auth.uid() IS NULL OR NOT public.is_admin_identity() THEN RAISE EXCEPTION 'Hanya Admin yang dapat membuat Laporan Internal Audit.';END IF;IF p_seksi_id IS NULL THEN RAISE EXCEPTION 'Seksi laporan wajib dipilih.';END IF;PERFORM pg_advisory_xact_lock(hashtextextended(p_instruction_row_id::text||p_seksi_id::text,0));IF NOT EXISTS(SELECT 1 FROM public.audit_instruction_rows r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]')) mark WHERE r.id=p_instruction_row_id AND mark->>'tipe' IN('target','terkait') AND public.safe_uuid(mark->>'seksi_id')=p_seksi_id) THEN RAISE EXCEPTION 'Seksi tidak termasuk lingkup audit QA.';END IF;IF EXISTS(SELECT 1 FROM public.audit_internal_reports WHERE instruction_row_id=p_instruction_row_id AND seksi_id=p_seksi_id) THEN RAISE EXCEPTION 'Laporan Internal Audit untuk No. Audit dan Seksi ini sudah ada.';END IF;IF NOT EXISTS(SELECT 1 FROM public.audit_agendas WHERE instruction_row_id=p_instruction_row_id) OR NOT(EXISTS(SELECT 1 FROM public.checklists WHERE row_id=p_instruction_row_id) OR EXISTS(SELECT 1 FROM public.checklist_produk WHERE row_id=p_instruction_row_id) OR EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift WHERE row_id=p_instruction_row_id)) THEN RAISE EXCEPTION 'Laporan hanya dapat dibuat setelah Agenda dan minimal satu Checklist tersedia.';END IF;
 SELECT array_agg(value ORDER BY value) INTO v_customer_values FROM(SELECT DISTINCT btrim(customer)value FROM public.checklist_manufaktur_shift WHERE row_id=p_instruction_row_id AND NULLIF(btrim(customer),'') IS NOT NULL)x;SELECT array_agg(value ORDER BY value) INTO v_product_values FROM(SELECT DISTINCT btrim(nama_part)value FROM public.checklist_manufaktur_shift WHERE row_id=p_instruction_row_id AND NULLIF(btrim(nama_part),'') IS NOT NULL UNION SELECT DISTINCT btrim(part_name) FROM public.checklist_produk WHERE row_id=p_instruction_row_id AND NULLIF(btrim(part_name),'') IS NOT NULL)x;SELECT array_agg(value ORDER BY value) INTO v_line_values FROM(SELECT DISTINCT btrim(nomor_line)value FROM public.checklist_manufaktur_shift WHERE row_id=p_instruction_row_id AND NULLIF(btrim(nomor_line),'') IS NOT NULL)x;
 INSERT INTO public.audit_internal_reports(instruction_row_id,seksi_id,tanggal_terbit,nama_customer,nama_produk,nama_line,sub_leader_auditor_id,status,kode_dokumen,revision_version)VALUES(p_instruction_row_id,p_seksi_id,current_date,CASE WHEN cardinality(v_customer_values)=1 THEN v_customer_values[1] END,CASE WHEN cardinality(v_product_values)=1 THEN v_product_values[1] END,CASE WHEN cardinality(v_line_values)=1 THEN v_line_values[1] END,NULL,'Draft','Q-120-ISE-001-FORM-015',1)RETURNING * INTO v_report;RETURN v_report;END $$;

CREATE FUNCTION public.assign_internal_audit_report_section(p_report_id uuid,p_expected_revision integer,p_seksi_id uuid) RETURNS public.audit_internal_reports LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_report public.audit_internal_reports%ROWTYPE;BEGIN IF auth.uid() IS NULL OR NOT public.is_admin_identity() THEN RAISE EXCEPTION 'Hanya Admin yang dapat menetapkan Seksi laporan lama.';END IF;SELECT * INTO v_report FROM public.audit_internal_reports WHERE id=p_report_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Laporan tidak ditemukan.';END IF;IF v_report.status<>'Draft' OR v_report.seksi_id IS NOT NULL THEN RAISE EXCEPTION 'Hanya laporan Draft lama tanpa Seksi yang dapat ditetapkan.';END IF;IF v_report.revision_version IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'Laporan sudah berubah. Muat ulang data.';END IF;IF NOT EXISTS(SELECT 1 FROM public.audit_instruction_rows r CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]')) mark WHERE r.id=v_report.instruction_row_id AND mark->>'tipe' IN('target','terkait') AND public.safe_uuid(mark->>'seksi_id')=p_seksi_id) THEN RAISE EXCEPTION 'Seksi tidak termasuk lingkup audit QA.';END IF;IF EXISTS(SELECT 1 FROM public.audit_internal_reports x WHERE x.instruction_row_id=v_report.instruction_row_id AND x.seksi_id=p_seksi_id) THEN RAISE EXCEPTION 'Laporan Seksi tersebut sudah ada.';END IF;UPDATE public.audit_internal_reports SET seksi_id=p_seksi_id,revision_version=revision_version+1 WHERE id=p_report_id RETURNING * INTO v_report;RETURN v_report;END $$;

REVOKE EXECUTE ON FUNCTION public.create_internal_audit_report(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.save_finding_plor_with_section(uuid,integer,text,text,text,text,text,text,uuid,text,uuid,date,text),public.create_internal_audit_report_for_section(uuid,uuid),public.assign_internal_audit_report_section(uuid,integer,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_finding_plor_with_section(uuid,integer,text,text,text,text,text,text,uuid,text,uuid,date,text),public.create_internal_audit_report_for_section(uuid,uuid),public.assign_internal_audit_report_section(uuid,integer,uuid) TO authenticated;

DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='findings' AND column_name='seksi_auditee_id') THEN RAISE EXCEPTION 'missing Finding Section';END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='audit_internal_reports' AND column_name='seksi_id') THEN RAISE EXCEPTION 'missing report Section';END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.audit_internal_reports'::regclass AND conname='audit_internal_reports_instruction_row_key') THEN RAISE EXCEPTION 'old report uniqueness remains';END IF;
 IF to_regclass('public.audit_internal_reports_instruction_section_unique') IS NULL THEN RAISE EXCEPTION 'missing scoped report uniqueness';END IF;
 IF has_table_privilege('authenticated','public.audit_internal_reports','INSERT') OR has_table_privilege('authenticated','public.audit_internal_reports','UPDATE') OR has_table_privilege('authenticated','public.audit_internal_reports','DELETE') THEN RAISE EXCEPTION 'direct report DML must remain revoked';END IF;
 IF has_table_privilege('authenticated','public.findings','UPDATE') THEN RAISE EXCEPTION 'direct Finding UPDATE must remain revoked';END IF;
 IF EXISTS(
   SELECT 1 FROM public.findings f
   WHERE f.seksi_auditee_id IS NOT NULL AND NOT EXISTS(
     SELECT 1 FROM public.audit_instruction_rows r
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]'::jsonb)) mark
     WHERE r.id=f.instruction_row_id AND mark->>'tipe' IN('target','terkait')
       AND public.safe_uuid(mark->>'seksi_id')=f.seksi_auditee_id
   )
 ) THEN RAISE EXCEPTION 'Finding Section hasil backfill berada di luar lingkup QA';END IF;
 IF EXISTS(
   SELECT 1 FROM public.findings f JOIN public.cars c ON c.finding_id=f.id
   WHERE c.seksi_auditee_id IS NOT NULL AND f.seksi_auditee_id IS DISTINCT FROM c.seksi_auditee_id
 ) THEN RAISE EXCEPTION 'Finding/LTP Section tidak konsisten setelah backfill';END IF;
 IF EXISTS(
   SELECT 1 FROM public.findings f JOIN finding_section_backfill_revisions snapshot ON snapshot.id=f.id
   WHERE f.revision_version IS DISTINCT FROM snapshot.revision_version
 ) THEN RAISE EXCEPTION 'Finding revision berubah selama Section backfill';END IF;
END $$;
