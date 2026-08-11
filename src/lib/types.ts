// Tipe data untuk modul Pelaksanaan Internal Audit.
// Penamaan field persis sama dengan desain — camelCase konsisten.

import type {
  AuditPlanStatus,
  KelompokIPO,
  MetodeVerifikasi,
  ChecklistBankStatus,
} from './enums';

// Master organisasi
export interface Seksi {
  id: string;
  nama: string;
  kepala_seksi: string | null;
  urutan_tampil: number;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

// Header rencana audit tahunan
export interface AuditPlan {
  id: string;
  tahun: number;
  tanggal_berlaku: string; // ISO date
  no_revisi: number;
  kode_dokumen: string;
  penanggung_jawab_qms: string | null;
  disetujui_oleh: string | null;
  status: AuditPlanStatus;
  seksi_terlibat: string[]; // array of seksiId
  created_at: string;
  updated_at: string;
}

// Baris proses per plan
export interface AuditPlanProcess {
  id: string;
  plan_id: string;
  proses_master_id: string | null; // FK ke master proses (nullable untuk row lama yang diketik manual)
  nama_proses: string;
  catatan_kaki: string | null;
  urutan_tampil: number;
  created_at: string;
  updated_at: string;
}

// Cell matriks proses × seksi
export interface AuditPlanSeksiLink {
  id: string;
  process_id: string;
  seksi_id: string;
  terkait: boolean; // deprecated — gunakan peran
  peran: PeranProses | null; // 'utama' (◎), 'terkait' (O), atau null (tidak terlibat)
  flag_audit_proses_shift_produk: boolean; // *1 per sel
  flag_lingkup_pdca: boolean; // *2 per sel
  created_at: string;
}

// Cell matriks proses × bulan
export interface AuditPlanSchedule {
  id: string;
  process_id: string;
  bulan: number; // 1-12
  plan: boolean;
  aktual: boolean;
  schedule_id: string | null; // FK ke jadwal audit (Batch 3)
  created_at: string;
}

// Master checklist bank
export interface SubPertanyaan {
  teks: string;
}

export interface ChecklistBankItem {
  id: string;
  proses: string;
  sub_proses: string;
  pic_sub_proses: string | null;
  kelompok_ipo: KelompokIPO;
  nomor: string;
  klausul: string | null;
  pertanyaan_utama: string;
  sub_pertanyaan: SubPertanyaan[];
  metode_verifikasi_default: MetodeVerifikasi;
  status: ChecklistBankStatus;
  created_at: string;
  updated_at: string;
}

// ============================================================
// BATCH 2: Program Internal Audit
// ============================================================

import type { JenisRonde, ProgramStatus } from './enums';

// Header program internal audit
export interface AuditProgram {
  id: string;
  plan_id: string;
  jenis_ronde: JenisRonde;
  nomor_ke: number;
  tahun: number;
  tanggal_dibuat: string; // ISO date
  tanggal_revisi: string | null;
  no_revisi: number;
  penanggung_jawab_qms: string | null;
  management: string | null;
  tujuan: string | null;
  poin_perhatian: string | null;
  periode_label: string[];
  status: ProgramStatus;
  kode_dokumen: string;
  created_at: string;
  updated_at: string;
}

// Tujuan distribusi audit per seksi
export interface AuditProgramDistribusi {
  id: string;
  program_id: string;
  seksi_id: string;
  nama_section_manager: string | null; // auto-terisi dari seksi.kepala_seksi, overrideable
  created_at: string;
}

// Risiko & peluang register
export interface AuditProgramRisiko {
  id: string;
  program_id: string;
  nomor: string | null;
  risiko_peluang: string | null;
  control_action: string | null;
  created_at: string;
  updated_at: string;
}

// Schedule dasar — 7 langkah (auto-copied from template)
export interface AuditProgramStep {
  id: string;
  program_id: string;
  nomor: number;
  item_pelaksanaan: string | null;
  prosedur_pelaksanaan: string | null;
  periode_target: boolean[]; // array sepanjang periode_label program
  pic: string | null;
  created_at: string;
  updated_at: string;
}

// Master 7 langkah baku (template)
export interface AuditProgramStepTemplate {
  id: string;
  nomor: number;
  item_pelaksanaan: string;
  prosedur_pelaksanaan: string | null;
  pic: string;
  created_at: string;
}

// ============================================================
// MASTER DATA: PROSES YANG DIAUDIT
// ============================================================

import type { PeranProses } from './enums';

// Master proses yang akan diaudit
export interface Proses {
  id: string;
  nama_proses: string;
  kode_proses: string;
  diaudit_tahun_ini: boolean; // aktif untuk tahun ini, atau inactive
  tanggal_audit: string | null; // ISO date
  flag_audit_proses_shift_produk: boolean; // *1
  flag_lingkup_pdca: boolean; // *2
  keterangan: string | null;
  created_at: string;
  updated_at: string;
}

// Relasi proses × seksi dengan peran (utama/terkait)
export interface ProsesSeksi {
  id: string;
  proses_id: string;
  seksi_id: string;
  peran: PeranProses; // 'utama' (◎) atau 'terkait' (O)
  created_at: string;
}

// ============================================================
// BATCH 3a: JADWAL AUDIT & RUANG LINGKUP
// ============================================================

import type { JenisAudit, AuditScheduleStatus, StandarAudit, AuditorStatus } from './enums';

// Header jadwal audit teknis
export interface AuditSchedule {
  id: string;
  kode_audit: string; // mis. "IA-2026-001"
  plan_id: string | null; // FK ke audit_plans
  program_id: string | null; // FK ke audit_programs
  tanggal_mulai: string | null; // ISO date
  tanggal_selesai: string | null; // ISO date
  jenis_audit: JenisAudit;
  standar: StandarAudit[]; // array standar acuan
  status: AuditScheduleStatus;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

// Master auditor (modul Training)
export interface Auditor {
  id: string;
  nama: string;
  nip: string | null;
  departemen: string | null;
  jabatan: string | null;
  kualifikasi: string[];
  tanggal_sertifikasi: string | null; // ISO date
  tanggal_berlaku: string | null; // ISO date
  status: AuditorStatus;
  catatan: string | null;
  created_at: string;
  updated_at: string;
}

// Tim audit per jadwal
export interface AuditTeam {
  id: string;
  schedule_id: string;
  lead_auditor_id: string | null;
  member_ids: string[];
  auditee_area_owner_ids: string[];
  catatan_justifikasi: string | null;
  created_at: string;
  updated_at: string;
}

// Ruang lingkup audit per area
export interface AuditScope {
  id: string;
  schedule_id: string; // FK ke audit_schedules
  kode_audit: string | null; // diisi di Batch 4 (instruksi audit)
  area: string;
  seksi_terkait: string | null; // FK ke seksi
  proses_terkait: string[]; // array proses id
  klausul_standar: string[]; // array klausul
  dokumen_referensi: string[]; // array nama dokumen
  pic_area: string | null; // default dari seksi.kepala_seksi
  created_at: string;
  updated_at: string;
}
