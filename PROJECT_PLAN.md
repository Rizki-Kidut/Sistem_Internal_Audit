# PROJECT_PLAN.md — CertiTrack: Pelaksanaan Internal Audit

> **Repository compatibility note — audit source 19 Aug 2026**
>
> This file remains the **target product specification** derived from the original Bolt step-by-step plan.
> The current GitHub export uses **snake_case** for Supabase columns and most TypeScript interfaces
> (`kode_audit`, `program_id`, `tanggal_mulai`, etc.), while the original product prompt used conceptual
> camelCase names (`kodeAudit`, `programId`, `tanggalMulai`, etc.).
>
> **Do not perform a bulk naming rewrite.** In this repository, preserve the established snake_case
> convention unless a specific migration/refactor is explicitly required. Treat conceptual
> `kodeAudit` in this plan as the same domain concept as repository field `kode_audit`.
>
> The repository also contains a nested `project/` directory that is an older snapshot. The active,
> newer implementation is the repository-root `src/` and root `supabase/migrations/`.
>
> The target specification says Calibration and Auditor Competency/Training already exist elsewhere.
> In this GitHub export they are not actually present: `App.tsx` renders placeholders, and Batch 3b
> currently uses a local `auditors` table as a stand-in. This is an integration dependency, not a reason
> to silently redesign the target architecture.

## 1. Project Scope

### Superseding workflow architecture decision — 20 Aug 2026

The active user-facing workflow is now **Rencana Audit Tahunan → Program Internal Audit → Instruksi
Internal Audit → Checklist Audit → Agenda Audit → Temuan/PLOR → CAR → Laporan**. `QA-xx` is the
primary business identifier throughout that workflow. The former **Jadwal & Tim Audit** step and its
`IA-{year}-{NNN}` identifier are legacy compatibility behavior and are not part of new normal usage.

Scheduling dates (`tanggal_plan_audit` and `tanggal_pelaksanaan_audit`) belong to each Instruksi row.
Team Audit is Master Data. The former QA-row Team/auditor snapshot behavior is superseded by the
annual live-roster refinement below; legacy snapshots remain readable only.
Instruksi supplies upstream audit data, while the active **Checklist Audit** sidebar page is the one
primary editor for System, Product, Manufacturing, and Shift checklists.

Legacy `audit_schedules`, `audit_scopes`, and schedule-specific `audit_teams` records remain intact
for compatibility/history, but new Instruksi generation and editing no longer reads from or writes to
those tables. Historical Batch 3 sections below are retained as implementation history and are
superseded wherever they conflict with this decision.

### Final Annual Team Audit refinement — 20 Aug 2026

Each Team Audit belongs to exactly one Annual Audit Plan in the normal workflow. Team codes may be
reused under different plans/years, and an Instruksi may select only an active, locked Team from its
own plan. Lead and Members come from active Internal Auditor master data through searchable
single/multi selectors. Team Master and its normalized members are the live source of truth; new QA
rows do not snapshot a roster. The existing `audit_instruction_rows.team` / `auditor` and
`checklist_manufaktur_shift.auditor` columns are retained as legacy compatibility data only.

Unlocked Teams may be edited. Locking finalizes a valid roster and is required before assignment and
checklist execution. A Team cannot be unlocked after any linked QA checklist begins, and a QA Team
assignment cannot change after its checklist exists. Date/section changes dynamically revalidate
current Team competency and independence. Checklist Audit remains the sole primary checklist
workspace, while Jadwal/IA tables remain legacy-only.

CertiTrack is an internal QMS application.

Existing modules that are outside the implementation scope of this plan:

- Calibration
- Auditor Competency/Training

The Internal Audit module must reuse auditor data from the existing Auditor Competency/Training module. Do not create a separate auditor master.

This document defines the intended final state of the **Pelaksanaan Internal Audit** module.

---

## 2. Product-Wide Rules

### UI

- Sidebar: `blue-800`
- Font: Inter
- Tailwind CSS
- Reuse existing CertiTrack card/table/modal/form patterns
- Indonesian UI language
- Indonesian date formatting

### Data inheritance

If a value already exists in an upstream document, auto-fill it instead of asking the user to type it again.

Auto-filled fields should be read-only where appropriate.

Derived values should stay computed from their source unless a historical snapshot is explicitly required.

### Central identifier

A central stable `kodeAudit` links:

- Checklist
- Agenda
- Finding
- CAR
- Report

For Instruction Internal Audit rows:

`kodeAudit = QA-01, QA-02, ...`

It is auto-incremented and immutable after generation.

### Finding categories

- `O` = Sesuai
- `A` = Major
- `B` = Minor
- `C` = OFI / Peluang Improvement
- `N-A` where applicable

Only `A`, `B`, and `C` generate findings.

### Overall business flow

Rencana Tahunan
→ Program Audit
→ Instruksi Audit
→ Checklist
→ Agenda
→ Temuan / PLOR
→ CAR
→ Daftar Ketidaksesuaian / Laporan
→ Weakness Analysis
→ Rangkuman Hasil Audit

### Engineering rules

