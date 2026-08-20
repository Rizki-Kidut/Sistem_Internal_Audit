// Data access layer untuk Instruksi Internal Audit (header + rows).

import { supabase } from '../lib/supabaseClient';
import type {
  AuditInstruction,
  AuditInstructionRow,
  SeksiMark,
  AuditorAssignment,
  MatriksProdukMark,
  MatriksManufakturShiftMark,
  ApprovalPair,
  Seksi,
  Proses,
} from '../lib/types';
import { INSTRUCTION_STATUS, TIPE_BARIS, KODE_DOKUMEN_INSTRUCTION } from '../lib/enums';
import type { InstructionStatus, TipeBaris } from '../lib/enums';
import { validateRequired, toDateInput } from '../lib/utils';
import { generateKodeAudit } from '../lib/codeGenerator';

// ============================================================
// MAPPERS
// ============================================================

function mapInstruction(row: Record<string, unknown>): AuditInstruction {
  return {
    id: row.id as string,
    program_id: (row.program_id as string) ?? null,
    tahun_fiskal: row.tahun_fiskal as number,
    tujuan_audit: (row.tujuan_audit as string) ?? null,
    tanggal_buat: (row.tanggal_buat as string) ?? null,
    tanggal_revisi: (row.tanggal_revisi as string) ?? null,
    no_revisi: row.no_revisi as number,
    kode_dokumen: (row.kode_dokumen as string) ?? KODE_DOKUMEN_INSTRUCTION,
    prefix_nomor_audit: (row.prefix_nomor_audit as string) ?? 'QA-',
    approval_pembuatan: (row.approval_pembuatan as ApprovalPair) ?? { dibuat_oleh_qms: null, disetujui_oleh_direktur: null },
    approval_selesai: (row.approval_selesai as ApprovalPair) ?? { dibuat_oleh_qms: null, disetujui_oleh_direktur: null },
    status: (row.status as InstructionStatus) ?? INSTRUCTION_STATUS.DRAFT,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapRow(row: Record<string, unknown>): AuditInstructionRow {
  return {
    id: row.id as string,
    instruction_id: row.instruction_id as string,
    kode_audit: (row.kode_audit as string) ?? '',
    team: (row.team as string) ?? null,
    team_master_id: (row.team_master_id as string) ?? null,
    catatan_justifikasi_tim: (row.catatan_justifikasi_tim as string) ?? null,
    proses_id: (row.proses_id as string) ?? null,
    pemilik_proses: (row.pemilik_proses as string) ?? null,
    seksi_marks: (row.seksi_marks as SeksiMark[]) ?? [],
    auditor: (row.auditor as AuditorAssignment[]) ?? [],
    tipe_baris: (row.tipe_baris as TipeBaris) ?? TIPE_BARIS.REGULER,
    matriks_produk_marks: (row.matriks_produk_marks as MatriksProdukMark[]) ?? [],
    matriks_manufaktur_shift_marks: (row.matriks_manufaktur_shift_marks as MatriksManufakturShiftMark[]) ?? [],
    tanggal_audit_produk: (row.tanggal_audit_produk as string) ?? null,
    nama_auditor_produk: (row.nama_auditor_produk as string) ?? null,
    kualifikasi: (row.kualifikasi as string) ?? null,
    item_lain_diperiksa: (row.item_lain_diperiksa as string) ?? null,
    tanggal_plan_audit: (row.tanggal_plan_audit as string) ?? null,
    tanggal_pelaksanaan_audit: (row.tanggal_pelaksanaan_audit as string) ?? null,
    cek_selesai: (row.cek_selesai as boolean) ?? false,
    urutan_tampil: (row.urutan_tampil as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ============================================================
// AUDIT_INSTRUCTIONS (header)
// ============================================================

export async function getInstructions(): Promise<AuditInstruction[]> {
  const { data, error } = await supabase
    .from('audit_instructions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Gagal memuat instruksi audit: ${error.message}`);
  return (data ?? []).map((r) => mapInstruction(r as Record<string, unknown>));
}

export async function getInstructionById(id: string): Promise<AuditInstruction | null> {
  const { data, error } = await supabase
    .from('audit_instructions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat instruksi audit: ${error.message}`);
  return data ? mapInstruction(data as Record<string, unknown>) : null;
}

export async function saveInstruction(instr: Partial<AuditInstruction>): Promise<AuditInstruction> {
  validateRequired({ tahun_fiskal: instr.tahun_fiskal }, { tahun_fiskal: 'Tahun Fiskal' });
  const payload = {
    program_id: instr.program_id ?? null,
    tahun_fiskal: instr.tahun_fiskal,
    tujuan_audit: instr.tujuan_audit ?? null,
    tanggal_buat: instr.tanggal_buat ?? toDateInput(new Date()),
    tanggal_revisi: instr.tanggal_revisi ?? null,
    no_revisi: instr.no_revisi ?? 0,
    kode_dokumen: instr.kode_dokumen ?? KODE_DOKUMEN_INSTRUCTION,
    prefix_nomor_audit: instr.prefix_nomor_audit ?? 'QA-',
    approval_pembuatan: instr.approval_pembuatan ?? { dibuat_oleh_qms: null, disetujui_oleh_direktur: null },
    approval_selesai: instr.approval_selesai ?? { dibuat_oleh_qms: null, disetujui_oleh_direktur: null },
    status: instr.status ?? INSTRUCTION_STATUS.DRAFT,
  };
  if (instr.id) {
    const { data, error } = await supabase
      .from('audit_instructions').update(payload).eq('id', instr.id).select().single();
    if (error) throw new Error(`Gagal mengupdate instruksi audit: ${error.message}`);
    return mapInstruction(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from('audit_instructions').insert(payload).select().single();
  if (error) throw new Error(`Gagal menambah instruksi audit: ${error.message}`);
  return mapInstruction(data as Record<string, unknown>);
}

export async function deleteInstruction(id: string): Promise<void> {
  const { error } = await supabase.from('audit_instructions').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus instruksi audit: ${error.message}`);
}

// ============================================================
// AUDIT_INSTRUCTION_ROWS
// ============================================================

export async function getRowsByInstruction(instructionId: string): Promise<AuditInstructionRow[]> {
  const { data, error } = await supabase
    .from('audit_instruction_rows')
    .select('*')
    .eq('instruction_id', instructionId)
    .order('urutan_tampil', { ascending: true });
  if (error) throw new Error(`Gagal memuat baris instruksi: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}
export async function getAllInstructionRows(): Promise<AuditInstructionRow[]> {
  const { data, error } = await supabase.from('audit_instruction_rows').select('*').order('kode_audit');
  if (error) throw new Error(`Gagal memuat worklist Checklist Audit: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function getRowsByKodeAudits(kodeAudits: string[]): Promise<AuditInstructionRow[]> {
  const uniqueCodes = [...new Set(kodeAudits.filter(Boolean))];
  if (uniqueCodes.length === 0) return [];
  const { data, error } = await supabase
    .from('audit_instruction_rows').select('*').in('kode_audit', uniqueCodes)
    .order('urutan_tampil', { ascending: true });
  if (error) throw new Error(`Gagal memuat baris instruksi sesi: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function saveRow(row: Partial<AuditInstructionRow>): Promise<AuditInstructionRow> {
  validateRequired({ instruction_id: row.instruction_id }, { instruction_id: 'Instruction' });
  const payload = {
    instruction_id: row.instruction_id,
    kode_audit: row.kode_audit,
    team: row.team ?? null,
    team_master_id: row.team_master_id ?? null,
    catatan_justifikasi_tim: row.catatan_justifikasi_tim ?? null,
    proses_id: row.proses_id ?? null,
    pemilik_proses: row.pemilik_proses ?? null,
    seksi_marks: row.seksi_marks ?? [],
    auditor: row.auditor ?? [],
    tipe_baris: row.tipe_baris ?? TIPE_BARIS.REGULER,
    matriks_produk_marks: row.matriks_produk_marks ?? [],
    matriks_manufaktur_shift_marks: row.matriks_manufaktur_shift_marks ?? [],
    tanggal_audit_produk: row.tanggal_audit_produk ?? null,
    nama_auditor_produk: row.nama_auditor_produk ?? null,
    kualifikasi: row.kualifikasi ?? null,
    item_lain_diperiksa: row.item_lain_diperiksa ?? null,
    tanggal_plan_audit: row.tanggal_plan_audit ?? null,
    tanggal_pelaksanaan_audit: row.tanggal_pelaksanaan_audit ?? null,
    cek_selesai: row.cek_selesai ?? false,
    urutan_tampil: row.urutan_tampil ?? 0,
  };
  if (row.id) {
    const { data, error } = await supabase
      .from('audit_instruction_rows').update(payload).eq('id', row.id).select().single();
    if (error) throw new Error(`Gagal mengupdate baris: ${error.message}`);
    return mapRow(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from('audit_instruction_rows').insert(payload).select().single();
  if (error) throw new Error(`Gagal menambah baris: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteRow(id: string): Promise<void> {
  const { error } = await supabase.from('audit_instruction_rows').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus baris: ${error.message}`);
}

// ============================================================
// GENERATE KODE AUDIT (QA-01, QA-02, dst) — sekali, tidak berubah
// ============================================================

export async function generateNextKodeAudit(prefix: string): Promise<string> {
  if (prefix !== 'QA-') throw new Error('Prefix nomor audit pusat harus QA-');
  return generateKodeAudit();
}

// ============================================================
// HELPER: Auto-fill pemilik proses dari seksi.kepala_seksi
// ============================================================

export function resolvePemilikProses(
  prosesId: string | null,
  prosesList: Proses[],
  seksiList: Seksi[],
  seksiMarks: SeksiMark[],
): string | null {
  if (!prosesId) return null;
  const targetMark = seksiMarks.find((m) => m.tipe === 'target');
  if (targetMark) {
    const seksi = seksiList.find((s) => s.id === targetMark.seksi_id);
    if (seksi?.kepala_seksi) return seksi.kepala_seksi;
  }
  return null;
}

// ============================================================
// GENERATE DARI PROGRAM — one Postgres RPC transaction.
// The database owns QA allocation, row creation, and existing-scope propagation so a failure
// cannot leave partially propagated generation state.
// ============================================================

export interface GenerateResult {
  instruction: AuditInstruction;
  rowsCreated: number;
}

export async function generateFromProgram(
  programId: string,
  programTahun: number,
  seksiList: Seksi[],
): Promise<GenerateResult> {
  void seksiList;
  const { data, error } = await supabase.rpc('generate_instruction_from_program', {
    p_program_id: programId,
    p_tahun: programTahun,
  });
  if (error) throw new Error(`Gagal generate instruksi: ${error.message}`);
  const result = (data as { instruction_id: string; rows_created: number }[] | null)?.[0];
  if (!result) throw new Error('Generate instruksi tidak menghasilkan data');
  const instruction = await getInstructionById(result.instruction_id);
  if (!instruction) throw new Error('Instruksi hasil generate tidak ditemukan');
  return { instruction, rowsCreated: result.rows_created };

}
