// --- THEME SYSTEM ---
const themeToggle = document.getElementById("themeToggle");
if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
    themeToggle.checked = true;
}
themeToggle.addEventListener("change", () => {
    const isLight = themeToggle.checked;
    document.body.classList.toggle("light", isLight);
    try {
        localStorage.setItem("theme", isLight ? "light" : "dark");
    } catch {}
});

// --- NAME SYSTEM ---
function getInitials(name) {
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function renderNameBar(name) {
    document.getElementById('nameAvatar').textContent = getInitials(name);
    document.getElementById('nameLabel').textContent  = name;
}

function startEditName() {
    const current = localStorage.getItem('username') || '';
    document.getElementById('nameInput').value = current;
    document.getElementById('nameError').textContent = '';
    document.getElementById('nameDisplay').style.display = 'none';
    document.getElementById('nameEdit').style.display    = 'flex';
    document.getElementById('nameInput').focus();
    document.getElementById('nameCancelBtn').style.display = current ? '' : 'none';
}

function cancelEditName() {
    document.getElementById('nameEdit').style.display    = 'none';
    document.getElementById('nameDisplay').style.display = '';
}

function saveName() {
    const val = document.getElementById('nameInput').value.trim();
    if (val.length < 2) {
        document.getElementById('nameError').textContent = 'Name must be at least 2 characters.';
        return;
    }
    const isFirst = !localStorage.getItem('username');
    try {
        localStorage.setItem('username', val);
    } catch {}
    renderNameBar(val);
    document.getElementById('nameEdit').style.display    = 'none';
    document.getElementById('nameDisplay').style.display = '';
    document.getElementById('nameError').textContent = '';
    if (isFirst) {
        document.getElementById('transfer').classList.remove('hidden');
        document.getElementById('transfer').scrollIntoView({ behavior: 'smooth' });
    }
}

document.getElementById('nameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') cancelEditName();
});

// Init
const savedName = localStorage.getItem('username');
if (savedName) {
    renderNameBar(savedName);
    document.getElementById('transfer').classList.remove('hidden');
} else {
    document.getElementById('nameDisplay').style.display = 'none';
    document.getElementById('nameEdit').style.display    = 'flex';
    document.getElementById('nameCancelBtn').style.display = 'none';
}

function scrollToUser() {
    const transfer = document.getElementById('transfer');
    if (!localStorage.getItem('username')) {
        transfer.classList.remove('hidden');
        transfer.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => startEditName(), 350);
    } else {
        transfer.scrollIntoView({ behavior: 'smooth' });
    }
}

// --- CLOUD HOLD ---
// Use relative URLs so the app works on any host (local dev + production).
const API = window.location.origin;

let appCryptoKey = null;

async function initEncryption() {
    if (appCryptoKey) return;
    try {
        const res = await fetch(`${API}/api/encryption-key`);
        const { keyHex } = await res.json();
        const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        appCryptoKey = await crypto.subtle.importKey(
            'raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
        );
    } catch (e) {
        console.error('Failed to init encryption:', e);
    }
}

