import { supabase } from '../lib/supabaseClient';
import type {
  AuditInstructionRow, ChecklistManufakturBankItem, ChecklistManufakturItem,
  ChecklistManufakturShift, JenisChecklistManufakturShift,
} from '../lib/types';
import {
  CHECKLIST_BANK_STATUS, CHECKLIST_MANUFAKTUR_STATUS, CHECKLIST_MANUFAKTUR_STATUS_LIST,
  HASIL_CHECKLIST_LIST, KODE_DOKUMEN_CHECKLIST_MANUFAKTUR, TIPE_BARIS,
} from '../lib/enums';
import type { HasilChecklist } from '../lib/enums';
import { validateRequired } from '../lib/utils';

const COMPLETED_ERROR = 'Checklist Manufaktur/Shift sudah Selesai. Kembalikan ke Draft sebelum mengubah data.';

const mapChecklist = (row: Record<string, unknown>) => ({
  ...row,
  jenis_checklist: (row.jenis_checklist ?? []) as JenisChecklistManufakturShift[],
  auditor: row.auditor ?? [],
}) as unknown as ChecklistManufakturShift;
const mapBank = (row: Record<string, unknown>) => row as unknown as ChecklistManufakturBankItem;
const mapItem = (row: Record<string, unknown>) => row as unknown as ChecklistManufakturItem;

function validateJenisChecklist(value: unknown): asserts value is JenisChecklistManufakturShift[] {
  if (!Array.isArray(value) || value.some((entry) => !entry || typeof entry !== 'object'
    || typeof entry.plant_id !== 'string' || typeof entry.shift_id !== 'string'
    || typeof entry.plant_nama !== 'string' || typeof entry.shift_nama !== 'string')) {
    throw new Error('Jenis Checklist harus berupa daftar pasangan Plant/Shift yang valid');
  }
}

export async function getManufacturingChecklistsByRow(rowId: string): Promise<ChecklistManufakturShift[]> {
  if (!rowId) throw new Error('Baris Instruksi wajib dipilih');
  const { data, error } = await supabase.from('checklist_manufaktur_shift').select('*')
    .eq('row_id', rowId).order('created_at');
  if (error) throw new Error(`Gagal memuat Checklist Manufaktur/Shift: ${error.message}`);
  return (data ?? []).map((row) => mapChecklist(row as Record<string, unknown>));
}

