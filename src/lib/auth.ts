import type { PageId } from '../components/layout/Sidebar';

export const IDENTITY_TYPES = ['ADMIN', 'AUDITOR', 'AUDITEE', 'SECTION_MANAGER'] as const;
export type IdentityType = typeof IDENTITY_TYPES[number];
export type IdentityStatus = 'Aktif' | 'Nonaktif';

export interface UserProfile {
  id: string;
  display_name: string;
  nik: string | null;
  identity_type: IdentityType;
  status: IdentityStatus;
  created_at: string;
  updated_at: string;
  is_company_lead_auditor?: boolean;
}

const permissions: Record<IdentityType, readonly PageId[]> = {
  ADMIN: ['dashboard','kalibrasi','training','rencana-audit','program-audit','instruksi-audit','plant-admin','checklist','agenda','pelaksanaan','temuan','car','ketidaksesuaian','laporan','analisa','rangkuman-hasil','seksi','proses','bank-checklist','team-master','user-management'],
  AUDITOR: ['dashboard','checklist', 'agenda', 'pelaksanaan', 'temuan', 'car'],
  AUDITEE: ['dashboard','car'],
  SECTION_MANAGER: ['dashboard','agenda', 'car'],
};

export function allowedPages(identity: IdentityType,isCompanyLeadAuditor=false): readonly PageId[] { return identity==='AUDITOR'&&isCompanyLeadAuditor?[...permissions.AUDITOR,'analisa','rangkuman-hasil']:permissions[identity]; }
export function canAccessPage(identity: IdentityType, page: PageId,isCompanyLeadAuditor=false): boolean { return allowedPages(identity,isCompanyLeadAuditor).includes(page); }
export function landingPage(identity: IdentityType): PageId | null { return permissions[identity].includes('dashboard') ? 'dashboard' : permissions[identity][0] ?? null; }
