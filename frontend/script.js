/* ═══════════════════════════════════════════════════
   ZAP — SCRIPT.JS
   All bugs fixed + P2P improvements applied
═══════════════════════════════════════════════════ */

'use strict';

// ── Use relative API origin ────────────────────────
const API = window.location.origin;

// ── Shared state ───────────────────────────────────
let pendingNameAction = null;

/* ═══════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════ */
const themeToggle = document.getElementById('themeToggle');
try {
  if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light');
    themeToggle.checked = true;
  }
} catch {}

themeToggle.addEventListener('change', () => {
  const isLight = themeToggle.checked;
  document.body.classList.toggle('light', isLight);
  try { localStorage.setItem('theme', isLight ? 'light' : 'dark'); } catch {}
});

/* ═══════════════════════════════════════════════════
   NAME BAR
═══════════════════════════════════════════════════ */
function getInitials(name) {
  return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderNameBar(name) {
  document.getElementById('nameAvatar').textContent = getInitials(name);
  document.getElementById('nameLabel').textContent  = name;
}

function startEditName() {
  const current = '';
  try { current || localStorage.getItem('username') || ''; } catch {}
  let stored = '';
  try { stored = localStorage.getItem('username') || ''; } catch {}
  document.getElementById('nameInput').value = stored;
  document.getElementById('nameError').textContent = '';
  document.getElementById('nameDisplay').style.display = 'none';
  document.getElementById('nameEdit').style.display    = 'flex';
  document.getElementById('nameInput').focus();
  document.getElementById('nameCancelBtn').style.display = stored ? '' : 'none';
}

function cancelEditName() {
  document.getElementById('nameEdit').style.display    = 'none';
  document.getElementById('nameDisplay').style.display = '';
  pendingNameAction = null;
}

function saveName() {
  const val = document.getElementById('nameInput').value.trim();
  if (val.length < 2) {
    document.getElementById('nameError').textContent = 'Name must be at least 2 characters.';
    return;
  }
  let isFirst = false;
  try { isFirst = !localStorage.getItem('username'); } catch {}
  try { localStorage.setItem('username', val); } catch {}
  renderNameBar(val);
  document.getElementById('nameEdit').style.display    = 'none';
  document.getElementById('nameDisplay').style.display = '';
  document.getElementById('nameError').textContent     = '';
  if (isFirst) {
    document.getElementById('transfer').classList.remove('hidden');
    document.getElementById('transfer').scrollIntoView({ behavior: 'smooth' });
  }
  if (pendingNameAction) {
    const action = pendingNameAction;
    pendingNameAction = null;
    action();
  }
}

document.getElementById('nameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter')  saveName();
  if (e.key === 'Escape') cancelEditName();
});

// Init name
(function initName() {
  let saved = '';
  try { saved = localStorage.getItem('username') || ''; } catch {}
  if (saved) {
    renderNameBar(saved);
    document.getElementById('transfer').classList.remove('hidden');
  } else {
    document.getElementById('nameDisplay').style.display = 'none';
    document.getElementById('nameEdit').style.display    = 'flex';
    document.getElementById('nameCancelBtn').style.display = 'none';
  }
})();

function scrollToUser() {
  const transfer = document.getElementById('transfer');
  let saved = '';
  try { saved = localStorage.getItem('username') || ''; } catch {}
  if (!saved) {
    transfer.classList.remove('hidden');
    transfer.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => startEditName(), 350);
  } else {
    transfer.scrollIntoView({ behavior: 'smooth' });
  }
}

/* ═══════════════════════════════════════════════════
   ENCRYPTION
═══════════════════════════════════════════════════ */
let appCryptoKey = null;

async function initEncryption() {
  if (appCryptoKey) return;
  try {
    const res = await fetch(`${API}/api/encryption-key`);
    if (!res.ok) throw new Error('Encryption key fetch failed');
    const { keyHex } = await res.json();
    const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
    appCryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    );
  } catch (e) {
    console.error('[Encryption] init failed:', e);
    throw e;
  }
}

/* ═══════════════════════════════════════════════════
   CLOUD SESSION CACHE
═══════════════════════════════════════════════════ */
function loadCloudSessions() {
  try {
    const raw = localStorage.getItem('myCloudRooms');
    if (!raw) return [];
    let data = JSON.parse(raw);
    data = data.filter(r => Date.now() < r.expiresAt);
    try { localStorage.setItem('myCloudRooms', JSON.stringify(data)); } catch {}
    return data;
  } catch { return []; }
}

function saveCloudSession(code, adminToken, expiresAt, link) {
  const rooms = loadCloudSessions();
  if (!rooms.find(r => r.code === code)) rooms.push({ code, adminToken, expiresAt, link });
  try { localStorage.setItem('myCloudRooms', JSON.stringify(rooms)); } catch {}
}

function removeCloudSession(code) {
  let rooms = loadCloudSessions();
  rooms = rooms.filter(r => r.code !== code);
  try { localStorage.setItem('myCloudRooms', JSON.stringify(rooms)); } catch {}
}

const TRASH_SVG = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.3093 2.24996H13.6907C13.9071 2.24982 14.0956 2.2497 14.2736 2.27813C14.9769 2.39043 15.5855 2.82909 15.9145 3.46078C15.9978 3.62067 16.0573 3.79955 16.1256 4.00488L16.2372 4.33978C16.2561 4.39647 16.2615 4.41252 16.266 4.42516C16.4412 4.90927 16.8952 5.23653 17.4098 5.24958C17.4234 5.24992 17.4399 5.24998 17.5 5.24998H20.5C20.9142 5.24998 21.25 5.58576 21.25 5.99998C21.25 6.41419 20.9142 6.74998 20.5 6.74998H3.49991C3.08569 6.74998 2.74991 6.41419 2.74991 5.99998C2.74991 5.58576 3.08569 5.24998 3.49991 5.24998H6.49999C6.56004 5.24998 6.57661 5.24992 6.59014 5.24958C7.10479 5.23653 7.55881 4.90929 7.73393 4.42518C7.73854 4.41245 7.74383 4.39675 7.76282 4.33978L7.87443 4.0049C7.94272 3.79958 8.00223 3.62067 8.08549 3.46078C8.41444 2.82909 9.02304 2.39043 9.72634 2.27813C9.90436 2.2497 10.0929 2.24982 10.3093 2.24996ZM9.00806 5.24998C9.05957 5.14895 9.10521 5.04398 9.14448 4.93542C9.15641 4.90245 9.1681 4.86736 9.18313 4.82228L9.28293 4.52286C9.3741 4.24935 9.39509 4.19357 9.41592 4.15358C9.52557 3.94301 9.72843 3.7968 9.96287 3.75936C10.0074 3.75225 10.0669 3.74998 10.3553 3.74998H13.6447C13.933 3.74998 13.9926 3.75225 14.0371 3.75936C14.2716 3.7968 14.4744 3.94301 14.5841 4.15358C14.6049 4.19357 14.6259 4.24934 14.7171 4.52286L14.8168 4.8221L14.8555 4.93544C14.8948 5.04399 14.9404 5.14896 14.9919 5.24998H9.00806Z" fill="currentColor"/><path d="M5.915 8.45009C5.88744 8.03679 5.53007 7.72409 5.11677 7.75164C4.70347 7.77919 4.39077 8.13657 4.41832 8.54987L4.88177 15.5016C4.96726 16.7843 5.03633 17.8205 5.1983 18.6336C5.3667 19.4789 5.65312 20.1849 6.24471 20.7384C6.83631 21.2919 7.55985 21.5307 8.41451 21.6425C9.23653 21.75 10.275 21.75 11.5605 21.75H12.4394C13.725 21.75 14.7635 21.75 15.5855 21.6425C16.4401 21.5307 17.1637 21.2919 17.7553 20.7384C18.3469 20.1849 18.6333 19.4789 18.8017 18.6336C18.9637 17.8205 19.0327 16.7844 19.1182 15.5016L19.5817 8.54987C19.6092 8.13657 19.2965 7.77919 18.8832 7.75164C18.4699 7.72409 18.1125 8.03679 18.085 8.45009L17.625 15.3492C17.5352 16.6971 17.4712 17.6349 17.3306 18.3405C17.1942 19.0249 17.0039 19.3872 16.7305 19.643C16.4571 19.8988 16.0829 20.0646 15.3909 20.1552C14.6775 20.2485 13.7375 20.25 12.3867 20.25H11.6133C10.2625 20.25 9.32246 20.2485 8.60906 20.1552C7.91706 20.0646 7.5429 19.8988 7.26949 19.643C6.99607 19.3872 6.80574 19.0249 6.66939 18.3405C6.52882 17.6349 6.4648 16.6971 6.37494 15.3492L5.915 8.45009Z" fill="currentColor"/><path d="M9.42537 10.2537C9.83753 10.2125 10.2051 10.5132 10.2463 10.9253L10.7463 15.9253C10.7875 16.3375 10.4868 16.705 10.0746 16.7463C9.66247 16.7875 9.29494 16.4868 9.25372 16.0746L8.75372 11.0746C8.71251 10.6624 9.01321 10.2949 9.42537 10.2537Z" fill="currentColor"/><path d="M14.5746 10.2537C14.9868 10.2949 15.2875 10.6624 15.2463 11.0746L14.7463 16.0746C14.7051 16.4868 14.3375 16.7875 13.9254 16.7463C13.5132 16.705 13.2125 16.3375 13.2537 15.9253L13.7537 10.9253C13.7949 10.5132 14.1625 10.2125 14.5746 10.2537Z" fill="currentColor"/></svg>`;

