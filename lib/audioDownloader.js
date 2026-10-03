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
  }
}

// ── Same APIs that work for .ytv (video) — but audio endpoints ───────────
const AUDIO_APIS = [
  { name: 'xcasper-audio', url: 'https://apis.xcasper.space/api/downloader/yt-audio', param: 'url' },
  { name: 'keith-audio',  url: 'https://apiskeith.top/download/audio',                param: 'url' },
  { name: 'xcasper-video-extract', url: 'https://apis.xcasper.space/api/downloader/yt-video', param: 'url', extractAudio: true },
];

// ── Download via working APIs (same providers as .ytv) ────────────────────
async function downloadViaApi(ytUrl) {
  for (const api of AUDIO_APIS) {
    try {
      sigLog('🌐', 'audioAPI', `Trying ${api.name}…`);
      const res = await axios.get(api.url, {
        params: { [api.param]: ytUrl },
        timeout: 30000,
      });
      const d = res.data;
      // The response structure mirrors the video API (which works)
      const dlUrl = d?.result?.download_url || d?.result?.url || d?.download_url || d?.url ||
                    d?.data?.download_url || d?.data?.url;
      if (!dlUrl) {
        sigLog('⚠️', 'audioAPI', `No download URL from ${api.name}`, null, 'yellow');
        continue;
      }

      sigLog('⬇️', 'audioAPI', `Downloading from ${api.name}…`);
      const dlRes = await axios.get(dlUrl, {
        responseType: 'arraybuffer',
        timeout: 120000,
        maxContentLength: 100 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' },
      });
      const buf = Buffer.from(dlRes.data);
      if (buf && buf.length > 1000) { // sanity check — real audio is >1KB
        sigLog('✅', 'audioAPI', `${api.name} succeeded`, { Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB` });

        // If this is actually a video file, extract audio using ffmpeg
        if (api.extractAudio) {
          sigLog('🎵', 'audioAPI', 'Extracting audio from video…');
          const audioBuf = await extractAudioWithFfmpeg(buf);
          if (audioBuf) return audioBuf;
          // If ffmpeg fails, return the video buffer (WhatsApp can still play it as audio)
          sigLog('⚠️', 'audioAPI', 'ffmpeg extraction failed — returning raw file', null, 'yellow');
        }
        return buf;
      }
    } catch (e) {
      sigLog('❌', 'audioAPI', `${api.name} failed`, { Error: e.message }, 'red');
    }
  }
  return null;
}

// ── Extract audio from video buffer using ffmpeg ──────────────────────────
async function extractAudioWithFfmpeg(videoBuf) {
  const tmpDir = join(tmpdir(), `klasu-ffmpeg-${randomUUID().slice(0, 8)}`);
  mkdirSync(tmpDir, { recursive: true });
  const inPath = join(tmpDir, 'input.mp4');
  const outPath = join(tmpDir, 'output.mp3');
  const { exec } = await import('child_process');
  const execAsync = promisify(exec);

  try {
    const fs = await import('fs');
    fs.writeFileSync(inPath, videoBuf);

    await execAsync(`ffmpeg -y -i "${inPath}" -vn -acodec libmp3lame -q:a 5 "${outPath}"`, {
      timeout: 60000,
      maxBuffer: 1024 * 1024 * 10,
    });

    const buf = await readFileAsync(outPath);
    if (buf && buf.length > 0) return buf;
    return null;
  } catch (e) {
    sigLog('❌', 'ffmpeg', 'Audio extraction failed', { Error: e.message }, 'red');
    return null;
  } finally {
    try { await unlinkAsync(inPath); } catch {}
    try { await unlinkAsync(outPath); } catch {}
  }
}

// ── Download via yt-dlp (fallback) ────────────────────────────────────────
async function downloadViaYtDlp(ytUrl) {
  ensureYtDlpExecutable();
  if (!existsSync(YTDLP_PATH)) {
    sigLog('❌', 'yt-dlp', 'Binary not found', null, 'red');
    return null;
  }
  const tmpDir = join(tmpdir(), `klasu-ytdlp-${randomUUID().slice(0, 8)}`);
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
    if (buf && buf.length > 0) {
      sigLog('✅', 'yt-dlp', 'Done', { Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB` });
      return buf;
    }
    return null;
  } catch (e) {
    sigLog('❌', 'yt-dlp', 'Failed', { Error: e.message }, 'red');
    return null;
  } finally {
    try { await unlinkAsync(outFile); } catch {}
  }
}

// ── Main export: xcasper/keith APIs (working) → yt-dlp (fallback) ─────────
export async function downloadAudioWithFallback(ytUrl) {
  // 1. Try the SAME APIs that work for .ytv (audio endpoints)
  sigLog('🔁', 'audioDownloader', 'Trying xcasper/keith audio APIs…');
  const apiBuf = await downloadViaApi(ytUrl);
  if (apiBuf) return apiBuf;

  // 2. Fallback to yt-dlp
  sigLog('🔁', 'audioDownloader', 'APIs failed, trying yt-dlp…');
  const ytdlpBuf = await downloadViaYtDlp(ytUrl);
  if (ytdlpBuf) return ytdlpBuf;

  sigLog('❌', 'audioDownloader', 'All providers failed', null, 'red');
  return null;
}
