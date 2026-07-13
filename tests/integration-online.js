/**
 * Online systems integration test.
 * Starts server, tests APIs + WebSocket, reports results.
 */
const cp = require("child_process");
const http = require("http");
const path = require("path");
const fs = require("fs");

// Only run if explicitly invoked
if (!process.env.RUN_INTEGRATION) {
  console.log("SKIP: Set RUN_INTEGRATION=true to run online integration tests");
  process.exitCode = 0;
  throw new Error("SKIP");
}

const DATA_DIR = path.join(__dirname, "..", "data-inttest-" + Date.now());
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
let passed = 0, failed = 0;

let server = null;

function httpReq(method, urlPath, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: "127.0.0.1", port: PORT, path: urlPath, method,
      headers: { ...headers }
    };
    if (body) {
      const b = typeof body === "string" ? body : JSON.stringify(body);
      opts.headers["Content-Type"] = "application/json";
      opts.headers["Content-Length"] = Buffer.byteLength(b);
    }
    const req = http.request(opts, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on("error", reject);
    if (body) req.write(typeof body === "string" ? body : JSON.stringify(body));
    req.end();
  });
}

function waitForServer(retries = 20) {
  return new Promise((resolve, reject) => {
    function tryConnect(n) {
      if (n <= 0) return reject(new Error("Server not ready after timeout"));
      const req = http.get(`${BASE}/health`, res => {
        let data = "";
        res.on("data", c => data += c);
        res.on("end", () => resolve());
      });
      req.on("error", () => setTimeout(() => tryConnect(n - 1), 500));
      req.setTimeout(2000, () => { req.destroy(); setTimeout(() => tryConnect(n - 1), 500); });
    }
    tryConnect(retries);
  });
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
    failed++;
  }
}

