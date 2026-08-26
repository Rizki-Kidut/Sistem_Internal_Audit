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
  metode_verifikasi_default: MetodeVerifikasi | null;
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
  periode_target: boolean[]; // legacy/backward compatibility
  tanggal_awal: string | null;
  tanggal_akhir: string | null;
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

// ============================================================
// BATCH 4: INSTRUKSI INTERNAL AUDIT + MASTER PLANT/MODEL/SHIFT
// ============================================================

import type { InstructionStatus, TipeBaris, TipeSeksiMark, StatusProgress } from './enums';

export interface Plant {
  id: string;
  nama: string;
  urutan_tampil: number;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

export interface TargetModel {
  id: string;
  plant_id: string;
  nama: string;
  urutan_tampil: number;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  plant_id: string;
  nama: string;
  urutan_tampil: number;
  created_at: string;
  updated_at: string;
}

export interface ApprovalPair {
  dibuat_oleh_qms: string | null;
  disetujui_oleh_direktur: string | null;
}

export interface AuditInstruction {
  id: string;
  program_id: string | null;
  tahun_fiskal: number;
  tujuan_audit: string | null;
  tanggal_buat: string | null;
  tanggal_revisi: string | null;
  no_revisi: number;
  kode_dokumen: string;
  prefix_nomor_audit: string;
  approval_pembuatan: ApprovalPair;
  approval_selesai: ApprovalPair;
  status: InstructionStatus;
  created_at: string;
  updated_at: string;
}

export interface SeksiMark {
  seksi_id: string;
  tipe: TipeSeksiMark;
}

export interface AuditorAssignment {
  auditor_id: string;
  is_lead: boolean;
}

export interface MatriksProdukMark {
  plant_id: string;
  target_model_id: string;
}

export interface MatriksManufakturShiftMark {
  plant_id: string;
  shift_id: string;
}

export interface AuditInstructionRow {
  id: string;
  instruction_id: string;
  kode_audit: string;
  team: string | null; // legacy compatibility only; Team master is authoritative
  team_master_id: string | null;
  catatan_justifikasi_tim: string | null;
  proses_id: string | null;
  pemilik_proses: string | null;
  seksi_marks: SeksiMark[];
  auditor: AuditorAssignment[]; // legacy compatibility only
  tipe_baris: TipeBaris;
  matriks_produk_marks: MatriksProdukMark[];
  matriks_manufaktur_shift_marks: MatriksManufakturShiftMark[];
  tanggal_audit_produk: string | null;
  nama_auditor_produk: string | null;
  kualifikasi: string | null;
  item_lain_diperiksa: string | null;
  tanggal_plan_audit: string | null;
  tanggal_pelaksanaan_audit: string | null;
  cek_selesai: boolean;
  urutan_tampil: number;
  created_at: string;
  updated_at: string;
}

import type { AuditTeamMasterStatus, AuditTeamMemberRole } from './enums';
export interface AuditTeamMasterMember {
  id: string;
  team_id: string;
  auditor_id: string;
  peran: AuditTeamMemberRole;
  is_team_leader: boolean;
  urutan_tampil: number;
  auditor?: Auditor;
}
export interface AuditTeamMaster {
  id: string;
  kode_tim: string;
  nama_tim: string;
  plan_id: string | null;
  is_locked: boolean;
  locked_at: string | null;
  status: AuditTeamMasterStatus;
  catatan: string | null;
  created_at: string;
  updated_at: string;
  members: AuditTeamMasterMember[];
}

export type RowStatusProgress = StatusProgress;

export interface AuditExecutionCounter { O: number; A: number; B: number; C: number; evaluated: number; total: number; }
export interface AuditExecutionFindingSummary { id: string; source_item_id: string; source_type: FindingSourceType; source_label: string; kode_temuan: string | null; draft_reference: string | null; kategori: KategoriTemuan; plor_complete: boolean; disposition: FindingSourceDisposition | null; }
export interface AuditExecutionSummary {
  row: AuditInstructionRow; proses: Proses | null; team: AuditTeamMaster | null;
  counter: AuditExecutionCounter; checklist_exists: boolean; checklist_complete: boolean;
  status_progress: RowStatusProgress; findings: AuditExecutionFindingSummary[];
  can_execute: boolean;
}

export function computeStatusProgress(input: Pick<AuditExecutionSummary, 'checklist_exists'|'checklist_complete'|'counter'>): RowStatusProgress {
  if (!input.checklist_exists || input.counter.evaluated === 0) return 'Belum Mulai';
  if (input.counter.A > 0 || input.counter.B > 0) return 'Ada NC';
  return input.checklist_complete ? 'Tidak Ada NC' : 'Berjalan';
}

// ============================================================
// BATCH 5: CHECKLIST PELAKSANAAN AUDIT
// ============================================================

export interface ChecklistSubPertanyaan {
  teks: string;
  sesuai: boolean | null;
}

export interface Checklist {
  id: string;
  row_id: string;
  kode_audit: string;
  judul_checklist: string;
  seksi_auditee: string[];
  section_manager: string | null;
  tanggal_dibuat: string;
  dibuat_oleh: string | null;
  penanggung_jawab_qms: string | null;
  kode_dokumen: string;
  pic_proses: string | null;
  item_monitoring_jelas: string | null;
  kondisi_pencapaian_target: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  bank_item_id: string | null;
  sub_proses: string;
  kelompok_ipo: KelompokIPO;
  nomor: string;
  klausul: string | null;
  pertanyaan_utama: string;
  sub_pertanyaan: ChecklistSubPertanyaan[];
  metode_verifikasi: MetodeVerifikasi | null;
  hasil: string | null;
  komentar_auditor: string | null;
  finding_id: string | null;
  created_at: string;
  updated_at: string;
}

export type { ProductChecklistStatus } from './enums';
import type { ProductChecklistStatus, JudgmentProduk } from './enums';

export interface ProductChecklistEvidence {
  name: string;
  path: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
}

export interface ChecklistProduk {
  id: string;
  row_id: string;
  kode_audit: string;
  nama_inspector: string | null;
  kualifikasi_inspector: string | null;
  part_name: string | null;
  part_no: string | null;
  control_plan_no: string | null;
  status: ProductChecklistStatus;
  kode_dokumen: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistProdukFase {
  id: string;
  checklist_produk_id: string;
  nama_fase: string;
  nama_proses: string | null;
  inspection_result_chart: boolean;
  no_inspection_standard: string | null;
  dokumen_bukti: ProductChecklistEvidence[];
  urutan_tampil: number;
  created_at: string;
  updated_at: string;
}

export interface ChecklistProdukItem {
  id: string;
  fase_id: string;
  kategori: string | null;
  jumlah_sampel_minimal: number | null;
  item_pemeriksaan: string;
  alat_pemeriksaan: string | null;
  standar_kriteria: string | null;
  jumlah_sampel: number | null;
  hasil_pemeriksaan: string | null;
  judgment: JudgmentProduk | null;
  finding_id: string | null;
  finding_kategori: import('./enums').KategoriTemuan | null;
  urutan_tampil: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// BATCH 6a: TEMUAN / PLOR FORMAL
// ============================================================
import type { FindingReviewStatus, FindingSourceType, FindingStatus, KlasifikasiDIS, KategoriTemuan } from './enums';
export interface Finding {
  id: string; instruction_row_id: string; kode_audit: string; kode_temuan: string | null; draft_reference: string | null;
  nomor_urut_temuan: number; source_type: FindingSourceType; source_item_id: string;
  kategori: KategoriTemuan; klasifikasi_dis: KlasifikasiDIS | null;
  problem: string | null; location: string | null; objective_evidence: string | null;
  reference: string | null; saran_perbaikan: string | null; auditor_penemu_id: string | null;
  auditee_area: string | null; tanggal_temuan: string; status: FindingStatus; review_status: FindingReviewStatus; car_id: string | null; revision_version:number;
  created_at: string; updated_at: string; auditor_penemu?: Auditor | null;
}
export interface FindingReviewEvent { id:string;finding_id:string;event_type:string;actor_user_id:string;actor_identity_type:string;comment:string|null;changed_fields:Record<string,unknown>|null;before_values:Record<string,unknown>|null;after_values:Record<string,unknown>|null;created_at:string; }
export interface FindingSourceDisposition { finding_id:string;source_type:FindingSourceType;source_item_id:string;initial_judgement:string;effective_judgement:string;reason:string;actor_display_name:string;created_at:string; }
export interface FindingCapabilities { is_team_member:boolean;is_team_leader:boolean;is_lead_auditor:boolean;is_admin:boolean; }
export interface FindingNotification { id:string;finding_id:string|null;notification_type:string;title:string;message:string;read_at:string|null;created_at:string; }
export interface ClauseKeywordMap { id: string; keyword: string; klausul: string; status: 'Aktif'|'Nonaktif'; prioritas: number; created_at: string; updated_at: string; }
export interface FindingContext {
  finding: Finding; row: AuditInstructionRow; instruction: AuditInstruction; proses: Proses | null;
  sections: Seksi[]; team: AuditTeamMaster | null; source_note: string | null;
  source_reference: string | null; source_details: Record<string, string | number | null>;
}

import type { LtpActionType, LtpEvidenceState, LtpStatus, LtpSystemRevisionCategory } from './enums';
export interface LtpWhyAnalysis { id?:string;level:number;teks:string; }
export interface LtpActionEvidence { id:string;action_id:string;evidence_state:LtpEvidenceState;file_name:string;path:string;mime_type:string|null;size_bytes:number|null;uploaded_at:string; }
export interface LtpAction { id?:string;action_type:LtpActionType;description:string;pic:string|null;due_date:string|null;evidence:LtpActionEvidence[]; }
export interface LtpSystemRevision { id?:string;kategori:LtpSystemRevisionCategory;nama_dokumen:string;created_at?:string; }
export interface LtpDraftPayload { car_id:string;expected_revision:number;dampak_temuan:string;manfaat_perbaikan:string;why_analysis:LtpWhyAnalysis[];actions:LtpAction[];system_revisions:LtpSystemRevision[]; }
export interface LtpWorklistRow { car_id:string;finding_id:string;kode_ltp:string;kode_audit:string;kategori:KategoriTemuan;status:LtpStatus;seksi_auditee_id:string|null;seksi_nama:string|null;proses_nama:string|null;tanggal_temuan:string; }
export interface LtpContext {
  ltp:{id:string;finding_id:string;kode_ltp:string;status:LtpStatus;seksi_auditee_id:string|null;revision_version:number;dampak_temuan:string|null;manfaat_perbaikan:string|null;auditor_verification_result:string|null;created_at:string};
  finding:{kode_audit:string;kode_temuan:string;kategori:KategoriTemuan;problem:string;location:string;objective_evidence:string;reference:string|null;saran_perbaikan:string|null;auditee_area:string|null;tanggal_temuan:string};
  section:{id:string;nama:string;kepala_seksi:string|null}|null;
  process:{id:string;nama:string}|null;
  team:{id:string;kode:string;nama:string}|null;
  team_leader:{id:string;nama:string}|null;
  permissions:{can_edit_auditee:boolean};
  why_analysis:LtpWhyAnalysis[];
  actions:LtpAction[];
  system_revisions:LtpSystemRevision[];
}

export type { ChecklistManufakturStatus } from './enums';
import type { ChecklistManufakturStatus, HasilChecklist } from './enums';

export interface JenisChecklistManufakturShift {
  plant_id: string;
  plant_nama: string;
  shift_id: string;
  shift_nama: string;
}

export interface ChecklistManufakturShift {
  id: string;
  row_id: string;
  kode_audit: string;
  jenis_checklist: JenisChecklistManufakturShift[];
  nama_seksi: string | null;
  manager_proses_line_leader: string | null;
  tanggal_audit: string | null;
  auditor: AuditorAssignment[];
  nama_part: string | null;
  nomor_part: string | null;
  nomor_line: string | null;
  control_plan_no: string | null;
  p_fmea_no: string | null;
  customer: string | null;
  jumlah_operator: number | null;
  status: ChecklistManufakturStatus;
  kode_dokumen: string;
  created_at: string;
  updated_at: string;
}

export interface ChecklistManufakturBankItem {
  id: string;
  bagian: string;
  nomor: string;
  klausul: string | null;
  item_pemeriksaan: string | null;
  urutan_tampil: number;
  status: ChecklistBankStatus;
  created_at: string;
  updated_at: string;
}

export interface ChecklistManufakturItem {
  id: string;
  checklist_id: string;
  bank_item_id: string | null;
  no_proses_dicek: string | null;
  hasil_pengamatan: string | null;
  hasil: HasilChecklist | null;
  finding_id: string | null;
  urutan_tampil: number;
  created_at: string;
  updated_at: string;
  bank_item?: ChecklistManufakturBankItem | null;
}

// ============================================================
// BATCH 5d: AGENDA INTERNAL AUDIT (one live Instruction row / QA context)
// ============================================================
import type { AuditAgendaStatus } from './enums';

export interface AgendaAssistantAuditor { nama: string; seksi: string; }
export interface AuditAgenda {
  id: string; instruction_row_id: string; tanggal_terbit: string;
  tujuan_lingkup_audit: string | null; item_lain_yang_dicek: string | null;
  dokumen_dikirim_di_awal: string | null; dokumen_dipersiapkan_hari_audit: string | null;
  asisten_auditor_pendamping: AgendaAssistantAuditor[]; catatan_khusus: string | null;
  status: AuditAgendaStatus; kode_dokumen: string; finalized_at: string | null;
  created_at: string; updated_at: string;
}
export interface AuditAgendaItem {
  id: string; agenda_id: string; tanggal: string; jam_mulai: string; jam_selesai: string;
  detail_audit_proses_persyaratan: string; lokasi: string | null; urutan: number;
  created_at: string; updated_at: string;
}
export interface AuditAgendaContext {
  row: AuditInstructionRow; instruction: AuditInstruction; proses: Proses | null;
  seksi: Seksi[]; managers: string[]; team: AuditTeamMaster | null;
  lead: Auditor | null; members: Auditor[]; agenda: AuditAgenda | null;
}
export interface AgendaWorklistRow extends AuditAgendaContext { status_agenda: 'Belum Dibuat' | AuditAgendaStatus; }
