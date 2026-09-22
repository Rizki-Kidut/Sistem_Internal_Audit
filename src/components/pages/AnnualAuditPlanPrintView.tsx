import { useMemo } from 'react';
import type { AuditPlan, AuditPlanProcess, AuditPlanSchedule, AuditPlanSeksiLink, Proses, Seksi } from '../../lib/types';
import { formatTanggal, parseDate } from '../../lib/utils';
import { annualAuditMonths, buildAnnualAuditPrintProcesses, FORM001_FISCAL_START_MONTH, FORM001_FOOTNOTES, FORM001_PROCESS_CAPACITY, formatAnnualAuditActualSectionMark, formatAnnualAuditSectionMark, paginateAnnualAuditForm } from '../../lib/annualAuditPrint';
import './annualAuditPlanPrint.css';

interface Props {
  plan: AuditPlan;
  processes: AuditPlanProcess[];
  masterProcesses: Proses[];
  sections: Seksi[];
  sectionLinks: AuditPlanSeksiLink[];
  schedules: AuditPlanSchedule[];
}

function MatrixCell({ inactive, value }: { inactive: boolean; value?: string }) {
  return <td className={inactive ? 'form001-inactive-cell' : undefined}>{inactive ? '' : value}</td>;
}

export function AnnualAuditPlanPrintView({ plan, processes, masterProcesses, sections, sectionLinks, schedules }: Props) {
  const printProcesses = useMemo(() => buildAnnualAuditPrintProcesses(processes, masterProcesses), [processes, masterProcesses]);
  const pages = useMemo(() => paginateAnnualAuditForm(printProcesses), [printProcesses]);
  const months = useMemo(() => annualAuditMonths(plan.tahun, FORM001_FISCAL_START_MONTH), [plan.tahun]);
  const orderedSections = useMemo(() => [...sections].sort((a, b) => a.urutan_tampil - b.urutan_tampil), [sections]);
  const linkByCell = useMemo(() => new Map(sectionLinks.map((link) => [`${link.process_id}:${link.seksi_id}`, link])), [sectionLinks]);
  const scheduleByCell = useMemo(() => new Map(schedules.map((schedule) => [`${schedule.process_id}:${schedule.bulan}`, schedule])), [schedules]);
  const sectionColumnCount = Math.max(orderedSections.length, 1);

  return <div className="annual-audit-print-view">{pages.map((page, pageIndex) => {
    const lastPage = pageIndex === pages.length - 1;
    return <section className="annual-audit-print-page" key={`form001-page-${pageIndex + 1}`}>
      <header className="form001-header">
        <div className="form001-logo" aria-hidden="true" />
        <h1>Rencana Internal Audit Tahunan</h1>
        <div className="form001-control">
          <div className="form001-metadata"><span>Tgl buat</span><b>: {formatTanggal(parseDate(plan.tanggal_berlaku))}</b><span>Revisi</span><b>: {plan.no_revisi}</b></div>
          <div className="form001-approval">
            <b>Penanggungjawab QMS</b><b>Direktur atau President Direktur</b>
            <span className={pageIndex > 0 ? 'form001-signature-slashed' : undefined}>{pageIndex === 0 ? plan.penanggung_jawab_qms || '-' : ''}</span>
            <span className={pageIndex > 0 ? 'form001-signature-slashed' : undefined}>{pageIndex === 0 ? plan.disetujui_oleh || '-' : ''}</span>
          </div>
          <div className="form001-page-number">Hal: {pageIndex + 1}/{pages.length}</div>
        </div>
      </header>
      <div className="form001-legends"><div><b>◎</b> Seksi utama terkait proses yang berlaku&nbsp;&nbsp;&nbsp; <b>○</b> Seksi terkait</div><div>Plan: <b>○</b>&nbsp;&nbsp;&nbsp; Aktual: <b>●</b></div></div>
      <table className="form001-matrix">
        <colgroup><col className="form001-number-col"/><col className="form001-process-col"/><col className="form001-state-col"/>{Array.from({ length: sectionColumnCount }, (_, index) => <col className="form001-matrix-col" key={`section-col-${index}`}/>)}{months.map((month) => <col className="form001-matrix-col" key={month.month}/>)}</colgroup>
        <thead><tr><th rowSpan={2}>No</th><th rowSpan={2}>Proses</th><th rowSpan={2}>Plan / Aktual</th><th colSpan={sectionColumnCount}>Seksi yang diaudit</th><th colSpan={months.length}>Jadwal pelaksanaan</th></tr><tr className="form001-vertical-headers">{orderedSections.length ? orderedSections.map((section) => <th className="form001-section-header" key={section.id}><span>{section.nama}</span></th>) : <th className="form001-section-header"><span>-</span></th>}{months.map((month) => <th key={month.month}><span>{month.label}</span></th>)}</tr></thead>
        <tbody>
          {page.processes.map((process, processIndex) => {
            const processId = process.planProcess?.id;
            const number = pageIndex * FORM001_PROCESS_CAPACITY + processIndex + 1;
            const hasActual = !!processId && months.some((month) => scheduleByCell.get(`${processId}:${month.month}`)?.aktual);
            return [
              <tr className="form001-process-row" key={`${process.key}-plan`}><td rowSpan={2}>{number}</td><td className="form001-process-name" rowSpan={2}>{process.nama_proses}</td><th>Plan</th>
                {orderedSections.length ? orderedSections.map((section) => { const link = processId ? linkByCell.get(`${processId}:${section.id}`) : undefined; return <MatrixCell key={section.id} inactive={!process.active} value={formatAnnualAuditSectionMark(link)}/>; }) : <MatrixCell inactive={!process.active}/>}
                {months.map((month) => <MatrixCell key={month.month} inactive={!process.active} value={processId && scheduleByCell.get(`${processId}:${month.month}`)?.plan ? '○' : ''}/>)}</tr>,
              <tr className="form001-process-row" key={`${process.key}-actual`}><th>Aktual</th>
                {orderedSections.length ? orderedSections.map((section) => {
                  const link = processId ? linkByCell.get(`${processId}:${section.id}`) : undefined;
                  return <MatrixCell key={section.id} inactive={!process.active} value={hasActual ? formatAnnualAuditActualSectionMark(link) : ''}/>;
                }) : <MatrixCell inactive={!process.active}/>}
                {months.map((month) => <MatrixCell key={month.month} inactive={!process.active} value={processId && scheduleByCell.get(`${processId}:${month.month}`)?.aktual ? '●' : ''}/>)}</tr>,
            ];
          })}
          {lastPage && page.fillerProcessCount > 0 && Array.from({ length: page.fillerProcessCount }, (_, fillerIndex) => [
            <tr className="form001-process-row form001-filler-row" key={`filler-${fillerIndex}-plan`}>{fillerIndex === 0 && <td className="form001-other-label" rowSpan={page.fillerProcessCount * 2}>Lainnya</td>}<td rowSpan={2}/><th>Plan</th>{Array.from({ length: sectionColumnCount + months.length }, (__, cell) => <td key={cell}/>)}</tr>,
            <tr className="form001-process-row form001-filler-row" key={`filler-${fillerIndex}-actual`}><th>Aktual</th>{Array.from({ length: sectionColumnCount + months.length }, (__, cell) => <td key={cell}/>)}</tr>,
          ])}
        </tbody>
      </table>
      <footer className="form001-footer"><div>{FORM001_FOOTNOTES.map((note) => <div key={note}>{note}</div>)}</div><strong>{plan.kode_dokumen}</strong></footer>
    </section>;
  })}</div>;
}
