const API = KNOWHUB.API_BASE;
const chipsEl = document.querySelector('#chips');
const listEl = document.querySelector('#list');
const searchEl = document.querySelector('#search');

const modal = document.querySelector('#modal');
const mTitle = document.querySelector('#m-title');
const mTags = document.querySelector('#m-tags');
const mBody = document.querySelector('#m-body');
document.querySelector('#m-close').onclick = ()=> modal.style.display = "none";
modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.style.display="none"; });

let selected = new Set();
let cache = [];

function renderChips(){
  chipsEl.innerHTML = KNOWHUB.SUBJECTS.map(s => 
    `<button class="chip ${selected.has(s)?'active':''}" data-s="${s}">${s}</button>`
  ).join('');
  chipsEl.querySelectorAll('.chip').forEach(b=>{
    b.onclick = ()=>{
      const s = b.dataset.s;
      selected.has(s) ? selected.delete(s) : selected.add(s);
      fetchList();
      renderChips();
    }
  });
}

function itemRow(x){
  const tags = (x.subject||[]).map(KNOWHUB.tagChip).join(' ');
  const summary = (x.content||"").replace(/<[^>]+>/g,"").slice(0,120);
  return `
  <div style="padding:10px 0;border-bottom:1px solid #233041">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
      <a href="javascript:void 0" class="link" data-id="${x.id}">${x.title}</a>
      <div>${tags}</div>
    </div>
    <div style="color:#9aa8bf;margin-top:4px">${summary}...</div>
  </div>`;
}

function openModal(x){
  mTitle.textContent = x.title;
  mTags.innerHTML = (x.subject||[]).map(KNOWHUB.tagChip).join(' ');
  mBody.innerHTML = x.content || "";
  KNOWHUB.renderMath(mBody);
  modal.style.display = "flex";
}

function renderList(items){
  listEl.innerHTML = items.map(itemRow).join('') || `<div style="opacity:.7">查無結果</div>`;
  listEl.querySelectorAll('a.link').forEach(a=>{
    a.onclick = ()=>{
      const id = a.getAttribute('data-id');
      const found = cache.find(x=>x.id===id);
      if(found) openModal(found);
    };
  });
}

async function fetchList(){
  const subjects = [...selected];
  const q = new URL(location.href).searchParams.get('q') || searchEl.value.trim();
  const url = new URL(API + "/api/notes");
  subjects.forEach(s => url.searchParams.append('subject', s));
  if (q) url.searchParams.set('q', q);
  const r = await fetch(url);
  const data = await r.json();
  cache = data.items || [];
  renderList(cache);
}

searchEl.addEventListener('input', ()=> fetchList());
renderChips();
fetchList();
