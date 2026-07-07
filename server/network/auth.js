"use strict";

const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "desert-kingdom-dev-secret-key-change-in-production";
const JWT_EXPIRES = "24h";

function generateToken(username) {
  return jwt.sign({ username: String(username).slice(0, 30) }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, username: decoded.username };
  } catch {
    return { valid: false, username: null };
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing or invalid Authorization header" }));
    return;
  }
  const token = authHeader.slice(7);
  const result = verifyToken(token);
  if (!result.valid) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid or expired token" }));
    return;
  }
  req.authUsername = result.username;
  next();
}

function wsAuth(req) {
  const params = new URL(req.url, "http://localhost").searchParams;
  const token = params.get("token");
  if (!token) return { authenticated: false, username: null };
  return verifyToken(token);
}

module.exports = { generateToken, verifyToken, authMiddleware, wsAuth, JWT_SECRET };
