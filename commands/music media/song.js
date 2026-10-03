import yts from 'yt-search';
import { getBotName } from '../../lib/botname.js';
import { getFooter } from '../../lib/menuHelper.js';
import { sigLog } from '../../lib/sigLog.js';
import { downloadAudioWithFallback } from '../../lib/audioDownloader.js';

// ── Search YouTube (fast — 5 second timeout) ──────────────────────────────
async function searchYouTube(query) {
  try {
    const { videos } = await yts(query);
    if (videos?.length) {
      const v = videos[0];
      return {
        url:   `https://www.youtube.com/watch?v=${v.videoId}`,
        title: v.title || query,
        thumb: v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
        author: v.author?.name || '',
      };
    }
  } catch {}
  return null;
}

// ── Download buffer from URL ──────────────────────────────────────────────
async function downloadBuffer(url, timeout = 30000) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout,
    maxRedirects: 10,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  const buf = Buffer.from(res.data);
  if (buf.length < 5000) throw new Error('file too small');
  return buf;
}

// ── Download audio (3-tier fallback — same APIs as .song2) ────────────────
async function downloadAudio(ytUrl) {
  // 1️⃣ xcasper audio API (confirmed working for .song2)
  try {
    sigLog('🌐', 'SONG', 'Trying xcasper audio...');
    const res = await axios.get(XCASPER_API, {
      params: { url: ytUrl }, timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const d = res.data;
    if (d?.success) {
      const dlUrl = d?.result?.download_url || d?.result?.url || d?.download_url || d?.url;
      if (dlUrl) {
        const buf = await downloadBuffer(dlUrl, 30000);
        sigLog('✅', 'SONG', 'xcasper audio downloaded', { Size: `${(buf.length/1024/1024).toFixed(1)}MB` });
        return buf;
      }
    }
  } catch (e) { sigLog('❌', 'SONG', `xcasper: ${e.message}`); }

  // 2️⃣ keith audio API
  try {
    sigLog('🌐', 'SONG', 'Trying keith audio...');
    for (const ep of ['yta', 'yta3', 'mp3']) {
      const res = await axios.get(`${KEITH_BASE}/${ep}`, {
        params: { url: ytUrl }, timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const d = res.data;
      if (d?.status === true || d?.success === true) {
        if (typeof d?.result === 'string' && d.result.startsWith('http')) {
          if (!d.result.includes('googlevideo.com') && d.result !== 'Waiting...') {
            const buf = await downloadBuffer(d.result, 30000);
            sigLog('✅', 'SONG', `keith/${ep} downloaded`, { Size: `${(buf.length/1024/1024).toFixed(1)}MB` });
            return buf;
          }
        }
      }
    }
  } catch (e) { sigLog('❌', 'SONG', `keith: ${e.message}`); }

  // 3️⃣ bk9 audio API
  try {
    sigLog('🌐', 'SONG', 'Trying bk9 audio...');
    const res = await axios.get(`${BK9_BASE}/youtube`, {
      params: { url: ytUrl, type: 'audio' }, timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const d = res.data;
    if (d?.status === true && d?.BK9?.url) {
      const buf = await downloadBuffer(d.BK9.url, 30000);
      sigLog('✅', 'SONG', 'bk9 audio downloaded', { Size: `${(buf.length/1024/1024).toFixed(1)}MB` });
      return buf;
    }
  } catch (e) { sigLog('❌', 'SONG', `bk9: ${e.message}`); }

  return null;
}

export default {
  name: 'song',
  aliases: ['music', 'audio', 'mp3', 'ytmusic', 'ytplay', 'ytmp3', 'singit'],
  category: 'Downloader',
  description: 'Download YouTube audio — fast (<20s)',

  async execute(sock, m, args, prefix) {
    const jid = m.key.remoteJid;
    const p = prefix || '.';
    const input = args.join(' ').trim() || m.quoted?.text?.trim() || '';

    if (!input) {
      return sock.sendMessage(jid, {
        text: `🎵 *SONG DOWNLOAD*\n\nUsage: ${p}song <song name>\nExample: ${p}song juice wrld robbery`
      }, { quoted: m });
    }

    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

    try {
      const isUrl = /^https?:\/\//i.test(input);
      let ytUrl, title;

      // Step 1: Resolve to YouTube URL (skip if already a URL)
      if (isUrl) {
        ytUrl = input;
        title = 'YouTube Audio';
      } else {
        const result = await searchYouTube(input);
        if (!result) {
          await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
          return sock.sendMessage(jid, { text: `❌ *No results found for:* ${input}` }, { quoted: m });
        }
        ytUrl = result.url;
        title = result.title;
      }

      await sock.sendMessage(jid, { react: { text: '📥', key: m.key } });

      // Step 2: Download audio (downloads video → extracts audio with ffmpeg)
      const audioBuffer = await downloadAudioWithFallback(ytUrl);

      if (!audioBuffer) {
        await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
        return sock.sendMessage(jid, { text: '❌ *Download failed. Please try again later.*' }, { quoted: m });
      }

      const sizeMB = (audioBuffer.length / 1024 / 1024).toFixed(1);
      const cleanTitle = title.replace(/[^\w\s.-]/gi, '').substring(0, 50);

      // Step 3: Send as audio (playable + saveable)
      await sock.sendMessage(jid, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${cleanTitle}.mp3`,
      }, { quoted: m });

      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
      console.log(`[SONG] ✅ "${title}" ${sizeMB}MB`);

    } catch (err) {
      console.error('[SONG] Error:', err.message);
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      return sock.sendMessage(jid, { text: `❌ *Download failed*\n\n${err.message}\n\nTry .song2 <name>` }, { quoted: m });
    }
  }
};
