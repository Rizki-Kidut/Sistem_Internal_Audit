// Dependency-free FORM-001 structure/pagination regression. This is not Chrome Print Preview acceptance.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

for (const extension of ['.ts', '.tsx']) require.extensions[extension] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, filename);
};
require.extensions['.css'] = () => {};

const { annualAuditMonths, buildAnnualAuditPrintProcesses, paginateAnnualAuditForm } = require('../src/lib/annualAuditPrint.ts');
const { AnnualAuditPlanPrintView } = require('../src/components/pages/AnnualAuditPlanPrintView.tsx');
const master = Array.from({ length: 15 }, (_, index) => ({
  id: `master-${index + 1}`, kode_proses: `PRC-${String(index + 1).padStart(3, '0')}`,
  nama_proses: index === 0 ? 'Proses dengan nama sangat panjang yang harus tetap tampil lengkap' : `Proses ${index + 1}`,
  diaudit_tahun_ini: index !== 14,
}));
const processes = master.slice(0, 14).map((process, index) => ({
  id: `plan-${index + 1}`, proses_master_id: process.id, nama_proses: process.nama_proses, urutan_tampil: index + 1,
}));
const rows = buildAnnualAuditPrintProcesses(processes, master);
assert.equal(rows.length, 15);
assert.equal(rows.at(-1).active, false);
const pages = paginateAnnualAuditForm(rows);
assert.deepEqual(pages.map((page) => [page.processes.length, page.fillerProcessCount]), [[13, 0], [2, 11]]);
assert.deepEqual(annualAuditMonths(2026).map((month) => month.label), ['Januari 2026', 'Februari 2026', 'Maret 2026', 'April 2026', 'Mei 2026', 'Juni 2026', 'Juli 2026', 'Agustus 2026', 'September 2026', 'Oktober 2026', 'November 2026', 'Desember 2026']);

const plan = { tahun: 2026, tanggal_berlaku: '2026-01-02', no_revisi: 1, kode_dokumen: 'Q-120-ISE-001-FORM-001', penanggung_jawab_qms: 'PJ QMS', disetujui_oleh: 'Direktur' };
const sections = [{ id: 'section-1', nama: 'Seksi dengan nama lengkap yang panjang', urutan_tampil: 1 }];
const links = [{ process_id: 'plan-1', seksi_id: 'section-1', peran: 'utama' }, { process_id: 'plan-2', seksi_id: 'section-1', peran: 'terkait' }];
const schedules = [{ process_id: 'plan-1', bulan: 1, plan: true, aktual: true }];
const html = renderToStaticMarkup(React.createElement(AnnualAuditPlanPrintView, { plan, processes, masterProcesses: master, sections, sectionLinks: links, schedules }));
assert.equal((html.match(/annual-audit-print-page/g) || []).length, 2);
for (const value of ['Rencana Internal Audit Tahunan', 'Seksi dengan nama lengkap yang panjang', 'Januari 2026', '◎', '○', '●', 'Lainnya', 'Hal: 1/2', 'Hal: 2/2', 'Q-120-ISE-001-FORM-001']) assert(html.includes(value));
assert.equal((html.match(/form001-signature-slashed/g) || []).length, 2);
assert(html.includes('form001-inactive-cell'));
assert.equal((html.match(/>PJ QMS</g) || []).length, 1);
assert.equal((html.match(/>Direktur</g) || []).length, 1);

const css = fs.readFileSync(path.join(__dirname, '../src/components/pages/annualAuditPlanPrint.css'), 'utf8');
for (const rule of ['size:A3 landscape', 'width:418mm', 'min-height:294mm', 'border-collapse:collapse', 'table-layout:fixed', 'writing-mode:vertical-rl', 'linear-gradient(to top right', '.annual-audit-print-page:last-child{break-after:auto;page-break-after:auto}']) assert(css.includes(rule));
assert(!css.includes('overflow:hidden'));
console.log('PASS: FORM-001 deterministic two-page shell, master inactivity, matrix marks, continuation signatures, filler grid, Indonesian calendar months, and buffered A3 CSS.');
