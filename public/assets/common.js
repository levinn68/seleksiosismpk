/* Shared helpers untuk leaderboard & penilaian. Konfigurasi dibaca dari config.js (tidak diubah). */
(function(){
"use strict";
const MC=window.MC={};
const $=MC.$=id=>document.getElementById(id);
const esc=MC.esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
MC.fmt=n=>n==null||isNaN(n)?"—":(Number.isInteger(+n)?String(+n):(+n).toFixed(1));
MC.pad=n=>String(n).padStart(2,"0");
MC.initials=name=>String(name||"?").trim().split(/\s+/).slice(0,2).map(w=>w[0]).join("").toUpperCase();
MC.category=n=>n>=90?"Sangat baik":n>=80?"Baik":n>=70?"Cukup":"Perlu ditingkatkan";
MC.YEAR="2027/2028";
MC.DEFAULT_STAGES=[{id:1,name:"Tes Tulis"},{id:2,name:"Tes MC"}];
MC.icons={
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  chev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  pdf:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  edit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};

/* ---------- Supabase ---------- */
MC.sb=null;MC.statusSupported=true;
MC.connect=function(){
  if(!window.supabase||typeof SUPABASE_URL==="undefined"||typeof SUPABASE_ANON_KEY==="undefined"||!SUPABASE_URL||!SUPABASE_ANON_KEY||SUPABASE_URL.includes("PASTE_")||SUPABASE_ANON_KEY.includes("PASTE_"))
    throw new Error("Isi URL dan anon/publishable key di config.js terlebih dahulu.");
  MC.sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  return MC.sb;
};
const denied=e=>e&&(e.code==="42501"||/permission denied/i.test(e.message||""));
MC.loadStages=async function(){
  const {data,error}=await MC.sb.from("stages").select("id,name").order("id");
  return (!error&&data&&data.length)?data:MC.DEFAULT_STAGES;
};
MC.loadParticipants=async function(){
  let r=await MC.sb.from("participants").select("id,name,kelas,stage,test_score,status").order("id");
  if(r.error&&/status/i.test(r.error.message||"")){ // kolom status belum ada
    MC.statusSupported=false;
    r=await MC.sb.from("participants").select("id,name,kelas,stage,test_score").order("id");
  }else if(!r.error){MC.statusSupported=true;}
  if(r.error){
    if(denied(r.error))throw new Error("Akses tabel participants ditolak. Jalankan supabase_fix_permissions.sql lalu muat ulang.");
    throw r.error;
  }
  return r.data||[];
};
MC.loadAll=async function(){
  const sb=MC.sb;
  const [stages,participants,j,pr,sc]=await Promise.all([
    MC.loadStages(),MC.loadParticipants(),
    sb.from("judges").select("id,name").order("name"),
    sb.from("presets").select("id,participant_id,judge1_id,judge2_id,created_at").order("created_at",{ascending:false}),
    sb.from("scores").select("participant_id,judge_id,total,stage,updated_at")
  ]);
  if(j.error)throw new Error(denied(j.error)?"Akses tabel judges ditolak. Jalankan supabase_fix_permissions.sql.":j.error.message);
  if(pr.error)throw pr.error;if(sc.error)throw sc.error;
  return {stages,participants,judges:j.data||[],presets:pr.data||[],scores:sc.data||[]};
};

/* ---------- stage persistence ---------- */
MC.getStage=function(defs){
  let s=Number(new URLSearchParams(location.search).get("tahap"))||Number(localStorage.getItem("mc_stage"))||1;
  if(defs&&defs.length&&!defs.some(d=>Number(d.id)===s))s=Number(defs[0].id);
  return s;
};
MC.setStage=function(s){
  try{localStorage.setItem("mc_stage",String(s));}catch(e){}
  const u=new URL(location.href);u.searchParams.set("tahap",s);history.replaceState(null,"",u);
};
MC.stageName=(defs,id)=>(defs.find(s=>Number(s.id)===Number(id))||{}).name||("Tahap "+id);

/* ---------- ranking ---------- */
MC.computeRows=function(data,stage){
  const preset=new Map(data.presets.map(p=>[String(p.participant_id),p]));
  const judge=new Map(data.judges.map(j=>[String(j.id),j]));
  const rows=data.participants.filter(p=>Number(p.stage||1)===Number(stage)).map(p=>{
    const pr=preset.get(String(p.id));
    const sc=data.scores.filter(s=>String(s.participant_id)===String(p.id)&&Number(s.stage||1)===Number(stage));
    const a=pr?sc.find(s=>String(s.judge_id)===String(pr.judge1_id)):null;
    const b=pr?sc.find(s=>String(s.judge_id)===String(pr.judge2_id)):null;
    const written=Number(stage)===1&&p.test_score!==null&&p.test_score!==undefined;
    const complete=Number(stage)===1?written:!!(a&&b);
    const avg=Number(stage)===1?(written?Number(p.test_score):null):(complete?(Number(a.total)+Number(b.total))/2:null);
    return {id:p.id,name:p.name,kelas:p.kelas||"—",gugur:p.status==="gugur",complete,avg,
      a:a?Number(a.total):null,b:b?Number(b.total):null,
      j1:pr?(judge.get(String(pr.judge1_id))||{}).name||"Penguji 1":null,
      j2:pr?(judge.get(String(pr.judge2_id))||{}).name||"Penguji 2":null,rank:null};
  });
  rows.sort((x,y)=>{
    if(x.complete!==y.complete)return x.complete?-1:1;
    if(x.complete&&x.avg!==y.avg)return y.avg-x.avg;
    return String(x.name).localeCompare(String(y.name),"id");
  });
  let r=0;rows.forEach(x=>{if(x.complete&&!x.gugur)x.rank=++r;});
  return rows;
};

/* ---------- toast ---------- */
MC.toast=function(msg,kind="ok",ms=3800){
  let box=$("toasts");
  if(!box){box=document.createElement("div");box.id="toasts";box.className="toasts";box.setAttribute("aria-live","polite");document.body.appendChild(box);}
  const t=document.createElement("div");t.className="toast "+kind;t.textContent=msg;box.appendChild(t);
  setTimeout(()=>{t.classList.add("out");setTimeout(()=>t.remove(),320);},ms);
};

/* ---------- dialog ---------- */
MC.dialog=function(o){
  return new Promise(resolve=>{
    const d=document.createElement("dialog");d.className="mc";
    const fields=(o.fields||[]).map(f=>`<div class="fld"><label class="lbl" for="f_${f.name}">${esc(f.label)}</label><input class="input" id="f_${f.name}" name="${f.name}" type="${f.type||"text"}" placeholder="${esc(f.placeholder||"")}" autocomplete="${f.autocomplete||"off"}"></div>`).join("");
    d.innerHTML=`<form class="dlg" method="dialog" novalidate><h2>${esc(o.title||"")}</h2>${o.message?`<p class="msg">${o.message}</p>`:""}${fields}<div class="err" role="alert"></div><div class="actions">${o.hideCancel?"":`<button type="button" class="btn" data-x>${esc(o.cancel||"Batal")}</button>`}<button type="submit" class="btn ${o.danger?"danger":"primary"}">${esc(o.confirm||"Lanjut")}</button></div></form>`;
    document.body.appendChild(d);
    const form=d.querySelector("form"),err=d.querySelector(".err");
    let out=null;
    form.addEventListener("submit",e=>{
      e.preventDefault();
      const vals={};(o.fields||[]).forEach(f=>vals[f.name]=form.elements[f.name].value);
      const msg=o.validate?o.validate(vals):"";
      if(msg){err.textContent=msg;const first=form.querySelector("input");if(first)first.focus();return;}
      out=o.fields&&o.fields.length?vals:true;d.close();
    });
    const x=d.querySelector("[data-x]");if(x)x.addEventListener("click",()=>d.close());
    d.addEventListener("click",e=>{if(e.target===d)d.close();});
    d.addEventListener("close",()=>{d.remove();resolve(out);});
    d.showModal();
    const first=form.querySelector("input");if(first)setTimeout(()=>first.focus(),50);
  });
};
MC.askPassword=async function(title,message){
  const r=await MC.dialog({title,message,confirm:"Konfirmasi",fields:[{name:"pw",label:"Password preset",type:"password",placeholder:"Masukkan password",autocomplete:"current-password"}],validate:v=>v.pw===PRESET_PASSWORD?"":"Password salah. Coba lagi."});
  return !!r;
};

/* ---------- stage tabs (dengan indikator geser) ---------- */
MC.renderStageTabs=function(el,defs,current,onChange,light){
  el.className="stagebar"+(light?" light":"");el.setAttribute("role","tablist");
  el.innerHTML='<span class="ind"></span>'+defs.map(s=>`<button type="button" role="tab" data-id="${s.id}" aria-selected="${Number(s.id)===Number(current)}">Tahap ${s.id}<small>${esc(s.name)}</small></button>`).join("");
  const place=center=>{
    const b=el.querySelector('[aria-selected="true"]'),ind=el.querySelector(".ind");
    if(!b||!ind)return;
    ind.style.width=b.offsetWidth+"px";ind.style.transform=`translateX(${b.offsetLeft-4}px)`;
    // Geser hanya di dalam tab tahap (bukan seluruh halaman) supaya scroll halaman tidak melompat ke atas.
    if(center&&el.scrollWidth>el.clientWidth)el.scrollTo({left:b.offsetLeft-(el.clientWidth-b.offsetWidth)/2,behavior:"smooth"});
  };
  el.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    if(Number(b.dataset.id)===Number(current))return;
    current=Number(b.dataset.id);
    el.querySelectorAll("button").forEach(x=>x.setAttribute("aria-selected",String(x===b)));
    place(true);onChange(current);
  }));
  requestAnimationFrame(()=>{const ind=el.querySelector(".ind");if(ind){ind.style.transition="none";place(false);requestAnimationFrame(()=>ind.style.transition="");}});
  window.addEventListener("resize",()=>place(false));
};

