import { supabase } from '../lib/supabaseClient';
import type {
  AuditInstructionRow, ChecklistProduk, ChecklistProdukFase, ChecklistProdukItem,
  ProductChecklistEvidence,
} from '../lib/types';
import {
  CHECKLIST_PRODUK_STATUS, CHECKLIST_PRODUK_STATUS_LIST, JUDGMENT_PRODUK_LIST,
  JUDGMENT_PRODUK, KODE_DOKUMEN_CHECKLIST_PRODUK,
} from '../lib/enums';
import type { JudgmentProduk, KategoriTemuan } from '../lib/enums';
import { KATEGORI_TEMUAN } from '../lib/enums';
import { validateRequired } from '../lib/utils';

const BUCKET = 'audit-evidence';
const COMPLETED_MUTATION_ERROR = 'Checklist Audit Produk sudah Selesai. Kembalikan ke Draft sebelum mengubah data.';

function mapChecklist(row: Record<string, unknown>): ChecklistProduk {
  return { ...row } as unknown as ChecklistProduk;
}
function mapPhase(row: Record<string, unknown>): ChecklistProdukFase {
  return { ...row, dokumen_bukti: (row.dokumen_bukti as ProductChecklistEvidence[]) ?? [] } as unknown as ChecklistProdukFase;
}
function mapItem(row: Record<string, unknown>): ChecklistProdukItem {
  return { ...row } as unknown as ChecklistProdukItem;
}

export async function getProductChecklistsByRow(rowId: string): Promise<ChecklistProduk[]> {
  const { data, error } = await supabase.from('checklist_produk').select('*').eq('row_id', rowId).order('created_at');
  if (error) throw new Error(`Gagal memuat Checklist Audit Produk: ${error.message}`);
  return (data ?? []).map((row) => mapChecklist(row as Record<string, unknown>));
}

export async function getProductChecklistById(id: string): Promise<ChecklistProduk | null> {
  const { data, error } = await supabase.from('checklist_produk').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`Gagal memuat Checklist Audit Produk: ${error.message}`);
  return data ? mapChecklist(data as Record<string, unknown>) : null;
}

export async function assertProductChecklistDraft(checklistId: string): Promise<void> {
  const checklist = await getProductChecklistById(checklistId);
  if (!checklist) throw new Error('Checklist Audit Produk tidak ditemukan');
  if (checklist.status === CHECKLIST_PRODUK_STATUS.SELESAI) throw new Error(COMPLETED_MUTATION_ERROR);
}

async function getChecklistIdForPhase(faseId: string): Promise<string> {
  const { data, error } = await supabase.from('checklist_produk_fase')
    .select('checklist_produk_id').eq('id', faseId).maybeSingle();
  if (error) throw new Error(`Gagal memuat fase produk: ${error.message}`);
  if (!data) throw new Error('Fase Checklist Audit Produk tidak ditemukan');
  return data.checklist_produk_id as string;
}

async function getPhaseIdForItem(itemId: string): Promise<string> {
  const { data, error } = await supabase.from('checklist_produk_items')
    .select('fase_id').eq('id', itemId).maybeSingle();
  if (error) throw new Error(`Gagal memuat item produk: ${error.message}`);
  if (!data) throw new Error('Item Checklist Audit Produk tidak ditemukan');
  return data.fase_id as string;
}

export async function createProductChecklistFromRow(row: AuditInstructionRow): Promise<ChecklistProduk> {
  if (!row.team_master_id) throw new Error('Pilih dan kunci Tim Audit pada Instruksi Internal Audit sebelum membuat checklist.');
  if (row.tipe_baris !== 'AuditProduk') throw new Error('Checklist Audit Produk hanya dapat dibuat untuk baris Audit Produk');
  return saveProductChecklist({
    row_id: row.id, kode_audit: row.kode_audit,
    nama_inspector: row.nama_auditor_produk, kualifikasi_inspector: row.kualifikasi,
    status: CHECKLIST_PRODUK_STATUS.DRAFT, kode_dokumen: KODE_DOKUMEN_CHECKLIST_PRODUK,
  });
}

