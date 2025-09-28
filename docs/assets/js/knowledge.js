// assets/js/knowledge.js — Sidenav index + Section rendering + KaTeX fix + Random (subjects-only)

/* ========= Config ========= */
const API_BASE   = (window.KNOWHUB && window.KNOWHUB.API_BASE) || "";
const SUBJECTS   = (window.KNOWHUB && window.KNOWHUB.SUBJECTS) || ["國文","英文","數學","物理","化學","生物","地球科學"];
const ANCHORS    = [
  "快速重點",
  "解釋", "解釋／定義", "解釋/定義",
  "詳細說明",
  "常見考點", "常見考點／易錯點", "常見考點/易錯點",
  "舉例說明"
];

/* ========= DOM ========= */
const sidenav    = document.querySelector(".kh-sidenav");
const toggleBtn  = document.getElementById("sidenav-toggle");
const sideSearch = document.getElementById("side-search");
const treeNav    = document.getElementById("nav-tree");
const cardHost   = document.getElementById("knowledge-card");
const btnRandom  = document.getElementById("btn-random");
const btnRefresh = document.getElementById("btn-refresh");
const randomChecksHost = document.getElementById("random-subjects");

/* ========= State ========= */
let INDEX = [];                 // [{id, title, subject:[...]}]
let FILTER_Q = "";              // 側欄搜尋關鍵字
let RANDOM_SUBJECTS = new Set(SUBJECTS); // 勾選的科目（只影響隨機），預設全開
let CURRENT_PAGE_ID = null;

/* ========= Utils ========= */
const escapeHTML = (s)=> (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;"," >":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
function debounce(fn, ms=250){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
function buildURL(path, params){
  const u = new URL(path, API_BASE || location.origin);
  if (params) Object.entries(params).forEach(([k,v])=>{
    if (Array.isArray(v)) v.forEach(vv=>u.searchParams.append(k, vv));
    else if (v!==undefined && v!==null && v!=="") u.searchParams.set(k, v);
  });
  return u;
}
async function apiGet(path, params){
  let r = await fetch(buildURL(path, params), { mode:"cors" });
  if (r.status === 404 && path.startsWith("/api/")) {
    r = await fetch(buildURL(path.replace(/^\/api\//,"/"), params), { mode:"cors" });
  }
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

/* ========= KaTeX rendering (explicit-only, idempotent) ========= */
// 移除 auto-render；僅顯式渲染 .math / .math-inline

function waitForKatexReady(timeout = 8000) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function loop() {
      if (window.katex) return resolve();
      if (Date.now() - t0 > timeout) return reject(new Error("KaTeX not ready"));
      setTimeout(loop, 50);
    })();
  });
}

// 將 prose 裡 textNode 的 $...$ 自動包成 <span class="math-inline">$...$</span>
function wrapInlineDollarMath(scope) {
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.includes("$")) return NodeFilter.FILTER_REJECT;
      // 不處理 code/pre/a 內
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest("code, pre, a, .math, .math-inline, .katex")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const toWrap = [];
  while (walker.nextNode()) toWrap.push(walker.currentNode);

  toWrap.forEach((textNode) => {
    const parts = textNode.nodeValue.split(/(\$[^$]+\$)/g); // 保留 $...$
    if (parts.length === 1) return;
    const frag = document.createDocumentFragment();
    parts.forEach((seg) => {
      if (!seg) return;
      if (seg.startsWith("$") && seg.endsWith("$") && seg.length > 2) {
        const span = document.createElement("span");
        span.className = "math-inline";
        span.textContent = seg; // 先保留 $...$，後面會拿掉外層 $
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(seg));
      }
    });
    textNode.parentNode.replaceChild(frag, textNode);
  });
}

async function renderMath(scope = document) {
  try { await waitForKatexReady(); } catch {}
  // 1) 先把 prose 內的 $...$ 包起來
  scope.querySelectorAll(".prose").forEach(wrapInlineDollarMath);

  // 2) 區塊數學（.math 裡包了 $$...$$）
  scope.querySelectorAll(".math").forEach((el) => {
    if (el.dataset.kRendered === "1" || el.querySelector(".katex")) return;
    const tex = (el.textContent || "").trim().replace(/^\$\$|\$\$$/g, "");
    if (!tex) return;
    try {
      window.katex.render(tex, el, { displayMode: true, throwOnError: false });
      el.dataset.kRendered = "1";
    } catch {}
  });

  // 3) 行內數學（.math-inline 裡包了 $...$）
  scope.querySelectorAll(".math-inline").forEach((el) => {
    if (el.dataset.kRendered === "1" || el.querySelector(".katex")) return;
    const raw = (el.textContent || "").trim();
    const tex = raw.replace(/^\$|\$$/g, "");
    if (!tex) return;
    try {
      window.katex.render(tex, el, { displayMode: false, throwOnError: false });
      el.dataset.kRendered = "1";
    } catch {}
  });
}


