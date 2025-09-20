// 為了相容性＆不必額外型別依賴，直接用 any；已在 tsconfig 加入 @types/node 仍可改回型別
export function setCORS(res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export function handleOptions(req: any, res: any) {
  if (req.method === "OPTIONS") {
    setCORS(res);
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

export function sendJSON(res: any, data: any, cache = "s-maxage=60, stale-while-revalidate=300") {
  setCORS(res);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(data));
}

export function badRequest(res: any, msg: string) {
  setCORS(res);
  res.statusCode = 400;
  res.end(JSON.stringify({ error: msg }));
}

export function serverError(res: any, e: any) {
  setCORS(res);
  res.statusCode = 500;
  res.end(JSON.stringify({ error: String(e?.message || e) }));
}
