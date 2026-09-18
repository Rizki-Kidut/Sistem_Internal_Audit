-- Run only after the unapplied Batch 9b migration has been loaded into an isolated local/Staging database.
-- Every fixture and mutation is transaction-local.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.assert_true(ok boolean,message text)RETURNS void LANGUAGE plpgsql AS $$BEGIN IF NOT COALESCE(ok,false)THEN RAISE EXCEPTION 'B9B ASSERT: %',message;END IF;END$$;
CREATE OR REPLACE FUNCTION pg_temp.claim(id uuid)RETURNS void LANGUAGE plpgsql AS $$BEGIN PERFORM set_config('request.jwt.claim.sub',id::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated')::text,true);END$$;
CREATE OR REPLACE FUNCTION pg_temp.actor(id uuid)RETURNS void LANGUAGE plpgsql AS $$BEGIN PERFORM pg_temp.claim(id);PERFORM set_config('role','authenticated',true);END$$;
CREATE OR REPLACE FUNCTION pg_temp.expect_error(sql_text text,needle text)RETURNS void LANGUAGE plpgsql AS $$BEGIN EXECUTE sql_text;RAISE EXCEPTION 'B9B ASSERT: expected error containing %',needle;EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'B9B ASSERT:%' THEN RAISE;END IF;IF position(needle in SQLERRM)=0 THEN RAISE EXCEPTION 'B9B ASSERT: expected %, got %',needle,SQLERRM;END IF;END$$;
SELECT pg_temp.assert_true(NOT has_function_privilege('authenticated','public.form014_active_company_lead_auditor()','EXECUTE'),'private Company Lead resolver must not be directly executable by authenticated');

RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);
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
INSERT INTO public.audit_team_masters(id,kode_tim,nama_tim,status,plan_id,is_locked)VALUES('b9750000-0000-0000-0000-000000000001','B9-TEAM','B9 Team','Aktif','b9700000-0000-0000-0000-000000000001',false);
INSERT INTO public.audit_team_master_members(team_id,auditor_id,peran,urutan_tampil,is_team_leader)VALUES('b9750000-0000-0000-0000-000000000001','b9100000-0000-0000-0000-000000000001','Lead',1,true);
SELECT public.lock_audit_team_master('b9750000-0000-0000-0000-000000000001');
INSERT INTO public.audit_programs(id,plan_id,jenis_ronde,nomor_ke,tahun,tanggal_dibuat,status)VALUES('b9800000-0000-0000-0000-000000000001','b9700000-0000-0000-0000-000000000001','Berkala',1,2026,'2026-01-01','Approved');
INSERT INTO public.audit_instructions(id,program_id,tahun_fiskal,status)VALUES('b9900000-0000-0000-0000-000000000001','b9800000-0000-0000-0000-000000000001',2026,'Selesai');
INSERT INTO public.audit_instructions(id,program_id,tahun_fiskal,status)VALUES('b9900000-0000-0000-0000-000000000002','b9800000-0000-0000-0000-000000000001',2026,'Selesai');
INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,proses_id,seksi_marks,tipe_baris,tanggal_pelaksanaan_audit,cek_selesai,urutan_tampil,team_master_id)VALUES
('ba000000-0000-0000-0000-000000000001','b9900000-0000-0000-0000-000000000001','QA-S1','b9300000-0000-0000-0000-000000000001','[{"seksi_id":"b9200000-0000-0000-0000-000000000001","tipe":"target"}]','Reguler','2026-09-18',false,1,'b9750000-0000-0000-0000-000000000001'),
('ba000000-0000-0000-0000-000000000002','b9900000-0000-0000-0000-000000000001','QA-S2','b9300000-0000-0000-0000-000000000001','[{"seksi_id":"b9200000-0000-0000-0000-000000000002","tipe":"terkait"}]','Reguler','2026-09-19',false,2,'b9750000-0000-0000-0000-000000000001');
INSERT INTO public.checklists(row_id,kode_audit,judul_checklist)VALUES('ba000000-0000-0000-0000-000000000001','QA-S1','B9'),('ba000000-0000-0000-0000-000000000002','QA-S2','B9');
SELECT pg_temp.claim('b9000000-0000-0000-0000-000000000002');
SELECT set_config('certitrack.execution_completion','1',true);
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id IN('ba000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000002');
SELECT set_config('certitrack.execution_completion','',true);
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,proses_id,seksi_marks,tipe_baris,tanggal_pelaksanaan_audit,cek_selesai,urutan_tampil,team_master_id)VALUES('ba000000-0000-0000-0000-000000000005','b9900000-0000-0000-0000-000000000002','QA-LEAD','b9300000-0000-0000-0000-000000000001','[]','Reguler','2026-09-20',false,1,'b9750000-0000-0000-0000-000000000001');
INSERT INTO public.checklists(row_id,kode_audit,judul_checklist)VALUES('ba000000-0000-0000-0000-000000000005','QA-LEAD','B9 Lead');
SELECT pg_temp.claim('b9000000-0000-0000-0000-000000000002');
SELECT set_config('certitrack.execution_completion','1',true);
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id='ba000000-0000-0000-0000-000000000005';
SELECT set_config('certitrack.execution_completion','',true);
SELECT set_config('request.jwt.claims','{}',true);
ALTER TABLE public.findings DISABLE TRIGGER trg_prepare_draft_finding_insert;
INSERT INTO public.findings(id,instruction_row_id,kode_audit,kode_temuan,nomor_urut_temuan,source_type,source_item_id,kategori,problem,location,objective_evidence,reference,tanggal_temuan,review_status)VALUES
('bb000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','QA-S1','B9/SYS/001',1,'ChecklistSistem','bc000000-0000-0000-0000-000000000001','A','Problem A','Lokasi A','Bukti A','ISO 1','2026-09-18','PUBLISHED'),
('bb000000-0000-0000-0000-000000000002','ba000000-0000-0000-0000-000000000002','QA-S2','B9/SYS/002',1,'ChecklistSistem','bc000000-0000-0000-0000-000000000002','B','Problem B','Lokasi B','Bukti B','ISO 2','2026-09-19','LEGACY_ESTABLISHED'),
('bb000000-0000-0000-0000-000000000003','ba000000-0000-0000-0000-000000000001','QA-S1',NULL,2,'ChecklistSistem','bc000000-0000-0000-0000-000000000003','A',NULL,NULL,NULL,NULL,'2026-09-18','DRAFT'),
('bb000000-0000-0000-0000-000000000004','ba000000-0000-0000-0000-000000000001','QA-S1','B9/MFG/001',3,'ChecklistManufakturShift','bc000000-0000-0000-0000-000000000004','A','MFG','MFG','MFG','MFG','2026-09-18','PUBLISHED');
ALTER TABLE public.findings ENABLE TRIGGER trg_prepare_draft_finding_insert;

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
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);
UPDATE public.user_profiles SET status='Nonaktif' WHERE id='b9000000-0000-0000-0000-000000000002';SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_lead_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports r,b9_lead_result x WHERE r.id=x.report_id)),'Company Lead Auditor aktif');
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);UPDATE public.user_profiles SET status='Aktif' WHERE id='b9000000-0000-0000-0000-000000000002';UPDATE public.auditors SET status='Nonaktif' WHERE id='b9100000-0000-0000-0000-000000000001';SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_lead_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports r,b9_lead_result x WHERE r.id=x.report_id)),'Company Lead Auditor aktif');
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);UPDATE public.auditors SET status='Aktif' WHERE id='b9100000-0000-0000-0000-000000000001';ALTER TABLE public.user_profiles DISABLE TRIGGER trg_protect_profile_identity_mapping;UPDATE public.user_profiles SET identity_type='ADMIN' WHERE id='b9000000-0000-0000-0000-000000000002';ALTER TABLE public.user_profiles ENABLE TRIGGER trg_protect_profile_identity_mapping;SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_lead_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports r,b9_lead_result x WHERE r.id=x.report_id)),'Company Lead Auditor aktif');
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);ALTER TABLE public.user_profiles DISABLE TRIGGER trg_protect_profile_identity_mapping;UPDATE public.user_profiles SET identity_type='AUDITOR' WHERE id='b9000000-0000-0000-0000-000000000002';ALTER TABLE public.user_profiles ENABLE TRIGGER trg_protect_profile_identity_mapping;

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

