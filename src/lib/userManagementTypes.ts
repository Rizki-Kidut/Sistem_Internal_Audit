import type { IdentityStatus, IdentityType } from './auth';

export const MANAGE_USER_ROLES = ['ADMIN','LEAD_AUDITOR','AUDITOR','AUDITEE','SECTION_MANAGER'] as const;
export type ManageUserRole = typeof MANAGE_USER_ROLES[number];

export const MANAGE_USER_ROLE_LABEL: Record<ManageUserRole,string> = {
  ADMIN:'Admin',
  LEAD_AUDITOR:'Lead Auditor',
  AUDITOR:'Auditor',
  AUDITEE:'Auditee',
  SECTION_MANAGER:'Section Manager',
};

export interface ManagedSectionAssignment {
  id:string;
  seksi_id:string;
  seksi_nama:string;
  assignment_type:'AUDIT_PIC'|'SECTION_MANAGER';
  status:IdentityStatus;
}

export interface ManagedAnnualAssignment {
  id:string;
  plan_id:string;
  tahun:number;
  plan_kode:string;
  team_id:string;
  team_kode:string;
  team_nama:string;
  status:IdentityStatus;
  is_team_leader:boolean;
}

export interface ManagedUser {
  user_id:string;
  email:string|null;
  email_confirmed_at:string|null;
  display_name:string|null;
  nik:string|null;
  identity_type:IdentityType|null;
  role:ManageUserRole|null;
  status:IdentityStatus|null;
  auditor_id:string|null;
  auditor_name:string|null;
  is_lead_auditor:boolean;
  section_assignments:ManagedSectionAssignment[];
  annual_assignments:ManagedAnnualAssignment[];
}

export interface SaveManagedUserAccessInput {
  user_id:string;
  display_name:string;
  nik:string|null;
  role:ManageUserRole;
  status:IdentityStatus;
  auditor_id:string|null;
  plan_id:string|null;
  team_id:string|null;
  seksi_id:string|null;
}

export interface ProvisionedUser { id:string;email:string; }
