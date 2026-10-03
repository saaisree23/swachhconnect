/* Live mode: Supabase Auth + Postgres (RLS) + Realtime. Falls back to local demo mode when config.js is empty. */
(()=>{const C=window.SC_CONFIG||{};
if(!C.url||!C.anon||!window.supabase){document.body.insertAdjacentHTML('afterbegin','<p class="demo-b">Demo mode: data stays in this browser. Add your Supabase keys to config.js for the live multi-user version.</p>');return}
const sb=window.SC_SB=supabase.createClient(C.url,C.anon),B=document.body;let me,prof,chain=Promise.resolve(),LAST={},LW={},first=1,lc,lt=0,tt;
B.dataset.live=1;S={nid:0,n:1,c:[],w:[],notes:[],act:[]};load=()=>S;
NID=()=>(Date.now().toString(36).slice(-5)+Math.floor(Math.random()*36).toString(36)).toUpperCase();
const isOp=()=>['operator','admin'].includes(prof.role);
const toRow=c=>({id:c.id,citizen_id:c.cid||(c.me?me.id:null),status:c.st,priority:c.pri,ward:c.ward,assigned_worker:c.w||null,data:c});
const fromRow=r=>({...r.data,id:r.id,st:r.status,pri:r.priority,ward:r.ward,w:r.assigned_worker,cid:r.citizen_id,me:r.citizen_id==me.id});
const push=async()=>{for(const c of S.c){const r=toRow(c),j=JSON.stringify(r),had=c.id in LAST;if(LAST[c.id]===j)continue;LAST[c.id]=j;const{id,citizen_id,...u}=r,{error}=await(had?sb.from('complaints').update(u).eq('id',id):sb.from('complaints').insert(r));if(error){delete LAST[c.id];S.notes.push({id:++S.nid,to:U.wid,m:'⚠️ Could not save the change. Please try again.'})}}
 if(['worker','admin'].includes(prof.role))for(const w of S.w){const j=''+w.duty+w.mode;if(LW[w.id]!==j){LW[w.id]=j;await sb.from('workers').update({duty:!!w.duty,mode:w.mode||null}).eq('id',w.id)}}};
save=()=>{chain=chain.then(push).catch(()=>{})};
log=m=>{sb.from('activity').insert({msg:m}).then(()=>{})};
const add=(to,m)=>S.notes.push({id:++S.nid,to,m});
const diff=prev=>S.c.forEach(c=>{const o=prev[c.id],s=ST[c.st];
 if(!o&&isOp())add('op',`🔴 NEW ${c.pri} complaint — Ward ${c.ward}: ${c.cat}`);
 if(o&&o.st!=c.st){if(c.me)add('cit',`${s[0]} ${c.id}: ${s[1]}`);if(isOp())add('op',`${s[0]} ${c.id} ${s[1]}`)}
 if(c.w&&c.w==U.wid&&c.st=='ASSIGNED'&&(!o||o.w!=c.w))add(c.w,`🆕 NEW ${c.pri} TASK — Ward ${c.ward}: ${c.cat}`)});
const pull=async()=>{const[a,b,d]=await Promise.all([sb.from('complaints').select('*').order('updated_at'),sb.from('workers').select('*'),sb.from('activity').select('*').order('id',{ascending:false}).limit(14)]);
 const prev=Object.fromEntries(S.c.map(c=>[c.id,c]));S.c=(a.data||[]).map(fromRow);S.w=(b.data||[]).map(x=>({id:x.id,n:x.name,v:x.vehicle,duty:x.duty?1:0,mode:x.mode||''}));S.act=(d.data||[]).map(x=>[Date.parse(x.created_at),x.msg]);
 S.c.forEach(c=>LAST[c.id]=JSON.stringify(toRow(c)));S.w.forEach(w=>LW[w.id]=''+w.duty+w.mode);if(!first)diff(prev);first=0;R()};
const sched=()=>{clearTimeout(tt);tt=setTimeout(()=>{chain=chain.then(pull).catch(()=>{})},150)};
const G=document.createElement('div');G.id='gate';
G.innerHTML='<div class="gc"><h2>🌱 SwachhConnect</h2><p class="m">Sign in to report, collect or manage waste.</p><input id="ge" type="email" placeholder="Email" autocomplete="email" aria-label="Email"><input id="gp" type="password" placeholder="Password (min 6 characters)" autocomplete="current-password" aria-label="Password"><p id="gx" role="alert"></p><button class="btn" id="gi">Sign in</button><button class="btn sec" id="gs">Create citizen account</button></div>';
B.append(G);const gx=t=>$('#gx').textContent=t,cred=()=>({email:$('#ge').value.trim(),password:$('#gp').value});
$('#gi').onclick=async()=>{const{data,error}=await sb.auth.signInWithPassword(cred());error?gx('Could not sign in. Check your email and password.'):boot(data.session)};
$('#gs').onclick=async()=>{const{data,error}=await sb.auth.signUp(cred());error?gx('Could not create the account. Use a valid email and a 6+ character password.'):data.session?boot(data.session):gx('Account created. Confirm your email, then sign in.')};
let booted=0;
async function boot(s){if(booted)return;booted=1;me=s.user;const{data}=await sb.from('profiles').select('*').eq('id',me.id).single();prof=data||{role:'citizen'};
 const V={citizen:'cit',worker:'wk',operator:'op',admin:'op'}[prof.role]||'cit';B.dataset.v=V;B.dataset.role=prof.role;const ov=A.view;A.view=v=>{if(v=='home'||(prof.role!='admin'&&v!=V))return;ov(v)};if(prof.worker_key)U.wid=prof.worker_key;
 const t=$('.tabs');if(prof.role!='admin')t.innerHTML='';else{t.querySelector('[data-v=home]').remove();t.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v==V))}
 const so=document.createElement('button');so.className='chip';so.textContent='Sign out';so.onclick=async()=>{await sb.auth.signOut();location.reload()};t.append(so);t.style.display='flex';
 await pull();if(prof.role=='worker'&&prof.worker_key){await sb.from('workers').update({duty:false}).eq('id',prof.worker_key);const w=S.w.find(x=>x.id==prof.worker_key);if(w)w.duty=0;R()}
 sb.channel('db').on('postgres_changes',{event:'*',schema:'public',table:'complaints'},sched).on('postgres_changes',{event:'*',schema:'public',table:'workers'},sched).on('postgres_changes',{event:'INSERT',schema:'public',table:'activity'},sched).subscribe();
 lc=sb.channel('loc',{config:{private:true,broadcast:{self:false}}}).on('broadcast',{event:'loc'},({payload})=>{if(isOp())ploc(payload)}).subscribe();
 BLOC=m=>{if(prof.role=='citizen')return;lc.send({type:'broadcast',event:'loc',payload:m});if(Date.now()-lt>3e4){lt=Date.now();sb.from('vehicle_locations').insert({vehicle:m.id,x:m.x,y:m.y,speed:m.sp||0,mode:m.mode}).then(()=>{})}};
 G.remove()}
sb.auth.getSession().then(({data})=>data.session&&boot(data.session))})();
