export function settingsKey(roomId, userId) {
  return `com.github.dmhpj.lolping-owlbear-test/settings/${encodeURIComponent(roomId)}/${encodeURIComponent(userId)}`;
}

export function normalizeSettings(value) {
  const saved = value && typeof value === 'object' ? value : {};
  const blockedUsers = [];
  if (Array.isArray(saved.blockedUsers)) {
    for (const user of saved.blockedUsers) {
      if (!user || typeof user.id !== 'string' || !user.id || user.id.length > 128
        || blockedUsers.some(blocked => blocked.id === user.id)) continue;
      blockedUsers.push({
        id: user.id,
        name: typeof user.name === 'string' && user.name ? user.name.slice(0, 80) : '房间玩家',
      });
    }
  }
  return {
    volume: typeof saved.volume === 'number' && Number.isFinite(saved.volume)
      ? Math.round(Math.min(120, Math.max(0, saved.volume))) : 100,
    blockAll: saved.blockAll === true,
    blockedUsers,
  };
}

export function readSettings(key, storage) {
  try {
    return normalizeSettings(JSON.parse((storage ?? globalThis.localStorage).getItem(key)));
  } catch {
    return normalizeSettings(null);
  }
}

export function writeSettings(key, value, storage) {
  const settings = normalizeSettings(value);
  (storage ?? globalThis.localStorage).setItem(key, JSON.stringify(settings));
  return settings;
}
