/* KnowHub — Knowledge (CSV-sections + enhanced UI) 2025-10-11
 * - Random button fixed at top-right (all devices)
 * - CSV-driven section groups (優先使用 CSV 欄位拆分)
 * - Fallback to H2/H3 sectionizing when CSV無對應欄位
 * - Mobile drawer sidenav with overlay & independent scrolling
 * - On load: auto random once
 */

// ===== Config =====
const CSV_INDEX = (window.KNOWHUB && window.KNOWHUB.CSV_INDEX) || "./assets/data/notes.csv";
const SUBJECT_ORDER = (window.KNOWHUB && window.KNOWHUB.SUBJECTS) || ["國文","英文","數學","物理","化學","生物","地球科學"];
const CANON_ANCHORS  = ["快速重點","解釋/定義","詳細說明","常見考點/易錯點","舉例說明"]; // 正規化後的標準鍵

// ===== DOM =====
const sidenav    = document.querySelector(".kh-sidenav");
const toggleBtn  = document.getElementById("sidenav-toggle");
const sideSearch = document.getElementById("side-search");
const treeNav    = document.getElementById("nav-tree");
const cardHost   = document.getElementById("knowledge-card");
const btnRandomInline  = document.getElementById("btn-random"); // 可能不存在（舊 toolbar）
const btnRandomFixed   = document.getElementById("btn-random-fixed");
const randomChecksHost = document.getElementById("random-subjects");

// ===== State =====
let INDEX = [];                 // [{id,title,subject:[],createdAt?,sections?:{anchor:string->text}, _fileGuess:string[]}]
let FILTER_Q = "";
let CURRENT_PAGE_ID = null;
let RANDOM_SUBJECTS = new Set(SUBJECT_ORDER);

// ===== Utils =====
const escapeHTML = (s)=> (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]||m));
const debounce = (fn,ms=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const toSlug = (s)=> (s||"").trim().replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g,"-");
async function fetchText(url){
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}

// ===== Subject Colors =====
const SUBJECT_COLOR_MAP = {
  "國文":"#E3556B","英文":"#4D9DE0","數學":"#6C5CE7","物理":"#00BCD4","化學":"#00B894","生物":"#55D6BE","地球科學":"#FFA62B","未分類":"#9E9E9E"
};
function subjectColor(s){
  if (SUBJECT_COLOR_MAP[s]) return SUBJECT_COLOR_MAP[s];
  let h=0; for (let i=0;i<s.length;i++) h=(h*31 + s.charCodeAt(i))>>>0;
  const hue = h%360; return `hsl(${hue},70%,55%)`;
}

// ===== CSV =====
function parseCSV(text){
  const rows=[]; let i=0, field="", row=[], inQ=false;
  const push = ()=>{ row.push(field); field=""; };
  while(i<text.length){
    const c=text[i];
    if (inQ){
      if (c==='"' && text[i+1]==='"'){ field+='"'; i+=2; continue; }
      if (c==='"'){ inQ=false; i++; continue; }
      field+=c; i++; continue;
    } else {
      if (c==='"'){ inQ=true; i++; continue; }
      if (c===','){ push(); i++; continue; }
      if (c==='\n'){ push(); rows.push(row); row=[]; i++; continue; }
      if (c==='\r'){ i++; continue; }
      field+=c; i++; continue;
    }
  }
  push(); rows.push(row);
  const header = (rows.shift()||[]).map(s=>s.trim());
  return rows.filter(r=>r.length && r.some(x=>x!=="" && x!=null)).map(r=>{
    const obj={}; header.forEach((h,idx)=> obj[h]=r[idx]!==undefined ? r[idx] : ""); return obj;
  });
}

// 正規化錨點（回傳標準鍵或 null）
function normalizeAnchor(raw){
  if (!raw) return null;
  const t = String(raw)
    .trim().replace(/\s+/g,"")
    .replace(/[／]/g,"/")
    .toLowerCase();
  if (t==="快速重點"||t==="重點") return "快速重點";
  if (t==="解釋/定義"||t==="解釋"||t==="定義") return "解釋/定義";
  if (t==="詳細說明"||t==="說明"||t==="內容") return "詳細說明";
  if (t==="常見考點/易錯點"||t==="常見考點"||t==="易錯點") return "常見考點/易錯點";
  if (t==="舉例說明"||t==="範例"||t==="例子") return "舉例說明";
  return null;
}

