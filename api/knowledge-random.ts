import { randomKnowledge } from "../lib/notion";
import { badRequest, handleOptions, sendJSON, serverError } from "./utils";

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const subjects = url.searchParams.getAll("subject");
    if (!process.env.NOTION_TOKEN || !process.env.DB_KNOWLEDGE) {
      return badRequest(res, "Missing NOTION_TOKEN or DB_KNOWLEDGE");
    }
    const item = await randomKnowledge(subjects);
    sendJSON(res, item, "s-maxage=15, stale-while-revalidate=60");
  } catch (e) {
    serverError(res, e);
  }
}
