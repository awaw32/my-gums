"use strict";

const crypto = require("crypto");
const { REDIS_URL } = require("../config");
const logger = require("../logger");

const CHANNEL = "world_broadcast";
const instanceId = crypto.randomUUID();

let redisPub = null;
let redisSub = null;

function init(onMessage) {
  if (!REDIS_URL) return; // لا Redis مضبوط — لا تغيير في السلوك الحالي إطلاقاً
  try {
    const Redis = require("ioredis");
    redisPub = new Redis(REDIS_URL);
    redisSub = new Redis(REDIS_URL);
    redisPub.on("error", (e) => logger.warn({ err: e.message }, "[BroadcastBus] Redis pub error"));
    redisSub.on("error", (e) => logger.warn({ err: e.message }, "[BroadcastBus] Redis sub error"));
    redisSub.subscribe(CHANNEL, (err) => {
      if (err) logger.warn({ err: err.message }, "[BroadcastBus] subscribe failed");
      else logger.info({ instanceId }, "[BroadcastBus] connected to Redis, subscribed");
    });
    redisSub.on("message", (channel, message) => {
      if (channel !== CHANNEL) return;
      try {
        const event = JSON.parse(message);
        if (event._originInstanceId === instanceId) return; // تجاهل رسائلنا الخاصة — النسخة المحلية أرسلتها مباشرة أصلاً
        onMessage(event);
      } catch (e) {
        logger.warn({ err: e.message }, "[BroadcastBus] bad message payload");
      }
    });
  } catch (e) {
    logger.warn({ err: e.message }, "[BroadcastBus] init failed — falling back to single-instance mode");
    redisPub = null;
    redisSub = null;
  }
}

function publish(kind, payload) {
  if (!redisPub) return; // no-op بلا Redis
  try {
    redisPub.publish(CHANNEL, JSON.stringify({ kind, payload, _originInstanceId: instanceId }));
  } catch (e) {
    logger.warn({ err: e.message }, "[BroadcastBus] publish failed");
  }
}

module.exports = {
  init,
  publish,
  instanceId,
  get enabled() { return !!redisPub; },
};
