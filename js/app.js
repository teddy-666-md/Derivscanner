const state={items:[],selected:new Set(),filter:"",sort:"name",current:null,xml:""};
const $=s=>document.querySelector(s);
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)};
function validUrl(v){try{const u=new URL(v);return u.protocol==="http:"||u.protocol==="https:"}catch{return false}}
function looksLikeBot(href,text=""){const s=(href+" "+text).toLowerCase();return /\.xml(?:[?#].*)?$/.test(href)||s.includes("bot")||s.includes("strategy")||s.includes("binarybot")||s.includes("derivbot")}
function filename(url){try{let p=new URL(url).pathname.split("/").pop()||"bot.xml";return decodeURIComponent(p)}catch{return"bot.xml"}}
function render(){let a=state.items.filter(x=>{const q=state.filter.toLowerCase();return !q||(x.name+" "+x.url).toLowerCase().includes(q)});if(state.sort==="source")a.sort((x,y)=>x.url.localeCompare(y.url));else a.sort((x,y)=>x.name.localeCompare(y.name));$("#count").textContent=state.items.length;
$("#grid").innerHTML=a.length?a.map((x,i)=>`<article class="card"><input class="check" type="checkbox" data-id="${x.id}" ${state.selected.has(x.id)?"checked":""}><div class="icon">🤖</div><h3 title="${esc(x.name)}">${esc(x.name)}</h3><p>${esc(x.url)}</p><div class="source">${esc(x.source)}</div><div class="cardfoot"><button class="action" data-preview="${x.id}">Preview</button><button class="action green" data-download="${x.id}">Download</button></div></article>`).join(""):`<div class="empty">No accessible bot files found.</div>`;
$("#grid").querySelectorAll("[data-id]").forEach(e=>e.onchange=()=>{const id=e.dataset.id;e.checked?state.selected.add(id):state.selected.delete(id)});
$("#grid").querySelectorAll("[data-preview]").forEach(e=>e.onclick=()=>preview(e.dataset.preview));
$("#grid").querySelectorAll("[data-download]").forEach(e=>e.onclick=()=>downloadOne(e.dataset.download));
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function scan(){
 let input=$("#url").value.trim();if(!/^https?:\/\//i.test(input))input="https://"+input;$("#url").value=input;
 if(!validUrl(input)){toast("Enter a valid URL");return}
 const box=$("#statusBox");box.classList.add("busy");$("#statusTitle").textContent="Scanning…";$("#statusText").textContent="Fetching public page and looking for XML/bot links…";state.items=[];state.selected.clear();render();
 try{
   const r=await fetch(input,{method:"GET"});if(!r.ok)throw new Error("HTTP "+r.status);
   const html=await r.text();const doc=new DOMParser().parseFromString(html,"text/html");const found=new Map();
   doc.querySelectorAll("a[href],area[href],link[href]").forEach(a=>{const href=a.getAttribute("href");if(!href)return;let abs;try{abs=new URL(href,input).href}catch{return}const text=(a.textContent||"").trim();if(looksLikeBot(abs,text)){found.set(abs,{url:abs,name:text||filename(abs),source:input})}});
   doc.querySelectorAll("script").forEach(s=>{const raw=s.textContent||"";const re=/https?:\/\/[^\s"'<>]+\.xml(?:[?#][^\s"'<>]*)?/gi;for(const m of raw.matchAll(re)){const u=m[0].replace(/[),;]+$/,"");found.set(u,{url:u,name:filename(u),source:input})}});
   state.items=[...found.values()].map((x,i)=>({...x,id:"b"+i}));
   $("#statusTitle").textContent="Scan complete";$("#statusText").textContent=`Found ${state.items.length} possible bot/XML links on the accessible page.`;toast(`${state.items.length} possible bots found`);
 }catch(e){$("#statusTitle").textContent="Scan failed";$("#statusText").textContent="The page could not be fetched from this browser. The site may block CORS or require access that frontend-only code cannot bypass.";toast("Unable to scan this site")}
 box.classList.remove("busy");render()
}
async function getXml(item){const r=await fetch(item.url);if(!r.ok)throw new Error("HTTP "+r.status);return await r.text()}
async function downloadOne(id){const x=state.items.find(a=>a.id===id);if(!x)return;try{const xml=await getXml(x);const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([xml],{type:"application/xml"}));a.download=(x.name||"bot.xml").replace(/[^\w.-]+/g,"-");a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast("Download started")}catch{window.open(x.url,"_blank");toast("Direct download opened; browser access may be required")}}
async function preview(id){const x=state.items.find(a=>a.id===id);state.current=x;$("#mtitle").textContent=x.name;$("#msource").textContent=x.url;$("#xml").textContent="Loading…";$("#modal").classList.add("show");try{state.xml=await getXml(x);$("#xml").textContent=state.xml}catch{state.xml="";$("#xml").textContent="This file cannot be fetched by the browser. The source may block cross-origin requests."}}
async function zip(ids){if(!ids.length){toast("Select at least one bot");return}if(!window.JSZip){toast("ZIP library unavailable");return}const zip=new JSZip();let n=0;for(const id of ids){const x=state.items.find(a=>a.id===id);if(!x)continue;try{const xml=await getXml(x);zip.file((x.name||`bot-${n+1}.xml`).replace(/[^\w.-]+/g,"-"),xml);n++}catch{}}if(!n){toast("No files were accessible for ZIP");return}$("#statusTitle").textContent="Creating ZIP…";const blob=await zip.generateAsync({type:"blob"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="deriv-bot-scan.zip";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$("#statusText").textContent=`ZIP created with ${n} accessible file(s).`;toast("ZIP download started")}
$("#scan").onclick=scan;$("#filter").oninput=e=>{state.filter=e.target.value;render()};$("#sort").onchange=e=>{state.sort=e.target.value;render()};
$("#selectAll").onclick=()=>{state.items.forEach(x=>state.selected.add(x.id));render();toast("All results selected")};
$("#downloadSelected").onclick=()=>zip([...state.selected]);$("#downloadAll").onclick=()=>zip(state.items.map(x=>x.id));
$("#close").onclick=()=>$("#modal").classList.remove("show");$("#modal").onclick=e=>{if(e.target.id==="modal")$("#modal").classList.remove("show")};
$("#mdownload").onclick=()=>state.current&&downloadOne(state.current.id);
$("#copy").onclick=async()=>{if(!state.xml)return;try{await navigator.clipboard.writeText(state.xml);toast("XML copied")}catch{toast("Copy unavailable")}};
$("#menu").onclick=()=>document.querySelector("nav").classList.toggle("open");