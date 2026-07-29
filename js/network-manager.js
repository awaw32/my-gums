/**
 * 🌐 Network Manager System
 * Handles all network requests with retry logic and race condition prevention
 * Production-safe with proper error handling
 */

export class NetworkManager {
  constructor(apiBase = '') {
    this.apiBase = apiBase;
    this.saveLock = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // ms
    this.requestTimeout = {
      load: 5000,
      save: 3000,
      quick: 2000,
    };
  }

  /**
   * Make a GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @returns {Promise}
   */
  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, null, options);
  }

  /**
   * Make a POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} options - Request options
   * @returns {Promise}
   */
  async post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, data, options);
  }

  /**
   * Core request method with retry and timeout
   * @private
   */
  async request(method, endpoint, data = null, options = {}) {
    const {
      timeout = this.requestTimeout.load,
      retries = this.maxRetries,
    } = options;

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Check for rate limiting
        if (this.isRateLimited(endpoint)) {
          await this.delay(500 * (attempt + 1));
        }

        const response = await this._executeRequest(
          method,
          endpoint,
          data,
          timeout
        );

        return response;
      } catch (error) {
        lastError = error;

        // Don't retry on client errors (4xx)
        if (error.status >= 400 && error.status < 500) {
          throw error;
        }

        // Retry with exponential backoff
        if (attempt < retries) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await this.delay(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute a single request
   * @private
   */
  async _executeRequest(method, endpoint, data, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const url = `${this.apiBase}${endpoint}`;
      const options = {
        method,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      };

      // Add authorization token
      const token = localStorage.getItem('player_token');
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }

      // Add request body
      if (data) {
        options.body = JSON.stringify(data);
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        error.message = `Request timeout (${timeout}ms)`;
      }

      throw error;
    }
  }

  /**
   * Save to database with race condition prevention
   * @param {string} username - Player username
   * @param {Object} data - Data to save
   * @returns {Promise}
   */
  async saveToDatabase(username, data) {
    // Prevent concurrent saves
    if (this.saveLock) {
      if (import.meta.env?.DEV) {
        console.warn('⚠️ [Network] Save already in progress, skipping...');
      }
      return false;
    }

    this.saveLock = true;

    try {
      const result = await this.post(
        `/api/players/${encodeURIComponent(username)}`,
        data,
        {
          timeout: this.requestTimeout.save,
          retries: 2,
        }
      );

      return result;
    } finally {
      this.saveLock = false;
    }
  }

  /**
   * Load from database with timeout
   * @param {string} username - Player username
   * @returns {Promise}
   */
  async loadFromDatabase(username) {
    return this.get(
      `/api/players/${encodeURIComponent(username)}`,
      {
        timeout: this.requestTimeout.load,
        retries: 3,
      }
    );
  }

  /**
   * Authentication endpoint
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise}
   */
  async authenticate(username, password) {
    return this.post(
      `/api/auth/login`,
      { username, password },
      {
        timeout: this.requestTimeout.quick,
        retries: 2,
      }
    );
  }

  /**
   * Check server health
   * @returns {Promise}
   */
  async checkHealth() {
    try {
      return await this.get('/health', {
        timeout: this.requestTimeout.quick,
        retries: 1,
      });
    } catch (error) {
      return { status: 'offline', error: error.message };
    }
  }

  /**
   * Check if endpoint is rate limited
   * @private
   */
  isRateLimited(endpoint) {
    const key = `_ratelimit_${endpoint}`;
    const entry = JSON.parse(sessionStorage.getItem(key) || '{}');
    const now = Date.now();

    if (entry.resetAt && now < entry.resetAt) {
      return true;
    }

    return false;
  }

  /**
   * Delay utility
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global singleton
export const networkManager = new NetworkManager();

if (import.meta.env?.DEV) {
  window.__networkManager = networkManager;
}