export async function validateProductChecklistCompletion(checklistId: string): Promise<void> {
  const phases = await getProductPhases(checklistId);
  if (phases.length === 0 || phases.some((phase) => phase.dokumen_bukti.length === 0)) {
    throw new Error('Checklist Audit Produk tidak dapat diselesaikan karena masih ada fase tanpa dokumen bukti');
  }
}

export async function saveProductChecklist(checklist: Partial<ChecklistProduk>): Promise<ChecklistProduk> {
  validateRequired(
    { row_id: checklist.row_id, kode_audit: checklist.kode_audit },
    { row_id: 'Baris Instruksi', kode_audit: 'Kode Audit QA' },
  );
  const status = checklist.status ?? CHECKLIST_PRODUK_STATUS.DRAFT;
  if (!CHECKLIST_PRODUK_STATUS_LIST.includes(status)) throw new Error('Status Checklist Audit Produk tidak valid');
  if (status === CHECKLIST_PRODUK_STATUS.SELESAI) {
    if (!checklist.id) throw new Error('Simpan checklist sebagai Draft sebelum menyelesaikannya');
    await validateProductChecklistCompletion(checklist.id);
  }
  const payload = {
    row_id: checklist.row_id, kode_audit: checklist.kode_audit,
    nama_inspector: checklist.nama_inspector ?? null,
    kualifikasi_inspector: checklist.kualifikasi_inspector ?? null,
    part_name: checklist.part_name ?? null, part_no: checklist.part_no ?? null,
    control_plan_no: checklist.control_plan_no ?? null, status,
    kode_dokumen: checklist.kode_dokumen ?? KODE_DOKUMEN_CHECKLIST_PRODUK,
  };
  const query = checklist.id
    ? supabase.from('checklist_produk').update(payload).eq('id', checklist.id)
    : supabase.from('checklist_produk').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw new Error(`Gagal menyimpan Checklist Audit Produk: ${error.message}`);
  return mapChecklist(data as Record<string, unknown>);
}

export async function deleteProductChecklist(id: string): Promise<void> {
  await assertProductChecklistDraft(id);
  const phases = await getProductPhases(id);
  const paths = phases.flatMap((phase) => phase.dokumen_bukti.map((evidence) => evidence.path));
  const { error } = await supabase.from('checklist_produk').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus Checklist Audit Produk: ${error.message}`);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) throw new Error(`Checklist terhapus, tetapi pembersihan dokumen bukti gagal: ${storageError.message}`);
  }
}

export async function getProductPhases(checklistId: string): Promise<ChecklistProdukFase[]> {
  const { data, error } = await supabase.from('checklist_produk_fase').select('*')
    .eq('checklist_produk_id', checklistId).order('urutan_tampil').order('created_at');
  if (error) throw new Error(`Gagal memuat fase produk: ${error.message}`);
  return (data ?? []).map((row) => mapPhase(row as Record<string, unknown>));
}

export async function saveProductPhase(phase: Partial<ChecklistProdukFase>): Promise<ChecklistProdukFase> {
  validateRequired(
    { checklist_produk_id: phase.checklist_produk_id, nama_fase: phase.nama_fase },
    { checklist_produk_id: 'Checklist Audit Produk', nama_fase: 'Nama Fase' },
  );
  if (phase.id) {
    await assertProductChecklistDraft(await getChecklistIdForPhase(phase.id));
  }
  await assertProductChecklistDraft(phase.checklist_produk_id!);
  const payload = {
    checklist_produk_id: phase.checklist_produk_id, nama_fase: phase.nama_fase,
    nama_proses: phase.nama_proses ?? null, inspection_result_chart: phase.inspection_result_chart ?? false,
    no_inspection_standard: phase.no_inspection_standard ?? null,
    dokumen_bukti: phase.dokumen_bukti ?? [], urutan_tampil: phase.urutan_tampil ?? 0,
  };
  const query = phase.id
    ? supabase.from('checklist_produk_fase').update(payload).eq('id', phase.id)
    : supabase.from('checklist_produk_fase').insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw new Error(`Gagal menyimpan fase produk: ${error.message}`);
  return mapPhase(data as Record<string, unknown>);
}

export async function deleteProductPhase(id: string): Promise<void> {
  const { data: phase, error: phaseError } = await supabase.from('checklist_produk_fase')
    .select('checklist_produk_id,dokumen_bukti').eq('id', id).maybeSingle();
  if (phaseError) throw new Error(`Gagal memuat fase produk: ${phaseError.message}`);
  if (!phase) throw new Error('Fase Checklist Audit Produk tidak ditemukan');
  await assertProductChecklistDraft(phase.checklist_produk_id as string);
  const paths = ((phase?.dokumen_bukti as ProductChecklistEvidence[] | undefined) ?? []).map((file) => file.path);
  const { error } = await supabase.from('checklist_produk_fase').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus fase produk: ${error.message}`);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) throw new Error(`Fase terhapus, tetapi pembersihan dokumen bukti gagal: ${storageError.message}`);
  }
}

