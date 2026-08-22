// Tab Checklist di detail Instruksi Audit.
// Untuk baris Reguler: tampilkan daftar checklist + editor items.
// Untuk tipe lain: placeholder "menyusul batch berikutnya".

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Plus, Trash2, Pencil, ChevronDown, ChevronRight,
} from 'lucide-react';
import type {
  AuditInstructionRow, Checklist, ChecklistItem,
  Seksi, Auditor, ChecklistBankItem,
} from '../../../lib/types';
import type { KelompokIPO } from '../../../lib/enums';
import {
  KELAMPOK_IPO, KELAMPOK_IPO_LIST,
  TIPE_BARIS, TIPE_BARIS_LABEL,
} from '../../../lib/enums';
import {
  getChecklistsByRow, getItemsByChecklist, saveChecklist, deleteChecklist,
  saveChecklistItemPreparation, deleteItem, createChecklistFromRow, groupItemsBySubProses,
} from '../../../services/checklistService';
import { getChecklistBankItems } from '../../../services/checklistBankService';
import { formatTanggal } from '../../../lib/utils';
import { Modal } from '../../ui/Modal';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '../../ui/Field';
import { Button, Card, Badge, EmptyState, LoadingSpinner } from '../../ui';
import { ProductChecklistPanel } from './ProductChecklistPanel';
import { ManufacturingChecklistPanel } from './ManufacturingChecklistPanel';

interface ChecklistTabProps {
  rows: AuditInstructionRow[];
  seksiList: Seksi[];
  auditorList: Auditor[];
  readOnly: boolean;
  onError: (msg: string) => void;
  initialSelectedRowId?: string | null;
  onChanged?: () => void | Promise<void>;
}

function emptyItem(checklistId: string): ChecklistItem {
  return {
    id: '',
    checklist_id: checklistId,
    bank_item_id: null,
    sub_proses: '',
    kelompok_ipo: KELAMPOK_IPO.INPUT,
    nomor: '',
    klausul: null,
    pertanyaan_utama: '',
    sub_pertanyaan: [],
    metode_verifikasi: null,
    hasil: null,
    komentar_auditor: null,
    finding_id: null,
    created_at: '',
    updated_at: '',
  };
}

export function ChecklistTab(props: ChecklistTabProps) {
  const { rows, readOnly, onError } = props;
  const [selectedRowId, setSelectedRowId] = useState<string | null>(props.initialSelectedRowId ?? null);
  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? null;

  useEffect(() => {
    if (selectedRowId && !rows.some((row) => row.id === selectedRowId)) setSelectedRowId(null);
  }, [rows, selectedRowId]);

  if (rows.length === 0) {
    return <Card className="p-12"><EmptyState icon={<ClipboardList size={40} />} title="Belum ada baris audit"
      message="Checklist tersedia setelah baris Instruksi Audit terhubung ke sesi ini." /></Card>;
  }

  return <div className="space-y-4">
    <Card className="p-4"><div className="flex items-center gap-4 flex-wrap">
      <label className="text-sm font-medium text-gray-700">Pilih Baris Audit:</label>
      <Select value={selectedRowId ?? ''} onChange={(event) => setSelectedRowId(event.target.value || null)} className="min-w-[240px]">
        <option value="">— Pilih Baris —</option>
        {rows.map((row) => <option key={row.id} value={row.id}>{row.kode_audit} — {TIPE_BARIS_LABEL[row.tipe_baris]}</option>)}
      </Select>
    </div></Card>
    {!selectedRow && <Card className="p-12"><EmptyState icon={<ClipboardList size={40} />} title="Pilih baris audit"
      message="Pilih QA dan tipe audit untuk membuka checklist yang sesuai." /></Card>}
    {selectedRow?.tipe_baris === TIPE_BARIS.REGULER && <SystemChecklistPanel {...props} rows={[selectedRow]} hideRowSelector />}
    {selectedRow?.tipe_baris === TIPE_BARIS.AUDIT_PRODUK && <ProductChecklistPanel key={selectedRow.id} row={selectedRow} readOnly={readOnly} onError={onError} onChanged={props.onChanged} />}
    {(selectedRow?.tipe_baris === TIPE_BARIS.AUDIT_MANUFAKTUR || selectedRow?.tipe_baris === TIPE_BARIS.AUDIT_SHIFT) &&
      <ManufacturingChecklistPanel key={selectedRow.id} row={selectedRow} auditorList={props.auditorList} readOnly={readOnly} onError={onError} onChanged={props.onChanged} />}
  </div>;
}

