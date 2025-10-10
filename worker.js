// worker.js — Notion 代理（模糊標題 + 只回標題與內容 + suggest/page 路由）

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors(env) });
    }

    try {
      // 列表查詢：只回 {id,title,content}（依 limit）
      if ((url.pathname === "/api/knowledge" || url.pathname === "/knowledge") && request.method === "GET") {
        const subjects = url.searchParams.getAll("subject");
        const q = (url.searchParams.get("q") || "").trim();
        const limit = clampInt(url.searchParams.get("limit"), 1, 50, 10);
        const fuzzy = url.searchParams.get("fuzzy") === "1";

        // 先向 Notion 拉一批（最多 100 筆），只做 server 端 subject 過濾與（可選）標題 contains
        const pages = await queryNotion(env, { subjects, q: fuzzy ? "" : q, pageSize: 100 });

        // 若模糊搜尋：用標題做距離排序後取前 limit；否則取前 limit
        let picked = pages;
        if (fuzzy && q) {
          picked = rankByTitleSimilarity(pages, q).slice(0, limit);
        } else {
          picked = pages.slice(0, limit);
        }

        const items = await Promise.all(picked.map(p => mapToTitleAndContent(p, env)));
        return json({ items }, env);
      }

      // 隨機一筆：只回 {id,title,content}
      if ((url.pathname === "/api/knowledge/random" || url.pathname === "/knowledge/random") && request.method === "GET") {
        const subjects = url.searchParams.getAll("subject");
        const pages = await queryNotion(env, { subjects, q: "", pageSize: 100 });
        if (!pages.length) return json({ ok: true, items: [] }, env);
        const pick = pages[Math.floor(Math.random() * pages.length)];
        const obj = await mapToTitleAndContent(pick, env);
        return json(obj, env);
      }

      // 模糊標題建議清單（最多 10 筆，僅回 id/title）
      if ((url.pathname === "/api/knowledge/suggest" || url.pathname === "/knowledge/suggest") && request.method === "GET") {
        const subjects = url.searchParams.getAll("subject");
        const q = (url.searchParams.get("q") || "").trim();
        if (!q) return json({ items: [] }, env);
        const pages = await queryNotion(env, { subjects, q: "", pageSize: 100 });
        const ranked = rankByTitleSimilarity(pages, q).slice(0, 10);
        const items = ranked.map(p => ({ id: p.id, title: pickTitle(p, env.TITLE || "標題") }));
        return json({ items }, env);
      }

      // 依 id 取全文（回 {id,title,content}）
      if ((url.pathname === "/api/knowledge/page" || url.pathname === "/knowledge/page") && request.method === "GET") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "missing id" }, env, 400);

        const pageRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
          headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2022-06-28" }
        });
        if (!pageRes.ok) return json({ error: `Notion ${pageRes.status}` }, env, pageRes.status);
        const page = await pageRes.json();
        const obj = await mapToTitleAndContent(page, env);
        return json(obj, env);
      }

      return new Response("Not found", { status: 404, headers: cors(env) });
    } catch (e) {
      return json({ error: String(e.stack || e) }, env, 500);
    }
  }
};

/* -------------------- Notion helpers -------------------- */

async function queryNotion(env, { subjects = [], q = "", pageSize = 100 }) {
  const body = {
    filter: buildFilter(env, subjects, q),
    page_size: Math.min(Math.max(pageSize, 1), 100),
    // 用 last_edited_time 排序，最穩定
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }]
  };

  const r = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28",
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`Notion ${r.status}`);
  const j = await r.json();
  return j.results || [];
}

function buildFilter(env, subjects, q) {
  const filters = [];

  // 科目（multi_select 或 select）
  const subjProp = env.SUBJECT || "科目";
  const subjKind = (env.SUBJECT_KIND || "multi_select").toLowerCase();
  if (subjects && subjects.length) {
    if (subjKind === "select") {
      filters.push({ or: subjects.map(s => ({ property: subjProp, select: { equals: s } })) });
    } else {
      filters.push({ or: subjects.map(s => ({ property: subjProp, multi_select: { contains: s } })) });
    }
  }

  // 非模糊情況：標題 contains（模糊模式下在本地排序，不在 Notion 過濾）
  if (q && q.trim()) {
    const titleProp = env.TITLE || "標題";
    filters.push({ property: titleProp, title: { contains: q.trim() } });
  }

  return filters.length ? { and: filters } : undefined;
}

// 取標題字串
function pickTitle(page, titleName = "標題") {
  const prop = page.properties || {};
  const arr = (prop[titleName]?.title || []);
  return arr.map(x => x.plain_text || "").join("").trim() || "";
}

// 只回 { id, title, content }（content 為 HTML）
async function mapToTitleAndContent(page, env) {
  const title = pickTitle(page, env.TITLE || "標題");
  const content = await fetchPageContentHTML(page.id, env);
  return { id: page.id, title, content };
}

// 取整頁 blocks→HTML
async function fetchPageContentHTML(pageId, env) {
  const blocks = await fetchBlocksRecursive(pageId, env, 2); // 取到第二層
  return blocksToHTML(blocks);
}

