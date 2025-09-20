import type { IncomingMessage, ServerResponse } from "http";

export function setCORS(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function handleOptions(req: IncomingMessage, res: ServerResponse) {
  if (req.method === "OPTIONS") {
    setCORS(res);
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function sendJSON(res: ServerResponse, data: any, cache = "s-maxage=60, stale-while-revalidate=300") {
  setCORS(res);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(data));
}

export function badRequest(res: ServerResponse, msg: string) {
  setCORS(res);
  res.statusCode = 400;
  res.end(JSON.stringify({ error: msg }));
}

export function serverError(res: ServerResponse, e: any) {
  setCORS(res);
  res.statusCode = 500;
  res.end(JSON.stringify({ error: String(e?.message || e) }));
}
