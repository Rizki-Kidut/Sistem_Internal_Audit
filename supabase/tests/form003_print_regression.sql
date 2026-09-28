-- Rollback-only behavioral regression for FORM-003 print read model.
-- Run only after 20260928120000 on an approved non-Production database.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.ok(value boolean,message text)RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT COALESCE(value,false) THEN RAISE EXCEPTION 'FORM003 ASSERT: %',message; END IF; END$$;
CREATE OR REPLACE FUNCTION pg_temp.actor(id uuid)RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',id,'role','authenticated')::text,true);
  PERFORM set_config('role','authenticated',true);
END$$;
CREATE OR REPLACE FUNCTION pg_temp.row_payload(payload jsonb,kode text)RETURNS jsonb LANGUAGE sql AS $$
  SELECT x FROM jsonb_array_elements(payload->'rows')x WHERE x->>'kode_audit'=kode LIMIT 1
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{}',true);

-- Admin is the only FORM-003 consumer. A second active Auditor verifies denial.
INSERT INTO auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',name||'@form003.test','',now(),'{}','{}',now(),now()
FROM(VALUES
('f3000000-0000-0000-0000-000000000001'::uuid,'admin'),
('f3000000-0000-0000-0000-000000000002'::uuid,'auditor'))v(id,name);
INSERT INTO public.user_profiles(id,display_name,identity_type,status)VALUES
('f3000000-0000-0000-0000-000000000001','FORM003 Admin','ADMIN','Aktif'),
('f3000000-0000-0000-0000-000000000002','FORM003 Auditor','AUDITOR','Aktif');

INSERT INTO public.auditors(id,nama,tanggal_berlaku,status)VALUES
('f3010000-0000-0000-0000-000000000001','FORM003 Lead','2100-12-31','Aktif'),
('f3010000-0000-0000-0000-000000000002','FORM003 Member','2100-12-31','Aktif');
INSERT INTO public.user_auditor_links(user_id,auditor_id,is_lead_auditor)VALUES
('f3000000-0000-0000-0000-000000000002','f3010000-0000-0000-0000-000000000002',false);

INSERT INTO public.seksi(id,nama,urutan_tampil,aktif)VALUES
('f3020000-0000-0000-0000-000000000001','FORM003 Section A',1,true),
('f3020000-0000-0000-0000-000000000002','FORM003 Section B',2,true),
('f3020000-0000-0000-0000-000000000003','FORM003 Unrelated C',3,true);
INSERT INTO public.proses(id,nama_proses,kode_proses)VALUES
('f3030000-0000-0000-0000-000000000001','FORM003 Process','F003-P1');

INSERT INTO public.audit_plans(id,tahun,tanggal_berlaku,no_revisi,kode_dokumen,status)VALUES
('f3040000-0000-0000-0000-000000000001',2098,'2098-04-01',1,'F003-PLAN','Approved');
INSERT INTO public.audit_team_masters(id,plan_id,kode_tim,nama_tim,status,is_locked)VALUES
('f3060000-0000-0000-0000-000000000001','f3040000-0000-0000-0000-000000000001','7','FORM003 Team','Aktif',false);
INSERT INTO public.audit_team_master_members(team_id,auditor_id,peran,urutan_tampil,is_team_leader)VALUES
('f3060000-0000-0000-0000-000000000001','f3010000-0000-0000-0000-000000000001','Lead',1,true),
('f3060000-0000-0000-0000-000000000001','f3010000-0000-0000-0000-000000000002','Member',2,false);
INSERT INTO public.audit_programs(id,plan_id,jenis_ronde,nomor_ke,tahun,tanggal_dibuat,status)VALUES
('f3070000-0000-0000-0000-000000000001','f3040000-0000-0000-0000-000000000001','Berkala',1,2098,'2098-04-01','Approved');

