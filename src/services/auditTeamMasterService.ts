import { supabase } from '../lib/supabaseClient';
import type { AuditInstructionRow, Auditor, AuditTeamMaster, AuditTeamMasterMember, Seksi } from '../lib/types';
import { AUDIT_TEAM_MASTER_STATUS, AUDIT_TEAM_MEMBER_ROLE } from '../lib/enums';
import { checkIndependensi, checkKompetensi, getActiveAuditors } from './auditorService';
import { getSeksiList } from './seksiService';

function mapTeam(row: Record<string, unknown>): AuditTeamMaster {
  return { ...row, members: (row.members ?? []) as AuditTeamMasterMember[] } as unknown as AuditTeamMaster;
}
const selectTeam = '*,members:audit_team_master_members(*,auditor:auditors(*))';

export async function getAuditTeamMasters(): Promise<AuditTeamMaster[]> {
  const { data, error } = await supabase.from('audit_team_masters').select(selectTeam).order('kode_tim');
  if (error) throw new Error(`Gagal memuat Tim Audit: ${error.message}`);
  return (data ?? []).map((row) => mapTeam(row as Record<string, unknown>));
}
export async function getActiveAuditTeamMasters(): Promise<AuditTeamMaster[]> {
  return (await getAuditTeamMasters()).filter((team) => team.status === AUDIT_TEAM_MASTER_STATUS.AKTIF);
}
export async function getAuditTeamMasterById(id: string): Promise<AuditTeamMaster | null> {
  const { data, error } = await supabase.from('audit_team_masters').select(selectTeam).eq('id', id).maybeSingle();
  if (error) throw new Error(`Gagal memuat Tim Audit: ${error.message}`);
  return data ? mapTeam(data as Record<string, unknown>) : null;
}
export async function saveAuditTeamMaster(team: Partial<AuditTeamMaster>): Promise<AuditTeamMaster> {
  const members = team.members ?? [];
  if (!team.kode_tim?.trim() || !team.nama_tim?.trim()) throw new Error('Kode dan nama Tim Audit wajib diisi');
  if (team.status === AUDIT_TEAM_MASTER_STATUS.AKTIF && members.filter((m) => m.peran === AUDIT_TEAM_MEMBER_ROLE.LEAD).length !== 1) throw new Error('Tim Audit aktif harus memiliki tepat satu Lead');
  if (new Set(members.map((m) => m.auditor_id)).size !== members.length) throw new Error('Auditor dalam satu Tim Audit tidak boleh duplikat');
  const { data, error } = await supabase.rpc('save_audit_team_master', { p_id: team.id || null, p_kode_tim: team.kode_tim,
    p_nama_tim: team.nama_tim, p_status: team.status ?? AUDIT_TEAM_MASTER_STATUS.AKTIF, p_catatan: team.catatan ?? null,
    p_members: members.map((m) => ({ auditor_id: m.auditor_id, peran: m.peran, urutan_tampil: m.urutan_tampil })) });
  if (error) throw new Error(`Gagal menyimpan Tim Audit: ${error.message}`);
  const saved = await getAuditTeamMasterById(data as string); if (!saved) throw new Error('Tim Audit tersimpan tidak ditemukan'); return saved;
}
export async function deactivateAuditTeamMaster(id: string): Promise<void> {
  const { error } = await supabase.from('audit_team_masters').update({ status: AUDIT_TEAM_MASTER_STATUS.NONAKTIF }).eq('id', id);
  if (error) throw new Error(`Gagal menonaktifkan Tim Audit: ${error.message}`);
}

async function getRow(rowId: string): Promise<AuditInstructionRow> {
  const { data, error } = await supabase.from('audit_instruction_rows').select('*').eq('id', rowId).maybeSingle();
  if (error || !data) throw new Error('Baris Instruksi Audit tidak ditemukan');
  return { ...data, seksi_marks: data.seksi_marks ?? [], auditor: data.auditor ?? [] } as AuditInstructionRow;
}
export async function assignTeamToInstructionRow(rowId: string, teamMasterId: string | null, justification: string): Promise<void> {
  const row = await getRow(rowId);
  if (!teamMasterId) {
    const { error } = await supabase.rpc('assign_team_to_instruction_row', { p_row_id: rowId, p_team_id: null, p_justification: null });
    if (error) throw new Error(error.message); return;
  }
  const [team, auditors, seksiList] = await Promise.all([getAuditTeamMasterById(teamMasterId), getActiveAuditors(), getSeksiList()]);
  if (!team || team.status !== AUDIT_TEAM_MASTER_STATUS.AKTIF) throw new Error('Tim Audit aktif tidak ditemukan');
  if (team.members.filter((m) => m.peran === AUDIT_TEAM_MEMBER_ROLE.LEAD).length !== 1) throw new Error('Tim Audit harus memiliki tepat satu Lead');
  const auditorMap = new Map(auditors.map((a) => [a.id, a]));
  const selected = team.members.map((m) => m.auditor ?? auditorMap.get(m.auditor_id)).filter((a): a is Auditor => !!a);
  if (selected.length !== team.members.length) throw new Error('Ada auditor Tim Audit yang tidak ditemukan atau tidak aktif');
  const ineligible = selected.filter((a) => !checkKompetensi(a, row.tanggal_pelaksanaan_audit).isEligible);
  if (ineligible.length) throw new Error(`Auditor tidak memenuhi kompetensi pada tanggal pelaksanaan: ${ineligible.map((a) => a.nama).join(', ')}`);
  const names = row.seksi_marks.map((m) => seksiList.find((s: Seksi) => s.id === m.seksi_id)?.nama).filter((name): name is string => !!name);
  const conflicts = selected.filter((a) => checkIndependensi(a, names).hasConflict);
  if (conflicts.length && !justification.trim()) throw new Error(`Auditor memiliki potensi konflik independensi dengan seksi yang diaudit: ${conflicts.map((a) => a.nama).join(', ')}. Catatan Justifikasi wajib diisi.`);
  const { error } = await supabase.rpc('assign_team_to_instruction_row', { p_row_id: rowId, p_team_id: teamMasterId, p_justification: justification || null });
  if (error) throw new Error(error.message);
}
