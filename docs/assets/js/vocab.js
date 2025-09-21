import { renderMath } from './common.js';

const cardEl = document.querySelector('#vocab-card');
const searchEl = document.querySelector('#search');
const randomBtn = document.querySelector('#random');
const prevBtn = document.querySelector('#prev');
const nextBtn = document.querySelector('#next');

// 🚨 你的公開 Google Sheet (CSV 匯出)
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1qIeWrbWWvpkwjLq2pd_3VmjxeHrPGYptyZG4P624qL0/export?format=csv";

let allWords = [];
let suggestionsEl;
let currentIndex = -1; // 🔥 新增：追蹤目前位置

// 讀取 Google Sheet CSV
async function loadSheet() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    const rows = text.split("\n").map(r => r.split(",").map(x => x.trim()));
    const [header, ...data] = rows;

    allWords = data.map((r, i) => ({
      word: r[0] || "",
      pos: r[1] || "",
      definition: r[2] || "",
      index: i + 2 // 因為第一列是標題
    })).filter(x => x.word);

    setupSuggestions();
  } catch (e) {
    cardEl.innerHTML = `<div class="card"><p>載入失敗 🚨 ${e.message}</p></div>`;
  }
}

function renderItem(x) {
  const html = `
    <div class="card" style="text-align:center; position:relative;">
      <span style="position:absolute; top:0.5rem; right:0.8rem; font-size:0.9rem; color:#94a3b8;">
        #${x.index}
      </span>
      <h2 style="font-size:2.2rem; margin-bottom:0.5rem;">${x.word}</h2>
      <p style="font-size:1.1rem; color:#94a3b8; margin-bottom:1rem;">
        ${x.pos ? `<span style="color:#38bdf8;">(${x.pos})</span>` : ""}
      </p>
      <div style="margin-top:1rem; text-align:center;">
        <p style="font-size:1.5rem; font-weight:bold;">${x.definition}</p>
      </div>
    </div>
  `;
  cardEl.innerHTML = html;
  renderMath(cardEl);
}

function showWordByIndex(i) {
  if (i < 0 || i >= allWords.length) return;
  currentIndex = i;
  renderItem(allWords[i]);
}

// 🔍 搜尋
function searchWord(q) {
  q = q.toLowerCase();
  if (!q) {
    suggestionsEl.innerHTML = "";
    return;
  }

  const results = allWords.filter(x =>
    x.word.toLowerCase().includes(q) ||
    x.pos.toLowerCase().includes(q) ||
    x.definition.toLowerCase().includes(q)
  );

  if (!results.length) {
    suggestionsEl.innerHTML = `<li style="padding:0.5rem; color:#94a3b8;">找不到結果</li>`;
    return;
  }

  suggestionsEl.innerHTML = results
    .slice(0, 10)
    .map(x => `
      <li class="suggestion-item" style="padding:0.5rem; cursor:pointer; border-bottom:1px solid #374151;">
        #${x.index} ${x.word} ${x.pos ? `(${x.pos})` : ""} - ${x.definition}
      </li>
    `).join("");

  suggestionsEl.querySelectorAll(".suggestion-item").forEach((li, i) => {
    li.onclick = () => {
      const chosen = results[i];
      const idx = allWords.findIndex(w => w.index === chosen.index);
      showWordByIndex(idx);
      suggestionsEl.innerHTML = "";
      searchEl.value = chosen.word;
    };
  });
}

// 🎲 隨機
function randomWord() {
  if (allWords.length === 0) return;
  const i = Math.floor(Math.random() * allWords.length);
  showWordByIndex(i);
}

// 綁定事件
randomBtn.onclick = () => randomWord();
prevBtn.onclick = () => showWordByIndex(currentIndex - 1);
nextBtn.onclick = () => showWordByIndex(currentIndex + 1);
searchEl.oninput = () => searchWord(searchEl.value.trim());

// 建立建議列表容器
function setupSuggestions() {
  suggestionsEl = document.createElement("ul");
  suggestionsEl.style.listStyle = "none";
  suggestionsEl.style.padding = "0";
  suggestionsEl.style.margin = "0.5rem 0 0 0";
  suggestionsEl.style.background = "#1f2937";
  suggestionsEl.style.border = "1px solid #374151";
  suggestionsEl.style.borderRadius = "0.5rem";
  suggestionsEl.style.maxHeight = "200px";
  suggestionsEl.style.overflowY = "auto";
  searchEl.insertAdjacentElement("afterend", suggestionsEl);
}

// 初始化：預設第一個單字
(async () => {
  await loadSheet();
  if (allWords.length > 0) {
    showWordByIndex(0);
  }
})();