export async function getProductItemsByPhase(faseId: string): Promise<ChecklistProdukItem[]> {
  const { data, error } = await supabase.from('checklist_produk_items').select('*')
    .eq('fase_id', faseId).order('urutan_tampil').order('created_at');
  if (error) throw new Error(`Gagal memuat item produk: ${error.message}`);
  return (data ?? []).map((row) => mapItem(row as Record<string, unknown>));
}

export interface ProductItemPreparationPayload {
  id?: string;
  fase_id: string;
  kategori?: string | null;
  jumlah_sampel_minimal?: number | null;
  item_pemeriksaan: string;
  alat_pemeriksaan?: string | null;
  standar_kriteria?: string | null;
  urutan_tampil?: number;
}

/** Saves only inspection-plan fields and preserves every historical execution value. */
export async function saveProductItemPreparation(item: ProductItemPreparationPayload): Promise<ChecklistProdukItem> {
  validateRequired(
    { fase_id: item.fase_id, item_pemeriksaan: item.item_pemeriksaan },
    { fase_id: 'Fase', item_pemeriksaan: 'Item Pemeriksaan' },
  );
  if ((item.jumlah_sampel_minimal ?? 0) < 0) throw new Error('Jumlah sampel minimal tidak boleh negatif');
  if (item.id) {
    const oldPhaseId = await getPhaseIdForItem(item.id);
    await assertProductChecklistDraft(await getChecklistIdForPhase(oldPhaseId));
  }
  await assertProductChecklistDraft(await getChecklistIdForPhase(item.fase_id));
  const payload = {
    fase_id: item.fase_id,
    kategori: item.kategori?.trim() || null,
    jumlah_sampel_minimal: item.jumlah_sampel_minimal ?? null,
    item_pemeriksaan: item.item_pemeriksaan.trim(),
    alat_pemeriksaan: item.alat_pemeriksaan?.trim() || null,
    standar_kriteria: item.standar_kriteria?.trim() || null,
    urutan_tampil: item.urutan_tampil ?? 0,
  };
  const query = item.id
    ? supabase.from('checklist_produk_items').update(payload).eq('id', item.id)
    : supabase.from('checklist_produk_items').insert({
        ...payload, jumlah_sampel: null, hasil_pemeriksaan: null,
        judgment: null, finding_kategori: null,
      });
  const { data, error } = await query.select().single();
  if (error) throw new Error(`Gagal menyimpan persiapan item Produk: ${error.message}`);
  return mapItem(data as Record<string, unknown>);
}

export interface ProductItemExecutionPayload {
  id: string;
  jumlah_sampel: number | null;
  hasil_pemeriksaan: string | null;
  judgment: JudgmentProduk | null;
  finding_kategori: KategoriTemuan | null;
}

