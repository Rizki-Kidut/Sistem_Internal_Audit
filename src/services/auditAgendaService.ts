import { supabase } from '../lib/supabaseClient';
import type { AgendaAssistantAuditor, AgendaWorklistRow, AuditAgenda, AuditAgendaContext, AuditAgendaItem, AuditInstruction, AuditInstructionRow, AuditTeamMaster, Proses, Seksi } from '../lib/types';
import { KODE_DOKUMEN_AGENDA_INTERNAL_AUDIT } from '../lib/enums';

function agenda(row: Record<string, unknown>): AuditAgenda {
  return { ...row, asisten_auditor_pendamping: (row.asisten_auditor_pendamping ?? []) as AgendaAssistantAuditor[], kode_dokumen: (row.kode_dokumen as string) || KODE_DOKUMEN_AGENDA_INTERNAL_AUDIT } as AuditAgenda;
}
function item(row: Record<string, unknown>): AuditAgendaItem { return row as unknown as AuditAgendaItem; }
async function allContexts(): Promise<AuditAgendaContext[]> {
  const [rowsResult, instructionsResult, prosesResult, seksiResult, teamsResult, agendasResult] = await Promise.all([
    supabase.from('audit_instruction_rows').select('*').order('kode_audit'),
    supabase.from('audit_instructions').select('*'), supabase.from('proses').select('*'), supabase.from('seksi').select('*'),
    supabase.from('audit_team_masters').select('*,members:audit_team_master_members(*,auditor:auditors(*))'),
    supabase.from('audit_agendas').select('*'),
  ]);
  const failure = [rowsResult, instructionsResult, prosesResult, seksiResult, teamsResult, agendasResult].find((result) => result.error);
  if (failure?.error) throw new Error(`Gagal memuat workspace Agenda: ${failure.error.message}`);
  const instructions = (instructionsResult.data ?? []) as AuditInstruction[];
  const proses = (prosesResult.data ?? []) as Proses[];
  const sections = (seksiResult.data ?? []) as Seksi[];
  const teams = (teamsResult.data ?? []) as unknown as AuditTeamMaster[];
  const agendas = (agendasResult.data ?? []).map((value) => agenda(value as Record<string, unknown>));
  return ((rowsResult.data ?? []) as AuditInstructionRow[]).map((row) => {
    const targetIds = (row.seksi_marks ?? []).filter((mark) => mark.tipe === 'target').map((mark) => mark.seksi_id);
    const selectedSections = targetIds.map((id) => sections.find((section) => section.id === id)).filter((value): value is Seksi => !!value);
    const team = teams.find((value) => value.id === row.team_master_id) ?? null;
    const leadMember = team?.members.find((member) => member.peran === 'Lead');
    return { row, instruction: instructions.find((value) => value.id === row.instruction_id)!, proses: proses.find((value) => value.id === row.proses_id) ?? null,
      seksi: selectedSections, managers: selectedSections.map((value) => value.kepala_seksi).filter((value): value is string => !!value), team,
      lead: leadMember?.auditor ?? null, members: team?.members.filter((member) => member.peran === 'Member').map((member) => member.auditor).filter((value): value is NonNullable<typeof value> => !!value) ?? [],
      agenda: agendas.find((value) => value.instruction_row_id === row.id) ?? null };
  }).filter((context) => !!context.instruction);
}
export async function listAgendaWorklist(): Promise<AgendaWorklistRow[]> { return (await allContexts()).map((context) => ({ ...context, status_agenda: context.agenda?.status ?? 'Belum Dibuat' })); }
export async function getAgendaContext(rowId: string): Promise<AuditAgendaContext> { const found=(await allContexts()).find((value)=>value.row.id===rowId); if(!found)throw new Error('Baris Instruksi Audit tidak ditemukan'); return found; }
export async function getAgendaForRow(rowId:string):Promise<AuditAgenda|null>{const {data,error}=await supabase.from('audit_agendas').select('*').eq('instruction_row_id',rowId).maybeSingle();if(error)throw new Error(error.message);return data?agenda(data as Record<string,unknown>):null;}
export async function createAgendaFromRow(rowId:string):Promise<AuditAgenda>{const {data,error}=await supabase.rpc('create_audit_agenda_from_row',{p_row_id:rowId});if(error)throw new Error(error.message);return agenda(data as Record<string,unknown>);}
export async function listAgendaItems(id:string):Promise<AuditAgendaItem[]>{const {data,error}=await supabase.from('audit_agenda_items').select('*').eq('agenda_id',id).order('urutan');if(error)throw new Error(error.message);return(data??[]).map((v)=>item(v as Record<string,unknown>));}
export interface AgendaDraftTimelinePayload { tanggal:string;jam_mulai:string;jam_selesai:string;detail_audit_proses_persyaratan:string;lokasi:string|null; }
export async function saveAgendaDraftBundle(value:AuditAgenda,items:AgendaDraftTimelinePayload[]):Promise<{agenda:AuditAgenda;items:AuditAgendaItem[]}>{const {data,error}=await supabase.rpc('save_audit_agenda_draft',{p_agenda_id:value.id,p_tanggal_terbit:value.tanggal_terbit,p_tujuan_lingkup_audit:value.tujuan_lingkup_audit,p_item_lain_yang_dicek:value.item_lain_yang_dicek,p_dokumen_dikirim_di_awal:value.dokumen_dikirim_di_awal,p_dokumen_dipersiapkan_hari_audit:value.dokumen_dipersiapkan_hari_audit,p_asisten_auditor_pendamping:value.asisten_auditor_pendamping,p_catatan_khusus:value.catatan_khusus,p_items:items});if(error)throw new Error(error.message);const result=data as {agenda:Record<string,unknown>;items:Record<string,unknown>[]};return{agenda:agenda(result.agenda),items:(result.items??[]).map(item)};}
export async function finalizeAgenda(id:string):Promise<AuditAgenda>{const {data,error}=await supabase.rpc('finalize_audit_agenda',{p_agenda_id:id});if(error)throw new Error(error.message);return agenda(data as Record<string,unknown>);}
export async function returnAgendaToDraft(id:string):Promise<AuditAgenda>{const {data,error}=await supabase.rpc('return_audit_agenda_to_draft',{p_agenda_id:id});if(error)throw new Error(error.message);return agenda(data as Record<string,unknown>);}
