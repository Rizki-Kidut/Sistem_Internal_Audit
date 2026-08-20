import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Users } from 'lucide-react';
import type { Auditor, AuditTeamMaster, AuditTeamMasterMember } from '../../lib/types';
import { AUDIT_TEAM_MASTER_STATUS, AUDIT_TEAM_MEMBER_ROLE } from '../../lib/enums';
import { getActiveAuditors } from '../../services/auditorService';
import { deactivateAuditTeamMaster, getAuditTeamMasters, saveAuditTeamMaster } from '../../services/auditTeamMasterService';
import { Badge, Button, Card, EmptyState, LoadingSpinner } from '../ui';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

const emptyTeam = (): AuditTeamMaster => ({ id: '', kode_tim: '', nama_tim: '', status: AUDIT_TEAM_MASTER_STATUS.AKTIF,
  catatan: null, created_at: '', updated_at: '', members: [] });
export function AuditTeamMasterPage() {
  const [teams,setTeams]=useState<AuditTeamMaster[]>([]); const [auditors,setAuditors]=useState<Auditor[]>([]);
  const [form,setForm]=useState<AuditTeamMaster|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState<string|null>(null);
  const load=useCallback(async()=>{setLoading(true);try{const [t,a]=await Promise.all([getAuditTeamMasters(),getActiveAuditors()]);setTeams(t);setAuditors(a);}catch(e){setError(e instanceof Error?e.message:'Gagal memuat Tim Audit');}finally{setLoading(false);}},[]);
  useEffect(()=>{load();},[load]);
  async function save(){if(!form)return;try{await saveAuditTeamMaster(form);setForm(null);await load();}catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan Tim Audit');}}
  async function deactivate(id:string){try{await deactivateAuditTeamMaster(id);await load();}catch(e){setError(e instanceof Error?e.message:'Gagal menonaktifkan Tim Audit');}}
  const names=(members:AuditTeamMasterMember[],role:string)=>members.filter(m=>m.peran===role).map(m=>m.auditor?.nama??auditors.find(a=>a.id===m.auditor_id)?.nama??m.auditor_id).join(', ')||'-';
  if(loading)return <LoadingSpinner message="Memuat Tim Audit..."/>;
  return <div><div className="flex justify-between mb-6"><div><h1 className="text-2xl font-bold">Kelola Tim Audit</h1><p className="text-sm text-gray-500">Template tim reusable; baris Instruksi menyimpan snapshot anggotanya.</p></div><Button onClick={()=>setForm(emptyTeam())}><Plus size={15}/> Tambah Tim</Button></div>{error&&<div className="mb-4 p-3 bg-red-50 text-red-700">{error}</div>}
    {!teams.length?<Card className="p-12"><EmptyState icon={<Users/>} title="Belum ada Tim Audit" message="Tambahkan satu Lead dan anggota tim."/></Card>:<Card className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left">{['Kode Tim','Nama Tim','Lead Auditor','Member','Status','Aksi'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{teams.map(t=><tr key={t.id} className="border-t"><td className="p-3 font-mono">{t.kode_tim}</td><td>{t.nama_tim}</td><td>{names(t.members,'Lead')}</td><td>{names(t.members,'Member')}</td><td><Badge variant={t.status==='Aktif'?'green':'gray'}>{t.status}</Badge></td><td><button className="text-blue-600 mr-3" onClick={()=>setForm(t)}><Pencil size={14}/></button>{t.status==='Aktif'&&<button className="text-red-600 text-xs" onClick={()=>deactivate(t.id)}>Nonaktifkan</button>}</td></tr>)}</tbody></table></Card>}
    <Modal open={!!form} onClose={()=>setForm(null)} title="Tim Audit" size="lg" footer={<><Button variant="secondary" onClick={()=>setForm(null)}>Batal</Button><Button onClick={save}>Simpan</Button></>}>{form&&<TeamForm team={form} auditors={auditors} onChange={setForm}/>}</Modal>
  </div>;
}
function TeamForm({team,auditors,onChange}:{team:AuditTeamMaster;auditors:Auditor[];onChange:(t:AuditTeamMaster)=>void}){
  const lead=team.members.find(m=>m.peran===AUDIT_TEAM_MEMBER_ROLE.LEAD)?.auditor_id??'';
  const members=new Set(team.members.filter(m=>m.peran===AUDIT_TEAM_MEMBER_ROLE.MEMBER).map(m=>m.auditor_id));
  const setLead=(id:string)=>onChange({...team,members:[...team.members.filter(m=>m.peran!==AUDIT_TEAM_MEMBER_ROLE.LEAD&&m.auditor_id!==id),...(id?[{id:'',team_id:team.id,auditor_id:id,peran:AUDIT_TEAM_MEMBER_ROLE.LEAD,urutan_tampil:0}]:[])]});
  const toggle=(id:string)=>onChange({...team,members:members.has(id)?team.members.filter(m=>m.auditor_id!==id):[...team.members,{id:'',team_id:team.id,auditor_id:id,peran:AUDIT_TEAM_MEMBER_ROLE.MEMBER,urutan_tampil:team.members.length}]});
  return <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><Field label="Kode Tim" required><Input value={team.kode_tim} onChange={e=>onChange({...team,kode_tim:e.target.value})}/></Field><Field label="Nama Tim" required><Input value={team.nama_tim} onChange={e=>onChange({...team,nama_tim:e.target.value})}/></Field><Field label="Lead Auditor" required><Select value={lead} onChange={e=>setLead(e.target.value)}><option value="">— Pilih Lead —</option>{auditors.map(a=><option key={a.id} value={a.id}>{a.nama}</option>)}</Select></Field><Field label="Status"><Select value={team.status} onChange={e=>onChange({...team,status:e.target.value as AuditTeamMaster['status']})}><option>Aktif</option><option>Nonaktif</option></Select></Field></div><Field label="Member"><div className="grid grid-cols-2 gap-2">{auditors.filter(a=>a.id!==lead).map(a=><label key={a.id} className="text-sm"><input type="checkbox" checked={members.has(a.id)} onChange={()=>toggle(a.id)} className="mr-2"/>{a.nama}</label>)}</div></Field><Field label="Catatan"><Textarea value={team.catatan??''} onChange={e=>onChange({...team,catatan:e.target.value||null})}/></Field></div>;
}
