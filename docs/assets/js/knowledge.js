const API = KNOWHUB.API_BASE;

const chipsEl = document.querySelector('#chips');
const cardEl = document.querySelector('#card');
const lastEl = document.querySelector('#last');
const searchEl = document.querySelector('#search');
const randomBtn = document.querySelector('#random');

let selected = new Set();
let lastQuery = '';

function renderChips(){
  chipsEl.innerHTML = KNOWHUB.SUBJECTS.map(s => 
    `<button class="chip ${selected.has(s)?'active':''}" data-s="${s}">${s}</button>`
  ).join('');
  chipsEl.querySelectorAll('.chip').forEach(b=>{
    b.onclick = ()=>{
      const s = b.dataset.s;
      selected.has(s) ? selected.delete(s) : selected.add(s);
      fetchOne();
      renderChips();
    }
  });
}

function skeleton(){
  return `<div class="skeleton" style="height:220px"></div>`;
}

function sec(title, html){
  if(!html) return '';
  return `
  <hr>
  <h2 style="font-size:18px">${title}</h2>
  <div class="prose">${html}</div>`;
}

function renderItem(x){
  const tags = (x.subject||[]).map(KNOWHUB.tagChip).join(' ');
  cardEl.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <h1 style="font-size:24px">${x.title}</h1>
        <div>${tags}</div>
      </div>
      ${sec('快速重點', x.quick)}
      ${sec('解釋 / 定義', x.definition)}
      ${sec('詳細說明', x.detail)}
      ${sec('常見考點 / 易錯點', x.pitfalls)}
      ${sec('舉例說明', x.examples)}
      <hr>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="link" href="https://www.notion.so/${(x.id||'').replace(/-/g,'')}" target="_blank">在 Notion 開啟</a>
        <button class="btn-outline" id="copy">複製分享連結</button>
      </div>
    </div>
  `;
  document.querySelector('#copy').onclick = ()=>{
    const url = location.origin + location.pathname + '?slug=' + encodeURIComponent(x.slug || x.id);
    navigator.clipboard.writeText(url);
  };
  KNOWHUB.renderMath(cardEl);
  lastEl.textContent = KNOWHUB.fmtDate(x.last_edited_time);
}

async function fetchOne(){
  cardEl.innerHTML = skeleton();
  const subjects = [...selected];
  const q = searchEl.value.trim();
  const url = new URL(q ? API + "/api/knowledge" : API + "/api/knowledge-random");
  subjects.forEach(s=> url.searchParams.append('subject', s));
  if (q) url.searchParams.set('q', q);
  const res = await fetch(url);
  const data = await res.json();
  const item = data?.items?.[0] || data;
  if (!item || !item.id){ cardEl.innerHTML = "<p>沒有資料</p>"; return; }
  renderItem(item);
}

searchEl.addEventListener('input', ()=>{
  const v = searchEl.value.trim();
  if (v !== lastQuery){ lastQuery = v; fetchOne(); }
});
randomBtn.onclick = fetchOne;

renderChips();
fetchOne();
