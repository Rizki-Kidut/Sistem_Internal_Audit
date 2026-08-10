// Halaman "Kelola Proses" — Master Data proses yang akan diaudit.
// Hanya menampilkan daftar proses (nama + kode) dengan aksi tambah/edit/hapus/aktif-nonaktif.
// Tidak ada matriks dan tidak ada input simbol seksi di sini.
// Penugasan simbol seksi dilakukan di menu Rencana Audit Tahunan.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Eye, EyeOff, Workflow } from 'lucide-react';
import type { Proses } from '../../lib/types';
import {
  getAllProses,
  saveProses,
  deleteProses,
  toggleDiauditTahunIni,
  generateKodeProses,
} from '../../services/prosesService';
import { ProsesForm } from './proses/ProsesForm';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Button, Card, Badge, EmptyState, LoadingSpinner } from '../ui';

export function ProsesPage() {
  const [prosesList, setProsesList] = useState<Proses[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingProses, setEditingProses] = useState<Proses | null>(null);
  const [generatedKode, setGeneratedKode] = useState('PRC-001');

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<Proses | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const proses = await getAllProses();
      setProsesList(proses);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleOpenCreate() {
    setError(null);
    try {
      const kode = await generateKodeProses();
      setGeneratedKode(kode);
    } catch {
      setGeneratedKode('PRC-001');
    }
    setFormMode('create');
    setEditingProses(null);
    setFormOpen(true);
  }

  function handleOpenEdit(proses: Proses) {
    setError(null);
    setFormMode('edit');
    setEditingProses(proses);
    setFormOpen(true);
  }

  async function handleSave(data: Partial<Proses>) {
    await saveProses(data);
    await loadData();
  }

  async function handleToggleActive(proses: Proses) {
    try {
      await toggleDiauditTahunIni(proses.id, proses.diaudit_tahun_ini);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengubah status');
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteProses(confirmDelete.id);
      setConfirmDelete(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghapus');
    }
  }

  if (loading) return <LoadingSpinner message="Memuat data proses..." />;

  const visibleProses = showInactive ? prosesList : prosesList.filter((p) => p.diaudit_tahun_ini);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kelola Proses</h1>
          <p className="mt-1 text-sm text-gray-500">
            Master data proses yang akan diaudit. Proses di sini otomatis muncul sebagai baris di matriks Rencana Audit Tahunan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={showInactive ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
            title={showInactive ? 'Sembunyikan proses inactive' : 'Tampilkan proses inactive'}
          >
            {showInactive ? <Eye size={14} /> : <EyeOff size={14} />}
            {showInactive ? 'Sembunyikan Inactive' : 'Tampilkan Inactive'}
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus size={16} /> Tambah Proses
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {visibleProses.length === 0 ? (
        <Card className="p-12">
          <EmptyState
            icon={<Workflow size={40} />}
            title="Belum ada proses"
            message="Tambahkan proses yang akan diaudit menggunakan tombol Tambah Proses. Proses yang aktif akan otomatis muncul di matriks Rencana Audit Tahunan."
            action={
              <Button onClick={handleOpenCreate}>
                <Plus size={16} /> Tambah Proses
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                  No.
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Kode Proses
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Nama Proses
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleProses.map((p, idx) => (
                <tr
                  key={p.id}
                  className={`hover:bg-gray-50 transition-colors ${!p.diaudit_tahun_ini ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3 text-sm text-gray-400 font-mono">{idx + 1}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">{p.kode_proses}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.nama_proses}</td>
                  <td className="px-4 py-3">
                    {p.diaudit_tahun_ini ? (
                      <Badge variant="green">Aktif</Badge>
                    ) : (
                      <Badge variant="gray">Inactive</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => handleToggleActive(p)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          p.diaudit_tahun_ini
                            ? 'text-green-600 hover:bg-green-50'
                            : 'text-gray-500 hover:bg-gray-100'
                        }`}
                        title={p.diaudit_tahun_ini ? 'Set inactive' : 'Set active'}
                      >
                        {p.diaudit_tahun_ini ? 'Aktif' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="px-2 py-1 rounded text-xs text-blue-600 hover:bg-blue-50 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(p)}
                        className="px-2 py-1 rounded text-xs text-red-500 hover:bg-red-50 font-medium"
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <ProsesForm
        open={formOpen}
        mode={formMode}
        proses={editingProses}
        generatedKode={generatedKode}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Hapus Proses"
        message={`Yakin ingin menghapus proses "${confirmDelete?.nama_proses}"? Proses ini juga akan dihapus dari semua rencana audit yang menggunakannya.`}
        confirmLabel="Hapus"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
