import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardCheck, RefreshCw } from 'lucide-react';
import type { AuditExecutionSummary } from '../../lib/types';
import { STATUS_PROGRESS, TIPE_BARIS, TIPE_BARIS_LABEL } from '../../lib/enums';
import { completeAuditExecution, listAuditExecutions, reopenAuditExecution } from '../../services/auditExecutionService';
import { Badge, Button, Card, EmptyState, LoadingSpinner } from '../ui';
import { Input, Select } from '../ui/Field';
import { ManufacturingAuditExecutionPanel } from './pelaksanaan/ManufacturingAuditExecutionPanel';
import { ProductAuditExecutionPanel } from './pelaksanaan/ProductAuditExecutionPanel';
import { SystemAuditExecutionPanel } from './pelaksanaan/SystemAuditExecutionPanel';
import { useAuth } from '../../contexts/AuthContext';

const statusVariant = (status: string) => status === STATUS_PROGRESS.ADA_NC ? 'red' : status === STATUS_PROGRESS.TIDAK_ADA_NC ? 'green' : status === STATUS_PROGRESS.BERJALAN ? 'blue' : 'gray';
const date = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID') : '-';

export function PelaksanaanAuditPage() {
  const { profile } = useAuth();
  const canExecute = profile?.identity_type === 'AUDITOR';
  const [items, setItems] = useState<AuditExecutionSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null); const [search, setSearch] = useState('');
  const [type, setType] = useState(''); const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); try { setItems(await listAuditExecutions()); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat Pelaksanaan Audit'); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => items.filter(item => (!search || `${item.row.kode_audit} ${item.proses?.nama_proses ?? ''}`.toLowerCase().includes(search.toLowerCase())) && (!type || item.row.tipe_baris === type) && (!status || item.status_progress === status)), [items, search, type, status]);
  const active = items.find(item => item.row.id === selected);
  const auditorNames = (item: AuditExecutionSummary) => item.team?.members.map(member => member.auditor?.nama).filter(Boolean).join(', ') || '-';
  async function setCompletion(reopen: boolean) { if (!active) return; setBusy(true); setError(null); setSuccess(null); try { if (reopen) await reopenAuditExecution(active.row.id); else await completeAuditExecution(active.row.id); setSuccess(reopen ? `Pelaksanaan ${active.row.kode_audit} berhasil dibuka kembali.` : `Pelaksanaan ${active.row.kode_audit} berhasil diselesaikan.`); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memperbarui penyelesaian audit'); } finally { setBusy(false); } }
  if (loading && !items.length) return <LoadingSpinner message="Memuat Pelaksanaan Audit..." />;
  if (active) return <div className="space-y-4">
    <div className="flex flex-wrap gap-2 justify-between"><Button variant="secondary" onClick={() => { setSelected(null); setSuccess(null); setError(null); }}><ArrowLeft size={14}/> Kembali</Button><Button variant="secondary" onClick={load}><RefreshCw size={14}/> Perbarui Ringkasan</Button></div>
    {error && <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700 whitespace-pre-line">{error}</div>}{success && <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-sm text-green-700">{success}</div>}
    <Card className="p-4 md:p-6"><div className="flex flex-col md:flex-row md:items-start justify-between gap-4"><div><p className="text-xs text-gray-500">Pelaksanaan Audit</p><h1 className="font-mono text-2xl font-bold text-blue-800">{active.row.kode_audit}</h1><p className="font-semibold">{TIPE_BARIS_LABEL[active.row.tipe_baris]} · {active.proses?.nama_proses ?? '-'}</p></div><div className="flex gap-2"><Badge variant={statusVariant(active.status_progress)}>{active.status_progress}</Badge><Badge variant={active.row.cek_selesai ? 'green' : 'amber'}>{active.row.cek_selesai ? 'Selesai' : 'Belum Selesai'}</Badge></div></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-sm"><div><span className="text-gray-500">Auditee</span><p className="font-medium">{active.row.pemilik_proses ?? '-'}</p></div><div><span className="text-gray-500">Tanggal</span><p className="font-medium">{date(active.row.tanggal_pelaksanaan_audit)}</p></div><div><span className="text-gray-500">Tim / Lead</span><p className="font-medium">{active.team ? `${active.team.kode_tim} — ${active.team.nama_tim}` : '-'}</p></div><div><span className="text-gray-500">Auditor</span><p className="font-medium">{auditorNames(active)}</p></div></div>
      <div className="grid grid-cols-4 gap-2 mt-5">{(['O','A','B','C'] as const).map(key => <div key={key} className="rounded-lg bg-gray-50 p-3 text-center"><p className="text-xs text-gray-500">{key}</p><p className="text-xl font-bold">{active.counter[key]}</p></div>)}</div>
    </Card>
    <div className="rounded-xl bg-white overflow-hidden">
      {active.row.tipe_baris === TIPE_BARIS.REGULER && <SystemAuditExecutionPanel row={active.row} readOnly={!canExecute || active.row.cek_selesai} onError={setError} onChanged={load}/>}
      {active.row.tipe_baris === TIPE_BARIS.AUDIT_PRODUK && <ProductAuditExecutionPanel row={active.row} readOnly={!canExecute || active.row.cek_selesai} onError={setError} onChanged={load}/>}
      {(active.row.tipe_baris === TIPE_BARIS.AUDIT_MANUFAKTUR || active.row.tipe_baris === TIPE_BARIS.AUDIT_SHIFT) && <ManufacturingAuditExecutionPanel row={active.row} readOnly={!canExecute || active.row.cek_selesai} onError={setError} onChanged={load}/>}
    </div>
    {active.findings.length > 0 && <Card className="p-4"><h2 className="font-semibold mb-3">Status Temuan / PLOR</h2><div className="grid sm:grid-cols-2 gap-2">{active.findings.map(finding => <div key={finding.id} className="rounded-lg border p-3 text-sm"><div className="flex justify-between"><span className="font-mono">{finding.kode_temuan??finding.draft_reference??'Finding'} · {finding.kategori}</span><Badge variant={finding.plor_complete ? 'green' : 'amber'}>{finding.plor_complete ? 'PLOR Lengkap' : 'PLOR Belum Lengkap'}</Badge></div><div className="mt-1 text-xs text-gray-600"><b>Sumber:</b> {finding.source_label}</div>{finding.disposition&&<div className="mt-2 border-t pt-2 text-xs text-amber-800"><b>Sumber Checklist:</b> {finding.source_label}<br/><b>Hasil efektif:</b> {finding.disposition.effective_judgement} · Finding Annulled<br/><b>Hasil awal:</b> {finding.disposition.initial_judgement}<br/><b>Alasan:</b> {finding.disposition.reason}<br/><b>Ditinjau:</b> {finding.disposition.actor_display_name}, {new Date(finding.disposition.created_at).toLocaleString('id-ID')}</div>}</div>)}</div></Card>}
    {canExecute && <div className="sticky bottom-3 flex justify-end"><Button disabled={busy} variant={active.row.cek_selesai ? 'secondary' : 'primary'} onClick={() => setCompletion(active.row.cek_selesai)}>{busy ? 'Memproses...' : active.row.cek_selesai ? 'Buka Kembali Pelaksanaan' : 'Selesaikan Pelaksanaan'}</Button></div>}
  </div>;
  return <div><div className="mb-6"><h1 className="text-2xl font-bold">Pelaksanaan Audit</h1><p className="text-sm text-gray-500">Workspace eksekusi mobile atas Checklist Audit yang sama, berbasis No. Audit QA.</p></div>{error && <div className="mb-4 p-3 bg-red-50 text-red-700">{error}</div>}
    <Card className="p-4 mb-4"><div className="grid md:grid-cols-3 gap-3"><Input placeholder="Cari QA / proses..." value={search} onChange={e => setSearch(e.target.value)}/><Select value={type} onChange={e => setType(e.target.value)}><option value="">Semua Tipe</option>{Object.entries(TIPE_BARIS_LABEL).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select><Select value={status} onChange={e => setStatus(e.target.value)}><option value="">Semua Status Progress</option>{Object.values(STATUS_PROGRESS).map(value => <option key={value}>{value}</option>)}</Select></div></Card>
    {!filtered.length ? <Card className="p-12"><EmptyState icon={<ClipboardCheck/>} title="Tidak ada pelaksanaan" message="Sesuaikan filter atau siapkan baris Instruksi Audit."/></Card> : <div className="space-y-3">{filtered.map(item => <Card key={item.row.id} className="p-4"><div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between"><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 text-sm"><div><p className="font-mono font-bold text-blue-800">{item.row.kode_audit}</p><p>{TIPE_BARIS_LABEL[item.row.tipe_baris]}</p></div><div><p className="font-medium">{item.proses?.nama_proses ?? '-'}</p><p className="text-gray-500">{item.row.pemilik_proses ?? '-'}</p></div><div><p>{item.team ? `${item.team.kode_tim} — ${item.team.nama_tim}` : '-'}</p><p className="text-gray-500 truncate">{auditorNames(item)}</p></div><div><p>{date(item.row.tanggal_pelaksanaan_audit)}</p><div className="flex gap-1 mt-1"><Badge variant={statusVariant(item.status_progress)}>{item.status_progress}</Badge><Badge variant={item.row.cek_selesai ? 'green' : 'gray'}>{item.row.cek_selesai ? 'Selesai' : 'Terbuka'}</Badge></div></div></div><div className="flex items-center gap-3"><span className="text-sm font-mono whitespace-nowrap">O:{item.counter.O} A:{item.counter.A} B:{item.counter.B} C:{item.counter.C}</span><Button size="sm" onClick={() => { setSelected(item.row.id); setError(null); }}>Buka Pelaksanaan</Button></div></div></Card>)}</div>}
  </div>;
}