- Separate data-access from UI.
- UI components must not access localStorage directly.
- Generated-code logic must be reusable.
- Keep field names consistent across files.
- Use centralized constants/enums.
- Validate required fields in save/domain logic, not UI only.
- Use optional chaining for nullable relationships.
- Keep inherited fields computed when appropriate.
- Use short comments only around important business logic.

---

# 3. Implementation Batches

## Batch 1 — Kelola Proses + Rencana Audit Tahunan + Bank Checklist

### 3.1 Kelola Proses

Global master, independent of year.

Only store process names and supporting metadata. Do not encode symbols in the process name.

#### Data

```ts
prosesMaster: {
  id,
  namaProses,
  catatanKaki?,
  urutanTampil,
  status // Aktif | Nonaktif
}
```

#### Requirements

- CRUD
- Reorder
- This is the only place where processes are created in the app.
- Other modules must consume this master rather than create their own process entries.

---

### 3.2 Rencana Audit Tahunan

#### Approval header

Fields:

- `tahun`
- `tanggalBerlaku`
- `noRevisi`
- `kodeDokumen = "Q-120-ISE-001-FORM-001"`
- `penanggungJawabQMS`
- `disetujuiOleh`
- `status = Draft | Approved`

Approved records are read-only except for:

**Buat Revisi Baru**

Creating a revision:

- increments revision number,
- preserves the previous revision,
- does not overwrite history.

#### Data

```ts
auditPlans: {
  id,
  tahun,
  tanggalBerlaku,
  noRevisi,
  kodeDokumen,
  penanggungJawabQMS,
  disetujuiOleh,
  status,
  seksiTerlibat: seksiId[],
  createdAt,
  updatedAt
}

seksi: {
  id,
  nama,
  kepalaSeksi,
  urutanTampil,
  aktif
}

auditPlanSeksiLink: {
  id,
  planId,
  processId, // ref prosesMaster
  seksiId,
  terkait: boolean
}

auditPlanSchedule: {
  id,
  planId,
  processId, // ref prosesMaster
  bulan, // 1..12
  plan: boolean,
  aktual: boolean,
  scheduleId: null | id
}
```

#### Kelola Seksi

Provide a CRUD page for `seksi`.

`kepalaSeksi` becomes the default PIC in downstream modules.

#### Matrix behavior

Process rows are generated automatically from active `prosesMaster`.

There must be no **Tambah Proses** button on the annual audit plan page.

If a new active process is added to `prosesMaster`, it must appear automatically in the matrix, including for existing or Approved plans.

Grid:

- rows: Proses
- columns: Seksi
- clickable relationship toggle
- Jan–Dec schedule
- each month has Plan / Aktual states
- interactions happen directly in the grid without a modal

#### Copy previous year

When creating a new annual plan:

**Salin dari Tahun Lalu**

copies `seksiTerlibat`.

---

### 3.3 Bank Checklist

Three-level business navigation:

Proses
→ Sub-Proses
→ Kelompok IPO
→ numbered questions

A question may have sub-bullets.

#### Data

```ts
checklistBankItems: {
  id,
  proses,
  subProses,
  picSubProses,
  kelompokIPO, // Input Proses | Method Proses | Output Proses
  nomor,
  klausul,
  pertanyaanUtama,
  subPertanyaan: { teks }[],
  metodeVerifikasiDefault, // Observasi | Wawancara | Dokumen | Sampling
  status // Aktif | Nonaktif
}
```

#### Requirements

- Accordion navigation
- CRUD
- Soft delete by setting Nonaktif
- Do not hard-delete checklist master items

---

# Batch 2 — Program Internal Audit

Menu:

**Program Internal Audit**

Created from an Approved annual audit plan.

Annual Audit Plan page includes:

**Buat Program Internal Audit**

### Data

```ts
auditPrograms: {
  id,
  planId,
  jenisRonde, // Berkala | Khusus
  nomorKe,
  tahun,
  tanggalDibuat,
  tanggalRevisi,
  noRevisi,
  penanggungJawabQMS,
  management,
  tujuan,
  poinPerhatian,
  periodeLabel: string[], // legacy/backward compatibility; tidak ditampilkan di UI
  status, // Draft | Approved
  kodeDokumen // "Q-120-ISE-001-FORM-002"
}

auditProgramDistribusi: {
  id,
  programId,
  seksiId,
  namaSectionManager
}

auditProgramRisiko: {
  id,
  programId,
  nomor,
  risikoPeluang,
  controlAction
}

auditProgramSteps: {
  id,
  programId,
  nomor, // 1..7
  itemPelaksanaan,
  prosedurPelaksanaan,
  tanggalAwal,
  tanggalAkhir,
  periodeTarget: boolean[], // legacy/backward compatibility
  pic
}

auditProgramStepTemplate
```

### Schedule Dasar date range

Setiap langkah menggunakan dua kolom tanggal: **Tanggal Awal** dan **Tanggal Akhir**.
Jika keduanya diisi, Tanggal Akhir tidak boleh lebih awal dari Tanggal Awal. Field lama
`periodeLabel` dan `periodeTarget` tetap disimpan hanya untuk kompatibilitas data historis dan tidak
ditampilkan sebagai editor/toggle pada UI.

