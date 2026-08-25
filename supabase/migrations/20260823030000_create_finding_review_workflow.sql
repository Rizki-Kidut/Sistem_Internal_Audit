-- Batch 7.0 review correction: controlled pre-publication Finding workflow.
-- Batch 6a/6b history stays immutable; these definitions supersede it additively.

ALTER TABLE public.audit_team_master_members
  ADD COLUMN is_team_leader boolean NOT NULL DEFAULT false,
  ADD COLUMN is_lead_auditor boolean NOT NULL DEFAULT false;
UPDATE public.audit_team_master_members SET is_team_leader=true,is_lead_auditor=true WHERE peran='Lead';
CREATE UNIQUE INDEX uq_team_one_team_leader ON public.audit_team_master_members(team_id) WHERE is_team_leader;
CREATE UNIQUE INDEX uq_team_one_lead_auditor ON public.audit_team_master_members(team_id) WHERE is_lead_auditor;
CREATE FUNCTION public.validate_team_responsibilities() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_team uuid:=CASE WHEN TG_TABLE_NAME='audit_team_masters' THEN CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END ELSE CASE WHEN TG_OP='DELETE' THEN OLD.team_id ELSE NEW.team_id END END;
BEGIN IF EXISTS(SELECT 1 FROM public.audit_team_masters t WHERE t.id=v_team AND t.status='Aktif') AND ((SELECT count(*) FROM public.audit_team_master_members m WHERE m.team_id=v_team AND m.is_team_leader)<>1 OR (SELECT count(*) FROM public.audit_team_master_members m WHERE m.team_id=v_team AND m.is_lead_auditor)<>1) THEN RAISE EXCEPTION 'Tim aktif wajib memiliki tepat satu Team Leader dan satu Lead Auditor';END IF;RETURN NULL;END $$;
CREATE CONSTRAINT TRIGGER trg_validate_team_responsibilities AFTER INSERT OR UPDATE OR DELETE ON public.audit_team_master_members DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_team_responsibilities();
CREATE CONSTRAINT TRIGGER trg_validate_team_header_responsibilities AFTER INSERT OR UPDATE ON public.audit_team_masters DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.validate_team_responsibilities();


-- Explicit responsibility flags are authoritative after the one-time legacy backfill above.
CREATE OR REPLACE FUNCTION public.save_audit_team_master(
  p_id uuid,p_plan_id uuid,p_kode_tim text,p_nama_tim text,p_status text,p_catatan text,p_members jsonb
) RETURNS uuid LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid;v_old_plan uuid;
BEGIN
  IF p_plan_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.audit_plans WHERE id=p_plan_id) THEN RAISE EXCEPTION 'Rencana Audit Tahunan tidak ditemukan';END IF;
  IF nullif(btrim(p_kode_tim),'') IS NULL OR nullif(btrim(p_nama_tim),'') IS NULL THEN RAISE EXCEPTION 'Kode dan nama Tim Audit wajib diisi';END IF;
  IF p_status NOT IN('Aktif','Nonaktif') OR jsonb_typeof(p_members)<>'array' THEN RAISE EXCEPTION 'Data Tim Audit tidak valid';END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_members))<>(SELECT count(DISTINCT x->>'auditor_id') FROM jsonb_array_elements(p_members)x) THEN RAISE EXCEPTION 'Auditor tidak boleh duplikat';END IF;
  IF p_status='Aktif' AND (SELECT count(*) FROM jsonb_array_elements(p_members)x WHERE COALESCE((x->>'is_team_leader')::boolean,false))<>1 THEN RAISE EXCEPTION 'Tim Audit aktif harus memiliki tepat satu Team Leader';END IF;
  IF p_status='Aktif' AND (SELECT count(*) FROM jsonb_array_elements(p_members)x WHERE COALESCE((x->>'is_lead_auditor')::boolean,false))<>1 THEN RAISE EXCEPTION 'Tim Audit aktif harus memiliki tepat satu Lead Auditor';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_members)x LEFT JOIN public.auditors a ON a.id=(x->>'auditor_id')::uuid WHERE a.id IS NULL OR a.status<>'Aktif') THEN RAISE EXCEPTION 'Semua anggota Tim Audit harus merupakan auditor aktif';END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.audit_team_masters(plan_id,kode_tim,nama_tim,status,catatan) VALUES(p_plan_id,btrim(p_kode_tim),btrim(p_nama_tim),p_status,nullif(btrim(p_catatan),'')) RETURNING id INTO v_id;
  ELSE
    SELECT plan_id INTO v_old_plan FROM public.audit_team_masters WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tim Audit tidak ditemukan';END IF;
    IF v_old_plan IS DISTINCT FROM p_plan_id THEN RAISE EXCEPTION 'Rencana Audit Tahunan pemilik Tim tidak dapat diubah';END IF;
    IF EXISTS(SELECT 1 FROM public.audit_team_masters WHERE id=p_id AND is_locked) THEN RAISE EXCEPTION 'Tim Audit terkunci. Buka kunci sebelum mengedit.';END IF;
    UPDATE public.audit_team_masters SET kode_tim=btrim(p_kode_tim),nama_tim=btrim(p_nama_tim),status=p_status,catatan=nullif(btrim(p_catatan),'') WHERE id=p_id RETURNING id INTO v_id;
    DELETE FROM public.audit_team_master_members WHERE team_id=v_id;
  END IF;
  INSERT INTO public.audit_team_master_members(team_id,auditor_id,peran,is_team_leader,is_lead_auditor,urutan_tampil)
  SELECT v_id,(x->>'auditor_id')::uuid,
         CASE WHEN COALESCE((x->>'is_team_leader')::boolean,false) THEN 'Lead' ELSE 'Member' END,
         COALESCE((x->>'is_team_leader')::boolean,false),COALESCE((x->>'is_lead_auditor')::boolean,false),COALESCE((x->>'urutan_tampil')::integer,0)
  FROM jsonb_array_elements(p_members)x;
  RETURN v_id;
END $$;

