const card = document.querySelector("#vocab-card");
const flipInner = card.querySelector(".flip-inner");
const wordEl = card.querySelector(".word-text");
const posEl = card.querySelector(".pos-text");
const defEl = card.querySelector(".definition-text");
const ttsBtn = document.querySelector("#tts-btn");

const searchEl = document.querySelector("#search");
const suggestionsEl = document.querySelector("#suggestions");
const randomBtn = document.querySelector("#random");
const prevBtn = document.querySelector("#prev");
const nextBtn = document.querySelector("#next");

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1qIeWrbWWvpkwjLq2pd_3VmjxeHrPGYptyZG4P624qL0/export?format=csv";

let allWords = [];
let pointer = 0;

/* === 讀取 Google Sheet CSV === */
async function loadSheet() {
  try {
    const res = await fetch(SHEET_URL);
    const text = await res.text();
    const rows = text.split("\n").map(r => r.split(",").map(x => x.trim()));

    allWords = rows.map((r, i) => ({
      index: i + 1,
      word: r[0] || "",
      pos: r[1] || "",
      definition: r[2] || ""
    })).filter(x => x.word);

    if (allWords.length > 0) {
      pointer = 0;
      renderItem(allWords[pointer]);
    }
  } catch (e) {
    console.error("讀取失敗", e);
  }
}

/* === 渲染單字 === */
function renderItem(item) {
  // 正面
  wordEl.textContent = item.word;
  posEl.textContent = `(${item.pos}) #${item.index}`;

  // 背面
  defEl.textContent = item.definition;

  // 確保翻回正面
  flipInner.classList.remove("flipped");
}


/* === 發音 (TTS) === */
ttsBtn.addEventListener("click", () => {
  if (!allWords[pointer]) return;
  const utterance = new SpeechSynthesisUtterance(allWords[pointer].word);
  utterance.lang = "en-US";
  speechSynthesis.speak(utterance);
});

/* === 翻轉效果 === */
card.addEventListener("click", () => {
  flipInner.classList.toggle("flipped");
});

/* === 前後 & 隨機 === */
prevBtn.addEventListener("click", () => {
  pointer = (pointer - 1 + allWords.length) % allWords.length;
  renderItem(allWords[pointer]);
});

nextBtn.addEventListener("click", () => {
  pointer = (pointer + 1) % allWords.length;
  renderItem(allWords[pointer]);
});

randomBtn.addEventListener("click", () => {
  pointer = Math.floor(Math.random() * allWords.length);
  renderItem(allWords[pointer]);
});

/* === 搜尋建議 === */
searchEl.addEventListener("input", () => {
  const q = searchEl.value.toLowerCase();
  suggestionsEl.innerHTML = "";
  if (!q) return;

  const matches = allWords.filter(x => x.word.toLowerCase().includes(q));
  matches.slice(0, 5).forEach(item => {
    const li = document.createElement("li");
    li.className = "suggestion-item";
    li.textContent = item.word;
    li.onclick = () => {
      pointer = item.index - 1;
      renderItem(item);
      suggestionsEl.innerHTML = "";
      searchEl.value = "";
    };
    suggestionsEl.appendChild(li);
  });
});

/* 啟動 */
loadSheet();
