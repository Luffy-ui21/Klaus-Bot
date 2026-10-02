import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { getBotName } from '../../lib/botname.js';
import { getFooter } from '../../lib/menuHelper.js';
import { getBoxStyleCommands } from './commandList.js';

const exec = promisify(execCallback);
const menuDirectory = path.dirname(fileURLToPath(import.meta.url));
const cacheTtl = 10 * 60 * 1000;
let mediaCache = null;
let mediaCacheAt = 0;

function localPath(...parts) {
  return path.join(process.cwd(), ...parts);
}

async function getMenuMedia() {
  const customGif = localPath('data', 'wolfbot_menu_custom.gif');
  const customImageJpg = localPath('data', 'wolfbot_menu_custom.jpg');
  const customImagePng = localPath('data', 'wolfbot_menu_custom.png');
  const bundledGif = path.join(menuDirectory, 'media', 'wolfbot.gif');
  const bundledImageJpg = path.join(menuDirectory, 'media', 'wolfbot.jpg');
  const bundledImagePng = path.join(menuDirectory, 'media', 'wolfbot.png');
  const bundledImageKlaus = path.join(menuDirectory, 'media', 'klasu-md.png');
  const gifPath = fs.existsSync(customGif) ? customGif : fs.existsSync(bundledGif) ? bundledGif : null;
  const imagePath = fs.existsSync(customImageJpg) ? customImageJpg
                : fs.existsSync(customImagePng) ? customImagePng
                : fs.existsSync(bundledImageJpg) ? bundledImageJpg
                : fs.existsSync(bundledImagePng) ? bundledImagePng
                : fs.existsSync(bundledImageKlaus) ? bundledImageKlaus : null;
  const now = Date.now();

  if (gifPath) {
    if (!mediaCache || mediaCache.kind !== 'gif' || now - mediaCacheAt > cacheTtl) {
      mediaCache = { kind: 'gif', buffer: fs.readFileSync(gifPath), mp4: null };
      mediaCacheAt = now;
      const tempDir = localPath('tmp');
      const outputPath = path.join(tempDir, 'klasu-menu.mp4');
      fs.mkdirSync(tempDir, { recursive: true });
      exec(`ffmpeg -y -i "${gifPath}" -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" -c:v libx264 -pix_fmt yuv420p -preset fast -crf 23 -movflags +faststart -an "${outputPath}"`, { timeout: 25000 })
        .then(() => { mediaCache.mp4 = fs.readFileSync(outputPath); })
        .catch(() => {})
        .finally(() => { try { fs.unlinkSync(outputPath); } catch {} });
    }
    return mediaCache;
  }

  if (imagePath) {
    if (!mediaCache || mediaCache.kind !== 'image' || now - mediaCacheAt > cacheTtl) {
      mediaCache = { kind: 'image', buffer: fs.readFileSync(imagePath) };
      mediaCacheAt = now;
    }
    return mediaCache;
  }

  return null;
}

export function invalidateMenuImageCache() {
  mediaCache = null;
  mediaCacheAt = 0;
}

function getPrefix() {
  return global.prefix || process.env.PREFIX || '.';
}

// ── Build a RAM usage bar using Unicode block characters ──────────────────
function ramBar(percent) {
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${Math.round(percent)}%`;
}

// ── Build the status dashboard (shown first when .menu is typed) ──────────
function buildStatusDashboard(message, commands, startTime) {
  const prefix = getPrefix();
  const botName = getBotName();
  const mem = process.memoryUsage();
  const memMB = (mem.rss / 1024 / 1024).toFixed(1);
  const memPercent = Math.min(100, (mem.rss / 1024 / 1024 / 512) * 100);
  const uptimeMs = Date.now() - (startTime || Date.now());
  const uptimeH = Math.floor(uptimeMs / 3600000);
  const uptimeM = Math.floor((uptimeMs % 3600000) / 60000);
  const nodeVersion = process.version;
  const platform = process.env.DYNO ? 'Heroku' :
                   process.env.RENDER ? 'Render' :
                   process.env.RAILWAY_PROJECT_ID ? 'Railway' :
                   process.env.KOYEB_APP ? 'Koyeb' : 'Panel';
  const mode = global.BOT_MODE || process.env.BOT_MODE || 'public';
  const ownerNum = global.OWNER_NUMBER || process.env.OWNER_NUMBER || '254711815459';
  const speed = Math.round(process.uptime() * 1000) % 1000;

  // Advanced Unicode symbols (not emojis):
  // ◈ = White diamond containing black small diamond
  // ◇ = White diamond
  // █ = Full block (filled)
  // ░ = Light shade (empty)
  // ┌ ┐ └ ┘ ─ │ = Box drawing characters
  return [
    `◈ ◇ ${botName.toUpperCase()} ◇`,
    ``,
    `OWNER : KLAUS TECH`,
    `NUMBER : ${ownerNum}`,
    `PREFIX : [ ${prefix} ]`,
    `HOST : ${platform}`,
    `PLUGINS : ${commands}`,
    `MODE : ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
    `VERSION : 1.1.5`,
    `SPEED : ${speed}.${Date.now() % 1000} ms`,
    `USAGE : ${memMB} MB`,
    `RAM : ${ramBar(memPercent)}`,
    `UPTIME : ${uptimeH}h ${uptimeM}m`,
    `NODE : ${nodeVersion}`,
    ``,
    `◈ Type ${prefix}menu2 for full command list`,
    `◈ ${botName} ◈ KLAUS TECH`,
  ].join('\n');
}

async function sendMenu(sock, jid, message, text, media) {
  if (media?.kind === 'gif' && media.mp4) {
    await sock.sendMessage(jid, { video: media.mp4, gifPlayback: true, caption: text, mimetype: 'video/mp4' }, { quoted: message });
    return;
  }
  if (media?.buffer) {
    await sock.sendMessage(jid, { image: media.buffer, caption: text, mimetype: 'image/jpeg' }, { quoted: message });
    return;
  }
  await sock.sendMessage(jid, { text }, { quoted: message });
}

// Track bot start time for uptime
let _botStartTime = Date.now();
export function setStartTime(ts) { _botStartTime = ts; }

export default {
  name: 'menu',
  description: 'Shows the KLAUS MD status dashboard',
  async execute(sock, message, args, prefixStr, extra) {
    const jid = message.key.remoteJid;
    // Count loaded commands
    const cmdCount = global.commands?.size || 0;
    const text = buildStatusDashboard(message, cmdCount, _botStartTime);
    const media = await getMenuMedia();
    await sendMenu(sock, jid, message, text, media);
  }
};