function collectSectionsFromRow(r){
  const sections = {}; // {canon: text}
  for (const [k,v] of Object.entries(r)){
    const canon = normalizeAnchor(k);
    if (!canon) continue;
    const val = (v||"").trim();
    if (!val) continue;
    sections[canon] = sections[canon] ? (sections[canon] + "\n\n" + val) : val;
  }
  return sections;
}

function csvRowToItem(r){
  const title = r.title || r.標題 || r.name || r.Name || "";
  if (!title) return null;
  const subjRaw = r.subject || r.科目 || r.標籤 || "";
  const subjects = subjRaw ? subjRaw.split(/[;,/、\s]+/).filter(Boolean) : [];
  const id = (r.id || r.pageId || r.notionId || "").trim() || toSlug(title);
  const file = (r.file || r.filename || r.path || r.檔案 || "").trim();
  const createdAt = (r.created || r.建立時間 || r.Created || r.date || "").trim();

  const g = [];
  if (file) g.push(prefixGuess(file));
  g.push(`./assets/data/pages/${id}.md`);
  g.push(`./assets/data/pages/${id}.html`);
  g.push(`./assets/data/pages/${toSlug(title)}.md`);
  g.push(`./assets/data/pages/${toSlug(title)}.html`);

  const sections = collectSectionsFromRow(r);
  return { id, title, subject: subjects, createdAt, sections, _fileGuess: g };
}
function prefixGuess(file){
  if (!file) return file;
  if (file.includes("/") || file.includes("\\")) return file;
  return `./assets/data/pages/${file}`;
}

// ===== Sidebar & Search =====
function groupBySubject(items){
  const map = new Map();
  items.forEach(x=>{
    const subs = x.subject?.length ? x.subject : ["未分類"];
    subs.forEach(s=>{ if(!map.has(s)) map.set(s,[]); map.get(s).push(x); });
  });
  for (const [,arr] of map) arr.sort((a,b)=>a.title.localeCompare(b.title,"zh-Hant"));
  const ordered = [];
  const set = new Set(map.keys());
  SUBJECT_ORDER.forEach(s=>{ if(set.has(s)) { ordered.push([s,map.get(s)]); set.delete(s); }});
  [...set].sort((a,b)=>a.localeCompare(b,"zh-Hant")).forEach(s=>ordered.push([s,map.get(s)]));
  return ordered;
}

function renderTree(){
  const q = (FILTER_Q||"").trim().toLowerCase();
  const filtered = q ? INDEX.filter(x=>(x.title||"").toLowerCase().includes(q)) : INDEX;

  treeNav.innerHTML = "";
  for (const [sub, arr] of groupBySubject(filtered)){
    const details = document.createElement("details");
    details.className = "group";
    details.open = false;
    details.innerHTML = `
      <summary>
        <span class="chip chip--sub" style="--chip-color:${subjectColor(sub)}">${escapeHTML(sub)}</span>
        <span class="count">${arr.length}</span>
      </summary>
      <div class="items" role="list"></div>`;
    const box = details.querySelector(".items");

    arr.forEach(it=>{
      const a = document.createElement("a");
      a.className = "item";
      a.href = "javascript:void(0)";
      a.dataset.id = it.id;
      a.textContent = it.title || "(未命名)";
      a.addEventListener("click", ()=>{
        loadPage(it.id, it);
        treeNav.querySelectorAll(".item.active").forEach(x=>x.classList.remove("active"));
        a.classList.add("active");
        if (!details.open) details.open = true;
      });
      box.appendChild(a);
    });
    treeNav.appendChild(details);
  }

  if (CURRENT_PAGE_ID){
    const hit = treeNav.querySelector(`.item[data-id="${CURRENT_PAGE_ID}"]`);
    if (hit){ treeNav.querySelectorAll(".item.active").forEach(x=>x.classList.remove("active"));
      hit.classList.add("active"); hit.closest("details")?.setAttribute("open",""); }
  }
  enableSingleOpenInTree(document);
  installMobileDrawer();
}

function enableSingleOpenInTree(root = document) {
  const tree = root.querySelector('.kh-tree');
  if (!tree) return;
  tree.querySelectorAll('details').forEach(d => { d.open = false; });
  tree.addEventListener('toggle', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLDetailsElement)) return;
    if (!target.open) return;
    const parent = target.parentElement;
    if (!parent) return;
    parent.querySelectorAll(':scope > details[open]').forEach(d => {
      if (d !== target) d.open = false;
    });
  }, true);
}

