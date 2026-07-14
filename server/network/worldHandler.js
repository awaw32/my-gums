"use strict";

const { PLAYER_COLORS } = require("../config");
const logger = require("../logger");
const { resolveMonsterKill, simulatePvPFull, computeLoot } = require("../logic/combatResolver");

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c] || c); }

function playerColor(username) {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = username.charCodeAt(i) + ((h << 5) - h);
  return PLAYER_COLORS[Math.abs(h) % PLAYER_COLORS.length];
}

function createWorldHandler({ worldMonsters, worldClients, combatSystem, memStore, getDefaultPlayer, markDirty, computeArmyYardUpgradeCost, computeArmyYardStats, computeKnowledgeUpgradeCost, computeKnowledgeBonuses, claimReward, applyWeaponUpgrade, computeWeaponDamageWithUpgrades, applyBuildingUpgrade, BUILDING_DEFS, applyResearchUpgrade, warManager }) {

  function broadcastWorld(excludeWs = null) {
    const list = [];
    worldClients.forEach((c) => {
      list.push({
        username: c.username, x_position: c.x, y_position: c.y,
        army_power: c.army_power,
        kills: c.kills || 0,
        coinsEarned: c.coinsEarned || 0,
        unitLevel: c.unitLevel || 1,
        armyAlive: c.armyAlive ?? 8,
        color: c.color,
        hp: c.hp ?? c.br_hp ?? 120,
        maxHp: c.maxHp ?? 120,
        br_hp: c.br_hp ?? 120,
        br_alive: c.br_alive ?? true,
        armyYardLevel: c.armyYardLevel || 1,
        knowledgeLevel: c.knowledgeLevel || 1,
        knowledgeType: c.knowledgeType || "economic",
        equippedWeapon: c.equippedWeapon || "",
        weaponStarLevel: c.weaponStarLevel || 1,
        weaponGemLevel: c.weaponGemLevel || 1,
        last_active: Date.now()
      });
    });
    const msg = JSON.stringify({ type: "world_players", list });
    worldClients.forEach((c) => {
      if (c.ws !== excludeWs && c.ws.readyState === 1) c.ws.send(msg);
    });
  }

  return function handleWorldConnection(ws, req) {
    const ip = req.socket.remoteAddress;
    let username = null;
    let worldMsgCount = 0;
    let worldLastReset = Date.now();
    const _pvpCooldowns = new Map();
    const _monsterKillTimestamps = new Map(); // 🛡️ منع القتل المزدوج للوحوش
    const _pvpCleanupInterval = setInterval(() => {
      const cutoff = Date.now() - 300000;
      for (const [key, time] of _pvpCooldowns) {
        if (time < cutoff) _pvpCooldowns.delete(key);
      }
    }, 300000);
    ws.on("close", () => clearInterval(_pvpCleanupInterval));
    logger.info({ ip }, "[WorldWS] Connection");

    ws.on("message", (raw) => {
      const now = Date.now();
      if (now - worldLastReset > 1000) { worldMsgCount = 0; worldLastReset = now; }
      if (++worldMsgCount > 60) { ws.close(1008, "Rate limit"); return; }

      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.type === "join") {
        username = msg.username;
        if (!username || typeof username !== "string") return;
        username = String(username).slice(0, 30);
        if (ws.authUsername && ws.authUsername !== username) {
          ws.close(4001, "Username mismatch"); return;
        }
        combatSystem.initWorldMonsters();
        const color = playerColor(username);
        const initHP = msg.hp ?? 120;
        const initMaxHP = msg.maxHp ?? 120;
        const { clampPosition } = require("../validation/movement");
        const initPos = clampPosition(msg.x_position || 1200, msg.y_position || 1200);
        worldClients.set(username, {
          ws, username, color,
          x: initPos.x,
          y: initPos.y,
          _lastMoveTs: Date.now(),
          army_power: msg.army_power || 5000,
          kills: msg.kills || 0,
          coinsEarned: msg.coinsEarned || 0,
          unitLevel: msg.unitLevel || 1,
          armyAlive: msg.armyAlive ?? 8,
          hp: initHP,
          maxHp: initMaxHP,
          level: msg.level || 1,
          trainingLevel: msg.trainingLevel || 1,
          prestigeLevel: msg.prestigeLevel || 0,
          armyYardLevel: msg.armyYardLevel || 1,
          knowledgeLevel: msg.knowledgeLevel || 1,
          knowledgeType: msg.knowledgeType || "economic",
          equippedWeapon: msg.equippedWeapon || "",
          weapons: msg.weapons || [],
          weaponStarLevel: msg.weaponStarLevel || 1,
          weaponGemLevel: msg.weaponGemLevel || 1,
          br_hp: msg.br_hp ?? 120,
          br_alive: msg.br_alive ?? true,
          buildings: msg.buildings || {},
          research: msg.research || {},
        });
        ws.send(JSON.stringify({ type: "world_monsters", list: worldMonsters }));
        broadcastWorld();
        const joinMsg = JSON.stringify({ type: "player_joined", username });
        worldClients.forEach((c) => {
          if (c.ws !== ws && c.ws.readyState === 1) c.ws.send(joinMsg);
        });
        logger.info({ username, color }, "[WorldWS] joined");
      } else if (msg.type === "update" && username) {
        const c = worldClients.get(username);
        if (c) {
          const { validatePosition } = require("../validation/movement");
          const now = Date.now();
          const timeDelta = now - (c._lastMoveTs || now);
          if (msg.x_position !== undefined || msg.y_position !== undefined) {
            const lastX = c.x;
            const lastY = c.y;
            const newX = msg.x_position ?? lastX;
            const newY = msg.y_position ?? lastY;
            const result = validatePosition(newX, newY, lastX, lastY, timeDelta);
            if (!result.valid) {
              if (c.ws.readyState === 1) {
                c.ws.send(JSON.stringify({ type: "move_rejected", reason: result.reason }));
              }
              broadcastWorld(ws);
              return;
            }
            c.x = result.clamped.x;
            c.y = result.clamped.y;
            c._lastMoveTs = now;
          }
          c.kills = msg.kills ?? c.kills;
          c.coinsEarned = msg.coinsEarned ?? c.coinsEarned;
          c.armyAlive = msg.armyAlive ?? c.armyAlive;
          if (msg.br_hp !== undefined) c.br_hp = Math.max(0, msg.br_hp);
          if (msg.br_alive !== undefined) c.br_alive = msg.br_alive;
          broadcastWorld(ws);
        }
      } else if (msg.type === "monster_killed" && username) {
        const mon = worldMonsters.find(m => m.id === msg.id);
        const c = worldClients.get(username);
        if (mon && mon.alive && c) {
          const now = Date.now();
          const dx = c.x - mon.x;
          const dy = c.y - mon.y;
          if (Math.hypot(dx, dy) > 150) {
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: "error", message: "أنت بعيد جداً عن هذا الوحش" }));
            return;
          }
          if (now - (mon._spawnTime || 0) < 3000) {
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: "error", message: "هذا الوحش ظهر لتوه" }));
            return;
          }
          const killKey = `kill_${msg.id}`;
          const lastKill = _monsterKillTimestamps.get(killKey) || 0;
          if (now - lastKill < 3000) {
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: "error", message: "هذا الوحش قد مات بالفعل" }));
            return;
          }
          // 🛡️ حساب الضرر من الخادم — اللاعب لا يستطيع تزوير نتيجة القتل
          const result = resolveMonsterKill(c, mon);
          if (!result.valid) return;
          const dmgMsg = JSON.stringify({ type: "monster_hit", id: msg.id, hp: mon.hp, maxHp: mon.maxHp, dmg: result.damage, killedBy: esc(username) });
          worldClients.forEach((cl) => { if (cl.ws.readyState === 1) cl.ws.send(dmgMsg); });
          if (result.killed) {
            _monsterKillTimestamps.set(killKey, now);
            mon.alive = false;
            mon.respawnTimer = 25;
            const killMsg = JSON.stringify({ type: "monster_killed", id: msg.id, killedBy: esc(username) });
            worldClients.forEach((cl) => { if (cl.ws.readyState === 1) cl.ws.send(killMsg); });
          }
        }
      } else if (msg.type === "pvp_attack" && username) {
        const target = msg.target;
        const attacker = username;
        const tc = worldClients.get(target);
        if (tc && tc.ws.readyState === 1) {
          tc.ws.send(JSON.stringify({ type: "pvp_notify", attacker: esc(attacker), power: msg.myPower || 0 }));
        }
      } else if (msg.type === "resolve_pvp" && username) {
        // 🛡️ PvP محسوب بالكامل من الخادم — اللاعب لا يقرر الفائز
        const targetName = msg.target;
        const now = Date.now();
        const c = worldClients.get(username);
        const tc = worldClients.get(targetName);
        if (!c || !tc) return;

        const dx = c.x - tc.x;
        const dy = c.y - tc.y;
        if (Math.hypot(dx, dy) > 200) {
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "error", message: "الخصم بعيد جداً" }));
          return;
        }
        const lastPvP = _pvpCooldowns.get(username) || 0;
        if (now - lastPvP < 5000) {
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: "error", message: "انتظر قليلاً قبل PvP" }));
          return;
        }
        _pvpCooldowns.set(username, now);

        // حساب المعركة من الخادم بشكل حاسم
        const battle = simulatePvPFull(c, tc);
        const won = battle.attackerWon;
        const attackerLoot = computeLoot(tc.army_power || 5000, !won);
        const defenderLoot = computeLoot(c.army_power || 5000, won);
        const validatedLoot = Math.min(attackerLoot.cash, 50000);
        const validatedReward = Math.min(defenderLoot.cash, 25000);

        if (tc.ws.readyState === 1) {
          tc.ws.send(JSON.stringify({
            type: "pvp_result",
            attacker: username,
            won: !won,
            loot: won ? 0 : validatedLoot,
            reward: won ? 0 : validatedReward,
            myPower: msg.myPower || 0,
          }));
        }
        if (c.ws.readyState === 1) {
          c.ws.send(JSON.stringify({
            type: "pvp_result",
            attacker: targetName,
            won,
            loot: won ? validatedLoot : 0,
            reward: won ? validatedReward : 0,
            myPower: 0,
          }));
        }
        if (!won && validatedLoot > 0 && tc) {
          tc.sessionCoins = Math.max(0, (tc.sessionCoins || 0) - validatedLoot);
        }
        if (won) {
          const despawnMsg = JSON.stringify({ type: "player_despawn", username: targetName });
          worldClients.forEach((cl) => { if (cl.ws.readyState === 1) cl.ws.send(despawnMsg); });
        }
        const pvpMsg = JSON.stringify({
          type: "broadcast_chat",
          username: "⚔️ النظام",
          message: won
            ? `${username} انتصر على ${targetName}!`
            : `${targetName} هزم ${username}!`,
        });
        worldClients.forEach((cl) => { if (cl.ws.readyState === 1) cl.ws.send(pvpMsg); });
      } else if (msg.type === "chat" && username) {
        const chatMsg = JSON.stringify({ type: "broadcast_chat", username: esc(username), message: esc(String(msg.message || "").slice(0, 200)) });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(chatMsg); });
      } else if (msg.type && msg.type.startsWith("war_") && warManager && username) {
        // 🏜️ معالج رسائل الحرب القبلية
        const result = warManager.handleMessage(msg, username, ws);
        if (result && ws.readyState === 1) {
          ws.send(JSON.stringify({ type: "war_response", requestType: msg.type, ...result }));
        }
      } else if (msg.type === "br_match_start" && username) {
        const brMsg = JSON.stringify({ type: "br_match_start", mapSize: msg.mapSize, matchDuration: msg.matchDuration });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(brMsg); });
      } else if (msg.type === "br_zone_shrink" && username) {
        const zMsg = JSON.stringify({ type: "br_zone_shrink", radius: msg.radius, centerX: msg.centerX, centerY: msg.centerY });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(zMsg); });
      } else if (msg.type === "br_bandit_spawn" && username) {
        const bMsg = JSON.stringify({ type: "br_bandit_spawn", bandit: msg.bandit });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(bMsg); });
      } else if (msg.type === "br_player_eliminated" && username) {
        const eMsg = JSON.stringify({ type: "br_player_eliminated", playerId: msg.playerId, by: msg.by });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(eMsg); });
      } else if (msg.type === "br_match_end" && username) {
        const endMsg = JSON.stringify({ type: "br_match_end", winner: msg.winner, kills: msg.kills });
        worldClients.forEach((c) => { if (c.ws.readyState === 1) c.ws.send(endMsg); });
      } else if (msg.type === "equip_weapon" && username) {
        const c = worldClients.get(username);
        if (c) {
          const weaponId = msg.weaponId || "";
          c.equippedWeapon = weaponId;
          const reply = JSON.stringify({ type: "equip_weapon_ack", weaponId });
          if (c.ws.readyState === 1) c.ws.send(reply);
          broadcastWorld(ws);
        }
      } else if (msg.type === "upgrade_army_yard" && username) {
        const c = worldClients.get(username);
        if (c) {
          const pData = memStore.get(username) || getDefaultPlayer(username);
          const currentLevel = c.armyYardLevel || 1;
          const cost = computeArmyYardUpgradeCost(currentLevel);
          for (const [res, val] of Object.entries(cost)) {
            const have = (pData[res] || 0);
            if (have < val) {
              if (c.ws.readyState === 1) c.ws.send(JSON.stringify({
                type: "upgrade_army_yard_ack", ok: false,
                reason: `غير كافٍ ${res}: تحتاج ${val}، لديك ${have}`
              }));
              return;
            }
          }
          for (const [res, val] of Object.entries(cost)) {
            pData[res] = (pData[res] || 0) - val;
          }
          memStore.set(username, pData);
          markDirty(username);
          c.armyYardLevel = currentLevel + 1;
          const stats = computeArmyYardStats(c.armyYardLevel);
          const reply = JSON.stringify({
            type: "upgrade_army_yard_ack", ok: true,
            armyYardLevel: c.armyYardLevel,
            maxTroops: stats.maxTroops,
            hpBonus: stats.hpBonus,
          });
          if (c.ws.readyState === 1) c.ws.send(reply);
          broadcastWorld(ws);
        }
      } else if (msg.type === "upgrade_knowledge" && username) {
        const c = worldClients.get(username);
        if (c) {
          const pData = memStore.get(username) || getDefaultPlayer(username);
          const currentLevel = c.knowledgeLevel || 1;
          const cost = computeKnowledgeUpgradeCost(currentLevel);
          for (const [res, val] of Object.entries(cost)) {
            const have = (pData[res] || 0);
            if (have < val) {
              if (c.ws.readyState === 1) c.ws.send(JSON.stringify({
                type: "upgrade_knowledge_ack", ok: false,
                reason: `غير كافٍ ${res}: تحتاج ${val}، لديك ${have}`
              }));
              return;
            }
          }
          for (const [res, val] of Object.entries(cost)) {
            pData[res] = (pData[res] || 0) - val;
          }
          memStore.set(username, pData);
          markDirty(username);
          c.knowledgeLevel = currentLevel + 1;
          if (msg.knowledgeType) c.knowledgeType = msg.knowledgeType;
          const bonuses = computeKnowledgeBonuses({ knowledgeLevel: c.knowledgeLevel, knowledgeType: c.knowledgeType });
          const reply = JSON.stringify({
            type: "upgrade_knowledge_ack", ok: true,
            knowledgeLevel: c.knowledgeLevel,
            knowledgeType: c.knowledgeType,
            ...bonuses,
          });
          if (c.ws.readyState === 1) c.ws.send(reply);
          broadcastWorld(ws);
        }
      } else if (msg.type === "item_dropped" && username) {
        const c = worldClients.get(username);
        if (!c || !msg.item) return;
        const name = (msg.item.name || "").slice(0, 48);
        const icon = (msg.item.icon || "").slice(0, 8);
        const ix = Math.min(Math.max(msg.item.x || c.x, -500), 5000);
        const iy = Math.min(Math.max(msg.item.y || c.y, -500), 5000);
        if (!c._dropCooldown) c._dropCooldown = 0;
        const now = Date.now();
        if (now < c._dropCooldown) return;
        c._dropCooldown = now + 300;
        if (name.length === 0) return;
        const dropMsg = JSON.stringify({
          type: "item_dropped",
          username,
          item: { x: ix, y: iy, name, icon }
        });
        worldClients.forEach((cl) => {
          if (cl.ws !== ws && cl.ws.readyState === 1) cl.ws.send(dropMsg);
        });
      } else if (msg.type === "claim_gift" && username) {
        const c = worldClients.get(username);
        if (c) {
          const pData = memStore.get(username) || getDefaultPlayer(username);
          const result = claimReward(pData);
          memStore.set(username, pData);
          markDirty(username);
          if (result.claimed) {
            c.gems = (c.gems || 0) + result.reward.gems;
            c.gold = (c.gold || 0) + result.reward.gold;
            c.hammers = (c.hammers || 0) + result.reward.hammers;
            c.scrolls = (c.scrolls || 0) + result.reward.scrolls;
          }
          const reply = JSON.stringify({ type: "claim_gift_ack", ...result });
          if (c.ws.readyState === 1) c.ws.send(reply);
        }
      } else if (msg.type === "weapon_upgrade" && username) {
        const c = worldClients.get(username);
        if (c) {
          const weaponId = msg.weaponId || c.equippedWeapon || "";
          if (!weaponId) {
            if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: "weapon_upgrade_ack", ok: false, reason: "اختر سلاحاً أولاً" }));
            return;
          }
          const pData = memStore.get(username) || getDefaultPlayer(username);
          const result = applyWeaponUpgrade(pData, weaponId);
          memStore.set(username, pData);
          markDirty(username);
          if (result.ok) {
            c.weaponStarLevel = result.starLevel;
            c.weaponGemLevel = result.gemLevel;
            const glowMsg = JSON.stringify({
              type: "weapon_glow",
              username,
              weaponId,
              starLevel: result.starLevel,
              color: "#FFD700"
            });
            worldClients.forEach((cl) => { if (cl.ws.readyState === 1) cl.ws.send(glowMsg); });
          }
          const stats = computeWeaponDamageWithUpgrades(pData);
          const reply = JSON.stringify({ type: "weapon_upgrade_ack", ...result, ...stats });
          if (c.ws.readyState === 1) c.ws.send(reply);
        }
      } else if (msg.type === "upgrade_building" && username) {
        const c = worldClients.get(username);
        if (c) {
          const buildingId = msg.buildingId;
          if (!buildingId || !BUILDING_DEFS[buildingId]) {
            if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: "upgrade_building_ack", ok: false, reason: "مبنى غير معروف" }));
            return;
          }
          const pData = memStore.get(username) || getDefaultPlayer(username);
          const result = applyBuildingUpgrade(pData, buildingId);
          memStore.set(username, pData);
          markDirty(username);
          if (result.ok && c) {
            if (!c.buildings) c.buildings = {};
            c.buildings[buildingId] = result.newLevel;
          }
          const reply = JSON.stringify({ type: "upgrade_building_ack", ...result });
          if (c.ws.readyState === 1) c.ws.send(reply);
        }
      } else if (msg.type === "upgrade_research" && username) {
        const c = worldClients.get(username);
        if (c) {
          const categoryId = msg.categoryId;
          const skillId = msg.skillId;
          if (!categoryId || !skillId) {
            if (c.ws.readyState === 1) c.ws.send(JSON.stringify({ type: "upgrade_research_ack", ok: false, reason: "بيانات البحث ناقصة" }));
            return;
          }
          const pData = memStore.get(username) || getDefaultPlayer(username);
          const result = applyResearchUpgrade(pData, categoryId, skillId);
          memStore.set(username, pData);
          markDirty(username);
          if (result.ok && c) {
            if (!c.research) c.research = {};
            c.research[`${categoryId}.${skillId}`] = result.newLevel;
          }
          const reply = JSON.stringify({ type: "upgrade_research_ack", ...result });
          if (c.ws.readyState === 1) c.ws.send(reply);
        }
      }
    });

    ws.on("close", () => {
      if (username) {
        worldClients.delete(username);
        broadcastWorld();
        const leaveMsg = JSON.stringify({ type: "player_left", username });
        worldClients.forEach((cl) => {
          if (cl.ws.readyState === 1) cl.ws.send(leaveMsg);
        });
        logger.info({ username }, "[WorldWS] left");
      }
    });

    ws.on("error", (err) => { logger.warn({ err: err.message }, "[WorldWS] Connection error"); });

    const list = [];
    worldClients.forEach((c) => {
      if (c.ws !== ws) list.push({
        username: c.username, x_position: c.x, y_position: c.y,
        army_power: c.army_power,
        kills: c.kills || 0,
        coinsEarned: c.coinsEarned || 0,
        unitLevel: c.unitLevel || 1,
        armyAlive: c.armyAlive ?? 8,
        color: c.color,
        hp: c.hp ?? c.br_hp ?? 120,
        maxHp: c.maxHp ?? 120,
        br_hp: c.br_hp ?? 120,
        br_alive: c.br_alive ?? true,
        armyYardLevel: c.armyYardLevel || 1,
        knowledgeLevel: c.knowledgeLevel || 1,
        knowledgeType: c.knowledgeType || "economic",
        equippedWeapon: c.equippedWeapon || "",
        weaponStarLevel: c.weaponStarLevel || 1,
        weaponGemLevel: c.weaponGemLevel || 1,
        last_active: Date.now()
      });
    });
    ws.send(JSON.stringify({ type: "world_players", list }));
  };
}

module.exports = { createWorldHandler, playerColor };
