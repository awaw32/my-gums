const PALETTE = ["#c2956a", "#a0764a", "#d4a574", "#8b5e3c", "#e8c9a0"];

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function generatePlaceholder(key, width, height, label) {
  const c = document.createElement("canvas");
  c.width = width || 64;
  c.height = height || 64;
  const ctx = c.getContext("2d");
  const hue = hashCode(key || label || "?") % PALETTE.length;
  ctx.fillStyle = PALETTE[hue];
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, c.width - 2, c.height - 2);
  ctx.fillStyle = "#3e2723";
  ctx.font = `bold ${Math.min(c.width, c.height) * 0.45}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label || "?", c.width / 2, c.height / 2);
  return c;
}

export function placeholderDataUrl(key, w, h, label) {
  return generatePlaceholder(key, w, h, label).toDataURL();
}

export class AssetManager {
  constructor() {
    this.images = new Map();
    this.audioBuffers = new Map();
    this.loaded = false;
    this.totalAssets = 0;
    this.loadedAssets = 0;
  }

  addImage(key, url) {
    this.totalAssets++;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(key, img);
        this.loadedAssets++;
        resolve(img);
      };
      img.onerror = () => {
        const placeholder = generatePlaceholder(key, 64, 64, key.slice(0, 2));
        this.images.set(key, placeholder);
        this.loadedAssets++;
        resolve(placeholder);
      };
      img.src = url;
    });
  }

  getImage(key) {
    return this.images.get(key) || null;
  }

  get progress() {
    if (this.totalAssets === 0) return 1;
    return this.loadedAssets / this.totalAssets;
  }

  async loadAll() {
    if (this.totalAssets === 0) {
      this.loaded = true;
      return;
    }
    this.loaded = true;
  }
}

export function createImgElement(key, alt, cls) {
  const img = document.createElement("img");
  img.alt = alt || key;
  img.className = cls || "";
  img.onerror = function () {
    this.onerror = null;
    this.src = placeholderDataUrl(key, 64, 64, (alt || key).slice(0, 2));
  };
  return img;
}
