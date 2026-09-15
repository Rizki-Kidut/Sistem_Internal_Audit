import type { EChartsCoreOption } from 'echarts/core';
import { WEAKNESS_4M1E_LABEL, WEAKNESS_DIS_LABEL, WEAKNESS_PROBLEM_LABEL } from '../../lib/enums';
import type { buildWeaknessCharts } from '../../lib/weaknessAnalysis';
import { WeaknessEChart } from './WeaknessEChart';

type Charts = ReturnType<typeof buildWeaknessCharts>;
const COLORS = ['#2563eb', '#0f766e', '#d97706', '#be123c', '#7c3aed', '#0891b2', '#4d7c0f', '#64748b'];
// One SVG gradient per slice supplies the bevel; no duplicated pie/depth series.
const PIE_TONES = [
  ['#719af2', '#1b49ae'], ['#589f99', '#0b5751'],
  ['#e6a65d', '#a15804'], ['#d4637e', '#8d0d2c'],
  ['#aa7ef3', '#5c2baf'], ['#5bc0cc', '#067f84'],
  ['#89aa60', '#395c0b'], ['#96a2b2', '#4a5567'],
];
const TEXT = { fontFamily: 'Inter, Arial, sans-serif', fontSize: 10, color: '#334155' };
const COUNT_AXIS = {
  type: 'value', min: 0, minInterval: 1,
  axisLabel: { fontSize: 10 },
  splitLine: { lineStyle: { color: '#e2e8f0' } },
};

export function ProcessStackedChart({ data }: { data: Charts['processes'] }) {
  const totals = data.reduce(
    (acc, value) => ({ A: acc.A + value.A, B: acc.B + value.B, C: acc.C + value.C }),
    { A: 0, B: 0, C: 0 },
  );
  const option: EChartsCoreOption = {
    animation: false, textStyle: TEXT,
    legend: { top: 0, selectedMode: false, itemWidth: 12, itemHeight: 9, textStyle: TEXT },
    grid: { left: 32, right: 12, top: 32, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category', data: data.map((value) => value.process),
      axisLabel: { interval: 0, rotate: 45, fontSize: 9 },
      axisTick: { alignWithLabel: true }, axisLine: { lineStyle: { color: '#94a3b8' } },
    },
    yAxis: COUNT_AXIS,
    series: [
      { key: 'C' as const, name: 'Peluang Improvement', color: '#2563eb' },
      { key: 'B' as const, name: 'Minor', color: '#f59e0b' },
      { key: 'A' as const, name: 'Major', color: '#dc2626' },
    ].map(({ key, name, color }) => ({
      type: 'bar', name, stack: 'findings', animation: false, silent: true,
      barMaxWidth: 40, itemStyle: { color },
      label: {
        show: true, position: 'inside', color: key === 'B' ? '#422006' : '#fff', fontSize: 10,
        formatter: ({ value }: { value: unknown }) => Number(value) > 0 ? String(value) : '',
      },
      data: data.map((value) => value[key]),
    })),
  };
  return (
    <div className="weakness-chart weakness-chart-primary">
      <h3>1. Berdasarkan temuan ketidaksesuaian</h3>
      {totals.A + totals.B + totals.C > 0 ? (
        <div className="process-chart-layout">
          <WeaknessEChart option={option} ariaLabel="Jumlah ketidaksesuaian per Process: Peluang Improvement, Minor, Major" />
          <div className="finding-summary">
            <b>Total ketidaksesuaian</b>
            <span>Berat (Major) = {totals.A}</span>
            <span>Ringan (Minor) = {totals.B}</span>
            <span>Peluang Improvement = {totals.C}</span>
            <span>Total ketidaksesuaian = {totals.A + totals.B + totals.C}</span>
          </div>
        </div>
      ) : <p>Belum ada Finding dalam populasi.</p>}
    </div>
  );
}

