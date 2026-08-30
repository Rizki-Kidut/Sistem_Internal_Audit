# PR #14 — Admin Manage User + Annual Auditor Access Verification

Status: `VERIFIED_STAGING — READY_FOR_MERGE`

This file is supporting technical evidence. `PROJECT_STATUS.md` is the canonical project progress,
verification, merge/PR, deferred-scope, known-issue, and next-work record.

PR #14 remains **OPEN** and **UNMERGED**. No known blocking browser issue remains for the implemented
scope; merge still requires explicit user approval.

## Direct provisioning — PASS

The active application flow is:

```text
Admin
→ Manage User
→ Tambah User
→ email/name/NIK
→ role + mapping
→ Simpan
→ Supabase Auth identity created server-side with confirmed email
→ CertiTrack role/mapping active immediately
```

CertiTrack-Staging runs `admin-create-user` version 2 as ACTIVE with JWT verification enabled. The
current Auth Admin call is:

```ts
admin.auth.admin.createUser({
  email,
  email_confirm: true,
})
```

No password or `password_hash` is created. The application uses no invite email or verification
workflow. Provisioning creates an Auth UUID, confirmed email identity, and CertiTrack role/mapping.
Corporate email/SSO authentication is separate future scope and is not implemented here.

The remotely deployed `admin-invite-user` is deprecated, unused by React, and no longer part of the
application flow. It remains deployed temporarily; `admin-create-user` is the active function.

## Real-browser provisioning — PASS

The browser created:

- email: `auditee2@gmail.com`
- name: Rizki
- NIK: `9999`
- role: Auditee
- Section: Quality Control

Manage User displayed Auditee, Aktif, Quality Control, and Auth **Terdaftar**.

Supabase verification:

- Auth UUID: `7db7f3e8-5cf0-44b5-931c-ab87ac20c2d3`
- `email_confirmed_at`: populated
- Auth event: `user_signedup`
- Auth route: `POST /admin/users`
- Edge Function response: HTTP 201
- no new `invite` / `mail.send` event accompanied successful v2 creation

An older invited Auth fixture for the same email came from the deprecated flow and was deleted. The
successful fixture is the current UUID above and was created through `/admin/users`; the two attempts
must not be conflated.

## Duplicate email — PASS

A second attempt to create `auditee2@gmail.com` returned HTTP 409. The browser displayed the expected
message:

> Email sudah terdaftar di Auth. Cari dan edit user tersebut dari Manage User.

Exactly one Auth user remained for the email and no duplicate identity was created.

## Real-browser role-transition matrix — PASS

The same provisioned user passed these transitions:

1. **AUDITEE → SECTION_MANAGER**
   - Section Manager / Quality Control active.
   - No Auditor mapping and no annual Auditor assignment.
2. **SECTION_MANAGER → AUDITOR**
   - Auditor Master linked; `is_lead_auditor = false`.
   - Plan 2099 / `B6B-SMOKE-PLAN-2099` and Team `B6B-SMOKE-TEAM` active.
   - Section assignment removed/inactivated.
   - Selected Auditor Master was not Team Leader.
   - Manage User displayed `2099 · B6B-SMOKE-TEAM` without Team Leader suffix.
3. **AUDITOR → LEAD_AUDITOR**
   - Persisted identity remained `AUDITOR`; `is_lead_auditor = true`.
   - Auditor Master remained required/linked; effective scope became Global.
   - Annual and Section assignments became Nonaktif.
   - Annual Plan/Team are not required for company Lead Auditor.
4. **LEAD_AUDITOR → ADMIN**
   - `identity_type = ADMIN`, scope Global, `auditor_id = null`, and
     `is_lead_auditor = null`.
   - Prior annual and Section assignments remain historical but Nonaktif.

Role-transition cleanup passed. Team Leader
(`audit_team_master_members.is_team_leader`) and company Lead Auditor
(`user_auditor_links.is_lead_auditor`) remained independent concepts.

## Manage User authorization — PASS with explicit caveat

A real-browser non-Admin login did not show Manage User. Source review confirms `user-management`
exists only in the Admin allowed-pages list and `App.tsx` checks
`canAccessPage(identityType, currentPage)` before rendering. The UI/page authorization gate therefore
passed and is not sidebar-hiding only.

The Edge Function retains its server-side active-Admin check. Previously verified runtime evidence
also includes non-Admin denial by the Admin mutation RPC. An authenticated non-Admin direct POST to
`admin-create-user` was **not separately browser-tested** and is not claimed PASS.

## Annual Auditor access — PASS

Rollback/runtime evidence remains valid:

- normal Auditor requires a linked Auditor Master;
- normal Auditor requires an active annual Plan + Team assignment;
- Team roster alone does not grant new-year access;
- explicit annual assignment grants access;
- deactivation removes scoped Auditor access;
- company Lead Auditor remains global;
- Team Leader remains Team-roster-derived;
- notification delivery and LTP Manager → Auditor recipient availability use the same annual gate.

The Admin RPC configured normal Auditor access and its exact annual assignment; the configured user
then gained scoped audit access. Non-Admin mutation was rejected. Changing Auditor to Admin
inactivated incompatible mappings, while company Lead Auditor configuration required no annual
assignment. Admin user listing remained Admin-only. Rollback fixtures were removed.

Privilege checks also confirmed authenticated users have SELECT-only table access to
`user_audit_plan_assignments`; direct INSERT/UPDATE/DELETE are denied; the Admin mutation RPC fails
closed for non-Admin callers; anon cannot execute it; and the internal annual-access helper is not
directly executable by authenticated clients. The expected authenticated-callable `SECURITY DEFINER`
advisor warning class remains documented; complete Security Advisor cleanliness is not claimed.

The existing smoke Team Leader `tl@gmail.com` remains a normal `AUDITOR`, Team Leader on
`B6B-SMOKE-TEAM`, active on Annual Plan 2099, and `is_lead_auditor = false`. This fixture was not
changed.

## Static, deployment, and migration evidence — PASS

- `npm run typecheck`: PASS
- `npm run build`: PASS
- `git diff --check`: PASS
- Vercel implementation deployment: PASS
- `admin-create-user`: version 2, ACTIVE, JWT verification enabled
- non-blocking only: Browserslist/caniuse-lite and bundle-size advisories
- `/project`: untouched

Applied staging migration:

`20260828055425_add_admin_user_management_and_annual_auditor_access.sql`

The migration remains immutable. Verified SHA-256:

`15f53adb08a90ef3d3bdc3107a95d6fb581f4752ccd8ed4d428493c3a6d2b02d`

This final closeout is documentation-only. No application source, React, service, Auth helper, Edge
Function source, migration, SQL/RPC/RLS, Supabase configuration, or nested `/project` file is changed.
