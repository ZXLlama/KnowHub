import { api, tagChip, renderMath } from './common.js';

const chipsEl = document.querySelector('#subject-chips');
const searchEl = document.querySelector('#search');
const listEl = document.querySelector('#notes-list');
const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
const closeModal = document.querySelector('#closeModal');

let selectedSubjects = new Set();

function renderChips() {
  chipsEl.innerHTML = KNOWHUB.SUBJECTS.map(s =>
    `<button data-s="${s}" class="${selectedSubjects.has(s) ? 'active' : ''}">${s}</button>`
  ).join('');

  chipsEl.querySelectorAll('button').forEach(b => {
    b.onclick = () => {
      const s = b.dataset.s;
      selectedSubjects.has(s) ? selectedSubjects.delete(s) : selectedSubjects.add(s);
      fetchNotes();
      renderChips();
    };
  });
}

async function fetchNotes() {
  listEl.innerHTML = `<div class="skeleton" style="height:200px;"></div>`;
  try {
    const subject = [...selectedSubjects];
    const q = searchEl.value.trim();
    const data = await api('/api/notes', { subject, q, limit: 20 });

    if (!data.items?.length) {
      listEl.innerHTML = `<p style="text-align:center; color:#94a3b8;">沒有找到符合的筆記 😢</p>`;
      return;
    }

    listEl.innerHTML = data.items.map(renderListItem).join('');
    listEl.querySelectorAll('.note-item').forEach(el => {
      el.onclick = () => {
        const id = el.dataset.id;
        const note = data.items.find(x => x.id === id);
        showModal(note);
      };
    });
  } catch (e) {
    listEl.innerHTML = `<p style="color:#f87171;">讀取失敗 🚨 ${e.message}</p>`;
  }
}

function renderListItem(note) {
  return `
    <div class="card note-item" data-id="${note.id}" style="cursor:pointer; margin-bottom:1rem;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
        <h3 style="font-size:1.2rem; margin:0;">${note.title}</h3>
        <div>${note.subject.map(tagChip).join('')}</div>
      </div>
      <p style="color:#94a3b8; margin-top:0.5rem; font-size:0.9rem;">
        ${note.content.slice(0, 100)}...
      </p>
    </div>
  `;
}

function showModal(note) {
  modal.style.display = "flex";
  modalContent.innerHTML = `
    <h2 style="font-size:1.5rem; margin-bottom:1rem;">${note.title}</h2>
    <div>${note.subject.map(tagChip).join('')}</div>
    <hr style="margin:1rem 0; border-color:#475569;">
    <div class="prose">${note.content}</div>
    <p style="margin-top:1rem; font-size:0.85rem; color:#94a3b8;">
      最後更新：${KNOWHUB.fmtDate(note.last_edited_time)}
    </p>
  `;
  renderMath(modalContent);
}

closeModal.onclick = () => { modal.style.display = "none"; };
modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };

searchEl.oninput = () => fetchNotes();

renderChips();
fetchNotes();
