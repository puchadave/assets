const MANIFEST_URL='assets/img/manifest.json';
const brandGrid=document.getElementById('brand-grid');
const assetList=document.getElementById('asset-list');
const filter=document.getElementById('asset-filter');
const version=document.getElementById('manifest-version');
const brandCount=document.getElementById('brand-count');
const progress=document.getElementById('progress');
const rawPath=document.getElementById('raw-path');
let manifest={brands:[]};

function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
function initials(name=''){return name.split(/[\s._-]+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'•';}
function repoPath(path){return `https://github.com/puchadave/assets/tree/main/${path}`;}
function fallbackMark(b){return `<span class="mark-fallback"><i>${esc(initials(b.name))}</i>${esc(b.name)}</span>`;}

function renderBrands(){
  brandCount.textContent=manifest.brands.length;
  brandGrid.innerHTML=manifest.brands.map(b=>{
    const primary=(b.assets||[]).find(a=>a.role==='primary'&&a.path);
    const mark=primary?`<img src="${esc(primary.path)}" alt="${esc(b.name)} Logo" onerror="this.outerHTML='${fallbackMark(b).replace(/'/g,'&#39;')}'">`:fallbackMark(b);
    const accent=b.accent?`style="--brand-accent:${esc(b.accent)}"`:'';
    return `<article class="brand-card" ${accent}>
      <div class="mark">${mark}</div>
      <div class="brand-meta"><div><h3>${esc(b.name)}</h3><p>${esc(b.description)}</p></div><span class="brand-type">${esc(b.type)}</span></div>
      <div class="brand-links"><a href="#assets" data-brand="${esc(b.id)}">Assets</a><a href="${esc(repoPath(b.path))}">Source ↗</a></div>
    </article>`;
  }).join('');
  document.querySelectorAll('[data-brand]').forEach(a=>a.addEventListener('click',()=>{filter.value=a.dataset.brand;renderAssets(a.dataset.brand);}));
}

function flattenAssets(){
  return manifest.brands.flatMap(b=>(b.assets||[]).map(a=>({...a,brand:b.name,brandId:b.id,base:b.path})));
}
function renderAssets(q=''){
  const needle=q.trim().toLowerCase();
  const rows=flattenAssets().filter(a=>!needle||[a.brand,a.brandId,a.role,a.format,a.path,a.label].join(' ').toLowerCase().includes(needle));
  if(!rows.length){assetList.innerHTML='<div class="asset-row"><div><strong>Keine passenden Assets im Manifest</strong><small>Neue Dateien werden über assets/img/manifest.json registriert.</small></div></div>';return;}
  assetList.innerHTML=rows.map(a=>`<div class="asset-row"><div><strong>${esc(a.brand)} · ${esc(a.label||a.role||'Asset')}</strong><small>${esc((a.role||'asset').toUpperCase())} · ${esc((a.format||'').toUpperCase())}</small></div><code>${esc(a.path||a.base)}</code><a href="${esc(a.path||repoPath(a.base))}">Öffnen ↗</a></div>`).join('');
}

async function loadManifest(){
  try{
    const r=await fetch(`${MANIFEST_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    manifest=await r.json();
    version.textContent=`manifest ${manifest.version||'–'}`;
    renderBrands();renderAssets();
  }catch(e){
    brandGrid.innerHTML='<article class="brand-card"><div class="mark"><span class="mark-fallback"><i>!</i>Manifest</span></div><h3>Brand-Manifest nicht verfügbar</h3><p>Die Portalstruktur ist online, aber assets/img/manifest.json konnte nicht geladen werden.</p></article>';
    assetList.innerHTML='<div class="asset-row"><strong>Manifest konnte nicht geladen werden.</strong></div>';
    console.error(e);
  }
}

filter?.addEventListener('input',e=>renderAssets(e.target.value));
document.getElementById('copy-path')?.addEventListener('click',async e=>{try{await navigator.clipboard.writeText(rawPath.textContent);e.currentTarget.textContent='Kopiert';setTimeout(()=>e.currentTarget.textContent='Kopieren',1200)}catch{}});
window.addEventListener('scroll',()=>{const h=document.documentElement.scrollHeight-innerHeight;progress.style.width=`${h>0?(scrollY/h)*100:0}%`;},{passive:true});
window.addEventListener('pointermove',e=>{document.documentElement.style.setProperty('--mx',`${e.clientX}px`);document.documentElement.style.setProperty('--my',`${e.clientY}px`);},{passive:true});
loadManifest();
