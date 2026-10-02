import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { readFile, unlink, mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { mcowDownloadAudio } from './giftedApi.js';
import { sigLog } from './sigLog.js';

const execFileAsync = promisify(execFile);
const readFileAsync = promisify(readFile);
const unlinkAsync = promisify(unlink);

// ── yt-dlp binary path ──────────────────────────────────────────────────────
// The bot ships with bin/yt-dlp (pre-built binary). We use it as the primary
// audio download method because it's the most reliable — it hits YouTube
// directly without depending on any third-party API.
const YTDLP_PATH = join(process.cwd(), 'bin', 'yt-dlp');

// ── Download via yt-dlp (primary — most reliable) ──────────────────────────
async function downloadViaYtDlp(ytUrl) {
    const tmpDir = join(tmpdir(), `klasu-audio-${randomUUID().slice(0, 8)}`);
    mkdirSync(tmpDir, { recursive: true });
    const outFile = join(tmpDir, 'audio.mp3');

    try {
        sigLog('🌐', 'yt-dlp', 'Downloading audio…', { url: ytUrl });
        const { stderr } = await execFileAsync(YTDLP_PATH, [
            '-x',                           // extract audio only
            '--audio-format', 'mp3',
            '--audio-quality', '5',         // medium quality (smaller file, faster)
            '--no-playlist',
            '--no-warnings',
            '--no-check-certificate',
            '-o', outFile,
            ytUrl,
        ], { timeout: 120000, maxBuffer: 1024 * 1024 * 10 });

        const buf = await readFileAsync(outFile);
        if (!buf || buf.length === 0) throw new Error('yt-dlp produced empty file');

        sigLog('✅', 'yt-dlp', 'Downloaded', { Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB` });
        return buf;
    } catch (e) {
        sigLog('❌', 'yt-dlp', 'Failed', { Error: e.message }, 'red');
        return null;
    } finally {
        try { await unlinkAsync(outFile); } catch {}
        try { await unlinkAsync(tmpDir); } catch {}
    }
}

// ── Download via xwolf API (fallback) ──────────────────────────────────────
async function downloadViaXwolf(ytUrl) {
    try {
        const XWOLF_KEY = process.env.XWOLF_API_KEY || 'wxa_u_xwk7sch6xj';
        sigLog('🌐', 'xwolf', 'Downloading audio…', { url: ytUrl });
        const res = await axios.get('https://xwolf-api.onrender.com/api/yta', {
            params: { url: ytUrl, apikey: XWOLF_KEY },
            timeout: 30000,
        });
        const d = res.data;
        const dlUrl = d?.result?.download_url || d?.download_url || d?.url;
        if (!dlUrl) throw new Error('xwolf: no download URL in response');

        const dlRes = await axios.get(dlUrl, {
            responseType: 'arraybuffer',
            timeout: 120000,
            maxContentLength: 100 * 1024 * 1024,
            headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const buf = Buffer.from(dlRes.data);
        if (!buf || buf.length === 0) throw new Error('xwolf: empty response');

        sigLog('✅', 'xwolf', 'Downloaded', { Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB` });
        return buf;
    } catch (e) {
        sigLog('❌', 'xwolf', 'Failed', { Error: e.message }, 'red');
        return null;
    }
}

// ── Main export: try yt-dlp → xwolf → mcow ─────────────────────────────────
export async function downloadAudioWithFallback(ytUrl) {
    // 1. yt-dlp (primary — hits YouTube directly, most reliable)
    sigLog('🔁', 'audioDownloader', 'Trying yt-dlp…');
    const ytdlpBuf = await downloadViaYtDlp(ytUrl);
    if (ytdlpBuf) return ytdlpBuf;

    // 2. xwolf API (fallback — Wolf API server)
    sigLog('🔁', 'audioDownloader', 'yt-dlp failed, trying xwolf…');
    const xwolfBuf = await downloadViaXwolf(ytUrl);
    if (xwolfBuf) return xwolfBuf;

    // 3. mcow (last resort — currently 404, but keep for when it comes back)
    sigLog('🔁', 'audioDownloader', 'xwolf failed, trying mcow…');
    try {
        const buf = await mcowDownloadAudio(ytUrl);
        if (buf) {
            sigLog('✅', 'audioDownloader', 'mcow succeeded', {
                Size: `${(buf.length / 1024 / 1024).toFixed(1)}MB`,
            });
            return buf;
        }
    } catch (e) {
        sigLog('❌', 'audioDownloader', 'mcow failed', { Error: e.message }, 'red');
    }

    sigLog('❌', 'audioDownloader', 'All providers failed', null, 'red');
    return null;
}
