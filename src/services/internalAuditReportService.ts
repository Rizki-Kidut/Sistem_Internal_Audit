import { supabase } from '../lib/supabaseClient';
import type {
  AuditAgenda, AuditAgendaItem, AuditInstruction, AuditInstructionRow, AuditTeamMaster,
  ChecklistManufakturShift, ChecklistProduk, Finding, InternalAuditReport,
  InternalAuditReportAttendee, InternalAuditReportContext, InternalAuditReportFindingCounts,
  InternalAuditReportFindingSummaryGroup, InternalAuditReportFollowUpItem,
  InternalAuditReportWorklistRow, Proses, SaveInternalAuditReportDraftPayload, Seksi,
} from '../lib/types';
import { KODE_DOKUMEN_LAPORAN_INTERNAL_AUDIT } from '../lib/enums';

function report(row:Record<string,unknown>):InternalAuditReport {
  return {
    ...row,
    auditee_hadir:(row.auditee_hadir??[]) as InternalAuditReportAttendee[],
    follow_up_items:(row.follow_up_items??[]) as InternalAuditReportFollowUpItem[],
    kode_dokumen:(row.kode_dokumen as string)||KODE_DOKUMEN_LAPORAN_INTERNAL_AUDIT,
  } as InternalAuditReport;
}

function eligibilityReason(hasAgenda:boolean,hasChecklist:boolean):string|null {
  if(hasAgenda&&hasChecklist)return null;
  if(!hasAgenda&&!hasChecklist)return 'Agenda dan Checklist belum tersedia.';
  return hasAgenda?'Checklist belum tersedia.':'Agenda belum dibuat.';
}

