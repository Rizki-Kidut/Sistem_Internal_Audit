# CertiTrack Identity & Access Setup

> Finding compatibility: identity authorization does not replace the operational Finding/CAR
> lifecycle. `findings.status` remains operational; Team/Lead/Admin publication uses the separate
> `findings.review_status`. Existing numbered Findings are preserved. Completed/progressed legacy
> records become `LEGACY_ESTABLISHED`, while numbered Findings on unfinished audits remain
> `DRAFT`-compatible so their PLOR can be completed and reviewed without replacing the old number.

## Identity is not a person

Each Supabase Auth account has exactly one active CertiTrack identity: `ADMIN`, `AUDITOR`,
`AUDITEE`, or `SECTION_MANAGER`. A person who performs more than one responsibility receives a
separate Auth account (and therefore a separate `auth.uid()`) for each responsibility. CertiTrack has
no role switch; the person must log out and log in with the other account. This preserves segregation
of duties and an unambiguous audit trail.

Never commit passwords, service-role keys, or production credentials. The browser uses only the
Supabase publishable/anon key and a normal Auth session.

## Trusted first-Admin bootstrap

1. In the Supabase Dashboard, create and confirm an email/password user under **Authentication → Users**.
2. Copy the generated `auth.users.id`.
3. In the trusted SQL editor (not from the browser), insert the profile:

```sql
insert into public.user_profiles(id, display_name, nik, identity_type)
values ('<auth-user-uuid>', 'Nama Admin', null, 'ADMIN');
```

4. Log in normally through CertiTrack. Subsequent profile/mapping administration is allowed only to
   an active Admin identity or trusted administrative SQL.

## Provisioning identities

First create a distinct Auth user, then insert exactly one matching profile:

```sql
insert into public.user_profiles(id, display_name, nik, identity_type)
values ('<auth-user-uuid>', 'Nama Tampilan', '<optional-nik>', 'AUDITOR');
```

Use `AUDITEE` or `SECTION_MANAGER` instead for those identities. `status='Nonaktif'` prevents normal
application access without deleting history.

### Auditor mapping

The existing `auditors` row remains authoritative; do not create a second Auditor master or alter its UUID.

```sql
insert into public.user_auditor_links(user_id, auditor_id)
values ('<auditor-auth-user-uuid>', '<existing-auditors-id>');
```

The database requires an `AUDITOR` profile and enforces one login per `auditors.id`. Audit ownership is:
`auth.uid()` → link → `auditors.id` → `audit_team_master_members` → Team → Instruction row.
Only Team-owned QA rows and descendants are returned by RLS, including direct UUID/QA lookups,
worklist counts, search results, filters, and dropdown sources.

### Auditee/Section Manager assignment

```sql
insert into public.section_identity_assignments(user_id, seksi_id, assignment_type)
values ('<auditee-auth-user-uuid>', '<seksi-id>', 'AUDIT_PIC');

insert into public.section_identity_assignments(user_id, seksi_id, assignment_type)
values ('<manager-auth-user-uuid>', '<seksi-id>', 'SECTION_MANAGER');
```

The assignment type must match the profile identity. The initial model permits one active Audit PIC
and one active Section Manager per section. Users can read their own assignment but cannot assign or
remap themselves. An identity type cannot be changed while an incompatible Auditor link or active
section assignment remains; administrators must remove the Auditor link or explicitly deactivate the
section assignment first, so mapping history is never deleted silently.

## Current and future access contract

- **Admin:** all existing preparation, master, execution, Agenda, and PLOR modules; execution content is visible globally but Auditor execution actions remain read-only/blocked.
- **Auditor:** Team-owned Checklist (read-only preparation), Agenda (read-only), Pelaksanaan, and PLOR.
- **Auditee:** restricted authenticated state until LTP exists.
- **Section Manager:** section-scoped Agenda read-only; no Checklist, Pelaksanaan, or PLOR.

Reference visibility follows the same least-visibility boundary: Auditors receive only process and
section labels referenced by Team-owned Instruction rows, while Managers receive only managed-section
Agenda context. Auditees receive no general process/section masters in Batch 7.0. Clause suggestions are
Auditor/Admin-only, Manufacturing bank labels are limited to Team-owned execution items, and Manager
Team/Lead/member names are limited to Teams used by Manager-accessible Agenda rows. Agenda may be
printed by Admin, assigned Auditors, and scoped Managers without changing database state.

Agenda approval/rejection is intentionally a follow-up. Batch 7a LTP must reuse these ownership
helpers: Auditee by active `AUDIT_PIC`, Manager by active `SECTION_MANAGER`, Auditor by assigned Team,
and Admin globally. This foundation does not create LTP/CAR tables or transitions.

## Finding responsibility and publication

Finding review uses audit-team responsibilities, not additional Auth identities. Existing Team Leads
are migrated explicitly as both Team Leader and Lead Auditor by default; the two boolean authorities
remain independent and may be assigned to the same or different Auditor members. The controlled flow is:

`Auditor Member prepares/revises PLOR → Team Leader submits/resubmits → Lead Auditor requests revision,
approves, or annuls → System assigns the official number on approval → Admin/QMS releases`.

New Drafts use a stable draft reference and receive official `{QA}/{SYS|PRD|MFG}/{year}/{NNN}` numbers
only at Lead approval. A numbered legacy Draft keeps its pre-workflow number through review instead of
receiving a replacement number. Review events, Admin/Team PLOR edits, annulled-source dispositions,
and release actions are append-only. Revision notifications are generated for every active mapped Team
Auditor except the requesting Lead; every recipient owns independent read state. PLOR saves use
`revision_version` optimistic concurrency to reject stale edits.

Lead annulment changes the authoritative source result to effective conforming (`O` for System/
Manufacturing, `OK` for Product) while preserving the initial judgement, reason, reviewer, timestamp,
Finding link, and review event. The Checklist workspace exposes that history so external reviewers can
see why an originally nonconforming judgement now has a conforming effective result.

## Runtime/RLS verification plan (not executed in this PR)

Using disposable Auth users and transaction-safe fixtures, verify: anonymous SELECT rejection; Admin
global access; inverse Team A/Team B worklists and direct UUID denial; scoped counters/search/filter
values; System/Product/Manufacturing allowed execution columns and rejected structural columns;
Finding and Agenda Team isolation; Manager target-section Agenda visibility; profile escalation,
Auditor remapping, and section self-assignment rejection; completion/reopen ownership; continued
DB-trigger Finding creation/removal; legacy numbered Draft preservation; governed annulment and source
history; evidence signed URL isolation; and final `cek_selesai` locks.
Also confirm `complete_audit_execution`, `reopen_audit_execution`, and `audit_execution_blockers`
remain `SECURITY INVOKER`.
