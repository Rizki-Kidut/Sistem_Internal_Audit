-- Batch 9b: controlled FORM-014 summary, one Audit Instruction + Audit Type.
CREATE FUNCTION public.can_manage_rangkuman_hasil_audit() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$ SELECT public.is_admin_identity() OR public.current_auditor_is_lead_auditor() $$;

CREATE TABLE public.rangkuman_hasil_audit_reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), audit_instruction_id uuid NOT NULL REFERENCES public.audit_instructions(id) ON DELETE RESTRICT,
 audit_type text NOT NULL CHECK(audit_type IN('ChecklistSistem','ChecklistManufakturShift','ChecklistProduk')),
 tahun_fiskal integer NOT NULL, status text NOT NULL DEFAULT 'Draft' CHECK(status IN('Draft','Final')),
 kode_dokumen text NOT NULL DEFAULT 'Q-120-ISE-001-FORM-014-REV.1' CHECK(kode_dokumen='Q-120-ISE-001-FORM-014-REV.1'), catatan text,
 created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, lead_auditor_id uuid REFERENCES public.auditors(id) ON DELETE RESTRICT,
 lead_auditor_name_snapshot text, pj_qms_snapshot text, audit_date_start date, audit_date_end date,
 revision_version integer NOT NULL DEFAULT 1 CHECK(revision_version>0), finalized_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(audit_instruction_id,audit_type)
);
CREATE TABLE public.rangkuman_hasil_audit_groups(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),report_id uuid NOT NULL REFERENCES public.rangkuman_hasil_audit_reports(id) ON DELETE CASCADE,
 group_key text NOT NULL,instruction_row_id uuid REFERENCES public.audit_instruction_rows(id) ON DELETE RESTRICT,
 group_sort_order integer NOT NULL,qa_code text NOT NULL,completed boolean NOT NULL,
 label_snapshot text,process_owner_snapshot text,related_sections_snapshot text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(report_id,group_key)
);
CREATE TABLE public.rangkuman_hasil_audit_group_rows(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid NOT NULL REFERENCES public.rangkuman_hasil_audit_groups(id) ON DELETE CASCADE,instruction_row_id uuid NOT NULL REFERENCES public.audit_instruction_rows(id) ON DELETE RESTRICT,UNIQUE(group_id,instruction_row_id));
CREATE TABLE public.rangkuman_hasil_audit_items(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),report_id uuid NOT NULL REFERENCES public.rangkuman_hasil_audit_reports(id) ON DELETE CASCADE,
 group_id uuid NOT NULL REFERENCES public.rangkuman_hasil_audit_groups(id) ON DELETE CASCADE,finding_id uuid NOT NULL REFERENCES public.findings(id) ON DELETE RESTRICT,
 finding_sort_order integer NOT NULL,keterangan text,
 kode_temuan_snapshot text,kategori_snapshot text,problem_snapshot text,location_snapshot text,objective_evidence_snapshot text,reference_snapshot text,saran_perbaikan_snapshot text,
 temporary_target_snapshot date,permanent_target_snapshot date,verification_date_snapshot timestamptz,car_status_snapshot text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(report_id,finding_id)
);
CREATE INDEX idx_form014_groups_report ON public.rangkuman_hasil_audit_groups(report_id,group_sort_order);
CREATE INDEX idx_form014_items_report ON public.rangkuman_hasil_audit_items(report_id,finding_sort_order);