function formatAuditTimeRange(items:AuditAgendaItem[]):string {
  if(!items.length)return '-';
  const sorted=[...items].sort((a,b)=>`${a.tanggal}T${a.jam_mulai}`.localeCompare(`${b.tanggal}T${b.jam_mulai}`));
  const first=sorted[0];
  const endSorted=[...items].sort((a,b)=>`${a.tanggal}T${a.jam_selesai}`.localeCompare(`${b.tanggal}T${b.jam_selesai}`));
  const last=endSorted[endSorted.length-1];
  const date=(value:string)=>new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`));
  const time=(value:string)=>value.slice(0,5).replace('.',':');
  return first.tanggal===last.tanggal
    ? `${date(first.tanggal)}, ${time(first.jam_mulai)}–${time(last.jam_selesai)}`
    : `${date(first.tanggal)} ${time(first.jam_mulai)} – ${date(last.tanggal)} ${time(last.jam_selesai)}`;
}

export function uniqueFindingReferences(findings:Pick<Finding,'reference'>[]):string[] {
  return [...new Set(findings.map(value=>value.reference?.trim()).filter((value):value is string=>!!value))]
    .sort((left,right)=>left.localeCompare(right,'id-ID',{numeric:true}));
}

export function groupInternalAuditReportFindings(findings:Finding[]):InternalAuditReportFindingSummaryGroup[] {
  const groups=new Map<string,InternalAuditReportFindingSummaryGroup>();
  for(const finding of [...findings].sort((a,b)=>a.nomor_urut_temuan-b.nomor_urut_temuan||a.id.localeCompare(b.id))){
    const reference=finding.reference?.trim()||null;
    const location=finding.location?.trim()||null;
    const key=JSON.stringify([reference,location]);
    const current=groups.get(key)??{reference,location,finding_numbers:[],requirement:finding.problem?.trim()||null,counts:{A:0,B:0,C:0}};
    current.finding_numbers.push(finding.nomor_urut_temuan);
    current.counts[finding.kategori]+=1;
    groups.set(key,current);
  }
  return [...groups.values()];
}

export function generateHasilPengamatanDraft(input:{
  proses:string|null; counts:InternalAuditReportFindingCounts; nama_customer?:string|null; nama_produk?:string|null;
}):string {
  const process=input.proses?.trim()||'yang ditetapkan';
  const subject=[input.nama_produk?.trim()&&`produk ${input.nama_produk.trim()}`,input.nama_customer?.trim()&&`customer ${input.nama_customer.trim()}`].filter(Boolean).join(' untuk ');
  const context=subject?` dengan konteks ${subject}`:'';
  if(input.counts.A===0&&input.counts.B===0&&input.counts.C===0){
    return `Telah dilakukan audit pada proses ${process}${context}. Berdasarkan hasil audit, tidak ditemukan ketidaksesuaian maupun Peluang Improvement.`;
  }
  return `Telah dilakukan audit pada proses ${process}${context}. Berdasarkan hasil audit, ditemukan ${input.counts.A} ketidaksesuaian Major, ${input.counts.B} ketidaksesuaian Minor, dan ${input.counts.C} Peluang Improvement.`;
}

export function generateEvaluasiDraft(input:{counts:InternalAuditReportFindingCounts;references:string[]}):string {
  if(input.counts.A===0&&input.counts.B===0&&input.counts.C===0){
    return 'Berdasarkan hasil audit, proses yang diaudit telah memenuhi persyaratan yang diperiksa. Pertahankan penerapan dan pemantauan yang sudah berjalan.';
  }
  if(!input.references.length)return 'Berdasarkan hasil audit, terdapat temuan yang perlu ditindaklanjuti sesuai hasil audit.';
  return `Berdasarkan hasil audit, temuan terkait dengan persyaratan: ${input.references.join(', ')}. Mohon dilakukan tindak lanjut sesuai hasil audit.`;
}

function friendlyError(message:string):Error {
  if(message.includes('duplicate key')||message.includes('instruction_row_key'))return new Error('Laporan Internal Audit untuk No. Audit ini sudah ada.');
  return new Error(message);
}

async function loadContexts():Promise<InternalAuditReportContext[]> {
  const [rowsResult,instructionsResult,prosesResult,seksiResult,teamsResult,agendasResult,agendaItemsResult,
    systemResult,productResult,manufacturingResult,findingsResult,reportsResult]=await Promise.all([
    supabase.from('audit_instruction_rows').select('*').order('kode_audit'),
    supabase.from('audit_instructions').select('*'),
    supabase.from('proses').select('*'),
    supabase.from('seksi').select('*'),
    supabase.from('audit_team_masters').select('*,members:audit_team_master_members(*,auditor:auditors(*))'),
    supabase.from('audit_agendas').select('*'),
    supabase.from('audit_agenda_items').select('*').order('tanggal').order('jam_mulai').order('urutan'),
    supabase.from('checklists').select('id,row_id'),
    supabase.from('checklist_produk').select('id,row_id,part_name'),
    supabase.from('checklist_manufaktur_shift').select('id,row_id,customer,nama_part,nomor_line'),
    supabase.from('findings').select('*').order('nomor_urut_temuan'),
    supabase.from('audit_internal_reports').select('*'),
  ]);
  const failure=[rowsResult,instructionsResult,prosesResult,seksiResult,teamsResult,agendasResult,agendaItemsResult,
    systemResult,productResult,manufacturingResult,findingsResult,reportsResult].find(result=>result.error);
  if(failure?.error)throw new Error(`Gagal memuat workspace Laporan Internal Audit: ${failure.error.message}`);

  const instructions=(instructionsResult.data??[]) as AuditInstruction[];
  const processes=(prosesResult.data??[]) as Proses[];
  const sections=(seksiResult.data??[]) as Seksi[];
  const teams=(teamsResult.data??[]) as unknown as AuditTeamMaster[];
  const agendas=(agendasResult.data??[]) as AuditAgenda[];
  const agendaItems=(agendaItemsResult.data??[]) as AuditAgendaItem[];
  const product=(productResult.data??[]) as Pick<ChecklistProduk,'id'|'row_id'|'part_name'>[];
  const manufacturing=(manufacturingResult.data??[]) as Pick<ChecklistManufakturShift,'id'|'row_id'|'customer'|'nama_part'|'nomor_line'>[];
  const findings=(findingsResult.data??[]) as Finding[];
  const reports=(reportsResult.data??[]).map(value=>report(value as Record<string,unknown>));
  const system=(systemResult.data??[]) as {id:string;row_id:string}[];

  return ((rowsResult.data??[]) as AuditInstructionRow[]).flatMap(row=>{
    const instruction=instructions.find(value=>value.id===row.instruction_id);
    if(!instruction)return [];
    const agenda=agendas.find(value=>value.instruction_row_id===row.id)??null;
    const checklist_presence={
      sistem:system.some(value=>value.row_id===row.id),
      produk:product.some(value=>value.row_id===row.id),
      manufaktur_shift:manufacturing.some(value=>value.row_id===row.id),
    };
    const reportValue=reports.find(value=>value.instruction_row_id===row.id)??null;
    const team=teams.find(value=>value.id===row.team_master_id)??null;
    const leaderMember=team?.members.find(value=>value.is_team_leader)??null;
    const memberRows=team?.members.filter(value=>!value.is_team_leader&&value.peran==='Member')??[];
    const team_members=memberRows.map(value=>value.auditor).filter((value):value is NonNullable<typeof value>=>!!value);
    const selected_sub_leader=team_members.find(value=>value.id===reportValue?.sub_leader_auditor_id)??null;
    const rowFindings=findings.filter(value=>value.instruction_row_id===row.id);
    const finding_counts=rowFindings.reduce<InternalAuditReportFindingCounts>((counts,finding)=>({...counts,[finding.kategori]:counts[finding.kategori]+1}),{A:0,B:0,C:0});
    const targetIds=(row.seksi_marks??[]).filter(mark=>mark.tipe==='target').map(mark=>mark.seksi_id);
    const hasChecklist=Object.values(checklist_presence).some(Boolean);
    return [{
      row,instruction,proses:processes.find(value=>value.id===row.proses_id)??null,
      sections:targetIds.map(id=>sections.find(value=>value.id===id)).filter((value):value is Seksi=>!!value),
      agenda,agenda_items:agendaItems.filter(value=>value.agenda_id===agenda?.id),team,
      team_leader:leaderMember?.auditor??null,team_members,selected_sub_leader,
      remaining_members:team_members.filter(value=>value.id!==reportValue?.sub_leader_auditor_id),
      checklist_presence,findings:rowFindings,finding_counts,finding_references:uniqueFindingReferences(rowFindings),
      finding_summary_groups:groupInternalAuditReportFindings(rowFindings),report:reportValue,
      eligible:!!agenda&&hasChecklist,eligibility_reason:eligibilityReason(!!agenda,hasChecklist),
      audit_time_range:formatAuditTimeRange(agendaItems.filter(value=>value.agenda_id===agenda?.id)),
    }];
  });
}

export async function listInternalAuditReportWorklist():Promise<InternalAuditReportWorklistRow[]> {
  return loadContexts();
}

export async function getInternalAuditReportContext(instructionRowId:string):Promise<InternalAuditReportContext> {
  const context=(await loadContexts()).find(value=>value.row.id===instructionRowId);
  if(!context)throw new Error('Baris Instruksi Audit tidak ditemukan atau tidak dapat diakses.');
  return context;
}

export async function createInternalAuditReport(instructionRowId:string):Promise<InternalAuditReport> {
  const {data,error}=await supabase.rpc('create_internal_audit_report',{p_instruction_row_id:instructionRowId});
  if(error)throw friendlyError(error.message);
  return report(data as Record<string,unknown>);
}

export async function saveInternalAuditReportDraft(payload:SaveInternalAuditReportDraftPayload):Promise<InternalAuditReport> {
  const {data,error}=await supabase.rpc('save_internal_audit_report_draft',{
    p_report_id:payload.report_id,p_expected_revision:payload.expected_revision,p_tanggal_terbit:payload.tanggal_terbit,
    p_auditee_hadir:payload.auditee_hadir,p_nama_customer:payload.nama_customer,p_nama_produk:payload.nama_produk,
    p_nama_line:payload.nama_line,p_sub_leader_auditor_id:payload.sub_leader_auditor_id,
    p_hasil_pengamatan:payload.hasil_pengamatan,p_evaluasi:payload.evaluasi,
    p_follow_up_required:payload.follow_up_required,p_follow_up_items:payload.follow_up_items,p_catatan:payload.catatan,
  });
  if(error)throw friendlyError(error.message);
  return report(data as Record<string,unknown>);
}
