import { useMemo } from 'react';
import type { InstructionAuditPrintData, InstructionAuditPrintRow } from '../../lib/types';
import {
  FORM003_DOCUMENT_CODE,
  FORM003_SECTION_MARKS,
  FORM003_STATUS_LEGEND,
  paginateInstructionAudit,
} from '../../lib/instructionAuditPrint';
import './instructionAuditPrint.css';

const date = (value?: string | null) => value
  ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
  : '';

function Slash({ className = '' }: { className?: string }) {
  return <svg className={`form003-slash ${className}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" y1="100" x2="100" y2="0" />
  </svg>;
}

function InactiveCell({ children }: { children?: React.ReactNode }) {
  return <td className="form003-inactive">{children}<Slash /></td>;
}

function Approval({ data, continuation }: { data: InstructionAuditPrintData; continuation: boolean }) {
  const instruction = data.instruction;
  return <div className="form003-approvals">
    <div className="form003-approval-title">Approval Pembuatan</div>
    <div className="form003-approval-title">Approval Selesai</div>
    <div className="form003-approval-body">
      {continuation ? <Slash /> : <><span>Tanggal Pembuatan<br/><b>{date(instruction.tanggal_buat) || '-'}</b></span><span>Dibuat<br/><b>{instruction.approval_pembuatan.dibuat_oleh_qms || '-'}</b></span><span>Disetujui<br/><b>{instruction.approval_pembuatan.disetujui_oleh_direktur || '-'}</b></span></>}
    </div>
    <div className="form003-approval-body">
      {continuation ? <Slash /> : <><span>Tanggal Selesai<br/><b>{date(data.completion_date) || '-'}</b></span><span>Dibuat<br/><b>{instruction.approval_selesai.dibuat_oleh_qms || '-'}</b></span><span>Disetujui<br/><b>{instruction.approval_selesai.disetujui_oleh_direktur || '-'}</b></span></>}
    </div>
  </div>;
}

function StatusQuadrants({ status, cell = false }: { status: number; cell?: boolean }) {
  if (!status && !cell) return null;
  const filledQuadrants = Math.max(0, Math.min(4, status ? status - 1 : 0));
  return <span className={cell ? 'form003-status-grid form003-status-grid-cell' : 'form003-status-grid'} aria-label={status ? `Status ${status}` : 'Status belum tersedia'}>
    {[0, 1, 2, 3].map((quadrant) => <span
      key={quadrant}
      className={quadrant < filledQuadrants ? 'form003-status-quadrant is-filled' : 'form003-status-quadrant'}
      aria-hidden="true"
    />)}
  </span>;
}

function MatrixBody({ row, data }: { row: InstructionAuditPrintRow; data: InstructionAuditPrintData }) {
  const regular = row.tipe_baris === 'Reguler';
  const product = row.tipe_baris === 'AuditProduk';
  const manufacturing = row.tipe_baris === 'AuditManufaktur' || row.tipe_baris === 'AuditShift';
  return <>
    {data.sections.length ? data.sections.map((section) => {
      if (!regular) return <InactiveCell key={`section-${section.id}`} />;
      const mark = row.seksi_marks.find((item) => item.seksi_id === section.id);
      return <td key={`section-${section.id}`} className="form003-mark">{mark ? FORM003_SECTION_MARKS[mark.tipe] : ''}</td>;
    }) : <InactiveCell/>}
    {data.target_models.length ? data.target_models.map((model) => product
      ? <td key={`product-${model.id}`} className="form003-mark">{row.matriks_produk_marks.some((mark) => mark.target_model_id === model.id && mark.plant_id === model.plant_id) ? '●' : ''}</td>
      : <InactiveCell key={`product-${model.id}`} />) : <InactiveCell/>}
    {data.shifts.length ? data.shifts.map((shift) => manufacturing
      ? <td key={`shift-${shift.id}`} className="form003-mark">{row.matriks_manufaktur_shift_marks.some((mark) => mark.shift_id === shift.id && mark.plant_id === shift.plant_id) ? '●' : ''}</td>
      : <InactiveCell key={`shift-${shift.id}`} />) : <InactiveCell/>}
  </>;
}

function Header({ data, pageIndex, pageCount }: { data: InstructionAuditPrintData; pageIndex: number; pageCount: number }) {
  const instruction = data.instruction;
  return <>
    <header className="form003-header">
      <div className="form003-identity"><strong>STANLEY</strong><b>Internal audit FY{instruction.tahun_fiskal}</b><span>Tujuan audit:</span><p>{instruction.tujuan_audit || '-'}</p></div>
      <h1>Instruksi internal audit</h1>
      <div className="form003-control">
        <div className="form003-metadata"><span>Tanggal buat</span><b>: {date(instruction.tanggal_buat) || '-'}</b><span>Tanggal revisi</span><b>: {date(instruction.tanggal_revisi) || '-'}</b><span>No Revisi</span><b>: {instruction.no_revisi}</b><span>Halaman</span><b>: {pageIndex + 1}/{pageCount}</b></div>
        <Approval data={data} continuation={pageIndex > 0} />
      </div>
    </header>
    <div className="form003-symbol-note">Seksi yang diaudit: target = <b>★</b>&nbsp;&nbsp; terkait = <b>●</b></div>
  </>;
}

function ColumnHeaders({ data }: { data: InstructionAuditPrintData }) {
  const plantName = (id: string) => data.plants.find((plant) => plant.id === id)?.nama ?? '-';
  return <thead>
    <tr>
      <th className="form003-col-team" rowSpan={3}>Team</th><th className="form003-col-process" rowSpan={3}>Proses yang diaudit</th><th className="form003-col-owner" rowSpan={3}>Pemilik proses</th><th className="form003-col-audit-no" rowSpan={3}>No. audit</th><th className="form003-col-leader" rowSpan={3}>Leader audit</th><th className="form003-col-members" rowSpan={3}>Auditor</th>
      <th colSpan={Math.max(data.sections.length, 1)}>Seksi yang diaudit</th>
      <th colSpan={Math.max(data.target_models.length, 1)}>Audit Produk</th>
      <th colSpan={Math.max(data.shifts.length, 1)}>Audit Manufaktur &amp; Shift</th>
      <th rowSpan={3}>Tanggal audit produk</th><th rowSpan={3}>Nama auditor produk</th><th rowSpan={3}>Kualifikasi (Y/N)</th>
      <th rowSpan={3}>Item lain yang diperiksa/<br/>persyaratan</th><th rowSpan={3}>Tanggal plan</th><th rowSpan={3}>Tanggal pelaksanaan</th><th rowSpan={3}>Cek selesai</th><th rowSpan={3}>Status progress</th>
    </tr>
    <tr className="form003-plant-headers">
      {data.sections.length ? <th colSpan={data.sections.length}>Seksi</th> : <th>-</th>}
      {data.target_models.length ? [...new Set(data.target_models.map((model) => model.plant_id))].map((plantId) => <th key={`product-plant-${plantId}`} colSpan={data.target_models.filter((model) => model.plant_id === plantId).length}>{plantName(plantId)}</th>) : <th>-</th>}
      {data.shifts.length ? [...new Set(data.shifts.map((shift) => shift.plant_id))].map((plantId) => <th key={`shift-plant-${plantId}`} colSpan={data.shifts.filter((shift) => shift.plant_id === plantId).length}>{plantName(plantId)}</th>) : <th>-</th>}
    </tr>
    <tr className="form003-vertical-headers">
      {data.sections.length ? data.sections.map((section) => <th key={section.id}><span>{section.nama}</span></th>) : <th><span>-</span></th>}
      {data.target_models.length ? data.target_models.map((model) => <th key={model.id}><span>{model.nama}</span></th>) : <th><span>-</span></th>}
      {data.shifts.length ? data.shifts.map((shift) => <th key={shift.id}><span>{shift.nama}</span></th>) : <th><span>-</span></th>}
    </tr>
  </thead>;
}

function AuditRow({ row, data }: { row: InstructionAuditPrintRow; data: InstructionAuditPrintData }) {
  const product = row.tipe_baris === 'AuditProduk';
  const leader = row.team_roster.find((member) => member.peran === 'Lead');
  const members = row.team_roster.filter((member) => member.peran !== 'Lead');
  return <tr className="form003-audit-row">
    <td className="form003-team-code">{row.team_kode || '-'}</td><td>{row.proses_nama || '-'}</td><td>{row.pemilik_proses || '-'}</td><td>{row.kode_audit}</td>
    <td className="form003-leader">{leader ? `★ ${leader.nama}` : ''}</td>
    <td className="form003-roster">{members.length ? members.map((member) => member.nama).join('\n') : ''}</td>
    <MatrixBody row={row} data={data} />
    {product ? <><td>{date(row.tanggal_audit_produk) || '-'}</td><td>{row.nama_auditor_produk || '-'}</td><td>{row.kualifikasi || '-'}</td></> : <><InactiveCell/><InactiveCell/><InactiveCell/></>}
    <td>{row.item_lain_diperiksa || ''}</td><td>{date(row.tanggal_plan_audit)}</td><td>{date(row.execution_date)}</td><td>{row.cek_selesai ? '✓' : ''}</td><td className="form003-status-cell"><StatusQuadrants status={row.status_progress} cell /></td>
  </tr>;
}

function Legend() {
  return <div className="form003-legend"><b>Status progress:</b>{FORM003_STATUS_LEGEND.map((label, index) => <div key={label}><StatusQuadrants status={index + 1}/><span>{index + 1}. {label}</span></div>)}</div>;
}

export function InstructionAuditPrintView({ data }: { data: InstructionAuditPrintData }) {
  const pages = useMemo(() => paginateInstructionAudit(data.rows), [data.rows]);
  const matrixCount = Math.max(data.sections.length, 1) + Math.max(data.target_models.length, 1) + Math.max(data.shifts.length, 1);
  const columnCount = 6 + matrixCount + 8;
  return <div className="form003-print-root">
    <style>{`@media print {
      @page { size: A3 landscape; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; }
      body:has(.form003-print-root), body:has(.form003-print-root) #root,
      body:has(.form003-print-root) #root > div, body:has(.form003-print-root) main,
      body:has(.form003-print-root) main > div { height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: none !important; overflow: visible !important; background: #fff !important; }
      body:has(.form003-print-root) aside, body:has(.form003-print-root) nav, body:has(.form003-print-root) .form003-screen-only { display: none !important; }
    }`}</style>
    {pages.map((page, pageIndex) => <article className="form003-page" key={`form003-page-${pageIndex + 1}`} aria-label={`${FORM003_DOCUMENT_CODE} halaman ${pageIndex + 1}`}>
      <Header data={data} pageIndex={pageIndex} pageCount={pages.length}/>
      <table className="form003-table">
        <ColumnHeaders data={data}/>
        <tbody>
          {page.rows.map((row) => <AuditRow key={row.id} row={row} data={data}/>)}
          {Array.from({ length: page.fillerRowCount }, (_, index) => <tr className="form003-filler-row" key={`filler-${index}`} aria-hidden="true">{Array.from({ length: columnCount }, (__, cell) => <td key={cell}/>)}</tr>)}
        </tbody>
      </table>
      <footer><Legend/><strong>{FORM003_DOCUMENT_CODE}</strong></footer>
    </article>)}
  </div>;
}