function renderActiveRooms() {
  const rooms = loadCloudSessions();
  const badge = document.getElementById('roomsBadge');
  const list  = document.getElementById('activeRoomsList');
  if (badge) badge.textContent = rooms.length;
  if (!list) return;
  if (!rooms.length) {
    list.innerHTML = '<div class="rooms-empty">No active rooms</div>';
    return;
  }
  list.innerHTML = rooms.map(r => {
    const remaining = r.expiresAt - Date.now();
    const hrs  = Math.floor(remaining / 3600000);
    const mins = Math.floor((remaining % 3600000) / 60000);
    const timeStr = remaining <= 0 ? 'expired' : hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
    return `
      <div class="room-item" id="ri-${r.code}">
        <div class="room-dot"></div>
        <div class="room-info">
          <span class="room-code">${r.code}</span>
          <span class="room-meta" data-expires="${r.expiresAt}">${timeStr}</span>
        </div>
        <div class="room-actions">
          <button class="btn-open" onclick="window.location.href='${r.link}'">Open</button>
          <button class="btn-delete" title="Delete" onclick="deleteCloudRoom('${r.code}','${r.adminToken}')">${TRASH_SVG}</button>
        </div>
      </div>`;
  }).join('');
}

// Live timer for active rooms — runs every 30s (not 60s to catch near-expiry sooner)
setInterval(() => {
  let expired = false;
  document.querySelectorAll('.room-meta[data-expires]').forEach(el => {
    const exp = parseInt(el.dataset.expires);
    if (Date.now() >= exp) { expired = true; return; }
    const rem  = exp - Date.now();
    const hrs  = Math.floor(rem / 3600000);
    const mins = Math.floor((rem % 3600000) / 60000);
    el.textContent = hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
  });
  if (expired) renderActiveRooms();
}, 30000);

window.deleteCloudRoom = async function(code, token) {
  // Inline confirmation instead of confirm()
  const el = document.getElementById('ri-' + code);
  if (!el) return;
  const btn = el.querySelector('.btn-delete');
  const orig = btn.innerHTML;
  btn.innerHTML = '<span style="font-size:0.6rem;color:#ef4444;font-family:var(--font-mono)">Sure?</span>';
  btn.style.width = '48px';
  const reset = () => { btn.innerHTML = orig; btn.style.width = ''; };
  btn.onclick = async () => {
    try {
      const res = await fetch(`${API}/api/room/${code}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Deletion failed');
      removeCloudSession(code);
      el.style.opacity = '0'; el.style.transform = 'translateY(-4px)';
      setTimeout(() => renderActiveRooms(), 200);
      if (cloudRoomCode_active === code) exitCloudRoom();
    } catch { showToast('Failed to delete room'); reset(); }
  };
  setTimeout(reset, 3000);
};

let cloudRoomCode_active = null;

/* ═══════════════════════════════════════════════════
   CLOUD DROP ZONE
═══════════════════════════════════════════════════ */
const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filesList = document.getElementById('filesList');
const dzInner   = document.getElementById('dzInner');
const uploadBtn = document.getElementById('uploadBtn');

let uploadedFiles = [];
let isUploading   = false;
const MAX_FILES   = 10;
const MAX_SIZE    = 2 * 1024 * 1024 * 1024; // 2 GB

dropZone.addEventListener('click', (e) => {
  if (isUploading) return;
  if (e.target.closest('.file-pill')) return;
  fileInput.click();
});
fileInput.addEventListener('change', () => { handleFiles([...fileInput.files]); fileInput.value = ''; });
['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('drag-over'); }));
['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('drag-over'); }));
dropZone.addEventListener('drop', e => {
  if (e.dataTransfer?.files.length) handleFiles([...e.dataTransfer.files]);
  spawnRipple(e, dropZone);
});

function spawnRipple(e, zone) {
  const rect = zone.getBoundingClientRect();
  const r = document.createElement('div');
  r.className = 'dz-ripple';
  const size = Math.max(rect.width, rect.height);
  r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
  zone.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
}

function handleFiles(files) {
  if (isUploading) return;
  let rejected = 0;
  files.forEach(file => {
    if (uploadedFiles.length >= MAX_FILES) { rejected++; return; }
    if (file.size > MAX_SIZE) { showToast(`${file.name} exceeds 2 GB limit`); return; }
    if (uploadedFiles.find(f => f.name === file.name && f.size === file.size)) return;
    uploadedFiles.push(file);
    renderPill(file, filesList, uploadedFiles, pillMap, () => toggleUI());
  });
  if (rejected) showToast(`Max ${MAX_FILES} files allowed`);
  toggleUI();
}

function toggleUI() {
  const has = uploadedFiles.length > 0;
  uploadBtn.classList.toggle('visible', has);
  if (!has) document.getElementById('shareLinkRow').classList.add('hidden');
}

function getExt(name) { const p = name.split('.'); return p.length > 1 ? p.pop().slice(0,4) : '?'; }
function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b/1048576).toFixed(1) + ' MB';
  return (b/1073741824).toFixed(2) + ' GB';
}

const pillMap = new WeakMap();

function renderPill(file, list, filesArr, map, onRemove) {
  const pill    = document.createElement('div');    pill.className = 'file-pill';
  const icon    = document.createElement('div');    icon.className = 'file-icon'; icon.textContent = getExt(file.name);
  const info    = document.createElement('div');    info.className = 'file-info';
  const nameEl  = document.createElement('div');    nameEl.className = 'file-name'; nameEl.textContent = file.name;
  const meta    = document.createElement('div');    meta.className = 'file-meta';
  const sizeEl  = document.createElement('span');   sizeEl.textContent = formatBytes(file.size);
  const pgWrap  = document.createElement('div');    pgWrap.className = 'file-prog-wrap';
  const pgBar   = document.createElement('div');    pgBar.className = 'file-prog-bar';
  pgWrap.appendChild(pgBar); meta.appendChild(sizeEl); meta.appendChild(pgWrap);
  info.appendChild(nameEl);  info.appendChild(meta);
  const rmBtn = document.createElement('button');
  rmBtn.className = 'file-remove'; rmBtn.title = 'Remove';
  rmBtn.innerHTML = `<svg style="pointer-events:none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  pill.append(icon, info, rmBtn);
  list.appendChild(pill);
  map.set(file, { pill, pgBar });
  rmBtn.addEventListener('click', e => {
    e.stopPropagation();
    const idx = filesArr.indexOf(file);
    if (idx > -1) filesArr.splice(idx, 1);
    pill.style.transition = 'opacity 0.18s, transform 0.18s';
    pill.style.opacity = '0'; pill.style.transform = 'translateY(-4px) scale(0.97)';
    setTimeout(() => { pill.remove(); if (onRemove) onRemove(); }, 180);
  });
}

function setPillProgress(map, file, pct) { const e = map.get(file); if (e) e.pgBar.style.width = pct + '%'; }
function setPillDone(map, file)  { const e = map.get(file); if (e) { e.pgBar.style.width='100%'; e.pgBar.style.background='#34A853'; } }
function setPillError(map, file) { const e = map.get(file); if (e) { e.pgBar.style.background='#ef4444'; e.pgBar.style.width='100%'; } }

function xhrUpload(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
    xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) onProgress(Math.round(e.loaded/e.total*100)); });
    xhr.onload = () => {
      if (xhr.status < 300) {
        const rawEtag = xhr.getResponseHeader('ETag') || '"fallback"';
        // FIX #41: Strip quotes from ETag for multipart completion
        resolve({ etag: rawEtag.replace(/"/g, '') });
      } else {
        const msg = xhr.responseText ? `${xhr.status}: ${xhr.responseText}` : `Upload failed (HTTP ${xhr.status})`;
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(blob);
  });
}

/* ═══════════════════════════════════════════════════
   PANEL TABS
═══════════════════════════════════════════════════ */
const panelTabIdx = { create: 0, join: 1, rooms: 2 };
window.switchPanelTab = function(tab) {
  const i = panelTabIdx[tab];
  if (i === undefined) return;
  document.getElementById('tabSlider').style.transform = `translateX(${i * 100}%)`;
  ['Create','Join','Rooms'].forEach((n, j) => {
    document.getElementById('tab'+n)?.classList.toggle('active', j === i);
    document.getElementById('view'+n)?.classList.toggle('active', j === i);
  });
  if (tab === 'rooms') renderActiveRooms();
};

/* ═══════════════════════════════════════════════════
   EXPIRY SLIDER
═══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const slider = document.getElementById('expirySlider');
  const numEl  = document.getElementById('expiryNum');
  const fill   = document.getElementById('trackFill');
  if (!slider) return;
  function updateSlider(v) {
    v = parseInt(v);
    if (numEl) numEl.textContent = v;
    // FIX #28: range is 1-24, so 23 steps
    if (fill) fill.style.width = ((v - 1) / 23 * 100) + '%';
  }
  slider.addEventListener('input', () => updateSlider(slider.value));
  updateSlider(4);
  renderActiveRooms();

  // FIX #47: Re-position mode tab slider after fonts load
  document.fonts.ready.then(() => {
    const active = document.querySelector('.mode-tab.active');
    if (active) positionSlider(active);
  });
});

/* ═══════════════════════════════════════════════════
   CLOUD ROOM CREATE / JOIN
═══════════════════════════════════════════════════ */
async function initCloudRoom() {
  let name = '';
  try { name = localStorage.getItem('username') || ''; } catch {}
  if (!name) { pendingNameAction = () => initCloudRoom(); startEditName(); return; }

  const sliderVal = document.getElementById('expirySlider')?.value ?? '4';
  // FIX #29: Use Number() consistently
  const expiry = Number(sliderVal) * 3600;

  const btn = document.querySelector('#viewCreate .btn-primary');
  if (btn) { btn.textContent = 'Creating…'; btn.disabled = true; }
  try {
    const res = await fetch(`${API}/api/room/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, expiry }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create room');
    const { code, adminToken, expiresAt } = await res.json();
    cloudRoomCode_active = code;
    const link = `${window.location.origin}${window.location.pathname}?room=${code}`;
    saveCloudSession(code, adminToken, expiresAt, link);
    try { localStorage.setItem('activeCloudUpload', JSON.stringify({ code, expiresAt, link })); } catch {}
    showCloudRoomActive(code, expiresAt, link);
  } catch (err) {
    showToast(err.message || 'Failed to create room');
  } finally {
    if (btn) { btn.textContent = 'Create room'; btn.disabled = false; }
  }
}

function showCloudRoomActive(code, expiresAt, link) {
  cloudRoomCode_active = code;
  document.getElementById('cloudRoomCode').textContent = code;
  document.getElementById('cloudRoomExpiry').textContent = formatTimeRemaining(expiresAt - Date.now());
  document.getElementById('shareLink').value = link;
  document.getElementById('shareLinkRow').classList.remove('hidden');
  document.getElementById('cloudSetup').classList.add('hidden');
  document.getElementById('cloudRoomActive').classList.remove('hidden');
}

function joinCloudRoom() {
  const code = document.getElementById('joinCloudCode').value.trim().toUpperCase();
  const errEl = document.getElementById('joinCodeError');
  // FIX #26: validate full 6 chars, show error
  if (code.length < 6) {
    errEl.classList.remove('hidden');
    document.getElementById('joinCloudCode').focus();
    return;
  }
  errEl.classList.add('hidden');
  history.replaceState(null, '', `?room=${code}`);
  loadDownloadView(code);
}

document.getElementById('joinCloudCode').addEventListener('input', () => {
  document.getElementById('joinCodeError').classList.add('hidden');
});
document.getElementById('joinCloudCode').addEventListener('keydown', e => {
  if (e.key === 'Enter') joinCloudRoom();
});

/* ═══════════════════════════════════════════════════
   CLOUD UPLOAD
═══════════════════════════════════════════════════ */
uploadBtn.addEventListener('click', async () => {
  // FIX #36: Show message if no room active
  if (!cloudRoomCode_active) { showToast('Create a room first'); return; }
  if (uploadedFiles.length === 0 || isUploading) return;

  uploadBtn.textContent = 'Encrypting & Uploading…';
  uploadBtn.disabled = true;
  isUploading = true;

  try {
    await initEncryption();
    const CHUNK_SIZE = 5 * 1024 * 1024;

    for (const file of uploadedFiles) {
      const numChunks   = Math.ceil(file.size / CHUNK_SIZE) || 1;
      const totalBlobSize = file.size + numChunks * 28; // IV(12) + tag(16) per chunk

      const urlRes = await fetch(`${API}/api/room/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cloudRoomCode_active, fileName: file.name, fileSize: totalBlobSize, contentType: file.type || 'application/octet-stream' }),
      });
      if (!urlRes.ok) throw new Error((await urlRes.json()).error || 'Failed to init upload');

      const { fileId, uploadUrls, uploadMethod, uploadId } = await urlRes.json();

      if (uploadMethod === 'multipart') {
        const parts = [];
        let uploadedBytes = 0;
        for (let i = 0; i < numChunks; i++) {
          const slice = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const plain = await slice.arrayBuffer();
          const iv    = crypto.getRandomValues(new Uint8Array(12));
          const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, appCryptoKey, plain);
          const blob   = new Blob([iv, cipher], { type: 'application/octet-stream' });
          const { etag } = await xhrUpload(uploadUrls[i], blob, partPct => {
            const total = Math.round(((uploadedBytes + blob.size * partPct / 100) / totalBlobSize) * 100);
            setPillProgress(pillMap, file, total);
          });
          uploadedBytes += blob.size;
          parts.push({ partNumber: i + 1, etag });
        }
        await fetch(`${API}/api/room/upload-complete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: cloudRoomCode_active, fileId, fileName: file.name, fileSize: totalBlobSize, uploadId, parts }),
        });
      } else {
        const iv     = crypto.getRandomValues(new Uint8Array(12));
        const plain  = await file.arrayBuffer();
        const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, appCryptoKey, plain);
        const blob   = new Blob([iv, cipher], { type: file.type || 'application/octet-stream' });
        await xhrUpload(uploadUrls[0], blob, pct => setPillProgress(pillMap, file, pct));
        await fetch(`${API}/api/room/upload-complete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: cloudRoomCode_active, fileId, fileName: file.name, fileSize: blob.size }),
        });
      }
      setPillDone(pillMap, file);
    }

    uploadBtn.textContent = '✓ Uploaded';
    uploadBtn.style.background = '#22c55e';
    uploadBtn.style.color = '#000';
    setTimeout(() => {
      try { localStorage.removeItem('activeCloudUpload'); } catch {}
      loadDownloadView(cloudRoomCode_active);
    }, 1000);
    setTimeout(() => {
      uploadBtn.textContent = 'Upload Files';
      uploadBtn.style.background = '';
      uploadBtn.style.color = '';
      uploadBtn.disabled = false;
      isUploading = false;
    }, 3000);
  } catch (err) {
    uploadedFiles.forEach(f => setPillError(pillMap, f));
    uploadBtn.textContent = err.message || 'Upload failed';
    uploadBtn.style.background = '#ef4444';
    setTimeout(() => {
      uploadBtn.textContent = 'Upload Files';
      uploadBtn.style.background = '';
      uploadBtn.disabled = false;
      isUploading = false; // FIX #38: always reset isUploading
    }, 3000);
  }
});

