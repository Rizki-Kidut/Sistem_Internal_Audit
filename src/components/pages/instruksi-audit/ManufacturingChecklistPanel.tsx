import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import type {
  AuditInstructionRow, Auditor, ChecklistManufakturBankItem, ChecklistManufakturItem,
  ChecklistManufakturShift, JenisChecklistManufakturShift, Plant, Shift,
} from '../../../lib/types';
import {
  CHECKLIST_BANK_STATUS, CHECKLIST_MANUFAKTUR_STATUS, HASIL_CHECKLIST_LABEL,
  HASIL_CHECKLIST_LIST,
} from '../../../lib/enums';
import {
  createManufacturingChecklistFromRow, deactivateManufacturingBankItem,
  deleteManufacturingChecklist, deleteManufacturingItem, getManufacturingBankItems,
  getManufacturingChecklistsByRow, getManufacturingItems, initializeManufacturingItemsFromBank,
  saveManufacturingBankItem, saveManufacturingChecklist, saveManufacturingItem,
} from '../../../services/checklistManufakturService';
import { getPlants, getShifts } from '../../../services/plantService';
import { Badge, Button, Card, EmptyState, LoadingSpinner } from '../../ui';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '../../ui/Field';
import { Modal } from '../../ui/Modal';

interface Props { row: AuditInstructionRow; auditorList: Auditor[]; readOnly: boolean; onError: (message: string) => void }
type DeleteTarget = { type: 'checklist' | 'item' | 'bank'; id: string; label: string } | null;

const emptyManualItem = (checklistId: string): ChecklistManufakturItem => ({
  id: '', checklist_id: checklistId, bank_item_id: null, no_proses_dicek: null,
  hasil_pengamatan: null, hasil: null, finding_id: null, urutan_tampil: 999,
  created_at: '', updated_at: '', bank_item: null,
});
const emptyBank = (): ChecklistManufakturBankItem => ({
  id: '', bagian: '', nomor: '', klausul: null, item_pemeriksaan: null, urutan_tampil: 0,
  status: CHECKLIST_BANK_STATUS.AKTIF, created_at: '', updated_at: '',
});

function resolveAuditorNames(assignments: ChecklistManufakturShift['auditor'], auditorList: Auditor[]): string {
  return assignments
    .map((assignment) => auditorList.find((auditor) => auditor.id === assignment.auditor_id)?.nama ?? assignment.auditor_id)
    .join(', ');
}

