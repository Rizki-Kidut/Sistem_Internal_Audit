-- Run only after the unapplied Batch 9b migration has been loaded into an isolated local/Staging database.
-- Every fixture and mutation is transaction-local.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.assert_true(ok boolean,message text)RETURNS void LANGUAGE plpgsql AS $$BEGIN IF NOT COALESCE(ok,false)THEN RAISE EXCEPTION 'B9B ASSERT: %',message;END IF;END$$;
CREATE OR REPLACE FUNCTION pg_temp.actor(id uuid)RETURNS void LANGUAGE plpgsql AS $$BEGIN PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated')::text,true);PERFORM set_config('role','authenticated',true);END$$;
CREATE OR REPLACE FUNCTION pg_temp.expect_error(sql_text text,needle text)RETURNS void LANGUAGE plpgsql AS $$BEGIN EXECUTE sql_text;RAISE EXCEPTION 'B9B ASSERT: expected error containing %',needle;EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'B9B ASSERT:%' THEN RAISE;END IF;IF position(needle in SQLERRM)=0 THEN RAISE EXCEPTION 'B9B ASSERT: expected %, got %',needle,SQLERRM;END IF;END$$;

RESET ROLE;
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)VALUES
('00000000-0000-0000-0000-000000000000','b9000000-0000-0000-0000-000000000001','authenticated','authenticated','b9-admin@test.local','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b9000000-0000-0000-0000-000000000002','authenticated','authenticated','b9-lead@test.local','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b9000000-0000-0000-0000-000000000003','authenticated','authenticated','b9-auditor@test.local','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b9000000-0000-0000-0000-000000000004','authenticated','authenticated','b9-auditee@test.local','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','b9000000-0000-0000-0000-000000000005','authenticated','authenticated','b9-manager@test.local','',now(),'{}','{}',now(),now());
INSERT INTO public.user_profiles(id,display_name,identity_type,status)VALUES
('b9000000-0000-0000-0000-000000000001','B9 Admin','ADMIN','Aktif'),('b9000000-0000-0000-0000-000000000002','B9 Lead','AUDITOR','Aktif'),('b9000000-0000-0000-0000-000000000003','B9 Auditor','AUDITOR','Aktif'),('b9000000-0000-0000-0000-000000000004','B9 Auditee','AUDITEE','Aktif'),('b9000000-0000-0000-0000-000000000005','B9 Manager','SECTION_MANAGER','Aktif');
INSERT INTO public.auditors(id,nama,tanggal_berlaku,status)VALUES('b9100000-0000-0000-0000-000000000001','B9 Company Lead','2027-12-31','Aktif'),('b9100000-0000-0000-0000-000000000002','B9 Ordinary','2027-12-31','Aktif');
INSERT INTO public.user_auditor_links(user_id,auditor_id,is_lead_auditor)VALUES('b9000000-0000-0000-0000-000000000002','b9100000-0000-0000-0000-000000000001',true),('b9000000-0000-0000-0000-000000000003','b9100000-0000-0000-0000-000000000002',false);
INSERT INTO public.seksi(id,nama)VALUES('b9200000-0000-0000-0000-000000000001','B9 Owner'),('b9200000-0000-0000-0000-000000000002','B9 Related');
INSERT INTO public.proses(id,nama_proses,kode_proses)VALUES('b9300000-0000-0000-0000-000000000001','B9 System Process','B9-SYS');
INSERT INTO public.proses_seksi(proses_id,seksi_id,peran)VALUES('b9300000-0000-0000-0000-000000000001','b9200000-0000-0000-0000-000000000001','utama');
INSERT INTO public.plants(id,nama)VALUES('b9400000-0000-0000-0000-000000000001','Fact 1'),('b9400000-0000-0000-0000-000000000002','Fact 2');
INSERT INTO public.shifts(id,plant_id,nama)VALUES('b9500000-0000-0000-0000-000000000001','b9400000-0000-0000-0000-000000000001','Shift 1'),('b9500000-0000-0000-0000-000000000002','b9400000-0000-0000-0000-000000000002','Shift 2'),('b9500000-0000-0000-0000-000000000003','b9400000-0000-0000-0000-000000000001','Shift 2');
INSERT INTO public.target_models(id,plant_id,nama)VALUES('b9600000-0000-0000-0000-000000000001','b9400000-0000-0000-0000-000000000001','Model A'),('b9600000-0000-0000-0000-000000000002','b9400000-0000-0000-0000-000000000001','Model B');
INSERT INTO public.audit_plans(id,tahun,tanggal_berlaku,kode_dokumen,penanggung_jawab_qms,status)VALUES('b9700000-0000-0000-0000-000000000001',2026,'2026-01-01','B9-PLAN','B9 PJ QMS','Approved');
INSERT INTO public.audit_team_masters(id,kode_tim,nama_tim,status,plan_id,is_locked,locked_at)VALUES('b9750000-0000-0000-0000-000000000001','B9-TEAM','B9 Team','Aktif','b9700000-0000-0000-0000-000000000001',true,now());
INSERT INTO public.audit_team_master_members(team_id,auditor_id,peran,urutan_tampil,is_team_leader)VALUES('b9750000-0000-0000-0000-000000000001','b9100000-0000-0000-0000-000000000001','Lead',1,true);
INSERT INTO public.audit_programs(id,plan_id,jenis_ronde,nomor_ke,tahun,tanggal_dibuat,status)VALUES('b9800000-0000-0000-0000-000000000001','b9700000-0000-0000-0000-000000000001','Berkala',1,2026,'2026-01-01','Approved');
INSERT INTO public.audit_instructions(id,program_id,tahun_fiskal,status)VALUES('b9900000-0000-0000-0000-000000000001','b9800000-0000-0000-0000-000000000001',2026,'Selesai');
INSERT INTO public.audit_instructions(id,program_id,tahun_fiskal,status)VALUES('b9900000-0000-0000-0000-000000000002','b9800000-0000-0000-0000-000000000001',2026,'Selesai');
INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,proses_id,seksi_marks,tipe_baris,tanggal_pelaksanaan_audit,cek_selesai,urutan_tampil)VALUES
('ba000000-0000-0000-0000-000000000001','b9900000-0000-0000-0000-000000000001','QA-S1','b9300000-0000-0000-0000-000000000001','[{"seksi_id":"b9200000-0000-0000-0000-000000000001","tipe":"target"}]','Reguler','2026-09-18',false,1),
('ba000000-0000-0000-0000-000000000002','b9900000-0000-0000-0000-000000000001','QA-S2','b9300000-0000-0000-0000-000000000001','[{"seksi_id":"b9200000-0000-0000-0000-000000000002","tipe":"terkait"}]','Reguler','2026-09-19',false,2);
UPDATE public.audit_instruction_rows SET team_master_id='b9750000-0000-0000-0000-000000000001' WHERE id IN('ba000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000002');
INSERT INTO public.checklists(row_id,kode_audit,judul_checklist)VALUES('ba000000-0000-0000-0000-000000000001','QA-S1','B9'),('ba000000-0000-0000-0000-000000000002','QA-S2','B9');
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id IN('ba000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000002');
INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,proses_id,seksi_marks,tipe_baris,tanggal_pelaksanaan_audit,cek_selesai,urutan_tampil)VALUES('ba000000-0000-0000-0000-000000000005','b9900000-0000-0000-0000-000000000002','QA-LEAD','b9300000-0000-0000-0000-000000000001','[]','Reguler','2026-09-20',false,1);
UPDATE public.audit_instruction_rows SET team_master_id='b9750000-0000-0000-0000-000000000001' WHERE id='ba000000-0000-0000-0000-000000000005';
INSERT INTO public.checklists(row_id,kode_audit,judul_checklist)VALUES('ba000000-0000-0000-0000-000000000005','QA-LEAD','B9 Lead');
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id='ba000000-0000-0000-0000-000000000005';
INSERT INTO public.findings(id,instruction_row_id,kode_audit,kode_temuan,nomor_urut_temuan,source_type,source_item_id,kategori,problem,location,objective_evidence,reference,tanggal_temuan,review_status)VALUES
('bb000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','QA-S1','B9/SYS/001',1,'ChecklistSistem','bc000000-0000-0000-0000-000000000001','A','Problem A','Lokasi A','Bukti A','ISO 1','2026-09-18','PUBLISHED'),
('bb000000-0000-0000-0000-000000000002','ba000000-0000-0000-0000-000000000002','QA-S2','B9/SYS/002',1,'ChecklistSistem','bc000000-0000-0000-0000-000000000002','B','Problem B','Lokasi B','Bukti B','ISO 2','2026-09-19','LEGACY_ESTABLISHED'),
('bb000000-0000-0000-0000-000000000003','ba000000-0000-0000-0000-000000000001','QA-S1',NULL,2,'ChecklistSistem','bc000000-0000-0000-0000-000000000003','A',NULL,NULL,NULL,NULL,'2026-09-18','DRAFT'),
('bb000000-0000-0000-0000-000000000004','ba000000-0000-0000-0000-000000000001','QA-S1','B9/MFG/001',3,'ChecklistManufakturShift','bc000000-0000-0000-0000-000000000004','A','MFG','MFG','MFG','MFG','2026-09-18','PUBLISHED');