-- Draft Keterangan preservation across regeneration and population changes.
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT public.save_rangkuman_hasil_audit_draft(r.report_id,x.revision_version,'B9 Catatan',jsonb_build_object('bb000000-0000-0000-0000-000000000001','Keep A')) FROM b9_result r JOIN public.rangkuman_hasil_audit_reports x ON x.id=r.report_id;
SELECT public.form014_refresh_population(report_id) FROM b9_result;
SELECT pg_temp.assert_true((SELECT keterangan='Keep A' FROM public.rangkuman_hasil_audit_items i,b9_result r WHERE i.report_id=r.report_id AND i.finding_id='bb000000-0000-0000-0000-000000000001'),'Keterangan must survive Regenerate for an existing Finding');

RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);
ALTER TABLE public.findings DISABLE TRIGGER trg_prepare_draft_finding_insert;
INSERT INTO public.findings(id,instruction_row_id,kode_audit,kode_temuan,nomor_urut_temuan,source_type,source_item_id,kategori,problem,location,objective_evidence,reference,tanggal_temuan,review_status)
VALUES('bb000000-0000-0000-0000-000000000005','ba000000-0000-0000-0000-000000000002','QA-S2','B9/SYS/005',2,'ChecklistSistem','bc000000-0000-0000-0000-000000000005','C','Problem C','Lokasi C','Bukti C','ISO 5','2026-09-19','PUBLISHED');
ALTER TABLE public.findings ENABLE TRIGGER trg_prepare_draft_finding_insert;

SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT public.form014_refresh_population(report_id) FROM b9_result;
SELECT pg_temp.assert_true((SELECT keterangan='Keep A' FROM public.rangkuman_hasil_audit_items i,b9_result r WHERE i.report_id=r.report_id AND i.finding_id='bb000000-0000-0000-0000-000000000001'),'existing Finding Keterangan must remain after adding a Finding');
SELECT pg_temp.assert_true((SELECT keterangan IS NULL FROM public.rangkuman_hasil_audit_items i,b9_result r WHERE i.report_id=r.report_id AND i.finding_id='bb000000-0000-0000-0000-000000000005'),'new Finding must not inherit another Finding Keterangan');

RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);
ALTER TABLE public.findings DISABLE TRIGGER trg_protect_finding_update;
UPDATE public.findings SET review_status='ANNULLED' WHERE id='bb000000-0000-0000-0000-000000000001';
ALTER TABLE public.findings ENABLE TRIGGER trg_protect_finding_update;

SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT public.form014_refresh_population(report_id) FROM b9_result;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM public.rangkuman_hasil_audit_items i,b9_result r WHERE i.report_id=r.report_id AND i.finding_id='bb000000-0000-0000-0000-000000000001'),'Finding leaving formal population must be removed on Regenerate');
SELECT pg_temp.assert_true((SELECT keterangan IS NULL FROM public.rangkuman_hasil_audit_items i,b9_result r WHERE i.report_id=r.report_id AND i.finding_id='bb000000-0000-0000-0000-000000000005'),'removed Finding Keterangan must not transfer');

-- LTP snapshot fixture: latest targets and CLOSE_TO_ADMIN verification only.
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO public.cars(id,finding_id,kode_car,status) VALUES('bd000000-0000-0000-0000-000000000001','bb000000-0000-0000-0000-000000000002','CAR-B9-001','CLOSED');
INSERT INTO public.car_actions(id,car_id,action_type,description,due_date,sort_order) VALUES
('be000000-0000-0000-0000-000000000001','bd000000-0000-0000-0000-000000000001','TEMPORARY','Temp 1','2026-09-21',1),
('be000000-0000-0000-0000-000000000002','bd000000-0000-0000-0000-000000000001','TEMPORARY','Temp 2','2026-09-25',2),
('be000000-0000-0000-0000-000000000003','bd000000-0000-0000-0000-000000000001','CORRECTIVE','Corrective','2026-10-01',1),
('be000000-0000-0000-0000-000000000004','bd000000-0000-0000-0000-000000000001','PREVENTIVE','Preventive','2026-10-05',1);
INSERT INTO public.car_workflow_events(id,car_id,event_type,actor_user_id,actor_identity_type,created_at) VALUES
('bf000000-0000-0000-0000-000000000001','bd000000-0000-0000-0000-000000000001','AUDITOR_VERIFIED_CLOSE_TO_ADMIN','b9000000-0000-0000-0000-000000000002','AUDITOR','2026-09-20T01:00:00Z'),
('bf000000-0000-0000-0000-000000000002','bd000000-0000-0000-0000-000000000001','AUDITOR_VERIFIED_OPEN_TO_AUDITEE','b9000000-0000-0000-0000-000000000002','AUDITOR','2026-09-21T01:00:00Z'),
('bf000000-0000-0000-0000-000000000003','bd000000-0000-0000-0000-000000000001','AUDITOR_VERIFIED_CLOSE_TO_ADMIN','b9000000-0000-0000-0000-000000000002','AUDITOR','2026-09-22T01:00:00Z');

