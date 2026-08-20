-- Annual-plan ownership and live roster authority for Team Audit.
-- Existing NULL plan_id rows remain readable legacy records but cannot enter the normal workflow.

ALTER TABLE public.audit_team_masters
  ADD COLUMN plan_id uuid REFERENCES public.audit_plans(id) ON DELETE RESTRICT,
  ADD COLUMN is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN locked_at timestamptz;

ALTER TABLE public.audit_team_masters DROP CONSTRAINT IF EXISTS audit_team_masters_kode_tim_key;
CREATE UNIQUE INDEX uq_audit_team_masters_plan_kode
  ON public.audit_team_masters(plan_id, kode_tim) WHERE plan_id IS NOT NULL;
CREATE INDEX idx_audit_team_masters_plan_id ON public.audit_team_masters(plan_id);

CREATE OR REPLACE FUNCTION public.resolve_instruction_plan_id(p_row_id uuid) RETURNS uuid
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public AS $$
DECLARE v_plan_id uuid; v_tahun integer; v_count integer;
BEGIN
  SELECT p.plan_id,i.tahun_fiskal INTO v_plan_id,v_tahun
    FROM public.audit_instruction_rows r
    JOIN public.audit_instructions i ON i.id=r.instruction_id
    LEFT JOIN public.audit_programs p ON p.id=i.program_id
    WHERE r.id=p_row_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baris Instruksi Audit tidak ditemukan'; END IF;
  IF v_plan_id IS NOT NULL THEN RETURN v_plan_id; END IF;
  SELECT count(*) INTO v_count FROM public.audit_plans WHERE tahun=v_tahun;
  IF v_count <> 1 THEN RAISE EXCEPTION 'Rencana Audit Tahunan untuk Instruksi tidak dapat ditentukan secara unik'; END IF;
  SELECT id INTO v_plan_id FROM public.audit_plans WHERE tahun=v_tahun LIMIT 1;
  RETURN v_plan_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_live_instruction_team() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_team public.audit_team_masters%ROWTYPE; v_plan_id uuid; v_names text;
