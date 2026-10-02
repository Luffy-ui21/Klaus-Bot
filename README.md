# KLAUS MD BOT

> Premium WhatsApp bot with AI chat, pair-link web, and auto-session authentication. Powered by wolfsocket (Baileys fork). Built by Klaus Labs.

[![WhatsApp](https://img.shields.io/badge/WhatsApp-Linked_Device-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://whatsapp.com)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Pair Link Web](#pair-link-web)
- [Deployment](#deployment)
- [Commands](#commands)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Credits](#credits)
- [License](#license)

---

## Overview

**KLASU MD** is a fully customized WhatsApp automation bot built on top of [WOLFBOT v1.1.5](https://github.com/WOLVAREX/v1.1.5-WOLFBOT-) by WOLVAREX. It uses the `wolfsocket` library (a Baileys fork) for WhatsApp communication and includes 30+ command categories, AI chat integrations, group management, media utilities, and a premium pairing web app.

### Key Branding

| Setting | Value |
|---------|-------|
| Bot name | `KLASU MD` |
| Session ID prefix | `KLAUS MD:` |
| Owner number | `254711815459` |
| Command prefix | `.` (dot) |
| Bot mode | `public` |
| Timezone | `Africa/Nairobi` |
| Deploy target | Railway / Render |

---

## Features

### Core
- **Auto-session authentication** — pair via 8-character code (no QR scanner needed)
- **30+ command categories** — AI, anime, automation, downloaders, economy, games, design, ephoto, photofunia, utility, owner, media conversion, menus, and more
- **Persistent configuration** — settings survive restarts via JSON files + `.env`
- **Multi-platform deploy** — Railway, Render, Fly.io, Heroku, Pterodactyl, Docker, Replit

### AI Chat (Enabled by default)
- ChatGPT, Gemini, Claude AI, DeepSeek, Blackbox, Copilot, Bing, Bard, Cohere, Llama, Falcon, Dolphin, and 20+ more
- All AI commands use the bundled `XWOLF_API_KEY` — no separate API keys needed

### Pair Link Web
- Premium glassmorphism UI with dark space + nebula + glowing particles
- Alternating cyan/purple neon corner accents
- Solid blue bot icon with ghost face
- Purple→blue gradient tabs and buttons
- Server picker (Server 1–5) when using PairSite backend
- Real-time WebSocket updates (pair code → session ID)
- Auto-refreshes expired pair codes every ~60s
- Dark translucent code box with white glowing text
- Session credentials panel with one-tap copy
- 5-step "How to use your code" instructions

### Bot Customizations (applied on top of WOLFBOT)
- All `🐺` wolf emojis removed
- All `🐾` paw emojis removed from user-facing strings
- `[WOLF-AUTH]` → `[KLAUS-AUTH]` log tag (and all other `[WOLF-*]` tags)
- `WOLFBOT CONTROL CORE` → `KLASU MD CONTROL CORE` boot banner
- `WOLF CORE BOOT SEQUENCE` → `KLASU MD BOOT SEQUENCE`
- `Silent Wolf Online` → `${botName} Online`
- `WOLFTECH` fallback → `KLASU MD`
- `SESSION_ID` prefix: `WOLF-BOT:` → `KLAUS MD:` (legacy prefix removed entirely)
- `lib/emojis.js` reconstructed (was missing from upstream)
- `isGiftedBtnsAvailable` export added to `lib/buttonHelper.js`
- Auto-update URLs neutralized in `settings.js`
- Bot menu image: custom KLAUS MD banner (JPG + PNG)

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   KLAUS MD BOT                       │
├─────────────────────────────────────────────────────┤
│  index.js (9.8K lines)                               │
│  ├── Baileys socket (wolfsocket)                     │
│  ├── Message router → commands/**/*.js               │
│  ├── Login manager (pair code / QR / ENV injection)  │
│  ├── Connection recovery + auto-restart              │
│  └── Web status server (port 3000, /health)          │
│                                                      │
│  lib/ (50+ helper modules)                           │
│  ├── botname.js    — bot display name management     │
│  ├── authState.js  — WhatsApp session storage        │
│  ├── menuHelper.js — menu image + footer helpers     │
│  ├── aiHelper.js   — AI command dispatcher            │
│  ├── emojis.js     — emoji constants (reconstructed) │
│  └── ...                                            │
│                                                      │
│  commands/ (30+ categories)                          │
│  ├── ai/           — ChatGPT, Gemini, Claude, etc.  │
│  ├── owner/        — .setbotname, .restart, etc.     │
│  ├── menus/        — .menu, .buttonmenu, etc.        │
│  ├── utility/      — .ping, .translate, .wiki, etc.  │
│  └── ...            — 200+ total commands            │
│                                                      │
│  mini-services/pair-service/ (port 3003)             │
│  ├── HTTP API: /api/pair/start, /api/pair/status     │
│  ├── WebSocket: /socket.io/ (real-time pair updates) │
│  └── wolfsocket → requestPairingCode() → SESSION_ID  │
│                                                      │
│  Pair Link Web (Next.js 16 app, port 3000)           │
│  ├── src/app/page.tsx    — premium glassmorphism UI  │
│  ├── src/app/globals.css — space bg + neon + flames  │
│  └── public/             — banner image, og:image    │
│                                                      │
│  Standalone HTML (klasu-md-pairsite.html)             │
│  └── Connects to PairSite backend API                 │
└─────────────────────────────────────────────────────┘
```

---

## Quick Start

### Prerequisites

- **Node.js 22+** (required for wolfsocket)
- **npm** or **bun** for package management
- A **WhatsApp account** with the phone number you want the bot to use

### 1. Install dependencies

```bash
cd wolfbot-custom
npm install
```

### 2. Configure `.env`

Copy `.env.example` to `.env` and fill in your values:

```env
# Bot identity
BOT_NAME="KLASU MD"
OWNER_NUMBER=254711815459

# Command behaviour
BOT_PREFIX=.
BOT_MODE=public
BOT_TIMEZONE=Africa/Nairobi

# WhatsApp session (leave EMPTY on first boot)
SESSION_ID=

# Internal
XWOLF_API_KEY=wxa_u_xwk7sch6xj
```

### 3. Start the bot

```bash
npm start
```

### 4. Pair WhatsApp (first boot only)

The bot will display a pairing menu:

```
╭─⌈ KLAUS MD CONTROL CORE ⌋
» 🏗️ Linux · 🔌 3000 · 📂 /logs
╰⊷

[KLAUS-AUTH] ⏱️ 10:06:09
◆ 01 → Pairing Code Login     ⟪Recommended⟫
◆ 02 → Clean Session Reset    ⟪Fresh Boot⟫
◆ 03 → ENV Session Injection  ⟪Advanced⟫

⚡ INPUT REQUIRED ▸ Select [1-3] ⟶ (default: 1):
```

1. Type `1` and press Enter
2. Enter your WhatsApp phone number (e.g., `254711815459`)
3. You'll receive an 8-character pairing code (e.g., `AB12-CD34`)
4. On your phone: open WhatsApp → **Settings → Linked Devices → Link a Device → Link with phone number instead** → enter the code
5. The bot will print your `SESSION_ID=KLAUS MD:eyJrZXlz...` — copy it into `.env` and restart

> ⚠️ WhatsApp does NOT send a push notification. You must manually open WhatsApp and enter the code. The code expires in ~60 seconds — the bot auto-generates a fresh code when the old one expires.

### 5. Test the bot

In any chat where the bot is a participant:

```
.menu          — show the full command menu
.ping          — health check
.chatgpt hello — ask ChatGPT
.sessionid     — retrieve your SESSION_ID for backup
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_ID` | ✅ Yes | (empty) | WhatsApp session ID. Must begin with `KLAUS MD:`. Leave empty on first boot to generate via pairing. |
| `BOT_NAME` | No | `KLASU MD` | Display name in menus and messages |
| `OWNER_NUMBER` | No | (empty) | Your WhatsApp number (international format, no `+`) |
| `BOT_PREFIX` | No | `.` | Command prefix (`.` `!` `?` `/`) |
| `BOT_MODE` | No | `public` | `public` / `private` / `group` / `solo` / `sudo` / `super` / `buttons` / `channel` |
| `BOT_TIMEZONE` | No | `UTC` | tz database name (e.g., `Africa/Nairobi`) |
| `DATABASE_URL` | No | (empty) | PostgreSQL connection string. Leave blank for SQLite. |
| `PTERODACTYL_KEY` | No | (empty) | Pterodactyl Application API key |
| `PTERODACTYL_URL` | No | (empty) | Pterodactyl panel URL |
| `PAYSTACK_KEY` | No | (empty) | Paystack secret key for M-Pesa payments |
| `XWOLF_API_KEY` | No | `wxa_u_xwk7sch6xj` | Wolf API key (bundled, pre-configured) |

### Runtime Commands

| Command | Description |
|---------|-------------|
| `.setbotname <name>` | Change the bot name at runtime |
| `.setprefix <char>` | Change the command prefix |
| `.setmode <mode>` | Change the operating mode |
| `.settimezone <tz>` | Change the timezone |
| `.sessionid` | Retrieve your SESSION_ID (owner-only) |
| `.pair <number>` | Generate a pair code for another number |

### Menu Image

The bot menu image lives at:
- `commands/menus/media/wolfbot.jpg` (JPG, default)
- `commands/menus/media/klasu-md.png` (PNG, high quality)
- `data/wolfbot_menu_custom.jpg` (runtime override via `.smi` command)

Both JPG and PNG are supported. Priority: custom > menus/media > commands/media > remote URL fallback.

---

## Pair Link Web

### Overview

The pair link web lets anyone pair their WhatsApp with KLAUS MD without running terminal commands. Two versions are available:

### Version A: Next.js App (port 3000)

Located in the project root (`src/app/page.tsx`). Features:
- Premium glassmorphism + dark space + nebula + particles
- Alternating cyan/purple neon corner accents
- Purple→blue gradient theme
- Real-time socket.io connection to the pair-service (port 3003)
- Auto-refreshing pair codes
- Session ID display with one-tap copy

**Run locally:**
```bash
# Start the pair-service (port 3003)
cd mini-services/pair-service
npm install
npm run dev   # or: node --import tsx index.ts

# Start the Next.js app (port 3000)
cd ../..
npm install
npm run dev
```

Visit `http://localhost:3000` (or the preview URL).

### Version B: Standalone HTML (PairSite-compatible)

File: `klasu-md-pairsite.html` — a single self-contained HTML file (34 KB) that connects to the [PairSite](https://pairsite.space) backend API.

**Features:**
- Same premium glassmorphism design
- Server picker (Server 1–5)
- Connects to PairSite's `/api/generate-session` and WebSocket `/ws`
- `method: "pairing"` API call format
- Session credentials with `KLAUS MD:` prefix
- Terminate session button
- Toast notifications
- Fully self-contained (inline CSS + vanilla JS, no frameworks)

**Deploy:**
1. Upload `klasu-md-pairsite.html` to your PairSite subdomain (`klausmd.pairsite.space`)
2. OR set up a reverse proxy (nginx/Caddy) that serves the HTML and proxies `/api/*` and `/ws` to the PairSite backend
3. The HTML must be served from the same origin as the PairSite API (no CORS support)

### Pair-Service (Mini-Service, port 3003)

The pair-service is a standalone Node.js/bun service that manages WhatsApp pairing:

```
POST /api/pair/start     { phone }              → { sessionId, status: 'pending' }
GET  /api/pair/status?sessionId=...               → { status, pairCode?, sessionId? }
POST /api/terminate-session { sessionId }         → terminates the session
WS   /socket.io/?XTransformPort=3003              → real-time pair code + session ID
```

**Key features:**
- Runs on Node.js (not bun — bun's WebSocket implementation is incomplete for wolfsocket)
- Auto-refreshes pair codes when WhatsApp invalidates them (~every 60s)
- 240-second timeout (4 minutes)
- Each session isolated (temp dir + own wolfsocket instance)
- Pre-registers sessions in the Map before async work (avoids 404 on first poll)
- Verbose `connection.update` logging for debugging

---

## Deployment

### Railway (Recommended)

1. Push the project to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
3. Railway auto-detects `railway.json` (NIXPACKS builder)
4. Set Variables: `SESSION_ID`, `BOT_NAME`, `OWNER_NUMBER`, `XWOLF_API_KEY`
5. Deploy — watch Logs for the pairing code

### Render

1. Push to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint → connect repo
3. Render reads `render.yaml` automatically
4. Set Variables in the Environment tab
5. Deploy

### Docker

```bash
docker build -t klasu-md .
docker run --env-file .env -p 3000:3000 klasu-md
```

### Fly.io

```bash
fly deploy
fly secrets set SESSION_ID="KLAUS MD:eyJrZXlz..."
```

### Heroku

```bash
heroku create klasu-md
heroku config:set BOT_NAME="KLASU MD" OWNER_NUMBER=254711815459
git push heroku main
```

### Pterodactyl

Import the `egg-nodejs-wolfbot.json` egg file, then upload the project.

---

## Commands

### AI Commands (30+ models)
```
.chatgpt <question>    .gemini <question>     .claudeai <question>
.deepseek <question>   .blackbox <question>   .copilot <question>
.bing <question>       .bard <question>       .cohere <question>
.groq <question>       .mixtral <question>    .falcon <question>
.dolphin <question>    .phi <question>        .orca <question>
.tinyllama <question>  .vicuna <question>     .wizard <question>
.zephyr <question>     .yi <question>         .kimi <question>
.perplexity <question> .venice <question>     .flux <prompt>
```

### Owner Commands
```
.setbotname <name>     .setprefix <char>      .setmode <mode>
.settimezone <tz>      .sessionid             .restart
.shutdown              .broadcast <message>   .sudomode
.mysudo                .addsudo <number>      .linksudo <number>
```

### Utility Commands
```
.ping                  .uptime                .speed
.translate <text>      .wiki <query>          .define <word>
.weather <location>    .calc <expression>     .qr <text>
.url <link>            .shorturl <link>       .remind <time> <msg>
.vcf (group contacts)  .topdf                 .toexcel
```

### Menu Commands
```
.menu                  .aimenu                .ownermenu
.gamemenu              .downloadmenu          .logomenu
.ephotomenu            .funmenu               .toolsmenu
.mediamenu             .automenu              .imagemenu
```

> Full command list: type `.menu` in WhatsApp.

---

## Troubleshooting

### Pair code not working / WhatsApp not linking

| Problem | Solution |
|---------|----------|
| WhatsApp didn't send a notification | WhatsApp does NOT send notifications. Manually open WhatsApp → Settings → Linked Devices → Link a Device → "Link with phone number instead" → enter the code |
| Code expired | The bot auto-generates a fresh code every ~60s. Enter the latest code shown on the page |
| "Session not found" on first poll | Fixed — sessions are now pre-registered before async work starts |
| WebSocket connection errors | The pair-service must run on Node.js (not bun). Use `node --import tsx index.ts` |
| wolfsocket build fails | Run `npx tsc -p tsconfig.klausbld.json` with `skipLibCheck: true` in the wolfsocket directory |
| `Cannot find module 'wolfsocket'` | Run `npm install` — wolfsocket is loaded from `github:WOLVAREX/wolfsocket#91f843a` |

### Bot not responding to commands

| Problem | Solution |
|---------|----------|
| `SESSION_ID` expired or revoked | Generate a new one via the pair link web or `.pair <number>` |
| Wrong `OWNER_NUMBER` | Must match the number you used to pair WhatsApp (no `+`) |
| Too many linked devices | WhatsApp limits to 4. Remove one in Linked Devices |
| Bot in `private` mode | Only the owner number can use commands. Switch to `public` via `.setmode public` |

### Deployment issues

| Problem | Solution |
|---------|----------|
| `OOMKilled` on Railway/Render | Bump to at least 512 MB RAM. The bot loads ~30 command categories at boot |
| `better-sqlite3` build fails | Install `python3 make g++` on your system, then `npm install` again |
| Port 3000 already in use | Change the port in `Procfile` / `railway.json` / `Dockerfile` |
| `EADDRINUSE` on port 3003 | Kill the old process: `kill -9 $(lsof -t -i:3003)` then restart |

---

## Project Structure

```
klasu-md/
├── index.js                    # 9.8K-line main entry point
├── package.json                # Dependencies (wolfsocket, wolfbtns, etc.)
├── settings.js                 # Repository URLs (neutralized)
├── patch_lid_sync.js           # LID sync patch
│
├── lib/                        # 50+ helper modules
│   ├── botname.js              # Bot display name management
│   ├── authState.js            # WhatsApp session storage (SQLite + file)
│   ├── menuHelper.js           # Menu image + footer helpers
│   ├── aiHelper.js             # AI command dispatcher
│   ├── buttonHelper.js         # Interactive button rendering
│   ├── emojis.js               # Emoji constants (reconstructed)
│   ├── envConfig.js            # Environment variable seeding
│   ├── webServer.js            # Health check + status server
│   └── ...                     # 40+ more modules
│
├── commands/                   # 30+ command categories
│   ├── ai/                     # ChatGPT, Gemini, Claude, DeepSeek, ...
│   ├── owner/                  # .setbotname, .restart, .sessionid, ...
│   ├── menus/                  # .menu, .buttonmenu, menu image
│   │   └── media/              # wolfbot.jpg + klasu-md.png (menu image)
│   ├── utility/                # .ping, .translate, .wiki, ...
│   ├── automation/             # .autoreact, .autoread, ...
│   ├── downloaders/            # .ytv, .facebook, .instagram, ...
│   ├── games/                  # .chess, .wordle, .trivia, ...
│   ├── design/                 # 20+ logo generators
│   ├── ephoto/                 # 30+ ephoto360 text effects
│   └── ...                     # anime, fun, sports, news, etc.
│
├── mini-services/
│   └── pair-service/           # WhatsApp pairing service (port 3003)
│       ├── index.ts            # HTTP API + socket.io + wolfsocket
│       ├── package.json        # wolfsocket, socket.io, pino, tsx
│       └── tsconfig.klausbld.json  # wolfsocket build config
│
├── src/                        # Next.js 16 pair link web app
│   └── app/
│       ├── page.tsx            # Premium glassmorphism pair UI
│       ├── layout.tsx          # Metadata + dark theme
│       └── globals.css         # Space bg + neon + glass + components
│
├── public/                     # Static assets
│   ├── klasu-md-banner.png     # Hero/menu banner image (2172×724)
│   ├── klasu-md-banner.jpg     # Optimized JPG version
│   └── klasu-md-og.jpg         # Social media preview (1200×400)
│
├── download/                   # Downloadable deliverables
│   ├── klasu-md-whatsapp-bot.zip  # Full customized bot (11 MB)
│   └── klasu-md-pairsite.html     # Standalone pair HTML (PairSite)
│
├── .env.example                # Environment variable template
├── SETUP.md                   # Detailed setup guide
├── Dockerfile                  # Container image
├── railway.json                # Railway deploy config
├── render.yaml                 # Render Blueprint
├── fly.toml                    # Fly.io config
├── Procfile                    # Heroku deploy
├── nixpacks.toml               # Nixpacks build config
├── app.json                   # Heroku app.json + env schema
├── heroku.yml                  # Heroku Docker deploy
└── egg-nodejs-wolfbot.json     # Pterodactyl egg
```

---

## Credits

- **WOLFBOT v1.1.5** by [WOLVAREX](https://github.com/WOLVAREX) — the upstream bot framework
- **wolfsocket** by WOLVAREX — Baileys fork with Group Status support
- **Baileys** by [@WhiskeySockets](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API
- **KLAUS MD branding** by Klaus Labs

### Customizations Applied

This is a customized fork of WOLFBOT v1.1.5 with the following changes:
- Full de-wolfing (all `🐺` / `🐾` emojis, `[WOLF-*]` log tags, `WOLFBOT` text → `KLASU MD`)
- `KLAUS MD:` session ID prefix (legacy `WOLF-BOT:` removed entirely)
- Reconstructed missing `lib/emojis.js`
- Added missing `isGiftedBtnsAvailable` export
- Auto-refreshing pair codes (every ~60s when WhatsApp invalidates)
- Pair-service runs on Node.js (not bun) for stable WebSocket
- Premium glassmorphism pair link web app
- Standalone HTML for PairSite platform integration
- Bot menu image (KLAUS MD banner)
- Neutralized auto-update URLs

---

## License

This project is released under the [MIT License](LICENSE).

---

<div align="center">

**⚡ KLAUS MD BOT — Powered by Klaus Labs**

</div>
