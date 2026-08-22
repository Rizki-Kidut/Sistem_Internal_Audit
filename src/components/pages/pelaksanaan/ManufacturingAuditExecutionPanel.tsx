import { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import type { AuditInstructionRow, ChecklistManufakturItem } from '../../../lib/types';
import type { HasilChecklist } from '../../../lib/enums';
import { HASIL_CHECKLIST_LABEL, HASIL_CHECKLIST_LIST } from '../../../lib/enums';
import { getManufacturingChecklistsByRow, getManufacturingItems, saveManufacturingItemExecution } from '../../../services/checklistManufakturService';
import { Badge, Button, Card, EmptyState, LoadingSpinner } from '../../ui';
import { Field, Select, Textarea } from '../../ui/Field';

interface Props { row: AuditInstructionRow; readOnly: boolean; onError: (message: string) => void; onChanged?: () => void | Promise<void>; }
interface Draft { hasil_pengamatan: string; hasil: HasilChecklist | null; }

export function ManufacturingAuditExecutionPanel({ row, readOnly, onError, onChanged }: Props) {
  const [items, setItems] = useState<ChecklistManufakturItem[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [preparationReady, setPreparationReady] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const checklists = await getManufacturingChecklistsByRow(row.id);
      setPreparationReady(checklists.length > 0 && checklists.every(checklist => checklist.status === 'Selesai'));
      const loaded = (await Promise.all(checklists.map(checklist => getManufacturingItems(checklist.id)))).flat();
      setItems(loaded);
      setDrafts(Object.fromEntries(loaded.map(item => [item.id, { hasil_pengamatan: item.hasil_pengamatan ?? '', hasil: item.hasil }])));
    } catch (error) { onError(error instanceof Error ? error.message : 'Gagal memuat pelaksanaan Manufaktur/Shift'); }
    finally { setLoading(false); }
  }, [row.id, onError]);
  useEffect(() => { void load(); }, [load]);

  async function save(item: ChecklistManufakturItem) {
    if (!preparationReady) return;
    const draft=drafts[item.id]; setSavingId(item.id);
    try { await saveManufacturingItemExecution({ id:item.id, hasil_pengamatan:draft.hasil_pengamatan||null, hasil:draft.hasil }); onError(''); await load(); await onChanged?.(); }
    catch (error) { onError(error instanceof Error ? error.message : 'Gagal menyimpan pelaksanaan Manufaktur/Shift'); }
    finally { setSavingId(null); }
  }
  if (loading) return <LoadingSpinner message="Memuat item pelaksanaan Manufaktur/Shift..."/>;
  if (!items.length) return <Card className="p-10"><EmptyState icon={<ClipboardCheck size={36}/>} title="Belum ada item FORM-007" message="Siapkan struktur dan sinkronkan Bank Checklist melalui Checklist Audit."/></Card>;
  const executionReadOnly = readOnly || !preparationReady;
  return <div className="space-y-3">{!preparationReady && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Checklist Manufaktur/Shift belum Siap Pelaksanaan. Selesaikan persiapan Checklist Audit terlebih dahulu.</div>}<div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Pelaksanaan Genba hanya mencatat Hasil Pengamatan dan Judgement per item. Bank, header, dan struktur FORM-007 dikelola di Checklist Audit.</div>{items.map((item,index)=>{const draft=drafts[item.id];const evaluated=Boolean(draft?.hasil&&draft.hasil_pengamatan.trim());return <Card key={item.id} className="p-4"><div className="grid lg:grid-cols-[minmax(240px,1fr)_minmax(240px,0.9fr)_190px_90px] gap-4"><div><p className="text-xs text-gray-500">{index+1} / {items.length} · {item.bank_item?`${item.bank_item.bagian}-${item.bank_item.nomor}`:'Manual'} · Klausul: {item.bank_item?.klausul||'-'}</p><p className="font-medium mt-1">{item.bank_item?.item_pemeriksaan||'Item manual'}</p><p className="text-xs text-gray-500 mt-1">No. Proses Dicek: {item.no_proses_dicek||'-'}</p></div><Field label="Hasil Pengamatan *"><Textarea disabled={executionReadOnly} rows={4} value={draft?.hasil_pengamatan??''} onChange={event=>setDrafts({...drafts,[item.id]:{...draft,hasil_pengamatan:event.target.value}})} placeholder="Catat bukti atau alasan N-A untuk item ini"/></Field><Field label="Judgement *"><Select disabled={executionReadOnly} value={draft?.hasil??''} onChange={event=>setDrafts({...drafts,[item.id]:{...draft,hasil:(event.target.value||null) as HasilChecklist|null}})}><option value="">-- Pilih Judgement --</option>{HASIL_CHECKLIST_LIST.map(result=><option key={result} value={result}>{HASIL_CHECKLIST_LABEL[result]}</option>)}</Select></Field><div className="flex lg:flex-col gap-2 lg:mt-6"><Badge variant={evaluated?'green':'amber'}>{evaluated?'Dinilai':'Belum'}</Badge>{!executionReadOnly&&<Button size="sm" disabled={savingId===item.id} onClick={()=>save(item)}>{savingId===item.id?'Menyimpan...':'Simpan'}</Button>}</div></div></Card>})}</div>;
}