-- Real fail-closed Product/Manufacturing context execution using persisted composite rows.
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,proses_id,tipe_baris,matriks_produk_marks,matriks_manufaktur_shift_marks,tanggal_pelaksanaan_audit,tanggal_audit_produk,team_master_id)VALUES
('ba000000-0000-0000-0000-000000000003','b9900000-0000-0000-0000-000000000001','QA-P1','b9300000-0000-0000-0000-000000000001','AuditProduk','[{"plant_id":"b9400000-0000-0000-0000-000000000001","target_model_id":"b9600000-0000-0000-0000-000000000001"},{"plant_id":"b9400000-0000-0000-0000-000000000001","target_model_id":"b9600000-0000-0000-0000-000000000002"}]','[]','2026-09-18','2026-09-18','b9750000-0000-0000-0000-000000000001'),
('ba000000-0000-0000-0000-000000000004','b9900000-0000-0000-0000-000000000001','QA-M1','b9300000-0000-0000-0000-000000000001','AuditManufaktur','[]','[{"plant_id":"b9400000-0000-0000-0000-000000000001","shift_id":"b9500000-0000-0000-0000-000000000001"}]','2026-09-18',NULL,'b9750000-0000-0000-0000-000000000001');
INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,proses_id,tipe_baris,matriks_produk_marks,matriks_manufaktur_shift_marks,tanggal_pelaksanaan_audit,tanggal_audit_produk,cek_selesai,urutan_tampil,team_master_id)VALUES
('ba000000-0000-0000-0000-000000000006','b9900000-0000-0000-0000-000000000001','QA-P2','b9300000-0000-0000-0000-000000000001','AuditProduk','[{"plant_id":"b9400000-0000-0000-0000-000000000002","target_model_id":"b9600000-0000-0000-0000-000000000001"}]','[]','2026-09-20','2026-09-20',false,4,'b9750000-0000-0000-0000-000000000001'),
('ba000000-0000-0000-0000-000000000007','b9900000-0000-0000-0000-000000000001','QA-M2','b9300000-0000-0000-0000-000000000001','AuditManufaktur','[]','[{"plant_id":"b9400000-0000-0000-0000-000000000001","shift_id":"b9500000-0000-0000-0000-000000000003"}]','2026-09-20',NULL,false,5,'b9750000-0000-0000-0000-000000000001');
INSERT INTO public.checklist_produk(row_id,kode_audit)VALUES('ba000000-0000-0000-0000-000000000003','QA-P1'),('ba000000-0000-0000-0000-000000000006','QA-P2');
INSERT INTO public.checklist_manufaktur_shift(row_id,kode_audit)VALUES('ba000000-0000-0000-0000-000000000004','QA-M1'),('ba000000-0000-0000-0000-000000000007','QA-M2');
SELECT pg_temp.claim('b9000000-0000-0000-0000-000000000002');
SELECT set_config('certitrack.execution_completion','1',true);
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id IN('ba000000-0000-0000-0000-000000000003','ba000000-0000-0000-0000-000000000004','ba000000-0000-0000-0000-000000000006','ba000000-0000-0000-0000-000000000007');
SELECT set_config('certitrack.execution_completion','',true);
SELECT set_config('request.jwt.claims','{}',true);
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
CREATE TEMP TABLE b9_product AS SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000001','ChecklistProduk') report_id;
CREATE TEMP TABLE b9_mfg AS SELECT public.create_rangkuman_hasil_audit('b9900000-0000-0000-0000-000000000001','ChecklistManufakturShift') report_id;
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.rangkuman_hasil_audit_groups g,b9_product r WHERE g.report_id=r.report_id AND g.label_snapshot IN('Audit Produk Fact 1','Audit Produk Fact 2')),'Product generation must create isolated Plant groups');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM public.rangkuman_hasil_audit_groups g,b9_mfg r WHERE g.report_id=r.report_id AND g.label_snapshot IN('Audit Manufaktur Shift 1 Fact 1','Audit Manufaktur Shift 2 Fact 1')),'Manufacturing generation must create isolated QA groups');
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);
CREATE TEMP TABLE b9_mfg_state AS SELECT public.form014_source_state(report_id) state FROM b9_mfg;
SELECT pg_temp.claim('b9000000-0000-0000-0000-000000000001');
UPDATE public.audit_instruction_rows SET matriks_manufaktur_shift_marks=matriks_manufaktur_shift_marks||matriks_manufaktur_shift_marks WHERE id='ba000000-0000-0000-0000-000000000004';
SELECT pg_temp.assert_true((SELECT state=public.form014_source_state((SELECT report_id FROM b9_mfg))FROM b9_mfg_state),'duplicate/reordered Manufacturing marks must normalize without false drift');
SELECT pg_temp.assert_true((SELECT public.form014_validate_context(r,'ChecklistProduk')='Audit Produk Fact 1' FROM public.audit_instruction_rows r WHERE id='ba000000-0000-0000-0000-000000000003'),'same-Plant multi-model Product context must pass');
SELECT pg_temp.assert_true((SELECT public.form014_validate_context(r,'ChecklistManufakturShift')='Audit Manufaktur Shift 1 Fact 1' FROM public.audit_instruction_rows r WHERE id='ba000000-0000-0000-0000-000000000004'),'Manufacturing label mismatch');
UPDATE public.audit_instruction_rows SET matriks_manufaktur_shift_marks='[{"plant_id":"b9400000-0000-0000-0000-000000000001","shift_id":"b9500000-0000-0000-0000-000000000002"}]' WHERE id='ba000000-0000-0000-0000-000000000004';
SELECT pg_temp.expect_error($q$SELECT public.form014_validate_context(r,'ChecklistManufakturShift')FROM public.audit_instruction_rows r WHERE id='ba000000-0000-0000-0000-000000000004'$q$,'konteks Plant/Shift tidak valid');
UPDATE public.audit_instruction_rows SET matriks_produk_marks='[{"plant_id":"malformed","target_model_id":null}]' WHERE id='ba000000-0000-0000-0000-000000000003';
SELECT pg_temp.expect_error($q$SELECT public.form014_validate_context(r,'ChecklistProduk')FROM public.audit_instruction_rows r WHERE id='ba000000-0000-0000-0000-000000000003'$q$,'konteks Plant tidak valid');

