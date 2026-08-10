// Generator kode terpusat untuk seluruh modul Pelaksanaan Internal Audit.
// Semua logic increment di satu tempat — jangan duplikasi di tempat lain.
// Format kodeAudit: "QA-01", "QA-02", dst. (zero-padded 2 digit, auto-incremental)

import { supabase } from './supabaseClient';

/**
 * Generate kodeAudit berikutnya (format "QA-01", "QA-02", dst).
 * Membaca nomor audit terbesar yang sudah ada dari tabel instruksi_audit
 * (Batch 4) dan menambah 1. Untuk Batch 1-3, tabel instruksi_audit belum ada,
 * jadi fallback ke sequence sederhana berdasarkan count di audit_plans.
 */
export async function generateKodeAudit(): Promise<string> {
  // Cek apakah tabel instruksi_audit ada (Batch 4+). Jika belum, gunakan fallback.
  try {
    const { data, error } = await supabase
      .from('instruksi_audit')
      .select('kode_audit')
      .order('kode_audit', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data?.kode_audit) {
      const nextNum = parseKodeAuditNumber(data.kode_audit) + 1;
      return formatKodeAudit(nextNum);
    }
  } catch {
    // Tabel belum ada — fallback ke count audit_plans
  }

  // Fallback: gunakan count dari audit_plans sebagai basis (sementara)
  const { count } = await supabase
    .from('audit_plans')
    .select('*', { count: 'exact', head: true });

  return formatKodeAudit((count ?? 0) + 1);
}

// Format nomor menjadi kode audit: 1 → "QA-01"
export function formatKodeAudit(num: number): string {
  return `QA-${String(num).padStart(2, '0')}`;
}

// Parse kode audit ke nomor: "QA-01" → 1
export function parseKodeAuditNumber(kode: string): number {
  const match = kode.match(/QA-(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Generator kode generik untuk prefix-NN pattern.
 * Digunakan untuk kodeCAR, kodeTemuan, dst. di batch berikutnya.
 * @param table - nama tabel yang memiliki kolom kode
 * @param column - nama kolom kode
 * @param prefix - prefix kode (mis. "CAR", "TMN")
 */
export async function generateKode(
  table: string,
  column: string,
  prefix: string,
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .order(column, { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data && data[column as keyof typeof data]) {
      const current = parseKodeNumber(data[column as keyof typeof data] as string, prefix);
      return formatKode(prefix, current + 1);
    }
  } catch {
    // Tabel belum ada atau kosong
  }

  return formatKode(prefix, 1);
}

export function formatKode(prefix: string, num: number): string {
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

export function parseKodeNumber(kode: string, prefix: string): number {
  const regex = new RegExp(`${prefix}-(\\d+)`, 'i');
  const match = kode.match(regex);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Generate kodeAudit untuk jadwal audit (format "IA-{tahun}-{NNN}").
 * Membaca kode terbesar untuk tahun bersangkutan dari audit_schedules lalu +1.
 * Reusable — jangan duplikasi logic increment di tempat lain.
 */
export async function generateKodeAuditSchedule(tahun: number): Promise<string> {
  const prefix = `IA-${tahun}`;
  const { data, error } = await supabase
    .from('audit_schedules')
    .select('kode_audit')
    .ilike('kode_audit', `${prefix}-%`)
    .order('kode_audit', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Gagal generate kode audit: ${error.message}`);

  if (!data?.kode_audit) return `${prefix}-001`;

  const match = (data.kode_audit as string).match(/IA-\d{4}-(\d+)/);
  const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
  return `${prefix}-${String(nextNum).padStart(3, '0')}`;
}