Rentang satu hari valid (`tanggalAwal === tanggalAkhir`). Setiap tampilan cetak/ekspor Program
Internal Audit di masa depan wajib memakai formatter terpusat `formatRentangTanggal()` agar tanggal
yang sama hanya dicetak sekali dan rentang berbeda memakai format Indonesia yang ringkas.

### Distribution

When a section is selected:

`namaSectionManager`

auto-fills from:

`seksi.kepalaSeksi`

but remains overridable.

### Seed the seven standard steps once

1. Penerbitan rencana audit — Audit Team Leader
2. Penerbitan checklist audit — Audit Team Leader
3. Pelaksanaan audit — Audit Team
4. Pembuatan laporan internal audit — Audit Team
5. Pembuatan rencana tindakan perbaikan (jika ada) — Manager Proses/Sekretaris Auditee
6. Pelaksanaan audit follow-up + kirim laporan tindakan perbaikan — Audit Team
7. Notifikasi audit selesai — QMS Representative

When a program is created, copy the template into `auditProgramSteps`.

### Form layout

- Approval header
- Tujuan
- Poin Perhatian
- Tujuan Distribusi table
- Risiko/Peluang table
- 7-step Schedule Dasar with Tanggal Awal and Tanggal Akhir columns

---

# Batch 3a — Jadwal Audit

> **SUPERSEDED FOR NEW WORKFLOW (20 Aug 2026):** This section describes retained legacy
> `audit_schedules`/`audit_scopes` behavior only. It is not exposed in active navigation and receives
> no writes from new normal Instruksi operations.

Menu:

**Jadwal Audit**

Use a 2-step wizard.

### Data

```ts
auditSchedules: {
  id,
  kodeAudit, // legacy scheduling identifier: IA-{tahun}-{urutan3digit}
  planId,
  programId,
  tanggalMulai,
  tanggalSelesai,
  jenisAudit, // Internal | Surveillance-prep | Follow-up
  standar: string[], // ISO 9001 | IATF 16949
  status, // Draft | Scheduled | In Progress | Completed | Closed
  approvedBy
}

auditScopes: {
  id,
  scheduleId,
  kodeAudit: null | string, // central QA-xx propagated later
  area,
  seksiTerkait,
  prosesTerkait: [],
  klausulStandar: [],
  dokumenReferensi: [],
  picArea
}
```

> Note: the original Bolt specification used `kodeAudit` for the schedule identifier as well as the later central `QA-xx` identifier. During implementation, preserve compatibility with existing code but avoid conflating the two concepts. The Instruction Internal Audit `QA-xx` value is the central cross-document identifier.

### Wizard step 1

- auto schedule identifier
- tanggal mulai
- tanggal selesai
- jenis audit
- multi-checkbox standard

### Wizard step 2

Select multiple audit areas from `prosesMaster`.

For every selected area:

- Seksi Terkait is required
- PIC Area is required
- default PIC = `seksi.kepalaSeksi`

Allow custom area additions.

Validation:

Schedule cannot enter `Scheduled` without at least one area + section.

### Pages

List page:

**Jadwal Audit**

Detail page:

**Detail Sesi Audit**

Initial tab:

- Ruang Lingkup

Do not fill future tabs yet except placeholders explicitly required later.

---

# Batch 3b — Tim Audit + Validasi

### Data

```ts
auditTeams: {
  id,
  scheduleId,
  leadAuditorId, // ref existing auditor Training module
  memberIds: [],
  auditeeAreaOwnerIds: []
}
```

### Tim Audit tab

On Detail Sesi Audit:

- select Lead Auditor
- select Members
- source all auditors from the existing Auditor Competency/Training module

### Automatic validation

If auditor competency is invalid or expired:

- disable selection
- red badge: `Tidak memenuhi syarat`

If auditor belongs to the same department as the audited area:

- yellow badge: `Berpotensi konflik independensi`
- selection remains possible
- justification note becomes required

### Placeholders

Prepare empty tabs:

- Checklist
- Agenda
- Pelaksanaan
- Temuan

---

# Batch 4a — Instruksi Internal Audit: Data

### Data

```ts
auditInstructions: {
  id,
  programId,
  tahunFiskal,
  tujuanAudit,
  tanggalBuat,
  tanggalRevisi,
  noRevisi,
  kodeDokumen, // "Q-120-ISE-001-FORM-003"
  approvalPembuatan: {
    dibuatOlehQMS,
    disetujuiOlehDirektur
  },
  approvalSelesai: {
    dibuatOlehQMS,
    disetujuiOlehDirektur
  },
  prefixNomorAudit, // default "QA-"
  status // Draft | Berjalan | Selesai
}

auditInstructionRows: {
  id,
  instructionId,
  kodeAudit, // unique QA-01 etc; immutable once generated
  team,
  prosesId,
  pemilikProses,
  seksiMarks: {
    seksiId,
    tipe // target | terkait
  }[],
  auditor: {
    ref,
    isLead: boolean
  }[],
  tipeBaris, // Reguler | AuditProduk | AuditManufaktur | AuditShift
  matriksProdukMarks: {
    plantId,
    targetModelId
  }[],
  matriksManufakturShiftMarks: {
    plantId,
    shiftId
  }[],
  tanggalAuditProduk,
  namaAuditorProduk,
  kualifikasi, // Y | N
  itemLainDiperiksa,
  tanggalPlanAudit,
  tanggalPelaksanaanAudit,
  cekSelesai: boolean,
  statusProgress // computed; initially Belum Mulai
}

plants: {
  id,
  nama,
  urutanTampil,
  aktif
}

targetModels: {
  id,
  plantId,
  nama,
  urutanTampil
}

shifts: {
  id,
  plantId,
  nama,
  urutanTampil
}
```

