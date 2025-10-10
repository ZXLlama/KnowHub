/* KnowHub — Knowledge (CSV-only, enhanced UI) 2025-10-10
 * - CSV only
 * - Subject color chips + createdAt
 * - Remove '---' blocks
 * - Section containers with gradients
 * - Better mobile sidebar
 * - Bottom-right scroll to top/bottom buttons
 * - Auto-indent paragraphs without '：'
 */

/* ===== Config ===== */
const CSV_INDEX = (window.KNOWHUB && window.KNOWHUB.CSV_INDEX) || "./assets/data/notes.csv";
const SUBJECT_ORDER = (window.KNOWHUB && window.KNOWHUB.SUBJECTS) || ["國文","英文","數學","物理","化學","生物","地球科學"];
const ANCHORS  = ["快速重點","解釋/定義","詳細說明","常見考點/易錯點","舉例說明"]; // 以你指定為主（同義詞自動合併見 normalizeAnchor）

/* ===== DOM ===== */
const sidenav    = document.querySelector(".kh-sidenav");
const toggleBtn  = document.getElementById("sidenav-toggle");
const sideSearch = document.getElementById("side-search");
const treeNav    = document.getElementById("nav-tree");
const cardHost   = document.getElementById("knowledge-card");
const btnRandom  = document.getElementById("btn-random");
const randomChecksHost = document.getElementById("random-subjects");

/* ===== State ===== */
let INDEX = [];                 // [{id,title,subject:[],createdAt?,_fileGuess:string[]}]
let FILTER_Q = "";
let CURRENT_PAGE_ID = null;
let RANDOM_SUBJECTS = new Set(SUBJECT_ORDER);

/* ===== Utils ===== */
const escapeHTML = (s)=> (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]||m));
const debounce = (fn,ms=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const toSlug = (s)=> (s||"").trim().replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g,"-");
async function fetchText(url){ const r=await fetch(url,{cache:"no-store",mode:"cors",credentials:"omit"}); if(!r.ok) throw new Error(`${r.status} ${r.statusText}`); return await r.text(); }

/* ===== Subject Colors (stable) ===== */
const SUBJECT_COLOR_MAP = {
  "國文":"#E3556B","英文":"#4D9DE0","數學":"#6C5CE7","物理":"#00BCD4","化學":"#00B894","生物":"#55D6BE","地球科學":"#FFA62B","未分類":"#9E9E9E"
};
function subjectColor(s){
  if (SUBJECT_COLOR_MAP[s]) return SUBJECT_COLOR_MAP[s];
  // 穩定 hash → HSL
  let h=0; for (let i=0;i<s.length;i++) h=(h*31 + s.charCodeAt(i))>>>0;
  const hue = h%360; return `hsl(${hue},70%,55%)`;
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
  const createdAt = (r.created || r.建立時間 || r.Created || r.date || "").trim();

  const g = [];
  if (file) g.push(prefixGuess(file));
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

  return { id, title, subject: subjects, createdAt, _fileGuess: g };
}
function prefixGuess(file){
  // 若 CSV 的 file 欄只有「檔名」（無路徑），預設視為在 pages 目錄
  if (!file) return file;
  if (file.includes("/") || file.includes("\\")) return file;
  return `./assets/data/pages/${file}`;
}

/* ===== Sidebar & Search ===== */
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
    details.open = true;
    details.innerHTML = `
      <summary>
        <span class="chip chip--sub" style="--chip-color:${subjectColor(sub)}">${escapeHTML(sub)}</span>
        <span class="count">${arr.length}</span>
      </summary>
      <div class="items"></div>`;
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

function mdToHtml(md){
  if (!md) return "";
  const esc = (t)=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lines = md.split(/\r?\n/);
  const out=[];
  for (const ln of lines){
    if (!ln.trim()) { out.push(""); continue; }
    if (ln.trim()==="---") { out.push(""); continue; }                 // 規則 4：移除 '---'
    if (ln.startsWith("### ")) out.push("<h3>"+esc(ln.slice(4))+"</h3>");
    else if (ln.startsWith("## ")) out.push("<h2>"+esc(ln.slice(3))+"</h2>");
    else if (ln.startsWith("# ")) out.push("<h1>"+esc(ln.slice(2))+"</h1>");
    else out.push("<p>"+esc(ln)+"</p>");
  }
  return out.join("\n");
}

function normalizeAnchor(raw){
  const t = (raw || "")
    .trim()
    .replace(/\s+/g, "")     // 移除空白
    .replace(/[／]/g, "/")   // 全形／→半形/
    .toLowerCase();          // 比對用

  if (t === "快速重點") return "快速重點";
  if (t === "解釋/定義" || t === "解釋" || t === "定義") return "解釋/定義";
  if (t === "詳細說明") return "詳細說明";
  if (t === "常見考點/易錯點" || t === "常見考點" || t === "易錯點") return "常見考點/易錯點";
  if (t === "舉例說明" || t === "例子" || t === "範例") return "舉例說明";
  return null;
}

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

