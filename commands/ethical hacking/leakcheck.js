import axios from 'axios';
import { getBotName } from '../../lib/botname.js';
import crypto from 'crypto';
import { getOwnerName } from '../../lib/menuHelper.js';

export default {
  name: 'leakcheck',
  alias: ['breachcheck', 'pwned', 'haveibeenpwned'],
  description: 'Check if email/password appeared in data breaches',
  category: 'ethical hacking',
  usage: 'leakcheck <email or password>',
  async execute(sock, m, args, PREFIX) {
    const jid = m.key.remoteJid;
    if (!args[0]) {
      return sock.sendMessage(jid, { text: `╭─⌈ 🔐 *LEAK CHECKER* ⌋\n│\n├─⊷ *${PREFIX}leakcheck <email>*\n│  └⊷ Check email in data breaches\n│\n├─⊷ *${PREFIX}leakcheck -p <password>*\n│  └⊷ Check password in breaches\n│     (uses k-anonymity, safe)\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*` }, { quoted: m });
    }
    await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });
    try {
      const isPasswordMode = args[0] === '-p' || args[0] === '--password';
      const input = isPasswordMode ? args.slice(1).join(' ') : args[0];

      if (!input) {
        return sock.sendMessage(jid, { text: `❌ Please provide an email or password to check.` }, { quoted: m });
      }

      let result;

      if (isPasswordMode) {
        const sha1Hash = crypto.createHash('sha1').update(input).digest('hex').toUpperCase();
        const prefix = sha1Hash.substring(0, 5);
        const suffix = sha1Hash.substring(5);

        const response = await axios.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
          timeout: 10000,
          headers: { 'User-Agent': 'KLAUS MD-BreachCheck' }
        });

        const lines = response.data.split('\n');
        const found = lines.find(line => line.startsWith(suffix));
        const count = found ? parseInt(found.split(':')[1].trim()) : 0;

        result = `╭─⌈ 🔐 *PASSWORD BREACH CHECK* ⌋\n│\n`;
        result += `├─⊷ *Status:* ${count > 0 ? '🔴 COMPROMISED' : '🟢 NOT FOUND'}\n│\n`;
        if (count > 0) {
          result += `├─⊷ *Breaches:* ${count.toLocaleString()} times\n`;
          result += `├─⊷ This password has appeared in\n│  known data breaches.\n│\n`;
          result += `├─⊷ ⚠️ *DO NOT USE THIS PASSWORD!*\n`;
          result += `│  └⊷ Change it immediately on all\n│     accounts that use it.\n`;
        } else {
          result += `├─⊷ This password was not found in\n│  any known data breaches.\n│\n`;
          result += `├─⊷ ℹ️ This doesn't guarantee safety,\n│  just that it's not in known leaks.\n`;
        }
        result += `│\n├─⊷ *Method:* HIBP k-Anonymity API\n`;
        result += `│  └⊷ Your password was NOT sent\n│     to any server (hash prefix only)\n`;
        result += `│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;
      } else {
        let breaches = [];
        let source = '';

        try {
          const response = await axios.get(`https://api.xposedornot.com/v1/check-email/${encodeURIComponent(input)}`, {
            timeout: 15000,
            headers: { 'User-Agent': 'KLAUS MD-BreachCheck' }
          });

          if (response.data && response.data.breaches) {
            const breachList = response.data.breaches;
            if (Array.isArray(breachList)) {
              breaches = breachList;
            } else if (typeof breachList === 'object') {
              breaches = Object.keys(breachList).map(k => ({ name: k, ...breachList[k] }));
            }
          }
          source = 'XposedOrNot';
        } catch (apiErr) {
          if (apiErr.response && apiErr.response.status === 404) {
            breaches = [];
            source = 'XposedOrNot';
          } else {
            try {
              const hibpRes = await axios.get(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(input)}?truncateResponse=false`, {
                timeout: 10000,
                headers: {
                  'User-Agent': 'KLAUS MD-BreachCheck',
                  'hibp-api-key': process.env.HIBP_API_KEY || ''
                }
              });
              breaches = hibpRes.data || [];
              source = 'Have I Been Pwned';
            } catch (hibpErr) {
              if (hibpErr.response && (hibpErr.response.status === 404 || hibpErr.response.status === 401)) {
                breaches = [];
                source = 'HIBP';
              } else {
                throw new Error('Could not reach breach databases. Try again later.');
              }
            }
          }
        }

        result = `╭─⌈ 🔐 *EMAIL BREACH CHECK* ⌋\n│\n`;
        result += `├─⊷ *Email:* ${input}\n`;
        result += `├─⊷ *Source:* ${source}\n│\n`;

        if (breaches.length > 0) {
          result += `├─⊷ *Status:* 🔴 BREACHED\n`;
          result += `├─⊷ *Found in:* ${breaches.length} breach(es)\n│\n`;
          const displayBreaches = breaches.slice(0, 10);
          displayBreaches.forEach((b, i) => {
            const name = b.Name || b.name || b.domain || 'Unknown';
            const date = b.BreachDate || b.breach_date || b.date || 'Unknown';
            const dataClasses = b.DataClasses || b.data || [];
            result += `│  ${i + 1}. *${name}*\n`;
            if (date !== 'Unknown') result += `│     📅 Date: ${date}\n`;
            if (Array.isArray(dataClasses) && dataClasses.length > 0) {
              result += `│     📋 Data: ${dataClasses.slice(0, 5).join(', ')}\n`;
            }
          });
          if (breaches.length > 10) {
            result += `│  ... and ${breaches.length - 10} more\n`;
          }
          result += `│\n├─⊷ ⚠️ *Recommendations:*\n`;
          result += `│  ├⊷ Change passwords on breached sites\n`;
          result += `│  ├⊷ Enable 2FA where possible\n`;
          result += `│  └⊷ Use unique passwords per site\n`;
        } else {
          result += `├─⊷ *Status:* 🟢 NO BREACHES FOUND\n│\n`;
          result += `├─⊷ This email was not found in\n│  known data breaches.\n│\n`;
          result += `├─⊷ ℹ️ Stay safe:\n`;
          result += `│  ├⊷ Use strong unique passwords\n`;
          result += `│  ├⊷ Enable 2FA on all accounts\n`;
          result += `│  └⊷ Check regularly for new breaches\n`;
        }
        result += `│\n╰───────────────\n> *${getOwnerName().toUpperCase()} TECH*`;
      }

      await sock.sendMessage(jid, { text: result }, { quoted: m });
      await sock.sendMessage(jid, { react: { text: '✅', key: m.key } });
    } catch (err) {
      await sock.sendMessage(jid, { react: { text: '❌', key: m.key } });
      await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: m });
    }
  }
};
