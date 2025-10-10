/* KnowHub — Knowledge (CSV-only, no overlay) 2025-10-10
 * - Data source: CSV only (window.KNOWHUB.CSV_INDEX is required; fallback to /assets/data/notes.csv)
 * - Sidebar: subjects vertically grouped; each group expandable with all titles
 * - Search: fuzzy by title
 * - Content files: tries pages/{id|slug|title id}.{md|html} and same under assets/data/
 * - Notion export: supports "Title SPACE ID.md/html"
 * - Math: $...$ / $$...$$ via KaTeX (page already includes KaTeX)
 * - Auto-indent: paragraphs without '：' get class .indent-1 (see HTML style)
 */

/* ===== Config ===== */
const CSV_INDEX = (window.KNOWHUB && window.KNOWHUB.CSV_INDEX) || "/assets/data/notes.csv";
const SUBJECT_ORDER = (window.KNOWHUB && window.KNOWHUB.SUBJECTS) || ["國文","英文","數學","物理","化學","生物","地球科學"];
const ANCHORS  = ["快速重點","解釋","解釋／定義","解釋/定義","詳細說明","常見考點","常見考點／易錯點","常見考點/易錯點","舉例說明"];

/* ===== DOM ===== */
const sidenav    = document.querySelector(".kh-sidenav");
const toggleBtn  = document.getElementById("sidenav-toggle");
const sideSearch = document.getElementById("side-search");
const treeNav    = document.getElementById("nav-tree");
const cardHost   = document.getElementById("knowledge-card");
const btnRandom  = document.getElementById("btn-random");
const randomChecksHost = document.getElementById("random-subjects");

/* ===== State ===== */
let INDEX = [];                 // [{id,title,subject:[],_fileGuess:string[]}]
let FILTER_Q = "";
let CURRENT_PAGE_ID = null;
let RANDOM_SUBJECTS = new Set(SUBJECT_ORDER);

/* ===== Utils ===== */
const escapeHTML = (s)=> (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]||m));
const debounce = (fn,ms=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const toSlug = (s)=> (s||"").trim().replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g,"-");

async function fetchText(url){
  const r = await fetch(url, { cache:"no-store", mode:"cors", credentials:"omit" });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}

/* ===== CSV ===== */
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

function csvRowToItem(r){
  const title = r.title || r.標題 || r.name || r.Name || "";
  if (!title) return null;
  const subjRaw = r.subject || r.科目 || r.標籤 || "";
  const subjects = subjRaw ? subjRaw.split(/[;,/、\s]+/).filter(Boolean) : [];
  const id = (r.id || r.pageId || r.notionId || "").trim() || toSlug(title);
  const file = (r.file || r.filename || r.path || r.檔案 || "").trim();

  const g = [];
  if (file) g.push(file);
  // Preferred under pages/
  g.push(`./assets/data/pages/${id}.md`);
  g.push(`./assets/data/pages/${id}.html`);
  g.push(`./assets/data/pages/${toSlug(title)}.md`);
  g.push(`./assets/data/pages/${toSlug(title)}.html`);
  // Notion "Title id"
  g.push(`./assets/data/pages/${toSlug(title)} ${id}.md`);
  g.push(`./assets/data/pages/${toSlug(title)} ${id}.html`);
  g.push(`./assets/data/pages/${title} ${id}.md`);
  g.push(`./assets/data/pages/${title} ${id}.html`);
  // Also allow directly under assets/data
  g.push(`./assets/data/${id}.md`);
  g.push(`./assets/data/${id}.html`);
  g.push(`./assets/data/${toSlug(title)}.md`);
  g.push(`./assets/data/${toSlug(title)}.html`);
  g.push(`./assets/data/${toSlug(title)} ${id}.md`);
  g.push(`./assets/data/${toSlug(title)} ${id}.html`);
  g.push(`./assets/data/${title} ${id}.md`);
  g.push(`./assets/data/${title} ${id}.html`);

  return { id, title, subject: subjects, _fileGuess: g };
}

/* ===== Sidebar & Search ===== */
function groupBySubject(items){
  // Keep stable subject order, then alphabetical for others
  const map = new Map();
  items.forEach(x=>{
    const subs = x.subject?.length ? x.subject : ["未分類"];
    subs.forEach(s=>{ if(!map.has(s)) map.set(s,[]); map.get(s).push(x); });
  });
  // sort each list by title
  for (const [,arr] of map) arr.sort((a,b)=>a.title.localeCompare(b.title,"zh-Hant"));
  // order subjects
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
    details.open = true;
    details.innerHTML = `<summary>${escapeHTML(sub)}</summary><div class="items"></div>`;
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
}

