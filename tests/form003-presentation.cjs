const assert = require('node:assert/strict');
const fs = require('node:fs');

const view = fs.readFileSync('src/components/pages/InstructionAuditPrintView.tsx', 'utf8');
const css = fs.readFileSync('src/components/pages/instructionAuditPrint.css', 'utf8');
const helper = fs.readFileSync('src/lib/instructionAuditPrint.ts', 'utf8');
const service = fs.readFileSync('src/services/auditInstructionService.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260928120000_add_form003_instruction_print_read_model.sql', 'utf8');

assert.match(view, /@page \{ size: A3 landscape; margin: 0; \}/, 'runtime A3 landscape target');
assert.match(css, /width:420mm;min-height:297mm/, 'physical A3 geometry');
assert.match(view, /Q-120-ISE-001-FORM-003|FORM003_DOCUMENT_CODE/, 'controlled document code');
assert.match(view, /row\.team_kode/, 'Team column uses Team Master code');
assert.doesNotMatch(view, /row\.team\b|nama_tim/, 'legacy Team/name is not rendered');
assert.match(service, /get_audit_instruction_print_data/, 'central print read model');
assert.match(helper, /target: '★', terkait: '●'/, 'FORM-003 Section symbols');
assert.doesNotMatch(view + helper, /[◎○]/, 'FORM-001 symbols cannot leak into FORM-003');
assert.match(css, /writing-mode:vertical-rl/, 'vertical bottom-aligned matrix headers');
assert.match(view, /matriks_produk_marks/, 'Product matrix source');
assert.match(view, /matriks_manufaktur_shift_marks/, 'Manufacturing/Shift matrix source');
assert.match(helper, /tanggal_audit_produk \?\? row\.tanggal_pelaksanaan_audit/, 'Product execution-date ownership');
assert.match(helper, /FORM003_ROW_CAPACITY = 22/, 'centralized row capacity');
assert.match(view, /continuation=\{pageIndex > 0\}/, 'page 2 approval behavior');
assert.match(view, /<Slash \/>/, 'approval slash uses deterministic SVG');
assert.match(view, /pages\.map[\s\S]*<Header[\s\S]*<ColumnHeaders[\s\S]*<Legend/, 'headers and legend repeat per sheet');
assert.match(view, /page\.fillerRowCount/, 'controlled filler rows');
assert.doesNotMatch(css, /@page/, 'no statically bundled global orientation rule');
assert.match(view, /body:has\(\.form003-print-root\)/, 'runtime root-scoped print shell isolation');
assert.match(migration, /public\.is_admin_identity\(\)/, 'FORM-003 RPC remains aligned with the Admin-only Instruction module');
assert.doesNotMatch(migration, /current_auditor_is_lead_auditor\(\)|dashboard_can_access_instruction_row\(/, 'FORM-003 must not broaden Instruction visibility through Dashboard/Lead scope');
assert.match(migration, /required_sections AS \([\s\S]*r\.tipe_baris='Reguler'/, 'only regular rows create FORM-015 Section obligations');
assert.match(migration, /report\.seksi_id=s\.seksi_id/, 'Final-report counting must be restricted to authoritative Section scope');
assert.match(migration, /WHEN NOT bool_and\(established AND reports_final\) THEN NULL/, 'Instruction completion requires every QA context to be Established and report obligations satisfied');
assert.match(migration, /ELSE max\(CASE WHEN has_required_reports THEN latest_report_final ELSE execution_date::timestamptz END\)/, 'ZERO-LTP completion falls back to authoritative execution dates for special rows');
assert.match(migration, /ELSE true\s+END AS reports_final/, 'Product\/Manufacturing\/Shift rows treat FORM-015 as not applicable');

console.log('FORM-003 presentation/read-model structural regression passed.');