/** Saves only actual inspection values; Finding linkage remains trigger-authoritative. */
export async function saveProductItemExecution(item: ProductItemExecutionPayload): Promise<ChecklistProdukItem> {
  const { data: readiness, error: readinessError } = await supabase
    .from('checklist_produk_items')
    .select('fase:checklist_produk_fase(checklist:checklist_produk(status))')
    .eq('id', item.id)
    .maybeSingle();
  if (readinessError) throw new Error(`Gagal memeriksa kesiapan Checklist Produk: ${readinessError.message}`);
  const phase = Array.isArray(readiness?.fase) ? readiness.fase[0] : readiness?.fase;
  const checklist = Array.isArray(phase?.checklist) ? phase.checklist[0] : phase?.checklist;
  if (checklist?.status !== CHECKLIST_PRODUK_STATUS.SELESAI) {
    throw new Error('Checklist Produk belum Siap Pelaksanaan. Selesaikan persiapan Checklist Audit terlebih dahulu.');
  }
  if ((item.jumlah_sampel ?? 0) < 0) throw new Error('Jumlah sampel aktual tidak boleh negatif');
  if (item.judgment && !JUDGMENT_PRODUK_LIST.includes(item.judgment)) throw new Error('Judgment produk harus OK atau NG');
  if ((item.judgment && !item.hasil_pemeriksaan?.trim()) || (!item.judgment && item.hasil_pemeriksaan?.trim())) {
    throw new Error('Hasil Pemeriksaan dan Judgment wajib diisi bersama');
  }
  const findingKategori = item.judgment === JUDGMENT_PRODUK.NG ? item.finding_kategori : null;
  if (item.judgment === JUDGMENT_PRODUK.NG && (!findingKategori || !Object.values(KATEGORI_TEMUAN).includes(findingKategori))) {
    throw new Error('Kategori Temuan A, B, atau C wajib dipilih untuk judgment NG');
  }
  const { data, error } = await supabase.from('checklist_produk_items').update({
    jumlah_sampel: item.jumlah_sampel,
    hasil_pemeriksaan: item.hasil_pemeriksaan?.trim() || null,
    judgment: item.judgment,
    finding_kategori: findingKategori,
  }).eq('id', item.id).select().single();
  if (error) throw new Error(`Gagal menyimpan pelaksanaan Produk: ${error.message}`);
  return mapItem(data as Record<string, unknown>);
}

export async function deleteProductItem(id: string): Promise<void> {
  const faseId = await getPhaseIdForItem(id);
  await assertProductChecklistDraft(await getChecklistIdForPhase(faseId));
  const { error } = await supabase.from('checklist_produk_items').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus item produk: ${error.message}`);
}

function sanitizeFileName(name: string): string {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export async function uploadProductEvidence(checklistId: string, faseId: string, file: File): Promise<ChecklistProdukFase> {
  await assertProductChecklistDraft(checklistId);
  const phaseChecklistId = await getChecklistIdForPhase(faseId);
  if (phaseChecklistId !== checklistId) throw new Error('Fase tidak terkait dengan Checklist Audit Produk ini');
  const path = `product-checklists/${checklistId}/${faseId}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type || undefined });
  if (uploadError) throw new Error(`Gagal mengunggah dokumen bukti: ${uploadError.message}`);
  const phases = await getProductPhases(checklistId);
  const phase = phases.find((candidate) => candidate.id === faseId);
  if (!phase) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error('Fase dokumen bukti tidak ditemukan');
  }
  const evidence: ProductChecklistEvidence = {
    name: file.name, path, mime_type: file.type, size: file.size, uploaded_at: new Date().toISOString(),
  };
  try {
    return await saveProductPhase({ ...phase, dokumen_bukti: [...phase.dokumen_bukti, evidence] });
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw error;
  }
}

export async function deleteProductEvidence(phase: ChecklistProdukFase, evidence: ProductChecklistEvidence): Promise<ChecklistProdukFase> {
  await assertProductChecklistDraft(await getChecklistIdForPhase(phase.id));
  const updated = await saveProductPhase({ ...phase, dokumen_bukti: phase.dokumen_bukti.filter((file) => file.path !== evidence.path) });
  const { error } = await supabase.storage.from(BUCKET).remove([evidence.path]);
  if (error) throw new Error(`Metadata bukti terhapus, tetapi file Storage gagal dibersihkan: ${error.message}`);
  return updated;
}

export async function getProductEvidenceSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
  if (error) throw new Error(`Gagal membuka dokumen bukti: ${error.message}`);
  return data.signedUrl;
}
