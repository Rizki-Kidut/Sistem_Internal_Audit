/*
# Fix duplicate audit_plan_process rows & enforce uniqueness

## Why
`syncProcessesFromMaster` dipanggil setiap kali halaman Rencana Audit dibuka.
Karena tidak ada constraint UNIQUE, jika fungsi di-trigger lebih dari sekali
(sebelum master selesai dimuat, atau StrictMode double-invoke), proses master
yang sama bisa ter-insert berkali-kali ke satu plan — menghasilkan baris ganda
di matriks (lihat laporan user: "Internal Audit" muncul 3x, "Continous
Improvement" 2x).

## Changes
1. Hapus baris duplikat yang sudah ada di `audit_plan_process` untuk kombinasi
   (plan_id, proses_master_id) yang sama, menyisakan satu baris per kombinasi.
   Baris dengan `proses_master_id IS NULL` (ditik manual) tidak disentuh.
2. Tambahkan UNIQUE constraint `uq_audit_plan_process_plan_master` pada
   (plan_id, proses_master_id) — mencegah duplikat di level database.
   Constraint bersifat partial: hanya berlaku saat proses_master_id IS NOT NULL,
   supaya baris manual (NULL) tetap boleh lebih dari satu.
3. Buat index pendukung `idx_audit_plan_process_plan_master` untuk query
   sinkronisasi yang lebih cepat.

## Notes
- Tidak ada kolom atau tabel yang dihapus; data unik dipertahankan.
- RLS tidak berubah (sudah ada dari migration sebelumnya).
*/

-- 1. Bersihkan duplikat yang sudah ada: simpan satu baris per (plan_id, proses_master_id)
DELETE FROM audit_plan_process
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY plan_id, proses_master_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM audit_plan_process
    WHERE proses_master_id IS NOT NULL
  ) dups
  WHERE dups.rn > 1
);

-- 2. Index pendukung untuk query sinkronisasi
CREATE INDEX IF NOT EXISTS idx_audit_plan_process_plan_master
  ON audit_plan_process (plan_id, proses_master_id)
  WHERE proses_master_id IS NOT NULL;

-- 3. Unique constraint partial: satu proses_master per plan
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_plan_process_plan_master
  ON audit_plan_process (plan_id, proses_master_id)
  WHERE proses_master_id IS NOT NULL;
