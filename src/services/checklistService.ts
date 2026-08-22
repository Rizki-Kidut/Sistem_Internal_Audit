// Data access layer untuk Checklist Pelaksanaan Audit (per baris Reguler).
// Saat checklist baru dibuat, auto-copy checklist_bank_items Aktif yang match
// proses pada baris instruksi, dikelompokkan per Sub-Proses → IPO.

import { supabase } from '../lib/supabaseClient';
import { getAuditTeamMasterById } from './auditTeamMasterService';
import type {
  Checklist, ChecklistItem, ChecklistSubPertanyaan,
  AuditInstructionRow, Seksi, Auditor,
  ChecklistBankItem,
} from '../lib/types';
import type { KelompokIPO, MetodeVerifikasi, HasilChecklist } from '../lib/enums';
import { KODE_DOKUMEN_CHECKLIST, KELAMPOK_IPO, KELAMPOK_IPO_LIST, HASIL_CHECKLIST_LIST } from '../lib/enums';
import { toDateInput, validateRequired } from '../lib/utils';

// ============================================================
// MAPPERS
// ============================================================

function mapChecklist(row: Record<string, unknown>): Checklist {
  return {
    id: row.id as string,
    row_id: row.row_id as string,
    kode_audit: row.kode_audit as string,
    judul_checklist: row.judul_checklist as string,
    seksi_auditee: (row.seksi_auditee as string[]) ?? [],
    section_manager: (row.section_manager as string) ?? null,
    tanggal_dibuat: row.tanggal_dibuat as string,
    dibuat_oleh: (row.dibuat_oleh as string) ?? null,
    penanggung_jawab_qms: (row.penanggung_jawab_qms as string) ?? null,
    kode_dokumen: (row.kode_dokumen as string) ?? KODE_DOKUMEN_CHECKLIST,
    pic_proses: (row.pic_proses as string) ?? null,
    item_monitoring_jelas: (row.item_monitoring_jelas as string) ?? null,
    kondisi_pencapaian_target: (row.kondisi_pencapaian_target as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapChecklistItem(row: Record<string, unknown>): ChecklistItem {
  return {
    id: row.id as string,
    checklist_id: row.checklist_id as string,
    bank_item_id: (row.bank_item_id as string) ?? null,
    sub_proses: row.sub_proses as string,
    kelompok_ipo: row.kelompok_ipo as KelompokIPO,
    nomor: row.nomor as string,
    klausul: (row.klausul as string) ?? null,
    pertanyaan_utama: row.pertanyaan_utama as string,
    sub_pertanyaan: (row.sub_pertanyaan as ChecklistSubPertanyaan[]) ?? [],
    metode_verifikasi: (row.metode_verifikasi as MetodeVerifikasi) ?? null,
    hasil: (row.hasil as string) ?? null,
    komentar_auditor: (row.komentar_auditor as string) ?? null,
    finding_id: (row.finding_id as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ============================================================
// CHECKLIST CRUD
// ============================================================

export async function getChecklistsByRow(rowId: string): Promise<Checklist[]> {
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('row_id', rowId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`Gagal memuat checklist: ${error.message}`);
  return (data ?? []).map((r) => mapChecklist(r as Record<string, unknown>));
}

export async function getChecklistById(id: string): Promise<Checklist | null> {
  const { data, error } = await supabase
    .from('checklists')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat checklist: ${error.message}`);
  return data ? mapChecklist(data as Record<string, unknown>) : null;
}

export async function saveChecklist(cl: Partial<Checklist>): Promise<Checklist> {
  validateRequired(
    { row_id: cl.row_id, kode_audit: cl.kode_audit, judul_checklist: cl.judul_checklist },
    { row_id: 'Baris Instruksi', kode_audit: 'Kode Audit', judul_checklist: 'Judul Checklist' },
  );
  const payload = {
    row_id: cl.row_id,
    kode_audit: cl.kode_audit,
    judul_checklist: cl.judul_checklist,
    seksi_auditee: cl.seksi_auditee ?? [],
    section_manager: cl.section_manager ?? null,
    tanggal_dibuat: cl.tanggal_dibuat ?? toDateInput(new Date()),
    dibuat_oleh: cl.dibuat_oleh ?? null,
    penanggung_jawab_qms: cl.penanggung_jawab_qms ?? null,
    kode_dokumen: cl.kode_dokumen ?? KODE_DOKUMEN_CHECKLIST,
    pic_proses: cl.pic_proses ?? null,
    item_monitoring_jelas: cl.item_monitoring_jelas ?? null,
    kondisi_pencapaian_target: cl.kondisi_pencapaian_target ?? null,
  };
  if (cl.id) {
    const { data, error } = await supabase
      .from('checklists').update(payload).eq('id', cl.id).select().single();
    if (error) throw new Error(`Gagal mengupdate checklist: ${error.message}`);
    return mapChecklist(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from('checklists').insert(payload).select().single();
  if (error) throw new Error(`Gagal membuat checklist: ${error.message}`);
  return mapChecklist(data as Record<string, unknown>);
}

export async function deleteChecklist(id: string): Promise<void> {
  const { error } = await supabase.from('checklists').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus checklist: ${error.message}`);
}

// ============================================================
// CHECKLIST ITEMS CRUD
// ============================================================

export async function getItemsByChecklist(checklistId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('checklist_id', checklistId)
    .order('sub_proses', { ascending: true })
    .order('kelompok_ipo', { ascending: true })
    .order('nomor', { ascending: true });
  if (error) throw new Error(`Gagal memuat item checklist: ${error.message}`);
  return (data ?? []).map((r) => mapChecklistItem(r as Record<string, unknown>));
}

export interface ChecklistItemPreparationPayload {
  id?: string;
  checklist_id: string;
  bank_item_id?: string | null;
  sub_proses: string;
  kelompok_ipo: KelompokIPO;
  nomor: string;
  klausul?: string | null;
  pertanyaan_utama: string;
  sub_pertanyaan?: ChecklistSubPertanyaan[];
}

/** Saves preparation fields only. Historical execution and Finding fields are never overwritten. */
export async function saveChecklistItemPreparation(item: ChecklistItemPreparationPayload): Promise<ChecklistItem> {
  validateRequired(
    { checklist_id: item.checklist_id, sub_proses: item.sub_proses, kelompok_ipo: item.kelompok_ipo, nomor: item.nomor, pertanyaan_utama: item.pertanyaan_utama },
    { checklist_id: 'Checklist', sub_proses: 'Sub-Proses', kelompok_ipo: 'Elemen Proses', nomor: 'Nomor', pertanyaan_utama: 'Pertanyaan Utama' },
  );
  if (!KELAMPOK_IPO_LIST.includes(item.kelompok_ipo)) throw new Error('Elemen Proses tidak valid');
  const payload = {
    checklist_id: item.checklist_id,
    bank_item_id: item.bank_item_id ?? null,
    sub_proses: item.sub_proses.trim(),
    kelompok_ipo: item.kelompok_ipo,
    nomor: item.nomor.trim(),
    klausul: item.klausul?.trim() || null,
    pertanyaan_utama: item.pertanyaan_utama.trim(),
    sub_pertanyaan: (item.sub_pertanyaan ?? []).filter(sp => sp.teks.trim()).map(sp => ({ teks: sp.teks.trim(), sesuai: sp.sesuai ?? null })),
  };
  if (item.id) {
    const { data, error } = await supabase.from('checklist_items').update(payload).eq('id', item.id).select().single();
    if (error) throw new Error(`Gagal mengupdate pertanyaan: ${error.message}`);
    return mapChecklistItem(data as Record<string, unknown>);
  }
  const { data, error } = await supabase.from('checklist_items').insert({ ...payload, metode_verifikasi: null, hasil: null, komentar_auditor: null }).select().single();
  if (error) throw new Error(`Gagal menambah pertanyaan: ${error.message}`);
  return mapChecklistItem(data as Record<string, unknown>);
}

/** Saves execution fields only; source preparation and finding_id remain database-authoritative. */
export async function saveSystemQuestionExecution(id: string, hasil: HasilChecklist | null, komentarAuditor: string | null): Promise<ChecklistItem> {
  if (hasil && !HASIL_CHECKLIST_LIST.includes(hasil)) throw new Error('Judgement tidak valid');
  if ((hasil && !komentarAuditor?.trim()) || (!hasil && komentarAuditor?.trim())) {
    throw new Error('Hasil Observasi dan Judgement wajib diisi bersama untuk setiap pertanyaan.');
  }
  const { data, error } = await supabase.from('checklist_items').update({ hasil, komentar_auditor: komentarAuditor?.trim() || null }).eq('id', id).select().single();
  if (error) throw new Error(`Gagal menyimpan hasil pelaksanaan: ${error.message}`);
  return mapChecklistItem(data as Record<string, unknown>);
}

// Compatibility alias for callers outside the active preparation editor.
export const saveItem = saveChecklistItemPreparation;

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('checklist_items').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus item: ${error.message}`);
}

// ============================================================
// AUTO-COPY FROM BANK
// Saat checklist baru dibuat, baca prosesId dari auditInstructionRow,
// auto-copy checklistBankItems Aktif yang match, dikelompokkan per
// Sub-Proses → IPO.
// ============================================================

export async function createChecklistFromRow(
  row: AuditInstructionRow,
  seksiList: Seksi[],
  auditorList: Auditor[],
  bankItems: ChecklistBankItem[],
): Promise<Checklist> {
  if (!row.team_master_id) throw new Error('Pilih dan kunci Tim Audit pada Instruksi Internal Audit sebelum membuat checklist.');
  // 1. Auto-derive fields from the row
  const targetSeksiIds = row.seksi_marks
    .filter((m) => m.tipe === 'target')
    .map((m) => m.seksi_id);
  const seksiAuditee = targetSeksiIds
    .map((id) => seksiList.find((s) => s.id === id)?.nama ?? '')
    .filter(Boolean);

  const sectionManager = row.pemilik_proses ?? null;

  const team = row.team_master_id ? await getAuditTeamMasterById(row.team_master_id) : null;
  const leadAuditor = team?.members.find((member) => member.peran === 'Lead');
  const dibuatOleh = leadAuditor
    ? leadAuditor.auditor?.nama ?? auditorList.find((a) => a.id === leadAuditor.auditor_id)?.nama ?? null
    : null;

  // 2. Create the checklist header
  const checklist = await saveChecklist({
    row_id: row.id,
    kode_audit: row.kode_audit,
    judul_checklist: `Checklist ${row.kode_audit}`,
    seksi_auditee: seksiAuditee,
    section_manager: sectionManager,
    dibuat_oleh: dibuatOleh,
    tanggal_dibuat: toDateInput(new Date()),
  });

  // 3. Auto-copy matching bank items
  let prosesName: string | null = null;
  if (row.proses_id) {
    const { data: prosesRow } = await supabase
      .from('proses')
      .select('nama_proses')
      .eq('id', row.proses_id)
      .maybeSingle();
    prosesName = (prosesRow as { nama_proses: string } | null)?.nama_proses ?? null;
  }

  const matchingBankItems = prosesName
    ? bankItems.filter((b) => b.proses === prosesName && b.status === 'Aktif')
    : [];

  // 4. Insert items grouped by Sub-Proses → IPO
  if (matchingBankItems.length > 0) {
    const itemPayloads = matchingBankItems.map((b) => ({
      checklist_id: checklist.id,
      bank_item_id: b.id,
      sub_proses: b.sub_proses,
      kelompok_ipo: b.kelompok_ipo,
      nomor: b.nomor,
      klausul: b.klausul,
      pertanyaan_utama: b.pertanyaan_utama,
      sub_pertanyaan: b.sub_pertanyaan.map((sp) => ({ teks: sp.teks, sesuai: null })),
      metode_verifikasi: null,
      hasil: null,
      komentar_auditor: null,
    }));
    const { error: insertErr } = await supabase
      .from('checklist_items')
      .insert(itemPayloads);
    if (insertErr) throw new Error(`Gagal auto-copy item bank: ${insertErr.message}`);
  }

  return checklist;
}

// ============================================================
// HELPERS
// ============================================================

export function groupItemsBySubProses(items: ChecklistItem[]): {
  subProses: string;
  groups: { kelompok: KelompokIPO; items: ChecklistItem[] }[];
}[] {
  const subProsesMap = new Map<string, Map<string, ChecklistItem[]>>();
  for (const item of items) {
    if (!subProsesMap.has(item.sub_proses)) {
      subProsesMap.set(item.sub_proses, new Map());
    }
    const ipoMap = subProsesMap.get(item.sub_proses)!;
    if (!ipoMap.has(item.kelompok_ipo)) {
      ipoMap.set(item.kelompok_ipo, []);
    }
    ipoMap.get(item.kelompok_ipo)!.push(item);
  }

  const ipoOrder: Record<string, number> = {
    [KELAMPOK_IPO.INPUT]: 0,
    [KELAMPOK_IPO.METHOD]: 1,
    [KELAMPOK_IPO.OUTPUT]: 2,
    [KELAMPOK_IPO.RESOURCE]: 3,
    [KELAMPOK_IPO.RISK_ANALYSIS]: 4,
  };

  return Array.from(subProsesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([subProses, ipoMap]) => ({
      subProses,
      groups: Array.from(ipoMap.entries())
        .sort(([a], [b]) => (ipoOrder[a] ?? 99) - (ipoOrder[b] ?? 99))
        .map(([kelompok, groupItems]) => ({
          kelompok: kelompok as KelompokIPO,
          items: groupItems,
        })),
    }));
}