/* ---------- lembar cetak PDF ---------- */
MC.buildPrintSheet=function(rows,opt){
  const el=$("printSheet");if(!el)return;
  const multi=Number(opt.stage)!==1;
  const list=opt.includeGugur?rows:rows.filter(r=>!r.gugur);
  const lolos=rows.filter(r=>!r.gugur&&r.complete).length,gugur=rows.filter(r=>r.gugur).length;
  const tgl=new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"});
  const body=list.map(r=>{
    const cls=r.gugur?"gone":(r.rank===1?"t1":r.rank===2?"t2":r.rank===3?"t3":"");
    const ket=r.gugur?'<span class="tag-no">Gugur</span>':(r.complete?'<span class="tag-ok">Lolos</span>':'<span class="tag-wait">Belum dinilai</span>');
    return `<tr class="${cls}"><td>${r.rank??"–"}</td><td class="l nm">${esc(r.name)}</td><td>${esc(r.kelas)}</td>${multi?`<td class="sm">${r.a==null?"–":MC.fmt(r.a)}</td><td class="sm">${r.b==null?"–":MC.fmt(r.b)}</td>`:""}<td class="sc">${r.complete?MC.fmt(r.avg):"–"}</td><td>${ket}</td></tr>`;
  }).join("");
  el.innerHTML=`<div class="ps-head"><div class="l"><img src="assets/logo-sekolah.png" alt=""></div><div class="ps-title"><h1>NILAI TEST OSIS MPK</h1><h2>SMP TUNAS HARAPAN</h2><p>Tahap ${opt.stage} — ${esc(opt.stageName)} · Tahun ajaran ${MC.YEAR}</p></div><div class="r"><img src="assets/logo-mpk.png" alt=""><img src="assets/logo-osis.png" alt=""></div></div><div class="ps-rule"></div><div class="ps-meta"><span>Dicetak: <b>${tgl}</b></span><span>Peserta: <b>${rows.length}</b> · Lolos: <b>${lolos}</b> · Gugur: <b>${gugur}</b></span></div><table class="ps-table"><thead><tr><th style="width:11%">Peringkat</th><th class="l">Nama</th><th style="width:11%">Kelas</th>${multi?'<th style="width:9%">Penguji 1</th><th style="width:9%">Penguji 2</th>':""}<th style="width:12%">${multi?"Rata-rata":"Nilai"}</th><th style="width:14%">Keterangan</th></tr></thead><tbody>${body||'<tr><td colspan="7">Belum ada data.</td></tr>'}</tbody></table><div class="ps-note">Catatan: peserta bernilai sama diurutkan berdasarkan abjad nama. Peringkat hanya diberikan kepada peserta yang sudah dinilai dan tidak gugur.</div>`;
};
MC.print=async function(title){
  const imgs=[...document.querySelectorAll("#printSheet img")];
  await Promise.all(imgs.map(i=>(i.complete&&i.naturalWidth)?Promise.resolve():new Promise(r=>{i.onload=i.onerror=r;})));
  await Promise.all(imgs.map(i=>i.decode?i.decode().catch(()=>{}):0));
  const old=document.title;document.title=title;
  const done=()=>{document.title=old;window.removeEventListener("afterprint",done);};
  window.addEventListener("afterprint",done);
  window.print();
  setTimeout(()=>{document.title=old;},5000);
};
})();
