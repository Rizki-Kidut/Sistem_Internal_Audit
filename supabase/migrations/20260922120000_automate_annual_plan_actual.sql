-- FORM-001 Actual is a materialized effective value: Admin override wins, otherwise
-- it is reconciled from completed executions and established Findings.

ALTER TABLE public.audit_plan_schedule
  ADD COLUMN aktual_auto boolean NOT NULL DEFAULT false,
  ADD COLUMN aktual_override boolean,
  ADD COLUMN aktual_override_reason text,
  ADD COLUMN aktual_override_actor uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN aktual_override_at timestamptz;

ALTER TABLE public.audit_plan_schedule ADD CONSTRAINT audit_plan_schedule_override_complete CHECK (
  (aktual_override IS NULL AND aktual_override_reason IS NULL AND aktual_override_actor IS NULL AND aktual_override_at IS NULL)
  OR
  (aktual_override IS NOT NULL AND aktual_override_reason IS NOT NULL AND aktual_override_at IS NOT NULL)
);

CREATE TABLE public.audit_plan_actual_override_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.audit_plan_schedule(id) ON DELETE RESTRICT,
  process_id uuid NOT NULL REFERENCES public.audit_plan_process(id) ON DELETE RESTRICT,
  bulan integer NOT NULL CHECK (bulan BETWEEN 1 AND 12),
  previous_effective_value boolean NOT NULL,
  new_override_value boolean,
  resulting_effective_value boolean NOT NULL,
  action text NOT NULL CHECK (action IN ('SET_TRUE','SET_FALSE','RETURN_TO_AUTO','LEGACY_PRESERVED')),
  reason text,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (action='LEGACY_PRESERVED' OR actor_user_id IS NOT NULL),
  CHECK (action NOT IN ('SET_TRUE','SET_FALSE') OR length(btrim(COALESCE(reason,'')))>0),
  CHECK ((action='SET_TRUE' AND new_override_value=true) OR (action='SET_FALSE' AND new_override_value=false)
    OR (action IN ('RETURN_TO_AUTO','LEGACY_PRESERVED') AND (new_override_value IS NULL OR action='LEGACY_PRESERVED')))
);
CREATE INDEX audit_plan_actual_override_events_schedule_idx
  ON public.audit_plan_actual_override_events(schedule_id,created_at);
ALTER TABLE public.audit_plan_actual_override_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_plan_actual_override_events_admin_select
  ON public.audit_plan_actual_override_events FOR SELECT TO authenticated
  USING(public.is_admin_identity());

CREATE FUNCTION public.reject_annual_actual_event_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN RAISE EXCEPTION 'Riwayat Override Aktual bersifat append-only.';END $$;
CREATE TRIGGER trg_reject_annual_actual_event_mutation BEFORE UPDATE OR DELETE
ON public.audit_plan_actual_override_events FOR EACH ROW EXECUTE FUNCTION public.reject_annual_actual_event_mutation();

CREATE FUNCTION public.annual_actual_checklist_complete(p_row public.audit_instruction_rows)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF p_row.tipe_baris='Reguler' THEN
    RETURN EXISTS(SELECT 1 FROM public.checklists c WHERE c.row_id=p_row.id)
      AND EXISTS(SELECT 1 FROM public.checklist_items i JOIN public.checklists c ON c.id=i.checklist_id WHERE c.row_id=p_row.id)
      AND NOT EXISTS(SELECT 1 FROM public.checklist_items i JOIN public.checklists c ON c.id=i.checklist_id WHERE c.row_id=p_row.id
        AND (i.hasil IS NULL OR (i.hasil IN('A','B','C') AND i.finding_id IS NULL)));
  ELSIF p_row.tipe_baris='AuditProduk' THEN
    RETURN EXISTS(SELECT 1 FROM public.checklist_produk c WHERE c.row_id=p_row.id)
      AND NOT EXISTS(SELECT 1 FROM public.checklist_produk c WHERE c.row_id=p_row.id AND c.status<>'Selesai')
      AND EXISTS(SELECT 1 FROM public.checklist_produk_items i JOIN public.checklist_produk_fase f ON f.id=i.fase_id JOIN public.checklist_produk c ON c.id=f.checklist_produk_id WHERE c.row_id=p_row.id)
      AND NOT EXISTS(SELECT 1 FROM public.checklist_produk_items i JOIN public.checklist_produk_fase f ON f.id=i.fase_id JOIN public.checklist_produk c ON c.id=f.checklist_produk_id WHERE c.row_id=p_row.id
        AND (i.judgment IS NULL OR (i.judgment='NG' AND (i.finding_kategori IS NULL OR i.finding_id IS NULL))));
  ELSE
    RETURN EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift c WHERE c.row_id=p_row.id)
      AND NOT EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift c WHERE c.row_id=p_row.id AND c.status<>'Selesai')
      AND EXISTS(SELECT 1 FROM public.checklist_manufaktur_items i JOIN public.checklist_manufaktur_shift c ON c.id=i.checklist_id WHERE c.row_id=p_row.id)
      AND NOT EXISTS(SELECT 1 FROM public.checklist_manufaktur_items i JOIN public.checklist_manufaktur_shift c ON c.id=i.checklist_id WHERE c.row_id=p_row.id
        AND (i.hasil IS NULL OR (i.hasil IN('A','B','C') AND i.finding_id IS NULL)));
  END IF;
