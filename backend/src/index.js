/**
 * Zap Backend — Cloudflare Worker Entry Point
 *
 * Replaces the Node.js Express + ws backend for Cloudflare deployment.
 * The existing backend/ folder is kept for local development.
 *
 * Architecture:
 *  - This Worker handles REST API routes and WebSocket upgrades.
 *  - All WebSocket/room/relay state lives in the ZapHub Durable Object.
 *  - Files are stored in Cloudflare R2 (env.FILES) via streaming PUT.
 *  - A KV counter tracks total R2 usage to enforce the 8 GB cap.
 *  - A Cron Trigger (every 10 min) cleans up expired room data and old R2 files.
 */

import { ZapHub } from './ZapHub.js';
export { ZapHub };

// Constants

const MAX_FILE_SIZE_GB  = 2;
const MAX_STORAGE_GB    = 8;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helpers

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

function err(msg, status = 400) {
  return json({ error: msg }, status);
}

function generateKey(roomId, fileName) {
  return `rooms/${roomId}/${Date.now()}-${fileName}`;
}

/** Returns the single global ZapHub Durable Object stub. */
function getHub(env) {
  return env.HUB.get(env.HUB.idFromName('global'));
}

/**
 * Forward an internal request to the Hub Durable Object.
 * The Hub exposes HTTP at /internal/* for the Worker to query room state.
 */
async function hubFetch(env, path, options = {}) {
  const hub = getHub(env);
  return hub.fetch(new Request(`http://do-internal${path}`, options));
}

// Main Worker

export default {

  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // WebSocket upgrade → delegate to ZapHub DO
    if (request.headers.get('Upgrade') === 'websocket' && path === '/ws') {
      return getHub(env).fetch(request);
    }

    // R2 file upload (Worker proxies the PUT stream to R2)
    // The client receives this URL from /api/upload-url and PUTs the file here.
    if (method === 'PUT' && path.startsWith('/api/r2/upload/')) {
      return handleR2Upload(request, env, path);
    }

    // R2 file download (Worker proxies the GET stream from R2)
    if (method === 'GET' && path.startsWith('/api/r2/download/')) {
      return handleR2Download(request, env, path);
    }

    // REST API
    if (path === '/api/health') {
      return json({
        status:    'healthy',
        timestamp: new Date().toISOString(),
        version:   '2.0.0-worker',
        runtime:   'cloudflare-workers',
      });
    }

    if (path === '/api/upload-url'      && method === 'POST') return handleUploadUrl(request, env);
    if (path === '/api/download-url'    && method === 'POST') return handleDownloadUrl(request, env);
    if (path === '/api/upload-complete' && method === 'POST') return handleUploadComplete(request, env);
    if (path === '/api/validate-file'   && method === 'POST') return handleValidateFile(request, env);
    if (path === '/api/storage-stats'   && method === 'GET')  return handleStorageStats(env);

    if (path === '/api/room-stats' && method === 'GET') {
      const resp = await hubFetch(env, '/internal/room-stats');
      return json(await resp.json());
    }

    if (path === '/api/cleanup' && method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const resp = await hubFetch(env, '/internal/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return json(await resp.json());
    }

    // Cloud Hold routes (merged from cloud-hold-worker)
    // These mirror the cloud-hold-worker API so the frontend cloudhold.js
    // works with CLOUD_HOLD_API pointing to the same origin when WS_URL = "".

    // PUT /api/room/upload-file/:code/:fileId/:fileName
    const uploadFileMatch = path.match(/^\/api\/room\/upload-file\/([A-Z0-9]{6})\/([a-z0-9-]+)\/(.+)$/);
    if (method === 'PUT' && uploadFileMatch) {
      return cloudHoldHandleUploadFile(request, env, uploadFileMatch[1], uploadFileMatch[2], uploadFileMatch[3]);
    }

    if (path === '/api/room/create'          && method === 'POST') return cloudHoldCreateRoom(request, env);
    if (path === '/api/room/upload'          && method === 'POST') return cloudHoldUpload(request, env);
    if (path === '/api/room/upload-complete' && method === 'POST') return cloudHoldUploadComplete(request, env);

    // GET /api/room/:code
    const roomMatch = path.match(/^\/api\/room\/([A-Z0-9]{6})$/);
    if (method === 'GET' && roomMatch) return cloudHoldGetRoom(roomMatch[1], env);

    // GET /api/room/:code/download/:fileId
    const downloadMatch = path.match(/^\/api\/room\/([A-Z0-9]{6})\/download\/(.+)$/);
    if (method === 'GET' && downloadMatch) return cloudHoldDownload(downloadMatch[1], downloadMatch[2], env);

    return err('Not found', 404);

  },

  // Cron: runs every 10 minutes
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runCleanup(env));
  },
};

