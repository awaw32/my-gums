export class GameStore {
  constructor() {
    this._listeners = {};
    this._state = {};
  }

  get(key) {
    return this._state[key];
  }

  set(key, val) {
    const old = this._state[key];
    this._state[key] = val;
    if (old !== val) this._notify(key, val, old);
  }

  update(key, fn) {
    const old = this._state[key];
    const val = fn(old);
    this._state[key] = val;
    if (old !== val) this._notify(key, val, old);
  }

  on(key, cb) {
    (this._listeners[key] = this._listeners[key] || []).push(cb);
    return () => this.off(key, cb);
  }

  off(key, cb) {
    const list = this._listeners[key];
    if (list) this._listeners[key] = list.filter(f => f !== cb);
  }

  _notify(key, val, old) {
    const list = this._listeners[key];
    if (list) for (const cb of list) cb(val, old);
  }
}
