// Konstanta/enum terpusat untuk seluruh modul Pelaksanaan Internal Audit.
// Jangan gunakan magic string di tempat lain — import dari sini.

export const AUDIT_PLAN_STATUS = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
} as const;
export type AuditPlanStatus = (typeof AUDIT_PLAN_STATUS)[keyof typeof AUDIT_PLAN_STATUS];

export const KELAMPOK_IPO = {
  INPUT: 'Input Proses',
  METHOD: 'Method Proses',
  OUTPUT: 'Output Proses',
} as const;
export type KelompokIPO = (typeof KELAMPOK_IPO)[keyof typeof KELAMPOK_IPO];

export const KELAMPOK_IPO_LIST: KelompokIPO[] = [
  KELAMPOK_IPO.INPUT,
  KELAMPOK_IPO.METHOD,
  KELAMPOK_IPO.OUTPUT,
];

export const METODE_VERIFIKASI = {
  OBSERVISI: 'Observasi',
  WAWANCARA: 'Wawancara',
  DOKUMEN: 'Dokumen',
  SAMPLING: 'Sampling',
} as const;
export type MetodeVerifikasi = (typeof METODE_VERIFIKASI)[keyof typeof METODE_VERIFIKASI];

export const METODE_VERIFIKASI_LIST: MetodeVerifikasi[] = [
  METODE_VERIFIKASI.OBSERVISI,
  METODE_VERIFIKASI.WAWANCARA,
  METODE_VERIFIKASI.DOKUMEN,
  METODE_VERIFIKASI.SAMPLING,
];

// Kategori temuan — hanya A, B, C. "O" (Sesuai) tidak memicu temuan.
export const KATEGORI_TEMUAN = {
  A: 'A', // Major
  B: 'B', // Minor
  C: 'C', // Peluang Improvement / OFI
} as const;
export type KategoriTemuan = (typeof KATEGORI_TEMUAN)[keyof typeof KATEGORI_TEMUAN];

export const KATEGORI_TEMUAN_LABEL: Record<KategoriTemuan, string> = {
  A: 'A — Major',
  B: 'B — Minor',
  C: 'C — OFI',
};

// Status checklist item hasil
export const HASIL_CHECKLIST = {
  SESUAI: 'O', // Sesuai — tidak memicu temuan
  MAJOR: 'A',
  MINOR: 'B',
  OFI: 'C',
} as const;

export const CHECKLIST_BANK_STATUS = {
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
} as const;
export type ChecklistBankStatus = (typeof CHECKLIST_BANK_STATUS)[keyof typeof CHECKLIST_BANK_STATUS];

export const BULAN_LABEL: string[] = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

export const BULAN_FULL: string[] = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Jenis ronde audit program
export const JENIS_RONDE = {
  BERKALA: 'Berkala',
  KHUSUS: 'Khusus',
} as const;
export type JenisRonde = (typeof JENIS_RONDE)[keyof typeof JENIS_RONDE];

export const JENIS_RONDE_LIST: JenisRonde[] = [JENIS_RONDE.BERKALA, JENIS_RONDE.KHUSUS];

// Status program audit (sama dengan plan: Draft/Approved, tapi pisahkan untuk clarity)
export const PROGRAM_STATUS = {
  DRAFT: 'Draft',
  APPROVED: 'Approved',
} as const;
export type ProgramStatus = (typeof PROGRAM_STATUS)[keyof typeof PROGRAM_STATUS];

// Kode dokumen baku untuk Program Internal Audit
export const KODE_DOKUMEN_PROGRAM = 'Q-120-ISE-001-FORM-002-REV.1';

// Default 4 label periode
export const DEFAULT_PERIODE_LABEL: string[] = ['Periode 1', 'Periode 2', 'Periode 3', 'Periode 4'];

// ============================================================
// MASTER DATA: PROSES YANG DIAUDIT
// ============================================================

// Peran seksi dalam proses
export const PERAN_PROSES = {
  UTAMA: 'utama', // pemilik proses — simbol ◎
  TERKAIT: 'terkait', // seksi terkait — simbol O
} as const;
export type PeranProses = (typeof PERAN_PROSES)[keyof typeof PERAN_PROSES];

export const PERAN_PROSES_LIST: PeranProses[] = [PERAN_PROSES.UTAMA, PERAN_PROSES.TERKAIT];

// Simbol untuk peran seksi di matriks
export const SIMBOL_PERAN: Record<PeranProses, string> = {
  utama: '◎',
  terkait: 'O',
};

// Flag audit — ditampilkan sebagai superscript di matriks
// *1: termasuk audit proses, audit shift, dan audit produk
// *2: lingkup audit: konfirmasi PDCA terkait kontrol kebijakan
export const FLAG_AUDIT = {
  PROSES_SHIFT_PRODUK: '*1', // flag_audit_proses_shift_produk
  LINGKUP_PDCA: '*2', // flag_lingkup_pdca
} as const;

// ============================================================
// BATCH 3a: JADWAL AUDIT
// ============================================================

// Jenis audit teknis
export const JENIS_AUDIT = {
  INTERNAL: 'Internal',
  SURVEILLANCE_PREP: 'Surveillance-prep',
  FOLLOW_UP: 'Follow-up',
} as const;
export type JenisAudit = (typeof JENIS_AUDIT)[keyof typeof JENIS_AUDIT];

export const JENIS_AUDIT_LIST: JenisAudit[] = [
  JENIS_AUDIT.INTERNAL,
  JENIS_AUDIT.SURVEILLANCE_PREP,
  JENIS_AUDIT.FOLLOW_UP,
];

// Status jadwal audit
export const AUDIT_SCHEDULE_STATUS = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
} as const;
export type AuditScheduleStatus = (typeof AUDIT_SCHEDULE_STATUS)[keyof typeof AUDIT_SCHEDULE_STATUS];

export const AUDIT_SCHEDULE_STATUS_LIST: AuditScheduleStatus[] = [
  AUDIT_SCHEDULE_STATUS.DRAFT,
  AUDIT_SCHEDULE_STATUS.SCHEDULED,
  AUDIT_SCHEDULE_STATUS.IN_PROGRESS,
  AUDIT_SCHEDULE_STATUS.COMPLETED,
  AUDIT_SCHEDULE_STATUS.CLOSED,
];

// Standar acuan audit (checkbox multi)
export const STANDAR_AUDIT = {
  ISO_9001: 'ISO 9001',
  IATF_16949: 'IATF 16949',
} as const;
export type StandarAudit = (typeof STANDAR_AUDIT)[keyof typeof STANDAR_AUDIT];

export const STANDAR_AUDIT_LIST: StandarAudit[] = [
  STANDAR_AUDIT.ISO_9001,
  STANDAR_AUDIT.IATF_16949,
];
