-- Run only on CertiTrack-Staging as the SQL test operator. Everything is rolled back.
-- Synthetic prerequisite workflow states are seeded with triggers suppressed ONLY during setup.
-- All FORM-010 RPCs, completion calls and negative mutation tests run with triggers enabled.
BEGIN;
CREATE TEMP TABLE form010_results(test text,result text) ON COMMIT DROP;
CREATE TEMP TABLE form010_fixture(kind text,program_id uuid,instruction_id uuid,audit_type text,row_id uuid,leader_id uuid,expected_dates date[]) ON COMMIT DROP;
CREATE TEMP TABLE form010_reports(kind text,audit_type text,report_id uuid) ON COMMIT DROP;
CREATE TEMP TABLE form010_actors(admin_id uuid,auditor_user_id uuid,auditor_id uuid) ON COMMIT DROP;
CREATE FUNCTION pg_temp.expect_error(p_sql text,p_message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE caught boolean:=false;
BEGIN
 BEGIN EXECUTE p_sql;
 EXCEPTION WHEN OTHERS THEN
  IF position(p_message in SQLERRM)=0 THEN RAISE EXCEPTION 'Unexpected error: %, expected %',SQLERRM,p_message; END IF;
  caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'Expected rejection: %',p_message; END IF;
END$$;
SET LOCAL session_replication_role=replica;
DO $$
DECLARE plan uuid:=gen_random_uuid(); admin_user uuid:=gen_random_uuid(); actor_user uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid();
 teams uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 leaders uuid[]:=ARRAY[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
 types text[]:=ARRAY['ChecklistSistem','ChecklistManufakturShift','ChecklistProduk'];
 rowtypes text[]:=ARRAY['Reguler','AuditManufaktur','AuditProduk'];
 kinds text[]:=ARRAY['with','zero','gaps','absent','open'];
 program uuid; instruction uuid; rid uuid; checklist uuid; item uuid; fase uuid; finding uuid;
 execution date; expected date[]; i integer; k integer; d integer; n integer; qa text;
BEGIN
 INSERT INTO auth.users(id) VALUES(admin_user),(actor_user);
 INSERT INTO public.user_profiles(id,display_name,identity_type) VALUES(admin_user,'FORM010 synthetic admin','ADMIN'),(actor_user,'FORM010 synthetic auditor','AUDITOR');
 INSERT INTO public.auditors(id,nama,tanggal_berlaku) VALUES(actor,'FORM010 synthetic actor','2100-12-31');
 INSERT INTO public.user_auditor_links(user_id,auditor_id) VALUES(actor_user,actor);
 INSERT INTO form010_actors VALUES(admin_user,actor_user,actor);
 INSERT INTO public.audit_plans(id,tahun,tanggal_berlaku,kode_dokumen) VALUES(plan,2097,'2026-01-01','FORM010-TEST-'||plan);
 FOR i IN 1..3 LOOP
  INSERT INTO public.auditors(id,nama,tanggal_berlaku) VALUES(leaders[i],'FORM010 leader '||i,'2100-12-31');
  INSERT INTO public.audit_team_masters(id,plan_id,kode_tim,nama_tim,is_locked) VALUES(teams[i],plan,'F010-'||i,'FORM010 type team '||i,true);
  INSERT INTO public.audit_team_master_members(team_id,auditor_id,peran,is_team_leader) VALUES(teams[i],leaders[i],'Lead',true),(teams[i],actor,'Member',false);
  INSERT INTO public.user_audit_plan_assignments(user_id,plan_id,team_id) VALUES(actor_user,plan,teams[i]);
 END LOOP;
 FOR k IN 1..5 LOOP
  program:=gen_random_uuid(); instruction:=gen_random_uuid();
  INSERT INTO public.audit_programs(id,plan_id,jenis_ronde,nomor_ke,tahun,tanggal_dibuat,penanggung_jawab_qms) VALUES(program,plan,'Khusus',k,2097,'2026-09-01','FORM010 PJ');
  INSERT INTO public.audit_instructions(id,program_id,tahun_fiskal) VALUES(instruction,program,2097);
  IF k=4 THEN INSERT INTO form010_fixture VALUES(kinds[k],program,instruction,NULL,NULL,NULL,NULL); CONTINUE; END IF;
  FOR i IN 1..3 LOOP
   n:=CASE WHEN k=3 THEN CASE WHEN i=2 THEN 2 ELSE 1 END WHEN i=1 THEN 5 WHEN i=2 THEN 2 ELSE 1 END;
   expected:=CASE WHEN k=3 THEN CASE WHEN i=2 THEN ARRAY['2026-09-09','2026-09-11']::date[] ELSE ARRAY['2026-09-09']::date[] END WHEN i=1 THEN ARRAY['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11']::date[] WHEN i=2 THEN ARRAY['2026-09-09','2026-09-10']::date[] ELSE ARRAY['2026-09-11']::date[] END;
   FOR d IN 1..n LOOP
    rid:=gen_random_uuid();checklist:=gen_random_uuid();item:=gen_random_uuid();fase:=gen_random_uuid();finding:=gen_random_uuid();qa:='QA-F010-'||rid;
    execution:=CASE WHEN i=3 AND k<>3 THEN '2026-09-07'::date ELSE expected[d] END;
    INSERT INTO public.audit_instruction_rows(id,instruction_id,kode_audit,tipe_baris,team_master_id,tanggal_pelaksanaan_audit,tanggal_audit_produk,cek_selesai)
     VALUES(rid,instruction,qa,rowtypes[i],teams[i],execution,CASE WHEN i=3 AND k<>3 THEN '2026-09-11'::date ELSE NULL END,k IN(1,5));
    INSERT INTO form010_fixture VALUES(kinds[k],program,instruction,types[i],rid,leaders[i],expected);
    IF i=1 THEN
     INSERT INTO public.checklists(id,row_id,kode_audit,judul_checklist) VALUES(checklist,rid,qa,'FORM010 synthetic system');
     INSERT INTO public.checklist_items(id,checklist_id,sub_proses,kelompok_ipo,nomor,pertanyaan_utama,hasil,komentar_auditor,finding_id)
      VALUES(item,checklist,'Synthetic','Input Proses','1','Synthetic question',CASE WHEN k IN(1,5) THEN 'B' ELSE 'O' END,'Synthetic observation',CASE WHEN k IN(1,5) THEN finding END);
    ELSIF i=2 THEN
     INSERT INTO public.checklist_manufaktur_shift(id,row_id,kode_audit,status) VALUES(checklist,rid,qa,'Selesai');
     INSERT INTO public.checklist_manufaktur_items(id,checklist_id,no_proses_dicek,hasil,hasil_pengamatan,finding_id)
      VALUES(item,checklist,'Synthetic',CASE WHEN k IN(1,5) THEN 'B' ELSE 'O' END,'Synthetic observation',CASE WHEN k IN(1,5) THEN finding END);
    ELSE
     INSERT INTO public.checklist_produk(id,row_id,kode_audit,status) VALUES(checklist,rid,qa,'Selesai');
     INSERT INTO public.checklist_produk_fase(id,checklist_produk_id,nama_fase,dokumen_bukti) VALUES(fase,checklist,'Synthetic','[{"name":"synthetic evidence metadata only"}]');
     INSERT INTO public.checklist_produk_items(id,fase_id,item_pemeriksaan,judgment,hasil_pemeriksaan,finding_kategori,finding_id)
      VALUES(item,fase,'Synthetic',CASE WHEN k IN(1,5) THEN 'NG' ELSE 'OK' END,'Synthetic observation',CASE WHEN k IN(1,5) THEN 'B' END,CASE WHEN k IN(1,5) THEN finding END);
    END IF;
    IF k IN(1,5) THEN
     INSERT INTO public.findings(id,instruction_row_id,kode_audit,kode_temuan,nomor_urut_temuan,source_type,source_item_id,kategori,problem,location,objective_evidence,reference,auditor_penemu_id,tanggal_temuan,review_status,status)
      VALUES(finding,rid,qa,qa||'-B1',1,types[i],item,'B','Synthetic problem','Synthetic location','Synthetic evidence','8.1',actor,execution,'PUBLISHED','Closed');
     INSERT INTO public.cars(finding_id,kode_car,status) VALUES(finding,qa||'-B1',CASE WHEN k=5 THEN 'AUDITEE_DRAFT' ELSE 'CLOSED' END);
    END IF;
   END LOOP;
  END LOOP;
 END LOOP;
END$$;
SET LOCAL session_replication_role=origin;
-- No fixture bypass remains active below this point.
DO $$
DECLARE f record; wi record; r public.weakness_analysis_reports%ROWTYPE; rid uuid; rev integer; admin_user uuid; actor_user uuid; arbitrary uuid; before_dates date[]; what text;
BEGIN
 SELECT admin_id,auditor_user_id INTO admin_user,actor_user FROM form010_actors;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_user,'role','authenticated')::text,true);
 PERFORM set_config('role','authenticated',true);
 -- Temporary fixture tables are operator-owned; reset role only to inspect fixture metadata.
 PERFORM set_config('role','none',true);
 FOR f IN SELECT DISTINCT kind,program_id,audit_type,leader_id,expected_dates FROM form010_fixture WHERE kind IN('with','zero','gaps') LOOP
  PERFORM set_config('role','authenticated',true);
  rid:=public.create_weakness_analysis('FORM010 test '||f.kind,'PROGRAM',NULL,NULL,f.program_id,f.audit_type);
  SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=rid;
  ASSERT r.audit_type=f.audit_type AND r.audit_execution_dates=f.expected_dates,'incorrect typed date snapshot';
  ASSERT r.audit_date_start=f.expected_dates[1] AND r.audit_date_end=f.expected_dates[cardinality(f.expected_dates)],'incorrect bounds';
  ASSERT NOT EXISTS(SELECT 1 FROM public.weakness_analysis_report_items i JOIN public.findings fi ON fi.id=i.finding_id WHERE i.report_id=rid AND fi.source_type<>r.audit_type),'cross-source contamination';
  ASSERT (SELECT array_agg(auditor_id) FROM public.weakness_team_leader_candidates(rid))=ARRAY[f.leader_id],'candidate contamination';
  arbitrary:=gen_random_uuid();
  PERFORM pg_temp.expect_error(format('select public.save_weakness_analysis_draft(%L,%s,%L,%L,%L,%L)',rid,r.revision_version,'Test',arbitrary,'FORM010 PJ','[]'),'Audit Team Leader bukan kandidat');
  rev:=public.save_weakness_analysis_draft(rid,r.revision_version,CASE WHEN f.kind='with' THEN 'Synthetic conclusion' ELSE NULL END,f.leader_id,'FORM010 PJ',CASE WHEN f.kind='with' THEN '[{"nomor":1,"sort_order":1,"problem":"Synthetic systemic problem","akar_permasalahan":"Synthetic root","levels":[{"level":1,"teks":"Synthetic Why"}],"actions":[{"sort_order":1,"rencana_tindakan":"Synthetic action","pic":"Synthetic PIC","due_date":"2026-10-01","status":"Belum Mulai"}]}]'::jsonb ELSE '[]'::jsonb END);
  PERFORM pg_temp.expect_error(format('select public.create_weakness_analysis(%L,%L,NULL,NULL,%L,%L)','Duplicate','PROGRAM',f.program_id,f.audit_type),'sudah tersedia');
  PERFORM pg_temp.expect_error(format('update public.weakness_analysis_reports set judul=%L where id=%L','Forbidden',rid),'permission denied');
  PERFORM pg_temp.expect_error(format('select public.finalize_weakness_analysis(%L,%s)',rid,rev-1),'WEAKNESS_STALE_REVISION');
  IF f.kind='with' THEN
   ASSERT (SELECT count(*) FROM public.weakness_analysis_report_items WHERE report_id=rid)=cardinality(f.expected_dates),'missing eligible findings';
   PERFORM pg_temp.expect_error(format('select public.finalize_weakness_analysis(%L,%s)',rid,rev),'Klasifikasi seluruh item wajib disetujui');
   FOR wi IN SELECT id FROM public.weakness_analysis_report_items WHERE report_id=rid LOOP
    PERFORM public.approve_ltp_analysis_classification(wi.id,'METHOD','SISTEM','B',NULL);
   END LOOP;
  ELSE
   ASSERT NOT EXISTS(SELECT 1 FROM public.weakness_analysis_report_items WHERE report_id=rid),'expected zero findings';
   PERFORM pg_temp.expect_error(format('select public.finalize_weakness_analysis(%L,%s)',rid,rev),'seluruh konteks audit selesai');
  END IF;
  PERFORM set_config('role','none',true);
  INSERT INTO form010_reports VALUES(f.kind,f.audit_type,rid);
  INSERT INTO form010_results VALUES(f.kind||' '||f.audit_type||' Draft / dates / isolation / signatory / stale / blockers','PASS');
 END LOOP;
 -- DATE_RANGE uses family execution dates, including Product priority over its generic date.
 PERFORM set_config('role','authenticated',true);
 rid:=public.create_weakness_analysis('Product date scope','DATE_RANGE','2026-09-11','2026-09-11',NULL,'ChecklistProduk');
 SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=rid;
 ASSERT r.audit_execution_dates=ARRAY['2026-09-11']::date[],'Product dedicated date lost';
 ASSERT (SELECT count(*) FROM public.weakness_analysis_report_items WHERE report_id=rid)=2,'Product date-range count wrong';
 PERFORM pg_temp.expect_error($q$select public.create_weakness_analysis('Wrong Product date','DATE_RANGE','2026-09-07','2026-09-07',NULL,'ChecklistProduk')$q$,'Tidak ada konteks checklist');
 rid:=public.create_weakness_analysis('Product fallback','DATE_RANGE','2026-09-09','2026-09-09',NULL,'ChecklistProduk');
 ASSERT (SELECT audit_execution_dates=ARRAY['2026-09-09']::date[] FROM public.weakness_analysis_reports WHERE id=rid),'same-row fallback lost';
 PERFORM set_config('role','none',true);
 INSERT INTO form010_results VALUES('DATE_RANGE Product primary-date isolation and same-row fallback','PASS');
 -- Even an operator-inserted typed report cannot finalize without checklist context.
 SELECT program_id INTO arbitrary FROM form010_fixture WHERE kind='absent';
 INSERT INTO public.weakness_analysis_reports(judul,source_mode,program_id,audit_type,audit_execution_dates,created_by)
 VALUES('Invalid context final test','PROGRAM',arbitrary,'ChecklistProduk','{}',admin_user) RETURNING id INTO rid;
 PERFORM set_config('role','authenticated',true);
 PERFORM pg_temp.expect_error(format('select public.finalize_weakness_analysis(%L,1)',rid),'Tidak ada konteks checklist');
 PERFORM set_config('role','none',true);
 INSERT INTO form010_results VALUES('Invalid empty context Final rejected','PASS');
 -- Non-zero open LTP still blocks Final, independently for every family.
 FOR f IN SELECT DISTINCT program_id,audit_type,leader_id FROM form010_fixture WHERE kind='open' LOOP
  PERFORM set_config('role','authenticated',true);
  rid:=public.create_weakness_analysis('Open LTP blocker','PROGRAM',NULL,NULL,f.program_id,f.audit_type);
  SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=rid;
  rev:=public.save_weakness_analysis_draft(rid,r.revision_version,'Synthetic conclusion',f.leader_id,'FORM010 PJ','[]');
  PERFORM pg_temp.expect_error(format('select public.finalize_weakness_analysis(%L,%s)',rid,rev),'Masih terdapat LTP yang belum Closed');
  PERFORM set_config('role','none',true);
  INSERT INTO form010_results VALUES(f.audit_type||' non-CLOSED LTP Final blocker','PASS');
 END LOOP;
 -- Omitted population cannot masquerade as zero, nor can an operator inject another family.
 FOR f IN SELECT DISTINCT program_id,audit_type,leader_id FROM form010_fixture WHERE kind='with' LOOP
  PERFORM set_config('role','authenticated',true);
  rid:=public.create_weakness_analysis('Stale population','DATE_RANGE','2026-09-01','2026-09-30',NULL,f.audit_type);
  SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=rid;
  PERFORM set_config('role','none',true);
  DELETE FROM public.weakness_analysis_report_items WHERE report_id=rid;
  PERFORM set_config('role','authenticated',true);
  PERFORM pg_temp.expect_error(format('select public.finalize_weakness_analysis(%L,%s)',rid,r.revision_version),'Populasi tidak sesuai lingkup');
  PERFORM public.populate_weakness_report(rid);
  SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=rid;
  PERFORM set_config('role','none',true);
  INSERT INTO public.weakness_analysis_report_items(report_id,finding_id,car_id,sort_order)
   SELECT rid,fi.id,c.id,999 FROM public.findings fi JOIN public.cars c ON c.finding_id=fi.id
   JOIN form010_fixture fx ON fx.row_id=fi.instruction_row_id
   WHERE fx.kind='with' AND fi.source_type<>f.audit_type LIMIT 1;
  PERFORM set_config('role','authenticated',true);
  PERFORM pg_temp.expect_error(format('select public.finalize_weakness_analysis(%L,%s)',rid,r.revision_version),'Populasi tidak sesuai lingkup');
  PERFORM set_config('role','none',true);
  INSERT INTO form010_results VALUES(f.audit_type||' omitted/cross-source population Final rejection','PASS');
 END LOOP;
 -- A Draft date change requires explicit regeneration, which refreshes only that snapshot.
 SELECT report_id INTO rid FROM form010_reports WHERE kind='gaps' AND audit_type='ChecklistSistem';
 SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=rid;
 UPDATE public.audit_instruction_rows SET tanggal_pelaksanaan_audit='2026-09-10'
  WHERE id IN(SELECT row_id FROM form010_fixture WHERE kind='gaps' AND audit_type='ChecklistSistem');
 PERFORM set_config('role','authenticated',true);
 PERFORM pg_temp.expect_error(format('select public.finalize_weakness_analysis(%L,%s)',rid,r.revision_version),'Tanggal audit berubah');
 PERFORM public.populate_weakness_report(rid);
 ASSERT (SELECT audit_execution_dates=ARRAY['2026-09-10']::date[] FROM public.weakness_analysis_reports WHERE id=rid),'Draft date refresh failed';
 PERFORM set_config('role','none',true);
 UPDATE public.audit_instruction_rows SET tanggal_pelaksanaan_audit='2026-09-09'
  WHERE id IN(SELECT row_id FROM form010_fixture WHERE kind='gaps' AND audit_type='ChecklistSistem');
 PERFORM set_config('role','authenticated',true);
 PERFORM public.populate_weakness_report(rid);
 PERFORM set_config('role','none',true);
 INSERT INTO form010_results VALUES('Draft execution-date drift blocks Final; explicit regeneration refreshes dates','PASS');
 -- Legacy fixture remains readable but cannot enter the new population/Final path.
 SELECT id,revision_version INTO rid,rev FROM public.weakness_analysis_reports WHERE audit_type IS NULL LIMIT 1;
 IF rid IS NOT NULL THEN
  PERFORM set_config('role','authenticated',true);
  PERFORM pg_temp.expect_error(format('select public.populate_weakness_report(%L)',rid),'legacy');
  PERFORM pg_temp.expect_error(format('select public.finalize_weakness_analysis(%L,%s)',rid,rev),'legacy');
  PERFORM set_config('role','none',true);
  INSERT INTO form010_results VALUES('Legacy report new population/Final paths rejected without mutation','PASS');
 END IF;
 -- Complete actual zero-Finding checklist execution through its existing guarded RPC.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_user,'role','authenticated')::text,true);
 FOR f IN SELECT row_id FROM form010_fixture WHERE kind IN('zero','gaps') LOOP
  PERFORM set_config('role','authenticated',true);
  PERFORM public.complete_audit_execution(f.row_id);
  PERFORM set_config('role','none',true);
 END LOOP;
 INSERT INTO form010_results VALUES('Zero-Finding completion through existing execution RPC (all three families)','PASS');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_user,'role','authenticated')::text,true);
 FOR f IN SELECT * FROM form010_reports LOOP
  PERFORM set_config('role','authenticated',true);
  SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=f.report_id;
  rev:=public.finalize_weakness_analysis(r.id,r.revision_version);
  SELECT * INTO r FROM public.weakness_analysis_reports WHERE id=f.report_id;
  ASSERT r.status='Final' AND r.pj_qms_snapshot='FORM010 PJ' AND r.audit_team_leader_name_snapshot LIKE 'FORM010 leader %','missing Final snapshot';
  IF f.kind<>'with' THEN ASSERT r.kesimpulan='-','zero analysis not dash'; END IF;
  PERFORM pg_temp.expect_error(format('select public.populate_weakness_report(%L)',r.id),'sudah Final');
  PERFORM pg_temp.expect_error(format('select public.save_weakness_analysis_draft(%L,%s,%L,NULL,NULL,%L)',r.id,rev,'changed','[]'),'sudah Final');
  IF f.kind='with' THEN
   ASSERT NOT EXISTS(SELECT 1 FROM public.weakness_analysis_report_items WHERE report_id=r.id AND final_4m1e IS DISTINCT FROM 'METHOD'),'missing classification snapshot';
   SELECT id INTO rid FROM public.weakness_analysis_report_items WHERE report_id=r.id LIMIT 1;
   PERFORM pg_temp.expect_error(format('select public.approve_ltp_analysis_classification(%L,%L,%L,%L,NULL)',rid,'MAN','DOKUMEN','A'),'Item tidak berada');
  END IF;
  PERFORM set_config('role','none',true);
  -- Trigger-level tests as operator, in addition to authenticated RPC/direct-DML denial.
  FOREACH what IN ARRAY ARRAY['judul=''mutated''','audit_type=''ChecklistProduk''','audit_execution_dates=ARRAY[''2026-01-01'']::date[]','audit_date_start=''2026-01-01''','audit_team_leader_name_snapshot=''mutated'''] LOOP
   PERFORM pg_temp.expect_error(format('update public.weakness_analysis_reports set %s where id=%L',what,r.id),CASE WHEN what LIKE 'audit_type%' AND r.audit_type<>'ChecklistProduk' THEN 'Identitas' ELSE 'immutable' END);
  END LOOP;
  PERFORM pg_temp.expect_error(format('insert into public.weakness_why_analysis(report_id,nomor,problem,akar_permasalahan,sort_order) values(%L,1,%L,%L,1)',r.id,'fake','fake'),'immutable');
  IF f.kind='with' THEN
   SELECT id INTO rid FROM public.weakness_why_analysis WHERE report_id=r.id LIMIT 1;
   PERFORM pg_temp.expect_error(format('update public.weakness_why_analysis set problem=%L where id=%L','mutated',rid),'immutable');
   PERFORM pg_temp.expect_error(format('update public.weakness_why_levels set teks=%L where why_analysis_id=%L','mutated',rid),'immutable');
   PERFORM pg_temp.expect_error(format('update public.weakness_actions set pic=%L where why_analysis_id=%L','mutated',rid),'immutable');
   PERFORM pg_temp.expect_error(format('update public.weakness_analysis_report_items set final_dis=%L where report_id=%L','DOKUMEN',r.id),'immutable');
   SELECT other.id INTO arbitrary FROM public.weakness_analysis_report_items own
    JOIN public.weakness_analysis_report_items other ON other.car_id=own.car_id AND other.report_id<>own.report_id
    JOIN public.weakness_analysis_reports draft ON draft.id=other.report_id AND draft.status='Draft'
    WHERE own.report_id=r.id LIMIT 1;
   ASSERT arbitrary IS NOT NULL,'missing separate Draft classification context';
   PERFORM set_config('role','authenticated',true);
   PERFORM public.approve_ltp_analysis_classification(arbitrary,'MAN','DOKUMEN','A',NULL);
   ASSERT NOT EXISTS(SELECT 1 FROM public.weakness_analysis_report_items WHERE report_id=r.id AND final_4m1e<>'METHOD'),'Final classification drift';
   PERFORM set_config('role','none',true);
  ELSE
   ASSERT NOT EXISTS(SELECT 1 FROM public.ltp_ai_classification_suggestions WHERE weakness_report_id=r.id),'zero report AI fabricated';
   ASSERT NOT EXISTS(SELECT 1 FROM public.weakness_why_analysis WHERE report_id=r.id),'zero report Why fabricated';
  END IF;
  -- Later upstream dates and display-name edits do not rewrite a Final report.
  UPDATE public.audit_instruction_rows SET tanggal_pelaksanaan_audit=tanggal_pelaksanaan_audit+20,
   tanggal_audit_produk=CASE WHEN tanggal_audit_produk IS NULL THEN NULL ELSE tanggal_audit_produk+20 END
   WHERE id IN(SELECT row_id FROM form010_fixture WHERE kind=f.kind AND audit_type=f.audit_type);
  ASSERT (SELECT audit_execution_dates IS NOT DISTINCT FROM r.audit_execution_dates FROM public.weakness_analysis_reports WHERE id=r.id),'Final date snapshot drift';
  INSERT INTO form010_results VALUES(f.kind||' '||f.audit_type||' Final / immutable snapshots','PASS');
 END LOOP;
 -- Missing audit context and old untyped creation are both rejected.
 SELECT program_id INTO rid FROM form010_fixture WHERE kind='absent';
 PERFORM set_config('role','authenticated',true);
 PERFORM pg_temp.expect_error(format('select public.create_weakness_analysis(%L,%L,NULL,NULL,%L,%L)','Invalid','PROGRAM',rid,'ChecklistSistem'),'Tidak ada konteks checklist');
 PERFORM pg_temp.expect_error(format('select public.create_weakness_analysis(%L,%L,NULL,NULL,%L)','Old','PROGRAM',rid),'Jenis Audit Analisa wajib');
 PERFORM pg_temp.expect_error(format('select public.create_weakness_analysis(%L,%L,NULL,NULL,%L,%L)','Invalid','PROGRAM',rid,'Audit Sistem'),'Jenis Audit Analisa tidak valid');
 PERFORM set_config('role','none',true);
 INSERT INTO form010_results VALUES('Invalid checklist context / invalid type / old untyped create rejected','PASS');
 -- Ordinary auditor has no management authority, despite belonging to every synthetic team.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_user,'role','authenticated')::text,true);
 PERFORM set_config('role','authenticated',true);
 ASSERT NOT public.can_manage_weakness_analysis(),'ordinary auditor broadened';
 PERFORM pg_temp.expect_error(format('select public.create_weakness_analysis(%L,%L,NULL,NULL,%L,%L)','Denied','PROGRAM',rid,'ChecklistSistem'),'Akses Weakness Analysis ditolak');
 PERFORM set_config('role','none',true);
 INSERT INTO form010_results VALUES('Ordinary auditor authorization remains denied','PASS');
 -- Company capability is separate and still accepted. This synthetic link change is rolled back.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_user,'role','authenticated')::text,true);
 UPDATE public.user_auditor_links SET is_lead_auditor=true WHERE user_id=actor_user;
 PERFORM set_config('role','authenticated',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_user,'role','authenticated')::text,true);
 ASSERT public.can_manage_weakness_analysis(),'Company Lead denied';
 PERFORM set_config('role','none',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',admin_user,'role','authenticated')::text,true);
 UPDATE public.user_profiles SET status='Nonaktif' WHERE id=actor_user;
 PERFORM set_config('role','authenticated',true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor_user,'role','authenticated')::text,true);
 ASSERT NOT public.can_manage_weakness_analysis(),'inactive Company Lead allowed';
 PERFORM set_config('role','none',true);
 INSERT INTO form010_results VALUES('Company Lead capability accepted, inactive denied','PASS');

END$$;
SELECT * FROM form010_results ORDER BY test;
ROLLBACK;
