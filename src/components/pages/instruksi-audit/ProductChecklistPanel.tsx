import { useCallback, useEffect, useState } from 'react';
import { FileText, Pencil, Plus, Trash2, Upload, ExternalLink } from 'lucide-react';
import type {
  AuditInstructionRow, ChecklistProduk, ChecklistProdukFase, ChecklistProdukItem,
  ProductChecklistEvidence,
} from '../../../lib/types';
import { CHECKLIST_PRODUK_STATUS, JUDGMENT_PRODUK, JUDGMENT_PRODUK_LIST } from '../../../lib/enums';
import {
  createProductChecklistFromRow, deleteProductChecklist, deleteProductEvidence,
  deleteProductItem, deleteProductPhase, getProductChecklistsByRow,
  getProductEvidenceSignedUrl, getProductItemsByPhase, getProductPhases,
  saveProductChecklist, saveProductItem, saveProductPhase, uploadProductEvidence,
} from '../../../services/checklistProdukService';
import { Badge, Button, Card, EmptyState, LoadingSpinner } from '../../ui';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '../../ui/Field';
import { Modal } from '../../ui/Modal';

interface Props { row: AuditInstructionRow; readOnly: boolean; onError: (message: string) => void }
type DeleteTarget = { type: 'checklist' | 'phase' | 'item'; id: string; label: string } | null;

const emptyPhase = (checklistId: string): ChecklistProdukFase => ({
  id: '', checklist_produk_id: checklistId, nama_fase: '', nama_proses: null,
  inspection_result_chart: false, no_inspection_standard: null, dokumen_bukti: [],
  urutan_tampil: 0, created_at: '', updated_at: '',
});
const emptyItem = (phaseId: string): ChecklistProdukItem => ({
  id: '', fase_id: phaseId, kategori: null, jumlah_sampel_minimal: null,
  item_pemeriksaan: '', alat_pemeriksaan: null, standar_kriteria: null,
  jumlah_sampel: null, hasil_pemeriksaan: null, judgment: null, finding_id: null, finding_kategori: null,
  urutan_tampil: 0, created_at: '', updated_at: '',
});
const displaySize = (size: number) => size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;

