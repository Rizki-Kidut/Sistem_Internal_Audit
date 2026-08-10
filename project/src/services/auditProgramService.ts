// Data access layer untuk Program Internal Audit (Batch 2).
// Mencakup header program, distribusi seksi, risiko, dan schedule steps.
// Operasi create program: auto-copy 7 langkah dari template + auto-populate distribusi
// dari seksi_terlibat plan — dibungkus dalam satu fungsi atomic.

import { supabase } from '../lib/supabaseClient';
import type {
  AuditProgram,
  AuditProgramDistribusi,
  AuditProgramRisiko,
  AuditProgramStep,
  AuditProgramStepTemplate,
  Seksi,
  AuditPlan,
} from '../lib/types';
import {
  JENIS_RONDE,
  PROGRAM_STATUS,
  KODE_DOKUMEN_PROGRAM,
  DEFAULT_PERIODE_LABEL,
} from '../lib/enums';
import type { JenisRonde, ProgramStatus } from '../lib/enums';
import { validateRequired, toDateInput } from '../lib/utils';

// Row mappers: snake_case DB → camelCase interface
function mapProgram(row: Record<string, unknown>): AuditProgram {
  return {
    id: row.id as string,
    plan_id: row.plan_id as string,
    jenis_ronde: row.jenis_ronde as JenisRonde,
    nomor_ke: row.nomor_ke as number,
    tahun: row.tahun as number,
    tanggal_dibuat: row.tanggal_dibuat as string,
    tanggal_revisi: (row.tanggal_revisi as string) ?? null,
    no_revisi: row.no_revisi as number,
    penanggung_jawab_qms: (row.penanggung_jawab_qms as string) ?? null,
    management: (row.management as string) ?? null,
    tujuan: (row.tujuan as string) ?? null,
    poin_perhatian: (row.poin_perhatian as string) ?? null,
    periode_label: (row.periode_label as string[]) ?? DEFAULT_PERIODE_LABEL,
    status: row.status as ProgramStatus,
    kode_dokumen: row.kode_dokumen as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapDistribusi(row: Record<string, unknown>): AuditProgramDistribusi {
  return {
    id: row.id as string,
    program_id: row.program_id as string,
    seksi_id: row.seksi_id as string,
    nama_section_manager: (row.nama_section_manager as string) ?? null,
    created_at: row.created_at as string,
  };
}

function mapRisiko(row: Record<string, unknown>): AuditProgramRisiko {
  return {
    id: row.id as string,
    program_id: row.program_id as string,
    nomor: (row.nomor as string) ?? null,
    risiko_peluang: (row.risiko_peluang as string) ?? null,
    control_action: (row.control_action as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapStep(row: Record<string, unknown>): AuditProgramStep {
  return {
    id: row.id as string,
    program_id: row.program_id as string,
    nomor: row.nomor as number,
    item_pelaksanaan: (row.item_pelaksanaan as string) ?? null,
    prosedur_pelaksanaan: (row.prosedur_pelaksanaan as string) ?? null,
    periode_target: (row.periode_target as boolean[]) ?? [],
    pic: (row.pic as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapTemplate(row: Record<string, unknown>): AuditProgramStepTemplate {
  return {
    id: row.id as string,
    nomor: row.nomor as number,
    item_pelaksanaan: row.item_pelaksanaan as string,
    prosedur_pelaksanaan: (row.prosedur_pelaksanaan as string) ?? null,
    pic: row.pic as string,
    created_at: row.created_at as string,
  };
}

// ============================================================
// AUDIT_PROGRAMS (header)
// ============================================================

export async function getAuditPrograms(): Promise<AuditProgram[]> {
  const { data, error } = await supabase
    .from('audit_programs')
    .select('*')
    .order('tahun', { ascending: false })
    .order('no_revisi', { ascending: false });

  if (error) throw new Error(`Gagal memuat program audit: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapProgram(r));
}

export async function getAuditProgramsByPlan(planId: string): Promise<AuditProgram[]> {
  const { data, error } = await supabase
    .from('audit_programs')
    .select('*')
    .eq('plan_id', planId)
    .order('no_revisi', { ascending: false });

  if (error) throw new Error(`Gagal memuat program audit: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapProgram(r));
}

export async function getAuditProgramById(id: string): Promise<AuditProgram | null> {
  const { data, error } = await supabase
    .from('audit_programs')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat program audit: ${error.message}`);
  return data ? mapProgram(data as Record<string, unknown>) : null;
}

export async function saveAuditProgram(program: Partial<AuditProgram>): Promise<AuditProgram> {
  validateRequired(
    {
      plan_id: program.plan_id,
      jenis_ronde: program.jenis_ronde,
      tahun: program.tahun,
      tanggal_dibuat: program.tanggal_dibuat,
    },
    {
      plan_id: 'Rencana Audit sumber',
      jenis_ronde: 'Jenis Ronde',
      tahun: 'Tahun',
      tanggal_dibuat: 'Tanggal Dibuat',
    },
  );

  const payload = {
    plan_id: program.plan_id,
    jenis_ronde: program.jenis_ronde,
    nomor_ke: program.nomor_ke ?? 1,
    tahun: program.tahun,
    tanggal_dibuat: program.tanggal_dibuat,
    tanggal_revisi: program.tanggal_revisi ?? null,
    no_revisi: program.no_revisi ?? 0,
    penanggung_jawab_qms: program.penanggung_jawab_qms ?? null,
    management: program.management ?? null,
    tujuan: program.tujuan ?? null,
    poin_perhatian: program.poin_perhatian ?? null,
    periode_label: program.periode_label ?? DEFAULT_PERIODE_LABEL,
    status: program.status ?? PROGRAM_STATUS.DRAFT,
    kode_dokumen: program.kode_dokumen ?? KODE_DOKUMEN_PROGRAM,
  };

  if (program.id) {
    const { data, error } = await supabase
      .from('audit_programs')
      .update(payload)
      .eq('id', program.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate program audit: ${error.message}`);
    return mapProgram(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('audit_programs')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah program audit: ${error.message}`);
  return mapProgram(data as Record<string, unknown>);
}

export async function approveAuditProgram(id: string): Promise<void> {
  const { error } = await supabase
    .from('audit_programs')
    .update({ status: PROGRAM_STATUS.APPROVED, tanggal_revisi: toDateInput(new Date()) })
    .eq('id', id);
  if (error) throw new Error(`Gagal menyetujui program audit: ${error.message}`);
}

export async function deleteAuditProgram(id: string): Promise<void> {
  const { error } = await supabase
    .from('audit_programs')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Gagal menghapus program audit: ${error.message}`);
}

// ============================================================
// CREATE PROGRAM — operasi massal atomic
// 1. Insert header program
// 2. Auto-copy 7 langkah dari template ke audit_program_steps
// 3. Auto-populate distribusi dari seksi_terlibat plan
// ============================================================

export async function createProgramFromPlan(
  plan: AuditPlan,
  jenisRonde: JenisRonde,
  nomorKe: number,
  seksiList: Seksi[],
): Promise<AuditProgram> {
  // 1. Buat header program
  const program = await saveAuditProgram({
    plan_id: plan.id,
    jenis_ronde: jenisRonde,
    nomor_ke: nomorKe,
    tahun: plan.tahun,
    tanggal_dibuat: toDateInput(new Date()),
    no_revisi: 0,
    penanggung_jawab_qms: plan.penanggung_jawab_qms,
    status: PROGRAM_STATUS.DRAFT,
    periode_label: [...DEFAULT_PERIODE_LABEL],
  });

  // 2. Ambil template 7 langkah
  const templates = await getStepTemplates();
  const periodeCount = DEFAULT_PERIODE_LABEL.length;

  // 3. Copy langkah ke audit_program_steps
  if (templates.length > 0) {
    const stepsData = templates.map((t) => ({
      program_id: program.id,
      nomor: t.nomor,
      item_pelaksanaan: t.item_pelaksanaan,
      prosedur_pelaksanaan: t.prosedur_pelaksanaan,
      periode_target: new Array(periodeCount).fill(false),
      pic: t.pic,
    }));
    const { error: stepErr } = await supabase.from('audit_program_steps').insert(stepsData);
    if (stepErr) throw new Error(`Gagal menyalin langkah template: ${stepErr.message}`);
  }

  // 4. Auto-populate distribusi dari seksi_terlibat plan
  // nama_section_manager auto-terisi dari seksi.kepala_seksi (selector/computed, bukan disalin manual)
  const seksiTerlibat = seksiList.filter((s) => plan.seksi_terlibat.includes(s.id));
  if (seksiTerlibat.length > 0) {
    const distribusiData = seksiTerlibat.map((s) => ({
      program_id: program.id,
      seksi_id: s.id,
      nama_section_manager: s.kepala_seksi ?? null, // auto-fill dari seksi.kepala_seksi
    }));
    const { error: distErr } = await supabase.from('audit_program_distribusi').insert(distribusiData);
    if (distErr) throw new Error(`Gagal auto-populate distribusi: ${distErr.message}`);
  }

  return program;
}

// ============================================================
// AUDIT_PROGRAM_DISTRIBUSI
// ============================================================

export async function getDistribusiByProgram(programId: string): Promise<AuditProgramDistribusi[]> {
  const { data, error } = await supabase
    .from('audit_program_distribusi')
    .select('*')
    .eq('program_id', programId);

  if (error) throw new Error(`Gagal memuat distribusi: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapDistribusi(r));
}

// Toggle distribusi seksi: jika belum ada, buat dengan nama_section_manager auto-terisi dari seksi.kepala_seksi.
// Jika sudah ada, hapus (uncheck).
export async function toggleDistribusi(
  programId: string,
  seksiId: string,
  seksi: Seksi | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from('audit_program_distribusi')
    .select('id')
    .eq('program_id', programId)
    .eq('seksi_id', seksiId)
    .maybeSingle();

  if (existing) {
    // Uncheck — hapus
    const { error } = await supabase
      .from('audit_program_distribusi')
      .delete()
      .eq('id', existing.id);
    if (error) throw new Error(`Gagal menghapus distribusi: ${error.message}`);
  } else {
    // Check — buat dengan nama_section_manager auto-terisi dari seksi.kepala_seksi
    const { error } = await supabase
      .from('audit_program_distribusi')
      .insert({
        program_id: programId,
        seksi_id: seksiId,
        nama_section_manager: seksi?.kepala_seksi ?? null,
      });
    if (error) throw new Error(`Gagal menambah distribusi: ${error.message}`);
  }
}

export async function updateDistribusiManager(
  distribusiId: string,
  namaSectionManager: string,
): Promise<void> {
  const { error } = await supabase
    .from('audit_program_distribusi')
    .update({ nama_section_manager: namaSectionManager || null })
    .eq('id', distribusiId);
  if (error) throw new Error(`Gagal mengupdate nama manager: ${error.message}`);
}

// ============================================================
// AUDIT_PROGRAM_RISIKO
// ============================================================

export async function getRisikoByProgram(programId: string): Promise<AuditProgramRisiko[]> {
  const { data, error } = await supabase
    .from('audit_program_risiko')
    .select('*')
    .eq('program_id', programId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Gagal memuat risiko: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapRisiko(r));
}

export async function saveRisiko(risiko: Partial<AuditProgramRisiko>): Promise<AuditProgramRisiko> {
  validateRequired(
    { program_id: risiko.program_id },
    { program_id: 'Program' },
  );

  const payload = {
    program_id: risiko.program_id,
    nomor: risiko.nomor ?? null,
    risiko_peluang: risiko.risiko_peluang ?? null,
    control_action: risiko.control_action ?? null,
  };

  if (risiko.id) {
    const { data, error } = await supabase
      .from('audit_program_risiko')
      .update(payload)
      .eq('id', risiko.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate risiko: ${error.message}`);
    return mapRisiko(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('audit_program_risiko')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah risiko: ${error.message}`);
  return mapRisiko(data as Record<string, unknown>);
}

export async function deleteRisiko(id: string): Promise<void> {
  const { error } = await supabase
    .from('audit_program_risiko')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Gagal menghapus risiko: ${error.message}`);
}

// ============================================================
// AUDIT_PROGRAM_STEPS
// ============================================================

export async function getStepsByProgram(programId: string): Promise<AuditProgramStep[]> {
  const { data, error } = await supabase
    .from('audit_program_steps')
    .select('*')
    .eq('program_id', programId)
    .order('nomor', { ascending: true });

  if (error) throw new Error(`Gagal memuat langkah: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapStep(r));
}

export async function saveStep(step: Partial<AuditProgramStep>): Promise<AuditProgramStep> {
  validateRequired(
    { program_id: step.program_id },
    { program_id: 'Program' },
  );

  const payload = {
    program_id: step.program_id,
    nomor: step.nomor ?? 0,
    item_pelaksanaan: step.item_pelaksanaan ?? null,
    prosedur_pelaksanaan: step.prosedur_pelaksanaan ?? null,
    periode_target: step.periode_target ?? [],
    pic: step.pic ?? null,
  };

  if (step.id) {
    const { data, error } = await supabase
      .from('audit_program_steps')
      .update(payload)
      .eq('id', step.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate langkah: ${error.message}`);
    return mapStep(data as Record<string, unknown>);
  }

  // Ambil nomor terbesar + 1 untuk step baru
  const existing = await getStepsByProgram(step.program_id!);
  const maxNomor = existing.reduce((max, s) => Math.max(max, s.nomor), 0);
  payload.nomor = maxNomor + 1;

  const { data, error } = await supabase
    .from('audit_program_steps')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah langkah: ${error.message}`);
  return mapStep(data as Record<string, unknown>);
}

export async function deleteStep(id: string): Promise<void> {
  const { error } = await supabase
    .from('audit_program_steps')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Gagal menghapus langkah: ${error.message}`);
}

// Toggle periode_target pada index tertentu untuk step
export async function toggleStepPeriode(
  stepId: string,
  periodeIndex: number,
  currentValue: boolean[],
): Promise<void> {
  const newPeriode = [...currentValue];
  newPeriode[periodeIndex] = !newPeriode[periodeIndex];
  const { error } = await supabase
    .from('audit_program_steps')
    .update({ periode_target: newPeriode })
    .eq('id', stepId);
  if (error) throw new Error(`Gagal toggle periode: ${error.message}`);
}

// Reorder steps (drag-and-drop)
export async function reorderSteps(
  programId: string,
  orderedIds: string[],
): Promise<void> {
  const updates = orderedIds.map((id, index) => ({
    id,
    program_id: programId,
    nomor: index + 1,
  }));

  const { error } = await supabase
    .from('audit_program_steps')
    .upsert(updates, { onConflict: 'id' });
  if (error) throw new Error(`Gagal mengurutkan langkah: ${error.message}`);
}

// ============================================================
// AUDIT_PROGRAM_STEP_TEMPLATE
// ============================================================

export async function getStepTemplates(): Promise<AuditProgramStepTemplate[]> {
  const { data, error } = await supabase
    .from('audit_program_step_template')
    .select('*')
    .order('nomor', { ascending: true });

  if (error) throw new Error(`Gagal memuat template langkah: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapTemplate(r));
}

// ============================================================
// HELPER: Cari nomor ronde berikutnya untuk plan tertentu
// ============================================================

export async function getNextNomorKe(planId: string, jenisRonde: JenisRonde): Promise<number> {
  const { data, error } = await supabase
    .from('audit_programs')
    .select('nomor_ke')
    .eq('plan_id', planId)
    .eq('jenis_ronde', jenisRonde)
    .order('nomor_ke', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Gagal mencari nomor ronde: ${error.message}`);
  return data ? (data.nomor_ke as number) + 1 : 1;
}
