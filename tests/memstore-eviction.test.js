import { describe, it, expect } from 'vitest';
import { evictInactivePlayers, INACTIVE_EVICTION_MS } from '../server/db/databaseHelper.js';

// 🧹 قبل هذا الإصلاح: memStore (Map) في server/db/databaseHelper.js ينمو دون
// حد أقصى طوال عمر العملية — كل لاعب سجّل دخوله ولو مرة واحدة يبقى في الذاكرة
// للأبد. على سيرفر طويل الأمد بلاعبين كثر، هذا استهلاك ذاكرة متزايد بلا توقف.
// evictInactivePlayers تحذف فقط اللاعبين الخاملين جداً (30 يوماً+) وفقط بعد
// التأكد أن بياناتهم محفوظة فعلاً على القرص (ليست في _dirtyUsernames).

function makeStore(entries) {
  return new Map(entries.map(([username, player]) => [username, player]));
}

describe('🧹 إخلاء اللاعبين الخاملين من memStore (server/db/databaseHelper.js)', () => {
  it('يحذف لاعباً خاملاً منذ أكثر من 30 يوماً وتم حفظه بالفعل', () => {
    const now = Date.now();
    const store = makeStore([
      ['old_player', { username: 'old_player', last_active: now - INACTIVE_EVICTION_MS - 1000 }],
    ]);
    const dirty = new Set(); // ليس متسخاً — مُحفَظ بالفعل
    const evicted = evictInactivePlayers(store, dirty, now);
    expect(evicted).toBe(1);
    expect(store.has('old_player')).toBe(false);
  });

  it('لا يحذف لاعباً نشطاً حديثاً', () => {
    const now = Date.now();
    const store = makeStore([
      ['active_player', { username: 'active_player', last_active: now - 1000 }],
    ]);
    const evicted = evictInactivePlayers(store, new Set(), now);
    expect(evicted).toBe(0);
    expect(store.has('active_player')).toBe(true);
  });

  it('لا يحذف لاعباً خاملاً جداً إن لم تُحفَظ بياناته بعد (موجود في dirtyUsernames) — يمنع فقدان بيانات', () => {
    const now = Date.now();
    const store = makeStore([
      ['unsaved_player', { username: 'unsaved_player', last_active: now - INACTIVE_EVICTION_MS - 1000 }],
    ]);
    const dirty = new Set(['unsaved_player']);
    const evicted = evictInactivePlayers(store, dirty, now);
    expect(evicted).toBe(0);
    expect(store.has('unsaved_player')).toBe(true);
  });

  it('لا يحذف لاعباً جديداً بلا last_active إطلاقاً (لا نفترض خموله)', () => {
    const now = Date.now();
    const store = makeStore([
      ['brand_new', { username: 'brand_new', last_active: 0 }],
    ]);
    const evicted = evictInactivePlayers(store, new Set(), now);
    expect(evicted).toBe(0);
    expect(store.has('brand_new')).toBe(true);
  });

  it('يحذف عدة لاعبين خاملين معاً ويترك النشطين', () => {
    const now = Date.now();
    const store = makeStore([
      ['old1', { username: 'old1', last_active: now - INACTIVE_EVICTION_MS - 5000 }],
      ['old2', { username: 'old2', last_active: now - INACTIVE_EVICTION_MS - 6000 }],
      ['active', { username: 'active', last_active: now - 5000 }],
    ]);
    const evicted = evictInactivePlayers(store, new Set(), now);
    expect(evicted).toBe(2);
    expect(store.has('old1')).toBe(false);
    expect(store.has('old2')).toBe(false);
    expect(store.has('active')).toBe(true);
  });

  it('يقبل عتبة خمول مخصصة (maxAgeMs) بدل الافتراضية', () => {
    const now = Date.now();
    const store = makeStore([
      ['semi_old', { username: 'semi_old', last_active: now - (2 * 60 * 60 * 1000) }], // ساعتان
    ]);
    const evicted = evictInactivePlayers(store, new Set(), now, 60 * 60 * 1000); // عتبة ساعة واحدة
    expect(evicted).toBe(1);
    expect(store.has('semi_old')).toBe(false);
  });

  it('لا يحذف بالضبط عند حافة العتبة (أقل بمللي ثانية واحدة من الحد)', () => {
    const now = Date.now();
    const store = makeStore([
      ['edge_player', { username: 'edge_player', last_active: now - INACTIVE_EVICTION_MS + 1 }],
    ]);
    const evicted = evictInactivePlayers(store, new Set(), now);
    expect(evicted).toBe(0);
    expect(store.has('edge_player')).toBe(true);
  });

  it('يعمل بلا أي خطأ إن كانت dirtyUsernames غير معرَّفة (null)', () => {
    const now = Date.now();
    const store = makeStore([
      ['old_player', { username: 'old_player', last_active: now - INACTIVE_EVICTION_MS - 1000 }],
    ]);
    expect(() => evictInactivePlayers(store, null, now)).not.toThrow();
    expect(store.has('old_player')).toBe(false);
  });

  it('لا يفعل شيئاً على Map فارغة', () => {
    const store = makeStore([]);
    const evicted = evictInactivePlayers(store, new Set());
    expect(evicted).toBe(0);
  });
});
