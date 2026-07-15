"use strict";

const webpush = require("web-push");
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = require("./config");
const logger = require("./logger");

const enabled = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (enabled) {
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

async function sendPush(subscription, payload) {
  if (!enabled || !subscription) return;
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
  } catch (e) {
    logger.warn({ err: e.message }, "[Push] send failed");
  }
}

module.exports = { enabled, sendPush };
