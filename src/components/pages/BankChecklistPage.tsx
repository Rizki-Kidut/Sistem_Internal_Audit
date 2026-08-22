// Halaman Bank Checklist — master data Proses → Sub-Proses → Elemen Proses → Pertanyaan.
// CRUD penuh, soft-delete (status → Nonaktif). Navigasi accordion bertingkat.
// Tombol Import/Export Excel sebagai placeholder (fokus ke CRUD manual dulu).

import { useEffect, useState, useMemo } from 'react';
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  ListChecks, FileSpreadsheet, Eye, EyeOff,
} from 'lucide-react';
import type { ChecklistBankItem, SubPertanyaan } from '../../lib/types';
import { KELAMPOK_IPO, KELAMPOK_IPO_LIST, CHECKLIST_BANK_STATUS } from '../../lib/enums';
import type { KelompokIPO } from '../../lib/enums';
import {
  getChecklistBankItems,
  saveChecklistBankItem,
  softDeleteChecklistBankItem,
  reactivateChecklistBankItem,
  getUniqueProses,
  getUniqueSubProses,
  getPicSubProses,
} from '../../services/checklistBankService';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field, Input, Select, Textarea, AutoFilledBadge } from '../ui/Field';
import { Button, Card, Badge, EmptyState, LoadingSpinner } from '../ui';