export function ManufacturingChecklistPanel({ row, auditorList, readOnly, onError }: Props) {
  const [active, setActive] = useState<ChecklistManufakturShift | null>(null);
  const [draft, setDraft] = useState<ChecklistManufakturShift | null>(null);
  const [items, setItems] = useState<ChecklistManufakturItem[]>([]);
  const [bank, setBank] = useState<ChecklistManufakturBankItem[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editHeader, setEditHeader] = useState(false);
  const [itemForm, setItemForm] = useState<ChecklistManufakturItem | null>(null);
  const [bankForm, setBankForm] = useState<ChecklistManufakturBankItem | null>(null);
  const [bankOpen, setBankOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const fail = useCallback((error: unknown, fallback: string) => onError(error instanceof Error ? error.message : fallback), [onError]);
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getManufacturingChecklistsByRow(row.id);
      setActive((old) => data.find((item) => item.id === old?.id) ?? data[0] ?? null);
    } catch (error) { fail(error, 'Gagal memuat Checklist Manufaktur/Shift'); }
    finally { setLoading(false); }
  }, [row.id, fail]);
  const loadItems = useCallback(async (id: string) => {
    try { setItems(await getManufacturingItems(id)); } catch (error) { fail(error, 'Gagal memuat item checklist'); }
  }, [fail]);
  const loadBank = useCallback(async () => {
    try { setBank(await getManufacturingBankItems()); } catch (error) { fail(error, 'Gagal memuat bank checklist'); }
  }, [fail]);

  useEffect(() => { loadList(); loadBank(); Promise.all([getPlants(), getShifts()]).then(([p, s]) => { setPlants(p); setShifts(s); }).catch((e) => fail(e, 'Gagal memuat Plant/Shift')); }, [loadList, loadBank, fail]);
  useEffect(() => { if (active) { setDraft(active); loadItems(active.id); } else setItems([]); }, [active, loadItems]);

  const suggestions = useMemo(() => row.matriks_manufaktur_shift_marks.map((mark) => ({
    plant_id: mark.plant_id, plant_nama: plants.find((p) => p.id === mark.plant_id)?.nama ?? 'Plant tidak ditemukan',
    shift_id: mark.shift_id, shift_nama: shifts.find((s) => s.id === mark.shift_id)?.nama ?? 'Shift tidak ditemukan',
  })), [row.matriks_manufaktur_shift_marks, plants, shifts]);
  const activeAuditorNames = resolveAuditorNames(active?.auditor ?? [], auditorList);
  const draftAuditorNames = resolveAuditorNames(draft?.auditor ?? [], auditorList);
  const editable = !readOnly && active?.status === CHECKLIST_MANUFAKTUR_STATUS.DRAFT;

  async function createChecklist() { setSaving(true); try { setActive(await createManufacturingChecklistFromRow(row)); await loadList(); } catch (e) { fail(e, 'Gagal membuat checklist'); } finally { setSaving(false); } }
  async function saveHeader(next = draft) { if (!next) return; setSaving(true); try { const saved = await saveManufacturingChecklist(next); setActive(saved); setDraft(saved); setEditHeader(false); await loadList(); } catch (e) { fail(e, 'Gagal menyimpan header'); } finally { setSaving(false); } }
  async function saveItem() { if (!itemForm || !active) return; try { await saveManufacturingItem({ ...itemForm, checklist_id: active.id }); setItemForm(null); await loadItems(active.id); } catch (e) { fail(e, 'Gagal menyimpan item'); } }
  async function saveBank() { if (!bankForm) return; try { await saveManufacturingBankItem(bankForm); setBankForm(null); await loadBank(); } catch (e) { fail(e, 'Gagal menyimpan bank'); } }
  async function syncBank() { if (!active) return; try { await initializeManufacturingItemsFromBank(active.id); await loadItems(active.id); } catch (e) { fail(e, 'Gagal menambahkan item bank'); } }
  async function confirmDelete() { if (!deleteTarget) return; try {
    if (deleteTarget.type === 'checklist') { await deleteManufacturingChecklist(deleteTarget.id); setActive(null); await loadList(); }
    if (deleteTarget.type === 'item' && active) { await deleteManufacturingItem(deleteTarget.id); await loadItems(active.id); }
    if (deleteTarget.type === 'bank') { await deactivateManufacturingBankItem(deleteTarget.id); await loadBank(); }
    setDeleteTarget(null);
  } catch (e) { fail(e, 'Gagal menghapus/menonaktifkan data'); } }

  if (loading) return <LoadingSpinner message="Memuat Checklist Manufaktur/Shift..." />;
  if (!active || !draft) return <Card className="p-12"><EmptyState icon={<ClipboardCheck size={40} />} title="Belum ada Checklist Manufaktur/Shift" message="Header dan item bank akan dibuat dari baris Instruksi Audit QA yang sama." action={!readOnly ? <Button onClick={createChecklist} disabled={saving}><Plus size={14} /> Buat Checklist</Button> : undefined} /></Card>;

  return <div className="space-y-4">
    <Card className="p-4"><div className="flex justify-between gap-3 flex-wrap"><div><div className="flex gap-2 items-center"><Badge variant="blue">{active.kode_audit}</Badge><Badge variant={active.status === 'Selesai' ? 'green' : 'gray'}>{active.status}</Badge></div><p className="text-xs text-gray-500 mt-1">{active.kode_dokumen}</p></div><div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={() => setBankOpen(true)}><Settings size={14} /> Bank Manufaktur</Button>
      {!readOnly && active.status === 'Selesai' && <Button size="sm" onClick={() => saveHeader({ ...active, status: CHECKLIST_MANUFAKTUR_STATUS.DRAFT })}>Kembalikan ke Draft</Button>}
      {editable && <><Button size="sm" variant="secondary" onClick={() => setEditHeader(true)}><Pencil size={14} /> Edit Header</Button><Button size="sm" onClick={() => saveHeader({ ...active, status: CHECKLIST_MANUFAKTUR_STATUS.SELESAI })}>Tandai Selesai</Button><Button size="sm" variant="ghost" onClick={() => setDeleteTarget({ type: 'checklist', id: active.id, label: 'checklist ini' })}><Trash2 size={14} /></Button></>}
    </div></div>
      <div className="grid md:grid-cols-3 gap-3 mt-4 text-sm">{[
        ['Jenis Checklist', active.jenis_checklist.map((j) => `${j.plant_nama} / ${j.shift_nama}`).join(', ') || '-'], ['Nama Seksi', active.nama_seksi || '-'], ['Manager Proses / Line Leader', active.manager_proses_line_leader || '-'], ['Tanggal Audit', active.tanggal_audit || '-'], ['Auditor', activeAuditorNames || '-'], ['Nama Part', active.nama_part || '-'], ['Nomor Part', active.nomor_part || '-'], ['Nomor Line', active.nomor_line || '-'], ['Control Plan No.', active.control_plan_no || '-'], ['P-FMEA No.', active.p_fmea_no || '-'], ['Customer', active.customer || '-'], ['Jumlah Operator', active.jumlah_operator ?? '-'],
      ].map(([label, value]) => <div key={label as string}><div className="text-xs text-gray-500">{label}</div><div>{value}</div></div>)}</div>
    </Card>
    <Card className="overflow-x-auto"><div className="p-4 flex justify-between"><h3 className="font-semibold">Item Checklist ({items.length})</h3>{editable && <div className="flex gap-2"><Button size="sm" variant="secondary" onClick={syncBank}>Sinkronkan Bank Aktif</Button><Button size="sm" onClick={() => setItemForm(emptyManualItem(active.id))}><Plus size={14} /> Item Manual</Button></div>}</div><table className="min-w-[1000px] w-full text-xs"><thead><tr className="bg-gray-50 text-left">{['No.','Klausul','Item Pemeriksaan','No. Proses Dicek','Hasil Pengamatan','Hasil','Aksi'].map((h) => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{item.bank_item ? `${item.bank_item.bagian}-${item.bank_item.nomor}` : 'Manual'}</td><td className="p-3">{item.bank_item?.klausul || '-'}</td><td className="p-3">{item.bank_item?.item_pemeriksaan || <span className="text-amber-600">Belum dilengkapi di bank</span>}</td><td className="p-3">{item.no_proses_dicek || '-'}</td><td className="p-3 whitespace-pre-wrap">{item.hasil_pengamatan || '-'}</td><td className="p-3">{item.hasil && <Badge variant={item.hasil === 'O' ? 'green' : item.hasil === 'N-A' ? 'gray' : 'amber'}>{item.hasil}</Badge>}</td><td className="p-3">{editable && <><button className="text-blue-600 mr-3" onClick={() => setItemForm(item)}><Pencil size={14} /></button><button className="text-red-500" onClick={() => setDeleteTarget({ type: 'item', id: item.id, label: 'item ini' })}><Trash2 size={14} /></button></>}</td></tr>)}</tbody></table></Card>

    <Modal open={editHeader} onClose={() => setEditHeader(false)} title="Edit Header Checklist Manufaktur/Shift" size="xl" footer={<><Button variant="secondary" onClick={() => setEditHeader(false)}>Batal</Button><Button onClick={() => saveHeader()}>Simpan</Button></>}><HeaderForm draft={draft} suggestions={suggestions} onChange={setDraft} auditorNames={draftAuditorNames} /></Modal>
    <Modal open={!!itemForm} onClose={() => setItemForm(null)} title="Edit Item Checklist" footer={<><Button variant="secondary" onClick={() => setItemForm(null)}>Batal</Button><Button onClick={saveItem}>Simpan</Button></>}>{itemForm && <div className="space-y-3"><Field label="No. Proses Dicek"><Input value={itemForm.no_proses_dicek ?? ''} onChange={(e) => setItemForm({ ...itemForm, no_proses_dicek: e.target.value || null })} /></Field><Field label="Hasil Pengamatan"><Textarea rows={4} value={itemForm.hasil_pengamatan ?? ''} onChange={(e) => setItemForm({ ...itemForm, hasil_pengamatan: e.target.value || null })} /></Field><Field label="Hasil"><Select value={itemForm.hasil ?? ''} onChange={(e) => setItemForm({ ...itemForm, hasil: (e.target.value || null) as ChecklistManufakturItem['hasil'] })}><option value="">— Belum dinilai —</option>{HASIL_CHECKLIST_LIST.map((h) => <option key={h} value={h}>{HASIL_CHECKLIST_LABEL[h]}</option>)}</Select></Field></div>}</Modal>
    <Modal open={bankOpen} onClose={() => setBankOpen(false)} title="Bank Checklist Manufaktur" size="xl"><div className="flex justify-end mb-3">{!readOnly && <Button size="sm" onClick={() => setBankForm(emptyBank())}><Plus size={14} /> Tambah</Button>}</div><div className="max-h-96 overflow-auto"><table className="w-full text-xs"><thead><tr className="bg-gray-50 text-left"><th className="p-2">Nomor</th><th>Klausul</th><th>Item Pemeriksaan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{bank.map((item) => <tr key={item.id} className="border-t"><td className="p-2">{item.bagian}-{item.nomor}</td><td>{item.klausul || '-'}</td><td>{item.item_pemeriksaan || 'Belum dilengkapi'}</td><td>{item.status}</td><td>{!readOnly && <><button className="text-blue-600 mr-2" onClick={() => setBankForm(item)}><Pencil size={13} /></button>{item.status === 'Aktif' && <button className="text-red-500" onClick={() => setDeleteTarget({ type: 'bank', id: item.id, label: `${item.bagian}-${item.nomor}` })}><Trash2 size={13} /></button>}</>}</td></tr>)}</tbody></table></div></Modal>
    <Modal open={!!bankForm} onClose={() => setBankForm(null)} title="Edit Bank Checklist" footer={<><Button variant="secondary" onClick={() => setBankForm(null)}>Batal</Button><Button onClick={saveBank}>Simpan</Button></>}>{bankForm && <BankForm item={bankForm} onChange={setBankForm} />}</Modal>
    <ConfirmDialog open={!!deleteTarget} title={deleteTarget?.type === 'bank' ? 'Nonaktifkan Bank Item' : 'Hapus Data'} message={`Yakin memproses ${deleteTarget?.label}?`} confirmLabel="Ya" onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
  </div>;
}

