import { readSettings, settingsKey, writeSettings } from './settings.js';
import './settings.css';

export function registerSettingsPanel(OBR) {
  document.body.style.margin = '0';
  const panel = document.createElement('main');
  panel.className = 'fvtt-lolping-settings';
  panel.innerHTML = `
    <h1>信号设置</h1>
    <p class="fvtt-lolping-settings-hint">仅影响你在当前房间接收的信号。</p>
    <form>
      <fieldset id="preferences" disabled>
        <div class="fvtt-lolping-settings-volume-label">
          <label for="volume">信号音量</label><output id="volume-value" for="volume">100%</output>
        </div>
        <input id="volume" type="range" min="0" max="120" step="1" value="100" list="volume-ticks" aria-describedby="volume-hint" />
        <datalist id="volume-ticks"><option value="100" label="100%"></option></datalist>
        <div class="fvtt-lolping-settings-volume-scale"><span>0%</span><span>100%</span><span>120%</span></div>
        <p id="volume-hint" class="fvtt-lolping-settings-hint">默认 100%，对应原版音量的 80%。0% 静音，标记照常显示。</p>
        <label class="fvtt-lolping-settings-row">
          <input id="block-all" type="checkbox" />
          <span>屏蔽其他所有人的信号</span>
        </label>
        <p class="fvtt-lolping-settings-hint">屏蔽后，同时隐藏信号标记和提示音。</p>
        <fieldset id="users">
          <legend>屏蔽指定用户</legend>
          <p class="fvtt-lolping-settings-hint">勾选要屏蔽的用户。</p>
          <div id="player-list"></div>
        </fieldset>
      </fieldset>
    </form>
    <p class="fvtt-lolping-settings-hint">自动保存到此浏览器。自己的信号仍正常发送和显示。</p>
    <p id="settings-status" role="status">正在读取设置…</p>`;
  document.body.append(panel);
  const form = panel.querySelector('form');
  const preferences = panel.querySelector('#preferences');
  const volume = panel.querySelector('#volume');
  const volumeValue = panel.querySelector('#volume-value');
  const blockAll = panel.querySelector('#block-all');
  const users = panel.querySelector('#users');
  const list = panel.querySelector('#player-list');
  const status = panel.querySelector('#settings-status');
  const unsubscribers = [];
  let key;
  let settings;
  let party = [];
  let closed = false;
  let draggingVolume = false;

  function renderUsers() {
    const available = new Map(party.filter(user => user.id !== OBR.player.id).map(user => [user.id, user]));
    for (const user of settings.blockedUsers) {
      if (user.id !== OBR.player.id && !available.has(user.id)) available.set(user.id, { ...user, offline: true });
    }
    list.replaceChildren();
    if (!available.size) {
      const empty = document.createElement('p');
      empty.className = 'fvtt-lolping-settings-hint';
      empty.textContent = '当前没有其他用户。';
      list.append(empty);
    }
    for (const user of available.values()) {
      const row = document.createElement('label');
      row.className = 'fvtt-lolping-settings-row';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.userId = user.id;
      checkbox.dataset.userName = user.name || '房间玩家';
      checkbox.checked = settings.blockedUsers.some(blocked => blocked.id === user.id);
      const name = document.createElement('span');
      name.textContent = `${user.name || '房间玩家'}${user.offline ? '（已离线）' : ''}`;
      row.append(checkbox, name);
      list.append(row);
    }
  }

  function syncControls() {
    volume.value = settings.volume;
    volumeValue.value = `${settings.volume}%`;
    blockAll.checked = settings.blockAll;
    users.disabled = settings.blockAll;
  }

  function save() {
    try {
      settings = writeSettings(key, settings);
      status.textContent = '已自动保存';
    } catch {
      settings = readSettings(key);
      syncControls();
      renderUsers();
      status.textContent = '保存失败：浏览器未允许本地存储。';
    }
  }

  form.addEventListener('submit', event => event.preventDefault());
  volume.addEventListener('pointerdown', () => { draggingVolume = true; });
  volume.addEventListener('pointerup', () => { draggingVolume = false; });
  volume.addEventListener('pointercancel', () => { draggingVolume = false; });
  volume.addEventListener('keydown', () => { draggingVolume = false; });
  volume.addEventListener('blur', () => { draggingVolume = false; });
  volume.addEventListener('input', () => {
    const value = Number(volume.value);
    settings.volume = draggingVolume && Math.abs(value - 100) <= 3 ? 100 : value;
    volume.value = settings.volume;
    volumeValue.value = `${settings.volume}%`;
    save();
  });
  blockAll.addEventListener('change', () => {
    settings.blockAll = blockAll.checked;
    users.disabled = settings.blockAll;
    save();
  });
  list.addEventListener('change', event => {
    const { userId, userName } = event.target.dataset;
    if (!userId || settings.blockAll) return;
    settings.blockedUsers = settings.blockedUsers.filter(user => user.id !== userId);
    if (event.target.checked) settings.blockedUsers.push({ id: userId, name: userName });
    save();
  });

  unsubscribers.push(OBR.onReady(async () => {
    if (closed) return;
    key = settingsKey(OBR.room.id, OBR.player.id);
    settings = readSettings(key);
    syncControls();
    renderUsers();
    preferences.disabled = false;
    status.textContent = '更改后自动保存';
    let partyChanged = false;
    unsubscribers.push(OBR.party.onChange(players => {
      partyChanged = true;
      party = players;
      renderUsers();
    }));
    const storageChanged = event => {
      if (event.key !== key && event.key !== null) return;
      settings = readSettings(key);
      syncControls();
      renderUsers();
    };
    globalThis.addEventListener('storage', storageChanged);
    unsubscribers.push(() => globalThis.removeEventListener('storage', storageChanged));
    try {
      const players = await OBR.party.getPlayers();
      if (closed || partyChanged) return;
      party = players;
      renderUsers();
    } catch {
      if (!closed) status.textContent = '无法读取房间用户，请重新打开设置。';
    }
  }));

  globalThis.addEventListener('pagehide', () => {
    closed = true;
    for (const unsubscribe of unsubscribers) unsubscribe?.();
  }, { once: true });
}
