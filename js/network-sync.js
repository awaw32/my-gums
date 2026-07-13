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
    this._wsInterval = setInterval(() => this.sendWSUpdate(), 200);
    this._posInterval = setInterval(() => this.sendPositionUpdate(), 30000);
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
      army_power: w.economy ? w.economy.power : 5000,
      kills: w.sessionStats.kills,
      coinsEarned: w.sessionStats.coinsEarned,
      unitLevel: w.army?.unitLevel || 1,
      armyAlive: w.armyUnits.filter(u => u.hp > 0).length,
      hp: Math.floor(w.leader.hp),
      maxHp: Math.floor(w.leader.maxHp),
      level: w.economy?.level || 1,
      armyYardLevel: w.economy?.armyYardLevel || 1,
      knowledgeLevel: w.economy?.knowledgeLevel || 1,
      knowledgeType: w.economy?.knowledgeType || "economic",
      equippedWeapon: w._equippedWeapon || "",
      weaponStarLevel: w._weaponStarLevel || 1,
      weaponGemLevel: w._weaponGemLevel || 1,
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

  _authHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = localStorage.getItem("player_token");
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  async sendPositionUpdate() {
    const w = this.world;
    if (!w || !w.leader) return;
    try {
      await fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
        method: "POST",
        headers: this._authHeaders(),
        body: JSON.stringify({
          x_position: Math.floor(w.leader.x),
          y_position: Math.floor(w.leader.y),
          kills: w.sessionStats?.kills || 0,
          last_active: Date.now()
        })
      });
    } catch (e) { console.warn("[NetSync] sendPositionUpdate:", e.message); }
  }

  async sendLoginNotification() {
    const w = this.world;
    if (!w || !w.leader) return;
    try {
      await fetch(`${this.apiBase}/api/players/${encodeURIComponent(this.username)}`, {
        method: "POST",
        headers: this._authHeaders(),
        body: JSON.stringify({
          username: this.username,
          x_position: Math.floor(w.leader.x),
          y_position: Math.floor(w.leader.y),
          army_power: w.economy ? w.economy.power : 5000,
          last_active: Date.now()
        })
      });
    } catch (e) { console.warn("[NetSync] sendLoginNotification:", e.message); }
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
        const imageKey = w._getMonsterImageKey(sm.enemyId || sm.name || "");
        w.monsters.push({
          ...sm,
          imageKey,
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
        existing.army_power = p.army_power || 5000;
        existing.unitLevel = p.unitLevel || 1;
        existing.armyAlive = p.armyAlive ?? 8;
        existing.lastActive = lastActive;
        existing.hp = p.hp ?? existing.hp ?? 120;
        existing.maxHp = p.maxHp ?? existing.maxHp ?? 120;
        existing.br_hp = p.br_hp ?? existing.br_hp;
        existing.br_alive = p.br_alive ?? existing.br_alive;
        existing.kills = p.kills ?? existing.kills ?? 0;
        existing.coinsEarned = p.coinsEarned ?? existing.coinsEarned ?? 0;
        existing.armyYardLevel = p.armyYardLevel ?? existing.armyYardLevel ?? 1;
        existing.knowledgeLevel = p.knowledgeLevel ?? existing.knowledgeLevel ?? 1;
        existing.knowledgeType = p.knowledgeType ?? existing.knowledgeType ?? "economic";
        existing.equippedWeapon = p.equippedWeapon ?? existing.equippedWeapon ?? "";
        existing.weaponStarLevel = p.weaponStarLevel ?? existing.weaponStarLevel ?? 1;
        existing.weaponGemLevel = p.weaponGemLevel ?? existing.weaponGemLevel ?? 1;
      } else {
        w.otherPlayers.set(name, {
          username: name,
          x, y,
          targetX: x, targetY: y,
          radius: 16,
          army_power: p.army_power || 5000,
          unitLevel: p.unitLevel || 1,
          armyAlive: p.armyAlive ?? 8,
          lastActive,
          color: p.color || "#3a5a8a",
          hp: p.hp ?? 120,
          maxHp: p.maxHp ?? 120,
          br_hp: p.br_hp ?? 120,
          br_alive: p.br_alive ?? true,
          kills: p.kills ?? 0,
          coinsEarned: p.coinsEarned ?? 0,
          armyYardLevel: p.armyYardLevel || 1,
          knowledgeLevel: p.knowledgeLevel || 1,
          knowledgeType: p.knowledgeType || "economic",
          equippedWeapon: p.equippedWeapon || "",
          weaponStarLevel: p.weaponStarLevel || 1,
          weaponGemLevel: p.weaponGemLevel || 1,
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
    const token = localStorage.getItem("player_token") || "";
    const url = `${base}/ws/world?token=${encodeURIComponent(token)}`;
    this._ws = new WebSocket(url);

    this._setOfflineIndicator(false);

    this._ws.onopen = () => {
      this._wsReconnectCount = 0;
      const w = this.world;
      this.send({
        type: "join", username: this.username,
        x_position: Math.floor(w?.leader?.x || 1200),
        y_position: Math.floor(w?.leader?.y || 1200),
        army_power: w?.economy ? w.economy.power : 5000,
        kills: w?.sessionStats?.kills || 0,
        coinsEarned: w?.sessionStats?.coinsEarned || 0,
        unitLevel: w?.army?.unitLevel || 1,
        armyAlive: w?.armyUnits?.filter(u => u.hp > 0).length || 0,
        hp: Math.floor(w?.leader?.hp || 120),
        maxHp: Math.floor(w?.leader?.maxHp || 120),
        level: w?.economy?.level || 1,
        trainingLevel: w?.army?.trainingLevel || 1,
        prestigeLevel: w?.economy?.prestigeLevel || 0,
        armyYardLevel: w?.economy?.armyYardLevel || 1,
        knowledgeLevel: w?.economy?.knowledgeLevel || 1,
        knowledgeType: w?.economy?.knowledgeType || "economic",
        equippedWeapon: w?._equippedWeapon || "",
        weapons: w?.army?.weapons?.map(ww => ({ id: ww.id, starLevel: ww.starLevel || 1, gemLevel: ww.gemLevel || 1 })) || [],
        weaponStarLevel: w?._weaponStarLevel || 1,
        weaponGemLevel: w?._weaponGemLevel || 1,
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
      this._setOfflineIndicator(true);
      this._ws = null;
      this._wsReconnectCount = (this._wsReconnectCount || 0) + 1;
      if (this._wsReconnectCount > 10) {
        console.warn("[WS] فشل 10 محاولات — توقف");
        return;
      }
      this._wsReconnectTimer = setTimeout(() => this._connectWS(), 2000);
    };

    this._ws.onerror = () => { this._setOfflineIndicator(true); };
  }

  _setOfflineIndicator(offline) {
    const el = document.getElementById("offline-indicator");
    if (!el) return;
    if (offline) {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  }

  _handleMessage(msg) {
    const w = this.world;
    if (!w) return;
    switch (msg.type) {
      case "world_players":
        this.syncOtherPlayers(msg.list || []);
        if (w.store) w.store.set('players', msg.list || []);
        break;
      case "world_monsters":
        this.syncMonsters(msg.list || []);
        break;
      case "monster_killed": {
        const mon = w.monsters.find(m => m.id === msg.id);
        if (mon && mon.alive) { mon.alive = false; mon.hp = 0; mon.respawnTimer = 25; }
        break;
      }
      case "pvp_notify":
        if (w.store) w.store.set('notification', { text: `⚔️ ${msg.attacker} هاجمك بقوة ${msg.power}!`, t: Date.now() });
        break;
      case "player_joined":
        if (w.store) w.store.set('notification', { text: `👋 ${msg.username} دخل إلى الصحراء`, t: Date.now() });
        break;
      case "player_left":
        if (w.store) w.store.set('notification', { text: `🚪 ${msg.username} خرج من الصحراء`, t: Date.now() });
        break;
      case "broadcast_chat":
        if (w._onChatMessage) w._onChatMessage(msg.username, msg.message);
        break;
      case "br_zone_shrink":
        if (w.mode === "battle_royale") { w.zone.radius = msg.radius; w.zone.x = msg.centerX; w.zone.y = msg.centerY; }
        break;
      case "br_bandit_spawn":
        if (w.mode === "battle_royale" && msg.bandit) w.bandits.push(msg.bandit);
        break;
      case "br_player_eliminated":
        if (w.store) w.store.set('notification', { text: `💀 ${msg.playerId} قُتل بواسطة ${msg.by}`, t: Date.now() });
        break;
      case "br_match_end":
        if (w.mode === "battle_royale") { w.matchEnded = true; w.matchStarted = false; if (this.onBRMatchEnd) this.onBRMatchEnd(msg); }
        break;
      case "equip_weapon_ack":
        w._equippedWeapon = msg.weaponId || "";
        if (w.store) w.store.set('equippedWeapon', w._equippedWeapon);
        break;
      case "upgrade_army_yard_ack":
        if (w.economy) w.economy.armyYardLevel = msg.armyYardLevel;
        if (w.store) w.store.set('notification', { text: `⬆️ ساحة الجيش → المستوى ${msg.armyYardLevel} (السعة: ${msg.maxTroops})`, t: Date.now() });
        break;
      case "upgrade_knowledge_ack":
        if (w.economy) { w.economy.knowledgeLevel = msg.knowledgeLevel; w.economy.knowledgeType = msg.knowledgeType; }
        if (w.store) {
          let buffText = "";
          if (msg.defensePercent > 0) buffText += ` دفاع +${msg.defensePercent}%`;
          if (msg.moveSpeedPercent > 0) buffText += ` سرعة +${msg.moveSpeedPercent}%`;
          if (msg.resourceSpeed > 1) buffText += ` انتاج ×${msg.resourceSpeed}`;
          w.store.set('notification', { text: `⬆️ المعرفة → المستوى ${msg.knowledgeLevel}${buffText}`, t: Date.now() });
        }
        break;
      case "player_despawn":
        w.otherPlayers.delete(msg.username);
        if (w.store) w.store.set('notification', { text: `💀 ${msg.username} قُتل في PvP`, t: Date.now() });
        break;
      case "claim_gift_ack":
        if (msg.claimed && msg.reward) {
          if (w.economy) {
            w.economy.gems += msg.reward.gems || 0;
            w.economy.gold += msg.reward.gold || 0;
            w.economy.hammers += msg.reward.hammers || 0;
            w.economy.scrolls += msg.reward.scrolls || 0;
          }
          if (w.store) w.store.set('notification', { text: `🎁 حصلت على ${msg.reward.gold} 💵 ${msg.reward.gems} 💎`, t: Date.now() });
        } else if (!msg.claimed && w.store) {
          const mins = Math.floor((msg.remainingMs || 0) / 60000);
          w.store.set('notification', { text: `⏳ باقي ${mins} دقيقة للصندوق القادم`, t: Date.now() });
        }
        break;
      case "weapon_upgrade_ack":
        if (msg.ok) {
          w._weaponStarLevel = msg.starLevel;
          w._weaponGemLevel = msg.gemLevel;
          if (w.army && w.army.weapons) {
            const existing = w.army.weapons.find(x => x.id === msg.weaponId);
            if (existing) {
              existing.level = msg.level;
              existing.starLevel = msg.starLevel;
              existing.gemLevel = msg.gemLevel;
            }
          }
          if (w.store) w.store.set('notification', { text: `⬆️ السلاح → المستوى ${msg.level} ⭐ (${msg.damageMult ? 'ضرر ×'+msg.damageMult.toFixed(2) : ''})`, t: Date.now() });
          if (w._onWeaponUpgraded) w._onWeaponUpgraded(msg);
        } else if (w.store) {
          w.store.set('notification', { text: `❌ ${msg.reason}`, t: Date.now() });
        }
        break;
      case "weapon_glow": {
        const target = w.otherPlayers.get(msg.username);
        if (target) { target._glowActive = true; target._glowTime = Date.now(); target._glowStarLevel = msg.starLevel; target._glowColor = msg.color; }
        break;
      }
      case "upgrade_building_ack":
        if (msg.ok) {
          if (w.economy) {
            if (!w.economy.buildings) w.economy.buildings = {};
            w.economy.buildings[msg.buildingId] = msg.newLevel;
          }
          if (w._onBuildingUpgraded) w._onBuildingUpgraded(msg);
          if (w.store) w.store.set('notification', { text: `🏛️ ${msg.buildingId || ""} → المستوى ${msg.newLevel}`, t: Date.now() });
        } else if (w.store) {
          w.store.set('notification', { text: `❌ ${msg.reason}`, t: Date.now() });
        }
        break;
      case "upgrade_research_ack":
        if (msg.ok) {
          if (w.economy) {
            if (!w.economy.research) w.economy.research = {};
            w.economy.research[`${msg.categoryId}.${msg.skillId}`] = msg.newLevel;
          }
          if (w._onResearchUpgraded) w._onResearchUpgraded(msg);
          if (w.store) w.store.set('notification', { text: `🧠 ${msg.skillId} → المستوى ${msg.newLevel}`, t: Date.now() });
        } else if (w.store) {
          w.store.set('notification', { text: `❌ ${msg.reason}`, t: Date.now() });
        }
        break;
      // ==================== 🏜️ رسائل الحرب القبلية ====================
      case "war_declared":
        if (w.store) w.store.set('notification', { text: `⚔️ ${msg.attacker} أعلنت الغزوة على ${msg.defender}!`, t: Date.now() });
        if (w._onWarEvent) w._onWarEvent("war_declared", msg);
        break;
      case "war_battle_result":
        if (w.store) w.store.set('notification', { text: `⚔️ ${msg.winner} انتصر على ${msg.loser} وغنم ${msg.loot} 🪙`, t: Date.now() });
        if (w._onWarEvent) w._onWarEvent("war_battle_result", msg);
        break;
      case "war_ended":
        if (w.store) w.store.set('notification', { text: msg.winner !== "تعادل" ? `🏆 ${msg.winner} انتصرت في الحرب القبلية!` : `🤝 الحرب انتهت بالتعادل`, t: Date.now() });
        if (w._onWarEvent) w._onWarEvent("war_ended", msg);
        break;
      case "war_response":
        if (w._onWarResponse) w._onWarResponse(msg.requestType, msg);
        break;
      // ==================== 🏪 رسائل السوق ====================
      case "market_listing_new":
      case "market_listing_sold":
      case "market_listing_removed":
      case "market_listings_sync":
        if (window._tradeMarket) window._tradeMarket.handleNetMessage(msg);
        break;
    }
  }
}
