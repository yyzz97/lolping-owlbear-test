import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSettings, readSettings, settingsKey, writeSettings } from '../src/settings.js';

test('settings default to the new 100 percent baseline with no blocked signals', () => {
  assert.deepEqual(normalizeSettings(null), { volume: 100, blockAll: false, blockedUsers: [] });
  assert.deepEqual(readSettings('missing', { getItem: () => null }), normalizeSettings(null));
});

test('settings clamp volume and validate and deduplicate blocked users', () => {
  assert.deepEqual(normalizeSettings({
    volume: 200, blockAll: 'true',
    blockedUsers: [null, {}, { id: '' }, { id: 'bob', name: 'Bob' }, { id: 'bob', name: 'Duplicate' }],
  }), { volume: 120, blockAll: false, blockedUsers: [{ id: 'bob', name: 'Bob' }] });
  assert.equal(normalizeSettings({ volume: -1 }).volume, 0);
  assert.equal(normalizeSettings({ volume: NaN }).volume, 100);
  assert.equal(normalizeSettings({ volume: '0' }).volume, 100);
});

test('settings survive reload and are isolated by room and user', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const key = settingsKey('room-1', 'alice');
  const saved = writeSettings(key, { volume: 0, blockAll: true, blockedUsers: [{ id: 'bob', name: 'Bob' }] }, storage);
  assert.deepEqual(readSettings(key, storage), saved);
  assert.deepEqual(readSettings(settingsKey('room-1', 'bob'), storage), normalizeSettings(null));
  assert.deepEqual(readSettings(settingsKey('room-2', 'alice'), storage), normalizeSettings(null));
});

test('corrupt or inaccessible settings fall back safely and failed writes are reported', () => {
  assert.deepEqual(readSettings('key', { getItem: () => '{broken' }), normalizeSettings(null));
  const unavailable = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readSettings('key', unavailable), normalizeSettings(null));
  assert.throws(() => writeSettings('key', {}, unavailable), /blocked/);
});
