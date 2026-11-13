const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Render the real print component; these checks do not replace browser Print Preview UAT.
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
};
require.extensions['.css'] = () => {};

const { InstructionAuditPrintView } = require('../src/components/pages/InstructionAuditPrintView.tsx');
const { paginateInstructionAudit } = require('../src/lib/instructionAuditPrint.ts');

const view = fs.readFileSync('src/components/pages/InstructionAuditPrintView.tsx', 'utf8');
const css = fs.readFileSync('src/components/pages/instructionAuditPrint.css', 'utf8');
const helper = fs.readFileSync('src/lib/instructionAuditPrint.ts', 'utf8');
const service = fs.readFileSync('src/services/auditInstructionService.ts', 'utf8');
const migration = fs.readFileSync('supabase/migrations/20260928120000_add_form003_instruction_print_read_model.sql', 'utf8');
const completionDateMigration = fs.readFileSync('supabase/migrations/20260928163000_add_form003_check_completion_date.sql', 'utf8');

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
assert.match(helper, /FORM003_ROW_CAPACITY = 29/, 'centralized A3 capacity supports 29 audit rows');
assert.match(view, /continuation=\{pageIndex > 0\}/, 'page 2 approval behavior');
assert.match(view, /<Slash \/>/, 'approval slash uses deterministic SVG');
assert.match(view, /pages\.map[\s\S]*<Header[\s\S]*<ColumnHeaders[\s\S]*<Legend/, 'headers and legend repeat per sheet');
assert.match(view, /page\.fillerRowCount/, 'controlled filler rows');
assert.doesNotMatch(css, /@page/, 'no statically bundled global orientation rule');
assert.match(view, /body:has\(\.form003-print-root\)/, 'runtime root-scoped print shell isolation');
assert.doesNotMatch(view, /Kapasitas terkendali/, 'visible controlled-capacity helper text must not be printed');
assert.match(view, />Leader audit<\/th>/, 'FORM-003 must render a dedicated Leader audit column');
assert.match(view, /className="form003-col-members"[^>]*>Auditor<\/th>/, 'FORM-003 must render a separate member Auditor column');
assert.match(view, /leader \? `★ \$\{leader\.nama\}` : ''/, 'Team leader must be prefixed with a star');
assert.match(view, /members\.map\(\(member\) => member\.nama\)\.join\('\\n'\)/, 'member auditors must render separately from the leader');
assert.match(view, /filledQuadrants = Math\.max\(0, Math\.min\(4, status \? status - 1 : 0\)\)/, 'status states map to zero-through-four filled quadrants, including empty cells');
assert.match(view, /\[0, 1, 2, 3\]\.map/, 'status motif must always render four quadrants');
assert.match(css, /grid-template-columns:repeat\(2,1fr\);grid-template-rows:repeat\(2,1fr\)/, 'status motif must be a 2x2 square');
assert.match(css, /form003-status-quadrant\.is-filled\{background:#111\}/, 'filled status quadrants must render black');
assert.match(view, /className="form003-status-cell"><StatusQuadrants status=\{row\.status_progress\} cell \/>/, 'status table cell must render the quadrant grid directly inside the cell');
assert.match(view, /row\.formal_finding_count === 0[\s\S]*form003-check-zero[\s\S]*<Slash \/>[\s\S]*date\(row\.cek_selesai_date\)/, 'Zero-Finding Cek selesai must slash the whole cell while Finding rows render the derived LTP verification date');
assert.doesNotMatch(view, /[✓✔☑]/, 'Cek selesai must not render any checklist symbol');
assert.match(completionDateMigration, /'cek_selesai_date',CASE/, 'additive FORM-003 migration must expose a per-QA Cek selesai date');
assert.match(completionDateMigration, /r\.required_ltp_count=r\.formal_finding_count/, 'Cek selesai requires one canonical LTP for every formal Finding');
assert.match(completionDateMigration, /r\.effective_closed_ltp_count=r\.required_ltp_count/, 'Cek selesai requires every required LTP to remain effectively CLOSE');
assert.match(completionDateMigration, /THEN r\.latest_effective_close/, 'Cek selesai uses the latest effective Auditor CLOSE timestamp');
assert.match(completionDateMigration, /ELSE NULL/, 'read model keeps the Cek selesai date null for Zero-Finding or incomplete-LTP rows so presentation can render the controlled slash');
assert.match(css, /form003-check-zero\{padding:0!important;background:#fff\}/, 'Zero-Finding Cek selesai cell must be a clean white vector-slash cell');
assert.match(css, /form003-status-cell\{padding:0!important;overflow:hidden!important\}/, 'status cell must remove inner padding');
assert.match(css, /form003-status-grid-cell\{position:absolute;inset:0;width:100%;height:100%;border:0\}/, 'status quadrant grid must fill the entire table cell');
assert.match(css, /nth-child\(1\).*nth-child\(3\)\{border-right:1px solid #111\}/, 'full-cell status grid must split vertically');
assert.match(css, /nth-child\(1\).*nth-child\(2\)\{border-bottom:1px solid #111\}/, 'full-cell status grid must split horizontally');
assert.doesNotMatch(css, /repeating-linear-gradient/, 'old striped status motifs must not return');
assert.match(view, /<StatusQuadrants status=\{index \+ 1\}\/>/, 'footer legend must reuse the same quadrant renderer');
assert.match(helper, /for \(let index = 0; index < rows\.length; index \+= capacity\)/, 'continuation-page pagination remains active above 29 rows');
assert.match(migration, /public\.is_admin_identity\(\)/, 'FORM-003 RPC remains aligned with the Admin-only Instruction module');
assert.doesNotMatch(migration, /current_auditor_is_lead_auditor\(\)|dashboard_can_access_instruction_row\(/, 'FORM-003 must not broaden Instruction visibility through Dashboard/Lead scope');
assert.match(migration, /required_sections AS \([\s\S]*r\.tipe_baris='Reguler'/, 'only regular rows create FORM-015 Section obligations');
assert.match(migration, /report\.seksi_id=s\.seksi_id/, 'Final-report counting must be restricted to authoritative Section scope');
assert.match(migration, /WHEN NOT bool_and\(established AND reports_final\) THEN NULL/, 'Instruction completion requires every QA context to be Established and report obligations satisfied');
assert.match(migration, /ELSE max\(CASE WHEN has_required_reports THEN latest_report_final ELSE execution_date::timestamptz END\)/, 'ZERO-LTP completion falls back to authoritative execution dates for special rows');
assert.match(migration, /ELSE true\s+END AS reports_final/, 'Product\/Manufacturing\/Shift rows treat FORM-015 as not applicable');

assert.match(completionDateMigration, /e\.event_type IN\('AUDITOR_VERIFIED_CLOSE_TO_ADMIN','ADMIN_RETURNED_TO_AUDITOR'\)[\s\S]*?ORDER BY e\.created_at DESC,e\.id DESC LIMIT 1/, 'current effective decision includes later Admin Return invalidation');
assert.match(completionDateMigration, /e\.event_type='AUDITOR_VERIFIED_CLOSE_TO_ADMIN'\s+ORDER BY e\.created_at DESC,e\.id DESC LIMIT 1[\s\S]*?close_event ON decision\.event_type='AUDITOR_VERIFIED_CLOSE_TO_ADMIN'/, 'only the latest authoritative Auditor CLOSE event supplies a still-effective LTP date');
assert.match(completionDateMigration, /max\(c\.latest_effective_close\) FILTER\(WHERE c\.latest_decision='AUDITOR_VERIFIED_CLOSE_TO_ADMIN' AND c\.status IN\('ADMIN_REVIEW','CLOSED'\)\)/, 'the row uses the latest relevant CLOSE across required LTPs, never a manual or Admin approval date');
assert.match(css, /form003-table th,\.form003-table td\{position:relative/, 'the actual table cell anchors its slash');
assert.match(css, /form003-slash\{position:absolute;inset:0;width:100%;height:100%/, 'vector slash extends to all four cell edges');
assert.match(css, /form003-slash line\{[^}]*vector-effect:non-scaling-stroke;shape-rendering:geometricPrecision/, 'controlled slash keeps a crisp vector stroke when printed');

const data = {
  instruction: {
    tahun_fiskal: 2098, tujuan_audit: 'FORM-003 regression', tanggal_buat: '2098-01-01',
    tanggal_revisi: null, no_revisi: 0,
    approval_pembuatan: { dibuat_oleh_qms: 'QMS', disetujui_oleh_direktur: 'Direktur' },
    approval_selesai: { dibuat_oleh_qms: 'QMS', disetujui_oleh_direktur: 'Direktur' },
  },
  completion_date: '2098-08-20T01:00:00Z',
  sections: [], plants: [], target_models: [], shifts: [],
};
const baseRow = {
  id: 'row-1', kode_audit: 'QA-01', tipe_baris: 'Reguler', team_kode: 'T-01',
  team_roster: [], seksi_marks: [], matriks_produk_marks: [], matriks_manufaktur_shift_marks: [],
  tanggal_plan_audit: '2098-08-14', execution_date: '2098-08-14',
  formal_finding_count: 2, cek_selesai: true, cek_selesai_date: '2098-08-14T01:00:00Z',
  status_progress: 5,
};
const render = (rows) => renderToStaticMarkup(React.createElement(InstructionAuditPrintView, { data: { ...data, rows } }));
const auditRows = (html) => [...html.matchAll(/<tr class="form003-audit-row">([\s\S]*?)<\/tr>/g)].map((match) => match[1]);
const cells = (rowHtml) => [...rowHtml.matchAll(/<td\b[^>]*>[\s\S]*?<\/td>/g)].map((match) => match[0]);
// Cek selesai is the actual penultimate data cell, directly before Status progress.
const completionCell = (html) => cells(auditRows(html)[0]).at(-2);
const text = (html) => html.replace(/<[^>]*>/g, '');
const slash = /<svg\b[^>]*class="form003-slash[^>]*viewBox="0 0 100 100"[^>]*preserveAspectRatio="none"[^>]*><line x1="0" y1="100" x2="100" y2="0"><\/line><\/svg>/;

for (const cek_selesai of [true, false]) {
  const html = render([{ ...baseRow, cek_selesai }]);
  const rowCells = cells(auditRows(html)[0]);
  const cell = completionCell(html);
  assert.equal(text(cell), '14 Agu 2098', 'Finding row prints the supplied authoritative latest Auditor CLOSE date');
  assert.equal(text(cell), text(rowCells.at(-3)), 'Cek selesai uses the same date format as Tanggal pelaksanaan');
  assert.doesNotMatch(cell, /svg|[✓✔☑]|20 Agu/, 'legacy completion flag and Instruction approval date cannot replace the row event date');
}
for (const cek_selesai_date of [null, baseRow.cek_selesai_date]) {
  const cell = completionCell(render([{ ...baseRow, formal_finding_count: 0, cek_selesai_date }]));
  assert.match(cell, /class="form003-check-zero"/, 'Zero Finding slash belongs to the controlled Cek selesai cell');
  assert.match(cell, slash, 'Zero Finding cell contains a bottom-left to top-right SVG line');
  assert.equal(text(cell), '', 'Zero Finding cell contains no date or checklist text, even if a stale date is supplied');
  assert.doesNotMatch(cell, /<img|<canvas|data:image|[✓✔☑]/, 'Zero Finding slash is vector-only');
}
const incomplete = completionCell(render([{ ...baseRow, cek_selesai_date: null, status_progress: 4 }]));
assert.equal(incomplete, '<td></td>', 'Finding row without an effective completed LTP date stays blank rather than being classified as Zero Finding');

for (const [count, expected] of [
  [0, [[0, 29]]], [1, [[1, 28]]], [29, [[29, 0]]], [30, [[29, 0], [1, 28]]],
  [58, [[29, 0], [29, 0]]], [59, [[29, 0], [29, 0], [1, 28]]],
]) {
  const rows = Array.from({ length: count }, (_, index) => ({ ...baseRow, id: `row-${index}`, kode_audit: `QA-${index + 1}` }));
  assert.deepEqual(paginateInstructionAudit(rows).map((page) => [page.rows.length, page.fillerRowCount]), expected);
  const html = render(rows);
  const pages = [...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/g)].map((match) => match[1]);
  assert.equal(pages.length, expected.length, `${count} rows retain the expected page count`);
  assert.doesNotMatch(html, /[✓✔☑]/, 'no page may print a checklist symbol');
  pages.forEach((page, index) => {
    assert.equal(auditRows(page).length, expected[index][0]);
    assert.equal([...page.matchAll(/class="form003-filler-row"/g)].length, expected[index][1]);
    assert.match(page, /<thead>/, 'column headers repeat');
    assert.match(page, /class="form003-legend"/, 'status legend repeats');
    assert.match(page, /<strong>Q-120-ISE-001-FORM-003<\/strong>/, 'document code remains in every page footer');
    const approvals = [...page.matchAll(/<div class="form003-approval-body">([\s\S]*?)<\/div>/g)];
    assert.equal(approvals.length, 2);
    approvals.forEach(([, content]) => {
      if (index > 0) {
        assert.match(content, slash, 'continuation approvals retain their vector slash');
        assert.equal(text(content), '', 'continuation approval areas retain slash-only behavior');
      } else {
        assert.doesNotMatch(content, /<svg/, 'first-page approvals retain their normal contents');
      }
    });
  });
  assert.deepEqual(auditRows(html).map((row) => text(cells(row)[3])), rows.map((row) => row.kode_audit), 'continuation pagination preserves every row exactly once and in order');
}

console.log('PASS: FORM-003 authoritative CLOSE date contract, rendered Cek selesai date/blank/Zero Finding vector slash, 29-row pagination, repeated headers/legend/code, and continuation approval slashes.');
