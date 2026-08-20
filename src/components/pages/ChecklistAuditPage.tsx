import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import type { AuditInstructionRow, Auditor, Proses, Seksi } from '../../lib/types';
import { TIPE_BARIS_LABEL } from '../../lib/enums';
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

export function ChecklistAuditPage({initialRowId,onClearInitial}:{initialRowId:string|null;onClearInitial:()=>void}){
  const [rows,setRows]=useState<AuditInstructionRow[]>([]); const [proses,setProses]=useState<Proses[]>([]); const [seksi,setSeksi]=useState<Seksi[]>([]); const [auditors,setAuditors]=useState<Auditor[]>([]);
  const [statuses,setStatuses]=useState<Record<string,string>>({}); const [selected,setSelected]=useState<string|null>(initialRowId); const [search,setSearch]=useState(''); const [type,setType]=useState(''); const [status,setStatus]=useState(''); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{setLoading(true);try{const [r,p,s,a]=await Promise.all([getAllInstructionRows(),getAllProses(),getSeksiList(),getActiveAuditors()]);setRows(r);setProses(p);setSeksi(s);setAuditors(a);const entries=await Promise.all(r.map(async row=>{if(row.tipe_baris==='Reguler'){const x=await getChecklistsByRow(row.id);return [row.id,x.length?'Tersedia':'Belum Dibuat'];}if(row.tipe_baris==='AuditProduk'){const x=await getProductChecklistsByRow(row.id);return [row.id,x[0]?.status??'Belum Dibuat'];}const x=await getManufacturingChecklistsByRow(row.id);return [row.id,x[0]?.status??'Belum Dibuat'];}));setStatuses(Object.fromEntries(entries));}catch(e){setError(e instanceof Error?e.message:'Gagal memuat Checklist Audit');}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]); useEffect(()=>{if(initialRowId)setSelected(initialRowId);},[initialRowId]);
  const filtered=useMemo(()=>rows.filter(r=>{const process=proses.find(p=>p.id===r.proses_id)?.nama_proses??'';return(!search||`${r.kode_audit} ${process}`.toLowerCase().includes(search.toLowerCase()))&&(!type||r.tipe_baris===type)&&(!status||statuses[r.id]===status);}),[rows,proses,search,type,status,statuses]);
  const auditorNames=(r:AuditInstructionRow)=>r.auditor.map(x=>`${x.is_lead?'Lead: ':'Member: '}${auditors.find(a=>a.id===x.auditor_id)?.nama??x.auditor_id}`).join(', ')||'-';
  if(loading)return <LoadingSpinner message="Memuat worklist Checklist Audit..."/>;
  if(selected){const row=rows.find(r=>r.id===selected);return <div><Button variant="secondary" className="mb-4" onClick={()=>{setSelected(null);onClearInitial();}}><ArrowLeft size={14}/> Kembali ke Worklist</Button>{row&&<ChecklistTab rows={[row]} seksiList={seksi} auditorList={auditors} readOnly={false} onError={setError} initialSelectedRowId={row.id}/>}</div>}
  return <div><div className="mb-6"><h1 className="text-2xl font-bold">Checklist Audit</h1><p className="text-sm text-gray-500">Workspace utama checklist berbasis No. Audit QA.</p></div>{error&&<div className="mb-4 p-3 bg-red-50 text-red-700">{error}</div>}<Card className="p-4 mb-4"><div className="grid md:grid-cols-3 gap-3"><Input placeholder="Cari QA / proses..." value={search} onChange={e=>setSearch(e.target.value)}/><Select value={type} onChange={e=>setType(e.target.value)}><option value="">Semua Tipe</option>{Object.entries(TIPE_BARIS_LABEL).map(([v,l])=><option key={v} value={v}>{l}</option>)}</Select><Select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Semua Status</option>{['Belum Dibuat','Tersedia','Draft','Selesai'].map(v=><option key={v}>{v}</option>)}</Select></div></Card>
    {!filtered.length?<Card className="p-12"><EmptyState icon={<ClipboardCheck/>} title="Tidak ada baris audit" message="Sesuaikan filter atau buat baris Instruksi Audit."/></Card>:<Card className="overflow-x-auto"><table className="min-w-[1100px] w-full text-xs"><thead><tr className="bg-gray-50 text-left">{['No. Audit','Tipe Audit','Proses','Pemilik Proses / Auditee','Team','Auditor','Tanggal Pelaksanaan','Checklist Status','Aksi'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-t"><td className="p-3 font-mono font-semibold">{r.kode_audit}</td><td>{TIPE_BARIS_LABEL[r.tipe_baris]}</td><td>{proses.find(p=>p.id===r.proses_id)?.nama_proses??'-'}</td><td>{r.pemilik_proses??'-'}</td><td>{r.team??'-'}</td><td>{auditorNames(r)}</td><td>{r.tanggal_pelaksanaan_audit??'-'}</td><td><Badge variant={statuses[r.id]==='Selesai'?'green':'gray'}>{statuses[r.id]}</Badge></td><td><Button size="sm" onClick={()=>setSelected(r.id)}>Buka Checklist</Button></td></tr>)}</tbody></table></Card>}
  </div>;
}
