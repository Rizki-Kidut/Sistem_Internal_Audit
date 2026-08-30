-- Batch 7d: Admin Manage User + annual Auditor access assignment.
-- Admin and company Lead Auditor remain global. Normal Auditor access is activated per Annual Audit Plan + Team.

CREATE TABLE public.user_audit_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.audit_plans(id) ON DELETE RESTRICT,
  team_id uuid NOT NULL REFERENCES public.audit_team_masters(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif','Nonaktif')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,plan_id,team_id)
);

CREATE INDEX idx_user_audit_plan_assignments_user ON public.user_audit_plan_assignments(user_id,status);
CREATE INDEX idx_user_audit_plan_assignments_plan ON public.user_audit_plan_assignments(plan_id,status);
CREATE INDEX idx_user_audit_plan_assignments_team ON public.user_audit_plan_assignments(team_id,status);
CREATE TRIGGER set_user_audit_plan_assignments_updated_at
BEFORE UPDATE ON public.user_audit_plan_assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.validate_user_audit_plan_assignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_auditor_id uuid;
  v_team_plan_id uuid;
BEGIN
  SELECT l.auditor_id INTO v_auditor_id
  FROM public.user_profiles p
  JOIN public.user_auditor_links l ON l.user_id=p.id
  WHERE p.id=NEW.user_id
    AND p.identity_type='AUDITOR';

  IF v_auditor_id IS NULL THEN
    RAISE EXCEPTION 'Assignment tahunan hanya untuk user Auditor yang sudah terhubung ke Auditor Master';
  END IF;

  SELECT t.plan_id INTO v_team_plan_id
  FROM public.audit_team_masters t
  WHERE t.id=NEW.team_id;

  IF v_team_plan_id IS NULL OR v_team_plan_id IS DISTINCT FROM NEW.plan_id THEN
    RAISE EXCEPTION 'Team Audit harus berasal dari Rencana Audit Tahunan yang dipilih';
  END IF;

  IF NEW.status='Aktif' AND NOT EXISTS (
    SELECT 1
    FROM public.audit_team_master_members m
    WHERE m.team_id=NEW.team_id
      AND m.auditor_id=v_auditor_id
  ) THEN
    RAISE EXCEPTION 'Auditor user ini bukan anggota Team Audit yang dipilih';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER trg_validate_user_audit_plan_assignment
BEFORE INSERT OR UPDATE ON public.user_audit_plan_assignments
FOR EACH ROW EXECUTE FUNCTION public.validate_user_audit_plan_assignment();

-- Preserve currently working normal-Auditor access once. Future Annual Plans are not auto-assigned.
INSERT INTO public.user_audit_plan_assignments(user_id,plan_id,team_id,status)
SELECT DISTINCT l.user_id,t.plan_id,m.team_id,'Aktif'
FROM public.user_auditor_links l
JOIN public.user_profiles p ON p.id=l.user_id
JOIN public.audit_team_master_members m ON m.auditor_id=l.auditor_id
JOIN public.audit_team_masters t ON t.id=m.team_id
WHERE p.identity_type='AUDITOR'
  AND p.status='Aktif'
  AND NOT l.is_lead_auditor
  AND t.plan_id IS NOT NULL