function exitCloudRoom() {
  try { localStorage.removeItem('activeCloudUpload'); } catch {}
  cloudRoomCode_active = null;
  uploadedFiles = [];
  isUploading   = false; // FIX #38
  filesList.innerHTML = '';
  uploadBtn.classList.remove('visible');
  uploadBtn.disabled = false;
  document.getElementById('shareLinkRow').classList.add('hidden');
  document.getElementById('cloudRoomActive').classList.add('hidden');
  document.getElementById('cloudSetup').classList.remove('hidden');
  renderActiveRooms();
  history.replaceState(null, '', window.location.pathname);
}

/* ═══════════════════════════════════════════════════
   DOWNLOAD VIEW
═══════════════════════════════════════════════════ */
function formatTimeRemaining(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `Expires in ${h}h ${m}m`;
  return `Expires in ${m}m`;
}

async function loadDownloadView(code) {
  switchMode('upload');
  document.getElementById('tabGroup').style.display = 'none';
  document.getElementById('uploadContainer').classList.add('hidden');
  document.getElementById('downloadContainer').classList.remove('hidden');
  document.getElementById('dlRoomName').textContent = 'Loading…';
  document.getElementById('dlFilesList').innerHTML = '';

  try {
    const res = await fetch(`${API}/api/room/${code}`);
    if (!res.ok) { document.getElementById('dlRoomName').textContent = 'Room not found or expired'; return; }
    const room = await res.json();

    document.getElementById('dlRoomName').textContent = `${room.name}'s files`;
    document.getElementById('dlRoomMeta').textContent = `${room.files.length} file${room.files.length !== 1 ? 's' : ''} · ${formatTimeRemaining(room.timeRemaining)}`;

    const list = document.getElementById('dlFilesList');
    if (!room.files.length) { list.innerHTML = '<p class="dl-empty">No files uploaded yet.</p>'; return; }

    room.files.forEach(file => {
      const row   = document.createElement('div'); row.className = 'dl-file-row';
      const left  = document.createElement('div'); left.className = 'dl-file-left';
      const icon  = document.createElement('div'); icon.className = 'file-icon'; icon.textContent = getExt(file.name);
      const info  = document.createElement('div'); info.className = 'file-info';
      const nameEl = document.createElement('div'); nameEl.className = 'file-name'; nameEl.textContent = file.name;
      const metaEl = document.createElement('div'); metaEl.className = 'file-meta';
      const szEl   = document.createElement('span'); szEl.textContent = formatBytes(file.size);
      metaEl.appendChild(szEl); info.append(nameEl, metaEl); left.append(icon, info);

      const dlBtn = document.createElement('button');
      dlBtn.className = 'dl-btn';
      dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download`;

      dlBtn.onclick = async () => {
        dlBtn.style.pointerEvents = 'none';
        try {
          await initEncryption();

          // FIX #42: Warn for large files on non-Chromium
          if (file.size > 500 * 1024 * 1024 && !window.showSaveFilePicker) {
            showToast('Large file — may use significant memory on this browser');
          }

          let writable = null;
          let plainChunks = [];
          if (window.showSaveFilePicker) {
            try {
              const handle = await window.showSaveFilePicker({ suggestedName: file.name });
              writable = await handle.createWritable();
            } catch (err) {
              if (err.name === 'AbortError') { dlBtn.style.pointerEvents = 'auto'; return; }
            }
          }

          dlBtn.innerHTML = `Decrypting… 0%`;
          const res = await fetch(`${API}/api/room/${code}/download/${file.id}`);
          if (!res.ok) throw new Error('Download failed');

          const totalSize = parseInt(res.headers.get('Content-Length')) || file.size || 0;
          let received = 0;
          const reader = res.body.getReader();
          const CHUNK = 5 * 1024 * 1024 + 28;
          let buffer = new Uint8Array(0);

          while (true) {
            const { done, value } = await reader.read();
            if (value) {
              received += value.length;
              const pct = totalSize ? Math.round(received / totalSize * 100) : 0;
              dlBtn.innerHTML = `Decrypting… ${pct}%`;
              const nb = new Uint8Array(buffer.length + value.length);
              nb.set(buffer); nb.set(value, buffer.length); buffer = nb;
              while (buffer.length >= CHUNK) {
                const chunk  = buffer.slice(0, CHUNK); buffer = buffer.slice(CHUNK);
                const iv     = chunk.slice(0, 12);
                const cipher = chunk.slice(12);
                const plain  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, appCryptoKey, cipher);
                if (writable) await writable.write(plain); else plainChunks.push(plain);
              }
            }
            if (done) {
              if (buffer.length > 0) {
                const iv    = buffer.slice(0, 12);
                const cipher = buffer.slice(12);
                const plain  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, appCryptoKey, cipher);
                if (writable) await writable.write(plain); else plainChunks.push(plain);
              }
              break;
            }
          }

          if (writable) {
            await writable.close();
          } else {
            const blob = new Blob(plainChunks, { type: 'application/octet-stream' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a'); a.href = url; a.download = file.name; a.click();
            URL.revokeObjectURL(url);
          }
          dlBtn.innerHTML = `✓ Downloaded`;
        } catch (err) {
          console.error('[Download]', err);
          dlBtn.innerHTML = `✗ Error`;
        }
        setTimeout(() => {
          dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download`;
          dlBtn.style.pointerEvents = 'auto';
        }, 3000);
      };

      row.append(left, dlBtn);
      list.appendChild(row);
    });
  } catch { document.getElementById('dlRoomName').textContent = 'Failed to load room'; }
}

