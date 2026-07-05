export class NetClient {
  constructor(url = "/ws/online") {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.playerId = null;
    this.roomId = null;
    this.seq = 0;
    this.otherPlayers = new Map();
    this.onState = null;
    this.onPlayerJoined = null;
    this.onPlayerLeft = null;
    this.onError = null;
  }

  connect(playerId, roomId, loadout) {
    this.playerId = playerId;
    this.roomId = roomId;
    this.loadout = loadout;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.connected = true;
      this.ws.send(JSON.stringify({ t: "join", playerId, roomId, loadout }));
    };

    this.ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      switch (msg.t) {
        case "state":
          if (this.onState) this.onState(msg);
          break;
        case "player_joined":
          if (this.onPlayerJoined) this.onPlayerJoined(msg.id);
          break;
        case "player_left":
          this.otherPlayers.delete(msg.id);
          if (this.onPlayerLeft) this.onPlayerLeft(msg.id);
          break;
        case "error":
          if (this.onError) this.onError(msg);
          break;
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
    };

    this.ws.onerror = () => {};
  }

  sendInput(axes, actions = {}) {
    if (!this.connected) return;
    this.ws.send(JSON.stringify({
      t: "input",
      seq: this.seq++,
      axes: { x: axes.x || 0, y: axes.y || 0 },
      actions,
      ts: Date.now(),
    }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.send(JSON.stringify({ t: "leave" }));
      this.ws.close();
    }
    this.connected = false;
  }
}
