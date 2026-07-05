import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock localStorage (same pattern as save.test.js)
const storage = {};
global.localStorage = {
  getItem: (key) => storage[key] ?? null,
  setItem: (key, val) => { storage[key] = String(val); },
  removeItem: (key) => { delete storage[key]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); },
};

// Mock document for DOM operations
global.document = {
  createElement: () => ({
    id: '', className: '', innerHTML: '', style: {},
    appendChild: vi.fn()
  }),
  body: { appendChild: vi.fn() }
};

const { CinematicManager, CINEMATIC_SCENES } = require('../js/cinematic.js');

describe("CinematicManager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("creates new manager with default state", () => {
    const manager = new CinematicManager();
    expect(manager.completed).toBe(false);
    expect(manager.currentScene).toBe(0);
    expect(manager.needsCinematic).toBe(true);
  });

  test("needsCinematic returns false when completed", () => {
    const manager = new CinematicManager();
    manager.completed = true;
    expect(manager.needsCinematic).toBe(false);
  });

  test("skip() marks as completed and saves state", () => {
    const manager = new CinematicManager();
    manager.skip();
    expect(manager.completed).toBe(true);
    expect(manager.needsCinematic).toBe(false);
    expect(localStorage.getItem("cinematic_completed")).toBe("true");
  });

  test("next() advances to next scene", () => {
    const manager = new CinematicManager();
    manager.currentScene = 0;
    manager.next();
    expect(manager.currentScene).toBe(1);
  });

  test("next() completes when all scenes shown", () => {
    const manager = new CinematicManager();
    manager.currentScene = 6;
    manager.next();
    expect(manager.completed).toBe(true);
  });

  test("getSaveData() returns correct structure", () => {
    const manager = new CinematicManager();
    const data = manager.getSaveData();
    expect(data).toHaveProperty("completed");
    expect(typeof data.completed).toBe("boolean");
  });

  test("loadState() restores completed state", () => {
    const manager = new CinematicManager();
    manager.loadState({ completed: true });
    expect(manager.completed).toBe(true);
  });

  test("loadState() handles null gracefully", () => {
    const manager = new CinematicManager();
    manager.loadState(null);
    expect(manager.completed).toBe(false);
  });

  test("start() calls onComplete immediately if already completed", () => {
    const manager = new CinematicManager();
    manager.completed = true;
    const callback = vi.fn();
    manager.start(callback);
    expect(callback).toHaveBeenCalled();
  });

  test("scenes array has correct length", () => {
    expect(CINEMATIC_SCENES.length).toBe(7);
  });

  test("each scene has required properties", () => {
    for (const scene of CINEMATIC_SCENES) {
      expect(scene).toHaveProperty("id");
      expect(scene).toHaveProperty("icon");
      expect(scene).toHaveProperty("title");
      expect(scene).toHaveProperty("text");
      expect(scene).toHaveProperty("bg");
    }
  });

  test("persisted state is restored on new instance", () => {
    localStorage.setItem("cinematic_completed", "true");
    const manager = new CinematicManager();
    expect(manager.completed).toBe(true);
    expect(manager.needsCinematic).toBe(false);
  });
});
