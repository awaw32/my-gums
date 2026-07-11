"use strict";

const logger = require("./logger");
const ENABLED = process.env.ENABLE_METRICS !== "false";

let client, register, latencyHist, roomsGauge, tickDriftGauge;

if (ENABLED) {
  try {
    client = require("prom-client");
    register = new client.Registry();
    client.collectDefaultMetrics({ register });

    latencyHist = new client.Histogram({
      name: "ws_roundtrip_ms",
      help: "WebSocket round-trip latency in milliseconds",
      buckets: [20, 40, 60, 80, 100, 150, 200, 300, 500],
      registers: [register],
    });

    roomsGauge = new client.Gauge({
      name: "rooms_active",
      help: "Number of active game rooms",
      registers: [register],
    });

    tickDriftGauge = new client.Gauge({
      name: "tick_drift_ms",
      help: "Tick loop drift from expected 50ms interval",
      registers: [register],
    });

    logger.info("Prometheus metrics enabled");
  } catch (err) {
    logger.warn({ err: err.message }, "Failed to initialize prom-client, metrics disabled");
  }
}

module.exports = {
  enabled: ENABLED && !!register,

  getRegister: () => register,

  observeLatency: (ms) => {
    if (latencyHist) latencyHist.observe(ms);
  },

  setRoomsActive: (count) => {
    if (roomsGauge) roomsGauge.set(count);
  },

  setTickDrift: (ms) => {
    if (tickDriftGauge) tickDriftGauge.set(Math.max(0, ms));
  },

  getP95Latency: () => {
    if (!latencyHist) return 0;
    const metric = latencyHist.get();
    if (metric && metric.values) {
      const p95 = metric.values.find(v => v.metricName === "ws_roundtrip_ms" && v.labels && v.labels.quantile === 0.95);
      if (p95) return Math.round(p95.value);
    }
    return 0;
  },

  getTickDrift: () => {
    if (!tickDriftGauge) return 0;
    const metric = tickDriftGauge.get();
    if (metric && metric.values && metric.values.length > 0) {
      return Math.round(metric.values[0].value);
    }
    return 0;
  },

  getMetricsText: async () => {
    if (!register) return "";
    return register.metrics();
  },

  getContentType: () => {
    if (!register) return "text/plain";
    return register.contentType;
  },
};
