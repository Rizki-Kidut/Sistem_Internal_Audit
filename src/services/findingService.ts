import { supabase } from '../lib/supabaseClient';
import type { Auditor, ClauseKeywordMap, Finding, FindingCapabilities, FindingContext, FindingNotification, FindingReviewEvent, FindingSourceDisposition } from '../lib/types';
import { FINDING_SOURCE_TYPE, KLASIFIKASI_DIS } from '../lib/enums';
import { getAuditTeamMasterById } from './auditTeamMasterService';

export interface ChecklistFindingReviewHistory {
  finding_id:string; finding_ref:string; source_type:string;
  initial_judgement:string; effective_judgement:string; reason:string;
  actor_display_name:string; created_at:string;
}

const mapFinding = (row: Record<string, unknown>) => row as unknown as Finding;
export async function listFindings(): Promise<Finding[]> {
  const { data,error }=await supabase.from('findings').select('*,auditor_penemu:auditors(*)').order('created_at',{ascending:false});
  if(error) throw new Error(`Gagal memuat Temuan: ${error.message}`); return (data??[]).map(r=>mapFinding(r as Record<string,unknown>));
}
export async function getFindingById(id:string):Promise<Finding|null>{
  const {data,error}=await supabase.from('findings').select('*,auditor_penemu:auditors(*)').eq('id',id).maybeSingle();
  if(error)throw new Error(`Gagal memuat Temuan: ${error.message}`);return data?mapFinding(data as Record<string,unknown>):null;
}
export async function saveFindingPLOR(finding:Finding):Promise<Finding>{
  if(finding.klasifikasi_dis&&!Object.values(KLASIFIKASI_DIS).includes(finding.klasifikasi_dis))throw new Error('Klasifikasi DIS tidak valid');
  const payload={klasifikasi_dis:finding.klasifikasi_dis,problem:finding.problem?.trim()||null,location:finding.location?.trim()||null,
    objective_evidence:finding.objective_evidence?.trim()||null,reference:finding.reference?.trim()||null,saran_perbaikan:finding.saran_perbaikan?.trim()||null,
    auditor_penemu_id:finding.auditor_penemu_id,auditee_area:finding.auditee_area?.trim()||null,tanggal_temuan:finding.tanggal_temuan};
  const {data,error}=await supabase.from('findings').update({...payload,revision_version:finding.revision_version}).eq('id',finding.id).eq('revision_version',finding.revision_version).select('*,auditor_penemu:auditors(*)').maybeSingle();
  if(error)throw new Error(`Gagal menyimpan PLOR: ${error.message}`);if(!data)throw new Error('Finding ini telah diperbarui anggota Tim lain. Muat ulang data terbaru sebelum menyimpan.');return mapFinding(data as Record<string,unknown>);
}
export async function getFindingWorkflow(id:string):Promise<{capabilities:FindingCapabilities;events:FindingReviewEvent[];disposition:FindingSourceDisposition|null}>{const [c,e,d]=await Promise.all([supabase.rpc('finding_capabilities',{p_id:id}),supabase.from('finding_review_events').select('*').eq('finding_id',id).order('created_at'),supabase.from('finding_source_dispositions').select('*').eq('finding_id',id).maybeSingle()]);if(c.error||e.error||d.error)throw new Error(c.error?.message??e.error?.message??d.error?.message??'Workflow Finding gagal dimuat');return{capabilities:c.data as FindingCapabilities,events:(e.data??[]) as FindingReviewEvent[],disposition:d.data as FindingSourceDisposition|null};}
export async function transitionFinding(id:string,action:string,comment?:string,effectiveJudgement?:string):Promise<Finding>{const{data,error}=await supabase.rpc('finding_transition',{p_id:id,p_action:action,p_comment:comment??null,p_effective_judgement:effectiveJudgement??null});if(error)throw new Error(error.message);return mapFinding(data as Record<string,unknown>);}
export async function addFindingTeamResponse(id:string,comment:string):Promise<void>{const{error}=await supabase.rpc('add_finding_team_response',{p_id:id,p_comment:comment});if(error)throw new Error(error.message);}
export async function listOwnFindingNotifications():Promise<FindingNotification[]>{const{data,error}=await supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(20);if(error)throw new Error(error.message);return(data??[]) as FindingNotification[];}
export async function markFindingNotificationRead(id:string):Promise<void>{const{error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);if(error)throw new Error(error.message);}
export async function listChecklistAnnulmentHistory(instructionRowId:string):Promise<ChecklistFindingReviewHistory[]>{
  const {data:findingRows,error:findingError}=await supabase.from('findings').select('id,kode_temuan,draft_reference,source_type').eq('instruction_row_id',instructionRowId).eq('review_status','ANNULLED');
  if(findingError)throw new Error(`Gagal memuat Finding annulled: ${findingError.message}`);
  const findingIds=(findingRows??[]).map(item=>item.id as string);
  if(!findingIds.length)return[];
  const {data:dispositions,error:dispositionError}=await supabase.from('finding_source_dispositions').select('finding_id,initial_judgement,effective_judgement,reason,actor_display_name,created_at').in('finding_id',findingIds).order('created_at',{ascending:false});
  if(dispositionError)throw new Error(`Gagal memuat disposisi review: ${dispositionError.message}`);
  const findingById=new Map((findingRows??[]).map(item=>[item.id as string,item]));
  return(dispositions??[]).map(item=>{const finding=findingById.get(item.finding_id as string);return{
    finding_id:item.finding_id as string,
    finding_ref:String(finding?.kode_temuan??finding?.draft_reference??'Finding'),
    source_type:String(finding?.source_type??''),
    initial_judgement:String(item.initial_judgement??'-'),effective_judgement:String(item.effective_judgement??'-'),
    reason:String(item.reason??'-'),actor_display_name:String(item.actor_display_name??'-'),created_at:String(item.created_at??''),
  };});
}
export async function getClauseSuggestions(problem:string|null):Promise<ClauseKeywordMap[]>{
  if(!problem?.trim())return[];const {data,error}=await supabase.from('clause_keyword_map').select('*').eq('status','Aktif').order('prioritas',{ascending:false});
  if(error)throw new Error(`Gagal memuat saran klausul: ${error.message}`);const normalized=problem.toLocaleLowerCase('id-ID');
  return(data??[]).filter(row=>normalized.includes(String(row.keyword).toLocaleLowerCase('id-ID'))) as ClauseKeywordMap[];
}
export async function getFindingContext(findingId:string):Promise<FindingContext>{
  const finding=await getFindingById(findingId);if(!finding)throw new Error('Temuan tidak ditemukan');
  const {data:row,error:rowError}=await supabase.from('audit_instruction_rows').select('*').eq('id',finding.instruction_row_id).single();
  if(rowError||!row)throw new Error(`Gagal memuat konteks QA: ${rowError?.message??'baris Instruksi tidak ditemukan'}`);
  const targetSectionIds=((row.seksi_marks??[]) as {seksi_id:string;tipe:string}[])
    .filter(mark=>mark.tipe==='target').map(mark=>mark.seksi_id);
  const [instructionResult,processResult,sectionsResult]=await Promise.all([
    supabase.from('audit_instructions').select('*').eq('id',row.instruction_id).single(),
    row.proses_id?supabase.from('proses').select('*').eq('id',row.proses_id).maybeSingle():Promise.resolve({data:null}),
    targetSectionIds.length?supabase.from('seksi').select('*').in('id',targetSectionIds):Promise.resolve({data:[]}),
  ]);
  if(instructionResult.error||!instructionResult.data)throw new Error(`Gagal memuat Instruksi Temuan: ${instructionResult.error?.message??'Instruksi tidak ditemukan'}`);
  if('error' in processResult&&processResult.error)throw new Error(`Gagal memuat proses Temuan: ${processResult.error.message}`);
  if('error' in sectionsResult&&sectionsResult.error)throw new Error(`Gagal memuat target section Temuan: ${sectionsResult.error.message}`);
  const instruction=instructionResult.data,proses=processResult.data,sectionRows=sectionsResult.data;
  let sourceNote:null|string=null,sourceReference:null|string=null,sourceDetails:Record<string,string|number|null>={};
  if(finding.source_type===FINDING_SOURCE_TYPE.SISTEM){const {data,error}=await supabase.from('checklist_items').select('nomor,pertanyaan_utama,klausul,hasil,komentar_auditor').eq('id',finding.source_item_id).single();if(error||!data)throw new Error(`Gagal memuat sumber Checklist Sistem: ${error?.message??'item tidak ditemukan'}`);sourceNote=data.komentar_auditor;sourceReference=data.klausul;sourceDetails={nomor:data.nomor,pertanyaan_utama:data.pertanyaan_utama,klausul:data.klausul,hasil:data.hasil};}
  else if(finding.source_type===FINDING_SOURCE_TYPE.MANUFAKTUR_SHIFT){const {data,error}=await supabase.from('checklist_manufaktur_items').select('no_proses_dicek,hasil_pengamatan,hasil,bank_item:checklist_manufaktur_bank_items(nomor,item_pemeriksaan,klausul)').eq('id',finding.source_item_id).single();if(error||!data)throw new Error(`Gagal memuat sumber Checklist Manufaktur/Shift: ${error?.message??'item tidak ditemukan'}`);const bank=Array.isArray(data.bank_item)?data.bank_item[0]:data.bank_item;sourceNote=data.hasil_pengamatan;sourceReference=bank?.klausul??null;sourceDetails={no_proses_dicek:data.no_proses_dicek,hasil:data.hasil,nomor:bank?.nomor??null,item_pemeriksaan:bank?.item_pemeriksaan??null,klausul:bank?.klausul??null};}
  else {const {data,error}=await supabase.from('checklist_produk_items').select('item_pemeriksaan,standar_kriteria,hasil_pemeriksaan,judgment,finding_kategori,fase:checklist_produk_fase(nama_fase)').eq('id',finding.source_item_id).single();if(error||!data)throw new Error(`Gagal memuat sumber Checklist Produk: ${error?.message??'item tidak ditemukan'}`);const fase=Array.isArray(data.fase)?data.fase[0]:data.fase;sourceNote=data.hasil_pemeriksaan;sourceReference=data.standar_kriteria;sourceDetails={fase:fase?.nama_fase??null,item_pemeriksaan:data.item_pemeriksaan,standar_kriteria:data.standar_kriteria,judgment:data.judgment,finding_kategori:data.finding_kategori};}
  const team=row.team_master_id?await getAuditTeamMasterById(row.team_master_id):null;
  return{finding,row,instruction,proses,sections:sectionRows??[],team,source_note:sourceNote,source_reference:sourceReference,source_details:sourceDetails} as FindingContext;
}
export function findingTeamAuditors(context:FindingContext):Auditor[]{return context.team?.members.map(m=>m.auditor).filter((a):a is Auditor=>Boolean(a))??[];}