/* ===== Render ===== */
function waitForKatexReady(timeout=8000){
  return new Promise((res,rej)=>{
    const t0=Date.now();
    (function loop(){
      if (window.katex) return res();
      if (Date.now()-t0>timeout) return rej();
      setTimeout(loop,50);
    })();
  });
}
async function renderMath(scope=document){
  try{ await waitForKatexReady(); }catch{} // best-effort
  // inline $...$
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
        const span=document.createElement("span"); span.textContent=seg;
        span.className="math-inline";
        frag.appendChild(span);
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

function mdToHtml(md){
  if (!md) return "";
  const esc = (t)=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = md.split(/\r?\n/);
  const out=[];
  for (const ln of lines){
    if (!ln.trim()) { out.push(""); continue; }
    if (ln.startsWith("### ")) out.push("<h3>"+esc(ln.slice(4))+"</h3>");
    else if (ln.startsWith("## ")) out.push("<h2>"+esc(ln.slice(3))+"</h2>");
    else if (ln.startsWith("# ")) out.push("<h1>"+esc(ln.slice(2))+"</h1>");
    else out.push("<p>"+ln+"</p>");
  }
  return out.join("\n");
}

function sectionizeAndRender(title, html){
  const temp = document.createElement("div");
  temp.innerHTML = html;
  temp.querySelectorAll("hr").forEach(x=>x.remove());

  const blocks = Array.from(temp.childNodes);
  const isHeading = (el)=> el && el.nodeType===1 && /H2|H3/.test(el.tagName);
  const normalize = (s)=> (s||"").replace(/\s+/g,"").replace(/[／/]/g,"/");
  const anchorSet = new Set(ANCHORS.map(a=>normalize(a)));

  const pageTitleCard = `<div class="page-title-card"><div class="page-title">《${escapeHTML(title||"(未命名)")}》</div></div>`;

  const sections=[]; let i=0;
  while(i<blocks.length){
    if (isHeading(blocks[i])){
      const t = blocks[i].textContent.trim();
      const k = normalize(t);
      if (anchorSet.has(k)){
        const nodes=[]; i++;
        while(i<blocks.length){
          if (isHeading(blocks[i]) && anchorSet.has(normalize(blocks[i].textContent.trim()))) break;
          nodes.push(blocks[i]); i++;
        }
        sections.push({title:t,nodes}); continue;
      }
    }
    i++;
  }
  if (!sections.length) sections.push({ title, nodes: blocks });

  const htmlCards = sections.map(sec=>{
    const wrap = document.createElement("div");
    wrap.className="section-card";
    const h = document.createElement("div");
    h.className="section-card__title";
    h.textContent=sec.title;
    const body = document.createElement("div");
    body.className="prose";
    sec.nodes.forEach(n=>body.appendChild(n.cloneNode(true)));
    wrap.appendChild(h); wrap.appendChild(body);
    return wrap.outerHTML;
  });

  cardHost.innerHTML = pageTitleCard + htmlCards.join("");

  // Auto-indent (no fullwidth colon)
  cardHost.querySelectorAll(".prose p").forEach(p=>{
    const t=(p.textContent||"").trim();
    if (t && !t.includes("：")) p.classList.add("indent-1");
  });

  renderMath(cardHost);
}

function showSkeleton(h=220){ cardHost.innerHTML = `<div class="skeleton" style="height:${h}px"></div>`; }
function showError(msg){ cardHost.innerHTML = `<div class="section-card"><div class="section-card__title">讀取失敗</div><div class="prose"><p>${escapeHTML(msg||"")}</p></div></div>`; }

/* ===== IO ===== */
async function readIndexFromCSV(){
  const text = await fetchText(CSV_INDEX);
  const items = parseCSV(text).map(csvRowToItem).filter(Boolean);
  if (!items.length) throw new Error("CSV 內容為空或欄位未對上（需要至少 title/標題）");
  return items;
}

async function tryLoadFromGuesses(guesses){
  for (const g of guesses){
    try{
      const raw = await fetchText(g);
      if (g.endsWith(".md")) return mdToHtml(raw);
      return raw; // html
    }catch{ /* try next */ }
  }
  throw new Error("找不到對應的內容檔（請確認放在 assets/data/pages/，檔名規則是否正確）");
}

async function loadPage(id, meta){
  showSkeleton(260);
  try{
    const m = meta || INDEX.find(x=>x.id===id);
    if (!m) throw new Error("找不到頁面索引");
    const html = await tryLoadFromGuesses(m._fileGuess || []);
    CURRENT_PAGE_ID = id;
    sectionizeAndRender(m.title, html);
    // 高亮側欄
    const hit = treeNav.querySelector(`.item[data-id="${id}"]`);
    if (hit){
      treeNav.querySelectorAll(".item.active").forEach(x=>x.classList.remove("active"));
      hit.classList.add("active");
      hit.closest("details")?.setAttribute("open","");
    }
  }catch(e){ showError(e.message); }
}

async function loadRandom(){
  if (!INDEX.length) { await bootstrap(); }
  const pool = INDEX; // 已可由上方勾選控制要不要加 subject 過濾
  if (!pool.length){ showError("列表為空"); return; }
  const pick = pool[Math.floor(Math.random()*pool.length)];
  await loadPage(pick.id, pick);
}

/* ===== Events & Bootstrap ===== */
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
btnRandom?.addEventListener("click", loadRandom);

function renderRandomChecks(){
  randomChecksHost.innerHTML = SUBJECT_ORDER.map(s=>{
    const c = RANDOM_SUBJECTS.has(s) ? "checked" : "";
    return `<label><input type="checkbox" value="${escapeHTML(s)}" ${c}/><span>${escapeHTML(s)}</span></label>`;
  }).join("");
  randomChecksHost.querySelectorAll('input[type="checkbox"]').forEach(el=>{
    el.addEventListener("change", ()=>{
      const v = el.value;
      if (el.checked) RANDOM_SUBJECTS.add(v); else RANDOM_SUBJECTS.delete(v);
    });
  });
}

async function bootstrap(){
  // 手機：預設關閉側欄
  if (sidenav && (matchMedia("(pointer: coarse)").matches || matchMedia("(max-width: 820px)").matches)) {
    sidenav.setAttribute("data-open","false");
    toggleBtn?.setAttribute("aria-expanded","false");
  }
  renderRandomChecks();

  // 只吃 CSV
  try{
    INDEX = await readIndexFromCSV();
    renderTree();
  }catch(e){
    showError(`CSV 載入失敗：${e.message}\n請確認 window.KNOWHUB.CSV_INDEX 指向正確檔名。`);
    throw e;
  }
}

// 首次載入：先畫一篇（若讀得到）
bootstrap().then(()=> loadRandom().catch(()=>{})).catch(()=>{});
