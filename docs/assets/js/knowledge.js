// assets/js/knowledge.js — Worker-API only

/* ========= Config ========= */
const API_BASE = (window.KNOWHUB && window.KNOWHUB.API_BASE) || "";
const SUBJECTS = (window.KNOWHUB && window.KNOWHUB.SUBJECTS) || ["國文","英文","數學","物理","化學","生物","地球科學"];
const ANCHORS  = ["快速重點","解釋","解釋／定義","解釋/定義","詳細說明","常見考點","常見考點／易錯點","常見考點/易錯點","舉例說明"];

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
let INDEX = []; // [{id,title,subject:[]}]
let FILTER_Q = "";
let RANDOM_SUBJECTS = new Set(SUBJECTS);
let CURRENT_PAGE_ID = null;

/* ========= Utils ========= */
const escapeHTML = (s)=> (s||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const debounce = (fn,ms=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

function buildURL(path, params){
  const u = new URL(path, API_BASE || location.origin);
  if (params) Object.entries(params).forEach(([k,v])=>{
    if (Array.isArray(v)) v.forEach(vv=>u.searchParams.append(k, vv));
    else if (v!==undefined && v!==null && v!=="") u.searchParams.set(k, v);
  });
  return u;
}
async function apiGet(path, params){
  // 先試 /api/...，失敗（404/400 之類）再試不含 /api 的路徑，容錯你的 Worker 路由
  const tryPaths = path.startsWith("/api/") ? [path, path.replace(/^\/api\//,"/")] : [path, `/api${path}`];
  for (const p of tryPaths) {
    try {
      const r = await fetch(buildURL(p, params), { mode:"cors", cache:"no-store", credentials:"omit" });
      if (r.ok) return await r.json();
    } catch (_) {}
  }
  throw new Error(`API failed for ${path}`);
}

/* ========= Loader / Messages ========= */
let LOADER = null;
function showLoader(text="載入中…"){
  if (!LOADER){
    LOADER = document.createElement("div");
    LOADER.className = "kh-loader";
    LOADER.innerHTML = `
      <div class="kh-loader__box">
        <div class="kh-spinner" aria-hidden="true"></div>
        <div class="kh-loader__text"></div>
      </div>`;
    document.body.appendChild(LOADER);
  }
  LOADER.querySelector(".kh-loader__text").textContent = text;
  LOADER.removeAttribute("hidden");
}
function hideLoader(){ LOADER?.setAttribute("hidden",""); }

function showSkeleton(h=220){ cardHost.innerHTML = `<div class="skeleton" style="height:${h}px"></div>`; }
function showMessage(title,msg=""){
  cardHost.innerHTML = `<div class="section-card"><div class="section-card__title">${escapeHTML(title)}</div><div class="prose"><p>${escapeHTML(msg)}</p></div></div>`;
}

/* ========= KaTeX (顯式渲染) ========= */
function waitForKatexReady(timeout=8000){
  return new Promise((res,rej)=>{
    const t0=Date.now();
    (function loop(){
      if (window.katex) return res();
      if (Date.now()-t0>timeout) return rej(new Error("KaTeX not ready"));
      setTimeout(loop,50);
    })();
  });
}
function wrapInlineDollarMath(scope){
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if (!n.nodeValue || !n.nodeValue.includes("$")) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
      if (p.closest("code, pre, a, .math, .math-inline, .katex")) return NodeFilter.FILTER_REJECT;
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
        const span=document.createElement("span"); span.className="math-inline"; span.textContent=seg;
        frag.appendChild(span);
      } else frag.appendChild(document.createTextNode(seg));
    });
    tn.parentNode.replaceChild(frag, tn);
  });
}
async function renderMath(scope=document){
  try{ await waitForKatexReady(); }catch{}
  scope.querySelectorAll(".prose").forEach(wrapInlineDollarMath);
  scope.querySelectorAll(".math").forEach(el=>{
    if (el.dataset.kRendered==="1" || el.querySelector(".katex")) return;
    const tex=(el.textContent||"").trim().replace(/^\$\$|\$\$$/g,""); if(!tex) return;
    try{ window.katex.render(tex, el, {displayMode:true, throwOnError:false}); el.dataset.kRendered="1"; }catch{}
  });
  scope.querySelectorAll(".math-inline").forEach(el=>{
    if (el.dataset.kRendered==="1" || el.querySelector(".katex")) return;
    const tex=(el.textContent||"").trim().replace(/^\$|\$$/g,""); if(!tex) return;
    try{ window.katex.render(tex, el, {displayMode:false, throwOnError:false}); el.dataset.kRendered="1"; }catch{}
  });
}
new MutationObserver(()=>{ clearTimeout(window.__kh_math_t); window.__kh_math_t=setTimeout(()=>renderMath(cardHost),60); })
  .observe(cardHost, { childList:true, subtree:true });

