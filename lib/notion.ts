import { Client } from "@notionhq/client";

export const notion = new Client({ auth: process.env.NOTION_TOKEN });

export const DB = {
  KNOWLEDGE: process.env.DB_KNOWLEDGE!,
  VOCAB: process.env.DB_VOCAB || "",
  NOTES: process.env.DB_NOTES || ""
};

// --- Utils: RichText/Blocks 轉 HTML（保留 LaTeX，交給前端 KaTeX） ---
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[m]!));
}

export function richToHTML(rich: any[] = []): string {
  return rich.map((r: any) => {
    if (r.type === "equation") return `$${r.equation?.expression || ""}$`;
    let text = r?.plain_text ?? "";
    // simple marks
    if (r.annotations?.code) text = `<code>${escapeHtml(text)}</code>`;
    if (r.annotations?.bold) text = `<strong>${text}</strong>`;
    if (r.annotations?.italic) text = `<em>${text}</em>`;
    if (r.annotations?.underline) text = `<u>${text}</u>`;
    if (r.annotations?.strikethrough) text = `<s>${text}</s>`;
    if (r.href) text = `<a href="${escapeHtml(r.href)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`;
    return text.replace(/\n/g, "<br/>");
  }).join("");
}

export async function blocksToHTML(blockId: string): Promise<string> {
  const r = await notion.blocks.children.list({ block_id: blockId, page_size: 100 });
  const parts: string[] = [];
  for (const b of r.results as any[]) {
    const t = b.type;
    if (t === "paragraph") parts.push(`<p>${richToHTML(b.paragraph.rich_text)}</p>`);
    else if (t === "heading_1") parts.push(`<h2>${richToHTML(b.heading_1.rich_text)}</h2>`);
    else if (t === "heading_2") parts.push(`<h3>${richToHTML(b.heading_2.rich_text)}</h3>`);
    else if (t === "heading_3") parts.push(`<h4>${richToHTML(b.heading_3.rich_text)}</h4>`);
    else if (t === "bulleted_list_item") parts.push(`<li>${richToHTML(b.bulleted_list_item.rich_text)}</li>`);
    else if (t === "numbered_list_item") parts.push(`<li>${richToHTML(b.numbered_list_item.rich_text)}</li>`);
    else if (t === "equation") parts.push(`$$${b.equation.expression}$$`);
    else if (t === "quote") parts.push(`<blockquote>${richToHTML(b.quote.rich_text)}</blockquote>`);
    else if (t === "code") {
      const lang = b.code.language || "text";
      parts.push(`<pre><code class="language-${lang}">${escapeHtml(b.code.rich_text?.map((x:any)=>x.plain_text).join("")||"")}</code></pre>`);
    }
  }
  // 合併連續 <li>
  const html = parts.join("\n").replace(/(?:<li>[\s\S]*?<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
  return html;
}

// --- Knowledge ---
export async function queryKnowledge({ subjects = [], q = "", limit = 10, cursor }: { subjects?: string[], q?: string, limit?: number, cursor?: string }) {
  const filter: any = { and: [] as any[] };
  if (subjects.length) {
    // Notion 沒有 multi-select OR in a single condition；用 or: [] 支持多選
    filter.and.push({
      or: subjects.map(s => ({ property: "Subject", multi_select: { contains: s } }))
    });
  }
  if (q) {
    filter.and.push({ property: "Title", title: { contains: q } });
  }
  const r = await notion.databases.query({
    database_id: DB.KNOWLEDGE,
    page_size: Math.min(limit, 50),
    start_cursor: cursor,
    filter: filter.and.length ? filter : undefined,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }]
  });

  const items = await Promise.all(r.results.map(cleanKnowledge));
  return { items, nextCursor: r.has_more ? r.next_cursor : null };
}

export async function randomKnowledge(subjects: string[] = []) {
  // 撈一批近編輯的 20 筆後隨機
  const { items } = await queryKnowledge({ subjects, limit: 20 });
  return items[Math.floor(Math.random() * Math.max(items.length, 1))] || null;
}

async function cleanKnowledge(p: any) {
  const props = p.properties;
  const title = props?.Title?.title?.[0]?.plain_text || "Untitled";
  const subject = props?.Subject?.multi_select?.map((x: any) => x.name) || [];
  const slug = props?.Slug?.rich_text?.[0]?.plain_text || p.id;
  const quick = richToHTML(props?.Quick?.rich_text || []);
  const definition = richToHTML(props?.Definition?.rich_text || []);
  const pitfalls = richToHTML(props?.Pitfalls?.rich_text || []);
  const examples = richToHTML(props?.Examples?.rich_text || []);
  let detail = "";
  if (props?.Detail?.rich_text?.length) {
    detail = richToHTML(props.Detail.rich_text);
  } else {
    detail = await blocksToHTML(p.id); // 若你把細節寫在頁面 Blocks
  }
  return {
    id: p.id,
    slug,
    title,
    subject,
    quick,
    definition,
    detail,
    pitfalls,
    examples,
    last_edited_time: p.last_edited_time
  };
}

// --- Vocab ---
export async function queryVocab({ q = "", limit = 20, cursor }: { q?: string, limit?: number, cursor?: string }) {
  if (!DB.VOCAB) return { items: [], nextCursor: null };
  const filter: any = q ? { property: "Word", title: { contains: q } } : undefined;
  const r = await notion.databases.query({
    database_id: DB.VOCAB,
    page_size: Math.min(limit, 50),
    start_cursor: cursor,
    filter,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }]
  });
  const items = r.results.map((p: any) => {
    const props = p.properties;
    return {
      id: p.id,
      slug: props?.Slug?.rich_text?.[0]?.plain_text || p.id,
      word: props?.Word?.title?.[0]?.plain_text || "Untitled",
      pronunciation: props?.Pronunciation?.rich_text?.[0]?.plain_text || "",
      pos: props?.POS?.select?.name || "",
      definition: richToHTML(props?.Definition?.rich_text || []),
      examples: richToHTML(props?.Examples?.rich_text || [])
    };
  });
  return { items, nextCursor: r.has_more ? r.next_cursor : null };
}
export async function randomVocab() {
  const { items } = await queryVocab({ limit: 20 });
  return items[Math.floor(Math.random() * Math.max(items.length, 1))] || null;
}

// --- Notes ---
export async function queryNotes({ subjects = [], q = "", limit = 20, cursor }: { subjects?: string[], q?: string, limit?: number, cursor?: string }) {
  if (!DB.NOTES) return { items: [], nextCursor: null };
  const filter: any = { and: [] as any[] };
  if (subjects.length) {
    filter.and.push({ or: subjects.map(s => ({ property: "Subject", multi_select: { contains: s } })) });
  }
  if (q) filter.and.push({ property: "Title", title: { contains: q } });

  const r = await notion.databases.query({
    database_id: DB.NOTES,
    page_size: Math.min(limit, 50),
    start_cursor: cursor,
    filter: filter.and.length ? filter : undefined,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }]
  });

  const items = await Promise.all(r.results.map(async (p: any) => {
    const props = p.properties;
    const content = await blocksToHTML(p.id);
    return {
      id: p.id,
      slug: props?.Slug?.rich_text?.[0]?.plain_text || p.id,
      title: props?.Title?.title?.[0]?.plain_text || "Untitled",
      subject: props?.Subject?.multi_select?.map((x: any) => x.name) || [],
      content,
      last_edited_time: p.last_edited_time
    };
  }));
  return { items, nextCursor: r.has_more ? r.next_cursor : null };
}