function SystemChecklistPanel({
  rows, seksiList, auditorList, readOnly, onError, onChanged,
  hideRowSelector = false,
}: ChecklistTabProps & { hideRowSelector?: boolean }) {
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [bankItems, setBankItems] = useState<ChecklistBankItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [confirmDeleteCl, setConfirmDeleteCl] = useState<Checklist | null>(null);
  const [itemForm, setItemForm] = useState<ChecklistItem | null>(null);
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [expandedSubProses, setExpandedSubProses] = useState<Set<string>>(new Set());

  const regulerRows = rows.filter((r) => r.tipe_baris === TIPE_BARIS.REGULER);

  useEffect(() => {
    getChecklistBankItems()
      .then((all) => setBankItems(all.filter((b) => b.status === 'Aktif')))
      .catch((e) => onError(e instanceof Error ? e.message : 'Gagal memuat bank checklist'));
  }, [onError]);

  useEffect(() => {
    if (hideRowSelector && rows.length === 1 && selectedRowId !== rows[0].id) setSelectedRowId(rows[0].id);
  }, [hideRowSelector, rows, selectedRowId]);

  const loadChecklists = useCallback(async (rowId: string) => {
    setChecklistLoading(true);
    try {
      const cls = await getChecklistsByRow(rowId);
      setChecklists(cls);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal memuat checklist');
    } finally {
      setChecklistLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    if (selectedRowId) {
      loadChecklists(selectedRowId);
      setActiveChecklist(null);
      setItems([]);
    } else {
      setChecklists([]);
      setActiveChecklist(null);
      setItems([]);
    }
  }, [selectedRowId, loadChecklists]);

  useEffect(() => {
    if (!activeChecklist) {
      setItems([]);
      return;
    }
    setItemsLoading(true);
    getItemsByChecklist(activeChecklist.id)
      .then((data) => {
        setItems(data);
        setExpandedSubProses(new Set(data.map((d) => d.sub_proses)));
      })
      .catch((e) => onError(e instanceof Error ? e.message : 'Gagal memuat item checklist'))
      .finally(() => setItemsLoading(false));
  }, [activeChecklist, onError]);

  async function handleCreateChecklist() {
    const row = regulerRows.find((r) => r.id === selectedRowId);
    if (!row) return;
    setCreating(true);
    try {
      const cl = await createChecklistFromRow(row, seksiList, auditorList, bankItems);
      await loadChecklists(row.id);
      setActiveChecklist(cl);
      await onChanged?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal membuat checklist');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteChecklist() {
    if (!confirmDeleteCl) return;
    try {
      await deleteChecklist(confirmDeleteCl.id);
      setConfirmDeleteCl(null);
      if (activeChecklist?.id === confirmDeleteCl.id) setActiveChecklist(null);
      if (selectedRowId) await loadChecklists(selectedRowId);
      await onChanged?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal menghapus checklist');
    }
  }

  async function handleSaveItem() {
    if (!itemForm || !activeChecklist) return;
    try {
      await saveChecklistItemPreparation({ ...itemForm, checklist_id: activeChecklist.id });
      setItemSaveError(null);
      onError('');
      setEditOpen(false);
      setItemForm(null);
      const data = await getItemsByChecklist(activeChecklist.id);
      setItems(data);
      await onChanged?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Gagal menyimpan item';
      setItemSaveError(message);
      onError(message);
    }
  }

  async function handleDeleteItem(itemId: string) {
    if (!activeChecklist) return;
    try {
      await deleteItem(itemId);
      const data = await getItemsByChecklist(activeChecklist.id);
      setItems(data);
      await onChanged?.();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal menghapus item');
    }
  }

  async function handleSaveChecklistHeader(cl: Checklist) {
    try {
      const updated = await saveChecklist(cl);
      setActiveChecklist(updated);
      if (selectedRowId) await loadChecklists(selectedRowId);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal menyimpan header checklist');
    }
  }

  function toggleSubProses(sp: string) {
    setExpandedSubProses((prev) => {
      const next = new Set(prev);
      if (next.has(sp)) next.delete(sp);
      else next.add(sp);
      return next;
    });
  }

  if (regulerRows.length === 0) {
    return (
      <Card className="p-12">
        <EmptyState
          icon={<ClipboardList size={40} />}
          title="Tidak ada baris Reguler"
          message="Checklist hanya tersedia untuk baris Reguler. Tambahkan baris Reguler terlebih dahulu."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!hideRowSelector && <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-gray-700">Pilih Baris Audit:</label>
          <Select
            value={selectedRowId ?? ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedRowId(e.target.value || null)}
            className="min-w-[200px]"
          >
            <option value="">— Pilih Baris —</option>
            {regulerRows.map((r) => (
              <option key={r.id} value={r.id}>{r.kode_audit}</option>
            ))}
          </Select>
          {selectedRowId && !readOnly && (
            <Button size="sm" onClick={handleCreateChecklist} disabled={creating}>
              <Plus size={14} /> {creating ? 'Membuat...' : 'Buat Checklist'}
            </Button>
          )}
        </div>
      </Card>}

      {hideRowSelector && selectedRowId && !readOnly && (
        <div className="flex justify-end"><Button size="sm" onClick={handleCreateChecklist} disabled={creating}>
          <Plus size={14} /> {creating ? 'Membuat...' : 'Buat Checklist Sistem'}
        </Button></div>
      )}

      {rows.some((r) => r.tipe_baris !== TIPE_BARIS.REGULER) && (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
          Baris non-Reguler ({rows.filter((r) => r.tipe_baris !== TIPE_BARIS.REGULER).map((r) => TIPE_BARIS_LABEL[r.tipe_baris]).join(', ')}): checklist menyusul batch berikutnya.
        </div>
      )}

      {selectedRowId && checklistLoading && <LoadingSpinner message="Memuat checklist..." />}

      {selectedRowId && !checklistLoading && checklists.length === 0 && (
        <Card className="p-12">
          <EmptyState
            icon={<ClipboardList size={40} />}
            title="Belum ada checklist"
            message={readOnly ? 'Checklist belum dibuat untuk baris ini.' : 'Klik "Buat Checklist" untuk auto-generate dari Bank Checklist yang match dengan proses baris ini.'}
          />
        </Card>
      )}

      {selectedRowId && !checklistLoading && checklists.length > 0 && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {checklists.map((cl) => (
              <button
                key={cl.id}
                onClick={() => setActiveChecklist(cl)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  activeChecklist?.id === cl.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <span className="font-mono">{cl.kode_audit}</span>
                <span className="ml-2 text-xs opacity-75">{cl.seksi_auditee.length} seksi</span>
              </button>
            ))}
          </div>

          {activeChecklist && (
            <ChecklistEditor
              checklist={activeChecklist}
              items={items}
              itemsLoading={itemsLoading}
              readOnly={readOnly}
              onSaveHeader={handleSaveChecklistHeader}
              onAddItem={(subProses, elemen) => { const draft = emptyItem(activeChecklist.id); if (subProses) draft.sub_proses = subProses; if (elemen) draft.kelompok_ipo = elemen; setItemSaveError(null); setItemForm(draft); setEditOpen(true); }}
              onEditItem={(item) => { setItemSaveError(null); setItemForm(item); setEditOpen(true); }}
              onDeleteItem={handleDeleteItem}
              expandedSubProses={expandedSubProses}
              onToggleSubProses={toggleSubProses}
            />
          )}

          {!readOnly && activeChecklist && (
            <div className="flex justify-end">
              <Button variant="danger" size="sm" onClick={() => setConfirmDeleteCl(activeChecklist)}>
                <Trash2 size={14} /> Hapus Checklist
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={editOpen}
        onClose={() => { setEditOpen(false); setItemForm(null); setItemSaveError(null); }}
        title={itemForm?.id ? 'Edit Item Checklist' : 'Tambah Item Checklist'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setEditOpen(false); setItemForm(null); setItemSaveError(null); }}>Batal</Button>
            <Button onClick={handleSaveItem}>Simpan</Button>
          </>
        }
      >
        {itemSaveError&&<div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700"><p className="font-semibold text-sm">Gagal menyimpan Checklist</p><p className="text-sm mt-1">{itemSaveError}</p></div>}
        {itemForm && <ItemEditForm item={itemForm} onChange={setItemForm} />}
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteCl}
        title="Hapus Checklist"
        message={`Yakin ingin menghapus checklist ${confirmDeleteCl?.kode_audit}? Semua item juga akan terhapus.`}
        confirmLabel="Hapus"
        onConfirm={handleDeleteChecklist}
        onCancel={() => setConfirmDeleteCl(null)}
      />
    </div>
  );
}

// ============================================================
// CHECKLIST EDITOR
// ============================================================

interface ChecklistEditorProps {
  checklist: Checklist;
  items: ChecklistItem[];
  itemsLoading: boolean;
  readOnly: boolean;
  onSaveHeader: (cl: Checklist) => void;
  onAddItem: (subProses?: string, elemen?: KelompokIPO) => void;
  onEditItem: (item: ChecklistItem) => void;
  onDeleteItem: (id: string) => void;
  expandedSubProses: Set<string>;
  onToggleSubProses: (sp: string) => void;
}

function ChecklistEditor({ checklist, items, itemsLoading, readOnly, onSaveHeader, onAddItem, onEditItem, onDeleteItem, expandedSubProses, onToggleSubProses }: ChecklistEditorProps) {
  const [editingHeader, setEditingHeader] = useState(false);
  const [headerDraft, setHeaderDraft] = useState<Checklist>(checklist);
  const [expandedElements, setExpandedElements] = useState<Set<string>>(new Set());
  useEffect(() => { setHeaderDraft(checklist); }, [checklist]);
  useEffect(() => { setExpandedElements(new Set(groupItemsBySubProses(items).flatMap(group => group.groups.map(element => `${group.subProses}::${element.kelompok}`)))); }, [items]);
  const grouped = groupItemsBySubProses(items);
  const toggleElement = (key: string) => setExpandedElements(previous => { const next = new Set(previous); if (next.has(key)) next.delete(key); else next.add(key); return next; });

  return <Card className="overflow-hidden">
    <div className="p-4 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between mb-3"><div className="flex items-center gap-3"><Badge variant="blue">{checklist.kode_audit}</Badge><span className="text-sm font-medium text-gray-700">{checklist.judul_checklist}</span></div>{!readOnly && <Button size="sm" variant="ghost" onClick={() => setEditingHeader(!editingHeader)}><Pencil size={14}/> Edit Header</Button>}</div>
      {!editingHeader ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div><span className="text-gray-400 block">Kode Dokumen</span><span className="font-mono">{checklist.kode_dokumen}</span></div><div><span className="text-gray-400 block">Seksi Auditee</span><span>{checklist.seksi_auditee.join(', ') || '-'}</span></div><div><span className="text-gray-400 block">Section Manager</span><span>{checklist.section_manager ?? '-'}</span></div><div><span className="text-gray-400 block">Dibuat Oleh</span><span>{checklist.dibuat_oleh ?? '-'}</span></div><div><span className="text-gray-400 block">Tanggal Dibuat</span><span>{formatTanggal(checklist.tanggal_dibuat)}</span></div><div><span className="text-gray-400 block">Penanggung Jawab QMS</span><span>{checklist.penanggung_jawab_qms ?? '-'}</span></div><div><span className="text-gray-400 block">PIC Proses</span><span>{checklist.pic_proses ?? '-'}</span></div><div><span className="text-gray-400 block">Item Monitoring</span><span>{checklist.item_monitoring_jelas ?? '-'}</span></div>
      </div> : <div className="space-y-3"><div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="Judul Checklist"><Input value={headerDraft.judul_checklist} onChange={e => setHeaderDraft({...headerDraft,judul_checklist:e.target.value})}/></Field><Field label="Penanggung Jawab QMS"><Input value={headerDraft.penanggung_jawab_qms ?? ''} onChange={e => setHeaderDraft({...headerDraft,penanggung_jawab_qms:e.target.value||null})}/></Field><Field label="PIC Proses"><Input value={headerDraft.pic_proses ?? ''} onChange={e => setHeaderDraft({...headerDraft,pic_proses:e.target.value||null})}/></Field><Field label="Tanggal Dibuat"><Input type="date" value={headerDraft.tanggal_dibuat} onChange={e => setHeaderDraft({...headerDraft,tanggal_dibuat:e.target.value})}/></Field></div><Field label="Item Monitoring Jelas"><Textarea value={headerDraft.item_monitoring_jelas ?? ''} onChange={e => setHeaderDraft({...headerDraft,item_monitoring_jelas:e.target.value||null})}/></Field><Field label="Kondisi Pencapaian Target"><Textarea value={headerDraft.kondisi_pencapaian_target ?? ''} onChange={e => setHeaderDraft({...headerDraft,kondisi_pencapaian_target:e.target.value||null})}/></Field><div className="flex gap-2"><Button size="sm" onClick={() => {onSaveHeader(headerDraft);setEditingHeader(false);}}>Simpan Header</Button><Button size="sm" variant="secondary" onClick={() => setEditingHeader(false)}>Batal</Button></div></div>}
    </div>
    <div className="p-4"><div className="flex items-center justify-between mb-3"><div><h4 className="text-sm font-semibold">Pertanyaan Checklist ({items.length})</h4><p className="text-xs text-gray-500">Persiapan: tentukan apa yang akan diperiksa. Hasil audit diisi di Pelaksanaan.</p></div>{!readOnly && <Button size="sm" onClick={() => onAddItem()}><Plus size={14}/> Tambah Pertanyaan</Button>}</div>
      {itemsLoading && <LoadingSpinner message="Memuat pertanyaan..."/>}{!itemsLoading && items.length===0 && <p className="text-sm text-gray-400 py-6 text-center">Belum ada pertanyaan.</p>}
      {!itemsLoading && grouped.map(({subProses,groups}) => <div key={subProses} className="mb-4 border rounded-lg overflow-hidden"><button onClick={() => onToggleSubProses(subProses)} className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 text-left">{expandedSubProses.has(subProses)?<ChevronDown size={16}/>:<ChevronRight size={16}/>}<span className="font-medium flex-1">{subProses}</span><Badge variant="gray">{groups.reduce((n,g)=>n+g.items.length,0)} Pertanyaan</Badge></button>{expandedSubProses.has(subProses)&&<div className="p-3 space-y-2">{KELAMPOK_IPO_LIST.map(elemen => {const group=groups.find(g=>g.kelompok===elemen);const elementItems=group?.items??[];const key=`${subProses}::${elemen}`;return <div key={elemen} className="border rounded"><button onClick={()=>toggleElement(key)} className="w-full flex items-center gap-2 px-3 py-2 bg-blue-50/50 text-left">{expandedElements.has(key)?<ChevronDown size={15}/>:<ChevronRight size={15}/>}<span className="text-sm font-semibold flex-1">{elemen}</span><Badge variant="gray">{elementItems.length}</Badge></button>{expandedElements.has(key)&&<div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b bg-gray-50 text-left"><th className="p-2 w-16">No</th><th className="p-2">Klausul / Acuan</th><th className="p-2">Pertanyaan Utama</th><th className="p-2">Sub Pertanyaan</th><th className="p-2 w-24">Aksi</th></tr></thead><tbody>{elementItems.map(item=><tr key={item.id} className="border-b"><td className="p-2 font-mono">{item.nomor}</td><td className="p-2">{item.klausul??'-'}</td><td className="p-2">{item.pertanyaan_utama}{item.bank_item_id&&<span className="ml-2"><Badge variant="blue">Bank</Badge></span>}</td><td className="p-2">{item.sub_pertanyaan.length} sub-pertanyaan</td><td className="p-2">{!readOnly&&<div className="flex gap-2"><button className="text-blue-600" onClick={()=>onEditItem(item)} title="Edit"><Pencil size={14}/></button><button className="text-red-500" onClick={()=>onDeleteItem(item.id)} title="Hapus"><Trash2 size={14}/></button></div>}</td></tr>)}</tbody></table>{!readOnly&&<div className="p-2"><Button size="sm" variant="ghost" onClick={()=>onAddItem(subProses,elemen)}><Plus size={14}/> Tambah Pertanyaan</Button></div>}</div>}</div>})}</div>}</div>)}
    </div>
  </Card>;
}