function HeaderForm({ draft, suggestions, auditorNames, onChange }: { draft: ChecklistManufakturShift; suggestions: JenisChecklistManufakturShift[]; auditorNames: string; onChange: (value: ChecklistManufakturShift) => void }) {
  const availableEntries = Array.from(
    [...draft.jenis_checklist, ...suggestions].reduce((entries, entry) => {
      const key = `${entry.plant_id}:${entry.shift_id}`;
      if (!entries.has(key)) entries.set(key, entry);
      return entries;
    }, new Map<string, JenisChecklistManufakturShift>()).values(),
  );
  const selected = new Set(draft.jenis_checklist.map((entry) => `${entry.plant_id}:${entry.shift_id}`));
  const toggle = (entry: JenisChecklistManufakturShift) => onChange({ ...draft, jenis_checklist: selected.has(`${entry.plant_id}:${entry.shift_id}`) ? draft.jenis_checklist.filter((item) => item.plant_id !== entry.plant_id || item.shift_id !== entry.shift_id) : [...draft.jenis_checklist, entry] });
  const text = (key: keyof ChecklistManufakturShift) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...draft, [key]: e.target.value || null });
  return <div className="grid md:grid-cols-2 gap-3"><Field label="Kode Audit"><Input value={draft.kode_audit} readOnly /></Field><Field label="Kode Dokumen"><Input value={draft.kode_dokumen} readOnly /></Field><Field label="Jenis Checklist" className="md:col-span-2"><div className="flex gap-3 flex-wrap">{availableEntries.map((entry) => <label key={`${entry.plant_id}:${entry.shift_id}`} className="text-sm"><input type="checkbox" className="mr-1" checked={selected.has(`${entry.plant_id}:${entry.shift_id}`)} onChange={() => toggle(entry)} /> {entry.plant_nama} / {entry.shift_nama}</label>)}</div></Field><Field label="Nama Seksi"><Input value={draft.nama_seksi ?? ''} onChange={text('nama_seksi')} /></Field><Field label="Manager Proses / Line Leader"><Input value={draft.manager_proses_line_leader ?? ''} readOnly /></Field><Field label="Tanggal Audit"><Input type="date" value={draft.tanggal_audit ?? ''} readOnly /></Field><Field label="Auditor"><Input value={auditorNames} readOnly /></Field>{[['nama_part','Nama Part'],['nomor_part','Nomor Part'],['nomor_line','Nomor Line'],['control_plan_no','Control Plan No.'],['p_fmea_no','P-FMEA No.'],['customer','Customer']].map(([key, label]) => <Field key={key} label={label}><Input value={(draft[key as keyof ChecklistManufakturShift] as string | null) ?? ''} onChange={text(key as keyof ChecklistManufakturShift)} /></Field>)}<Field label="Jumlah Operator"><Input type="number" min="0" value={draft.jumlah_operator ?? ''} onChange={(e) => onChange({ ...draft, jumlah_operator: e.target.value === '' ? null : Number(e.target.value) })} /></Field></div>;
}

function BankForm({ item, onChange }: { item: ChecklistManufakturBankItem; onChange: (value: ChecklistManufakturBankItem) => void }) {
  return <div className="grid grid-cols-2 gap-3"><Field label="Bagian" required><Input value={item.bagian} onChange={(e) => onChange({ ...item, bagian: e.target.value })} /></Field><Field label="Nomor" required><Input value={item.nomor} onChange={(e) => onChange({ ...item, nomor: e.target.value })} /></Field><Field label="Klausul"><Input value={item.klausul ?? ''} onChange={(e) => onChange({ ...item, klausul: e.target.value || null })} /></Field><Field label="Urutan"><Input type="number" value={item.urutan_tampil} onChange={(e) => onChange({ ...item, urutan_tampil: Number(e.target.value) })} /></Field><Field label="Item Pemeriksaan" className="col-span-2"><Textarea rows={4} value={item.item_pemeriksaan ?? ''} onChange={(e) => onChange({ ...item, item_pemeriksaan: e.target.value || null })} /></Field><Field label="Status"><Select value={item.status} onChange={(e) => onChange({ ...item, status: e.target.value as ChecklistManufakturBankItem['status'] })}><option>Aktif</option><option>Nonaktif</option></Select></Field></div>;
}
