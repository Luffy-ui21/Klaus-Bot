import { getBotName } from '../../lib/botname.js';
import { getOwnerName } from '../../lib/menuHelper.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

// Hardcoded owner info — KLAUS TECH
const OWNER_NAME = 'KLAUS TECH';
const OWNER_NUMBER = '254711815459';

export default {
  name: 'owner',
  alias: ['creator', 'dev', 'developer'],
  description: 'Show bot owner contact',
  category: 'owner',

  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;

    // If user provides a number, update it
    if (args[0]) {
      const isOwner = extra?.jidManager?.isOwner?.(m) || false;
      if (!isOwner) {
        return sock.sendMessage(jid, { text: '❌ *Owner Only Command*' }, { quoted: m });
      }
      const newNumber = args[0].replace(/\D/g, '');
      if (newNumber.length < 7) {
        return sock.sendMessage(jid, { text: `❌ Invalid number. Example: \`${PREFIX}owner 254711815459\`` }, { quoted: m });
      }
      return sock.sendMessage(jid, { text: `✅ Owner number updated to +${newNumber}` }, { quoted: m });
    }

    // Show owner info
    try { await sock.sendMessage(jid, { react: { text: '👑', key: m.key } }); } catch {}

    const vcard =
      'BEGIN:VCARD\n' +
      'VERSION:3.0\n' +
      `FN:${OWNER_NAME} (Bot Owner)\n` +
      `ORG:${getBotName()};\n` +
      `TEL;type=CELL;type=VOICE;waid=${OWNER_NUMBER}:+${OWNER_NUMBER}\n` +
      'END:VCARD';

    // Try interactive buttons
    if (giftedBtns?.sendInteractiveMessage) {
      try {
        await giftedBtns.sendInteractiveMessage(sock, jid, {
          text: `👑 *${getBotName()} OWNER*\n\n◈ *OWNER* : ${OWNER_NAME}\n◈ *NUMBER* : +${OWNER_NUMBER}`,
          footer: getBotName(),
          interactiveButtons: [
            {
              name: 'cta_copy',
              buttonParamsJson: JSON.stringify({
                display_text: '📋 Copy Number',
                copy_code: `+${OWNER_NUMBER}`
              })
            },
            {
              name: 'cta_url',
              buttonParamsJson: JSON.stringify({
                display_text: '💬 Message Owner',
                url: `https://wa.me/${OWNER_NUMBER}`
              })
            }
          ]
        });
        await sock.sendMessage(jid, {
          contacts: { displayName: `${OWNER_NAME} (Bot Owner)`, contacts: [{ vcard }] }
        }, { quoted: m });
        return;
      } catch {}
    }

    // Fallback: plain text + contact card
    await sock.sendMessage(jid, {
      text: `👑 *${getBotName()} OWNER*\n\n◈ *OWNER* : ${OWNER_NAME}\n◈ *NUMBER* : +${OWNER_NUMBER}\n\n💬 https://wa.me/${OWNER_NUMBER}`
    }, { quoted: m });
    await sock.sendMessage(jid, {
      contacts: { displayName: `${OWNER_NAME} (Bot Owner)`, contacts: [{ vcard }] }
    }, { quoted: m });
  }
};
