"use strict";

const fs = require("fs");
const path = require("path");
const { STATIC_EXTS, BUILD_DIR } = require("../config");
const rootDir = path.resolve(__dirname, "../../", BUILD_DIR);

function cachePolicy(ext) {
  if (ext === ".html") return "no-cache, must-revalidate";
  if (ext === ".js" || ext === ".css") return "public, max-age=0, must-revalidate";
  return "public, max-age=86400, must-revalidate";
}

function computeETag(filePath) {
  try {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;
    const size = stat.size;
    return `"${size.toString(16)}-${mtime.toString(16)}"`;
  } catch { return null; }
}

function serveStatic(rawUrl, req, res) {
  const url = decodeURIComponent(rawUrl.split("?")[0]);
  const isRoot = url === "/";
  const ext = isRoot ? ".html" : path.extname(url).toLowerCase();
  if (!STATIC_EXTS[ext]) return false;
  const cleanPath = isRoot ? "index.html" : url.replace(/^\//, "");
  const safePath = path.resolve(rootDir, cleanPath);
  if (!safePath.startsWith(rootDir)) {
    res.writeHead(403); res.end("Forbidden"); return true;
  }
  let filePath = safePath;
  let content = null;
  try {
    content = fs.readFileSync(safePath);
  } catch {
    const pubPath = path.resolve(rootDir, "public", cleanPath);
    if (pubPath.startsWith(rootDir)) {
      try { content = fs.readFileSync(pubPath); filePath = pubPath; } catch { return false; }
    } else {
      return false;
    }
  }
  const etag = computeETag(filePath);
  if (etag && req.headers["if-none-match"] === etag) {
    res.writeHead(304);
    res.end();
    return true;
  }
  const headers = {
    "Content-Type": STATIC_EXTS[ext],
    "Cache-Control": cachePolicy(ext),
    "X-Content-Type-Options": "nosniff"
  };
  if (etag) headers["ETag"] = etag;
  res.writeHead(200, headers);
  res.end(content);
  return true;
}

module.exports = { serveStatic };