export async function getManufacturingChecklistById(id: string): Promise<ChecklistManufakturShift | null> {
  const { data, error } = await supabase.from('checklist_manufaktur_shift').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Gagal memuat Checklist Manufaktur/Shift: ${error.message}`);
  return data ? mapChecklist(data as Record<string, unknown>) : null;
}

export async function assertManufacturingChecklistDraft(id: string): Promise<void> {
  const checklist = await getManufacturingChecklistById(id);
  if (!checklist) throw new Error('Checklist Manufaktur/Shift tidak ditemukan');
  if (checklist.status === CHECKLIST_MANUFAKTUR_STATUS.SELESAI) throw new Error(COMPLETED_ERROR);
}

export async function createManufacturingChecklistFromRow(row: AuditInstructionRow): Promise<ChecklistManufakturShift> {
  if (!row.team_master_id) throw new Error('Pilih dan kunci Tim Audit pada Instruksi Internal Audit sebelum membuat checklist.');
  if (![TIPE_BARIS.AUDIT_MANUFAKTUR, TIPE_BARIS.AUDIT_SHIFT].includes(row.tipe_baris as typeof TIPE_BARIS.AUDIT_MANUFAKTUR)) {
    throw new Error('Checklist Manufaktur/Shift hanya dapat dibuat untuk baris Audit Manufaktur atau Audit Shift');
  }
  validateRequired({ row_id: row.id, kode_audit: row.kode_audit }, { row_id: 'Baris Instruksi', kode_audit: 'Kode Audit QA' });
  const { data, error } = await supabase.rpc('create_manufacturing_checklist_from_row', { p_row_id: row.id });
  if (error) throw new Error(`Gagal membuat Checklist Manufaktur/Shift: ${error.message}`);
  const checklist = await getManufacturingChecklistById(data as string);
  if (!checklist) throw new Error('Checklist Manufaktur/Shift yang dibuat tidak ditemukan');
  return checklist;
}

export async function saveManufacturingChecklist(checklist: Partial<ChecklistManufakturShift>): Promise<ChecklistManufakturShift> {
  validateRequired({ row_id: checklist.row_id, kode_audit: checklist.kode_audit }, { row_id: 'Baris Instruksi', kode_audit: 'Kode Audit QA' });
  const status = checklist.status ?? CHECKLIST_MANUFAKTUR_STATUS.DRAFT;
  if (!CHECKLIST_MANUFAKTUR_STATUS_LIST.includes(status)) throw new Error('Status Checklist Manufaktur/Shift tidak valid');
  validateJenisChecklist(checklist.jenis_checklist ?? []);
  if (checklist.jumlah_operator != null && (!Number.isInteger(checklist.jumlah_operator) || checklist.jumlah_operator < 0)) {
    throw new Error('Jumlah operator harus berupa bilangan bulat nol atau lebih');
  }
  if (!checklist.id) throw new Error('Checklist baru harus dibuat dari baris Instruksi Audit');
  const current = await getManufacturingChecklistById(checklist.id);
  if (!current) throw new Error('Checklist Manufaktur/Shift tidak ditemukan');
  if (current.row_id !== checklist.row_id || current.kode_audit !== checklist.kode_audit) throw new Error('Relasi baris dan kode QA tidak dapat diubah');
  const { data: sourceRow, error: rowError } = await supabase.from('audit_instruction_rows')
    .select('kode_audit,tipe_baris').eq('id', current.row_id).maybeSingle();
  if (rowError || !sourceRow || sourceRow.kode_audit !== current.kode_audit
    || ![TIPE_BARIS.AUDIT_MANUFAKTUR, TIPE_BARIS.AUDIT_SHIFT].includes(sourceRow.tipe_baris)) {
    throw new Error('Checklist tidak terkait dengan baris Audit Manufaktur/Shift yang valid');
  }
  if (current.status === CHECKLIST_MANUFAKTUR_STATUS.SELESAI && status !== CHECKLIST_MANUFAKTUR_STATUS.DRAFT) throw new Error(COMPLETED_ERROR);
  const payload = {
    jenis_checklist: checklist.jenis_checklist, nama_seksi: checklist.nama_seksi ?? null,
    manager_proses_line_leader: current.manager_proses_line_leader,
    tanggal_audit: current.tanggal_audit, auditor: current.auditor,
    nama_part: checklist.nama_part ?? null, nomor_part: checklist.nomor_part ?? null,
    nomor_line: checklist.nomor_line ?? null, control_plan_no: checklist.control_plan_no ?? null,
    p_fmea_no: checklist.p_fmea_no ?? null, customer: checklist.customer ?? null,
    jumlah_operator: checklist.jumlah_operator ?? null, status,
    kode_dokumen: KODE_DOKUMEN_CHECKLIST_MANUFAKTUR,
  };
  const { data, error } = await supabase.from('checklist_manufaktur_shift').update(payload).eq('id', checklist.id).select().single();
  if (error) throw new Error(`Gagal menyimpan Checklist Manufaktur/Shift: ${error.message}`);
  return mapChecklist(data as Record<string, unknown>);
}

export async function deleteManufacturingChecklist(id: string): Promise<void> {
  await assertManufacturingChecklistDraft(id);
  const { error } = await supabase.from('checklist_manufaktur_shift').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus Checklist Manufaktur/Shift: ${error.message}`);
}

export async function getManufacturingBankItems(): Promise<ChecklistManufakturBankItem[]> {
  const { data, error } = await supabase.from('checklist_manufaktur_bank_items').select('*')
    .order('urutan_tampil').order('bagian').order('nomor');
  if (error) throw new Error(`Gagal memuat Bank Checklist Manufaktur: ${error.message}`);
  return (data ?? []).map((row) => mapBank(row as Record<string, unknown>));
}

export async function saveManufacturingBankItem(item: Partial<ChecklistManufakturBankItem>): Promise<ChecklistManufakturBankItem> {
  validateRequired({ bagian: item.bagian, nomor: item.nomor }, { bagian: 'Bagian', nomor: 'Nomor' });
  const payload = { bagian: item.bagian, nomor: item.nomor, klausul: item.klausul ?? null,
    item_pemeriksaan: item.item_pemeriksaan ?? null, urutan_tampil: item.urutan_tampil ?? 0,
    status: item.status ?? CHECKLIST_BANK_STATUS.AKTIF };
  const query = item.id ? supabase.from('checklist_manufaktur_bank_items').update(payload).eq('id', item.id)
    : supabase.from('checklist_manufaktur_bank_items').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw new Error(`Gagal menyimpan Bank Checklist Manufaktur: ${error.message}`);
  return mapBank(data as Record<string, unknown>);
}

export async function deactivateManufacturingBankItem(id: string): Promise<void> {
  const { error } = await supabase.from('checklist_manufaktur_bank_items').update({ status: CHECKLIST_BANK_STATUS.NONAKTIF }).eq('id', id);
  if (error) throw new Error(`Gagal menonaktifkan Bank Checklist Manufaktur: ${error.message}`);
}

export async function getManufacturingItems(checklistId: string): Promise<ChecklistManufakturItem[]> {
  const { data, error } = await supabase.from('checklist_manufaktur_items')
    .select('*,bank_item:checklist_manufaktur_bank_items(*)').eq('checklist_id', checklistId)
    .order('urutan_tampil').order('created_at');
  if (error) throw new Error(`Gagal memuat item Checklist Manufaktur: ${error.message}`);
  return (data ?? []).map((row) => mapItem(row as Record<string, unknown>));
}

