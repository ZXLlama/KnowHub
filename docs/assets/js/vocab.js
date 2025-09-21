import { renderMath } from './common.js';

const cardEl = document.querySelector('#vocab-card');
const searchEl = document.querySelector('#search');
const randomBtn = document.querySelector('#random');
const prevBtn = document.querySelector('#prev');
const nextBtn = document.querySelector('#next');

// 🚨 你的公開 Google Sheet (CSV 匯出)
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1qIeWrbWWvpkwjLq2pd_3VmjxeHrPGYptyZG4P624qL0/export?format=csv";

let allWords = [];
let history = [];
let pointer = -1;
let suggestionsEl;

// 讀取 Google Sheet CSV
async function loadSheet() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    const rows = text.split("\n").map(r => r.split(",").map(x => x.trim()));
    const [header, ...data] = rows;

    allWords = data.map(r => ({
      word: r[0] || "",
      pos: r[1] || "",
      definition: r[2] || ""
    })).filter(x => x.word);

    setupSuggestions();
  } catch (e) {
    cardEl.innerHTML = `<div class="card"><p>載入失敗 🚨 ${e.message}</p></div>`;
  }
}

function renderItem(x) {
  const html = `
    <div class="card" style="text-align:center;">
      <h2 style="font-size:2.2rem; margin-bottom:0.5rem;">${x.word}</h2>
      <p style="font-size:1.1rem; color:#94a3b8; margin-bottom:0.8rem;">
        ${x.pos ? `<span style="color:#38bdf8;">(${x.pos})</span>` : ""}
      </p>
      <div style="text-align:left; margin-top:1rem;">
        ${section("中文", x.definition)}
      </div>
    </div>
  `;
  cardEl.innerHTML = html;
  renderMath(cardEl);
}

function section(title, content) {
  if (!content) return "";
  return `<hr style="margin:1rem 0; border-color:#475569;">
          <h3 style="margin-bottom:0.5rem;">${title}</h3>
          <div class="prose">${content}</div>`;
}

function showWord(word) {
  if (!word) {
    cardEl.innerHTML = `<div class="card"><p>找不到符合的單字 😢</p></div>`;
    return;
  }
  renderItem(word);
  history = history.slice(0, pointer + 1);
  history.push(word);
  pointer++;
}

// 🔍 模糊搜尋 + 中文支援
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
        ${x.word} ${x.pos ? `(${x.pos})` : ""} - ${x.definition}
      </li>
    `).join("");

  suggestionsEl.querySelectorAll(".suggestion-item").forEach((li, i) => {
    li.onclick = () => {
      showWord(results[i]);
      suggestionsEl.innerHTML = "";
      searchEl.value = results[i].word;
    };
  });
}

// 🎲 隨機
function randomWord() {
  if (allWords.length === 0) return;
  const word = allWords[Math.floor(Math.random() * allWords.length)];
  showWord(word);
}

// 綁定事件
randomBtn.onclick = () => randomWord();
prevBtn.onclick = () => {
  if (pointer > 0) {
    pointer--;
    renderItem(history[pointer]);
  }
};
nextBtn.onclick = () => {
  if (pointer < history.length - 1) {
    pointer++;
    renderItem(history[pointer]);
  }
};
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

// 初始化
(async () => {
  await loadSheet();
  randomWord();
})();
