import axios from 'axios';
import yts from 'yt-search';
import { getBotName } from '../../lib/botname.js';
import { getFooter } from '../../lib/menuHelper.js';
import { downloadAudioWithFallback } from '../../lib/audioDownloader.js';

const KEITH_BASE  = 'https://apiskeith.top/download';
const XCASPER_API = 'https://apis.xcasper.space/api/downloader/yt-audio';
const BK9_BASE    = 'https://api.bk9.dev/download';

// ── Search YouTube and return first result ────────────────────────────────
async function searchYouTube(query) {
  const { videos } = await yts(query);
  if (!videos?.length) throw new Error('No YouTube results found for that search.');
  const v = videos[0];
  return {
    url:       `https://www.youtube.com/watch?v=${v.videoId}`,
    title:     v.title     || query,
    thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`
  };
}

// ── Download audio buffer from URL ────────────────────────────────────────
async function downloadBuffer(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 180000,
    maxRedirects: 10,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  const buf = Buffer.from(res.data);
  if (buf.length < 5000) throw new Error('file too small');
  return buf;
}

// ── Keith audio API ───────────────────────────────────────────────────────
async function tryKeithAudio(ytUrl) {
  const endpoints = ['yta', 'yta3', 'mp3'];
  for (const ep of endpoints) {
    try {
      const res = await axios.get(`${KEITH_BASE}/${ep}`, {
        params: { url: ytUrl }, timeout: 35000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const d = res.data;
      if (!(d?.status === true || d?.success === true)) continue;
      if (typeof d?.result !== 'string' || !d.result.startsWith('http')) continue;
      if (d.result.includes('googlevideo.com') || d.result === 'Waiting...') continue;
      return await downloadBuffer(d.result);
    } catch {}
  }
  throw new Error('all Keith audio endpoints failed');
}

// ── XCasper audio API ─────────────────────────────────────────────────────
async function tryXcasperAudio(ytUrl) {
  const res = await axios.get(XCASPER_API, {
    params: { url: ytUrl }, timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const d = res.data;
  if (!d?.success) throw new Error(d?.message || 'xcasper: no audio');
  const dlUrl = d?.result?.download_url || d?.result?.url || d?.download_url || d?.url;
  if (!dlUrl) throw new Error('xcasper: no download URL');
  return await downloadBuffer(dlUrl);
}

// ── BK9 audio API ────────────────────────────────────────────────────────
async function tryBk9Audio(ytUrl) {
  try {
    const res = await axios.get(`${BK9_BASE}/youtube`, {
      params: { url: ytUrl, type: 'audio' },
      timeout: 30000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const d = res.data;
    if (d?.status === true && d?.BK9?.url) return await downloadBuffer(d.BK9.url);
  } catch {}
  throw new Error('BK9 audio failed');
}

export default {
  name: 'song2',
  aliases: ['ytv'],
  category: 'Downloader',
  description: 'Download YouTube audio (was video — now downloads audio)',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;
    const p   = prefix || '/';
    const quotedText = m.quoted?.text?.trim()
      || m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation?.trim()
      || '';

    const input = args.join(' ').trim() || quotedText;

    if (!input) {
      return sock.sendMessage(jid, {
        text:
          `╭─⌈ 🎵 *YTV AUDIO* ⌋\n` +
          `│\n` +
          `├─⊷ *${p}ytv <song name>*\n` +
          `│  └⊷ Search and download audio\n` +
          `├─⊷ *${p}ytv <YouTube URL>*\n` +
          `│  └imiter Download from link\n` +
          `│\n` +
          `╰imiter ${getFooter(m.key.participant || m.key.remoteJid)}`
      }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      // ── Step 1: Resolve to YouTube URL ───────────────────────────────────
      const isUrl = /^https?:\/\//i.test(input);
      let ytUrl = input;
      let title = 'YouTube Audio';

      if (!isUrl) {
        const found = await searchYouTube(input);
        ytUrl = found.url;
        title = found.title;
      }

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      // ── Step 2: Download AUDIO (not video) ─────────────────────────────────
      let audioBuffer = null;

      // 1️⃣ XCasper audio (same provider as .ytv video — confirmed working)
      try { audioBuffer = await tryXcasperAudio(ytUrl); } catch (e) { console.log(`[YTV] xcasper: ${e.message}`); }

      // 2️⃣ Keith audio
      if (!audioBuffer) { try { audioBuffer = await tryKeithAudio(ytUrl); } catch (e) { console.log(`[YTV] keith: ${e.message}`); } }

      // 3️⃣ BK9 audio
      if (!audioBuffer) { try { audioBuffer = await tryBk9Audio(ytUrl); } catch (e) { console.log(`[YTV] bk9: ${e.message}`); } }

      // 4️⃣ Fallback: downloadAudioWithFallback (yt-dlp + more APIs)
      if (!audioBuffer) { audioBuffer = await downloadAudioWithFallback(ytUrl); }

      if (!audioBuffer) throw new Error('All audio providers failed');

      const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(1);
      const cleanTitle = title.replace(/[^\w\s.-]/gi, '').substring(0, 50);

      // ── Step 3: Send as AUDIO (not video) ──────────────────────────────────
      await sock.sendMessage(jid, {
        audio:    audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
        caption:  `🎵 *${title}*\n📦 ${sizeMB}MB\n ${getBotName()}`
      }, { quoted: m });

      // Also send as a saveable document
      await sock.sendMessage(jid, {
        document: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`[YTV] ✅ Audio "${title}" ${sizeMB}MB`);

    } catch (err) {
      console.error('[YTV] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      return sock.sendMessage(jid, {
        text: `❌ *Download failed*\n\n_${err.message}_`
      }, { quoted: m });
    }
  }
};