function sectionizeAndRender(meta, html){
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // 先清掉多餘內容
  // 1) 單獨 '---' 與 <hr>
  temp.querySelectorAll("hr").forEach(x=>x.remove());
  temp.querySelectorAll("p").forEach(p=>{
    const t=(p.textContent||"").trim();
    if (t==="---") p.remove();
  });

  // 2) 與頁面標題相同的 H1/H2/H3
  const pageTitle = (meta.title||"").trim();
  if (pageTitle){
    temp.querySelectorAll("h1,h2,h3").forEach(h=>{
      if ((h.textContent||"").trim()===pageTitle) h.remove();
    });
  }

  // 3) 清掉中英冒號開頭的中繼資料行
  const metaLine = /^(建立時間|科目)\s*[:：]/;
  temp.querySelectorAll("p").forEach(p=>{
    const t=(p.textContent||"").trim();
    if (metaLine.test(t)) p.remove();
  });

  const blocks = Array.from(temp.childNodes);
  const isHeading = el => el && el.nodeType===1 && /H2|H3/.test(el.tagName);

  // 依標題錨點切段
  const sections=[]; let i=0;
  while(i<blocks.length){
    if (isHeading(blocks[i])){
      const norm = normalizeAnchor((blocks[i].textContent||"").trim());
      if (norm){
        const nodes=[]; i++;
        while(i<blocks.length){
          if (isHeading(blocks[i]) && normalizeAnchor((blocks[i].textContent||"").trim())) break;
          nodes.push(blocks[i]); i++;
        }
        sections.push({ title:norm, nodes });
        continue;
      }
    }
    i++;
  }
  if (!sections.length) sections.push({ title:"內容", nodes: blocks, noWrap:true });

  // Header（頁標題 + 科目 chips + 建立時間）
  const chips = (meta.subject && meta.subject.length)
    ? `<div class="page-chips">` + meta.subject.map(s=>(
        `<span class="chip" style="--chip-color:${subjectColor(s)}">${escapeHTML(s)}</span>`
      )).join("") + `</div>`
    : `<div class="page-chips"></div>`;
  const created = meta.createdAt ? `<div class="page-meta">${escapeHTML(meta.createdAt)}</div>` : "";
  const headerCard = `
    <div class="page-title-card">
      <div class="page-title">《${escapeHTML(meta.title||"(未命名)")}》</div>
      ${chips}
      ${created}
    </div>`;

  // 章節卡片
  const htmlCards = sections.map(sec=>{
    const wrap = document.createElement("div");
    wrap.className = `section-card ${sectionClassByTitle(sec.title)}`;

    const titleEl = document.createElement("div");
    titleEl.className = "section-card__title";
    titleEl.textContent = sec.title;

    const body = document.createElement("div");
    body.className = "prose";
    sec.nodes.forEach(n=>body.appendChild(n.cloneNode(true)));

    // 沒有「：」就自動縮排
    body.querySelectorAll("p").forEach(p=>{
      const t=(p.textContent||"").trim();
      if (t && !t.includes("：")) p.classList.add("indent-1");
    });

    wrap.appendChild(titleEl);
    wrap.appendChild(body);
    return wrap.outerHTML;
  });

  cardHost.innerHTML = headerCard + htmlCards.join("");
  renderMath(cardHost);
  ensureScrollButtons();
}

function showSkeleton(h=220){ cardHost.innerHTML = `<div class="skeleton" style="height:${h}px"></div>`; }
function showError(msg){ cardHost.innerHTML = `<div class="section-card sec--generic"><div class="section-card__title">讀取失敗</div><div class="prose"><p>${escapeHTML(msg||"")}</p></div></div>`; }

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
    sectionizeAndRender(m, html);
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
  const pool = INDEX;
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
  // 可保留；此處省略顯示，若需要也能加回
  randomChecksHost && (randomChecksHost.innerHTML = "");
}

async function bootstrap(){
  // 手機：預設關閉側欄
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
  ensureScrollButtons();
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
  wrap.querySelector(".fab--up").addEventListener("click", ()=> window.scrollTo({top:0, behavior:"smooth"}));
  wrap.querySelector(".fab--down").addEventListener("click", ()=> window.scrollTo({top:document.body.scrollHeight, behavior:"smooth"}));
}

// 首次載入
bootstrap().then(()=> loadRandom().catch(()=>{})).catch(()=>{});
