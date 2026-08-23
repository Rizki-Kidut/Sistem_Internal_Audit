import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import type { AuditInstructionRow, Auditor, AuditTeamMaster, Proses, Seksi } from '../../lib/types';
import { TIPE_BARIS_LABEL } from '../../lib/enums';
import { supabase } from '../../lib/supabaseClient';
import { getAllInstructionRows } from '../../services/auditInstructionService';
import { getAllProses } from '../../services/prosesService';
import { getSeksiList } from '../../services/seksiService';
import { getActiveAuditors } from '../../services/auditorService';
import { getChecklistsByRow } from '../../services/checklistService';
import { getProductChecklistsByRow } from '../../services/checklistProdukService';
import { getManufacturingChecklistsByRow } from '../../services/checklistManufakturService';
import { Badge, Button, Card, EmptyState, LoadingSpinner } from '../ui';
import { Input, Select } from '../ui/Field';
import { ChecklistTab } from './instruksi-audit/ChecklistTab';
import { getAuditTeamMasters } from '../../services/auditTeamMasterService';

type ChecklistReviewHistory = {
  finding_id: string;
  finding_ref: string;
  source_type: string;
  initial_judgement: string;
  effective_judgement: string;
  reason: string;
  actor_display_name: string;
  created_at: string;
};

const reviewSourceLabel: Record<string,string> = {
  ChecklistSistem: 'Sistem',
  ChecklistProduk: 'Produk',
  ChecklistManufakturShift: 'Manufaktur / Shift',
};

