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
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; }
      body:has(.daftar-ketidaksesuaian-print) { margin: 0 !important; padding: 0 !important; background: white !important; }
      body:has(.daftar-ketidaksesuaian-print) aside { display: none !important; }
      body:has(.daftar-ketidaksesuaian-print) main { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; overflow: visible !important; }
      body:has(.daftar-ketidaksesuaian-print) main > div { margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; }
      .daftar-ketidaksesuaian-print { box-sizing: border-box !important; width: 100% !important; min-height: 297mm !important; padding: 19.05mm 17.78mm 19.05mm 17.78mm !important; }
      .daftar-ketidaksesuaian-print .report-card { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; overflow: visible !important; }
      .daftar-ketidaksesuaian-print .report-header,
      .daftar-ketidaksesuaian-print .report-header-layout,
      .daftar-ketidaksesuaian-print .report-table,
      .daftar-ketidaksesuaian-print .report-document-code { width: 100% !important; max-width: none !important; }
      .daftar-ketidaksesuaian-print .report-header-layout { display: grid !important; grid-template-columns: minmax(0, 45fr) minmax(0, 55fr) !important; align-items: stretch; }
      .daftar-ketidaksesuaian-print .report-table { table-layout: fixed; min-width: 0 !important; max-width: 100% !important; width: 100% !important; font-size: 8.5pt !important; }
      .daftar-ketidaksesuaian-print .report-table thead { display: table-header-group; }
      .daftar-ketidaksesuaian-print .report-table th,
      .daftar-ketidaksesuaian-print .report-table td { border: 1px solid #111827 !important; padding: 5px !important; overflow-wrap: anywhere; white-space: normal; }
      .daftar-ketidaksesuaian-print .report-header { break-inside: avoid; }
      .daftar-ketidaksesuaian-print .report-table tr { break-inside: avoid; }
      .daftar-ketidaksesuaian-print .report-filler-row { display: table-row !important; height: 22mm; }
      .daftar-ketidaksesuaian-print .report-document-code { break-before: avoid; page-break-before: avoid; }
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
  const teamCode=report.team_label.includes(' — ')?report.team_label.split(' — ')[0].trim():report.team_label;
  return <>
    <div className="print:hidden mb-3 flex flex-col items-end gap-1"><Button onClick={()=>window.print()}><Printer size={16}/> Cetak / Simpan PDF</Button><p className="text-xs text-gray-500">Di dialog print gunakan Scale 100%, Margins None, dan nonaktifkan &quot;Headers and footers&quot;.</p></div>
    <Card className="report-card overflow-x-auto p-5">
      <header className="report-header mb-5 border-b-2 border-gray-900 pb-4">
        <div className="report-header-layout grid gap-5 lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)]">
          <div className="flex min-h-32 items-center"><h2 className="text-2xl font-bold leading-tight text-gray-900">DAFTAR KETIDAKSESUAIAN / PELUANG PERBAIKAN</h2></div>
          <div className="flex items-center">
            <table className="w-full table-fixed border-collapse text-xs">
              <thead><tr>{['No. audit','Audit team','Tgl. pembuatan','Dibuat'].map(label=><th key={label} className="border border-gray-500 bg-gray-50 px-1.5 py-2 text-center font-semibold">{label}</th>)}</tr></thead>
              <tbody><tr><td className="border border-gray-500 px-1.5 py-2 text-center font-medium">{report.kode_audit||'-'}</td><td className="border border-gray-500 px-1.5 py-2 text-center font-medium">{teamCode||'-'}</td><td className="border border-gray-500 px-1.5 py-2 text-center font-medium">{formatGeneratedDate(report.generated_at)||'-'}</td><td className="border border-gray-500 px-1.5 py-2 text-center font-medium">{report.team_leader_name||'-'}</td></tr></tbody>
            </table>
          </div>
        </div>
      </header>
      <table className="report-table min-w-[1000px] w-full border-collapse text-sm">
        <colgroup><col className="w-[11%]"/><col className="w-[43%]"/><col className="w-[14%]"/><col className="w-[7%]"/><col className="w-[7%]"/><col className="w-[18%]"/></colgroup>
        <thead className="bg-blue-50 text-xs uppercase text-gray-700">
          <tr><th rowSpan={2} className="border border-gray-400 p-2 text-left">No Ketidaksesuaian</th><th rowSpan={2} className="border border-gray-400 p-2 text-left">No. Persyaratan + Item</th><th rowSpan={2} className="border border-gray-400 p-2 text-left">Seksi Lokasi</th><th colSpan={2} className="border border-gray-400 p-2 text-center">Ketidaksesuaian (tanda O)</th><th rowSpan={2} className="border border-gray-400 p-2 text-center">Peluang Improvement</th></tr>
          <tr><th className="border border-gray-400 p-2 text-center">Major</th><th className="border border-gray-400 p-2 text-center">Minor</th></tr>
        </thead>
        <tbody>{report.rows.map(row=><tr key={row.finding_id} className="align-top">
          <td className="border border-gray-400 p-2 text-center font-semibold">{row.nomor_urut_temuan}</td>
          <td className="border border-gray-400 p-2 whitespace-pre-wrap">{row.narrative}</td>
          <td className="border border-gray-400 p-2">{row.location||'-'}</td>
          <td className="border border-gray-400 p-2 text-center text-lg font-bold">{row.kategori==='A'?'O':''}</td>
          <td className="border border-gray-400 p-2 text-center text-lg font-bold">{row.kategori==='B'?'O':''}</td>
          <td className="border border-gray-400 p-2 text-center text-lg font-bold">{row.kategori==='C'?'O':''}</td>
        </tr>)}{Array.from({length:Math.max(0,6-report.rows.length)},(_,index)=><tr key={`filler-${index}`} aria-hidden="true" className="report-filler-row hidden">{Array.from({length:6},(_,cellIndex)=><td key={cellIndex} className="border border-gray-400"/>)}</tr>)}</tbody>
      </table>
      <div className="report-document-code mt-2 text-right font-mono text-sm font-bold">{DOCUMENT_CODE}</div>
    </Card>
  </>;
}