// ===== Math =====
function waitForKatexReady(timeout=8000){
  return new Promise((res,rej)=>{ const t0=Date.now(); (function loop(){ if (window.katex) return res(); if (Date.now()-t0>timeout) return rej(); setTimeout(loop,50); })(); });
}
async function renderMath(scope=document){
  try{ await waitForKatexReady(); }catch{}
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if (!n.nodeValue || !n.nodeValue.includes("$")) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest("code, pre, a, .katex")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const list=[]; while(walker.nextNode()) list.push(walker.currentNode);
  list.forEach(tn=>{
    const parts = tn.nodeValue.split(/(\$[^$]+\$)/g);
    if (parts.length===1) return;
    const frag = document.createDocumentFragment();
    parts.forEach(seg=>{
      if (!seg) return;
      if (seg.startsWith("$") && seg.endsWith("$") && seg.length>2){
        const span=document.createElement("span"); span.textContent=seg; span.className="math-inline"; frag.appendChild(span);
      } else frag.appendChild(document.createTextNode(seg));
    });
    tn.parentNode.replaceChild(frag, tn);
  });
  scope.querySelectorAll(".math-inline").forEach(el=>{
    if (el.dataset.kRendered==="1" || el.querySelector(".katex")) return;
    const tex=(el.textContent||"").trim().replace(/^\$|\$$/g,""); if(!tex) return;
    try{ window.katex.render(tex, el, {displayMode:false, throwOnError:false}); el.dataset.kRendered="1"; }catch{}
  });
  scope.querySelectorAll(".math").forEach(el=>{
    if (el.dataset.kRendered==="1" || el.querySelector(".katex")) return;
    const tex=(el.textContent||"").trim().replace(/^\$\$|\$\$$/g,""); if(!tex) return;
    try{ window.katex.render(tex, el, {displayMode:true, throwOnError:false}); el.dataset.kRendered="1"; }catch{}
  });
}

// ===== Markdown mini
function mdToHtml(md){
  if (!md) return "";
  const esc = (t)=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = md.split(/\r?\n/);
  const out=[];
  for (const ln of lines){
    if (!ln.trim()) { out.push(""); continue; }
    if (ln.trim()==="---") { out.push(""); continue; }
    if (ln.startsWith("### ")) out.push("<h3>"+esc(ln.slice(4))+"</h3>");
    else if (ln.startsWith("## ")) out.push("<h2>"+esc(ln.slice(3))+"</h2>");
    else if (ln.startsWith("# ")) out.push("<h1>"+esc(ln.slice(2))+"</h1>");
    else out.push("<p>"+esc(ln)+"</p>");
  }
  return out.join("\n");
}

// ===== Render helpers =====
function sectionClassByTitle(name){
  switch(name){
    case "快速重點": return "sec--highlight";
    case "解釋/定義": return "sec--define";
    case "詳細說明": return "sec--details";
    case "常見考點/易錯點": return "sec--pitfalls";
    case "舉例說明": return "sec--examples";
    default: return "sec--generic";
  }
}

function renderTitleHeader(meta){
  const chips = (meta.subject && meta.subject.length)
    ? `<div class="page-chips">` + meta.subject.map(s=>(`<span class="chip" style="--chip-color:${subjectColor(s)}">${escapeHTML(s)}</span>`)).join("") + `</div>`
    : `<div class="page-chips"></div>`;
  const created = meta.createdAt ? `<div class="page-meta">${escapeHTML(meta.createdAt)}</div>` : "";
  return `<div class="page-title-card">
      <div class="page-title">《${escapeHTML(meta.title||"(未命名)")}》</div>
      ${chips}
      ${created}
    </div>`;
}

function fromCSVSections(meta){
  const order = CANON_ANCHORS;
  const blocks = [];
  let hasContent = false;
  for (const key of order){
    const txt = meta.sections?.[key];
    if (!txt) continue;
    hasContent = true;
    const html = mdToHtml(txt);
    const wrap = `<div class="section-card ${sectionClassByTitle(key)}">
        <div class="section-card__title">${key}</div>
        <div class="prose">${html}</div>
      </div>`;
    blocks.push(wrap);
  }
  return { hasContent, html: blocks.join("") };
}


