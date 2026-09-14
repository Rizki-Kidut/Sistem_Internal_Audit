- [ ] Complete real-browser Draft/Final/read-only and A4 Portrait 100% print/Save-as-PDF smoke against representative zero-, one-, and multi-page Finding reports.

Batch 8b2 is no longer `NOT_STARTED`; only the Staging/runtime and browser/print verification above prevents `VERIFIED_COMPLETE`.

---

## Batch 9a — Weakness Analysis and AI-assisted classification — 14 Sep 2026

**Status:** `IMPLEMENTED_UNVERIFIED` (base `c3028cbf086708231bb13fa645cbcc1c919a343a`).

### Implemented repository scope

- Added the single additive migration `supabase/migrations/20260914120000_create_batch9a_weakness_analysis.sql`
  (corrected pre-application SHA-256 `57eee2d2c124ad9fc82600a445bebda4218b29f8ef44dce3b8441a144c58220d`; the former hash is obsolete). It adds normalized report, persisted population, reusable
  approved LTP classification, append-only AI suggestion, systemic Why 1–4, and multi-action tables.
- Batch 9a database access is exactly `public.is_admin_identity() OR
  public.current_auditor_is_lead_auditor()` through `can_manage_weakness_analysis()`. RLS limits reads to
  that capability, authenticated table mutation is revoked, and guarded RPCs re-check authorization.
  Ordinary Auditors, Team Master leaders without company capability, Sub Leaders, Auditees, Section
  Managers, and inactive identities receive no Batch 9a authority from team membership.
- Added guarded create/populate, classification approval, optimistic Draft save, and atomic Finalize RPCs.
  Finalization locks the report, checks expected revision and Draft state, validates population/current
  Finding-LTP relations, requires every LTP Closed and every taxonomy approved, requires a conclusion,
  validates any existing Why/Action structures, snapshots approved classifications/signatory display
  values, and increments the revision once. Final report-owned content and population are immutable.
- Enabled the capability-aware `analisa` route/sidebar without granting every AUDITOR. Added list/create,
  four-tab workspace, manual/AI Accepted/AI Edited classification, bounded-concurrency AI actions, five
  deterministic chart views, robust IATF clause parsing, deterministic conclusion helper, systemic Why
  and multiple Actions, blocker display, and Draft/Final controls.
- Added dedicated A3 Landscape FORM-010 preview/print rendering with `DRAFT / PREVIEW` watermark only for
  Draft, controlled document code `Q-120-ISE-001-FORM-010-REV.0`, sections A/B/C, break-safe rows, and
  browser print. Native deterministic SVG/CSS charts are used so the report remains dependency-light and
  stable for A3 browser print/Save-as-PDF.
- Added `supabase/functions/weakness-ai-classify/index.ts`. It authenticates the caller, resolves the
  database capability rather than trusting browser flags, fetches authoritative text context server-side,
  defends against prompt injection, calls the OpenAI Responses API with strict JSON Schema, hashes normalized
  inputs for compatible-result reuse, and appends model/prompt/hash/result/token/request metadata. Compatible
  AI suggestion reuse is scoped to the active `weakness_report_id` so a cached suggestion from another report
  cannot be returned as though it belonged to the current analysis. It reads only server secrets
  `OPENAI_API_KEY`, optionally `OPENAI_MODEL_FAST` (default `gpt-5.6-luna`), `OPENAI_MODEL_DEEP` (default
  `gpt-5.6-terra`), and `OPENAI_PROMPT_VERSION` (default `batch9a-v1`). No OpenAI secret is stored in the
  repository or a `VITE_*` variable.
- Prepared the required Staging authorization/finalization/AI runtime matrix in
  `docs/batch-9a-authorization-matrix.md`.

### Known limitations and verification remaining

- The migration is intentionally unapplied and the Edge Function intentionally undeployed. Staging schema,
  constraints, RLS, the full authorization matrix, transactional blockers/stale revision, manual/AI Accepted/
  AI Edited flows, real OpenAI request, and browser A3 pagination/no-watermark behavior remain unverified.
- The correction pass replaced the invalid `audit_programs.nama_program` query with the established
  `jenis_ronde`, `nomor_ke`, `tahun`, `status`, and `penanggung_jawab_qms` DTO and a TypeScript label such as
  `Berkala ke-1 · FY2026`. Program reports no longer display a raw UUID.
- Team Leader candidates now resolve uniquely through persisted report Finding → Instruction row → Team
  Master member `is_team_leader` → Auditor. PJ QMS candidates resolve from Programs represented by persisted
  population. Draft-save and Finalize validate both candidate sets in the database; zero candidates normalize
  to NULL, one auto-selects in the UI, and multiple candidates use restricted selectors.
- Classification approval is scoped by a Draft report-item ID. The database validates an optional suggestion
  against that report/canonical LTP and derives `MANUAL`, `AI_ACCEPTED`, or `AI_EDITED`; client-supplied
  provenance was removed. Finding `seksi_auditee_id` now resolves to `seksi.nama` for UI and AI context.
- FORM-010 screen and print share deterministic chart components: Process-stacked Major/Minor/OFI with totals,
  SVG donut distributions for clause/DIS/4M+1E, and an A–E bar chart with legend. Why rows persist only 1–4
  nonblank contiguous levels, allowing unused trailing Why columns.
- OpenAI Responses API payload remains subject to deployment smoke verification against the configured model
  and project credentials before Batch 9a can move beyond `IMPLEMENTED_UNVERIFIED`.
- Batch 9b was not implemented. Historical migrations and nested `/project` were not changed.
