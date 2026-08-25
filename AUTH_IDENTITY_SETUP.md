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

Reference visibility follows the same least-visibility boundary for ordinary Auditors: they receive only
process and section labels referenced by Team-owned Instruction rows, while Managers receive only
managed-section Agenda context. The single company Lead Auditor is the deliberate exception for read-only
oversight: that Auditor identity may read all Finding/checklist/source context needed to review Findings from
every Team, while execution mutations remain Team-scoped. Auditees receive no general process/section
masters in Batch 7.0. Clause suggestions are Auditor/Admin-only. Agenda may be printed by Admin, assigned
Auditors, and scoped Managers without changing database state.

Agenda approval/rejection is intentionally a follow-up. Batch 7a LTP must reuse these ownership
helpers: Auditee by active `AUDIT_PIC`, Manager by active `SECTION_MANAGER`, Auditor by assigned Team,
and Admin globally. This foundation does not create LTP/CAR tables or transitions.

## Finding responsibility and publication

Finding review separates Team authority from company authority without creating another Auth identity type.

- Every active Audit Team has exactly one **Team Leader**. Historical `peran='Lead'` is retained only as the
  legacy storage marker for that Team Leader and is backfilled once to `is_team_leader=true`.
- The company has at most one active **Lead Auditor** capability, stored on `user_auditor_links.is_lead_auditor`.
  Lead Auditor is company-wide and is not selected inside Audit Team Master.
- The Lead Auditor may also be Team Leader/member of one Team, or may belong to no Team at all. Company-wide
  review authority is unchanged either way.
- Ordinary Auditor execution and PLOR editing remain Team-scoped. The company Lead Auditor may read all
  Finding/checklist/source context but may execute or edit PLOR only when separately assigned to that Team.

Provision the company Lead Auditor only after creating the AUDITOR profile and Auditor link:

```sql
-- At most one row may be true. Clear the old holder first when transferring authority.
update public.user_auditor_links
set is_lead_auditor = true
where user_id = '<lead-auditor-auth-user-uuid>';
```

The controlled flow is:

`Auditor Member prepares/revises PLOR → Team Leader submits/resubmits → Company Lead Auditor requests
revision, approves, or annuls → System assigns the official number on approval → Admin/QMS releases`.

Submit/Resubmit fails closed when no active company Lead Auditor is configured, preventing a Finding from
entering review with no authorized reviewer. New Drafts use a stable draft reference and receive official
`{QA}/{SYS|PRD|MFG}/{year}/{NNN}` numbers only at Lead approval. A numbered legacy Draft keeps its
pre-workflow number through review instead of receiving a replacement number.

Review events, Admin/Team PLOR edits, annulled-source dispositions, and release actions are append-only.
Submit/Resubmit notifications go to the active company Lead Auditor. Revision notifications are generated
for every active mapped Auditor in the owning Team except the requesting Lead when that person is also a
Team member; every recipient owns independent read state. PLOR saves use the controlled `save_finding_plor`
RPC plus `revision_version` optimistic concurrency to reject stale edits. Admin/QMS correction is an
explicit controlled exception, not the normal authoring path: it is available only while the Finding is
`DRAFT` or `REVISION_REQUIRED`, requires a reason containing at least ten non-whitespace characters, and
records actor, reason, changed fields, and full before/after values in the immutable `PLOR_EDITED` event.
The exception cannot change Checklist/source judgement or execution state, cannot submit/resubmit or make
Lead decisions, and does not bypass the Team Leader → company Lead Auditor review chain. Direct ordinary
PLOR updates are rejected.

Application functions revoke inherited `PUBLIC`/`anon` execution. Authenticated browser execution is
limited to caller-bound helpers/RPCs needed by the application, while trigger/source-sync internals remain
private; the Batch 6b blocker/complete/reopen functions remain `SECURITY INVOKER`.

Lead annulment changes the authoritative source result to effective conforming (`O` for System/
Manufacturing, `OK` for Product) while preserving the initial judgement, reason, reviewer, timestamp,
Finding link, and review event. Checklist and Pelaksanaan history also resolve the concrete RLS-scoped
source item (System item/question/clause, Product phase/item/criteria, or Manufacturing process/bank item)
so external reviewers can distinguish multiple annulled Findings without relying on UUIDs.

## Runtime/RLS verification plan (not executed in this PR)

Using disposable Auth users and transaction-safe fixtures, verify: anonymous SELECT rejection; Admin
global access; inverse Team A/Team B execution mutation denial; ordinary Auditor direct UUID isolation;
company Lead Auditor global Finding/checklist/source read with zero execution/PLOR authority outside any
Team; company Lead review/approve/annul across Team A and Team B; the same Lead acting as Team Leader only
for a separately assigned Team; submit failure when no active company Lead is configured; Manager
target-section Agenda visibility; profile escalation, Auditor remapping, and section self-assignment
rejection; completion/reopen ownership; continued DB-trigger Finding creation/removal; legacy numbered
Draft preservation; governed annulment and source history; evidence signed URL isolation; and final
`cek_selesai` locks.
Also confirm `complete_audit_execution`, `reopen_audit_execution`, and `audit_execution_blockers`
remain `SECURITY INVOKER`.
