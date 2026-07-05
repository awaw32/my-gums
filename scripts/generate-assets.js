"use strict";

/**
 * مولد صور SVG للعبة ملك الصحراء
 * ينشئ خلفيات القرى وصور المباني لكل قرية وحالة
 */

const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(__dirname, "..", "assets", "images");
const BUILDINGS_DIR = path.join(ASSETS_DIR, "buildings");
const BG_DIR = path.join(ASSETS_DIR, "bg");

const villages = [
  { id: "wadi", name: "الواحة", primary: "#2e86c1", secondary: "#27ae60", accent: "#f1c40f" },
  { id: "palace_ruins", name: "أطلال القصر", primary: "#8b6914", secondary: "#5d4037", accent: "#d4ac0d" },
  { id: "mountain", name: "قلعة الجبل", primary: "#566573", secondary: "#1a5276", accent: "#82e0aa" },
  { id: "plains", name: "سهول الريف", primary: "#228b22", secondary: "#8b4513", accent: "#f39c12" },
  { id: "throne", name: "قصر الملك", primary: "#b8860b", secondary: "#922b21", accent: "#ffd700" }
];

const buildingTypes = [
  { id: "b1", name: "مدني", icon: "🏛️" },
  { id: "b2", name: "عسكري", icon: "⚔️" },
  { id: "b3", name: "اقتصادي", icon: "📦" },
  { id: "b4", name: "تدريبي", icon: "🏋️" }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function wrapSvg(content, width = 128, height = 128) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${content}</svg>`;
}

function backgroundSvg(village) {
  const { primary, secondary, accent } = village;
  return wrapSvg(`
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${primary}"/>
        <stop offset="60%" stop-color="${secondary}"/>
        <stop offset="100%" stop-color="#1a1a2e"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" fill="url(#bg)"/>
    <circle cx="20" cy="20" r="12" fill="${accent}" opacity="0.8"/>
    ${village.id === "wadi" ? `
      <path d="M0 100 Q30 70 60 100 T120 100 L128 128 L0 128 Z" fill="#27ae60" opacity="0.6"/>
      <rect x="50" y="60" width="4" height="30" fill="#5d4037"/>
      <circle cx="52" cy="55" r="12" fill="#2ecc71"/>
    ` : ""}
    ${village.id === "palace_ruins" ? `
      <rect x="20" y="60" width="15" height="40" fill="#8b6914" opacity="0.7"/>
      <rect x="45" y="50" width="15" height="50" fill="#8b6914" opacity="0.5"/>
      <rect x="70" y="55" width="15" height="45" fill="#8b6914" opacity="0.6"/>
    ` : ""}
    ${village.id === "mountain" ? `
      <path d="M0 128 L40 50 L80 128 Z" fill="#566573" opacity="0.8"/>
      <path d="M60 128 L90 70 L120 128 Z" fill="#7f8c8d" opacity="0.7"/>
      <path d="M30 60 L40 40 L50 60 Z" fill="#fff" opacity="0.6"/>
    ` : ""}
    ${village.id === "plains" ? `
      <path d="M0 90 Q40 80 80 90 T128 95 L128 128 L0 128 Z" fill="#228b22" opacity="0.7"/>
      <line x1="30" y1="95" x2="30" y2="70" stroke="#8b4513" stroke-width="2"/>
      <circle cx="30" cy="65" r="8" fill="#f39c12"/>
    ` : ""}
    ${village.id === "throne" ? `
      <rect x="35" y="50" width="58" height="50" fill="#922b21" opacity="0.8"/>
      <path d="M30 50 L64 25 L98 50 Z" fill="#b8860b"/>
      <rect x="58" y="70" width="12" height="20" fill="#ffd700"/>
    ` : ""}
    <rect width="128" height="128" fill="#000" opacity="0.15"/>
  `);
}

function buildingSvg(village, type, state) {
  const { primary, secondary, accent } = village;
  const baseColor = state === "empty" ? "#5d4037" : state === "building" ? "#7f8c8d" : primary;
  const roofColor = state === "empty" ? "#3e2723" : state === "building" ? "#95a5a6" : secondary;
  const windowColor = state === "empty" ? "#2c1810" : state === "building" ? "#f39c12" : accent;

  let shape = "";

  if (type.id === "b1") {
    // مبنى مدني: قبة/مقر
    shape = `
      <rect x="30" y="55" width="68" height="55" fill="${baseColor}" rx="2"/>
      <path d="M25 55 L64 20 L103 55 Z" fill="${roofColor}"/>
      <rect x="52" y="75" width="24" height="35" fill="#3e2723"/>
      <circle cx="64" cy="95" r="4" fill="${windowColor}"/>
      ${state === "building" ? `<line x1="20" y1="30" x2="108" y2="100" stroke="#e74c3c" stroke-width="2"/><line x1="108" y1="30" x2="20" y2="100" stroke="#e74c3c" stroke-width="2"/>` : ""}
    `;
  } else if (type.id === "b2") {
    // مبنى عسكري: أبراج/سور
    shape = `
      <rect x="25" y="50" width="78" height="60" fill="${baseColor}" rx="2"/>
      <rect x="20" y="40" width="18" height="30" fill="${roofColor}"/>
      <rect x="90" y="40" width="18" height="30" fill="${roofColor}"/>
      <rect x="52" y="78" width="24" height="32" fill="#3e2723"/>
      <path d="M18 40 L29 25 L40 40 Z" fill="${roofColor}"/>
      <path d="M88 40 L99 25 L110 40 Z" fill="${roofColor}"/>
      ${state === "building" ? `<rect x="22" y="25" width="84" height="8" fill="#e74c3c"/><line x1="64" y1="25" x2="64" y2="110" stroke="#e74c3c" stroke-width="2"/>` : ""}
    `;
  } else if (type.id === "b3") {
    // مبنى اقتصادي: مخزن/صندوق
    shape = `
      <rect x="28" y="50" width="72" height="60" fill="${baseColor}" rx="4"/>
      <rect x="28" y="42" width="72" height="12" fill="${roofColor}" rx="2"/>
      <rect x="45" y="80" width="38" height="30" fill="#3e2723" rx="2"/>
      <circle cx="55" cy="95" r="3" fill="${windowColor}"/>
      <circle cx="73" cy="95" r="3" fill="${windowColor}"/>
      ${state === "building" ? `<rect x="24" y="48" width="80" height="6" fill="#e74c3c"/><line x1="64" y1="30" x2="64" y2="110" stroke="#e74c3c" stroke-width="2"/>` : ""}
    `;
  } else if (type.id === "b4") {
    // مبنى تدريبي: ساحة/منصة
    shape = `
      <rect x="20" y="85" width="88" height="25" fill="${baseColor}" rx="2"/>
      <rect x="35" y="55" width="58" height="30" fill="${roofColor}" rx="2"/>
      <rect x="50" y="60" width="28" height="20" fill="#3e2723"/>
      <path d="M30 55 L64 35 L98 55 Z" fill="${roofColor}"/>
      ${state === "building" ? `<line x1="20" y1="40" x2="108" y2="110" stroke="#e74c3c" stroke-width="2"/><line x1="108" y1="40" x2="20" y2="110" stroke="#e74c3c" stroke-width="2"/>` : ""}
    `;
  }

  // حالة الخراب: تشققات وظلال
  const ruinOverlay = state === "empty" ? `
    <line x1="30" y1="45" x2="50" y2="70" stroke="#2c1810" stroke-width="2" opacity="0.5"/>
    <line x1="80" y1="50" x2="70" y2="80" stroke="#2c1810" stroke-width="2" opacity="0.5"/>
    <circle cx="90" cy="95" r="8" fill="#2c1810" opacity="0.3"/>
  ` : "";

  return wrapSvg(`
    <defs>
      <linearGradient id="grad-${village.id}-${type.id}" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${baseColor}"/>
        <stop offset="100%" stop-color="${roofColor}"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" fill="${village.id === "wadi" ? "#d4f1f9" : village.id === "palace_ruins" ? "#f5e6cc" : village.id === "mountain" ? "#d5dbdb" : village.id === "plains" ? "#d5f5e3" : "#f9e79f"}" opacity="0.3"/>
    ${shape}
    ${ruinOverlay}
  `);
}

function main() {
  ensureDir(ASSETS_DIR);
  ensureDir(BG_DIR);
  ensureDir(BUILDINGS_DIR);

  for (const village of villages) {
    // خلفيات القرى
    const bgPath = path.join(BG_DIR, `bg-${village.id}.svg`);
    fs.writeFileSync(bgPath, backgroundSvg(village));
    console.log(`Created ${bgPath}`);

    // صور المباني
    const villageDir = path.join(BUILDINGS_DIR, village.id);
    ensureDir(villageDir);

    for (const type of buildingTypes) {
      for (const state of ["empty", "building", "built"]) {
        const filePath = path.join(villageDir, `${type.id}-${state}.svg`);
        fs.writeFileSync(filePath, buildingSvg(village, type, state));
        console.log(`Created ${filePath}`);
      }
    }
  }

  console.log("\n✅ All assets generated successfully!");
}

main();
