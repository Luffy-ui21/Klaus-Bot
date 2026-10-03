'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');

// ── Fix 1: dotenv index.js shim ─────────────────────────────────────────────
const dotenvDir = path.join(root, 'node_modules', 'dotenv');
if (fs.existsSync(dotenvDir)) {
  const idx = path.join(dotenvDir, 'index.js');
  const main = path.join(dotenvDir, 'lib', 'main.js');
  if (!fs.existsSync(idx) && fs.existsSync(main)) {
    fs.writeFileSync(idx, "'use strict';\nmodule.exports = require('./lib/main.js');\n");
  }
}

// ── Fix 2: ensure ffmpeg-static binary is downloaded ────────────────────────
const ffmpegStaticDir = path.join(root, 'node_modules', 'ffmpeg-static');
if (fs.existsSync(ffmpegStaticDir)) {
  const binaryPath  = path.join(ffmpegStaticDir, 'ffmpeg');
  const binaryPathW = path.join(ffmpegStaticDir, 'ffmpeg.exe');
  const hasBinary   = fs.existsSync(binaryPath) || fs.existsSync(binaryPathW);
  if (!hasBinary) {
    try {
      console.log('[patch-modules] ffmpeg-static binary missing — downloading…');
      execSync('node install.js', {
        cwd:     ffmpegStaticDir,
        stdio:   'inherit',
        timeout: 120000,
      });
      console.log('[patch-modules] ffmpeg-static binary downloaded ✓');
    } catch (e) {
      console.warn('[patch-modules] ffmpeg-static download failed (non-fatal):', e.message);
    }
  }
}

// ── Fix 3: ensure bin/yt-dlp is executable ──────────────────────────────────
// The yt-dlp binary is committed to the repo but may lose its execute
// permission during git operations or when deployed to cloud platforms
// (Heroku, Railway, Render, etc.). This ensures it's always executable.
const ytDlpPath = path.join(root, 'bin', 'yt-dlp');
if (fs.existsSync(ytDlpPath)) {
  try {
    fs.chmodSync(ytDlpPath, 0o755);
    console.log('[patch-modules] bin/yt-dlp chmod +x ✓');
  } catch (e) {
    // On some platforms chmod might fail — try execSync as fallback
    try {
      execSync(`chmod +x "${ytDlpPath}"`, { stdio: 'ignore' });
      console.log('[patch-modules] bin/yt-dlp chmod +x (via exec) ✓');
    } catch {}
  }
}
