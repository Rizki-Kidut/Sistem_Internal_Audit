import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import type { AuditInstructionRow, ChecklistProdukItem } from '../../../lib/types';
import type { JudgmentProduk, KategoriTemuan } from '../../../lib/enums';
import { JUDGMENT_PRODUK, JUDGMENT_PRODUK_LIST } from '../../../lib/enums';
import {
  getProductChecklistsByRow, getProductItemsByPhase, getProductPhases,
  saveProductItemExecution,
} from '../../../services/checklistProdukService';
import { Badge, Button, Card, EmptyState, LoadingSpinner } from '../../ui';
import { Field, Input, Select, Textarea } from '../../ui/Field';

interface Props { row: AuditInstructionRow; readOnly: boolean; onError: (message: string) => void; onChanged?: () => void | Promise<void>; }
interface ExecutionDraft { jumlah_sampel: number | null; hasil_pemeriksaan: string; judgment: JudgmentProduk | null; finding_kategori: KategoriTemuan | null; }
interface PhaseItems { id: string; name: string; process: string | null; standard: string | null; items: ChecklistProdukItem[]; }

export function ProductAuditExecutionPanel({ row, readOnly, onError, onChanged }: Props) {
  const [phases, setPhases] = useState<PhaseItems[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ExecutionDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const checklists = await getProductChecklistsByRow(row.id);
      const phaseRecords = (await Promise.all(checklists.map(checklist => getProductPhases(checklist.id)))).flat();
      const itemGroups = await Promise.all(phaseRecords.map(phase => getProductItemsByPhase(phase.id)));
      setPhases(phaseRecords.map((phase, index) => ({ id: phase.id, name: phase.nama_fase, process: phase.nama_proses, standard: phase.no_inspection_standard, items: itemGroups[index] })));
      setDrafts(Object.fromEntries(itemGroups.flat().map(item => [item.id, {
        jumlah_sampel: item.jumlah_sampel,
        hasil_pemeriksaan: item.hasil_pemeriksaan ?? '',
        judgment: item.judgment,
        finding_kategori: item.finding_kategori,
      }])));
    } catch (error) { onError(error instanceof Error ? error.message : 'Gagal memuat pelaksanaan Audit Produk'); }
    finally { setLoading(false); }
  }, [row.id, onError]);
  useEffect(() => { void load(); }, [load]);

  async function save(item: ChecklistProdukItem) {
    const draft = drafts[item.id];
    setSavingId(item.id);
    try {
      await saveProductItemExecution({ id: item.id, ...draft, hasil_pemeriksaan: draft.hasil_pemeriksaan || null });
      onError(''); await load(); await onChanged?.();
    } catch (error) { onError(error instanceof Error ? error.message : 'Gagal menyimpan pelaksanaan Produk'); }
    finally { setSavingId(null); }
  }

  if (loading) return <LoadingSpinner message="Memuat item pelaksanaan Produk..."/>;
  if (!phases.some(phase => phase.items.length)) return <Card className="p-10"><EmptyState icon={<ClipboardCheck size={36}/>} title="Belum ada item Produk" message="Siapkan fase dan item pemeriksaan terlebih dahulu di Checklist Audit."/></Card>;
  return <div className="space-y-4"><div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Pelaksanaan Produk hanya mencatat sampel aktual, hasil pemeriksaan, dan Judgment. Struktur inspeksi dikelola di Checklist Audit.</div>{phases.map(phase => <Card key={phase.id} className="overflow-hidden"><div className="p-4 bg-gray-50 border-b"><h3 className="font-semibold">{phase.name}</h3><p className="text-xs text-gray-500">{phase.process || '-'} · Inspection Standard: {phase.standard || '-'}</p></div><div className="divide-y">{phase.items.map(item => { const draft=drafts[item.id]; const evaluated=Boolean(draft?.judgment&&draft.hasil_pemeriksaan.trim()); return <div key={item.id} className="p-4"><div className="grid lg:grid-cols-[minmax(220px,1fr)_130px_minmax(220px,0.8fr)_170px_170px_90px] gap-3 items-start"><div><p className="text-xs text-gray-500">{item.kategori || 'Tanpa kategori'} · Sampel minimal: {item.jumlah_sampel_minimal ?? '-'}</p><p className="font-medium mt-1">{item.item_pemeriksaan}</p><p className="text-xs text-gray-500 mt-1">Alat: {item.alat_pemeriksaan || '-'} · Standar/Kriteria: {item.standar_kriteria || '-'}</p></div><Field label="Sampel Aktual"><Input disabled={readOnly} type="number" min="0" value={draft?.jumlah_sampel ?? ''} onChange={event=>setDrafts({...drafts,[item.id]:{...draft,jumlah_sampel:event.target.value===''?null:Number(event.target.value)}})}/></Field><Field label="Hasil Pemeriksaan *"><Textarea disabled={readOnly} rows={3} value={draft?.hasil_pemeriksaan ?? ''} onChange={event=>setDrafts({...drafts,[item.id]:{...draft,hasil_pemeriksaan:event.target.value}})}/></Field><Field label="Judgment *"><Select disabled={readOnly} value={draft?.judgment ?? ''} onChange={event=>{const judgment=(event.target.value||null) as JudgmentProduk|null;setDrafts({...drafts,[item.id]:{...draft,judgment,finding_kategori:judgment===JUDGMENT_PRODUK.NG?draft.finding_kategori:null}})}}><option value="">-- Pilih Judgment --</option>{JUDGMENT_PRODUK_LIST.map(value=><option key={value}>{value}</option>)}</Select></Field><Field label="Kategori Temuan"><Select disabled={readOnly||draft?.judgment!==JUDGMENT_PRODUK.NG} value={draft?.finding_kategori??''} onChange={event=>setDrafts({...drafts,[item.id]:{...draft,finding_kategori:(event.target.value||null) as KategoriTemuan|null}})}><option value="">-- Pilih --</option><option value="A">A — Major</option><option value="B">B — Minor</option><option value="C">C — OFI</option></Select></Field><div className="flex lg:flex-col gap-2 lg:mt-6"><Badge variant={evaluated?'green':'amber'}>{evaluated?'Dinilai':'Belum'}</Badge>{!readOnly&&<Button size="sm" disabled={savingId===item.id} onClick={()=>save(item)}>{savingId===item.id?'Menyimpan...':'Simpan'}</Button>}</div></div></div>})}</div></Card>)}</div>;
}
