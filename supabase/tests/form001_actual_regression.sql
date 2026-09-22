-- Run only after 20260922120000 on an isolated local/Staging database.
-- All identities, domain fixtures, overrides, and history events are rolled back.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.assert_true(ok boolean,message text)RETURNS void LANGUAGE plpgsql AS $$BEGIN IF NOT COALESCE(ok,false)THEN RAISE EXCEPTION 'FORM001 ACTUAL ASSERT: %',message;END IF;END$$;
CREATE OR REPLACE FUNCTION pg_temp.actor(id uuid)RETURNS void LANGUAGE plpgsql AS $$BEGIN PERFORM set_config('request.jwt.claim.sub',id::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated')::text,true);PERFORM set_config('role','authenticated',true);END$$;
CREATE OR REPLACE FUNCTION pg_temp.expect_error(sql_text text,needle text)RETURNS void LANGUAGE plpgsql AS $$BEGIN EXECUTE sql_text;RAISE EXCEPTION 'FORM001 ACTUAL ASSERT: expected error containing %',needle;EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FORM001 ACTUAL ASSERT:%' THEN RAISE;END IF;IF position(needle in SQLERRM)=0 THEN RAISE EXCEPTION 'FORM001 ACTUAL ASSERT: expected %, got %',needle,SQLERRM;END IF;END$$;

RESET ROLE;SELECT set_config('request.jwt.claim.sub','',true);SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)VALUES
('00000000-0000-0000-0000-000000000000','f1000000-0000-0000-0000-000000000001','authenticated','authenticated','form001-admin@test.local','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','f1000000-0000-0000-0000-000000000002','authenticated','authenticated','form001-auditor@test.local','',now(),'{}','{}',now(),now());
INSERT INTO public.user_profiles(id,display_name,identity_type,status)VALUES
('f1000000-0000-0000-0000-000000000001','FORM001 Admin','ADMIN','Aktif'),
('f1000000-0000-0000-0000-000000000002','FORM001 Non Admin','AUDITOR','Aktif');
INSERT INTO public.proses(id,nama_proses,kode_proses)VALUES('f1100000-0000-0000-0000-000000000001','FORM001 Process','F1-PROC');
INSERT INTO public.audit_plans(id,tahun,tanggal_berlaku,kode_dokumen,status)VALUES('f1200000-0000-0000-0000-000000000001',2026,'2026-04-01','Q-120-ISE-001-FORM-001','Approved');
INSERT INTO public.audit_plan_process(id,plan_id,proses_master_id,nama_proses,urutan_tampil)VALUES('f1300000-0000-0000-0000-000000000001','f1200000-0000-0000-0000-000000000001','f1100000-0000-0000-0000-000000000001','FORM001 Process',1);
INSERT INTO public.audit_programs(id,plan_id,jenis_ronde,nomor_ke,tahun,tanggal_dibuat,status)VALUES('f1400000-0000-0000-0000-000000000001','f1200000-0000-0000-0000-000000000001','Berkala',1,2026,'2026-04-01','Approved');
INSERT INTO public.audit_instructions(id,program_id,tahun_fiskal,status)VALUES('f1500000-0000-0000-0000-000000000001','f1400000-0000-0000-0000-000000000001',2026,'Selesai');

-- Rows: zero Finding, pending/annulled, two-QA reconciliation, Product date ownership, Manufacturing date ownership.
INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,proses_id,tipe_baris,tanggal_pelaksanaan_audit,tanggal_audit_produk,cek_selesai,urutan_tampil)VALUES
('f1600000-0000-0000-0000-000000000001','f1500000-0000-0000-0000-000000000001','QA-F101','f1100000-0000-0000-0000-000000000001','Reguler','2026-04-10',NULL,false,1),
('f1600000-0000-0000-0000-000000000002','f1500000-0000-0000-0000-000000000001','QA-F102','f1100000-0000-0000-0000-000000000001','Reguler','2026-05-10',NULL,false,2),
('f1600000-0000-0000-0000-000000000003','f1500000-0000-0000-0000-000000000001','QA-F103','f1100000-0000-0000-0000-000000000001','Reguler','2026-06-10',NULL,false,3),
('f1600000-0000-0000-0000-000000000004','f1500000-0000-0000-0000-000000000001','QA-F104','f1100000-0000-0000-0000-000000000001','Reguler','2026-07-10',NULL,false,4),
('f1600000-0000-0000-0000-000000000005','f1500000-0000-0000-0000-000000000001','QA-F105','f1100000-0000-0000-0000-000000000001','Reguler','2026-07-20',NULL,false,5),
('f1600000-0000-0000-0000-000000000006','f1500000-0000-0000-0000-000000000001','QA-F106','f1100000-0000-0000-0000-000000000001','AuditProduk','2026-12-20','2027-01-15',false,6),
('f1600000-0000-0000-0000-000000000007','f1500000-0000-0000-0000-000000000001','QA-F107','f1100000-0000-0000-0000-000000000001','AuditManufaktur','2027-03-15',NULL,false,7);

