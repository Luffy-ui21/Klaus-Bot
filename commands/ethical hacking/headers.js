import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';

const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'x-xss-protection',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
  'cross-origin-resource-policy',
  'cross-origin-embedder-policy'
];

export default {
  name: 'headers',
  alias: ['httpheaders', 'secheaders'],
  description: 'HTTP headers analyzer - check security headers',
  category: 'ethical hacking',
  usage: 'headers <url>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🛡️ *HTTP HEADERS ANALYZER* ⌋\n│\n├─⊷ *${PREFIX}headers <url>*\n│  └⊷ Analyze HTTP response headers\n│\n├─⊷ *Example:*\n│  └⊷ ${PREFIX}headers google.com\n│  └⊷ ${PREFIX}headers https://example.com\n│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      let url = args[0];
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

      const response = await axios.get(url, {
        timeout: 15000,
        maxRedirects: 5,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KLAUS MD/1.0)' },
        validateStatus: () => true
      });

      const headers = response.headers;
      const presentSecurity = [];
      const missingSecurity = [];

      SECURITY_HEADERS.forEach(h => {
        if (headers[h]) {
          presentSecurity.push({ name: h, value: headers[h] });
        } else {
          missingSecurity.push(h);
        }
      });

      let result = `╭─⌈ 🛡️ *HTTP HEADERS ANALYZER* ⌋\n│\n`;
      result += `├─⊷ *URL:* ${url}\n`;
      result += `├─⊷ *Status:* ${response.status} ${response.statusText}\n`;
      result += `├─⊷ *Server:* ${headers['server'] || 'Hidden'}\n│\n`;

      result += `├─⊷ *✅ Security Headers Present:*\n`;
      if (presentSecurity.length > 0) {
        presentSecurity.forEach(h => {
          const val = String(h.value).length > 80 ? String(h.value).substring(0, 80) + '...' : h.value;
          result += `│  └⊷ *${h.name}:* ${val}\n`;
        });
      } else {
        result += `│  └⊷ None found!\n`;
      }

      result += `│\n├─⊷ *❌ Missing Security Headers:*\n`;
      if (missingSecurity.length > 0) {
        missingSecurity.forEach(h => {
          result += `│  └⊷ ${h}\n`;
        });
      } else {
        result += `│  └⊷ All security headers present! 🎉\n`;
      }

      result += `│\n├─⊷ *📋 All Response Headers:*\n`;
      Object.entries(headers).slice(0, 20).forEach(([key, value]) => {
        const val = String(value).length > 60 ? String(value).substring(0, 60) + '...' : value;
        result += `│  └⊷ *${key}:* ${val}\n`;
      });

      const score = Math.round((presentSecurity.length / SECURITY_HEADERS.length) * 100);
      result += `│\n├─⊷ *Security Score:* ${score}% (${presentSecurity.length}/${SECURITY_HEADERS.length})\n`;
      result += `│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