export function ProductChecklistPanel({ row, readOnly, onError }: Props) {
  const [checklists, setChecklists] = useState<ChecklistProduk[]>([]);
  const [active, setActive] = useState<ChecklistProduk | null>(null);
  const [phases, setPhases] = useState<ChecklistProdukFase[]>([]);
  const [items, setItems] = useState<Record<string, ChecklistProdukItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState<ChecklistProduk | null>(null);
  const [phaseForm, setPhaseForm] = useState<ChecklistProdukFase | null>(null);
  const [itemForm, setItemForm] = useState<ChecklistProdukItem | null>(null);
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const fail = useCallback((error: unknown, fallback: string) => {
    onError(error instanceof Error ? error.message : fallback);
  }, [onError]);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProductChecklistsByRow(row.id);
      setChecklists(data);
      setActive((previous) => data.find((item) => item.id === previous?.id) ?? data[0] ?? null);
    } catch (error) { fail(error, 'Gagal memuat Checklist Audit Produk'); }
    finally { setLoading(false); }
  }, [row.id, fail]);

  const loadDetails = useCallback(async (checklist: ChecklistProduk) => {
    try {
      const phaseData = await getProductPhases(checklist.id);
      const itemLists = await Promise.all(phaseData.map((phase) => getProductItemsByPhase(phase.id)));
      setPhases(phaseData);
      setItems(Object.fromEntries(phaseData.map((phase, index) => [phase.id, itemLists[index]])));
    } catch (error) { fail(error, 'Gagal memuat detail Checklist Audit Produk'); }
  }, [fail]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    if (active) { setHeaderDraft(active); loadDetails(active); }
    else { setPhases([]); setItems({}); }
  }, [active, loadDetails]);

  const editable = !readOnly && active?.status === CHECKLIST_PRODUK_STATUS.DRAFT;

  async function createChecklist() {
    setSaving(true);
    try { const created = await createProductChecklistFromRow(row); await loadList(); setActive(created); }
    catch (error) { fail(error, 'Gagal membuat Checklist Audit Produk'); }
    finally { setSaving(false); }
  }

  async function saveHeader(next = headerDraft) {
    if (!next) return;
    setSaving(true);
    try {
      const saved = await saveProductChecklist(next);
      setActive(saved); setEditingHeader(false); await loadList();
    } catch (error) { fail(error, 'Gagal menyimpan header'); }
    finally { setSaving(false); }
  }

  async function changeStatus(status: ChecklistProduk['status']) {
    if (!active) return;
    await saveHeader({ ...active, status });
  }

  async function savePhase() {
    if (!phaseForm || !active) return;
    try { await saveProductPhase({ ...phaseForm, checklist_produk_id: active.id }); setPhaseForm(null); await loadDetails(active); }
    catch (error) { fail(error, 'Gagal menyimpan fase'); }
  }

  async function saveItem() {
    if (!itemForm || !active) return;
    try { await saveProductItem(itemForm); setItemSaveError(null); onError(''); setItemForm(null); await loadDetails(active); }
    catch (error) { setItemSaveError(error instanceof Error?error.message:'Gagal menyimpan item');fail(error, 'Gagal menyimpan item'); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'checklist') { await deleteProductChecklist(deleteTarget.id); setActive(null); await loadList(); }
      if (deleteTarget.type === 'phase' && active) { await deleteProductPhase(deleteTarget.id); await loadDetails(active); }
      if (deleteTarget.type === 'item' && active) { await deleteProductItem(deleteTarget.id); await loadDetails(active); }
      setDeleteTarget(null);
    } catch (error) { fail(error, 'Gagal menghapus data'); }
  }

  async function upload(phase: ChecklistProdukFase, file?: File) {
    if (!active || !file) return;
    try { await uploadProductEvidence(active.id, phase.id, file); await loadDetails(active); }
    catch (error) { fail(error, 'Gagal mengunggah dokumen bukti'); }
  }

  async function removeEvidence(phase: ChecklistProdukFase, evidence: ProductChecklistEvidence) {
    if (!active) return;
    try { await deleteProductEvidence(phase, evidence); await loadDetails(active); }
    catch (error) { fail(error, 'Gagal menghapus dokumen bukti'); }
  }

  async function openEvidence(path: string) {
    try { window.open(await getProductEvidenceSignedUrl(path), '_blank', 'noopener,noreferrer'); }
    catch (error) { fail(error, 'Gagal membuka dokumen bukti'); }
  }

  if (loading) return <LoadingSpinner message="Memuat Checklist Audit Produk..." />;
  if (checklists.length === 0) return (
    <Card className="p-12"><EmptyState icon={<FileText size={40} />} title="Belum ada Checklist Audit Produk"
      message="Data inspector akan diwarisi dari baris Instruksi Audit yang sama."
      action={!readOnly ? <Button onClick={createChecklist} disabled={saving}><Plus size={14} /> Buat Checklist Audit Produk</Button> : undefined} /></Card>
  );
  if (!active || !headerDraft) return null;

  return <div className="space-y-4">
    {checklists.length > 1 && <Card className="p-3 flex gap-2 flex-wrap">{checklists.map((checklist) =>
      <Button key={checklist.id} size="sm" variant={active.id === checklist.id ? 'primary' : 'secondary'} onClick={() => setActive(checklist)}>{checklist.kode_audit}</Button>)}</Card>}
    <Card className="overflow-hidden">
      <div className="p-4 bg-gray-50 border-b border-gray-200">
        <div className="flex justify-between gap-3 items-center mb-4">
          <div className="flex gap-2 items-center"><Badge variant="blue">{active.kode_audit}</Badge><Badge variant={active.status === 'Selesai' ? 'green' : 'amber'}>{active.status}</Badge></div>
          <div className="flex gap-2">
            {!readOnly && active.status === 'Selesai' && <Button size="sm" variant="secondary" onClick={() => changeStatus(CHECKLIST_PRODUK_STATUS.DRAFT)}>Kembalikan ke Draft</Button>}
            {editable && <><Button size="sm" variant="ghost" onClick={() => setEditingHeader(true)}><Pencil size={14} /> Edit Header</Button><Button size="sm" onClick={() => changeStatus(CHECKLIST_PRODUK_STATUS.SELESAI)}>Tandai Selesai</Button></>}
          </div>
        </div>
        {!active.nama_inspector && <div className="mb-3 p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-700">Nama Inspector belum tersedia. Lengkapi Nama Auditor Produk pada baris Instruksi Audit.</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {[['Kode Dokumen', active.kode_dokumen], ['Nama Inspector', active.nama_inspector], ['Kualifikasi Inspector', active.kualifikasi_inspector], ['Part Name', active.part_name], ['Part No', active.part_no], ['Control Plan No', active.control_plan_no]].map(([label, value]) =>
            <div key={label ?? ''}><span className="text-gray-400 block">{label}</span><span className="text-gray-700">{value || '-'}</span></div>)}
        </div>
      </div>
      <div className="p-4 space-y-4">
        <div className="flex justify-between"><h3 className="font-semibold text-gray-900">Fase Pemeriksaan ({phases.length})</h3>{editable && <Button size="sm" onClick={() => setPhaseForm(emptyPhase(active.id))}><Plus size={14} /> Tambah Fase</Button>}</div>
        {phases.length === 0 && <p className="text-sm text-gray-400 text-center py-5">Belum ada fase. Checklist tidak dapat diselesaikan sebelum fase dan bukti tersedia.</p>}
        {phases.map((phase) => <PhaseCard key={phase.id} phase={phase} items={items[phase.id] ?? []} editable={editable}
          onEdit={() => setPhaseForm(phase)} onDelete={() => setDeleteTarget({ type: 'phase', id: phase.id, label: phase.nama_fase })}
          onAddItem={() => {setItemSaveError(null);setItemForm(emptyItem(phase.id));}} onEditItem={(item)=>{setItemSaveError(null);setItemForm(item);}}
          onDeleteItem={(item) => setDeleteTarget({ type: 'item', id: item.id, label: item.item_pemeriksaan })}
          onUpload={(file) => upload(phase, file)} onOpen={openEvidence} onDeleteEvidence={(evidence) => removeEvidence(phase, evidence)} />)}
      </div>
    </Card>
    {editable && <div className="flex justify-end"><Button variant="danger" size="sm" onClick={() => setDeleteTarget({ type: 'checklist', id: active.id, label: active.kode_audit })}><Trash2 size={14} /> Hapus Checklist</Button></div>}

    <Modal open={editingHeader} onClose={() => { setEditingHeader(false); setHeaderDraft(active); }} title="Edit Header Checklist Audit Produk" footer={<><Button variant="secondary" onClick={() => setEditingHeader(false)}>Batal</Button><Button onClick={() => saveHeader()}>Simpan</Button></>}>
      <div className="space-y-3"><Field label="Nama Inspector (dari Instruksi Audit)"><Input value={headerDraft.nama_inspector ?? ''} disabled /></Field><Field label="Kualifikasi Inspector (dari Instruksi Audit)"><Input value={headerDraft.kualifikasi_inspector ?? ''} disabled /></Field>
        <Field label="Part Name"><Input value={headerDraft.part_name ?? ''} onChange={(e) => setHeaderDraft({ ...headerDraft, part_name: e.target.value || null })} /></Field><Field label="Part No"><Input value={headerDraft.part_no ?? ''} onChange={(e) => setHeaderDraft({ ...headerDraft, part_no: e.target.value || null })} /></Field><Field label="Control Plan No"><Input value={headerDraft.control_plan_no ?? ''} onChange={(e) => setHeaderDraft({ ...headerDraft, control_plan_no: e.target.value || null })} /></Field></div>
    </Modal>
    <Modal open={!!phaseForm} onClose={() => setPhaseForm(null)} title={phaseForm?.id ? 'Edit Fase' : 'Tambah Fase'} footer={<><Button variant="secondary" onClick={() => setPhaseForm(null)}>Batal</Button><Button onClick={savePhase}>Simpan</Button></>}>
      {phaseForm && <div className="space-y-3"><Field label="Nama Fase" required><Input value={phaseForm.nama_fase} onChange={(e) => setPhaseForm({ ...phaseForm, nama_fase: e.target.value })} /></Field><Field label="Nama Proses"><Input value={phaseForm.nama_proses ?? ''} onChange={(e) => setPhaseForm({ ...phaseForm, nama_proses: e.target.value || null })} /></Field><Field label="No. Inspection Standard"><Input value={phaseForm.no_inspection_standard ?? ''} onChange={(e) => setPhaseForm({ ...phaseForm, no_inspection_standard: e.target.value || null })} /></Field><label className="flex gap-2 text-sm"><input type="checkbox" checked={phaseForm.inspection_result_chart} onChange={(e) => setPhaseForm({ ...phaseForm, inspection_result_chart: e.target.checked })} /> Inspection Result Chart</label></div>}
    </Modal>
    <Modal open={!!itemForm} onClose={() => {setItemForm(null);setItemSaveError(null);}} title={itemForm?.id ? 'Edit Item Pemeriksaan' : 'Tambah Item Pemeriksaan'} size="lg" footer={<><Button variant="secondary" onClick={() => {setItemForm(null);setItemSaveError(null);}}>Batal</Button><Button onClick={saveItem}>Simpan</Button></>}>
      {itemSaveError&&<div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700"><p className="font-semibold text-sm">Gagal menyimpan Checklist</p><p className="text-sm mt-1">{itemSaveError}</p></div>}
      {itemForm && <ItemForm item={itemForm} onChange={setItemForm} />}
    </Modal>
    <ConfirmDialog open={!!deleteTarget} title="Hapus Data" message={`Yakin ingin menghapus ${deleteTarget?.label}?`} confirmLabel="Hapus" onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
  </div>;
}

function PhaseCard({ phase, items, editable, onEdit, onDelete, onAddItem, onEditItem, onDeleteItem, onUpload, onOpen, onDeleteEvidence }: {
  phase: ChecklistProdukFase; items: ChecklistProdukItem[]; editable: boolean; onEdit: () => void; onDelete: () => void;
  onAddItem: () => void; onEditItem: (item: ChecklistProdukItem) => void; onDeleteItem: (item: ChecklistProdukItem) => void;
  onUpload: (file?: File) => void; onOpen: (path: string) => void; onDeleteEvidence: (evidence: ProductChecklistEvidence) => void;
}) {
  return <div className="border border-gray-200 rounded-lg overflow-hidden"><div className="p-3 bg-gray-50 flex justify-between gap-3"><div><div className="font-medium text-gray-900">{phase.nama_fase}</div><div className="text-xs text-gray-500">{phase.nama_proses || '-'} · Chart: {phase.inspection_result_chart ? 'Ya' : 'Tidak'} · Standard: {phase.no_inspection_standard || '-'}</div></div>{editable && <div className="flex"><Button size="sm" variant="ghost" onClick={onEdit}><Pencil size={13} /></Button><Button size="sm" variant="ghost" onClick={onDelete}><Trash2 size={13} /></Button></div>}</div>
    <div className="p-3 border-b border-gray-100"><div className="flex justify-between mb-2"><div className="text-sm font-medium">Dokumen Bukti {phase.dokumen_bukti.length === 0 && <Badge variant="amber">Dokumen bukti belum tersedia</Badge>}</div>{editable && <label className="inline-flex items-center gap-1 text-xs text-blue-600 cursor-pointer"><Upload size={13} /> Upload<input type="file" className="hidden" onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ''; }} /></label>}</div>
      <div className="space-y-1">{phase.dokumen_bukti.map((evidence) => <div key={evidence.path} className="flex justify-between text-xs bg-gray-50 rounded p-2"><span>{evidence.name} · {evidence.mime_type || 'file'} · {displaySize(evidence.size)}</span><span className="flex gap-2"><button className="text-blue-600" onClick={() => onOpen(evidence.path)}><ExternalLink size={13} /></button>{editable && <button className="text-red-500" onClick={() => onDeleteEvidence(evidence)}><Trash2 size={13} /></button>}</span></div>)}</div></div>
    <div className="p-3 overflow-x-auto"><div className="flex justify-between mb-2"><span className="text-sm font-medium">Item Pemeriksaan ({items.length})</span>{editable && <Button size="sm" onClick={onAddItem}><Plus size={13} /> Tambah Item</Button>}</div><table className="min-w-[1100px] w-full text-xs"><thead><tr className="bg-gray-50 text-left">{['Kategori','Sampel Minimal','Item Pemeriksaan','Alat','Standar/Kriteria','Jumlah Sampel','Hasil','Judgment','Aksi'].map((h) => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="p-2">{item.kategori || '-'}</td><td className="p-2">{item.jumlah_sampel_minimal ?? '-'}</td><td className="p-2">{item.item_pemeriksaan}</td><td className="p-2">{item.alat_pemeriksaan || '-'}</td><td className="p-2">{item.standar_kriteria || '-'}</td><td className="p-2">{item.jumlah_sampel ?? '-'}</td><td className="p-2">{item.hasil_pemeriksaan || '-'}</td><td className="p-2">{item.judgment && <Badge variant={item.judgment === JUDGMENT_PRODUK.OK ? 'green' : 'red'}>{item.judgment}</Badge>}</td><td className="p-2">{editable && <><button className="text-blue-600 mr-2" onClick={() => onEditItem(item)}><Pencil size={13} /></button><button className="text-red-500" onClick={() => onDeleteItem(item)}><Trash2 size={13} /></button></>}</td></tr>)}</tbody></table></div>
  </div>;
}

