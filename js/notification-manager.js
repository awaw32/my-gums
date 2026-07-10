export class NotificationManager {
  constructor() {
    this.container = document.getElementById("notification-container");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "notification-container";
      this.container.className = "notification-container";
      document.body.appendChild(this.container);
    }
    this.container.setAttribute("aria-live", "polite");
    this._history = [];
    this._maxVisible = 5;
    this._visible = 0;
    this._maxHistory = 50;
  }

  show(text, type = "info", duration = 3000) {
    if (!text) return;
    const toast = document.createElement("div");
    toast.className = `notification-toast notif-${type}`;
    toast.textContent = text;
    toast.addEventListener("click", () => this._dismiss(toast));
    this.container.appendChild(toast);
    this._visible++;
    this._pruneVisible();
    this._history.push({ text, type, t: Date.now() });
    if (this._history.length > this._maxHistory) this._history.shift();
    setTimeout(() => this._dismiss(toast), duration);
  }

  success(text, duration) { this.show(text, "success", duration || 3000); }
  error(text, duration) { this.show(text, "error", duration || 5000); }
  warning(text, duration) { this.show(text, "warning", duration || 4000); }
  info(text, duration) { this.show(text, "info", duration || 3000); }
  battle(text, duration) { this.show(text, "battle", duration || 2500); }
  system(text, duration) { this.show(text, "system", duration || 3500); }

  clear() {
    this.container.querySelectorAll(".notification-toast").forEach(t => t.remove());
    this._visible = 0;
  }

  getHistory() { return [...this._history]; }

  clearHistory() { this._history = []; }

  _dismiss(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add("notif-dismiss");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      this._visible = Math.max(0, this._visible - 1);
    }, 300);
  }

  _pruneVisible() {
    if (this._visible <= this._maxVisible) return;
    const all = this.container.querySelectorAll(".notification-toast");
    for (let i = 0; i < all.length - this._maxVisible; i++) {
      all[i].classList.add("notif-dismiss");
      setTimeout(() => {
        if (all[i].parentNode) all[i].parentNode.removeChild(all[i]);
        this._visible = Math.max(0, this._visible - 1);
      }, 300);
    }
  }
}
