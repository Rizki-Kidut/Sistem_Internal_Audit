// Utility functions untuk format tanggal Indonesia dan helper umum.

const NAMA_BULAN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const NAMA_BULAN_LENGKAP = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
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

// Format rentang tanggal ringkas untuk dokumen/ekspor berbahasa Indonesia.
export function formatRentangTanggal(
  tanggalAwal: string | null,
  tanggalAkhir: string | null,
): string {
  const awal = tanggalAwal ? parseDate(tanggalAwal) : null;
  const akhir = tanggalAkhir ? parseDate(tanggalAkhir) : null;
  const formatLengkap = (date: Date) =>
    `${date.getDate()} ${NAMA_BULAN_LENGKAP[date.getMonth()]} ${date.getFullYear()}`;

  if (!awal && !akhir) return '-';
  if (!awal) return formatLengkap(akhir!);
  if (!akhir) return formatLengkap(awal);

  const tahunAwal = awal.getFullYear();
  const tahunAkhir = akhir.getFullYear();
  const bulanAwal = awal.getMonth();
  const bulanAkhir = akhir.getMonth();
  const hariAwal = awal.getDate();
  const hariAkhir = akhir.getDate();

  if (tahunAwal === tahunAkhir && bulanAwal === bulanAkhir && hariAwal === hariAkhir) {
    return formatLengkap(awal);
  }
  if (tahunAwal === tahunAkhir && bulanAwal === bulanAkhir) {
    return `${hariAwal}–${hariAkhir} ${NAMA_BULAN_LENGKAP[bulanAwal]} ${tahunAwal}`;
  }
  if (tahunAwal === tahunAkhir) {
    return `${hariAwal} ${NAMA_BULAN_LENGKAP[bulanAwal]}–${hariAkhir} ${NAMA_BULAN_LENGKAP[bulanAkhir]} ${tahunAwal}`;
  }
  return `${formatLengkap(awal)}–${formatLengkap(akhir)}`;
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
