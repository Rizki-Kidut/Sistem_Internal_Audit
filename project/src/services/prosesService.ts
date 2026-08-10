// Data access layer untuk Master Data Proses yang Diaudit.
// Mencakup CRUD proses + assignment seksi (peran utama/terkait).
// Save assignment bersifat atomic: hapus semua relasi lama lalu insert yang baru.

import { supabase } from '../lib/supabaseClient';
import type { Proses, ProsesSeksi, Seksi } from '../lib/types';
import { PERAN_PROSES } from '../lib/enums';
import type { PeranProses } from '../lib/enums';
import { validateRequired } from '../lib/utils';

function mapProses(row: Record<string, unknown>): Proses {
  return {
    id: row.id as string,
    nama_proses: row.nama_proses as string,
    kode_proses: row.kode_proses as string,
    diaudit_tahun_ini: row.diaudit_tahun_ini as boolean,
    tanggal_audit: (row.tanggal_audit as string) ?? null,
    flag_audit_proses_shift_produk: row.flag_audit_proses_shift_produk as boolean,
    flag_lingkup_pdca: row.flag_lingkup_pdca as boolean,
    keterangan: (row.keterangan as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapProsesSeksi(row: Record<string, unknown>): ProsesSeksi {
  return {
    id: row.id as string,
    proses_id: row.proses_id as string,
    seksi_id: row.seksi_id as string,
    peran: row.peran as PeranProses,
    created_at: row.created_at as string,
  };
}

// ============================================================
// PROSES (CRUD)
// ============================================================

export async function getAllProses(): Promise<Proses[]> {
  const { data, error } = await supabase
    .from('proses')
    .select('*')
    .order('kode_proses', { ascending: true });

  if (error) throw new Error(`Gagal memuat proses: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapProses(r));
}

export async function getActiveProses(): Promise<Proses[]> {
  const { data, error } = await supabase
    .from('proses')
    .select('*')
    .eq('diaudit_tahun_ini', true)
    .order('kode_proses', { ascending: true });

  if (error) throw new Error(`Gagal memuat proses aktif: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapProses(r));
}

export async function getProsesById(id: string): Promise<Proses | null> {
  const { data, error } = await supabase
    .from('proses')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat proses: ${error.message}`);
  return data ? mapProses(data as Record<string, unknown>) : null;
}

export async function saveProses(proses: Partial<Proses>): Promise<Proses> {
  // Validasi di level fungsi (bukan cuma UI)
  validateRequired(
    {
      nama_proses: proses.nama_proses,
      kode_proses: proses.kode_proses,
    },
    {
      nama_proses: 'Nama Proses',
      kode_proses: 'Kode Proses',
    },
  );

  const payload = {
    nama_proses: proses.nama_proses,
    kode_proses: proses.kode_proses,
    diaudit_tahun_ini: proses.diaudit_tahun_ini ?? true,
    tanggal_audit: proses.tanggal_audit ?? null,
    flag_audit_proses_shift_produk: proses.flag_audit_proses_shift_produk ?? false,
    flag_lingkup_pdca: proses.flag_lingkup_pdca ?? false,
    keterangan: proses.keterangan ?? null,
  };

  if (proses.id) {
    const { data, error } = await supabase
      .from('proses')
      .update(payload)
      .eq('id', proses.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate proses: ${error.message}`);
    return mapProses(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('proses')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah proses: ${error.message}`);
  return mapProses(data as Record<string, unknown>);
}

export async function deleteProses(id: string): Promise<void> {
  const { error } = await supabase.from('proses').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus proses: ${error.message}`);
}

// Toggle status diaudit tahun ini (active/inactive)
export async function toggleDiauditTahunIni(id: string, currentValue: boolean): Promise<void> {
  const { error } = await supabase
    .from('proses')
    .update({ diaudit_tahun_ini: !currentValue })
    .eq('id', id);
  if (error) throw new Error(`Gagal mengubah status: ${error.message}`);
}

// ============================================================
// PROSES_SEKSI (assignment)
// ============================================================

export async function getProsesSeksiByProses(prosesId: string): Promise<ProsesSeksi[]> {
  const { data, error } = await supabase
    .from('proses_seksi')
    .select('*')
    .eq('proses_id', prosesId);

  if (error) throw new Error(`Gagal memuat assignment seksi: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapProsesSeksi(r));
}

// Ambil semua assignment untuk multiple proses sekaligus (untuk matriks)
export async function getAllProsesSeksi(): Promise<ProsesSeksi[]> {
  const { data, error } = await supabase
    .from('proses_seksi')
    .select('*');

  if (error) throw new Error(`Gagal memuat assignment seksi: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapProsesSeksi(r));
}

// Simpan assignment seksi untuk proses secara atomic.
// Hapus semua relasi lama, lalu insert yang baru — supaya tidak ada data tidak konsisten.
export async function saveProsesSeksiAssignment(
  prosesId: string,
  assignments: Array<{ seksiId: string; peran: PeranProses }>,
): Promise<ProsesSeksi[]> {
  // 1. Hapus semua assignment lama
  const { error: delErr } = await supabase
    .from('proses_seksi')
    .delete()
    .eq('proses_id', prosesId);
  if (delErr) throw new Error(`Gagal menghapus assignment lama: ${delErr.message}`);

  // 2. Insert assignment baru
  if (assignments.length === 0) return [];

  const payload = assignments.map((a) => ({
    proses_id: prosesId,
    seksi_id: a.seksiId,
    peran: a.peran,
  }));

  const { data, error: insErr } = await supabase
    .from('proses_seksi')
    .insert(payload)
    .select('*');

  if (insErr) throw new Error(`Gagal menyimpan assignment: ${insErr.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapProsesSeksi(r));
}

// ============================================================
// HELPER: Cari peran seksi untuk proses tertentu (selector/computed)
// ============================================================

export function getPeranForSeksi(
  assignments: ProsesSeksi[],
  prosesId: string,
  seksiId: string,
): PeranProses | null {
  const found = assignments.find((a) => a.proses_id === prosesId && a.seksi_id === seksiId);
  return found ? found.peran : null;
}

// ============================================================
// HELPER: Generate kode proses otomatis (PRC-001, PRC-002, ...)
// ============================================================

export async function generateKodeProses(): Promise<string> {
  const { data, error } = await supabase
    .from('proses')
    .select('kode_proses')
    .order('kode_proses', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Gagal generate kode proses: ${error.message}`);

  if (!data) return 'PRC-001';

  const lastKode = data.kode_proses as string;
  const match = lastKode.match(/PRC-(\d+)/);
  if (match) {
    const nextNum = parseInt(match[1]) + 1;
    return `PRC-${String(nextNum).padStart(3, '0')}`;
  }
  return 'PRC-001';
}

// ============================================================
// HELPER: Hitung simbol untuk matriks
// ============================================================

export function getSimbolForCell(
  assignments: ProsesSeksi[],
  prosesId: string,
  seksiId: string,
  proses: Proses | undefined,
): string {
  const peran = getPeranForSeksi(assignments, prosesId, seksiId);
  if (!peran) return '';

  const simbol = peran === PERAN_PROSES.UTAMA ? '◎' : 'O';
  let suffix = '';
  if (proses?.flag_audit_proses_shift_produk) suffix += '*1';
  if (proses?.flag_lingkup_pdca) suffix += '*2';

  return simbol + suffix;
}