async function fetchBlocksRecursive(blockId, env, depth = 1) {
  const list = await listBlocks(blockId, env);
  if (depth <= 0) return list;
  const out = [];
  for (const b of list) {
    if (b.has_children) {
      const children = await fetchBlocksRecursive(b.id, env, depth - 1);
      b.children = children;
    }
    out.push(b);
  }
  return out;
}

async function listBlocks(blockId, env) {
  const url = `https://api.notion.com/v1/blocks/${blockId}/children?page_size=100`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28"
    }
  });
  if (!r.ok) return [];
  const j = await r.json();
  return j.results || [];
}

/* -------------------- HTML renderers -------------------- */

function blocksToHTML(blocks) {
  let html = "";
  let listStack = [];

  const closeLists = (level = 0) => {
    while (listStack.length > level) {
      const tag = listStack.pop();
      html += `</${tag}>`;
    }
  };

  for (const b of blocks) {
    const t = b.type;
    if (t === "paragraph") {
      closeLists();
      html += `<p>${richToHTML(b.paragraph.rich_text)}</p>`;
    } else if (t === "heading_1" || t === "heading_2" || t === "heading_3") {
      closeLists();
      const tag = t === "heading_1" ? "h2" : t === "heading_2" ? "h3" : "h4";
      html += `<${tag}>${richToHTML(b[t].rich_text)}</${tag}>`;
    } else if (t === "bulleted_list_item" || t === "numbered_list_item") {
      const tag = t === "bulleted_list_item" ? "ul" : "ol";
      if (listStack[listStack.length - 1] !== tag) {
        closeLists(0);
        listStack.push(tag);
        html += `<${tag}>`;
      }
      html += `<li>${richToHTML(b[t].rich_text)}${b.children ? blocksToHTML(b.children) : ""}</li>`;
    } else if (t === "quote") {
      closeLists();
      html += `<blockquote>${richToHTML(b.quote.rich_text)}</blockquote>`;
    } else if (t === "callout") {
      closeLists();
      html += `<div class="callout">${richToHTML(b.callout.rich_text)}</div>`;
    } else if (t === "equation") {
      closeLists();
      html += `<div class="math">$$${escapeHTML(b.equation.expression || "")}$$</div>`;
    } else if (t === "code") {
      closeLists();
      const lang = b.code.language || "plain";
      html += `<pre><code class="language-${escapeHTML(lang)}">${escapeHTML(richPlain(b.code.rich_text))}</code></pre>`;
    } else if (t === "divider") {
      // 跳過水平線，不輸出 
    } else {
      closeLists();
      const txt = richPlain(b[b.type]?.rich_text || []);
      if (txt) html += `<p>${escapeHTML(txt)}</p>`;
    }
  }
  closeLists();
  return html;
}

function richPlain(arr) { return (arr || []).map(x => x.plain_text || "").join(""); }

function richToHTML(arr) {
  if (!arr || !arr.length) return "";
  return arr.map(rt => {
    // inline equation
    if (rt.type === "equation" && rt.equation?.expression) {
      return `<span class="math-inline">$${escapeHTML(rt.equation.expression)}$</span>`;
    }
    // normal text + annotations
    let text = escapeHTML(rt.plain_text || "");
    const ann = rt.annotations || {};
    if (ann.code) text = `<code>${text}</code>`;
    if (ann.bold) text = `<strong>${text}</strong>`;
    if (ann.italic) text = `<em>${text}</em>`;
    if (ann.strikethrough) text = `<s>${text}</s>`;
    if (ann.underline) text = `<u>${text}</u>`;
    if (rt.href) text = `<a href="${escapeHTML(rt.href)}" target="_blank" rel="noopener">${text}</a>`;
    return text;
  }).join("");
}



/* -------------------- Fuzzy title ranking -------------------- */

function rankByTitleSimilarity(pages, q) {
  const qn = norm(q);
  const scored = pages.map(p => {
    const title = pickTitle(p);
    const tn = norm(title);
    const d = levenshtein(qn, tn);
    const rel = d / Math.max(1, tn.length);
    return { p, score: rel, title };
  });
  scored.sort((a, b) => a.score - b.score);
  return scored.map(x => x.p);
}

function norm(s) { return (s || "").toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim(); }

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = new Uint16Array((m + 1) * (n + 1));
  for (let i = 0; i <= m; i++) dp[i*(n+1)] = i;
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      const idx = i*(n+1) + j;
      dp[idx] = Math.min(
        dp[(i-1)*(n+1) + j] + 1,
        dp[i*(n+1) + (j-1)] + 1,
        dp[(i-1)*(n+1) + (j-1)] + cost
      );
    }
  }
  return dp[m*(n+1) + n];
}

/* -------------------- misc -------------------- */
function cors(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}
function json(data, env, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors(env), "cache-control": "public, max-age=60" }
  });
}
function clampInt(v, min, max, dfl) {
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : dfl;
}
function escapeHTML(s){return (s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
