import type { InstructionAuditPrintRow } from './types';

export const FORM003_ROW_CAPACITY = 29;
export const FORM003_DOCUMENT_CODE = 'Q-120-ISE-001-FORM-003';
export const FORM003_SECTION_MARKS = { target: '★', terkait: '●' } as const;

export const FORM003_STATUS_LEGEND = [
  'Pelaksanaan audit tidak ada ketidaksesuaian',
  'Pelaksanaan audit ada ketidaksesuaian',
  'Sudah kirim Laporan audit',
  'Sudah kirim Laporan tindakan perbaikan',
  'Selesai',
] as const;

export interface InstructionAuditPrintPage {
  rows: InstructionAuditPrintRow[];
  fillerRowCount: number;
}

export function paginateInstructionAudit(
  rows: InstructionAuditPrintRow[],
  capacity = FORM003_ROW_CAPACITY,
): InstructionAuditPrintPage[] {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error('Kapasitas halaman FORM-003 harus berupa bilangan bulat positif.');
  }
  const pages: InstructionAuditPrintPage[] = [];
  for (let index = 0; index < rows.length; index += capacity) {
    const pageRows = rows.slice(index, index + capacity);
    pages.push({ rows: pageRows, fillerRowCount: capacity - pageRows.length });
  }
  return pages.length ? pages : [{ rows: [], fillerRowCount: capacity }];
}

export function instructionExecutionDate(row: Pick<InstructionAuditPrintRow, 'tipe_baris' | 'tanggal_audit_produk' | 'tanggal_pelaksanaan_audit'>) {
  return row.tipe_baris === 'AuditProduk'
    ? row.tanggal_audit_produk ?? row.tanggal_pelaksanaan_audit
    : row.tanggal_pelaksanaan_audit;
}
