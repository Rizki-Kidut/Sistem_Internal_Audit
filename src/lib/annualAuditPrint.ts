import type { AuditPlanProcess, AuditPlanSeksiLink, Proses, Seksi } from './types';
import { PERAN_PROSES } from './enums';

export const FORM001_PROCESS_CAPACITY = 13;
export const FORM001_FISCAL_START_MONTH = 4;
export const FORM001_FOOTNOTES = [
  '*1: termasuk audit proses, audit shift, dan audit produk',
  '*2: lingkup audit: konfirmasi PDCA terkait kontrol kebijakan',
] as const;

export function formatAnnualAuditSectionMark(link?: AuditPlanSeksiLink): string {
  if (!link?.peran) return '';
  const relationship = link.peran === PERAN_PROSES.UTAMA ? '◎' : '○';
  const flag1 = link.flag_audit_proses_shift_produk ? '*1' : '';
  const flag2 = link.flag_lingkup_pdca ? '*2' : '';
  return `${relationship}${flag1}${flag2}`;
}

export function resolveAnnualAuditSections(selectedIds: string[], sections: Seksi[]): Seksi[] {
  const selected = new Set(selectedIds);
  return sections
    .filter((section) => selected.has(section.id))
    .sort((a, b) => a.urutan_tampil - b.urutan_tampil);
}

export interface AnnualAuditPrintProcess {
  key: string;
  planProcess: AuditPlanProcess | null;
  masterProcess: Proses | null;
  nama_proses: string;
  active: boolean;
}

export interface AnnualAuditPrintPage {
  processes: AnnualAuditPrintProcess[];
  fillerProcessCount: number;
}

/** Keep plan order; append unsynchronized inactive master rows without persisting print data. */
export function buildAnnualAuditPrintProcesses(
  planProcesses: AuditPlanProcess[],
  masterProcesses: Proses[],
): AnnualAuditPrintProcess[] {
  const masterById = new Map(masterProcesses.map((process) => [process.id, process]));
  const representedMasterIds = new Set<string>();
  const rows = [...planProcesses].sort((a, b) => a.urutan_tampil - b.urutan_tampil).map((planProcess) => {
    const masterProcess = planProcess.proses_master_id ? masterById.get(planProcess.proses_master_id) ?? null : null;
    if (masterProcess) representedMasterIds.add(masterProcess.id);
    return {
      key: planProcess.id,
      planProcess,
      masterProcess,
      nama_proses: planProcess.nama_proses,
      active: masterProcess?.diaudit_tahun_ini ?? true,
    };
  });
  const inactiveMissingFromPlan = masterProcesses
    .filter((process) => !process.diaudit_tahun_ini && !representedMasterIds.has(process.id))
    .sort((a, b) => a.kode_proses.localeCompare(b.kode_proses, 'id'))
    .map((masterProcess) => ({
      key: `master-${masterProcess.id}`,
      planProcess: null,
      masterProcess,
      nama_proses: masterProcess.nama_proses,
      active: false,
    }));
  return [...rows, ...inactiveMissingFromPlan];
}

export function paginateAnnualAuditForm(
  processes: AnnualAuditPrintProcess[],
  capacity = FORM001_PROCESS_CAPACITY,
): AnnualAuditPrintPage[] {
  if (!Number.isInteger(capacity) || capacity < 1) throw new Error('Kapasitas halaman FORM-001 harus berupa bilangan bulat positif.');
  const pages: AnnualAuditPrintPage[] = [];
  for (let index = 0; index < processes.length; index += capacity) {
    const pageProcesses = processes.slice(index, index + capacity);
    pages.push({ processes: pageProcesses, fillerProcessCount: capacity - pageProcesses.length });
  }
  return pages.length ? pages : [{ processes: [], fillerProcessCount: capacity }];
}

export interface AnnualAuditMonth { month: number; year: number; label: string }
const INDONESIAN_MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'] as const;

/** Returns presentation order while retaining real calendar month numbers for schedule lookup. */
export function annualAuditMonths(year: number, startMonth = 1): AnnualAuditMonth[] {
  return Array.from({ length: 12 }, (_, offset) => {
    const zeroBased = startMonth - 1 + offset;
    const month = (zeroBased % 12) + 1;
    const monthYear = year + Math.floor(zeroBased / 12);
    return { month, year: monthYear, label: `${INDONESIAN_MONTHS[month - 1]} ${monthYear}` };
  });
}
