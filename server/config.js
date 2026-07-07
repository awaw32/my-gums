"use strict";

const PORT = parseInt(process.env.PORT) || 3000;
const USE_HTTPS = process.env.HTTPS === "true" || process.env.HTTPS === "1";
const CERT_DIR = process.env.CERT_DIR || "/etc/letsencrypt/live";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const JWT_SECRET = process.env.JWT_SECRET || "desert-kingdom-dev-secret-change-in-production";
const JWT_EXPIRES = "24h";
const BUILD_ID = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
const DATA_DIR = process.env.DATA_DIR || "./data";
const BUILD_DIR = process.env.BUILD_DIR || (process.env.NODE_ENV === "production" ? "./dist" : "./");
const WORLD_W = 3200;
const WORLD_H = 3200;
const TICK_MS = 50;
const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX) || 600;

const PLAYER_COLORS = ["#c0392b","#2980b9","#27ae60","#8e44ad","#d35400","#16a085","#2c3e50","#f39c12","#1abc9c","#e67e22","#9b59b6","#34495e"];

const STATIC_EXTS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

module.exports = {
  PORT,
  USE_HTTPS,
  CERT_DIR,
  ADMIN_KEY,
  BUILD_ID,
  DATA_DIR,
  BUILD_DIR,
  WORLD_W,
  WORLD_H,
  TICK_MS,
  RATE_LIMIT_WINDOW,
  RATE_LIMIT_MAX,
  PLAYER_COLORS,
  STATIC_EXTS,
  JWT_SECRET,
  JWT_EXPIRES,
};