// Cron Cleanup

async function runCleanup(env) {
  // 1. Cleanup expired rooms inside the Durable Object
  await hubFetch(env, '/internal/cleanup', { method: 'POST' });

  // 2. Delete R2 objects older than 48 hours (orphan cleanup)
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  let cursor;
  let deletedCount = 0;

  do {
    const listed = await env.FILES.list({ prefix: 'rooms/', cursor, limit: 500 });
    for (const obj of listed.objects) {
      if (obj.uploaded.getTime() < cutoff) {
        await env.FILES.delete(obj.key);
        deletedCount++;
      }
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  if (deletedCount > 0) {
    console.log(`[cleanup] Deleted ${deletedCount} orphaned R2 objects`);
  }
}

// R2 Upload/Download Proxy

async function handleR2Upload(request, env, path) {
  const key = decodeURIComponent(path.replace('/api/r2/upload/', ''));

  await env.FILES.put(key, request.body, {
    httpMetadata: {
      contentType: request.headers.get('Content-Type') || 'application/octet-stream',
    },
  });

  return json({ success: true, key });
}

async function handleR2Download(request, env, path) {
  const key = decodeURIComponent(path.replace('/api/r2/download/', ''));
  const obj = await env.FILES.get(key);

  if (!obj) return err('File not found', 404);

  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', obj.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
  if (obj.size) headers.set('Content-Length', String(obj.size));

  return new Response(obj.body, { headers });
}

// REST Route Handlers

async function handleUploadUrl(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON body'); }

  const { roomId, fileName, fileSize, contentType } = body;
  if (!roomId || !fileName || !fileSize) return err('Missing required fields: roomId, fileName, fileSize');

  // Validate room exists via Hub DO
  const roomCheck = await hubFetch(env, '/internal/room-lookup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId }),
  });
  if (!roomCheck.ok) return err('Room not found', 404);

  // Validate file size
  const maxFileBytes = MAX_FILE_SIZE_GB * 1024 * 1024 * 1024;
  if (fileSize > maxFileBytes) return err(`File exceeds maximum allowed size of ${MAX_FILE_SIZE_GB}GB`);

  // Check global R2 storage cap via KV counter (avoids expensive R2 list on every upload)
  const storedUsage = parseInt((await env.ROOMS_KV.get('r2_usage_bytes')) || '0');
  const maxStorageBytes = MAX_STORAGE_GB * 1024 * 1024 * 1024;
  if (storedUsage + fileSize > maxStorageBytes) {
    return err(`Storage capacity exceeded. Used: ${formatBytes(storedUsage)}, Max: ${formatBytes(maxStorageBytes)}`);
  }

  // Build the upload URL — client will PUT to this Worker endpoint
  const key        = generateKey(roomId, fileName);
  const uploadUrl  = new URL(request.url);
  uploadUrl.pathname = `/api/r2/upload/${encodeURIComponent(key)}`;

  return json({ uploadUrl: uploadUrl.toString(), key, expiresIn: 3600 });
}

async function handleDownloadUrl(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON body'); }

  const { key } = body;
  if (!key) return err('Missing required field: key');

  const downloadUrl = new URL(request.url);
  downloadUrl.pathname = `/api/r2/download/${encodeURIComponent(key)}`;

  return json({ downloadUrl: downloadUrl.toString(), expiresIn: 3600 });
}

async function handleUploadComplete(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON body'); }

  const { roomId, key, fileName, fileSize } = body;
  if (!roomId || !key) return err('Missing required fields: roomId, key');

  // Increment R2 usage counter in KV
  const current = parseInt((await env.ROOMS_KV.get('r2_usage_bytes')) || '0');
  await env.ROOMS_KV.put('r2_usage_bytes', String(current + (fileSize || 0)));

  // Notify the Hub DO so it can store the file metadata on the room
  await hubFetch(env, '/internal/upload-complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId, key, fileName, fileSize }),
  });

  return json({ success: true });
}

