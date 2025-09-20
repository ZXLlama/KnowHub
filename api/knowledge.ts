import { queryKnowledge } from "../lib/notion.js";
import { badRequest, handleOptions, sendJSON, serverError } from "./utils.js";

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const subject = url.searchParams.getAll("subject");
    const q = url.searchParams.get("q") || "";
    const limit = Number(url.searchParams.get("limit") || 10);
    const cursor = url.searchParams.get("cursor") || undefined;

    if (!process.env.NOTION_TOKEN || !process.env.DB_KNOWLEDGE) {
      return badRequest(res, "Missing NOTION_TOKEN or DB_KNOWLEDGE");
    }
    const data = await queryKnowledge({ subjects: subject, q, limit, cursor });
    sendJSON(res, data);
  } catch (e) {
    serverError(res, e);
  }
}
export const config = { api: { bodyParser: false } };
