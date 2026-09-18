-- Batch 9a pre-merge hardening: freeze all chart inputs when FORM-010 becomes Final.
ALTER TABLE public.weakness_analysis_report_items
  ADD COLUMN final_process_name text,
  ADD COLUMN final_category text,
  ADD COLUMN final_reference text,
  ADD CONSTRAINT weakness_final_category_check
    CHECK (final_category IS NULL OR final_category IN ('A','B','C'));

CREATE OR REPLACE FUNCTION public.finalize_weakness_analysis(
  p_report_id uuid,
  p_expected_revision integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public
AS $function$
DECLARE
  r public.weakness_analysis_reports%ROWTYPE;
  v_dates date[];
  v_has_items boolean;
BEGIN
  IF NOT public.can_manage_weakness_analysis() THEN
    RAISE EXCEPTION 'Akses Weakness Analysis ditolak';
  END IF;

  SELECT * INTO r
  FROM public.weakness_analysis_reports
  WHERE id=p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Analisa tidak ditemukan';
  END IF;

  IF r.status<>'Draft' THEN
    RAISE EXCEPTION 'Analisa bukan Draft';
  END IF;

  IF r.revision_version<>p_expected_revision THEN
    RAISE EXCEPTION 'WEAKNESS_STALE_REVISION';
  END IF;

  PERFORM public.assert_weakness_draft(r.id);

  -- Lock represented Instruction rows against concurrent scope/date/completion changes.
  PERFORM 1
  FROM public.audit_instruction_rows ir
  WHERE ir.id IN (
    SELECT row_id FROM public.weakness_audit_context(r.id)
  )
  FOR SHARE;

  IF NOT EXISTS(
    SELECT 1 FROM public.weakness_audit_context(r.id)
  ) THEN
    RAISE EXCEPTION 'Tidak ada konteks checklist untuk jenis audit dan lingkup yang dipilih';
  END IF;

  SELECT public.normalize_weakness_audit_dates(array_agg(execution_date))
    INTO v_dates
  FROM public.weakness_audit_context(r.id);

  IF r.audit_execution_dates IS DISTINCT FROM v_dates THEN
    RAISE EXCEPTION 'Tanggal audit berubah; Regenerate Populasi sebelum Final';
  END IF;

  -- Exact set equality prevents stale/omitted Findings from masquerading as an empty audit.
  IF EXISTS(
    SELECT 1
    FROM public.weakness_audit_context(r.id) ctx
    JOIN public.findings f
      ON f.instruction_row_id=ctx.row_id
     AND f.source_type=r.audit_type
    LEFT JOIN public.cars c ON c.finding_id=f.id
    LEFT JOIN public.weakness_analysis_report_items wi
      ON wi.report_id=r.id
     AND wi.finding_id=f.id
     AND wi.car_id=c.id
    WHERE f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED')
      AND (c.id IS NULL OR wi.id IS NULL)
  ) OR EXISTS(
    SELECT 1
    FROM public.weakness_analysis_report_items wi
    JOIN public.findings f ON f.id=wi.finding_id
    WHERE wi.report_id=r.id
      AND (
        f.source_type<>r.audit_type
        OR NOT EXISTS(
          SELECT 1
          FROM public.weakness_audit_context(r.id) ctx
          WHERE ctx.row_id=f.instruction_row_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'Populasi tidak sesuai lingkup jenis audit; Regenerate Populasi sebelum Final';
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.weakness_analysis_report_items
    WHERE report_id=r.id
  ) INTO v_has_items;

  IF NOT v_has_items
     AND EXISTS(
       SELECT 1
       FROM public.weakness_audit_context(r.id)
       WHERE NOT completed
     ) THEN
    RAISE EXCEPTION 'Audit tanpa Finding hanya dapat Final setelah seluruh konteks audit selesai';
  END IF;

  IF NOT v_has_items
     AND EXISTS(
       SELECT 1
       FROM public.weakness_why_analysis
       WHERE report_id=r.id
     ) THEN
    RAISE EXCEPTION 'Analisa tanpa Finding tidak memerlukan Why-Why atau Tindakan';
  END IF;

  IF (SELECT count(*) FROM public.weakness_team_leader_candidates(r.id))=0
       AND r.audit_team_leader_auditor_id IS NOT NULL
     OR (SELECT count(*) FROM public.weakness_team_leader_candidates(r.id))>0
       AND (
         r.audit_team_leader_auditor_id IS NULL
         OR NOT EXISTS(
           SELECT 1
           FROM public.weakness_team_leader_candidates(r.id) c
           WHERE c.auditor_id=r.audit_team_leader_auditor_id
         )
       ) THEN
    RAISE EXCEPTION 'Audit Team Leader bukan kandidat otoritatif laporan';
  END IF;

  IF (SELECT count(*) FROM public.weakness_pj_qms_candidates(r.id))=0
       AND r.pj_qms IS NOT NULL
     OR (SELECT count(*) FROM public.weakness_pj_qms_candidates(r.id))>0
       AND (
         r.pj_qms IS NULL
         OR NOT EXISTS(
           SELECT 1
           FROM public.weakness_pj_qms_candidates(r.id) c
           WHERE c.pj_qms=r.pj_qms
         )
       ) THEN
    RAISE EXCEPTION 'PJ QMS bukan kandidat otoritatif laporan';
  END IF;

  IF v_has_items AND btrim(COALESCE(r.kesimpulan,''))='' THEN
    RAISE EXCEPTION 'Kesimpulan wajib diisi';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM public.weakness_analysis_report_items x
    LEFT JOIN public.findings f
      ON f.id=x.finding_id
     AND f.review_status IN('PUBLISHED','LEGACY_ESTABLISHED')
    LEFT JOIN public.cars c
      ON c.id=x.car_id
     AND c.finding_id=x.finding_id
    WHERE x.report_id=r.id
      AND (f.id IS NULL OR c.id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Relasi Finding/LTP tidak lagi valid';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM public.weakness_analysis_report_items x
    JOIN public.cars c ON c.id=x.car_id
    WHERE x.report_id=r.id
      AND c.status<>'CLOSED'
  ) THEN
    RAISE EXCEPTION 'Masih terdapat LTP yang belum Closed.';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM public.weakness_analysis_report_items x
    LEFT JOIN public.ltp_analysis_classifications c ON c.car_id=x.car_id
    WHERE x.report_id=r.id
      AND (
        c.car_id IS NULL
        OR c.approved_4m1e IS NULL
        OR c.approved_dis IS NULL
        OR c.approved_problem_type IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Klasifikasi seluruh item wajib disetujui';
  END IF;

  IF EXISTS(
    SELECT 1
    FROM public.weakness_why_analysis w
    WHERE w.report_id=r.id
      AND (btrim(w.problem)='' OR btrim(w.akar_permasalahan)='')
  ) OR EXISTS(
    SELECT 1
    FROM public.weakness_why_analysis w
    JOIN public.weakness_why_levels l ON l.why_analysis_id=w.id
    WHERE w.report_id=r.id
      AND (l.level NOT BETWEEN 1 AND 4 OR btrim(l.teks)='')
  ) OR EXISTS(
    SELECT 1
    FROM public.weakness_why_analysis w
    CROSS JOIN LATERAL (
      SELECT
        count(*)::integer n,
        array_agg(l.level ORDER BY l.level) levels
      FROM public.weakness_why_levels l
      WHERE l.why_analysis_id=w.id
    ) x
    WHERE w.report_id=r.id
      AND (
        x.n NOT BETWEEN 1 AND 4
        OR x.levels<>ARRAY(SELECT generate_series(1,x.n))
      )
  ) OR EXISTS(
    SELECT 1
    FROM public.weakness_why_analysis w
    JOIN public.weakness_actions a ON a.why_analysis_id=w.id
    WHERE w.report_id=r.id
      AND (
        btrim(a.rencana_tindakan)=''
        OR btrim(a.pic)=''
        OR a.due_date IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'Why-Why atau Tindakan belum lengkap';
  END IF;

  -- Freeze every input used by Charts #1-#5 at the exact Finalization point.
  -- Existing Final reports created before this migration intentionally retain NULL
  -- snapshot fields and are handled by the frontend's legacy fallback.
  UPDATE public.weakness_analysis_report_items x
  SET
    final_process_name=COALESCE(p.nama_proses,'-'),
    final_category=f.kategori,
    final_reference=f.reference,
    final_4m1e=c.approved_4m1e,
    final_dis=c.approved_dis,
    final_problem_type=c.approved_problem_type
  FROM public.ltp_analysis_classifications c,
       public.findings f
       LEFT JOIN public.audit_instruction_rows ir
         ON ir.id=f.instruction_row_id
       LEFT JOIN public.proses p
         ON p.id=ir.proses_id
  WHERE x.report_id=r.id
    AND c.car_id=x.car_id
    AND f.id=x.finding_id;

  UPDATE public.weakness_analysis_reports
  SET
    status='Final',
    kesimpulan=CASE WHEN v_has_items THEN kesimpulan ELSE '-' END,
    finalized_at=now(),
    revision_version=revision_version+1,
    audit_team_leader_name_snapshot=(
      SELECT nama
      FROM public.auditors
      WHERE id=r.audit_team_leader_auditor_id
    ),
    pj_qms_snapshot=r.pj_qms
  WHERE id=r.id;

  RETURN r.revision_version+1;
END
$function$;

COMMENT ON COLUMN public.weakness_analysis_report_items.final_process_name
  IS 'Process display name frozen when FORM-010 becomes Final.';
COMMENT ON COLUMN public.weakness_analysis_report_items.final_category
  IS 'Finding category A/B/C frozen when FORM-010 becomes Final.';
COMMENT ON COLUMN public.weakness_analysis_report_items.final_reference
  IS 'Finding reference/clause frozen when FORM-010 becomes Final.';

NOTIFY pgrst,'reload schema';