async function handleValidateFile(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON body'); }

  const { fileName, fileSize } = body;
  if (!fileName || !fileSize) return err('Missing required fields: fileName, fileSize');

  const maxFileBytes = MAX_FILE_SIZE_GB * 1024 * 1024 * 1024;
  if (fileSize > maxFileBytes) return err(`File exceeds maximum allowed size of ${MAX_FILE_SIZE_GB}GB`);

  return json({ valid: true, message: 'File validation passed' });
}

async function handleStorageStats(env) {
  const usage     = parseInt((await env.ROOMS_KV.get('r2_usage_bytes')) || '0');
  const maxBytes  = MAX_STORAGE_GB * 1024 * 1024 * 1024;

  return json({
    currentUsage:    usage,
    maxCapacity:     maxBytes,
    usagePercentage: (usage / maxBytes) * 100,
    availableSpace:  maxBytes - usage,
    formatted: {
      used:      formatBytes(usage),
      max:       formatBytes(maxBytes),
      available: formatBytes(maxBytes - usage),
    },
  });
}

// Utilities

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k     = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Cloud Hold Handlers
// Mirrors the standalone cloud-hold-worker API exactly.
// Uses env.ROOMS (KV) for room metadata and env.FILES (R2) for file storage.
// Binding names and R2 key format match the deployed cloud-hold-worker.

const VALID_EXPIRY_SECONDS = { 7200: '2 hours', 14400: '4 hours', 43200: '12 hours', 86400: '24 hours' };

function cloudRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function cloudFileId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function cloudHoldCreateRoom(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON body'); }

  const { name, expiry } = body;
  if (!name || typeof name !== 'string' || !name.trim()) return err('Name is required');
  if (!expiry || !VALID_EXPIRY_SECONDS[expiry]) {
    return err(`Invalid expiry. Must be one of: ${Object.keys(VALID_EXPIRY_SECONDS).join(', ')} (seconds)`);
  }

  // Generate unique 6-char code
  let code, attempts = 0;
  do {
    code = cloudRoomCode();
    const existing = await env.ROOMS.get(`room:${code}`);
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  if (attempts >= 5) return err('Failed to generate unique room code. Try again.', 500);

  const roomData = {
    name: name.trim(), code, files: [],
    createdAt: Date.now(),
    expiresAt: Date.now() + expiry * 1000,
    expirySeconds: expiry,
  };

  await env.ROOMS.put(`room:${code}`, JSON.stringify(roomData), { expirationTtl: expiry });

  return json({ code, name: roomData.name, expiresAt: roomData.expiresAt, expiresIn: VALID_EXPIRY_SECONDS[expiry] }, 201);
}

async function cloudHoldUpload(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON body'); }

  const { code, fileName, fileSize, contentType = 'application/octet-stream' } = body;
  if (!code || !fileName || !fileSize) return err('Missing required fields: code, fileName, fileSize');

  const roomJson = await env.ROOMS.get(`room:${code}`);
  if (!roomJson) return err('Room not found or expired', 404);

  const room = JSON.parse(roomJson);

  const maxFiles = parseInt(env.MAX_ROOM_FILES) || 10;
  if (room.files.length >= maxFiles) return err(`Maximum ${maxFiles} files per room`);

  const maxSizeMB = parseInt(env.MAX_FILE_SIZE_MB) || 2048;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (fileSize > maxSizeBytes) return err(`File too large. Maximum ${maxSizeMB}MB`);

  const fileId = cloudFileId();
  const r2Key = `rooms/${code}/${fileId}-${fileName}`;

  let uploadUrl;
  let uploadMethod = 'worker'; // tells client which flow to follow

  // If R2 credentials are configured → presigned URL so client uploads
  // DIRECTLY to R2 — no Worker in the data path, no 100MB limit.
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
    uploadUrl = await generateR2PresignedUrl(env, r2Key, contentType, 3600);
    uploadMethod = 'presigned';
  } else {
    // Local dev fallback: Worker-proxied upload (fine for files ≤100 MB)
    const workerUrl = new URL(request.url);
    workerUrl.pathname = `/api/room/upload-file/${code}/${fileId}/${encodeURIComponent(fileName)}`;
    uploadUrl = workerUrl.toString();
  }

  return json({ fileId, r2Key, uploadUrl, uploadMethod, maxSize: maxSizeBytes });
}


