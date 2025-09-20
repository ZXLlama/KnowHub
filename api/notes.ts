import { queryNotes } from "../lib/notion.js";
import { handleOptions, sendJSON, serverError } from "./utils.js";

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const subject = url.searchParams.getAll("subject");
    const q = url.searchParams.get("q") || "";
    const limit = Number(url.searchParams.get("limit") || 20);
    const cursor = url.searchParams.get("cursor") || undefined;
    const data = await queryNotes({ subjects: subject, q, limit, cursor });
    sendJSON(res, data);
  } catch (e) {
    serverError(res, e);
  }
}
export const config = { api: { bodyParser: false } };