export async function initializeManufacturingItemsFromBank(checklistId: string): Promise<void> {
  await assertManufacturingChecklistDraft(checklistId);
  const bank = (await getManufacturingBankItems()).filter((item) => item.status === CHECKLIST_BANK_STATUS.AKTIF);
  const existing = new Set((await getManufacturingItems(checklistId)).map((item) => item.bank_item_id).filter(Boolean));
  const payload = bank.filter((item) => !existing.has(item.id)).map((item) => ({ checklist_id: checklistId, bank_item_id: item.id, urutan_tampil: item.urutan_tampil }));
  if (payload.length) {
    const { error } = await supabase.from('checklist_manufaktur_items').insert(payload);
    if (error) throw new Error(`Gagal menginisialisasi item Checklist Manufaktur: ${error.message}`);
  }
}

export interface ManufacturingItemPreparationPayload {
  id?: string;
  checklist_id: string;
  bank_item_id?: string | null;
  no_proses_dicek?: string | null;
  urutan_tampil?: number;
}

/** Saves FORM-007 item structure without touching execution or Finding fields. */
export async function saveManufacturingItemPreparation(item: ManufacturingItemPreparationPayload): Promise<ChecklistManufakturItem> {
  validateRequired({ checklist_id: item.checklist_id }, { checklist_id: 'Checklist Manufaktur/Shift' });
  if (item.id) {
    const { data: old } = await supabase.from('checklist_manufaktur_items').select('checklist_id').eq('id', item.id).maybeSingle();
    if (!old || old.checklist_id !== item.checklist_id) throw new Error('Item tidak terkait dengan checklist yang dipilih');
  }
  await assertManufacturingChecklistDraft(item.checklist_id);
  const payload = {
    checklist_id: item.checklist_id,
    bank_item_id: item.bank_item_id ?? null,
    no_proses_dicek: item.no_proses_dicek?.trim() || null,
    urutan_tampil: item.urutan_tampil ?? 0,
  };
  const query = item.id
    ? supabase.from('checklist_manufaktur_items').update(payload).eq('id', item.id)
    : supabase.from('checklist_manufaktur_items').insert({ ...payload, hasil_pengamatan: null, hasil: null });
  const { data, error } = await query.select('*,bank_item:checklist_manufaktur_bank_items(*)').single();
  if (error) throw new Error(`Gagal menyimpan persiapan item Manufaktur/Shift: ${error.message}`);
  return mapItem(data as Record<string, unknown>);
}

export interface ManufacturingItemExecutionPayload {
  id: string;
  hasil_pengamatan: string | null;
  hasil: HasilChecklist | null;
}

/** Saves only Genba observation and judgement; structural and Finding fields are untouched. */
export async function saveManufacturingItemExecution(item: ManufacturingItemExecutionPayload): Promise<ChecklistManufakturItem> {
  const { data: readiness, error: readinessError } = await supabase
    .from('checklist_manufaktur_items')
    .select('checklist:checklist_manufaktur_shift(status)')
    .eq('id', item.id)
    .maybeSingle();
  if (readinessError) throw new Error(`Gagal memeriksa kesiapan Checklist Manufaktur/Shift: ${readinessError.message}`);
  const checklist = Array.isArray(readiness?.checklist) ? readiness.checklist[0] : readiness?.checklist;
  if (checklist?.status !== CHECKLIST_MANUFAKTUR_STATUS.SELESAI) {
    throw new Error('Checklist Manufaktur/Shift belum Siap Pelaksanaan. Selesaikan persiapan Checklist Audit terlebih dahulu.');
  }
  if (item.hasil && !HASIL_CHECKLIST_LIST.includes(item.hasil)) throw new Error('Judgement checklist tidak valid');
  if ((item.hasil && !item.hasil_pengamatan?.trim()) || (!item.hasil && item.hasil_pengamatan?.trim())) {
    throw new Error('Hasil Pengamatan dan Judgement wajib diisi bersama');
  }
  const { data, error } = await supabase.from('checklist_manufaktur_items').update({
    hasil_pengamatan: item.hasil_pengamatan?.trim() || null,
    hasil: item.hasil,
  }).eq('id', item.id).select('*,bank_item:checklist_manufaktur_bank_items(*)').single();
  if (error) throw new Error(`Gagal menyimpan pelaksanaan Manufaktur/Shift: ${error.message}`);
  return mapItem(data as Record<string, unknown>);
}

export async function deleteManufacturingItem(id: string): Promise<void> {
  const { data, error: loadError } = await supabase.from('checklist_manufaktur_items').select('checklist_id').eq('id', id).maybeSingle();
  if (loadError || !data) throw new Error('Item Checklist Manufaktur tidak ditemukan');
  await assertManufacturingChecklistDraft(data.checklist_id as string);
  const { error } = await supabase.from('checklist_manufaktur_items').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus item Checklist Manufaktur: ${error.message}`);
}