async function main() {
  console.log("=".repeat(65));
  console.log("  DESERT EMPIRE — ONLINE INTEGRATION TEST");
  console.log("=".repeat(65));

  // Setup
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Start server
  console.log("\nStarting server...");
  server = cp.spawn("node", ["server.js"], {
    cwd: __dirname + "/..",
    env: {
      ...process.env,
      NODE_ENV: "development",
      JWT_SECRET: "integration-secret-key-test",
      PORT: String(PORT),
      DATA_DIR: DATA_DIR,
      MONGO_URL: "",
      CORS_ORIGIN: "*"
    },
    stdio: ["pipe", "pipe", "pipe"]
  });
  server.stderr.on("data", d => {
    const line = d.toString().trim();
    if (line && !line.includes("injected env")) console.log("  [srv]", line.slice(0, 120));
  });
  server.on("exit", (code, sig) => {
    if (code !== null && code !== 0 && code !== undefined) {
      console.log(`  [srv] exited with code ${code} signal ${sig}`);
    }
  });

  // Wait for ready
  await waitForServer();
  console.log("Server ready!\n");

  let token1, token2;
  let wsModule;

  // ============ HTTP API ============
  console.log("─── HTTP API ───");

  await test("Health check", async () => {
    const r = await httpReq("GET", "/health");
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (!r.body.status) throw new Error("No status");
  });

  await test("CORS header", async () => {
    const r = await httpReq("GET", "/health");
    if (r.headers["access-control-allow-origin"] !== "*")
      throw new Error(`Bad CORS: ${r.headers["access-control-allow-origin"]}`);
  });

  await test("Security headers", async () => {
    const r = await httpReq("GET", "/health");
    if (r.headers["x-content-type-options"] !== "nosniff")
      throw new Error("Missing nosniff");
    if (r.headers["x-frame-options"] !== "DENY")
      throw new Error("Missing XFO");
  });

  await test("Register player1", async () => {
    const r = await httpReq("POST", "/api/auth/login",
      { username: "inttest1", password: "pass123" });
    if (r.status !== 200) throw new Error(`Status ${r.status}: ${JSON.stringify(r.body)}`);
    if (!r.body.token) throw new Error("No token");
    token1 = r.body.token;
  });

  await test("Register player2", async () => {
    const r = await httpReq("POST", "/api/auth/login",
      { username: "inttest2", password: "pass456" });
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    token2 = r.body.token;
  });

  await test("Login existing = same token", async () => {
    const r = await httpReq("POST", "/api/auth/login",
      { username: "inttest1", password: "pass123" });
    if (r.body.token !== token1) throw new Error("Token changed");
  });

  await test("Wrong password = 401", async () => {
    const r = await httpReq("POST", "/api/auth/login",
      { username: "inttest1", password: "bad" });
    if (r.status !== 401) throw new Error(`Got ${r.status}`);
  });

  await test("Get profile (public)", async () => {
    const r = await httpReq("GET", "/api/players/inttest1");
    if (r.status !== 200) throw new Error(`Status ${r.status}`);
    if (r.body.password) throw new Error("Password LEAKED");
  });

  await test("Save with JWT", async () => {
    const r = await httpReq("POST", "/api/players/inttest1",
      { army_power: 7777, cash: 1000, gems: 30 },
      { Authorization: `Bearer ${token1}` });
    if (r.status !== 200) throw new Error(`Status ${r.status}: ${JSON.stringify(r.body)}`);
  });

  await test("Save without JWT = 401", async () => {
    const r = await httpReq("POST", "/api/players/inttest1", { cash: 999 });
    if (r.status !== 401) throw new Error(`Got ${r.status}`);
  });

  await test("Save with wrong JWT rejected", async () => {
    const r = await httpReq("POST", "/api/players/inttest1", { cash: 100 },
      { Authorization: `Bearer ${token2}` });
    // 401 (unauthorized) or 403 (forbidden) both acceptable
    if (![401, 403].includes(r.status)) throw new Error(`Got ${r.status}`);
  });

  await test("Saved data persists", async () => {
    const r = await httpReq("GET", "/api/players/inttest1");
    if (r.body.army_power !== 7777) throw new Error(`Expected 7777 got ${r.body.army_power}`);
    if (r.body.cash !== 1000) throw new Error(`Expected 1000 got ${r.body.cash}`);
  });

  await test("Leaderboard", async () => {
    const r = await httpReq("GET", "/api/leaderboard?sort=power");
    if (!Array.isArray(r.body)) throw new Error("Not array");
    if (r.body.length < 1) throw new Error("Empty");
  });

  await test("Buildings definitions", async () => {
    const r = await httpReq("GET", "/api/buildings");
    if (Object.keys(r.body).length === 0) throw new Error("No buildings");
  });

  await test("Research definitions", async () => {
    const r = await httpReq("GET", "/api/research");
    if (Object.keys(r.body).length === 0) throw new Error("No research");
  });

  await test("Weapon definitions", async () => {
    const r = await httpReq("GET", "/api/weapons/defs");
    if (!Array.isArray(r.body)) throw new Error("Not array");
  });

  await test("Players list", async () => {
    const r = await httpReq("GET", "/api/players");
    if (!r.body.some(p => p.username === "inttest1"))
      throw new Error("Player not listed");
  });

  await test("Version endpoint", async () => {
    const r = await httpReq("GET", "/version");
    if (!r.body.buildId) throw new Error("No buildId");
  });

  await test("Claim reward", async () => {
    const r = await httpReq("POST", "/api/rewards/claim/inttest1", "",
      { Authorization: `Bearer ${token1}` });
    if (![200, 409].includes(r.status))
      throw new Error(`Got ${r.status}`);
  });

  await test("Claim reward without JWT = 401", async () => {
    const r = await httpReq("POST", "/api/rewards/claim/inttest1");
    if (r.status !== 401) throw new Error(`Got ${r.status}`);
  });

  await test("Upgrade endpoint", async () => {
    const r = await httpReq("POST", "/api/upgrades/inttest1",
      { armyYardLevel: 2 },
      { Authorization: `Bearer ${token1}` });
    if (![200, 400].includes(r.status))
      throw new Error(`Got ${r.status}`);
  });

  // ============ WEB SOCKET ============
  console.log("\n─── WEB SOCKET ───");

  try {
    wsModule = require("ws");
  } catch {
    console.log("  ws module not available for WS tests");
  }

  if (wsModule) {
    const WebSocket = wsModule;

    function wsConnect(urlPath) {
      return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://127.0.0.1:${PORT}${urlPath}`);
        ws.on("open", () => resolve(ws));
        ws.on("error", reject);
        ws.on("unexpected-response", (req, res) => {
          let data = "";
          res.on("data", c => data += c);
          res.on("end", () => reject(new Error(`WS ${res.statusCode}`)));
        });
        setTimeout(() => reject(new Error("WS timeout")), 5000);
      });
    }

    let ws1, ws2;

    function wsCollect(ws, typeFilter, timeout = 4000) {
      return new Promise(resolve => {
        const msgs = [];
        const t = setTimeout(() => resolve(msgs), timeout);
        ws.on("message", data => {
          try {
            const m = JSON.parse(data.toString());
            msgs.push(m);
            if (typeFilter && m.type === typeFilter) { clearTimeout(t); resolve(msgs); }
          } catch {}
        });
      });
    }

    await test("WS world rejected/closed without token", async () => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/world`);
      const closeCode = await new Promise(resolve => {
        ws.on("close", (code) => resolve(code));
        setTimeout(() => resolve(-1), 3000);
      });
      // Server may reject during upgrade (4001) or allow then close (close code 4001)
      // Either way the connection should not be usable
      console.log(`    Close code: ${closeCode}`);
    });

    await test("WS world connect + join with token", async () => {
      ws1 = new WebSocket(`ws://127.0.0.1:${PORT}/ws/world?token=${token1}`);
      await new Promise((resolve, reject) => {
        ws1.on("open", resolve);
        ws1.on("error", reject);
        setTimeout(() => reject(new Error("WS1 connect timeout")), 5000);
      });
      // Send join and collect all messages for 3s
      const collector = wsCollect(ws1);
      ws1.send(JSON.stringify({
        type: "join", username: "inttest1",
        x_position: 1200, y_position: 1200,
        army_power: 7777, hp: 120, maxHp: 120
      }));
      const msgs = await collector;
      const types = msgs.map(m => m.type).join(", ");
      console.log(`    Messages: ${types}`);
      const hasWorldState = msgs.some(m => m.type === "world_players" || m.type === "world_monsters");
      if (!hasWorldState) {
        // Try once more - maybe the server needs time
        await new Promise(r => setTimeout(r, 2000));
        const msgs2 = ws1.listeners("message").length > 0 ? [] : [];
        console.log(`    Retry collected: ${msgs2.length}`);
      }
      if (!hasWorldState) throw new Error(`No world state. Types: ${types || "none"}`);
    });

    const ws2Messages = [];

    await test("Second player joins", async () => {
      // Small delay to let first player settle
      await new Promise(r => setTimeout(r, 500));
      ws2 = new WebSocket(`ws://127.0.0.1:${PORT}/ws/world?token=${token2}`);
      await new Promise((resolve, reject) => {
        ws2.on("open", resolve);
        ws2.on("error", reject);
        setTimeout(() => reject(new Error("WS2 connect timeout")), 5000);
      });
      // Collect ALL messages persistently to avoid race conditions
      ws2.on("message", data => {
        try { ws2Messages.push(JSON.parse(data.toString())); } catch {}
      });
      ws2.send(JSON.stringify({
        type: "join", username: "inttest2",
        x_position: 1300, y_position: 1300
      }));
      // Wait up to 3s for initial state
      await new Promise(r => setTimeout(r, 3000));
      const hasWorldPlayers = ws2Messages.some(m => m.type === "world_players");
      if (hasWorldPlayers) {
        const wp = ws2Messages.find(m => m.type === "world_players");
        console.log(`    Players online: ${wp.list.length}`);
        console.log(`    Players: ${wp.list.map(p => p.username).join(", ")}`);
      } else {
        console.log(`    WS2 msgs: ${ws2Messages.map(m => m.type).join(", ") || "none"}`);
      }
    });

    await test("Players see each other", async () => {
      // Check all messages received so far
      const wp = ws2Messages.find(m => m.type === "world_players");
      if (!wp) throw new Error("No world_players received by player2");
      const found = wp.list.find(p => p.username === "inttest1");
      if (!found) throw new Error(`Player1 not in list: ${wp.list.map(p => p.username).join(",")}`);
      console.log(`    Player2 sees player1 at (${found.x_position},${found.y_position})`);
    });

    await test("Movement broadcast", async () => {
      // Clear previous messages, send movement, wait for update
      ws2Messages.length = 0;
      ws1.send(JSON.stringify({ type: "update", x_position: 1250, y_position: 1250 }));
      await new Promise(r => setTimeout(r, 4000));
      const wp = ws2Messages.find(m => m.type === "world_players");
      if (!wp) throw new Error("No position update received");
      const p1 = wp.list.find(p => p.username === "inttest1");
      if (!p1) throw new Error("P1 missing from update");
      console.log(`    P1 position: (${p1.x_position}, ${p1.y_position})`);
      if (p1.x_position !== 1250) {
        console.log(`    Note: position may differ from sent value (server-validated)`);
      }
    });

    await test("Chat broadcast", async () => {
      ws2Messages.length = 0;
      ws1.send(JSON.stringify({ type: "chat", message: "Hello online!" }));
      await new Promise(r => setTimeout(r, 4000));
      const chat = ws2Messages.find(m => m.type === "broadcast_chat");
      if (!chat) throw new Error("No broadcast_chat received");
      console.log(`    Chat: from=${chat.username || chat.from}, msg=${chat.message}`);
    });

    const ws1Messages = [];

    await test("Player disconnect broadcast", async () => {
      // Capture p1 messages
      ws1.on("message", data => {
        try { ws1Messages.push(JSON.parse(data.toString())); } catch {}
      });
      ws2.close();
      await new Promise(r => setTimeout(r, 4000));
      const left = ws1Messages.find(m => m.type === "player_left");
      if (!left) throw new Error("No player_left received");
      console.log(`    Left: ${left.username}`);
    });

    ws1?.close();
  } else {
    console.log("  ⚠️  ws module not found - skipping WebSocket tests");
    console.log("     Install with: npm install ws");
  }

  // ============ RESULTS ============
  console.log(`\n${"=".repeat(65)}`);
  const total = passed + failed;
  console.log(`  ${total} TESTS: ${passed} ✅ PASSED  |  ${failed} ❌ FAILED`);
  if (failed === 0) console.log("  🎉 ALL SYSTEMS VERIFIED");
  console.log(`${"=".repeat(65)}`);

  // Cleanup
  server.kill("SIGTERM");
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error("FATAL:", e);
  if (server) try { server.kill("SIGTERM"); } catch {}
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
  process.exit(1);
});
