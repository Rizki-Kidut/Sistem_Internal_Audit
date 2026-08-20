import { supabase } from '../lib/supabaseClient';
import type { AuditInstruction, AuditInstructionRow, Auditor, AuditTeamMaster, AuditTeamMasterMember, Seksi } from '../lib/types';
import { AUDIT_TEAM_MASTER_STATUS, AUDIT_TEAM_MEMBER_ROLE } from '../lib/enums';
import { checkIndependensi, checkKompetensi, getActiveAuditors } from './auditorService';
import { getSeksiList } from './seksiService';

function mapTeam(row: Record<string, unknown>): AuditTeamMaster {
  return { ...row, plan_id: (row.plan_id as string) ?? null, is_locked: row.is_locked ?? false, locked_at: row.locked_at ?? null, members: (row.members ?? []) as AuditTeamMasterMember[] } as unknown as AuditTeamMaster;
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
export async function getAuditTeamMastersByPlan(planId:string):Promise<AuditTeamMaster[]>{return (await getAuditTeamMasters()).filter(t=>t.plan_id===planId);}
export async function getLockedAuditTeamMastersByPlan(planId:string):Promise<AuditTeamMaster[]>{return (await getAuditTeamMastersByPlan(planId)).filter(t=>t.status===AUDIT_TEAM_MASTER_STATUS.AKTIF&&t.is_locked);}
export async function resolveInstructionPlanId(instruction:AuditInstruction):Promise<string>{
  if(instruction.program_id){const {data,error}=await supabase.from('audit_programs').select('plan_id').eq('id',instruction.program_id).maybeSingle();if(error||!data?.plan_id)throw new Error('Rencana Tahunan sumber Instruksi tidak ditemukan');return data.plan_id as string;}
  const {data,error}=await supabase.from('audit_plans').select('id').eq('tahun',instruction.tahun_fiskal);if(error||!data||data.length!==1)throw new Error('Rencana Tahunan Instruksi tidak dapat ditentukan secara unik');return data[0].id as string;
}
export async function getAuditTeamMasterById(id: string): Promise<AuditTeamMaster | null> {
  const { data, error } = await supabase.from('audit_team_masters').select(selectTeam).eq('id', id).maybeSingle();
  if (error) throw new Error(`Gagal memuat Tim Audit: ${error.message}`);
  return data ? mapTeam(data as Record<string, unknown>) : null;
}
export async function saveAuditTeamMaster(team: Partial<AuditTeamMaster>): Promise<AuditTeamMaster> {
  const members = team.members ?? [];
  if (!team.plan_id) throw new Error('Rencana Audit Tahunan wajib dipilih');
  if (team.id && team.is_locked) throw new Error('Tim Audit terkunci. Buka kunci sebelum mengedit.');
  if (!team.kode_tim?.trim() || !team.nama_tim?.trim()) throw new Error('Kode dan nama Tim Audit wajib diisi');
  if (team.status === AUDIT_TEAM_MASTER_STATUS.AKTIF && members.filter((m) => m.peran === AUDIT_TEAM_MEMBER_ROLE.LEAD).length !== 1) throw new Error('Tim Audit aktif harus memiliki tepat satu Lead');
  if (new Set(members.map((m) => m.auditor_id)).size !== members.length) throw new Error('Auditor dalam satu Tim Audit tidak boleh duplikat');
  const { data, error } = await supabase.rpc('save_audit_team_master', { p_id: team.id || null, p_plan_id:team.plan_id,p_kode_tim: team.kode_tim,
    p_nama_tim: team.nama_tim, p_status: team.status ?? AUDIT_TEAM_MASTER_STATUS.AKTIF, p_catatan: team.catatan ?? null,
    p_members: members.map((m) => ({ auditor_id: m.auditor_id, peran: m.peran, urutan_tampil: m.urutan_tampil })) });
  if (error) throw new Error(`Gagal menyimpan Tim Audit: ${error.message}`);
  const saved = await getAuditTeamMasterById(data as string); if (!saved) throw new Error('Tim Audit tersimpan tidak ditemukan'); return saved;
}
export async function lockAuditTeamMaster(id:string):Promise<void>{const {error}=await supabase.rpc('lock_audit_team_master',{p_team_id:id});if(error)throw new Error(error.message);}
export async function unlockAuditTeamMaster(id:string):Promise<void>{const {error}=await supabase.rpc('unlock_audit_team_master',{p_team_id:id});if(error)throw new Error(error.message);}
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
  if (!team || team.status !== AUDIT_TEAM_MASTER_STATUS.AKTIF || !team.is_locked || !team.plan_id) throw new Error('Tim Audit aktif dan terkunci tidak ditemukan');
  if (team.members.filter((m) => m.peran === AUDIT_TEAM_MEMBER_ROLE.LEAD).length !== 1) throw new Error('Tim Audit harus memiliki tepat satu Lead');
  const auditorMap = new Map(auditors.map((a) => [a.id, a]));
  const inactiveMembers = team.members.filter((member) => !auditorMap.has(member.auditor_id));
  if (inactiveMembers.length) {
    const names = inactiveMembers.map((member) => member.auditor?.nama ?? member.auditor_id);
    throw new Error(`Tim Audit memiliki auditor yang sudah tidak aktif: ${names.join(', ')}`);
  }
  const selected = team.members.map((member) => auditorMap.get(member.auditor_id)).filter((auditor): auditor is Auditor => !!auditor);
  const ineligible = selected.filter((a) => !checkKompetensi(a, row.tanggal_pelaksanaan_audit).isEligible);
  if (ineligible.length) throw new Error(`Auditor tidak memenuhi kompetensi pada tanggal pelaksanaan: ${ineligible.map((a) => a.nama).join(', ')}`);
  const names = row.seksi_marks.map((m) => seksiList.find((s: Seksi) => s.id === m.seksi_id)?.nama).filter((name): name is string => !!name);
  const conflicts = selected.filter((a) => checkIndependensi(a, names).hasConflict);
  if (conflicts.length && !justification.trim()) throw new Error(`Auditor memiliki potensi konflik independensi dengan seksi yang diaudit: ${conflicts.map((a) => a.nama).join(', ')}. Catatan Justifikasi wajib diisi.`);
  const { error } = await supabase.rpc('assign_team_to_instruction_row', { p_row_id: rowId, p_team_id: teamMasterId, p_justification: justification || null });
  if (error) throw new Error(error.message);
}
