import { getBotName } from '../../lib/botname.js';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let giftedBtns;
try { giftedBtns = require('wolfbtns'); } catch {}

const CONTACT_FILE = path.join(process.cwd(), 'bot_owner_contact.json');

function getOwnerContact() {
    // Default to the bot owner's number
    return '254711815459';
}

export default {
    name: 'owner',
    alias: ['creator', 'dev', 'developer'],
    description: 'Show bot owner contact',
    category: 'owner',

    async execute(sock, m, args, PREFIX, extra) {
        const jid = m.key.remoteJid;

        // If user provides a number, save it
        if (args[0]) {
            const { jidManager } = extra || {};
            const isOwner = jidManager?.isOwner(m) || false;
            if (!isOwner) {
                return sock.sendMessage(jid, {
                    text: `❌ *Owner Only Command!*`
                }, { quoted: m });
            }
            const newNumber = args[0].replace(/\D/g, '');
            if (newNumber.length < 7) {
                return sock.sendMessage(jid, {
                    text: `❌ Invalid number. Example: \`${PREFIX}owner 254711815459\``
                }, { quoted: m });
            }
            try {
                fs.writeFileSync(CONTACT_FILE, JSON.stringify({ number: newNumber }, null, 2));
            } catch {}
            return sock.sendMessage(jid, {
                text: `✅ *Owner number updated*\n\`+${newNumber}\``
            }, { quoted: m });
        }

        const ownerNumber = getOwnerContact();

        try { await sock.sendMessage(jid, { react: { text: '👑', key: m.key } }); } catch {}

        const vcard =
            'BEGIN:VCARD\n' +
            'VERSION:3.0\n' +
            `FN:KLAUS (Bot Owner)\n` +
            `ORG:${getBotName()};\n` +
            `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` +
            'END:VCARD';

        // Try interactive buttons
        if (giftedBtns?.sendInteractiveMessage) {
            try {
                await giftedBtns.sendInteractiveMessage(sock, jid, {
                    text: `◈ *OWNER : KLAUS*\n\n◈ *WhatsApp : +${ownerNumber}*`,
                    footer: ` ${getBotName()}`,
                    interactiveButtons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: '📋 Copy Number',
                                copy_code: `+${ownerNumber}`
                            })
                        },
                        {
                            name: 'cta_url',
                            buttonParamsJson: JSON.stringify({
                                display_text: '💬 Message Owner',
                                url: `https://wa.me/${ownerNumber}`
                            })
                        }
                    ]
                });
                await sock.sendMessage(jid, {
                    contacts: { displayName: 'KLAUS (Bot Owner)', contacts: [{ vcard }] }
                }, { quoted: m });
                return;
            } catch {}
        }

        // Fallback: text + contact card
        await sock.sendMessage(jid, {
            text: `◈ *OWNER : KLAUS*\n◈ *WhatsApp : +${ownerNumber}*\n\n💬 https://wa.me/${ownerNumber}`
        }, { quoted: m });
        await sock.sendMessage(jid, {
            contacts: { displayName: 'KLAUS (Bot Owner)', contacts: [{ vcard }] }
        }, { quoted: m });
    }
};
