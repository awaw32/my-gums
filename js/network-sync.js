export class NetworkSync {
  constructor(apiBase, username) {
    this.apiBase = apiBase;
    this.username = username;

    this.world = null; // set after construction
    this._ws = null;
    this._wsReconnectTimer = null;
    this._wsInterval = null;
    this._posInterval = null;
    this._boundUnload = null;

    this.onBRMatchEnd = null;
  }

  start() {
    if (this._ws) return;
    this._connectWS();
    this._wsInterval = setInterval(() => this.sendWSUpdate(), 100);
    this._posInterval = setInterval(() => this.sendPositionUpdate(), 5000);
    this._boundUnload = () => this.stop();
    window.addEventListener("beforeunload", this._boundUnload);
  }

  stop() {
    if (this._wsInterval) {
      clearInterval(this._wsInterval);
      this._wsInterval = null;
    }
    if (this._posInterval) {
      clearInterval(this._posInterval);
      this._posInterval = null;
    }
    if (this._wsReconnectTimer) {
      clearTimeout(this._wsReconnectTimer);
      this._wsReconnectTimer = null;
    }
    if (this._ws) {
      this._ws.onclose = null;
      this._ws.onmessage = null;
      this._ws.onerror = null;
      try { this._ws.close(); } catch {}
      this._ws = null;
    }
    if (this._boundUnload) {
      window.removeEventListener("beforeunload", this._boundUnload);
      this._boundUnload = null;
    }
  }

  get isConnected() {
    return !!(this._ws && this._ws.readyState === WebSocket.OPEN);
  }

  send(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data));
    }
  }

  sendWSUpdate() {
    const w = this.world;
    if (!w || !w.leader || !this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    const update = {
      type: "update",
      x_position: Math.floor(w.leader.x),
      y_position: Math.floor(w.leader.y),
      army_power: w.economy ? w.economy.power : 0,
      kills: w.sessionStats.kills,
      coinsEarned: w.sessionStats.coinsEarned,
      unitLevel: w.army?.unitLevel || 1,
      armyAlive: w.armyUnits.filter(u => u.hp > 0).length
    };
    if (w.mode === "battle_royale") {
      update.br_hp = w.leader.hp;
      update.br_alive = w.leader.hp > 0;
      update.br_kills = w.brKills;
    }
    this.send(update);
    if (w._onSelfStatsChanged) {
      w._onSelfStatsChanged(w.sessionStats.kills, w.sessionStats.coinsEarned);
    }
  }

  async sendPositionUpdate() {
    const w = this.world;
    if (!w || !w.leader) return;
    try {
      await fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cash: w.economy?.cash || 0,
          gems: w.economy?.gems || 0,
          gold: w.economy?.gold || 0,
          kingCoins: w.economy?.kingCoins || 0,
          hammers: w.economy?.hammers || 0,
          scrolls: w.economy?.scrolls || 0,
          horns: w.economy?.horns || 0,
          army_power: w.economy ? w.economy.power : 0,
          unitLevel: w.army?.unitLevel || 1,
          weapons: w.army?.weapons?.map(ww => ({ id: ww.id, level: ww.level, upgradeLevel: ww.upgradeLevel })) || [],
          x_position: Math.floor(w.leader.x),
          y_position: Math.floor(w.leader.y),
          kills: w.sessionStats.kills,
          coinsEarned: w.sessionStats.coinsEarned,
          last_active: Date.now()
        })
      });
    } catch {}
  }

  async sendLoginNotification() {
    const w = this.world;
    if (!w || !w.leader) return;
    try {
      await fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: this.username,
          x_position: Math.floor(w.leader.x),
          y_position: Math.floor(w.leader.y),
          army_power: w.economy ? w.economy.power : 0,
          last_active: Date.now()
        })
      });
    } catch {}
  }

  syncMonsters(serverMonsters) {
    const w = this.world;
    if (!w || !serverMonsters || serverMonsters.length === 0) return;
    w._monstersSynced = true;
    const newIds = new Set();
    for (const sm of serverMonsters) {
      newIds.add(sm.id);
      const local = w.monsters.find(m => m.id === sm.id);
      if (local) {
        if (!local._targetX) { local._targetX = local.x; local._targetY = local.y; }
        local._targetX = sm.x;
        local._targetY = sm.y;
        local.hp = sm.hp;
        local.maxHp = sm.maxHp;
        if (local.alive && !sm.alive) {
          local.alive = false;
          local.respawnTimer = sm.respawnTimer || 25;
        } else if (!local.alive && sm.alive) {
          local.alive = true;
          local.hp = sm.hp;
          local.respawnTimer = 0;
        }
      } else {
        w.monsters.push({
          ...sm,
          facing: 1, attackCD: 0,
          _targetX: sm.x, _targetY: sm.y,
          respawnTimer: sm.alive ? 0 : (sm.respawnTimer || 25)
        });
      }
    }
    for (let i = w.monsters.length - 1; i >= 0; i--) {
      if (!newIds.has(w.monsters[i].id)) {
        w.monsters.splice(i, 1);
      }
    }
  }

  syncOtherPlayers(players) {
    const w = this.world;
    if (!w) return;
    const now = Date.now();
    const activeUsernames = new Set();
    for (const p of players) {
      const name = p.username;
      if (!name || name === this.username) continue;
      const lastActive = p.last_active ? new Date(p.last_active).getTime() : 0;
      if (now - lastActive > 10000) continue;
      activeUsernames.add(name);
      const x = p.x_position ?? w.W / 2 + (Math.random() - 0.5) * 400;
      const y = p.y_position ?? w.H / 2 + (Math.random() - 0.5) * 400;
      if (w.otherPlayers.has(name)) {
        const existing = w.otherPlayers.get(name);
        existing.targetX = x;
        existing.targetY = y;
        existing.army_power = p.army_power || 0;
        existing.unitLevel = p.unitLevel || 1;
        existing.armyAlive = p.armyAlive ?? 8;
        existing.lastActive = lastActive;
        existing.br_hp = p.br_hp ?? existing.br_hp;
        existing.br_alive = p.br_alive ?? existing.br_alive;
        existing.kills = p.kills ?? existing.kills ?? 0;
        existing.coinsEarned = p.coinsEarned ?? existing.coinsEarned ?? 0;
      } else {
        w.otherPlayers.set(name, {
          username: name,
          x, y,
          targetX: x, targetY: y,
          radius: 16,
          army_power: p.army_power || 0,
          unitLevel: p.unitLevel || 1,
          armyAlive: p.armyAlive ?? 8,
          lastActive,
          color: p.color || "#3a5a8a",
          br_hp: p.br_hp ?? 120,
          br_alive: p.br_alive ?? true,
          kills: p.kills ?? 0,
          coinsEarned: p.coinsEarned ?? 0,
        });
      }
    }
    for (const [name] of w.otherPlayers) {
      if (!activeUsernames.has(name)) {
        w.otherPlayers.delete(name);
      }
    }
  }

  _connectWS() {
    if (this._ws) return;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const base = this.apiBase ? this.apiBase.replace(/^http/, "ws") : `${protocol}//${location.host}`;
    const url = `${base}/ws/world`;
    this._ws = new WebSocket(url);

    this._ws.onopen = () => {
      const w = this.world;
      this.send({
        type: "join", username: this.username,
        x_position: Math.floor(w?.leader?.x || 1200),
        y_position: Math.floor(w?.leader?.y || 1200),
        army_power: w?.economy ? w.economy.power : 0,
        kills: w?.sessionStats?.kills || 0,
        coinsEarned: w?.sessionStats?.coinsEarned || 0,
        unitLevel: w?.army?.unitLevel || 1,
        armyAlive: w?.armyUnits?.filter(u => u.hp > 0).length || 0
      });
    };

    this._ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        this._handleMessage(msg);
      } catch {}
    };

    this._ws.onclose = () => {
      console.warn("[WS] قطع الاتصال، إعادة محاولة...");
      this._ws = null;
      this._wsReconnectTimer = setTimeout(() => this._connectWS(), 2000);
    };

    this._ws.onerror = () => {};
  }

  _handleMessage(msg) {
    const w = this.world;
    if (!w) return;
    if (msg.type === "world_players") {
      this.syncOtherPlayers(msg.list || []);
      if (w._onPlayersChanged) w._onPlayersChanged(msg.list || []);
    } else if (msg.type === "world_monsters") {
      this.syncMonsters(msg.list || []);
    } else if (msg.type === "monster_killed") {
      const mon = w.monsters.find(m => m.id === msg.id);
      if (mon && mon.alive) { mon.alive = false; mon.hp = 0; mon.respawnTimer = 25; }
    } else if (msg.type === "pvp_notify") {
      if (w._onNotification) w._onNotification(`⚔️ ${msg.attacker} هاجمك بقوة ${msg.power}!`);
    } else if (msg.type === "player_joined") {
      if (w._onNotification) w._onNotification(`👋 ${msg.username} دخل إلى الصحراء`);
    } else if (msg.type === "player_left") {
      if (w._onNotification) w._onNotification(`🚪 ${msg.username} خرج من الصحراء`);
    } else if (msg.type === "broadcast_chat") {
      if (w._onChatMessage) w._onChatMessage(msg.username, msg.message);
    } else if (msg.type === "br_zone_shrink") {
      if (w.mode === "battle_royale") {
        w.zone.radius = msg.radius;
        w.zone.x = msg.centerX;
        w.zone.y = msg.centerY;
      }
    } else if (msg.type === "br_bandit_spawn") {
      if (w.mode === "battle_royale" && msg.bandit) {
        w.bandits.push(msg.bandit);
      }
    } else if (msg.type === "br_player_eliminated") {
      if (w._onNotification) w._onNotification(`💀 ${msg.playerId} قُتل بواسطة ${msg.by}`);
    } else if (msg.type === "br_match_end") {
      if (w.mode === "battle_royale") {
        w.matchEnded = true;
        w.matchStarted = false;
        if (this.onBRMatchEnd) this.onBRMatchEnd(msg);
      }
    }
  }
}
