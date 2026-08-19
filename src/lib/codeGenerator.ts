// Generator kode terpusat untuk seluruh modul Pelaksanaan Internal Audit.
// Semua logic increment di satu tempat — jangan duplikasi di tempat lain.
// Format kodeAudit: "QA-01", "QA-02", dst. (zero-padded 2 digit, auto-incremental)

import { supabase } from './supabaseClient';

/** Allocate the next globally unique central QA code through the database sequence. */
export async function generateKodeAudit(): Promise<string> {
  const { data, error } = await supabase.rpc('next_qa_audit_code');
  if (error || typeof data !== 'string') {
    throw new Error(`Gagal generate kode audit: ${error?.message ?? 'respons tidak valid'}`);
  }
  return data;
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