### Auto-filled values

- `pemilikProses` from the target section's `kepalaSeksi`
- `seksiMarks` from `auditPlanSeksiLink`
- auditor values from existing auditor data

If `namaAuditorProduk` is empty, provide:

**Sama dengan Auditor**

and render label:

`(Lihat kolom Auditor)`

### Row-type exclusivity

`Reguler`:

- locks both special matrices

Special types:

- lock the Seksi matrix as applicable

### Admin

Provide small CRUD pages for:

- plants
- targetModels
- shifts

### Pages

- Instruksi Internal Audit list
- detail page
- editable `auditInstructionRows` grid
- manual row creation in this batch

Automatic generation comes in Batch 4b.

---

# Batch 4b — Instruksi Internal Audit: Generate + Grid

On Program Internal Audit page:

**Generate dari Program**

Create:

- one `auditInstruction`
- one `auditInstructionRow` per related `prosesMaster`

### Per generated row

- `kodeAudit`: sequential QA-xx
- `seksiMarks`: copy/derive from `auditPlanSeksiLink`
- `pemilikProses`: from `seksi.kepalaSeksi`
- `tanggalPlanAudit`: suggested from month where `auditPlanSchedule.plan = true`

If matching `auditSchedule` / `auditTeam` exists:

- auto-link

If not:

- leave editable in this grid
- completing the data here creates the required `auditScope` + `auditTeam`

After row generation:

propagate the central `kodeAudit` to related:

`auditScopes.kodeAudit`

### Grid columns

- Team
- Proses
- Pemilik Proses
- No. Audit
- Auditor
- Seksi matrix (`★ / • / N-A`)
- Audit Produk matrix, two-level header `Plant → Model`
- Manufaktur & Shift matrix, two-level header `Plant → Shift`
- Item Lain
- Tanggal Plan
- Tanggal Pelaksanaan
- Cek Selesai
- Status Progress badge

Special row types display a blue label badge.

### Atomicity

Generate-from-Program must be atomic.

If generation fails halfway, do not leave partial instruction data.

---

# Batch 5a — Checklist Sistem

Applies to:

`tipeBaris = Reguler`

Display `kodeAudit` as a header badge.

### Data

```ts
checklists: {
  id,
  kodeAudit,
  judulChecklist,
  seksiAuditee: [],
  sectionManager,
  tanggalDibuat,
  dibuatOleh,
  penanggungJawabQMS,
  kodeDokumen, // "Q-120-ISE-001-FORM-005"
  picProses,
  itemMonitoringJelas,
  kondisiPencapaianTarget
}

checklistItems: {
  id,
  checklistId,
  bankItemId?,
  subProses,
  kelompokIPO,
  nomor,
  klausul,
  pertanyaanUtama,
  subPertanyaan: {
    teks,
    sesuai?: boolean
  }[],
  metodeVerifikasi,
  hasil, // O | A | B | C | N-A
  komentarAuditor,
  findingId: null | id
}
```

### Auto values

- `seksiAuditee` from `seksiMarks`
- `sectionManager` from `pemilikProses`, read-only
- `dibuatOleh` from lead auditor, read-only

### Checklist initialization

When creating a checklist:

1. read `prosesId` from the related `auditInstructionRow`;
2. load active matching `checklistBankItems`;
3. initialize checklist items;
4. group by `Sub-Proses → IPO`.

Auditor may:

- add a manual row (`bankItemId = null`)
- skip a bank row

### Detail Sesi Audit

Populate Checklist tab for Regular rows.

Other row types remain placeholders until their batches.

---

# Batch 5b — Checklist Audit Produk

Applies to:

`tipeBaris = AuditProduk`

### Data

```ts
checklistProduk: {
  id,
  kodeAudit,
  namaInspector,
  kualifikasiInspector,
  partName,
  partNo,
  controlPlanNo,
  status, // Draft | Selesai
  kodeDokumen // "Q-120-ISE-001-FORM-006"
}

checklistProdukFase: {
  id,
  checklistProdukId,
  namaFase,
  namaProses,
  inspectionResultChart: boolean,
  noInspectionStandard,
  dokumenBukti: file[]
}

checklistProdukItems: {
  id,
  faseId,
  kategori,
  jumlahSampelMinimal,
  itemPemeriksaan,
  alatPemeriksaan,
  standarKriteria,
  jumlahSampel,
  hasilPemeriksaan,
  judgment // OK | NG
}
```

### Auto fields

- `namaInspector` from `namaAuditorProduk`
- `kualifikasiInspector` from `kualifikasi`

### Required evidence

Every phase requires at least one `dokumenBukti`.

Validation belongs in save/domain logic.

Checklist status cannot become `Selesai` while any phase lacks evidence.

### Detail Sesi Audit

Render this component in Checklist tab for `AuditProduk`.

