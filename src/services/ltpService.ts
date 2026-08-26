import { supabase } from '../lib/supabaseClient';
import type { LtpContext,LtpWorklistRow } from '../lib/types';

export async function listLtpWorklist():Promise<LtpWorklistRow[]>{
  const {data,error}=await supabase.rpc('list_ltp_worklist');
  if(error)throw new Error(`Gagal memuat worklist LTP: ${error.message}`);
  return(data??[]) as LtpWorklistRow[];
}

export async function getLtpContext(carId:string):Promise<LtpContext>{
  if(!carId)throw new Error('ID LTP wajib diisi');
  const {data,error}=await supabase.rpc('get_ltp_context',{p_car_id:carId});
  if(error)throw new Error(`Gagal memuat konteks LTP: ${error.message}`);
  if(!data)throw new Error('LTP tidak ditemukan atau tidak dapat diakses');
  return data as LtpContext;
}