function fromFileSections(meta, html){
  const temp = document.createElement("div");
  temp.innerHTML = html;
  // 清掉只有 '---' 和與標題相同的 heading、以及中繼資料行
  const pageTitle = (meta.title||"").trim();
  temp.querySelectorAll("p").forEach(p=>{
    const t=(p.textContent||"").trim();
    if (t==="---" || /^(建立時間|科目)\s*[:：]/.test(t)) p.remove();
  });
  if (pageTitle){
    temp.querySelectorAll("h1,h2,h3").forEach(h=>{
      if ((h.textContent||"").trim()===pageTitle) h.remove();
    });
  }

  const blocks = Array.from(temp.childNodes).filter(n => !(n.nodeType===3 && !String(n.nodeValue).trim()));
  const isHeading = el => el && el.nodeType===1 && /H1|H2|H3/.test(el.tagName);

  const sections=[]; let i=0;
  while(i<blocks.length){
    if (isHeading(blocks[i])){
      const heading = blocks[i];
      const rawTitle = (heading.textContent||"").trim();
      const title = normalizeAnchor(rawTitle) || rawTitle;
      const nodes=[]; i++;
      while(i<blocks.length){
        if (isHeading(blocks[i])) break;
        nodes.push(blocks[i]); i++;
      }
      const body = document.createElement("div"); body.className="prose";
      nodes.forEach(n=>body.appendChild(n.cloneNode(true)));
      body.querySelectorAll("p").forEach(p=>{
        const t=(p.textContent||"").trim();
        if (t && !t.includes("：")) p.classList.add("indent-1");
      });
      // 內文群組卡片
      const secTitleHTML = `<div class="section-card__title">${escapeHTML(title)}</div>`;
      sections.push(`<div class="section-card ${sectionClassByTitle(normalizeAnchor(rawTitle)||"")}">
        ${secTitleHTML}
        ${body.outerHTML}
      </div>`);
      continue;
    }
    i++;
  }

  if (!sections.length){
    // Fallback：若無任何分段，包一張卡，但不顯示「內容」標題
    const body = document.createElement("div"); body.className="prose"; body.innerHTML = temp.innerHTML;
    body.querySelectorAll("p").forEach(p=>{ const t=(p.textContent||"").trim(); if (t && !t.includes("：")) p.classList.add("indent-1"); });
    sections.push(`<div class="section-card sec--generic">${body.outerHTML}</div>`);
  }
  return { hasContent: true, html: sections.join("") };
}

function showSkeleton(h=220){
  if (!cardHost) return;
  cardHost.innerHTML = `<div class="skeleton" style="height:${h}px"></div>`;
}
function showError(msg){
  if (!cardHost) return;
  const safe = (msg||"").toString();
  cardHost.innerHTML = `<div class="section-card sec--generic">
    <div class="section-card__title">讀取失敗</div>
    <div class="prose"><p>${escapeHTML(safe)}</p></div>
  </div>`;
}


async function loadRandom(){
  if (!INDEX.length) { await bootstrap(); }
  const pool = INDEX;
  if (!pool.length){ showError("列表為空"); return; }
  const pick = pool[Math.floor(Math.random()*pool.length)];
  await loadPage(pick.id, pick);
}

// ===== Events & Bootstrap =====
toggleBtn?.addEventListener("click", ()=>{
  const open = sidenav.getAttribute("data-open")!=="false";
  const next = open ? "false" : "true";
  sidenav.setAttribute("data-open", next);
  toggleBtn.setAttribute("aria-expanded", (next==="true").toString());
});
sideSearch?.addEventListener("input", debounce(()=>{
  FILTER_Q = sideSearch.value || "";
  renderTree();
}, 120));

btnRandomInline?.addEventListener("click", loadRandom);
btnRandomFixed?.addEventListener("click", loadRandom);

function renderRandomChecks(){ randomChecksHost && (randomChecksHost.innerHTML = ""); }

function installMobileDrawer() {
  if (document.querySelector('.kh-drawer-overlay') &&
      document.querySelector('.kh-drawer-toggle')) return;

  const overlay = document.createElement('div');
  overlay.className = 'kh-drawer-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.appendChild(overlay);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'kh-drawer-toggle';
  btn.setAttribute('aria-label', '開啟類別');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '☰';
  document.body.appendChild(btn);

  const sidenav = document.querySelector('.kh-sidenav');
  if (!sidenav) return;

  const openDrawer = () => {
    document.documentElement.classList.add('kh-drawer-open');
    sidenav.setAttribute('data-open', 'true');
    btn.setAttribute('aria-expanded', 'true');
  };
  const closeDrawer = () => {
    document.documentElement.classList.remove('kh-drawer-open');
    sidenav.setAttribute('data-open', 'false');
    btn.setAttribute('aria-expanded', 'false');
  };
  const toggleDrawer = () => {
    const isOpen = document.documentElement.classList.contains('kh-drawer-open');
    isOpen ? closeDrawer() : openDrawer();
  };

  btn.addEventListener('click', toggleDrawer);
  overlay.addEventListener('click', closeDrawer);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  const mq = matchMedia('(max-width: 820px)');
  const handleMQ = () => {
    if (mq.matches) {
      closeDrawer();
      btn.style.display = 'inline-flex';
      overlay.style.display = '';
    } else {
      document.documentElement.classList.remove('kh-drawer-open');
      sidenav.setAttribute('data-open', 'true');
      btn.setAttribute('aria-expanded', 'true');
      btn.style.display = 'none';
      overlay.style.display = 'none';
    }
  };
  mq.addEventListener('change', handleMQ);
  handleMQ();
}