-- Real completion, source-state and fiscal-year drift rejection.
RESET ROLE; SELECT pg_temp.claim('b9000000-0000-0000-0000-000000000002');
SELECT set_config('certitrack.execution_completion','1',true);
UPDATE public.audit_instruction_rows SET cek_selesai=false WHERE id='ba000000-0000-0000-0000-000000000005';
SELECT set_config('certitrack.execution_completion','',true);
SELECT set_config('request.jwt.claims','{}',true);
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_lead_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports x,b9_lead_result r WHERE x.id=r.report_id)),'Status pelaksanaan audit berubah');
RESET ROLE; SELECT pg_temp.claim('b9000000-0000-0000-0000-000000000002');
SELECT set_config('certitrack.execution_completion','1',true);
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id='ba000000-0000-0000-0000-000000000005';
SELECT set_config('certitrack.execution_completion','',true);
SELECT set_config('request.jwt.claims','{}',true);
UPDATE public.audit_instructions SET tahun_fiskal=2027 WHERE id='b9900000-0000-0000-0000-000000000001';
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error(format('SELECT public.finalize_rangkuman_hasil_audit(%L,%s)',(SELECT report_id FROM b9_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports x,b9_result r WHERE x.id=r.report_id)),'Data sumber FORM-014 berubah');
-- Real valid Finalization and immutable report/children/RPC behavior.
RESET ROLE; SELECT set_config('request.jwt.claim.sub','',true); SELECT set_config('request.jwt.claims','{}',true);
UPDATE public.audit_instructions SET tahun_fiskal=2026 WHERE id='b9900000-0000-0000-0000-000000000001';
SELECT pg_temp.actor('b9000000-0000-0000-0000-000000000001');
SELECT public.form014_refresh_population(report_id)FROM b9_result;
SELECT public.finalize_rangkuman_hasil_audit(r.report_id,x.revision_version)FROM b9_result r JOIN public.rangkuman_hasil_audit_reports x ON x.id=r.report_id;
SELECT pg_temp.assert_true((SELECT status='Final' AND finalized_at IS NOT NULL AND lead_auditor_name_snapshot='B9 Company Lead' AND pj_qms_snapshot='B9 PJ QMS' FROM public.rangkuman_hasil_audit_reports x,b9_result r WHERE x.id=r.report_id),'valid Final snapshot failed');
SELECT pg_temp.assert_true((SELECT temporary_target_snapshot='2026-09-25'::date AND permanent_target_snapshot='2026-10-05'::date AND verification_date_snapshot='2026-09-22T01:00:00Z'::timestamptz AND car_status_snapshot='CLOSED' FROM public.rangkuman_hasil_audit_items i,b9_result r WHERE i.report_id=r.report_id AND i.finding_id='bb000000-0000-0000-0000-000000000002'),'Final LTP snapshot must use max targets, latest CLOSE_TO_ADMIN, and CAR status');
SELECT pg_temp.assert_true((SELECT temporary_target_snapshot IS NULL AND permanent_target_snapshot IS NULL AND verification_date_snapshot IS NULL AND car_status_snapshot='MISSING' FROM public.rangkuman_hasil_audit_items i,b9_result r WHERE i.report_id=r.report_id AND i.finding_id='bb000000-0000-0000-0000-000000000005'),'formal Finding without CAR must remain with MISSING snapshot');