INSERT INTO public.audit_instructions(id,program_id,tahun_fiskal,status)VALUES
('f3080000-0000-0000-0000-000000000001','f3070000-0000-0000-0000-000000000001',2098,'Berjalan'),
('f3080000-0000-0000-0000-000000000002','f3070000-0000-0000-0000-000000000001',2098,'Berjalan'),
('f3080000-0000-0000-0000-000000000003','f3070000-0000-0000-0000-000000000001',2098,'Berjalan');

ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER USER;
INSERT INTO public.audit_instruction_rows(
 id,instruction_id,kode_audit,proses_id,team_master_id,tipe_baris,seksi_marks,
 tanggal_plan_audit,tanggal_pelaksanaan_audit,tanggal_audit_produk,cek_selesai,urutan_tampil
)VALUES
-- A: regular ZERO FINDING, requires Section A+B reports.
('f3090000-0000-0000-0000-000000000001','f3080000-0000-0000-0000-000000000001','QA-F3001','f3030000-0000-0000-0000-000000000001','f3060000-0000-0000-0000-000000000001','Reguler','[{"seksi_id":"f3020000-0000-0000-0000-000000000001","tipe":"target"},{"seksi_id":"f3020000-0000-0000-0000-000000000002","tipe":"terkait"}]','2098-04-01','2098-04-02',NULL,false,1),
-- B: Product + Manufacturing ZERO FINDING. FORM-015 is N/A for both.
('f3090000-0000-0000-0000-000000000002','f3080000-0000-0000-0000-000000000002','QA-F3002','f3030000-0000-0000-0000-000000000001','f3060000-0000-0000-0000-000000000001','AuditProduk','[]','2098-05-01','2098-05-01','2098-05-02',false,1),
('f3090000-0000-0000-0000-000000000003','f3080000-0000-0000-0000-000000000002','QA-F3003','f3030000-0000-0000-0000-000000000001','f3060000-0000-0000-0000-000000000001','AuditManufaktur','[]','2098-06-01','2098-06-03',NULL,false,2),
-- C: regular row with 2 Findings/LTPs plus one Product row left incomplete initially.
('f3090000-0000-0000-0000-000000000004','f3080000-0000-0000-0000-000000000003','QA-F3004','f3030000-0000-0000-0000-000000000001','f3060000-0000-0000-0000-000000000001','Reguler','[{"seksi_id":"f3020000-0000-0000-0000-000000000001","tipe":"target"}]','2098-07-01','2098-07-02',NULL,false,1),
('f3090000-0000-0000-0000-000000000005','f3080000-0000-0000-0000-000000000003','QA-F3005','f3030000-0000-0000-0000-000000000001','f3060000-0000-0000-0000-000000000001','AuditProduk','[]','2098-07-20','2098-07-20','2098-07-21',false,2);
ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER USER;

-- Team must be locked before checklist creation.
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');
SELECT public.lock_audit_team_master('f3060000-0000-0000-0000-000000000001');
RESET ROLE;

-- System checklists for A and C regular rows.
INSERT INTO public.checklists(id,row_id,kode_audit,judul_checklist)VALUES
('f3100000-0000-0000-0000-000000000001','f3090000-0000-0000-0000-000000000001','QA-F3001','FORM003'),
('f3100000-0000-0000-0000-000000000004','f3090000-0000-0000-0000-000000000004','QA-F3004','FORM003');
ALTER TABLE public.checklist_items DISABLE TRIGGER USER;
INSERT INTO public.checklist_items(id,checklist_id,sub_proses,kelompok_ipo,nomor,pertanyaan_utama,metode_verifikasi,hasil,komentar_auditor)VALUES
('f3110000-0000-0000-0000-000000000001','f3100000-0000-0000-0000-000000000001','Sub','Input Proses','1','Q','Observasi','O','OK'),
('f3110000-0000-0000-0000-000000000004','f3100000-0000-0000-0000-000000000004','Sub','Input Proses','1','Q1','Observasi','A','Finding 1'),
('f3110000-0000-0000-0000-000000000005','f3100000-0000-0000-0000-000000000004','Sub','Input Proses','2','Q2','Observasi','B','Finding 2');
ALTER TABLE public.checklist_items ENABLE TRIGGER USER;

