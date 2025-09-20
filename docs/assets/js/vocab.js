import { api, renderMath } from './common.js';

const cardEl = document.querySelector('#vocab-card');
const searchEl = document.querySelector('#search');
const randomBtn = document.querySelector('#random');
const prevBtn = document.querySelector('#prev');
const nextBtn = document.querySelector('#next');

let history = [];
let pointer = -1;

async function fetchOne(type = "random") {
  cardEl.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;
  try {
    let data;
    if (type === "search") {
      const q = searchEl.value.trim();
      data = await api('/api/vocab', { q, limit: 1 });
      if (data.items?.length) data = data.items[0];
    } else {
      data = await api('/api/vocab/random');
    }

    if (!data) {
      cardEl.innerHTML = `<div class="card"><p>找不到符合的單字 😢</p></div>`;
      return;
    }

    renderItem(data);

    if (type !== "history") {
      history = history.slice(0, pointer + 1);
      history.push(data);
      pointer++;
    }
  } catch (e) {
    cardEl.innerHTML = `<div class="card"><p>讀取失敗 🚨 ${e.message}</p></div>`;
  }
}

function renderItem(x) {
  const html = `
    <div class="card" style="text-align:center;">
      <h2 style="font-size:2.2rem; margin-bottom:0.5rem;">${x.word}</h2>
      <p style="font-size:1.1rem; color:#94a3b8; margin-bottom:0.8rem;">
        [${x.pronunciation || "—"}] ${x.pos ? `<span style="color:#38bdf8;">(${x.pos})</span>` : ""}
      </p>
      <div style="text-align:left; margin-top:1rem;">
        ${section("定義", x.definition)}
        ${section("例句", x.examples)}
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

randomBtn.onclick = () => fetchOne("random");
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
searchEl.oninput = () => fetchOne("search");

fetchOne("random");
