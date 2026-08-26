-- Batch 7a: read-only LTP foundation. Historical CAR identifiers remain internal compatibility names.

CREATE TABLE public.cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL UNIQUE REFERENCES public.findings(id) ON DELETE RESTRICT,
  kode_car text NOT NULL UNIQUE,
  seksi_auditee_id uuid REFERENCES public.seksi(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'AUDITEE_DRAFT' CHECK (status IN (
    'AUDITEE_DRAFT','MANAGER_REVIEW','AUDITEE_RETURNED','AUDITOR_REVIEW',
    'AUDITOR_RETURNED','ADMIN_REVIEW','CLOSED'
  )),
  dampak_temuan text,
  manfaat_perbaikan text,
  auditor_verification_result text CHECK (auditor_verification_result IS NULL OR auditor_verification_result IN ('OPEN','CLOSE')),
  revision_version integer NOT NULL DEFAULT 1 CHECK (revision_version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.car_why_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
  level integer NOT NULL CHECK (level > 0),
  teks text NOT NULL CHECK (btrim(teks) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (car_id, level)
);

CREATE TABLE public.car_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
  action_type text NOT NULL CHECK (action_type IN ('TEMPORARY','CORRECTIVE','PREVENTIVE')),
  description text NOT NULL CHECK (btrim(description) <> ''),
  pic text,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (car_id, action_type)
);

CREATE TABLE public.car_action_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id uuid NOT NULL REFERENCES public.car_actions(id) ON DELETE RESTRICT,
  evidence_state text NOT NULL CHECK (evidence_state IN ('BEFORE','AFTER','BEFORE_AFTER')),
  file_name text NOT NULL CHECK (btrim(file_name) <> ''),
  path text NOT NULL CHECK (btrim(path) <> ''),
  mime_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.car_system_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
  kategori text NOT NULL CHECK (kategori IN ('Peraturan ISE','Dokumen Standard','Dokumen Lainnya')),
  nama_dokumen text NOT NULL CHECK (btrim(nama_dokumen) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.car_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id uuid NOT NULL REFERENCES public.cars(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (btrim(event_type) <> ''),
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_identity_type text NOT NULL CHECK (actor_identity_type IN ('ADMIN','AUDITOR','AUDITEE','SECTION_MANAGER')),
  comment text,
  from_status text,
  to_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cars_seksi_auditee ON public.cars(seksi_auditee_id);
CREATE INDEX idx_car_why_analysis_car ON public.car_why_analysis(car_id);
CREATE INDEX idx_car_actions_car ON public.car_actions(car_id);
CREATE INDEX idx_car_action_evidence_action ON public.car_action_evidence(action_id);
CREATE INDEX idx_car_system_revisions_car ON public.car_system_revisions(car_id);
CREATE INDEX idx_car_workflow_events_car ON public.car_workflow_events(car_id,created_at);

CREATE TRIGGER set_cars_updated_at BEFORE UPDATE ON public.cars FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_car_why_analysis_updated_at BEFORE UPDATE ON public.car_why_analysis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_car_actions_updated_at BEFORE UPDATE ON public.car_actions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_immutable_car_workflow_events BEFORE UPDATE OR DELETE ON public.car_workflow_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_workflow_rows();

CREATE FUNCTION public.car_accessible_to_current_identity(p_car_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cars c
    JOIN public.findings f ON f.id=c.finding_id
    WHERE c.id=p_car_id AND (
      public.is_admin_identity()
      OR public.current_auditor_is_lead_auditor()
      OR (public.current_identity_type()='AUDITOR' AND public.auditor_can_access_instruction_row(f.instruction_row_id))
      OR (public.current_identity_type()='AUDITEE' AND EXISTS (
        SELECT 1 FROM public.section_identity_assignments a
        WHERE a.user_id=auth.uid() AND a.seksi_id=c.seksi_auditee_id
          AND a.assignment_type='AUDIT_PIC' AND a.status='Aktif'
      ))
      OR (public.current_identity_type()='SECTION_MANAGER' AND EXISTS (
        SELECT 1 FROM public.section_identity_assignments a
        WHERE a.user_id=auth.uid() AND a.seksi_id=c.seksi_auditee_id
          AND a.assignment_type='SECTION_MANAGER' AND a.status='Aktif'
      ))
    )
  )
$$;

CREATE FUNCTION public.ltp_finding_has_complete_plor(p_f public.findings) RETURNS boolean
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public AS $$
BEGIN
  PERFORM public.assert_complete_plor(p_f);
  RETURN true;
EXCEPTION WHEN raise_exception THEN
  RETURN false;
END $$;

CREATE FUNCTION public.create_ltp_for_eligible_finding() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_target_count integer; v_target_id uuid;
BEGIN
  IF NEW.review_status NOT IN ('PUBLISHED','LEGACY_ESTABLISHED') OR NEW.kode_temuan IS NULL
    OR NOT public.ltp_finding_has_complete_plor(NEW) THEN RETURN NEW; END IF;

  SELECT count(DISTINCT s.id), (array_agg(DISTINCT s.id))[1]
    INTO v_target_count,v_target_id
  FROM public.audit_instruction_rows r
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]'::jsonb)) mark
  JOIN public.seksi s ON mark->>'seksi_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND s.id=(mark->>'seksi_id')::uuid
  WHERE r.id=NEW.instruction_row_id AND mark->>'tipe'='target';

  INSERT INTO public.cars(finding_id,kode_car,seksi_auditee_id)
  VALUES(NEW.id,NEW.kode_temuan,CASE WHEN v_target_count=1 THEN v_target_id END)
  ON CONFLICT (finding_id) DO NOTHING;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_create_ltp_for_eligible_finding
AFTER INSERT OR UPDATE OF review_status,problem,location,objective_evidence,reference,saran_perbaikan,kode_temuan
ON public.findings FOR EACH ROW EXECUTE FUNCTION public.create_ltp_for_eligible_finding();

-- Generic backfill through the same eligibility and PLOR semantics as the trigger.
DO $$ DECLARE f public.findings%ROWTYPE; v_target_count integer; v_target_id uuid; BEGIN
  FOR f IN SELECT f0.* FROM public.findings f0
    WHERE f0.review_status IN ('PUBLISHED','LEGACY_ESTABLISHED') AND f0.kode_temuan IS NOT NULL
      AND public.ltp_finding_has_complete_plor(f0)
  LOOP
    PERFORM public.assert_complete_plor(f);
    SELECT count(DISTINCT s.id),(array_agg(DISTINCT s.id))[1] INTO v_target_count,v_target_id
    FROM public.audit_instruction_rows r
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]'::jsonb)) mark
    JOIN public.seksi s ON mark->>'seksi_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND s.id=(mark->>'seksi_id')::uuid
    WHERE r.id=f.instruction_row_id AND mark->>'tipe'='target';
    INSERT INTO public.cars(finding_id,kode_car,seksi_auditee_id)
    VALUES(f.id,f.kode_temuan,CASE WHEN v_target_count=1 THEN v_target_id END)
    ON CONFLICT (finding_id) DO NOTHING;
  END LOOP;
END $$;

CREATE FUNCTION public.list_ltp_worklist()
RETURNS TABLE(car_id uuid,finding_id uuid,kode_ltp text,kode_audit text,kategori text,status text,seksi_auditee_id uuid,seksi_nama text,proses_nama text,tanggal_temuan date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT c.id,c.finding_id,c.kode_car,f.kode_audit,f.kategori,c.status,c.seksi_auditee_id,s.nama,p.nama_proses,f.tanggal_temuan
  FROM public.cars c JOIN public.findings f ON f.id=c.finding_id
  JOIN public.audit_instruction_rows r ON r.id=f.instruction_row_id
  LEFT JOIN public.seksi s ON s.id=c.seksi_auditee_id
  LEFT JOIN public.proses p ON p.id=r.proses_id
  WHERE public.car_accessible_to_current_identity(c.id)
  ORDER BY f.tanggal_temuan DESC,c.kode_car
$$;

CREATE FUNCTION public.get_ltp_context(p_car_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT jsonb_build_object(
    'ltp',jsonb_build_object('id',c.id,'finding_id',c.finding_id,'kode_ltp',c.kode_car,'status',c.status,'seksi_auditee_id',c.seksi_auditee_id,'revision_version',c.revision_version,'created_at',c.created_at),
    'finding',jsonb_build_object('kode_audit',f.kode_audit,'kode_temuan',f.kode_temuan,'kategori',f.kategori,'problem',f.problem,'location',f.location,'objective_evidence',f.objective_evidence,'reference',f.reference,'saran_perbaikan',f.saran_perbaikan,'auditee_area',f.auditee_area,'tanggal_temuan',f.tanggal_temuan),
    'section',CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id',s.id,'nama',s.nama,'kepala_seksi',s.kepala_seksi) END,
    'process',CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id',p.id,'nama',p.nama_proses) END,
    'team',CASE WHEN t.id IS NULL THEN NULL ELSE jsonb_build_object('id',t.id,'kode',t.kode_tim,'nama',t.nama_tim) END,
    'team_leader',CASE WHEN lead.id IS NULL THEN NULL ELSE jsonb_build_object('id',lead.id,'nama',lead.nama) END
  )
  FROM public.cars c JOIN public.findings f ON f.id=c.finding_id
  JOIN public.audit_instruction_rows r ON r.id=f.instruction_row_id
  LEFT JOIN public.seksi s ON s.id=c.seksi_auditee_id
  LEFT JOIN public.proses p ON p.id=r.proses_id
  LEFT JOIN public.audit_team_masters t ON t.id=r.team_master_id
  LEFT JOIN public.audit_team_master_members lm ON lm.team_id=t.id AND lm.is_team_leader
  LEFT JOIN public.auditors lead ON lead.id=lm.auditor_id
  WHERE c.id=p_car_id AND public.car_accessible_to_current_identity(c.id)
$$;

ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_why_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_action_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_system_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_workflow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY cars_authorized_select ON public.cars FOR SELECT TO authenticated USING(public.car_accessible_to_current_identity(id));
CREATE POLICY car_why_authorized_select ON public.car_why_analysis FOR SELECT TO authenticated USING(public.car_accessible_to_current_identity(car_id));
CREATE POLICY car_actions_authorized_select ON public.car_actions FOR SELECT TO authenticated USING(public.car_accessible_to_current_identity(car_id));
CREATE POLICY car_evidence_authorized_select ON public.car_action_evidence FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.car_actions a WHERE a.id=action_id AND public.car_accessible_to_current_identity(a.car_id)));
CREATE POLICY car_revisions_authorized_select ON public.car_system_revisions FOR SELECT TO authenticated USING(public.car_accessible_to_current_identity(car_id));
CREATE POLICY car_events_authorized_select ON public.car_workflow_events FOR SELECT TO authenticated USING(public.car_accessible_to_current_identity(car_id));

REVOKE ALL ON public.cars,public.car_why_analysis,public.car_actions,public.car_action_evidence,public.car_system_revisions,public.car_workflow_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cars,public.car_why_analysis,public.car_actions,public.car_action_evidence,public.car_system_revisions,public.car_workflow_events TO authenticated;
REVOKE ALL ON FUNCTION public.car_accessible_to_current_identity(uuid),public.ltp_finding_has_complete_plor(public.findings),public.create_ltp_for_eligible_finding(),public.list_ltp_worklist(),public.get_ltp_context(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ltp_finding_has_complete_plor(public.findings),public.create_ltp_for_eligible_finding() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.car_accessible_to_current_identity(uuid),public.list_ltp_worklist(),public.get_ltp_context(uuid) TO authenticated;
