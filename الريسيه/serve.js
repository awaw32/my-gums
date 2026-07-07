const http = require("http");
const fs = require("fs");
const path = require("path");
const PORT = 8080;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "application/javascript", ".png": "image/png", ".css": "text/css", ".json": "application/json" };
http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  let fp = url === "/" ? "index.html" : url.slice(1);
  fp = path.resolve(__dirname, fp);
  if (!fp.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
  const ext = path.extname(fp);
  try {
    const c = fs.readFileSync(fp);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-cache" });
    res.end(c);
  } catch { res.writeHead(404); res.end("404"); }
}).listen(PORT, () => console.log(`→ http://localhost:${PORT}`));
