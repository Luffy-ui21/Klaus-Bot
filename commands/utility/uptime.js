import { getBotName } from '../../lib/botname.js';

export default {
  name: 'uptime',
  aliases: ['runtime'],
  description: 'Check how long the bot has been running',
  category: 'utility',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    try {
      const uptime  = process.uptime();
      const days    = Math.floor(uptime / 86400);
      const hours   = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);

      const status = uptime < 3600 ? '🔴' : uptime < 86400 ? '🟡' : '🟢';
      const botName = getBotName().toUpperCase();

      const text = `◈ ◇ ${botName} ${status} : ${days}D : ${hours}H : ${minutes}M`;

      await sock.sendMessage(jid, { text }, { quoted: m });
      try { await sock.sendMessage(jid, { react: { text: '⏱️', key: m.key } }); } catch {}
    } catch (err) {
      const uptime = process.uptime();
      const days = Math.floor(uptime / 86400);
      const hours = Math.floor((uptime % 86400) / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      await sock.sendMessage(jid, {
        text: `◈ ◇ ${getBotName().toUpperCase()} 🔴 : ${days}D : ${hours}H : ${minutes}M`
      }, { quoted: m });
    }
  }
};