/* ========= 索引與側欄 ========= */
function groupBySubject(items){
  const map = new Map();
  items.forEach(x=>{
    const subs = x.subject && x.subject.length ? x.subject : ["未分類"];
    subs.forEach(s=>{
      if (!map.has(s)) map.set(s, []);
      map.get(s).push(x);
    });
  });
  for (const [,arr] of map) arr.sort((a,b)=>a.title.localeCompare(b.title,"zh-Hant"));
  return new Map([...map.entries()].sort((a,b)=>a[0].localeCompare(b[0],"zh-Hant")));
}
function renderRandomChecks(){
  randomChecksHost.innerHTML = SUBJECTS.map(s=>{
    const checked = RANDOM_SUBJECTS.has(s) ? "checked" : "";
    return `<label><input type="checkbox" value="${escapeHTML(s)}" ${checked}/><span>${escapeHTML(s)}</span></label>`;
  }).join("");
  randomChecksHost.querySelectorAll('input[type="checkbox"]').forEach(chk=>{
    chk.addEventListener("change", ()=>{
      const v = chk.value;
      if (chk.checked) RANDOM_SUBJECTS.add(v); else RANDOM_SUBJECTS.delete(v);
    });
  });
}
function renderTree(){
  const q = FILTER_Q.trim().toLowerCase();
  const filtered = q ? INDEX.filter(x=>(x.title||"").toLowerCase().includes(q)) : INDEX;
  const grouped = groupBySubject(filtered);

  treeNav.innerHTML = "";
  for (const [sub, arr] of grouped.entries()){
    const groupEl = document.createElement("details");
    groupEl.className="group"; groupEl.open = true;
    groupEl.innerHTML = `<summary>${escapeHTML(sub)}</summary><div class="items"></div>`;
    const itemsEl = groupEl.querySelector(".items");
    arr.forEach(it=>{
      const a = document.createElement("a");
      a.href="javascript:void(0)"; a.className="item"; a.dataset.id=it.id;
      a.textContent = it.title || "(未命名)";
      a.addEventListener("click", ()=>{
        loadPage(it.id);
        treeNav.querySelectorAll(".item.active").forEach(x=>x.classList.remove("active"));
        a.classList.add("active");
        const d=a.closest(".group"); if(d && !d.open) d.open=true;
      });
      itemsEl.appendChild(a);
    });
    treeNav.appendChild(groupEl);
  }

  if (CURRENT_PAGE_ID){
    const hit = treeNav.querySelector(`.item[data-id="${CURRENT_PAGE_ID}"]`);
    if (hit){ treeNav.querySelectorAll(".item.active").forEach(x=>x.classList.remove("active"));
      hit.classList.add("active"); const d=hit.closest(".group"); if(d && !d.open) d.open=true; }
  }
}