// --- SESSION CACHE (Cloud Hold) ---
function loadCloudSessions() {
    try {
        const raw = localStorage.getItem('myCloudRooms');
        if (!raw) return [];
        let data = JSON.parse(raw);
        data = data.filter(r => Date.now() < r.expiresAt);
        try {
            localStorage.setItem('myCloudRooms', JSON.stringify(data));
        } catch {}
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
function renderActiveRooms() {
    const rooms = loadCloudSessions();
    const list = document.getElementById('activeRoomsList');
    const badge = document.getElementById('roomsBadge');
    if (badge) badge.textContent = rooms.length;
    if (!list) return;
    
    if (rooms.length === 0) {
        list.innerHTML = '<div class="rooms-empty">No active rooms</div>';
        return;
    }
    const TRASH = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.3093 2.24996H13.6907C13.9071 2.24982 14.0956 2.2497 14.2736 2.27813C14.9769 2.39043 15.5855 2.82909 15.9145 3.46078C15.9978 3.62067 16.0573 3.79955 16.1256 4.00488L16.2372 4.33978C16.2561 4.39647 16.2615 4.41252 16.266 4.42516C16.4412 4.90927 16.8952 5.23653 17.4098 5.24958C17.4234 5.24992 17.4399 5.24998 17.5 5.24998H20.5C20.9142 5.24998 21.25 5.58576 21.25 5.99998C21.25 6.41419 20.9142 6.74998 20.5 6.74998H3.49991C3.08569 6.74998 2.74991 6.41419 2.74991 5.99998C2.74991 5.58576 3.08569 5.24998 3.49991 5.24998H6.49999C6.56004 5.24998 6.57661 5.24992 6.59014 5.24958C7.10479 5.23653 7.55881 4.90929 7.73393 4.42518C7.73854 4.41245 7.74383 4.39675 7.76282 4.33978L7.87443 4.0049C7.94272 3.79958 8.00223 3.62067 8.08549 3.46078C8.41444 2.82909 9.02304 2.39043 9.72634 2.27813C9.90436 2.2497 10.0929 2.24982 10.3093 2.24996ZM9.00806 5.24998C9.05957 5.14895 9.10521 5.04398 9.14448 4.93542C9.15641 4.90245 9.1681 4.86736 9.18313 4.82228L9.28293 4.52286C9.3741 4.24935 9.39509 4.19357 9.41592 4.15358C9.52557 3.94301 9.72843 3.7968 9.96287 3.75936C10.0074 3.75225 10.0669 3.74998 10.3553 3.74998H13.6447C13.933 3.74998 13.9926 3.75225 14.0371 3.75936C14.2716 3.7968 14.4744 3.94301 14.5841 4.15358C14.6049 4.19357 14.6259 4.24934 14.7171 4.52286L14.8168 4.8221L14.8555 4.93544C14.8948 5.04399 14.9404 5.14896 14.9919 5.24998H9.00806Z" fill="currentColor"/><path d="M5.915 8.45009C5.88744 8.03679 5.53007 7.72409 5.11677 7.75164C4.70347 7.77919 4.39077 8.13657 4.41832 8.54987L4.88177 15.5016C4.96726 16.7843 5.03633 17.8205 5.1983 18.6336C5.3667 19.4789 5.65312 20.1849 6.24471 20.7384C6.83631 21.2919 7.55985 21.5307 8.41451 21.6425C9.23653 21.75 10.275 21.75 11.5605 21.75H12.4394C13.725 21.75 14.7635 21.75 15.5855 21.6425C16.4401 21.5307 17.1637 21.2919 17.7553 20.7384C18.3469 20.1849 18.6333 19.4789 18.8017 18.6336C18.9637 17.8205 19.0327 16.7844 19.1182 15.5016L19.5817 8.54987C19.6092 8.13657 19.2965 7.77919 18.8832 7.75164C18.4699 7.72409 18.1125 8.03679 18.085 8.45009L17.625 15.3492C17.5352 16.6971 17.4712 17.6349 17.3306 18.3405C17.1942 19.0249 17.0039 19.3872 16.7305 19.643C16.4571 19.8988 16.0829 20.0646 15.3909 20.1552C14.6775 20.2485 13.7375 20.25 12.3867 20.25H11.6133C10.2625 20.25 9.32246 20.2485 8.60906 20.1552C7.91706 20.0646 7.5429 19.8988 7.26949 19.643C6.99607 19.3872 6.80574 19.0249 6.66939 18.3405C6.52882 17.6349 6.4648 16.6971 6.37494 15.3492L5.915 8.45009Z" fill="currentColor"/><path d="M9.42537 10.2537C9.83753 10.2125 10.2051 10.5132 10.2463 10.9253L10.7463 15.9253C10.7875 16.3375 10.4868 16.705 10.0746 16.7463C9.66247 16.7875 9.29494 16.4868 9.25372 16.0746L8.75372 11.0746C8.71251 10.6624 9.01321 10.2949 9.42537 10.2537Z" fill="currentColor"/><path d="M14.5746 10.2537C14.9868 10.2949 15.2875 10.6624 15.2463 11.0746L14.7463 16.0746C14.7051 16.4868 14.3375 16.7875 13.9254 16.7463C13.5132 16.705 13.2125 16.3375 13.2537 15.9253L13.7537 10.9253C13.7949 10.5132 14.1625 10.2125 14.5746 10.2537Z" fill="currentColor"/></svg>`;
    
    list.innerHTML = rooms.map(r => {
        const remaining = r.expiresAt - Date.now();
        const hrs = Math.floor(remaining / 3600000);
        const mins = Math.floor((remaining % 3600000) / 60000);
        const timeLeftStr = remaining <= 0 ? 'expired' : (hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`);
        return `
        <div class="room-item" id="ri-${r.code}">
          <div class="room-dot"></div>
          <div class="room-info">
            <span class="room-code">${r.code}</span>
            <span class="room-meta" data-expires="${r.expiresAt}">${timeLeftStr}</span>
          </div>
          <div class="room-actions">
            <button class="btn-open" onclick="window.location.href='${r.link}'">Open</button>
            <button class="btn-delete" title="Delete Room" onclick="deleteCloudRoom('${r.code}', '${r.adminToken}')">${TRASH}</button>
          </div>
        </div>
    `}).join('');
}

window.deleteCloudRoom = async function(code, token) {
    if (!confirm(`Are you sure you want to completely delete room ${code}?`)) return;
    try {
        const res = await fetch(`${API}/api/room/${code}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Deletion failed');
        removeCloudSession(code);
        renderActiveRooms();
        if (cloudRoomCode_active === code) exitCloudRoom();
    } catch (e) {
        console.error(e);
        alert('Failed to delete room.');
    }
};
let cloudRoomCode_active = null;

const dropZone  = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const filesList = document.getElementById('filesList');
const dzInner   = document.getElementById('dzInner');
const uploadBtn = document.getElementById('uploadBtn');
let uploadedFiles = [];

let isUploading = false;

dropZone.addEventListener('click', (e) => { 
    if (isUploading || e.target === fileInput) return;
    if (e.target.closest('.file-pill')) return; 
    fileInput.click(); 
});
fileInput.addEventListener('change', () => { handleFiles([...fileInput.files]); fileInput.value = ''; });
['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('drag-over'); }));
['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('drag-over'); }));
dropZone.addEventListener('drop', e => { if (e.dataTransfer?.files.length) handleFiles([...e.dataTransfer.files]); spawnRipple(e); });

function spawnRipple(e) {
    const rect = dropZone.getBoundingClientRect();
    const r = document.createElement('div');
    r.className = 'dz-ripple';
    const size = Math.max(rect.width, rect.height);
    r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px`;
    dropZone.appendChild(r);
    r.addEventListener('animationend', () => r.remove());
}

function handleFiles(files) {
    if (isUploading) return;
    files.forEach(file => {
        if (uploadedFiles.find(f => f.name === file.name && f.size === file.size)) return;
        uploadedFiles.push(file);
        renderPill(file);
    });
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
    return (b/1048576).toFixed(1) + ' MB';
}

const pillMap = new WeakMap();

function renderPill(file) {
    const pill = document.createElement('div');
    pill.className = 'file-pill';
    const icon = document.createElement('div');
    icon.className = 'file-icon';
    icon.textContent = getExt(file.name);
    const info = document.createElement('div');
    info.className = 'file-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'file-name';
    nameEl.textContent = file.name;
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    const sizeEl = document.createElement('span');
    sizeEl.textContent = formatBytes(file.size);
    const progWrap = document.createElement('div');
    progWrap.className = 'file-prog-wrap';
    const progBar = document.createElement('div');
    progBar.className = 'file-prog-bar';
    progWrap.appendChild(progBar);
    meta.appendChild(sizeEl);
    meta.appendChild(progWrap);
    info.appendChild(nameEl);
    info.appendChild(meta);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-remove';
    removeBtn.title = 'Remove';
    removeBtn.innerHTML = `<svg style="pointer-events:none;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    pill.appendChild(icon);
    pill.appendChild(info);
    pill.appendChild(removeBtn);
    filesList.appendChild(pill);
    pillMap.set(file, { pill, progBar });
    removeBtn.addEventListener('click', e => {
        e.stopPropagation();
        uploadedFiles = uploadedFiles.filter(f => !(f.name === file.name && f.size === file.size));
        pill.style.transition = 'opacity 0.18s, transform 0.18s';
        pill.style.opacity = '0';
        pill.style.transform = 'translateY(-4px) scale(0.97)';
        setTimeout(() => { pill.remove(); toggleUI(); }, 180);
    });
}

function setPillProgress(file, pct) { const e = pillMap.get(file); if (e) e.progBar.style.width = pct + '%'; }
function setPillDone(file)  {
    const e = pillMap.get(file);
    if (e) {
        e.progBar.style.width = '100%';
        e.progBar.style.background = '#34A853';
    }
}
function setPillError(file) { const e = pillMap.get(file); if (e) { e.progBar.style.background = '#ef4444'; e.progBar.style.width = '100%'; } }

function xhrUpload(url, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) onProgress(Math.round(e.loaded/e.total*100)); });
        xhr.onload  = () => {
            if (xhr.status < 300) {
                const etag = xhr.getResponseHeader('ETag') || '"fallback"';
                resolve({ etag });
            } else reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(file);
    });
}

// --- PANEL TABS & SLIDER ---
const panelTabIdx = { create: 0, join: 1, rooms: 2 };
window.switchPanelTab = function(tab) {
  const i = panelTabIdx[tab];
  if (i === undefined) return;
  document.getElementById('tabSlider').style.transform = `translateX(${i*100}%)`;
  ['Create','Join','Rooms'].forEach((n, j) => {
    document.getElementById('tab'+n)?.classList.toggle('active', j===i);
    document.getElementById('view'+n)?.classList.toggle('active', j===i);
  });
  if (tab === 'rooms') renderActiveRooms();
};

document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('expirySlider');
    const numEl  = document.getElementById('expiryNum');
    const fill   = document.getElementById('trackFill');
    if (!slider) return;

    function updateSlider(v) {
        v = parseInt(v);
        if (numEl) numEl.textContent = v;
        if (fill) fill.style.width = ((v-1)/23*100) + '%';
    }
    slider.addEventListener('input', () => updateSlider(slider.value));
    updateSlider(4); // Default 4 hours
    
    // Sync active rooms badge on page load
    renderActiveRooms();
});

