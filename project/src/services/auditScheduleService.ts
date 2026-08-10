// Data access layer untuk Jadwal Audit (Batch 3a).
// Mencakup header schedule + ruang lingkup (audit_scopes).
// Komponen UI TIDAK BOLEH langsung memanggil supabase — lewat sini.

import { supabase } from '../lib/supabaseClient';
import type { AuditSchedule, AuditScope, Seksi, Proses } from '../lib/types';
import { AUDIT_SCHEDULE_STATUS, JENIS_AUDIT } from '../lib/enums';
import type { JenisAudit, AuditScheduleStatus, StandarAudit } from '../lib/enums';
import { generateKodeAuditSchedule } from '../lib/codeGenerator';
import { validateRequired } from '../lib/utils';

// Row mappers: snake_case DB → camelCase interface
function mapSchedule(row: Record<string, unknown>): AuditSchedule {
  return {
    id: row.id as string,
    kode_audit: row.kode_audit as string,
    plan_id: (row.plan_id as string) ?? null,
    program_id: (row.program_id as string) ?? null,
    tanggal_mulai: (row.tanggal_mulai as string) ?? null,
    tanggal_selesai: (row.tanggal_selesai as string) ?? null,
    jenis_audit: (row.jenis_audit as JenisAudit) ?? JENIS_AUDIT.INTERNAL,
    standar: (row.standar as StandarAudit[]) ?? [],
    status: (row.status as AuditScheduleStatus) ?? AUDIT_SCHEDULE_STATUS.DRAFT,
    approved_by: (row.approved_by as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function mapScope(row: Record<string, unknown>): AuditScope {
  return {
    id: row.id as string,
    schedule_id: row.schedule_id as string,
    kode_audit: (row.kode_audit as string) ?? null,
    area: row.area as string,
    seksi_terkait: (row.seksi_terkait as string) ?? null,
    proses_terkait: (row.proses_terkait as string[]) ?? [],
    klausul_standar: (row.klausul_standar as string[]) ?? [],
    dokumen_referensi: (row.dokumen_referensi as string[]) ?? [],
    pic_area: (row.pic_area as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// ============================================================
// AUDIT_SCHEDULES (header CRUD)
// ============================================================

export async function getAuditSchedules(): Promise<AuditSchedule[]> {
  const { data, error } = await supabase
    .from('audit_schedules')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Gagal memuat jadwal audit: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapSchedule(r));
}

export async function getAuditScheduleById(id: string): Promise<AuditSchedule | null> {
  const { data, error } = await supabase
    .from('audit_schedules')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat jadwal audit: ${error.message}`);
  return data ? mapSchedule(data as Record<string, unknown>) : null;
}

export async function saveAuditSchedule(schedule: Partial<AuditSchedule>): Promise<AuditSchedule> {
  validateRequired(
    { kode_audit: schedule.kode_audit },
    { kode_audit: 'Kode Audit' },
  );

  const payload = {
    kode_audit: schedule.kode_audit,
    plan_id: schedule.plan_id ?? null,
    program_id: schedule.program_id ?? null,
    tanggal_mulai: schedule.tanggal_mulai ?? null,
    tanggal_selesai: schedule.tanggal_selesai ?? null,
    jenis_audit: schedule.jenis_audit ?? JENIS_AUDIT.INTERNAL,
    standar: schedule.standar ?? [],
    status: schedule.status ?? AUDIT_SCHEDULE_STATUS.DRAFT,
    approved_by: schedule.approved_by ?? null,
  };

  if (schedule.id) {
    const { data, error } = await supabase
      .from('audit_schedules')
      .update(payload)
      .eq('id', schedule.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate jadwal audit: ${error.message}`);
    return mapSchedule(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('audit_schedules')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah jadwal audit: ${error.message}`);
  return mapSchedule(data as Record<string, unknown>);
}

export async function deleteAuditSchedule(id: string): Promise<void> {
  const { error } = await supabase.from('audit_schedules').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus jadwal audit: ${error.message}`);
}

// ============================================================
// AUDIT_SCOPES (ruang lingkup per area)
// ============================================================

export async function getScopesBySchedule(scheduleId: string): Promise<AuditScope[]> {
  const { data, error } = await supabase
    .from('audit_scopes')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Gagal memuat ruang lingkup: ${error.message}`);
  return (data ?? []).map((r: Record<string, unknown>) => mapScope(r));
}

export async function saveScope(scope: Partial<AuditScope>): Promise<AuditScope> {
  validateRequired(
    { schedule_id: scope.schedule_id, area: scope.area },
    { schedule_id: 'Schedule', area: 'Area' },
  );

  const payload = {
    schedule_id: scope.schedule_id,
    kode_audit: scope.kode_audit ?? null,
    area: scope.area,
    seksi_terkait: scope.seksi_terkait ?? null,
    proses_terkait: scope.proses_terkait ?? [],
    klausul_standar: scope.klausul_standar ?? [],
    dokumen_referensi: scope.dokumen_referensi ?? [],
    pic_area: scope.pic_area ?? null,
  };

  if (scope.id) {
    const { data, error } = await supabase
      .from('audit_scopes')
      .update(payload)
      .eq('id', scope.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate ruang lingkup: ${error.message}`);
    return mapScope(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('audit_scopes')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah ruang lingkup: ${error.message}`);
  return mapScope(data as Record<string, unknown>);
}

export async function deleteScope(id: string): Promise<void> {
  const { error } = await supabase.from('audit_scopes').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus ruang lingkup: ${error.message}`);
}

// ============================================================
// CREATE SCHEDULE WITH SCOPES — operasi massal atomic
// 1. Generate kodeAudit (IA-{tahun}-{NNN})
// 2. Insert header schedule
// 3. Insert semua scope (area) sekaligus
// Jika gagal di tengah jalan, header tetap tersimpan tapi scope mungkin kosong —
// caller dapat retry insert scope. Kode sudah generated jadi tidak duplikat.
// ============================================================

export interface ScopeInput {
  area: string;
  seksi_terkait: string | null;
  proses_terkait: string[];
  klausul_standar: string[];
  dokumen_referensi: string[];
  pic_area: string | null;
}

export async function createScheduleWithScopes(
  tahun: number,
  data: {
    plan_id?: string | null;
    program_id?: string | null;
    tanggal_mulai?: string | null;
    tanggal_selesai?: string | null;
    jenis_audit?: JenisAudit;
    standar?: StandarAudit[];
    scopes: ScopeInput[];
  },
): Promise<AuditSchedule> {
  // 1. Generate kode audit unik untuk tahun ini
  const kodeAudit = await generateKodeAuditSchedule(tahun);

  // 2. Insert header schedule
  const schedule = await saveAuditSchedule({
    kode_audit: kodeAudit,
    plan_id: data.plan_id ?? null,
    program_id: data.program_id ?? null,
    tanggal_mulai: data.tanggal_mulai ?? null,
    tanggal_selesai: data.tanggal_selesai ?? null,
    jenis_audit: data.jenis_audit ?? JENIS_AUDIT.INTERNAL,
    standar: data.standar ?? [],
    status: AUDIT_SCHEDULE_STATUS.DRAFT,
  });

  // 3. Insert semua scope sekaligus (atomic batch insert)
  if (data.scopes.length > 0) {
    const scopePayload = data.scopes.map((s) => ({
      schedule_id: schedule.id,
      area: s.area,
      seksi_terkait: s.seksi_terkait,
      proses_terkait: s.proses_terkait,
      klausul_standar: s.klausul_standar,
      dokumen_referensi: s.dokumen_referensi,
      pic_area: s.pic_area,
    }));

    const { error: scopeErr } = await supabase.from('audit_scopes').insert(scopePayload);
    if (scopeErr) throw new Error(`Gagal menambah ruang lingkup: ${scopeErr.message}`);
  }

  return schedule;
}

// ============================================================
// VALIDATION: status Scheduled wajib punya minimal 1 area dengan seksi
// ============================================================

export function validateScheduledScopes(scopes: ScopeInput[]): string | null {
  const withSeksi = scopes.filter((s) => s.seksi_terkait);
  if (withSeksi.length === 0) {
    return 'Status "Scheduled" wajib minimal 1 area dengan Seksi Terkait terisi';
  }
  return null;
}

// ============================================================
// HELPER: Default PIC area dari seksi.kepala_seksi (selector/computed)
// ============================================================

export function getDefaultPicArea(seksi: Seksi | undefined | null): string | null {
  return seksi?.kepala_seksi ?? null;
}

// ============================================================
// HELPER: Resolve nama proses dari array id (selector/computed)
// ============================================================

export function resolveProsesNames(
  prosesIds: string[],
  prosesList: Proses[],
): string[] {
  const map = new Map(prosesList.map((p) => [p.id, p.nama_proses]));
  return prosesIds.map((id) => map.get(id) ?? id).filter(Boolean);
}