ON CONFLICT (user_id,plan_id,team_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.auditor_user_authorized_for_team(p_user_id uuid,p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles p
    JOIN public.user_auditor_links l ON l.user_id=p.id
    JOIN public.audit_team_master_members m
      ON m.team_id=p_team_id AND m.auditor_id=l.auditor_id
    JOIN public.audit_team_masters t ON t.id=m.team_id
    WHERE p.id=p_user_id
      AND p.identity_type='AUDITOR'
      AND p.status='Aktif'
      AND (
        l.is_lead_auditor
        OR EXISTS (
          SELECT 1
          FROM public.user_audit_plan_assignments a
          WHERE a.user_id=p.id
            AND a.plan_id=t.plan_id
            AND a.team_id=t.id
            AND a.status='Aktif'
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.auditor_user_can_receive_finding(p_user_id uuid,p_finding_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles p
    JOIN public.user_auditor_links l ON l.user_id=p.id
    JOIN public.auditors a ON a.id=l.auditor_id
    JOIN public.findings f ON f.id=p_finding_id
    JOIN public.audit_instruction_rows r ON r.id=f.instruction_row_id
    WHERE p.id=p_user_id
      AND p.identity_type='AUDITOR'
      AND p.status='Aktif'
      AND a.status='Aktif'
      AND (
        l.is_lead_auditor
        OR public.auditor_user_authorized_for_team(p.id,r.team_master_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.auditor_can_access_instruction_row(p_row_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT public.current_identity_type()='AUDITOR' AND EXISTS (
    SELECT 1
    FROM public.audit_instruction_rows r
    WHERE r.id=p_row_id
      AND r.team_master_id IS NOT NULL
      AND public.auditor_user_authorized_for_team(auth.uid(),r.team_master_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.current_auditor_belongs_to_team(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT public.current_identity_type()='AUDITOR'
     AND public.auditor_user_authorized_for_team(auth.uid(),p_team_id)
$$;

CREATE OR REPLACE FUNCTION public.current_auditor_is_peer(p_auditor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.audit_team_master_members mine
    JOIN public.audit_team_master_members peer ON peer.team_id=mine.team_id
    WHERE mine.auditor_id=public.current_auditor_id()
      AND peer.auditor_id=p_auditor_id
      AND public.auditor_user_authorized_for_team(auth.uid(),mine.team_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.current_auditor_is_team_leader(p_finding_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
  SELECT public.current_identity_type()='AUDITOR' AND EXISTS (
    SELECT 1
    FROM public.findings f
    JOIN public.audit_instruction_rows r ON r.id=f.instruction_row_id
    JOIN public.audit_team_master_members m ON m.team_id=r.team_master_id
    WHERE f.id=p_finding_id
      AND m.auditor_id=public.current_auditor_id()
      AND m.is_team_leader
      AND public.auditor_user_authorized_for_team(auth.uid(),m.team_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.guard_auditor_notification_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_identity text;
BEGIN
  SELECT p.identity_type INTO v_identity
  FROM public.user_profiles p
  WHERE p.id=NEW.recipient_user_id
    AND p.status='Aktif';

  IF v_identity='AUDITOR'
     AND NOT public.auditor_user_can_receive_finding(NEW.recipient_user_id,NEW.finding_id) THEN
    RETURN NULL;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER trg_guard_auditor_notification_assignment
BEFORE INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.guard_auditor_notification_assignment();

CREATE OR REPLACE FUNCTION public.ltp_manager_decision_blockers(p_car_id uuid,p_decision text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
DECLARE
  v_car public.cars%ROWTYPE;
  v_decision text:=upper(btrim(COALESCE(p_decision,'')));
  v_blockers text[]:=ARRAY[]::text[];
BEGIN
  SELECT * INTO v_car FROM public.cars WHERE id=p_car_id;
  IF NOT FOUND THEN
    RETURN ARRAY['LTP tidak ditemukan.'];
  END IF;

  IF v_car.status<>'MANAGER_REVIEW' THEN
    RETURN ARRAY['LTP tidak berada pada tahap review Section Manager.'];
  END IF;

  IF v_decision='RETURN' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.section_identity_assignments a
      JOIN public.user_profiles p ON p.id=a.user_id
      WHERE a.seksi_id=v_car.seksi_auditee_id
        AND a.assignment_type='AUDIT_PIC'
        AND a.status='Aktif'
        AND p.identity_type='AUDITEE'
        AND p.status='Aktif'
    ) THEN
      v_blockers:=array_append(v_blockers,'Belum ada Auditee aktif untuk menerima revisi LTP ini.');
    END IF;
  ELSIF v_decision='APPROVE' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.user_profiles p
      WHERE p.identity_type='AUDITOR'
        AND p.status='Aktif'
        AND public.auditor_user_can_receive_finding(p.id,v_car.finding_id)
    ) THEN
      v_blockers:=array_append(v_blockers,'Belum ada akun Auditor aktif dengan assignment tahun/Team yang dapat menerima verifikasi LTP ini.');
    END IF;
  ELSE
    v_blockers:=array_append(v_blockers,'Keputusan Section Manager tidak valid.');
  END IF;

  RETURN v_blockers;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_list_user_management()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS $$
  SELECT CASE WHEN public.is_admin_identity() THEN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'user_id',u.id,
        'email',u.email,
        'email_confirmed_at',u.email_confirmed_at,
        'display_name',p.display_name,
        'nik',p.nik,
        'identity_type',p.identity_type,
        'role',CASE WHEN p.identity_type='AUDITOR' AND COALESCE(l.is_lead_auditor,false) THEN 'LEAD_AUDITOR' ELSE p.identity_type END,
        'status',p.status,
        'auditor_id',l.auditor_id,
        'auditor_name',au.nama,
        'is_lead_auditor',COALESCE(l.is_lead_auditor,false),
        'section_assignments',COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id',sa.id,'seksi_id',sa.seksi_id,'seksi_nama',s.nama,
            'assignment_type',sa.assignment_type,'status',sa.status
          ) ORDER BY s.nama,sa.assignment_type)
          FROM public.section_identity_assignments sa
          JOIN public.seksi s ON s.id=sa.seksi_id
          WHERE sa.user_id=u.id
        ),'[]'::jsonb),
        'annual_assignments',COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id',aa.id,'plan_id',aa.plan_id,'tahun',ap.tahun,'plan_kode',ap.kode_dokumen,
            'team_id',aa.team_id,'team_kode',tm.kode_tim,'team_nama',tm.nama_tim,
            'status',aa.status,
            'is_team_leader',COALESCE(mm.is_team_leader,false)
          ) ORDER BY ap.tahun DESC,tm.kode_tim)
          FROM public.user_audit_plan_assignments aa
          JOIN public.audit_plans ap ON ap.id=aa.plan_id
          JOIN public.audit_team_masters tm ON tm.id=aa.team_id
          LEFT JOIN public.audit_team_master_members mm ON mm.team_id=aa.team_id AND mm.auditor_id=l.auditor_id
          WHERE aa.user_id=u.id
        ),'[]'::jsonb)
      ) ORDER BY COALESCE(p.display_name,u.email),u.id
    )
    FROM auth.users u
    LEFT JOIN public.user_profiles p ON p.id=u.id
    LEFT JOIN public.user_auditor_links l ON l.user_id=u.id
    LEFT JOIN public.auditors au ON au.id=l.auditor_id
  ),'[]'::jsonb) ELSE '[]'::jsonb END
$$;

CREATE OR REPLACE FUNCTION public.admin_save_user_access(
  p_user_id uuid,
  p_display_name text,
  p_nik text,
  p_role text,
  p_status text,
  p_auditor_id uuid DEFAULT NULL,
  p_plan_id uuid DEFAULT NULL,
  p_team_id uuid DEFAULT NULL,
  p_seksi_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,auth
AS $$
DECLARE
  v_target_identity text;
  v_old_identity text;
  v_old_auditor_id uuid;
  v_role text:=upper(btrim(COALESCE(p_role,'')));
BEGIN
  IF NOT public.is_admin_identity() THEN
    RAISE EXCEPTION 'Hanya Admin yang dapat mengelola user';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=p_user_id) THEN
    RAISE EXCEPTION 'Supabase Auth user tidak ditemukan';
  END IF;
  IF COALESCE(btrim(p_display_name),'')='' THEN
    RAISE EXCEPTION 'Nama user wajib diisi';
  END IF;
  IF p_status NOT IN ('Aktif','Nonaktif') THEN
    RAISE EXCEPTION 'Status user tidak valid';
  END IF;
  IF v_role NOT IN ('ADMIN','LEAD_AUDITOR','AUDITOR','AUDITEE','SECTION_MANAGER') THEN
    RAISE EXCEPTION 'Role user tidak valid';
  END IF;

  v_target_identity:=CASE WHEN v_role='LEAD_AUDITOR' THEN 'AUDITOR' ELSE v_role END;

  SELECT p.identity_type INTO v_old_identity
  FROM public.user_profiles p
  WHERE p.id=p_user_id
  FOR UPDATE;

  SELECT l.auditor_id INTO v_old_auditor_id
  FROM public.user_auditor_links l
  WHERE l.user_id=p_user_id;

  IF v_old_identity='AUDITOR' AND (v_target_identity<>'AUDITOR' OR v_old_auditor_id IS DISTINCT FROM p_auditor_id) THEN
    UPDATE public.user_audit_plan_assignments SET status='Nonaktif' WHERE user_id=p_user_id AND status='Aktif';
    DELETE FROM public.user_auditor_links WHERE user_id=p_user_id;
  END IF;

  IF v_old_identity IN ('AUDITEE','SECTION_MANAGER') AND v_old_identity IS DISTINCT FROM v_target_identity THEN
    UPDATE public.section_identity_assignments SET status='Nonaktif' WHERE user_id=p_user_id AND status='Aktif';
  END IF;

  INSERT INTO public.user_profiles(id,display_name,nik,identity_type,status)
  VALUES(p_user_id,btrim(p_display_name),NULLIF(btrim(COALESCE(p_nik,'')),''),v_target_identity,p_status)
  ON CONFLICT(id) DO UPDATE SET
    display_name=EXCLUDED.display_name,
    nik=EXCLUDED.nik,
    identity_type=EXCLUDED.identity_type,
    status=EXCLUDED.status;

  IF v_target_identity='ADMIN' THEN
    UPDATE public.user_audit_plan_assignments SET status='Nonaktif' WHERE user_id=p_user_id AND status='Aktif';
    DELETE FROM public.user_auditor_links WHERE user_id=p_user_id;
    UPDATE public.section_identity_assignments SET status='Nonaktif' WHERE user_id=p_user_id AND status='Aktif';
    RETURN;
  END IF;

  IF v_target_identity='AUDITOR' THEN
    IF p_auditor_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.auditors a WHERE a.id=p_auditor_id AND a.status='Aktif') THEN
      RAISE EXCEPTION 'Auditor Master aktif wajib dipilih';
    END IF;
    IF EXISTS(SELECT 1 FROM public.user_auditor_links l WHERE l.auditor_id=p_auditor_id AND l.user_id<>p_user_id) THEN
      RAISE EXCEPTION 'Auditor Master sudah terhubung ke user lain';
    END IF;

    IF v_role='LEAD_AUDITOR' THEN
      IF EXISTS(
        SELECT 1
        FROM public.user_auditor_links l
        JOIN public.user_profiles p ON p.id=l.user_id
        WHERE l.user_id<>p_user_id
          AND l.is_lead_auditor
          AND p.identity_type='AUDITOR'
          AND p.status='Aktif'
      ) THEN
        RAISE EXCEPTION 'Lead Auditor perusahaan aktif sudah dikonfigurasi pada user lain';
      END IF;
      INSERT INTO public.user_auditor_links(user_id,auditor_id,is_lead_auditor)
      VALUES(p_user_id,p_auditor_id,true)
      ON CONFLICT(user_id) DO UPDATE SET auditor_id=EXCLUDED.auditor_id,is_lead_auditor=true;
      UPDATE public.user_audit_plan_assignments SET status='Nonaktif' WHERE user_id=p_user_id AND status='Aktif';
      UPDATE public.section_identity_assignments SET status='Nonaktif' WHERE user_id=p_user_id AND status='Aktif';
      RETURN;
    END IF;

    INSERT INTO public.user_auditor_links(user_id,auditor_id,is_lead_auditor)
    VALUES(p_user_id,p_auditor_id,false)
    ON CONFLICT(user_id) DO UPDATE SET auditor_id=EXCLUDED.auditor_id,is_lead_auditor=false;
    UPDATE public.section_identity_assignments SET status='Nonaktif' WHERE user_id=p_user_id AND status='Aktif';

    IF p_status='Aktif' THEN
      IF p_plan_id IS NOT NULL OR p_team_id IS NOT NULL THEN
        IF p_plan_id IS NULL OR p_team_id IS NULL THEN
          RAISE EXCEPTION 'Rencana Audit Tahunan dan Team Audit harus dipilih bersama';
        END IF;
        INSERT INTO public.user_audit_plan_assignments(user_id,plan_id,team_id,status)
        VALUES(p_user_id,p_plan_id,p_team_id,'Aktif')
        ON CONFLICT(user_id,plan_id,team_id) DO UPDATE SET status='Aktif';
      ELSIF NOT EXISTS(
        SELECT 1 FROM public.user_audit_plan_assignments a
        WHERE a.user_id=p_user_id AND a.status='Aktif'
      ) THEN
        RAISE EXCEPTION 'Auditor aktif wajib memiliki assignment Rencana Audit Tahunan dan Team Audit';
      END IF;
    END IF;
    RETURN;
  END IF;

  UPDATE public.user_audit_plan_assignments SET status='Nonaktif' WHERE user_id=p_user_id AND status='Aktif';
  DELETE FROM public.user_auditor_links WHERE user_id=p_user_id;

  IF p_status='Aktif' THEN
    IF p_seksi_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.seksi s WHERE s.id=p_seksi_id AND s.aktif) THEN
      RAISE EXCEPTION 'Seksi aktif wajib dipilih untuk Auditee/Section Manager';
    END IF;
    UPDATE public.section_identity_assignments
    SET status='Nonaktif'
    WHERE user_id=p_user_id AND status='Aktif';

    INSERT INTO public.section_identity_assignments(user_id,seksi_id,assignment_type,status)
    VALUES(
      p_user_id,p_seksi_id,
      CASE WHEN v_target_identity='AUDITEE' THEN 'AUDIT_PIC' ELSE 'SECTION_MANAGER' END,
      'Aktif'
    )
    ON CONFLICT(user_id,seksi_id,assignment_type) DO UPDATE SET status='Aktif';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.admin_set_user_audit_assignment_status(p_assignment_id uuid,p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $$
BEGIN
  IF NOT public.is_admin_identity() THEN
    RAISE EXCEPTION 'Hanya Admin yang dapat mengubah assignment Auditor';
  END IF;
  IF p_status NOT IN ('Aktif','Nonaktif') THEN
    RAISE EXCEPTION 'Status assignment tidak valid';
  END IF;
  UPDATE public.user_audit_plan_assignments
  SET status=p_status
  WHERE id=p_assignment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assignment Auditor tidak ditemukan';
  END IF;
END
$$;

ALTER TABLE public.user_audit_plan_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_audit_plan_assignments_admin_select ON public.user_audit_plan_assignments
FOR SELECT TO authenticated USING(public.is_admin_identity());
CREATE POLICY user_audit_plan_assignments_own_select ON public.user_audit_plan_assignments
FOR SELECT TO authenticated USING(user_id=auth.uid());

REVOKE ALL ON public.user_audit_plan_assignments FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.user_audit_plan_assignments TO authenticated;

REVOKE ALL ON FUNCTION public.validate_user_audit_plan_assignment() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.auditor_user_authorized_for_team(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.auditor_user_can_receive_finding(uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_auditor_notification_assignment() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.admin_list_user_management() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_save_user_access(uuid,text,text,text,text,uuid,uuid,uuid,uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_set_user_audit_assignment_status(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_list_user_management() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_user_access(uuid,text,text,text,text,uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_audit_assignment_status(uuid,text) TO authenticated;
