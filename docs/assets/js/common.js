// === 共用設定 ===
export const SUBJECTS = ["國文","英文","數學","物理","化學","生物","地科","其他"];

export function subjectColor(tag) {
  const map = {
    "國文": ["#fef3c7", "#92400e"],
    "英文": ["#e0e7ff", "#3730a3"],
    "數學": ["#d1fae5", "#065f46"],
    "物理": ["#bae6fd", "#0c4a6e"],
    "化學": ["#fecdd3", "#881337"],
    "生物": ["#dcfce7", "#166534"],
    "地科": ["#ede9fe", "#5b21b6"],
    "其他": ["#f3f4f6", "#374151"]
  };
  return map[tag] || map["其他"];
}

export function tagChip(tag) {
  const [bg, fg] = subjectColor(tag);
  return `
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style="background:${bg}; color:${fg}; border:1px solid ${fg}22;">
      ${tag}
    </span>`;
}

export function renderMath(scope=document.body) {
  if (!window.renderMathInElement) return;
  renderMathInElement(scope, {
    delimiters: [
      {left:"$$",right:"$$",display:true},
      {left:"$",right:"$",display:false},
      {left:"\\(",right:"\\)",display:false},
      {left:"\\[",right:"\\]",display:true}
    ],
    throwOnError:false
  });
}

export function fmtDate(iso) {
  try { 
    return new Date(iso).toLocaleString("zh-TW", {hour12:false}); 
  }
  catch { 
    return ""; 
  }
}

// === 全域快捷鍵：按 "/" 聚焦第一個搜尋框 ===
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
    const el = document.querySelector("input[type=search]");
    if (el) { e.preventDefault(); el.focus(); }
  }
});
