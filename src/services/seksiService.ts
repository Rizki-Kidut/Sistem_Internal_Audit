// Data access layer untuk master Seksi.
// Komponen UI TIDAK BOLEH langsung memanggil supabase — lewat sini.

import { supabase } from '../lib/supabaseClient';
import type { Seksi } from '../lib/types';
import { validateRequired } from '../lib/utils';

export async function getSeksiList(): Promise<Seksi[]> {
  const { data, error } = await supabase
    .from('seksi')
    .select('*')
    .order('urutan_tampil', { ascending: true });

  if (error) throw new Error(`Gagal memuat daftar seksi: ${error.message}`);
  return (data ?? []) as Seksi[];
}

export async function getSeksiAktif(): Promise<Seksi[]> {
  const { data, error } = await supabase
    .from('seksi')
    .select('*')
    .eq('aktif', true)
    .order('urutan_tampil', { ascending: true });

  if (error) throw new Error(`Gagal memuat seksi aktif: ${error.message}`);
  return (data ?? []) as Seksi[];
}

export async function saveSeksi(seksi: Partial<Seksi>): Promise<Seksi> {
  validateRequired(
    { nama: seksi.nama },
    { nama: 'Nama Seksi' },
  );

  const payload = {
    nama: seksi.nama,
    kepala_seksi: seksi.kepala_seksi ?? null,
    urutan_tampil: seksi.urutan_tampil ?? 0,
    aktif: seksi.aktif ?? true,
  };

  if (seksi.id) {
    const { data, error } = await supabase
      .from('seksi')
      .update(payload)
      .eq('id', seksi.id)
      .select()
      .single();
    if (error) throw new Error(`Gagal mengupdate seksi: ${error.message}`);
    return data as Seksi;
  }

  const { data, error } = await supabase
    .from('seksi')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(`Gagal menambah seksi: ${error.message}`);
  return data as Seksi;
}

// Soft-delete: set aktif=false, jangan hard-delete.
export async function deactivateSeksi(id: string): Promise<void> {
  const { error } = await supabase
    .from('seksi')
    .update({ aktif: false })
    .eq('id', id);
  if (error) throw new Error(`Gagal menonaktifkan seksi: ${error.message}`);
}

export async function reactivateSeksi(id: string): Promise<void> {
  const { error } = await supabase
    .from('seksi')
    .update({ aktif: true })
    .eq('id', id);
  if (error) throw new Error(`Gagal mengaktifkan kembali seksi: ${error.message}`);
}

export async function deleteSeksi(id: string): Promise<void> {
  const { error } = await supabase
    .from('seksi')
    .delete()
    .eq('id', id);
  if (error) throw new Error(`Gagal menghapus seksi: ${error.message}`);
}