CREATE FUNCTION public.current_auditor_is_team_leader(p_finding_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.current_identity_type()='AUDITOR' AND EXISTS(SELECT 1 FROM public.findings f JOIN public.audit_instruction_rows r ON r.id=f.instruction_row_id JOIN public.audit_team_master_members m ON m.team_id=r.team_master_id WHERE f.id=p_finding_id AND m.auditor_id=public.current_auditor_id() AND m.is_team_leader)
$$;
CREATE FUNCTION public.current_auditor_is_lead_auditor(p_finding_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.current_identity_type()='AUDITOR' AND EXISTS(SELECT 1 FROM public.findings f JOIN public.audit_instruction_rows r ON r.id=f.instruction_row_id JOIN public.audit_team_master_members m ON m.team_id=r.team_master_id WHERE f.id=p_finding_id AND m.auditor_id=public.current_auditor_id() AND m.is_lead_auditor)
$$;

ALTER TABLE public.findings ALTER COLUMN kode_temuan DROP NOT NULL;
ALTER TABLE public.findings ADD COLUMN draft_reference text,
  ADD COLUMN review_status text,
  ADD COLUMN revision_version integer NOT NULL DEFAULT 1,
  ADD COLUMN approved_at timestamptz, ADD COLUMN approved_by uuid REFERENCES auth.users(id),
  ADD COLUMN released_at timestamptz, ADD COLUMN released_by uuid REFERENCES auth.users(id),
  ADD COLUMN annulled_at timestamptz, ADD COLUMN annulled_by uuid REFERENCES auth.users(id), ADD COLUMN annul_reason text;
-- Existing numbered Findings predate this review workflow. Preserve their official
-- number and operational lifecycle. Only records that are already completed or have
-- progressed beyond Open/CAR-less operation are treated as established. Numbered
-- Findings on an unfinished audit remain DRAFT-compatible so the Team can finish PLOR
-- and submit them through the new review workflow without losing the legacy number.
UPDATE public.findings f
SET review_status = CASE
      WHEN f.kode_temuan IS NULL THEN 'DRAFT'
      WHEN r.cek_selesai IS TRUE OR f.status <> 'Open' OR f.car_id IS NOT NULL THEN 'LEGACY_ESTABLISHED'
      ELSE 'DRAFT'
    END,
    draft_reference = CASE WHEN f.kode_temuan IS NULL
      THEN 'Draft Finding #'||lpad(f.nomor_urut_temuan::text,2,'0') ELSE NULL END
FROM public.audit_instruction_rows r
WHERE r.id=f.instruction_row_id;
ALTER TABLE public.findings ALTER COLUMN review_status SET DEFAULT 'DRAFT';
ALTER TABLE public.findings ALTER COLUMN review_status SET NOT NULL;
ALTER TABLE public.findings ADD CONSTRAINT findings_review_status_check CHECK(review_status IN('DRAFT','LEAD_REVIEW','REVISION_REQUIRED','READY_FOR_RELEASE','PUBLISHED','ANNULLED','LEGACY_ESTABLISHED'));
ALTER TABLE public.findings ADD CONSTRAINT findings_revision_version_check CHECK(revision_version>0);

CREATE TABLE public.finding_review_events(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), finding_id uuid NOT NULL REFERENCES public.findings(id) ON DELETE RESTRICT,
 event_type text NOT NULL CHECK(event_type IN('PLOR_EDITED','TEAM_SUBMITTED','REVISION_REQUESTED','TEAM_RESPONSE','TEAM_RESUBMITTED','APPROVED','ANNULLED','RELEASED')),
 actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, actor_identity_type text NOT NULL,
 comment text, changed_fields jsonb, before_values jsonb, after_values jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_finding_review_events_finding ON public.finding_review_events(finding_id,created_at);
CREATE TABLE public.finding_source_dispositions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), finding_id uuid NOT NULL UNIQUE REFERENCES public.findings(id) ON DELETE RESTRICT,
 source_type text NOT NULL, source_item_id uuid NOT NULL, initial_judgement text NOT NULL, effective_judgement text NOT NULL,
 reason text NOT NULL, actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
 actor_display_name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
 finding_id uuid REFERENCES public.findings(id) ON DELETE CASCADE, notification_type text NOT NULL,
 title text NOT NULL, message text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(recipient_user_id,finding_id,notification_type,created_at)
);
CREATE INDEX idx_notifications_recipient ON public.notifications(recipient_user_id,read_at,created_at DESC);

ALTER TABLE public.finding_review_events ENABLE ROW LEVEL SECURITY; ALTER TABLE public.finding_source_dispositions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.finding_review_events,public.finding_source_dispositions TO authenticated;
GRANT SELECT,UPDATE ON public.notifications TO authenticated;
CREATE POLICY finding_events_scoped_read ON public.finding_review_events FOR SELECT TO authenticated USING(public.is_admin_identity() OR public.auditor_can_access_instruction_row((SELECT f.instruction_row_id FROM public.findings f WHERE f.id=finding_review_events.finding_id)));
CREATE POLICY finding_dispositions_scoped_read ON public.finding_source_dispositions FOR SELECT TO authenticated USING(public.is_admin_identity() OR public.auditor_can_access_instruction_row((SELECT f.instruction_row_id FROM public.findings f WHERE f.id=finding_source_dispositions.finding_id)));
CREATE POLICY notifications_own_read ON public.notifications FOR SELECT TO authenticated USING(recipient_user_id=auth.uid());
CREATE POLICY notifications_own_update ON public.notifications FOR UPDATE TO authenticated USING(recipient_user_id=auth.uid()) WITH CHECK(recipient_user_id=auth.uid());

CREATE FUNCTION public.protect_notification_update() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN IF (to_jsonb(NEW)-'read_at') IS DISTINCT FROM (to_jsonb(OLD)-'read_at') THEN RAISE EXCEPTION 'Notifikasi hanya dapat ditandai dibaca';END IF;RETURN NEW;END $$;
CREATE TRIGGER trg_protect_notification_update BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.protect_notification_update();
CREATE FUNCTION public.reject_immutable_workflow_rows() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$ BEGIN RAISE EXCEPTION 'Riwayat review/disposisi bersifat permanen';END $$;
CREATE TRIGGER trg_immutable_finding_events BEFORE UPDATE OR DELETE ON public.finding_review_events FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_workflow_rows();
CREATE TRIGGER trg_immutable_finding_dispositions BEFORE UPDATE OR DELETE ON public.finding_source_dispositions FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_workflow_rows();

-- Source synchronization creates a stable draft, never an official publication number.
CREATE FUNCTION public.prepare_draft_finding_insert() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN NEW.kode_temuan:=NULL;NEW.draft_reference:=COALESCE(NEW.draft_reference,'Draft Finding #'||lpad(NEW.nomor_urut_temuan::text,2,'0'));NEW.review_status:='DRAFT';RETURN NEW;END $$;
CREATE TRIGGER trg_prepare_draft_finding_insert BEFORE INSERT ON public.findings FOR EACH ROW EXECUTE FUNCTION public.prepare_draft_finding_insert();

CREATE FUNCTION public.assert_complete_plor(p_f public.findings) RETURNS void LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
BEGIN
 IF COALESCE(btrim(p_f.problem),'')='' OR COALESCE(btrim(p_f.location),'')='' OR COALESCE(btrim(p_f.objective_evidence),'')='' THEN RAISE EXCEPTION 'Problem, Location, dan Objective Evidence wajib dilengkapi';END IF;
 IF p_f.kategori IN('A','B') AND COALESCE(btrim(p_f.reference),'')='' THEN RAISE EXCEPTION 'Reference wajib diisi untuk kategori A/B';END IF;
 IF p_f.kategori='C' AND COALESCE(btrim(p_f.saran_perbaikan),'')='' THEN RAISE EXCEPTION 'Saran Perbaikan wajib diisi untuk kategori C';END IF;