async function initCloudRoom() {
    const name = localStorage.getItem('username');
    if (!name) { startEditName(); return; }
    
    const sliderVal = document.getElementById('expirySlider')?.value || 4;
    const expiry = parseInt(sliderVal) * 3600; // slider hours to seconds
    
    const btn = document.querySelector('#viewCreate .btn-primary');
    if (btn) { btn.textContent = 'Creating…'; btn.disabled = true; }
    try {
        const res = await fetch(`${API}/api/room/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, expiry }),
        });
        if (!res.ok) throw new Error((await res.json()).error || 'Failed');
        const { code, adminToken, expiresAt } = await res.json();
        cloudRoomCode_active = code;
        const link = `${window.location.origin}${window.location.pathname}?room=${code}`;
        // Persist to local array so history is kept
        saveCloudSession(code, adminToken, expiresAt, link);
        localStorage.setItem('activeCloudUpload', JSON.stringify({ code, expiresAt, link }));
        showCloudRoomActive(code, expiresAt, link);
    } catch (err) {
        alert(err.message);
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
    if (code.length < 4) { document.getElementById('joinCloudCode').focus(); return; }
    history.replaceState(null, '', `?room=${code}`);
    loadDownloadView(code);
}

document.getElementById('joinCloudCode').addEventListener('keydown', e => { if (e.key === 'Enter') joinCloudRoom(); });

uploadBtn.addEventListener('click', async () => {
    if (uploadedFiles.length === 0 || !cloudRoomCode_active || isUploading) return;
    uploadBtn.textContent = 'Encrypting & Uploading…';
    uploadBtn.disabled = true;
    isUploading = true;
    try {
        await initEncryption();
        for (const file of uploadedFiles) {
            const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
            const numChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
            // Native AES-GCM tags are exactly 16 bytes. Random IV is 12 bytes.
            const totalBlobSize = file.size + (numChunks * 28);

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
                    const plainBuf = await slice.arrayBuffer();
                    const iv = crypto.getRandomValues(new Uint8Array(12));
                    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, appCryptoKey, plainBuf);
                    const chunkBlob = new Blob([iv, cipherBuf], { type: 'application/octet-stream' });
                    
                    const { etag } = await xhrUpload(uploadUrls[i], chunkBlob, partPct => {
                        const totalPct = Math.round(((uploadedBytes + (chunkBlob.size * (partPct/100))) / totalBlobSize) * 100);
                        setPillProgress(file, totalPct);
                    });
                    
                    uploadedBytes += chunkBlob.size;
                    parts.push({ partNumber: i + 1, etag: etag });
                }
                
                // Complete multipart request
                await fetch(`${API}/api/room/upload-complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: cloudRoomCode_active, fileId, fileName: file.name, fileSize: totalBlobSize, uploadId, parts }),
                });
            } else {
                // Local dev fallback (worker proxy) -> Single chunk
                const iv = crypto.getRandomValues(new Uint8Array(12));
                const plainBuf = await file.arrayBuffer();
                const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, appCryptoKey, plainBuf);
                const finalBlob = new Blob([iv, cipherBuf], { type: file.type || 'application/octet-stream' });
                await xhrUpload(uploadUrls[0], finalBlob, pct => setPillProgress(file, pct));
                await fetch(`${API}/api/room/upload-complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: cloudRoomCode_active, fileId, fileName: file.name, fileSize: finalBlob.size }),
                });
            }
            setPillDone(file);
        }
        uploadBtn.textContent = '✓ Uploaded';
        uploadBtn.style.background = '#22c55e';
        uploadBtn.style.color = '#000';
        
        // Show uploaded files after 1 second
        setTimeout(() => {
            localStorage.removeItem('activeCloudUpload');
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
        uploadedFiles.forEach(f => setPillError(f));
        uploadBtn.textContent = err.message || 'Upload failed';
        uploadBtn.style.background = '#ef4444';
        setTimeout(() => { uploadBtn.textContent = 'Upload Files'; uploadBtn.style.background = ''; uploadBtn.disabled = false; isUploading = false; }, 3000);
    }
});

function exitCloudRoom() {
    // Only reset UI; do NOT clear session array so room persists in history.
    localStorage.removeItem('activeCloudUpload');
    cloudRoomCode_active = null;
    uploadedFiles = [];
    filesList.innerHTML = '';
    dzInner.style.display = '';
    uploadBtn.classList.remove('visible');
    document.getElementById('shareLinkRow').classList.add('hidden');
    document.getElementById('cloudRoomActive').classList.add('hidden');
    document.getElementById('cloudSetup').classList.remove('hidden');
    renderActiveRooms();
    history.replaceState(null, '', window.location.pathname);
}

// --- DOWNLOAD VIEW ---
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
        if (room.files.length === 0) { list.innerHTML = '<p class="dl-empty">No files uploaded yet.</p>'; return; }
        room.files.forEach(file => {
            const row = document.createElement('div');
            row.className = 'dl-file-row';
            const left = document.createElement('div');
            left.className = 'dl-file-left';
            const icon = document.createElement('div');
            icon.className = 'file-icon';
            icon.textContent = getExt(file.name);
            const info = document.createElement('div');
            info.className = 'file-info';
            const metaSpan = `<span>${formatBytes(file.size)}</span>`;
            info.innerHTML = `<div class="file-name">${file.name}</div><div class="file-meta">${metaSpan}</div>`;
            left.appendChild(icon);
            left.appendChild(info);
            const dlBtn = document.createElement('a');
            dlBtn.className = 'dl-btn';
            dlBtn.href = '#';
            dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download`;
            dlBtn.onclick = async (e) => {
                e.preventDefault();
                try {
                    await initEncryption();
                    
                    let writable = null;
                    let plainChunks = [];
                    if (window.showSaveFilePicker) {
                        try {
                            const handle = await window.showSaveFilePicker({ suggestedName: file.name });
                            writable = await handle.createWritable();
                        } catch (err) {
                            if (err.name === 'AbortError') return; // User cancelled prompt
                        }
                    }

                    dlBtn.innerHTML = `Decrypting... 0%`;
                    dlBtn.style.pointerEvents = 'none';

                    const res = await fetch(`${API}/api/room/${code}/download/${file.id}`);
                    if (!res.ok) throw new Error('Download failed');
                    
                    const totalSize = parseInt(res.headers.get('Content-Length') || file.size);
                    let receivedLength = 0;
                    
                    const reader = res.body.getReader();
                    const CHUNK_SIZE = (5 * 1024 * 1024) + 28; // 5MB plain + 12 IV + 16 Tag
                    let buffer = new Uint8Array(0);

                    while (true) {
                        const { done, value } = await reader.read();
                        if (value) {
                            receivedLength += value.length;
                            const pct = totalSize ? Math.round((receivedLength / totalSize) * 100) : 0;
                            dlBtn.innerHTML = `Decrypting... ${pct}%`;
                            
                            const newBuffer = new Uint8Array(buffer.length + value.length);
                            newBuffer.set(buffer);
                            newBuffer.set(value, buffer.length);
                            buffer = newBuffer;
                            
                            while (buffer.length >= CHUNK_SIZE) {
                                const chunk = buffer.slice(0, CHUNK_SIZE);
                                buffer = buffer.slice(CHUNK_SIZE);
                                const iv = chunk.slice(0, 12);
                                const cipherData = chunk.slice(12);
                                const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, appCryptoKey, cipherData);
                                if (writable) await writable.write(plainBuf);
                                else plainChunks.push(plainBuf);
                            }
                        }
                        
                        if (done) {
                            if (buffer.length > 0) {
                                const iv = buffer.slice(0, 12);
                                const cipherData = buffer.slice(12);
                                const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, appCryptoKey, cipherData);
                                if (writable) await writable.write(plainBuf);
                                else plainChunks.push(plainBuf);
                            }
                            break;
                        }
                    }
                    
                    if (writable) {
                        await writable.close();
                    } else {
                        const blob = new Blob(plainChunks, { type: 'application/octet-stream' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = file.name;
                        a.click();
                        URL.revokeObjectURL(url);
                    }
                    dlBtn.innerHTML = `✓ Downloaded`;
                } catch (err) {
                    console.error('Decryption failed:', err);
                    dlBtn.innerHTML = `✗ Error`;
                }
                setTimeout(() => {
                    dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download`;
                    dlBtn.style.pointerEvents = 'auto';
                }, 3000);
            };
            row.appendChild(left);
            row.appendChild(dlBtn);
            list.appendChild(row);
        });
    } catch { document.getElementById('dlRoomName').textContent = 'Failed to load room'; }
}

function exitDownloadView() {
    history.replaceState(null, '', window.location.pathname);
    document.getElementById('tabGroup').style.display = 'flex';
    document.getElementById('downloadContainer').classList.add('hidden');
    document.getElementById('uploadContainer').classList.remove('hidden');
}

// URL Routing initialized at the bottom of the file

// --- MODE TABS ---
const modeTabs = document.querySelectorAll('.mode-tab');
const slider   = document.getElementById('slider');

function positionSlider(activeTab) {
    const tabGroup = document.getElementById('tabGroup');
    const groupRect = tabGroup.getBoundingClientRect();
    const tabRect   = activeTab.getBoundingClientRect();
    slider.style.left  = (tabRect.left - groupRect.left) + 'px';
    slider.style.width = tabRect.width + 'px';
}

function switchMode(mode) {
    const uploadCont = document.getElementById("uploadContainer");
    const peerCont   = document.getElementById("peerContainer");
    modeTabs.forEach(t => t.classList.remove('active'));
    const active = document.getElementById(mode === 'peer' ? 'modePeer' : 'modeUpload');
    active.classList.add('active');
    positionSlider(active);
    if (mode === 'peer') {
        uploadCont.classList.add('hidden');
        peerCont.classList.remove('hidden');
    } else {
        uploadCont.classList.remove('hidden');
        peerCont.classList.add('hidden');
    }
}

window.addEventListener('resize', () => { const a = document.querySelector('.mode-tab.active'); if (a) positionSlider(a); });
// --- PEER TO PEER ---
let p2pFiles = [];
let p2pConnection = null;
let p2pDataChannel = null;
let p2pWs = null;
let p2pRoomId = null;       // assigned by backend after room_created
let p2pMyClientId = null;   // assigned by backend on connect
let p2pPeerId = null;       // the other side's clientId
let p2pIsSender = false;
let p2pAccepted = false;    // receiver clicked Accept
let p2pReceiveBuffers = {}; // { [fileName]: { chunks, received, total, meta } }

const p2pDropZone  = document.getElementById('p2pDropZone');
const p2pFileInput = document.getElementById('p2pFileInput');
const p2pFilesList = document.getElementById('p2pFilesList');
const p2pDzInner   = document.getElementById('p2pDzInner');
const p2pCreateBtn = document.getElementById('p2pCreateBtn');

// Drop zone
p2pDropZone.addEventListener('click', (e) => { 
    if (e.target === p2pFileInput) return;
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
        renderP2PPill(file);
    });
    toggleP2PUI();
}

function toggleP2PUI() {
    const has = p2pFiles.length > 0;
    p2pCreateBtn.classList.toggle('visible', has);
}

const p2pPillMap = new WeakMap();

function renderP2PPill(file) {
    const pill = document.createElement('div');
    pill.className = 'file-pill';
    const icon = document.createElement('div'); icon.className = 'file-icon'; icon.textContent = getExt(file.name);
    const info = document.createElement('div'); info.className = 'file-info';
    const nameEl = document.createElement('div'); nameEl.className = 'file-name'; nameEl.textContent = file.name;
    const meta = document.createElement('div'); meta.className = 'file-meta';
    const sizeEl = document.createElement('span'); sizeEl.textContent = formatBytes(file.size);
    const progWrap = document.createElement('div'); progWrap.className = 'file-prog-wrap';
    const progBar  = document.createElement('div'); progBar.className  = 'file-prog-bar';
    progWrap.appendChild(progBar); meta.appendChild(sizeEl); meta.appendChild(progWrap);
    info.appendChild(nameEl); info.appendChild(meta);
    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-remove'; removeBtn.title = 'Remove';
    removeBtn.innerHTML = `<svg style="pointer-events:none;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    pill.appendChild(icon); pill.appendChild(info); pill.appendChild(removeBtn);
    p2pFilesList.appendChild(pill);
    p2pPillMap.set(file, { pill, progBar });
    removeBtn.addEventListener('click', e => {
        e.stopPropagation();
        p2pFiles = p2pFiles.filter(f => !(f.name === file.name && f.size === file.size));
        pill.style.transition = 'opacity 0.18s, transform 0.18s';
        pill.style.opacity = '0'; pill.style.transform = 'translateY(-4px) scale(0.97)';
        setTimeout(() => { pill.remove(); toggleP2PUI(); }, 180);
    });
}

function setP2PPillProgress(file, pct) {
    const e = p2pPillMap.get(file);
    if (e) e.progBar.style.width = pct + '%';
}

// ── Signaling helpers ──────────────────────────────────────────────────────

function wsSend(msg) {
    if (p2pWs && p2pWs.readyState === WebSocket.OPEN) p2pWs.send(JSON.stringify(msg));
}

// Signal wrapper — matches backend's #forwardSignal which expects:
// { type:'signal', roomId, data:{ targetId, signalType, signalData } }
function sendSignal(signalType, signalData) {
    if (!p2pRoomId) {
        console.error('[P2P] Cannot send signal - roomId not set');
        return;
    }
    if (!p2pPeerId) {
        console.warn('[P2P] sendSignal called but p2pPeerId not set yet, using broadcast');
        wsSend({ type: 'signal', roomId: p2pRoomId, data: { targetId: '*', signalType, signalData } });
    } else {
        wsSend({ type: 'signal', roomId: p2pRoomId, data: { targetId: p2pPeerId, signalType, signalData } });
    }
}

// ── Connect to backend WS ──────────────────────────────────────────────────

function p2pConnect(isSender, onReady) {
    p2pIsSender = isSender;
    const _wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    p2pWs = new WebSocket(`${_wsProto}//${location.host}/ws`);

    p2pWs.onopen = () => console.log('[P2P] WS open');

    p2pWs.onmessage = async (ev) => {
        const msg = JSON.parse(ev.data);
        console.log('[P2P] ←', msg);

        switch (msg.type) {
            // Backend sends this immediately on connect
            case 'connected':
                p2pMyClientId = msg.clientId;
                onReady();
                break;

            // Sender: backend confirmed room created, roomId is backend-assigned
            case 'room_created':
                p2pRoomId = msg.roomId;
                // Build share link with backend roomId
                const link = `${window.location.origin}${window.location.pathname}?p2p=${p2pRoomId}`;
                document.getElementById('p2pShareLink').value = link;
                QRCode.toCanvas(document.getElementById('p2pQR'), link, { width: 200, margin: 1 }, () => {});
                document.getElementById('p2pFileCount').textContent =
                    `${p2pFiles.length} file${p2pFiles.length !== 1 ? 's' : ''} ready`;
                document.getElementById('p2pUploadStep').classList.add('hidden');
                document.getElementById('p2pShareStep').classList.remove('hidden');
                break;

            // Someone joined our room — that's the receiver
            case 'user_joined':
                if (isSender && msg.clientId !== p2pMyClientId) {
                    p2pPeerId = msg.clientId;
                    // Start WebRTC offer
                    await p2pStartWebRTC(true);
                }
                break;

            // Receiver: joined successfully, get sender info from room metadata
            case 'room_joined':
                // sender info is in msg.room.metadata
                const meta = msg.room?.metadata || {};
                document.getElementById('p2pSenderName').textContent =
                    meta.userName ? `${meta.userName}'s files` : 'Incoming files';
                document.getElementById('p2pReceiveFileCount').textContent =
                    meta.files ? `${meta.files.length} file${meta.files.length !== 1 ? 's' : ''}` : '';
                // Populate file list for receiver
                renderReceiveFileList(meta.files || []);
                document.getElementById('p2pUploadStep').classList.add('hidden');
                document.getElementById('p2pReceiveStep').classList.remove('hidden');
                break;

            // WebRTC signaling relayed through backend
            case 'signal':
                p2pPeerId = p2pPeerId || msg.fromId;
                if (msg.signalType === 'offer')         await p2pHandleOffer(msg.signalData);
                else if (msg.signalType === 'answer')   await p2pHandleAnswer(msg.signalData);
                else if (msg.signalType === 'ice')      await p2pHandleIce(msg.signalData);
                break;

            case 'error':
                console.error('[P2P] server error:', msg.message);
                break;
        }
    };

    p2pWs.onerror = () => alert('WebSocket connection failed. Is the backend running?');
    p2pWs.onclose = () => console.log('[P2P] WS closed');
}

// ── WebRTC ─────────────────────────────────────────────────────────────────

async function p2pStartWebRTC(isInitiator) {
    p2pConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    p2pConnection.onicecandidate = (e) => {
        if (e.candidate) sendSignal('ice', e.candidate);
    };

    if (isInitiator) {
        p2pDataChannel = p2pConnection.createDataChannel('files');
        setupSenderChannel();
        const offer = await p2pConnection.createOffer();
        await p2pConnection.setLocalDescription(offer);
        sendSignal('offer', offer);
    } else {
        p2pConnection.ondatachannel = (e) => {
            p2pDataChannel = e.channel;
            setupReceiverChannel();
        };
    }
}

async function p2pHandleOffer(offer) {
    await p2pStartWebRTC(false);
    await p2pConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await p2pConnection.createAnswer();
    await p2pConnection.setLocalDescription(answer);
    sendSignal('answer', answer);
}

async function p2pHandleAnswer(answer) {
    await p2pConnection.setRemoteDescription(new RTCSessionDescription(answer));
}

async function p2pHandleIce(candidate) {
    try { await p2pConnection.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
}

// ── Data channel — sender side ─────────────────────────────────────────────

const CHUNK_SIZE = 64 * 1024; // 64 KB

function setupSenderChannel() {
    p2pDataChannel.onopen = async () => {
        console.log('[P2P] data channel open — sending files');
        document.getElementById('p2pShareStep').classList.add('hidden');
        document.getElementById('p2pTransferStep').classList.remove('hidden');
        await sendAllFiles();
    };
    p2pDataChannel.onerror = (e) => console.error('[P2P] channel error', e);
}

async function sendAllFiles() {
    let totalBytes = p2pFiles.reduce((s, f) => s + f.size, 0);
    let sentBytes  = 0;

    for (const file of p2pFiles) {
        // Send metadata header
        p2pDataChannel.send(JSON.stringify({
            kind: 'meta', name: file.name, size: file.size, type: file.type
        }));

        // Send file in chunks
        let offset = 0;
        while (offset < file.size) {
            // Respect buffer backpressure
            while (p2pDataChannel.bufferedAmount > 4 * 1024 * 1024) {
                await new Promise(r => setTimeout(r, 50));
            }
            const slice = file.slice(offset, offset + CHUNK_SIZE);
            const buf   = await slice.arrayBuffer();
            p2pDataChannel.send(buf);
            offset    += buf.byteLength;
            sentBytes += buf.byteLength;
            const pct = Math.round(sentBytes / totalBytes * 100);
            document.getElementById('p2pTransferBar').style.width = pct + '%';
            document.getElementById('p2pTransferInfo').textContent =
                `${pct}% • ${formatBytes(sentBytes)} / ${formatBytes(totalBytes)}`;
            setP2PPillProgress(file, Math.round(offset / file.size * 100));
        }

        // End-of-file marker
        p2pDataChannel.send(JSON.stringify({ kind: 'eof', name: file.name }));
    }

    document.getElementById('p2pTransferStatus').textContent = 'Done!';
    document.getElementById('p2pTransferInfo').textContent = 'All files sent.';
}

// ── Data channel — receiver side ───────────────────────────────────────────

function setupReceiverChannel() {
    let currentMeta = null;
    let chunks = [];
    let received = 0;

    p2pDataChannel.onmessage = (e) => {
        if (typeof e.data === 'string') {
            const msg = JSON.parse(e.data);
            if (msg.kind === 'meta') {
                currentMeta = msg;
                chunks = []; received = 0;
            } else if (msg.kind === 'eof' && currentMeta) {
                // Assemble and trigger download
                const blob = new Blob(chunks, { type: currentMeta.type || 'application/octet-stream' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href = url; a.download = currentMeta.name; a.click();
                URL.revokeObjectURL(url);
                currentMeta = null; chunks = []; received = 0;
            }
        } else {
            // Binary chunk
            chunks.push(e.data);
            received += e.data.byteLength;
            if (currentMeta) {
                const pct = Math.round(received / currentMeta.size * 100);
                document.getElementById('p2pTransferBar').style.width = pct + '%';
                document.getElementById('p2pTransferInfo').textContent =
                    `${pct}% • ${formatBytes(received)} / ${formatBytes(currentMeta.size)}`;
                document.getElementById('p2pTransferStatus').textContent = `Receiving ${currentMeta.name}…`;
            }
        }
    };

    p2pDataChannel.onopen = () => {
        document.getElementById('p2pReceiveStep').classList.add('hidden');
        document.getElementById('p2pTransferStep').classList.remove('hidden');
        document.getElementById('p2pTransferStatus').textContent = 'Receiving…';
    };
}

// ── Receiver file list ─────────────────────────────────────────────────────

function renderReceiveFileList(files) {
    const list = document.getElementById('p2pReceiveFilesList');
    list.innerHTML = '';
    if (!files.length) { list.innerHTML = '<p class="dl-empty">File list loading…</p>'; return; }
    files.forEach(f => {
        const row = document.createElement('div'); row.className = 'dl-file-row';
        const left = document.createElement('div'); left.className = 'dl-file-left';
        const icon = document.createElement('div'); icon.className = 'file-icon'; icon.textContent = getExt(f.name);
        const info = document.createElement('div'); info.className = 'file-info';
        info.innerHTML = `<div class="file-name">${f.name}</div><div class="file-meta"><span>${formatBytes(f.size)}</span></div>`;
        left.appendChild(icon); left.appendChild(info); row.appendChild(left);
        list.appendChild(row);
    });
}

// ── UI actions ─────────────────────────────────────────────────────────────

p2pCreateBtn.addEventListener('click', () => {
    if (!p2pFiles.length) return;
    const name = localStorage.getItem('username');
    if (!name) { startEditName(); return; }

    p2pConnect(true, () => {
        // onReady: we have our clientId, now create the room
        wsSend({
            type: 'create_room',
            data: {
                mode: 'p2p',
                metadata: {
                    userName: name,
                    files: p2pFiles.map(f => ({ name: f.name, size: f.size }))
                }
            }
        });
    });
});

document.getElementById('p2pCopyBtn').onclick = () => {
    navigator.clipboard.writeText(document.getElementById('p2pShareLink').value);
    showToast('Link Copied!');
};

function cancelP2PShare() {
    if (p2pWs) p2pWs.close();
    if (p2pConnection) p2pConnection.close();
    p2pFiles = []; p2pRoomId = null; p2pPeerId = null;
    p2pFilesList.innerHTML = '';
    p2pDzInner.style.display = '';
    p2pCreateBtn.classList.remove('visible');
    document.getElementById('tabGroup').style.display = 'flex';
    document.getElementById('p2pShareStep').classList.add('hidden');
    document.getElementById('p2pUploadStep').classList.remove('hidden');
    history.replaceState(null, '', window.location.pathname);
}

function exitP2PReceive() {
    if (p2pWs) p2pWs.close();
    if (p2pConnection) p2pConnection.close();
    p2pRoomId = null; p2pPeerId = null;
    document.getElementById('tabGroup').style.display = 'flex';
    document.getElementById('p2pReceiveStep').classList.add('hidden');
    document.getElementById('p2pUploadStep').classList.remove('hidden');
    history.replaceState(null, '', window.location.pathname);
}

// Accept button — receiver already has WebRTC connection being set up,
// just show transfer UI (channel open event will handle the rest)
document.getElementById('p2pAcceptBtn').addEventListener('click', () => {
    p2pAccepted = true;
    document.getElementById('p2pReceiveStep').classList.add('hidden');
    document.getElementById('p2pTransferStep').classList.remove('hidden');
    document.getElementById('p2pTransferStatus').textContent = 'Waiting for sender…';
    document.getElementById('p2pTransferInfo').textContent = 'Connection established, transfer will begin shortly.';
});

// ── Receiver entry via ?p2p= URL ───────────────────────────────────────────

const p2pParam = new URLSearchParams(window.location.search).get('p2p');
const roomParam = new URLSearchParams(window.location.search).get('room');

// Single unified initialization routing
requestAnimationFrame(() => {
    if (p2pParam) {
        switchMode('peer');
        document.getElementById('tabGroup').style.display = 'none';
        document.getElementById('p2pUploadStep').classList.add('hidden');
        p2pRoomId = p2pParam.toUpperCase();
        const name = localStorage.getItem('username') || 'Guest';

        console.log('[P2P] Receiver mode - joining room:', p2pRoomId);

        p2pConnect(false, () => {
            // onReady: join the room using the roomId from the URL
            console.log('[P2P] Connected, sending join_room');
            wsSend({
                type: 'join_room',
                data: { roomId: p2pRoomId, metadata: { userName: name } }
            });
        });
    } else if (roomParam) {
        // Automatically open the download view
        loadDownloadView(roomParam.toUpperCase());
    } else {
        // Default page load
        const activeUploadStr = localStorage.getItem('activeCloudUpload');
        let restored = false;
        if (activeUploadStr) {
            try {
                const active = JSON.parse(activeUploadStr);
                if (active.expiresAt > Date.now()) {
                    switchMode('upload');
                    showCloudRoomActive(active.code, active.expiresAt, active.link);
                    restored = true;
                } else {
                    localStorage.removeItem('activeCloudUpload');
                }
            } catch(e) {}
        }
        if (!restored) {
            switchMode('peer');
        }
        renderActiveRooms();
    }
});


// --- UTILS ---
let toastTimeout;
function showToast(msg) {
    const toast = document.getElementById("toast");
    toast.textContent = msg;
    toast.style.display = 'block'; // Failsafe if CSS is missing
    toast.classList.add("show");
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => { if (!toast.classList.contains("show")) toast.style.display = ''; }, 300);
    }, 2500);
}

document.getElementById("copyCodeBtn").onclick = () => {
    navigator.clipboard.writeText(document.getElementById("cloudRoomCode").textContent);
    showToast('Room Code Copied!');
};

document.getElementById("copyBtn").onclick = () => {
    navigator.clipboard.writeText(document.getElementById("shareLink").value);
    showToast('Share Link Copied!');
};

// ─── GDG LOGO ANIMATION ───────────────────────────────────────────────────────
(function () {
    function gdgSpring(from, to, stiffness, damping, mass) {
        stiffness = stiffness || 180; damping = damping || 20; mass = mass || 1;
        const diff = to - from;
        const w0 = Math.sqrt(stiffness / mass);
        const zeta = damping / (2 * Math.sqrt(stiffness * mass));
        if (zeta < 1) {
            const wd = w0 * Math.sqrt(1 - zeta * zeta);
            return t => to - Math.exp(-zeta * w0 * t) * (diff * Math.cos(wd * t) + (diff * zeta * w0 / wd) * Math.sin(wd * t));
        }
        return t => to - diff * Math.exp(-w0 * t) * (1 + w0 * t);
    }
    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const easeIn  = t => t * t * t;
    function anim(duration, tickFn, doneFn) {
        let start = null;
        function f(ts) {
            if (!start) start = ts;
            const t = Math.min((ts - start) / duration, 1);
            tickFn(t);
            if (t < 1) requestAnimationFrame(f);
            else if (doneFn) doneFn();
        }
        requestAnimationFrame(f);
    }
    const gdgDots = { blue: document.getElementById('dot-blue'), red: document.getElementById('dot-red'), yellow: document.getElementById('dot-yellow'), green: document.getElementById('dot-green') };
    const gdgLogoSvg = document.getElementById('logo-svg');
    const gdgCaps = { blue: document.getElementById('cap-blue'), red: document.getElementById('cap-red'), yellow: document.getElementById('cap-yellow'), green: document.getElementById('cap-green'), 'blue-out': document.getElementById('cap-blue-out'), 'red-out': document.getElementById('cap-red-out'), 'yellow-out': document.getElementById('cap-yellow-out'), 'green-out': document.getElementById('cap-green-out') };
    const KEYS = ['blue', 'red', 'yellow', 'green'];
    const dotHome   = { blue: { x: 99, y: 110 }, red: { x: 141, y: 110 }, yellow: { x: 183, y: 110 }, green: { x: 225, y: 110 } };
    const capTarget = { blue: { x: 118, y: 91 }, red: { x: 118, y: 129 }, yellow: { x: 222, y: 91 }, green: { x: 222, y: 129 } };
    const gdgLengths = {};
    KEYS.forEach(k => {
        const el = gdgCaps[k];
        const dx = parseFloat(el.getAttribute('x2')) - parseFloat(el.getAttribute('x1'));
        const dy = parseFloat(el.getAttribute('y2')) - parseFloat(el.getAttribute('y1'));
        gdgLengths[k] = Math.sqrt(dx * dx + dy * dy);
        [gdgCaps[k], gdgCaps[k + '-out']].forEach(e => { e.style.strokeDasharray = gdgLengths[k]; e.style.strokeDashoffset = gdgLengths[k]; });
    });
    function setDotPos(key, x, y, scale) {
        scale = scale === undefined ? 1 : scale;
        gdgDots[key].style.transform = `translateY(-50%) translate(${x - dotHome[key].x}px,${y - dotHome[key].y}px) scale(${scale})`;
    }
    function resetDot(key) { gdgDots[key].style.transform = 'translateY(-50%)'; }
    function startBounce(duration, onDone) {
        const delays = { blue: 0, red: 0.15, yellow: 0.30, green: 0.45 };
        const amp = 32; let start = null;
        function frame(ts) {
            if (!start) start = ts;
            const elapsed = (ts - start) / 1000;
            KEYS.forEach(k => { const t = elapsed - delays[k]; if (t < 0) return; setDotPos(k, dotHome[k].x, dotHome[k].y - Math.abs(Math.sin(Math.PI * t * 2.8)) * amp * Math.exp(-1.2 * t)); });
            if (elapsed < duration) requestAnimationFrame(frame);
            else { KEYS.forEach(k => resetDot(k)); if (onDone) onDone(); }
        }
        requestAnimationFrame(frame);
    }
    function morphToLogo(onDone) {
        gdgLogoSvg.style.opacity = '1';
        const stagger = { blue: 0, red: 80, yellow: 50, green: 130 };
        let done = 0;
        KEYS.forEach(k => {
            setTimeout(() => {
                const from = dotHome[k], to = capTarget[k];
                const sx = gdgSpring(from.x, to.x, 220, 22), sy = gdgSpring(from.y, to.y, 220, 22);
                anim(700, t => { setDotPos(k, sx(t * 0.9), sy(t * 0.9), 1 - easeIn(t) * 0.9); }, () => { gdgDots[k].style.opacity = '0'; if (++done === 4) drawCaps(onDone); });
            }, stagger[k]);
        });
    }
    function drawCaps(onDone) {
        const stagger = { blue: 0, red: 60, yellow: 40, green: 100 }; let done = 0;
        KEYS.forEach(k => { setTimeout(() => { anim(500, t => { const v = gdgLengths[k] * (1 - easeOut(t)); gdgCaps[k].style.strokeDashoffset = v; gdgCaps[k+'-out'].style.strokeDashoffset = v; }, () => { if (++done === 4 && onDone) onDone(); }); }, stagger[k]); });
    }
    function unmorphToDots(onDone) {
        const stagger = { blue: 100, red: 40, yellow: 60, green: 0 }; let done = 0;
        KEYS.forEach(k => { setTimeout(() => { anim(400, t => { const v = gdgLengths[k] * easeIn(t); gdgCaps[k].style.strokeDashoffset = v; gdgCaps[k+'-out'].style.strokeDashoffset = v; }, () => { if (++done === 4) emergeDots(onDone); }); }, stagger[k]); });
    }
    function emergeDots(onDone) {
        gdgLogoSvg.style.opacity = '0';
        const stagger = { blue: 0, red: 70, yellow: 40, green: 110 }; let done = 0;
        KEYS.forEach(k => {
            gdgDots[k].style.opacity = '1';
            setTimeout(() => {
                const from = capTarget[k], to = dotHome[k];
                const sx = gdgSpring(from.x, to.x, 200, 18), sy = gdgSpring(from.y, to.y, 200, 18);
                anim(650, t => { setDotPos(k, sx(t * 0.9), sy(t * 0.9), easeOut(t)); }, () => { resetDot(k); if (++done === 4 && onDone) onDone(); });
            }, stagger[k]);
        });
    }
    function gdgLoop() {
        KEYS.forEach(k => { gdgDots[k].style.opacity = '1'; resetDot(k); gdgCaps[k].style.strokeDashoffset = gdgLengths[k]; gdgCaps[k+'-out'].style.strokeDashoffset = gdgLengths[k]; });
        gdgLogoSvg.style.opacity = '0';
        startBounce(2.2, () => morphToLogo(() => setTimeout(() => unmorphToDots(() => setTimeout(gdgLoop, 400)), 1200)));
    }
    setTimeout(gdgLoop, 300);
})();

// --- Dropdown Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const dd = document.getElementById('expiryDropdown');
    if (!dd) return;
    const selected = dd.querySelector('.dropdown-selected');
    const optionsCont = dd.querySelector('.dropdown-options');
    const options = dd.querySelectorAll('.dropdown-option');
    const hiddenInput = document.getElementById('expirySelect');
    const currentText = document.getElementById('expiryCurrentText');

    selected.addEventListener('click', (e) => {
        e.stopPropagation();
        optionsCont.classList.toggle('show');
        selected.classList.toggle('open');
    });

    options.forEach(opt => {
        opt.addEventListener('click', () => {
            currentText.textContent = opt.textContent;
            hiddenInput.value = opt.getAttribute('data-val');
            options.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            optionsCont.classList.remove('show');
            selected.classList.remove('open');
        });
    });

    document.addEventListener('click', () => {
        optionsCont.classList.remove('show');
        selected.classList.remove('open');
    });
});

// Live ticking timers for the Active Rooms panel
setInterval(() => {
    let expiredFound = false;
    document.querySelectorAll('.room-meta[data-expires]').forEach(el => {
        const expiresAt = parseInt(el.getAttribute('data-expires'));
        if (Date.now() >= expiresAt) {
            expiredFound = true;
        } else {
            const remaining = expiresAt - Date.now();
            const hrs = Math.floor(remaining / 3600000);
            const mins = Math.floor((remaining % 3600000) / 60000);
            el.textContent = hrs > 0 ? `${hrs}h ${mins}m left` : `${mins}m left`;
        }
    });
    if (expiredFound) renderActiveRooms();
}, 60000);

/* ── Spotlight ──────────────────────────────── */
function spotlight(e, card) {
  const r = card.getBoundingClientRect();
  const sp = card.querySelector('.card-spotlight');
  if(!sp) return;
  sp.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  sp.style.setProperty('--my', (e.clientY - r.top) + 'px');
}

/* ── Tesstimonial Typewriter ─────────────────────────────── */
const phrases = ['students who ship.','the GDG Cloud Team.','the team behind Zap.'];
let pi=0,ci=0,del=false;
const twEl = document.getElementById('twLine');
function pTick() {
  if (!twEl) return;
  const p = phrases[pi];
  if (!del) {
    ci++;
    twEl.innerHTML = p.slice(0,ci) + '<span class="tw-cursor"></span>';
    if (ci===p.length) { del=true; setTimeout(pTick,2000); return; }
    setTimeout(pTick,55);
  } else {
    ci--;
    twEl.innerHTML = p.slice(0,ci) + '<span class="tw-cursor"></span>';
    if (ci===0) { del=false; pi=(pi+1)%phrases.length; setTimeout(pTick,350); return; }
    setTimeout(pTick,30);
  }
}
setTimeout(pTick,700);


/* ── Dev avatars ────────────────────────────── */
const devs = [
  { initials:'AB', name:'Anisha Bhargava',  role:'Cloud Chapter Lead',     quote:'"Leading the cloud, one deploy at a time."',          bg:'#1e2535', color:'#7aa2f7', li:'https://www.linkedin.com/in/anisha-bhargava19/',           photo:'assets/anisha.png' },
  { initials:'RR', name:'Ritwik Rish Raj',  role:'Cloud Team · Developer', quote:'"Building at the edge is building for the future."',  bg:'#1f2820', color:'#7dcfab', li:'https://www.linkedin.com/in/ritwik-rish-raj-4880a8322/', photo:'assets/ritwik.png' },
  { initials:'MM', name:'Mayank Mishra',    role:'Cloud Team · Developer', quote:'"Every line of code is a step toward scale."',        bg:'#251e2b', color:'#bb9af7', li:'https://www.linkedin.com/in/mayank-mishra-417864316/',  photo:'assets/mayank.png' },
  { initials:'AS', name:'Adarsh Srivastava',role:'Cloud Team · Developer', quote:'"Serverless is not just a trend — it\'s the future."',bg:'#2b1e1e', color:'#f7768e', li:'https://www.linkedin.com/in/adarsh-srivastava-08947631a/',photo:'assets/adarsh.png' },
  { initials:'SP', name:'Sayan Pal',        role:'Cloud Team · Developer', quote:'"Good infrastructure is invisible infrastructure."',   bg:'#1e2820', color:'#9ece6a', li:'https://linkedin.com/in/sayarch/',                        photo:'assets/sayan.png' },
  { initials:'AG', name:'Agam Singh Saluja',role:'Cloud Team · Developer', quote:'"Ship fast, iterate faster."',                        bg:'#2b2318', color:'#e0af68', li:'https://www.linkedin.com/in/agam-singh-saluja',            photo:'assets/agam.png' },
  { initials:'RS', name:'Riddhi Sardar',    role:'Cloud Team · Developer', quote:'"The best products solve real problems simply."',     bg:'#1e2530', color:'#2ac3de', li:'https://www.linkedin.com/in/riddhi-sardar-131a29319',      photo:'assets/riddhi.png' },
];

let selectedDevIdx = 0;
let devCycleInverval = null;

function avatarImg(d, size=44) {
  // Priority: local photo -> initials
  const initSpan = `<span style="display:none;width:${size}px;height:${size}px;border-radius:50%;background:${d.bg};color:${d.color};font-family:var(--mono,'DM Mono',monospace);font-size:${size<40?'0.55':'0.65'}rem;font-weight:500;align-items:center;justify-content:center;">${d.initials}</span>`;
  if (d.photo) {
    return `<img src="${d.photo}" alt="${d.name}"
      style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;display:block;"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"/>
    ${initSpan}`;
  } else {
    return initSpan.replace('display:none', 'display:flex');
  }
}

function renderStrip() {
  const strip = document.getElementById('avatarStrip');
  if(!strip) return;
  strip.innerHTML = devs.map((d,i) => `
    <button class="avatar-item ${i===selectedDevIdx?'selected':''}" data-i="${i}"
       style="background:${d.bg};color:${d.color};padding:0;overflow:hidden;"
       onclick="selectDev(${i})">
      ${avatarImg(d, 44)}
    </button>`).join('');
}

function renderCard() {
  const wrap  = document.getElementById('devCardWrap');
  if(!wrap) return;
  const d = devs[selectedDevIdx];
  wrap.innerHTML = `
    <a class="dev-card-active" href="${d.li}" target="_blank" rel="noopener">
      <div class="dev-card-avatar" style="background:${d.bg};color:${d.color};overflow:hidden;padding:0;">
        ${avatarImg(d, 40)}
      </div>
      <div class="dev-card-info">
        <div class="dev-card-name">${d.name}</div>
        <div class="dev-card-role">${d.role}</div>
        <div class="dev-card-quote">${d.quote}</div>
      </div>
      <svg class="li-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
    </a>`;
}

function selectDev(i) {
  selectedDevIdx = i;
  renderStrip();
  renderCard();
  clearInterval(devCycleInverval);
}

// Initial renders
if (document.getElementById('avatarStrip')) {
    renderStrip();
    renderCard();
    devCycleInverval = setInterval(() => {
        selectedDevIdx = (selectedDevIdx + 1) % devs.length;
        renderStrip();
        renderCard();
    }, 4000);
}