function rememberScrollPositions() {
  const side = document.querySelector('.kh-sidenav');
  const main = document.querySelector('.kh-content') || document.querySelector('.kh-main') || document.querySelector('#kh-content');
  const K = { side: 'kh-scroll-sidenav', main: 'kh-scroll-main' };

  const load = (el, key) => {
    try {
      const y = parseFloat(localStorage.getItem(key) || '0');
      if (el) el.scrollTop = y;
    } catch {}
  };
  const save = (el, key) => {
    if (!el) return;
    let raf = 0;
    const tick = () => {
      try { localStorage.setItem(key, String(el.scrollTop)); } catch {}
    };
    el.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    });
  };
  load(side, K.side); load(main, K.main);
  save(side, K.side); save(main, K.main);
}

// 右下角上下捲動按鈕
function ensureScrollButtons(){
  if (document.querySelector(".kh-fab")) return;
  const wrap = document.createElement("div");
  wrap.className = "kh-fab";
  wrap.innerHTML = `
    <button class="fab fab--up" aria-label="到頂端">↑</button>
    <button class="fab fab--down" aria-label="到底部">↓</button>
  `;
  document.body.appendChild(wrap);

  const mainScroller = document.querySelector(".kh-content") || document.querySelector(".kh-main") || document.scrollingElement || document.body;

  wrap.querySelector(".fab--up").addEventListener("click", ()=> {
    if (mainScroller === document.scrollingElement) {
      window.scrollTo({top:0, behavior:"smooth"});
    } else {
      mainScroller.scrollTo({top:0, behavior:"smooth"});
    }
  });
  wrap.querySelector(".fab--down").addEventListener("click", ()=> {
    const target = (mainScroller === document.scrollingElement) ? document.body : mainScroller;
    const max = target.scrollHeight;
    if (mainScroller === document.scrollingElement) {
      window.scrollTo({top:max, behavior:"smooth"});
    } else {
      mainScroller.scrollTo({top:max, behavior:"smooth"});
    }
  });
}

async function bootstrap(){
  if (sidenav && (matchMedia("(pointer: coarse)").matches || matchMedia("(max-width: 820px)").matches)) {
    sidenav.setAttribute("data-open","false");
    toggleBtn?.setAttribute("aria-expanded","false");
  }
  renderRandomChecks();

  try{
    INDEX = await readIndexFromCSV();
    renderTree();
  }catch(e){
    showError(`CSV 載入失敗：${e.message}\n請確認 window.KNOWHUB.CSV_INDEX 指向正確檔名。`);
    throw e;
  }
  rememberScrollPositions();
  ensureScrollButtons();
  ensureMobileToggleFab();
}

function ensureMobileToggleFab() {
  if (document.querySelector('.kh-sidenav-fab')) return;
  const isMobile = matchMedia("(pointer: coarse)").matches || matchMedia("(max-width: 820px)").matches;
  if (!isMobile) return;
  const fab = document.createElement('button');
  fab.className = 'kh-sidenav-fab btn btn-primary';
  fab.type = 'button';
  fab.setAttribute('aria-label', '切換類別');
  fab.textContent = '☰ 類別';
  document.body.appendChild(fab);
  const toggle = () => {
    const open = sidenav.getAttribute("data-open") !== "false";
    const next = open ? "false" : "true";
    sidenav.setAttribute("data-open", next);
    toggleBtn?.setAttribute("aria-expanded", (next === "true").toString());
  };
  fab.addEventListener('click', toggle);
  toggleBtn?.addEventListener('click', toggle);
}

// 首次載入：先啟動，再自動隨機一次
bootstrap()
  .then(()=> loadRandom().catch(()=>{}))
  .catch(()=>{});
