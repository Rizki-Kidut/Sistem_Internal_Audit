// Dependency-free runner using the repository's existing TypeScript/React packages.
// Run: node tests/form010-presentation.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  // Inspect ECharts options without a browser; this does not claim SVG layout acceptance.
  if (filename.endsWith('/WeaknessEChart.tsx')) {
    module.exports = { WeaknessEChart: () => React.createElement('div', { 'data-chart': true }) };
    return;
  }
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
};
require.extensions['.css'] = () => {};
const { formatAuditExecutionDates } = require('../src/lib/utils.ts');
const { WeaknessAnalysisPrintView } = require('../src/components/pages/WeaknessAnalysisPrintView.tsx');
const { ProcessStackedChart, PieDistributionChart, ProblemTypeChart } = require('../src/components/pages/WeaknessCharts.tsx');
const cases = [
  [[], '-'],
  [['2026-09-11'], '11 September 2026'],
  [['2026-09-10', '2026-09-09', '2026-09-09'], '9–10 September 2026'],
  [['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11'], '7–11 September 2026'],
  [['2026-09-09', '2026-09-11'], '9 & 11 September 2026'],
  [['2026-09-07', '2026-09-08', '2026-09-10', '2026-09-11'], '7–8 & 10–11 September 2026'],
  [['2026-09-30', '2026-10-01'], '30 September–1 Oktober 2026'],
  [['2026-12-31', '2027-01-01'], '31 Desember 2026–1 Januari 2027'],
  [['2026-02-30', 'invalid'], '-'],
];
for (const [dates, expected] of cases) assert.equal(formatAuditExecutionDates(dates), expected);
const data = [{ process: 'Small', A: 0, B: 1, C: 0 }, { process: 'Large', A: 2, B: 2, C: 1 }, { process: 'Middle', A: 1, B: 1, C: 0 }];
const original = JSON.stringify(data);
const option = ProcessStackedChart({ data }).props.children[1].props.children[0].props.option;
assert.deepEqual(option.xAxis.data, ['Large', 'Middle', 'Small']);
assert.deepEqual(option.series[3].data, [62.5, 87.5, 100]);
assert.equal(option.series[3].yAxisIndex, 1);
assert.equal(option.yAxis[1].max, 100);
assert.equal(JSON.stringify(data), original);
assert(!JSON.stringify(option).includes('markLine'));
for (const bar of option.series.slice(0, 3)) assert.equal(bar.stack, 'findings');
const pie = PieDistributionChart({ title: 'Pie', values: { METHOD: 1 } }).props.children[1].props.children[0].props.option;
assert.deepEqual(pie.series[0].radius, ['36%', '78%']);
assert.equal(pie.series[0].data[0].itemStyle.color.type, 'linear');
assert.equal(ProblemTypeChart({ values: { A: 1 } }).props.children[1].props.option.series[0].type, 'bar');
const types = [
  ['ChecklistSistem', 'Audit Sistem', cases[3][0], cases[3][1]],
  ['ChecklistManufakturShift', 'Audit Proses Manufaktur', cases[2][0], cases[2][1]],
  ['ChecklistProduk', 'Audit Produk', cases[1][0], cases[1][1]],
];
for (const [audit_type, label, audit_execution_dates, dateLabel] of types) {
  for (const preview of [true, false]) {
    const report = { audit_type, audit_execution_dates, judul: 'Synthetic context', tanggal: '2026-09-16', audit_team_leader_name_snapshot: 'Real leader', pj_qms_snapshot: 'Real PJ', kesimpulan: 'Must not render with zero Findings' };
    const staleWhy = [{ nomor: 1, sort_order: 1, problem: 'Stale fabricated problem', akar_permasalahan: 'Stale root', levels: [], actions: [] }];
    const html = renderToStaticMarkup(React.createElement(WeaknessAnalysisPrintView, { report, items: [], why: staleWhy, preview }));
    assert(html.includes(`A. Hasil ${label} (${dateLabel})`));
    for (const metadata of ['Synthetic context', 'Real leader', 'Real PJ', '16-Sep-2026', 'FORM-010-REV.0']) assert(html.includes(metadata));
    for (const unwanted of ['data-chart', 'Belum ada data', 'Must not render', 'Stale fabricated', 'Stale root']) assert(!html.includes(unwanted));
    assert(html.includes('Berat (Major) = -'));
    assert(html.includes('Ringan (Minor) = -'));
    assert(html.includes('Peluang Improvement = -'));
    assert(html.includes('Total ketidaksesuaian = -'));
    assert.equal(html.includes('DRAFT / PREVIEW'), preview);
    assert((html.match(/<td>-<\/td>/g) || []).length >= 46);
    const order = ['1. Berdasarkan', '2. Analisa', '3. Analisa', '5. Jenis', '4. Analisa'].map(title => html.indexOf(title));
    assert.deepEqual(order, [...order].sort((a, b) => a - b));
    // A mismatching item's source must never choose/change the report's header identity.
    const populated = renderToStaticMarkup(React.createElement(WeaknessAnalysisPrintView, { report, items: [{ process: 'Process', finding: { source_type: 'unknown', kategori: 'B' }, classification: {} }], why: [], preview }));
    assert(populated.includes(`A. Hasil ${label} (${dateLabel})`));
    assert(populated.includes('data-chart'));
  }
}
const css = fs.readFileSync(path.join(__dirname, '../src/components/pages/weaknessAnalysisPrint.css'), 'utf8');
const chartCss = fs.readFileSync(path.join(__dirname, '../src/components/pages/weaknessCharts.css'), 'utf8');
assert(css.includes('font-size:14pt;font-weight:700'));
assert(css.includes('text-align:center;white-space:nowrap'));
assert(css.includes('size:A3 landscape'));
assert(css.includes('width:419mm;min-height:296mm'));
assert(css.includes('grid-template-rows:minmax(min-content,3fr) minmax(min-content,2fr)'));
assert(css.includes('.form010-data-row{height:auto}'));
assert(css.includes('.form010-table-section>.form010-fill-table{flex:1 1 0;height:auto;min-height:0;margin-top:-1px}'));
const narrativeRule = css.match(/\.form010-why-section td,\.form010-action-section td\{([^}]+)\}/)?.[1] || '';
for (const declaration of ['white-space:pre-wrap', 'overflow-wrap:anywhere', 'word-break:break-word', 'vertical-align:top']) {
  assert(narrativeRule.includes(declaration));
}
for (const clipping of ['overflow:hidden', 'max-height']) assert(!narrativeRule.includes(clipping));
assert(chartCss.includes('.weakness-chart-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(280px,1.25fr) repeat(2,minmax(230px,1fr))'));
assert(chartCss.includes('.form010 .weakness-chart-grid{flex:1;grid-template-rows:minmax(56mm,1.15fr) repeat(2,minmax(45mm,1fr));gap:2mm}'));

