import { useMemo } from 'react';
import { formatFindingNarrative } from '../../lib/finding';
import { formatForm014AuditRange,formatForm014DateOnly,formatForm014TimestampDate } from '../../lib/form014';
import { itemDisplay,type Form014Group,type Form014Report,type Form014Signatories } from '../../services/rangkumanHasilAuditService';
import './rangkumanHasilAuditPrint.css';

const FORM014_TABLE_BODY_HEIGHT_PX=500;
const FORM014_MIN_FINDING_ROW_HEIGHT_PX=40;
const FORM014_NARRATIVE_CHARS_PER_LINE=50;
const FORM014_TEXT_LINE_HEIGHT_PX=15.6;
const FORM014_ROW_VERTICAL_PADDING_PX=12;
const FORM014_BLANK_ROW_HEIGHT_PX=18.9;
const FORM014_FILLER_SAFETY_RESERVE_PX=18;
const FORM014_EMPTY_STATE_ROW_HEIGHT_PX=49;
const FORM014_COLUMN_COUNT=11;

const cat=(v:string)=>v==='A'?'Major':v==='B'?'Minor':'Peluang Improvement';

function paginate(groups:Form014Group[],final:boolean){
  let no=0;
  return groups.flatMap(group=>{
    const pages:{group:Form014Group;items:typeof group.items;start:number;usedHeight:number}[]=[];
    let chunk:typeof group.items=[];
    let height=0;
    let start=no+1;

    for(const item of group.items){
      const d=itemDisplay(item,final);
      const narrative=formatFindingNarrative(d.finding);
      const lines=Math.max(1,Math.ceil(narrative.length/FORM014_NARRATIVE_CHARS_PER_LINE));
      const row=Math.max(
        FORM014_MIN_FINDING_ROW_HEIGHT_PX,
        lines*FORM014_TEXT_LINE_HEIGHT_PX+FORM014_ROW_VERTICAL_PADDING_PX,
      );

      if(chunk.length&&height+row>FORM014_TABLE_BODY_HEIGHT_PX){
        pages.push({group,items:chunk,start,usedHeight:height});
        start=no+1;
        chunk=[];
        height=0;
      }

      chunk.push(item);
      height+=row;
      no++;
    }

    if(chunk.length){
      pages.push({group,items:chunk,start,usedHeight:height});
    }else if(!group.items.length){
      pages.push({
        group,
        items:chunk,
        start,
        usedHeight:group.completed?FORM014_BLANK_ROW_HEIGHT_PX:FORM014_EMPTY_STATE_ROW_HEIGHT_PX,
      });
    }

    return pages;
  });
}

function fillerRowCount(usedHeight:number){
  return Math.max(
    0,
    Math.floor(
      (FORM014_TABLE_BODY_HEIGHT_PX-usedHeight-FORM014_FILLER_SAFETY_RESERVE_PX)
      /FORM014_BLANK_ROW_HEIGHT_PX,
    ),
  );
}