BEGIN
  IF NEW.team_master_id IS NULL THEN
    IF TG_OP='UPDATE' AND NEW.team_master_id IS DISTINCT FROM OLD.team_master_id
      AND current_setting('app.team_assignment_row_id',true) IS DISTINCT FROM NEW.id::text THEN
      RAISE EXCEPTION 'Tim Audit hanya dapat diubah melalui proses penugasan Tim Audit';
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND NEW.team_master_id IS DISTINCT FROM OLD.team_master_id
    AND current_setting('app.team_assignment_row_id',true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'Tim Audit hanya dapat diubah melalui proses penugasan Tim Audit';
  END IF;
  SELECT * INTO v_team FROM public.audit_team_masters WHERE id=NEW.team_master_id;
  IF NOT FOUND OR v_team.status<>'Aktif' OR NOT v_team.is_locked OR v_team.plan_id IS NULL THEN
    RAISE EXCEPTION 'Pilih Tim Audit aktif dan terkunci dari Rencana Audit Tahunan yang sesuai';
  END IF;
  v_plan_id:=public.resolve_instruction_plan_id(NEW.id);
  IF v_team.plan_id<>v_plan_id THEN RAISE EXCEPTION 'Tim Audit harus berasal dari Rencana Audit Tahunan yang sama dengan Instruksi'; END IF;
  IF (SELECT count(*) FROM public.audit_team_master_members WHERE team_id=v_team.id AND peran='Lead')<>1
    OR NOT EXISTS(SELECT 1 FROM public.audit_team_master_members WHERE team_id=v_team.id) THEN
    RAISE EXCEPTION 'Tim Audit harus memiliki tepat satu Lead dan minimal satu auditor';
  END IF;
  SELECT string_agg(COALESCE(a.nama,m.auditor_id::text),', ' ORDER BY COALESCE(a.nama,m.auditor_id::text)) INTO v_names
    FROM public.audit_team_master_members m LEFT JOIN public.auditors a ON a.id=m.auditor_id
    WHERE m.team_id=v_team.id AND (a.id IS NULL OR a.status<>'Aktif');
  IF v_names IS NOT NULL THEN RAISE EXCEPTION 'Tim Audit memiliki auditor yang sudah tidak aktif: %',v_names; END IF;
  SELECT string_agg(a.nama,', ' ORDER BY a.nama) INTO v_names
    FROM public.audit_team_master_members m JOIN public.auditors a ON a.id=m.auditor_id
    WHERE m.team_id=v_team.id AND (a.tanggal_berlaku IS NULL OR a.tanggal_berlaku<COALESCE(NEW.tanggal_pelaksanaan_audit,CURRENT_DATE));
  IF v_names IS NOT NULL THEN RAISE EXCEPTION 'Auditor tidak memenuhi kompetensi pada tanggal pelaksanaan: %',v_names; END IF;
  SELECT string_agg(DISTINCT a.nama,', ' ORDER BY a.nama) INTO v_names
    FROM public.audit_team_master_members m JOIN public.auditors a ON a.id=m.auditor_id
    JOIN jsonb_array_elements(NEW.seksi_marks) mark ON true JOIN public.seksi s ON s.id=(mark->>'seksi_id')::uuid
    WHERE m.team_id=v_team.id AND nullif(btrim(a.departemen),'') IS NOT NULL
      AND lower(s.nama) LIKE '%'||lower(a.departemen)||'%';
  IF v_names IS NOT NULL AND nullif(btrim(NEW.catatan_justifikasi_tim),'') IS NULL THEN
    RAISE EXCEPTION 'Auditor memiliki potensi konflik independensi dengan seksi yang diaudit: %. Catatan Justifikasi wajib diisi.',v_names;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_validate_instruction_team_assignment ON public.audit_instruction_rows;
CREATE TRIGGER trg_validate_instruction_team_assignment
BEFORE INSERT OR UPDATE OF team_master_id,catatan_justifikasi_tim,tanggal_pelaksanaan_audit,seksi_marks
ON public.audit_instruction_rows FOR EACH ROW EXECUTE FUNCTION public.validate_live_instruction_team();
DROP FUNCTION IF EXISTS public.validate_instruction_team_assignment();

CREATE OR REPLACE FUNCTION public.protect_audit_team_identity() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.plan_id IS DISTINCT FROM NEW.plan_id THEN RAISE EXCEPTION 'Rencana Audit Tahunan pemilik Tim tidak dapat diubah'; END IF;
  IF OLD.is_locked IS DISTINCT FROM NEW.is_locked
    AND current_setting('app.team_lock_id',true) IS DISTINCT FROM NEW.id::text THEN
    RAISE EXCEPTION 'Status kunci Tim Audit hanya dapat diubah melalui aksi Kunci/Buka Kunci';
  END IF;
  IF OLD.is_locked AND (OLD.kode_tim IS DISTINCT FROM NEW.kode_tim OR OLD.plan_id IS DISTINCT FROM NEW.plan_id) THEN
    RAISE EXCEPTION 'Identitas Tim Audit terkunci tidak dapat diubah';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_audit_team_identity BEFORE UPDATE ON public.audit_team_masters
FOR EACH ROW EXECUTE FUNCTION public.protect_audit_team_identity();

CREATE OR REPLACE FUNCTION public.protect_locked_audit_team_members() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF EXISTS(SELECT 1 FROM public.audit_team_masters WHERE id=OLD.team_id AND is_locked) THEN RAISE EXCEPTION 'Roster Tim Audit terkunci. Buka kunci sebelum mengubah anggota.'; END IF;
  ELSIF TG_OP='INSERT' THEN
    IF EXISTS(SELECT 1 FROM public.audit_team_masters WHERE id=NEW.team_id AND is_locked) THEN RAISE EXCEPTION 'Roster Tim Audit terkunci. Buka kunci sebelum mengubah anggota.'; END IF;
  ELSIF EXISTS(SELECT 1 FROM public.audit_team_masters WHERE id IN(OLD.team_id,NEW.team_id) AND is_locked) THEN
    RAISE EXCEPTION 'Roster Tim Audit terkunci. Buka kunci sebelum mengubah anggota.';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;
CREATE TRIGGER trg_protect_locked_audit_team_members BEFORE INSERT OR UPDATE OR DELETE
ON public.audit_team_master_members FOR EACH ROW EXECUTE FUNCTION public.protect_locked_audit_team_members();

REVOKE ALL ON FUNCTION public.save_audit_team_master(uuid,text,text,text,text,jsonb) FROM anon,authenticated;
DROP FUNCTION public.save_audit_team_master(uuid,text,text,text,text,jsonb);
CREATE FUNCTION public.save_audit_team_master(p_id uuid,p_plan_id uuid,p_kode_tim text,p_nama_tim text,p_status text,p_catatan text,p_members jsonb) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_id uuid; v_old_plan uuid;
BEGIN
  IF p_plan_id IS NULL THEN RAISE EXCEPTION 'Rencana Audit Tahunan wajib dipilih'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.audit_plans WHERE id=p_plan_id) THEN RAISE EXCEPTION 'Rencana Audit Tahunan tidak ditemukan'; END IF;
  IF nullif(btrim(p_kode_tim),'') IS NULL OR nullif(btrim(p_nama_tim),'') IS NULL THEN RAISE EXCEPTION 'Kode dan nama Tim Audit wajib diisi'; END IF;
  IF p_status NOT IN('Aktif','Nonaktif') OR jsonb_typeof(p_members)<>'array' THEN RAISE EXCEPTION 'Data Tim Audit tidak valid'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_members))<>(SELECT count(DISTINCT x->>'auditor_id') FROM jsonb_array_elements(p_members)x) THEN RAISE EXCEPTION 'Auditor tidak boleh duplikat'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_members)x WHERE x->>'peran'='Lead')<>1 THEN RAISE EXCEPTION 'Tim Audit harus memiliki tepat satu Lead'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_members)x LEFT JOIN public.auditors a ON a.id=(x->>'auditor_id')::uuid WHERE a.id IS NULL OR a.status<>'Aktif') THEN RAISE EXCEPTION 'Semua anggota Tim Audit harus merupakan auditor aktif'; END IF;
  IF p_id IS NULL THEN INSERT INTO public.audit_team_masters(plan_id,kode_tim,nama_tim,status,catatan) VALUES(p_plan_id,btrim(p_kode_tim),btrim(p_nama_tim),p_status,nullif(btrim(p_catatan),'')) RETURNING id INTO v_id;
  ELSE
    SELECT plan_id INTO v_old_plan FROM public.audit_team_masters WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Tim Audit tidak ditemukan'; END IF;
    IF v_old_plan IS DISTINCT FROM p_plan_id THEN RAISE EXCEPTION 'Rencana Audit Tahunan pemilik Tim tidak dapat diubah'; END IF;
    IF EXISTS(SELECT 1 FROM public.audit_team_masters WHERE id=p_id AND is_locked) THEN RAISE EXCEPTION 'Tim Audit terkunci. Buka kunci sebelum mengedit.'; END IF;
    UPDATE public.audit_team_masters SET kode_tim=btrim(p_kode_tim),nama_tim=btrim(p_nama_tim),status=p_status,catatan=nullif(btrim(p_catatan),'') WHERE id=p_id RETURNING id INTO v_id;
    DELETE FROM public.audit_team_master_members WHERE team_id=v_id;
  END IF;
  INSERT INTO public.audit_team_master_members(team_id,auditor_id,peran,urutan_tampil)
    SELECT v_id,(x->>'auditor_id')::uuid,x->>'peran',COALESCE((x->>'urutan_tampil')::integer,0) FROM jsonb_array_elements(p_members)x;
  RETURN v_id;
