#!/usr/bin/env node
import { createReadStream, stat } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Math.max(1024, Math.min(65535, Number(process.argv[2]) || 8765));
const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".pdf": "application/pdf",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip"
};

createServer((request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname); }
  catch { response.writeHead(400).end("Bad request"); return; }
  const filePath = path.resolve(ROOT, `.${pathname}`);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  stat(filePath, (error, fileInfo) => {
    if (error) { response.writeHead(404).end("Not found"); return; }
    const target = fileInfo.isDirectory() ? path.join(filePath, "index.html") : filePath;
    response.setHeader("Content-Type", MIME[path.extname(target).toLowerCase()] || "application/octet-stream");
    if (target.endsWith(".json")) response.setHeader("Cache-Control", "no-cache");
    const stream = createReadStream(target);
    stream.on("error", () => { if (!response.headersSent) response.writeHead(404); response.end("Not found"); });
    stream.pipe(response);
  });
}).listen(PORT, "127.0.0.1", () => {
  console.log(`ARCHIVE / 026 preview: http://localhost:${PORT}/`);
  console.log("Local only. Press Ctrl+C to stop.");
});
