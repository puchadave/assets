const MANIFEST_URL='https://raw.githubusercontent.com/puchadave/assets/main/assets/img/manifest.json';
const brandGrid=document.getElementById('brand-grid');
const assetList=document.getElementById('asset-list');
const filter=document.getElementById('asset-filter');
const version=document.getElementById('manifest-version');
const brandCount=document.getElementById('brand-count');
const progress=document.getElementById('progress');
const rawPath=document.getElementById('raw-path');
const MANIFEST_TIMEOUT_MS=15000;
let manifest={brands:[],canonicalRawBase:'https://raw.githubusercontent.com/puchadave/assets/main/'};

for(const [id,el] of Object.entries({'brand-grid':brandGrid,'asset-list':assetList,'asset-filter':filter,'manifest-version':version,'brand-count':brandCount,'progress':progress,'raw-path':rawPath})){
  if(!el)console.error(`brand.js: missing element #${id}; related portal features are disabled.`);
}

function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function initials(name=''){return name.split(/[\s._-]+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'•';}
function repoPath(path=''){return `https://github.com/puchadave/assets/tree/main/${path}`;}
function rawAsset(path=''){return `${manifest.canonicalRawBase||'https://raw.githubusercontent.com/puchadave/assets/main/'}${path}`;}
function fallbackMark(b){return `<span class="mark-fallback"><i>${esc(initials(b.name))}</i>${esc(b.name)}</span>`;}

function brands(){return Array.isArray(manifest.brands)?manifest.brands:[];}

function renderBrands(){
  if(!brandGrid)return;
  if(brandCount)brandCount.textContent=brands().length;
  brandGrid.innerHTML=brands().map(b=>{
    const primary=(b.assets||[]).find(a=>a.role==='primary'&&a.path);
    const mark=primary
      ? `<img class="brand-logo" src="${esc(rawAsset(primary.path))}" alt="${esc(b.name)} Logo" data-brand-id="${esc(b.id)}">`
      : fallbackMark(b);
    const accent=b.accent?`style="--brand-accent:${esc(b.accent)}"`:'';
    return `<article class="brand-card" ${accent}>
      <div class="mark">${mark}</div>
      <div class="brand-meta"><div><h3>${esc(b.name)}</h3><p>${esc(b.description)}</p></div><span class="brand-type">${esc(b.type)}</span></div>
      <div class="brand-links"><a href="#assets" data-brand="${esc(b.id)}">Assets</a><a href="${esc(repoPath(b.path))}">Source ↗</a></div>
    </article>`;
  }).join('');

  document.querySelectorAll('.brand-logo').forEach(img=>{
    img.addEventListener('error',()=>{
      const b=brands().find(x=>x.id===img.dataset.brandId);
      const mark=img.closest('.mark');
      console.warn(`brand.js: logo for "${img.dataset.brandId}" could not be loaded (${img.src}).`);
      if(b&&mark)mark.innerHTML=fallbackMark(b);
    },{once:true});
  });

  document.querySelectorAll('[data-brand]').forEach(a=>a.addEventListener('click',()=>{
    if(filter)filter.value=a.dataset.brand;
    renderAssets(a.dataset.brand);
  }));
}

function flattenAssets(){
  return brands().flatMap(b=>(b.assets||[]).map(a=>({...a,brand:b.name,brandId:b.id,base:b.path})));
}

function renderAssets(q=''){
  if(!assetList)return;
  const needle=q.trim().toLowerCase();
  const rows=flattenAssets().filter(a=>!needle||[a.brand,a.brandId,a.role,a.format,a.path,a.label].join(' ').toLowerCase().includes(needle));
  if(!rows.length){
    assetList.innerHTML='<div class="asset-row"><div><strong>Keine passenden Assets im Manifest</strong><small>Neue Dateien werden über assets/img/manifest.json registriert.</small></div></div>';
    return;
  }
  assetList.innerHTML=rows.map(a=>{
    const isFile=Boolean(a.path);
    const target=isFile?rawAsset(a.path):repoPath(a.base);
    return `<div class="asset-row"><div><strong>${esc(a.brand)} · ${esc(a.label||a.role||'Asset')}</strong><small>${esc((a.role||'asset').toUpperCase())} · ${esc((a.format||'').toUpperCase())}</small></div><code>${esc(a.path||a.base)}</code><a href="${esc(target)}">Öffnen ↗</a></div>`;
  }).join('');
}

async function fetchManifest(){
  const r=await fetch(`${MANIFEST_URL}?v=${Date.now()}`,{cache:'no-store',signal:AbortSignal.timeout?.(MANIFEST_TIMEOUT_MS)});
  if(!r.ok)throw new Error(`HTTP ${r.status} ${r.statusText} für ${MANIFEST_URL}`);
  let data;
  try{
    data=await r.json();
  }catch(e){
    throw new Error(`Manifest ist kein gültiges JSON: ${e.message}`,{cause:e});
  }
  if(!data||!Array.isArray(data.brands))throw new Error('Manifest enthält kein "brands"-Array.');
  return data;
}

function showManifestError(e){
  const reason=e?.name==='TimeoutError'?`Zeitüberschreitung nach ${MANIFEST_TIMEOUT_MS/1000}s`:e?.message||String(e);
  console.error('brand.js: Brand-Manifest konnte nicht geladen werden.',e);
  if(version)version.textContent='manifest nicht verfügbar';
  if(brandGrid)brandGrid.innerHTML=`<article class="brand-card"><div class="mark"><span class="mark-fallback"><i>!</i>Manifest</span></div><h3>Brand-Manifest nicht verfügbar</h3><p>Die Portalstruktur ist online, aber das kanonische Brand-Manifest konnte nicht geladen werden.</p><p><code>${esc(reason)}</code></p></article>`;
  if(assetList)assetList.innerHTML=`<div class="asset-row"><div><strong>Manifest konnte nicht geladen werden.</strong><small>${esc(reason)}</small></div></div>`;
}

async function loadManifest(){
  try{
    manifest=await fetchManifest();
  }catch(e){
    showManifestError(e);
    return;
  }
  try{
    if(version)version.textContent=`manifest ${manifest.version||'–'}`;
    renderBrands();
    renderAssets();
  }catch(e){
    showManifestError(new Error(`Manifest konnte nicht gerendert werden: ${e.message}`,{cause:e}));
  }
}

filter?.addEventListener('input',e=>renderAssets(e.target.value));
document.getElementById('copy-path')?.addEventListener('click',async e=>{
  const button=e.currentTarget;
  const reset=()=>setTimeout(()=>{button.textContent='Kopieren';},1600);
  try{
    if(!rawPath)throw new Error('Element #raw-path fehlt.');
    if(!navigator.clipboard)throw new Error('Clipboard-API nicht verfügbar (benötigt HTTPS).');
    await navigator.clipboard.writeText(rawPath.textContent);
    button.textContent='Kopiert';
  }catch(err){
    console.error('brand.js: Pfad konnte nicht kopiert werden.',err);
    button.textContent='Kopieren fehlgeschlagen';
  }
  reset();
});
if(progress){
  window.addEventListener('scroll',()=>{
    const h=document.documentElement.scrollHeight-innerHeight;
    progress.style.width=`${h>0?(scrollY/h)*100:0}%`;
  },{passive:true});
}
window.addEventListener('pointermove',e=>{
  document.documentElement.style.setProperty('--mx',`${e.clientX}px`);
  document.documentElement.style.setProperty('--my',`${e.clientY}px`);
},{passive:true});
loadManifest();