async function cloudHoldHandleUploadFile(request, env, code, fileId, fileName) {
  const roomJson = await env.ROOMS.get(`room:${code}`);
  if (!roomJson) return err('Room not found or expired', 404);

  const room = JSON.parse(roomJson);
  const decodedFileName = decodeURIComponent(fileName);
  const r2Key = `rooms/${code}/${fileId}-${decodedFileName}`;

  const contentType = request.headers.get('Content-Type') || 'application/octet-stream';

  await env.FILES.put(r2Key, request.body, {
    httpMetadata: { contentType },
    customMetadata: { roomCode: code, fileName: decodedFileName, fileId, uploadedAt: Date.now().toString() },
  });

  const obj = await env.FILES.head(r2Key);
  const fileSize = obj ? obj.size : 0;

  room.files.push({ id: fileId, name: decodedFileName, size: fileSize, r2Key, uploadedAt: Date.now(), contentType });

  const remainingTtl = Math.max(60, Math.floor((room.expiresAt - Date.now()) / 1000));
  await env.ROOMS.put(`room:${code}`, JSON.stringify(room), { expirationTtl: remainingTtl });

  return json({ success: true, fileId, fileName: decodedFileName, fileSize });
}

async function cloudHoldUploadComplete(request, env) {
  let body;
  try { body = await request.json(); } catch { return err('Invalid JSON body'); }

  const { code, fileId, fileName, fileSize } = body;
  if (!code || !fileId) return err('Missing required fields: code, fileId');

  const roomJson = await env.ROOMS.get(`room:${code}`);
  if (!roomJson) return err('Room not found or expired', 404);

  const room = JSON.parse(roomJson);

  // Idempotency: skip if already recorded
  if (room.files.some(f => f.id === fileId)) {
    return json({ success: true, message: 'File already recorded' });
  }

  room.files.push({ id: fileId, name: fileName, size: fileSize, r2Key: `rooms/${code}/${fileId}-${fileName}`, uploadedAt: Date.now() });

  const remainingTtl = Math.max(60, Math.floor((room.expiresAt - Date.now()) / 1000));
  await env.ROOMS.put(`room:${code}`, JSON.stringify(room), { expirationTtl: remainingTtl });

  return json({ success: true, filesCount: room.files.length });
}

async function cloudHoldGetRoom(code, env) {
  const roomJson = await env.ROOMS.get(`room:${code}`);
  if (!roomJson) return err('Room not found or expired', 404);

  const room = JSON.parse(roomJson);

  return json({
    code: room.code, name: room.name,
    files: room.files.map(f => ({ id: f.id, name: f.name, size: f.size, uploadedAt: f.uploadedAt })),
    createdAt: room.createdAt, expiresAt: room.expiresAt,
    timeRemaining: Math.max(0, room.expiresAt - Date.now()),
  });
}