---

# Batch 5c — Checklist Audit Manufaktur & Shift

Applies to:

- `AuditManufaktur`
- `AuditShift`

### Data

```ts
checklistManufakturShift: {
  id,
  kodeAudit,
  jenisChecklist: [],
  namaSeksi,
  managerProsesLineLeader,
  tanggalAudit,
  auditor,
  namaPart,
  nomorPart,
  nomorLine,
  controlPlanNo,
  pFmeaNo,
  customer,
  jumlahOperator,
  status,
  kodeDokumen // "Q-120-ISE-001-FORM-007"
}

checklistManufakturBankItem: {
  // master bank
}

checklistManufakturItems: {
  id,
  checklistId,
  bankItemId,
  noProsesDicek,
  hasilPengamatan,
  hasil, // O | A | B | C | N-A
  findingId: null | id
}
```

### Auto/suggested values

- `jenisChecklist` may include more than one value
- suggest from `matriksManufakturShiftMarks`
- `managerProsesLineLeader` from `pemilikProses`
- `tanggalAudit` from `tanggalPelaksanaanAudit`
- auditor auto-filled

### Seed bank

Seed initial sample items only:

- section A items 1–19
- clause references including:
  - IATF 9.2.2.1
  - 5.3.2
  - 9.1.1.1
  - 8.6
  - 8.7
  - 8.7.1.3
  - 7.2
  - 7.3
- B-1
- B-2
- B-3

Full text may be completed later.

### Checklist tab

After this batch, Checklist tab automatically selects the correct one of:

- System checklist
- Product checklist
- Manufacturing/Shift checklist

No placeholder should remain for supported row types.

---

# Batch 5d — Agenda Internal Audit

> **Keputusan produk pengganti — 21 Agustus 2026.** Workspace aktif Batch 5d adalah menu pusat
> **Agenda Internal Audit** di sidebar. Satu QA / baris Instruksi memiliki maksimal satu Agenda,
> dan Agenda hanya berelasi ke `audit_instruction_rows`: tidak ada dependensi Checklist maupun
> Jadwal/Detail Sesi legacy. Data Instruksi dan roster Team diwarisi secara live, bukan snapshot.
> `tujuan_lingkup_audit`, `item_lain_yang_dicek`, `dokumen_dikirim_di_awal`, dan
> `dokumen_dipersiapkan_hari_audit` merupakan data manual milik Agenda untuk sumber Laporan masa
> depan. Siklusnya Draft → Final (dapat dikembalikan ke Draft). Tanda tangan digital dan PDF tidak
> diimplementasikan pada batch ini. Bagian historis di bawah dipertahankan sebagai konteks awal.

> **Keputusan UX pengganti — 21 Agustus 2026.** Checklist hanya dibuat/dibuka dari workspace pusat
> Checklist Audit dan Agenda hanya dibuat/dibuka dari workspace pusat Agenda Internal Audit; Instruksi
> tidak lagi menampilkan shortcut keduanya dan tetap menjadi otoritas QA-xx/upstream context. Timeline
> Agenda memakai satu sesi Draft lokal dengan satu tombol `Tambah Kegiatan`; baris tidak memiliki tombol
> Add/Save sendiri dan pengguna dapat menyusun banyak kegiatan sebelum menyimpan. `Simpan Agenda`
> menyimpan header beserta seluruh Timeline secara atomik, sedangkan `Finalkan Agenda` menyimpan Draft
> terkini terlebih dahulu lalu menjalankan finalisasi.

### Data

```ts
auditAgendas: {
  id,
  kodeAudit,
  tanggalTerbit,
  prosesYangDiaudit,
  managerSeksiDiaudit: string[],
  tujuanLingkupAudit,
  team,
  leaderSubLeader: {
    leader,
    subLeader
  },
  members: {
    nama,
    seksi
  }[],
  asistenAuditorPendamping?: {
    nama,
    seksi
  }[],
  itemLainYangDicek,
  dokumenDikirimDiAwal,
  dokumenDipersiapkanHariAudit,
  items: {
    tanggal,
    jamMulai,
    jamSelesai,
    detailAuditProsesPersyaratan,
    lokasi
  }[],
  catatanKhusus,
  leaderSubLeaderTandaTangan,
  managerSeksiTandaTangan,
  managementRepresentativeTandaTangan,
  kodeDokumen, // "Q-120-ISE-001-FORM-004"
  status
}
```

### Auto fields

- `prosesYangDiaudit`
- audited section managers from target-section `kepalaSeksi`
- team
- leader/subleader
- members

### Agenda items

If `lokasi` is empty, use the previous row's location.

### Entry point

On each Internal Audit Instruction row:

**Buat Agenda**

Header is auto-filled.

User manually fills:

- audit objective/scope detail
- initial documents
- documents prepared for audit day
- hourly schedule
- optional assistant auditor
- special notes

### Detail Sesi Audit

Populate Agenda tab.

---

# Batch 6a — Temuan / PLOR + Automatic Trigger

