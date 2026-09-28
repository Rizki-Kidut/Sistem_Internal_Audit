// Dependency-free FORM-015 print-orientation regression.
const fs=require('node:fs');
const assert=require('node:assert/strict');

const css=fs.readFileSync('src/components/pages/internalAuditReportPrint.css','utf8');
const view=fs.readFileSync('src/components/pages/InternalAuditReportPrintView.tsx','utf8');

assert(view.includes('@page { size: A4 portrait; margin: 0; }'),'FORM-015 mounted print root must force A4 portrait');
assert(view.includes('body:has(.form015-preview)'),'FORM-015 print override must be scoped to the mounted report root');
assert(view.includes('body:has(.form015-preview) #root > div'),'FORM-015 print override must reset application-shell height that can create an extra page');
assert(view.includes('body:has(.form015-preview) main > div'),'FORM-015 print override must reset the page workspace wrapper');
assert(view.includes('min-height: 0 !important;'),'FORM-015 print root must clear application min-height during print');
assert(!css.includes('@page form015-report'),'FORM-015 must not use a named page that can return trailing content to the landscape default page');
assert(!css.includes('page: form015-report'),'FORM-015 documents must not switch page names');
assert(!css.includes('@page {'),'Static FORM-015 CSS must not compete globally with runtime portrait print parameters');
assert(css.includes('width: 210mm;')&&css.includes('min-height: 297mm;'),'FORM-015 physical geometry must remain A4 portrait');

console.log('PASS: FORM-015 matches the Daftar Ketidaksesuaian runtime A4 portrait print pattern and resets shell geometry to prevent a trailing landscape page.');
