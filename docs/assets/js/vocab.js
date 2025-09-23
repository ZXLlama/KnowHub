// ====== DOM ======
const cardEl = document.querySelector('#vocab-card');
const flipInner = document.querySelector('#flip-inner');

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

const FLIP_DURATION = 600; // ms；CSS 也會用到對應值
let isFlipped = false;     // 目前是否看到背面
let allWords = [];
let pointer = 0;

// ====== 讀取 CSV ======
async function loadSheet() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();

  // 簡單 CSV 解析（你的資料沒有引號包逗號，這樣就夠）
  const rows = text.split("\n").map(r => r.split(",").map(s => s.trim()));

  allWords = rows
    .map((r, i) => ({ index: i + 1, word: r[0] || "", pos: r[1] || "", definition: r[2] || "" }))
    .filter(x => x.word);

  pointer = 0;
  renderItem(allWords[pointer], /*resetToFront=*/true);
}

// ====== 渲染 ======
function renderItem(item, resetToFront = false) {
  wordEl.textContent = item.word;
  posEl.textContent  = item.pos ? `(${item.pos}) #${item.index}` : `#${item.index}`;
  defEl.textContent  = item.definition;
  idxEl.textContent  = `#${item.index}`;

  // 保證切換單字時回到正面，並隱藏背面
  if (resetToFront) {
    isFlipped = false;
    flipInner.classList.remove('flipped');
    front.classList.remove('face-hidden');
    back.classList.add('face-hidden');
  }
}

// ====== 翻轉：在 90° 切換顯示面 ======
function smartFlip() {
  const goingToBack = !isFlipped;

  // 啟動旋轉
  flipInner.classList.add('animating');
  // 先切換旋轉狀態（0→180 或 180→0）
  flipInner.classList.toggle('flipped', goingToBack);

  // 在動畫一半時切換可見面
  setTimeout(() => {
    isFlipped = goingToBack;
    if (isFlipped) {
      front.classList.add('face-hidden');
      back.classList.remove('face-hidden');
    } else {
      back.classList.add('face-hidden');
      front.classList.remove('face-hidden');
    }
  }, FLIP_DURATION / 2);

  // 動畫結束收尾
  setTimeout(() => {
    flipInner.classList.remove('animating');
  }, FLIP_DURATION);
}

// ====== 事件 ======
cardEl.addEventListener('click', () => smartFlip());

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
  renderItem(allWords[pointer], /*resetToFront=*/true);
});

nextBtn.addEventListener('click', () => {
  pointer = (pointer + 1) % allWords.length;
  renderItem(allWords[pointer], /*resetToFront=*/true);
});

randomBtn.addEventListener('click', () => {
  pointer = Math.floor(Math.random() * allWords.length);
  renderItem(allWords[pointer], /*resetToFront=*/true);
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
      renderItem(item, /*resetToFront=*/true);
      suggestionsEl.innerHTML = '';
      searchEl.value = '';
    };
    suggestionsEl.appendChild(li);
  });
});

// 手機滑動（左→下一個、右→上一個）
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
