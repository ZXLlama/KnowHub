import { api, tagChip, renderMath } from './common.js';

const chipsEl = document.querySelector('#subject-chips');
const cardEl = document.querySelector('#knowledge-card');
const searchEl = document.querySelector('#search');
const randomBtn = document.querySelector('#random');
const prevBtn = document.querySelector('#prev');
const nextBtn = document.querySelector('#next');

let selectedSubjects = new Set();
let history = [];
let pointer = -1;

function renderChips() {
  chipsEl.innerHTML = KNOWHUB.SUBJECTS.map(s =>
    `<button data-s="${s}" class="${selectedSubjects.has(s) ? 'active' : ''}">${s}</button>`
  ).join('');

  chipsEl.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      const s = b.dataset.s;
      selectedSubjects.has(s) ? selectedSubjects.delete(s) : selectedSubjects.add(s);
      fetchOne();
      renderChips();
    };
  });
}

async function fetchOne(type = "random") {
  cardEl.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;

  try {
    const subject = [...selectedSubjects];
    let data;

    if (type === "search") {
      data = await api('/api/knowledge', { subject, q: searchEl.value.trim(), limit: 1 });
      if (data.items?.length) data = data.items[0];
    } else {
      data = await api('/api/knowledge/random', { subject });
    }

    if (!data) {
      cardEl.innerHTML = `<div class="card"><p>找不到符合的內容 😢</p></div>`;
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
    <div class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
        <h2 style="font-size:1.5rem;">${x.title}</h2>
        <div>${x.subject.map(tagChip).join('')}</div>
      </div>
      ${section("快速重點", x.quick)}
      ${section("解釋 / 定義", x.definition)}
      ${section("詳細說明", x.detail)}
      ${section("常見考點 / 易錯點", x.pitfalls)}
      ${section("舉例說明", x.examples)}
      <p style="margin-top:1rem; font-size:0.85rem; color:#94a3b8;">
        最後更新：${KNOWHUB.fmtDate(x.last_edited_time)}
      </p>
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

renderChips();
fetchOne("random");