END $$;

CREATE FUNCTION public.annual_actual_plan_process(p_instruction_id uuid,p_process_master_id uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_id uuid;v_count integer;
BEGIN
  SELECT count(*),(array_agg(app.id))[1] INTO v_count,v_id
  FROM public.audit_instructions ai
  JOIN public.audit_programs ap ON ap.id=ai.program_id
  JOIN public.audit_plan_process app ON app.plan_id=ap.plan_id AND app.proses_master_id=p_process_master_id
  WHERE ai.id=p_instruction_id;
  IF v_count<>1 THEN RAISE EXCEPTION 'Annual Plan Process tidak dapat diresolusikan secara unik untuk Instruksi %, Proses %.',p_instruction_id,p_process_master_id;END IF;
  RETURN v_id;
END $$;

CREATE FUNCTION public.reconcile_annual_plan_actual(p_process_id uuid,p_bulan integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_auto boolean;v_effective boolean;v_previous_guard text;v_schedule public.audit_plan_schedule%ROWTYPE;
BEGIN
  IF p_bulan NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Bulan Actual harus 1 sampai 12.';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_plan_process WHERE id=p_process_id) THEN RAISE EXCEPTION 'Annual Plan Process tidak ditemukan.';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_process_id::text||':'||p_bulan::text,0));
  SELECT EXISTS(
    SELECT 1 FROM public.audit_instruction_rows ir
    JOIN public.audit_instructions ai ON ai.id=ir.instruction_id
    JOIN public.audit_programs ap ON ap.id=ai.program_id
    JOIN public.audit_plan_process app ON app.plan_id=ap.plan_id AND app.proses_master_id=ir.proses_id
    CROSS JOIN LATERAL (SELECT CASE WHEN ir.tipe_baris='AuditProduk' THEN COALESCE(ir.tanggal_audit_produk,ir.tanggal_pelaksanaan_audit) ELSE ir.tanggal_pelaksanaan_audit END AS execution_date) d
    WHERE app.id=p_process_id AND ir.cek_selesai AND d.execution_date IS NOT NULL
      AND extract(month FROM d.execution_date)::integer=p_bulan
      AND public.annual_actual_checklist_complete(ir)
      AND NOT EXISTS(SELECT 1 FROM public.findings f WHERE f.instruction_row_id=ir.id
        AND f.source_type=CASE WHEN ir.tipe_baris='Reguler' THEN 'ChecklistSistem' WHEN ir.tipe_baris='AuditProduk' THEN 'ChecklistProduk' ELSE 'ChecklistManufakturShift' END
        AND f.review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED','ANNULLED'))
  ) INTO v_auto;
  v_previous_guard:=COALESCE(current_setting('certitrack.annual_actual_write',true),'');
  PERFORM set_config('certitrack.annual_actual_write','1',true);
  SELECT * INTO v_schedule FROM public.audit_plan_schedule WHERE process_id=p_process_id AND bulan=p_bulan FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.audit_plan_schedule(process_id,bulan,plan,aktual,aktual_auto)
    VALUES(p_process_id,p_bulan,false,v_auto,v_auto) RETURNING * INTO v_schedule;
  END IF;
  v_effective:=COALESCE(v_schedule.aktual_override,v_auto);
  UPDATE public.audit_plan_schedule SET aktual_auto=v_auto,aktual=v_effective WHERE id=v_schedule.id;
  PERFORM set_config('certitrack.annual_actual_write',v_previous_guard,true);
  RETURN v_effective;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('certitrack.annual_actual_write',COALESCE(v_previous_guard,''),true);RAISE;
END $$;

CREATE FUNCTION public.reconcile_annual_plan_actual_for_row(p_row_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE r public.audit_instruction_rows%ROWTYPE;v_process uuid;v_date date;
BEGIN
  SELECT * INTO r FROM public.audit_instruction_rows WHERE id=p_row_id;
  IF NOT FOUND THEN RETURN;END IF;
  v_date:=CASE WHEN r.tipe_baris='AuditProduk' THEN COALESCE(r.tanggal_audit_produk,r.tanggal_pelaksanaan_audit) ELSE r.tanggal_pelaksanaan_audit END;
  IF v_date IS NULL THEN RETURN;END IF;
  v_process:=public.annual_actual_plan_process(r.instruction_id,r.proses_id);
  PERFORM public.reconcile_annual_plan_actual(v_process,extract(month FROM v_date)::integer);
END $$;

CREATE FUNCTION public.trigger_reconcile_annual_actual_row() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_old_process uuid;v_new_process uuid;v_old_date date;v_new_date date;
BEGIN
  v_old_date:=CASE WHEN OLD.tipe_baris='AuditProduk' THEN COALESCE(OLD.tanggal_audit_produk,OLD.tanggal_pelaksanaan_audit) ELSE OLD.tanggal_pelaksanaan_audit END;
  v_new_date:=CASE WHEN NEW.tipe_baris='AuditProduk' THEN COALESCE(NEW.tanggal_audit_produk,NEW.tanggal_pelaksanaan_audit) ELSE NEW.tanggal_pelaksanaan_audit END;
  IF v_old_date IS NOT NULL THEN v_old_process:=public.annual_actual_plan_process(OLD.instruction_id,OLD.proses_id);END IF;
  IF v_new_date IS NOT NULL THEN v_new_process:=public.annual_actual_plan_process(NEW.instruction_id,NEW.proses_id);END IF;
  IF v_old_process IS NOT NULL THEN PERFORM public.reconcile_annual_plan_actual(v_old_process,extract(month FROM v_old_date)::integer);END IF;
  IF v_new_process IS NOT NULL AND (v_new_process,v_new_date) IS DISTINCT FROM (v_old_process,v_old_date) THEN
    PERFORM public.reconcile_annual_plan_actual(v_new_process,extract(month FROM v_new_date)::integer);
  ELSIF v_new_process IS NOT NULL AND NEW.cek_selesai IS DISTINCT FROM OLD.cek_selesai THEN
    PERFORM public.reconcile_annual_plan_actual(v_new_process,extract(month FROM v_new_date)::integer);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_reconcile_annual_actual_row AFTER UPDATE OF cek_selesai,tanggal_pelaksanaan_audit,tanggal_audit_produk,proses_id,instruction_id
ON public.audit_instruction_rows FOR EACH ROW EXECUTE FUNCTION public.trigger_reconcile_annual_actual_row();

CREATE FUNCTION public.trigger_reconcile_annual_actual_finding() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN PERFORM public.reconcile_annual_plan_actual_for_row(OLD.instruction_row_id);END IF;
  IF TG_OP<>'DELETE' AND (TG_OP='INSERT' OR NEW.instruction_row_id IS DISTINCT FROM OLD.instruction_row_id OR NEW.review_status IS DISTINCT FROM OLD.review_status) THEN
    PERFORM public.reconcile_annual_plan_actual_for_row(NEW.instruction_row_id);
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER trg_reconcile_annual_actual_finding AFTER INSERT OR DELETE OR UPDATE OF review_status,instruction_row_id
ON public.findings FOR EACH ROW EXECUTE FUNCTION public.trigger_reconcile_annual_actual_finding();

CREATE FUNCTION public.protect_annual_actual_materialization() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
  IF COALESCE(current_setting('certitrack.annual_actual_write',true),'')<>'1' THEN
    IF TG_OP='INSERT' AND (NEW.aktual OR NEW.aktual_auto OR NEW.aktual_override IS NOT NULL) THEN RAISE EXCEPTION 'Aktual dikelola otomatis atau melalui Override Aktual Admin.';END IF;
    IF TG_OP='UPDATE' AND (NEW.aktual,NEW.aktual_auto,NEW.aktual_override,NEW.aktual_override_reason,NEW.aktual_override_actor,NEW.aktual_override_at)
      IS DISTINCT FROM (OLD.aktual,OLD.aktual_auto,OLD.aktual_override,OLD.aktual_override_reason,OLD.aktual_override_actor,OLD.aktual_override_at)
    THEN RAISE EXCEPTION 'Aktual dikelola otomatis atau melalui Override Aktual Admin.';END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_annual_actual_materialization BEFORE INSERT OR UPDATE ON public.audit_plan_schedule
FOR EACH ROW EXECUTE FUNCTION public.protect_annual_actual_materialization();

CREATE FUNCTION public.override_annual_plan_actual(p_process_id uuid,p_bulan integer,p_action text,p_reason text DEFAULT NULL)
RETURNS public.audit_plan_schedule LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.audit_plan_schedule%ROWTYPE;v_previous boolean;v_override boolean;v_event_action text;v_reason text:=NULLIF(btrim(COALESCE(p_reason,'')),'');v_guard text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_identity() THEN RAISE EXCEPTION 'Hanya Admin yang dapat melakukan Override Aktual.';END IF;
  IF p_bulan NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Bulan Actual harus 1 sampai 12.';END IF;
  IF p_action NOT IN('SET_TRUE','SET_FALSE','RETURN_TO_AUTO') THEN RAISE EXCEPTION 'Aksi Override Aktual tidak valid.';END IF;
  IF p_action IN('SET_TRUE','SET_FALSE') AND v_reason IS NULL THEN RAISE EXCEPTION 'Alasan Override Aktual wajib diisi.';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_process_id::text||':'||p_bulan::text,0));
  v_guard:=COALESCE(current_setting('certitrack.annual_actual_write',true),'');PERFORM set_config('certitrack.annual_actual_write','1',true);
  SELECT * INTO s FROM public.audit_plan_schedule WHERE process_id=p_process_id AND bulan=p_bulan FOR UPDATE;
  IF NOT FOUND THEN INSERT INTO public.audit_plan_schedule(process_id,bulan) VALUES(p_process_id,p_bulan) RETURNING * INTO s;END IF;
  v_previous:=s.aktual;v_event_action:=p_action;
  IF p_action='RETURN_TO_AUTO' THEN
    UPDATE public.audit_plan_schedule SET aktual_override=NULL,aktual_override_reason=NULL,aktual_override_actor=NULL,aktual_override_at=NULL WHERE id=s.id;
    PERFORM set_config('certitrack.annual_actual_write',v_guard,true);
    PERFORM public.reconcile_annual_plan_actual(p_process_id,p_bulan);
  ELSE
    v_override:=p_action='SET_TRUE';
    UPDATE public.audit_plan_schedule SET aktual=v_override,aktual_override=v_override,aktual_override_reason=v_reason,aktual_override_actor=auth.uid(),aktual_override_at=now() WHERE id=s.id;
    PERFORM set_config('certitrack.annual_actual_write',v_guard,true);
  END IF;
  SELECT * INTO s FROM public.audit_plan_schedule WHERE id=s.id;
  INSERT INTO public.audit_plan_actual_override_events(schedule_id,process_id,bulan,previous_effective_value,new_override_value,resulting_effective_value,action,reason,actor_user_id)
  VALUES(s.id,p_process_id,p_bulan,v_previous,CASE WHEN p_action='RETURN_TO_AUTO' THEN NULL ELSE v_override END,s.aktual,v_event_action,COALESCE(v_reason,CASE WHEN p_action='RETURN_TO_AUTO' THEN 'Kembali ke Otomatis' END),auth.uid());
  RETURN s;
EXCEPTION WHEN OTHERS THEN PERFORM set_config('certitrack.annual_actual_write',COALESCE(v_guard,''),true);RAISE;
END $$;

-- Conservative migration: preserve every historical TRUE as an explicit legacy override;
-- FALSE/default cells enter automatic mode and are reconciled from current authoritative evidence.
DO $$DECLARE s public.audit_plan_schedule%ROWTYPE;v_guard text:=COALESCE(current_setting('certitrack.annual_actual_write',true),'');BEGIN
  PERFORM set_config('certitrack.annual_actual_write','1',true);
  FOR s IN SELECT * FROM public.audit_plan_schedule WHERE aktual LOOP
    UPDATE public.audit_plan_schedule SET aktual_override=true,aktual_override_reason='Dipertahankan dari nilai Aktual historis saat migrasi otomatisasi FORM-001.',aktual_override_at=now() WHERE id=s.id;
    INSERT INTO public.audit_plan_actual_override_events(schedule_id,process_id,bulan,previous_effective_value,new_override_value,resulting_effective_value,action,reason)
    VALUES(s.id,s.process_id,s.bulan,true,true,true,'LEGACY_PRESERVED','Nilai Aktual historis dipertahankan; aktor asal tidak tersedia.');
  END LOOP;
  PERFORM set_config('certitrack.annual_actual_write',v_guard,true);
  FOR s IN SELECT * FROM public.audit_plan_schedule WHERE aktual_override IS NULL LOOP PERFORM public.reconcile_annual_plan_actual(s.process_id,s.bulan);END LOOP;
END $$;

REVOKE ALL ON TABLE public.audit_plan_actual_override_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.audit_plan_actual_override_events TO authenticated;
REVOKE ALL ON FUNCTION public.reject_annual_actual_event_mutation(),public.annual_actual_checklist_complete(public.audit_instruction_rows),public.annual_actual_plan_process(uuid,uuid),public.reconcile_annual_plan_actual(uuid,integer),public.reconcile_annual_plan_actual_for_row(uuid),public.trigger_reconcile_annual_actual_row(),public.trigger_reconcile_annual_actual_finding(),public.protect_annual_actual_materialization() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.override_annual_plan_actual(uuid,integer,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.override_annual_plan_actual(uuid,integer,text,text) TO authenticated;
