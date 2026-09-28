// Dependency-free FORM-015 print-orientation regression.
const fs=require('node:fs');
const assert=require('node:assert/strict');

const css=fs.readFileSync('src/components/pages/internalAuditReportPrint.css','utf8');

assert(css.includes('@page form015-report {'),'FORM-015 must use a named print page');
assert(css.includes('size: A4 portrait;'),'FORM-015 named page must remain A4 portrait');
assert(css.includes('page: form015-report;'),'FORM-015 document must bind to its named page');
assert(!/@media print\s*\{\s*@page\s*\{/.test(css),'FORM-015 must not publish a bare global @page rule that can conflict with landscape forms');
assert(css.includes('width: 210mm;')&&css.includes('min-height: 297mm;'),'FORM-015 physical geometry must remain A4 portrait');

console.log('PASS: FORM-015 uses an isolated named A4 portrait page and cannot be overridden by unrelated landscape @page rules.');
