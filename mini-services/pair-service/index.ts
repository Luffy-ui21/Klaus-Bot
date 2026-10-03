// mini-services/pair-service/index.ts
// KLAUS MD — Pair Link Web service.
//
// Listens on port 3003 (via socket.io). Frontend connects via:
//   io("/?XTransformPort=3003")
//
// Flow:
//   1. Client emits 'start_pair' with { phone } (international format, no +).
//   2. We spin up a temporary wolfsocket (Baileys fork) with a temp auth folder.
//   3. When WA sends the QR challenge, we call requestPairingCode(phone) and
//      emit 'pair_code' with the 8-character code.
//   4. We wait up to 90s. If the user pairs on their phone, WA fires
//      connection.update with connection='open' — we then read creds.json
//      from the temp folder, base64-encode it, prepend "KLAUS MD:", and
//      emit 'session_id' with the full string.
//   5. We clean up the temp folder and close the socket.
//
// All clients are isolated — each pair session has its own temp dir + wolfsocket
// instance. No state is shared.

import { Server } from 'socket.io';
import { createServer } from 'http';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const PORT = 3003;
const SESSION_PREFIX = 'KLAUS MD:';

interface PairSession {
  id: string;
  tempDir: string;
  sock: any;
  timeout: any;
  resolved: boolean;
  // HTTP polling state — set by event handlers, read by GET /api/pair/status
  status: 'pending' | 'pair_code' | 'connected' | 'error' | 'timeout';
  pairCode?: string | null;
  rawCode?: string | null;
  sessionId?: string | null;   // The exported KLAUS MD:base64 string
  phone?: string | null;
  error?: string | null;
  expiresAt?: number | null;
  startedAt: number;
}

// ── HTTP API helpers (for the standalone HTML page) ─────────────────────────
// The standalone HTML at /download/klasu-md-pair.html uses fetch() (not
// socket.io) so it can be opened directly from disk via file://. These
// endpoints let it start a pair session and poll for status updates.

function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res: any, status: number, body: any) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let chunks = '';
    req.on('data', (c: any) => { chunks += c; if (chunks.length > 65536) req.destroy(); });
    req.on('end', () => {
      try { resolve(chunks ? JSON.parse(chunks) : {}); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const httpServer = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  // GET /health — simple health check
  if (url.pathname === '/health') {
    sendJson(res, 200, { ok: true, service: 'klasu-md-pair-service' });
    return;
  }

  // POST /api/pair/start — start a new pair session
  // Body: { phone: "254711815459" }
  // Returns: { sessionId: "...", status: "pending" }
  if (url.pathname === '/api/pair/start' && req.method === 'POST') {
    setCorsHeaders(res);
    const body = await readJsonBody(req);
    const phone = String(body?.phone || '').replace(/\D/g, '');
    if (phone.length < 7 || phone.length > 15) {
      sendJson(res, 400, { error: `Invalid phone — must be 7-15 digits with country code (got ${phone.length}).` });
      return;
    }
    // Generate a session ID synchronously.
    const sessionId = randomUUID().slice(0, 12);
    // IMPORTANT: register the session in the Map BEFORE we kick off the
    // async pairing work. The HTTP client polls /api/pair/status immediately
    // after POST returns, so the entry must already exist (with status
    // 'pending') to avoid a 404 on the first poll.
    const placeholderSession: PairSession = {
      id: sessionId,
      tempDir: '',
      sock: null,
      timeout: null,
      resolved: false,
      status: 'pending',
      pairCode: null, rawCode: null, sessionId: null,
      phone, error: null, expiresAt: null, startedAt: Date.now(),
    };
    sessions.set(sessionId, placeholderSession);
    // Don't await — let pairing happen async; client polls for status.
    startPairingForSession(sessionId, phone).catch((err) => {
      console.error(`[${sessionId}] Background pair start failed:`, err.message);
      const s = sessions.get(sessionId);
      if (s) { s.status = 'error'; s.error = err.message; }
    });
    sendJson(res, 200, { sessionId, status: 'pending', phone });
    return;
  }

  // GET /api/pair/status?sessionId=... — poll for status
  // Returns: { status, pairCode?, rawCode?, sessionId?(=KLAUS MD:base64),
  //           phone?, error?, expiresAt? }
  if (url.pathname === '/api/pair/status' && req.method === 'GET') {
    setCorsHeaders(res);
    const sid = url.searchParams.get('sessionId') || '';
    const s = sessions.get(sid);
    if (!s) {
      sendJson(res, 404, { error: 'Session not found or expired. Start a new one with POST /api/pair/start.' });
      return;
    }
    sendJson(res, 200, {
      status: s.status,
      pairCode: s.pairCode,
      rawCode: s.rawCode,
      sessionId: s.sessionId,        // The exported KLAUS MD:base64 string
      phone: s.phone,
      error: s.error,
      expiresAt: s.expiresAt,
      startedAt: s.startedAt,
    });
    return;
  }

  // 404 for everything else
  setCorsHeaders(res);
  sendJson(res, 404, { error: 'Not found', path: url.pathname });
});

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  // Use a dedicated sub-path so socket.io doesn't intercept HTTP API routes
  // like /health, /api/pair/start, /api/pair/status.
  // The Next.js frontend connects via: io('/socket.io/?XTransformPort=3003')
  path: '/socket.io/',
});