function exitDownloadView() {
  history.replaceState(null, '', window.location.pathname);
  document.getElementById('tabGroup').style.display = '';  // FIX #8: restore to '' not 'flex'
  document.getElementById('downloadContainer').classList.add('hidden');
  document.getElementById('uploadContainer').classList.remove('hidden');
}

/* ═══════════════════════════════════════════════════
   MODE TABS (P2P / Cloud)
═══════════════════════════════════════════════════ */
const modeTabs = document.querySelectorAll('.mode-tab');
const slider   = document.getElementById('slider');

function positionSlider(activeTab) {
  const groupRect = document.getElementById('tabGroup').getBoundingClientRect();
  const tabRect   = activeTab.getBoundingClientRect();
  slider.style.left  = (tabRect.left - groupRect.left) + 'px';
  slider.style.width = tabRect.width + 'px';
}

function switchMode(mode) {
  const upload = document.getElementById('uploadContainer');
  const peer   = document.getElementById('peerContainer');
  modeTabs.forEach(t => t.classList.remove('active'));
  const active = document.getElementById(mode === 'peer' ? 'modePeer' : 'modeUpload');
  active.classList.add('active');
  positionSlider(active);
  if (mode === 'peer') { upload.classList.add('hidden'); peer.classList.remove('hidden'); }
  else                 { upload.classList.remove('hidden'); peer.classList.add('hidden'); }
}

window.addEventListener('resize', () => {
  const a = document.querySelector('.mode-tab.active');
  if (a) positionSlider(a);
});

/* ═══════════════════════════════════════════════════
   P2P — STATE
═══════════════════════════════════════════════════ */
let p2pFiles             = [];
let p2pWs                = null;
let p2pConnection        = null;   // RTCPeerConnection
let p2pDataChannel       = null;   // RTCDataChannel
let p2pRoomId            = null;
let p2pMyClientId        = null;
let p2pPeerId            = null;
let p2pIsSender          = false;
let p2pAccepted          = false;
let p2pAcceptPending     = false;
let p2pHandshakeStarted  = false;
let p2pConnectedReceivers = 0;
let p2pRemoteDescSet     = false;
let p2pIceCandidateQueue = [];
let p2pIceSendQueue      = [];     // queued before roomId known
let p2pStatsInterval     = null;
let p2pCurrentMeta       = null;
let p2pChunks            = [];
let p2pReceived          = 0;
let p2pWritableStream    = null;
let p2pSenderFileAcceptResolver = null;
let p2pRtcConfig         = null;   // filled once /api/turn-credentials responds

// Speed tracking
let p2pSpeedSamples = [];
let p2pLastBytes    = 0;
let p2pLastTime     = Date.now();

const p2pDropZone  = document.getElementById('p2pDropZone');
const p2pFileInput = document.getElementById('p2pFileInput');
const p2pFilesList = document.getElementById('p2pFilesList');
const p2pCreateBtn = document.getElementById('p2pCreateBtn');
const p2pPillMap   = new WeakMap();

p2pDropZone.addEventListener('click', e => {
  if (e.target.closest('.file-pill')) return;
  p2pFileInput.click();
});
p2pFileInput.addEventListener('change', () => { handleP2PFiles([...p2pFileInput.files]); p2pFileInput.value = ''; });
['dragenter','dragover'].forEach(ev => p2pDropZone.addEventListener(ev, e => { e.preventDefault(); p2pDropZone.classList.add('drag-over'); }));
['dragleave','drop'].forEach(ev => p2pDropZone.addEventListener(ev, e => { e.preventDefault(); p2pDropZone.classList.remove('drag-over'); }));
p2pDropZone.addEventListener('drop', e => { if (e.dataTransfer?.files.length) handleP2PFiles([...e.dataTransfer.files]); });

function handleP2PFiles(files) {
  files.forEach(file => {
    if (p2pFiles.find(f => f.name === file.name && f.size === file.size)) return;
    p2pFiles.push(file);
    renderPill(file, p2pFilesList, p2pFiles, p2pPillMap, () => toggleP2PUI());
  });
  toggleP2PUI();
}

function toggleP2PUI() {
  p2pCreateBtn.classList.toggle('visible', p2pFiles.length > 0);
}

/* ── WebSocket helpers ────────────────────────────── */
function wsSend(msg) {
  if (p2pWs && p2pWs.readyState === WebSocket.OPEN) {
    p2pWs.send(JSON.stringify(msg));
  } else {
    console.warn('[P2P] wsSend dropped — socket not open:', msg.type);
  }
}

function sendSignal(signalType, signalData) {
  if (!p2pRoomId) {
    console.error('[P2P] sendSignal called without roomId for', signalType); return;
  }
  const targetId = p2pPeerId || '*';
  wsSend({ type: 'signal', roomId: p2pRoomId, data: { targetId, signalType, signalData } });
}

/* ── Fetch TURN credentials (cached) ─────────────── */
async function ensureRtcConfig() {
  if (p2pRtcConfig) return p2pRtcConfig;
  try {
    const res = await fetch('/api/turn-credentials');
    const { iceServers } = await res.json();
    p2pRtcConfig = { iceServers };
    console.log('[P2P] TURN/STUN servers loaded:', iceServers.map(s => s.urls).flat());
  } catch {
    p2pRtcConfig = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] };
  }
  return p2pRtcConfig;
}

