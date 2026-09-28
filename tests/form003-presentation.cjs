const assert = require('node:assert/strict');
const fs = require('node:fs');

const view = fs.readFileSync('src/components/pages/InstructionAuditPrintView.tsx', 'utf8');
const css = fs.readFileSync('src/components/pages/instructionAuditPrint.css', 'utf8');
const helper = fs.readFileSync('src/lib/instructionAuditPrint.ts', 'utf8');
const service = fs.readFileSync('src/services/auditInstructionService.ts', 'utf8');

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

console.log('FORM-003 presentation regression passed.');
