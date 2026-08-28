import { useCallback,useEffect,useMemo,useState } from 'react';
import { ArrowLeft,FileCheck } from 'lucide-react';
import type { LtpNotification,LtpWorkflowContext } from '../../lib/ltpWorkflowTypes';
import type { LtpWorklistRow } from '../../lib/types';
import { LTP_STATUS_LABEL } from '../../lib/enums';
import { getLtpContext,listLtpWorklist,listOwnLtpNotifications,markLtpNotificationRead } from '../../services/ltpService';
import { Badge,Button,Card,EmptyState,LoadingSpinner } from '../ui';
import { Input,Select } from '../ui/Field';
import { LtpAuditeeForm } from './ltp/LtpAuditeeForm';
import { LtpManagerReview } from './ltp/LtpManagerReview';

const date=(value:string)=>new Date(`${value}T00:00:00`).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'});

export function LtpPage(){
  const [rows,setRows]=useState<LtpWorklistRow[]>([]),[notifications,setNotifications]=useState<LtpNotification[]>([]),[selected,setSelected]=useState<string|null>(null),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{setLoading(true);try{const[r,n]=await Promise.all([listLtpWorklist(),listOwnLtpNotifications()]);setRows(r);setNotifications(n);setError(null);}catch(e){setError(e instanceof Error?e.message:'Gagal memuat LTP');}finally{setLoading(false);}},[]);
  useEffect(()=>{void load();},[load]);
  const filtered=useMemo(()=>rows.filter(row=>(!status||row.status===status)&&(!search||`${row.kode_ltp} ${row.kode_audit} ${row.seksi_nama??''} ${row.proses_nama??''}`.toLowerCase().includes(search.toLowerCase()))),[rows,search,status]);
  const openNotification=async(notification:LtpNotification)=>{
    const row=rows.find(item=>item.finding_id===notification.finding_id);
    if(!row){setError('LTP dari notifikasi ini tidak ditemukan atau tidak dapat diakses.');return;}
    try{
      await markLtpNotificationRead(notification.id);
      setNotifications(items=>items.map(item=>item.id===notification.id?{...item,read_at:new Date().toISOString()}:item));
      setSelected(row.car_id);
    }catch(e){setError(e instanceof Error?e.message:'Gagal membuka notifikasi LTP');}
  };
  if(selected)return <LtpDetail carId={selected} onBack={()=>{setSelected(null);void load();}}/>;
  if(loading)return <LoadingSpinner message="Memuat worklist LTP..."/>;
  return <div>
    <h1 className="text-2xl font-bold">LTP — Laporan Tindakan Perbaikan</h1>
    <p className="text-sm text-gray-500 mb-6">Satu Finding memiliki maksimal satu LTP. No. LTP mengikuti No. Temuan.</p>
    {error&&<div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}
    {notifications.some(notification=>!notification.read_at)&&<Card className="p-4 mb-4">
      <h2 className="font-semibold mb-2">Notifikasi LTP</h2>
      {notifications.filter(notification=>!notification.read_at).map(notification=><button key={notification.id} className="block w-full text-left border-t py-2" onClick={()=>void openNotification(notification)}>
        <b>{notification.title}</b>
        <div className="text-sm text-gray-600 whitespace-pre-wrap">{notification.message}</div>
      </button>)}
    </Card>}
    <Card className="p-4 mb-4">
      <div className="grid md:grid-cols-2 gap-3">
        <Input placeholder="Cari No. LTP, audit, seksi, atau proses" value={search} onChange={e=>setSearch(e.target.value)}/>
        <Select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">Semua Status</option>
          {Object.entries(LTP_STATUS_LABEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
    </Card>
    {!filtered.length
      ?<Card className="p-12"><EmptyState icon={<FileCheck/>} title="Belum ada LTP" message="LTP dibuat otomatis setelah Finding dipublikasikan dan PLOR lengkap."/></Card>
      :<Card className="overflow-x-auto"><table className="min-w-[1050px] w-full text-sm">
        <thead><tr className="bg-gray-50 text-left">{['No. LTP','No. Audit','Kategori','Seksi Auditee','Proses','Tanggal Temuan','Status','Aksi'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead>
        <tbody>{filtered.map(row=><tr key={row.car_id} className="border-t">
          <td className="p-3 font-mono font-semibold">{row.kode_ltp}</td>
          <td>{row.kode_audit}</td>
          <td><Badge variant={row.kategori==='A'?'red':row.kategori==='C'?'blue':'green'}>{row.kategori}</Badge></td>
          <td>{row.seksi_nama??'-'}</td>
          <td>{row.proses_nama??'-'}</td>
          <td>{date(row.tanggal_temuan)}</td>
          <td><Badge variant="gray">{LTP_STATUS_LABEL[row.status]}</Badge></td>
          <td><Button size="sm" onClick={()=>setSelected(row.car_id)}>Buka LTP</Button></td>
        </tr>)}</tbody>
      </table></Card>}
  </div>;
}

function LtpDetail({carId,onBack}:{carId:string;onBack:()=>void}){
  const [context,setContext]=useState<LtpWorkflowContext|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{setContext(await getLtpContext(carId));},[carId]);
  useEffect(()=>{refresh().catch(e=>setError(e instanceof Error?e.message:'Gagal memuat detail LTP')).finally(()=>setLoading(false));},[refresh]);
  if(loading)return <LoadingSpinner message="Memuat detail LTP..."/>;
  if(error||!context)return <div><Button variant="secondary" className="mb-4" onClick={onBack}><ArrowLeft size={14}/> Kembali</Button><div className="p-3 bg-red-50 text-red-700">{error??'Detail LTP tidak tersedia.'}</div></div>;
  const {ltp,finding,section,process,team,team_leader}=context;
  return <div>
    <Button variant="secondary" className="mb-4" onClick={onBack}><ArrowLeft size={14}/> Kembali</Button>
    <div className="flex items-center gap-3 mb-6"><h1 className="text-2xl font-bold">Detail LTP</h1><Badge variant="blue">{LTP_STATUS_LABEL[ltp.status]}</Badge></div>
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="font-semibold mb-4">1. Identitas LTP — Read-only</h2>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <Info label="No. LTP" value={ltp.kode_ltp}/><Info label="No. Audit" value={finding.kode_audit}/><Info label="Kategori" value={finding.kategori}/><Info label="Tanggal Temuan" value={date(finding.tanggal_temuan)}/>
          <Info label="Seksi Auditee" value={section?.nama}/><Info label="Proses" value={process?.nama}/><Info label="Tim Audit" value={team?`${team.kode} — ${team.nama}`:null}/><Info label="Team Leader" value={team_leader?.nama}/>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold mb-4">2. PLOR / Temuan — Read-only</h2>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          {finding.kategori==='C'
            ?<><Info label="Kondisi / Peluang Peningkatan" value={finding.problem}/><Info label="Location" value={finding.location}/><Info label="Objective Evidence" value={finding.objective_evidence}/><Info label="Saran Perbaikan" value={finding.saran_perbaikan}/>{finding.reference&&<Info label="Reference / Acuan" value={finding.reference}/>}</>
            :<><Info label="Problem" value={finding.problem}/><Info label="Location" value={finding.location}/><Info label="Objective Evidence" value={finding.objective_evidence}/><Info label="Reference" value={finding.reference}/></>}
          <Info label="Auditee Area" value={finding.auditee_area}/>
        </div>
      </Card>
      <LtpAuditeeForm context={context} onRefresh={refresh}/>
      <LtpManagerReview context={context} onRefresh={refresh}/>
    </div>
  </div>;
}

function Info({label,value}:{label:string;value:string|null|undefined}){return <div><div className="text-xs uppercase text-gray-500">{label}</div><div className="font-medium whitespace-pre-wrap">{value||'-'}</div></div>}
