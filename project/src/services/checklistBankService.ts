// Data access layer untuk Bank Checklist (master data terpisah dari sesi audit).
// Soft-delete via status='Nonaktif' — jangan hard-delete supaya histori checklist
// yang sudah pakai pertanyaan ini tetap valid.

import { supabase } from '../lib/supabaseClient';
import type { ChecklistBankItem, SubPertanyaan } from '../lib/types';
import { validateRequired } from '../lib/utils';
import { KELAMPOK_IPO, METODE_VERIFIKASI, CHECKLIST_BANK_STATUS } from '../lib/enums';
import type { KelompokIPO, MetodeVerifikasi, ChecklistBankStatus } from '../lib/enums';

// Row dari Supabase (snake_case) → ChecklistBankItem (camelCase interface)
function mapRow(row: Record<string, unknown>): ChecklistBankItem {
  return {
    id: row.id as string,
    proses: row.proses as string,
    sub_proses: row.sub_proses as string,
    pic_sub_proses: (row.pic_sub_proses as string) ?? null,
    kelompok_ipo: row.kelompok_ipo as KelompokIPO,
    nomor: row.nomor as string,
    klausul: (row.klausul as string) ?? null,
    pertanyaan_utama: row.pertanyaan_utama as string,
    sub_pertanyaan: (row.sub_pertanyaan as SubPertanyaan[]) ?? [],
    metode_verifikasi_default: row.metode_verifikasi_default as MetodeVerifikasi,
    status: row.status as ChecklistBankStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getChecklistBankItems(): Promise<ChecklistBankItem[]> {
  const { data, error } = await supabase
    .from('checklist_bank_items')
    .select('*')
    .order('proses', { ascending: true })
    .order('sub_proses', { ascending: true })
    .order('kelompok_ipo', { ascending: true })
    .order('nomor', { ascending: true });

  if (error) throw new Error(`Gagal memuat checklist bank: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapRow(r));
}

export async function saveChecklistBankItem(
  item: Partial<ChecklistBankItem>,
): Promise<ChecklistBankItem> {
  // Validasi wajib di level fungsi save (bukan cuma UI)
  validateRequired(
    {
      proses: item.proses,
      sub_proses: item.sub_proses,
      kelompok_ipo: item.kelompok_ipo,
      nomor: item.nomor,
      pertanyaan_utama: item.pertanyaan_utama,
    },
    {
      proses: 'Proses',
      sub_proses: 'Sub-Proses',
      kelompok_ipo: 'Kelompok IPO',
      nomor: 'Nomor',
      pertanyaan_utama: 'Pertanyaan Utama',
    },
  );

  // Validasi nilai enum
  if (item.kelompok_ipo && !KELAMPOK_IPO_LIST.includes(item.kelompok_ipo)) {
    throw new Error('Kelompok IPO tidak valid');
  }
  if (
    item.metode_verifikasi_default &&
    !METODE_VERIFIKASI_LIST.includes(item.metode_verifikasi_default)
  ) {
    throw new Error('Metode verifikasi tidak valid');
  }

  const payload = {
    proses: item.proses,
    sub_proses: item.sub_proses,
    pic_sub_proses: item.pic_sub_proses ?? null,
    kelompok_ipo: item.kelompok_ipo,
    nomor: item.nomor,
    klausul: item.klausul ?? null,
    pertanyaan_utama: item.pertanyaan_utama,
    sub_pertanyaan: item.sub_pertanyaan ?? [],
    metode_verifikasi_default: item.metode_verifikasi_default ?? METODE_VERIFIKASI.OBSERVISI,
    status: item.status ?? CHECKLIST_BANK_STATUS.AKTIF,
  };

  if (item.id) {
    const { data, error } = await supabase
      .from('checklist_bank_items')
      .update(payload)
      .eq('id', item.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate checklist: ${error.message}`);
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('checklist_bank_items')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah checklist: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

// Soft-delete: ubah status jadi Nonaktif
export async function softDeleteChecklistBankItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('checklist_bank_items')
    .update({ status: CHECKLIST_BANK_STATUS.NONAKTIF })
    .eq('id', id);
  if (error) throw new Error(`Gagal menonaktifkan checklist: ${error.message}`);
}

export async function reactivateChecklistBankItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('checklist_bank_items')
    .update({ status: CHECKLIST_BANK_STATUS.AKTIF })
    .eq('id', id);
  if (error) throw new Error(`Gagal mengaktifkan kembali checklist: ${error.message}`);
}

// Ambil daftar proses unik (untuk accordion level 1)
export function getUniqueProses(items: ChecklistBankItem[]): string[] {
  return [...new Set(items.map((i) => i.proses))].sort();
}

// Ambil daftar sub-proses unik per proses (untuk accordion level 2)
export function getUniqueSubProses(items: ChecklistBankItem[], proses: string): string[] {
  return [...new Set(items.filter((i) => i.proses === proses).map((i) => i.sub_proses))].sort();
}

// Ambil PIC baku per sub-proses (dari item pertama yang cocok)
export function getPicSubProses(
  items: ChecklistBankItem[],
  proses: string,
  subProses: string,
): string | null {
  return items.find((i) => i.proses === proses && i.sub_proses === subProses)?.pic_sub_proses ?? null;
}

// Import dari KELAMPOK_IPO_LIST dan METODE_VERIFIKASI_LIST (re-export untuk komponen)
import { KELAMPOK_IPO_LIST, METODE_VERIFIKASI_LIST } from '../lib/enums';
export { KELAMPOK_IPO_LIST, METODE_VERIFIKASI_LIST };
