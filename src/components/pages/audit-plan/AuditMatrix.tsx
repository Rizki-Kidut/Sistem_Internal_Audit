// Matriks grid untuk Rencana Audit Tahunan.
// Baris = Proses (dari master Kelola Proses), Kolom = Seksi (◎/O cycle) + Bulan Jan-Des (Plan/Aktual).
// Kolom seksi: klik kiri untuk siklus 3-state: kosong → ◎ (utama) → O (terkait) → kosong.
// Tanda *1 dan *2 dipilih per sel melalui menu kecil (tit tiga) di pojok sel — disimpan per sel.

import { GripVertical, MoreVertical, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { AuditPlanProcess, AuditPlanSeksiLink, AuditPlanSchedule, Seksi } from '../../../lib/types';
import { BULAN_LABEL, PERAN_PROSES, SIMBOL_PERAN, FLAG_AUDIT } from '../../../lib/enums';
import type { PeranProses } from '../../../lib/enums';

interface AuditMatrixProps {
  processes: AuditPlanProcess[];
  seksiList: Seksi[];
  seksiLinks: AuditPlanSeksiLink[];
  schedules: AuditPlanSchedule[];
  readOnly: boolean;
  onCycleSeksi: (processId: string, seksiId: string, currentPeran: PeranProses | null) => void;
  onToggleFlag: (processId: string, seksiId: string, flag: 'flag_audit_proses_shift_produk' | 'flag_lingkup_pdca') => void;
  onToggleSchedule: (processId: string, bulan: number, field: 'plan' | 'aktual') => void;
  onReorder: (orderedIds: string[]) => void;
  onDeleteProcess: (processId: string) => void;
}

// Helper: cari link untuk process × seksi
function findSeksiLink(links: AuditPlanSeksiLink[], processId: string, seksiId: string): AuditPlanSeksiLink | undefined {
  return links.find((l) => l.process_id === processId && l.seksi_id === seksiId);
}

// Helper: cari schedule untuk process × bulan
function findSchedule(schedules: AuditPlanSchedule[], processId: string, bulan: number): AuditPlanSchedule | undefined {
  return schedules.find((s) => s.process_id === processId && s.bulan === bulan);
}

export function AuditMatrix({
  processes,
  seksiList,
  seksiLinks,
  schedules,
  readOnly,
  onCycleSeksi,
  onToggleFlag,
  onToggleSchedule,
  onReorder,
  onDeleteProcess,
}: AuditMatrixProps) {
  let dragIndex: number | null = null;

  function handleDragStart(idx: number) {
    dragIndex = idx;
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(targetIdx: number) {
    if (dragIndex === null || dragIndex === targetIdx) return;
    const reordered = [...processes];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(targetIdx, 0, moved);
    onReorder(reordered.map((p) => p.id));
    dragIndex = null;
  }

  if (processes.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-sm text-gray-500">
          Belum ada proses. Tambahkan proses di menu "Kelola Proses" (Master Data) terlebih dahulu, lalu kembali ke halaman ini.
        </p>
      </div>
    );
  }

  // Tinggi header rotated: cukup untuk seluruh nama seksi tanpa terpotong.
  // Asumsi ~7px per karakter pada font-size 12px; minimum 80px, tidak ada cap atas
  // supaya nama seksi panjang tetap tampil utuh (lihat gambar 2 — terpotong sebelumnya).
  const maxNameLen = seksiList.reduce((m, s) => Math.max(m, s.nama.length), 0);
  const headerHeight = Math.max(80, maxNameLen * 7 + 40);

  // Lebar kolom seksi: minimum 52px, maksimum 120px, berdasarkan panjang nama
  const seksiColWidth = Math.max(52, Math.min(120, maxNameLen * 6 + 20));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-r border-gray-200" style={{ minWidth: 48 }}></th>
            <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider border-b border-r border-gray-200" style={{ minWidth: 180 }}>
              Proses
            </th>
            {/* Kolom seksi — vertical text */}
            {seksiList.map((s) => (
              <th
                key={s.id}
                className="px-1 py-2 text-center border-b border-r border-gray-200 align-bottom"
                style={{ minWidth: seksiColWidth, width: seksiColWidth, height: headerHeight }}
              >
                <div
                  className="flex items-end justify-center h-full"
                  style={{ height: headerHeight - 8 }}
                >
                  <span
                    className="text-xs font-semibold text-gray-700 leading-tight"
                    style={{
                      writingMode: 'vertical-rl',
                      textOrientation: 'mixed',
                      transform: 'rotate(180deg)',
                      whiteSpace: 'nowrap',
                    }}
                    title={s.nama}
                  >
                    {s.nama}
                  </span>
                </div>
              </th>
            ))}
            <th className="px-1 py-1 text-center text-xs font-semibold text-gray-500 border-b border-l border-gray-200 bg-gray-100" style={{ minWidth: 40 }}>
              P/A
            </th>
            {BULAN_LABEL.map((bl) => (
              <th
                key={bl}
                className="px-1 py-1 text-center text-xs font-semibold text-gray-500 border-b border-r border-gray-200 bg-gray-100"
                style={{ minWidth: 36 }}
              >
                {bl}
              </th>
            ))}
            <th className="px-2 py-2 border-b border-gray-200" style={{ minWidth: 48 }}></th>
          </tr>
        </thead>
        <tbody>
          {processes.map((proc, idx) => {
            const isOdd = idx % 2 === 1;
            const rowBg = isOdd ? 'bg-gray-50/30' : 'bg-white';
            return (
              <ProcessRow
                key={proc.id}
                process={proc}
                seksiList={seksiList}
                seksiLinks={seksiLinks}
                schedules={schedules}
                readOnly={readOnly}
                rowBg={rowBg}
                seksiColWidth={seksiColWidth}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(idx)}
                onCycleSeksi={onCycleSeksi}
                onToggleFlag={onToggleFlag}
                onToggleSchedule={onToggleSchedule}
                onDelete={() => onDeleteProcess(proc.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface ProcessRowProps {
  process: AuditPlanProcess;
  seksiList: Seksi[];
  seksiLinks: AuditPlanSeksiLink[];
  schedules: AuditPlanSchedule[];
  readOnly: boolean;
  rowBg: string;
  seksiColWidth: number;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onCycleSeksi: (processId: string, seksiId: string, currentPeran: PeranProses | null) => void;
  onToggleFlag: (processId: string, seksiId: string, flag: 'flag_audit_proses_shift_produk' | 'flag_lingkup_pdca') => void;
  onToggleSchedule: (processId: string, bulan: number, field: 'plan' | 'aktual') => void;
  onDelete: () => void;
}

function ProcessRow({
  process,
  seksiList,
  seksiLinks,
  schedules,
  readOnly,
  rowBg,
  seksiColWidth,
  onDragStart,
  onDragOver,
  onDrop,
  onCycleSeksi,
  onToggleFlag,
  onToggleSchedule,
  onDelete,
}: ProcessRowProps) {
  return (
    <>
      {/* Sub-baris Plan */}
      <tr className={`${rowBg} group`}>
        <td
          rowSpan={2}
          className="align-middle px-2 py-2 border-b border-r border-gray-200 cursor-grab active:cursor-grabbing"
          draggable={!readOnly}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDrop={onDrop}
        >
          <GripVertical className="text-gray-300 group-hover:text-gray-400" size={16} />
        </td>
        <td rowSpan={2} className="align-top px-3 py-2 border-b border-r border-gray-200">
          <div className="text-sm font-medium text-gray-900">{process.nama_proses}</div>
          {process.catatan_kaki && (
            <div className="text-xs text-gray-400 mt-0.5">{process.catatan_kaki}</div>
          )}
        </td>
        {seksiList.map((s) => (
          <SeksiCell
            key={s.id}
            processId={process.id}
            seksi={s}
            link={findSeksiLink(seksiLinks, process.id, s.id)}
            readOnly={readOnly}
            colWidth={seksiColWidth}
            onCycleSeksi={onCycleSeksi}
            onToggleFlag={onToggleFlag}
          />
        ))}
        <td className="px-1 py-1 text-center text-xs font-medium text-blue-600 border-b border-l border-gray-200 bg-blue-50/50">
          Plan
        </td>
        {BULAN_LABEL.map((_, blIdx) => {
          const bulan = blIdx + 1;
          const sched = findSchedule(schedules, process.id, bulan);
          const isPlan = sched?.plan ?? false;
          return (
            <td
              key={`plan-${bulan}`}
              className="px-1 py-1 text-center border-b border-r border-gray-200"
            >
              <button
                disabled={readOnly}
                onClick={() => onToggleSchedule(process.id, bulan, 'plan')}
                className={`w-6 h-6 rounded transition-all ${
                  isPlan
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-50 hover:bg-blue-100'
                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                title={`Plan ${BULAN_LABEL[blIdx]}`}
              >
                {isPlan ? '■' : ''}
              </button>
            </td>
          );
        })}
        <td rowSpan={2} className="align-middle px-2 py-2 border-b border-gray-200">
          {!readOnly && (
            <button
              onClick={onDelete}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              title="Hapus proses"
            >
              ✕
            </button>
          )}
        </td>
      </tr>
      {/* Sub-baris Aktual */}
      <tr className={`${rowBg} group`}>
        <td className="px-1 py-1 text-center text-xs font-medium text-green-600 border-b border-l border-gray-200 bg-green-50/50">
          Akt
        </td>
        {BULAN_LABEL.map((_, blIdx) => {
          const bulan = blIdx + 1;
          const sched = findSchedule(schedules, process.id, bulan);
          const isAktual = sched?.aktual ?? false;
          return (
            <td
              key={`aktual-${bulan}`}
              className="px-1 py-1 text-center border-b border-r border-gray-200"
            >
              <button
                disabled={readOnly}
                onClick={() => onToggleSchedule(process.id, bulan, 'aktual')}
                className={`w-6 h-6 rounded transition-all ${
                  isAktual
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-50 hover:bg-green-100'
                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                title={`Aktual ${BULAN_LABEL[blIdx]}`}
              >
                {isAktual ? '■' : ''}
              </button>
            </td>
          );
        })}
      </tr>
    </>
  );
}

// ============================================================
// SEKSI CELL — simbol peran + menu tanda *1 / *2
// ============================================================

interface SeksiCellProps {
  processId: string;
  seksi: Seksi;
  link: AuditPlanSeksiLink | undefined;
  readOnly: boolean;
  colWidth: number;
  onCycleSeksi: (processId: string, seksiId: string, currentPeran: PeranProses | null) => void;
  onToggleFlag: (processId: string, seksiId: string, flag: 'flag_audit_proses_shift_produk' | 'flag_lingkup_pdca') => void;
}

function SeksiCell({
  processId,
  seksi,
  link,
  readOnly,
  colWidth,
  onCycleSeksi,
  onToggleFlag,
}: SeksiCellProps) {
  const peran = link?.peran ?? null;
  const simbol = peran ? SIMBOL_PERAN[peran] : '';
  const isUtama = peran === PERAN_PROSES.UTAMA;
  const isTerkait = peran === PERAN_PROSES.TERKAIT;
  const flag1 = link?.flag_audit_proses_shift_produk ?? false;
  const flag2 = link?.flag_lingkup_pdca ?? false;
  const flagsSuffix = `${flag1 ? '*1' : ''}${flag2 ? '*2' : ''}`;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <td
      rowSpan={2}
      className="text-center align-middle px-1 py-2 border-b border-r border-gray-200 relative"
      style={{ minWidth: colWidth, width: colWidth }}
    >
      <div className="flex items-center justify-center gap-1">
        <button
          disabled={readOnly}
          onClick={() => onCycleSeksi(processId, seksi.id, peran)}
          className={`w-8 h-8 rounded flex items-center justify-center text-sm transition-all ${
            isUtama
              ? 'bg-blue-600 text-white font-bold'
              : isTerkait
                ? 'bg-blue-100 text-blue-700 font-bold'
                : 'bg-gray-50 text-gray-300 hover:bg-gray-100'
          } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
          title={
            isUtama
              ? 'Seksi utama (pemilik proses) — klik untuk ubah'
              : isTerkait
                ? 'Seksi terkait — klik untuk ubah'
                : 'Tidak terlibat — klik untuk assign'
          }
        >
          {simbol ? (
            <span>
              {simbol}
              {flagsSuffix && (
                <sup className="text-[9px] text-amber-500 font-semibold">{flagsSuffix}</sup>
              )}
            </span>
          ) : (
            <span className="text-gray-300">·</span>
          )}
        </button>
        {!readOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="text-gray-300 hover:text-gray-500 transition-colors"
            title="Tanda audit"
          >
            <MoreVertical size={12} />
          </button>
        )}
      </div>
      {menuOpen && !readOnly && (
        <div
          ref={menuRef}
          className="absolute z-20 top-full left-1/2 -translate-x-1/2 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[180px]"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-gray-600">Tanda Audit</span>
            <button
              onClick={() => setMenuOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          </div>
          <button
            onClick={() => {
              onToggleFlag(processId, seksi.id, 'flag_audit_proses_shift_produk');
              setMenuOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-gray-50 transition-colors ${
              flag1 ? 'text-amber-600 font-semibold' : 'text-gray-600'
            }`}
          >
            <span className="w-6 text-center font-mono">{FLAG_AUDIT.PROSES_SHIFT_PRODUK}</span>
            <span>Audit proses, shift & produk</span>
          </button>
          <button
            onClick={() => {
              onToggleFlag(processId, seksi.id, 'flag_lingkup_pdca');
              setMenuOpen(false);
            }}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-gray-50 transition-colors ${
              flag2 ? 'text-amber-600 font-semibold' : 'text-gray-600'
            }`}
          >
            <span className="w-6 text-center font-mono">{FLAG_AUDIT.LINGKUP_PDCA}</span>
            <span>Lingkup PDCA</span>
          </button>
        </div>
      )}
    </td>
  );
}