-- Product checklists for B product and C product rows.
INSERT INTO public.checklist_produk(id,row_id,kode_audit,status)VALUES
('f3140000-0000-0000-0000-000000000001','f3090000-0000-0000-0000-000000000002','QA-F3002','Draft'),
('f3140000-0000-0000-0000-000000000002','f3090000-0000-0000-0000-000000000005','QA-F3005','Draft');
INSERT INTO public.checklist_produk_fase(id,checklist_produk_id,nama_fase,dokumen_bukti)VALUES
('f3150000-0000-0000-0000-000000000001','f3140000-0000-0000-0000-000000000001','Fase','["fixture"]'),
('f3150000-0000-0000-0000-000000000002','f3140000-0000-0000-0000-000000000002','Fase','["fixture"]');
ALTER TABLE public.checklist_produk_items DISABLE TRIGGER USER;
INSERT INTO public.checklist_produk_items(id,fase_id,item_pemeriksaan,hasil_pemeriksaan,judgment)VALUES
('f3160000-0000-0000-0000-000000000001','f3150000-0000-0000-0000-000000000001','Item','OK','OK'),
('f3160000-0000-0000-0000-000000000002','f3150000-0000-0000-0000-000000000002','Item','OK','OK');
ALTER TABLE public.checklist_produk_items ENABLE TRIGGER USER;
UPDATE public.checklist_produk SET status='Selesai' WHERE id IN('f3140000-0000-0000-0000-000000000001','f3140000-0000-0000-0000-000000000002');

-- Manufacturing checklist for B manufacturing row.
INSERT INTO public.checklist_manufaktur_shift(id,row_id,kode_audit,status)VALUES
('f3170000-0000-0000-0000-000000000001','f3090000-0000-0000-0000-000000000003','QA-F3003','Draft');
ALTER TABLE public.checklist_manufaktur_items DISABLE TRIGGER USER;
INSERT INTO public.checklist_manufaktur_items(id,checklist_id,no_proses_dicek,hasil_pengamatan,hasil)VALUES
('f3180000-0000-0000-0000-000000000001','f3170000-0000-0000-0000-000000000001','1','Observed','O');
ALTER TABLE public.checklist_manufaktur_items ENABLE TRIGGER USER;
UPDATE public.checklist_manufaktur_shift SET status='Selesai' WHERE id='f3170000-0000-0000-0000-000000000001';

-- Mark all rows complete except C Product, which intentionally blocks Instruction completion.
ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER USER;
UPDATE public.audit_instruction_rows SET cek_selesai=true
WHERE id IN(
'f3090000-0000-0000-0000-000000000001',
'f3090000-0000-0000-0000-000000000002',
'f3090000-0000-0000-0000-000000000003',
'f3090000-0000-0000-0000-000000000004'
);
ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER USER;

-- Formal Findings for C regular row.
ALTER TABLE public.findings DISABLE TRIGGER USER;
INSERT INTO public.findings(
 id,instruction_row_id,kode_audit,kode_temuan,nomor_urut_temuan,source_type,source_item_id,
 kategori,problem,location,objective_evidence,reference,tanggal_temuan,status,review_status,seksi_auditee_id
)VALUES
('f3120000-0000-0000-0000-000000000001','f3090000-0000-0000-0000-000000000004','QA-F3004','F003-F1',1,'ChecklistSistem','f3110000-0000-0000-0000-000000000004','A','P1','L','E','8.5.1','2098-07-02','Open','PUBLISHED','f3020000-0000-0000-0000-000000000001'),
('f3120000-0000-0000-0000-000000000002','f3090000-0000-0000-0000-000000000004','QA-F3004','F003-F2',2,'ChecklistSistem','f3110000-0000-0000-0000-000000000005','B','P2','L','E','10.2','2098-07-02','Open','PUBLISHED','f3020000-0000-0000-0000-000000000001');
ALTER TABLE public.findings ENABLE TRIGGER USER;
INSERT INTO public.cars(id,finding_id,kode_car,seksi_auditee_id,status)VALUES
('f3130000-0000-0000-0000-000000000001','f3120000-0000-0000-0000-000000000001','F003-CAR1','f3020000-0000-0000-0000-000000000001','MANAGER_REVIEW'),
('f3130000-0000-0000-0000-000000000002','f3120000-0000-0000-0000-000000000002','F003-CAR2','f3020000-0000-0000-0000-000000000001','MANAGER_REVIEW');

