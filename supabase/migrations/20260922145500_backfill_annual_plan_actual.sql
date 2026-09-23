-- Backfill FORM-001 Actual materialization for audit executions that were already
-- completed before the automatic Actual migration was installed.
-- Only uniquely-resolvable Annual Plan Process + execution-month contexts are reconciled.
-- The centralized reconciliation function still decides whether Actual is TRUE/FALSE
-- based on checklist completion, Finding review state, and any active Admin override.

DO $$
DECLARE
  v_context record;
BEGIN
  FOR v_context IN
    SELECT DISTINCT
      public.annual_actual_plan_process(ir.instruction_id, ir.proses_id) AS process_id,
      extract(
        month FROM CASE
          WHEN ir.tipe_baris='AuditProduk'
            THEN COALESCE(ir.tanggal_audit_produk, ir.tanggal_pelaksanaan_audit)
          ELSE ir.tanggal_pelaksanaan_audit
        END
      )::integer AS bulan
    FROM public.audit_instruction_rows ir
    WHERE ir.cek_selesai
      AND CASE
        WHEN ir.tipe_baris='AuditProduk'
          THEN COALESCE(ir.tanggal_audit_produk, ir.tanggal_pelaksanaan_audit)
        ELSE ir.tanggal_pelaksanaan_audit
      END IS NOT NULL
  LOOP
    IF v_context.process_id IS NOT NULL AND v_context.bulan BETWEEN 1 AND 12 THEN
      PERFORM public.reconcile_annual_plan_actual(v_context.process_id, v_context.bulan);
    END IF;
  END LOOP;
END
$$;