/* 在內容容器變動時自動重渲染（避免延遲載入/切段後漏掃） */
const __kh_mo = new MutationObserver(() => {
  // 低頻去抖，避免持續插入造成大量重算
  clearTimeout(window.__kh_math_t);
  window.__kh_math_t = setTimeout(() => renderMath(cardHost), 60);
});
__kh_mo.observe(cardHost, { childList: true, subtree: true });



/* ========= Skeleton / Messages ========= */
function showSkeleton(h=220){ cardHost.innerHTML = `<div class="skeleton" style="height:${h}px"></div>`; }
function showMessage(title, msg=""){
  cardHost.innerHTML = `
    <div class="section-card">
      <div class="section-card__title">${escapeHTML(title)}</div>
      <div class="prose"><p>${escapeHTML(msg)}</p></div>
    </div>`;
}

/* ========= Render: Sidenav (subjects + titles) ========= */
function groupBySubject(items){
  const map = new Map(); // subject => [{id,title,subject:[...]}]
  items.forEach(x=>{
    const subs = x.subject && x.subject.length ? x.subject : ["未分類"];
    subs.forEach(s=>{
      if (!map.has(s)) map.set(s, []);
      map.get(s).push(x);
    });
  });
  // sort titles within subjects
  for (const [,arr] of map) arr.sort((a,b)=>a.title.localeCompare(b.title,"zh-Hant"));
  return new Map([...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],"zh-Hant")));
}

function renderRandomChecks(){
  randomChecksHost.innerHTML = SUBJECTS.map(s=>{
    const checked = RANDOM_SUBJECTS.has(s) ? "checked" : "";
    return `
      <label>
        <input type="checkbox" value="${escapeHTML(s)}" ${checked}/>
        <span>${escapeHTML(s)}</span>
      </label>`;
  }).join("");
  randomChecksHost.querySelectorAll('input[type="checkbox"]').forEach(chk=>{
    chk.addEventListener("change", ()=>{
      const val = chk.value;
      if (chk.checked) RANDOM_SUBJECTS.add(val);
      else RANDOM_SUBJECTS.delete(val);
    });
  });
}

function renderTree(){
  const q = FILTER_Q.trim().toLowerCase();
  // 以關鍵字過濾 INDEX（標題含關鍵字才顯示）
  const filtered = q ? INDEX.filter(x => (x.title||"").toLowerCase().includes(q)) : INDEX;
  const grouped = groupBySubject(filtered);

  treeNav.innerHTML = "";
  for (const [sub, arr] of grouped.entries()){
    const open = "open";
    const groupEl = document.createElement("details");
    groupEl.className = "group";
    groupEl.setAttribute(open, "");
    groupEl.innerHTML = `
      <summary>${escapeHTML(sub)}</summary>
      <div class="items"></div>
    `;
    const itemsEl = groupEl.querySelector(".items");
    arr.forEach(it=>{
      const a = document.createElement("a");
      a.href = "javascript:void(0)";
      a.className = "item";
      a.dataset.id = it.id;
      a.textContent = it.title || "(未命名)";
      a.addEventListener("click", ()=> {
        loadPage(it.id);
        // 標示 active
        treeNav.querySelectorAll(".item.active").forEach(x=>x.classList.remove("active"));
        a.classList.add("active");
      });
      itemsEl.appendChild(a);
    });
    treeNav.appendChild(groupEl);
  }
}