export function BankChecklistPage() {
  const [items, setItems] = useState<ChecklistBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  // Accordion state
  const [openProses, setOpenProses] = useState<string | null>(null);
  const [openSubProses, setOpenSubProses] = useState<string | null>(null);

  // Modal: edit/create item
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistBankItem | null>(null);
  const [form, setForm] = useState<ChecklistFormState>(defaultForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Confirm: soft-delete
  const [confirmDelete, setConfirmDelete] = useState<ChecklistBankItem | null>(null);

  // Filter: hanya tampilkan item Aktif atau keduanya
  const filteredItems = useMemo(
    () => (showInactive ? items : items.filter((i) => i.status === CHECKLIST_BANK_STATUS.AKTIF)),
    [items, showInactive],
  );

  const prosesList = useMemo(() => getUniqueProses(filteredItems), [filteredItems]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const list = await getChecklistBankItems();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function defaultForm(): ChecklistFormState {
    return {
      proses: '',
      sub_proses: '',
      pic_sub_proses: '',
      kelompok_ipo: KELAMPOK_IPO.INPUT,
      nomor: '',
      klausul: '',
      pertanyaan_utama: '',
      sub_pertanyaan: [],
    };
  }

  function openCreate(proses?: string, subProses?: string) {
    setEditingItem(null);
    const f = defaultForm();
    if (proses) f.proses = proses;
    if (subProses) f.sub_proses = subProses;
    // Auto-fill PIC dari sub-proses yang sudah ada (prinsip: generate sekali, koreksi seperlunya)
    if (proses && subProses) {
      const pic = getPicSubProses(items, proses, subProses);
      if (pic) f.pic_sub_proses = pic;
    }
    setForm(f);
    setFormError(null);
    setEditModalOpen(true);
  }

  function openEdit(item: ChecklistBankItem) {
    setEditingItem(item);
    setForm({
      proses: item.proses,
      sub_proses: item.sub_proses,
      pic_sub_proses: item.pic_sub_proses ?? '',
      kelompok_ipo: item.kelompok_ipo,
      nomor: item.nomor,
      klausul: item.klausul ?? '',
      pertanyaan_utama: item.pertanyaan_utama,
      sub_pertanyaan: item.sub_pertanyaan.map((s) => ({ teks: s.teks })),
    });
    setFormError(null);
    setEditModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    setSaving(true);
    try {
      await saveChecklistBankItem({
        id: editingItem?.id,
        proses: form.proses.trim(),
        sub_proses: form.sub_proses.trim(),
        pic_sub_proses: form.pic_sub_proses.trim() || null,
        kelompok_ipo: form.kelompok_ipo,
        nomor: form.nomor.trim(),
        klausul: form.klausul.trim() || null,
        pertanyaan_utama: form.pertanyaan_utama.trim(),
        sub_pertanyaan: form.sub_pertanyaan.filter((s) => s.teks.trim()),
        status: editingItem?.status ?? CHECKLIST_BANK_STATUS.AKTIF,
      });
      setEditModalOpen(false);
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function handleSoftDelete() {
    if (!confirmDelete) return;
    try {
      await softDeleteChecklistBankItem(confirmDelete.id);
      setConfirmDelete(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menonaktifkan');
    }
  }

  async function handleReactivate(item: ChecklistBankItem) {
    try {
      await reactivateChecklistBankItem(item.id);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengaktifkan kembali');
    }
  }

  // --- Sub-pertanyaan handlers (dynamic array) ---
  function addSubPertanyaan() {
    setForm({ ...form, sub_pertanyaan: [...form.sub_pertanyaan, { teks: '' }] });
  }

  function updateSubPertanyaan(idx: number, teks: string) {
    const updated = [...form.sub_pertanyaan];
    updated[idx] = { teks };
    setForm({ ...form, sub_pertanyaan: updated });
  }

  function removeSubPertanyaan(idx: number) {
    setForm({ ...form, sub_pertanyaan: form.sub_pertanyaan.filter((_, i) => i !== idx) });
  }

  // --- Render ---
  if (loading) return <LoadingSpinner message="Memuat bank checklist..." />;

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bank Checklist</h1>
          <p className="mt-1 text-sm text-gray-500">
            Master data checklist 3-level: Proses → Sub-Proses → Input/Method/Output → Pertanyaan.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
            title={showInactive ? 'Sembunyikan nonaktif' : 'Tampilkan nonaktif'}
          >
            {showInactive ? <EyeOff size={14} /> : <Eye size={14} />}
            {showInactive ? 'Sembunyikan Nonaktif' : 'Tampilkan Nonaktif'}
          </Button>
          <Button variant="secondary" size="sm" disabled title="Placeholder — akan diimplementasi">
            <FileSpreadsheet size={14} /> Import
          </Button>
          <Button variant="secondary" size="sm" disabled title="Placeholder — akan diimplementasi">
            <FileSpreadsheet size={14} /> Export
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            <Plus size={14} /> Tambah Pertanyaan
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {prosesList.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={<ListChecks size={40} />}
            title="Belum ada checklist"
            message="Tambahkan pertanyaan checklist pertama untuk memulai bank checklist."
            action={
              <Button onClick={() => openCreate()}>
                <Plus size={16} /> Tambah Pertanyaan
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {prosesList.map((proses) => {
            const prosesItems = filteredItems.filter((i) => i.proses === proses);
            const subProsesList = getUniqueSubProses(filteredItems, proses);
            const isProsesOpen = openProses === proses;

            return (
              <Card key={proses} className="overflow-hidden">
                {/* Level 1: Proses */}
                <button
                  onClick={() => setOpenProses(isProsesOpen ? null : proses)}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
                >
                  {isProsesOpen ? <ChevronDown size={18} className="text-blue-600" /> : <ChevronRight size={18} className="text-blue-600" />}
                  <span className="text-sm font-semibold text-blue-900">{proses}</span>
                  <Badge variant="blue">{prosesItems.length} item</Badge>
                  <span className="ml-auto text-xs text-blue-600">
                    {subProsesList.length} sub-proses
                  </span>
                </button>

                {isProsesOpen && (
                  <div className="border-t border-gray-100">
                    {subProsesList.map((subProses) => {
                      const subItems = prosesItems.filter((i) => i.sub_proses === subProses);
                      const pic = getPicSubProses(items, proses, subProses);
                      const isSubOpen = openSubProses === `${proses}||${subProses}`;

                      return (
                        <div key={subProses} className="border-b border-gray-100 last:border-b-0">
                          {/* Level 2: Sub-Proses */}
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50">
                            <button
                              onClick={() => setOpenSubProses(isSubOpen ? null : `${proses}||${subProses}`)}
                              className="flex items-center gap-2 flex-1 text-left"
                            >
                              {isSubOpen ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
                              <span className="text-sm font-medium text-gray-700">{subProses}</span>
                              {pic && (
                                <Badge variant="gray">{pic}</Badge>
                              )}
                              <Badge variant="gray">{subItems.length} pertanyaan</Badge>
                            </button>
                            <button
                              onClick={() => openCreate(proses, subProses)}
                              className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Tambah pertanyaan di sub-proses ini"
                            >
                              <Plus size={14} />
                            </button>
                          </div>

                          {isSubOpen && (
                            <div className="bg-white">
                              {/* Level 3: Elemen Proses */}
                              {KELAMPOK_IPO_LIST.map((kelompok) => {
                                const kelompokItems = subItems.filter((i) => i.kelompok_ipo === kelompok);
                                if (kelompokItems.length === 0) return null;

                                return (
                                  <div key={kelompok} className="border-t border-gray-50">
                                    <div className="px-6 py-2 bg-gray-50/50">
                                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        {kelompok}
                                      </span>
                                    </div>
                                    <table className="w-full">
                                      <thead>
                                        <tr className="border-b border-gray-100">
                                          <th className="px-6 py-2 text-left text-xs font-medium text-gray-400 w-12">No</th>
                                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-400">Pertanyaan</th>
                                          <th className="px-2 py-2 text-left text-xs font-medium text-gray-400 w-24">Klausul</th>

                                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-400 w-20">Status</th>
                                          <th className="px-2 py-2 text-right text-xs font-medium text-gray-400 w-20">Aksi</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {kelompokItems.map((item) => (
                                          <tr key={item.id} className={`border-b border-gray-50 hover:bg-gray-50 ${item.status === CHECKLIST_BANK_STATUS.NONAKTIF ? 'opacity-50' : ''}`}>
                                            <td className="px-6 py-2 text-sm text-gray-500">{item.nomor}</td>
                                            <td className="px-2 py-2">
                                              <div className="text-sm text-gray-900">{item.pertanyaan_utama}</div>
                                              {item.sub_pertanyaan.length > 0 && (
                                                <ul className="mt-1 ml-4 text-xs text-gray-500 list-disc">
                                                  {item.sub_pertanyaan.map((sp, idx) => (
                                                    <li key={idx}>{sp.teks}</li>
                                                  ))}
                                                </ul>
                                              )}
                                            </td>
                                            <td className="px-2 py-2 text-xs text-gray-500">{item.klausul ?? '-'}</td>
                                            <td className="px-2 py-2 text-center">
                                              <Badge variant={item.status === CHECKLIST_BANK_STATUS.AKTIF ? 'green' : 'gray'}>
                                                {item.status}
                                              </Badge>
                                            </td>
                                            <td className="px-2 py-2">
                                              <div className="flex items-center justify-end gap-1">
                                                <button
                                                  onClick={() => openEdit(item)}
                                                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                                  title="Edit"
                                                >
                                                  <Pencil size={14} />
                                                </button>
                                                {item.status === CHECKLIST_BANK_STATUS.AKTIF ? (
                                                  <button
                                                    onClick={() => setConfirmDelete(item)}
                                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                                    title="Nonaktifkan"
                                                  >
                                                    <Trash2 size={14} />
                                                  </button>
                                                ) : (
                                                  <button
                                                    onClick={() => handleReactivate(item)}
                                                    className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                                                    title="Aktifkan kembali"
                                                  >
                                                    <Eye size={14} />
                                                  </button>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })}

                              {/* Tombol tambah per kelompok */}
                              <div className="px-6 py-2 flex gap-2">
                                {KELAMPOK_IPO_LIST.map((k) => (
                                  <button
                                    key={k}
                                    onClick={() => openCreate(proses, subProses)}
                                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                  >
                                    <Plus size={12} /> {k}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal: Edit/Create Item */}
      <Modal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={editingItem ? 'Edit Pertanyaan Checklist' : 'Tambah Pertanyaan Checklist'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {formError}
            </div>
          )}

          {/* Proses & Sub-Proses — auto-fill indikator jika diwarisi */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Proses" required>
              <Input
                value={form.proses}
                onChange={(e) => setForm({ ...form, proses: e.target.value })}
                placeholder="mis. Produksi, Inspeksi"
                list="proses-suggestions"
              />
              <datalist id="proses-suggestions">
                {getUniqueProses(items).map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Sub-Proses" required>
              <Input
                value={form.sub_proses}
                onChange={(e) => setForm({ ...form, sub_proses: e.target.value })}
                placeholder="mis. Persiapan Material"
                list="subproses-suggestions"
              />
              <datalist id="subproses-suggestions">
                {form.proses && getUniqueSubProses(items, form.proses).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>

          {/* PIC Sub-Proses — auto-filled dari sub-proses yang sudah ada */}
          <Field label="PIC Sub-Proses">
            <div className="flex items-center gap-2">
              <Input
                value={form.pic_sub_proses}
                onChange={(e) => setForm({ ...form, pic_sub_proses: e.target.value })}
                placeholder="mis. PIC: PRC"
              />
              {form.pic_sub_proses && getPicSubProses(items, form.proses, form.sub_proses) && (
                <AutoFilledBadge />
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Elemen Proses" required>
              <Select
                value={form.kelompok_ipo}
                onChange={(e) => setForm({ ...form, kelompok_ipo: e.target.value as KelompokIPO })}
              >
                {KELAMPOK_IPO_LIST.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </Select>
            </Field>
            <Field label="Nomor" required>
              <Input
                value={form.nomor}
                onChange={(e) => setForm({ ...form, nomor: e.target.value })}
                placeholder="mis. 1, 2.1, 3"
              />
            </Field>
          </div>

          <Field label="Klausul">
            <Input
              value={form.klausul}
              onChange={(e) => setForm({ ...form, klausul: e.target.value })}
              placeholder="Referensi klausul standar (opsional)"
            />
          </Field>

          <Field label="Pertanyaan Utama" required>
            <Textarea
              value={form.pertanyaan_utama}
              onChange={(e) => setForm({ ...form, pertanyaan_utama: e.target.value })}
              placeholder="Tuliskan pertanyaan utama..."
              rows={3}
            />
          </Field>

          {/* Sub-pertanyaan (dynamic array) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Sub-Pertanyaan</label>
              <button
                onClick={addSubPertanyaan}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus size={12} /> Tambah Sub-Pertanyaan
              </button>
            </div>
            {form.sub_pertanyaan.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">Tidak ada sub-pertanyaan. Klik "Tambah Sub-Pertanyaan" untuk menambah.</p>
            ) : (
              <div className="space-y-2">
                {form.sub_pertanyaan.map((sp, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-xs text-gray-400 mt-2 w-6">{idx + 1}.</span>
                    <Input
                      value={sp.teks}
                      onChange={(e) => updateSubPertanyaan(idx, e.target.value)}
                      placeholder="Teks sub-pertanyaan"
                    />
                    <button
                      onClick={() => removeSubPertanyaan(idx)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>


        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Nonaktifkan Pertanyaan"
        message={`Pertanyaan "${confirmDelete?.pertanyaan_utama.slice(0, 50)}..." akan dinonaktifkan. Histori checklist yang sudah memakai pertanyaan ini tetap valid.`}
        confirmLabel="Nonaktifkan"
        variant="warning"
        onConfirm={handleSoftDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

interface ChecklistFormState {
  proses: string;
  sub_proses: string;
  pic_sub_proses: string;
  kelompok_ipo: KelompokIPO;
  nomor: string;
  klausul: string;
  pertanyaan_utama: string;
  sub_pertanyaan: SubPertanyaan[];
}
