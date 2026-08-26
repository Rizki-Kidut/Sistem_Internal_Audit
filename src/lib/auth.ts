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
}

const permissions: Record<IdentityType, readonly PageId[]> = {
  ADMIN: ['kalibrasi','training','rencana-audit','program-audit','instruksi-audit','plant-admin','checklist','agenda','pelaksanaan','temuan','car','ketidaksesuaian','laporan','analisa','seksi','proses','bank-checklist','team-master'],
  AUDITOR: ['checklist', 'agenda', 'pelaksanaan', 'temuan', 'car'],
  AUDITEE: ['car'],
  SECTION_MANAGER: ['agenda', 'car'],
};

export function allowedPages(identity: IdentityType): readonly PageId[] { return permissions[identity]; }
export function canAccessPage(identity: IdentityType, page: PageId): boolean { return permissions[identity].includes(page); }
export function landingPage(identity: IdentityType): PageId | null { return permissions[identity][0] ?? null; }
