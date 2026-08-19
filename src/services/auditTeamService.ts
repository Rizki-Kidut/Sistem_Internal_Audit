// Data access layer untuk Tim Audit (audit_teams).
// Satu schedule punya maksimal satu audit_teams row (unique constraint).

import { supabase } from '../lib/supabaseClient';
import type { AuditTeam } from '../lib/types';
import { getScopesBySchedule } from './auditScheduleService';
import { getSeksiAktif } from './seksiService';
import { getActiveAuditors, checkIndependensi } from './auditorService';

function mapTeam(row: Record<string, unknown>): AuditTeam {
  return {
    id: row.id as string,
    schedule_id: row.schedule_id as string,
    lead_auditor_id: (row.lead_auditor_id as string) ?? null,
    member_ids: (row.member_ids as string[]) ?? [],
    auditee_area_owner_ids: (row.auditee_area_owner_ids as string[]) ?? [],
    catatan_justifikasi: (row.catatan_justifikasi as string) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getTeamBySchedule(scheduleId: string): Promise<AuditTeam | null> {
  const { data, error } = await supabase
    .from('audit_teams')
    .select('*')
    .eq('schedule_id', scheduleId)
    .maybeSingle();

  if (error) throw new Error(`Gagal memuat tim audit: ${error.message}`);
  return data ? mapTeam(data as Record<string, unknown>) : null;
}

export async function saveTeam(team: Partial<AuditTeam>): Promise<AuditTeam> {
  const payload = {
    schedule_id: team.schedule_id,
    lead_auditor_id: team.lead_auditor_id ?? null,
    member_ids: team.member_ids ?? [],
    auditee_area_owner_ids: team.auditee_area_owner_ids ?? [],
    catatan_justifikasi: team.catatan_justifikasi ?? null,
  };

  if (team.id) {
    const { data, error } = await supabase
      .from('audit_teams')
      .update(payload)
      .eq('id', team.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate tim audit: ${error.message}`);
    return mapTeam(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from('audit_teams')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah tim audit: ${error.message}`);
  return mapTeam(data as Record<string, unknown>);
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from('audit_teams').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus tim audit: ${error.message}`);
}

// Upsert helper: if team exists for schedule, update; otherwise insert.
export async function upsertTeam(
  scheduleId: string,
  data: {
    lead_auditor_id: string | null;
    member_ids: string[];
    auditee_area_owner_ids: string[];
    catatan_justifikasi: string | null;
  },
): Promise<AuditTeam> {
  const [scopes, seksiList, auditors] = await Promise.all([
    getScopesBySchedule(scheduleId), getSeksiAktif(), getActiveAuditors(),
  ]);
  const auditedSeksiNames = scopes
    .map((scope) => seksiList.find((seksi) => seksi.id === scope.seksi_terkait)?.nama)
    .filter((nama): nama is string => Boolean(nama));
  const selectedIds = [data.lead_auditor_id, ...data.member_ids].filter(Boolean);
  const requiresJustification = selectedIds.some((id) => {
    const auditor = auditors.find((candidate) => candidate.id === id);
    return auditor ? checkIndependensi(auditor, auditedSeksiNames).hasConflict : false;
  });
  if (requiresJustification && !data.catatan_justifikasi?.trim()) {
    throw new Error('Catatan justifikasi wajib diisi karena ada potensi konflik independensi');
  }
  const existing = await getTeamBySchedule(scheduleId);
  return saveTeam({
    id: existing?.id,
    schedule_id: scheduleId,
    lead_auditor_id: data.lead_auditor_id,
    member_ids: data.member_ids,
    auditee_area_owner_ids: data.auditee_area_owner_ids,
    catatan_justifikasi: data.catatan_justifikasi,
  });
}
