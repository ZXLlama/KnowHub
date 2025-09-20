// === 共用設定 ===
window.KNOWHUB = {
  // ⚠️ 請改成你 Vercel API 的網域，例如：
  // API_BASE: "https://knowhub.vercel.app"
  API_BASE: "https://<你的Vercel域名>.vercel.app",

  SUBJECTS: ["國文","英文","數學","物理","化學","生物","地科","其他"],

  subjectColor(tag){
  const map = {
    "國文":["#fef3c7","#92400e"],
    "英文":["#e0e7ff","#3730a3"],
    "數學":["#d1fae5","#065f46"],
    "物理":["#bae6fd","#0c4a6e"],
    "化學":["#fecdd3","#881337"],
    "生物":["#dcfce7","#166534"],
    "地科":["#ede9fe","#5b21b6"],
    "其他":["#f3f4f6","#374151"]
  };
  return map[tag] || map["其他"];
},

tagChip(tag){
  const [bg,fg] = KNOWHUB.subjectColor(tag);
  return `
    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
          style="background:${bg}; color:${fg}; border:1px solid ${fg}22;">
      ${tag}
    </span>`;
},


  renderMath(scope=document.body){
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
  },

  fmtDate(iso){
    try{ return new Date(iso).toLocaleString("zh-TW",{hour12:false}); }
    catch{ return ""; }
  },

  async api(path, params={}){
    const url = new URL(KNOWHUB.API_BASE + path);
    Object.entries(params).forEach(([k,v])=>{
      if (Array.isArray(v)) v.forEach(x=> url.searchParams.append(k,x));
      else if (v!==undefined && v!==null && v!=="") url.searchParams.set(k,v);
    });
    const r = await fetch(url);
    if (!r.ok) throw new Error("API error " + r.status);
    return r.json();
  }
};

// === 全域快捷鍵：按 "/" 聚焦第一個搜尋框 ===
document.addEventListener("keydown", (e)=>{
  if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
    const el = document.querySelector("input[type=search]");
    if (el){ e.preventDefault(); el.focus(); }
  }
});
