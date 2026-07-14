/**
 * 📊 Performance Monitor System
 * Tracks game performance metrics (FPS, memory, render time, etc.)
 * Non-intrusive with minimal overhead
 */

export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 0,
      frameTime: 0,
      renderTime: 0,
      updateTime: 0,
      memory: 0,
      memoryUsage: 0,
    };

    this.history = {
      fps: [],
      frameTime: [],
      memory: [],
    };

    this.maxHistorySize = 60; // Keep last 60 samples
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsUpdateInterval = 1000; // Update FPS every second
    this.lastFpsUpdate = this.lastTime;

    this.enabled = import.meta.env?.DEV; // Only enable in dev mode
    this.listeners = [];
  }

  /**
   * Start tracking a frame
   * @returns {number} Frame start time
   */
  startFrame() {
    if (!this.enabled) return 0;
    return performance.now();
  }

  /**
   * End tracking a frame
   * @param {number} frameStart - Frame start time
   */
  endFrame(frameStart) {
    if (!this.enabled) return;

    const now = performance.now();
    const frameTime = now - frameStart;

    this.metrics.frameTime = frameTime;
    this.frameCount++;

    // Update FPS
    const elapsed = now - this.lastFpsUpdate;
    if (elapsed >= this.fpsUpdateInterval) {
      this.metrics.fps = Math.round((this.frameCount * 1000) / elapsed);
      this.addToHistory('fps', this.metrics.fps);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    // Update memory
    if (performance.memory) {
      this.metrics.memory = Math.round(performance.memory.usedJSHeapSize / 1048576);
      this.metrics.memoryUsage = Math.round(
        (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit) * 100
      );
      this.addToHistory('memory', this.metrics.memory);
    }

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Track operation timing
   * @param {string} label - Operation label
   * @param {Function} callback - Operation to time
   * @returns {any} Operation result
   */
  trackOperation(label, callback) {
    if (!this.enabled) return callback();

    const start = performance.now();
    try {
      const result = callback();
      const duration = performance.now() - start;

      if (label === 'render') {
        this.metrics.renderTime = duration;
      } else if (label === 'update') {
        this.metrics.updateTime = duration;
      }

      if (duration > 16) {
        // Warn if operation takes longer than a frame (60 FPS)
        console.warn(`⚠️ [Perf] ${label} took ${duration.toFixed(2)}ms`);
      }

      return result;
    } catch (error) {
      console.error(`❌ [Perf] ${label} failed:`, error);
      throw error;
    }
  }

  /**
   * Add metric to history
   * @private
   */
  addToHistory(metric, value) {
    if (!this.history[metric]) return;

    this.history[metric].push(value);
    if (this.history[metric].length > this.maxHistorySize) {
      this.history[metric].shift();
    }
  }

  /**
   * Subscribe to metric updates
   * @param {Function} callback - Callback function
   */
  subscribe(callback) {
    this.listeners.push(callback);
  }

  /**
   * Unsubscribe from updates
   * @param {Function} callback - Callback function
   */
  unsubscribe(callback) {
    this.listeners = this.listeners.filter(l => l !== callback);
  }

  /**
   * Notify all listeners
   * @private
   */
  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.metrics);
      } catch (error) {
        console.error('❌ [Perf] Listener error:', error);
      }
    }
  }

  /**
   * Get performance summary
   * @returns {Object}
   */
  getSummary() {
    const getAverage = (arr) => {
      if (arr.length === 0) return 0;
      return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
    };

    return {
      current: {
        fps: this.metrics.fps,
        frameTime: this.metrics.frameTime.toFixed(2),
        renderTime: this.metrics.renderTime.toFixed(2),
        updateTime: this.metrics.updateTime.toFixed(2),
        memory: this.metrics.memory,
        memoryUsage: this.metrics.memoryUsage,
      },
      average: {
        fps: getAverage(this.history.fps),
        memory: getAverage(this.history.memory),
      },
    };
  }

  /**
   * Get performance report (for debugging)
   * @returns {Object}
   */
  getReport() {
    const summary = this.getSummary();
    return {
      timestamp: new Date().toISOString(),
      ...summary,
      history: {
        fps: this.history.fps,
        memory: this.history.memory,
      },
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      fps: 0,
      frameTime: 0,
      renderTime: 0,
      updateTime: 0,
      memory: 0,
      memoryUsage: 0,
    };
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.lastFpsUpdate = this.lastTime;
  }

  /**
   * Enable/disable monitoring
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

// Global singleton
export const performanceMonitor = new PerformanceMonitor();

// Expose to window for debugging
if (typeof window !== 'undefined' && import.meta.env?.DEV) {
  window.__performanceMonitor = performanceMonitor;
}