> **Keputusan arsitektur pengganti — 21 Agustus 2026.** Checklist adalah working paper sumber yang
> menyimpan pertanyaan/hasil dan observasi singkat; `findings` adalah satu-satunya otoritas Temuan
> formal dan menyimpan PLOR secara terpisah. Catatan sumber Checklist tidak pernah disalin otomatis
> ke Problem, Location, Objective Evidence, Reference, atau Saran Perbaikan. PLOR formal hanya diedit
> di workspace pusat Temuan (PLOR). Temuan berelasi langsung ke `audit_instruction_rows.id` dan
> `kode_audit` QA; rancangan historis `scheduleId`/`scopeId` adalah arsitektur Jadwal lama dan tidak
> digunakan untuk Finding baru. Daftar Ketidaksesuaian pada batch mendatang wajib membaca informasi
> formal dari `findings`, bukan langsung dari `checklist_items`, `checklist_manufaktur_items`, atau
> `checklist_produk_items`. Teks historis di bawah dipertahankan hanya sebagai riwayat spesifikasi.

> **Keputusan semantik OFI pengganti — 21 Agustus 2026.** A/B tetap merupakan ketidaksesuaian formal
> dengan urutan Problem → Location → Objective Evidence → Reference. C adalah Opportunity for
> Improvement dengan urutan Kondisi/Peluang Peningkatan (`findings.problem`) → Location → Objective
> Evidence → Saran Perbaikan → Reference/Acuan. Saran Perbaikan wajib untuk C, sedangkan Reference
> opsional. Narasi OFI tidak boleh memakai bahasa ketidaksesuaian seperti "tidak sesuai".

Connect the previously reserved `findingId` fields.

### Data

```ts
findings: {
  id,
  kodeTemuan,
  kodeAudit,
  nomorUrutTemuan,
  sourceType, // ChecklistSistem | ChecklistProduk | ChecklistManufakturShift
  sourceItemId,
  scheduleId,
  scopeId,
  kategori, // A | B | C
  klasifikasiDIS?, // Dokumen | Implementasi | Sistem
  problem,
  location,
  objectiveEvidence,
  reference,
  saranPerbaikan,
  auditorPenemu,
  auditeeArea,
  tanggalTemuan,
  status, // Open | CAR Submitted | Verifikasi | Closed | Overdue
  carId: null | id
}
```

### Finding code

Format:

`{kodeAudit}/{SYS|PRD|MFG}/{tahun}/{urutan3digit}`

Example conceptual form:

`QA-01/SYS/2026/001`

Use one reusable generator from all finding sources.

### Trigger rules

#### System checklist

When result becomes:

- A
- B
- C

auto-create/link a finding.

#### Manufacturing/Shift checklist

Same A/B/C behavior.

#### Product checklist

When:

`judgment = NG`

prompt for category A/B/C and then create the finding.

### PLOR

Store separately:

- Problem
- Location
- Objective Evidence
- Reference

`C` additionally requires:

- `saranPerbaikan`

### Narrative formatter

Reusable:

```ts
formatFindingNarrative(finding)
```

Base output:

> Pada {location}, ditemukan {problem}. Hal ini dibuktikan dengan {objectiveEvidence}, yang tidak sesuai dengan {reference}.

For category C append the improvement recommendation.

Narrative is a view/computed representation. PLOR fields remain separate.

### Rule-based clause suggestion

Not AI.

Master:

```ts
clauseKeywordMap
```

Match lowercase substrings from `problem`.

Show a clickable suggestion badge.

Do not force-fill the clause.

Initial examples:

- kalibrasi → 7.1.5
- kompetensi → 7.2
- dokumen tidak terkendali → 7.5

### Temuan tab

List findings for the current `kodeAudit`.

Provide PLOR editing.

---

# Batch 6b — Pelaksanaan

### Mobile audit execution

Populate Pelaksanaan tab/page as a mobile-friendly presentation of existing checklist functionality.

Reuse the checklist components from Batches 5a–5c.

Do not create a second checklist data model.

### Live counter

Per `kodeAudit`:

- `O:x`
- `A:x`
- `B:x`
- `C:x`

### `statusProgress`

Replace the temporary Batch 4a implementation with actual computed status based on checklist and finding data.

Examples include:

- Belum Mulai
- Ada NC
- Tidak Ada NC

Implement based on actual data rather than manually stored duplication.

### Completion validation

`auditSchedule` cannot become `Completed` when any A/B/C checklist result has an incomplete PLOR finding.

For category C, empty `saranPerbaikan` also blocks completion.

Error messages must identify the specific incomplete item.

---

# Batch 7a — CAR: Major / Minor

### Data

