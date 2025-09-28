// assets/js/common.js
export const BASE = (window.KNOWHUB && window.KNOWHUB.API_BASE) || 'https://your-worker.example.workers.dev';

export async function api(path, payload = null) {
  const url = new URL(path, BASE);
  // GET with querystring for simple filters
  if (payload && !(payload instanceof FormData) && (path.includes('/random') || path.includes('/knowledge'))) {
    Object.entries(payload).forEach(([k, v]) => {
      if (Array.isArray(v)) v.forEach(vv => url.searchParams.append(k, vv));
      else if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), { method: 'GET', mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function tagChip(label) {
  return `<span style="
    display:inline-block;padding:.25rem .5rem;border-radius:999px;
    background:linear-gradient(135deg,#7cf0ff55,#8aa9ff55);
    border:1px solid #ffffff33;color:#e8ecf1;font-size:.8rem
  ">${label}</span>`;
}

// 讓 KaTeX 自動渲染 knowledge.js 動態注入的內容
export function renderMath(scope = document) {
  if (!window.renderMathInElement) return;
  window.renderMathInElement(scope, {
    delimiters: [
      {left:'$$',right:'$$',display:true},
      {left:'$',right:'$',display:false},
      {left:'\\(',right:'\\)',display:false},
      {left:'\\[',right:'\\]',display:true}
    ],
    throwOnError:false
  });
}

// 供 knowledge.js 顯示時間
if (!window.KNOWHUB) window.KNOWHUB = {};
window.KNOWHUB.fmtDate = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-TW', { hour12:false });
  } catch { return iso || ''; }
};