CREATE TEMP TABLE b9_frozen AS
SELECT r.id report_id,r.tahun_fiskal,r.audit_date_start,r.audit_date_end,r.lead_auditor_name_snapshot,r.pj_qms_snapshot,
       g.id group_id,g.label_snapshot,g.process_owner_snapshot,g.related_sections_snapshot,
       i.id item_id,i.finding_id,i.problem_snapshot,i.location_snapshot,i.reference_snapshot,i.kategori_snapshot,
       i.temporary_target_snapshot,i.permanent_target_snapshot,i.verification_date_snapshot,i.car_status_snapshot,i.keterangan
FROM public.rangkuman_hasil_audit_reports r
JOIN public.rangkuman_hasil_audit_groups g ON g.report_id=r.id
JOIN public.rangkuman_hasil_audit_items i ON i.group_id=g.id
WHERE r.id=(SELECT report_id FROM b9_result)
  AND i.finding_id='bb000000-0000-0000-0000-000000000002';
SELECT pg_temp.expect_error(format('UPDATE public.rangkuman_hasil_audit_reports SET catatan=%L WHERE id=%L','mutate',(SELECT report_id FROM b9_result)),'');
SELECT pg_temp.expect_error(format('DELETE FROM public.rangkuman_hasil_audit_reports WHERE id=%L',(SELECT report_id FROM b9_result)),'');
SELECT pg_temp.expect_error(format('SELECT public.form014_refresh_population(%L)',(SELECT report_id FROM b9_result)),'Final tidak dapat diregenerasi');
SELECT pg_temp.expect_error(format('SELECT public.save_rangkuman_hasil_audit_draft(%L,%s,%L,%L::jsonb)',(SELECT report_id FROM b9_result),(SELECT revision_version FROM public.rangkuman_hasil_audit_reports x,b9_result r WHERE x.id=r.report_id),'x','{}'),'Final bersifat immutable');
SELECT pg_temp.expect_error(format('INSERT INTO public.rangkuman_hasil_audit_groups(report_id,group_key,group_sort_order,qa_code,completed)VALUES(%L,%L,99,%L,true)',(SELECT report_id FROM b9_result),'late','late'),'');
RESET ROLE; SELECT set_config('request.jwt.claim.sub','b9000000-0000-0000-0000-000000000001',true); SELECT set_config('request.jwt.claims',jsonb_build_object('sub','b9000000-0000-0000-0000-000000000001','role','authenticated')::text,true);
SELECT pg_temp.expect_error(format('UPDATE public.rangkuman_hasil_audit_groups SET label_snapshot=%L WHERE id=%L','mutated',(SELECT group_id FROM b9_frozen)),'Final bersifat immutable');
SELECT pg_temp.expect_error(format('DELETE FROM public.rangkuman_hasil_audit_groups WHERE id=%L',(SELECT group_id FROM b9_frozen)),'Final bersifat immutable');
SELECT pg_temp.expect_error(format('UPDATE public.rangkuman_hasil_audit_items SET keterangan=%L WHERE id=%L','mutated',(SELECT item_id FROM b9_frozen)),'Final bersifat immutable');
SELECT pg_temp.expect_error(format('DELETE FROM public.rangkuman_hasil_audit_items WHERE id=%L',(SELECT item_id FROM b9_frozen)),'Final bersifat immutable');
SELECT pg_temp.expect_error(format('INSERT INTO public.rangkuman_hasil_audit_items(report_id,group_id,finding_id,finding_sort_order)VALUES(%L,%L,%L,99)',(SELECT report_id FROM b9_result),(SELECT group_id FROM b9_frozen),'bb000000-0000-0000-0000-000000000003'),'Final bersifat immutable');
SELECT pg_temp.expect_error(format('DELETE FROM public.rangkuman_hasil_audit_group_rows WHERE id=(SELECT id FROM public.rangkuman_hasil_audit_group_rows WHERE group_id=%L LIMIT 1)',(SELECT group_id FROM b9_frozen)),'Final bersifat immutable');

