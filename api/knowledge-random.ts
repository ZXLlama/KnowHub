import { randomKnowledge } from "../lib/notion.js";
import { badRequest, handleOptions, sendJSON, serverError } from "./utils.js";

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const subject = url.searchParams.getAll("subject");
    if (!process.env.NOTION_TOKEN || !process.env.DB_KNOWLEDGE) {
      return badRequest(res, "Missing NOTION_TOKEN or DB_KNOWLEDGE");
    }
    const item = await randomKnowledge(subject);
    sendJSON(res, item, "s-maxage=15, stale-while-revalidate=60");
  } catch (e) {
    serverError(res, e);
  }
}
export const config = { api: { bodyParser: false } };