-- Authoritative Lead semantics: active AUDITOR succeeds; inactive profile/master and non-AUDITOR fail.
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.form014_active_company_lead_auditor()),'active AUDITOR Lead must resolve');
UPDATE public.user_profiles SET status='Nonaktif' WHERE id='b9000000-0000-0000-0000-000000000002';
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.form014_active_company_lead_auditor()),'inactive Lead profile must not resolve');
UPDATE public.user_profiles SET status='Aktif' WHERE id='b9000000-0000-0000-0000-000000000002';UPDATE public.auditors SET status='Nonaktif' WHERE id='b9100000-0000-0000-0000-000000000001';
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.form014_active_company_lead_auditor()),'inactive Lead auditor master must not resolve');
UPDATE public.auditors SET status='Aktif' WHERE id='b9100000-0000-0000-0000-000000000001';ALTER TABLE public.user_profiles DISABLE TRIGGER trg_protect_profile_identity_mapping;UPDATE public.user_profiles SET identity_type='ADMIN' WHERE id='b9000000-0000-0000-0000-000000000002';ALTER TABLE public.user_profiles ENABLE TRIGGER trg_protect_profile_identity_mapping;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.form014_active_company_lead_auditor()),'non-AUDITOR linked Lead must not resolve');
ALTER TABLE public.user_profiles DISABLE TRIGGER trg_protect_profile_identity_mapping;UPDATE public.user_profiles SET identity_type='AUDITOR' WHERE id='b9000000-0000-0000-0000-000000000002';ALTER TABLE public.user_profiles ENABLE TRIGGER trg_protect_profile_identity_mapping;

