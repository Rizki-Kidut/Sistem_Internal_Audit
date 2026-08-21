import { supabase } from '../lib/supabaseClient';
import type { Auditor, ClauseKeywordMap, Finding, FindingContext } from '../lib/types';
import { FINDING_SOURCE_TYPE, KLASIFIKASI_DIS } from '../lib/enums';
import { getAuditTeamMasterById } from './auditTeamMasterService';

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
  const {data,error}=await supabase.from('findings').update(payload).eq('id',finding.id).select('*,auditor_penemu:auditors(*)').single();
  if(error)throw new Error(`Gagal menyimpan PLOR: ${error.message}`);return mapFinding(data as Record<string,unknown>);
}
export async function getClauseSuggestions(problem:string|null):Promise<ClauseKeywordMap[]>{
  if(!problem?.trim())return[];const {data,error}=await supabase.from('clause_keyword_map').select('*').eq('status','Aktif').order('prioritas',{ascending:false});
  if(error)throw new Error(`Gagal memuat saran klausul: ${error.message}`);const normalized=problem.toLocaleLowerCase('id-ID');
  return(data??[]).filter(row=>normalized.includes(String(row.keyword).toLocaleLowerCase('id-ID'))) as ClauseKeywordMap[];
}
export async function getFindingContext(findingId:string):Promise<FindingContext>{
  const finding=await getFindingById(findingId);if(!finding)throw new Error('Temuan tidak ditemukan');
  const {data:row,error:rowError}=await supabase.from('audit_instruction_rows').select('*').eq('id',finding.instruction_row_id).single();
  if(rowError)throw new Error(`Gagal memuat konteks QA: ${rowError.message}`);
  const [{data:instruction},{data:proses},{data:sectionRows}]=await Promise.all([
    supabase.from('audit_instructions').select('*').eq('id',row.instruction_id).single(),
    row.proses_id?supabase.from('proses').select('*').eq('id',row.proses_id).maybeSingle():Promise.resolve({data:null}),
    supabase.from('seksi').select('*').in('id',((row.seksi_marks??[]) as {seksi_id:string}[]).map(m=>m.seksi_id)),
  ]);
  let sourceNote:null|string=null,sourceReference:null|string=null,sourceDetails:Record<string,string|number|null>={};
  if(finding.source_type===FINDING_SOURCE_TYPE.SISTEM){const {data}=await supabase.from('checklist_items').select('nomor,pertanyaan_utama,klausul,hasil,komentar_auditor').eq('id',finding.source_item_id).single();if(!data)throw new Error('Item Checklist sumber tidak ditemukan');sourceNote=data.komentar_auditor;sourceReference=data.klausul;sourceDetails={nomor:data.nomor,pertanyaan_utama:data.pertanyaan_utama,klausul:data.klausul,hasil:data.hasil};}
  else if(finding.source_type===FINDING_SOURCE_TYPE.MANUFAKTUR_SHIFT){const {data}=await supabase.from('checklist_manufaktur_items').select('no_proses_dicek,hasil_pengamatan,hasil,bank_item:checklist_manufaktur_bank_items(nomor,item_pemeriksaan,klausul)').eq('id',finding.source_item_id).single();if(!data)throw new Error('Item Checklist sumber tidak ditemukan');const bank=Array.isArray(data.bank_item)?data.bank_item[0]:data.bank_item;sourceNote=data.hasil_pengamatan;sourceReference=bank?.klausul??null;sourceDetails={no_proses_dicek:data.no_proses_dicek,hasil:data.hasil,nomor:bank?.nomor??null,item_pemeriksaan:bank?.item_pemeriksaan??null,klausul:bank?.klausul??null};}
  else {const {data}=await supabase.from('checklist_produk_items').select('item_pemeriksaan,standar_kriteria,hasil_pemeriksaan,judgment,finding_kategori,fase:checklist_produk_fase(nama_fase)').eq('id',finding.source_item_id).single();if(!data)throw new Error('Item Checklist sumber tidak ditemukan');const fase=Array.isArray(data.fase)?data.fase[0]:data.fase;sourceNote=data.hasil_pemeriksaan;sourceReference=data.standar_kriteria;sourceDetails={fase:fase?.nama_fase??null,item_pemeriksaan:data.item_pemeriksaan,standar_kriteria:data.standar_kriteria,judgment:data.judgment,finding_kategori:data.finding_kategori};}
  const team=row.team_master_id?await getAuditTeamMasterById(row.team_master_id):null;
  return{finding,row,instruction,proses,sections:sectionRows??[],team,source_note:sourceNote,source_reference:sourceReference,source_details:sourceDetails} as FindingContext;
}
export function findingTeamAuditors(context:FindingContext):Auditor[]{return context.team?.members.map(m=>m.auditor).filter((a):a is Auditor=>Boolean(a))??[];}
