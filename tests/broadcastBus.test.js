import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function freshBroadcastBus() {
  delete require.cache[require.resolve('../server/config')];
  delete require.cache[require.resolve('../server/network/broadcastBus')];
  return require('../server/network/broadcastBus');
}

describe('broadcastBus — disabled (no REDIS_URL)', () => {
  const prevRedisUrl = process.env.REDIS_URL;

  beforeEach(() => { delete process.env.REDIS_URL; });
  afterEach(() => { if (prevRedisUrl !== undefined) process.env.REDIS_URL = prevRedisUrl; });

  it('enabled is false and publish is a safe no-op', () => {
    const bus = freshBroadcastBus();
    expect(bus.enabled).toBe(false);
    expect(() => bus.publish('chat', { username: 'a', message: 'hi' })).not.toThrow();
  });

  it('init is a safe no-op — never invokes the callback synchronously', () => {
    const bus = freshBroadcastBus();
    let called = false;
    expect(() => bus.init(() => { called = true; })).not.toThrow();
    expect(called).toBe(false);
  });
});

describe('broadcastBus — enabled (mocked ioredis)', () => {
  const prevRedisUrl = process.env.REDIS_URL;
  let fakeChannels;

  beforeEach(() => {
    process.env.REDIS_URL = 'redis://fake-host:6379';
    fakeChannels = new Map(); // channel -> Set<handler>

    // ioredis instances are EventEmitters — replicate the minimal surface used by broadcastBus.js
    const EventEmitter = require('events');
    class FakeRedisFull extends EventEmitter {
      constructor() { super(); }
      subscribe(channel, cb) {
        if (!fakeChannels.has(channel)) fakeChannels.set(channel, new Set());
        fakeChannels.get(channel).add((ch, msg) => this.emit('message', ch, msg));
        if (cb) cb(null);
      }
      publish(channel, message) {
        const subs = fakeChannels.get(channel);
        if (subs) for (const deliver of subs) deliver(channel, message);
      }
    }

    require.cache[require.resolve('ioredis')] = {
      id: require.resolve('ioredis'),
      filename: require.resolve('ioredis'),
      loaded: true,
      exports: FakeRedisFull,
    };
  });

  afterEach(() => {
    delete require.cache[require.resolve('ioredis')];
    if (prevRedisUrl !== undefined) process.env.REDIS_URL = prevRedisUrl;
    else delete process.env.REDIS_URL;
  });

  it('enabled becomes true after init with REDIS_URL set', () => {
    const bus = freshBroadcastBus();
    bus.init(() => {});
    expect(bus.enabled).toBe(true);
  });

  it('relays a message published by another instance to the local handler', () => {
    const bus = freshBroadcastBus();
    const receivedEvents = [];
    bus.init((event) => receivedEvents.push(event));

    // simulate a DIFFERENT instance publishing (different _originInstanceId)
    const otherInstanceMsg = JSON.stringify({ kind: 'chat', payload: { username: 'x', message: 'hi' }, _originInstanceId: 'other-instance-id' });
    fakeChannels.get('world_broadcast').forEach((deliver) => deliver('world_broadcast', otherInstanceMsg));

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].kind).toBe('chat');
    expect(receivedEvents[0].payload.message).toBe('hi');
  });

  it('ignores its own published messages (dedup by _originInstanceId)', () => {
    const bus = freshBroadcastBus();
    const receivedEvents = [];
    bus.init((event) => receivedEvents.push(event));

    bus.publish('chat', { username: 'self', message: 'should not echo back to myself' });

    expect(receivedEvents).toHaveLength(0);
  });
});
