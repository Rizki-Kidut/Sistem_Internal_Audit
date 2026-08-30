import { useCallback,useEffect,useMemo,useState } from 'react';
import { Pencil,Plus,ShieldCheck,Users } from 'lucide-react';
import type { IdentityStatus } from '../../lib/auth';
import type { AuditPlan,Auditor,AuditTeamMaster,Seksi } from '../../lib/types';
import { MANAGE_USER_ROLE_LABEL,MANAGE_USER_ROLES,type ManagedAnnualAssignment,type ManagedUser,type ManageUserRole } from '../../lib/userManagementTypes';
import { getAuditPlans } from '../../services/auditPlanService';
import { getActiveAuditors } from '../../services/auditorService';
import { getAuditTeamMasters } from '../../services/auditTeamMasterService';
import { getSeksiList } from '../../services/seksiService';
import { createManagedUser,listManagedUsers,saveManagedUserAccess,setManagedAnnualAssignmentStatus } from '../../services/userManagementService';
import { Badge,Button,Card,EmptyState,LoadingSpinner } from '../ui';
import { Field,Input,Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { SearchableSelect,type SearchOption } from '../ui/SearchableSelect';

interface UserFormState {
  user_id:string|null;
  email:string;
  display_name:string;
  nik:string;
  role:ManageUserRole;
  status:IdentityStatus;
  auditor_id:string;
  plan_id:string;
  team_id:string;
  seksi_id:string;
  annual_assignments:ManagedAnnualAssignment[];
}

const emptyForm=(planId:string):UserFormState=>({
  user_id:null,email:'',display_name:'',nik:'',role:'AUDITOR',status:'Aktif',auditor_id:'',plan_id:planId,team_id:'',seksi_id:'',annual_assignments:[],
});

function formFromUser(user:ManagedUser,plans:AuditPlan[]):UserFormState{
  const activeAnnual=user.annual_assignments.find(item=>item.status==='Aktif');
  const activeSection=user.section_assignments.find(item=>item.status==='Aktif');
  return {
    user_id:user.user_id,
    email:user.email??'',
    display_name:user.display_name??'',
    nik:user.nik??'',
    role:user.role??'AUDITEE',
    status:user.status??'Aktif',
    auditor_id:user.auditor_id??'',
    plan_id:activeAnnual?.plan_id??plans[0]?.id??'',
    team_id:activeAnnual?.team_id??'',
    seksi_id:activeSection?.seksi_id??'',
    annual_assignments:user.annual_assignments,
  };
}

const accessSummary=(user:ManagedUser)=>{
  if(!user.role)return 'Belum dikonfigurasi';
  if(user.role==='ADMIN'||user.role==='LEAD_AUDITOR')return 'Global';
  if(user.role==='AUDITOR'){
    const active=user.annual_assignments.filter(item=>item.status==='Aktif');
    if(!active.length)return 'Belum ada assignment tahun';
    return active.map(item=>`${item.tahun} · ${item.team_kode}${item.is_team_leader?' · Team Leader':''}`).join(' | ');
  }
  const active=user.section_assignments.filter(item=>item.status==='Aktif');
  return active.length?active.map(item=>item.seksi_nama).join(', '):'Belum ada assignment seksi';
};

export function UserManagementPage(){
  const [users,setUsers]=useState<ManagedUser[]>([]),[plans,setPlans]=useState<AuditPlan[]>([]),[teams,setTeams]=useState<AuditTeamMaster[]>([]),[auditors,setAuditors]=useState<Auditor[]>([]),[sections,setSections]=useState<Seksi[]>([]);
  const [form,setForm]=useState<UserFormState|null>(null),[search,setSearch]=useState(''),[roleFilter,setRoleFilter]=useState('');
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[message,setMessage]=useState<string|null>(null);

  const load=useCallback(async()=>{
    setLoading(true);
    try{
      const [u,p,t,a,s]=await Promise.all([listManagedUsers(),getAuditPlans(),getAuditTeamMasters(),getActiveAuditors(),getSeksiList()]);
      setUsers(u);
      setPlans([...p].sort((x,y)=>y.tahun-x.tahun||y.no_revisi-x.no_revisi));
      setTeams(t);
      setAuditors(a);
      setSections(s.filter(section=>section.aktif));
      setError(null);
    }catch(e){setError(e instanceof Error?e.message:'Gagal memuat Manage User');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);

  const filtered=useMemo(()=>users.filter(user=>{
    const haystack=`${user.email??''} ${user.display_name??''} ${user.nik??''} ${user.role??''}`.toLowerCase();
    return (!search||haystack.includes(search.toLowerCase()))&&(!roleFilter||user.role===roleFilter);
  }),[users,search,roleFilter]);

  const auditorOptions:SearchOption[]=useMemo(()=>auditors.map(a=>({value:a.id,label:a.nama,searchText:`${a.nip??''} ${a.departemen??''}`,detail:`${a.nip??'-'} · ${a.departemen??'-'}`})),[auditors]);
  const sectionOptions:SearchOption[]=useMemo(()=>sections.map(s=>({value:s.id,label:s.nama,detail:s.kepala_seksi??'-'})),[sections]);

  const openNew=()=>setForm(emptyForm(plans[0]?.id??''));
  const openEdit=(user:ManagedUser)=>setForm(formFromUser(user,plans));

  async function save(){
    if(!form)return;
    setBusy(true);setError(null);setMessage(null);
    let provisioned=false;
    try{
      let userId=form.user_id;
      if(!userId){
        const result=await createManagedUser(form.email,form.display_name);
        userId=result.id;
        provisioned=true;
      }
      await saveManagedUserAccess({
        user_id:userId,
        display_name:form.display_name,
        nik:form.nik||null,
        role:form.role,
        status:form.status,
        auditor_id:(form.role==='AUDITOR'||form.role==='LEAD_AUDITOR')?(form.auditor_id||null):null,
        plan_id:form.role==='AUDITOR'?(form.plan_id||null):null,
        team_id:form.role==='AUDITOR'?(form.team_id||null):null,
        seksi_id:(form.role==='AUDITEE'||form.role==='SECTION_MANAGER')?(form.seksi_id||null):null,
      });
      setForm(null);
      await load();
      setMessage(provisioned?'User berhasil dibuat dan akses berhasil dikonfigurasi.':'Akses user berhasil diperbarui.');
    }catch(e){
      const text=e instanceof Error?e.message:'Gagal menyimpan user';
      setError(provisioned?`User Auth sudah dibuat, tetapi konfigurasi akses gagal. Buka user tersebut dari daftar lalu konfigurasi kembali. ${text}`:text);
      if(provisioned){await load();setForm(null);}
    }finally{setBusy(false);}
  }

  async function toggleAssignment(item:ManagedAnnualAssignment){
    setBusy(true);setError(null);setMessage(null);
    const next:IdentityStatus=item.status==='Aktif'?'Nonaktif':'Aktif';
    try{
      await setManagedAnnualAssignmentStatus(item.id,next);
      setForm(current=>current?{...current,annual_assignments:current.annual_assignments.map(row=>row.id===item.id?{...row,status:next}:row)}:current);
      await load();
      setMessage(`Assignment Auditor ${next.toLowerCase()}.`);
    }catch(e){setError(e instanceof Error?e.message:'Gagal mengubah assignment');}
    finally{setBusy(false);}
  }

  if(loading)return <LoadingSpinner message="Memuat Manage User..."/>;
  return <div>
    <div className="flex flex-wrap justify-between gap-3 mb-6">
      <div><h1 className="text-2xl font-bold">Manage User</h1><p className="text-sm text-gray-500">Kelola akun, role, seksi, dan assignment Auditor per Rencana Audit Tahunan.</p></div>
      <Button onClick={openNew}><Plus size={15}/> Tambah User</Button>
    </div>
    {error&&<div className="p-3 mb-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}
    {message&&<div className="p-3 mb-4 bg-green-50 text-green-700 rounded-lg">{message}</div>}
    <Card className="p-4 mb-4"><div className="grid md:grid-cols-2 gap-3"><Input placeholder="Cari email, nama, NIK, atau role" value={search} onChange={e=>setSearch(e.target.value)}/><Select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="">Semua Role</option>{MANAGE_USER_ROLES.map(role=><option key={role} value={role}>{MANAGE_USER_ROLE_LABEL[role]}</option>)}</Select></div></Card>
    {!filtered.length?<Card className="p-12"><EmptyState icon={<Users/>} title="Belum ada user" message="Tambah user baru atau periksa filter pencarian."/></Card>:<Card className="overflow-x-auto"><table className="min-w-[1100px] w-full text-sm"><thead><tr className="bg-gray-50 text-left">{['Email','Nama','NIK','Role','Status','Assignment / Scope','Auth','Aksi'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{filtered.map(user=><tr key={user.user_id} className="border-t"><td className="p-3">{user.email??'-'}</td><td>{user.display_name??<span className="text-amber-700">Belum dikonfigurasi</span>}</td><td>{user.nik??'-'}</td><td>{user.role?<Badge variant={user.role==='LEAD_AUDITOR'?'blue':'gray'}>{MANAGE_USER_ROLE_LABEL[user.role]}</Badge>:<Badge variant="amber">Unconfigured</Badge>}</td><td><Badge variant={user.status==='Aktif'?'green':'gray'}>{user.status??'-'}</Badge></td><td className="max-w-[360px] text-xs">{accessSummary(user)}</td><td><Badge variant="green">Terdaftar</Badge></td><td><button className="text-blue-600 inline-flex items-center gap-1" onClick={()=>openEdit(user)}><Pencil size={14}/> Edit</button></td></tr>)}</tbody></table></Card>}
    <Modal open={!!form} onClose={()=>!busy&&setForm(null)} title={form?.user_id?'Edit User':'Tambah User'} size="lg" footer={<><Button variant="secondary" disabled={busy} onClick={()=>setForm(null)}>Batal</Button><Button disabled={busy} onClick={()=>void save()}>{busy?'Memproses...':'Simpan'}</Button></>}>{form&&<UserForm form={form} plans={plans} teams={teams} auditorOptions={auditorOptions} sectionOptions={sectionOptions} busy={busy} onChange={setForm} onToggleAssignment={toggleAssignment}/>}</Modal>
  </div>;
}

function UserForm({form,plans,teams,auditorOptions,sectionOptions,busy,onChange,onToggleAssignment}:{form:UserFormState;plans:AuditPlan[];teams:AuditTeamMaster[];auditorOptions:SearchOption[];sectionOptions:SearchOption[];busy:boolean;onChange:(value:UserFormState)=>void;onToggleAssignment:(item:ManagedAnnualAssignment)=>void}){
  const auditorRole=form.role==='AUDITOR'||form.role==='LEAD_AUDITOR';
  const scopedRole=form.role==='AUDITEE'||form.role==='SECTION_MANAGER';
  const eligibleTeams=teams.filter(team=>team.plan_id===form.plan_id&&team.status==='Aktif'&&(!form.auditor_id||team.members.some(member=>member.auditor_id===form.auditor_id)));
  const selectedAuditorHasTeam=eligibleTeams.length>0;
  const updateRole=(role:ManageUserRole)=>onChange({...form,role,team_id:role==='AUDITOR'?form.team_id:'',seksi_id:scopedRole?form.seksi_id:'',plan_id:role==='AUDITOR'?(form.plan_id||plans[0]?.id||''):form.plan_id});
  return <div className="space-y-5">
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800 flex gap-2"><ShieldCheck size={16} className="shrink-0"/><span>Admin dan Lead Auditor adalah akses global. Auditor biasa wajib memiliki assignment per Rencana Audit Tahunan + Team Audit. Team Leader tetap ditentukan oleh roster di Kelola Tim Audit.</span></div>
    <div className="grid md:grid-cols-2 gap-3">
      <Field label="Email" required><Input type="email" disabled={!!form.user_id||busy} value={form.email} onChange={e=>onChange({...form,email:e.target.value})}/></Field>
      <Field label="Nama" required><Input disabled={busy} value={form.display_name} onChange={e=>onChange({...form,display_name:e.target.value})}/></Field>
      <Field label="NIK"><Input disabled={busy} value={form.nik} onChange={e=>onChange({...form,nik:e.target.value})}/></Field>
      <Field label="Status" required><Select disabled={busy} value={form.status} onChange={e=>onChange({...form,status:e.target.value as IdentityStatus})}><option value="Aktif">Aktif</option><option value="Nonaktif">Nonaktif</option></Select></Field>
      <Field label="Role" required><Select disabled={busy} value={form.role} onChange={e=>updateRole(e.target.value as ManageUserRole)}>{MANAGE_USER_ROLES.map(role=><option key={role} value={role}>{MANAGE_USER_ROLE_LABEL[role]}</option>)}</Select></Field>
    </div>

    {auditorRole&&<div className="space-y-3 border rounded-lg p-4"><h3 className="font-medium">Mapping Auditor</h3><Field label="Auditor Master" required><SearchableSelect disabled={busy} options={auditorOptions} value={form.auditor_id} onChange={value=>onChange({...form,auditor_id:value,team_id:''})} placeholder="Cari Auditor Master..."/></Field>
      {form.role==='LEAD_AUDITOR'?<p className="text-xs text-blue-700">Lead Auditor adalah authority perusahaan dan tidak memerlukan assignment per tahun/Team.</p>:<div className="grid md:grid-cols-2 gap-3"><Field label="Rencana Audit Tahunan" required><Select disabled={busy} value={form.plan_id} onChange={e=>onChange({...form,plan_id:e.target.value,team_id:''})}>{plans.map(plan=><option key={plan.id} value={plan.id}>{plan.tahun} — {plan.kode_dokumen}</option>)}</Select></Field><Field label="Team Audit" required><Select disabled={busy||!form.auditor_id} value={form.team_id} onChange={e=>onChange({...form,team_id:e.target.value})}><option value="">Pilih Team Audit</option>{eligibleTeams.map(team=>{const member=team.members.find(row=>row.auditor_id===form.auditor_id);return <option key={team.id} value={team.id}>{team.kode_tim} — {team.nama_tim}{member?.is_team_leader?' (Team Leader)':''}{team.is_locked?'':' · Draft'}</option>})}</Select></Field>{form.auditor_id&&!selectedAuditorHasTeam&&<p className="md:col-span-2 text-xs text-amber-700">Auditor ini belum terdaftar pada Team Audit aktif untuk Rencana Tahunan terpilih. Tambahkan ke Kelola Tim Audit terlebih dahulu.</p>}</div>}
    </div>}

    {scopedRole&&<div className="border rounded-lg p-4"><Field label="Seksi" required><SearchableSelect disabled={busy} options={sectionOptions} value={form.seksi_id} onChange={value=>onChange({...form,seksi_id:value})} placeholder="Cari seksi..."/></Field></div>}

    {form.role==='AUDITOR'&&form.user_id&&form.annual_assignments.length>0&&<div className="border rounded-lg p-4"><h3 className="font-medium mb-3">Riwayat Assignment Auditor</h3><div className="space-y-2">{form.annual_assignments.map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 bg-gray-50 rounded p-2 text-sm"><span>{item.tahun} · {item.team_kode} — {item.team_nama}{item.is_team_leader?' · Team Leader':''}</span><span className="flex items-center gap-2"><Badge variant={item.status==='Aktif'?'green':'gray'}>{item.status}</Badge><button disabled={busy} className="text-xs text-blue-600 disabled:text-gray-400" onClick={()=>onToggleAssignment(item)}>{item.status==='Aktif'?'Nonaktifkan':'Aktifkan'}</button></span></div>)}</div></div>}
  </div>;
}
