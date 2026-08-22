-- Batch 7.0: one authenticated account represents exactly one audit identity.
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (btrim(display_name) <> ''), nik text,
  identity_type text NOT NULL CHECK (identity_type IN ('ADMIN','AUDITOR','AUDITEE','SECTION_MANAGER')),
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Nonaktif')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_auditor_links (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  auditor_id uuid UNIQUE NOT NULL REFERENCES public.auditors(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.section_identity_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  seksi_id uuid NOT NULL REFERENCES public.seksi(id) ON DELETE RESTRICT,
  assignment_type text NOT NULL CHECK (assignment_type IN ('AUDIT_PIC','SECTION_MANAGER')),
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Nonaktif')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,seksi_id,assignment_type)
);
CREATE UNIQUE INDEX uq_active_section_assignment_type ON public.section_identity_assignments(seksi_id,assignment_type) WHERE status='Aktif';
CREATE INDEX idx_section_identity_user ON public.section_identity_assignments(user_id);

CREATE TRIGGER set_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_user_auditor_links_updated_at BEFORE UPDATE ON public.user_auditor_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER set_section_identity_updated_at BEFORE UPDATE ON public.section_identity_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION public.current_identity_type() RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$ SELECT identity_type FROM public.user_profiles WHERE id=auth.uid() AND status='Aktif' $$;
CREATE FUNCTION public.is_admin_identity() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$ SELECT COALESCE(public.current_identity_type()='ADMIN',false) $$;
CREATE FUNCTION public.current_auditor_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$ SELECT l.auditor_id FROM public.user_auditor_links l JOIN public.user_profiles p ON p.id=l.user_id WHERE l.user_id=auth.uid() AND p.status='Aktif' AND p.identity_type='AUDITOR' $$;
CREATE FUNCTION public.current_auditor_belongs_to_team(p_team_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$ SELECT EXISTS(SELECT 1 FROM public.audit_team_master_members m WHERE m.team_id=p_team_id AND m.auditor_id=public.current_auditor_id()) $$;
CREATE FUNCTION public.current_auditor_is_peer(p_auditor_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$ SELECT EXISTS(SELECT 1 FROM public.audit_team_master_members mine JOIN public.audit_team_master_members peer ON peer.team_id=mine.team_id WHERE mine.auditor_id=public.current_auditor_id() AND peer.auditor_id=p_auditor_id) $$;
CREATE FUNCTION public.auditor_can_access_instruction_row(p_row_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$ SELECT EXISTS(SELECT 1 FROM public.audit_instruction_rows r JOIN public.audit_team_master_members m ON m.team_id=r.team_master_id WHERE r.id=p_row_id AND m.auditor_id=public.current_auditor_id()) $$;
CREATE FUNCTION public.manager_can_access_instruction_row(p_row_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public AS $$ SELECT EXISTS(SELECT 1 FROM public.audit_instruction_rows r JOIN LATERAL jsonb_array_elements(r.seksi_marks) mark ON mark->>'tipe'='target' JOIN public.section_identity_assignments a ON a.seksi_id=(mark->>'seksi_id')::uuid WHERE r.id=p_row_id AND a.user_id=auth.uid() AND a.assignment_type='SECTION_MANAGER' AND a.status='Aktif') $$;

CREATE FUNCTION public.validate_identity_mapping() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
DECLARE v_type text;
BEGIN SELECT identity_type INTO v_type FROM public.user_profiles WHERE id=NEW.user_id;
 IF TG_TABLE_NAME='user_auditor_links' AND v_type<>'AUDITOR' THEN RAISE EXCEPTION 'Link Auditor hanya untuk identitas AUDITOR'; END IF;
 IF TG_TABLE_NAME='section_identity_assignments' AND ((NEW.assignment_type='AUDIT_PIC' AND v_type<>'AUDITEE') OR (NEW.assignment_type='SECTION_MANAGER' AND v_type<>'SECTION_MANAGER')) THEN RAISE EXCEPTION 'Tipe penugasan seksi tidak sesuai identitas'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_user_auditor_link BEFORE INSERT OR UPDATE ON public.user_auditor_links FOR EACH ROW EXECUTE FUNCTION public.validate_identity_mapping();
CREATE TRIGGER trg_validate_section_identity BEFORE INSERT OR UPDATE ON public.section_identity_assignments FOR EACH ROW EXECUTE FUNCTION public.validate_identity_mapping();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.user_auditor_links ENABLE ROW LEVEL SECURITY; ALTER TABLE public.section_identity_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_own_select ON public.user_profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY profiles_admin_all ON public.user_profiles FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY auditor_links_own_select ON public.user_auditor_links FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY auditor_links_admin_all ON public.user_auditor_links FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());
CREATE POLICY section_assignments_own_select ON public.section_identity_assignments FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY section_assignments_admin_all ON public.section_identity_assignments FOR ALL TO authenticated USING(public.is_admin_identity()) WITH CHECK(public.is_admin_identity());

REVOKE ALL ON public.user_profiles,public.user_auditor_links,public.section_identity_assignments FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.user_profiles,public.user_auditor_links,public.section_identity_assignments TO authenticated;
REVOKE ALL ON FUNCTION public.current_identity_type(),public.is_admin_identity(),public.current_auditor_id(),public.current_auditor_belongs_to_team(uuid),public.current_auditor_is_peer(uuid),public.auditor_can_access_instruction_row(uuid),public.manager_can_access_instruction_row(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_identity_type(),public.is_admin_identity(),public.current_auditor_id(),public.current_auditor_belongs_to_team(uuid),public.current_auditor_is_peer(uuid),public.auditor_can_access_instruction_row(uuid),public.manager_can_access_instruction_row(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.validate_identity_mapping() FROM PUBLIC;