/* ── Connect WS ───────────────────────────────────── */
function p2pConnect(isSender, onReady) {
  p2pIsSender = isSender;
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  p2pWs = new WebSocket(`${proto}//${location.host}/ws`);

  p2pWs.onopen = () => console.log('[P2P] WS open');

  p2pWs.onerror = () => {
    console.error('[P2P] WS error');
    const errState = document.getElementById('p2pErrorState');
    const errMsg   = document.getElementById('p2pErrorMessage');
    document.getElementById('p2pLoadingState')?.classList.add('hidden');
    if (errMsg) errMsg.textContent = 'Could not connect to server. Is the backend running?';
    errState?.classList.remove('hidden');
  };

  p2pWs.onclose = e => {
    console.log('[P2P] WS closed', e.code, e.reason);
    handleP2PDisconnect();
  };

  p2pWs.onmessage = async ev => {
    const msg = JSON.parse(ev.data);
    console.log('[P2P] ←', msg.type);

    switch (msg.type) {
      case 'connected':
        p2pMyClientId = msg.clientId;
        onReady();
        break;

      case 'room_created':
        p2pRoomId = msg.roomId;
        while (p2pIceSendQueue.length) sendSignal('ice', p2pIceSendQueue.shift());
        const link = `${window.location.origin}${window.location.pathname}?p2p=${p2pRoomId}`;
        document.getElementById('p2pShareLink').value = link;
        QRCode.toCanvas(document.getElementById('p2pQR'), link, { width: 190, margin: 1 }, () => {});
        document.getElementById('p2pFileCount').textContent =
          `${p2pFiles.length} file${p2pFiles.length !== 1 ? 's' : ''} ready`;
        document.getElementById('p2pUploadStep').classList.add('hidden');
        document.getElementById('p2pShareStep').classList.remove('hidden');
        break;

      case 'user_joined':
        if (p2pIsSender && msg.clientId !== p2pMyClientId) {
          if (p2pPeerId || p2pHandshakeStarted) {
            console.warn('[P2P] Blocked duplicate join from:', msg.clientId); break;
          }
          p2pHandshakeStarted = true;
          p2pPeerId = msg.clientId;
          p2pConnectedReceivers++;
          const rc = document.getElementById('p2pReceiverCount');
          if (rc) rc.textContent = `${p2pConnectedReceivers} receiver${p2pConnectedReceivers !== 1 ? 's' : ''} connected`;
          await p2pStartWebRTC(true);
        }
        break;

      case 'user_left':
      case 'user_disconnected':
        if (p2pIsSender && msg.clientId !== p2pMyClientId) {
          p2pConnectedReceivers = Math.max(0, p2pConnectedReceivers - 1);
          const rc = document.getElementById('p2pReceiverCount');
          if (rc) rc.textContent = p2pConnectedReceivers > 0 ? `${p2pConnectedReceivers} receiver${p2pConnectedReceivers !== 1 ? 's' : ''} connected` : '';
          handleP2PDisconnect();
        }
        break;

      case 'room_joined': {
        const meta = msg.room?.metadata || {};
        const sn = document.getElementById('p2pSenderName');
        const fc = document.getElementById('p2pReceiveFileCount');
        if (sn) sn.textContent = meta.userName ? `${meta.userName}'s files` : 'Incoming files';
        if (fc) fc.textContent = meta.files ? `${meta.files.length} file${meta.files.length !== 1 ? 's' : ''}` : '';
        renderReceiveFileList(meta.files || []);
        document.getElementById('p2pLoadingState').classList.add('hidden');
        document.getElementById('p2pUploadStep').classList.add('hidden');
        document.getElementById('p2pReceiveStep').classList.remove('hidden');
        break;
      }

      case 'signal':
        if (p2pPeerId && p2pPeerId !== msg.fromId) {
          console.warn('[P2P] Signal from unknown peer ignored:', msg.fromId); break;
        }
        p2pPeerId = p2pPeerId || msg.fromId;
        if      (msg.signalType === 'offer')  await p2pHandleOffer(msg.signalData);
        else if (msg.signalType === 'answer') await p2pHandleAnswer(msg.signalData);
        else if (msg.signalType === 'ice')    await p2pHandleIce(msg.signalData);
        break;

      case 'error':
        console.error('[P2P] server error:', msg.message);
        if (!p2pIsSender && document.getElementById('p2pReceiveStep').classList.contains('hidden')) {
          document.getElementById('p2pLoadingState').classList.add('hidden');
          document.getElementById('p2pErrorState').classList.remove('hidden');
          const em = document.getElementById('p2pErrorMessage');
          if (em) em.textContent = msg.message === 'Room not found' ? 'Sender not found.' : msg.message;
        }
        break;
    }
  };
}

/* ── WebRTC setup ─────────────────────────────────── */
async function p2pStartWebRTC(isInitiator) {
  const config = await ensureRtcConfig();
  p2pConnection = new RTCPeerConnection(config);

  p2pConnection.onicecandidate = e => {
    if (!e.candidate) return;
    if (p2pRoomId) sendSignal('ice', e.candidate);
    else p2pIceSendQueue.push(e.candidate);
  };

  p2pConnection.oniceconnectionstatechange = () => {
    const s = p2pConnection.iceConnectionState;
    console.log('[P2P] ICE:', s);
    if (s === 'failed') { console.warn('[P2P] ICE failed — restarting'); p2pConnection.restartIce(); }
    if (s === 'disconnected' || s === 'failed') handleP2PDisconnect();
    updateConnBadges();
  };

  if (isInitiator) {
    p2pDataChannel = p2pConnection.createDataChannel('files', { ordered: true });
    setupSenderChannel();
    const offer = await p2pConnection.createOffer();
    await p2pConnection.setLocalDescription(offer);
    sendSignal('offer', offer);
  } else {
    p2pConnection.ondatachannel = e => { p2pDataChannel = e.channel; setupReceiverChannel(); };
  }

  if (p2pStatsInterval) clearInterval(p2pStatsInterval);
  p2pStatsInterval = setInterval(async () => {
    if (!p2pConnection) return;
    try {
      const stats = await p2pConnection.getStats();
      stats.forEach(r => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded') {
          const isRelay = r.remoteCandidateType === 'relay';
          const rtt     = r.currentRoundTripTime;
          const label   = isRelay
            ? `Relayed · ${rtt ? Math.round(rtt * 1000) + 'ms' : '…'}`
            : `Direct · ${rtt ? Math.round(rtt * 1000) + 'ms' : '…'}`;
          const dotClass = isRelay ? 'conn-relay' : 'conn-direct';
          ['p2pConnBadge','p2pTransferConnBadge'].forEach(id => {
            const badge = document.getElementById(id);
            if (!badge) return;
            badge.classList.remove('hidden'); badge.style.display = '';
            const dot = badge.querySelector('.p2p-conn-dot');
            const lbl = badge.querySelector('[id$="ConnLabel"]') || badge.querySelector('span:last-child');
            if (dot) dot.className = 'p2p-conn-dot ' + dotClass;
            if (lbl) lbl.textContent = label;
          });
        }
      });
    } catch {}
  }, 2500);
}

async function p2pHandleOffer(offer) {
  if (p2pConnection) { try { p2pConnection.close(); } catch {} p2pConnection = null; }
  p2pRemoteDescSet = false; p2pIceCandidateQueue = [];
  await p2pStartWebRTC(false);
  await p2pConnection.setRemoteDescription(new RTCSessionDescription(offer));
  p2pRemoteDescSet = true;
  await p2pFlushIceQueue();
  const answer = await p2pConnection.createAnswer();
  await p2pConnection.setLocalDescription(answer);
  sendSignal('answer', answer);
}

async function p2pHandleAnswer(answer) {
  await p2pConnection.setRemoteDescription(new RTCSessionDescription(answer));
  p2pRemoteDescSet = true;
  await p2pFlushIceQueue();
}

