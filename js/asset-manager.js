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
        console.warn(`[Assets] Failed to load: ${url}`);
        this.loadedAssets++;
        resolve(null);
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