INSERT INTO public.checklists(id,row_id,kode_audit,judul_checklist) SELECT ('f1700000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('f1600000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'QA-F10'||n,'Fixture' FROM generate_series(1,5)n;
INSERT INTO public.checklist_items(id,checklist_id,sub_proses,kelompok_ipo,nomor,pertanyaan_utama,metode_verifikasi,hasil,komentar_auditor)
SELECT ('f1800000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,('f1700000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'Sub','Input Proses',n::text,'Question','Observasi','O','Observed' FROM generate_series(1,5)n;

INSERT INTO public.checklist_produk(id,row_id,kode_audit,status)VALUES('f1900000-0000-0000-0000-000000000001','f1600000-0000-0000-0000-000000000006','QA-F106','Draft');
INSERT INTO public.checklist_produk_fase(id,checklist_produk_id,nama_fase,dokumen_bukti)VALUES('f1910000-0000-0000-0000-000000000001','f1900000-0000-0000-0000-000000000001','Fase','["fixture"]');
INSERT INTO public.checklist_produk_items(id,fase_id,item_pemeriksaan)VALUES('f1920000-0000-0000-0000-000000000001','f1910000-0000-0000-0000-000000000001','Item');
UPDATE public.checklist_produk SET status='Selesai' WHERE id='f1900000-0000-0000-0000-000000000001';
ALTER TABLE public.checklist_produk_items DISABLE TRIGGER trg_identity_product_execution;
UPDATE public.checklist_produk_items SET hasil_pemeriksaan='OK',judgment='OK' WHERE id='f1920000-0000-0000-0000-000000000001';
ALTER TABLE public.checklist_produk_items ENABLE TRIGGER trg_identity_product_execution;
INSERT INTO public.checklist_manufaktur_shift(id,row_id,kode_audit,status)VALUES('f1a00000-0000-0000-0000-000000000001','f1600000-0000-0000-0000-000000000007','QA-F107','Draft');
INSERT INTO public.checklist_manufaktur_items(id,checklist_id,no_proses_dicek)VALUES('f1a10000-0000-0000-0000-000000000001','f1a00000-0000-0000-0000-000000000001','1');
UPDATE public.checklist_manufaktur_shift SET status='Selesai' WHERE id='f1a00000-0000-0000-0000-000000000001';
ALTER TABLE public.checklist_manufaktur_items DISABLE TRIGGER trg_identity_manufacturing_execution;
UPDATE public.checklist_manufaktur_items SET hasil_pengamatan='Observed',hasil='O' WHERE id='f1a10000-0000-0000-0000-000000000001';
ALTER TABLE public.checklist_manufaktur_items ENABLE TRIGGER trg_identity_manufacturing_execution;

ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER trg_identity_instruction_completion;
ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER trg_protect_audit_execution_completion;
ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER trg_require_auditor_execution_transition;
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE instruction_id='f1500000-0000-0000-0000-000000000001';
ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER trg_require_auditor_execution_transition;
ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER trg_protect_audit_execution_completion;
ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER trg_identity_instruction_completion;

ALTER TABLE public.findings DISABLE TRIGGER trg_prepare_draft_finding_insert;
INSERT INTO public.findings(id,instruction_row_id,kode_audit,kode_temuan,nomor_urut_temuan,source_type,source_item_id,kategori,problem,location,objective_evidence,reference,tanggal_temuan,review_status)VALUES
('f1b00000-0000-0000-0000-000000000001','f1600000-0000-0000-0000-000000000002','QA-F102','QA-F102/SYS/2026/001',1,'ChecklistSistem','f1c00000-0000-0000-0000-000000000001','A','P','L','E','R','2026-05-10','DRAFT'),
('f1b00000-0000-0000-0000-000000000002','f1600000-0000-0000-0000-000000000003','QA-F103','QA-F103/SYS/2026/001',1,'ChecklistSistem','f1c00000-0000-0000-0000-000000000002','B','P','L','E','R','2026-06-10','ANNULLED');
ALTER TABLE public.findings ENABLE TRIGGER trg_prepare_draft_finding_insert;

SELECT public.reconcile_annual_plan_actual('f1300000-0000-0000-0000-000000000001',m) FROM unnest(ARRAY[1,3,4,5,6,7])m;
SELECT pg_temp.assert_true((SELECT aktual FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=4),'completed ZERO FINDING must auto TRUE');
SELECT pg_temp.assert_true((SELECT NOT aktual FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=5),'pending Finding must keep Actual FALSE');
SELECT pg_temp.assert_true((SELECT aktual FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=6),'ANNULLED Finding must not block');
SELECT pg_temp.assert_true((SELECT aktual FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=7),'two qualifying QAs must produce TRUE');
SELECT pg_temp.assert_true((SELECT aktual FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=1),'Product must use tanggal_audit_produk, including fiscal rollover month 1');
SELECT pg_temp.assert_true((SELECT aktual FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=3),'Manufacturing must use tanggal_pelaksanaan_audit');

ALTER TABLE public.findings DISABLE TRIGGER trg_protect_finding_update;
UPDATE public.findings SET review_status='PUBLISHED' WHERE id='f1b00000-0000-0000-0000-000000000001';
ALTER TABLE public.findings ENABLE TRIGGER trg_protect_finding_update;
SELECT pg_temp.assert_true((SELECT aktual FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=5),'all Findings established must produce TRUE');

-- Reopen one of two July QAs; the other qualifying QA must keep Actual true.
ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER trg_identity_instruction_completion;ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER trg_protect_audit_execution_completion;ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER trg_require_auditor_execution_transition;
UPDATE public.audit_instruction_rows SET cek_selesai=false WHERE id='f1600000-0000-0000-0000-000000000004';
ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER trg_require_auditor_execution_transition;ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER trg_protect_audit_execution_completion;ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER trg_identity_instruction_completion;
SELECT pg_temp.assert_true((SELECT aktual FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=7),'reopening one of two qualifying QAs must not clear Actual');
ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER trg_identity_instruction_completion;ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER trg_protect_audit_execution_completion;ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER trg_require_auditor_execution_transition;
UPDATE public.audit_instruction_rows SET cek_selesai=false WHERE id='f1600000-0000-0000-0000-000000000005';
ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER trg_require_auditor_execution_transition;ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER trg_protect_audit_execution_completion;ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER trg_identity_instruction_completion;
SELECT pg_temp.assert_true((SELECT NOT aktual FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=7),'reopened final qualifying execution must clear automatic Actual');

SELECT pg_temp.actor('f1000000-0000-0000-0000-000000000002');
SELECT pg_temp.expect_error($q$SELECT public.override_annual_plan_actual('f1300000-0000-0000-0000-000000000001',4,'SET_FALSE','Non Admin attempt')$q$,'Hanya Admin');
SELECT pg_temp.actor('f1000000-0000-0000-0000-000000000001');
SELECT pg_temp.expect_error($q$SELECT public.override_annual_plan_actual('f1300000-0000-0000-0000-000000000001',4,'SET_FALSE','   ')$q$,'wajib diisi');
SELECT public.override_annual_plan_actual('f1300000-0000-0000-0000-000000000001',4,'SET_FALSE','Controlled clear for regression');
SELECT pg_temp.assert_true((SELECT NOT aktual AND aktual_override=false FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=4),'Admin Clear Actual must succeed');
SELECT public.reconcile_annual_plan_actual('f1300000-0000-0000-0000-000000000001',4);
SELECT pg_temp.assert_true((SELECT NOT aktual AND aktual_auto AND aktual_override=false FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=4),'automatic reconciliation must not overwrite Admin override');
SELECT public.override_annual_plan_actual('f1300000-0000-0000-0000-000000000001',5,'SET_TRUE','Controlled set for regression');
SELECT pg_temp.assert_true((SELECT aktual AND aktual_override=true FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=5),'Admin Set Actual must succeed');
SELECT public.override_annual_plan_actual('f1300000-0000-0000-0000-000000000001',4,'RETURN_TO_AUTO',NULL);
SELECT pg_temp.assert_true((SELECT aktual AND aktual_override IS NULL AND aktual_auto FROM public.audit_plan_schedule WHERE process_id='f1300000-0000-0000-0000-000000000001' AND bulan=4),'Return to Automatic must recompute authoritative TRUE');

SELECT pg_temp.actor('f1000000-0000-0000-0000-000000000002');
SELECT pg_temp.expect_error($q$UPDATE public.audit_plan_actual_override_events SET reason='tamper'$q$,'permission denied');
SELECT pg_temp.expect_error($q$DELETE FROM public.audit_plan_actual_override_events$q$,'permission denied');
RESET ROLE;
SELECT pg_temp.assert_true((SELECT count(*)=3 FROM public.audit_plan_actual_override_events WHERE process_id='f1300000-0000-0000-0000-000000000001'),'override history must append all three Admin actions');
ROLLBACK;
