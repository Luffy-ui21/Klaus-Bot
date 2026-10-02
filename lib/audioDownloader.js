import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { readFile, unlink, mkdirSync, existsSync, chmodSync } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { sigLog } from './sigLog.js';

const execFileAsync = promisify(execFile);
const readFileAsync = promisify(readFile);
const unlinkAsync = promisify(unlink);

const YTDLP_PATH = join(process.cwd(), 'bin', 'yt-dlp');

// ── Ensure yt-dlp is executable ─────────────────────────────────────────────
function ensureYtDlpExecutable() {
  if (existsSync(YTDLP_PATH)) {
    try { chmodSync(YTDLP_PATH, 0o755); } catch {}
    try { execFileSync('chmod', ['+x', YTDLP_PATH], { stdio: 'ignore' }); } catch {}
  }
}

import { execFileSync } from 'child_process';

// ── Download via yt-dlp (primary) ──────────────────────────────────────────
async function downloadViaYtDlp(ytUrl) {
  ensureYtDlpExecutable();
  if (!existsSync(YTDLP_PATH)) {
    sigLog('❌', 'yt-dlp', 'Binary not found', null, 'red');
    return null;
  }
  const tmpDir = join(tmpdir(), `klasu-audio-${randomUUID().slice(0, 8)}`);
  mkdirSync(tmpDir, { recursive: true });
  const outFile = join(tmpDir, 'audio.mp3');
  try {
    sigLog('🌐', 'yt-dlp', 'Downloading…', { url: ytUrl });
    await execFileAsync(YTDLP_PATH, [
      '-x', '--audio-format', 'mp3', '--audio-quality', '5',
      '--no-playlist', '--no-warnings', '--no-check-certificate',
      '-o', outFile, ytUrl,
    ], { timeout: 120000, maxBuffer: 1024 * 1024 * 10 });
    const buf = await readFileAsync(outFile);
    if (!buf || buf.length === 0) throw new Error('empty file');
    sigLog('✅', 'yt-dlp', 'Done', { Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB` });
    return buf;
  } catch (e) {
    sigLog('❌', 'yt-dlp', 'Failed', { Error: e.message }, 'red');
    return null;
  } finally {
    try { await unlinkAsync(outFile); } catch {}
  }
}

// ── Download via public API (fallback) ─────────────────────────────────────
async function downloadViaApi(ytUrl) {
  const apis = [
    { url: 'https://api.ditura.me/api/yta', param: 'url' },
    { url: 'https://api.zahwazein.xyz/download/yta', param: 'url' },
  ];
  for (const api of apis) {
    try {
      sigLog('🌐', 'api', `Trying ${api.url}…`);
      const res = await axios.get(api.url, { params: { [api.param]: ytUrl }, timeout: 30000 });
      const d = res.data;
      const dlUrl = d?.result?.download_url || d?.result?.url || d?.download_url || d?.url;
      if (!dlUrl) continue;
      const dlRes = await axios.get(dlUrl, {
        responseType: 'arraybuffer', timeout: 120000,
        maxContentLength: 100 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const buf = Buffer.from(dlRes.data);
      if (buf && buf.length > 0) {
        sigLog('✅', 'api', 'Done', { Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB` });
        return buf;
      }
    } catch (e) {
      sigLog('❌', 'api', `Failed: ${api.url}`, { Error: e.message }, 'red');
    }
  }
  return null;
}

// ── Main export: yt-dlp → public API ───────────────────────────────────────
export async function downloadAudioWithFallback(ytUrl) {
  // 1. yt-dlp (most reliable — hits YouTube directly)
  const buf = await downloadViaYtDlp(ytUrl);
  if (buf) return buf;

  // 2. Public API fallback
  const apiBuf = await downloadViaApi(ytUrl);
  if (apiBuf) return apiBuf;

  sigLog('❌', 'audioDownloader', 'All providers failed', null, 'red');
  return null;
}