CREATE FUNCTION public.form014_validate_context(p_row public.audit_instruction_rows,p_type text) RETURNS text LANGUAGE plpgsql STABLE
SET search_path=pg_catalog,public AS $$ DECLARE v_count integer;v_label text;BEGIN
 IF p_type='ChecklistSistem' THEN SELECT p.nama_proses INTO v_label FROM public.proses p WHERE p.id=p_row.proses_id;IF v_label IS NULL THEN RAISE EXCEPTION 'QA % tidak memiliki Proses Sistem yang valid.',p_row.kode_audit;END IF;
 ELSIF p_type='ChecklistManufakturShift' THEN
  SELECT count(*),min('Audit Manufaktur '||s.nama||' '||p.nama) INTO v_count,v_label FROM(SELECT DISTINCT public.safe_uuid(x->>'plant_id') plant_id,public.safe_uuid(x->>'shift_id') shift_id FROM jsonb_array_elements(p_row.matriks_manufaktur_shift_marks)x)m JOIN public.plants p ON p.id=m.plant_id JOIN public.shifts s ON s.id=m.shift_id;
  IF v_count<>1 THEN RAISE EXCEPTION 'QA % memiliki konteks Plant/Shift tidak valid. FORM-014 memerlukan satu QA Manufaktur = satu Plant + satu Shift.',p_row.kode_audit;END IF;
 ELSE
  SELECT count(*),min('Audit Produk '||p.nama) INTO v_count,v_label FROM(SELECT DISTINCT public.safe_uuid(x->>'plant_id') plant_id FROM jsonb_array_elements(p_row.matriks_produk_marks)x)m JOIN public.plants p ON p.id=m.plant_id;
  IF v_count<>1 THEN RAISE EXCEPTION 'QA % memiliki konteks Plant tidak valid. FORM-014 memerlukan satu QA Produk = satu Plant.',p_row.kode_audit;END IF;
 END IF;RETURN v_label;END $$;

CREATE FUNCTION public.form014_refresh_population(p_report_id uuid) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rangkuman_hasil_audit_reports%ROWTYPE;v_row public.audit_instruction_rows%ROWTYPE;v_group uuid;v_label text;v_old jsonb;v_count integer:=0;BEGIN
 IF auth.uid() IS NULL OR NOT public.can_manage_rangkuman_hasil_audit() THEN RAISE EXCEPTION 'Anda tidak berwenang mengelola FORM-014.';END IF;
 SELECT * INTO r FROM public.rangkuman_hasil_audit_reports WHERE id=p_report_id FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'FORM-014 tidak ditemukan.';END IF;IF r.status<>'Draft' THEN RAISE EXCEPTION 'FORM-014 Final tidak dapat diregenerasi.';END IF;
 SELECT COALESCE(jsonb_object_agg(finding_id::text,keterangan),'{}') INTO v_old FROM public.rangkuman_hasil_audit_items WHERE report_id=r.id;
 DELETE FROM public.rangkuman_hasil_audit_groups WHERE report_id=r.id;
 FOR v_row IN SELECT ir.* FROM public.audit_instruction_rows ir WHERE ir.instruction_id=r.audit_instruction_id AND CASE r.audit_type WHEN 'ChecklistSistem' THEN EXISTS(SELECT 1 FROM public.checklists c WHERE c.row_id=ir.id) WHEN 'ChecklistManufakturShift' THEN EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift c WHERE c.row_id=ir.id) ELSE EXISTS(SELECT 1 FROM public.checklist_produk c WHERE c.row_id=ir.id) END ORDER BY ir.urutan_tampil,ir.kode_audit,ir.id LOOP
  v_label:=public.form014_validate_context(v_row,r.audit_type);
  INSERT INTO public.rangkuman_hasil_audit_groups(report_id,group_key,instruction_row_id,group_sort_order,qa_code,completed,label_snapshot)
  VALUES(r.id,CASE WHEN r.audit_type='ChecklistSistem' THEN 'SYSTEM:'||v_row.proses_id::text ELSE r.audit_type||':'||v_row.id::text END,CASE WHEN r.audit_type='ChecklistSistem' THEN NULL ELSE v_row.id END,v_row.urutan_tampil,v_row.kode_audit,v_row.cek_selesai,v_label)
  ON CONFLICT(report_id,group_key) DO UPDATE SET completed=rangkuman_hasil_audit_groups.completed AND excluded.completed,group_sort_order=least(rangkuman_hasil_audit_groups.group_sort_order,excluded.group_sort_order) RETURNING id INTO v_group;
  INSERT INTO public.rangkuman_hasil_audit_group_rows(group_id,instruction_row_id)VALUES(v_group,v_row.id);
  INSERT INTO public.rangkuman_hasil_audit_items(report_id,group_id,finding_id,finding_sort_order,keterangan)
  SELECT r.id,v_group,f.id,row_number()over(order by f.nomor_urut_temuan,f.id),v_old->>f.id::text FROM public.findings f WHERE f.instruction_row_id=v_row.id AND f.source_type=r.audit_type AND f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED');GET DIAGNOSTICS v_count=ROW_COUNT;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM public.rangkuman_hasil_audit_groups WHERE report_id=r.id) THEN RAISE EXCEPTION 'Tidak ada konteks audit yang terwakili untuk jenis audit ini.';END IF;
 SELECT min(CASE WHEN r.audit_type='ChecklistProduk' THEN COALESCE(ir.tanggal_audit_produk,ir.tanggal_pelaksanaan_audit) ELSE ir.tanggal_pelaksanaan_audit END),max(CASE WHEN r.audit_type='ChecklistProduk' THEN COALESCE(ir.tanggal_audit_produk,ir.tanggal_pelaksanaan_audit) ELSE ir.tanggal_pelaksanaan_audit END) INTO r.audit_date_start,r.audit_date_end FROM public.rangkuman_hasil_audit_groups g JOIN public.rangkuman_hasil_audit_group_rows gr ON gr.group_id=g.id JOIN public.audit_instruction_rows ir ON ir.id=gr.instruction_row_id WHERE g.report_id=r.id;
 UPDATE public.rangkuman_hasil_audit_reports SET audit_date_start=r.audit_date_start,audit_date_end=r.audit_date_end,revision_version=revision_version+1,updated_at=now() WHERE id=r.id RETURNING revision_version INTO v_count;RETURN v_count;