END $$;

CREATE OR REPLACE FUNCTION public.protect_finding_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_identity text:=public.current_identity_type();v_changed jsonb;v_plor_context text:=COALESCE(current_setting('certitrack.finding_plor_save',true),'');v_reason text:=NULLIF(btrim(COALESCE(current_setting('certitrack.finding_plor_reason',true),'')),'');
BEGIN
 IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at Temuan tidak dapat diubah';END IF;
 IF COALESCE(current_setting('certitrack.finding_sync',true),'')='1' THEN
  IF OLD.review_status NOT IN('DRAFT','REVISION_REQUIRED') THEN RAISE EXCEPTION 'Kategori sumber terkunci setelah Finding dikirim untuk review';END IF;
  IF (to_jsonb(NEW)-ARRAY['kategori','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['kategori','updated_at']) THEN RAISE EXCEPTION 'Sinkronisasi sumber hanya boleh mengubah kategori Finding';END IF;RETURN NEW;
 END IF;
 IF COALESCE(current_setting('certitrack.finding_workflow',true),'')='1' THEN
  IF OLD.review_status='DRAFT' AND NEW.review_status='LEAD_REVIEW' AND public.current_auditor_is_team_leader(OLD.id) AND (to_jsonb(NEW)-ARRAY['review_status','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='REVISION_REQUIRED' AND NEW.review_status='LEAD_REVIEW' AND public.current_auditor_is_team_leader(OLD.id) AND (to_jsonb(NEW)-ARRAY['review_status','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='LEAD_REVIEW' AND NEW.review_status='REVISION_REQUIRED' AND public.current_auditor_is_lead_auditor(OLD.id) AND (to_jsonb(NEW)-ARRAY['review_status','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='LEAD_REVIEW' AND NEW.review_status='READY_FOR_RELEASE' AND public.current_auditor_is_lead_auditor(OLD.id) AND (to_jsonb(NEW)-ARRAY['kode_temuan','review_status','approved_at','approved_by','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['kode_temuan','review_status','approved_at','approved_by','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='LEAD_REVIEW' AND NEW.review_status='ANNULLED' AND public.current_auditor_is_lead_auditor(OLD.id) AND (to_jsonb(NEW)-ARRAY['review_status','annulled_at','annulled_by','annul_reason','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','annulled_at','annulled_by','annul_reason','revision_version','updated_at']) THEN RETURN NEW;END IF;
  IF OLD.review_status='READY_FOR_RELEASE' AND NEW.review_status='PUBLISHED' AND public.is_admin_identity() AND (to_jsonb(NEW)-ARRAY['review_status','released_at','released_by','revision_version','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['review_status','released_at','released_by','revision_version','updated_at']) THEN RETURN NEW;END IF;
  RAISE EXCEPTION 'Mutasi workflow Finding tidak sesuai aksi/otoritas resmi';
 END IF;
 IF v_plor_context=OLD.id::text THEN
  IF OLD.review_status NOT IN('DRAFT','REVISION_REQUIRED') THEN RAISE EXCEPTION 'PLOR tidak dapat diedit pada status %',OLD.review_status;END IF;
  IF v_identity='AUDITOR' AND NOT public.auditor_can_access_instruction_row(OLD.instruction_row_id) THEN RAISE EXCEPTION 'Temuan bukan milik Tim Auditor';
  ELSIF v_identity<>'AUDITOR' AND v_identity<>'ADMIN' THEN RAISE EXCEPTION 'Identitas tidak diizinkan mengedit PLOR';END IF;
  IF v_identity='ADMIN' AND length(regexp_replace(COALESCE(v_reason,''),'[[:space:]]','','g'))<10 THEN RAISE EXCEPTION 'Alasan perubahan Admin/QMS wajib minimal 10 karakter non-spasi';END IF;
  IF (to_jsonb(NEW)-ARRAY['klasifikasi_dis','problem','location','objective_evidence','reference','saran_perbaikan','auditor_penemu_id','auditee_area','tanggal_temuan','revision_version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['klasifikasi_dis','problem','location','objective_evidence','reference','saran_perbaikan','auditor_penemu_id','auditee_area','tanggal_temuan','revision_version','updated_at']) THEN RAISE EXCEPTION 'save_finding_plor hanya boleh mengubah field PLOR yang disetujui';END IF;
  IF NEW.auditor_penemu_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.audit_instruction_rows r JOIN public.audit_team_master_members m ON m.team_id=r.team_master_id WHERE r.id=NEW.instruction_row_id AND m.auditor_id=NEW.auditor_penemu_id) THEN RAISE EXCEPTION 'Auditor Penemu harus anggota Tim Audit';END IF;
  IF NEW.revision_version<>OLD.revision_version THEN RAISE EXCEPTION 'Versi Temuan tidak valid';END IF;
  v_changed:=(SELECT COALESCE(jsonb_object_agg(k,v),'{}') FROM jsonb_each(to_jsonb(NEW)-ARRAY['updated_at','revision_version']) n(k,v) WHERE v IS DISTINCT FROM (to_jsonb(OLD)->k));
  NEW.revision_version:=OLD.revision_version+1;
  INSERT INTO public.finding_review_events(finding_id,event_type,actor_user_id,actor_identity_type,comment,changed_fields,before_values,after_values)
  VALUES(OLD.id,'PLOR_EDITED',auth.uid(),v_identity,v_reason,v_changed,to_jsonb(OLD),to_jsonb(NEW));
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'PLOR hanya dapat diubah melalui save_finding_plor';
END $$;

CREATE FUNCTION public.save_finding_plor(
 p_id uuid,p_expected_version integer,p_klasifikasi_dis text,p_problem text,p_location text,p_objective_evidence text,p_reference text,p_saran_perbaikan text,p_auditor_penemu_id uuid,p_auditee_area text,p_tanggal_temuan date,p_reason text
) RETURNS public.findings LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE f public.findings%ROWTYPE;v_identity text:=public.current_identity_type();v_previous_context text:=current_setting('certitrack.finding_plor_save',true);v_previous_reason text:=current_setting('certitrack.finding_plor_reason',true);v_result public.findings%ROWTYPE;
BEGIN
 SELECT * INTO f FROM public.findings WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Temuan tidak ditemukan';END IF;
 IF f.review_status NOT IN('DRAFT','REVISION_REQUIRED') THEN RAISE EXCEPTION 'PLOR tidak dapat diedit pada status %',f.review_status;END IF;
 IF v_identity='AUDITOR' AND NOT public.auditor_can_access_instruction_row(f.instruction_row_id) THEN RAISE EXCEPTION 'Temuan bukan milik Tim Auditor';
 ELSIF v_identity<>'AUDITOR' AND v_identity<>'ADMIN' THEN RAISE EXCEPTION 'Identitas tidak diizinkan mengedit PLOR';END IF;
 IF f.revision_version<>p_expected_version THEN RAISE EXCEPTION 'Finding ini telah diperbarui anggota Tim lain. Muat ulang data terbaru sebelum menyimpan.';END IF;
 IF v_identity='ADMIN' AND length(regexp_replace(COALESCE(p_reason,''),'[[:space:]]','','g'))<10 THEN RAISE EXCEPTION 'Alasan perubahan Admin/QMS wajib minimal 10 karakter non-spasi';END IF;
 PERFORM set_config('certitrack.finding_plor_save',p_id::text,true);
 PERFORM set_config('certitrack.finding_plor_reason',COALESCE(p_reason,''),true);
 BEGIN
  UPDATE public.findings SET klasifikasi_dis=p_klasifikasi_dis,problem=NULLIF(btrim(p_problem),''),location=NULLIF(btrim(p_location),''),objective_evidence=NULLIF(btrim(p_objective_evidence),''),reference=NULLIF(btrim(p_reference),''),saran_perbaikan=NULLIF(btrim(p_saran_perbaikan),''),auditor_penemu_id=p_auditor_penemu_id,auditee_area=NULLIF(btrim(p_auditee_area),''),tanggal_temuan=p_tanggal_temuan WHERE id=p_id AND revision_version=p_expected_version RETURNING * INTO v_result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finding ini telah diperbarui anggota Tim lain. Muat ulang data terbaru sebelum menyimpan.';END IF;
 EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('certitrack.finding_plor_save',COALESCE(v_previous_context,''),true);PERFORM set_config('certitrack.finding_plor_reason',COALESCE(v_previous_reason,''),true);RAISE;
 END;
 PERFORM set_config('certitrack.finding_plor_save',COALESCE(v_previous_context,''),true);PERFORM set_config('certitrack.finding_plor_reason',COALESCE(v_previous_reason,''),true);
 RETURN v_result;
END $$;

CREATE FUNCTION public.add_finding_notification(p_finding uuid,p_type text,p_title text,p_message text,p_recipient uuid) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 INSERT INTO public.notifications(recipient_user_id,finding_id,notification_type,title,message) VALUES(p_recipient,p_finding,p_type,p_title,p_message)
$$;
CREATE FUNCTION public.finding_transition(p_id uuid,p_action text,p_comment text DEFAULT NULL,p_effective_judgement text DEFAULT NULL) RETURNS public.findings LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE f public.findings%ROWTYPE;v_identity text:=public.current_identity_type();v_team uuid;v_year int;v_prefix text;v_seq int;u record;v_initial text;v_actor_name text;v_display_ref text;
BEGIN
 SELECT x.* INTO f FROM public.findings x WHERE x.id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Temuan tidak ditemukan';END IF;
 IF NOT public.is_admin_identity() AND NOT public.auditor_can_access_instruction_row(f.instruction_row_id) THEN RAISE EXCEPTION 'Temuan tidak ditemukan atau tidak dapat diakses';END IF;
 SELECT r.team_master_id,i.tahun_fiskal INTO v_team,v_year FROM public.audit_instruction_rows r JOIN public.audit_instructions i ON i.id=r.instruction_id WHERE r.id=f.instruction_row_id;
 v_display_ref:=COALESCE(f.kode_temuan,f.draft_reference,'Finding');
 PERFORM set_config('certitrack.finding_workflow','1',true);
 IF p_action='SUBMIT' THEN
  IF f.review_status<>'DRAFT' OR NOT public.current_auditor_is_team_leader(p_id) THEN RAISE EXCEPTION 'Hanya Team Leader dapat mengirim Draft';END IF;PERFORM public.assert_complete_plor(f);
  UPDATE public.findings SET review_status='LEAD_REVIEW',revision_version=revision_version+1 WHERE id=p_id;
  INSERT INTO public.finding_review_events VALUES(gen_random_uuid(),p_id,'TEAM_SUBMITTED',auth.uid(),v_identity,NULLIF(btrim(p_comment),''),NULL,NULL,NULL,now());
  FOR u IN SELECT l.user_id FROM public.audit_team_master_members m JOIN public.user_auditor_links l ON l.auditor_id=m.auditor_id JOIN public.user_profiles p ON p.id=l.user_id WHERE m.team_id=v_team AND m.is_lead_auditor AND p.status='Aktif' LOOP PERFORM public.add_finding_notification(p_id,'LEAD_REVIEW','Finding menunggu review',f.kode_audit||' · '||v_display_ref,u.user_id);END LOOP;
 ELSIF p_action='RESUBMIT' THEN
  IF f.review_status<>'REVISION_REQUIRED' OR NOT public.current_auditor_is_team_leader(p_id) THEN RAISE EXCEPTION 'Hanya Team Leader dapat mengirim ulang revisi';END IF;PERFORM public.assert_complete_plor(f);
  UPDATE public.findings SET review_status='LEAD_REVIEW',revision_version=revision_version+1 WHERE id=p_id;
  INSERT INTO public.finding_review_events VALUES(gen_random_uuid(),p_id,'TEAM_RESUBMITTED',auth.uid(),v_identity,NULLIF(btrim(p_comment),''),NULL,NULL,NULL,now());
  FOR u IN SELECT l.user_id FROM public.audit_team_master_members m JOIN public.user_auditor_links l ON l.auditor_id=m.auditor_id JOIN public.user_profiles p ON p.id=l.user_id WHERE m.team_id=v_team AND m.is_lead_auditor AND p.status='Aktif' LOOP PERFORM public.add_finding_notification(p_id,'RESUBMITTED','Finding dikirim ulang',f.kode_audit||' · '||v_display_ref,u.user_id);END LOOP;
 ELSIF p_action='REQUEST_REVISION' THEN
  IF f.review_status<>'LEAD_REVIEW' OR NOT public.current_auditor_is_lead_auditor(p_id) THEN RAISE EXCEPTION 'Hanya Lead Auditor dapat meminta revisi';END IF;IF COALESCE(btrim(p_comment),'')='' THEN RAISE EXCEPTION 'Komentar revisi wajib diisi';END IF;
  UPDATE public.findings SET review_status='REVISION_REQUIRED',revision_version=revision_version+1 WHERE id=p_id;
  INSERT INTO public.finding_review_events VALUES(gen_random_uuid(),p_id,'REVISION_REQUESTED',auth.uid(),v_identity,p_comment,NULL,NULL,NULL,now());
  FOR u IN SELECT l.user_id FROM public.audit_team_master_members m JOIN public.user_auditor_links l ON l.auditor_id=m.auditor_id JOIN public.user_profiles p ON p.id=l.user_id WHERE m.team_id=v_team AND p.status='Aktif' AND l.user_id<>auth.uid() LOOP PERFORM public.add_finding_notification(p_id,'REVISION_REQUIRED','Finding Revision Required',f.kode_audit||' · '||v_display_ref||E'\n'||p_comment,u.user_id);END LOOP;
 ELSIF p_action='APPROVE' THEN
  IF f.review_status<>'LEAD_REVIEW' OR NOT public.current_auditor_is_lead_auditor(p_id) THEN RAISE EXCEPTION 'Hanya Lead Auditor dapat menyetujui';END IF;PERFORM public.assert_complete_plor(f);
  IF f.kode_temuan IS NULL THEN
   PERFORM pg_advisory_xact_lock(hashtext('finding-number'),hashtext(f.kode_audit));
   v_prefix:=CASE f.source_type WHEN 'ChecklistSistem' THEN 'SYS' WHEN 'ChecklistProduk' THEN 'PRD' ELSE 'MFG' END;
   SELECT COALESCE(max((regexp_match(kode_temuan,'/([0-9]+)$'))[1]::int),0)+1 INTO v_seq FROM public.findings WHERE kode_audit=f.kode_audit AND kode_temuan IS NOT NULL;
  END IF;
  UPDATE public.findings SET kode_temuan=COALESCE(f.kode_temuan,f.kode_audit||'/'||v_prefix||'/'||v_year||'/'||lpad(v_seq::text,3,'0')),review_status='READY_FOR_RELEASE',approved_at=now(),approved_by=auth.uid(),revision_version=revision_version+1 WHERE id=p_id;
  INSERT INTO public.finding_review_events VALUES(gen_random_uuid(),p_id,'APPROVED',auth.uid(),v_identity,NULLIF(btrim(p_comment),''),NULL,NULL,NULL,now());
  FOR u IN SELECT id user_id FROM public.user_profiles WHERE status='Aktif' AND identity_type='ADMIN' UNION SELECT l.user_id FROM public.audit_team_master_members m JOIN public.user_auditor_links l ON l.auditor_id=m.auditor_id JOIN public.user_profiles p ON p.id=l.user_id WHERE m.team_id=v_team AND p.status='Aktif' LOOP PERFORM public.add_finding_notification(p_id,'APPROVED','Finding disetujui',f.kode_audit||' · '||v_display_ref||' siap dirilis',u.user_id);END LOOP;
 ELSIF p_action='ANNUL' THEN
  IF f.review_status<>'LEAD_REVIEW' OR NOT public.current_auditor_is_lead_auditor(p_id) THEN RAISE EXCEPTION 'Hanya Lead Auditor dapat membatalkan';END IF;IF COALESCE(btrim(p_comment),'')='' THEN RAISE EXCEPTION 'Alasan pembatalan wajib diisi';END IF;
  SELECT display_name INTO v_actor_name FROM public.user_profiles WHERE id=auth.uid() AND identity_type='AUDITOR' AND status='Aktif';
  IF v_actor_name IS NULL THEN RAISE EXCEPTION 'Identitas Lead Auditor tidak aktif';END IF;
  PERFORM set_config('certitrack.finding_annul_source',p_id::text,true);
  IF f.source_type='ChecklistProduk' THEN
   SELECT concat_ws(' / ',judgment,finding_kategori) INTO v_initial FROM public.checklist_produk_items WHERE id=f.source_item_id AND finding_id=f.id FOR UPDATE;
   IF v_initial IS NULL OR split_part(v_initial,' / ',1)<>'NG' OR p_effective_judgement<>'OK' THEN RAISE EXCEPTION 'Sumber Produk harus NG dan judgement efektif harus OK';END IF;
   UPDATE public.checklist_produk_items SET judgment='OK',finding_kategori=NULL WHERE id=f.source_item_id AND finding_id=f.id;
  ELSIF f.source_type='ChecklistSistem' THEN
   SELECT hasil INTO v_initial FROM public.checklist_items WHERE id=f.source_item_id AND finding_id=f.id FOR UPDATE;
   IF v_initial NOT IN('A','B','C') OR p_effective_judgement<>'O' THEN RAISE EXCEPTION 'Sumber Sistem harus A/B/C dan hasil efektif harus O';END IF;
   UPDATE public.checklist_items SET hasil='O' WHERE id=f.source_item_id AND finding_id=f.id;
  ELSE
   SELECT hasil INTO v_initial FROM public.checklist_manufaktur_items WHERE id=f.source_item_id AND finding_id=f.id FOR UPDATE;
   IF v_initial NOT IN('A','B','C') OR p_effective_judgement<>'O' THEN RAISE EXCEPTION 'Sumber Manufaktur harus A/B/C dan hasil efektif harus O';END IF;
   UPDATE public.checklist_manufaktur_items SET hasil='O' WHERE id=f.source_item_id AND finding_id=f.id;
  END IF;
  INSERT INTO public.finding_source_dispositions(finding_id,source_type,source_item_id,initial_judgement,effective_judgement,reason,actor_user_id,actor_display_name) VALUES(p_id,f.source_type,f.source_item_id,v_initial,p_effective_judgement,p_comment,auth.uid(),v_actor_name);
  UPDATE public.findings SET review_status='ANNULLED',annulled_at=now(),annulled_by=auth.uid(),annul_reason=p_comment,revision_version=revision_version+1 WHERE id=p_id;
  INSERT INTO public.finding_review_events VALUES(gen_random_uuid(),p_id,'ANNULLED',auth.uid(),v_identity,p_comment,NULL,NULL,jsonb_build_object('effective_judgement',p_effective_judgement),now());
 ELSIF p_action='RELEASE' THEN
  IF f.review_status<>'READY_FOR_RELEASE' OR NOT public.is_admin_identity() THEN RAISE EXCEPTION 'Hanya Admin dapat merilis Finding yang disetujui';END IF;
  UPDATE public.findings SET review_status='PUBLISHED',released_at=now(),released_by=auth.uid(),revision_version=revision_version+1 WHERE id=p_id;
  INSERT INTO public.finding_review_events VALUES(gen_random_uuid(),p_id,'RELEASED',auth.uid(),v_identity,NULLIF(btrim(p_comment),''),NULL,NULL,NULL,now());
 ELSE RAISE EXCEPTION 'Aksi Finding tidak valid';END IF;
 SELECT * INTO f FROM public.findings WHERE id=p_id;RETURN f;
END $$;

CREATE FUNCTION public.add_finding_team_response(p_id uuid,p_comment text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE f public.findings%ROWTYPE;BEGIN SELECT * INTO f FROM public.findings WHERE id=p_id;IF NOT public.auditor_can_access_instruction_row(f.instruction_row_id) OR f.review_status NOT IN('DRAFT','REVISION_REQUIRED') THEN RAISE EXCEPTION 'Respons Tim tidak diizinkan';END IF;IF COALESCE(btrim(p_comment),'')='' THEN RAISE EXCEPTION 'Komentar wajib diisi';END IF;INSERT INTO public.finding_review_events(finding_id,event_type,actor_user_id,actor_identity_type,comment) VALUES(p_id,'TEAM_RESPONSE',auth.uid(),'AUDITOR',p_comment);END $$;

CREATE FUNCTION public.finding_capabilities(p_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT jsonb_build_object('is_team_member',public.auditor_can_access_instruction_row(f.instruction_row_id),'is_team_leader',public.current_auditor_is_team_leader(f.id),'is_lead_auditor',public.current_auditor_is_lead_auditor(f.id),'is_admin',public.is_admin_identity()) FROM public.findings f WHERE f.id=p_id AND (public.is_admin_identity() OR public.auditor_can_access_instruction_row(f.instruction_row_id))
$$;

-- Admin remains preparation authority but cannot act as an execution Auditor.
CREATE OR REPLACE FUNCTION public.guard_identity_execution_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_identity text:=public.current_identity_type();v_sync boolean:=COALESCE(current_setting('certitrack.finding_sync',true),'')='1';v_annul text:=COALESCE(current_setting('certitrack.finding_annul_source',true),'');v_review text;
BEGIN
 IF v_annul<>'' AND v_identity='AUDITOR' THEN
  IF TG_TABLE_NAME='checklist_items' AND OLD.finding_id::text=v_annul AND NEW.finding_id=OLD.finding_id AND NEW.hasil='O' AND (to_jsonb(NEW)-ARRAY['hasil','updated_at']) IS NOT DISTINCT FROM(to_jsonb(OLD)-ARRAY['hasil','updated_at']) THEN RETURN NEW;END IF;
  IF TG_TABLE_NAME='checklist_produk_items' AND OLD.finding_id::text=v_annul AND NEW.finding_id=OLD.finding_id AND NEW.judgment='OK' AND NEW.finding_kategori IS NULL AND (to_jsonb(NEW)-ARRAY['judgment','finding_kategori','updated_at']) IS NOT DISTINCT FROM(to_jsonb(OLD)-ARRAY['judgment','finding_kategori','updated_at']) THEN RETURN NEW;END IF;
  IF TG_TABLE_NAME='checklist_manufaktur_items' AND OLD.finding_id::text=v_annul AND NEW.finding_id=OLD.finding_id AND NEW.hasil='O' AND (to_jsonb(NEW)-ARRAY['hasil','updated_at']) IS NOT DISTINCT FROM(to_jsonb(OLD)-ARRAY['hasil','updated_at']) THEN RETURN NEW;END IF;
  RAISE EXCEPTION 'Konteks annulment hanya boleh menerapkan hasil conforming pada sumber Finding yang sama';
 END IF;
 IF v_sync THEN
  IF TG_TABLE_NAME='checklist_items' AND (to_jsonb(NEW)-ARRAY['finding_id','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['finding_id','updated_at']) THEN RAISE EXCEPTION 'Sinkronisasi hanya boleh mengubah finding_id';END IF;
  IF TG_TABLE_NAME='checklist_produk_items' AND (to_jsonb(NEW)-ARRAY['finding_id','finding_kategori','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['finding_id','finding_kategori','updated_at']) THEN RAISE EXCEPTION 'Sinkronisasi hanya boleh mengubah relasi Finding';END IF;
  IF TG_TABLE_NAME='checklist_manufaktur_items' AND (to_jsonb(NEW)-ARRAY['finding_id','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['finding_id','updated_at']) THEN RAISE EXCEPTION 'Sinkronisasi hanya boleh mengubah finding_id';END IF;RETURN NEW;
 END IF;
 IF v_identity='ADMIN' THEN
  IF TG_TABLE_NAME='audit_instruction_rows' AND NEW.cek_selesai IS DISTINCT FROM OLD.cek_selesai THEN RAISE EXCEPTION 'Admin tidak dapat menyelesaikan/membuka pelaksanaan';END IF;
  IF TG_TABLE_NAME='checklist_items' AND (NEW.hasil,NEW.komentar_auditor) IS DISTINCT FROM (OLD.hasil,OLD.komentar_auditor) THEN RAISE EXCEPTION 'Admin tidak dapat mengisi pelaksanaan Sistem';END IF;
  IF TG_TABLE_NAME='checklist_produk_items' AND (NEW.jumlah_sampel,NEW.hasil_pemeriksaan,NEW.judgment,NEW.finding_kategori) IS DISTINCT FROM (OLD.jumlah_sampel,OLD.hasil_pemeriksaan,OLD.judgment,OLD.finding_kategori) THEN RAISE EXCEPTION 'Admin tidak dapat mengisi pelaksanaan Produk';END IF;
  IF TG_TABLE_NAME='checklist_manufaktur_items' AND (NEW.hasil_pengamatan,NEW.hasil) IS DISTINCT FROM (OLD.hasil_pengamatan,OLD.hasil) THEN RAISE EXCEPTION 'Admin tidak dapat mengisi pelaksanaan Manufaktur';END IF;RETURN NEW;
 END IF;
 IF v_identity<>'AUDITOR' THEN RAISE EXCEPTION 'Identitas tidak diizinkan mengubah pelaksanaan';END IF;
 IF TG_TABLE_NAME<>'audit_instruction_rows' THEN
  SELECT review_status INTO v_review FROM public.findings WHERE id=OLD.finding_id;
  IF v_review IS NOT NULL AND v_review NOT IN('DRAFT','REVISION_REQUIRED') THEN RAISE EXCEPTION 'Hasil sumber terkunci pada tahap review %',v_review;END IF;
 END IF;
 IF TG_TABLE_NAME='audit_instruction_rows' THEN IF NOT public.auditor_can_access_instruction_row(OLD.id) OR (to_jsonb(NEW)-'cek_selesai'-'updated_at') IS DISTINCT FROM(to_jsonb(OLD)-'cek_selesai'-'updated_at') THEN RAISE EXCEPTION 'Auditor hanya dapat menyelesaikan audit Tim';END IF;
 ELSIF TG_TABLE_NAME='checklist_items' AND (to_jsonb(NEW)-ARRAY['hasil','komentar_auditor','finding_id','updated_at']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['hasil','komentar_auditor','finding_id','updated_at']) THEN RAISE EXCEPTION 'Struktur Sistem tidak dapat diubah Auditor';
 ELSIF TG_TABLE_NAME='checklist_produk_items' AND (to_jsonb(NEW)-ARRAY['jumlah_sampel','hasil_pemeriksaan','judgment','finding_kategori','finding_id','updated_at']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['jumlah_sampel','hasil_pemeriksaan','judgment','finding_kategori','finding_id','updated_at']) THEN RAISE EXCEPTION 'Struktur Produk tidak dapat diubah Auditor';
 ELSIF TG_TABLE_NAME='checklist_manufaktur_items' AND (to_jsonb(NEW)-ARRAY['hasil_pengamatan','hasil','finding_id','updated_at']) IS DISTINCT FROM(to_jsonb(OLD)-ARRAY['hasil_pengamatan','hasil','finding_id','updated_at']) THEN RAISE EXCEPTION 'Struktur Manufaktur tidak dapat diubah Auditor';END IF;RETURN NEW;
END $$;
CREATE FUNCTION public.guard_identity_execution_insert() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF public.current_identity_type()<>'ADMIN' THEN RAISE EXCEPTION 'Hanya Admin dapat menambah struktur persiapan';END IF;
 IF TG_TABLE_NAME='checklist_items' AND (NEW.hasil IS NOT NULL OR NEW.komentar_auditor IS NOT NULL OR NEW.finding_id IS NOT NULL) THEN RAISE EXCEPTION 'Item persiapan Sistem tidak boleh berisi hasil pelaksanaan';END IF;
 IF TG_TABLE_NAME='checklist_produk_items' AND (NEW.jumlah_sampel IS NOT NULL OR NEW.hasil_pemeriksaan IS NOT NULL OR NEW.judgment IS NOT NULL OR NEW.finding_kategori IS NOT NULL OR NEW.finding_id IS NOT NULL) THEN RAISE EXCEPTION 'Item persiapan Produk tidak boleh berisi hasil pelaksanaan';END IF;
 IF TG_TABLE_NAME='checklist_manufaktur_items' AND (NEW.hasil_pengamatan IS NOT NULL OR NEW.hasil IS NOT NULL OR NEW.finding_id IS NOT NULL) THEN RAISE EXCEPTION 'Item persiapan Manufaktur tidak boleh berisi hasil pelaksanaan';END IF;RETURN NEW;
END $$;
CREATE TRIGGER trg_identity_system_insert BEFORE INSERT ON public.checklist_items FOR EACH ROW EXECUTE FUNCTION public.guard_identity_execution_insert();
CREATE TRIGGER trg_identity_product_insert BEFORE INSERT ON public.checklist_produk_items FOR EACH ROW EXECUTE FUNCTION public.guard_identity_execution_insert();
CREATE TRIGGER trg_identity_manufacturing_insert BEFORE INSERT ON public.checklist_manufaktur_items FOR EACH ROW EXECUTE FUNCTION public.guard_identity_execution_insert();

CREATE FUNCTION public.require_auditor_execution_transition() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN IF NEW.cek_selesai IS DISTINCT FROM OLD.cek_selesai AND (public.current_identity_type()<>'AUDITOR' OR NOT public.auditor_can_access_instruction_row(OLD.id)) THEN RAISE EXCEPTION 'Hanya Auditor Tim dapat menyelesaikan atau membuka pelaksanaan';END IF;
 IF NEW.cek_selesai AND EXISTS(SELECT 1 FROM public.findings f WHERE f.instruction_row_id=OLD.id AND f.review_status IN('DRAFT','LEAD_REVIEW','REVISION_REQUIRED')) THEN RAISE EXCEPTION 'Audit belum dapat diselesaikan. Review Finding masih tertunda.';END IF;RETURN NEW;END $$;
CREATE TRIGGER trg_require_auditor_execution_transition BEFORE UPDATE OF cek_selesai ON public.audit_instruction_rows FOR EACH ROW EXECUTE FUNCTION public.require_auditor_execution_transition();

CREATE FUNCTION public.product_evidence_phase_matches(p_name text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.checklist_produk_fase f WHERE f.id=CASE WHEN public.product_evidence_checklist_id(p_name) IS NOT NULL THEN (storage.foldername(p_name))[3]::uuid END AND f.checklist_produk_id=public.product_evidence_checklist_id(p_name))
$$;
DROP POLICY IF EXISTS audit_evidence_scoped_select ON storage.objects;DROP POLICY IF EXISTS audit_evidence_admin_insert ON storage.objects;DROP POLICY IF EXISTS audit_evidence_admin_update ON storage.objects;DROP POLICY IF EXISTS audit_evidence_admin_delete ON storage.objects;
CREATE POLICY audit_evidence_scoped_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='audit-evidence' AND public.product_evidence_phase_matches(name) AND (public.is_admin_identity() OR EXISTS(SELECT 1 FROM public.checklist_produk c WHERE c.id=public.product_evidence_checklist_id(name) AND public.auditor_can_access_instruction_row(c.row_id))));
CREATE POLICY audit_evidence_admin_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='audit-evidence' AND public.product_evidence_phase_matches(name) AND public.is_admin_identity());
CREATE POLICY audit_evidence_admin_update ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='audit-evidence' AND public.product_evidence_phase_matches(name) AND public.is_admin_identity()) WITH CHECK(bucket_id='audit-evidence' AND public.product_evidence_phase_matches(name) AND public.is_admin_identity());
CREATE POLICY audit_evidence_admin_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='audit-evidence' AND public.product_evidence_phase_matches(name) AND public.is_admin_identity());

-- Batch 6a source synchronization remains authoritative for Draft creation/removal.
CREATE OR REPLACE FUNCTION public.sync_checklist_finding(p_type text,p_item uuid,p_category text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_ctx record; v_row record; v_f public.findings%ROWTYPE; v_id uuid; v_seq integer; v_prefix text; v_lead uuid; v_previous_sync text;
BEGIN
  SELECT * INTO v_ctx FROM public.finding_source_context(p_type,p_item);
  IF NOT FOUND THEN RAISE EXCEPTION 'Sumber Checklist Temuan tidak ditemukan'; END IF;
  SELECT r.*,i.tahun_fiskal INTO v_row FROM public.audit_instruction_rows r
    JOIN public.audit_instructions i ON i.id=r.instruction_id WHERE r.id=v_ctx.instruction_row_id FOR UPDATE OF r;
  IF v_row.kode_audit IS DISTINCT FROM v_ctx.kode_audit THEN RAISE EXCEPTION 'Sumber Checklist tidak dimiliki No. Audit yang sama'; END IF;
  SELECT * INTO v_f FROM public.findings WHERE source_type=p_type AND source_item_id=p_item;
  -- Controlled Lead-annulment keeps the source link and permanent Finding while the
  -- authoritative source result is changed to conforming in the same transaction.
  IF v_f.id IS NOT NULL AND COALESCE(current_setting('certitrack.finding_annul_source',true),'')=v_f.id::text THEN RETURN v_f.id; END IF;
  IF p_category IS NULL THEN
    IF v_f.id IS NULL THEN RETURN NULL; END IF;
    -- A numbered legacy Draft already owns an externally traceable Batch 6a number.
    -- Do not silently delete it through ordinary source correction; route cancellation
    -- through Team submission and Lead annulment so the number/history remains visible.
    IF v_f.kode_temuan IS NOT NULL THEN
      RAISE EXCEPTION 'Temuan legacy bernomor tidak dapat dibatalkan otomatis. Lengkapi/submit PLOR lalu gunakan keputusan Annul oleh Lead Auditor.';
    END IF;
    IF v_f.review_status <> 'DRAFT' OR v_f.car_id IS NOT NULL OR
       COALESCE(btrim(v_f.klasifikasi_dis),'')<>'' OR COALESCE(btrim(v_f.problem),'')<>'' OR
       COALESCE(btrim(v_f.location),'')<>'' OR COALESCE(btrim(v_f.objective_evidence),'')<>'' OR
       COALESCE(btrim(v_f.reference),'')<>'' OR COALESCE(btrim(v_f.saran_perbaikan),'')<>'' THEN
      RAISE EXCEPTION 'Temuan sudah memiliki data PLOR dan tidak dapat dibatalkan otomatis. Kosongkan data PLOR terlebih dahulu jika hasil checklist memang akan dikoreksi.';
    END IF;
    v_previous_sync:=current_setting('certitrack.finding_sync',true);
    PERFORM set_config('certitrack.finding_sync','1',true);
    BEGIN
      IF p_type='ChecklistSistem' THEN
        UPDATE public.checklist_items SET finding_id=NULL WHERE id=p_item AND finding_id=v_f.id;
      ELSIF p_type='ChecklistManufakturShift' THEN
        UPDATE public.checklist_manufaktur_items SET finding_id=NULL WHERE id=p_item AND finding_id=v_f.id;
      ELSE
        UPDATE public.checklist_produk_items SET finding_id=NULL,finding_kategori=NULL WHERE id=p_item AND finding_id=v_f.id;
      END IF;
      DELETE FROM public.findings WHERE id=v_f.id;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
      RAISE;
    END;
    PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
    RETURN NULL;
  END IF;
  IF p_category NOT IN ('A','B','C') THEN RAISE EXCEPTION 'Kategori Temuan tidak valid'; END IF;
  IF v_f.id IS NOT NULL THEN
    IF v_f.review_status NOT IN('DRAFT','REVISION_REQUIRED') THEN
      IF v_f.kategori IS DISTINCT FROM p_category THEN RAISE EXCEPTION 'Kategori Finding terkunci pada tahap review %',v_f.review_status;END IF;
      RETURN v_f.id;
    END IF;
    v_previous_sync:=current_setting('certitrack.finding_sync',true);
    PERFORM set_config('certitrack.finding_sync','1',true);
    BEGIN
      UPDATE public.findings SET kategori=p_category WHERE id=v_f.id AND kategori IS DISTINCT FROM p_category;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
      RAISE;
    END;
    PERFORM set_config('certitrack.finding_sync',COALESCE(v_previous_sync,''),true);
    RETURN v_f.id;
  END IF;
  SELECT COALESCE(MAX(nomor_urut_temuan),0)+1 INTO v_seq FROM public.findings WHERE kode_audit=v_ctx.kode_audit;
  v_prefix:=CASE p_type WHEN 'ChecklistSistem' THEN 'SYS' WHEN 'ChecklistProduk' THEN 'PRD' ELSE 'MFG' END;
  SELECT m.auditor_id INTO v_lead FROM public.audit_team_master_members m
    WHERE m.team_id=v_row.team_master_id AND m.peran='Lead' LIMIT 1;
  INSERT INTO public.findings(instruction_row_id,kode_audit,kode_temuan,nomor_urut_temuan,source_type,source_item_id,kategori,auditor_penemu_id,auditee_area,tanggal_temuan)
  VALUES(v_ctx.instruction_row_id,v_ctx.kode_audit,NULL,v_seq,p_type,p_item,p_category,v_lead,NULLIF(v_ctx.auditee_area,''),COALESCE(v_row.tanggal_pelaksanaan_audit,current_date)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;


-- Default PostgreSQL PUBLIC function execution is not acceptable for application routines.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon;

-- Trigger/private/source-sync helpers stay unavailable as browser RPCs even for authenticated users.
REVOKE ALL ON FUNCTION public.validate_team_responsibilities(),public.prepare_draft_finding_insert(),public.assert_complete_plor(public.findings),public.add_finding_notification(uuid,text,text,text,uuid),public.protect_finding_update(),public.protect_notification_update(),public.reject_immutable_workflow_rows(),public.guard_identity_execution_mutation(),public.guard_identity_execution_insert(),public.require_auditor_execution_transition() FROM authenticated;
REVOKE ALL ON FUNCTION public.finding_source_context(text,uuid),public.sync_checklist_finding(text,uuid,text),public.sync_system_finding(),public.sync_product_finding(),public.sync_manufacturing_finding() FROM authenticated;

-- Caller-bound identity/RLS helpers required by authenticated policies.
GRANT EXECUTE ON FUNCTION public.current_identity_type(),public.is_admin_identity(),public.current_auditor_id(),public.current_auditor_belongs_to_team(uuid),public.current_auditor_is_peer(uuid),public.auditor_can_access_instruction_row(uuid),public.manager_can_access_instruction_row(uuid),public.identity_can_access_proses(uuid),public.identity_can_access_seksi(uuid),public.manager_can_access_team(uuid),public.manager_can_access_auditor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.product_evidence_checklist_id(text),public.product_evidence_phase_matches(text) TO authenticated;

-- Active browser RPC allowlist.
GRANT EXECUTE ON FUNCTION public.next_qa_audit_code(),public.generate_instruction_from_program(uuid,integer),public.save_audit_team_master(uuid,uuid,text,text,text,text,jsonb),public.lock_audit_team_master(uuid),public.unlock_audit_team_master(uuid),public.assign_team_to_instruction_row(uuid,uuid,text),public.save_instruction_row_with_team(uuid,uuid,text,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_audit_agenda_from_row(uuid),public.finalize_audit_agenda(uuid),public.return_audit_agenda_to_draft(uuid),public.reorder_audit_agenda_items(uuid,uuid[]),public.validate_audit_agenda_creation_context(uuid),public.save_audit_agenda_draft(uuid,date,text,text,text,text,jsonb,text,jsonb),public.create_manufacturing_checklist_from_row(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_execution_blockers(uuid),public.complete_audit_execution(uuid),public.reopen_audit_execution(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_auditor_is_team_leader(uuid),public.current_auditor_is_lead_auditor(uuid),public.finding_transition(uuid,text,text,text),public.add_finding_team_response(uuid,text),public.finding_capabilities(uuid),public.save_finding_plor(uuid,integer,text,text,text,text,text,text,uuid,text,date,text) TO authenticated;
