import { randomVocab } from "../lib/notion.js";
import { handleOptions, sendJSON, serverError } from "./utils.js";

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;
  try {
    const item = await randomVocab();
    sendJSON(res, item, "s-maxage=15, stale-while-revalidate=60");
  } catch (e) {
    serverError(res, e);
  }
}
export const config = { api: { bodyParser: false } };
