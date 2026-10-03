import { exec } from 'child_process';
import { promisify } from 'util';
import { getBotName } from '../../lib/botname.js';
import { OWNER, REPO, REPO_URL } from '../../lib/repoConfig.js';

const execAsync = promisify(exec);
const _R = 'origin';

function sanitizeErr(msg = '') {
  return msg.replace(/https?:\/\/[^\s'"]+/g, '[remote]').trim();
}

async function run(cmd, timeout = 60000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout, windowsHide: true }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || stdout || err.message));
      resolve(stdout.toString().trim());
    });
  });
}

export default {
  name: 'restartbot',
  alias: ['restart', 'reboot', 'updatebot'],
  description: 'Restart bot and load latest version from GitHub',
  category: 'owner',
  ownerOnly: true,

  async execute(sock, m, args, PREFIX, extra) {
    const jid = m.key.remoteJid;
    const isOwner = extra?.jidManager?.isOwner?.(m) || false;

    if (!isOwner) {
      return sock.sendMessage(jid, {
        text: '❌ *Owner only command*'
      }, { quoted: m });
    }

    try {
      await sock.sendMessage(jid, { react: { text: '⏳', key: m.key } });

      // Send initial status
      const statusMsg = await sock.sendMessage(jid, {
        text: `◈ *Restarting ${getBotName().toUpperCase()}...*\n\n⏳ Fetching latest version from GitHub...`
      }, { quoted: m });

      const editStatus = async (text) => {
        try {
          if (statusMsg?.key) {
            await sock.sendMessage(jid, { text, edit: statusMsg.key });
          }
        } catch {}
      };

      // Detect platform
      const isHeroku = !!(process.env.DYNO || process.env.HEROKU_APP_NAME);
      const isRender = !!(process.env.RENDER || process.env.RENDER_SERVICE_ID);
      const isRailway = !!(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT);
      const isCloud = isHeroku || isRender || isRailway;

      // ── HEROKU: Try to trigger a new build via Heroku API ──────────────
      // If the user has HEROKU_API_KEY and HEROKU_APP_NAME set, we can
      // trigger a new build from the GitHub repo directly. This downloads
      // the latest code from GitHub and rebuilds the slug.
      if (isHeroku && process.env.HEROKU_API_KEY && process.env.HEROKU_APP_NAME) {
        await editStatus(`◈ *Heroku detected*\n\n🔄 Triggering new build from GitHub...\n📦 Repo: ${OWNER}/${REPO}\n\n⏳ This takes 2-5 minutes. The bot will restart automatically.`);

        try {
          const axios = (await import('axios')).default;
          const appName = process.env.HEROKU_APP_NAME;
          const apiKey = process.env.HEROKU_API_KEY;

          // Trigger a new build from the GitHub source tarball
          const sourceUrl = `https://github.com/${OWNER}/${REPO}/archive/refs/heads/main.tar.gz`;
          const res = await axios.post(
            `https://api.heroku.com/apps/${appName}/builds`,
            { source_blob: { url: sourceUrl, checksum: null } },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/vnd.heroku+json; version=3',
                'Content-Type': 'application/json',
              },
              timeout: 30000,
            }
          );

          await editStatus(`◈ *Build triggered! ✅*\n\n📦 Repo: ${OWNER}/${REPO}\n🔄 Build ID: ${res.data?.id || 'N/A'}\n⏳ Building (2-5 min)...\n\nThe bot will restart automatically when the build completes.`);

          // Wait for build, then exit so Heroku picks up the new slug
          await new Promise(r => setTimeout(r, 5000));

          await sock.sendMessage(jid, {
            text: `✅ *Build triggered successfully!*\n\n🔄 Heroku is rebuilding from GitHub.\nThe bot will restart automatically with the new code.\n\n⏳ Estimated time: 2-5 minutes`
          }, { quoted: m });

          // Exit — Heroku will restart with the new slug once the build completes
          if (typeof globalThis.preExitSave === 'function') {
            try { await globalThis.preExitSave(); } catch {}
          }
          process.exit(0);

        } catch (apiErr) {
          await editStatus(`⚠️ Heroku API build failed: ${sanitizeErr(apiErr.message)}\nFalling back to dyno restart...`);
          // Fall through to process.exit(0) below
        }
      }

      // ── CLOUD (Heroku/Render/Railway): Just restart the process ────────
      // If auto-deploy is enabled, the latest code is already built into the
      // slug. process.exit(0) causes the platform to restart the dyno with
      // the latest slug.
      if (isCloud) {
        const platform = isHeroku ? 'Heroku' : isRender ? 'Render' : 'Railway';
        await editStatus(`◈ *${platform} detected*\n\n🔄 Restarting to load latest code...\n\n💡 Make sure auto-deploy is ON in your ${platform} dashboard\n💡 Push updates to GitHub: github.com/${OWNER}/${REPO}`);

        await new Promise(r => setTimeout(r, 2000));

        await sock.sendMessage(jid, {
          text: `✅ *Restarting now!*\n\n🔄 ${platform} will restart the bot with the latest code.\n\n📌 If you pushed new code to GitHub:\n• Auto-deploy ON → new code loads automatically\n• Auto-deploy OFF → trigger a manual build in ${platform} dashboard\n\nGitHub: https://github.com/${OWNER}/${REPO}`
        }, { quoted: m });

        if (typeof globalThis.preExitSave === 'function') {
          try { await globalThis.preExitSave(); } catch {}
        }
        process.exit(0);
        return;
      }

      // ── LOCAL / PTERODACTYL: git fetch + merge + npm install + restart ──
      await editStatus('◈ *Local deployment detected*\n\n🌐 Fetching latest from GitHub...');

      try {
        const oldRev = await run('git rev-parse HEAD').catch(() => 'unknown');
        await run(`git fetch ${_R} --depth=5 --prune`, 30000);
        const newRev = await run(`git rev-parse ${_R}/main`).catch(() => null);

        if (oldRev === newRev) {
          await editStatus('✅ *Already up to date!*\nNo new commits found.');
        } else {
          await editStatus('📥 *New updates found!*\nMerging...');
          try {
            await run(`git merge --ff-only ${newRev}`);
          } catch {
            await run(`git merge --no-edit --allow-unrelated-histories ${newRev}`);
          }
          await editStatus('📦 *Installing dependencies...*');
          try {
            await run('npm install --no-audit --no-fund --loglevel=error', 180000);
          } catch {}
          await editStatus(`✅ *Updated to latest!*\nCommit: ${(newRev || '').slice(0, 7)}`);
        }
      } catch (gitErr) {
        await editStatus(`⚠️ Git update skipped: ${sanitizeErr(gitErr.message)}\nContinuing with restart...`);
      }

      await new Promise(r => setTimeout(r, 2000));

      await sock.sendMessage(jid, {
        text: `✅ *Restart complete!*\n\n🔄 Bot is restarting now with the latest code.\n\nGitHub: https://github.com/${OWNER}/${REPO}`
      }, { quoted: m });

      if (typeof globalThis.preExitSave === 'function') {
        try { await globalThis.preExitSave(); } catch {}
      }

      // Try pm2 restart, then process.exit
      try {
        await run('pm2 restart all', 10000);
      } catch {
        process.exit(0);
      }

    } catch (err) {
      await sock.sendMessage(jid, {
        text: `❌ *Restart failed*\n\nError: ${sanitizeErr(err.message)}\n\nUse \`${PREFIX}restartbot\` to try again.`
      }, { quoted: m });
    }
  }
};
