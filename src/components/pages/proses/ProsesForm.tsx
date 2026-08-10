// Form modal untuk tambah/edit proses (hanya data inti prosesnya saja).
// Penugasan seksi dan tanda *1/*2 dilakukan terpisah di matriks, bukan di form ini.

import { useEffect, useState } from 'react';
import type { Proses } from '../../../lib/types';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui';
import { Field, Input, Select } from '../../ui/Field';

interface ProsesFormProps {
  open: boolean;
  mode: 'create' | 'edit';
  proses: Proses | null;
  generatedKode: string;
  onSave: (data: Partial<Proses>) => Promise<void>;
  onClose: () => void;
}

export function ProsesForm({
  open,
  mode,
  proses,
  generatedKode,
  onSave,
  onClose,
}: ProsesFormProps) {
  const [namaProses, setNamaProses] = useState('');
  const [kodeProses, setKodeProses] = useState('');
  const [diauditTahunIni, setDiauditTahunIni] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === 'edit' && proses) {
      setNamaProses(proses.nama_proses);
      setKodeProses(proses.kode_proses);
      setDiauditTahunIni(proses.diaudit_tahun_ini);
    } else {
      setNamaProses('');
      setKodeProses(generatedKode);
      setDiauditTahunIni(true);
    }
  }, [open, mode, proses, generatedKode]);

  async function handleSubmit() {
    setError(null);
    if (!namaProses.trim()) {
      setError('Nama Proses wajib diisi');
      return;
    }
    if (!kodeProses.trim()) {
      setError('Kode Proses wajib diisi');
      return;
    }

    const prosesData: Partial<Proses> = {
      nama_proses: namaProses.trim(),
      kode_proses: kodeProses.trim(),
      diaudit_tahun_ini: diauditTahunIni,
    };
    if (mode === 'edit' && proses) {
      prosesData.id = proses.id;
    }

    setSaving(true);
    try {
      await onSave(prosesData);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Tambah Proses' : 'Edit Proses'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <Field label="Nama Proses" required>
          <Input
            value={namaProses}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNamaProses(e.target.value)}
            placeholder="Nama proses yang diaudit"
          />
        </Field>

        <Field label="Kode Proses" required>
          <Input
            value={kodeProses}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKodeProses(e.target.value)}
            placeholder="PRC-001"
            disabled={mode === 'edit'}
          />
        </Field>

        <Field label="Status">
          <Select
            value={diauditTahunIni ? 'true' : 'false'}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setDiauditTahunIni(e.target.value === 'true')
            }
          >
            <option value="true">Diaudit Tahun Ini (Aktif)</option>
            <option value="false">Inactive (tidak diaudit tahun ini)</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
