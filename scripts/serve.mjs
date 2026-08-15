// Local edit server for the Kintaro Formulary.
// Serves the generated viewer AND lets the UX write back: removing a product in
// the browser moves its row from formulary.csv (the source of truth) into
// archived.csv (recoverable) and regenerates the artifacts. Undo restores the
// most recently archived row. Every write is password-gated. Zero dependencies.
//
// Usage:  node scripts/serve.mjs   then open http://localhost:8000
// Password defaults to 1542; override with DELETE_PASSWORD=... node scripts/serve.mjs
// Localhost single-user tool: the password is a light gate, not real auth
// (anyone who can read these files can read it), so do not expose it to a network.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";
import { execFileSync } from "node:child_process";
import { removeFormularyRow, appendRow, popLastRow, loadRows } from "../lib/vocab.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSV_PATH = join(ROOT, "formulary.csv");
const ARCHIVE_PATH = join(ROOT, "archived.csv");
const PORT = Number(process.env.PORT) || 8000;
const DELETE_PASSWORD = process.env.DELETE_PASSWORD || "1542";
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".csv": "text/csv",
  ".md": "text/markdown",
  ".js": "text/javascript",
  ".ico": "image/x-icon",
};

function json(res, code, obj) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

const readCsv = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const rebuild = () => execFileSync(process.execPath, [join(ROOT, "scripts", "build.mjs")], { stdio: "ignore" });

function handleRemove(payload, res) {
  const { row } = payload;
  if (!row || typeof row !== "object") return json(res, 400, { ok: false, reason: "missing row" });
  try {
    const { csv, row: removed } = removeFormularyRow(readFileSync(CSV_PATH, "utf8"), row);
    writeFileSync(ARCHIVE_PATH, appendRow(readCsv(ARCHIVE_PATH), removed)); // archive before dropping
    writeFileSync(CSV_PATH, csv);
    rebuild();
    json(res, 200, { ok: true });
  } catch (e) {
    json(res, 409, { ok: false, reason: String(e.message || e) });
  }
}

function handleUndo(res) {
  try {
    const { csv: newArchive, row } = popLastRow(readCsv(ARCHIVE_PATH));
    const restored = appendRow(readFileSync(CSV_PATH, "utf8"), row);
    loadRows(restored); // validate the restore before writing anything
    writeFileSync(CSV_PATH, restored);
    writeFileSync(ARCHIVE_PATH, newArchive);
    rebuild();
    json(res, 200, { ok: true, restored: row.product_name });
  } catch (e) {
    json(res, 409, { ok: false, reason: String(e.message || e) });
  }
}

function serveStatic(req, res) {
  let p = decodeURIComponent((req.url || "/").split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = normalize(join(ROOT, p));
  if (file !== ROOT && !file.startsWith(ROOT + "/")) return void res.writeHead(403).end("forbidden");
  if (!existsSync(file) || !statSync(file).isFile()) return void res.writeHead(404).end("not found");
  res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
}

const AUTHED = new Set(["/api/remove", "/api/undo", "/api/unlock"]);

createServer((req, res) => {
  if (req.method === "POST" && AUTHED.has(req.url)) {
    let body = "";
    req.on("data", (c) => {
      body += c;
      if (body.length > 1e6) req.destroy();
    });
    req.on("end", () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        return json(res, 400, { ok: false, reason: "invalid JSON" });
      }
      if (payload.password !== DELETE_PASSWORD) return json(res, 401, { ok: false, reason: "wrong password" });
      if (req.url === "/api/unlock") return json(res, 200, { ok: true });
      if (req.url === "/api/remove") return handleRemove(payload, res);
      return handleUndo(res);
    });
    return;
  }
  if (req.method !== "GET") return void res.writeHead(405).end("method not allowed");
  serveStatic(req, res);
}).listen(PORT, () => console.log(`[serve] http://localhost:${PORT}  \u2014 password-gated removals write formulary.csv (archived to archived.csv)`));
