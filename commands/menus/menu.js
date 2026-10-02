import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { getBotName } from '../../lib/botname.js';

const exec = promisify(execCallback);
const menuDirectory = path.dirname(fileURLToPath(import.meta.url));
const cacheTtl = 10 * 60 * 1000;
let mediaCache = null;
let mediaCacheAt = 0;

function localPath(...parts) { return path.join(process.cwd(), ...parts); }

async function getMenuMedia() {
  const paths = [
    localPath('data', 'wolfbot_menu_custom.jpg'),
    localPath('data', 'wolfbot_menu_custom.png'),
    path.join(menuDirectory, 'media', 'wolfbot.jpg'),
    path.join(menuDirectory, 'media', 'wolfbot.png'),
    path.join(menuDirectory, 'media', 'klasu-md.png'),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      const now = Date.now();
      if (!mediaCache || mediaCache.kind !== 'image' || now - mediaCacheAt > cacheTtl) {
        mediaCache = { kind: 'image', buffer: fs.readFileSync(p) };
        mediaCacheAt = now;
      }
      return mediaCache;
    }
  }
  return null;
}

export function invalidateMenuImageCache() { mediaCache = null; mediaCacheAt = 0; }

function ramBar(percent) {
  const filled = Math.round(percent / 10);
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${Math.round(percent)}%`;
}

let _botStartTime = Date.now();
export function setStartTime(ts) { _botStartTime = ts; }

function buildMenu(message, commands) {
  const prefix = global.prefix || process.env.PREFIX || '.';
  const botName = getBotName();
  const mem = process.memoryUsage();
  const memMB = (mem.rss / 1024 / 1024).toFixed(0);
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(0);
  const memPercent = Math.min(100, (mem.rss / 1024 / 1024 / 512) * 100);
  const uptimeMs = Date.now() - _botStartTime;
  const upH = Math.floor(uptimeMs / 3600000);
  const upM = Math.floor((uptimeMs % 3600000) / 60000);
  const platform = process.env.DYNO ? 'Heroku' : process.env.RENDER ? 'Render' : process.env.RAILWAY_PROJECT_ID ? 'Railway' : 'Panel';
  const mode = (global.BOT_MODE || process.env.BOT_MODE || 'public');

  const sections = [
    ['AI MENU', ['analyze','blackbox','cat','chatbot','chatgpt','claudeai','deepseek','gemini','gpt','grok','kimi','llama','metai','mistral','perplexity','qwen','story','summarize','translate2']],
    ['ANIME MENU', ['anime','cuddle','hug','kiss','neko','pat','slap','waifu','wink']],
    ['AUDIO MENU', ['bassboost','deep','echo','fast','nightcore','reverse','robot','slow','toaudio','tomp3','toptt']],
    ['DOWNLOAD MENU', ['apk','facebook','instagram','mediafire','song','spotify','tiktok','twitter','ytmp3','ytmp4','ytv','playlist']],
    ['FUN MENU', ['8ball','coinflip','dare','dice','fact','joke','quote','truth','trivia','wordle']],
    ['GAMES MENU', ['chess','hangman','memory','slots','snake','ttt','numberguess']],
    ['GROUP MENU', ['add','demote','hidetag','kick','leave','link','mute','promote','revoke','setdesc','setname','tagall','unmute','warn','welcome']],
    ['IMAGE MENU', ['carbon','jail','remini','rainbow','trigger','wanted','wasted','wallpaper']],
    ['LOGO MENU', ['neonlogo','firelogo','goldlogo','silverlogo','rainbowlogo','dragonlogo','phoenixlogo','moonlogo','lightninglogo','crystallogo']],
    ['TOOLS MENU', ['calc','define','google','iplookup','ping','qr','shorturl','speed','translate','uptime','url','weather','wiki']],
    ['OWNER MENU', ['about','broadcast','owner','pair','repo','restart','sessionid','setbotname','setmode','setprefix','settimezone','shutdown']],
    ['INFO MENU', ['alive','botstatus','platform','prefixinfo','sessioninfo','whoami']],
    ['SETTINGS MENU', ['autobio','autoread','autoreact','autotype','autoviewstatus','setemoji','anticall','antidelete','antilink','antispam','antisticker']],
    ['MEDIA MENU', ['logo','status','groupst','tosticker','toimage','tovideo','tovoice','tts','vv']],
    ['MUSIC MENU', ['lyrics','shazam','spotify','musicmenu']],
    ['SPORTS MENU', ['sportsnews','matches','standings','scorers']],
  ];

  let text = '';

  // Status dashboard
  text += `┏▣ ◈ *${botName.toUpperCase()}* ◈\n`;
  text += `┃ *ᴏᴡɴᴇʀ* : Not Set\n`;
  text += `┃ *ᴘʀᴇғɪx* : [ ${prefix} ]\n`;
  text += `┃ *ʜᴏsᴛ* : ${platform}\n`;
  text += `┃ *ᴘʟᴜɢɪɴs* : ${commands}\n`;
  text += `┃ *ᴍᴏᴅᴇ* : ${mode.charAt(0).toUpperCase() + mode.slice(1)}\n`;
  text += `┃ *ᴠᴇʀsɪᴏɴ* : 1.1.5\n`;
  text += `┃ *sᴘᴇᴇᴅ* : ${(Date.now() % 1000)}.${(Date.now() % 100)} ms\n`;
  text += `┃ *ᴜsᴀɢᴇ* : ${memMB} MB of ${totalMem} GB\n`;
  text += `┃ *ʀᴀᴍ* : ${ramBar(memPercent)}\n`;
  text += `┃ *ᴜᴘᴛɪᴍᴇ* : ${upH}h ${upM}m\n`;
  text += `┗▣\n`;
  text += `\n`;

  // Command sections
  for (const [title, cmds] of sections) {
    text += `┏▣ ◈ *${title}* ◈\n`;
    for (const cmd of cmds) {
      text += `┃➽ ${cmd}\n`;
    }
    text += `┗▣\n\n`;
  }

  text += `◈ ♔ OWNER : Not Set\n`;
  text += `◈ ◇ POWERED BY KLAUS LABS ◇`;

  return text;
}

export default {
  name: 'menu',
  description: 'Shows the KLAUS MD menu',
  async execute(sock, message) {
    const jid = message.key.remoteJid;
    const cmdCount = global.commands?.size || 0;
    const text = buildMenu(message, cmdCount);
    const media = await getMenuMedia();
    if (media?.buffer) {
      await sock.sendMessage(jid, { image: media.buffer, caption: text, mimetype: 'image/jpeg' }, { quoted: message });
    } else {
      await sock.sendMessage(jid, { text }, { quoted: message });
    }
  }
};