-- Real authorization and report/group/zero-Finding execution.
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000002');
CREATE TEMP TABLE b9_lead_result AS SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000002','ChecklistSistem') report_id;
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.rangkuman_hasil_audit_reports r,b9_lead_result x WHERE r.id=x.report_id),'active Company Lead must create FORM-014');
RESET ROLE;
UPDATE public.user_profiles SET status='Nonaktif' WHERE id='b9000000-0000-0000-0000-000000000002';SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_lead_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports r,b9_lead_result x WHERE r.id=x.report_id)),'Company Lead Auditor aktif');
RESET ROLE;UPDATE public.user_profiles SET status='Aktif' WHERE id='b9000000-0000-0000-0000-000000000002';UPDATE public.auditors SET status='Nonaktif' WHERE id='b9100000-0000-0000-0000-000000000001';SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_lead_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports r,b9_lead_result x WHERE r.id=x.report_id)),'Company Lead Auditor aktif');
RESET ROLE;UPDATE public.auditors SET status='Aktif' WHERE id='b9100000-0000-0000-0000-000000000001';ALTER TABLE public.user_profiles DISABLE TRIGGER trg_protect_profile_identity_mapping;UPDATE public.user_profiles SET identity_type='ADMIN' WHERE id='b9000000-0000-0000-0000-000000000002';ALTER TABLE public.user_profiles ENABLE TRIGGER trg_protect_profile_identity_mapping;SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_lead_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports r,b9_lead_result x WHERE r.id=x.report_id)),'Company Lead Auditor aktif');
RESET ROLE;ALTER TABLE public.user_profiles DISABLE TRIGGER trg_protect_profile_identity_mapping;UPDATE public.user_profiles SET identity_type='AUDITOR' WHERE id='b9000000-0000-0000-0000-000000000002';ALTER TABLE public.user_profiles ENABLE TRIGGER trg_protect_profile_identity_mapping;

SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
CREATE TEMP TABLE b9_result AS SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000001','ChecklistSistem') report_id;
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.rangkuman_hasil_audit_items i,b9_result r WHERE i.report_id=r.report_id),'only formal System Findings must populate');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM public.rangkuman_hasil_audit_groups g,b9_result r WHERE g.report_id=r.report_id),'System rows must form one process group');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.rangkuman_hasil_audit_group_rows gr JOIN public.rangkuman_hasil_audit_groups g ON g.id=gr.group_id,b9_result r WHERE g.report_id=r.report_id),'both System rows must be represented');
SELECT pg_temp.assert_true((SELECT process_owner_snapshot='B9 Owner' AND related_sections_snapshot='B9 Owner, B9 Related' AND completed FROM public.rangkuman_hasil_audit_groups g,b9_result r WHERE g.report_id=r.report_id),'owner/section union or completed ZERO FINDING state mismatch');
SELECT pg_temp.expect_error($q$SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000001','ChecklistSistem')$q$,'duplicate key');
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000003');SELECT pg_temp.expect_error($q$SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000001','ChecklistProduk')$q$,'tidak berwenang');
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000004');SELECT pg_temp.expect_error($q$SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000001','ChecklistProduk')$q$,'tidak berwenang');
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000005');SELECT pg_temp.expect_error($q$SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000001','ChecklistProduk')$q$,'tidak berwenang');

-- Real optimistic concurrency: matching succeeds; stale and NULL fail closed.
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT public.save_rangkuman_hasil_audit_draft(r.report_id,x.revision_version,'B9 Catatan','{}')FROM b9_result r JOIN public.rangkuman_hasil_audit_reports x ON x.id=r.report_id;
SELECT pg_temp.assert_true((SELECT catatan='B9 Catatan' FROM public.rangkuman_hasil_audit_reports x,b9_result r WHERE x.id=r.report_id),'matching save failed');
SELECT pg_temp.expect_error(format('SELECT public.save_rangkuman_hasil_audit_draft(%L,1,%L,%L::jsonb)',(SELECT report_id FROM b9_result),'x','{}'),'FORM014_STALE_REVISION');
SELECT pg_temp.expect_error(format('SELECT public.save_rangkuman_hasil_audit_draft(%L,NULL,%L,%L::jsonb)',(SELECT report_id FROM b9_result),'x','{}'),'FORM014_STALE_REVISION');

