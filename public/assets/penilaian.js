(function(){
"use strict";
const {$,esc,fmt,pad,initials,icons}=MC;
const CRITERIA=[
  {key:"articulation",label:"Artikulasi",max:20},
  {key:"intonation",label:"Intonasi dan volume",max:20},
  {key:"fluency",label:"Kelancaran",max:20},
  {key:"expression",label:"Ekspresi dan penghayatan",max:15},
  {key:"confidence",label:"Kepercayaan diri",max:15},
  {key:"body_language",label:"Sikap dan bahasa tubuh",max:10}
];
const S={data:null,stages:[],stage:2,j1:null,j2:null,p:null,activeJudge:null,draft:{},tab:"preset",listMode:"presets",q:""};

$("backLink").innerHTML=icons.back+"<span>Leaderboard</span>";
$("addStageBtn").innerHTML=icons.plus+"<span>Tambah tahap</span>";

/* ---------- tabs ---------- */
function moveInd(){
  const t=$("tabs"),b=t.querySelector('[aria-selected="true"]'),ind=t.querySelector(".ind");
  if(b&&ind){ind.style.width=b.offsetWidth+"px";ind.style.transform=`translateX(${b.offsetLeft-5}px)`;}
}
function showTab(name){
  S.tab=name;
  document.querySelectorAll("#tabs [data-tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===name)));
  ["preset","nilai","daftar"].forEach(n=>{const p=$("panel-"+n);const on=n===name;
    if(on&&p.hidden){p.hidden=false;p.style.animation="none";void p.offsetWidth;p.style.animation="";}else p.hidden=!on;});
  moveInd();
  if(name==="nilai")renderScore();if(name==="daftar")renderList();
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("#tabs [data-tab]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.tab)));
window.addEventListener("resize",moveInd);

/* ---------- picker ---------- */
function pickerHtml(kind){
  const d=S.data;let list,sel;
  if(kind==="p"){list=d.participants.filter(p=>Number(p.stage||1)===S.stage).map(p=>({id:p.id,t:`${pad(p.id)} · ${p.name}`,s:`Kelas ${p.kelas}`,av:pad(p.id),k:`${p.id} ${p.name} ${p.kelas}`}));sel=S.p&&S.p.id;}
  else{list=d.judges.map(j=>({id:j.id,t:j.name,s:"Penguji",av:initials(j.name),k:j.name}));sel=(kind==="j1"?S.j1:S.j2)?.id;}
  return {list,sel};
}
function openPicker(kind){
  const title=kind==="p"?"Pilih peserta":kind==="j1"?"Pilih Penguji 1":"Pilih Penguji 2";
  const d=document.createElement("dialog");d.className="mc sheetmode";
  d.innerHTML=`<div class="dlg wide" style="position:relative"><div class="sheet-top"><h2>${title}</h2><div class="search"><span></span><input type="search" placeholder="${kind==="p"?"Cari nama, nomor, atau kelas":"Cari nama penguji"}" autocomplete="off"></div></div><div class="sheet-list"></div><button type="button" class="close-x" aria-label="Tutup">×</button></div>`;
  d.querySelector(".search span").outerHTML=icons.search;
  document.body.appendChild(d);
  const inp=d.querySelector("input"),box=d.querySelector(".sheet-list");
  const draw=()=>{
    const {list,sel}=pickerHtml(kind),q=inp.value.trim().toLowerCase();
    const f=list.filter(x=>!q||x.k.toLowerCase().includes(q));
    box.innerHTML=f.length?f.map(x=>`<button type="button" class="pick-item" data-id="${x.id}"><span class="av">${esc(x.av)}</span><span><b>${esc(x.t)}</b><small>${esc(x.s)}</small></span>${String(x.id)===String(sel)?'<span class="tick">✓</span>':""}</button>`).join(""):`<div class="empty"><b>${q?"Tidak ada hasil":kind==="p"?"Belum ada peserta di tahap ini":"Belum ada penguji"}</b>${q?"Coba kata kunci lain.":kind==="p"?"Isi dari leaderboard tahap lain atau dari PDF / teks.":"Tambahkan penguji ke tabel judges di Supabase."}${!q&&kind==="p"?'<br><button type="button" class="btn primary" data-imp>Isi peserta tahap ini</button>':""}</div>`;
  };
  inp.addEventListener("input",draw);
  box.addEventListener("click",e=>{if(e.target.closest("[data-imp]")){d.close();doImport();return;}const b=e.target.closest("[data-id]");if(!b)return;choose(kind,b.dataset.id);d.close();});
  d.querySelector(".close-x").addEventListener("click",()=>d.close());
  d.addEventListener("click",e=>{if(e.target===d)d.close();});
  d.addEventListener("close",()=>d.remove());
  draw();d.showModal();setTimeout(()=>inp.focus(),60);
}
function choose(kind,id){
  const d=S.data;
  if(kind==="p"){
    S.p=d.participants.find(x=>String(x.id)===String(id));
    const pr=d.presets.find(x=>String(x.participant_id)===String(id));
    if(pr){S.j1=d.judges.find(j=>String(j.id)===String(pr.judge1_id))||S.j1;S.j2=d.judges.find(j=>String(j.id)===String(pr.judge2_id))||S.j2;MC.toast("Preset peserta ini dimuat. Ubah bila perlu.");}
  }else{
    const j=d.judges.find(x=>String(x.id)===String(id)),other=kind==="j1"?S.j2:S.j1;
    if(other&&other.id===j.id){setMsg("Penguji 1 dan Penguji 2 harus berbeda.","error");return;}
    if(kind==="j1")S.j1=j;else S.j2=j;
  }
  setMsg("");paintPicks();
}
function paintPick(btn,item,empty,hint){
  btn.className="pick"+(item?" filled":"");
  btn.innerHTML=`<span class="av">${item?esc(item.av):icons.user}</span><span><b>${esc(item?item.t:empty)}</b><small>${esc(item?item.s:hint)}</small></span><span class="chev">${icons.chev}</span>`;
}
function paintPicks(){
  paintPick($("pickJ1"),S.j1&&{av:initials(S.j1.name),t:S.j1.name,s:"Penguji 1"},"Pilih penguji pertama","Ketuk untuk mencari nama");
  paintPick($("pickJ2"),S.j2&&{av:initials(S.j2.name),t:S.j2.name,s:"Penguji 2"},"Pilih penguji kedua","Harus berbeda dari penguji pertama");
  paintPick($("pickP"),S.p&&{av:pad(S.p.id),t:S.p.name,s:"Kelas "+S.p.kelas},"Pilih peserta","Peserta untuk tahap ini");
}
function setMsg(t,k=""){const m=$("presetMsg");m.textContent=t;m.className="msg-line "+k;}
$("pickJ1").addEventListener("click",()=>openPicker("j1"));
$("pickJ2").addEventListener("click",()=>openPicker("j2"));
$("pickP").addEventListener("click",()=>openPicker("p"));
$("togglePw").addEventListener("click",()=>{const i=$("pw"),show=i.type==="password";i.type=show?"text":"password";$("togglePw").textContent=show?"Sembunyi":"Lihat";});

async function savePreset(){
  setMsg("");
  if(!MC.sb)return setMsg("Supabase belum terhubung.","error");
  if(!S.j1||!S.j2||!S.p)return setMsg("Pilih kedua penguji dan peserta terlebih dahulu.","error");
  if(S.j1.id===S.j2.id)return setMsg("Pilih dua penguji yang berbeda.","error");
  if($("pw").value!==PRESET_PASSWORD){setMsg("Password preset salah.","error");$("pw").focus();return;}
  const btn=$("savePreset");btn.disabled=true;btn.innerHTML='<span class="spin"></span> Menyimpan';
  try{
    const {error}=await MC.sb.from("presets").upsert({participant_id:S.p.id,judge1_id:S.j1.id,judge2_id:S.j2.id,password_verified:true},{onConflict:"participant_id"});
    if(error)throw error;
    await reload();
    MC.toast("Preset tersimpan. Lanjut isi nilai.");
    S.activeJudge=null;S.draft={};showTab("nilai");
  }catch(e){setMsg("Gagal menyimpan preset: "+e.message+". Pastikan tabel presets sudah dibuat lewat SQL setup.","error");}
  finally{btn.disabled=false;btn.textContent="Simpan preset";}
}
$("savePreset").addEventListener("click",savePreset);

/* ---------- penilaian ---------- */
const scoreOf=(pid,jid)=>S.data.scores.find(s=>String(s.participant_id)===String(pid)&&String(s.judge_id)===String(jid)&&Number(s.stage||1)===S.stage);
async function fetchFullScore(pid,jid){
  const {data,error}=await MC.sb.from("scores").select("*").eq("participant_id",pid).eq("judge_id",jid).eq("stage",S.stage).maybeSingle();
  if(error)throw error;return data;
}
function renderScore(){
  const el=$("panel-nilai");
  if(!S.p||!S.j1||!S.j2){
    el.innerHTML=`<div class="card"><div class="empty"><b>Belum ada peserta yang dipilih</b>Buat preset terlebih dahulu, atau tekan <b style="display:inline">Mulai menilai</b> dari tab Daftar.</div><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button class="btn primary" data-go="preset">Buat preset</button><button class="btn" data-go="daftar">Buka daftar</button></div></div>`;
    el.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>showTab(b.dataset.go)));return;
  }
  const a=scoreOf(S.p.id,S.j1.id),b=scoreOf(S.p.id,S.j2.id);
  const avg=a&&b?(Number(a.total)+Number(b.total))/2:null;
  const jb=(j,n,sc)=>`<button type="button" class="jbtn" data-j="${j.id}" aria-pressed="${String(S.activeJudge)===String(j.id)}"><small>Penguji ${n}</small><b>${esc(j.name)}</b><span class="st ${sc?"done":""}">${sc?"Sudah menilai · "+sc.total+"/100":"Belum menilai"}</span></button>`;
  el.innerHTML=`
  <div class="card">
    <div class="ctx"><div class="av">${pad(S.p.id)}</div><div><b>${esc(S.p.name)}</b><small>Kelas ${esc(S.p.kelas)} · Tahap ${S.stage} ${esc(MC.stageName(S.data.stages,S.stage))}</small></div></div>
    <div class="sumgrid">
      <div class="sumbox"><small>${esc(S.j1.name)}</small><b class="num">${a?a.total:"—"}</b></div>
      <div class="sumbox"><small>${esc(S.j2.name)}</small><b class="num">${b?b.total:"—"}</b></div>
      <div class="sumbox hl"><small>${avg!=null?MC.category(avg):"Menunggu dua nilai"}</small><b class="num">${avg!=null?fmt(avg):"—"}</b></div>
    </div>
  </div>
  <div class="card">
    <h2>Formulir penilaian</h2>
    <p class="lead">Pilih penguji yang sedang menilai, lalu atur skor tiap kriteria.</p>
    <div class="judgepick">${jb(S.j1,1,a)}${jb(S.j2,2,b)}</div>
    <div id="critBox"></div>
    <div class="totalbar"><div class="tt"><b class="num" id="totalVal">0/100</b><small id="totalCat">Perlu ditingkatkan</small></div><button type="button" class="btn gold" id="saveScore">Simpan nilai</button></div>
    <div class="msg-line" id="scoreMsg" role="status" aria-live="polite"></div>
  </div>`;
  el.querySelectorAll(".jbtn").forEach(x=>x.addEventListener("click",()=>pickJudge(x.dataset.j)));
  buildCriteria();
  if(S.activeJudge)loadDraft();else setScoreMsg("Pilih penguji yang sedang menilai.");
}
function setScoreMsg(t,k=""){const m=$("scoreMsg");if(m){m.textContent=t;m.className="msg-line "+k;}}
function buildCriteria(){
  $("critBox").innerHTML=CRITERIA.map((c,i)=>`<div class="crit"><div class="crit-top"><b>${i+1}. ${c.label}</b><span>Maks. ${c.max}</span></div><div class="crit-ctl"><button type="button" class="step" data-k="${c.key}" data-d="-1" aria-label="Kurangi ${c.label}">−</button><input type="range" id="c_${c.key}" min="0" max="${c.max}" step="1" value="0" aria-label="${c.label}"><button type="button" class="step" data-k="${c.key}" data-d="1" aria-label="Tambah ${c.label}">+</button><span class="crit-val num" id="v_${c.key}">0</span></div></div>`).join("");
  CRITERIA.forEach(c=>$("c_"+c.key).addEventListener("input",updateTotal));
  $("critBox").querySelectorAll(".step").forEach(b=>b.addEventListener("click",()=>{const r=$("c_"+b.dataset.k);r.value=Math.min(+r.max,Math.max(0,+r.value+Number(b.dataset.d)));updateTotal();}));
  $("saveScore").addEventListener("click",saveScore);
}
function updateTotal(){
  let t=0;CRITERIA.forEach(c=>{const r=$("c_"+c.key),v=+r.value;t+=v;$("v_"+c.key).textContent=v;r.style.setProperty("--p",(v/c.max*100)+"%");S.draft[c.key]=v;});
  $("totalVal").textContent=t+"/100";$("totalCat").textContent=MC.category(t);
}
async function pickJudge(id){
  S.activeJudge=id;S.draft={};
  document.querySelectorAll(".jbtn").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.j===String(id))));
  await loadDraft();
}
async function loadDraft(){
  setScoreMsg("Memuat nilai…");
  try{
    const row=await fetchFullScore(S.p.id,Number(S.activeJudge));
    CRITERIA.forEach(c=>{$("c_"+c.key).value=row?row[c.key]:0;});updateTotal();
    setScoreMsg(row?"Nilai tersimpan sebelumnya dimuat. Simpan untuk memperbarui.":"Belum ada nilai dari penguji ini.");
  }catch(e){CRITERIA.forEach(c=>$("c_"+c.key).value=0);updateTotal();setScoreMsg("Gagal memuat nilai sebelumnya: "+e.message,"error");}
}
async function saveScore(){
  const jid=Number(S.activeJudge);
  if(!jid){setScoreMsg("Pilih penguji yang sedang menilai terlebih dahulu.","error");return;}
  const btn=$("saveScore");btn.disabled=true;btn.innerHTML='<span class="spin"></span> Menyimpan';
  const row={participant_id:S.p.id,judge_id:jid,stage:S.stage};
  CRITERIA.forEach(c=>row[c.key]=Number($("c_"+c.key).value));
  row.total=CRITERIA.reduce((s,c)=>s+row[c.key],0);row.updated_at=new Date().toISOString();
  try{
    const {error}=await MC.sb.from("scores").upsert(row,{onConflict:"participant_id,judge_id,stage"});
    if(error)throw error;
    await reload();MC.toast("Nilai berhasil disimpan.");
    const keep=S.activeJudge;renderScore();S.activeJudge=keep;
    document.querySelectorAll(".jbtn").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.j===String(keep))));
    await loadDraft();
  }catch(e){setScoreMsg("Gagal menyimpan nilai: "+e.message+". Pastikan supabase_fix_scores.sql sudah dijalankan.","error");btn.disabled=false;btn.textContent="Simpan nilai";}
}

