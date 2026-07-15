import { ExtractionMode } from "./modes/extraction-mode.js";
import { HordeMode } from "./modes/horde-mode.js";
import { CaveMode } from "./modes/cave-mode.js";

export function injectModesMethods(WorldMap) {
  WorldMap.prototype.switchToMode = function (modeName) {
    // تنظيف أي وضع سابق (BR, campaign, etc.)
    if (this.mode === "battle_royale") {
      this.matchStarted = false;
      this.matchEnded = false;
      this.bandits = [];
      this.killFeed = [];
      document.getElementById("br-timer")?.classList.add("hidden");
      document.getElementById("br-players")?.classList.add("hidden");
      document.getElementById("br-kills")?.classList.add("hidden");
      document.getElementById("br-kill-feed")?.classList.add("hidden");
      document.getElementById("br-zone-warning")?.classList.add("hidden");
    }
    this.exitCurrentMode();
    let mode;
    switch (modeName) {
      case "extraction": mode = new ExtractionMode(this); break;
      case "horde": mode = new HordeMode(this); break;
      case "cave": mode = new CaveMode(this); break;
      default: return;
    }
    if (mode) {
      mode.init();
      this._activeMode = mode;
      this.enterWorldMap();
    }
  };

  WorldMap.prototype.exitCurrentMode = function () {
    if (this._activeMode) {
      if (typeof this._activeMode.exit === 'function') this._activeMode.exit();
      this._activeMode = null;
    }
  };
}
