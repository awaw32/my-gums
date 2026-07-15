/**
 * 🛡️ Error Logger System
 * Comprehensive error tracking and reporting
 * Production-safe with optional service integration
 */

let _sentryInitPromise = null;

async function ensureSentry() {
  const dsn = import.meta.env?.VITE_SENTRY_DSN;
  if (!dsn) return null;
  if (!_sentryInitPromise) {
    _sentryInitPromise = import('@sentry/browser').then((Sentry) => {
      Sentry.init({ dsn, environment: import.meta.env?.MODE || 'production', tracesSampleRate: 0 });
      return Sentry;
    }).catch((e) => {
      if (import.meta.env?.DEV) console.warn('Sentry init failed:', e.message);
      return null;
    });
  }
  return _sentryInitPromise;
}

export class ErrorLogger {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.maxErrors = 100;
    this.maxWarnings = 100;
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.stats = {
      totalErrors: 0,
      totalWarnings: 0,
      errorsByType: {},
      errorsByComponent: {},
    };

    this.setupGlobalHandlers();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  setupGlobalHandlers() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.logError({
        type: 'uncaughtError',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: Date.now(),
      });
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        type: 'unhandledRejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: Date.now(),
      });
    });

    // Handle resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.logError({
          type: 'resourceError',
          resource: event.target.src || event.target.href,
          message: `Failed to load resource`,
          timestamp: Date.now(),
        });
      }
    }, true);
  }

  /**
   * Log an error
   * @param {Object} errorObj - Error object with details
   */
  logError(errorObj) {
    const error = {
      ...errorObj,
      id: this.generateErrorId(),
      sessionId: this.sessionId,
      env: import.meta.env?.MODE,
      timestamp: errorObj.timestamp || Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.errors.push(error);
    this.stats.totalErrors++;
    this.stats.errorsByType[error.type] = (this.stats.errorsByType[error.type] || 0) + 1;

    // Keep array size manageable
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    // Log to console in development
    if (import.meta.env?.DEV) {
      console.error(`[ERROR] ${error.type}:`, error.message, error);
    }

    // Send to service if in production and error is critical
    if (import.meta.env?.PROD && this.isCritical(error)) {
      this.reportToService(error);
    }
  }

  /**
   * Log a warning
   * @param {string} component - Component name
   * @param {string} message - Warning message
   * @param {Object} metadata - Additional data
   */
  logWarning(component, message, metadata = {}) {
    const warning = {
      component,
      message,
      metadata,
      id: this.generateErrorId(),
      sessionId: this.sessionId,
      timestamp: Date.now(),
    };

    this.warnings.push(warning);
    this.stats.totalWarnings++;

    if (this.warnings.length > this.maxWarnings) {
      this.warnings.shift();
    }

    if (import.meta.env?.DEV) {
      console.warn(`[${component}] ${message}`, metadata);
    }
  }

  /**
   * Log network error with retry capability
   * @param {string} endpoint - API endpoint
   * @param {string} error - Error message
   * @param {number} retryCount - Number of retries
   */
  logNetworkError(endpoint, error, retryCount = 0) {
    this.logError({
      type: 'networkError',
      endpoint,
      message: error,
      retryCount,
      timestamp: Date.now(),
    });

    // Store in localStorage for analysis
    const networkErrors = JSON.parse(localStorage.getItem('_network_errors') || '[]');
    networkErrors.push({
      endpoint,
      error,
      retryCount,
      timestamp: Date.now(),
    });
    if (networkErrors.length > 50) networkErrors.shift();
    localStorage.setItem('_network_errors', JSON.stringify(networkErrors));
  }

  /**
   * Log save operation error
   * @param {string} type - Save type (welcome_bonus, login_ping, br_match, etc)
   * @param {Error} error - Error object
   */
  logSaveError(type, error) {
    this.logError({
      type: 'saveError',
      saveType: type,
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
    });

    // Store failed saves for retry
    const failedSaves = JSON.parse(localStorage.getItem('_failed_saves') || '[]');
    failedSaves.push({
      type,
      error: error.message,
      timestamp: Date.now(),
    });
    if (failedSaves.length > 20) failedSaves.shift();
    localStorage.setItem('_failed_saves', JSON.stringify(failedSaves));
  }

  /**
   * Determine if error is critical
   * @param {Object} error - Error object
   * @returns {boolean}
   */
  isCritical(error) {
    const criticalTypes = ['uncaughtError', 'unhandledRejection', 'networkError'];
    return criticalTypes.includes(error.type);
  }

  /**
   * Generate unique error ID
   * @returns {string}
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  /**
   * Report error to logging service (placeholder)
   * @param {Object} error - Error object
   */
  async reportToService(error) {
    try {
      const Sentry = await ensureSentry();
      if (Sentry) {
        try {
          Sentry.captureException(new Error(error.message || error.type), { extra: error });
        } catch {}
        return;
      }

      // بلا Sentry مُفعّل: ترسل تقريراً بسيطاً إلى /api/logs (يُسجَّل عبر pino على السيرفر)
      const loggingEndpoint = window.__LOGGING_ENDPOINT__ || '/api/logs';

      await fetch(loggingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error,
          sessionId: this.sessionId,
          timestamp: Date.now(),
        }),
      }).catch(e => {
        // Silently fail if logging service is unavailable
        if (import.meta.env?.DEV) console.warn('Logging service unavailable:', e.message);
      });
    } catch {
      // Prevent logging errors from breaking the app
    }
  }

  /**
   * Get error summary
   * @returns {Object}
   */
  getSummary() {
    return {
      sessionId: this.sessionId,
      uptime: Date.now() - this.startTime,
      stats: this.stats,
      recentErrors: this.errors.slice(-10),
      recentWarnings: this.warnings.slice(-10),
    };
  }

  /**
   * Export all logs (for debugging)
   * @returns {Object}
   */
  exportLogs() {
    return {
      session: {
        id: this.sessionId,
        startTime: this.startTime,
        uptime: Date.now() - this.startTime,
      },
      errors: this.errors,
      warnings: this.warnings,
      stats: this.stats,
    };
  }

  /**
   * Clear old logs
   */
  clearOldLogs() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    this.errors = this.errors.filter(e => e.timestamp > oneHourAgo);
    this.warnings = this.warnings.filter(w => w.timestamp > oneHourAgo);
  }
}

// Global singleton instance
export const errorLogger = new ErrorLogger();

// Expose to window for debugging
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__errorLogger = errorLogger;
}
