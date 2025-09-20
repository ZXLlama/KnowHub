import { randomVocab } from "../lib/notion";
import { handleOptions, sendJSON, serverError } from "./utils";

export default async function handler(req: any, res: any) {
  if (handleOptions(req, res)) return;
  try {
    const item = await randomVocab();
    sendJSON(res, item, "s-maxage=15, stale-while-revalidate=60");
  } catch (e) {
    serverError(res, e);
  }
}