END $$;

CREATE FUNCTION public.create_rangkuman_hasil_audit(p_instruction_id uuid,p_audit_type text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid;v_year integer;BEGIN IF auth.uid() IS NULL OR NOT public.can_manage_rangkuman_hasil_audit() THEN RAISE EXCEPTION 'Anda tidak berwenang mengelola FORM-014.';END IF;
 IF p_audit_type NOT IN('ChecklistSistem','ChecklistManufakturShift','ChecklistProduk') THEN RAISE EXCEPTION 'Jenis audit FORM-014 tidak valid.';END IF;
 SELECT tahun_fiskal INTO v_year FROM public.audit_instructions WHERE id=p_instruction_id;IF NOT FOUND THEN RAISE EXCEPTION 'Instruksi Audit tidak ditemukan.';END IF;
 INSERT INTO public.rangkuman_hasil_audit_reports(audit_instruction_id,audit_type,tahun_fiskal,created_by_user_id)VALUES(p_instruction_id,p_audit_type,v_year,auth.uid())RETURNING id INTO v_id;PERFORM public.form014_refresh_population(v_id);RETURN v_id;END $$;

CREATE FUNCTION public.save_rangkuman_hasil_audit_draft(p_report_id uuid,p_expected_revision integer,p_catatan text,p_keterangan jsonb) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rangkuman_hasil_audit_reports%ROWTYPE;v integer;BEGIN IF auth.uid() IS NULL OR NOT public.can_manage_rangkuman_hasil_audit() THEN RAISE EXCEPTION 'Anda tidak berwenang mengelola FORM-014.';END IF;SELECT * INTO r FROM public.rangkuman_hasil_audit_reports WHERE id=p_report_id FOR UPDATE;IF r.status<>'Draft' THEN RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';END IF;IF r.revision_version<>p_expected_revision THEN RAISE EXCEPTION 'FORM014_STALE_REVISION';END IF;
 UPDATE public.rangkuman_hasil_audit_items i SET keterangan=NULLIF(btrim(e.value),'') FROM jsonb_each_text(COALESCE(p_keterangan,'{}'))e WHERE i.report_id=r.id AND i.finding_id::text=e.key;
 UPDATE public.rangkuman_hasil_audit_reports SET catatan=NULLIF(btrim(p_catatan),''),revision_version=revision_version+1,updated_at=now()WHERE id=r.id RETURNING revision_version INTO v;RETURN v;END $$;

CREATE FUNCTION public.finalize_rangkuman_hasil_audit(p_report_id uuid,p_expected_revision integer) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.rangkuman_hasil_audit_reports%ROWTYPE;v_lead uuid;v_lead_name text;v_pj text;v integer;BEGIN IF auth.uid() IS NULL OR NOT public.can_manage_rangkuman_hasil_audit() THEN RAISE EXCEPTION 'Anda tidak berwenang mengelola FORM-014.';END IF;SELECT * INTO r FROM public.rangkuman_hasil_audit_reports WHERE id=p_report_id FOR UPDATE;IF r.status<>'Draft' THEN RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';END IF;IF r.revision_version<>p_expected_revision THEN RAISE EXCEPTION 'FORM014_STALE_REVISION';END IF;
 IF EXISTS(SELECT 1 FROM public.rangkuman_hasil_audit_groups WHERE report_id=r.id AND NOT completed)THEN RAISE EXCEPTION 'Semua QA/proses FORM-014 wajib selesai sebelum Final.';END IF;
 IF EXISTS((SELECT f.id FROM public.findings f JOIN public.rangkuman_hasil_audit_group_rows gr ON gr.instruction_row_id=f.instruction_row_id JOIN public.rangkuman_hasil_audit_groups g ON g.id=gr.group_id WHERE g.report_id=r.id AND f.source_type=r.audit_type AND f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED') EXCEPT SELECT finding_id FROM public.rangkuman_hasil_audit_items WHERE report_id=r.id) UNION ALL (SELECT finding_id FROM public.rangkuman_hasil_audit_items WHERE report_id=r.id EXCEPT SELECT f.id FROM public.findings f JOIN public.rangkuman_hasil_audit_group_rows gr ON gr.instruction_row_id=f.instruction_row_id JOIN public.rangkuman_hasil_audit_groups g ON g.id=gr.group_id WHERE g.report_id=r.id AND f.source_type=r.audit_type AND f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED')))THEN RAISE EXCEPTION 'Populasi Rangkuman berubah. Regenerate Populasi sebelum Final.';END IF;
 PERFORM public.form014_validate_context(ir,r.audit_type) FROM public.rangkuman_hasil_audit_group_rows gr JOIN public.rangkuman_hasil_audit_groups g ON g.id=gr.group_id JOIN public.audit_instruction_rows ir ON ir.id=gr.instruction_row_id WHERE g.report_id=r.id;
 SELECT a.id,a.nama INTO v_lead,v_lead_name FROM public.user_auditor_links l JOIN public.user_profiles u ON u.id=l.user_id JOIN public.auditors a ON a.id=l.auditor_id WHERE l.is_lead_auditor AND u.status='Aktif' AND a.status='Aktif';IF v_lead IS NULL THEN RAISE EXCEPTION 'Company Lead Auditor aktif wajib tersedia sebelum Final.';END IF;
 SELECT ap.penanggung_jawab_qms INTO v_pj FROM public.audit_instructions ai JOIN public.audit_programs pr ON pr.id=ai.program_id JOIN public.audit_plans ap ON ap.id=pr.plan_id WHERE ai.id=r.audit_instruction_id;IF COALESCE(btrim(v_pj),'')='' THEN RAISE EXCEPTION 'Penanggungjawab QMS Rencana Audit Tahunan wajib tersedia.';END IF;
 UPDATE public.rangkuman_hasil_audit_items i SET kode_temuan_snapshot=f.kode_temuan,kategori_snapshot=f.kategori,problem_snapshot=f.problem,location_snapshot=f.location,objective_evidence_snapshot=f.objective_evidence,reference_snapshot=f.reference,saran_perbaikan_snapshot=f.saran_perbaikan,temporary_target_snapshot=x.temp,permanent_target_snapshot=x.perm,verification_date_snapshot=x.verified,car_status_snapshot=COALESCE(x.status,'MISSING') FROM public.findings f LEFT JOIN LATERAL(SELECT c.status,max(a.due_date)FILTER(WHERE a.action_type='TEMPORARY')temp,max(a.due_date)FILTER(WHERE a.action_type IN('CORRECTIVE','PREVENTIVE'))perm,(SELECT max(e.created_at)FROM public.car_workflow_events e WHERE e.car_id=c.id AND e.event_type='AUDITOR_VERIFIED_CLOSE_TO_ADMIN')verified FROM public.cars c LEFT JOIN public.car_actions a ON a.car_id=c.id WHERE c.finding_id=f.id GROUP BY c.id)x ON true WHERE i.report_id=r.id AND i.finding_id=f.id;
 UPDATE public.rangkuman_hasil_audit_reports SET status='Final',lead_auditor_id=v_lead,lead_auditor_name_snapshot=v_lead_name,pj_qms_snapshot=v_pj,finalized_at=now(),revision_version=revision_version+1,updated_at=now()WHERE id=r.id RETURNING revision_version INTO v;RETURN v;END $$;