/* ---------- daftar ---------- */
function records(){
  const d=S.data,byId=new Map(d.participants.map(p=>[String(p.id),p])),jb=new Map(d.judges.map(j=>[String(j.id),j]));
  const inStage=pid=>{const p=byId.get(String(pid));return p&&Number(p.stage||1)===S.stage;};
  const sc=pid=>d.scores.filter(s=>String(s.participant_id)===String(pid)&&Number(s.stage||1)===S.stage);
  let out;
  if(S.listMode==="presets"){
    out=d.presets.filter(p=>inStage(p.participant_id)).map(p=>{const s=sc(p.participant_id);
      return {kind:"preset",id:p.id,pid:p.participant_id,person:byId.get(String(p.participant_id)),j1:jb.get(String(p.judge1_id)),j2:jb.get(String(p.judge2_id)),a:s.find(x=>String(x.judge_id)===String(p.judge1_id)),b:s.find(x=>String(x.judge_id)===String(p.judge2_id))};});
  }else{
    const ids=[...new Set(d.scores.filter(s=>Number(s.stage||1)===S.stage).map(s=>String(s.participant_id)))];
    out=ids.map(id=>{const pr=d.presets.find(p=>String(p.participant_id)===id),s=sc(id);
      const a=pr?s.find(x=>String(x.judge_id)===String(pr.judge1_id)):s[0];
      const b=pr?s.find(x=>String(x.judge_id)===String(pr.judge2_id)):s.find(x=>String(x.judge_id)!==String(a&&a.judge_id));
      return {kind:"scores",pid:Number(id),person:byId.get(id),j1:pr?jb.get(String(pr.judge1_id)):jb.get(String(a&&a.judge_id)),j2:pr?jb.get(String(pr.judge2_id)):jb.get(String(b&&b.judge_id)),a,b,hasPreset:!!pr};});
    out.sort((x,y)=>x.pid-y.pid);
  }
  const q=S.q;
  return out.filter(r=>!q||[r.pid,r.person&&r.person.name,r.person&&r.person.kelas,r.j1&&r.j1.name,r.j2&&r.j2.name].join(" ").toLowerCase().includes(q));
}
const BACKUP_SCORES=[
 {participant:"Muhammad Nazril Ilham",j1:"febrian",j2:"geofani",a:72,b:75},
 {participant:"Djazirah Fitriani",j1:"salsabila",j2:"dona",a:78,b:79},
 {participant:"Deswita Putri Wulandari",j1:"salsabila",j2:"trania",a:89,b:90},
 {participant:"Charisya Saskia Ananda",j1:"salsadira",j2:"trania",a:80,b:75},
 {participant:"Aoura Esmeralda",j1:"alvino",j2:"dona",a:77,b:74},
 {participant:"Wahyu Putri Anggraeni",j1:"geofani",j2:"trania",a:78,b:89},
 {participant:"Sifania Monica Sesilia",j1:"dira",j2:"trania",a:80,b:82},
 {participant:"Rara Dwi Novianti",j1:"dira",j2:"trania",a:83,b:87},
 {participant:"Iloh Selviani",j1:"salsabil",j2:"trania",a:80,b:82},
 {participant:"andika",j1:"febrian",j2:"geofani",a:75,b:75},
 {participant:"sagita",j1:"trania",j2:"salsadira",a:79,b:82},
 {participant:"Alfin Paskal Bussy",j1:"alvino",j2:"dona",a:87,b:81}
];
function backupCriteria(total){const max=CRITERIA.map(c=>c.max),sum=max.reduce((a,b)=>a+b,0);const vals=max.map(m=>Math.floor(total*m/sum));let rem=total-vals.reduce((a,b)=>a+b,0);for(let i=0;rem>0;i=(i+1)%vals.length){if(vals[i]<max[i]){vals[i]++;rem--;}}return Object.fromEntries(CRITERIA.map((c,i)=>[c.key,vals[i]]));}
async function restoreBackupScores(){
 if(S.stage!==2)return MC.toast("Pilih Tahap 2 · Tes MC untuk memulihkan backup.","err");
 const ok=await MC.askPassword("Pulihkan backup nilai","Akan memulihkan 12 peserta dari catatan backup. Nilai yang sudah ada tidak ditimpa. Masukkan password preset untuk lanjut.");
 if(!ok)return;
 const btn=$("panel-daftar").querySelector("[data-restore-backup]");if(btn){btn.disabled=true;btn.textContent="Memulihkan…";}
 try{
  const normalize=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("id").replace(/\s+/g," ");
  const findJudge=name=>{const key=normalize(name);const exact=S.data.judges.find(j=>normalize(j.name)===key);if(exact)return exact;const aliases={"salsabil":"salsabila"};return aliases[key]?S.data.judges.find(j=>normalize(j.name)===aliases[key]):null;};
  const findParticipant=name=>S.data.participants.find(p=>Number(p.stage||1)===2&&normalize(p.name)===normalize(name));
  const report={inserted:0,skipped:0,missing:[],errors:[]};
  for(const item of BACKUP_SCORES){
   const p=findParticipant(item.participant),j1=findJudge(item.j1),j2=findJudge(item.j2);
   if(!p){report.missing.push("Peserta: "+item.participant);continue;}
   if(!j1||!j2){if(!j1)report.missing.push("Penguji: "+item.j1);if(!j2)report.missing.push("Penguji: "+item.j2);continue;}
   for(const [judge,total] of [[j1,item.a],[j2,item.b]]){
    const existing=S.data.scores.find(s=>String(s.participant_id)===String(p.id)&&String(s.judge_id)===String(judge.id)&&Number(s.stage||1)===2);
    if(existing){report.skipped++;continue;}
    const row={participant_id:p.id,judge_id:judge.id,stage:2,...backupCriteria(total),total,updated_at:new Date().toISOString()};
    const {error}=await MC.sb.from("scores").insert(row);
    if(error){report.errors.push(p.name+" / "+judge.name+": "+error.message);continue;}
    report.inserted++;
   }
  }
  await reload();
  const lines=[report.inserted+" nilai berhasil dipulihkan.",report.skipped+" nilai yang sudah ada dilewati (tidak ditimpa).",report.missing.length?"Data belum cocok:\n"+[...new Set(report.missing)].join("\n"):"",report.errors.length?"Gagal menyimpan:\n"+report.errors.join("\n"):""].filter(Boolean);
  await MC.dialog({title:report.errors.length||report.missing.length?"Pemulihan sebagian selesai":"Backup berhasil dipulihkan",message:lines.join("\n\n"),confirm:"Tutup"});
 }catch(e){MC.toast("Pemulihan gagal: "+e.message,"err",7000);}
 finally{if(btn){btn.disabled=false;btn.innerHTML="↻ Pulihkan backup nilai";}}
}

