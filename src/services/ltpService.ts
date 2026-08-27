import { supabase } from '../lib/supabaseClient';
import type { LtpActionEvidence,LtpContext,LtpDraftPayload,LtpWorklistRow } from '../lib/types';
import type { LtpEvidenceState } from '../lib/enums';

const BUCKET='audit-evidence';
export const LTP_STALE_MESSAGE='LTP telah berubah di sesi lain. Muat ulang data sebelum menyimpan kembali.';

export async function listLtpWorklist():Promise<LtpWorklistRow[]>{
  const {data,error}=await supabase.rpc('list_ltp_worklist');
  if(error)throw new Error(`Gagal memuat worklist LTP: ${error.message}`);
  return(data??[]) as LtpWorklistRow[];
}

export async function saveLtpAuditeeDraft(payload:LtpDraftPayload):Promise<number>{
  const {data,error}=await supabase.rpc('save_ltp_auditee_draft',{
    p_car_id:payload.car_id,p_expected_revision:payload.expected_revision,
    p_dampak_temuan:payload.dampak_temuan,p_manfaat_perbaikan:payload.manfaat_perbaikan,
    p_why_analysis:payload.why_analysis.map(({teks})=>({teks})),
    p_actions:payload.actions.map(({action_type,description,pic,due_date})=>({action_type,description,pic,due_date})),
    p_system_revisions:payload.system_revisions.map(({kategori,nama_dokumen})=>({kategori,nama_dokumen})),
  });
  if(error){if(error.message.includes('LTP_STALE_REVISION'))throw new Error(LTP_STALE_MESSAGE);throw new Error(`Gagal menyimpan Draft LTP: ${error.message}`);}
  return data as number;
}

function sanitizeFileName(name:string):string{return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-')||'file';}

export async function uploadLtpActionEvidence(carId:string,actionId:string,state:LtpEvidenceState,file:File):Promise<void>{
  if(!actionId)throw new Error('Simpan Draft terlebih dahulu untuk mengaktifkan upload bukti.');
  const path=`ltp/${carId}/${actionId}/${state}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const {error:uploadError}=await supabase.storage.from(BUCKET).upload(path,file,{contentType:file.type||undefined,upsert:false});
  if(uploadError)throw new Error(`Gagal mengunggah bukti LTP: ${uploadError.message}`);
  const {error}=await supabase.rpc('register_ltp_action_evidence',{p_action_id:actionId,p_evidence_state:state,p_file_name:file.name,p_path:path,p_mime_type:file.type||null,p_size_bytes:file.size});
  if(error){await supabase.storage.from(BUCKET).remove([path]);throw new Error(`Gagal mencatat bukti LTP: ${error.message}`);}
}

export async function deleteLtpActionEvidence(evidence:LtpActionEvidence):Promise<void>{
  const {data,error}=await supabase.rpc('delete_ltp_action_evidence',{p_evidence_id:evidence.id});
  if(error)throw new Error(`Gagal menghapus bukti LTP: ${error.message}`);
  const path=(data as string)||evidence.path;
  const {error:storageError}=await supabase.storage.from(BUCKET).remove([path]);
  if(storageError)throw new Error(`Metadata bukti terhapus, tetapi file Storage gagal dibersihkan: ${storageError.message}`);
}

export async function getLtpEvidenceSignedUrl(path:string):Promise<string>{
  const {data,error}=await supabase.storage.from(BUCKET).createSignedUrl(path,60*10);
  if(error)throw new Error(`Gagal membuka bukti LTP: ${error.message}`);
  return data.signedUrl;
}

export async function getLtpContext(carId:string):Promise<LtpContext>{
  if(!carId)throw new Error('ID LTP wajib diisi');
  const {data,error}=await supabase.rpc('get_ltp_context',{p_car_id:carId});
  if(error)throw new Error(`Gagal memuat konteks LTP: ${error.message}`);
  if(!data)throw new Error('LTP tidak ditemukan atau tidak dapat diakses');
  return data as LtpContext;
}
