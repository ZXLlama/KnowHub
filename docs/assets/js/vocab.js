import { renderMath } from './common.js';

const cardEl = document.querySelector('#vocab-card');
const searchEl = document.querySelector('#search');
const randomBtn = document.querySelector('#random');
const prevBtn = document.querySelector('#prev');
const nextBtn = document.querySelector('#next');

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1qIeWrbWWvpkwjLq2pd_3VmjxeHrPGYptyZG4P624qL0/export?format=csv";

let allWords = [];
let suggestionsEl;
let currentIndex = -1;
let flipped = false; // 翻轉狀態

// === 讀取 CSV ===
async function loadSheet() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    const rows = text.split("\n").map(r => r.split(",").map(x => x.trim()));

    allWords = rows.map((r, i) => ({
      word: r[0] || "",
      pos: r[1] || "",
      definition: r[2] || "",
      index: i + 1
    })).filter(x => x.word);

    setupSuggestions();
  } catch (e) {
    cardEl.innerHTML = `<div class="card"><p>載入失敗 🚨 ${e.message}</p></div>`;
  }
}

// === 渲染字卡 ===
function renderItem(x) {
  const html = `
    <div class="card flip-card ${flipped ? "flipped" : ""} fade" id="word-card">
      <div class="flip-inner">
        <!-- 正面 (英文) -->
        <div class="flip-front" style="text-align:center; position:relative;">
          <span style="position:absolute; top:0.5rem; right:0.8rem; font-size:0.9rem; color:#94a3b8;">
            #${x.index}
          </span>
          <h2 class="word-text">${x.word}</h2>
          <p class="pos-text">${x.pos ? `<span>(${x.pos})</span>` : ""}</p>
          <button class="btn-tts" id="tts-btn">🔊 發音</button>
        </div>

        <!-- 背面 (中文) -->
        <div class="flip-back">
          <p class="definition-text">${x.definition}</p>
        </div>
      </div>
    </div>
  `;
  cardEl.innerHTML = html;
  renderMath(cardEl);

  const wordCard = document.querySelector("#word-card");
  const ttsBtn = document.querySelector("#tts-btn");

  // 點整張卡片翻轉
  wordCard.onclick = () => {
    flipped = !flipped;
    wordCard.classList.toggle("flipped");
  };

  // 發音按鈕 → 阻止翻轉
  ttsBtn.onclick = (e) => {
    e.stopPropagation();
    speakWord(x.word);
  };

  // 觸發淡入動畫
  requestAnimationFrame(() => {
    wordCard.classList.add("fade-in");
  });
}

// === TTS 發音 ===
function speakWord(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  speechSynthesis.speak(utter);
}

// === 翻頁 (含淡出/淡入) ===
function showWordByIndex(i) {
  if (allWords.length === 0) return;

  if (i < 0) i = allWords.length - 1;
  if (i >= allWords.length) i = 0;

  const oldCard = document.querySelector("#word-card");
  if (oldCard) {
    oldCard.classList.remove("fade-in");
    oldCard.classList.add("fade-out");

    // 等動畫結束後再換字卡
    oldCard.addEventListener("animationend", () => {
      currentIndex = i;
      flipped = false;
      renderItem(allWords[i]);
    }, { once: true });
  } else {
    currentIndex = i;
    flipped = false;
    renderItem(allWords[i]);
  }
}

// === 搜尋 ===
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

// === 隨機 ===
function randomWord() {
  if (allWords.length === 0) return;
  const i = Math.floor(Math.random() * allWords.length);
  showWordByIndex(i);
}

// === 綁定 ===
randomBtn.onclick = () => randomWord();
prevBtn.onclick = () => showWordByIndex(currentIndex - 1);
nextBtn.onclick = () => showWordByIndex(currentIndex + 1);
searchEl.oninput = () => searchWord(searchEl.value.trim());

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

// === 手機滑動手勢 ===
function setupSwipe() {
  let startX = 0;
  let endX = 0;

  cardEl.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  cardEl.addEventListener("touchend", (e) => {
    endX = e.changedTouches[0].clientX;
    const diff = endX - startX;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        showWordByIndex(currentIndex - 1); // 右滑
      } else {
        showWordByIndex(currentIndex + 1); // 左滑
      }
    }
  });
}

// === 初始化 ===
(async () => {
  await loadSheet();
  if (allWords.length > 0) {
    showWordByIndex(0);
  }
  setupSwipe();
})();
