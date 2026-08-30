# Batch 7d — Admin Manage User + Annual Auditor Access

Status: `IMPLEMENTED_PENDING_BROWSER_VERIFICATION`

## Scope

- Added Admin-only **Manage User** navigation and page.
- Added direct Admin provisioning through an authenticated Supabase Edge Function; no service-role/secret key is exposed to the React client.
- The Auth identity is created server-side with its email already confirmed. No invitation, confirmation request, verification link, or temporary credential is sent or displayed.
- Admin configures the role and required application mapping immediately in **Manage User**. Corporate email/SSO authentication remains future scope.
- Added business roles shown to Admin: Admin, Lead Auditor, Auditor, Auditee, Section Manager.
- Kept the persisted identity architecture compatible:
  - Lead Auditor remains `identity_type = AUDITOR` + `user_auditor_links.is_lead_auditor = true`.
  - Team Leader remains a Team Audit roster responsibility (`audit_team_master_members.is_team_leader`), not a new Auth identity.
- Added annual normal-Auditor access assignment through `user_audit_plan_assignments` linking User + Annual Audit Plan + Team Audit.
- Team dropdown is derived from existing Team Audit masters and only offers teams whose roster already contains the selected Auditor Master.
- Normal Auditor access requires both Team roster membership and an active annual assignment for that exact plan/team.
- Admin and company Lead Auditor remain global and do not require annual reassignment.
- Existing normal-Auditor access was backfilled once during migration to prevent breaking the current staging workflow. Future Annual Audit Plans are not auto-assigned.
- Auditor notification delivery and LTP Manager → Auditor availability checks now respect the same annual assignment gate.

## Smoke Team Leader mapping

Staging Auth user:

`88cdc09d-4add-4be8-a93f-d34fbaff68c3`

is configured for browser smoke as:

- profile identity: `AUDITOR`
- linked Auditor Master: `f075a744-b125-418c-b185-d64a1f1b5d74` (`B6B Smoke Auditor Lead`)
- company Lead Auditor flag: `false`
- Annual Audit Plan: year 2099, plan `75c79c1e-5bd9-40de-b4e3-0f6eecb04089`
- Team Audit: `B6B-SMOKE-TEAM` / `B6B Browser Smoke Team`
- Team responsibility: `is_team_leader = true`
- annual assignment status: `Aktif`

This deliberately grants Team Leader responsibility without company Lead Auditor authority.

## Applied Staging migration

`20260828055425_add_admin_user_management_and_annual_auditor_access.sql`

The applied migration is immutable. Any correction must be additive.

## Direct provisioning decision

The original invitation + email-verification onboarding was replaced by direct Admin provisioning because the production target will use corporate email authentication. **Manage User → Tambah User → Simpan** now creates the Supabase Auth identity server-side and then configures its CertiTrack role/mapping through the existing Admin RPC.

`admin-create-user`:

- requires a valid caller JWT and revalidates the caller against the active Admin application profile;
- uses the server-only Auth Admin API with `email_confirm: true`;
- generates a cryptographically random password server-side only as an Auth implementation detail;
- never returns, displays, logs, stores, or emails that password;
- returns only the new Auth user ID and normalized email;
- does not call an invitation or verification-email API;
- rejects an existing Auth email and directs Admin to edit that user from **Manage User**;
- does not derive authorization from user-editable Auth metadata.

The former deployed `admin-invite-user` is deprecated and no longer called by the React application. It may remain temporarily deployed until replacement verification is complete, but it is not part of the application flow.

## Deployed Edge Function

`admin-create-user`

- deployment/status: ACTIVE on CertiTrack-Staging (version 1)
- JWT verification: enabled
- verifies the caller is an active Admin before using the backend Auth Admin API
- role authorization is not derived from editable user metadata

Deployment inspection confirmed both the replacement and deprecated function are ACTIVE with JWT verification enabled. A direct unauthenticated POST to `admin-create-user` returned HTTP 401 and created no data. Authenticated non-Admin rejection, active-Admin creation, confirmed-email state, duplicate-email handling, and role/Section mapping remain part of the pending authenticated/browser reverification; no PASS is claimed for those runtime cases yet.

## Runtime verification

Passed rollback-only assertions:

- smoke UUID resolves as normal `AUDITOR`, not company Lead Auditor;
- active year-2099 assignment permits access to the matching Team-owned audit rows;
- Team Leader capability is available while the annual assignment is active;
- deactivating the annual assignment removes normal Auditor and Team Leader workflow access;
- company Lead Auditor capability remains global when tested without an annual assignment;
- new-year proof: adding the Auditor to a Team roster in another Annual Audit Plan does **not** grant access automatically; access becomes true only after an explicit new annual assignment is added;
- Admin RPC can configure a normal Auditor and create the matching annual Plan/Team assignment;
- configured Auditor gains scoped audit access;
- non-Admin use of the Admin save RPC is rejected;
- changing a configured Auditor to Admin removes/inactivates incompatible Auditor mappings;
- Lead Auditor can be configured without an annual assignment;
- Admin list RPC exposes users to Admin and returns no user list to normal Auditor;
- rollback fixtures were removed.

Privilege verification:

- `authenticated` has SELECT only on `user_audit_plan_assignments`;
- direct INSERT / UPDATE / DELETE are denied;
- Admin mutation RPC is callable by authenticated sessions but fail-closed inside the function unless the caller is Admin;
- anon cannot execute the Admin mutation RPC;
- internal annual-access helper is not directly executable by authenticated clients.

Supabase Security Advisor was reviewed after DDL. The new Admin RPCs appear in the expected authenticated-callable `SECURITY DEFINER` warning class; runtime authorization checks above verify their intended fail-closed boundaries. Existing unrelated advisor warnings remain outside this batch.

## Synchronization with merged Batch 7d Manager Decision

- Synchronized with `origin/main` at `5d46218c4f1625d7dc628b49a0eae4c18d3f5ebd` after PR #13 merged.
- The finalized Section Manager Return/Approve workflow, post-decision Section 7 state, and cumulative `Riwayat Review & Persetujuan` from main are preserved.
- PR #14 browser verification remains pending; this synchronization does not claim Manage User browser PASS.

## Source/deployment verification

- Vercel branch build/deployment: PASS on implementation head before this documentation-only commit.
- Diff is scoped to Admin user management, annual Auditor access, one Edge Function, and one additive migration.
- `/project` is untouched.
- Post-synchronization `npm run typecheck`, `npm run build`, and `git diff --check` passed. The build reported only the existing Browserslist metadata and bundle-size advisories.

## Browser verification required before merge recommendation

1. Login as Admin and confirm **Administrasi → Manage User** appears only for Admin.
2. Confirm the existing smoke user shows Auditor + year 2099 + `B6B-SMOKE-TEAM` + `Team Leader` and does not show Lead Auditor.
3. Open/Edit a normal Auditor and confirm Annual Plan and Team Audit selectors are shown.
4. Confirm changing Annual Plan limits the Team Audit dropdown to Team masters from that Plan containing the selected Auditor Master.
5. Confirm Admin and Lead Auditor do not require Annual Plan/Team assignment.
6. Confirm Auditee and Section Manager use Section assignment instead of Auditor/Team fields.
7. Provision a disposable corporate-style test email as Auditee with a Section. Verify it appears immediately with Auth status **Terdaftar**, its role and Section mapping are present, and there is no invitation/verification waiting step.
8. Confirm an Auditor cannot access a new-year Team merely from roster membership until Admin creates the new annual assignment.

Browser reverification of direct provisioning remains pending and is not marked PASS in this document.
