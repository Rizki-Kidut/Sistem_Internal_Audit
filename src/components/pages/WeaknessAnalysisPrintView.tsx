import type { WeaknessItem, WeaknessReport, WeaknessWhy } from '../../services/weaknessAnalysisService';
import { FINDING_SOURCE_TYPE } from '../../lib/enums';
import { buildWeaknessCharts } from '../../lib/weaknessAnalysis';
import { WeaknessChartSet } from './WeaknessCharts';
import './weaknessCharts.css';
import './weaknessAnalysisPrint.css';

const MIN_WHY_ROWS = 4;
const MIN_ACTION_ROWS = 3;

export function WeaknessAnalysisPrintView({
  report,
  items,
  why,
  preview,
}: {
  report: WeaknessReport;
  items: WeaknessItem[];
  why: WeaknessWhy[];
  preview: boolean;
}) {
  const auditTypes = [
    { source: FINDING_SOURCE_TYPE.SISTEM, label: 'Audit Sistem' },
    { source: FINDING_SOURCE_TYPE.MANUFAKTUR_SHIFT, label: 'Audit Proses Manufaktur' },
    { source: FINDING_SOURCE_TYPE.PRODUK, label: 'Audit Produk' },
  ].filter(({ source }) => items.some((item) => item.finding.source_type === source));
  const auditContext = auditTypes.map(({ label }) => label).join(' / ') || 'Internal Audit';
  const charts = buildWeaknessCharts(items.map(toChart));
  const actions = why.flatMap((entry) =>
    entry.actions.map((action) => ({ ...action, root: entry.akar_permasalahan })),
  );
  const whyPadding = Math.max(0, MIN_WHY_ROWS - why.length);
  const actionPadding = Math.max(0, MIN_ACTION_ROWS - actions.length);

  return (
    <section className="form010">
      <div className="form010-page">
        {preview && <div className="form010-watermark">DRAFT / PREVIEW</div>}

        <header>
          <h1 className="form010-title">Analisa Ketidaksesuaian Hasil Internal Audit</h1>
          <div>
            <div>A. Hasil {auditContext}</div>
            <div className="form010-context">{report.judul}</div>
          </div>
          <table className="form010-approval">
            <thead>
              <tr>
                <th colSpan={3}>Persetujuan</th>
              </tr>
              <tr>
                <th>Tanggal</th>
                <th>Audit Team Leader</th>
                <th>PJ QMS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{report.tanggal}</td>
                <td>{report.audit_team_leader_name_snapshot || '-'}</td>
                <td>{report.pj_qms_snapshot || report.pj_qms || '-'}</td>
              </tr>
            </tbody>
          </table>
        </header>

        <div className="form010-grid">
          <main className="form010-analysis">
            <WeaknessChartSet charts={charts} />
          </main>

          <aside className="form010-analysis-detail">
            <section className="form010-table-section form010-why-section">
              <h3>B. Why Why Analysis</h3>
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Problem</th>
                    {[1, 2, 3, 4].map((level) => (
                      <th key={level}>Why {level}</th>
                    ))}
                    <th>Akar Permasalahan</th>
                  </tr>
                </thead>
                <tbody>
                  {why.map((entry) => (
                    <tr key={entry.sort_order}>
                      <td>{entry.nomor}</td>
                      <td>{entry.problem}</td>
                      {[1, 2, 3, 4].map((level) => (
                        <td key={level}>{entry.levels.find((item) => item.level === level)?.teks || ''}</td>
                      ))}
                      <td>{entry.akar_permasalahan}</td>
                    </tr>
                  ))}
                  {Array.from({ length: whyPadding }, (_, index) => (
                    <tr className="form010-blank-row form010-blank-why" key={`blank-why-${index}`}>
                      {Array.from({ length: 7 }, (__, cellIndex) => (
                        <td key={cellIndex}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="form010-table-section form010-action-section">
              <h3>C. Tindakan</h3>
              <table>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Akar Masalah</th>
                    <th>Rencana Tindakan</th>
                    <th>PIC</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((action, index) => (
                    <tr key={`${action.root}-${index}`}>
                      <td>{index + 1}</td>
                      <td>{action.root}</td>
                      <td>{action.rencana_tindakan}</td>
                      <td>{action.pic}</td>
                      <td>{action.due_date}</td>
                      <td>{action.status}</td>
                    </tr>
                  ))}
                  {Array.from({ length: actionPadding }, (_, index) => (
                    <tr className="form010-blank-row form010-blank-action" key={`blank-action-${index}`}>
                      {Array.from({ length: 6 }, (__, cellIndex) => (
                        <td key={cellIndex}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </aside>
        </div>

        <section className="form010-box form010-conclusion">
          <b>6. Kesimpulan Sumber Permasalahan</b>
          <div className="form010-conclusion-body">{report.kesimpulan || '\u00a0'}</div>
        </section>

        <footer>Q-120-ISE-001-FORM-010-REV.0</footer>
      </div>
    </section>
  );
}

function toChart(value: WeaknessItem) {
  const classification: Record<string, unknown> = value.classification ?? {};
  return {
    process: value.process,
    category: String(value.finding.kategori) as 'A' | 'B' | 'C',
    reference: (value.finding.reference as string | null) ?? null,
    approved_4m1e: (value.final_4m1e ?? classification.approved_4m1e ?? null) as string | null,
    approved_dis: (value.final_dis ?? classification.approved_dis ?? null) as string | null,
    approved_problem_type: (value.final_problem_type ?? classification.approved_problem_type ?? null) as string | null,
  };
}
