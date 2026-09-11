import type { InternalAuditReport, InternalAuditReportContext } from '../../lib/types';
import './internalAuditReportPrint.css';

const value = (v?: string | null) => v?.trim() || '-';
const date = (v?: string | null) =>
  v
    ? new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${v.slice(0, 10)}T00:00:00Z`))
    : '-';
const lines = (values: (string | null | undefined)[]) => values.map(value).join('\n');

export function InternalAuditReportPrintView({
  context,
  report,
  preview = false,
}: {
  context: InternalAuditReportContext;
  report: InternalAuditReport;
  preview?: boolean;
}) {
  const signer = [context.team_leader, ...context.team_members].find(
    (auditor) => auditor?.id === report.leader_signatory_auditor_id,
  );
  const subLeader = context.team_members.find(
    (auditor) => auditor.id === report.sub_leader_auditor_id,
  );
  const members = context.team_members.filter(
    (auditor) => auditor.id !== report.sub_leader_auditor_id,
  );
  const assistants = context.agenda?.asisten_auditor_pendamping ?? [];

  return (
    <div className="form015-preview">
      <article
        className="form015-document"
        aria-label="Q-120-ISE-001-FORM-015 Laporan Internal Audit"
      >
        {preview && <div className="form015-watermark">DRAFT / PREVIEW</div>}

        <header className="form015-header">
          <div className="form015-code">{report.kode_dokumen}</div>
          <h1>Laporan Internal Audit</h1>
        </header>

        <table className="form015-table-fixed form015-meta-table">
          <colgroup>
            <col style={{ width: '19%' }} />
            <col style={{ width: '31%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '32%' }} />
          </colgroup>
          <tbody>
            <tr>
              <th>No. audit</th>
              <td className="strong">{context.row.kode_audit}</td>
              <th>Tanggal Terbit</th>
              <td>{date(report.tanggal_terbit)}</td>
            </tr>
          </tbody>
        </table>

        <table className="form015-table-fixed form015-context-table">
          <colgroup>
            <col style={{ width: '27%' }} />
            <col style={{ width: '25%' }} />
            <col style={{ width: '31%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Proses yang diaudit</th>
              <th>Manager seksi (proses) yang diaudit</th>
              <th>Tujuan dan lingkup audit (proses)</th>
              <th>Waktu &amp; tanggal audit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{value(context.proses?.nama_proses)}</td>
              <td>
                {value(context.scope_section.kepala_seksi)}
                <br />
                {context.scope_section.nama}
              </td>
              <td className="pre">{value(context.agenda?.tujuan_lingkup_audit)}</td>
              <td>{context.audit_time_range}</td>
            </tr>
          </tbody>
        </table>

        <table className="form015-table-fixed form015-auditee-table">
          <colgroup>
            <col style={{ width: '16%' }} />
            <col style={{ width: '38%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '28%' }} />
          </colgroup>
          <tbody>
            <tr>
              <th rowSpan={3}>Auditee / Seksi</th>
              <td rowSpan={3} className="pre">
                {report.auditee_hadir.length
                  ? report.auditee_hadir
                      .map((attendee) => `${value(attendee.nama)} / ${value(attendee.seksi)}`)
                      .join('\n')
                  : '-'}
              </td>
              <th>Nama customer</th>
              <td>{value(report.nama_customer)}</td>
            </tr>
            <tr>
              <th>Nama produk</th>
              <td>{value(report.nama_produk)}</td>
            </tr>
            <tr>
              <th>Nama line</th>
              <td>{value(report.nama_line)}</td>
            </tr>
          </tbody>
        </table>

        <table className="form015-table-fixed form015-team-table">
          <colgroup>
            <col style={{ width: '12%' }} />
            <col style={{ width: '22%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '20%' }} />
            <col style={{ width: '26%' }} />
          </colgroup>
          <thead>
            <tr>
              <th>Audit team</th>
              <th>Leader &amp; sub-leader audit/seksi</th>
              <th>Member Audit/Seksi</th>
              <th>Asisten auditor pendamping/seksi</th>
              <th>Item lain yang dicek</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pre">
                {context.team ? `${context.team.kode_tim}\n${context.team.nama_tim}` : '-'}
              </td>
              <td className="pre">{lines([context.team_leader?.nama, subLeader?.nama])}</td>
              <td className="pre">
                {members.length ? members.map((auditor) => auditor.nama).join('\n') : '-'}
              </td>
              <td className="pre">
                {assistants.length
                  ? assistants.map((assistant) => `${assistant.nama} / ${assistant.seksi}`).join('\n')
                  : '-'}
              </td>
              <td className="pre">{value(context.agenda?.item_lain_yang_dicek)}</td>
            </tr>
          </tbody>
        </table>

        <section className="form015-bordered form015-observation-section">
          <h2>Hasil pengamatan/evaluasi</h2>
          <div>
            <b>[Hasil pengamatan]</b>
            <p>{value(report.hasil_pengamatan)}</p>
            <b>[Evaluasi]</b>
            <p>{value(report.evaluasi)}</p>
          </div>
        </section>

        <table className="finding-table form015-table-fixed">
          <colgroup>
            <col style={{ width: '11%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '31%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2}>No. Ketidaksesuaian</th>
              <th colSpan={2}>Item kejadian ketidaksesuaian</th>
              <th rowSpan={2}>Seksi tempat kejadian</th>
              <th colSpan={3}>Jumlah Ketidaksesuaian</th>
            </tr>
            <tr>
              <th>Klausul</th>
              <th>Persyaratan</th>
              <th>Major</th>
              <th>Minor</th>
              <th>Peluang Improvement</th>
            </tr>
          </thead>
          <tbody>
            {context.finding_summary_groups.length ? (
              context.finding_summary_groups.map((group, index) => (
                <tr key={index}>
                  <td>{group.finding_numbers.join(' & ')}</td>
                  <td>{value(group.reference)}</td>
                  <td className="pre">{value(group.requirement)}</td>
                  <td>{value(group.location)}</td>
                  <td>{group.counts.A || '-'}</td>
                  <td>{group.counts.B || '-'}</td>
                  <td>{group.counts.C || '-'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="form015-empty-row">
                  Tidak terdapat ketidaksesuaian / peluang improvement.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <p className="form015-note">
          *Lihat lampiran “Q-120-ISE-001-FORM-008 Daftar Ketidaksesuaian/Peluang Perbaikan”
          untuk detail ketidaksesuaian
        </p>

        <table className="form015-table-fixed form015-followup-table">
          <colgroup>
            <col style={{ width: '20%' }} />
            <col style={{ width: '18%' }} />
            <col style={{ width: '35%' }} />
            <col style={{ width: '27%' }} />
          </colgroup>
          <tbody>
            <tr>
              <th rowSpan={Math.max(1, report.follow_up_items.length + 1)}>Saran perbaikan</th>
              <td>{report.follow_up_required ? '☑ Ada   ☐ Tidak' : '☐ Ada   ☑ Tidak'}</td>
              <th>Seksi pelaksana audit follow-up</th>
              <th>Jadwal audit follow-up</th>
            </tr>
            {report.follow_up_required &&
              report.follow_up_items.map((item, index) => (
                <tr key={index}>
                  <td>{value(item.seksi)}</td>
                  <td>{value(item.seksi_pelaksana_follow_up)}</td>
                  <td>{date(item.jadwal_follow_up)}</td>
                </tr>
              ))}
          </tbody>
        </table>

        <table className="signature-table form015-table-fixed">
          <colgroup>
            <col style={{ width: '54%' }} />
            <col style={{ width: '15.33%' }} />
            <col style={{ width: '15.33%' }} />
            <col style={{ width: '15.34%' }} />
          </colgroup>
          <tbody>
            <tr>
              <td rowSpan={2} className="notes">
                <b>[Catatan]</b>
                <p>{value(report.catatan)}</p>
              </td>
              <th>
                Leader/sub-leader
                <br />
                tim audit
              </th>
              <th>
                Manager seksi
                <br />
                (proses) yang diaudit
              </th>
              <th>
                Management
                <br />
                Representative
              </th>
            </tr>
            <tr className="signature-names">
              <td>{value(signer?.nama)}</td>
              <td>{value(report.manager_signatory_name ?? context.scope_section.kepala_seksi)}</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>

        <section className="form015-route">
          <h2>[Rute laporan]</h2>
          <div className="route-flow">
            <div>
              <b>Leader audit</b>
              <span>Membuat laporan internal audit</span>
            </div>
            <i aria-hidden="true">→</i>
            <div>
              <b>Penanggung jawab seksi auditee</b>
              <span>Cek laporan internal audit &amp; tulis nama dan approval jika tidak ada masalah</span>
            </div>
            <i aria-hidden="true">→</i>
            <div>
              <b>Management Representative</b>
              <span>
                Cek efektivitas hasil audit, cek apakah ada yang belum tertulis, lalu tuliskan nama dan
                approval
              </span>
            </div>
          </div>
          <p>Kirimkan salinan ke leader audit dan penanggung jawab seksi auditee</p>
        </section>

        <section className="form015-documents">
          <b>[Dokumen lainnya]</b>
          <p>{context.checklist_presence.sistem ? '☑' : '☐'} Checklist internal audit (untuk menulis hasil)</p>
          <p>
            {context.checklist_presence.manufaktur_shift ? '☑' : '☐'} Checklist audit proses manufaktur &amp;
            shift (jika ada)
          </p>
          <p>{context.checklist_presence.produk ? '☑' : '☐'} Checklist audit produk (jika ada)</p>
        </section>
      </article>
    </div>
  );
}