-- Real fail-closed Product/Manufacturing context execution using persisted composite rows.
RESET ROLE;
INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,proses_id,tipe_baris,matriks_produk_marks,matriks_manufaktur_shift_marks)VALUES
('ba000000-0000-0000-0000-000000000003','b9900000-0000-0000-0000-000000000001','QA-P1','b9300000-0000-0000-0000-000000000001','AuditProduk','[{"plant_id":"b9400000-0000-0000-0000-000000000001","target_model_id":"b9600000-0000-0000-0000-000000000001"},{"plant_id":"b9400000-0000-0000-0000-000000000001","target_model_id":"b9600000-0000-0000-0000-000000000002"}]','[]'),
('ba000000-0000-0000-0000-000000000004','b9900000-0000-0000-0000-000000000001','QA-M1','b9300000-0000-0000-0000-000000000001','AuditManufaktur','[]','[{"plant_id":"b9400000-0000-0000-0000-000000000001","shift_id":"b9500000-0000-0000-0000-000000000001"}]');
UPDATE public.audit_instruction_rows SET tanggal_pelaksanaan_audit='2026-09-18',tanggal_audit_produk='2026-09-18' WHERE id IN('ba000000-0000-0000-0000-000000000003','ba000000-0000-0000-0000-000000000004');
INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,proses_id,tipe_baris,matriks_produk_marks,matriks_manufaktur_shift_marks,tanggal_pelaksanaan_audit,tanggal_audit_produk,cek_selesai,urutan_tampil)VALUES
('ba000000-0000-0000-0000-000000000006','b9900000-0000-0000-0000-000000000001','QA-P2','b9300000-0000-0000-0000-000000000001','AuditProduk','[{"plant_id":"b9400000-0000-0000-0000-000000000002","target_model_id":"b9600000-0000-0000-0000-000000000001"}]','[]','2026-09-20','2026-09-20',false,4),
('ba000000-0000-0000-0000-000000000007','b9900000-0000-0000-0000-000000000001','QA-M2','b9300000-0000-0000-0000-000000000001','AuditManufaktur','[]','[{"plant_id":"b9400000-0000-0000-0000-000000000001","shift_id":"b9500000-0000-0000-0000-000000000003"}]','2026-09-20',NULL,false,5);
UPDATE public.audit_instruction_rows SET team_master_id='b9750000-0000-0000-0000-000000000001' WHERE id IN('ba000000-0000-0000-0000-000000000003','ba000000-0000-0000-0000-000000000004','ba000000-0000-0000-0000-000000000006','ba000000-0000-0000-0000-000000000007');
INSERT INTO public.checklist_produk(row_id,kode_audit)VALUES('ba000000-0000-0000-0000-000000000003','QA-P1'),('ba000000-0000-0000-0000-000000000006','QA-P2');
INSERT INTO public.checklist_manufaktur_shift(row_id,kode_audit)VALUES('ba000000-0000-0000-0000-000000000004','QA-M1'),('ba000000-0000-0000-0000-000000000007','QA-M2');
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id IN('ba000000-0000-0000-0000-000000000003','ba000000-0000-0000-0000-000000000004','ba000000-0000-0000-0000-000000000006','ba000000-0000-0000-0000-000000000007');
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
CREATE TEMP TABLE b9_product AS SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000001','ChecklistProduk') report_id;
CREATE TEMP TABLE b9_mfg AS SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000001','ChecklistManufakturShift') report_id;
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.rangkuman_hasil_audit_groups g,b9_product r WHERE g.report_id=r.report_id AND g.label_snapshot IN('Audit Produk Fact 1','Audit Produk Fact 2')),'Product generation must create isolated Plant groups');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.rangkuman_hasil_audit_groups g,b9_mfg r WHERE g.report_id=r.report_id AND g.label_snapshot IN('Audit Manufaktur Shift 1 Fact 1','Audit Manufaktur Shift 2 Fact 1')),'Manufacturing generation must create isolated QA groups');
RESET ROLE;
CREATE TEMP TABLE b9_mfg_state AS SELECT public.form014_source_state(report_id) state FROM b9_mfg;
UPDATE public.audit_instruction_rows SET matriks_manufaktur_shift_marks=matriks_manufaktur_shift_marks||matriks_manufaktur_shift_marks WHERE id='ba000000-0000-0000-0000-000000000004';
SELECT pg_temp.assert_true((SELECT state=public.form014_source_state((SELECT report_id FROM b9_mfg))FROM b9_mfg_state),'duplicate/reordered Manufacturing marks must normalize without false drift');
SELECT pg_temp.assert_true((SELECT public.form014_validate_context(r,'ChecklistProduk')='Audit Produk Fact 1' FROM public.audit_instruction_rows r WHERE id='ba000000-0000-0000-0000-000000000003'),'same-Plant multi-model Product context must pass');
SELECT pg_temp.assert_true((SELECT public.form014_validate_context(r,'ChecklistManufakturShift')='Audit Manufaktur Shift 1 Fact 1' FROM public.audit_instruction_rows r WHERE id='ba000000-0000-0000-0000-000000000004'),'Manufacturing label mismatch');
UPDATE public.audit_instruction_rows SET matriks_manufaktur_shift_marks='[{"plant_id":"b9400000-0000-0000-0000-000000000001","shift_id":"b9500000-0000-0000-0000-000000000002"}]' WHERE id='ba000000-0000-0000-0000-000000000004';
SELECT pg_temp.expect_error($q$SELECT public.form014_validate_context(r,'ChecklistManufakturShift')FROM public.audit_instruction_rows r WHERE id='ba000000-0000-0000-0000-000000000004'$q$,'konteks Plant/Shift tidak valid');
UPDATE public.audit_instruction_rows SET matriks_produk_marks='[{"plant_id":"malformed","target_model_id":null}]' WHERE id='ba000000-0000-0000-0000-000000000003';
SELECT pg_temp.expect_error($q$SELECT public.form014_validate_context(r,'ChecklistProduk')FROM public.audit_instruction_rows r WHERE id='ba000000-0000-0000-0000-000000000003'$q$,'konteks Plant tidak valid');

