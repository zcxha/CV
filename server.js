/* Zero-dependency static server for local use.
 * Run: node server.js
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 5173);
const ROOT = process.cwd();

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

function safePath(urlPath) {
  const raw = decodeURIComponent(urlPath.split("?")[0]);
  const rel = raw === "/" ? "/index.html" : raw;
  const normalized = path.posix.normalize(rel);
  if (normalized.includes("..")) return null;
  return path.join(ROOT, normalized);
}

const server = http.createServer((req, res) => {
  const filePath = safePath(req.url || "/");
  if (!filePath) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }

  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME.get(ext) || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(buf);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CV Chunk Studio running: http://0.0.0.0:${PORT}`);
});

