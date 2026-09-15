import { WEAKNESS_4M1E_LABEL, WEAKNESS_DIS_LABEL, WEAKNESS_PROBLEM_LABEL } from '../../lib/enums';
import type { buildWeaknessCharts } from '../../lib/weaknessAnalysis';

type Charts = ReturnType<typeof buildWeaknessCharts>;
const COLORS = ['#1d4ed8', '#0f766e', '#d97706', '#be123c', '#7c3aed', '#0891b2', '#4d7c0f', '#64748b'];

export function ProcessStackedChart({ data }: { data: Charts['processes'] }) {
  const totals = data.reduce(
    (acc, value) => ({ A: acc.A + value.A, B: acc.B + value.B, C: acc.C + value.C }),
    { A: 0, B: 0, C: 0 },
  );
  const max = Math.max(1, ...data.map((value) => value.A + value.B + value.C));

  return (
    <div className="weakness-chart weakness-chart-primary">
      <h3>1. Berdasarkan temuan ketidaksesuaian</h3>
      <div className="stack-legend">
        <span className="major">Major</span>
        <span className="minor">Minor</span>
        <span className="ofi">Peluang Improvement</span>
      </div>
      <div className="stack-plot">
        {data.length ? (
          data.map((value) => (
            <div className="stack-row" key={value.process}>
              <span>{value.process}</span>
              <div className="stack-track">
                <i className="major" style={{ width: `${(value.A / max) * 100}%` }} title={`Major ${value.A}`}>
                  {value.A || ''}
                </i>
                <i className="minor" style={{ width: `${(value.B / max) * 100}%` }} title={`Minor ${value.B}`}>
                  {value.B || ''}
                </i>
                <i className="ofi" style={{ width: `${(value.C / max) * 100}%` }} title={`OFI ${value.C}`}>
                  {value.C || ''}
                </i>
              </div>
            </div>
          ))
        ) : (
          <p>Belum ada Finding dalam populasi.</p>
        )}
      </div>
      <div className="finding-summary">
        <b>Total ketidaksesuaian</b>
        <span>Berat (Major) = {totals.A}</span>
        <span>Ringan (Minor) = {totals.B}</span>
        <span>Peluang Improvement = {totals.C}</span>
        <span>Total ketidaksesuaian = {totals.A + totals.B + totals.C}</span>
      </div>
    </div>
  );
}

export function DonutChart({
  title,
  values,
  labels = {},
}: {
  title: string;
  values: Record<string, number>;
  labels?: Record<string, string>;
}) {
  const entries = Object.entries(values).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let offset = 0;
  const segments = entries.map(([key, value], index) => {
    const portion = (value / total) * 100;
    const segment = { key, value, portion, offset, color: COLORS[index % COLORS.length] };
    offset += portion;
    return segment;
  });

  return (
    <div className="weakness-chart weakness-chart-donut">
      <h3>{title}</h3>
      {total ? (
        <div className="donut-layout">
          <svg viewBox="0 0 44 44" role="img" aria-label={title} className="donut-3d">
            <g className="donut-depth" transform="translate(1 5) scale(1 .78)">
              <circle className="donut-base" cx="21" cy="21" r="15.9155" />
              <g transform="rotate(-90 21 21)">
                {segments.map((segment) => (
                  <circle
                    key={`depth-${segment.key}`}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="8"
                    strokeDasharray={`${segment.portion} ${100 - segment.portion}`}
                    strokeDashoffset={-segment.offset}
                  />
                ))}
              </g>
            </g>
            <g className="donut-top" transform="translate(1 1) scale(1 .78)">
              <circle className="donut-base" cx="21" cy="21" r="15.9155" />
              <g transform="rotate(-90 21 21)">
                {segments.map((segment) => (
                  <circle
                    key={`top-${segment.key}`}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="none"
                    stroke={segment.color}
                    strokeWidth="8"
                    strokeDasharray={`${segment.portion} ${100 - segment.portion}`}
                    strokeDashoffset={-segment.offset}
                  />
                ))}
              </g>
              <ellipse className="donut-highlight" cx="21" cy="13" rx="12" ry="3" />
            </g>
            <text x="22" y="18" textAnchor="middle">Total</text>
            <text x="22" y="23" textAnchor="middle" className="donut-total">{total}</text>
          </svg>
          <div className="donut-legend">
            {segments.map((segment) => (
              <div key={segment.key}>
                <i style={{ background: segment.color }} />
                <span>
                  {segment.key}{labels[segment.key] ? ` — ${labels[segment.key]}` : ''}: <b>{segment.value}</b>{' '}
                  ({Math.round((segment.value / total) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p>Belum ada data terklasifikasi.</p>
      )}
    </div>
  );
}

export function ProblemTypeChart({ values }: { values: Record<string, number> }) {
  const max = Math.max(1, ...Object.values(values));
  return (
    <div className="weakness-chart">
      <h3>5. Breakdown Masalah berdasarkan 4M+1E / Jenis Ketidakpatuhan</h3>
      <div className="vertical-bars">
        {Object.keys(WEAKNESS_PROBLEM_LABEL).map((key, index) => (
          <div key={key}>
            <div className="bar-value">{values[key] ?? 0}</div>
            <i style={{ height: `${((values[key] ?? 0) / max) * 80}%`, background: COLORS[index] }} />
            <b>{key}</b>
          </div>
        ))}
      </div>
      <div className="problem-legend">
        {Object.entries(WEAKNESS_PROBLEM_LABEL).map(([key, label]) => (
          <span key={key}>
            <b>{key}</b> — {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WeaknessChartSet({ charts }: { charts: Charts }) {
  return (
    <div className="weakness-chart-grid">
      <ProcessStackedChart data={charts.processes} />
      <DonutChart
        title="2. Analisa berdasarkan klausul IATF 16949"
        values={charts.clauses}
        labels={{
          '4': 'Konteks Organisasi',
          '5': 'Kepemimpinan',
          '6': 'Perencanaan',
          '7': 'Proses Pendukung',
          '8': 'Operasional',
          '9': 'Evaluasi Performa',
          '10': 'Peningkatan',
        }}
      />
      <DonutChart
        title="3. Analisa berdasarkan ISO 19011 / DIS (Dokumen, Implementasi, Sistem)"
        values={charts.dis}
        labels={WEAKNESS_DIS_LABEL}
      />
      <DonutChart title="4. Analisa berdasarkan 4M + 1E" values={charts.fourM} labels={WEAKNESS_4M1E_LABEL} />
      <ProblemTypeChart values={charts.problems} />
    </div>
  );
}
