import { supabase } from '../lib/supabaseClient';
import type { AgendaAssistantAuditor, AgendaWorklistRow, AuditAgenda, AuditAgendaContext, AuditAgendaItem, AuditInstruction, AuditInstructionRow, AuditTeamMaster, Proses, Seksi } from '../lib/types';
import { AUDIT_AGENDA_STATUS, KODE_DOKUMEN_AGENDA_INTERNAL_AUDIT } from '../lib/enums';

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
export async function saveDraftAgenda(value:AuditAgenda):Promise<AuditAgenda>{if(value.status!==AUDIT_AGENDA_STATUS.DRAFT)throw new Error('Agenda Final tidak dapat diubah');const {data,error}=await supabase.from('audit_agendas').update({tanggal_terbit:value.tanggal_terbit,tujuan_lingkup_audit:value.tujuan_lingkup_audit,item_lain_yang_dicek:value.item_lain_yang_dicek,dokumen_dikirim_di_awal:value.dokumen_dikirim_di_awal,dokumen_dipersiapkan_hari_audit:value.dokumen_dipersiapkan_hari_audit,asisten_auditor_pendamping:value.asisten_auditor_pendamping,catatan_khusus:value.catatan_khusus}).eq('id',value.id).select().single();if(error)throw new Error(error.message);return agenda(data as Record<string,unknown>);}
export async function listAgendaItems(id:string):Promise<AuditAgendaItem[]>{const {data,error}=await supabase.from('audit_agenda_items').select('*').eq('agenda_id',id).order('urutan');if(error)throw new Error(error.message);return(data??[]).map((v)=>item(v as Record<string,unknown>));}
export async function saveAgendaItem(value:Partial<AuditAgendaItem>):Promise<AuditAgendaItem>{if(!value.agenda_id||!value.tanggal||!value.jam_mulai||!value.jam_selesai||!value.detail_audit_proses_persyaratan?.trim())throw new Error('Tanggal, waktu, dan Detail Audit wajib diisi');if(value.jam_selesai<=value.jam_mulai)throw new Error('Jam Selesai harus lebih akhir dari Jam Mulai');const payload={agenda_id:value.agenda_id,tanggal:value.tanggal,jam_mulai:value.jam_mulai,jam_selesai:value.jam_selesai,detail_audit_proses_persyaratan:value.detail_audit_proses_persyaratan.trim(),lokasi:value.lokasi?.trim()||null,urutan:value.urutan};const query=value.id?supabase.from('audit_agenda_items').update(payload).eq('id',value.id):supabase.from('audit_agenda_items').insert(payload);const {data,error}=await query.select().single();if(error)throw new Error(error.message);return item(data as Record<string,unknown>);}
export async function deleteAgendaItem(id:string):Promise<void>{const {error}=await supabase.from('audit_agenda_items').delete().eq('id',id);if(error)throw new Error(error.message);}
export async function reorderAgendaItems(agendaId:string,ids:string[]):Promise<void>{const {error}=await supabase.rpc('reorder_audit_agenda_items',{p_agenda_id:agendaId,p_item_ids:ids});if(error)throw new Error(error.message);}
export async function finalizeAgenda(id:string):Promise<AuditAgenda>{const {data,error}=await supabase.rpc('finalize_audit_agenda',{p_agenda_id:id});if(error)throw new Error(error.message);return agenda(data as Record<string,unknown>);}
export async function returnAgendaToDraft(id:string):Promise<AuditAgenda>{const {data,error}=await supabase.rpc('return_audit_agenda_to_draft',{p_agenda_id:id});if(error)throw new Error(error.message);return agenda(data as Record<string,unknown>);}