export function PieDistributionChart({ title, values, labels = {} }: {
  title: string;
  values: Record<string, number>;
  labels?: Record<string, string>;
}) {
  const entries = Object.entries(values).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const option: EChartsCoreOption = {
    animation: false, textStyle: TEXT, color: COLORS,
    series: [{
      type: 'pie', animation: false, silent: true,
      // A balanced, thick annulus also gives a single category a defined inner rim.
      radius: ['36%', '78%'], center: ['50%', '50%'],
      emphasis: { disabled: true },
      label: { show: false }, labelLine: { show: false },
      itemStyle: { borderColor: '#fff', borderWidth: 1.25, borderRadius: 2 },
      data: entries.map(([key, value], index) => {
        const color = COLORS[index % COLORS.length];
        const [highlight, edge] = PIE_TONES[index % PIE_TONES.length];
        return {
          name: key, value,
          itemStyle: {
            // Native SVG vector stops remain crisp without a blur/filter or raster layer.
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: edge },
                { offset: 0.035, color: highlight },
                { offset: 0.12, color: highlight },
                { offset: 0.3, color },
                { offset: 0.78, color },
                { offset: 0.94, color: edge },
                { offset: 1, color: edge },
              ],
            },
          },
        };
      }),
    }],
  };
  return (
    <div className="weakness-chart weakness-chart-pie">
      <h3>{title}</h3>
      {total > 0 ? (
        <div className="pie-layout">
          <WeaknessEChart option={option} ariaLabel={title} />
          <div className="pie-legend">
            {entries.map(([key, value], index) => (
              <div key={key}>
                <i style={{ background: COLORS[index % COLORS.length] }} />
                <span>{labels[key] && labels[key].toUpperCase() !== key.toUpperCase() ? `${key} — ${labels[key]}` : key}: <b>{value}</b> ({Math.round(value / total * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      ) : <p>Belum ada data terklasifikasi.</p>}
    </div>
  );
}

export function ProblemTypeChart({ values }: { values: Record<string, number> }) {
  const keys = Object.keys(WEAKNESS_PROBLEM_LABEL);
  const option: EChartsCoreOption = {
    animation: false, textStyle: TEXT,
    grid: { left: 30, right: 12, top: 22, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: keys, axisLabel: { interval: 0 }, axisTick: { show: false } },
    yAxis: COUNT_AXIS,
    series: [{
      type: 'bar', animation: false, silent: true, barMaxWidth: 36,
      label: { show: true, position: 'top', fontSize: 10, color: '#334155' },
      data: keys.map((key, index) => ({ value: values[key] ?? 0, itemStyle: { color: COLORS[index] } })),
    }],
  };
  return (
    <div className="weakness-chart weakness-chart-problem">
      <h3>5. Jenis Ketidakpatuhan</h3>
      {keys.some((key) => (values[key] ?? 0) > 0)
        ? <WeaknessEChart option={option} ariaLabel="Jenis Ketidakpatuhan A sampai E" />
        : <p>Belum ada data terklasifikasi.</p>}
      <div className="problem-legend">
        {Object.entries(WEAKNESS_PROBLEM_LABEL).map(([key, label]) => (
          <span key={key}><b>{key}</b> — {label}</span>
        ))}
      </div>
    </div>
  );
}

export function WeaknessChartSet({ charts }: { charts: Charts }) {
  return (
    <div className="weakness-chart-grid">
      <ProcessStackedChart data={charts.processes} />
      <PieDistributionChart
        title="2. Analisa berdasarkan klausul IATF 16949" values={charts.clauses}
        labels={{ '4': 'Konteks Organisasi', '5': 'Kepemimpinan', '6': 'Perencanaan', '7': 'Proses Pendukung', '8': 'Operasional', '9': 'Evaluasi Performa', '10': 'Peningkatan' }}
      />
      <PieDistributionChart title="3. Analisa berdasarkan ISO 19011 / DIS (Dokumen, Implementasi, Sistem)" values={charts.dis} labels={WEAKNESS_DIS_LABEL} />
      <ProblemTypeChart values={charts.problems} />
      <PieDistributionChart title="4. Analisa berdasarkan 4M + 1E" values={charts.fourM} labels={WEAKNESS_4M1E_LABEL} />
    </div>
  );
}