// Keep track of active pair sessions so we can clean up on disconnect.
const sessions = new Map<string, PairSession>();

function makeLogger(sid: string) {
  return (level: 'info' | 'error' | 'warn', msg: string, extra?: any) => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] [${sid}] [${level.toUpperCase()}] ${msg}${extra ? ' ' + JSON.stringify(extra) : ''}`);
  };
}

function cleanupSession(sessionId: string) {
  const s = sessions.get(sessionId);
  if (!s) return;
  try { if (s.timeout) clearTimeout(s.timeout); } catch {}
  try {
    if (s.sock) {
      s.sock.ev?.removeAllListeners?.();
      s.sock.ws?.close?.();
    }
  } catch {}
  try {
    if (existsSync(s.tempDir)) rmSync(s.tempDir, { recursive: true, force: true });
  } catch {}
  sessions.delete(sessionId);
}

// Refactored pairing function: works for both socket.io (pass emit callback)
// and HTTP polling (omit emit; status is read from the session object).
// `sessionId` is provided by the caller so the HTTP endpoint can return it
// immediately and the client can poll before pairing even starts.
async function startPairingForSession(
  sessionId: string,
  phone: string,
  emit?: (event: string, data: any) => void,
): Promise<void> {
  const log = makeLogger(sessionId);
  log('info', `Starting pair for ${phone}`);

  const emitOrStore = (event: string, data: any) => {
    // Always update the session's polling state
    const s = sessions.get(sessionId);
    if (s) {
      if (event === 'pair_code') {
        s.status = 'pair_code';
        s.pairCode = data.code;
        s.rawCode = data.raw;
        s.expiresAt = Date.now() + (data.expiresIn * 1000);
      } else if (event === 'session_id') {
        s.status = 'connected';
        s.sessionId = data.sessionId;
        s.resolved = true;
      } else if (event === 'pair_error') {
        s.status = 'error';
        s.error = data.message;
      } else if (event === 'pair_timeout') {
        s.status = 'timeout';
        s.error = data.message;
      }
    }
    // Also emit to the socket if one was provided (socket.io mode)
    if (emit) emit(event, data);
  };

  // Validate phone: digits only, 7-15 chars, no +
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 7 || cleanPhone.length > 15) {
    emitOrStore('pair_error', { message: `Invalid phone number — must be 7-15 digits with country code (got ${cleanPhone.length}).` });
    return;
  }

  // Create temp auth folder
  const tempDir = join(tmpdir(), `klasu-pair-${sessionId}-${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  let resolved = false;

  // 240s (4 min) timeout — WhatsApp invalidates pair codes every ~60s and
  // sends a fresh QR challenge. We auto-generate a new pair code on every
  // QR event (above), so the user always has a fresh code. 4 minutes gives
  // them plenty of time to open WhatsApp, navigate to Linked Devices, and
  // enter the code — even if they're on a slow connection or fumbling with
  // the UI.
  const timeout = setTimeout(() => {
    if (resolved) return;
    log('warn', 'Pairing timed out after 240s');
    emitOrStore('pair_timeout', { message: 'Pairing timed out after 4 minutes. Please try again — and have WhatsApp open on your phone ready to enter the code.' });
    cleanupSession(sessionId);
  }, 240_000);

  // Create wolfsocket instance
  let wolfsocket: any;
  try {
    wolfsocket = await import('wolfsocket');
  } catch (err: any) {
    log('error', 'Failed to load wolfsocket', { msg: err.message });
    emitOrStore('pair_error', { message: `Server could not load wolfsocket library: ${err.message}` });
    cleanupSession(sessionId);
    return;
  }

  const makeWASocket = (typeof wolfsocket.default === 'function' ? wolfsocket.default : null) ?? wolfsocket.makeWASocket;
  const { useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers } = wolfsocket;
  const pino = (await import('pino')).default;

  if (!makeWASocket || !useMultiFileAuthState || !fetchLatestBaileysVersion) {
    emitOrStore('pair_error', { message: 'wolfsocket exports are missing required functions (makeWASocket/useMultiFileAuthState/fetchLatestBaileysVersion).' });
    cleanupSession(sessionId);
    return;
  }

  const silentLogger = pino({ level: 'silent' });

  // Set up auth state (file-based, in the temp dir)
  let state: any, saveCreds: any;
  try {
    const authState = await useMultiFileAuthState(tempDir);
    state = authState.state;
    saveCreds = authState.saveCreds;
  } catch (err: any) {
    log('error', 'useMultiFileAuthState failed', { msg: err.message });
    emitOrStore('pair_error', { message: `Failed to set up auth state: ${err.message}` });
    cleanupSession(sessionId);
    return;
  }

  let version: { version: [number, number, number]; isLatest: boolean };
  try {
    version = await fetchLatestBaileysVersion();
  } catch (err: any) {
    log('warn', 'fetchLatestBaileysVersion failed, using fallback', { msg: err.message });
    version = { version: [2, 3000, 1015904757] as any, isLatest: false };
  }

  // Create the socket
  let sock: any;
  try {
    sock = makeWASocket({
      version: version.version,
      logger: silentLogger,
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
      },
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
    });
  } catch (err: any) {
    log('error', 'makeWASocket failed', { msg: err.message });
    emitOrStore('pair_error', { message: `Failed to create WhatsApp socket: ${err.message}` });
    cleanupSession(sessionId);
    return;
  }

  // If a placeholder session was pre-registered by the HTTP endpoint (so the
  // first /api/pair/status poll didn't 404), use IT instead of creating a
  // new one — this way any external mutations (e.g. error set by the catch
  // handler) are preserved.
  let pairSession: PairSession = sessions.get(sessionId) || {
    id: sessionId, tempDir, sock, timeout, resolved: false,
    status: 'pending', pairCode: null, rawCode: null, sessionId: null,
    phone: cleanPhone, error: null, expiresAt: null, startedAt: Date.now(),
  };
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, pairSession);
  } else {
    // Update the existing entry's missing fields
    pairSession.tempDir = tempDir;
    pairSession.sock = sock;
    pairSession.timeout = timeout;
    pairSession.phone = cleanPhone;
  }

  // Save creds when WA sends updates
  sock.ev.on('creds.update', () => {
    try { saveCreds(); } catch {}
  });

  let lastPairCodeAt = 0;

  sock.ev.on('connection.update', async (update: any) => {
    const { connection, qr, lastDisconnect, receivedPendingNotifications, isOnline } = update || {};

    // Log EVERY connection.update event so we can see exactly what WhatsApp
    // is sending. This is critical for debugging "pairing doesn't complete"
    // issues — we need to know if the connection drops, restarts, or stays
    // in a "connecting" state forever.
    log('info', 'connection.update', {
      connection: connection || null,
      hasQr: !!qr,
      isOnline: isOnline || false,
      receivedPendingNotifications: receivedPendingNotifications || false,
      lastDisconnectErr: lastDisconnect?.error?.message || null,
      lastDisconnectCode: lastDisconnect?.error?.output?.statusCode || null,
    });

    // QR is sent when WA is ready for pairing code request — AND when the
    // previous pair code has expired (WA invalidates codes after ~60s and
    // sends a fresh QR challenge). We must request a NEW pair code on every
    // QR event so the user always has a fresh code to enter on their phone.
    if (qr && !state.creds.registered) {
      // Throttle: don't request a new code more than once every 5 seconds
      // (in case WA sends multiple QRs in rapid succession during reconnect).
      const now = Date.now();
      if (now - lastPairCodeAt < 5000) {
        log('info', 'Skipping pair code request (throttled)', { msSinceLast: now - lastPairCodeAt });
        return;
      }
      lastPairCodeAt = now;
      try {
        const code = await sock.requestPairingCode(cleanPhone);
        const clean = (code || '').replace(/\s+/g, '');
        const formatted = clean.length === 8
          ? `${clean.slice(0, 4)}-${clean.slice(4)}`
          : clean;
        log('info', 'Pair code generated', { code: formatted, isRefresh: lastPairCodeAt > 0 && (Date.now() - pairSession.startedAt) > 30000 });
        // Emit the fresh code — the UI will update because pairCode changes.
        emitOrStore('pair_code', { code: formatted, raw: clean, expiresIn: 60 });
      } catch (err: any) {
        log('error', 'requestPairingCode failed', { msg: err.message });
        emitOrStore('pair_error', { message: `Failed to generate pair code: ${err.message}` });
        cleanupSession(sessionId);
      }
    }

    if (connection === 'open' && !resolved) {
      pairSession.resolved = true;
      log('info', 'WhatsApp connected — exporting SESSION_ID');

      // Give creds.saveCreds() a moment to flush
      setTimeout(() => {
        try {
          // Try creds.json in tempDir first
          const credsPath = join(tempDir, 'creds.json');
          if (!existsSync(credsPath)) {
            emitOrStore('pair_error', { message: 'creds.json not found after connection opened.' });
            cleanupSession(sessionId);
            return;
          }
          const raw = readFileSync(credsPath, 'utf8');
          // Re-parse to ensure it's valid JSON, then re-stringify cleanly
          const creds = JSON.parse(raw);
          const json = JSON.stringify(creds);
          const base64 = Buffer.from(json, 'utf8').toString('base64');
          const sessionIdString = `${SESSION_PREFIX}${base64}`;
          log('info', 'SESSION_ID exported', { length: sessionIdString.length });
          emitOrStore('session_id', { sessionId: sessionIdString, prefix: SESSION_PREFIX });
          // Keep the session around for ~60s so the HTTP polling client has
          // time to fetch the SESSION_ID after the connection closes.
          setTimeout(() => cleanupSession(sessionId), 60_000);
        } catch (err: any) {
          log('error', 'SESSION_ID export failed', { msg: err.message });
          emitOrStore('pair_error', { message: `Failed to export SESSION_ID: ${err.message}` });
          cleanupSession(sessionId);
        }
      }, 2000);
    }

    if (connection === 'close' && !resolved) {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const reason = lastDisconnect?.error?.message || `status ${statusCode}`;
      log('warn', 'Connection closed before pairing completed', { reason, statusCode });
      // 515 = restart, 410 = reconnect — these can be retried silently
      if (statusCode !== 515 && statusCode !== 410) {
        emitOrStore('pair_error', { message: `Connection closed: ${reason}. Try again.` });
        cleanupSession(sessionId);
      }
    }
  });

  // Stash the session id on the socket so disconnect handler can clean it up
  return pairSession;
}

