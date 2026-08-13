// Data access layer untuk Instruksi Internal Audit (header + rows).

import { supabase } from '../lib/supabaseClient';
import type {
  AuditInstruction,
  AuditInstructionRow,
  SeksiMark,
  AuditorAssignment,
  MatriksProdukMark,
  MatriksManufakturShiftMark,
  ApprovalPair,
  Seksi,
  Proses,
} from '../lib/types';
import { INSTRUCTION_STATUS, TIPE_BARIS, TIPE_SEKSI_MARK, KODE_DOKUMEN_INSTRUCTION } from '../lib/enums';
import type { InstructionStatus, TipeBaris } from '../lib/enums';
import { validateRequired, toDateInput } from '../lib/utils';

// ============================================================
// MAPPERS
// ============================================================

function mapInstruction(row: Record<string, unknown>): AuditInstruction {
  return {
    id: row.id as string,
    program_id: (row.program_id as string) ?? null,
    tahun_fiskal: row.tahun_fiskal as number,
    tujuan_audit: (row.tujuan_audit as string) ?? null,
    tanggal_buat: (row.tanggal_buat as string) ?? null,
    tanggal_revisi: (row.tanggal_revisi as string) ?? null,
    no_revisi: row.no_revisi as number,
    kode_dokumen: (row.kode_dokumen as string) ?? KODE_DOKUMEN_INSTRUCTION,
    prefix_nomor_audit: (row.prefix_nomor_audit as string) ?? 'QA-',
    approval_pembuatan: (row.approval_pembuatan as ApprovalPair) ?? { dibuat_oleh_qms: null, disetujui_oleh_direktur: null },
    approval_selesai: (row.approval_selesai as ApprovalPair) ?? { dibuat_oleh_qms: null, disetujui_oleh_direktur: null },
    status: (row.status as InstructionStatus) ?? INSTRUCTION_STATUS.DRAFT,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapRow(row: Record<string, unknown>): AuditInstructionRow {
  return {
    id: row.id as string,
    instruction_id: row.instruction_id as string,
    kode_audit: (row.kode_audit as string) ?? '',
    team: (row.team as string) ?? null,
    proses_id: (row.proses_id as string) ?? null,
    pemilik_proses: (row.pemilik_proses as string) ?? null,
    seksi_marks: (row.seksi_marks as SeksiMark[]) ?? [],
    auditor: (row.auditor as AuditorAssignment[]) ?? [],
    tipe_baris: (row.tipe_baris as TipeBaris) ?? TIPE_BARIS.REGULER,
    matriks_produk_marks: (row.matriks_produk_marks as MatriksProdukMark[]) ?? [],
    matriks_manufaktur_shift_marks: (row.matriks_manufaktur_shift_marks as MatriksManufakturShiftMark[]) ?? [],
    tanggal_audit_produk: (row.tanggal_audit_produk as string) ?? null,
    nama_auditor_produk: (row.nama_auditor_produk as string) ?? null,
    kualifikasi: (row.kualifikasi as string) ?? null,
    item_lain_diperiksa: (row.item_lain_diperiksa as string) ?? null,
    tanggal_plan_audit: (row.tanggal_plan_audit as string) ?? null,
    tanggal_pelaksanaan_audit: (row.tanggal_pelaksanaan_audit as string) ?? null,
    cek_selesai: (row.cek_selesai as boolean) ?? false,
    urutan_tampil: (row.urutan_tampil as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ============================================================
// AUDIT_INSTRUCTIONS (header)
// ============================================================

export async function getInstructions(): Promise<AuditInstruction[]> {
  const { data, error } = await supabase
    .from('audit_instructions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Gagal memuat instruksi audit: ${error.message}`);
  return (data ?? []).map((r) => mapInstruction(r as Record<string, unknown>));
}

export async function getInstructionById(id: string): Promise<AuditInstruction | null> {
  const { data, error } = await supabase
    .from('audit_instructions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat instruksi audit: ${error.message}`);
  return data ? mapInstruction(data as Record<string, unknown>) : null;
}

export async function saveInstruction(instr: Partial<AuditInstruction>): Promise<AuditInstruction> {
  validateRequired({ tahun_fiskal: instr.tahun_fiskal }, { tahun_fiskal: 'Tahun Fiskal' });
  const payload = {
    program_id: instr.program_id ?? null,
    tahun_fiskal: instr.tahun_fiskal,
    tujuan_audit: instr.tujuan_audit ?? null,
    tanggal_buat: instr.tanggal_buat ?? toDateInput(new Date()),
    tanggal_revisi: instr.tanggal_revisi ?? null,
    no_revisi: instr.no_revisi ?? 0,
    kode_dokumen: instr.kode_dokumen ?? KODE_DOKUMEN_INSTRUCTION,
    prefix_nomor_audit: instr.prefix_nomor_audit ?? 'QA-',
    approval_pembuatan: instr.approval_pembuatan ?? { dibuat_oleh_qms: null, disetujui_oleh_direktur: null },
    approval_selesai: instr.approval_selesai ?? { dibuat_oleh_qms: null, disetujui_oleh_direktur: null },
    status: instr.status ?? INSTRUCTION_STATUS.DRAFT,
  };
  if (instr.id) {
    const { data, error } = await supabase
      .from('audit_instructions').update(payload).eq('id', instr.id).select().single();
    if (error) throw new Error(`Gagal mengupdate instruksi audit: ${error.message}`);
    return mapInstruction(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from('audit_instructions').insert(payload).select().single();
  if (error) throw new Error(`Gagal menambah instruksi audit: ${error.message}`);
  return mapInstruction(data as Record<string, unknown>);
}

export async function deleteInstruction(id: string): Promise<void> {
  const { error } = await supabase.from('audit_instructions').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus instruksi audit: ${error.message}`);
}

// ============================================================
// AUDIT_INSTRUCTION_ROWS
// ============================================================

export async function getRowsByInstruction(instructionId: string): Promise<AuditInstructionRow[]> {
  const { data, error } = await supabase
    .from('audit_instruction_rows')
    .select('*')
    .eq('instruction_id', instructionId)
    .order('urutan_tampil', { ascending: true });
  if (error) throw new Error(`Gagal memuat baris instruksi: ${error.message}`);
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

export async function saveRow(row: Partial<AuditInstructionRow>): Promise<AuditInstructionRow> {
  validateRequired({ instruction_id: row.instruction_id }, { instruction_id: 'Instruction' });
  const payload = {
    instruction_id: row.instruction_id,
    kode_audit: row.kode_audit,
    team: row.team ?? null,
    proses_id: row.proses_id ?? null,
    pemilik_proses: row.pemilik_proses ?? null,
    seksi_marks: row.seksi_marks ?? [],
    auditor: row.auditor ?? [],
    tipe_baris: row.tipe_baris ?? TIPE_BARIS.REGULER,
    matriks_produk_marks: row.matriks_produk_marks ?? [],
    matriks_manufaktur_shift_marks: row.matriks_manufaktur_shift_marks ?? [],
    tanggal_audit_produk: row.tanggal_audit_produk ?? null,
    nama_auditor_produk: row.nama_auditor_produk ?? null,
    kualifikasi: row.kualifikasi ?? null,
    item_lain_diperiksa: row.item_lain_diperiksa ?? null,
    tanggal_plan_audit: row.tanggal_plan_audit ?? null,
    tanggal_pelaksanaan_audit: row.tanggal_pelaksanaan_audit ?? null,
    cek_selesai: row.cek_selesai ?? false,
    urutan_tampil: row.urutan_tampil ?? 0,
  };
  if (row.id) {
    const { data, error } = await supabase
      .from('audit_instruction_rows').update(payload).eq('id', row.id).select().single();
    if (error) throw new Error(`Gagal mengupdate baris: ${error.message}`);
    return mapRow(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from('audit_instruction_rows').insert(payload).select().single();
  if (error) throw new Error(`Gagal menambah baris: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

export async function deleteRow(id: string): Promise<void> {
  const { error } = await supabase.from('audit_instruction_rows').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus baris: ${error.message}`);
}

// ============================================================
// GENERATE KODE AUDIT (QA-01, QA-02, dst) — sekali, tidak berubah
// ============================================================

export async function generateNextKodeAudit(prefix: string): Promise<string> {
  const { data, error } = await supabase
    .from('audit_instruction_rows')
    .select('kode_audit')
    .ilike('kode_audit', `${prefix}%`)
    .order('kode_audit', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Gagal generate kode audit: ${error.message}`);
  if (!data?.kode_audit) return `${prefix}01`;
  const match = (data.kode_audit as string).match(new RegExp(`${prefix}(\\d+)`));
  const nextNum = match ? parseInt(match[1], 10) + 1 : 1;
  return `${prefix}${String(nextNum).padStart(2, '0')}`;
}

// ============================================================
// HELPER: Auto-fill pemilik proses dari seksi.kepala_seksi
// ============================================================

export function resolvePemilikProses(
  prosesId: string | null,
  prosesList: Proses[],
  seksiList: Seksi[],
  seksiMarks: SeksiMark[],
): string | null {
  if (!prosesId) return null;
  const targetMark = seksiMarks.find((m) => m.tipe === 'target');
  if (targetMark) {
    const seksi = seksiList.find((s) => s.id === targetMark.seksi_id);
    if (seksi?.kepala_seksi) return seksi.kepala_seksi;
  }
  return null;
}

// ============================================================
// GENERATE DARI PROGRAM — atomic batch creation
// Membuat 1 audit_instruction + 1 audit_instruction_row per proses
// di audit_plan_process (plan sumber program). Setiap baris:
//  - kodeAudit auto sequential (QA-01, QA-02, ...)
//  - seksiMarks disalin dari audit_plan_seksi_link (peran utama→target, terkait→terkait)
//  - pemilikProses dari seksi target.kepala_seksi
//  - tanggalPlanAudit disarankan dari bulan plan=true pertama di audit_plan_schedule
//  - kalau audit_schedule/audit_team untuk proses itu sudah ada (via program), auto-link;
//    kalau belum, kosongkan (diisi di grid)
// Setelah baris dibuat, propagasi kodeAudit ke audit_scopes.kode_audit terkait.
// Jika gagal di tengah, hapus instruction (CASCADE menghapus rows) — tidak tinggalkan data setengah jadi.
// ============================================================

interface PlanProcessRow {
  id: string;
  proses_master_id: string | null;
  nama_proses: string;
}

interface SeksiLinkRow {
  process_id: string;
  seksi_id: string;
  peran: string | null;
}

interface ScheduleRow {
  process_id: string;
  bulan: number;
  plan: boolean;
}

interface ScopeRow {
  id: string;
  schedule_id: string;
  kode_audit: string | null;
  proses_terkait: string[];
}

interface TeamRow {
  schedule_id: string;
  lead_auditor_id: string | null;
  member_ids: string[];
}

export interface GenerateResult {
  instruction: AuditInstruction;
  rowsCreated: number;
}

function bulanToDate(bulan: number, tahun: number): string {
  const month = String(bulan).padStart(2, '0');
  return `${tahun}-${month}-15`;
}

export async function generateFromProgram(
  programId: string,
  programTahun: number,
  seksiList: Seksi[],
): Promise<GenerateResult> {
  // 1. Ambil program untuk dapat plan_id
  const { data: programRow, error: progErr } = await supabase
    .from('audit_programs')
    .select('plan_id, tujuan')
    .eq('id', programId)
    .maybeSingle();
  if (progErr) throw new Error(`Gagal memuat program: ${progErr.message}`);
  if (!programRow) throw new Error('Program tidak ditemukan');
  const planId = (programRow as { plan_id: string }).plan_id;
  const tujuan = (programRow as { tujuan: string | null }).tujuan;

  // 2. Ambil semua audit_plan_process untuk plan ini
  const { data: procData, error: procErr } = await supabase
    .from('audit_plan_process')
    .select('id, proses_master_id, nama_proses')
    .eq('plan_id', planId)
    .order('urutan_tampil', { ascending: true });
  if (procErr) throw new Error(`Gagal memuat proses plan: ${procErr.message}`);
  const processes = (procData ?? []) as unknown as PlanProcessRow[];

  // 3. Ambil semua audit_plan_seksi_link untuk proses-proses ini
  const processIds = processes.map((p) => p.id);
  let seksiLinks: SeksiLinkRow[] = [];
  if (processIds.length > 0) {
    const { data: linkData, error: linkErr } = await supabase
      .from('audit_plan_seksi_link')
      .select('process_id, seksi_id, peran')
      .in('process_id', processIds);
    if (linkErr) throw new Error(`Gagal memuat seksi link: ${linkErr.message}`);
    seksiLinks = (linkData ?? []) as unknown as SeksiLinkRow[];
  }

  // 4. Ambil semua audit_plan_schedule untuk proses-proses ini
  let schedules: ScheduleRow[] = [];
  if (processIds.length > 0) {
    const { data: schedData, error: schedErr } = await supabase
      .from('audit_plan_schedule')
      .select('process_id, bulan, plan')
      .in('process_id', processIds);
    if (schedErr) throw new Error(`Gagal memuat jadwal plan: ${schedErr.message}`);
    schedules = (schedData ?? []) as unknown as ScheduleRow[];
  }

  // 5. Ambil audit_schedules yang terkait program ini (untuk auto-link)
  const { data: schedHdrData, error: schedHdrErr } = await supabase
    .from('audit_schedules')
    .select('id, program_id')
    .eq('program_id', programId);
  if (schedHdrErr) throw new Error(`Gagal memuat jadwal audit: ${schedHdrErr.message}`);
  const scheduleIds = ((schedHdrData ?? []) as { id: string }[]).map((r) => r.id);

  // 6. Ambil audit_scopes untuk schedule di program ini (untuk auto-link & propagasi)
  let scopes: ScopeRow[] = [];
  if (scheduleIds.length > 0) {
    const { data: scopeData, error: scopeErr } = await supabase
      .from('audit_scopes')
      .select('id, schedule_id, kode_audit, proses_terkait')
      .in('schedule_id', scheduleIds);
    if (scopeErr) throw new Error(`Gagal memuat ruang lingkup: ${scopeErr.message}`);
    scopes = (scopeData ?? []) as unknown as ScopeRow[];
  }

  // 7. Ambil audit_teams untuk schedule di program ini
  let teams: TeamRow[] = [];
  if (scheduleIds.length > 0) {
    const { data: teamData, error: teamErr } = await supabase
      .from('audit_teams')
      .select('schedule_id, lead_auditor_id, member_ids')
      .in('schedule_id', scheduleIds);
    if (teamErr) throw new Error(`Gagal memuat tim audit: ${teamErr.message}`);
    teams = (teamData ?? []) as unknown as TeamRow[];
  }

  // 8. Buat instruction header
  const prefix = 'QA-';
  const { data: instrData, error: instrErr } = await supabase
    .from('audit_instructions')
    .insert({
      program_id: programId,
      tahun_fiskal: programTahun,
      tujuan_audit: tujuan,
      kode_dokumen: KODE_DOKUMEN_INSTRUCTION,
      prefix_nomor_audit: prefix,
      status: INSTRUCTION_STATUS.DRAFT,
    })
    .select()
    .single();
  if (instrErr) throw new Error(`Gagal membuat instruksi: ${instrErr.message}`);
  const instruction = mapInstruction(instrData as Record<string, unknown>);

  try {
    // 9. Bangun payload rows
    const rowPayloads: Record<string, unknown>[] = [];
    const propagationUpdates: { scopeId: string; kodeAudit: string }[] = [];

    // Map process_id → seksi_marks
    const linksByProcess = new Map<string, SeksiLinkRow[]>();
    for (const link of seksiLinks) {
      const arr = linksByProcess.get(link.process_id) ?? [];
      arr.push(link);
      linksByProcess.set(link.process_id, arr);
    }

    // Map process_id → first plan=true month
    const firstPlanMonthByProcess = new Map<string, number>();
    for (const sched of schedules) {
      if (sched.plan) {
        const existing = firstPlanMonthByProcess.get(sched.process_id);
        if (existing === undefined || sched.bulan < existing) {
          firstPlanMonthByProcess.set(sched.process_id, sched.bulan);
        }
      }
    }

    // Map proses_master_id → scopes (match via proses_terkait which contains master IDs)
    const scopesByProsesMaster = new Map<string, ScopeRow[]>();
    for (const scope of scopes) {
      for (const pid of scope.proses_terkait) {
        const arr = scopesByProsesMaster.get(pid) ?? [];
        arr.push(scope);
        scopesByProsesMaster.set(pid, arr);
      }
    }

    // Map schedule_id → team
    const teamBySchedule = new Map<string, TeamRow>();
    for (const team of teams) {
      teamBySchedule.set(team.schedule_id, team);
    }

    // Map scope → schedule_id for team lookup
    const scheduleIdByScope = new Map<string, string>();
    for (const scope of scopes) {
      scheduleIdByScope.set(scope.id, scope.schedule_id);
    }

    let seqNum = 0;
    for (const proc of processes) {
      seqNum++;
      const kodeAudit = `${prefix}${String(seqNum).padStart(2, '0')}`;

      // Build seksi_marks from links
      const procLinks = linksByProcess.get(proc.id) ?? [];
      const seksiMarks: SeksiMark[] = procLinks
        .filter((l) => l.peran !== null)
        .map((l) => ({
          seksi_id: l.seksi_id,
          tipe: l.peran === 'utama' ? TIPE_SEKSI_MARK.TARGET : TIPE_SEKSI_MARK.TERKAIT,
        }));

      // Resolve pemilik_proses from target seksi
      let pemilikProses: string | null = null;
      const targetMark = seksiMarks.find((m) => m.tipe === 'target');
      if (targetMark) {
        const seksi = seksiList.find((s) => s.id === targetMark.seksi_id);
        if (seksi?.kepala_seksi) pemilikProses = seksi.kepala_seksi;
      }

      // Suggested tanggal_plan_audit from first plan=true month
      const firstMonth = firstPlanMonthByProcess.get(proc.id);
      const tanggalPlan = firstMonth !== undefined ? bulanToDate(firstMonth, programTahun) : null;

      // Auto-link: cari scope yang proses_terkait-nya mengandung proses_master_id ini
      const matchedScopes = proc.proses_master_id
        ? (scopesByProsesMaster.get(proc.proses_master_id) ?? [])
        : [];

      // Auto-link auditor dari team (jika scope match dan team ada)
      let auditorAssignment: AuditorAssignment[] = [];
      if (matchedScopes.length > 0) {
        const scope = matchedScopes[0];
        const scheduleId = scheduleIdByScope.get(scope.id);
        if (scheduleId) {
          const team = teamBySchedule.get(scheduleId);
          if (team) {
            if (team.lead_auditor_id) {
              auditorAssignment.push({ auditor_id: team.lead_auditor_id, is_lead: true });
            }
            for (const memberId of team.member_ids) {
              if (memberId !== team.lead_auditor_id) {
                auditorAssignment.push({ auditor_id: memberId, is_lead: false });
              }
            }
          }
        }
        // Propagation: update scope.kode_audit
        propagationUpdates.push({ scopeId: scope.id, kodeAudit });
      }

      rowPayloads.push({
        instruction_id: instruction.id,
        kode_audit: kodeAudit,
        team: null,
        proses_id: proc.proses_master_id,
        pemilik_proses: pemilikProses,
        seksi_marks: seksiMarks,
        auditor: auditorAssignment,
        tipe_baris: TIPE_BARIS.REGULER,
        matriks_produk_marks: [],
        matriks_manufaktur_shift_marks: [],
        tanggal_audit_produk: null,
        nama_auditor_produk: null,
        kualifikasi: null,
        item_lain_diperiksa: null,
        tanggal_plan_audit: tanggalPlan,
        tanggal_pelaksanaan_audit: null,
        cek_selesai: false,
        urutan_tampil: seqNum,
      });
    }

    if (rowPayloads.length === 0) {
      // No processes — still return the empty instruction
      return { instruction, rowsCreated: 0 };
    }

    // 10. Batch insert all rows
    const { error: rowErr } = await supabase
      .from('audit_instruction_rows')
      .insert(rowPayloads);
    if (rowErr) throw new Error(`Gagal membuat baris: ${rowErr.message}`);

    // 11. Propagate kode_audit ke audit_scopes
    for (const update of propagationUpdates) {
      const { error: scopeErr } = await supabase
        .from('audit_scopes')
        .update({ kode_audit: update.kodeAudit })
        .eq('id', update.scopeId);
      if (scopeErr) throw new Error(`Gagal propagasi kode audit: ${scopeErr.message}`);
    }

    return { instruction, rowsCreated: rowPayloads.length };
  } catch (err) {
    // Rollback: hapus instruction (CASCADE menghapus rows)
    await supabase.from('audit_instructions').delete().eq('id', instruction.id);
    throw err;
  }
}