export function RangkumanHasilAuditPrintView({report,groups,signatories}:{report:Form014Report;groups:Form014Group[];signatories:Form014Signatories}){
  const final=report.status==='Final';
  const pages=useMemo(()=>paginate(groups,final),[groups,final]);
  const all=groups.flatMap(g=>g.items);
  const summary={
    a:all.filter(i=>(final?i.kategori_snapshot:i.finding?.kategori)==='A').length,
    b:all.filter(i=>(final?i.kategori_snapshot:i.finding?.kategori)==='B').length,
    c:all.filter(i=>(final?i.kategori_snapshot:i.finding?.kategori)==='C').length,
  };

  return <div className="form014-print">{pages.map((page,physicalPageIndex)=>{
    const blankRows=fillerRowCount(page.usedHeight);
    return <section className="form014-page" key={`${page.group.id}-${physicalPageIndex}`}>
      <header><div><b>PROSES</b><span>{page.group.label_snapshot}</span><b>PEMILIK PROSES</b><span>{page.group.process_owner_snapshot||'-'}</span><b>SEKSI TERKAIT</b><span>{page.group.related_sections_snapshot||'-'}</span></div><h1>RANGKUMAN HASIL INTERNAL AUDIT</h1><div><b>PERIODE - TAHUN FISKAL {report.tahun_fiskal}</b><span>TGL AUDIT: {formatForm014AuditRange(report.audit_date_start,report.audit_date_end)}</span></div></header>
      <table>
        <colgroup>
          <col style={{width:'3%'}}/>
          <col style={{width:'34%'}}/>
          <col style={{width:'9%'}}/>
          <col style={{width:'8%'}}/>
          <col style={{width:'7%'}}/>
          <col style={{width:'7%'}}/>
          <col style={{width:'7%'}}/>
          <col style={{width:'7%'}}/>
          <col style={{width:'5%'}}/>
          <col style={{width:'5%'}}/>
          <col style={{width:'8%'}}/>
        </colgroup>
        <thead><tr><th rowSpan={3}>No</th><th rowSpan={3}>Temuan</th><th rowSpan={3}>No. Laporan</th><th rowSpan={3}>Klausul</th><th rowSpan={3}>Kategori</th><th colSpan={3}>Tanggal</th><th colSpan={2}>Status</th><th rowSpan={3}>Keterangan</th></tr><tr><th colSpan={2}>Target</th><th rowSpan={2}>Verifikasi</th><th rowSpan={2}>Close</th><th rowSpan={2}>Open</th></tr><tr><th>Temporary</th><th>Permanent</th></tr></thead>
        <tbody>
          {page.items.length?page.items.map((item,index)=>{
            const d=itemDisplay(item,final),k=String(d.finding.kategori);
            return <tr className="form014-finding-row" key={item.id}><td>{page.start+index}</td><td className="form014-temuan-cell">{formatFindingNarrative(d.finding)}</td><td>{d.kode||'-'}</td><td>{d.reference||'-'}</td><td className={`category-${k}`}>{cat(k)}</td><td>{formatForm014DateOnly(d.temporary)}</td><td>{formatForm014DateOnly(d.permanent)}</td><td>{formatForm014TimestampDate(d.verified)}</td><td>{d.status==='CLOSED'?'Close':'-'}</td><td>{d.status==='CLOSED'?'-':'Open'}</td><td>{item.keterangan||'-'}</td></tr>;
          }):page.group.completed?<tr className="zero-finding-row"><td/><td className="zero-finding-text">ZERO FINDING</td>{Array.from({length:FORM014_COLUMN_COUNT-2},(_,colIndex)=><td key={colIndex}/>)}</tr>:<tr className="audit-incomplete"><td colSpan={FORM014_COLUMN_COUNT}>AUDIT BELUM SELESAI</td></tr>}
          {Array.from({length:blankRows},(_,rowIndex)=><tr className="form014-blank-row" key={`blank-${rowIndex}`}>{Array.from({length:FORM014_COLUMN_COUNT},(_,colIndex)=><td key={colIndex}/>)}</tr>)}
        </tbody>
      </table>
      <footer>{physicalPageIndex===0?<><div className="form014-summary"><b>Rangkuman Temuan</b><span>Jumlah ketidaksesuaian: {summary.a+summary.b+summary.c}</span><span>Major: {summary.a}</span><span>Minor: {summary.b}</span><span>Peluang Improvement: {summary.c}</span></div><div className="form014-note"><b>Catatan</b><p>{report.catatan||'-'}</p></div></>:<><div className="form014-summary empty"/><div className="form014-note empty"><b>Catatan</b></div></>}<div className="form014-approval"><div className="approval-roles"><b>Dibuat</b><b>Penanggungjawab QMS</b></div><div className={`approval-body ${physicalPageIndex?'slashed':''}`}><span>{physicalPageIndex===0?((final?report.lead_auditor_name_snapshot:signatories.lead_auditor_name)||'BELUM TERSEDIA'):' '}</span><span>{physicalPageIndex===0?((final?report.pj_qms_snapshot:signatories.pj_qms)||'BELUM TERSEDIA'):' '}</span></div></div><strong>{report.kode_dokumen}</strong></footer>
    </section>;
  })}</div>;
}
