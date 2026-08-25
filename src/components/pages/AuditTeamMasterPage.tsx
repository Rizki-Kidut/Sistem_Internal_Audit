import { useCallback,useEffect,useMemo,useState } from 'react';
import { Pencil,Plus,Users } from 'lucide-react';
import type { AuditPlan,Auditor,AuditTeamMaster,AuditTeamMasterMember } from '../../lib/types';
import { AUDIT_TEAM_MASTER_STATUS,AUDIT_TEAM_MEMBER_ROLE } from '../../lib/enums';
import { getActiveAuditors } from '../../services/auditorService';
import { getAuditPlans } from '../../services/auditPlanService';
import { deactivateAuditTeamMaster,getAuditTeamMastersByPlan,lockAuditTeamMaster,saveAuditTeamMaster,unlockAuditTeamMaster } from '../../services/auditTeamMasterService';
import { Badge,Button,Card,EmptyState,LoadingSpinner } from '../ui';
import { Field,Input,Select,Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { SearchableMultiSelect,SearchableSelect,type SearchOption } from '../ui/SearchableSelect';

const emptyTeam=(planId:string):AuditTeamMaster=>({id:'',plan_id:planId,kode_tim:'',nama_tim:'',status:AUDIT_TEAM_MASTER_STATUS.AKTIF,catatan:null,is_locked:false,locked_at:null,created_at:'',updated_at:'',members:[]});
const responsibilityNames=(members:AuditTeamMasterMember[],key:'is_team_leader'|'is_lead_auditor')=>members.filter(m=>m[key]).map(m=>m.auditor?.nama??m.auditor_id).join(', ')||'-';
const regularNames=(members:AuditTeamMasterMember[])=>members.filter(m=>!m.is_team_leader&&!m.is_lead_auditor).map(m=>m.auditor?.nama??m.auditor_id).join(', ')||'-';

export function AuditTeamMasterPage(){
 const [plans,setPlans]=useState<AuditPlan[]>([]),[planId,setPlanId]=useState(''),[teams,setTeams]=useState<AuditTeamMaster[]>([]),[auditors,setAuditors]=useState<Auditor[]>([]);const [form,setForm]=useState<AuditTeamMaster|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState<string|null>(null);
 const loadBase=useCallback(async()=>{setLoading(true);try{const[p,a]=await Promise.all([getAuditPlans(),getActiveAuditors()]);setPlans(p);setAuditors(a);setPlanId(old=>old||p[0]?.id||'');}catch(e){setError(e instanceof Error?e.message:'Gagal memuat data');}finally{setLoading(false);}},[]);
 const loadTeams=useCallback(async()=>{if(!planId){setTeams([]);return;}try{setTeams(await getAuditTeamMastersByPlan(planId));}catch(e){setError(e instanceof Error?e.message:'Gagal memuat Tim Audit');}},[planId]);
 useEffect(()=>{loadBase();},[loadBase]);useEffect(()=>{loadTeams();},[loadTeams]);
 async function save(){if(!form)return;try{await saveAuditTeamMaster(form);setForm(null);await loadTeams();}catch(e){setError(e instanceof Error?e.message:'Gagal menyimpan Tim Audit');}}
 async function action(fn:(id:string)=>Promise<void>,id:string){try{await fn(id);await loadTeams();}catch(e){setError(e instanceof Error?e.message:'Gagal memproses Tim Audit');}}
 if(loading)return <LoadingSpinner message="Memuat Tim Audit..."/>;
 return <div><div className="flex justify-between mb-6"><div><h1 className="text-2xl font-bold">Kelola Tim Audit</h1><p className="text-sm text-gray-500">Roster tahunan berdasarkan Rencana Audit.</p></div><Button disabled={!planId} onClick={()=>setForm(emptyTeam(planId))}><Plus size={15}/> Tambah Tim</Button></div>{error&&<div className="mb-4 p-3 bg-red-50 text-red-700">{error}</div>}<Card className="p-4 mb-4"><Field label="Rencana Audit Tahunan"><Select value={planId} onChange={e=>setPlanId(e.target.value)}>{plans.map(p=><option key={p.id} value={p.id}>{p.tahun} — {p.kode_dokumen}</option>)}</Select></Field></Card>
 {!teams.length?<Card className="p-12"><EmptyState icon={<Users/>} title="Belum ada Tim Audit" message="Tambahkan Tim untuk Rencana Tahunan terpilih."/></Card>:<Card className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left">{['Kode Tim','Nama Tim','Team Leader','Lead Auditor','Member','Status','Lock Status','Aksi'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{teams.map(t=><tr key={t.id} className="border-t"><td className="p-3 font-mono">{t.kode_tim}</td><td>{t.nama_tim}</td><td>{responsibilityNames(t.members,'is_team_leader')}</td><td>{responsibilityNames(t.members,'is_lead_auditor')}</td><td>{regularNames(t.members)}</td><td><Badge variant={t.status==='Aktif'?'green':'gray'}>{t.status}</Badge></td><td><Badge variant={t.is_locked?'blue':'amber'}>{t.is_locked?'Locked':'Draft'}</Badge></td><td className="space-x-2">{!t.is_locked&&<><button className="text-blue-600" onClick={()=>setForm(t)}><Pencil size={14}/></button><button className="text-blue-600 text-xs" onClick={()=>action(lockAuditTeamMaster,t.id)}>Kunci Tim</button>{t.status==='Aktif'&&<button className="text-red-600 text-xs" onClick={()=>action(deactivateAuditTeamMaster,t.id)}>Nonaktifkan</button>}</>}{t.is_locked&&<><button className="text-gray-600 text-xs" onClick={()=>setForm(t)}>View</button><button className="text-blue-600 text-xs" onClick={()=>action(unlockAuditTeamMaster,t.id)}>Buka Kunci</button></>}</td></tr>)}</tbody></table></Card>}
 <Modal open={!!form} onClose={()=>setForm(null)} title={form?.is_locked?'Lihat Tim Audit':'Edit Tim Audit'} size="lg" footer={<><Button variant="secondary" onClick={()=>setForm(null)}>Tutup</Button>{form&&!form.is_locked&&<Button onClick={save}>Simpan</Button>}</>}>{form&&<TeamForm team={form} auditors={auditors} onChange={setForm}/>}</Modal></div>;
}

function TeamForm({team,auditors,onChange}:{team:AuditTeamMaster;auditors:Auditor[];onChange:(t:AuditTeamMaster)=>void}){
 const teamLeader=team.members.find(m=>m.is_team_leader)?.auditor_id??'';
 const leadAuditor=team.members.find(m=>m.is_lead_auditor)?.auditor_id??'';
 const members=team.members.filter(m=>!m.is_team_leader&&!m.is_lead_auditor).map(m=>m.auditor_id);
 const disabled=team.is_locked;
 const options:SearchOption[]=useMemo(()=>auditors.map(a=>({value:a.id,label:a.nama,searchText:`${a.nip??''} ${a.departemen??''}`,detail:`${a.departemen??'-'} · Berlaku s.d. ${a.tanggal_berlaku??'-'}`})),[auditors]);
 const rebuild=(nextTeamLeader:string,nextLeadAuditor:string,nextMembers:string[])=>{
   const ids=Array.from(new Set([nextTeamLeader,nextLeadAuditor,...nextMembers].filter(Boolean)));
   const previous=new Map(team.members.map(member=>[member.auditor_id,member]));
   const rebuilt=ids.map((id,index)=>{
     const isTeamLeader=id===nextTeamLeader;
     const isLeadAuditor=id===nextLeadAuditor;
     const existing=previous.get(id);
     return {id:existing?.id??'',team_id:team.id,auditor_id:id,peran:isTeamLeader?AUDIT_TEAM_MEMBER_ROLE.LEAD:AUDIT_TEAM_MEMBER_ROLE.MEMBER,is_team_leader:isTeamLeader,is_lead_auditor:isLeadAuditor,urutan_tampil:index,auditor:existing?.auditor};
   });
   onChange({...team,members:rebuilt});
 };
 const setTeamLeader=(id:string)=>rebuild(id,leadAuditor,members);
 const setLeadAuditor=(id:string)=>rebuild(teamLeader,id,members);
 const setMembers=(ids:string[])=>rebuild(teamLeader,leadAuditor,ids.filter(id=>id!==teamLeader&&id!==leadAuditor));
 return <div className="space-y-3"><div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">Team Leader mengoordinasikan Submit/Resubmit PLOR. Lead Auditor melakukan Request Revision/Approve/Annul. Keduanya dapat orang yang sama atau Auditor yang berbeda.</div><div className="grid grid-cols-2 gap-3"><Field label="Kode Tim" required><Input disabled={disabled} value={team.kode_tim} onChange={e=>onChange({...team,kode_tim:e.target.value})}/></Field><Field label="Nama Tim" required><Input disabled={disabled} value={team.nama_tim} onChange={e=>onChange({...team,nama_tim:e.target.value})}/></Field><Field label="Team Leader" required><SearchableSelect disabled={disabled} options={options} value={teamLeader} onChange={setTeamLeader} placeholder="Cari Team Leader..."/></Field><Field label="Lead Auditor" required><SearchableSelect disabled={disabled} options={options} value={leadAuditor} onChange={setLeadAuditor} placeholder="Cari Lead Auditor..."/></Field><Field label="Status"><Select disabled={disabled} value={team.status} onChange={e=>onChange({...team,status:e.target.value as AuditTeamMaster['status']})}><option>Aktif</option><option>Nonaktif</option></Select></Field></div><Field label="Member"><SearchableMultiSelect disabled={disabled} options={options.filter(o=>o.value!==teamLeader&&o.value!==leadAuditor)} values={members} onChange={setMembers}/></Field><Field label="Catatan"><Textarea disabled={disabled} value={team.catatan??''} onChange={e=>onChange({...team,catatan:e.target.value||null})}/></Field></div>;
}
