// Data access layer untuk master Plant, TargetModel, Shift.

import { supabase } from '../lib/supabaseClient';
import type { Plant, TargetModel, Shift } from '../lib/types';
import { validateRequired } from '../lib/utils';

// ============================================================
// PLANTS
// ============================================================

function mapPlant(row: Record<string, unknown>): Plant {
  return {
    id: row.id as string,
    nama: row.nama as string,
    urutan_tampil: row.urutan_tampil as number,
    aktif: row.aktif as boolean,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getPlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .order('urutan_tampil', { ascending: true });
  if (error) throw new Error(`Gagal memuat plant: ${error.message}`);
  return (data ?? []).map((r) => mapPlant(r as Record<string, unknown>));
}

export async function getActivePlants(): Promise<Plant[]> {
  const { data, error } = await supabase
    .from('plants')
    .select('*')
    .eq('aktif', true)
    .order('urutan_tampil', { ascending: true });
  if (error) throw new Error(`Gagal memuat plant aktif: ${error.message}`);
  return (data ?? []).map((r) => mapPlant(r as Record<string, unknown>));
}

export async function savePlant(plant: Partial<Plant>): Promise<Plant> {
  validateRequired({ nama: plant.nama }, { nama: 'Nama Plant' });
  const payload = {
    nama: plant.nama,
    urutan_tampil: plant.urutan_tampil ?? 0,
    aktif: plant.aktif ?? true,
  };
  if (plant.id) {
    const { data, error } = await supabase
      .from('plants').update(payload).eq('id', plant.id).select().single();
    if (error) throw new Error(`Gagal mengupdate plant: ${error.message}`);
    return mapPlant(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from('plants').insert(payload).select().single();
  if (error) throw new Error(`Gagal menambah plant: ${error.message}`);
  return mapPlant(data as Record<string, unknown>);
}

export async function deletePlant(id: string): Promise<void> {
  const { error } = await supabase.from('plants').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus plant: ${error.message}`);
}

// ============================================================
// TARGET_MODELS
// ============================================================

function mapModel(row: Record<string, unknown>): TargetModel {
  return {
    id: row.id as string,
    plant_id: row.plant_id as string,
    nama: row.nama as string,
    urutan_tampil: row.urutan_tampil as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getTargetModels(): Promise<TargetModel[]> {
  const { data, error } = await supabase
    .from('target_models')
    .select('*')
    .order('urutan_tampil', { ascending: true });
  if (error) throw new Error(`Gagal memuat target model: ${error.message}`);
  return (data ?? []).map((r) => mapModel(r as Record<string, unknown>));
}

export async function saveTargetModel(model: Partial<TargetModel>): Promise<TargetModel> {
  validateRequired({ nama: model.nama, plant_id: model.plant_id }, { nama: 'Nama Model', plant_id: 'Plant' });
  const payload = {
    nama: model.nama,
    plant_id: model.plant_id,
    urutan_tampil: model.urutan_tampil ?? 0,
  };
  if (model.id) {
    const { data, error } = await supabase
      .from('target_models').update(payload).eq('id', model.id).select().single();
    if (error) throw new Error(`Gagal mengupdate target model: ${error.message}`);
    return mapModel(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from('target_models').insert(payload).select().single();
  if (error) throw new Error(`Gagal menambah target model: ${error.message}`);
  return mapModel(data as Record<string, unknown>);
}

export async function deleteTargetModel(id: string): Promise<void> {
  const { error } = await supabase.from('target_models').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus target model: ${error.message}`);
}

// ============================================================
// SHIFTS
// ============================================================

function mapShift(row: Record<string, unknown>): Shift {
  return {
    id: row.id as string,
    plant_id: row.plant_id as string,
    nama: row.nama as string,
    urutan_tampil: row.urutan_tampil as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getShifts(): Promise<Shift[]> {
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .order('urutan_tampil', { ascending: true });
  if (error) throw new Error(`Gagal memuat shift: ${error.message}`);
  return (data ?? []).map((r) => mapShift(r as Record<string, unknown>));
}

export async function saveShift(shift: Partial<Shift>): Promise<Shift> {
  validateRequired({ nama: shift.nama, plant_id: shift.plant_id }, { nama: 'Nama Shift', plant_id: 'Plant' });
  const payload = {
    nama: shift.nama,
    plant_id: shift.plant_id,
    urutan_tampil: shift.urutan_tampil ?? 0,
  };
  if (shift.id) {
    const { data, error } = await supabase
      .from('shifts').update(payload).eq('id', shift.id).select().single();
    if (error) throw new Error(`Gagal mengupdate shift: ${error.message}`);
    return mapShift(data as Record<string, unknown>);
  }
  const { data, error } = await supabase
    .from('shifts').insert(payload).select().single();
  if (error) throw new Error(`Gagal menambah shift: ${error.message}`);
  return mapShift(data as Record<string, unknown>);
}

export async function deleteShift(id: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', id);
  if (error) throw new Error(`Gagal menghapus shift: ${error.message}`);
}
