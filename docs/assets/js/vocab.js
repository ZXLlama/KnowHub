// ====== 設定 ======
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1qIeWrbWWvpkwjLq2pd_3VmjxeHrPGYptyZG4P624qL0/export?format=csv";



// DOM 元素
const wordEl = document.querySelector("#word");
const posEl = document.querySelector("#pos");
const defEl = document.querySelector("#definition");
const idxEl = document.querySelector("#index");
const front = document.querySelector("#front");
const back = document.querySelector("#back");
const cardEl = document.querySelector("#vocab-card .card");

let allWords = [];
let pointer = 0;
let isFlipped = false;
let mode = 1; // 1=翻轉模式(預設), 2=同面模式

// ====== 渲染單字 ======
function renderItem(item, resetToFront = false) {
  wordEl.textContent = item.word || "";
  posEl.textContent  = item.pos ? `(${item.pos}) #${item.index}` : `#${item.index}`;
  defEl.textContent  = item.definition || "";
  idxEl.textContent  = `#${item.index}`;

  if (mode === 1) {
    // 翻轉模式
    if (resetToFront) {
      isFlipped = false;
      front.classList.remove("face-hidden");
      back.classList.add("face-hidden");
    }
  } else {
    // 同面模式
    front.classList.remove("face-hidden");
    back.classList.remove("face-hidden");
  }
}

// ====== 翻轉 ======
function toggleCard() {
  if (!isFlipped) {
    front.classList.add("face-hidden");
    back.classList.remove("face-hidden");
  } else {
    front.classList.remove("face-hidden");
    back.classList.add("face-hidden");
  }
  isFlipped = !isFlipped;
}

// ====== 模式切換 ======
document.querySelector("#mode-toggle").addEventListener("click", () => {
  mode = mode === 1 ? 2 : 1;
  const toggleBtn = document.querySelector("#mode-toggle");
  if (mode === 1) {
    toggleBtn.textContent = "🔀 切換到「同面模式」";
  } else {
    toggleBtn.textContent = "🔀 切換到「翻轉模式」";
  }
  renderItem(allWords[pointer], true);
});

// ====== 點擊卡片 ======
cardEl.addEventListener("click", () => {
  if (mode === 1) toggleCard();
});

// ====== 按鈕事件 ======
document.querySelector("#next").addEventListener("click", () => {
  pointer = (pointer + 1) % allWords.length;
  renderItem(allWords[pointer], true);
});

document.querySelector("#prev").addEventListener("click", () => {
  pointer = (pointer - 1 + allWords.length) % allWords.length;
  renderItem(allWords[pointer], true);
});

document.querySelector("#random").addEventListener("click", () => {
  pointer = Math.floor(Math.random() * allWords.length);
  renderItem(allWords[pointer], true);
});

// ====== 載入資料 ======
async function loadSheet() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();

  const rows = text.split("\n").map(r => r.split(",").map(s => s.trim()));

  allWords = rows
    .map((r, i) => ({
      index: i + 1,
      word: r[0] || "",
      pos: r[1] || "",
      definition: r[2] || ""
    }))
    .filter(x => x.word);

  // ✅ 初始隨機單字
  pointer = Math.floor(Math.random() * allWords.length);
  renderItem(allWords[pointer], true);
}

loadSheet();