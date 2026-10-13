(function(){
"use strict";
const {$,esc,fmt,icons}=MC;
let data=null,stage=1,q="",unlocked=sessionStorage.getItem("mc_unlock")==="1",includeGugur=true,podiumKey="";
const busy=new Set();
const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelector(".search").innerHTML=icons.search+'<input id="q" type="search" placeholder="Cari nama atau kelas" aria-label="Cari peserta" autocomplete="off">';
$("q").addEventListener("input",e=>{q=e.target.value.trim().toLowerCase();renderList();});

function paintButtons(){
  $("manageBtn").innerHTML=unlocked?icons.lock+"<span>Selesai mengatur</span>":icons.edit+"<span>Atur status</span>";
  $("pdfBtn").innerHTML=icons.pdf+"<span>Unduh PDF</span>";
  const b=$("manageBanner");b.hidden=!unlocked;
  b.innerHTML=unlocked?icons.edit+"<span>Mode atur status aktif. Perubahan langsung tersimpan ke database.</span>":"";
}

function countUp(el){
  const to=Number(el.dataset.v);if(reduce||isNaN(to)){el.textContent=fmt(to);return;}
  const t0=performance.now(),dur=900;
  const tick=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=fmt(Number.isInteger(to)?Math.round(to*e):(to*e));if(p<1)requestAnimationFrame(tick);else el.textContent=fmt(to);};
  requestAnimationFrame(tick);
}

function renderPodium(rows){
  const top=rows.filter(r=>r.rank&&r.rank<=3);
  const key=stage+"|"+top.map(r=>r.id+":"+r.avg).join(",");
  if(key===podiumKey)return;podiumKey=key;
  const by=n=>top.find(r=>r.rank===n);
  const cell=n=>{const r=by(n);
    return r?`<div class="pod r${n}"><div class="who"><b>${esc(r.name)}</b><small>Kelas ${esc(r.kelas)}</small></div><div class="pl"><span class="rk">Peringkat ${n}</span><span class="sc num" data-v="${r.avg}">${fmt(r.avg)}</span></div></div>`
      :`<div class="pod r${n} empty"><div class="who"><b>Belum ada</b></div><div class="pl"><span class="rk">#${n}</span><span class="sc">–</span></div></div>`;};
  const p=$("podium");p.classList.remove("play");p.innerHTML=cell(2)+cell(1)+cell(3);
  void p.offsetWidth;p.classList.add("play");
  p.querySelectorAll(".sc[data-v]").forEach(countUp);
}

function renderSummary(rows){
  const done=rows.filter(r=>r.complete).length,ok=rows.filter(r=>!r.gugur).length,no=rows.filter(r=>r.gugur).length;
  $("summary").innerHTML=`<span><b class="num">${done}</b> dari ${rows.length} peserta sudah dinilai</span><span><b class="num">${ok}</b> lolos</span><span><b class="num">${no}</b> gugur</span>`;
}

function rowHtml(r){
  const multi=stage!==1;
  const cls=["lrow",r.rank===1?"top1":r.rank===2?"top2":r.rank===3?"top3":"",r.gugur?"gone":"",r.complete?"":"pending"].join(" ");
  const rank=r.gugur?"×":(r.rank??"–");
  const meta=multi?`<div class="lmeta">${r.j1?`${esc(r.j1)}: ${r.a==null?"belum menilai":fmt(r.a)} · ${esc(r.j2)}: ${r.b==null?"belum menilai":fmt(r.b)}`:"Preset penguji belum dibuat"}</div>`:"";
  const lab=r.complete?(multi?"rata-rata":"tes tulis"):"menunggu";
  const isBusy=busy.has(String(r.id));
  const act=unlocked?`<button type="button" class="stbtn ${r.gugur?"undo":""}" data-id="${esc(r.id)}" ${isBusy?"disabled":""}>${isBusy?"Menyimpan…":(r.gugur?"Batalkan gugur":"Gugurkan")}</button>`:"";
  return `<div class="${cls}"><div class="rank ${rank==="–"||rank==="×"?"none":""} num">${rank}</div><div class="who"><div class="lname">${esc(r.name)}</div><div class="lmeta">Kelas ${esc(r.kelas)}</div>${meta}</div><div class="lside"><span class="pill ${r.gugur?"no":"ok"}">${r.gugur?"Gugur":"Lolos"}</span>${act}</div><div class="lscore"><b class="num">${r.complete?fmt(r.avg):"–"}</b><small>${lab}</small></div></div>`;
}

function renderList(){
  if(!data)return;
  const rows=MC.computeRows(data,stage);
  const f=rows.filter(r=>!q||String(r.name).toLowerCase().includes(q)||String(r.kelas).toLowerCase().includes(q));
  $("rows").innerHTML=f.length?f.map(rowHtml).join(""):`<div class="empty"><b>${q?"Tidak ada hasil":"Belum ada peserta di tahap ini"}</b>${q?"Coba nama atau kelas lain.":"Data peserta untuk tahap ini belum dimasukkan ke tabel participants."}</div>`;
}

function render(){
  const rows=MC.computeRows(data,stage);
  renderSummary(rows);renderPodium(rows);renderList();
  MC.buildPrintSheet(rows,{stage,stageName:MC.stageName(data.stages,stage),includeGugur});
}

async function reload(){
  try{data=await MC.loadAll();$("connError").hidden=true;render();}
  catch(e){showError(e);}
}
function showError(e){const b=$("connError");b.hidden=false;b.textContent="Data belum bisa dimuat: "+(e.message||e);
  if(!data)$("rows").innerHTML='<div class="empty"><b>Leaderboard belum tersedia</b>Periksa koneksi lalu muat ulang halaman.</div>';}

/* ---------- status lolos / gugur ---------- */
async function toggleStatus(id){
  const row=data.participants.find(p=>String(p.id)===String(id));if(!row||busy.has(String(id)))return;
  if(!MC.statusSupported){
    return MC.dialog({title:"Kolom status belum ada",message:"Database belum punya kolom <b>status</b>. Jalankan <b>supabase_fix_gugur.sql</b> di Supabase (SQL Editor → Run), lalu muat ulang halaman.",confirm:"Mengerti",hideCancel:true});
  }
  const next=row.status==="gugur"?null:"gugur";
  busy.add(String(id));renderList();
  let ok=false;
  try{
    const {data:res,error}=await MC.sb.from("participants").update({status:next}).eq("id",row.id).select("id,status");
    if(error)throw error;
    // Supabase tidak melempar error saat RLS memblokir UPDATE; hasilnya hanya 0 baris. Itu penyebab status "balik lagi" setelah refresh.
    if(!res||!res.length||(res[0].status??null)!==next){const b=new Error("blocked");b.blocked=true;throw b;}
    row.status=next;ok=true;
    MC.toast(next?`${row.name} ditandai gugur.`:`${row.name} kembali lolos.`);
  }catch(e){
    MC.dialog({title:"Status belum tersimpan",
      message:e.blocked?"Database menolak perubahan ini, jadi status peserta tidak berubah. Jalankan <b>supabase_fix_gugur.sql</b> di Supabase (SQL Editor → Run), lalu coba lagi.":"Gagal menyimpan: "+esc(e.message||e)+".<br>Pastikan <b>supabase_fix_gugur.sql</b> sudah dijalankan.",
      confirm:"Mengerti",hideCancel:true});
  }finally{busy.delete(String(id));}
  if(ok)render();else renderList();
  reload(); // sinkronkan ulang dengan database
}
$("rows").addEventListener("click",e=>{const b=e.target.closest(".stbtn");if(b)toggleStatus(b.dataset.id);});

$("manageBtn").addEventListener("click",async()=>{
  if(unlocked){unlocked=false;sessionStorage.removeItem("mc_unlock");}
  else{
    const ok=await MC.askPassword("Atur status peserta","Masukkan password preset untuk menggugurkan atau mengembalikan peserta.");
    if(!ok)return;unlocked=true;sessionStorage.setItem("mc_unlock","1");
  }
  paintButtons();renderList();
});

/* ---------- PDF ---------- */
$("pdfBtn").addEventListener("click",async()=>{
  if(!data)return;
  const rows=MC.computeRows(data,stage),hasGugur=rows.some(r=>r.gugur);
  if(hasGugur){
    const ok=await MC.dialog({title:"Unduh PDF leaderboard",
      message:`Di jendela berikutnya pilih <b>Simpan sebagai PDF</b> sebagai printer.<br><br><label style="display:flex;gap:10px;align-items:center;font-weight:650;color:var(--text);cursor:pointer"><input type="checkbox" id="incG" ${includeGugur?"checked":""} style="width:18px;height:18px"> Sertakan peserta gugur (diberi keterangan)</label>`,
      confirm:"Lanjut cetak",validate:()=>{includeGugur=$("incG").checked;return "";}});
    if(!ok)return;
  }
  const name=MC.stageName(data.stages,stage);
  MC.buildPrintSheet(rows,{stage,stageName:name,includeGugur});
  MC.print(`Leaderboard Tahap ${stage} - ${name} - SMP Tunas Harapan ${MC.YEAR.replace("/","-")}`);
});

/* ---------- start ---------- */
(async function(){
  paintButtons();
  try{
    MC.connect();data=await MC.loadAll();
    stage=MC.getStage(data.stages);MC.setStage(stage);
    MC.renderStageTabs($("stageTabs"),data.stages,stage,s=>{
      stage=s;MC.setStage(s);podiumKey="";render();
      const r=$("rows");r.classList.remove("swap");void r.offsetWidth;r.classList.add("swap");
    });
    $("goPenilaian").addEventListener("click",()=>MC.setStage(stage));
    render();
    setInterval(()=>{if(document.visibilityState==="visible"&&!busy.size&&!document.querySelector("dialog[open]"))reload();},30000);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reload();});
  }catch(e){showError(e);}
})();
})();
