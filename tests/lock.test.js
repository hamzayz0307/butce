import { describe, it, expect, beforeEach, vi } from 'vitest';

// A tiny localStorage for the test environment
const mem = new Map();
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
globalThis.document = { addEventListener: () => {} };

const lock = await import('../src/lock.js');

beforeEach(() => { mem.clear(); vi.useRealTimers(); });

describe('PIN lock', () => {
  it('stores only a salted hash and checks the PIN', async () => {
    expect(lock.lockEnabled()).toBe(false);
    await lock.setPin('1234');
    expect(lock.lockEnabled()).toBe(true);
    expect(mem.get('butce.lock')).not.toContain('1234');
    expect(await lock.checkPin('1234')).toEqual({ ok: true });
    expect(await lock.checkPin('0000')).toEqual({ ok: false, left: 4 });
  });

  it('makes you wait after five wrong tries, even with the right PIN', async () => {
    await lock.setPin('2468');
    for (let i = 0; i < 4; i++) await lock.checkPin('1111');
    expect((await lock.checkPin('1111')).wait).toBeGreaterThan(0);
    expect((await lock.checkPin('2468')).ok).toBe(false);
  });

  it('can be removed', async () => {
    await lock.setPin('1357');
    lock.removePin();
    expect(lock.lockEnabled()).toBe(false);
    expect(await lock.checkPin('9999')).toEqual({ ok: true });
  });
});
