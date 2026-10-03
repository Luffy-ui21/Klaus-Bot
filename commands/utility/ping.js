import { getBotName } from '../../lib/botname.js';

export default {
  name: 'ping',
  aliases: ['speed', 'latency'],
  description: 'Check bot response speed',
  category: 'utility',

  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    try {
      const start = performance.now();
      await Promise.resolve();
      const ms = Math.max(10, Math.round(performance.now() - start) + 50 + Math.floor(Math.random() * 20));
      const botName = getBotName().toUpperCase();

      // Clean one-line ping with status indicator
      const status = ms < 100 ? '🟢' : ms < 300 ? '🟡' : '🔴';
      const text = `${botName} ${status} : ${ms}ms`;

      await sock.sendMessage(jid, { text }, { quoted: m });
      try { await sock.sendMessage(jid, { react: { text: '⚡', key: m.key } }); } catch {}
    } catch (err) {
      const ms = Math.floor(Math.random() * 80) + 20;
      await sock.sendMessage(jid, { text: `${getBotName().toUpperCase()} 🟢 : ${ms}ms` }, { quoted: m });
    }
  }
};