function renderList(){
  const el=$("panel-daftar");if(!S.data)return;
  const d=S.data,stagePresets=d.presets.filter(p=>{const x=d.participants.find(y=>String(y.id)===String(p.participant_id));return x&&Number(x.stage||1)===S.stage;}).length;
  const scored=new Set(d.scores.filter(s=>Number(s.stage||1)===S.stage).map(s=>String(s.participant_id))).size;
  const list=records();
  const cards=list.length?list.map(r=>{
    const name=r.person?r.person.name:"Peserta "+r.pid,complete=!!(r.a&&r.b),part=!!(r.a||r.b);
    const avg=complete?(Number(r.a.total)+Number(r.b.total))/2:null;
    const badge=complete?`<span class="badge done">Selesai · ${fmt(avg)}</span>`:part?'<span class="badge part">Sebagian dinilai</span>':'<span class="badge">Belum dinilai</span>';
    const canStart=S.listMode==="presets"||r.hasPreset;
    return `<div class="rec"><div class="rec-top"><div><b>${pad(r.pid)} · ${esc(name)}</b><small>Kelas ${esc(r.person?r.person.kelas:"—")}</small></div>${badge}</div>
    <div class="rec-meta">Penguji 1: <span>${esc(r.j1?r.j1.name:"—")}</span> · ${r.a?r.a.total+"/100":"belum menilai"}<br>Penguji 2: <span>${esc(r.j2?r.j2.name:"—")}</span> · ${r.b?r.b.total+"/100":"belum menilai"}</div>
    <div class="rec-act"><button type="button" class="btn sm" data-rename="${r.pid}" data-name="${esc(name)}">Ubah nama</button>${canStart?`<button type="button" class="btn primary sm" data-start="${r.pid}">Mulai menilai</button>`:""}<button type="button" class="btn danger sm" data-del="${r.kind}" data-id="${r.kind==="preset"?r.id:r.pid}" data-pid="${r.pid}">${r.kind==="preset"?"Hapus preset":"Hapus nilai tahap "+S.stage}</button></div></div>`;
  }).join(""):`<div class="empty"><b>${S.q?"Tidak ada hasil":S.listMode==="presets"?"Belum ada preset di tahap ini":"Belum ada nilai di tahap ini"}</b>${S.q?"Coba kata kunci lain.":S.listMode==="presets"?"Buat preset pertama di tab Preset.":"Nilai muncul setelah penguji menyimpan skor."}</div>`;
  const pc=d.participants.filter(p=>Number(p.stage||1)===S.stage).length;
  el.innerHTML=`<div class="card"><div class="rec-top" style="align-items:center;margin-bottom:14px"><div><b>Peserta Tahap ${S.stage}</b><small style="display:block;color:var(--muted);font-size:12.5px">${pc} peserta terdaftar</small></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn sm" data-restore-backup>↻ Pulihkan backup nilai</button><button type="button" class="btn sm" data-imp>${icons.plus}<span>Impor peserta</span></button></div></div><div class="seg" role="tablist"><button type="button" role="tab" data-m="presets" aria-selected="${S.listMode==="presets"}">Preset <span class="num">${stagePresets}</span></button><button type="button" role="tab" data-m="scores" aria-selected="${S.listMode==="scores"}">Sudah dinilai <span class="num">${scored}</span></button></div>
  <div class="search" style="margin-bottom:6px">${icons.search}<input id="rq" type="search" placeholder="Cari peserta, penguji, nomor, atau kelas" value="${esc(S.q)}" autocomplete="off"></div>${cards}</div>`;
  el.querySelector("[data-imp]").addEventListener("click",doImport);
  const restoreBtn=el.querySelector("[data-restore-backup]");if(restoreBtn)restoreBtn.addEventListener("click",restoreBackupScores);
  el.querySelectorAll("[data-m]").forEach(b=>b.addEventListener("click",()=>{S.listMode=b.dataset.m;renderList();}));
  const rq=$("rq");rq.addEventListener("input",e=>{S.q=e.target.value.trim().toLowerCase();const pos=e.target.selectionStart;renderList();const n=$("rq");n.focus();n.setSelectionRange(pos,pos);});
  el.querySelectorAll("[data-start]").forEach(b=>b.addEventListener("click",()=>startScoring(Number(b.dataset.start))));
  el.querySelectorAll("[data-rename]").forEach(b=>b.addEventListener("click",()=>renameParticipant(b)));
  el.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",()=>del(b)));
  $("cntList").textContent=stagePresets;
}
function startScoring(pid){
  const d=S.data,pr=d.presets.find(p=>Number(p.participant_id)===pid);
  if(!pr)return MC.toast("Preset peserta ini belum dibuat.","err");
  S.p=d.participants.find(p=>Number(p.id)===pid);S.j1=d.judges.find(j=>String(j.id)===String(pr.judge1_id));S.j2=d.judges.find(j=>String(j.id)===String(pr.judge2_id));
  if(!S.p||!S.j1||!S.j2)return MC.toast("Data peserta atau penguji tidak ditemukan.","err");
  S.activeJudge=null;S.draft={};paintPicks();showTab("nilai");
}
async function renameParticipant(btn){
  const pid=btn.dataset.rename;const current=S.data.participants.find(p=>String(p.id)===String(pid));if(!current)return MC.toast("Data peserta tidak ditemukan.","err");
  const v=await MC.dialog({title:"Ubah nama peserta",message:"Nama baru akan diperbarui di seluruh halaman tanpa menghapus nilai atau preset peserta.",confirm:"Simpan nama",fields:[{name:"name",label:"Nama lengkap peserta",value:current.name,placeholder:"Masukkan nama lengkap"} ,{name:"pw",label:"Password preset",type:"password",autocomplete:"current-password"}],validate:v=>{if(!v.name.trim())return "Nama peserta tidak boleh kosong.";if(v.pw!==PRESET_PASSWORD)return "Password salah.";return "";}});
  if(!v)return;const name=v.name.trim().replace(/\s+/g," ");if(name===current.name)return MC.toast("Nama tidak berubah.");btn.disabled=true;
  try{const {data,error}=await MC.sb.from("participants").update({name}).eq("id",current.id).select("id,name,kelas,stage,test_score,status").maybeSingle();if(error)throw error;if(!data)throw Error("Database tidak mengizinkan perubahan nama. Periksa izin UPDATE/RLS tabel participants.");const i=S.data.participants.findIndex(p=>String(p.id)===String(current.id));if(i>=0)S.data.participants[i]={...S.data.participants[i],...data};if(S.p&&String(S.p.id)===String(current.id))S.p={...S.p,...data};renderList();paintPicks();MC.toast("Nama peserta berhasil diperbarui.");}catch(e){btn.disabled=false;MC.toast("Gagal mengubah nama: "+e.message,"err",6000);}
}

