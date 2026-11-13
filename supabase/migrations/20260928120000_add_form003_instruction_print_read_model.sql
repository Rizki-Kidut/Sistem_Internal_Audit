-- FORM-003 is a live, read-only projection. It persists neither completion nor progress.
CREATE FUNCTION public.form003_can_access_instruction(p_instruction_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_admin_identity()
    AND EXISTS(SELECT 1 FROM public.audit_instructions i WHERE i.id=p_instruction_id)
$$;

CREATE FUNCTION public.get_audit_instruction_print_data(p_instruction_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.current_identity_type() IS NULL THEN
    RAISE EXCEPTION 'Identitas aktif diperlukan.';
  END IF;
  IF NOT public.form003_can_access_instruction(p_instruction_id) THEN
    RAISE EXCEPTION 'Instruksi tidak ditemukan atau tidak dapat diakses.';
  END IF;

  WITH instruction AS (
    SELECT i.* FROM public.audit_instructions i WHERE i.id=p_instruction_id
  ), base_rows AS (
    SELECT r.*,p.nama_proses AS proses_nama,
      CASE WHEN r.tipe_baris='AuditProduk' THEN COALESCE(r.tanggal_audit_produk,r.tanggal_pelaksanaan_audit)
           ELSE r.tanggal_pelaksanaan_audit END AS execution_date,
      CASE WHEN r.tipe_baris='Reguler' THEN 'ChecklistSistem'
           WHEN r.tipe_baris='AuditProduk' THEN 'ChecklistProduk'
           ELSE 'ChecklistManufakturShift' END AS audit_type,
      public.annual_actual_checklist_complete(r) AS checklist_complete
    FROM public.audit_instruction_rows r LEFT JOIN public.proses p ON p.id=r.proses_id
    WHERE r.instruction_id=p_instruction_id
  ), established AS (
    SELECT r.id FROM base_rows r
    WHERE r.cek_selesai AND r.execution_date IS NOT NULL AND r.checklist_complete
      AND NOT EXISTS (
        SELECT 1 FROM public.findings f WHERE f.instruction_row_id=r.id
          AND f.source_type=r.audit_type
          AND f.review_status NOT IN('PUBLISHED','LEGACY_ESTABLISHED','ANNULLED')
      )
  ), required_sections AS (
    SELECT DISTINCT r.id AS row_id,public.safe_uuid(mark->>'seksi_id') AS seksi_id
    FROM base_rows r
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.seksi_marks,'[]'::jsonb)) mark
    WHERE r.tipe_baris='Reguler'
      AND mark->>'tipe' IN('target','terkait')
      AND public.safe_uuid(mark->>'seksi_id') IS NOT NULL
  ), scope_rollup AS (
    SELECT r.id,count(DISTINCT s.seksi_id)::integer AS required_report_count
    FROM base_rows r LEFT JOIN required_sections s ON s.row_id=r.id
    GROUP BY r.id
  ), report_rollup AS (
    SELECT r.id,
      count(DISTINCT report.seksi_id) FILTER(WHERE report.status='Final' AND s.seksi_id IS NOT NULL)::integer AS final_report_count,
      max(report.finalized_at) FILTER(WHERE report.status='Final' AND s.seksi_id IS NOT NULL) AS latest_report_final
    FROM base_rows r
    LEFT JOIN required_sections s ON s.row_id=r.id
    LEFT JOIN public.audit_internal_reports report
      ON report.instruction_row_id=r.id AND report.seksi_id=s.seksi_id
    GROUP BY r.id
  ), formal_findings AS (
    SELECT f.* FROM public.findings f JOIN base_rows r ON r.id=f.instruction_row_id
    WHERE f.source_type=r.audit_type AND f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED')
  ), car_decisions AS (
    SELECT c.id,c.finding_id,c.status,decision.event_type AS latest_decision,
      close_event.created_at AS latest_effective_close
    FROM formal_findings f JOIN public.cars c ON c.finding_id=f.id
    LEFT JOIN LATERAL (
      SELECT e.event_type,e.created_at FROM public.car_workflow_events e
      WHERE e.car_id=c.id AND e.event_type IN('AUDITOR_VERIFIED_CLOSE_TO_ADMIN','ADMIN_RETURNED_TO_AUDITOR')
      ORDER BY e.created_at DESC,e.id DESC LIMIT 1
    ) decision ON true
    LEFT JOIN LATERAL (
      SELECT e.created_at FROM public.car_workflow_events e
      WHERE e.car_id=c.id AND e.event_type='AUDITOR_VERIFIED_CLOSE_TO_ADMIN'
      ORDER BY e.created_at DESC,e.id DESC LIMIT 1
    ) close_event ON decision.event_type='AUDITOR_VERIFIED_CLOSE_TO_ADMIN'
  ), finding_rollup AS (
    SELECT r.id,count(DISTINCT f.id)::integer AS formal_finding_count,
      count(DISTINCT c.id)::integer AS required_ltp_count,
      count(DISTINCT c.id) FILTER(WHERE c.status IN('AUDITOR_REVIEW','AUDITOR_RETURNED','ADMIN_REVIEW','CLOSED'))::integer AS submitted_ltp_count,
      count(DISTINCT c.id) FILTER(WHERE c.latest_decision='AUDITOR_VERIFIED_CLOSE_TO_ADMIN' AND c.status IN('ADMIN_REVIEW','CLOSED'))::integer AS effective_closed_ltp_count,
      max(c.latest_effective_close) FILTER(WHERE c.latest_decision='AUDITOR_VERIFIED_CLOSE_TO_ADMIN' AND c.status IN('ADMIN_REVIEW','CLOSED')) AS latest_effective_close
    FROM base_rows r LEFT JOIN formal_findings f ON f.instruction_row_id=r.id
    LEFT JOIN car_decisions c ON c.finding_id=f.id GROUP BY r.id
  ), team_roster AS (
    SELECT r.id,t.kode_tim,
      COALESCE(jsonb_agg(jsonb_build_object('nama',a.nama,'peran',m.peran,'urutan_tampil',m.urutan_tampil)
        ORDER BY CASE m.peran WHEN 'Lead' THEN 0 ELSE 1 END,m.urutan_tampil,a.nama)
        FILTER(WHERE m.id IS NOT NULL),'[]'::jsonb) AS roster
    FROM base_rows r LEFT JOIN public.audit_team_masters t ON t.id=r.team_master_id
    LEFT JOIN public.audit_team_master_members m ON m.team_id=t.id
    LEFT JOIN public.auditors a ON a.id=m.auditor_id GROUP BY r.id,t.kode_tim
  ), resolved_rows AS (
    SELECT r.*,e.id IS NOT NULL AS established,
      s.required_report_count,rr.final_report_count,rr.latest_report_final,
      f.formal_finding_count,f.required_ltp_count,f.submitted_ltp_count,
      f.effective_closed_ltp_count,f.latest_effective_close,t.kode_tim,t.roster,
      (r.tipe_baris='Reguler' AND s.required_report_count>0) AS has_required_reports,
      CASE
        WHEN r.tipe_baris='Reguler' THEN s.required_report_count>0 AND rr.final_report_count=s.required_report_count
        ELSE true
      END AS reports_final,
      CASE
        WHEN e.id IS NOT NULL
          AND (CASE WHEN r.tipe_baris='Reguler' THEN s.required_report_count>0 AND rr.final_report_count=s.required_report_count ELSE true END)
          AND (f.formal_finding_count=0 OR (f.required_ltp_count=f.formal_finding_count AND f.effective_closed_ltp_count=f.required_ltp_count)) THEN 5
        WHEN f.formal_finding_count>0 AND f.required_ltp_count=f.formal_finding_count AND f.submitted_ltp_count=f.required_ltp_count THEN 4
        WHEN s.required_report_count>0 AND rr.final_report_count=s.required_report_count THEN 3
        WHEN e.id IS NOT NULL AND f.formal_finding_count>0 THEN 2
        WHEN e.id IS NOT NULL AND f.formal_finding_count=0 THEN 1
        ELSE 0 END AS status_progress
    FROM base_rows r LEFT JOIN established e ON e.id=r.id
    JOIN scope_rollup s ON s.id=r.id JOIN report_rollup rr ON rr.id=r.id
    JOIN finding_rollup f ON f.id=r.id JOIN team_roster t ON t.id=r.id
  ), instruction_completion AS (
    SELECT CASE
      WHEN count(*)=0 THEN NULL
      WHEN NOT bool_and(established AND reports_final) THEN NULL
      WHEN sum(formal_finding_count)>0 THEN
        CASE WHEN sum(required_ltp_count)=sum(formal_finding_count)
          AND sum(effective_closed_ltp_count)=sum(required_ltp_count)
          THEN max(latest_effective_close) END
      ELSE max(CASE WHEN has_required_reports THEN latest_report_final ELSE execution_date::timestamptz END)
    END AS completion_date FROM resolved_rows
  ), rows_json AS (
    SELECT COALESCE(jsonb_agg(
      (to_jsonb(r)-ARRAY['audit_type','checklist_complete','latest_report_final','latest_effective_close','reports_final','has_required_reports','kode_tim','roster'])
      ||jsonb_build_object('team_kode',r.kode_tim,'team_roster',r.roster)
      ORDER BY r.urutan_tampil,r.kode_audit,r.id
    ),'[]'::jsonb) AS value FROM resolved_rows r
  )
  SELECT jsonb_build_object(
    'instruction',to_jsonb(i),
    'completion_date',(SELECT completion_date FROM instruction_completion),
    'sections',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.urutan_tampil,s.nama,s.id) FROM public.seksi s),'[]'::jsonb),
    'plants',COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.urutan_tampil,p.nama,p.id) FROM public.plants p WHERE p.aktif),'[]'::jsonb),
    'target_models',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY p.urutan_tampil,m.urutan_tampil,m.nama,m.id) FROM public.target_models m JOIN public.plants p ON p.id=m.plant_id WHERE p.aktif),'[]'::jsonb),
    'shifts',COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY p.urutan_tampil,s.urutan_tampil,s.nama,s.id) FROM public.shifts s JOIN public.plants p ON p.id=s.plant_id WHERE p.aktif),'[]'::jsonb),
    'rows',(SELECT value FROM rows_json)
  ) INTO v_result FROM instruction i;

  IF v_result IS NULL THEN RAISE EXCEPTION 'Instruksi tidak ditemukan atau tidak dapat diakses.';END IF;
  RETURN v_result;
END $$;

COMMENT ON FUNCTION public.get_audit_instruction_print_data(uuid) IS
'Admin-only live FORM-003 projection. Team/roster come from Team Master; regular-row reports are scoped only to authoritative Section marks; special Product/Manufacturing/Shift rows treat FORM-015 as N/A; completion requires all rows Established and all applicable reports satisfied, with effective Auditor CLOSE or execution/report fallback derived without persisted duplicates.';

REVOKE ALL ON FUNCTION public.form003_can_access_instruction(uuid),public.get_audit_instruction_print_data(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_instruction_print_data(uuid) TO authenticated;