-- Upstream changes after Final must not alter frozen FORM-014 snapshots.
ALTER TABLE public.findings DISABLE TRIGGER trg_protect_finding_update;
ALTER TABLE public.findings DISABLE TRIGGER trg_protect_completed_audit_plor;
UPDATE public.findings SET problem='Changed after Final',location='Changed location',reference='Changed ref',kategori='C' WHERE id='bb000000-0000-0000-0000-000000000002';
ALTER TABLE public.findings ENABLE TRIGGER trg_protect_completed_audit_plor;
ALTER TABLE public.findings ENABLE TRIGGER trg_protect_finding_update;
UPDATE public.proses SET nama_proses='Changed Process' WHERE id='b9300000-0000-0000-0000-000000000001';
UPDATE public.seksi SET nama='Changed Owner' WHERE id='b9200000-0000-0000-0000-000000000001';
UPDATE public.car_actions SET due_date='2027-01-01' WHERE id='be000000-0000-0000-0000-000000000002';
INSERT INTO public.car_workflow_events(id,car_id,event_type,actor_user_id,actor_identity_type,created_at)
VALUES('bf000000-0000-0000-0000-000000000004','bd000000-0000-0000-0000-000000000001','AUDITOR_VERIFIED_CLOSE_TO_ADMIN','b9000000-0000-0000-0000-000000000002','AUDITOR','2027-01-02T01:00:00Z');

SELECT pg_temp.assert_true((SELECT i.problem_snapshot=f.problem_snapshot AND i.location_snapshot=f.location_snapshot AND i.reference_snapshot=f.reference_snapshot AND i.kategori_snapshot=f.kategori_snapshot AND i.temporary_target_snapshot=f.temporary_target_snapshot AND i.permanent_target_snapshot=f.permanent_target_snapshot AND i.verification_date_snapshot=f.verification_date_snapshot AND i.car_status_snapshot=f.car_status_snapshot FROM public.rangkuman_hasil_audit_items i JOIN b9_frozen f ON f.item_id=i.id),'Final item snapshots must remain stable after upstream mutation');
SELECT pg_temp.assert_true((SELECT g.label_snapshot=f.label_snapshot AND g.process_owner_snapshot=f.process_owner_snapshot AND g.related_sections_snapshot=f.related_sections_snapshot FROM public.rangkuman_hasil_audit_groups g JOIN b9_frozen f ON f.group_id=g.id),'Final group snapshots must remain stable after upstream mutation');
ROLLBACK;