async function p2pHandleIce(candidate) {
  if (!p2pRemoteDescSet) { p2pIceCandidateQueue.push(candidate); return; }
  try { await p2pConnection.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
}

async function p2pFlushIceQueue() {
  while (p2pIceCandidateQueue.length) {
    const c = p2pIceCandidateQueue.shift();
    try { await p2pConnection.addIceCandidate(new RTCIceCandidate(c)); } catch {}
  }
}

function updateConnBadges() { /* updated by stats interval */ }

/* ── Sender channel ───────────────────────────────── */
const P2P_CHUNK = 256 * 1024;

function setupSenderChannel() {
  p2pDataChannel.binaryType = 'arraybuffer';
  p2pDataChannel.onopen = () => {
    console.log('[P2P] DataChannel open (sender)');
    document.getElementById('p2pShareStep').classList.add('hidden');
    document.getElementById('p2pTransferStep').classList.remove('hidden');
    document.getElementById('p2pTransferStatus').textContent = 'Waiting for receiver…';
    document.getElementById('p2pTransferInfo').textContent   = 'Connection established.';
  };
  p2pDataChannel.onmessage = async e => {
    if (typeof e.data !== 'string') return;
    try {
      const msg = JSON.parse(e.data);
      if (msg.kind === 'transfer_start' && p2pSenderFileAcceptResolver === null) {
        await sendAllFiles();
      } else if (msg.kind === 'file_accepted') {
        if (p2pSenderFileAcceptResolver) { p2pSenderFileAcceptResolver(); p2pSenderFileAcceptResolver = null; }
      }
    } catch {}
  };
  p2pDataChannel.onerror = e => console.error('[P2P] channel error', e);
  p2pDataChannel.onclose = () => handleP2PDisconnect();
}

async function sendAllFiles() {
  const totalBytes = p2pFiles.reduce((s, f) => s + f.size, 0);
  let sentBytes = 0;

  try {
    for (let fi = 0; fi < p2pFiles.length; fi++) {
      const file = p2pFiles[fi];
      document.getElementById('p2pTransferStatus').textContent =
        `Sending file ${fi + 1} of ${p2pFiles.length}…`;

      p2pDataChannel.send(JSON.stringify({ kind: 'meta', name: file.name, size: file.size, type: file.type }));
      await new Promise(resolve => { p2pSenderFileAcceptResolver = resolve; });

      let offset = 0;
      p2pLastBytes = sentBytes; p2pLastTime = Date.now(); p2pSpeedSamples = [];

      while (offset < file.size) {
        let waited = 0;
        while (p2pDataChannel.bufferedAmount > 16 * 1024 * 1024) {
          if (p2pDataChannel.readyState !== 'open') throw new Error('Channel closed during transfer');
          if (waited > 30000) throw new Error('Send buffer timeout — connection stalled');
          await new Promise(r => setTimeout(r, 50));
          waited += 50;
        }
        if (p2pDataChannel.readyState !== 'open') throw new Error('Channel closed');

        const slice  = file.slice(offset, offset + P2P_CHUNK);
        const buf    = await slice.arrayBuffer();
        p2pDataChannel.send(buf);
        offset    += buf.byteLength;
        sentBytes += buf.byteLength;

        const now     = Date.now();
        const elapsed = (now - p2pLastTime) / 1000;
        if (elapsed >= 0.5) {
          const speed = (sentBytes - p2pLastBytes) / elapsed;
          p2pSpeedSamples.push(speed);
          if (p2pSpeedSamples.length > 5) p2pSpeedSamples.shift();
          p2pLastBytes = sentBytes; p2pLastTime = now;
        }
        const avgSpeed = p2pSpeedSamples.length
          ? p2pSpeedSamples.reduce((a, b) => a + b, 0) / p2pSpeedSamples.length : 0;

        const pct = Math.round(sentBytes / totalBytes * 100);
        document.getElementById('p2pTransferBar').style.width = pct + '%';
        document.getElementById('p2pTransferInfo').textContent =
          `${pct}% · ${formatBytes(sentBytes)} / ${formatBytes(totalBytes)}` +
          (avgSpeed > 0 ? ` · ${formatBytes(avgSpeed)}/s` : '');

        const filePct = Math.round(offset / file.size * 100);
        const pe = p2pPillMap.get(file);
        if (pe) pe.pgBar.style.width = filePct + '%';
      }

      p2pDataChannel.send(JSON.stringify({ kind: 'eof', name: file.name }));
      const pe = p2pPillMap.get(file);
      if (pe) { pe.pgBar.style.width = '100%'; pe.pgBar.style.background = '#34A853'; }
    }

    document.getElementById('p2pTransferStatus').textContent = 'Done!';
    document.getElementById('p2pTransferInfo').textContent   = `All ${p2pFiles.length} file${p2pFiles.length !== 1 ? 's' : ''} sent.`;
    document.getElementById('p2pTransferCancelBtn').style.display = 'none';
  } catch (err) {
    console.error('[P2P] sendAllFiles error:', err);
    document.getElementById('p2pTransferStatus').textContent = 'Transfer failed';
    document.getElementById('p2pTransferInfo').textContent   = err.message || 'Connection lost';
  }
}

/* ── Receiver channel ─────────────────────────────── */
function setupReceiverChannel() {
  p2pDataChannel.binaryType = 'arraybuffer';

  p2pDataChannel.onopen = () => {
    console.log('[P2P] DataChannel open (receiver)');
    if (p2pAccepted || p2pAcceptPending) {
      p2pAcceptPending = false;
      document.getElementById('p2pReceiveStep').classList.add('hidden');
      document.getElementById('p2pTransferStep').classList.remove('hidden');
      document.getElementById('p2pTransferStatus').textContent = 'Receiving…';
      document.getElementById('p2pTransferInfo').textContent   = 'Connection established.';
      try { p2pDataChannel.send(JSON.stringify({ kind: 'transfer_start' })); } catch {}
    }
  };

  p2pDataChannel.onmessage = async e => {
    if (typeof e.data === 'string') {
      const msg = JSON.parse(e.data);
      if (msg.kind === 'meta') {
        p2pCurrentMeta = msg; p2pChunks = []; p2pReceived = 0;
        p2pSpeedSamples = []; p2pLastBytes = 0; p2pLastTime = Date.now();
        if (window.showSaveFilePicker) {
          try {
            const handle = await window.showSaveFilePicker({ suggestedName: msg.name });
            p2pWritableStream = await handle.createWritable();
          } catch (err) {
            if (err.name === 'AbortError') { p2pDataChannel.close(); exitP2PReceive(); return; }
          }
        }
        try { p2pDataChannel.send(JSON.stringify({ kind: 'file_accepted' })); } catch {}
      } else if (msg.kind === 'eof' && p2pCurrentMeta) {
        if (p2pWritableStream) { await p2pWritableStream.close(); p2pWritableStream = null; }
        else {
          const blob = new Blob(p2pChunks, { type: p2pCurrentMeta.type || 'application/octet-stream' });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement('a'); a.href = url; a.download = p2pCurrentMeta.name; a.click();
          URL.revokeObjectURL(url);
        }
        p2pCurrentMeta = null; p2pChunks = []; p2pReceived = 0;
        document.getElementById('p2pTransferStatus').textContent = 'Done!';
        document.getElementById('p2pTransferInfo').textContent   = 'All files received.';
        document.getElementById('p2pTransferCancelBtn').style.display = 'none';
      }
    } else {
      // Binary chunk
      if (p2pWritableStream) await p2pWritableStream.write(e.data);
      else p2pChunks.push(e.data);
      p2pReceived += e.data.byteLength;

      if (p2pCurrentMeta) {
        const pct = Math.round(p2pReceived / p2pCurrentMeta.size * 100);
        const now = Date.now();
        const elapsed = (now - p2pLastTime) / 1000;
        if (elapsed >= 0.5) {
          const speed = (p2pReceived - p2pLastBytes) / elapsed;
          p2pSpeedSamples.push(speed);
          if (p2pSpeedSamples.length > 5) p2pSpeedSamples.shift();
          p2pLastBytes = p2pReceived; p2pLastTime = now;
        }
        const avgSpeed = p2pSpeedSamples.length
          ? p2pSpeedSamples.reduce((a, b) => a + b, 0) / p2pSpeedSamples.length : 0;

        document.getElementById('p2pTransferBar').style.width = pct + '%';
        document.getElementById('p2pTransferInfo').textContent =
          `${pct}% · ${formatBytes(p2pReceived)} / ${formatBytes(p2pCurrentMeta.size)}` +
          (avgSpeed > 0 ? ` · ${formatBytes(avgSpeed)}/s` : '');
        document.getElementById('p2pTransferStatus').textContent = `Receiving ${p2pCurrentMeta.name}…`;
      }
    }
  };

  p2pDataChannel.onerror = e => console.error('[P2P] receiver channel error', e);
  p2pDataChannel.onclose = () => handleP2PDisconnect();
}



/* ── Disconnect handling ──────────────────────────── */
async function handleP2PDisconnect() {
  const transferStep = document.getElementById('p2pTransferStep');
  const shareStep    = document.getElementById('p2pShareStep');

  if (shareStep && !shareStep.classList.contains('hidden')) {
    shareStep.classList.add('hidden');
    document.getElementById('p2pErrorState')?.classList.remove('hidden');
    const em = document.getElementById('p2pErrorMessage');
    if (em) em.textContent = 'Receiver disconnected.';
    return;
  }

  if (!transferStep || transferStep.classList.contains('hidden')) return;
  const status = document.getElementById('p2pTransferStatus').textContent;
  if (status === 'Done!' || status === 'Transfer failed') return;

  document.getElementById('p2pTransferStatus').textContent = 'Transfer failed';
  document.getElementById('p2pTransferInfo').textContent   = 'Peer disconnected unexpectedly.';

  if (p2pWritableStream) { try { await p2pWritableStream.abort(); } catch {} p2pWritableStream = null; }
  if (p2pSenderFileAcceptResolver) { p2pSenderFileAcceptResolver(); p2pSenderFileAcceptResolver = null; }
}

/* ── Receive file list ────────────────────────────── */
function renderReceiveFileList(files) {
  const list = document.getElementById('p2pReceiveFilesList');
  list.innerHTML = '';
  if (!files.length) { list.innerHTML = '<p class="dl-empty">File list loading…</p>'; return; }
  files.forEach(f => {
    const row  = document.createElement('div'); row.className = 'dl-file-row';
    const left = document.createElement('div'); left.className = 'dl-file-left';
    const icon = document.createElement('div'); icon.className = 'file-icon'; icon.textContent = getExt(f.name);
    const info = document.createElement('div'); info.className = 'file-info';
    const nm   = document.createElement('div'); nm.className = 'file-name'; nm.textContent = f.name;
    const mt   = document.createElement('div'); mt.className = 'file-meta';
    const sz   = document.createElement('span'); sz.textContent = formatBytes(f.size);
    mt.appendChild(sz); info.append(nm, mt); left.append(icon, info); row.append(left);
    list.appendChild(row);
  });
}

/* ── Accept / Decline ─────────────────────────────── */
document.getElementById('p2pAcceptBtn').addEventListener('click', () => {
  p2pAccepted = true;
  document.getElementById('p2pReceiveStep').classList.add('hidden');
  document.getElementById('p2pTransferStep').classList.remove('hidden');
  document.getElementById('p2pTransferStatus').textContent = 'Waiting for sender…';
  document.getElementById('p2pTransferInfo').textContent   = 'Waiting for connection…';

  if (p2pDataChannel && p2pDataChannel.readyState === 'open') {
    try { p2pDataChannel.send(JSON.stringify({ kind: 'transfer_start' })); } catch {}
  } else {
    p2pAcceptPending = true; // flushed in setupReceiverChannel onopen
  }
});

/* ── P2P create button ────────────────────────────── */
p2pCreateBtn.addEventListener('click', () => {
  if (!p2pFiles.length) return;
  let name = '';
  try { name = localStorage.getItem('username') || ''; } catch {}
  if (!name) { pendingNameAction = () => p2pCreateBtn.click(); startEditName(); return; }
  p2pConnect(true, () => {
    wsSend({
      type: 'create_room',
      data: {
        mode: 'p2p',
        metadata: { userName: name, files: p2pFiles.map(f => ({ name: f.name, size: f.size })) }
      }
    });
  });
});

document.getElementById('p2pCopyBtn').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('p2pShareLink').value);
  showToast('Link Copied!');
};

