import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ClipboardCheck } from 'lucide-react';
import type { AuditInstructionRow, ChecklistItem } from '../../../lib/types';
import type { HasilChecklist } from '../../../lib/enums';
import { HASIL_CHECKLIST_LABEL, HASIL_CHECKLIST_LIST } from '../../../lib/enums';
import { getChecklistsByRow, getItemsByChecklist, groupItemsBySubProses, saveSystemQuestionExecution } from '../../../services/checklistService';
import { Badge, Button, Card, EmptyState, LoadingSpinner } from '../../ui';
import { Field, Select, Textarea } from '../../ui/Field';

interface Props { row: AuditInstructionRow; readOnly: boolean; onError: (message: string) => void; onChanged?: () => void | Promise<void>; }
interface Draft { hasil: HasilChecklist | null; observation: string; }

export function SystemAuditExecutionPanel({ row, readOnly, onError, onChanged }: Props) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const checklists = await getChecklistsByRow(row.id);
      const loaded = (await Promise.all(checklists.map(checklist => getItemsByChecklist(checklist.id)))).flat();
      setItems(loaded);
      setDrafts(Object.fromEntries(loaded.map(item => [item.id, { hasil: item.hasil as HasilChecklist | null, observation: item.komentar_auditor ?? '' }])));
      setExpanded(new Set(groupItemsBySubProses(loaded).flatMap(group => [group.subProses, ...group.groups.map(element => `${group.subProses}::${element.kelompok}`)])));
    } catch (error) { onError(error instanceof Error ? error.message : 'Gagal memuat pelaksanaan Checklist Sistem'); }
    finally { setLoading(false); }
  }, [row.id, onError]);
  useEffect(() => { void load(); }, [load]);

  function toggle(key: string) { setExpanded(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  async function save(item: ChecklistItem) {
    const draft = drafts[item.id];
    setSavingId(item.id);
    try {
      await saveSystemQuestionExecution(item.id, draft.hasil, draft.observation);
      onError('');
      await load();
      await onChanged?.();
    } catch (error) { onError(error instanceof Error ? error.message : 'Gagal menyimpan hasil pelaksanaan'); }
    finally { setSavingId(null); }
  }

  if (loading) return <LoadingSpinner message="Memuat pertanyaan pelaksanaan..."/>;
  if (!items.length) return <Card className="p-10"><EmptyState icon={<ClipboardCheck size={36}/>} title="Belum ada pertanyaan" message="Siapkan pertanyaan terlebih dahulu di Checklist Audit."/></Card>;
  const grouped = groupItemsBySubProses(items);
  let sequence = 0;
  return <div className="space-y-3"><div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">Pelaksanaan hanya mencatat Hasil Observasi dan Judgement per Pertanyaan Utama. Struktur pertanyaan dikelola di Checklist Audit.</div>{grouped.map(group => <Card key={group.subProses} className="overflow-hidden"><button className="w-full flex items-center gap-2 p-4 bg-gray-50 text-left" onClick={()=>toggle(group.subProses)}>{expanded.has(group.subProses)?<ChevronDown size={17}/>:<ChevronRight size={17}/>}<span className="font-semibold flex-1">{group.subProses}</span><Badge variant="gray">{group.groups.reduce((n,g)=>n+g.items.length,0)} Pertanyaan</Badge></button>{expanded.has(group.subProses)&&<div className="p-3 space-y-3">{group.groups.map(element => {const key=`${group.subProses}::${element.kelompok}`;return <div key={key} className="border rounded-lg"><button className="w-full flex items-center gap-2 p-3 bg-blue-50/50 text-left" onClick={()=>toggle(key)}>{expanded.has(key)?<ChevronDown size={15}/>:<ChevronRight size={15}/>}<span className="font-semibold text-sm flex-1">{element.kelompok}</span><Badge variant="gray">{element.items.length}</Badge></button>{expanded.has(key)&&<div className="divide-y">{element.items.map(item => {sequence += 1; const number=sequence; const draft=drafts[item.id]??{hasil:null,observation:''}; const evaluated=Boolean(draft.hasil&&draft.observation.trim()); return <div key={item.id} className="p-4"><div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_180px_90px] md:gap-4"><div><p className="text-xs text-gray-500 mb-1">{number} / {items.length} · {item.klausul || 'Tanpa Klausul'}</p><p className="font-medium">{item.pertanyaan_utama}</p>{item.sub_pertanyaan.length>0&&<div className="mt-2 text-sm text-gray-600"><p className="font-medium">Sub Pertanyaan:</p><ul className="list-disc ml-5">{item.sub_pertanyaan.map((sub,index)=><li key={index}>{sub.teks}</li>)}</ul></div>}</div><Field label="Hasil Observasi *"><Textarea disabled={readOnly} rows={3} value={draft.observation} onChange={event=>setDrafts({...drafts,[item.id]:{...draft,observation:event.target.value}})} placeholder="Catat bukti atau alasan N-A untuk pertanyaan ini"/></Field><Field label="Judgement *"><Select disabled={readOnly} value={draft.hasil??''} onChange={event=>setDrafts({...drafts,[item.id]:{...draft,hasil:(event.target.value||null) as HasilChecklist|null}})}><option value="">-- Pilih Judgement --</option>{HASIL_CHECKLIST_LIST.map(result=><option key={result} value={result}>{HASIL_CHECKLIST_LABEL[result]}</option>)}</Select></Field><div className="flex md:flex-col items-center md:items-stretch gap-2 mt-3 md:mt-6"><Badge variant={evaluated?'green':'amber'}>{evaluated?'Dinilai':'Belum'}</Badge>{!readOnly&&<Button size="sm" disabled={savingId===item.id} onClick={()=>save(item)}>{savingId===item.id?'Menyimpan...':'Simpan'}</Button>}</div></div></div>})}</div>}</div>})}</div>}</Card>)}</div>;
}