/* ========= 內容渲染 ========= */
function renderPage(obj){
  CURRENT_PAGE_ID = obj.id;

  const temp = document.createElement("div");
  temp.innerHTML = obj.content || "";
  temp.querySelectorAll("hr").forEach((hr)=>hr.remove());

  const blocks = Array.from(temp.childNodes);
  const isHeading = (el)=> el && el.nodeType===1 && /H2|H3/.test(el.tagName);
  const normalize = (s)=> (s||"").replace(/\s+/g,"").replace(/[／/]/g,"/");
  const anchorSet = new Set(ANCHORS.map(a=>normalize(a)));

  const pageTitle = obj.title || "(未命名)";
  const pageTitleCard = `<div class="page-title-card"><div class="page-title">《${escapeHTML(pageTitle)}》</div></div>`;

  const sections=[]; let i=0;
  while(i<blocks.length){
    if (isHeading(blocks[i])){
      const titleText = blocks[i].textContent.trim();
      const key = normalize(titleText);
      if (anchorSet.has(key)){
        const nodes=[]; i++;
        while(i<blocks.length){
          if (isHeading(blocks[i]) && anchorSet.has(normalize(blocks[i].textContent.trim()))) break;
          nodes.push(blocks[i]); i++;
        }
        sections.push({ title:titleText, nodes });
        continue;
      }
    }
    i++;
  }
  if (!sections.length) sections.push({ title: obj.title || "(未命名)", nodes: blocks });

  const sectionCards = sections.map(sec=>{
    const wrap=document.createElement("div"); wrap.className="section-card";
    const title=document.createElement("div"); title.className="section-card__title"; title.textContent=sec.title;
    const body=document.createElement("div"); body.className="prose";
    sec.nodes.forEach(n=>body.appendChild(n.cloneNode(true)));
    wrap.appendChild(title); wrap.appendChild(body);
    return wrap.outerHTML;
  });

  cardHost.innerHTML = [pageTitleCard, ...sectionCards].join("");
  renderMath(cardHost);
}

/* ========= Data IO (Worker only) ========= */
async function loadIndex({ refresh=false } = {}){
  showLoader("正在載入索引…");
  try{
    const params = refresh ? { refresh:1 } : undefined;
    const res = await apiGet("/api/knowledge/titles", params);
    const items = Array.isArray(res) ? res : (res?.items || []);
    INDEX = items.map(it=>({
      id: it.id || it.pageId || it.notionId,
      title: it.title || it.name || "(未命名)",
      subject: Array.isArray(it.subject) ? it.subject : (it.subject ? [String(it.subject)] : [])
    })).filter(x=>x.id);
    renderTree();
  }catch(e){
    console.error(e);
    showMessage("索引載入失敗","請稍後再試");
  }finally{
    hideLoader();
  }
}

async function loadPage(id){
  showSkeleton(260);
  try{
    const obj = await apiGet("/api/knowledge/page", { id });
    renderPage(obj);
    const hit = treeNav.querySelector(`.item[data-id="${obj.id}"]`);
    if (hit){
      treeNav.querySelectorAll(".item.active").forEach(x=>x.classList.remove("active"));
      hit.classList.add("active");
      const d=hit.closest(".group"); if(d && !d.open) d.open=true;
    }
  }catch(e){
    showMessage("讀取失敗", e.message || "Page error");
  }
}

async function loadRandom(){
  if (RANDOM_SUBJECTS.size===0){
    showMessage("沒有可用的科目","請至少勾選一個科目後再試。");
    return;
  }
  showSkeleton(220);
  try{
    const obj = await apiGet("/api/knowledge/random", { subject: [...RANDOM_SUBJECTS] });
    renderPage(obj);
    const hit = treeNav.querySelector(`.item[data-id="${obj.id}"]`);
    if (hit){
      treeNav.querySelectorAll(".item.active").forEach(x=>x.classList.remove("active"));
      hit.classList.add("active");
      const d=hit.closest(".group"); if(d && !d.open) d.open=true;
    }
  }catch(e){
    showMessage("隨機讀取失敗", e.message || "Random error");
  }
}

/* ========= Events ========= */
toggleBtn?.addEventListener("click", ()=>{
  const open = sidenav.getAttribute("data-open")!=="false";
  const next = open ? "false" : "true";
  sidenav.setAttribute("data-open", next);
  toggleBtn.setAttribute("aria-expanded", (next==="true").toString());
});
sideSearch?.addEventListener("input", debounce(()=>{ FILTER_Q = sideSearch.value || ""; renderTree(); },150));
btnRandom?.addEventListener("click", loadRandom);
btnRefresh?.addEventListener("click", async ()=>{
  btnRefresh.disabled = true; try{ await loadIndex({ refresh:true }); } finally { btnRefresh.disabled = false; }
});

/* ========= Bootstrap ========= */
renderRandomChecks();
(async function init(){
  waitForKatexReady().catch(()=>{});
  // 先抽一則，避免索引較慢時畫面空白
  loadRandom().catch(()=>{});
  await loadIndex();
})();
