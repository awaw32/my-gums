"use strict";

const { SENTRY_DSN } = require("./config");
const logger = require("./logger");

let Sentry = null;

if (SENTRY_DSN) {
  try {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: 0,
    });
    logger.info("Sentry initialized");
  } catch (e) {
    logger.warn({ err: e.message }, "Sentry init failed — continuing without it");
    Sentry = null;
  }
}

function captureException(err, context) {
  if (Sentry) {
    try { Sentry.captureException(err, context); } catch {}
  }
}

module.exports = { captureException };
