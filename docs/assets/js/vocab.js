// ====== DOM ======
const cardEl = document.querySelector('#vocab-card');

const front = document.querySelector('#face-front');
const back = document.querySelector('#face-back');

const wordEl = document.querySelector('#word');
const posEl  = document.querySelector('#pos');
const defEl  = document.querySelector('#def');
const idxEl  = document.querySelector('#corner-index');

const searchEl = document.querySelector('#search');
const suggestionsEl = document.querySelector('#suggestions');

const prevBtn   = document.querySelector('#prev');
const nextBtn   = document.querySelector('#next');
const randomBtn = document.querySelector('#random');
const ttsBtn    = document.querySelector('#tts-btn');

// ====== 設定 ======
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1qIeWrbWWvpkwjLq2pd_3VmjxeHrPGYptyZG4P624qL0/export?format=csv";

let isFlipped = false;
let allWords = [];
let pointer = 0;

// ====== 讀取 CSV ======
async function loadSheet() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();

  const rows = text.split("\n").map(r => r.split(",").map(s => s.trim()));

  allWords = rows
    .map((r, i) => ({ index: i + 1, word: r[0] || "", pos: r[1] || "", definition: r[2] || "" }))
    .filter(x => x.word);

  pointer = 0;
  renderItem(allWords[pointer], true);
}

// ====== 渲染 ======
function renderItem(item, resetToFront = false) {
  wordEl.textContent = item.word;
  posEl.textContent  = item.pos ? `(${item.pos}) #${item.index}` : `#${item.index}`;
  defEl.textContent  = item.definition;
  idxEl.textContent  = `#${item.index}`;

  if (resetToFront) {
    isFlipped = false;
    front.classList.remove('face-hidden');
    back.classList.add('face-hidden');
  }
}

// ====== 點擊切換 ======
function toggleCard() {
  isFlipped = !isFlipped;
  if (isFlipped) {
    front.classList.add('face-hidden');
    back.classList.remove('face-hidden');
  } else {
    back.classList.add('face-hidden');
    front.classList.remove('face-hidden');
  }
  // 小縮放特效
  cardEl.style.transform = 'scale(0.97)';
  setTimeout(() => cardEl.style.transform = 'scale(1)', 150);
}

// ====== 事件 ======
cardEl.addEventListener('click', () => toggleCard());

ttsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const w = allWords[pointer]?.word;
  if (!w) return;
  const u = new SpeechSynthesisUtterance(w);
  u.lang = 'en-US';
  speechSynthesis.speak(u);
});

prevBtn.addEventListener('click', () => {
  pointer = (pointer - 1 + allWords.length) % allWords.length;
  renderItem(allWords[pointer], true);
});

nextBtn.addEventListener('click', () => {
  pointer = (pointer + 1) % allWords.length;
  renderItem(allWords[pointer], true);
});

randomBtn.addEventListener('click', () => {
  pointer = Math.floor(Math.random() * allWords.length);
  renderItem(allWords[pointer], true);
});

// 搜尋 + 建議
searchEl.addEventListener('input', () => {
  const q = searchEl.value.trim().toLowerCase();
  suggestionsEl.innerHTML = '';
  if (!q) return;
  const list = allWords.filter(x =>
    x.word.toLowerCase().includes(q) ||
    x.pos.toLowerCase().includes(q) ||
    x.definition.toLowerCase().includes(q)
  ).slice(0, 8);

  list.forEach(item => {
    const li = document.createElement('li');
    li.className = 'suggestion-item';
    li.textContent = `#${item.index} ${item.word} ${item.pos ? '(' + item.pos + ')' : ''}`;
    li.onclick = () => {
      pointer = item.index - 1;
      renderItem(item, true);
      suggestionsEl.innerHTML = '';
      searchEl.value = '';
    };
    suggestionsEl.appendChild(li);
  });
});

// 手機滑動
(function setupSwipe() {
  let sx = 0;
  cardEl.addEventListener('touchstart', e => sx = e.touches[0].clientX);
  cardEl.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) < 50) return;
    if (dx > 0) prevBtn.click(); else nextBtn.click();
  });
})();

// ====== init ======
loadSheet();
