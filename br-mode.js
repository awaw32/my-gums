"use strict";

function htmlToElements(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  const f = document.createDocumentFragment();
  while (t.content.firstChild) f.appendChild(t.content.firstChild);
  return f;
}

/*
    ⚔️ إمبراطورية الصحراء — Battle Royale Mode
    - PvP multiplayer arena
    - Admin controls map size, timer, bandits
    - Shrinking zone (storm)
    - Bandits that hunt players
    - Kill feed, victory/defeat screens
    - WebSocket real-time sync
*/

// ====== WAIT FOR GAME TO LOAD ======
(function waitForGame() {
  if (!window.__game) { setTimeout(waitForGame, 100); return; }

  const br = {
    mode: "campaign",
    matchTimer: 600,
    matchStarted: false,
    matchEnded: false,
    playerId: "player_" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    playerName: "مقاتل_" + Math.floor(Math.random() * 9999),
    isAdmin: false,
    adminCode: "admin123",
    roomCode: "",
    kills: 0,
    bandits: [],
    zone: { x: 1600, y: 1600, radius: 1440, minRadius: 100, nextShrink: 30 },
    ws: null,
    otherPlayers: [],
    killFeed: [],
    serverUrl: "wss://desert-empire-br.up.railway.app",
    usingServer: false,
  };

  let brTimer = 0;
  let banditSpawnTimer = 0;
  let brKillFeedTimer = 0;
  let localHeroRef = null;

  // ====== DOM REFS ======
  const brTimerEl = document.getElementById("br-timer");
  const brAliveEl = document.getElementById("br-alive-count");
  const brTotalEl = document.getElementById("br-total-count");
  const brKillsEl = document.getElementById("br-kill-count");
  const brKillFeedEl = document.getElementById("br-kill-feed");
  const brZoneWarningEl = document.getElementById("br-zone-warning");
  const brVictoryEl = document.getElementById("br-victory-screen");
  const brDefeatEl = document.getElementById("br-defeat-screen");
  const brVictoryStats = document.getElementById("br-victory-stats");
  const brDefeatStats = document.getElementById("br-defeat-stats");

  // ====== BR BUTTON ======
  const brBtn = document.getElementById("br-btn");
  if (brBtn) brBtn.addEventListener("click", showBRLobby);

  // ====== EXPOSE HOOKS ======
  window.__brUpdate = brUpdate;
  window.__brRender = brRender;

  // ====== BR UPDATE HOOK ======
  function brUpdate(dt) {
    if (br.mode !== "battle_royale" || !br.matchStarted || br.matchEnded) return;
    brTimer -= dt;
    updateBRTimer();
    updateBRZone(dt);
    updateBRBandits(dt);
    updateBRKillFeed(dt);
    updateBRPlayerPositions(dt);
    checkBRWinCondition();
  }

  // ====== BR RENDER HOOK ======
  function brRender() {
    if (br.mode !== "battle_royale") return;
    drawBRZone();
    drawBRBandits();
    drawBROtherPlayers();
  }

  // ====== SHOW BR LOBBY ======
  function showBRLobby() {
    const ls = document.getElementById("landing-screen");
    const card = document.getElementById("landing-card");
    if (!ls || !card) return;
    ls.classList.remove("hidden");
    ls.removeAttribute("aria-hidden");
    card.textContent = "";
    card.appendChild(htmlToElements(`
      <h1 style="font-size:1.8rem;margin-bottom:8px">⚔️ معركة ملكية</h1>
      <p class="subtitle" style="margin:4px 0 16px">تنافس مع لاعبين آخرين في ساحة الصحراء</p>
      <div class="action-group" style="gap:10px">
        <input id="br-room-input" class="br-input" placeholder="🔑 كود الغرفة" maxlength="8" style="text-transform:uppercase">
        <button id="br-join-btn" class="menu-button primary" type="button" style="background:linear-gradient(180deg,#5a8ab5,#2a5a7a)">🔗 انضمام إلى غرفة</button>
        <button id="br-host-btn" class="menu-button primary" type="button" style="background:linear-gradient(180deg,#d4943a,#8a5e28)">👑 استضافة (Admin)</button>
        <button id="br-back-btn" class="menu-button secondary" type="button">🔙 رجوع</button>
      </div>
    `));

    document.getElementById("br-join-btn").addEventListener("click", joinBR);
    document.getElementById("br-host-btn").addEventListener("click", hostBR);
    document.getElementById("br-back-btn").addEventListener("click", () => {
      window.location.reload();
    });
  }

  // ====== HOST BR (ADMIN) ======
  function hostBR() {
    br.isAdmin = true;
    br.roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    br.mode = "battle_royale";
    tryConnectWebSocket();
    showAdminPanel();
  }

  // ====== JOIN BR ======
  function joinBR() {
    const input = document.getElementById("br-room-input");
    if (!input || input.value.trim().length < 4) {
      alert("📌 أدخل كود الغرفة (4-8 أحرف)");
      return;
    }
    br.isAdmin = false;
    br.roomCode = input.value.trim().toUpperCase();
    br.mode = "battle_royale";
    tryConnectWebSocket();
    // Start game and wait for admin signal
    startBRGame(null);
  }

  // ====== WEBSOCKET CONNECTION ======
  function tryConnectWebSocket() {
    try {
      br.ws = new WebSocket(br.serverUrl);
      br.ws.onopen = () => {
        br.usingServer = true;
        console.log("✅ WebSocket connected");
        br.ws.send(JSON.stringify({
          type: "join",
          playerId: br.playerId,
          name: br.playerName,
          adminKey: br.isAdmin ? "admin123" : "",
          roomCode: br.roomCode,
          level: window.__game ? window.__game.level : 1,
        }));
      };
      br.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          handleBRMessage(msg);
        } catch (err) {}
      };
      br.ws.onclose = () => {
        console.log("WebSocket disconnected — using local mode");
        br.usingServer = false;
        // In local mode, spawn bots
        if (br.isAdmin && br.matchStarted) spawnLocalBots();
      };
      br.ws.onerror = () => {
        console.log("WebSocket error — using local mode");
        br.usingServer = false;
      };
    } catch (e) {
      console.log("WebSocket unavailable — using local mode");
      br.usingServer = false;
    }
  }

  // ====== HANDLE SERVER MESSAGES ======
  function handleBRMessage(msg) {
    switch (msg.type) {
      case "player_list":
        if (msg.admin && br.adminPanelEl) {
          const listEl = document.getElementById("br-player-list");
          if (listEl) {
            listEl.textContent = "";
            msg.players.forEach(p => {
              const div = document.createElement("div");
              div.textContent = `${p.name} (${p.level}) ${p.alive ? "✅" : "💀"}`;
              listEl.appendChild(div);
            });
          }
          const countEl = document.getElementById("br-connected-count");
          if (countEl) countEl.textContent = msg.players.length;
        }
        break;
      case "state_update":
        if (msg.players) {
          br.otherPlayers = msg.players.filter(p => p.id !== br.playerId);
          const self = msg.players.find(p => p.id === br.playerId);
          if (self) {
            const hero = window.__hero;
            if (hero) {
              hero.x = self.x;
              hero.y = self.y;
            }
          }
        }
        break;
      case "match_start":
        if (!br.isAdmin) {
          br.matchTimer = msg.matchTime || 600;
          const hero = window.__hero;
          if (hero) {
            hero.x = 1600; hero.y = 1600;
          }
          startBRGame(null);
        }
        break;
      case "zone_shrink":
        br.zone.radius = msg.radius;
        br.zone.x = msg.centerX || 1600;
        br.zone.y = msg.centerY || 1600;
        break;
      case "bandit_spawn":
        if (msg.bandit) br.bandits.push(msg.bandit);
        break;
      case "attack_result":
        if (msg.targetId === br.playerId) {
          const hero = window.__hero;
          if (hero) hero.hp = msg.targetHp;
        }
        break;
      case "player_eliminated":
        addBRKillFeed(`⚔️ ${msg.killedBy || "???"} قضى على ${msg.playerId || "???"}`);
        break;
    }
  }

  // ====== ADMIN PANEL ======
  function showAdminPanel() {
    const ls = document.getElementById("landing-screen");
    const card = document.getElementById("landing-card");
    if (!ls || !card) return;
    ls.classList.remove("hidden");
    ls.removeAttribute("aria-hidden");
    card.textContent = "";
    card.appendChild(htmlToElements(`
      <div style="text-align:right">
        <div class="info-title">👑 لوحة تحكم المعركة</div>
        <div class="info-desc" style="margin:4px 0">📌 كود الغرفة: <b style="color:var(--gold);font-size:1.2rem;direction:ltr;display:inline-block">${br.roomCode.replace(/[<>&"']/g, "")}</b></div>
        <hr style="border-color:rgba(255,209,102,0.3);margin:10px 0">

        <div class="info-stat" style="margin:6px 0">
          <span>🗺️ حجم الخريطة</span>
          <span><input type="range" id="br-map-size" min="1000" max="5000" value="2000" step="100" style="width:100px"> <span id="br-map-label" style="min-width:60px">2000</span></span>
        </div>
        <div class="info-stat" style="margin:6px 0">
          <span>⏱️ وقت المباراة</span>
          <span><input type="range" id="br-match-time" min="3" max="30" value="10" step="1" style="width:100px"> <span id="br-time-label">10 د</span></span>
        </div>

        <hr style="border-color:rgba(255,209,102,0.3);margin:10px 0">

        <div class="info-stat" style="color:var(--gold);margin:6px 0">
          👥 متصلون: <span id="br-connected-count">0</span>
        </div>
        <div id="br-player-list" style="max-height:100px;overflow-y:auto;font-size:0.78rem;margin:4px 0"></div>

        <hr style="border-color:rgba(255,209,102,0.3);margin:10px 0">

        <div class="action-group" style="margin-top:6px;gap:8px">
          <button id="br-spawn-bandits" class="menu-button secondary" style="min-height:44px;font-size:0.85rem">🤖 إرسال قطاع طرق</button>
          <button id="br-start-match" class="menu-button primary" style="min-height:44px;font-size:0.85rem;background:linear-gradient(180deg,#d43a3a,#8a2020)">🚀 بدء المباراة!</button>
        </div>
      </div>
    `));

    document.getElementById("br-map-size").addEventListener("input", (e) => {
      document.getElementById("br-map-label").textContent = e.target.value;
    });
    document.getElementById("br-match-time").addEventListener("input", (e) => {
      document.getElementById("br-time-label").textContent = e.target.value + " د";
      br.matchTimer = parseInt(e.target.value) * 60;
    });
    document.getElementById("br-spawn-bandits").addEventListener("click", () => {
      for (let i = 0; i < 5; i++) createBRBandit();
      addBRKillFeed("🤖 تم إرسال قطاع طرق!");
    });
    document.getElementById("br-start-match").addEventListener("click", startBRMatch);
  }

  // ====== START BR MATCH ======
  function startBRMatch() {
    if (!br.isAdmin) return;
    const mapSize = parseInt(document.getElementById("br-map-size").value) || 2000;
    const matchTime = parseInt(document.getElementById("br-match-time").value) * 60 || 600;
    br.matchTimer = matchTime;

    const world = window.__world;
    if (world) { world.width = mapSize; world.height = mapSize; }

    const hero = window.__hero;
    if (hero) {
      hero.x = mapSize / 2 + Math.random() * 200 - 100;
      hero.y = mapSize / 2 + Math.random() * 200 - 100;
      hero.targetX = hero.x; hero.targetY = hero.y;
    }

    br.zone = {
      x: mapSize / 2,
      y: mapSize / 2,
      radius: mapSize * 0.45,
      minRadius: 100,
      nextShrink: 30,
    };

    // Add initial bandits
    br.bandits = [];
    for (let i = 0; i < 5; i++) createBRBandit();

    startBRGame(mapSize);

    if (br.ws && br.ws.readyState === WebSocket.OPEN) {
      br.ws.send(JSON.stringify({
        type: "match_start",
        mapSize: mapSize,
        matchTime: matchTime,
        spawnPoints: [{ x: hero ? hero.x : 1000, y: hero ? hero.y : 1000 }],
      }));
    }
  }

  // ====== START BR GAME ======
  function startBRGame(mapSize) {
    br.matchStarted = true;
    br.matchEnded = false;
    br.kills = 0;
    br.bandits = [];
    brTimer = br.matchTimer;

    const game = window.__game;
    if (game) {
      game.resources.gold = 20;
      game.resources.food = 10;
      game.level = 1;
    }

    const hero = window.__hero;
    if (hero) {
      hero.hp = 100;
      hero.maxHp = 100;
      hero.alive = true;
      hero.damage = 15;
      hero.defense = 2;
    }

    // Show BR UI
    if (brTimerEl) brTimerEl.classList.remove("hidden");
    if (brAliveEl) { brAliveEl.parentElement.classList.remove("hidden"); }
    if (brKillsEl) { brKillsEl.parentElement.classList.remove("hidden"); }

    // Start canvas game
    const startGame = window.__startGame;
    if (startGame) startGame();

    // Override pause
    const gameObj = window.__game;
    if (gameObj) gameObj.paused = false;
  }

  // ====== CREATE BANDIT ======
  function createBRBandit() {
    const world = window.__world;
    if (!world) return;
    const w = world.width, h = world.height;
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    switch (edge) {
      case 0: x = Math.random() * w; y = 50; break;
      case 1: x = w - 50; y = Math.random() * h; break;
      case 2: x = Math.random() * w; y = h - 50; break;
      case 3: x = 50; y = Math.random() * h; break;
    }
    const level = window.__game ? window.__game.level : 1;
    const bandit = {
      id: "bandit_" + Date.now() + "_" + Math.floor(Math.random() * 999),
      x, y, r: 14,
      hp: 40 + level * 5,
      maxHp: 40 + level * 5,
      damage: 10 + level * 2,
      speed: 60 + Math.random() * 30,
      alive: true,
      facing: 1,
      attackTimer: 0,
      patrolTarget: null,
      gold: 5 + level * 2,
      food: 3 + level,
    };
    br.bandits.push(bandit);
    return bandit;
  }

  // ====== UPDATE ZONE ======
  function updateBRZone(dt) {
    if (!br.matchStarted || br.matchEnded) return;
    br.zone.nextShrink -= dt;
    if (br.zone.nextShrink <= 0) {
      br.zone.nextShrink = 30;
      br.zone.radius = Math.max(br.zone.minRadius, br.zone.radius - 80);
      showZoneWarning();
      if (br.ws && br.ws.readyState === WebSocket.OPEN) {
        br.ws.send(JSON.stringify({
          type: "zone_shrink",
          radius: br.zone.radius,
          centerX: br.zone.x,
          centerY: br.zone.y,
        }));
      }
    }

    // Damage players outside zone
    const hero = window.__hero;
    if (hero && hero.alive) {
      const dist = Math.hypot(hero.x - br.zone.x, hero.y - br.zone.y);
      if (dist > br.zone.radius) {
        hero.hp -= 4 * dt;
        if (hero.hp <= 0) {
          hero.hp = 0;
          hero.alive = false;
          showBRDefeat("المنطقة المميتة");
        }
      }
    }

    // Damage bandits outside zone
    for (const b of br.bandits) {
      if (!b.alive) continue;
      const dist = Math.hypot(b.x - br.zone.x, b.y - br.zone.y);
      if (dist > br.zone.radius) {
        b.hp -= 6 * dt;
        if (b.hp <= 0) b.alive = false;
      }
    }
  }

  function showZoneWarning() {
    if (!brZoneWarningEl) return;
    brZoneWarningEl.classList.remove("hidden");
    setTimeout(() => {
      if (brZoneWarningEl) brZoneWarningEl.classList.add("hidden");
    }, 2500);
  }

  // ====== UPDATE BANDITS ======
  function updateBRBandits(dt) {
    // Spawn new bandits periodically
    banditSpawnTimer += dt;
    if (banditSpawnTimer >= 15) {
      banditSpawnTimer = 0;
      if (br.bandits.filter(b => b.alive).length < 15) createBRBandit();
    }

    const hero = window.__hero;
    for (const b of br.bandits) {
      if (!b.alive) continue;

      // Find nearest player (hero)
      let target = null;
      let minDist = 400;
      if (hero && hero.alive) {
        const d = Math.hypot(hero.x - b.x, hero.y - b.y);
        if (d < minDist) { minDist = d; target = hero; }
      }

      if (target) {
        const dx = target.x - b.x;
        const dy = target.y - b.y;
        const d = Math.hypot(dx, dy);
        b.facing = dx >= 0 ? 1 : -1;
        if (d > 25) {
          b.x += (dx / d) * b.speed * dt;
          b.y += (dy / d) * b.speed * dt;
        } else {
          // Attack
          b.attackTimer -= dt;
          if (b.attackTimer <= 0) {
            b.attackTimer = 1.0;
            const dmg = Math.max(1, b.damage - (hero.defense || 0));
            hero.hp -= dmg;
            const spawnHit = window.__spawnHitEffect;
            if (spawnHit) spawnHit(hero.x, hero.y, dmg);
            if (hero.hp <= 0) {
              hero.hp = 0;
              hero.alive = false;
              showBRDefeat("قطاع طرق");
            }
          }
        }
      } else {
        // Patrol
        if (!b.patrolTarget) {
          b.patrolTarget = {
            x: b.x + (Math.random() - 0.5) * 500,
            y: b.y + (Math.random() - 0.5) * 500,
          };
          const world = window.__world;
          if (world) {
            b.patrolTarget.x = Math.max(50, Math.min(world.width - 50, b.patrolTarget.x));
            b.patrolTarget.y = Math.max(50, Math.min(world.height - 50, b.patrolTarget.y));
          }
        }
        const dx = b.patrolTarget.x - b.x;
        const dy = b.patrolTarget.y - b.y;
        const d = Math.hypot(dx, dy);
        if (d < 20) {
          b.patrolTarget = null;
        } else {
          b.facing = dx >= 0 ? 1 : -1;
          b.x += (dx / d) * b.speed * 0.4 * dt;
          b.y += (dy / d) * b.speed * 0.4 * dt;
        }
      }
    }

    // Remove dead bandits
    br.bandits = br.bandits.filter(b => b.alive);
  }

  // ====== UPDATE OTHER PLAYERS ======
  function updateBRPlayerPositions(dt) {
    if (!br.usingServer || br.otherPlayers.length === 0) return;
    const hero = window.__hero;
    if (!hero || !hero.alive) return;

    // Check collisions with other players
    for (const op of br.otherPlayers) {
      if (!op || op.id === br.playerId || !op.alive) continue;
      const dist = Math.hypot(hero.x - op.x, hero.y - op.y);
      if (dist < 40) {
        // Auto-attack other player
        hero.attacking = true;
        const dmg = Math.max(1, hero.damage - (op.defense || 0));
        if (br.ws && br.ws.readyState === WebSocket.OPEN) {
          br.ws.send(JSON.stringify({
            type: "attack",
            targetId: op.id,
            damage: dmg,
          }));
        }
        const spawnHit = window.__spawnHitEffect;
        if (spawnHit) spawnHit(op.x, op.y, dmg);
      }
    }
  }

  // ====== DRAW ZONE ======
  function drawBRZone() {
    const ctx = window.__ctx;
    const camera = window.__camera;
    if (!ctx || !camera) return;

    const cx = br.zone.x - camera.x;
    const cy = br.zone.y - camera.y;
    const cr = br.zone.radius;

    // Draw zone border
    ctx.save();
    ctx.strokeStyle = "rgba(255, 0, 0, 0.6)";
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Glow effect
    const gradient = ctx.createRadialGradient(cx, cy, cr - 10, cx, cy, cr);
    gradient.addColorStop(0, "rgba(255, 0, 0, 0)");
    gradient.addColorStop(0.8, "rgba(255, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(255, 0, 0, 0.15)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw safe zone text
    if (cr < 300) {
      ctx.save();
      ctx.fillStyle = "rgba(255, 200, 50, 0.8)";
      ctx.font = "700 16px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("⚠️ المنطقة الآمنة", cx, cy);
      ctx.restore();
    }
  }

  // ====== DRAW BANDITS ======
  function drawBRBandits() {
    const ctx = window.__ctx;
    const camera = window.__camera;
    if (!ctx || !camera) return;

    for (const b of br.bandits) {
      if (!b.alive) continue;
      const x = b.x - camera.x;
      const y = b.y - camera.y;
      if (x < -40 || y < -40 || x > camera.width + 40 || y > camera.height + 40) continue;

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(b.facing || 1, 1);

      // Shadow
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      ctx.beginPath();
      ctx.ellipse(0, 12, 14, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body
      ctx.fillStyle = "#4a4a3a";
      ctx.beginPath();
      ctx.arc(0, 0, b.r || 14, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = "#8a7a5a";
      ctx.beginPath();
      ctx.arc(0, -14, 7, 0, Math.PI * 2);
      ctx.fill();

      // Eye band
      ctx.fillStyle = "#222";
      ctx.fillRect(-8, -16, 16, 3);

      // Weapon
      ctx.strokeStyle = "#666";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(15, -2);
      ctx.lineTo(25, -12);
      ctx.stroke();

      // HP bar
      const hpPct = b.hp / b.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(-14, -22, 28, 3);
      ctx.fillStyle = "#ff6600";
      ctx.fillRect(-14, -22, 28 * hpPct, 3);

      ctx.restore();
    }
  }

  // ====== DRAW OTHER PLAYERS ======
  function drawBROtherPlayers() {
    const ctx = window.__ctx;
    const camera = window.__camera;
    if (!ctx || !camera) return;

    for (const op of br.otherPlayers) {
      if (!op || op.id === br.playerId || !op.alive) continue;
      const x = op.x - camera.x;
      const y = op.y - camera.y;
      if (x < -30 || y < -30 || x > camera.width + 30 || y > camera.height + 30) continue;

      ctx.save();
      // Colored circle for other players
      ctx.fillStyle = "#e74c3c";
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();

      // Name
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "600 9px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(op.name || op.id, x, y - 22);

      // HP bar
      const hpPct = op.hp !== undefined ? op.hp / 100 : 1;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x - 14, y - 18, 28, 3);
      ctx.fillStyle = hpPct > 0.5 ? "#4cd964" : "#ff4444";
      ctx.fillRect(x - 14, y - 18, 28 * hpPct, 3);

      ctx.restore();
    }
  }

  // ====== UPDATE TIMER ======
  function updateBRTimer() {
    if (!brTimerEl) return;
    if (brTimer <= 0) {
      brTimer = 0;
      // Time's up — whoever has most kills or highest level wins
      endBRMatch("time");
    }
    const mins = Math.floor(brTimer / 60);
    const secs = Math.floor(brTimer % 60);
    brTimerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (brTimer < 60) brTimerEl.classList.add("warning");
    else brTimerEl.classList.remove("warning");
  }

  // ====== KILL FEED ======
  function addBRKillFeed(msg) {
    const hero = window.__hero;
    if (hero && msg.includes(br.playerId)) {
      // I got a kill
      br.kills++;
      if (brKillsEl) brKillsEl.textContent = br.kills;
    }
    br.killFeed.push({ msg, timer: 3 });
    if (br.killFeed.length > 5) br.killFeed.shift();
  }

  function updateBRKillFeed(dt) {
    if (!brKillFeedEl) return;
    for (let i = br.killFeed.length - 1; i >= 0; i--) {
      br.killFeed[i].timer -= dt;
      if (br.killFeed[i].timer <= 0) br.killFeed.splice(i, 1);
    }
    if (br.killFeed.length === 0) {
      brKillFeedEl.textContent = "";
      return;
    }
    brKillFeedEl.textContent = "";
    for (const k of br.killFeed) {
      const div = document.createElement("div");
      div.className = "kill-msg";
      div.textContent = k.msg;
      brKillFeedEl.appendChild(div);
    }
  }

  // ====== CHECK WIN CONDITION ======
  function checkBRWinCondition() {
    const hero = window.__hero;
    if (!hero) return;
    // If all players are dead and I'm alive, I win
    const aliveOthers = br.otherPlayers.filter(p => p.alive !== false).length;
    const aliveBandits = br.bandits.filter(b => b.alive).length;
    if (hero.alive && aliveOthers <= 1 && aliveBandits === 0 && br.matchStarted && !br.matchEnded) {
      // If only me and maybe 1 other left
      if (aliveOthers <= 1 && aliveBandits === 0) {
        // Give it a moment — if no one else attacks
        setTimeout(() => {
          if (hero.alive && !br.matchEnded) {
            endBRMatch("win");
          }
        }, 3000);
      }
    }
  }

  // ====== END MATCH ======
  function endBRMatch(reason) {
    if (br.matchEnded) return;
    br.matchEnded = true;
    const hero = window.__hero;

    if (reason === "win" || (hero && hero.alive)) {
      showBRVictory();
    } else {
      showBRDefeat(reason === "time" ? "نهاية الوقت" : "معركة");
    }
  }

  function showBRVictory() {
    if (brVictoryStats) brVictoryStats.textContent = `🏆 قضيت على ${br.kills} أعداء و ${br.bandits.filter(b => !b.alive).length} قطاع طرق`;
    if (brVictoryEl) {
      brVictoryEl.classList.remove("hidden");
      brVictoryEl.style.display = "flex";
      brVictoryEl.style.alignItems = "center";
      brVictoryEl.style.justifyContent = "center";
    }
  }

  function showBRDefeat(killedBy) {
    if (brDefeatStats) brDefeatStats.textContent = `💀 قُتلت بواسطة ${killedBy} — قتلت ${br.kills} أعداء`;
    if (brDefeatEl) {
      brDefeatEl.classList.remove("hidden");
      brDefeatEl.style.display = "flex";
      brDefeatEl.style.alignItems = "center";
      brDefeatEl.style.justifyContent = "center";
    }
  }

  // ====== LOCAL BOTS (fallback when no server) ======
  function spawnLocalBots() {
    if (!br.isAdmin) return;
    const botCount = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < botCount; i++) {
      setTimeout(() => {
        if (!br.matchStarted) return;
        const world = window.__world;
        const hero = window.__hero;
        if (!world || !hero) return;
        const bot = {
          id: "bot_" + Date.now() + "_" + i,
          name: "عصابي_" + String.fromCharCode(65 + i),
          x: Math.random() * world.width,
          y: Math.random() * world.height,
          hp: 80,
          alive: true,
          defense: 2 + Math.floor(Math.random() * 3),
        };
        br.otherPlayers.push(bot);
        addBRKillFeed(`👥 ${bot.name} دخل الساحة!`);
      }, i * 2000);
    }
  }

  // ====== EXPOSE BR API ======
  window.BattleRoyale = {
    startMatch: startBRMatch,
    host: hostBR,
    join: joinBR,
    getState: () => ({
      mode: br.mode,
      matchStarted: br.matchStarted,
      matchEnded: br.matchEnded,
      timer: brTimer,
      kills: br.kills,
      banditsAlive: br.bandits.filter(b => b.alive).length,
      players: br.otherPlayers.filter(p => p.alive !== false).length + (window.__hero && window.__hero.alive ? 1 : 0),
      zoneRadius: br.zone.radius,
      isAdmin: br.isAdmin,
      roomCode: br.roomCode,
    }),
    spawnBandits: () => { for (let i = 0; i < 5; i++) createBRBandit(); },
    stop: () => {
      br.matchStarted = false;
      br.matchEnded = true;
    },
  };

  console.log("⚔️ Battle Royale Mode loaded");
  console.log("💡 Commands: BattleRoyale.getState()");
})();