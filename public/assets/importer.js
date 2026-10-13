/* Impor peserta untuk sebuah tahap: dari leaderboard tahap lain, atau dari PDF / teks. */
(function(){
"use strict";
const MC=window.MC||(window.MC={});
const KELAS=/^([7-9]\.\d{1,2}|[7-9][A-Za-z]|[7-9]-\d{1,2})$/;
const KEYWORD=/^(lolos|gugur|belum|dinilai|menunggu|tidak|lulus)$/i;
const SKIP=/^(peringkat|rank|no\b|no\.|nama|kelas|nilai|keterangan|catatan|halaman|dicetak|peserta|smp|tahap|tahun|jumlah|total|daftar)/i;
const NUM=/^\d+([.,]\d+)?$/;

/* Mengubah teks bebas (hasil PDF / tempelan / CSV) menjadi [{name,kelas}] */
MC.parseParticipants=function(text){
  const lines=String(text||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const parsed=[];let anyKelas=false;
  for(const line of lines){
    if(SKIP.test(line))continue;
    const t=line.replace(/[,;|\t·•]+/g," ").split(/\s+/).filter(Boolean);
    while(t.length&&NUM.test(t[0])&&!KELAS.test(t[0])&&t.length>1)t.shift();      // nomor / peringkat di depan
    while(t.length>1&&(/^\d+[.)]$/.test(t[0])||/^[–—\-•*]+$/.test(t[0])))t.shift();
    while(t.length&&(KEYWORD.test(t[t.length-1])||(NUM.test(t[t.length-1])&&!KELAS.test(t[t.length-1]))))t.pop(); // nilai / keterangan di belakang
    let kelas=null;
    if(t.length>1&&KELAS.test(t[t.length-1]))kelas=t.pop();
    else{const i=t.findIndex((x,k)=>k>0&&KELAS.test(x));if(i>0){kelas=t[i];t.splice(i,1);}}
    const name=t.join(" ").replace(/\s+/g," ").trim();
    if(!name||/\d/.test(name)||(name.match(/[A-Za-zÀ-ÿ]/g)||[]).length<3||t.length>9)continue;
    if(kelas)anyKelas=true;
    parsed.push({name,kelas});
  }
  const seen=new Set(),out=[];
  parsed.filter(p=>anyKelas?p.kelas:true).forEach(p=>{const k=p.name.toLowerCase();if(seen.has(k))return;seen.add(k);out.push({name:p.name,kelas:p.kelas||"—"});});
  return out;
};

let pdfPromise=null;
function loadPdfJs(){
  if(window.pdfjsLib)return Promise.resolve();
  if(pdfPromise)return pdfPromise;
  pdfPromise=new Promise((res,rej)=>{
    const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";res();};
    s.onerror=()=>{pdfPromise=null;rej(new Error("Pembaca PDF gagal dimuat. Periksa internet, atau tempel teksnya."));};
    document.head.appendChild(s);
  });
  return pdfPromise;
}
async function pdfToText(file){
  await loadPdfJs();
  const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  const out=[];
  for(let n=1;n<=pdf.numPages;n++){
    const tc=await (await pdf.getPage(n)).getTextContent();
    const rows=new Map();
    tc.items.forEach(it=>{if(!it.str||!it.str.trim())return;const y=Math.round(it.transform[5]/4);if(!rows.has(y))rows.set(y,[]);rows.get(y).push(it);});
    [...rows.entries()].sort((a,b)=>b[0]-a[0]).forEach(([,items])=>{
      items.sort((a,b)=>a.transform[4]-b.transform[4]);
      let line="",end=null;
      items.forEach(it=>{const x=it.transform[4];line+=(end!==null&&x-end>10?"\t":(line?" ":""))+it.str.trim();end=x+(it.width||0);});
      out.push(line);
    });
  }
  return out.join("\n");
}

/* ---------- dialog ---------- */
MC.openImporter=function(o){
  const {$,esc,pad}=MC,data=o.data,target=Number(o.stage);
  const tName=MC.stageName(data.stages,target);
  const others=data.stages.filter(s=>Number(s.id)!==target);
  const existing=new Set(data.participants.filter(p=>Number(p.stage||1)===target).map(p=>String(p.name).trim().toLowerCase()));
  const st={mode:others.length?"src":"file",items:[],src:others.length?String((others.find(s=>Number(s.id)===1)||others[0]).id):"",lolos:true,top:"",text:"",busy:false,note:""};
  return new Promise(resolve=>{
    const d=document.createElement("dialog");d.className="mc sheetmode";
    d.innerHTML=`<div class="dlg wide imp"><div class="sheet-top"><h2>Isi peserta Tahap ${target}</h2><p class="msg" style="margin:0 0 12px">${esc(tName)}. Pilih sumbernya, cek daftar, lalu simpan.</p>
      <div class="seg" role="tablist" style="margin:0"><button type="button" data-m="src" ${others.length?"":"hidden"}>Dari leaderboard</button><button type="button" data-m="file">PDF / teks</button></div></div>
      <div class="sheet-list imp-body"><div class="imp-ctl"></div><div class="imp-sum"></div><div class="imp-list"></div></div>
      <div class="imp-foot">${o.verified?"":'<div class="fld" style="margin-bottom:10px"><label class="lbl" for="impPw">Password preset</label><input class="input" id="impPw" type="password" autocomplete="current-password" placeholder="Masukkan password preset"></div>'}<div class="err" role="alert" style="color:var(--red);font-size:13px;font-weight:600;min-height:18px"></div>
      <div class="actions" style="display:flex;gap:10px;justify-content:flex-end;margin-top:6px"><button type="button" class="btn" data-cancel>${o.verified?"Lewati":"Batal"}</button><button type="button" class="btn primary" id="impSave">Simpan peserta</button></div></div>
      <button type="button" class="close-x" aria-label="Tutup">×</button></div>`;
    document.body.appendChild(d);
    const q=s=>d.querySelector(s);
    const setErr=t=>{q(".err").textContent=t||"";};

    function srcItems(){
      const rows=MC.computeRows(data,Number(st.src));
      let r=st.lolos?rows.filter(x=>!x.gugur):rows;
      const n=parseInt(st.top,10);
      if(n>0)r=r.filter(x=>x.rank!==null).slice(0,n);
      return r.map(x=>({name:x.name,kelas:x.kelas,tag:x.rank?("#"+x.rank):(x.gugur?"gugur":"")}));
    }
    function setItems(list){
      st.items=list.map(x=>{const dup=existing.has(String(x.name).trim().toLowerCase());return {...x,dup,sel:!dup};});
    }
    function ctl(){
      if(st.mode==="src"){
        q(".imp-ctl").innerHTML=`<div class="fld"><label class="lbl" for="impSrc">Ambil dari leaderboard</label><select class="input" id="impSrc">${others.map(s=>`<option value="${s.id}" ${String(s.id)===st.src?"selected":""}>Tahap ${s.id} — ${esc(s.name)}</option>`).join("")}</select></div>
        <div class="imp-two"><label class="chk"><input type="checkbox" id="impLolos" ${st.lolos?"checked":""}> Hanya yang lolos</label><div><label class="lbl" for="impTop">Ambil N teratas</label><input class="input" id="impTop" type="number" min="1" inputmode="numeric" placeholder="Kosong = semua" value="${esc(st.top)}"></div></div>`;
        $("impSrc").onchange=e=>{st.src=e.target.value;setItems(srcItems());list();};
        $("impLolos").onchange=e=>{st.lolos=e.target.checked;setItems(srcItems());list();};
        $("impTop").oninput=e=>{st.top=e.target.value;setItems(srcItems());list();};
      }else{
        q(".imp-ctl").innerHTML=`<div class="fld"><label class="lbl" for="impFile">Unggah PDF, TXT, atau CSV</label><input class="input" id="impFile" type="file" accept=".pdf,.txt,.csv,application/pdf,text/*"></div>
        <div class="fld"><label class="lbl" for="impText">Atau tempel daftar</label><textarea class="input" id="impText" rows="5" placeholder="Satu peserta per baris, contoh:\nAdela Syawaliani 8.4\n2. Afra Zahra Rachmawati, 7.1" style="resize:vertical;font:inherit">${esc(st.text)}</textarea></div><div class="imp-note" id="impNote">${esc(st.note)}</div>`;
        $("impText").oninput=e=>{st.text=e.target.value;st.note="";setItems(MC.parseParticipants(st.text));list();};
        $("impFile").onchange=async e=>{
          const f=e.target.files[0];if(!f)return;setErr("");$("impNote").textContent="Membaca "+f.name+"…";
          try{
            const txt=/\.pdf$/i.test(f.name)||f.type==="application/pdf"?await pdfToText(f):await f.text();
            st.text=txt;$("impText").value=txt;setItems(MC.parseParticipants(txt));
            st.note=st.items.length?`${st.items.length} nama terbaca dari ${f.name}. Periksa daftar di bawah.`:"Tidak ada nama yang terbaca. Pastikan format: nama lalu kelas, satu peserta per baris.";
          }catch(err){st.note="";setErr(err.message||String(err));}
          $("impNote").textContent=st.note;list();
        };
      }
      d.querySelectorAll("[data-m]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.m===st.mode)));
    }
    function list(){
      const n=st.items.filter(x=>x.sel).length;
      q(".imp-sum").innerHTML=st.items.length?`<b class="num">${n}</b> dari ${st.items.length} peserta akan disimpan${st.items.some(x=>x.dup)?` · ${st.items.filter(x=>x.dup).length} sudah ada`:""} <button type="button" class="linkbtn" data-all>${n===st.items.filter(x=>!x.dup).length?"Kosongkan":"Pilih semua"}</button>`:"";
      q(".imp-list").innerHTML=st.items.length?st.items.map((x,i)=>`<label class="imp-row ${x.dup?"dup":""}"><input type="checkbox" data-i="${i}" ${x.sel?"checked":""} ${x.dup?"disabled":""}><span class="nm">${esc(x.name)}<small>Kelas ${esc(x.kelas)}${x.dup?" · sudah ada di tahap ini":""}</small></span>${x.tag?`<span class="badge">${esc(x.tag)}</span>`:""}</label>`).join(""):`<div class="empty" style="padding:22px 10px"><b>${st.mode==="src"?"Tidak ada peserta":"Belum ada daftar"}</b>${st.mode==="src"?"Leaderboard tahap itu belum punya peserta yang memenuhi syarat.":"Unggah file atau tempel daftar nama di atas."}</div>`;
      q("#impSave").textContent=n?`Simpan ${n} peserta`:"Simpan peserta";
    }
    d.addEventListener("change",e=>{const c=e.target.closest("[data-i]");if(c){st.items[+c.dataset.i].sel=c.checked;list();}});
    d.addEventListener("click",e=>{
      const m=e.target.closest("[data-m]");
      if(m&&m.dataset.m!==st.mode){st.mode=m.dataset.m;st.items=[];if(st.mode==="src")setItems(srcItems());else if(st.text)setItems(MC.parseParticipants(st.text));ctl();list();return;}
      if(e.target.closest("[data-all]")){const all=st.items.filter(x=>!x.dup).every(x=>x.sel);st.items.forEach(x=>{if(!x.dup)x.sel=!all;});list();return;}
      if(e.target===d)d.close();
    });
    q("[data-cancel]").addEventListener("click",()=>d.close());
    q(".close-x").addEventListener("click",()=>d.close());

    let saved=false;
    q("#impSave").addEventListener("click",async()=>{
      if(st.busy)return;setErr("");
      const pick=st.items.filter(x=>x.sel);
      if(!pick.length)return setErr("Pilih minimal satu peserta.");
      if(!o.verified&&$("impPw").value!==PRESET_PASSWORD)return setErr("Password preset salah.");
      st.busy=true;const btn=q("#impSave");btn.disabled=true;btn.innerHTML='<span class="spin"></span> Menyimpan';
      try{
        let id=Math.max(0,...data.participants.map(p=>Number(p.id)||0))+1;
        const rows=pick.map(x=>({id:id++,name:x.name,kelas:x.kelas,stage:target}));
        for(let i=0;i<rows.length;i+=100){
          const {data:res,error}=await MC.sb.from("participants").insert(rows.slice(i,i+100)).select("id");
          if(error)throw error;
          if(!res||res.length!==rows.slice(i,i+100).length)throw new Error("Database menolak penyimpanan peserta.");
        }
        saved=true;MC.toast(`${rows.length} peserta disimpan di Tahap ${target}.`);d.close();
      }catch(e){
        setErr("Gagal menyimpan: "+(e.message||e)+". Jalankan supabase_fix_import.sql di Supabase SQL Editor lalu coba lagi.");
        st.busy=false;btn.disabled=false;list();
      }
    });
    d.addEventListener("close",()=>{d.remove();resolve(saved);});
    if(st.mode==="src")setItems(srcItems());
    ctl();list();d.showModal();
  });
};
})();