export function ChecklistAuditPage({readOnly=false}:{readOnly?:boolean}){
  const [rows,setRows]=useState<AuditInstructionRow[]>([]); const [proses,setProses]=useState<Proses[]>([]); const [seksi,setSeksi]=useState<Seksi[]>([]); const [auditors,setAuditors]=useState<Auditor[]>([]);const [teams,setTeams]=useState<AuditTeamMaster[]>([]);
  const [statuses,setStatuses]=useState<Record<string,string>>({}); const [selected,setSelected]=useState<string|null>(null); const [search,setSearch]=useState(''); const [type,setType]=useState(''); const [status,setStatus]=useState(''); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const [reviewHistory,setReviewHistory]=useState<ChecklistReviewHistory[]>([]); const [reviewLoading,setReviewLoading]=useState(false);
  const load=useCallback(async()=>{setLoading(true);try{const [r,p,s,a,t]=await Promise.all([getAllInstructionRows(),getAllProses(),getSeksiList(),getActiveAuditors(),getAuditTeamMasters()]);setRows(r);setProses(p);setSeksi(s);setAuditors(a);setTeams(t);const entries=await Promise.all(r.map(async row=>{if(row.tipe_baris==='Reguler'){const x=await getChecklistsByRow(row.id);return [row.id,x.length?'Tersedia':'Belum Dibuat'];}if(row.tipe_baris==='AuditProduk'){const x=await getProductChecklistsByRow(row.id);return [row.id,x[0]?.status??'Belum Dibuat'];}const x=await getManufacturingChecklistsByRow(row.id);return [row.id,x[0]?.status??'Belum Dibuat'];}));setStatuses(Object.fromEntries(entries));}catch(e){setError(e instanceof Error?e.message:'Gagal memuat Checklist Audit');}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    let cancelled=false;
    if(!selected){setReviewHistory([]);setReviewLoading(false);return;}
    setReviewLoading(true);
    (async()=>{
      try{
        const {data:findingRows,error:findingError}=await supabase.from('findings').select('id,kode_temuan,draft_reference,source_type').eq('instruction_row_id',selected).eq('review_status','ANNULLED');
        if(findingError)throw new Error(findingError.message);
        const findingIds=(findingRows??[]).map(item=>item.id as string);
        if(!findingIds.length){if(!cancelled)setReviewHistory([]);return;}
        const {data:dispositions,error:dispositionError}=await supabase.from('finding_source_dispositions').select('finding_id,initial_judgement,effective_judgement,reason,actor_display_name,created_at').in('finding_id',findingIds).order('created_at',{ascending:false});
        if(dispositionError)throw new Error(dispositionError.message);
        const findingById=new Map((findingRows??[]).map(item=>[item.id as string,item]));
        const history=(dispositions??[]).map(item=>{const finding=findingById.get(item.finding_id as string);return{
          finding_id:item.finding_id as string,
          finding_ref:String(finding?.kode_temuan??finding?.draft_reference??'Finding'),
          source_type:String(finding?.source_type??''),
          initial_judgement:String(item.initial_judgement??'-'),
          effective_judgement:String(item.effective_judgement??'-'),
          reason:String(item.reason??'-'),
          actor_display_name:String(item.actor_display_name??'-'),
          created_at:String(item.created_at??''),
        };});
        if(!cancelled)setReviewHistory(history);
      }catch(e){if(!cancelled)setError(e instanceof Error?`Gagal memuat riwayat review Checklist: ${e.message}`:'Gagal memuat riwayat review Checklist');}
      finally{if(!cancelled)setReviewLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[selected]);
  const filtered=useMemo(()=>rows.filter(r=>{const process=proses.find(p=>p.id===r.proses_id)?.nama_proses??'';return(!search||`${r.kode_audit} ${process}`.toLowerCase().includes(search.toLowerCase()))&&(!type||r.tipe_baris===type)&&(!status||statuses[r.id]===status);}),[rows,proses,search,type,status,statuses]);
  const teamFor=(r:AuditInstructionRow)=>teams.find(t=>t.id===r.team_master_id);const auditorNames=(r:AuditInstructionRow)=>{const t=teamFor(r);if(!t)return '-';const resolve=(id:string)=>t.members.find(m=>m.auditor_id===id)?.auditor?.nama??auditors.find(a=>a.id===id)?.nama??id;const lead=t.members.find(m=>m.peran==='Lead');const members=t.members.filter(m=>m.peran==='Member').map(m=>resolve(m.auditor_id));return `${lead?`Lead: ${resolve(lead.auditor_id)}`:'Lead: -'}${members.length?`; Member: ${members.join(', ')}`:''}`;};
  if(loading)return <LoadingSpinner message="Memuat worklist Checklist Audit..."/>;
  if(selected){const row=rows.find(r=>r.id===selected);return <div><Button variant="secondary" className="mb-4" onClick={()=>setSelected(null)}><ArrowLeft size={14}/> Kembali ke Worklist</Button>{error&&<div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700">{error}</div>}{row?.cek_selesai&&<div className="mb-4 p-3 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-700">Pelaksanaan audit ini sudah selesai. Buka kembali Pelaksanaan Audit sebelum mengubah Checklist.</div>}{reviewLoading&&<Card className="p-4 mb-4"><LoadingSpinner message="Memuat riwayat review hasil Checklist..."/></Card>}{!reviewLoading&&reviewHistory.length>0&&<Card className="p-4 mb-4 border-l-4 border-amber-400"><div className="mb-3"><h2 className="font-semibold">Riwayat Review Hasil Checklist</h2><p className="text-xs text-gray-500">Hasil yang tampil pada Checklist adalah hasil efektif. Nilai awal dan alasan perubahan akibat Finding yang dianulir tetap dipertahankan untuk traceability.</p></div><div className="space-y-3">{reviewHistory.map(item=><div key={item.finding_id} className="rounded-lg border bg-amber-50/50 p-3 text-sm"><div className="flex flex-wrap items-center gap-2 mb-2"><Badge variant="amber">Finding Annulled</Badge><span className="font-mono font-semibold">{item.finding_ref}</span><span className="text-xs text-gray-500">{reviewSourceLabel[item.source_type]??item.source_type}</span></div><div className="grid md:grid-cols-2 gap-2"><div><span className="text-xs text-gray-500 block">Hasil Awal</span><span className="font-semibold">{item.initial_judgement}</span></div><div><span className="text-xs text-gray-500 block">Hasil Efektif</span><span className="font-semibold">{item.effective_judgement}</span></div></div><div className="mt-2"><span className="text-xs text-gray-500 block">Alasan Annulment</span><span>{item.reason}</span></div><div className="mt-2 text-xs text-gray-500">Ditinjau oleh {item.actor_display_name}{item.created_at?` · ${new Date(item.created_at).toLocaleString('id-ID')}`:''}</div></div>)}</div></Card>}{row&&<ChecklistTab rows={[row]} seksiList={seksi} auditorList={auditors} readOnly={readOnly||row.cek_selesai} onError={setError} initialSelectedRowId={row.id}/>}</div>}
  return <div><div className="mb-6"><h1 className="text-2xl font-bold">Checklist Audit</h1><p className="text-sm text-gray-500">Workspace utama checklist berbasis No. Audit QA.</p></div>{error&&<div className="mb-4 p-3 bg-red-50 text-red-700">{error}</div>}<Card className="p-4 mb-4"><div className="grid md:grid-cols-3 gap-3"><Input placeholder="Cari QA / proses..." value={search} onChange={e=>setSearch(e.target.value)}/><Select value={type} onChange={e=>setType(e.target.value)}><option value="">Semua Tipe</option>{Object.entries(TIPE_BARIS_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select><Select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Semua Status</option>{['Belum Dibuat','Tersedia','Draft','Selesai'].map(v=><option key={v}>{v}</option>)}</Select></div></Card>
    {!filtered.length?<Card className="p-12"><EmptyState icon={<ClipboardCheck/>} title="Tidak ada baris audit" message="Sesuaikan filter atau buat baris Instruksi Audit."/></Card>:<Card className="overflow-x-auto"><table className="min-w-[1100px] w-full text-xs"><thead><tr className="bg-gray-50 text-left">{['No. Audit','Tipe Audit','Proses','Pemilik Proses / Auditee','Team','Auditor','Tanggal Pelaksanaan','Checklist Status','Aksi'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-t"><td className="p-3 font-mono font-semibold">{r.kode_audit}</td><td>{TIPE_BARIS_LABEL[r.tipe_baris]}</td><td>{proses.find(p=>p.id===r.proses_id)?.nama_proses??'-'}</td><td>{r.pemilik_proses??'-'}</td><td>{teamFor(r)?`${teamFor(r)!.kode_tim} — ${teamFor(r)!.nama_tim}`:'-'}</td><td>{auditorNames(r)}</td><td>{r.tanggal_pelaksanaan_audit??'-'}</td><td><Badge variant={statuses[r.id]==='Selesai'?'green':'gray'}>{statuses[r.id]}</Badge></td><td><Button size="sm" onClick={()=>setSelected(r.id)}>Buka Checklist</Button></td></tr>)}</tbody></table></Card>}
  </div>;
}