END;
$$;

CREATE FUNCTION public.lock_audit_team_master(p_team_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.audit_team_masters WHERE id=p_team_id AND plan_id IS NOT NULL AND status='Aktif') THEN RAISE EXCEPTION 'Tim Audit aktif dengan Rencana Tahunan tidak ditemukan'; END IF;
  IF (SELECT count(*) FROM public.audit_team_master_members WHERE team_id=p_team_id AND peran='Lead')<>1 OR NOT EXISTS(SELECT 1 FROM public.audit_team_master_members WHERE team_id=p_team_id) THEN RAISE EXCEPTION 'Tim Audit harus memiliki tepat satu Lead dan minimal satu auditor'; END IF;
  IF EXISTS(SELECT 1 FROM public.audit_team_master_members m LEFT JOIN public.auditors a ON a.id=m.auditor_id WHERE m.team_id=p_team_id AND(a.id IS NULL OR a.status<>'Aktif')) THEN RAISE EXCEPTION 'Semua anggota Tim Audit harus aktif sebelum Tim dikunci'; END IF;
  PERFORM set_config('app.team_lock_id',p_team_id::text,true);
  UPDATE public.audit_team_masters SET is_locked=true,locked_at=now() WHERE id=p_team_id;
END;
$$;
CREATE FUNCTION public.unlock_audit_team_master(p_team_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.audit_instruction_rows r WHERE r.team_master_id=p_team_id AND(EXISTS(SELECT 1 FROM public.checklists c WHERE c.row_id=r.id) OR EXISTS(SELECT 1 FROM public.checklist_produk c WHERE c.row_id=r.id) OR EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift c WHERE c.row_id=r.id))) THEN RAISE EXCEPTION 'Tim Audit tidak dapat dibuka kuncinya karena sudah digunakan pada pelaksanaan checklist.'; END IF;
  PERFORM set_config('app.team_lock_id',p_team_id::text,true);
  UPDATE public.audit_team_masters SET is_locked=false,locked_at=NULL WHERE id=p_team_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tim Audit tidak ditemukan'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_team_to_instruction_row(p_row_id uuid,p_team_id uuid,p_justification text) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('assign-audit-team'),hashtext(p_row_id::text));
  IF EXISTS(SELECT 1 FROM public.checklists WHERE row_id=p_row_id) OR EXISTS(SELECT 1 FROM public.checklist_produk WHERE row_id=p_row_id) OR EXISTS(SELECT 1 FROM public.checklist_manufaktur_shift WHERE row_id=p_row_id) THEN RAISE EXCEPTION 'Tim audit tidak dapat diubah karena checklist untuk No. Audit ini sudah dibuat. Hapus checklist Draft terlebih dahulu jika tim harus diganti.'; END IF;
  PERFORM set_config('app.team_assignment_row_id',p_row_id::text,true);
  UPDATE public.audit_instruction_rows SET team_master_id=p_team_id,catatan_justifikasi_tim=nullif(btrim(p_justification),''),team=NULL,auditor='[]'::jsonb WHERE id=p_row_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baris Instruksi Audit tidak ditemukan'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_instruction_team_for_checklist() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_row public.audit_instruction_rows%ROWTYPE;v_names text;