// ============================================================
// ITEM EDIT FORM
// ============================================================

interface ItemEditFormProps {
  item: ChecklistItem;
  onChange: (updated: ChecklistItem) => void;
}

function ItemEditForm({ item, onChange }: ItemEditFormProps) {
  const [form, setForm] = useState<ChecklistItem>(item);

  useEffect(() => {
    setForm(item);
  }, [item]);

  useEffect(() => {
    onChange(form);
  }, [form, onChange]);

  function update<K extends keyof ChecklistItem>(key: K, value: ChecklistItem[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addSubPertanyaan() {
    setForm((prev) => ({
      ...prev,
      sub_pertanyaan: [...prev.sub_pertanyaan, { teks: '', sesuai: null }],
    }));
  }

  function updateSubPertanyaan(idx: number, value: string) {
    setForm((prev) => ({
      ...prev,
      sub_pertanyaan: prev.sub_pertanyaan.map((sp, i) =>
        i === idx ? { ...sp, teks: value } : sp
      ),
    }));
  }

  function removeSubPertanyaan(idx: number) {
    setForm((prev) => ({
      ...prev,
      sub_pertanyaan: prev.sub_pertanyaan.filter((_, i) => i !== idx),
    }));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sub-Proses" required>
          <Input value={form.sub_proses} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('sub_proses', e.target.value)} />
        </Field>
        <Field label="Elemen Proses" required>
          <Select value={form.kelompok_ipo} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update('kelompok_ipo', e.target.value as KelompokIPO)}>
            {KELAMPOK_IPO_LIST.map((k) => <option key={k} value={k}>{k}</option>)}
          </Select>
        </Field>
        <Field label="Nomor" required>
          <Input value={form.nomor} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('nomor', e.target.value)} />
        </Field>
        <Field label="Klausul">
          <Input value={form.klausul ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update('klausul', e.target.value || null)} />
        </Field>
      </div>

      <Field label="Pertanyaan Utama" required>
        <Textarea value={form.pertanyaan_utama} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update('pertanyaan_utama', e.target.value)} rows={2} />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Sub-Pertanyaan</label>
          <Button size="sm" variant="ghost" onClick={addSubPertanyaan}><Plus size={14} /> Tambah</Button>
        </div>
        {form.sub_pertanyaan.length === 0 && (
          <p className="text-xs text-gray-400">Tidak ada sub-pertanyaan.</p>
        )}
        {form.sub_pertanyaan.map((sp, idx) => (
          <div key={idx} className="flex items-start gap-2 mb-2">
            <Input
              value={sp.teks}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSubPertanyaan(idx, e.target.value)}
              placeholder="Teks sub-pertanyaan..."
              className="flex-1"
            />

            <button onClick={() => removeSubPertanyaan(idx)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {form.bank_item_id && (
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          Item ini di-link ke Bank Checklist. Jika bank item diubah, item ini tidak ikut berubah.
        </div>
      )}
    </div>
  );
}