-- A has one correct Final report plus one unrelated later report. Missing B must still block.
INSERT INTO public.audit_internal_reports(id,instruction_row_id,seksi_id,status,finalized_at,tanggal_terbit)VALUES
('f3190000-0000-0000-0000-000000000001','f3090000-0000-0000-0000-000000000001','f3020000-0000-0000-0000-000000000001','Final','2098-04-10T01:00:00Z','2098-04-10'),
('f3190000-0000-0000-0000-000000000002','f3090000-0000-0000-0000-000000000001','f3020000-0000-0000-0000-000000000003','Final','2098-04-30T01:00:00Z','2098-04-30');

SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');

-- 1/2 Team code + live Team Master roster.
SELECT pg_temp.ok(pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000001'),'QA-F3001')->>'team_kode'='7','Team must use kode_tim only');
SELECT pg_temp.ok(jsonb_array_length(pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000001'),'QA-F3001')->'team_roster')=2,'Team roster must come from Team Master');

-- 3 report scope: unrelated Section C report cannot satisfy required Section B.
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000001'),'QA-F3001')->>'required_report_count')::int=2,'Regular row requires both marked Sections');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000001'),'QA-F3001')->>'final_report_count')::int=1,'Only Final reports for authoritative marked Sections count');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000001'),'QA-F3001')->>'status_progress')::int=1,'ZERO FINDING established row remains state 1 until required reports are Final');
SELECT pg_temp.ok(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000001')->>'completion_date' IS NULL,'Missing required Section report blocks completion');

RESET ROLE;
INSERT INTO public.audit_internal_reports(id,instruction_row_id,seksi_id,status,finalized_at,tanggal_terbit)VALUES
('f3190000-0000-0000-0000-000000000003','f3090000-0000-0000-0000-000000000001','f3020000-0000-0000-0000-000000000002','Final','2098-04-12T01:00:00Z','2098-04-12');
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000001'),'QA-F3001')->>'status_progress')::int=5,'ZERO FINDING regular row completes after all required reports Final');
SELECT pg_temp.ok((public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000001')->>'completion_date')::timestamptz='2098-04-12T01:00:00Z'::timestamptz,'Unrelated later report must not move completion date');

-- 4/5/6 special rows: FORM-015 N/A and authoritative execution-date fallback.
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000002'),'QA-F3002')->>'execution_date')::date='2098-05-02','Product execution uses tanggal_audit_produk');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000002'),'QA-F3003')->>'execution_date')::date='2098-06-03','Manufacturing execution uses tanggal_pelaksanaan_audit');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000002'),'QA-F3002')->>'required_report_count')::int=0 AND (pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000002'),'QA-F3002')->>'status_progress')::int=5,'Product ZERO FINDING treats FORM-015 as N/A and can complete');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000002'),'QA-F3003')->>'status_progress')::int=5,'Manufacturing ZERO FINDING treats FORM-015 as N/A and can complete');
SELECT pg_temp.ok((public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000002')->>'completion_date')::date='2098-06-03','Zero-LTP special-only Instruction falls back to latest authoritative execution date');

-- 7/8 C row starts at Has Finding because report is not Final.
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003'),'QA-F3004')->>'formal_finding_count')::int=2,'Formal PUBLISHED Findings counted');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003'),'QA-F3004')->>'status_progress')::int=2,'Established row with formal Findings starts at Has Finding');
SELECT pg_temp.ok(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003')->>'completion_date' IS NULL,'Incomplete sibling QA blocks Instruction completion');

RESET ROLE;
INSERT INTO public.audit_internal_reports(id,instruction_row_id,seksi_id,status,finalized_at,tanggal_terbit)VALUES
('f3190000-0000-0000-0000-000000000004','f3090000-0000-0000-0000-000000000004','f3020000-0000-0000-0000-000000000001','Final','2098-07-05T01:00:00Z','2098-07-05');
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003'),'QA-F3004')->>'status_progress')::int=3,'All required FORM-015 Final advances row to Audit Report Sent');

-- 9/10/11 LTP draft/manager states are not sent; Auditor Review is sent.
RESET ROLE;
ALTER TABLE public.cars DISABLE TRIGGER USER;
UPDATE public.cars SET status='AUDITOR_REVIEW' WHERE id IN('f3130000-0000-0000-0000-000000000001','f3130000-0000-0000-0000-000000000002');
ALTER TABLE public.cars ENABLE TRIGGER USER;
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003'),'QA-F3004')->>'status_progress')::int=4,'All canonical LTPs at Auditor-or-later stage advances to Corrective Action Report Sent');

-- 12/13/14 Two effective Auditor CLOSE events make row Complete, but unfinished sibling still blocks Instruction completion.
RESET ROLE;
ALTER TABLE public.cars DISABLE TRIGGER USER;
UPDATE public.cars SET status='ADMIN_REVIEW' WHERE id IN('f3130000-0000-0000-0000-000000000001','f3130000-0000-0000-0000-000000000002');
ALTER TABLE public.cars ENABLE TRIGGER USER;
INSERT INTO public.car_workflow_events(id,car_id,event_type,actor_user_id,actor_identity_type,from_status,to_status,created_at)VALUES
('f31a0000-0000-0000-0000-000000000001','f3130000-0000-0000-0000-000000000001','AUDITOR_VERIFIED_CLOSE_TO_ADMIN','f3000000-0000-0000-0000-000000000001','ADMIN','AUDITOR_REVIEW','ADMIN_REVIEW','2098-08-10T01:00:00Z'),
('f31a0000-0000-0000-0000-000000000002','f3130000-0000-0000-0000-000000000002','AUDITOR_VERIFIED_CLOSE_TO_ADMIN','f3000000-0000-0000-0000-000000000001','ADMIN','AUDITOR_REVIEW','ADMIN_REVIEW','2098-08-12T01:00:00Z');
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003'),'QA-F3004')->>'status_progress')::int=5,'All LTPs with current effective Auditor CLOSE make the row Complete');
SELECT pg_temp.ok(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003')->>'completion_date' IS NULL,'Instruction completion requires every QA row Established even when all LTPs are closed');

-- Complete the Product sibling; Instruction completion becomes the last effective Auditor CLOSE.
RESET ROLE;
ALTER TABLE public.audit_instruction_rows DISABLE TRIGGER USER;
UPDATE public.audit_instruction_rows SET cek_selesai=true WHERE id='f3090000-0000-0000-0000-000000000005';
ALTER TABLE public.audit_instruction_rows ENABLE TRIGGER USER;
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok((public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003')->>'completion_date')::timestamptz='2098-08-12T01:00:00Z'::timestamptz,'Multiple LTP completion uses the last effective Auditor CLOSE');

-- 15 Admin Return invalidates prior close.
RESET ROLE;
ALTER TABLE public.cars DISABLE TRIGGER USER;
UPDATE public.cars SET status='AUDITOR_RETURNED' WHERE id='f3130000-0000-0000-0000-000000000002';
ALTER TABLE public.cars ENABLE TRIGGER USER;
INSERT INTO public.car_workflow_events(id,car_id,event_type,actor_user_id,actor_identity_type,from_status,to_status,created_at)VALUES
('f31a0000-0000-0000-0000-000000000003','f3130000-0000-0000-0000-000000000002','ADMIN_RETURNED_TO_AUDITOR','f3000000-0000-0000-0000-000000000001','ADMIN','ADMIN_REVIEW','AUDITOR_RETURNED','2098-08-13T01:00:00Z');
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003')->>'completion_date' IS NULL,'Admin Return invalidates an earlier Auditor CLOSE');
SELECT pg_temp.ok((pg_temp.row_payload(public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003'),'QA-F3004')->>'status_progress')::int=4,'Returned LTP remains submitted but is not Complete');

-- 16 later Auditor CLOSE restores completion.
RESET ROLE;
ALTER TABLE public.cars DISABLE TRIGGER USER;
UPDATE public.cars SET status='ADMIN_REVIEW' WHERE id='f3130000-0000-0000-0000-000000000002';
ALTER TABLE public.cars ENABLE TRIGGER USER;
INSERT INTO public.car_workflow_events(id,car_id,event_type,actor_user_id,actor_identity_type,from_status,to_status,created_at)VALUES
('f31a0000-0000-0000-0000-000000000004','f3130000-0000-0000-0000-000000000002','AUDITOR_VERIFIED_CLOSE_TO_ADMIN','f3000000-0000-0000-0000-000000000001','ADMIN','AUDITOR_RETURNED','ADMIN_REVIEW','2098-08-14T01:00:00Z');
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok((public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003')->>'completion_date')::timestamptz='2098-08-14T01:00:00Z'::timestamptz,'Later Auditor CLOSE restores completion with the new date');

-- 17 CLOSED remains completion-qualified even after a later Admin approval event.
RESET ROLE;
ALTER TABLE public.cars DISABLE TRIGGER USER;
UPDATE public.cars SET status='CLOSED' WHERE id='f3130000-0000-0000-0000-000000000002';
ALTER TABLE public.cars ENABLE TRIGGER USER;
INSERT INTO public.car_workflow_events(id,car_id,event_type,actor_user_id,actor_identity_type,from_status,to_status,created_at)VALUES
('f31a0000-0000-0000-0000-000000000005','f3130000-0000-0000-0000-000000000002','ADMIN_APPROVED_LTP','f3000000-0000-0000-0000-000000000001','ADMIN','ADMIN_REVIEW','CLOSED','2098-08-15T01:00:00Z');
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000001');
SELECT pg_temp.ok((public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000003')->>'completion_date')::timestamptz='2098-08-14T01:00:00Z'::timestamptz,'CLOSED remains qualified and completion date remains the Auditor CLOSE date');

-- 18/19 authorization: public RPC is authenticated but Admin-only; helper is private.
RESET ROLE;
SELECT pg_temp.ok(has_function_privilege('authenticated','public.get_audit_instruction_print_data(uuid)','EXECUTE'),'authenticated may execute the public FORM-003 RPC');
SELECT pg_temp.ok(NOT has_function_privilege('anon','public.get_audit_instruction_print_data(uuid)','EXECUTE'),'anon may not execute FORM-003 RPC');
SELECT pg_temp.ok(NOT has_function_privilege('authenticated','public.form003_can_access_instruction(uuid)','EXECUTE'),'FORM-003 authorization helper stays private');
SELECT pg_temp.actor('f3000000-0000-0000-0000-000000000002');
DO $$
BEGIN
  BEGIN
    PERFORM public.get_audit_instruction_print_data('f3080000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'FORM003 ASSERT: non-Admin unexpectedly read FORM-003';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Instruksi tidak ditemukan atau tidak dapat diakses%' THEN RAISE; END IF;
  END;
END$$;

ROLLBACK;