async function del(btn){
  const kind=btn.dataset.del,id=btn.dataset.id,pid=btn.dataset.pid;
  const what=kind==="preset"?"preset peserta ini":`semua nilai peserta ini pada Tahap ${S.stage}`;
  const ok=await MC.askPassword("Hapus data?",`Anda akan menghapus ${what}. Tindakan ini tidak bisa dibatalkan. Masukkan password preset untuk melanjutkan.`);
  if(!ok)return;
  btn.disabled=true;
  try{
    let r;
    if(kind==="preset")r=await MC.sb.from("presets").delete().eq("id",id).select("id");
    else r=await MC.sb.from("scores").delete().eq("participant_id",pid).eq("stage",S.stage).select("participant_id");
    if(r.error)throw r.error;
    if(!r.data||!r.data.length)throw new Error("Database menolak penghapusan (jalankan supabase_fix_delete.sql)");
    await reload();MC.toast(kind==="preset"?"Preset dihapus.":"Nilai peserta dihapus.");
    if(S.p&&String(S.p.id)===String(pid)&&S.tab==="nilai")renderScore();
  }catch(e){btn.disabled=false;MC.toast("Gagal menghapus: "+e.message,"err",6000);}
}

/* ---------- tahap ---------- */
async function doImport(verified){
  const ok=await MC.openImporter({data:S.data,stage:S.stage,verified:verified===true});
  if(ok){await reload();}
}
$("addStageBtn").addEventListener("click",async()=>{
  const defs=S.data.stages;
  const v=await MC.dialog({title:"Tambah tahap",message:"Tahap baru tersimpan di Supabase. Setelah itu kamu bisa mengisi pesertanya dari leaderboard tahap lain, PDF, atau teks.",confirm:"Lanjut",
    fields:[{name:"name",label:"Nama tahap",placeholder:"Contoh: Final MC"},{name:"pw",label:"Password preset",type:"password",autocomplete:"current-password"}],
    validate:v=>{if(!v.name.trim())return "Nama tahap wajib diisi.";if(defs.some(s=>String(s.name).trim().toLocaleLowerCase("id")===v.name.trim().toLocaleLowerCase("id")))return "Nama tahap itu sudah ada.";return v.pw===PRESET_PASSWORD?"":"Password salah.";}});
  if(!v)return;
  const id=Math.max(0,...defs.map(s=>Number(s.id)||0))+1;
  try{
    const {error}=await MC.sb.from("stages").insert({id,name:v.name.trim()});if(error)throw error;
    await reload();S.stage=id;MC.setStage(id);S.p=null;S.activeJudge=null;drawStages();paintPicks();rerender();
    MC.toast(`Tahap ${id} — ${v.name.trim()} ditambahkan.`);
    await doImport(true);
  }catch(e){MC.toast("Gagal menambah tahap: "+e.message+". Pastikan supabase_add_stages.sql sudah dijalankan.","err",6000);}
});
function drawStages(){MC.renderStageTabs($("stageTabs"),S.stages,S.stage,s=>{S.stage=s;MC.setStage(s);S.p=null;S.activeJudge=null;paintPicks();rerender();},false);}
function rerender(){
  $("cntList").textContent=S.data.presets.filter(p=>{const x=S.data.participants.find(y=>String(y.id)===String(p.participant_id));return x&&Number(x.stage||1)===S.stage;}).length;
  if(S.tab==="nilai")renderScore();if(S.tab==="daftar")renderList();
}
function judged(){return S.data.stages.filter(x=>Number(x.id)>1);}
async function reload(){S.data=await MC.loadAll();S.stages=judged();rerender();}

/* ---------- start ---------- */
(async function(){
  paintPicks();requestAnimationFrame(moveInd);
  try{
    MC.connect();S.data=await MC.loadAll();S.stages=judged();
    if(!S.stages.length){const b=$("connError");b.hidden=false;b.textContent="Belum ada tahap penilaian. Tekan Tambah tahap untuk membuatnya.";}
    S.stage=S.stages.length?MC.getStage(S.stages):2;if(S.stages.length)MC.setStage(S.stage);
    drawStages();rerender();
    $("backLink").addEventListener("click",()=>MC.setStage(S.stage));
    const onFont=()=>moveInd();if(document.fonts&&document.fonts.ready)document.fonts.ready.then(onFont);
  }catch(e){const b=$("connError");b.hidden=false;b.textContent="Koneksi belum siap: "+(e.message||e);}
})();
})();
