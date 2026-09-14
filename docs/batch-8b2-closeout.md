# Batch 8b2 Closeout — Internal Audit Report Finalization & Official FORM-015

**Status:** `VERIFIED_STAGING — READY_FOR_MERGE`

**PR:** #24 — Batch 8b2: Finalize Internal Audit Reports and FORM-015 layout

**Base main:** `956e77519f12be300ecb92def1ac181bc2572544`

**Browser-tested implementation head before this documentation-only closeout:** `9e99386cb8a41bbea5c1b5d0cf95046e03a21632`

## Database / migration

- Repository migration: `supabase/migrations/20260911120000_finalize_batch8b2_internal_audit_reports.sql`
- Immutable SHA-256: `566a930ed44bbeb51255dc91bfb50d2022ee4e49b92b681eaf3452ece1ff8c44`
- CertiTrack-Staging ledger: `20260911042029 · finalize_batch8b2_internal_audit_reports`
- The migration is applied to Staging and is immutable. Any future database correction must use a new additive migration.
- Historical Batch 8b1 and Batch 8b2a migrations remain unchanged.

## Finalization / runtime verification — PASS

- Draft → Final is database-authoritative through `finalize_internal_audit_report(...)`.
- Admin authorization, row locking, expected-revision concurrency, Section-scope validation, active-unassigned Finding blocker, scoped-pending Finding blocker, nonblank Hasil/Evaluasi, explicit follow-up decision, complete follow-up structure, and valid Team Leader/Sub Leader signatory checks were exercised on Staging.
- The legacy 13-argument Draft-save RPC remains executable during staged rollout, and the new Draft-save overload works with signatory selection.
- Direct authenticated report-table UPDATE remains unavailable.
- Transactional smoke verified successful save/finalize behavior and rollback preservation; stale revision and invalid/missing signer paths were rejected.
- Final reports are immutable through Draft-save guards and render read-only in the browser.

## Real-browser FORM-015 verification — PASS

Manual real-browser verification against the Vercel Preview connected to CertiTrack-Staging passed for the official `Q-120-ISE-001-FORM-015` layout.

Verified behavior includes:

- A4 Portrait print / Save as PDF at 100% scale.
- Application chrome excluded from print.
- Draft preview watermark enlarged to cover the page diagonally; watermark disappears after Finalization.
- Official document code placed at the bottom-right.
- Audit Team renders one authoritative Team display value rather than duplicated code + name.
- Leader/Sub Leader signature displays the saved signer and safely falls back to the authoritative Team Leader in Draft preview when no saved signer exists.
- Manager context remains derived from the scoped Section; the final signature name uses the report-owned snapshot.
- Zero-Finding report layout passed.
- Populated Finding table layout passed.
- Multi-page Finding pagination passed with a maximum of 5 summary rows per FORM-015 page.
- Every continuation page repeats the full FORM-015 context/layout rather than rendering an isolated Finding table.
- Every page repeats Saran Perbaikan, Catatan/Signature, Rute Laporan, and Dokumen Lainnya so the document format remains complete on every A4 sheet.
- On non-final continuation pages, follow-up / Catatan / approval cells are intentionally crossed with a full solid diagonal line from bottom-left to top-right; only the last page contains the actual follow-up and approval values.
- Diagonal placeholders use a solid line consistently across follow-up, Catatan, Leader/Sub Leader, Manager, and Management Representative cells.
- The last page contains the actual closing-section values and signatory names.

## Multi-page smoke fixture — PASS / CLEANED

A controlled Staging pagination fixture added 12 synthetic established Findings (`B8B2 PAGINATION SMOKE`, Finding numbers 3–14) to exercise a three-page FORM-015 output, including longer requirement text for wrapping behavior.

Browser verification passed for:

- page 1: first 5 Finding summary rows;
- page 2: next 5 Finding summary rows;
- page 3: final 2 Finding summary rows plus actual closing/approval values;
- complete A4-form repetition on every page;
- solid diagonal placeholders on non-final pages;
- no clipped Finding row;
- correct bottom-right document code.

After browser approval, all 12 synthetic pagination Findings were deleted from CertiTrack-Staging. Cleanup verification returned `remaining_smoke_rows = 0`. QA-0101 therefore retains only its original two Draft Findings.

## Static / deployment verification — PASS

- `npm run typecheck` — PASS
- `npm run build` — PASS; only the existing non-blocking Browserslist/bundle-size advisories were reported.
- targeted changed-file ESLint — PASS
- `git diff --check` — PASS
- No package dependency was added for PDF generation; printing uses `window.print()` and FORM-015 print CSS.
- Nested `/project` remains untouched.
- Vercel deployment for the browser-tested implementation head reported SUCCESS.

## Known deferred source decision

No authoritative repository source has been established for the Management Representative identity. The official FORM-015 Management Representative box remains present and renders `-` on the populated/final page. No employee master or inferred QMS equivalence was invented. This is an explicit non-blocking source-integration limitation, not a Batch 8b2 verification failure.

## Merge gate

Batch 8b2 has passed the required Staging database/runtime, real-browser Draft/Final/read-only, zero-Finding, populated-Finding, multi-page FORM-015, and A4 print/PDF verification gates.

PR #24 must remain open and unmerged until explicit user approval to merge into `main`.