-- Real completion, source-state and fiscal-year drift rejection.
RESET ROLE;
UPDATE public.audit_instruction_rows SET cek_selesai=false WHERE id='ba000000-0000-0000-0000-000000000001';
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports x,b9_result r WHERE x.id=r.report_id)),'Status pelaksanaan audit berubah');
RESET ROLE;
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id='ba000000-0000-0000-0000-000000000001';
UPDATE public.audit_instructions SET tahun_fiskal=2027 WHERE id='b9900000-0000-0000-0000-000000000001';
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports x,b9_result r WHERE x.id=r.report_id)),'Data sumber FORM-014 berubah');
-- Real valid Finalization and immutable report/children/RPC behavior.
RESET ROLE;
UPDATE public.audit_instructions SET tahun_fiskal=2026 WHERE id='b9900000-0000-0000-0000-000000000001';
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT public.form014_refresh_population(report_id)FROM b9_result;
SELECT public.finalize_rangkuman_hasil_audit(r.report_id,x.revision_version)FROM b9_result r JOIN public.rangkuman_hasil_audit_reports x ON x.id=r.report_id;
SELECT pg_temp.assert_true((SELECT status='Final' AND finalized_at IS NOT NULL AND lead_auditor_name_snapshot='B9 Company Lead' AND pj_qms_snapshot='B9 PJ QMS' FROM public.rangkuman_hasil_audit_reports x,b9_result r WHERE x.id=r.report_id),'valid Final snapshot failed');
SELECT pg_temp.expect_error(format('UPDATE public.rangkuman_hasil_audit_reports SET catatan=%L WHERE id=%L','mutate',(SELECT report_id FROM b9_result)),'');
SELECT pg_temp.expect_error(format('DELETE FROM public.rangkuman_hasil_audit_reports WHERE id=%L',(SELECT report_id FROM b9_result)),'');
SELECT pg_temp.expect_error(format('SELECT public.form014_refresh_population(%L)',(SELECT report_id FROM b9_result)),'Final tidak dapat diregenerasi');
SELECT pg_temp.expect_error(format('SELECT public.save_rangkuman_hasil_audit_draft(%L,%s,%L,%L::jsonb)',(SELECT report_id FROM b9_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports x,b9_result r WHERE x.id=r.report_id),'x','{}'),'Final bersifat immutable');
SELECT pg_temp.expect_error(format('INSERT INTO public.rangkuman_hasil_audit_groups(report_id,group_key,group_sort_order,qa_code,completed)VALUES(%L,%L,99,%L,true)',(SELECT report_id FROM b9_result),'late','late'),'');
ROLLBACK;
