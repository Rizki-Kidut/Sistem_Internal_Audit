// Utility functions untuk format tanggal Indonesia dan helper umum.

const NAMA_BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

// Format tanggal ke format Indonesia DD-MMM-YYYY (mis. "05-Mar-2024").
export function formatTanggal(date: string | Date | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = NAMA_BULAN[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

// Parse input HTML date (YYYY-MM-DD) ke Date object.
export function parseDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

// Format Date ke input HTML date value (YYYY-MM-DD).
export function toDateInput(date: string | Date | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function generateId(): string {
  return crypto.randomUUID();
}

// Validasi field wajib diisi — throw Error dengan pesan jika ada yang kosong.
export function validateRequired(fields: Record<string, unknown>, names: Record<string, string>): void {
  for (const key of Object.keys(fields)) {
    const value = fields[key];
    const isEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0);
    if (isEmpty) {
      throw new Error(`${names[key]} wajib diisi`);
    }
  }
}

// Safe optional chaining helper untuk akses nested property.
export function safe<T>(value: T | null | undefined, fallback: T): T {
  return value ?? fallback;
}
