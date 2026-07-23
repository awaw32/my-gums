"use strict";

const PORT = parseInt(process.env.PORT) || 3000;
const USE_HTTPS = process.env.HTTPS === "true" || process.env.HTTPS === "1";
const CERT_DIR = process.env.CERT_DIR || "/etc/letsencrypt/live";
const ADMIN_KEY = process.env.ADMIN_KEY || "";
const SENTRY_DSN = process.env.SENTRY_DSN || "";
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "";
const REDIS_URL = process.env.REDIS_URL || "";
const SIM_OWNER = process.env.SIM_OWNER !== "false"; // افتراضياً true (نسخة واحدة تشغّل المحاكاة كالسابق)
const crypto = require("crypto");
const isProd = process.env.NODE_ENV === "production";
// ═══════════════════════════════════════════════════════════════
//  🔐 JWT_SECRET — في التطوير: يُحفظ في ملف ليثبت بين جلسات التشغيل
//  في الإنتاج: يجب تعيينه في .env وإلا يرفض التشغيل
// ═══════════════════════════════════════════════════════════════
const fs = require("fs");
const path = require("path");

const DATA_DIR = process.env.DATA_DIR || "./data";
const BUILD_DIR = process.env.BUILD_DIR || (process.env.NODE_ENV === "production" ? "./dist" : "./");

function getOrCreateJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (isProd) {
    throw new Error("JWT_SECRET is REQUIRED in production. Set it in .env");
  }
  // في التطوير: احفظ السر في ملف .jwt_secret داخل DATA_DIR
  const secretFile = path.resolve(DATA_DIR, ".jwt_secret");
  try {
    // محاولة قراءة السر من الملف
    return fs.readFileSync(secretFile, "utf8").trim();
  } catch {
    // إنشاء سر جديد وحفظه
    const newSecret = crypto.randomBytes(32).toString("hex");
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(secretFile, newSecret, "utf8");
    } catch { /* تجاهل — السيرفر سيبقى شغال بهذا السر */ }
    return newSecret;
  }
}

const JWT_SECRET = getOrCreateJwtSecret();
const JWT_EXPIRES = "24h";
const BUILD_ID = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
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
  SENTRY_DSN,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  REDIS_URL,
  SIM_OWNER,
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