async function cloudHoldDownload(code, fileId, env) {
  const roomJson = await env.ROOMS.get(`room:${code}`);
  if (!roomJson) return err('Room not found or expired', 404);

  const room = JSON.parse(roomJson);
  const file = room.files.find(f => f.id === fileId);
  if (!file) return err('File not found', 404);

  // If R2 credentials are configured → presigned GET URL so the client downloads
  // directly from R2 (same bucket as upload, bypasses Worker response size limit).
  if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY) {
    const presignedGetUrl = await generateR2PresignedUrl(
      env, file.r2Key,
      file.contentType || 'application/octet-stream',
      3600,
      'GET'
    );
    // Redirect the client directly to R2; browser triggers native download.
    return Response.redirect(presignedGetUrl, 302);
  }

  // Fallback: stream through Worker (local dev without credentials)
  const object = await env.FILES.get(file.r2Key);
  if (!object) return err('File data not found in storage', 404);

  const headers = new Headers(CORS_HEADERS);
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Content-Disposition', `attachment; filename="${file.name}"`);
  if (object.size) headers.set('Content-Length', String(object.size));

  return new Response(object.body, { headers });
}
// AWS v4 Presigned URL (for R2 direct upload/download)

// Uses the Web Crypto API — no external dependencies required.
// R2 credentials (separate from account API key) must be added as Worker secrets:
//   npx wrangler secret put R2_ACCOUNT_ID
//   npx wrangler secret put R2_ACCESS_KEY_ID
//   npx wrangler secret put R2_SECRET_ACCESS_KEY

async function generateR2PresignedUrl(env, r2Key, contentType, expiresInSec = 3600, method = 'PUT') {
  const accountId     = env.R2_ACCOUNT_ID;
  const accessKeyId   = env.R2_ACCESS_KEY_ID;
  const secretKey     = env.R2_SECRET_ACCESS_KEY;
  const bucket        = env.R2_BUCKET_NAME || 'zap-files';
  const region        = 'auto';
  const service       = 's3';

  const host     = `${accountId}.r2.cloudflarestorage.com`;
  const now      = new Date();

  // Date strings required by AWS v4
  const pad      = n => String(n).padStart(2, '0');
  const dateStr  = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}`;
  const timeStr  = `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const datetime = `${dateStr}T${timeStr}Z`;

  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;
  const credential      = `${accessKeyId}/${credentialScope}`;

  // Query params must be sorted alphabetically
  const queryParams = [
    ['X-Amz-Algorithm',     'AWS4-HMAC-SHA256'],
    ['X-Amz-Content-Sha256','UNSIGNED-PAYLOAD'],
    ['X-Amz-Credential',    credential],
    ['X-Amz-Date',          datetime],
    ['X-Amz-Expires',       String(expiresInSec)],
    ['X-Amz-SignedHeaders', 'host'],
  ].sort((a, b) => a[0].localeCompare(b[0]));

  const queryString = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  // Canonical URI: must be double-encoded for S3
  const canonicalUri    = `/${bucket}/${r2Key.split('/').map(encodeURIComponent).join('/')}`;
  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders    = 'host';

  const canonicalRequest = [
    method,   // PUT for upload, GET for download
    canonicalUri,
    queryString,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    datetime,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = await deriveSigningKey(secretKey, dateStr, region, service);
  const signature  = await hmacHex(signingKey, stringToSign);

  return `https://${host}/${bucket}/${r2Key}?${queryString}&X-Amz-Signature=${signature}`;
}

// Crypto helpers

async function sha256Hex(message) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSign(key, message) {
  const k = typeof key === 'string'
    ? await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    : await crypto.subtle.importKey('raw', key,                           { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, typeof message === 'string' ? new TextEncoder().encode(message) : message);
}

async function hmacHex(key, message) {
  return [...new Uint8Array(await hmacSign(key, message))].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveSigningKey(secret, date, region, service) {
  const kDate    = await hmacSign(`AWS4${secret}`, date);
  const kRegion  = await hmacSign(kDate,           region);
  const kService = await hmacSign(kRegion,         service);
  return              hmacSign(kService,        'aws4_request');
}