CREATE FUNCTION public.protect_form014_final() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$BEGIN IF TG_TABLE_NAME='rangkuman_hasil_audit_reports' AND OLD.status='Final' THEN RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';END IF;IF TG_TABLE_NAME IN('rangkuman_hasil_audit_groups','rangkuman_hasil_audit_items') AND EXISTS(SELECT 1 FROM public.rangkuman_hasil_audit_reports r WHERE r.id=OLD.report_id AND r.status='Final')THEN RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';END IF;IF TG_TABLE_NAME='rangkuman_hasil_audit_group_rows' AND EXISTS(SELECT 1 FROM public.rangkuman_hasil_audit_groups g JOIN public.rangkuman_hasil_audit_reports r ON r.id=g.report_id WHERE g.id=OLD.group_id AND r.status='Final')THEN RAISE EXCEPTION 'FORM-014 Final bersifat immutable.';END IF;RETURN COALESCE(NEW,OLD);END $$;
CREATE TRIGGER trg_form014_report_final BEFORE UPDATE OR DELETE ON public.rangkuman_hasil_audit_reports FOR EACH ROW EXECUTE FUNCTION public.protect_form014_final();
CREATE TRIGGER trg_form014_group_final BEFORE UPDATE OR DELETE ON public.rangkuman_hasil_audit_groups FOR EACH ROW EXECUTE FUNCTION public.protect_form014_final();
CREATE TRIGGER trg_form014_item_final BEFORE UPDATE OR DELETE ON public.rangkuman_hasil_audit_items FOR EACH ROW EXECUTE FUNCTION public.protect_form014_final();
CREATE TRIGGER trg_form014_group_row_final BEFORE UPDATE OR DELETE ON public.rangkuman_hasil_audit_group_rows FOR EACH ROW EXECUTE FUNCTION public.protect_form014_final();
ALTER TABLE public.rangkuman_hasil_audit_reports ENABLE ROW LEVEL SECURITY;ALTER TABLE public.rangkuman_hasil_audit_groups ENABLE ROW LEVEL SECURITY;ALTER TABLE public.rangkuman_hasil_audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rangkuman_hasil_audit_group_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY form014_reports_read ON public.rangkuman_hasil_audit_reports FOR SELECT TO authenticated USING(public.can_manage_rangkuman_hasil_audit());
CREATE POLICY form014_groups_read ON public.rangkuman_hasil_audit_groups FOR SELECT TO authenticated USING(public.can_manage_rangkuman_hasil_audit());
CREATE POLICY form014_items_read ON public.rangkuman_hasil_audit_items FOR SELECT TO authenticated USING(public.can_manage_rangkuman_hasil_audit());
CREATE POLICY form014_group_rows_read ON public.rangkuman_hasil_audit_group_rows FOR SELECT TO authenticated USING(public.can_manage_rangkuman_hasil_audit());
REVOKE ALL ON public.rangkuman_hasil_audit_reports,public.rangkuman_hasil_audit_groups,public.rangkuman_hasil_audit_group_rows,public.rangkuman_hasil_audit_items FROM anon,authenticated;GRANT SELECT ON public.rangkuman_hasil_audit_reports,public.rangkuman_hasil_audit_groups,public.rangkuman_hasil_audit_group_rows,public.rangkuman_hasil_audit_items TO authenticated;
REVOKE ALL ON FUNCTION public.can_manage_rangkuman_hasil_audit(),public.create_rangkuman_hasil_audit(uuid,text),public.form014_refresh_population(uuid),public.save_rangkuman_hasil_audit_draft(uuid,integer,text,jsonb),public.finalize_rangkuman_hasil_audit(uuid,integer) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.can_manage_rangkuman_hasil_audit(),public.create_rangkuman_hasil_audit(uuid,text),public.form014_refresh_population(uuid),public.save_rangkuman_hasil_audit_draft(uuid,integer,text,jsonb),public.finalize_rangkuman_hasil_audit(uuid,integer) TO authenticated;
