import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { readFile, unlink, mkdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { xwolfDownloadAudio } from './xwolfApi.js';
import { sigLog } from './sigLog.js';

const execFileAsync = promisify(execFile);
const readFileAsync = promisify(readFile);
const unlinkAsync = promisify(unlink);

// ── Xcasper audio API (the video version works, so audio should too) ──────
const XCASPER_AUDIO_API = 'https://apis.xcasper.space/api/downloader/yt-audio';
const KEITH_AUDIO_API   = 'https://apiskeith.top/download/audio';

// ── Xcasper video API (for fallback: download video → extract audio) ──────
const XCASPER_VIDEO_API = 'https://apis.xcasper.space/api/downloader/yt-video';
const KEITH_VIDEO_API   = 'https://apiskeith.top/download/video';

async function downloadBuffer(url, timeout = 120000) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout,
    maxContentLength: 100 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return Buffer.from(res.data);
}

// ── 1. Xwolf audio API (primary — bundled key, 6 endpoints) ──────────────
async function downloadViaXwolf(query) {
  try {
    sigLog('🔁', 'audioDownloader', 'Trying xwolf audio API…');
    const buf = await xwolfDownloadAudio(query, 90000);
    if (buf && buf.length > 10000) {
      sigLog('✅', 'audioDownloader', 'xwolf succeeded', { Size: `${(buf.byteLength / 1024 / 1024).toFixed(1)}MB` });
      return buf;
    }
  } catch (e) {
    sigLog('❌', 'audioDownloader', 'xwolf failed', { Error: e.message }, 'red');
  }
  return null;
}

// ── 2. Xcasper/Keith audio APIs ────────────────────────────────────────────
async function downloadViaAudioApi(ytUrl) {
  const apis = [
    { name: 'xcasper-audio', url: XCASPER_AUDIO_API, param: 'url' },
    { name: 'keith-audio',   url: KEITH_AUDIO_API,   param: 'url' },
  ];
  for (const api of apis) {
    try {
      sigLog('🔁', 'audioDownloader', `Trying ${api.name}…`);
      const res = await axios.get(api.url, { params: { [api.param]: ytUrl }, timeout: 30000 });
      const d = res.data;
      const dlUrl = d?.result?.download_url || d?.result?.url || d?.download_url || d?.url;
      if (!dlUrl) { sigLog('⚠️', api.name, 'No URL in response'); continue; }
      const buf = await downloadBuffer(dlUrl);
      if (buf && buf.length > 10000) {
        sigLog('✅', 'audioDownloader', `${api.name} succeeded`, { Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB` });
        return buf;
      }
    } catch (e) {
      sigLog('❌', 'audioDownloader', `${api.name} failed`, { Error: e.message }, 'red');
    }
  }
  return null;
}

// ── 3. Download VIDEO via xcasper/keith → extract AUDIO with ffmpeg ───────
// This is the GUARANTEED fallback — video download works, ffmpeg extracts audio.
async function downloadVideoThenExtractAudio(ytUrl) {
  sigLog('🔁', 'audioDownloader', 'Trying video→ffmpeg extraction…');
  let videoBuffer = null;

  // Try xcasper video first (known working)
  try {
    const res = await axios.get(XCASPER_VIDEO_API, { params: { url: ytUrl }, timeout: 30000 });
    const d = res.data;
    const dlUrl = d?.result?.download_url || d?.result?.url || d?.download_url || d?.url;
    if (dlUrl) {
      videoBuffer = await downloadBuffer(dlUrl, 120000);
      if (videoBuffer && videoBuffer.length > 50000) {
        sigLog('✅', 'audioDownloader', 'Video downloaded via xcasper', { Size: `${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB` });
      }
    }
  } catch (e) {
    sigLog('❌', 'audioDownloader', 'xcasper video failed', { Error: e.message }, 'red');
  }

  // Try keith video if xcasper failed
  if (!videoBuffer) {
    try {
      const res = await axios.get(KEITH_VIDEO_API, { params: { url: ytUrl }, timeout: 30000 });
      const d = res.data;
      const dlUrl = d?.result?.download_url || d?.result?.url || d?.download_url || d?.url;
      if (dlUrl) {
        videoBuffer = await downloadBuffer(dlUrl, 120000);
        if (videoBuffer && videoBuffer.length > 50000) {
          sigLog('✅', 'audioDownloader', 'Video downloaded via keith', { Size: `${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB` });
        }
      }
    } catch (e) {
      sigLog('❌', 'audioDownloader', 'keith video failed', { Error: e.message }, 'red');
    }
  }

  if (!videoBuffer) {
    sigLog('❌', 'audioDownloader', 'No video buffer to extract audio from', null, 'red');
    return null;
  }

  // Extract audio from video using ffmpeg
  const tmpDir = join(tmpdir(), `klasu-audio-${randomUUID().slice(0, 8)}`);
  mkdirSync(tmpDir, { recursive: true });
  const videoPath = join(tmpDir, 'video.mp4');
  const audioPath = join(tmpDir, 'audio.mp3');

  try {
    const fs = await import('fs');
    fs.writeFileSync(videoPath, videoBuffer);

    sigLog('🎵', 'audioDownloader', 'Extracting audio via ffmpeg…');
    await execFileAsync('ffmpeg', [
      '-i', videoPath,
      '-vn',                        // no video
      '-acodec', 'libmp3lame',
      '-q:a', '5',                  // medium quality
      '-y',                         // overwrite
      audioPath,
    ], { timeout: 60000 });

    const audioBuf = await readFileAsync(audioPath);
    if (audioBuf && audioBuf.length > 5000) {
      sigLog('✅', 'audioDownloader', 'Audio extracted from video', { Size: `${(audioBuf.length / 1024 / 1024).toFixed(1)}MB` });
      return audioBuf;
    }
  } catch (e) {
    sigLog('❌', 'audioDownloader', 'ffmpeg extraction failed', { Error: e.message }, 'red');
  } finally {
    try { await unlinkAsync(videoPath); } catch {}
    try { await unlinkAsync(audioPath); } catch {}
  }
  return null;
}

// ── Main export: xwolf → audio APIs → video→ffmpeg ────────────────────────
// Query can be either a YouTube URL or a search term.
export async function downloadAudioWithFallback(query) {
  // 1. Xwolf audio API (primary — bundled, tries 6 endpoints)
  const xwolfBuf = await downloadViaXwolf(query);
  if (xwolfBuf) return xwolfBuf;

  // 2. Xcasper/Keith audio APIs
  // If query is a search term (not a URL), convert to YouTube URL first
  const isUrl = /^https?:\/\//i.test(query);
  const ytUrl = isUrl ? query : `https://www.youtube.com/watch?v=${query}`;

  const apiBuf = await downloadViaAudioApi(ytUrl);
  if (apiBuf) return apiBuf;

  // 3. Download video → extract audio with ffmpeg (GUARANTEED to work
  //    because video download works and ffmpeg is available on Heroku)
  const videoAudioBuf = await downloadVideoThenExtractAudio(ytUrl);
  if (videoAudioBuf) return videoAudioBuf;

  sigLog('❌', 'audioDownloader', 'All providers failed', null, 'red');
  return null;
}