function resetP2PState() {
  if (p2pStatsInterval)  { clearInterval(p2pStatsInterval); p2pStatsInterval = null; }
  if (p2pWs)             { try { p2pWs.close(); }             catch {} p2pWs = null; }
  if (p2pDataChannel)    { try { p2pDataChannel.close(); }    catch {} p2pDataChannel = null; }
  if (p2pConnection)     { try { p2pConnection.close(); }     catch {} p2pConnection = null; }
  if (p2pWritableStream) { try { p2pWritableStream.abort(); } catch {} p2pWritableStream = null; }

  p2pFiles = []; p2pRoomId = null; p2pPeerId = null; p2pMyClientId = null;
  p2pIsSender = false; p2pAccepted = false; p2pAcceptPending = false;
  p2pHandshakeStarted = false; p2pConnectedReceivers = 0;
  p2pRemoteDescSet = false; p2pIceCandidateQueue = []; p2pIceSendQueue = [];
  p2pCurrentMeta = null; p2pChunks = []; p2pReceived = 0;
  p2pSpeedSamples = []; p2pLastBytes = 0; p2pLastTime = Date.now();
  if (p2pSenderFileAcceptResolver) { p2pSenderFileAcceptResolver(); p2pSenderFileAcceptResolver = null; }
}

function cancelP2PShare() {
  resetP2PState();
  p2pFilesList.innerHTML = '';
  document.getElementById('tabGroup').style.display = '';
  ['p2pShareStep','p2pTransferStep','p2pLoadingState','p2pErrorState'].forEach(id =>
    document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('p2pUploadStep').classList.remove('hidden');
  history.replaceState(null, '', window.location.pathname);
}

function exitP2PReceive() {
  resetP2PState();
  document.getElementById('tabGroup').style.display = '';
  ['p2pReceiveStep','p2pTransferStep','p2pLoadingState','p2pErrorState'].forEach(id =>
    document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('p2pUploadStep').classList.remove('hidden');
  history.replaceState(null, '', window.location.pathname);
}

/* ═══════════════════════════════════════════════════
   URL ROUTING
   FIX #14: use DOMContentLoaded instead of rAF
═══════════════════════════════════════════════════ */
function initRouting() {
  const p2pParam  = new URLSearchParams(window.location.search).get('p2p');
  const roomParam = new URLSearchParams(window.location.search).get('room');

  if (p2pParam) {
    switchMode('peer');
    document.getElementById('tabGroup').style.display = 'none';
    document.getElementById('p2pUploadStep').classList.add('hidden');
    p2pRoomId = p2pParam.toUpperCase();
    let name = 'Guest';
    try { name = localStorage.getItem('username') || 'Guest'; } catch {}
    document.getElementById('p2pLoadingState').classList.remove('hidden');
    p2pConnect(false, () => {
      wsSend({ type: 'join_room', data: { roomId: p2pRoomId, metadata: { userName: name } } });
    });

  } else if (roomParam) {
    loadDownloadView(roomParam.toUpperCase());

  } else {
    let restored = false;
    try {
      const raw = localStorage.getItem('activeCloudUpload');
      if (raw) {
        const active = JSON.parse(raw);
        if (active.expiresAt > Date.now()) {
          switchMode('upload');
          showCloudRoomActive(active.code, active.expiresAt, active.link);
          restored = true;
        } else {
          try { localStorage.removeItem('activeCloudUpload'); } catch {}
        }
      }
    } catch {}
    if (!restored) switchMode('peer');
    renderActiveRooms();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRouting);
} else {
  initRouting();
}

/* ═══════════════════════════════════════════════════
   UTILS — TOAST
═══════════════════════════════════════════════════ */
let toastTimeout;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.display = 'block';
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { if (!toast.classList.contains('show')) toast.style.display = ''; }, 300);
  }, 2500);
}

document.getElementById('copyCodeBtn').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('cloudRoomCode').textContent);
  showToast('Room Code Copied!');
};
document.getElementById('copyBtn').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('shareLink').value);
  showToast('Share Link Copied!');
};

/* ── Spotlight ────────────────────────────────────── */
function spotlight(e, card) {
  const r  = card.getBoundingClientRect();
  const sp = card.querySelector('.card-spotlight');
  if (!sp) return;
  sp.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  sp.style.setProperty('--my', (e.clientY - r.top)  + 'px');
}

