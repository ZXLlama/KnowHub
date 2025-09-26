// ────────────────────────────────────────────────────────────
//  Config
// ────────────────────────────────────────────────────────────
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1qIeWrbWWvpkwjLq2pd_3VmjxeHrPGYptyZG4P624qL0/export?format=csv";

// ────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────
const $  = (sel, root = document) => root.querySelector(sel);
const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function debounce(fn, wait = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

// Robust CSV line parser (supports quotes, commas, "" escape)
function parseCSVLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (c === "," && !q) {
      out.push(cur.trim()); cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseCSVLine);
}

// ────────────────────────────────────────────────────────────
/** speech */
function speak(text, lang) {
  if (!("speechSynthesis" in window) || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  // pick a suitable voice if available
  const pick = (voices) =>
    voices.find(v => v.lang?.toLowerCase().startsWith(lang.toLowerCase()));
  const voices = speechSynthesis.getVoices();
  const v = pick(voices);
  if (v) u.voice = v;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

// Prewarm voices (Safari)
on(window, "voiceschanged", () => speechSynthesis.getVoices());

// ────────────────────────────────────────────────────────────
//  DOM refs (null-safe)
// ────────────────────────────────────────────────────────────
const searchInput   = $("#search");
const suggestionsEl = $("#suggestions");

const cardWrap = $("#vocab-card");
const cardEl   = $("#card");
const front    = $("#front");
const back     = $("#back");

const wordEl = $("#word");
const posEl  = $("#pos");
const defEl  = $("#definition");
const idxEl  = $("#index");

const btnSpeakEn = $("#speak-en");     // ← 只宣告一次
const btnRandom  = $("#random");
const btnPrev    = $("#prev");
const btnNext    = $("#next");
const btnMode    = $("#mode-toggle");

// ────────────────────────────────────────────────────────────
//  State
// ────────────────────────────────────────────────────────────
let allWords = [];
let pointer  = 0;
let isFlipped = false;
let mode = Number(localStorage.getItem("vocab_mode")) || 1; // 1=雙面 2=同面

// ────────────────────────────────────────────────────────────
//  UI helpers
// ────────────────────────────────────────────────────────────
function setButtonsEnabled(enabled) {
  [btnRandom, btnPrev, btnNext, btnMode, btnSpeakEn].forEach(b => {
    if (b) b.disabled = !enabled;
  });
}

function updateModeButton() {
  if (!btnMode) return;
  btnMode.textContent = mode === 1
    ? "🔀 切換到「同面模式」"
    : "🔀 切換到「雙面模式」";
}

// 強制讓卡片兩面高度一致（文字變動後仍一致）
function equalizeCard() {
  if (!front || !back) return;
  front.style.minHeight = back.style.minHeight = "auto";
  const h = Math.max(front.offsetHeight, back.offsetHeight);
  front.style.minHeight = back.style.minHeight = h + "px";
}

// ────────────────────────────────────────────────────────────
//  Render
// ────────────────────────────────────────────────────────────
function renderItem(item, resetToFront = false) {
  if (!item) return;

  if (wordEl) wordEl.textContent = item.word || "";
  if (posEl)  posEl.textContent  = item.pos ? `(${item.pos})` : "";
  if (defEl)  defEl.textContent  = item.definition || "";
  if (idxEl)  idxEl.textContent  = `#${item.index}`;

  if (mode === 1) {
    // 雙面
    if (resetToFront) {
      isFlipped = false;
      front?.classList.remove("face-hidden");
      back?.classList.add("face-hidden");
    }
    cardWrap?.classList.remove("same-face");
  } else {
    // 同面
    front?.classList.remove("face-hidden");
    back?.classList.remove("face-hidden");
    isFlipped = false;
    cardWrap?.classList.add("same-face");
  }

  equalizeCard();
  updateModeButton();
}

function toggleCard() {
  if (mode !== 1) return;
  if (!front || !back) return;
  if (!isFlipped) {
    front.classList.add("face-hidden");
    back.classList.remove("face-hidden");
  } else {
    front.classList.remove("face-hidden");
    back.classList.add("face-hidden");
  }
  isFlipped = !isFlipped;
}

// ────────────────────────────────────────────────────────────
//  Events（全部 null-safe 綁定）
// ────────────────────────────────────────────────────────────
on(btnMode, "click", () => {
  mode = mode === 1 ? 2 : 1;
  localStorage.setItem("vocab_mode", String(mode));
  renderItem(allWords[pointer], true);
});

on(btnSpeakEn, "click", (e) => {
  e.stopPropagation();
  const w = allWords[pointer]?.word || "";
  speak(w, "en-US");
});

on(cardEl, "click", (e) => {
  if (e.target?.closest?.(".no-flip")) return; // TTS/控制元件不翻面
  if (mode === 1) toggleCard();
});

on(btnNext, "click", () => {
  if (!allWords.length) return;
  pointer = (pointer + 1) % allWords.length;
  renderItem(allWords[pointer], true);
});

on(btnPrev, "click", () => {
  if (!allWords.length) return;
  pointer = (pointer - 1 + allWords.length) % allWords.length;
  renderItem(allWords[pointer], true);
});

on(btnRandom, "click", () => {
  if (!allWords.length) return;
  pointer = Math.floor(Math.random() * allWords.length);
  renderItem(allWords[pointer], true);
});

// Keyboard: ← → / 空白 / Enter
on(window, "keydown", (e) => {
  if (!allWords.length) return;
  if (e.key === "ArrowRight") btnNext?.click();
  else if (e.key === "ArrowLeft") btnPrev?.click();
  else if (e.key === " " || e.key === "Enter") {
    if (mode === 1) { e.preventDefault(); toggleCard(); }
  }
});

// 搜尋（debounce）
on(searchInput, "input", debounce(() => {
  const q = (searchInput?.value || "").trim().toLowerCase();
  if (!suggestionsEl) return;
  suggestionsEl.innerHTML = "";
  if (!q) return;
  const matches = allWords
    .filter(x => x.word.toLowerCase().includes(q))
    .slice(0, 8);
  for (const m of matches) {
    const li = document.createElement("li");
    li.className = "suggestion-item";
    li.textContent = `${m.word} — ${m.definition}`;
    li.addEventListener("click", () => {
      pointer = m.index - 1; // 因為我們會重新編號，這裡一定安全
      renderItem(allWords[pointer], true);
      suggestionsEl.innerHTML = "";
      searchInput?.blur();
    });
    suggestionsEl.appendChild(li);
  }
}, 120));

on(searchInput, "keydown", (e) => {
  if (e.key === "Enter" && suggestionsEl) {
    const first = suggestionsEl.querySelector(".suggestion-item");
    if (first) first.click();
  }
});

// ────────────────────────────────────────────────────────────
//  Data loading
// ────────────────────────────────────────────────────────────
async function init() {
  setButtonsEnabled(false);
  try {
    const res  = await fetch(SHEET_URL, { cache: "no-store" });
    const text = await res.text();
    const rows = parseCSV(text);

    // 先 map 再 filter，最後重新編號（確保 index 與陣列索引一致）
    const cleaned = rows
      .map((r) => ({ word: r[0] || "", pos: r[1] || "", definition: r[2] || "" }))
      .filter(x => x.word);

    allWords = cleaned.map((x, i) => ({ ...x, index: i + 1 }));

    if (!allWords.length) throw new Error("No data in sheet.");

    // 初始隨機單字
    pointer = Math.floor(Math.random() * allWords.length);

    // Safari: 預熱 voices
    speechSynthesis?.getVoices?.();

    renderItem(allWords[pointer], true);
  } catch (err) {
    console.error("Load vocab failed:", err);
    // very small fallback
    allWords = [{ index: 1, word: "fallback", pos: "n.", definition: "後備方案" }];
    pointer = 0;
    renderItem(allWords[pointer], true);
  } finally {
    setButtonsEnabled(true);
  }
}

init();