```ts
cars: {
  id,
  kodeCAR,
  tanggalDibuat,
  findingId,
  seksiAuditee,
  lingkupAuditProses,
  noKetidaksesuaian,
  kategoriKetidaksesuaian,
  timAudit,
  leadAuditor,
  uraianTemuanAudit,
  dampakTemuan,
  koreksi,
  tanggalKoreksi,
  whyAnalysis: {
    level, // 1..5
    teks
  }[],
  tindakanKorektif,
  kategoriAkarMasalah4M1E?,
  jenisMasalahId?,
  perbaikanSistem?,
  sistemDirevisi: {
    kategori, // Peraturan ISE | Dokumen Standard | Dokumen Lainnya
    namaDokumen
  }[],
  buktiKoreksi: {
    sebelum: file[],
    sesudah: file[]
  },
  buktiTindakanKorektif: {
    sebelum: file[],
    sesudah: file[]
  },
  buktiPerbaikanSistem: {
    sebelum: file[],
    sesudah: file[]
  },
  picTindakan,
  targetPenyelesaian,
  dibuatOlehSeksiAuditee: {
    user,
    tanggal
  },
  approvalPenanggungJawabSeksi: {
    user,
    tanggal
  },
  approvalPenanggungJawabQMS: {
    user,
    tanggal
  },
  tanggalVerifikasi,
  statusVerifikasi, // Close (Selesai) | Open (Perlu Perbaikan Ulang)
  catatan: {
    ada: boolean,
    teks?
  },
  approvalLeadAuditor,
  approvalPenanggungJawabSeksiVerifikasi,
  approvalPenanggungJawabQMSVerifikasi,
  approvalSekretariat,
  kodeDokumen // "Q-120-ISE-001-FORM-009"
}
```

### CAR identifier

`kodeCAR` must be exactly equal to the related:

`finding.kodeTemuan`

Do not generate another number.

### Auto/computed fields

- `seksiAuditee` from finding
- audit scope/process
- finding sequence number
- category
- audit team
- lead auditor
- finding narrative

`uraianTemuanAudit` is read-only and computed from the finding narrative/reference.

### A/B route

Full route:

Dampak
→ Koreksi + evidence
→ 5-Why
→ Tindakan Korektif + evidence
→ optional Perbaikan Sistem
→ Sistem Direvisi
→ evidence when system improvement is used
→ PIC & target
→ verification

### Required evidence

Before/after evidence is mandatory for:

- correction
- corrective action

For system improvement:

- required if `perbaikanSistem` is filled.

### `jenisMasalahMaster`

```ts
jenisMasalahMaster: {
  id,
  kode,
  nama,
  urutanTampil,
  status
}
```

Seed examples:

- Tidak Patuh Peraturan
- Inkonsisten Terhadap Peraturan
- Aturan Belum Mencukupi
- Aturannya Tidak Ada
- Merubah Peraturan Tanpa Koordinasi

Provide Admin CRUD.

### Submit validation

Cannot enter Submitted when a filled action lacks required before/after evidence.

### Temporary access

For this batch only, a simple link from Finding may open the A/B CAR.

CAR Tracker replaces this in Batch 7b.

---

# Batch 7b — CAR: OFI + CAR Tracker

## Category C route

Hide 5-Why completely.

Flow:

Dampak
→ Koreksi + evidence
→ Tindakan Korektif + evidence
→ Perbaikan Sistem REQUIRED
→ Sistem Direvisi
→ required evidence
→ PIC & target
→ verification

Pre-fill:

- `koreksi`
- `tindakanKorektif`

from:

`finding.saranPerbaikan`

The user may edit as appropriate.

## CAR Tracker

Menu:

**CAR Tracker**

This becomes the official route to CAR details.

### Level 1

Area Audit list with summary counts:

- A
- B
- C
- answered/completed
- not completed

### Level 2

Area → findings in that area.

### Level 3

Finding → CAR detail.

### Filters

- status
- PIC
- category
- overdue

### Finding tab integration

Replace the temporary direct CAR link with:

- CAR status badge
- **Buka di CAR Tracker**

Navigate directly to Tracker Level 3.

### CAR lifecycle

Draft
→ Submitted
→ Under Review
→ Close (Selesai)

or:

→ Open (Perlu Perbaikan Ulang)

If verification returns Open:

- create a follow-up/rework entry,
- retain the same finding relationship,
- preserve previous evidence/history.

---

# Batch 8a — Daftar Ketidaksesuaian

This is a computed print/view.

Do **not** create a duplicate persistent table solely for this report.

Source:

- findings
- cars

### Entry point

CAR Tracker Level 2:

**Cetak Daftar Ketidaksesuaian**

### Table

- No Ketidaksesuaian = `nomorUrutTemuan`
- No. Persyaratan + Item = reference + formatted finding narrative
- Seksi Lokasi = location
- Major = category A marker
- Minor = category B marker
- Peluang Improvement = category C + `saranPerbaikan`

### Header

- No. Audit & Team auto-filled
- generation date
- Dibuat = lead auditor/team leader

### Export

PDF

Document code:

`Q-120-ISE-001-FORM-008`

---

# Batch 8b — Laporan Internal Audit

Most report fields are computed from existing:

- Agenda
- Checklist
- Finding
- CAR

Avoid duplicate storage.

### Data

```ts
laporanInternalAudit: {
  id,
  kodeAudit,
  agendaId,
  tanggalTerbit,
  prosesYangDiaudit,
  managerSeksiDiaudit: {
    seksiNama,
    managers: []
  }[],
  tujuanLingkupAudit,
  waktuTanggalAudit,
  auditeeHadir: {
    nama,
    seksi
  }[],
  namaCustomer,
  namaProduk,
  namaLine,
  hasilPengamatan,
  evaluasi,
  ringkasanTemuan,
  saranPerbaikanFollowUp: {
    ada: boolean,
    perSeksi: {
      seksiNama,
      seksiPelaksanaFollowUp,
      jadwalFollowUp
    }[]
  },
  catatan,
  leaderSubLeaderTandaTangan,
  managerSeksiTandaTangan,
  managementRepresentativeTandaTangan,
  ruteLaporan,
  dokumenLainnyaChecklist,
  status,
  kodeDokumen // "Q-120-ISE-001-FORM-015"
}
```

