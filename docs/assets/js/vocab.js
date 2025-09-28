/* ===========================================
 * KnowHub Vocab - 完整 JS（合併詞性/英/中於同一區塊）
 * 規則：
 * - 順序：詞性 → 英文 → 中文
 * - 字級：詞性最小、中文次之、英文最大（由 CSS 控制）
 * - 雙面模式：英文面清空中文；中文面清空英文
 * - 單面模式：兩面皆同時顯示中英文
 * =========================================== */

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1qIeWrbWWvpkwjLq2pd_3VmjxeHrPGYptyZG4P624qL0/export?format=csv";

/* ---------- 工具 ---------- */
const $  = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const escapeHTML = (s) =>
  (s ?? "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

/* 可處理引號/逗號/跨行的 CSV 解析器 */
function parseCSV(text){
  const rows = [];
  let cur = [], val = "", i = 0, inQuotes = false;
  while (i < text.length){
    const ch = text[i];
    if (inQuotes){
      if (ch === '"'){
        if (text[i+1] === '"'){ val += '"'; i += 2; }
        else { inQuotes = false; i++; }
      } else { val += ch; i++; }
    } else {
      if (ch === '"'){ inQuotes = true; i++; }
      else if (ch === ","){ cur.push(val); val = ""; i++; }
      else if (ch === "\n"){ cur.push(val); rows.push(cur); cur = []; val = ""; i++; }
      else if (ch === "\r"){ i++; }
      else { val += ch; i++; }
    }
  }
  cur.push(val); rows.push(cur);
  return rows;
}

/* ---------- DOM ---------- */
const searchInput   = $("#search");
const suggestionsUl = $("#suggestions");

const cardEl   = $("#card");
const front    = $("#front");
const back     = $("#back");

// 六個文字節點（同一結構，正反面各三個）
const posFront = $("#pos-front");
const enFront  = $("#en-front");
const zhFront  = $("#zh-front");

const posBack  = $("#pos-back");
const enBack   = $("#en-back");
const zhBack   = $("#zh-back");

const indexEl  = $("#index");
const btnSpeakEn = $("#speak-en"); // 需有 .no-flip
const btnRandom  = $("#random");
const btnPrev    = $("#prev");
const btnNext    = $("#next");
const modeToggle = $("#mode-toggle");

/* ---------- 狀態 ---------- */
let items      = [];   // {word, pos, definition}
let idx        = 0;
let isDualMode = true; // true=雙面（可翻面）；false=單面（兩面同顯）
let flipped    = false;

/* ---------- 語音 ---------- */
function speakEn(text){
  try{
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    const best = voices.find(v => /en(-|_)|English/i.test(v.lang || v.name)) || voices[0];
    if (best) u.voice = best;
    u.rate = 0.95; u.pitch = 1.0; u.volume = 1.0;
    speechSynthesis.speak(u);
  }catch{}
}
window.addEventListener("voiceschanged", () => {});

/* ---------- 顯示邏輯 ---------- */
function applyCardFace() {
  if (!front || !back) return;
  if (!isDualMode) {
    // 單面：兩面同時顯示
    front.classList.remove("face-hidden");
    back.classList.remove("face-hidden");
    return;
  }
  // 雙面：只顯示其一
  if (flipped) {
    back.classList.remove("face-hidden");
    front.classList.add("face-hidden");
  } else {
    front.classList.remove("face-hidden");
    back.classList.add("face-hidden");
  }
}

/* 固定高度下讓兩面等高（以卡片容器高為準） */
function equalizeCard(){
  if (!front || !back || !cardEl) return;
  const h = cardEl.clientHeight;
  front.style.minHeight = h + "px";
  back.style.minHeight  = h + "px";
}

/* 將目前 idx 的資料，依模式與面向，填入正反兩面 */
function updateContent(){
  if (!items.length) return;
  const item = items[idx];
  const W = (item.word || "").trim() || "—";
  const P = (item.pos  || "").trim();
  const Z = (item.definition || "").trim() || "—";

  // 詞性兩面都相同
  posFront.textContent = P;
  posBack.textContent  = P;

  if (isDualMode){
    // 雙面：英文面清空中文；中文面清空英文
    // 英文面（front）
    enFront.textContent = W;
    zhFront.textContent = "";    // 清空中文

    // 中文面（back）
    enBack.textContent  = "";    // 清空英文
    zhBack.textContent  = Z;
  } else {
    // 單面：兩面都同時顯示（不清空）
    enFront.textContent = W;
    zhFront.textContent = Z;

    enBack.textContent  = W;
    zhBack.textContent  = Z;
  }
}

/* ---------- 資料載入 ---------- */
async function loadFromSheet(){
  const resp = await fetch(SHEET_URL, { cache: "no-store" });
  if (!resp.ok) throw new Error("Fetch CSV failed");
  const text = await resp.text();
  const rows = parseCSV(text).filter(r => r.some(c => (c ?? "").toString().trim() !== ""));
  if (!rows.length) return [];

  // 可有表頭也可無表頭（自動判斷）
  let start = 0;
  const first = rows[0].map(x => (x ?? "").toString().trim().toLowerCase());
  const mayHeader =
    first[0] === "word" || first[1] === "pos" || first[2] === "definition" ||
    first.join(",").includes("詞性") || first.join(",").includes("中文");
  if (mayHeader) start = 1;

  const list = [];
  for (let i = start; i < rows.length; i++){
    const r = rows[i];
    const word = (r[0] ?? "").toString().trim();
    const pos  = (r[1] ?? "").toString().trim();
    const def  = (r[2] ?? "").toString().trim();
    if (!word && !pos && !def) continue;
    list.push({ word, pos, definition: def });
  }
  return list;
}

/* ---------- 渲染 ---------- */
function renderItem(i){
  if (!items.length) return;
  const item = items[i];
  indexEl.textContent = `#${i + 1}`;

  // 換卡：預設回到英文面（flipped=false）
  flipped = false;

  // 依模式填內容 & 設定可見面
  updateContent();
  applyCardFace();
  equalizeCard();

  try{ localStorage.setItem("vocab_idx", String(i)); }catch{}
}

/* ---------- 導航 ---------- */
function clampIndex(n){
  if (!items.length) return 0;
  if (n < 0) return items.length - 1;
  if (n >= items.length) return 0;
  return n;
}
function go(i){ idx = clampIndex(i); renderItem(idx); }
function next(){ go(idx + 1); }
function prev(){ go(idx - 1); }
function random(){ if (!items.length) return; go(Math.floor(Math.random() * items.length)); }

/* ---------- 搜尋 ---------- */
function updateSuggestions(q){
  const query = (q || "").trim().toLowerCase();
  if (!query){ suggestionsUl.innerHTML = ""; suggestionsUl.classList.remove("show"); return; }
  const res = items.map((it,i)=>({...it,i}))
    .filter(it => (it.word || "").toLowerCase().includes(query))
    .slice(0, 8);

  suggestionsUl.innerHTML = res.map(r =>
    `<li data-i="${r.i}" role="option">${escapeHTML(r.word)} <small style="opacity:.7">${escapeHTML(r.pos || "")}</small></li>`
  ).join("");
  suggestionsUl.classList.toggle("show", res.length > 0);
}

/* ---------- 事件 ---------- */
// 卡片點擊：空白處翻面（只在雙面模式）
cardEl.addEventListener("click", (e) => {
  if (e.target.closest(".no-flip")) return;
  if (!isDualMode) return;
  flipped = !flipped;
  applyCardFace();
});

// 模式切換（文字可自行調整）
modeToggle.addEventListener("click", () => {
  isDualMode = !isDualMode;

  if (isDualMode){
    flipped = false; // 回到英文面
    modeToggle.textContent = "🔀 切換到「單面模式」";
  }else{
    modeToggle.textContent = "🔁 切換到「雙面模式」";
  }

  updateContent();  // 依新模式填寫內容（清空/顯示）
  applyCardFace();  // 立即套用顯示狀態
});

// 導航
btnPrev.addEventListener("click", prev);
btnNext.addEventListener("click", next);
btnRandom.addEventListener("click", random);

// 發音（直接念目前單字的英文，不依面向）
btnSpeakEn.addEventListener("click", (e) => {
  e.stopPropagation();
  const text = (items[idx]?.word || "").trim();
  if (text) speakEn(text);
});

// 搜尋
searchInput.addEventListener("input", (e) => updateSuggestions(e.target.value || ""));
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter"){
    const li = suggestionsUl.querySelector("li");
    if (li){
      go(Number(li.getAttribute("data-i")));
      suggestionsUl.classList.remove("show");
      searchInput.blur();
    }
  }
});
suggestionsUl.addEventListener("click", (e) => {
  const li = e.target.closest("li"); if (!li) return;
  go(Number(li.getAttribute("data-i")));
  suggestionsUl.classList.remove("show");
});

// 鍵盤（桌機 UX）
window.addEventListener("keydown", (e) => {
  if (["INPUT","TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if (e.key === "ArrowRight") next();
  else if (e.key === "ArrowLeft") prev();
  else if (e.key === " "){
    if (isDualMode){ e.preventDefault(); flipped = !flipped; applyCardFace(); }
  }
});

// 尺寸改變時維持兩面等高
window.addEventListener("resize", equalizeCard);

/* ---------- 初始化 ---------- */
(async function init(){
  try{
    items = await loadFromSheet();
  }catch{
    items = [
      { word: "example", pos: "noun", definition: "例子；範例" },
      { word: "quarrel",  pos: "noun/verb", definition: "爭吵／爭執／口角" },
    ];
  }

  try{
    const saved = Number(localStorage.getItem("vocab_idx"));
    if (!Number.isNaN(saved) && saved >= 0 && saved < items.length) idx = saved;
  }catch{}

  renderItem(idx);

  // 保險：首幀確保正確顯示
  applyCardFace();
  equalizeCard();

  // 點其它區域關閉建議
  document.body.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) suggestionsUl.classList.remove("show");
  }, { capture: true });
})();