function ItemForm({ item, onChange }: { item: ChecklistProdukItem; onChange: (item: ChecklistProdukItem) => void }) {
  const numberValue = (value: string) => value === '' ? null : Number(value);
  return <div className="grid grid-cols-2 gap-3"><Field label="Kategori"><Input value={item.kategori ?? ''} onChange={(e) => onChange({ ...item, kategori: e.target.value || null })} /></Field><Field label="Jumlah Sampel Minimal"><Input type="number" min="0" value={item.jumlah_sampel_minimal ?? ''} onChange={(e) => onChange({ ...item, jumlah_sampel_minimal: numberValue(e.target.value) })} /></Field><Field label="Item Pemeriksaan" required className="col-span-2"><Textarea value={item.item_pemeriksaan} onChange={(e) => onChange({ ...item, item_pemeriksaan: e.target.value })} /></Field><Field label="Alat Pemeriksaan"><Input value={item.alat_pemeriksaan ?? ''} onChange={(e) => onChange({ ...item, alat_pemeriksaan: e.target.value || null })} /></Field><Field label="Standar/Kriteria"><Input value={item.standar_kriteria ?? ''} onChange={(e) => onChange({ ...item, standar_kriteria: e.target.value || null })} /></Field><Field label="Jumlah Sampel"><Input type="number" min="0" value={item.jumlah_sampel ?? ''} onChange={(e) => onChange({ ...item, jumlah_sampel: numberValue(e.target.value) })} /></Field><Field label="Judgment"><Select value={item.judgment ?? ''} onChange={(e) => onChange({ ...item, judgment: (e.target.value || null) as ChecklistProdukItem['judgment'], finding_kategori: e.target.value === 'NG' ? item.finding_kategori : null })}><option value="">— Belum dinilai —</option>{JUDGMENT_PRODUK_LIST.map((value) => <option key={value}>{value}</option>)}</Select></Field>{item.judgment === 'NG' && <Field label="Kategori Temuan" required><Select value={item.finding_kategori ?? ''} onChange={e=>onChange({...item,finding_kategori:(e.target.value||null) as ChecklistProdukItem['finding_kategori']})}><option value="">— Pilih —</option><option value="A">A — Major</option><option value="B">B — Minor</option><option value="C">C — OFI</option></Select></Field>}<Field label={`Hasil Pemeriksaan${item.judgment==='NG'?' *':''}`} className="col-span-2"><Textarea value={item.hasil_pemeriksaan ?? ''} onChange={(e) => onChange({ ...item, hasil_pemeriksaan: e.target.value || null })} /><p className="text-xs text-gray-500 mt-1">Catat hasil pemeriksaan singkat. Detail formal PLOR diisi pada menu Temuan (PLOR).</p></Field></div>;
}
