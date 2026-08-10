// Halaman "Kelola Seksi" — CRUD master organisasi.
// Field kepalaSeksi akan dipakai sebagai default PIC di banyak tempat pada batch berikutnya.

import { useEffect, useState } from 'react';
import { Plus, Pencil, Power, Settings } from 'lucide-react';
import {
  getSeksiList,
  saveSeksi,
  deactivateSeksi,
  reactivateSeksi,
  deleteSeksi,
} from '../../services/seksiService';
import type { Seksi } from '../../lib/types';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Field, Input } from '../ui/Field';
import { Button, Card, Badge, EmptyState, LoadingSpinner } from '../ui';

export function SeksiPage() {
  const [seksiList, setSeksiList] = useState<Seksi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Seksi | null>(null);
  const [form, setForm] = useState({ nama: '', kepala_seksi: '', urutan_tampil: 0 });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<Seksi | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const list = await getSeksiList();
      setSeksiList(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({
      nama: '',
      kepala_seksi: '',
      urutan_tampil: seksiList.length > 0 ? Math.max(...seksiList.map((s) => s.urutan_tampil)) + 1 : 1,
    });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(s: Seksi) {
    setEditing(s);
    setForm({
      nama: s.nama,
      kepala_seksi: s.kepala_seksi ?? '',
      urutan_tampil: s.urutan_tampil,
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    setSaving(true);
    try {
      await saveSeksi({
        id: editing?.id,
        nama: form.nama.trim(),
        kepala_seksi: form.kepala_seksi.trim() || null,
        urutan_tampil: form.urutan_tampil,
        aktif: true,
      });
      setModalOpen(false);
      await loadData();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(s: Seksi) {
    try {
      if (s.aktif) {
        await deactivateSeksi(s.id);
      } else {
        await reactivateSeksi(s.id);
      }
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteSeksi(confirmDelete.id);
      setConfirmDelete(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Seksi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Master organisasi. Kepala seksi akan dipakai sebagai default PIC di modul audit.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Tambah Seksi
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        {loading ? (
          <LoadingSpinner />
        ) : seksiList.length === 0 ? (
          <EmptyState
            icon={<Settings size={40} />}
            title="Belum ada seksi"
            message="Tambahkan seksi/department untuk mulai membangun rencana audit."
            action={
              <Button onClick={openCreate}>
                <Plus size={16} /> Tambah Seksi
              </Button>
            }
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Seksi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Kepala Seksi</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Urutan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {seksiList.map((s, idx) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.nama}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.kepala_seksi ?? '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.urutan_tampil}</td>
                  <td className="px-4 py-3">
                    <Badge variant={s.aktif ? 'green' : 'gray'}>
                      {s.aktif ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(s)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => handleToggleActive(s)}
                        className={`p-1.5 rounded transition-colors ${
                          s.aktif
                            ? 'text-gray-500 hover:text-amber-600 hover:bg-amber-50'
                            : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={s.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <Power size={16} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(s)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Hapus"
                      >
                        <Settings size={16} className="rotate-90" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal Create/Edit */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Seksi' : 'Tambah Seksi'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
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
          <Field label="Nama Seksi" required>
            <Input
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="mis. Production, Quality Control, Engineering"
              autoFocus
            />
          </Field>
          <Field label="Kepala Seksi" >
            <Input
              value={form.kepala_seksi}
              onChange={(e) => setForm({ ...form, kepala_seksi: e.target.value })}
              placeholder="Nama kepala seksi (opsional)"
            />
          </Field>
          <Field label="Urutan Tampil">
            <Input
              type="number"
              value={form.urutan_tampil}
              onChange={(e) => setForm({ ...form, urutan_tampil: parseInt(e.target.value) || 0 })}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Seksi"
        message={`Yakin ingin menghapus "${confirmDelete?.nama}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmLabel="Hapus"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}