// Backwards-compat shim for the socket.io path — wraps the new function.
async function startPairing(io: any, socket: any, phone: string): Promise<void> {
  const sessionId = randomUUID().slice(0, 8);
  // Stash on the socket for the disconnect handler
  (socket as any).__pairSessionId = sessionId;
  // Pre-create the session entry so HTTP polling can find it immediately
  const tempDir = join(tmpdir(), `klasu-pair-${sessionId}-${Date.now()}`);
  const pairSession: PairSession = {
    id: sessionId, tempDir, sock: null, timeout: null, resolved: false,
    status: 'pending', pairCode: null, rawCode: null, sessionId: null,
    phone: phone.replace(/\D/g, ''), error: null, expiresAt: null, startedAt: Date.now(),
  };
  sessions.set(sessionId, pairSession);
  await startPairingForSession(sessionId, phone, (event, data) => socket.emit(event, data));
}

// ── Socket.io event handlers ────────────────────────────────────────────────
io.on('connection', (socket: any) => {
  console.log(`[${new Date().toISOString()}] [CONNECT] socket=${socket.id}`);

  socket.on('start_pair', async (data: { phone?: string } | string) => {
    // Accept either { phone } object or a raw phone string
    const phone = typeof data === 'string' ? data : (data?.phone || '');
    if (!phone || phone.trim() === '') {
      socket.emit('pair_error', { message: 'Phone number is required.' });
      return;
    }
    try {
      await startPairing(io, socket, phone);
    } catch (err: any) {
      console.error(`[FATAL] start_pair failed:`, err);
      socket.emit('pair_error', { message: `Server error: ${err.message}` });
    }
  });

  socket.on('disconnect', () => {
    const sid = (socket as any).__pairSessionId;
    if (sid) {
      console.log(`[${new Date().toISOString()}] [DISCONNECT] socket=${socket.id} — cleaning up pair session ${sid}`);
      cleanupSession(sid);
    } else {
      console.log(`[${new Date().toISOString()}] [DISCONNECT] socket=${socket.id}`);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`╭─⌈ KLAUS MD PAIR SERVICE ⌋`);
  console.log(`│  📡 Listening on http://localhost:${PORT}`);
  console.log(`│  🔌 Socket.io path: /?XTransformPort=${PORT}`);
  console.log(`╰⊷`);
  console.log(`[${new Date().toISOString()}] [BOOT] KLAUS MD pair service is ready.`);
});

// ── Graceful shutdown ───────────────────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`\n[${new Date().toISOString()}] [${signal}] Cleaning up...`);
  for (const sid of sessions.keys()) cleanupSession(sid);
  io.close(() => {
    httpServer.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