const populatedReport = { audit_type: 'ChecklistSistem', audit_execution_dates: ['2026-09-16'], judul: 'Row sizing', tanggal: '2026-09-16' };
const populatedItems = [{ process: 'Process', finding: { source_type: 'ChecklistSistem', kategori: 'B' }, classification: {} }];
const populatedWhy = [{
  nomor: 1,
  sort_order: 1,
  problem: 'Problem narrative',
  akar_permasalahan: 'Root narrative',
  levels: [{ level: 1, teks: 'Why narrative' }],
  actions: [{ rencana_tindakan: 'Action narrative', pic: 'PIC', due_date: '2026-09-30', status: 'Berjalan' }],
}];
const populatedHtml = renderToStaticMarkup(React.createElement(WeaknessAnalysisPrintView, {
  report: populatedReport,
  items: populatedItems,
  why: populatedWhy,
  preview: true,
}));
assert.equal((populatedHtml.match(/class="form010-data-row"/g) || []).length, 2);
assert.equal((populatedHtml.match(/form010-blank-why/g) || []).length, 3);
assert.equal((populatedHtml.match(/form010-blank-action/g) || []).length, 2);
assert.equal((populatedHtml.match(/class="form010-fill-row"/g) || []).length, 2);
assert.equal((populatedHtml.match(/class="form010-fill-table"/g) || []).length, 2);

console.log(`PASS: ${cases.length} exact-date cases; all three families × Draft/Final empty/populated headers; dash-only analysis; intrinsic data rows with minimum blanks and dedicated fillers; compact FORM-010 chart grid; metadata/watermarks; retained Pareto/beveled/A–E options. TZ=${process.env.TZ || 'default'}`);