### Agenda-derived fields

Display directly from Agenda; do not store duplicate copies where avoidable:

- team
- leader/subleader
- members
- assistant auditor
- other checked items

### Computed fields

- audited process
- audited section managers, grouped by section
- audit objective/scope
- date/time range from agenda items
- finding summary
- clause evaluation
- checklist document links

### Manual fields

- `auditeeHadir`
- customer
- product
- line
- notes
- selected signatures as specified

### Generate Draft

`hasilPengamatan`:

Generate draft based on finding counts.

`evaluasi`:

Generate a draft list of unique clauses.

### Finding summary

Group findings by:

- reference
- location

Output:

- combined finding numbers, e.g. `"2 & 3"`
- clause
- requirement
- occurrence section
- Major count
- Minor count
- OFI count

### Report route

`ruteLaporan` is a static admin-configured value shown consistently in reports.

### Entry point

Internal Audit Instruction row:

**Buat Laporan Internal Audit**

Enabled only when:

- Agenda exists
- at least one Checklist exists

---

# Batch 9a — Analisa Weakness Point

### Data

```ts
weaknessAnalysisReports: {
  id,
  judul,
  periodeMulai,
  periodeSelesai,
  programId?,
  tanggal,
  auditTeamLeader,
  pjQMS,
  status,
  kodeDokumen // "Q-120-ISE-001-FORM-010"
}

whyWhyMeta: {
  id,
  reportId,
  nomor,
  problem,
  whyLevels: {
    level, // 1..5
    teks
  }[],
  akarPermasalahan
}

tindakanCapa: {
  id,
  reportId,
  whyWhyMetaId,
  rencanaTindakan,
  pic,
  dueDate,
  status // Belum Mulai | Berjalan | Selesai
}
```

`whyWhyMeta` is not the same as per-finding `cars.whyAnalysis`.

It is a higher-level manual pattern analysis.

### Generate Analisa

User chooses:

- date range, or
- one `auditProgram`

Generate five computed charts from findings + CAR data.

Use Chart.js if that is consistent with the existing repository.

Charts:

1. Stacked bar per Proses:
   - Major
   - Minor
   - Peluang Improvement
   - total summary box
2. Pie by top-level clause, using first digit of `reference`
3. Pie by `finding.klasifikasiDIS`
4. Pie by `cars.kategoriAkarMasalah4M1E`
5. Bar by `cars.jenisMasalahId`

### Manual analysis

Provide:

- Kesimpulan
- Generate Draft for conclusion based on dominant categories from charts 4/5
- WhyWhyMeta table
- TindakanCapa table
- CRUD for manual analysis entries

---

# Batch 9b — Rangkuman Hasil Internal Audit

### Data

```ts
rangkumanHasilInternalAudit: {
  id,
  prosesId,
  pemilikProses,
  seksiTerkait,
  periodeTahunFiskal,
  tglAuditRange,
  status,
  kodeDokumen, // "Q-120-ISE-001-FORM-014"
  jumlahKetidaksesuaian,
  jumlahMajor,
  jumlahMinor,
  jumlahPeluangImprovement,
  catatan,
  dibuatOleh,
  penanggungJawabQMS
}
```

### Computed header values

- `pemilikProses`
- `seksiTerkait` = union of all `seksiMarks` for all instruction rows for the process in the selected period
- audit date range
- total findings
- major count
- minor count
- OFI count

### Table

One row per finding.

All values computed except `Keterangan`.

Columns:

- No
- Temuan
- No. Laporan = `kodeTemuan`
- Klausul = `reference`
- Kategori
- Tanggal Target Temporary = `car.tanggalKoreksi`
- Tanggal Target Permanent = `car.targetPenyelesaian`
- Verifikasi = `car.tanggalVerifikasi`
- Status Close/Open = `car.statusVerifikasi`
- Keterangan = manual

### Category display

- Major: red
- Minor: green
- Peluang Improvement: blue

### Generate modes

#### Generate Rangkuman

Select:

- one Process
- Fiscal Year

#### Generate Semua Proses

Select:

- Fiscal Year only

Generate one summary document for every active `prosesMaster`.

Processes without findings must still receive an empty summary document.

This batch generation must be atomic.

### Combined export

Export combined PDF:

- one process per page

---

# 4. Final Consistency Review

After Batch 9b:

Review the entire Internal Audit module for:

1. canonical field names,
2. central `kodeAudit` propagation,
3. generated identifier consistency,
4. computed fields not becoming stale,
5. no duplicate auditor data model,
6. all A/B/C trigger behavior,
7. CAR linkage to finding,
8. required upload validation,
9. atomic generation,
10. process/section master reuse,
11. revision-history preservation,
12. report computation instead of unnecessary duplication,
13. status consistency,
14. mobile Pelaksanaan usability,
15. lint/typecheck/test/build health.

Document unresolved issues in `PROJECT_STATUS.md`.