/* ========= Render: Page -> Section Cards ========= */
function renderPage(obj) {
  CURRENT_PAGE_ID = obj.id;

  const temp = document.createElement("div");
  temp.innerHTML = obj.content || "";

  // 清掉所有 <hr>
  temp.querySelectorAll("hr").forEach((hr) => hr.remove());

  const blocks = Array.from(temp.childNodes);
  const isHeading = (el) => el && el.nodeType === 1 && /H2|H3/.test(el.tagName);
  const normalize = (s) => (s || "").replace(/\s+/g, "").replace(/[／/]/g, "/");
  const anchorSet = new Set(ANCHORS.map((a) => normalize(a)));

  // 頁面標題卡（《標題》）
  const pageTitle = obj.title || "(未命名)";
  const pageTitleCard =
    `<div class="page-title-card"><div class="page-title">《${escapeHTML(pageTitle)}》</div></div>`;

  // 依錨點切塊
  const sections = [];
  let i = 0;
  while (i < blocks.length) {
    if (isHeading(blocks[i])) {
      const titleText = blocks[i].textContent.trim();
      const key = normalize(titleText);
      if (anchorSet.has(key)) {
        const contentNodes = [];
        i++;
        while (i < blocks.length) {
          if (isHeading(blocks[i]) && anchorSet.has(normalize(blocks[i].textContent.trim()))) break;
          contentNodes.push(blocks[i]);
          i++;
        }
        sections.push({ title: titleText, nodes: contentNodes });
        continue;
      }
    }
    i++;
  }
  if (!sections.length) sections.push({ title: obj.title || "(未命名)", nodes: blocks });

  // 產出各段卡片
  const sectionCards = sections.map((sec) => {
    const wrap = document.createElement("div");
    wrap.className = "section-card";
    const title = document.createElement("div");
    title.className = "section-card__title";
    title.textContent = sec.title;
    const body = document.createElement("div");
    body.className = "prose";
    sec.nodes.forEach((n) => body.appendChild(n.cloneNode(true)));
    wrap.appendChild(title);
    wrap.appendChild(body);
    return wrap.outerHTML;
  });

  // ⚠️ 正確拼接：先標題卡，再各段
  cardHost.innerHTML = [pageTitleCard, ...sectionCards].join("");


  // 渲染 KaTeX
  renderMath(cardHost);
}



/* ========= Data IO ========= */
async function loadIndex({ refresh=false } = {}){
  const params = {};
  if (refresh) params.refresh = 1;
  const { items } = await apiGet("/api/knowledge/titles", params);
  INDEX = items || [];
  renderTree();
}

async function loadPage(id){
  showSkeleton(260);
  try{
    const obj = await apiGet("/api/knowledge/page", { id });
    renderPage(obj);
  }catch(e){
    showMessage("讀取失敗", e.message || "Page error");
  }
}

async function loadRandom(){
  if (RANDOM_SUBJECTS.size === 0) {
    showMessage("沒有可用的科目", "請至少勾選一個科目後再試。");
    return;
  }
  showSkeleton(220);
  try{
    const subjects = [...RANDOM_SUBJECTS];
    const obj = await apiGet("/api/knowledge/random", { subject: subjects });
    renderPage(obj);
    // 高亮側欄相對應標題
    const hit = treeNav.querySelector(`.item[data-id="${obj.id}"]`);
    if (hit) {
      treeNav.querySelectorAll(".item.active").forEach(x=>x.classList.remove("active"));
      hit.classList.add("active");
      // 展開所在 group
      const details = hit.closest(".group");
      if (details && !details.open) details.open = true;
    }
  }catch(e){
    showMessage("隨機讀取失敗", e.message || "Random error");
  }
}

/* ========= Events ========= */
toggleBtn?.addEventListener("click", ()=>{
  const open = sidenav.getAttribute("data-open") !== "false";
  sidenav.setAttribute("data-open", open ? "false" : "true");
  toggleBtn.setAttribute("aria-expanded", (!open).toString());
});

sideSearch?.addEventListener("input", debounce(()=>{
  FILTER_Q = sideSearch.value || "";
  renderTree();
}, 150));

btnRandom?.addEventListener("click", loadRandom);
btnRefresh?.addEventListener("click", async ()=>{
  btnRefresh.disabled = true;
  try{
    await loadIndex({ refresh: true });
  } finally {
    btnRefresh.disabled = false;
  }
});

/* ========= Bootstrap ========= */
// 隨機勾選科目（預設全開）
renderRandomChecks();

// 初始化：先顯示一則隨機內容（避免索引一時 404 或慢載時出錯畫面）
// 同時背景載入索引，載到後把側欄高亮同步
(async function init() {
  // 先嘗試 KaTeX readiness（不阻塞 UI）
  waitForKatexReady().catch(() => { /* ignore */ });

  // 1) 立即跑一次隨機（依勾選科目）
  loadRandom().catch((e) => {
    // 隨機也失敗才顯示訊息
    showMessage("讀取失敗", e.message || "Random error");
  });

  // 2) 背景載索引；成功後更新側欄、並嘗試高亮當前頁
  try {
    await loadIndex();
    if (CURRENT_PAGE_ID) {
      const hit = treeNav.querySelector(`.item[data-id="${CURRENT_PAGE_ID}"]`);
      if (hit) {
        treeNav.querySelectorAll(".item.active").forEach((x) => x.classList.remove("active"));
        hit.classList.add("active");
        const details = hit.closest(".group");
        if (details && !details.open) details.open = true;
      }
    }
  } catch (e) {
    // 索引載入失敗不影響已呈現的隨機內容
    console.warn("Index load failed:", e);
  }
})();
