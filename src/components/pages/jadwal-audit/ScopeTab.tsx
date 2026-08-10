// Tab "Ruang Lingkup" untuk Detail Sesi Audit.
// Menampilkan daftar area (scope) per schedule, dengan CRUD.
// Setiap area: nama, seksi terkait, proses terkait, klausul, dokumen referensi, PIC.

import { useState } from 'react';
import { Plus, Trash2, Pencil, MapPin } from 'lucide-react';
import type { AuditScope, Proses, Seksi } from '../../../lib/types';
import {
  saveScope,
  deleteScope,
  getDefaultPicArea,
  resolveProsesNames,
} from '../../../services/auditScheduleService';
import { Modal } from '../../ui/Modal';
import { Field, Input, Select, AutoFilledBadge } from '../../ui/Field';
import { Button, Card, Badge, EmptyState } from '../../ui';

interface ScopeTabProps {
  scheduleId: string;
  scopes: AuditScope[];
  prosesList: Proses[];
  seksiList: Seksi[];
  readOnly: boolean;
  onReload: () => void;
  onError: (msg: string) => void;
}

interface ScopeForm {
  area: string;
  seksi_terkait: string;
  proses_terkait: string[];
  pic_area: string;
}

export function ScopeTab({
  scheduleId,
  scopes,
  prosesList,
  seksiList,
  readOnly,
  onReload,
  onError,
}: ScopeTabProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<AuditScope | null>(null);
  const [form, setForm] = useState<ScopeForm>(emptyForm());
  const [saving, setSaving] = useState(false);

  function emptyForm(): ScopeForm {
    return { area: '', seksi_terkait: '', proses_terkait: [], pic_area: '' };
  }

  function openCreate() {
    setEditingScope(null);
    setForm(emptyForm());
    setEditOpen(true);
  }

  function openEdit(scope: AuditScope) {
    setEditingScope(scope);
    setForm({
      area: scope.area,
      seksi_terkait: scope.seksi_terkait ?? '',
      proses_terkait: scope.proses_terkait ?? [],
      pic_area: scope.pic_area ?? '',
    });
    setEditOpen(true);
  }

  function handleSeksiChange(seksiId: string) {
    const seksi = seksiList.find((s) => s.id === seksiId);
    setForm((prev) => ({
      ...prev,
      seksi_terkait: seksiId,
      pic_area: getDefaultPicArea(seksi) ?? prev.pic_area,
    }));
  }

  function toggleProses(prosesId: string) {
    setForm((prev) => ({
      ...prev,
      proses_terkait: prev.proses_terkait.includes(prosesId)
        ? prev.proses_terkait.filter((id) => id !== prosesId)
        : [...prev.proses_terkait, prosesId],
    }));
  }

  async function handleSave() {
    if (!form.area.trim()) {
      onError('Nama area wajib diisi');
      return;
    }
    if (!form.seksi_terkait) {
      onError('Seksi terkait wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await saveScope({
        id: editingScope?.id,
        schedule_id: scheduleId,
        area: form.area.trim(),
        seksi_terkait: form.seksi_terkait || null,
        proses_terkait: form.proses_terkait,
        klausul_standar: editingScope?.klausul_standar ?? [],
        dokumen_referensi: editingScope?.dokumen_referensi ?? [],
        pic_area: form.pic_area || null,
      });
      setEditOpen(false);
      onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal menyimpan ruang lingkup');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(scope: AuditScope) {
    try {
      await deleteScope(scope.id);
      onReload();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Gagal menghapus ruang lingkup');
    }
  }

  function getSeksiNama(id: string | null): string {
    if (!id) return '-';
    return seksiList.find((s) => s.id === id)?.nama ?? id;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Ruang Lingkup</h3>
          <Badge variant="gray">{scopes.length} area</Badge>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={openCreate}>
            <Plus size={14} /> Tambah Area
          </Button>
        )}
      </div>

      {scopes.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={<MapPin size={40} />}
            title="Belum ada ruang lingkup"
            message="Tambahkan area yang akan diaudit. Tiap area wajib memiliki seksi terkait dan PIC."
            action={
              !readOnly ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus size={14} /> Tambah Area
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {scopes.map((scope, idx) => (
            <Card key={scope.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-gray-400">#{idx + 1}</span>
                    <h4 className="text-sm font-semibold text-gray-900">{scope.area}</h4>
                    {scope.kode_audit && (
                      <Badge variant="blue">{scope.kode_audit}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Seksi Terkait</p>
                      <p className="text-gray-700">{getSeksiNama(scope.seksi_terkait)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">PIC Area</p>
                      <p className="text-gray-700">{scope.pic_area ?? '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Proses Terkait</p>
                      <p className="text-gray-700">
                        {scope.proses_terkait.length > 0
                          ? resolveProsesNames(scope.proses_terkait, prosesList).join(', ')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Klausul Standar</p>
                      <p className="text-gray-700">
                        {scope.klausul_standar.length > 0
                          ? scope.klausul_standar.join(', ')
                          : '-'}
                      </p>
                    </div>
                  </div>
                  {scope.dokumen_referensi.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-400">Dokumen Referensi</p>
                      <p className="text-sm text-gray-700">{scope.dokumen_referensi.join(', ')}</p>
                    </div>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1 ml-4">
                    <button
                      onClick={() => openEdit(scope)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(scope)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={editingScope ? 'Edit Ruang Lingkup' : 'Tambah Ruang Lingkup'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nama Area" required>
            <Input
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              placeholder="mis. Produksi Line A"
            />
          </Field>

          <Field label="Seksi Terkait" required>
            <Select
              value={form.seksi_terkait}
              onChange={(e) => handleSeksiChange(e.target.value)}
            >
              <option value="">— Pilih Seksi —</option>
              {seksiList.map((s) => (
                <option key={s.id} value={s.id}>{s.nama}</option>
              ))}
            </Select>
          </Field>

          <Field label="PIC Area">
            <div className="flex items-center gap-2">
              <Input
                value={form.pic_area}
                onChange={(e) => setForm({ ...form, pic_area: e.target.value })}
                placeholder="Default: kepala seksi"
              />
              {form.pic_area && form.seksi_terkait && (() => {
                const seksi = seksiList.find((s) => s.id === form.seksi_terkait);
                return seksi?.kepala_seksi === form.pic_area ? <AutoFilledBadge /> : null;
              })()}
            </div>
          </Field>

          <Field label="Proses Terkait">
            <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
              {prosesList.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-1.5 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={form.proses_terkait.includes(p.id)}
                    onChange={() => toggleProses(p.id)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">{p.nama_proses}</span>
                </label>
              ))}
              {prosesList.length === 0 && (
                <span className="text-xs text-gray-400">Belum ada proses di master data</span>
              )}
            </div>
          </Field>
        </div>
      </Modal>
    </div>
  );
}