/* ═══════════════════════════════════════════════════
   GDG LOGO ANIMATION
   FIX #44/#15: stop loop when element removed
═══════════════════════════════════════════════════ */
(function gdgInit() {
  const stage = document.getElementById('gdg-stage');
  if (!stage) return;

  let loopActive = true;
  const observer = new MutationObserver(() => {
    if (!document.contains(stage)) { loopActive = false; observer.disconnect(); }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  function spring(from, to, k, d, m) {
    k = k||180; d = d||20; m = m||1;
    const diff = to-from, w0 = Math.sqrt(k/m), z = d/(2*Math.sqrt(k*m));
    if (z < 1) {
      const wd = w0*Math.sqrt(1-z*z);
      return t => to - Math.exp(-z*w0*t)*(diff*Math.cos(wd*t)+(diff*z*w0/wd)*Math.sin(wd*t));
    }
    return t => to - diff*Math.exp(-w0*t)*(1+w0*t);
  }
  const easeOut = t => 1-Math.pow(1-t,3);
  const easeIn  = t => t*t*t;
  function anim(dur, tick, done) {
    let start=null;
    function f(ts) {
      if (!loopActive) return;
      if (!start) start=ts;
      const t = Math.min((ts-start)/dur,1);
      tick(t);
      if (t<1) requestAnimationFrame(f);
      else if (done) done();
    }
    requestAnimationFrame(f);
  }
  const dots = { blue: document.getElementById('dot-blue'), red: document.getElementById('dot-red'), yellow: document.getElementById('dot-yellow'), green: document.getElementById('dot-green') };
  const logSvg = document.getElementById('logo-svg');
  const caps = { blue: document.getElementById('cap-blue'), red: document.getElementById('cap-red'), yellow: document.getElementById('cap-yellow'), green: document.getElementById('cap-green'), 'blue-out': document.getElementById('cap-blue-out'), 'red-out': document.getElementById('cap-red-out'), 'yellow-out': document.getElementById('cap-yellow-out'), 'green-out': document.getElementById('cap-green-out') };
  const KEYS = ['blue','red','yellow','green'];
  const home   = { blue:{x:99,y:110}, red:{x:141,y:110}, yellow:{x:183,y:110}, green:{x:225,y:110} };
  const capTgt = { blue:{x:118,y:91}, red:{x:118,y:129}, yellow:{x:222,y:91}, green:{x:222,y:129} };
  const lens = {};
  KEYS.forEach(k => {
    const el = caps[k];
    const dx = parseFloat(el.getAttribute('x2'))-parseFloat(el.getAttribute('x1'));
    const dy = parseFloat(el.getAttribute('y2'))-parseFloat(el.getAttribute('y1'));
    lens[k] = Math.sqrt(dx*dx+dy*dy);
    [caps[k],caps[k+'-out']].forEach(e => { e.style.strokeDasharray=lens[k]; e.style.strokeDashoffset=lens[k]; });
  });
  function setDot(k,x,y,sc) { sc=sc===undefined?1:sc; dots[k].style.transform=`translateY(-50%) translate(${x-home[k].x}px,${y-home[k].y}px) scale(${sc})`; }
  function resetDot(k) { dots[k].style.transform='translateY(-50%)'; }
  function bounce(dur,onDone) {
    const delay={blue:0,red:0.15,yellow:0.30,green:0.45}, amp=32; let start=null;
    function f(ts) {
      if (!loopActive) return;
      if (!start) start=ts;
      const el = (ts-start)/1000;
      KEYS.forEach(k => { const t=el-delay[k]; if(t<0) return; setDot(k,home[k].x,home[k].y-Math.abs(Math.sin(Math.PI*t*2.8))*amp*Math.exp(-1.2*t)); });
      if (el<dur) requestAnimationFrame(f);
      else { KEYS.forEach(k=>resetDot(k)); if(onDone) onDone(); }
    }
    requestAnimationFrame(f);
  }
  function morphToLogo(cb) {
    logSvg.style.opacity='1';
    const st={blue:0,red:80,yellow:50,green:130}; let done=0;
    KEYS.forEach(k => {
      setTimeout(() => {
        const sx=spring(home[k].x,capTgt[k].x,220,22), sy=spring(home[k].y,capTgt[k].y,220,22);
        anim(700, t => setDot(k,sx(t*0.9),sy(t*0.9),1-easeIn(t)*0.9), () => { dots[k].style.opacity='0'; if(++done===4) drawCaps(cb); });
      }, st[k]);
    });
  }
  function drawCaps(cb) {
    const st={blue:0,red:60,yellow:40,green:100}; let done=0;
    KEYS.forEach(k => { setTimeout(() => { anim(500, t => { const v=lens[k]*(1-easeOut(t)); caps[k].style.strokeDashoffset=v; caps[k+'-out'].style.strokeDashoffset=v; }, () => { if(++done===4&&cb) cb(); }); }, st[k]); });
  }
  function unmorphToDots(cb) {
    const st={blue:100,red:40,yellow:60,green:0}; let done=0;
    KEYS.forEach(k => { setTimeout(() => { anim(400, t => { const v=lens[k]*easeIn(t); caps[k].style.strokeDashoffset=v; caps[k+'-out'].style.strokeDashoffset=v; }, () => { if(++done===4) emergeDots(cb); }); }, st[k]); });
  }
  function emergeDots(cb) {
    logSvg.style.opacity='0';
    const st={blue:0,red:70,yellow:40,green:110}; let done=0;
    KEYS.forEach(k => {
      dots[k].style.opacity='1';
      setTimeout(() => {
        const sx=spring(capTgt[k].x,home[k].x,200,18), sy=spring(capTgt[k].y,home[k].y,200,18);
        anim(650, t => setDot(k,sx(t*0.9),sy(t*0.9),easeOut(t)), () => { resetDot(k); if(++done===4&&cb) cb(); });
      }, st[k]);
    });
  }
  function gdgLoop() {
    if (!loopActive) return;
    KEYS.forEach(k => { dots[k].style.opacity='1'; resetDot(k); caps[k].style.strokeDashoffset=lens[k]; caps[k+'-out'].style.strokeDashoffset=lens[k]; });
    logSvg.style.opacity='0';
    bounce(2.2, () => morphToLogo(() => setTimeout(() => unmorphToDots(() => setTimeout(gdgLoop, 400)), 1200)));
  }
  setTimeout(gdgLoop, 300);
})();

/* ═══════════════════════════════════════════════════
   TYPEWRITER
═══════════════════════════════════════════════════ */
(function initTypewriter() {
  const phrases = ['students who ship.', 'the GDG Cloud Team.', 'the team behind Zap.'];
  let pi=0, ci=0, del=false;
  const el = document.getElementById('twLine');
  if (!el) return;
  function tick() {
    const p = phrases[pi];
    if (!del) {
      ci++;
      el.innerHTML = p.slice(0,ci) + '<span class="tw-cursor"></span>';
      if (ci===p.length) { del=true; setTimeout(tick,2000); return; }
      setTimeout(tick,55);
    } else {
      ci--;
      el.innerHTML = p.slice(0,ci) + '<span class="tw-cursor"></span>';
      if (ci===0) { del=false; pi=(pi+1)%phrases.length; setTimeout(tick,350); return; }
      setTimeout(tick,30);
    }
  }
  setTimeout(tick, 700);
})();

/* ═══════════════════════════════════════════════════
   DEV AVATARS — FOOTER
   FIX #45: auto-cycle restarts after manual select
   FIX #46: use textContent for user-controlled text
═══════════════════════════════════════════════════ */
const devs = [
  { initials:'AB', name:'Anisha Bhargava',   role:'Cloud Chapter Lead',     quote:'"Leading the cloud, one deploy at a time."',           bg:'#1e2535', color:'#7aa2f7', li:'https://www.linkedin.com/in/anisha-bhargava19/',            photo:'assets/anisha.png' },
  { initials:'RR', name:'Ritwik Rish Raj',   role:'Cloud Team · Developer', quote:'"Building at the edge is building for the future."',   bg:'#1f2820', color:'#7dcfab', li:'https://www.linkedin.com/in/ritwik-rish-raj-4880a8322/',  photo:'assets/ritwik.png' },
  { initials:'MM', name:'Mayank Mishra',     role:'Cloud Team · Developer', quote:'"Every line of code is a step toward scale."',         bg:'#251e2b', color:'#bb9af7', li:'https://www.linkedin.com/in/mayank-mishra-417864316/',   photo:'assets/mayank.png' },
  { initials:'AS', name:'Adarsh Srivastava', role:'Cloud Team · Developer', quote:'"Serverless is not just a trend — it\'s the future."', bg:'#2b1e1e', color:'#f7768e', li:'https://www.linkedin.com/in/adarsh-srivastava-08947631a/', photo:'assets/adarsh.png' },
  { initials:'SP', name:'Sayan Pal',         role:'Cloud Team · Developer', quote:'"Good infrastructure is invisible infrastructure."',    bg:'#1e2820', color:'#9ece6a', li:'https://linkedin.com/in/sayarch/',                         photo:'assets/sayan.png'  },
  { initials:'AG', name:'Agam Singh Saluja', role:'Cloud Team · Developer', quote:'"Ship fast, iterate faster."',                         bg:'#2b2318', color:'#e0af68', li:'https://www.linkedin.com/in/agam-singh-saluja',             photo:'assets/agam.png'  },
  { initials:'RS', name:'Riddhi Sardar',     role:'Cloud Team · Developer', quote:'"The best products solve real problems simply."',      bg:'#1e2530', color:'#2ac3de', li:'https://www.linkedin.com/in/riddhi-sardar-131a29319',       photo:'assets/riddhi.png' },
];

let selectedDev    = 0;
let devCycleTimer  = null; // FIX #27: correct spelling

function avatarImg(d, size) {
  const fallback = `<span style="display:none;width:${size}px;height:${size}px;border-radius:50%;background:${d.bg};color:${d.color};font-family:'DM Mono',monospace;font-size:${size<40?'0.55':'0.65'}rem;font-weight:500;align-items:center;justify-content:center;flex-shrink:0">${d.initials}</span>`;
  if (d.photo) {
    return `<img src="${d.photo}" alt="${d.initials}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;flex-shrink:0" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">${fallback}`;
  }
  return fallback.replace('display:none', 'display:flex');
}

function renderStrip() {
  const strip = document.getElementById('avatarStrip');
  if (!strip) return;
  strip.innerHTML = devs.map((d, i) => {
    const btn = document.createElement('button');
    btn.className = 'avatar-item' + (i === selectedDev ? ' selected' : '');
    btn.style.cssText = `background:${d.bg};color:${d.color};padding:0;overflow:hidden;border:none`;
    btn.dataset.idx = i;
    btn.innerHTML = avatarImg(d, 38);
    btn.addEventListener('click', () => selectDev(i));
    return btn.outerHTML;
  }).join('');
  // Re-attach listeners since innerHTML was used
  strip.querySelectorAll('.avatar-item').forEach(btn => {
    btn.addEventListener('click', () => selectDev(parseInt(btn.dataset.idx)));
  });
}

function renderCard() {
  const wrap = document.getElementById('devCardWrap');
  if (!wrap) return;
  const d = devs[selectedDev];
  // FIX #46: Use DOM methods for user text to avoid XSS
  const a    = document.createElement('a');
  a.className = 'dev-card-active';
  a.href      = d.li;
  a.target    = '_blank';
  a.rel       = 'noopener';

  const av  = document.createElement('div'); av.className = 'dev-card-avatar';
  av.style.cssText = `background:${d.bg};color:${d.color};overflow:hidden;padding:0`;
  av.innerHTML = avatarImg(d, 40);

  const inf = document.createElement('div'); inf.className = 'dev-card-info';
  const nm  = document.createElement('div'); nm.className = 'dev-card-name'; nm.textContent = d.name;
  const rl  = document.createElement('div'); rl.className = 'dev-card-role'; rl.textContent = d.role;
  const qt  = document.createElement('div'); qt.className = 'dev-card-quote'; qt.textContent = d.quote;
  inf.append(nm, rl, qt);

  const arr = document.createElement('svg');
  arr.setAttribute('class', 'li-arrow');
  arr.setAttribute('width', '14'); arr.setAttribute('height', '14');
  arr.setAttribute('viewBox', '0 0 24 24'); arr.setAttribute('fill', 'none');
  arr.setAttribute('stroke', 'currentColor'); arr.setAttribute('stroke-width', '2');
  arr.setAttribute('stroke-linecap', 'round'); arr.setAttribute('stroke-linejoin', 'round');
  arr.innerHTML = '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>';

  a.append(av, inf, arr);
  wrap.innerHTML = '';
  wrap.appendChild(a);
}

function selectDev(i) {
  selectedDev = i;
  renderStrip();
  renderCard();
  // FIX #45: restart auto-cycle after manual select
  if (devCycleTimer) clearInterval(devCycleTimer);
  devCycleTimer = setInterval(autoCycleDev, 4000);
}

function autoCycleDev() {
  selectedDev = (selectedDev + 1) % devs.length;
  renderStrip();
  renderCard();
}

const stripEl = document.getElementById('avatarStrip');
if (stripEl) {
  renderStrip();
  renderCard();
  devCycleTimer = setInterval(autoCycleDev, 4000);
}