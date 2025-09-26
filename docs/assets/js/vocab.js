const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1qIeWrbWWvpkwjLq2pd_3VmjxeHrPGYptyZG4P624qL0/export?format=csv";

const searchInput = document.querySelector("#search");
const suggestionsEl = document.querySelector("#suggestions");

const cardWrap = document.querySelector("#vocab-card");
const cardEl = document.querySelector("#card");
const front = document.querySelector("#front");
const back = document.querySelector("#back");

const wordEl = document.querySelector("#word");
const posEl = document.querySelector("#pos");
const defEl = document.querySelector("#definition");
const idxEl = document.querySelector("#index");

const btnSpeakEn = document.querySelector("#speak-en");
const btnRandom = document.querySelector("#random");
const btnPrev = document.querySelector("#prev");
const btnNext = document.querySelector("#next");
const btnMode = document.querySelector("#mode-toggle");

let allWords = [];
let pointer = 0;
let isFlipped = false;
let mode = Number(localStorage.getItem("vocab_mode")) || 1;

function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(",")
        .map((cell) => cell.trim().replace(/^"|"$/g, ""))
    )
    .filter((row) => row.length && (row[0] ?? "").trim() !== "");
}

function speak(text, lang) {
  if (!window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const voices = speechSynthesis.getVoices();
  const want = voices.find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase()));
  if (want) u.voice = want;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function renderItem(item, resetToFront = false) {
  wordEl.textContent = item.word || "";
  posEl.textContent = item.pos ? `(${item.pos})` : "";
  defEl.textContent = item.definition || "";
  idxEl.textContent = `#${item.index}`;

  if (mode === 1) {
    if (resetToFront) {
      isFlipped = false;
      front.classList.remove("face-hidden");
      back.classList.add("face-hidden");
    }
    cardWrap.classList.remove("same-face");
  } else {
    front.classList.remove("face-hidden");
    back.classList.remove("face-hidden");
    isFlipped = false;
    cardWrap.classList.add("same-face");
  }

  updateModeButton();
}

function toggleCard() {
  if (mode !== 1) return;
  if (!isFlipped) {
    front.classList.add("face-hidden");
    back.classList.remove("face-hidden");
  } else {
    front.classList.remove("face-hidden");
    back.classList.add("face-hidden");
  }
  isFlipped = !isFlipped;
}

function updateModeButton() {
  btnMode.textContent =
    mode === 1 ? "🔀 切換到「同面模式」" : "🔀 切換到「雙面模式」";
}

btnMode.addEventListener("click", () => {
  mode = mode === 1 ? 2 : 1;
  localStorage.setItem("vocab_mode", String(mode));
  renderItem(allWords[pointer], true);
});

btnSpeakEn.addEventListener("click", (e) => {
  e.stopPropagation();
  const word = allWords[pointer]?.word || "";
  if (word) speak(word, "en-US");
});

cardEl.addEventListener("click", (e) => {
  if (e.target.closest(".no-flip")) return;
  if (mode === 1) toggleCard();
});

btnNext.addEventListener("click", () => {
  pointer = (pointer + 1) % allWords.length;
  renderItem(allWords[pointer], true);
});
btnPrev.addEventListener("click", () => {
  pointer = (pointer - 1 + allWords.length) % allWords.length;
  renderItem(allWords[pointer], true);
});
btnRandom.addEventListener("click", () => {
  pointer = Math.floor(Math.random() * allWords.length);
  renderItem(allWords[pointer], true);
});

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") btnNext.click();
  else if (e.key === "ArrowLeft") btnPrev.click();
  else if (e.key === " " || e.key === "Enter") {
    if (mode === 1) { e.preventDefault(); toggleCard(); }
  }
});

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  suggestionsEl.innerHTML = "";
  if (!q) return;
  const matches = allWords
    .filter((x) => x.word.toLowerCase().includes(q))
    .slice(0, 8);
  for (const m of matches) {
    const li = document.createElement("li");
    li.className = "suggestion-item";
    li.textContent = `${m.word} — ${m.definition}`;
    li.addEventListener("click", () => {
      pointer = m.index - 1;
      renderItem(allWords[pointer], true);
      suggestionsEl.innerHTML = "";
      searchInput.blur();
    });
    suggestionsEl.appendChild(li);
  }
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const first = suggestionsEl.querySelector(".suggestion-item");
    if (first) first.click();
  }
});

async function init() {
  const res = await fetch(SHEET_URL);
  const text = await res.text();
  const rows = parseCSV(text);

  allWords = rows
    .map((r, i) => ({
      index: i + 1,
      word: r[0] || "",
      pos: r[1] || "",
      definition: r[2] || ""
    }))
    .filter((x) => x.word);

  pointer = Math.floor(Math.random() * allWords.length);
  speechSynthesis?.getVoices?.();
  renderItem(allWords[pointer], true);
}

init();
