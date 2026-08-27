const REPO_BASE='https://github.com/puchadave/assets';
const RAW_BASE='https://raw.githubusercontent.com/puchadave/assets/main/';
const MANIFEST_URL=`${RAW_BASE}assets/img/manifest.json`;

const byId=id=>document.getElementById(id);
const each=(selector,fn)=>document.querySelectorAll(selector).forEach(fn);
const on=(selector,type,fn,opts)=>each(selector,el=>el.addEventListener(type,fn,opts));

const brandGrid=byId('brand-grid');
const assetList=byId('asset-list');
const filter=byId('asset-filter');
const version=byId('manifest-version');
const brandCount=byId('brand-count');
const progress=byId('progress');
const rawPath=byId('raw-path');
let manifest={brands:[],canonicalRawBase:RAW_BASE};

function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function initials(name=''){return name.split(/[\s._-]+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'•';}
function repoPath(path=''){return `${REPO_BASE}/tree/main/${path}`;}
function rawAsset(path=''){return `${manifest.canonicalRawBase||RAW_BASE}${path}`;}
function markFallback(label){return `<span class="mark-fallback"><i>${esc(initials(label))}</i>${esc(label)}</span>`;}
function assetRow(inner){return `<div class="asset-row">${inner}</div>`;}
function assetNotice(title,hint=''){return assetRow(`<div><strong>${esc(title)}</strong>${hint?`<small>${esc(hint)}</small>`:''}</div>`);}

function renderBrands(){
  brandCount.textContent=manifest.brands.length;
  brandGrid.innerHTML=manifest.brands.map(b=>{
    const primary=(b.assets||[]).find(a=>a.role==='primary'&&a.path);
    const mark=primary
      ? `<img class="brand-logo" src="${esc(rawAsset(primary.path))}" alt="${esc(b.name)} Logo" data-brand-id="${esc(b.id)}">`
      : markFallback(b.name);
    const accent=b.accent?`style="--brand-accent:${esc(b.accent)}"`:'';
    return `<article class="brand-card" ${accent}>
      <div class="mark">${mark}</div>
      <div class="brand-meta"><div><h3>${esc(b.name)}</h3><p>${esc(b.description)}</p></div><span class="brand-type">${esc(b.type)}</span></div>
      <div class="brand-links"><a href="#assets" data-brand="${esc(b.id)}">Assets</a><a href="${esc(repoPath(b.path))}">Source ↗</a></div>
    </article>`;
  }).join('');

  on('.brand-logo','error',e=>{
    const img=e.currentTarget;
    const b=manifest.brands.find(x=>x.id===img.dataset.brandId);
    if(b)img.closest('.mark').innerHTML=markFallback(b.name);
  },{once:true});

  on('[data-brand]','click',e=>{
    const id=e.currentTarget.dataset.brand;
    filter.value=id;
    renderAssets(id);
  });
}

function flattenAssets(){
  return manifest.brands.flatMap(b=>(b.assets||[]).map(a=>({...a,brand:b.name,brandId:b.id,base:b.path})));
}

function renderAssets(q=''){
  const needle=q.trim().toLowerCase();
  const rows=flattenAssets().filter(a=>!needle||[a.brand,a.brandId,a.role,a.format,a.path,a.label].join(' ').toLowerCase().includes(needle));
  if(!rows.length){
    assetList.innerHTML=assetNotice('Keine passenden Assets im Manifest','Neue Dateien werden über assets/img/manifest.json registriert.');
    return;
  }
  assetList.innerHTML=rows.map(a=>{
    const isFile=Boolean(a.path);
    const target=isFile?rawAsset(a.path):repoPath(a.base);
    return assetRow(`<div><strong>${esc(a.brand)} · ${esc(a.label||a.role||'Asset')}</strong><small>${esc((a.role||'asset').toUpperCase())} · ${esc((a.format||'').toUpperCase())}</small></div><code>${esc(a.path||a.base)}</code><a href="${esc(target)}">Öffnen ↗</a>`);
  }).join('');
}

async function loadManifest(){
  try{
    const r=await fetch(`${MANIFEST_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    manifest=await r.json();
    version.textContent=`manifest ${manifest.version||'–'}`;
    renderBrands();
    renderAssets();
  }catch(e){
    brandGrid.innerHTML='<article class="brand-card"><div class="mark"><span class="mark-fallback"><i>!</i>Manifest</span></div><h3>Brand-Manifest nicht verfügbar</h3><p>Die Portalstruktur ist online, aber das kanonische Brand-Manifest konnte nicht geladen werden.</p></article>';
    assetList.innerHTML=assetNotice('Manifest konnte nicht geladen werden.');
    console.error(e);
  }
}

filter?.addEventListener('input',e=>renderAssets(e.target.value));
byId('copy-path')?.addEventListener('click',async e=>{
  try{
    await navigator.clipboard.writeText(rawPath.textContent);
    e.currentTarget.textContent='Kopiert';
    setTimeout(()=>e.currentTarget.textContent='Kopieren',1200);
  }catch{}
});
window.addEventListener('scroll',()=>{
  const h=document.documentElement.scrollHeight-innerHeight;
  progress.style.width=`${h>0?(scrollY/h)*100:0}%`;
},{passive:true});
window.addEventListener('pointermove',e=>{
  document.documentElement.style.setProperty('--mx',`${e.clientX}px`);
  document.documentElement.style.setProperty('--my',`${e.clientY}px`);
},{passive:true});
loadManifest();
