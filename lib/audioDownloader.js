import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { readFile, unlink, mkdirSync, existsSync, chmodSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { sigLog } from './sigLog.js';

const execAsync = promisify(exec);
const readFileAsync = promisify(readFile);
const unlinkAsync = promisify(unlink);

const YTDLP_PATH = join(process.cwd(), 'bin', 'yt-dlp');

// ── Video APIs that ARE working (confirmed by user: .ytmp4 works) ───────
const VIDEO_APIS = [
  { name: 'xcasper-video', url: 'https://apis.xcasper.space/api/downloader/yt-video', param: 'url' },
  { name: 'keith-video',   url: 'https://apiskeith.top/download/ytv',                 param: 'url' },
  { name: 'keith-mp4',     url: 'https://apiskeith.top/download/mp4',                  param: 'url' },
];

// ── Download video buffer from URL ──────────────────────────────────────
async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000, // 60s max — we want speed!
    maxRedirects: 5,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  const buf = Buffer.from(res.data);
  if (buf.length < 5000) throw new Error('file too small');
  return buf;
}

// ── Extract audio from video using ffmpeg ──────────────────────────────
async function extractAudio(videoBuf) {
  const tmpDir = join(tmpdir(), `klasu-ffmpeg-${randomUUID().slice(0, 8)}`);
  mkdirSync(tmpDir, { recursive: true });
  const inPath = join(tmpDir, 'input.mp4');
  const outPath = join(tmpDir, 'audio.mp3');

  try {
    writeFileSync(inPath, videoBuf);
    // Extract audio only — fast because we skip re-encoding the video
    await execAsync(
      `ffmpeg -y -i "${inPath}" -vn -acodec libmp3lame -q:a 5 -nostdin "${outPath}"`,
      { timeout: 30000, maxBuffer: 1024 * 1024 * 5 }
    );
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

// ── Main: download VIDEO → extract AUDIO ────────────────────────────────
export async function downloadAudioWithFallback(ytUrl) {
  // Strategy: Download the VIDEO using the same APIs that .ytmp4 uses
  // (confirmed working), then extract audio with ffmpeg.
  // This is the most reliable method since video APIs work but audio APIs don't.

  for (const api of VIDEO_APIS) {
    try {
      sigLog('🌐', 'audioDownloader', `Trying ${api.name}...`);

      const res = await axios.get(api.url, {
        params: { [api.param]: ytUrl },
        timeout: 15000, // fast — 15s max per API
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      const d = res.data;

      // Extract download URL from various response formats
      let dlUrl = null;
      if (api.name === 'xcasper-video') {
        // XCasper returns: { success: true, videos: [{ quality, url }] }
        if (d?.success && Array.isArray(d?.videos)) {
          const vid = d.videos.find(v => v.quality === '144p' && v.url)
                   || d.videos.find(v => v.quality === '360p' && v.url)
                   || d.videos.find(v => v.url);
          dlUrl = vid?.url;
        }
      } else {
        // Keith returns: { status: true, result: "url" }
        if (d?.status === true || d?.success === true) {
          dlUrl = typeof d?.result === 'string' ? d.result : d?.result?.download_url || d?.download_url || d?.url;
        }
      }

      if (!dlUrl || !dlUrl.startsWith('http')) {
        sigLog('⚠️', 'audioDownloader', `${api.name}: no download URL`, null, 'yellow');
        continue;
      }

      // Skip googlevideo CDN (IP-locked, won't work from Heroku)
      if (dlUrl.includes('googlevideo.com') || dlUrl === 'Waiting...') {
        sigLog('⚠️', 'audioDownloader', `${api.name}: googlevideo CDN (IP-locked)`, null, 'yellow');
        continue;
      }

      sigLog('⬇️', 'audioDownloader', `Downloading video from ${api.name}...`);

      // Download the VIDEO buffer (low quality for speed)
      const videoBuf = await downloadBuffer(dlUrl);
      sigLog('✅', 'audioDownloader', `Video downloaded: ${(videoBuf.length / 1024 / 1024).toFixed(1)}MB`);

      // Extract audio with ffmpeg
      sigLog('🎵', 'audioDownloader', 'Extracting audio with ffmpeg...');
      const audioBuf = await extractAudio(videoBuf);

      if (audioBuf) {
        sigLog('✅', 'audioDownloader', `Audio extracted: ${(audioBuf.length / 1024 / 1024).toFixed(1)}MB`);
        return audioBuf;
      }

      // If ffmpeg fails, return the video buffer — WhatsApp can play it
      sigLog('⚠️', 'audioDownloader', 'ffmpeg failed — returning video as audio', null, 'yellow');
      return videoBuf;

    } catch (e) {
      sigLog('❌', 'audioDownloader', `${api.name} failed`, { Error: e.message }, 'red');
    }
  }

  // Last resort: try yt-dlp
  if (existsSync(YTDLP_PATH)) {
    try { chmodSync(YTDLP_PATH, 0o755); } catch {}
    const tmpDir = join(tmpdir(), `klasu-ytdlp-${randomUUID().slice(0, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
    const outFile = join(tmpDir, 'audio.mp3');
    try {
      sigLog('🌐', 'audioDownloader', 'Trying yt-dlp...');
      const { execFile } = await import('child_process');
      const execFileAsync = promisify(execFile);
      await execFileAsync(YTDLP_PATH, [
        '-x', '--audio-format', 'mp3', '--audio-quality', '5',
        '--no-playlist', '--no-warnings', '--no-check-certificate',
        '-o', outFile, ytUrl,
      ], { timeout: 30000, maxBuffer: 1024 * 1024 * 5 });
      const buf = await readFileAsync(outFile);
      if (buf && buf.length > 0) {
        sigLog('✅', 'audioDownloader', `yt-dlp succeeded: ${(buf.length / 1024 / 1024).toFixed(1)}MB`);
        return buf;
      }
    } catch (e) {
      sigLog('❌', 'audioDownloader', `yt-dlp failed`, { Error: e.message }, 'red');
    } finally {
      try { await unlinkAsync(outFile); } catch {}
    }
  }

  sigLog('❌', 'audioDownloader', 'All providers failed', null, 'red');
  return null;
}
