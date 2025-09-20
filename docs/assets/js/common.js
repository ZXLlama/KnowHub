// === 共用設定 ===
window.KNOWHUB = {
  // ⚠️ 請改成你 Vercel API 的網域，例如：
  // API_BASE: "https://knowhub.vercel.app"
  API_BASE: "https://<你的Vercel域名>.vercel.app",

  SUBJECTS: ["國文","英文","數學","物理","化學","生物","地科","其他"],

  subjectColor(tag){
    const map = {
      "國文":["#fde68a","#352600"],
      "英文":["#c7d2fe","#1e1b4b"],
      "數學":["#a7f3d0","#064e3b"],
      "物理":["#bae6fd","#0c4a6e"],
      "化學":["#fecaca","#7f1d1d"],
      "生物":["#bbf7d0","#14532d"],
      "地科":["#e9d5ff","#4c1d95"],
      "其他":["#e5e7eb","#111827"]
    };
    return map[tag] || map["其他"];
  },

  tagChip(tag){
    const [bg,fg] = KNOWHUB.subjectColor(tag);
    return `<span class="badge" style="background:${bg}22;color:${fg};border-color:${bg}55">${tag}</span>`;
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