BEGIN
  SELECT * INTO v_row FROM public.audit_instruction_rows WHERE id=NEW.row_id;
  IF NOT FOUND OR v_row.team_master_id IS NULL THEN RAISE EXCEPTION 'Pilih dan kunci Tim Audit pada Instruksi Internal Audit sebelum membuat checklist.'; END IF;
  PERFORM public.resolve_instruction_plan_id(v_row.id);
  IF NOT EXISTS(SELECT 1 FROM public.audit_team_masters t WHERE t.id=v_row.team_master_id AND t.status='Aktif' AND t.is_locked AND t.plan_id=public.resolve_instruction_plan_id(v_row.id) AND(SELECT count(*) FROM public.audit_team_master_members m WHERE m.team_id=t.id AND m.peran='Lead')=1 AND NOT EXISTS(SELECT 1 FROM public.audit_team_master_members m LEFT JOIN public.auditors a ON a.id=m.auditor_id WHERE m.team_id=t.id AND(a.id IS NULL OR a.status<>'Aktif'))) THEN RAISE EXCEPTION 'Pilih dan kunci Tim Audit pada Instruksi Internal Audit sebelum membuat checklist.'; END IF;
  SELECT string_agg(a.nama,', ') INTO v_names FROM public.audit_team_master_members m JOIN public.auditors a ON a.id=m.auditor_id WHERE m.team_id=v_row.team_master_id AND(a.tanggal_berlaku IS NULL OR a.tanggal_berlaku<COALESCE(v_row.tanggal_pelaksanaan_audit,CURRENT_DATE));
  IF v_names IS NOT NULL THEN RAISE EXCEPTION 'Auditor tidak memenuhi kompetensi pada tanggal pelaksanaan: %',v_names;END IF;
  SELECT string_agg(DISTINCT a.nama,', ') INTO v_names FROM public.audit_team_master_members m JOIN public.auditors a ON a.id=m.auditor_id JOIN jsonb_array_elements(v_row.seksi_marks)mark ON true JOIN public.seksi s ON s.id=(mark->>'seksi_id')::uuid WHERE m.team_id=v_row.team_master_id AND nullif(btrim(a.departemen),'')IS NOT NULL AND lower(s.nama)LIKE'%'||lower(a.departemen)||'%';
  IF v_names IS NOT NULL AND nullif(btrim(v_row.catatan_justifikasi_tim),'')IS NULL THEN RAISE EXCEPTION 'Auditor memiliki potensi konflik independensi dengan seksi yang diaudit: %. Catatan Justifikasi wajib diisi.',v_names;END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manufacturing_checklist_from_row(p_row_id uuid) RETURNS uuid
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_row public.audit_instruction_rows%ROWTYPE;v_id uuid;v_jenis jsonb;v_nama_seksi text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('manufacturing-checklist'),hashtext(p_row_id::text));
  SELECT * INTO v_row FROM public.audit_instruction_rows WHERE id=p_row_id;
  IF NOT FOUND OR v_row.tipe_baris NOT IN('AuditManufaktur','AuditShift') THEN RAISE EXCEPTION 'Checklist Manufaktur/Shift hanya dapat dibuat dari baris AuditManufaktur atau AuditShift'; END IF;
  SELECT id INTO v_id FROM public.checklist_manufaktur_shift WHERE row_id=p_row_id ORDER BY created_at LIMIT 1;IF v_id IS NOT NULL THEN RETURN v_id;END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('plant_id',m->>'plant_id','plant_nama',p.nama,'shift_id',m->>'shift_id','shift_nama',s.nama)ORDER BY p.urutan_tampil,s.urutan_tampil),'[]') INTO v_jenis FROM jsonb_array_elements(v_row.matriks_manufaktur_shift_marks)m LEFT JOIN public.plants p ON p.id=(m->>'plant_id')::uuid LEFT JOIN public.shifts s ON s.id=(m->>'shift_id')::uuid AND s.plant_id=p.id;
  SELECT max(sec.nama) INTO v_nama_seksi FROM jsonb_array_elements(v_row.seksi_marks)mark JOIN public.seksi sec ON sec.id=(mark->>'seksi_id')::uuid WHERE mark->>'tipe'='target' HAVING count(*)=1;
  INSERT INTO public.checklist_manufaktur_shift(row_id,kode_audit,jenis_checklist,nama_seksi,manager_proses_line_leader,tanggal_audit,auditor,status,kode_dokumen) VALUES(v_row.id,v_row.kode_audit,v_jenis,v_nama_seksi,v_row.pemilik_proses,v_row.tanggal_pelaksanaan_audit,'[]'::jsonb,'Draft','Q-120-ISE-001-FORM-007') RETURNING id INTO v_id;
  INSERT INTO public.checklist_manufaktur_items(checklist_id,bank_item_id,urutan_tampil) SELECT v_id,id,urutan_tampil FROM public.checklist_manufaktur_bank_items WHERE status='Aktif' ORDER BY urutan_tampil,bagian,nomor;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_audit_team_master(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lock_audit_team_master(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unlock_audit_team_master(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assign_team_to_instruction_row(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_audit_team_master(uuid,uuid,text,text,text,text,jsonb) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.lock_audit_team_master(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_audit_team_master(uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_team_to_instruction_row(uuid,uuid,text) TO anon,authenticated;
