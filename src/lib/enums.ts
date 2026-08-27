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
  RESOURCE: 'Resource',
  RISK_ANALYSIS: 'Analisa Risiko',
} as const;
export type KelompokIPO = (typeof KELAMPOK_IPO)[keyof typeof KELAMPOK_IPO];

export const KELAMPOK_IPO_LIST: KelompokIPO[] = [
  KELAMPOK_IPO.INPUT,
  KELAMPOK_IPO.METHOD,
  KELAMPOK_IPO.OUTPUT,
  KELAMPOK_IPO.RESOURCE,
  KELAMPOK_IPO.RISK_ANALYSIS,
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

export const FINDING_SOURCE_TYPE = {
  SISTEM: 'ChecklistSistem', PRODUK: 'ChecklistProduk', MANUFAKTUR_SHIFT: 'ChecklistManufakturShift',
} as const;
export type FindingSourceType = (typeof FINDING_SOURCE_TYPE)[keyof typeof FINDING_SOURCE_TYPE];
export const FINDING_STATUS = { OPEN:'Open', CAR_SUBMITTED:'CAR Submitted', VERIFIKASI:'Verifikasi', CLOSED:'Closed', OVERDUE:'Overdue' } as const;
export type FindingStatus = (typeof FINDING_STATUS)[keyof typeof FINDING_STATUS];
export const FINDING_REVIEW_STATUS = { DRAFT:'DRAFT', LEAD_REVIEW:'LEAD_REVIEW', REVISION_REQUIRED:'REVISION_REQUIRED', READY_FOR_RELEASE:'READY_FOR_RELEASE', PUBLISHED:'PUBLISHED', ANNULLED:'ANNULLED', LEGACY_ESTABLISHED:'LEGACY_ESTABLISHED' } as const;
export type FindingReviewStatus = (typeof FINDING_REVIEW_STATUS)[keyof typeof FINDING_REVIEW_STATUS];
export const LTP_STATUS = {
  AUDITEE_DRAFT:'AUDITEE_DRAFT', MANAGER_REVIEW:'MANAGER_REVIEW', AUDITEE_RETURNED:'AUDITEE_RETURNED',
  AUDITOR_REVIEW:'AUDITOR_REVIEW', AUDITOR_RETURNED:'AUDITOR_RETURNED', ADMIN_REVIEW:'ADMIN_REVIEW', CLOSED:'CLOSED',
} as const;
export type LtpStatus = (typeof LTP_STATUS)[keyof typeof LTP_STATUS];
export const LTP_STATUS_LABEL:Record<LtpStatus,string> = {
  AUDITEE_DRAFT:'Draft Auditee', MANAGER_REVIEW:'Menunggu Section Manager', AUDITEE_RETURNED:'Dikembalikan ke Auditee',
  AUDITOR_REVIEW:'Menunggu Verifikasi Auditor', AUDITOR_RETURNED:'Dikembalikan ke Auditor', ADMIN_REVIEW:'Menunggu Approval Admin/QMS', CLOSED:'Closed',
};
export const LTP_ACTION_TYPE = { TEMPORARY:'TEMPORARY', CORRECTIVE:'CORRECTIVE', PREVENTIVE:'PREVENTIVE' } as const;
export type LtpActionType = (typeof LTP_ACTION_TYPE)[keyof typeof LTP_ACTION_TYPE];
export const LTP_ACTION_TYPE_LABEL:Record<LtpActionType,string> = { TEMPORARY:'Tindakan Sementara', CORRECTIVE:'Tindakan Korektif', PREVENTIVE:'Tindakan Pencegahan' };
export const LTP_EVIDENCE_STATE = { BEFORE:'BEFORE', AFTER:'AFTER', BEFORE_AFTER:'BEFORE_AFTER' } as const;
export type LtpEvidenceState = (typeof LTP_EVIDENCE_STATE)[keyof typeof LTP_EVIDENCE_STATE];
export const LTP_EVIDENCE_STATE_LABEL:Record<LtpEvidenceState,string> = {
  BEFORE:'Bukti Sebelum', AFTER:'Bukti Sesudah', BEFORE_AFTER:'Perbandingan Before vs After',
};
export const LTP_SYSTEM_REVISION_CATEGORY = { ISE:'Peraturan ISE', STANDARD:'Dokumen Standard', OTHER:'Dokumen Lainnya' } as const;
export type LtpSystemRevisionCategory = (typeof LTP_SYSTEM_REVISION_CATEGORY)[keyof typeof LTP_SYSTEM_REVISION_CATEGORY];
export const KLASIFIKASI_DIS = { DOKUMEN: 'Dokumen', IMPLEMENTASI: 'Implementasi', SISTEM: 'Sistem' } as const;
export type KlasifikasiDIS = (typeof KLASIFIKASI_DIS)[keyof typeof KLASIFIKASI_DIS];

// Status checklist item hasil
export const HASIL_CHECKLIST = {
  SESUAI: 'O', // Sesuai — tidak memicu temuan
  MAJOR: 'A',
  MINOR: 'B',
  OFI: 'C',
  N_A: 'N-A', // Not Applicable
} as const;
export type HasilChecklist = (typeof HASIL_CHECKLIST)[keyof typeof HASIL_CHECKLIST];

export const HASIL_CHECKLIST_LIST: string[] = [
  HASIL_CHECKLIST.SESUAI,
  HASIL_CHECKLIST.MAJOR,
  HASIL_CHECKLIST.MINOR,
  HASIL_CHECKLIST.OFI,
  HASIL_CHECKLIST.N_A,
];

export const HASIL_CHECKLIST_LABEL: Record<string, string> = {
  'O': 'O — Sesuai',
  'A': 'A — Major',
  'B': 'B — Minor',
  'C': 'C — OFI',
  'N-A': 'N/A',
};

export const KODE_DOKUMEN_CHECKLIST = 'Q-120-ISE-001-FORM-005';
export const KODE_DOKUMEN_AGENDA_INTERNAL_AUDIT = 'Q-120-ISE-001-FORM-004';
export const AUDIT_AGENDA_STATUS = { DRAFT: 'Draft', FINAL: 'Final' } as const;
export type AuditAgendaStatus = (typeof AUDIT_AGENDA_STATUS)[keyof typeof AUDIT_AGENDA_STATUS];

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

// ============================================================
// BATCH 3b: AUDITOR / TRAINING
// ============================================================

// Status auditor
export const AUDITOR_STATUS = {
  AKTIF: 'Aktif',
  NONAKTIF: 'Nonaktif',
} as const;
export type AuditorStatus = (typeof AUDITOR_STATUS)[keyof typeof AUDITOR_STATUS];

export const AUDITOR_STATUS_LIST: AuditorStatus[] = [
  AUDITOR_STATUS.AKTIF,
  AUDITOR_STATUS.NONAKTIF,
];

// Hasil validasi kompetensi auditor
export const KOMPETENSI_STATUS = {
  MEMENUHI: 'Memenuhi Syarat',
  EXPIRED: 'Tidak Memenuhi Syarat',
  BELUM_ADA: 'Belum Ada Sertifikasi',
} as const;
export type KompetensiStatus = (typeof KOMPETENSI_STATUS)[keyof typeof KOMPETENSI_STATUS];

// ============================================================
// BATCH 4: INSTRUKSI INTERNAL AUDIT
// ============================================================

export const INSTRUCTION_STATUS = {
  DRAFT: 'Draft',
  BERJALAN: 'Berjalan',
  SELESAI: 'Selesai',
} as const;
export type InstructionStatus = (typeof INSTRUCTION_STATUS)[keyof typeof INSTRUCTION_STATUS];

export const INSTRUCTION_STATUS_LIST: InstructionStatus[] = [
  INSTRUCTION_STATUS.DRAFT,
  INSTRUCTION_STATUS.BERJALAN,
  INSTRUCTION_STATUS.SELESAI,
];

export const TIPE_BARIS = {
  REGULER: 'Reguler',
  AUDIT_PRODUK: 'AuditProduk',
  AUDIT_MANUFAKTUR: 'AuditManufaktur',
  AUDIT_SHIFT: 'AuditShift',
} as const;
export type TipeBaris = (typeof TIPE_BARIS)[keyof typeof TIPE_BARIS];

export const TIPE_BARIS_LIST: TipeBaris[] = [
  TIPE_BARIS.REGULER,
  TIPE_BARIS.AUDIT_PRODUK,
  TIPE_BARIS.AUDIT_MANUFAKTUR,
  TIPE_BARIS.AUDIT_SHIFT,
];

export const TIPE_BARIS_LABEL: Record<TipeBaris, string> = {
  Reguler: 'Reguler',
  AuditProduk: 'Audit Produk',
  AuditManufaktur: 'Audit Manufaktur',
  AuditShift: 'Audit Shift',
};

export const TIPE_SEKSI_MARK = {
  TARGET: 'target',
  TERKAIT: 'terkait',
} as const;
export type TipeSeksiMark = (typeof TIPE_SEKSI_MARK)[keyof typeof TIPE_SEKSI_MARK];

export const KODE_DOKUMEN_INSTRUCTION = 'Q-120-ISE-001-FORM-003';

export const STATUS_PROGRESS = {
  BELUM_MULAI: 'Belum Mulai',
  BERJALAN: 'Berjalan',
  ADA_NC: 'Ada NC',
  TIDAK_ADA_NC: 'Tidak Ada NC',
} as const;
export type StatusProgress = (typeof STATUS_PROGRESS)[keyof typeof STATUS_PROGRESS];

// ============================================================
// BATCH 5b: CHECKLIST AUDIT PRODUK
// ============================================================

export const CHECKLIST_PRODUK_STATUS = {
  DRAFT: 'Draft',
  SELESAI: 'Selesai',
} as const;
export type ProductChecklistStatus = (typeof CHECKLIST_PRODUK_STATUS)[keyof typeof CHECKLIST_PRODUK_STATUS];
export const CHECKLIST_PRODUK_STATUS_LIST: ProductChecklistStatus[] = Object.values(CHECKLIST_PRODUK_STATUS);

export const JUDGMENT_PRODUK = { OK: 'OK', NG: 'NG' } as const;
export type JudgmentProduk = (typeof JUDGMENT_PRODUK)[keyof typeof JUDGMENT_PRODUK];
export const JUDGMENT_PRODUK_LIST: JudgmentProduk[] = Object.values(JUDGMENT_PRODUK);

export const KODE_DOKUMEN_CHECKLIST_PRODUK = 'Q-120-ISE-001-FORM-006';

// ============================================================
// BATCH 5c: CHECKLIST AUDIT MANUFAKTUR & SHIFT
// ============================================================

export const CHECKLIST_MANUFAKTUR_STATUS = {
  DRAFT: 'Draft',
  SELESAI: 'Selesai',
} as const;
export type ChecklistManufakturStatus = (typeof CHECKLIST_MANUFAKTUR_STATUS)[keyof typeof CHECKLIST_MANUFAKTUR_STATUS];
export const CHECKLIST_MANUFAKTUR_STATUS_LIST: ChecklistManufakturStatus[] = Object.values(CHECKLIST_MANUFAKTUR_STATUS);

export const KODE_DOKUMEN_CHECKLIST_MANUFAKTUR = 'Q-120-ISE-001-FORM-007';

export const AUDIT_TEAM_MASTER_STATUS = { AKTIF: 'Aktif', NONAKTIF: 'Nonaktif' } as const;
export type AuditTeamMasterStatus = (typeof AUDIT_TEAM_MASTER_STATUS)[keyof typeof AUDIT_TEAM_MASTER_STATUS];
export const AUDIT_TEAM_MEMBER_ROLE = { LEAD: 'Lead', MEMBER: 'Member' } as const;
export type AuditTeamMemberRole = (typeof AUDIT_TEAM_MEMBER_ROLE)[keyof typeof AUDIT_TEAM_MEMBER_ROLE];
