import { useEffect,useState } from 'react';
import { FileWarning,Printer } from 'lucide-react';
import type { DaftarKetidaksesuaianAuditOption,DaftarKetidaksesuaianReport } from '../../lib/types';
import { getDaftarKetidaksesuaianReport,listDaftarKetidaksesuaianAudits } from '../../services/daftarKetidaksesuaianService';
import { Button,Card,EmptyState,LoadingSpinner } from '../ui';
import { Select } from '../ui/Field';

const DOCUMENT_CODE='Q-120-ISE-001-FORM-008';
const formatGeneratedDate=(value:string)=>new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(value));

export function DaftarKetidaksesuaianPage(){
  const [options,setOptions]=useState<DaftarKetidaksesuaianAuditOption[]>([]);
  const [selected,setSelected]=useState('');
  const [report,setReport]=useState<DaftarKetidaksesuaianReport|null>(null);
  const [loading,setLoading]=useState(true);
  const [reportLoading,setReportLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{listDaftarKetidaksesuaianAudits().then(setOptions).catch(error=>setError(error instanceof Error?error.message:'Gagal memuat daftar audit.')).finally(()=>setLoading(false));},[]);
  async function selectAudit(kodeAudit:string){
    setSelected(kodeAudit);setReport(null);setError(null);
    if(!kodeAudit)return;
    setReportLoading(true);
    try{setReport(await getDaftarKetidaksesuaianReport(kodeAudit));}
    catch(error){setError(error instanceof Error?error.message:'Gagal memuat laporan Daftar Ketidaksesuaian.');}
    finally{setReportLoading(false);}
  }

  if(loading)return <LoadingSpinner message="Memuat Daftar Ketidaksesuaian..."/>;
  return <div className="daftar-ketidaksesuaian-print">
    <style>{`@media print {
      @page { size: A4 landscape; margin: 10mm; }
      body:has(.daftar-ketidaksesuaian-print) { background: white !important; }
      body:has(.daftar-ketidaksesuaian-print) aside { display: none !important; }
      body:has(.daftar-ketidaksesuaian-print) main { overflow: visible !important; }
      body:has(.daftar-ketidaksesuaian-print) main > div { max-width: none !important; padding: 0 !important; }
      .daftar-ketidaksesuaian-print .report-card { border: 0 !important; border-radius: 0 !important; box-shadow: none !important; }
      .daftar-ketidaksesuaian-print .report-table { table-layout: fixed; width: 100% !important; font-size: 9pt !important; }
      .daftar-ketidaksesuaian-print .report-table th,
      .daftar-ketidaksesuaian-print .report-table td { border: 1px solid #111827 !important; padding: 5px !important; overflow-wrap: anywhere; white-space: normal; }
      .daftar-ketidaksesuaian-print .report-header { break-inside: avoid; }
      .daftar-ketidaksesuaian-print .report-table tr { break-inside: avoid; }
    }`}</style>
    <div className="print:hidden mb-6">
      <h1 className="text-2xl font-bold text-gray-900">Daftar Ketidaksesuaian</h1>
      <p className="mt-1 text-sm text-gray-500">Laporan terhitung dari Finding formal yang telah memiliki LTP.</p>
    </div>
    {error&&<div className="print:hidden mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <Card className="print:hidden mb-5 p-4">
      <label className="block max-w-xl text-sm font-medium text-gray-700">No. Audit
        <Select className="mt-1" value={selected} onChange={event=>void selectAudit(event.target.value)}>
          <option value="">Pilih No. Audit</option>
          {options.map(option=><option key={option.kode_audit} value={option.kode_audit}>{option.kode_audit} ({option.finding_count} Finding)</option>)}
        </Select>
      </label>
    </Card>
    {reportLoading?<LoadingSpinner message="Menyusun laporan..."/>:report?<ReportPreview report={report}/>:<Card className="print:hidden p-10"><EmptyState icon={<FileWarning/>} title={options.length?'Pilih No. Audit':'Belum ada laporan yang tersedia'} message={options.length?'Pilih satu No. Audit untuk menampilkan pratinjau laporan.':'Belum ada Finding yang memiliki LTP dan dapat Anda akses.'}/></Card>}
  </div>;
}

function ReportPreview({report}:{report:DaftarKetidaksesuaianReport}){
  return <>
    <div className="print:hidden mb-3 flex justify-end"><Button onClick={()=>window.print()}><Printer size={16}/> Cetak / Simpan PDF</Button></div>
    <Card className="report-card overflow-x-auto p-5">
      <header className="report-header mb-5 border-b-2 border-gray-900 pb-4">
        <div className="flex items-start justify-between gap-6"><div><p className="text-xs font-semibold tracking-wider text-blue-800">DOKUMEN</p><h2 className="text-2xl font-bold text-gray-900">DAFTAR KETIDAKSESUAIAN</h2></div><div className="text-right"><p className="text-xs text-gray-500">Kode Dokumen</p><p className="font-mono text-sm font-semibold">{DOCUMENT_CODE}</p></div></div>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 text-sm lg:grid-cols-4">
          <HeaderValue label="No. Audit" value={report.kode_audit}/><HeaderValue label="Team Audit" value={report.team_label}/><HeaderValue label="Tanggal Generate" value={formatGeneratedDate(report.generated_at)}/><HeaderValue label="Dibuat" value={report.team_leader_name}/>
        </dl>
      </header>
      <table className="report-table min-w-[1000px] w-full border-collapse text-sm">
        <colgroup><col className="w-[11%]"/><col className="w-[43%]"/><col className="w-[14%]"/><col className="w-[7%]"/><col className="w-[7%]"/><col className="w-[18%]"/></colgroup>
        <thead><tr className="bg-blue-50 text-left text-xs uppercase text-gray-700">{['No Ketidaksesuaian','No. Persyaratan + Item','Seksi Lokasi','Major','Minor','Peluang Improvement'].map(label=><th key={label} className="border border-gray-400 p-2">{label}</th>)}</tr></thead>
        <tbody>{report.rows.map(row=><tr key={row.finding_id} className="align-top">
          <td className="border border-gray-400 p-2 text-center font-semibold">{row.nomor_urut_temuan}</td>
          <td className="border border-gray-400 p-2"><div className="space-y-1">{row.reference&&<p className="font-semibold">{row.reference}</p>}<p className="whitespace-pre-wrap">{row.narrative}</p></div></td>
          <td className="border border-gray-400 p-2">{row.location||'-'}</td>
          <td className="border border-gray-400 p-2 text-center text-lg font-bold">{row.kategori==='A'?'✓':''}</td>
          <td className="border border-gray-400 p-2 text-center text-lg font-bold">{row.kategori==='B'?'✓':''}</td>
          <td className="border border-gray-400 p-2">{row.kategori==='C'?`C — ${row.saran_perbaikan||'-'}`:''}</td>
        </tr>)}</tbody>
      </table>
    </Card>
  </>;
}

function HeaderValue({label,value}:{label:string;value:string}){return <div><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-0.5 font-semibold text-gray-900">{value||'-'}</dd></div>;}
