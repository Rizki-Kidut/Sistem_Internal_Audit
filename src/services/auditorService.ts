// Data access layer untuk Master Auditor (modul Training).
// Komponen UI TIDAK BOLEH langsung memanggil supabase — lewat sini.

import { supabase } from '../lib/supabaseClient';
import type { Auditor } from '../lib/types';
import { AUDITOR_STATUS } from '../lib/enums';
import type { AuditorStatus } from '../lib/enums';
import { validateRequired } from '../lib/utils';

function mapAuditor(row: Record<string, unknown>): Auditor {
  return {
    id: row.id as string,
    nama: row.nama as string,
    nip: (row.nip as string) ?? null,
    departemen: (row.departemen as string) ?? null,
    jabatan: (row.jabatan as string) ?? null,
    kualifikasi: (row.kualifikasi as string[]) ?? [],
    tanggal_sertifikasi: (row.tanggal_sertifikasi as string) ?? null,
    tanggal_berlaku: (row.tanggal_berlaku as string) ?? null,
    status: (row.status as AuditorStatus) ?? AUDITOR_STATUS.AKTIF,
    catatan: (row.catatan as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getAuditors(): Promise<Auditor[]> {
  const { data, error } = await supabase
    .from('auditors')
    .select('*')
    .order('nama', { ascending: true });

  if (error) throw new Error(`Gagal memuat auditor: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapAuditor(r));
}

export async function getActiveAuditors(): Promise<Auditor[]> {
  const { data, error } = await supabase
    .from('auditors')
    .select('*')
    .eq('status', AUDITOR_STATUS.AKTIF)
    .order('nama', { ascending: true });

  if (error) throw new Error(`Gagal memuat auditor aktif: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapAuditor(r));
}

export async function getAuditorById(id: string): Promise<Auditor | null> {
  const { data, error } = await supabase
    .from('auditors')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat auditor: ${error.message}`);
  return data ? mapAuditor(data as Record<string, unknown>) : null;
}

export async function saveAuditor(auditor: Partial<Auditor>): Promise<Auditor> {
  validateRequired(
    { nama: auditor.nama },
    { nama: 'Nama Auditor' },
  );

  const payload = {
    nama: auditor.nama,
    nip: auditor.nip ?? null,
    departemen: auditor.departemen ?? null,
    jabatan: auditor.jabatan ?? null,
    kualifikasi: auditor.kualifikasi ?? [],
    tanggal_sertifikasi: auditor.tanggal_sertifikasi ?? null,
    tanggal_berlaku: auditor.tanggal_berlaku ?? null,
    status: auditor.status ?? AUDITOR_STATUS.AKTIF,
    catatan: auditor.catatan ?? null,
  };

  if (auditor.id) {
    const { data, error } = await supabase
      .from('auditors')
      .update(payload)
      .eq('id', auditor.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate auditor: ${error.message}`);
    return mapAuditor(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('auditors')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah auditor: ${error.message}`);
  return mapAuditor(data as Record<string, unknown>);
}

export async function deleteAuditor(id: string): Promise<void> {
  const { error } = await supabase.from('auditors').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus auditor: ${error.message}`);
}

// ============================================================
// VALIDATION HELPERS
// ============================================================

// Cek apakah auditor kompeten berdasarkan tanggal_berlaku vs tanggal audit.
// Return: { status, isExpired, isEligible }
export function checkKompetensi(
  auditor: Auditor,
  auditDate: string | null,
): {
  status: 'Memenuhi Syarat' | 'Tidak Memenuhi Syarat' | 'Belum Ada Sertifikasi';
  isExpired: boolean;
  isEligible: boolean;
} {
  if (!auditor.tanggal_berlaku) {
    return {
      status: 'Belum Ada Sertifikasi',
      isExpired: false,
      isEligible: false,
    };
  }

  const berlaku = new Date(auditor.tanggal_berlaku + 'T00:00:00');
  const refDate = auditDate ? new Date(auditorDate(auditDate) + 'T00:00:00') : new Date();

  if (isNaN(berlaku.getTime())) {
    return {
      status: 'Belum Ada Sertifikasi',
      isExpired: false,
      isEligible: false,
    };
  }

  const isExpired = berlaku < refDate;
  return {
    status: isExpired ? 'Tidak Memenuhi Syarat' : 'Memenuhi Syarat',
    isExpired,
    isEligible: !isExpired,
  };
}

// Cek apakah auditor dari departemen yang sama dengan seksi yang diaudit.
// Parameter: auditor.departemen vs array scope.seksi_terkait → resolve ke seksi.departemen.
// Di sini kita bandingkan string departemen auditor vs nama seksi (sebagai proxy).
export function checkIndependensi(
  auditor: Auditor,
  auditedSeksiNames: string[],
): { hasConflict: boolean; conflictingSeksi: string | null } {
  if (!auditor.departemen) return { hasConflict: false, conflictingSeksi: null };

  const deptLower = auditor.departemen.toLowerCase();
  for (const nama of auditedSeksiNames) {
    if (nama && nama.toLowerCase().includes(deptLower)) {
      return { hasConflict: true, conflictingSeksi: nama };
    }
  }
  return { hasConflict: false, conflictingSeksi: null };
}

function auditorDate(dateStr: string): string {
  // Accept both ISO timestamp and YYYY-MM-DD
  if (dateStr.length === 10) return dateStr;
  return dateStr.slice(0, 10);
}
