<div align="center">

<img src="assets/klasu-md-banner.png" alt="KLAUS MD BOT" width="100%">

# ⚡ KLAUS MD BOT

*"The fire that lights the night."*

### Premium WhatsApp Bot with AI Chat, Pair Link Web & Auto-Session Authentication

---

<!-- Deploy / Pair / Download buttons -->
<a href="https://railway.app/new">
  <img src="https://img.shields.io/badge/🚀_DEPLOY_KLAUS_MD-7c3aed?style=for-the-badge&logo=railway&logoColor=white&labelColor=1e1b4b" alt="Deploy" height="40">
</a>
&nbsp;
<a href="https://klausmd.pairsite.space">
  <img src="https://img.shields.io/badge/📱_PAIR_CODE-3b82f6?style=for-the-badge&logo=whatsapp&logoColor=white&labelColor=0f172a" alt="Pair Code" height="40">
</a>
&nbsp;
<a href="https://github.com/Luffy-ui21/Klaus-Bot/archive/refs/heads/main.zip">
  <img src="https://img.shields.io/badge/📦_DOWNLOAD_ZIP-fbbf24?style=for-the-badge&logo=github&logoColor=white&labelColor=1a1a2e" alt="Download ZIP" height="40">
</a>

---

<!-- Stats dashboard -->
<img src="https://img.shields.io/github/stars/Luffy-ui21/Klaus-Bot?style=for-the-badge&color=7c3aed&labelColor=1e1b4b&label=⭐+STARS" alt="Stars" height="28">
<img src="https://img.shields.io/github/forks/Luffy-ui21/Klaus-Bot?style=for-the-badge&color=3b82f6&labelColor=0f172a&label=🍴+FORKS" alt="Forks" height="28">
<img src="https://img.shields.io/github/repo-size/Luffy-ui21/Klaus-Bot?style=for-the-badge&color=22c55e&labelColor=1a1a2e&label=📦+REPO+SIZE" alt="Repo Size" height="28">
<img src="https://img.shields.io/github/last-commit/Luffy-ui21/Klaus-Bot?style=for-the-badge&color=fbbf24&labelColor=1e1b4b&label=🔄+LAST+COMMIT" alt="Last Commit" height="28">

---

<!-- Tech stack badges -->
<img src="https://img.shields.io/badge/Node.js-22+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js">
<img src="https://img.shields.io/badge/WhatsApp-Linked_Device-25D366?style=flat-square&logo=whatsapp&logoColor=white" alt="WhatsApp">
<img src="https://img.shields.io/badge/wolfsocket-Baileys+fork-8B5CF6?style=flat-square" alt="wolfsocket">
<img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js">
<img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="License">
<img src="https://img.shields.io/badge/Made_by-Klaus_Labs-7c3aed?style=flat-square" alt="Klaus Labs">

</div>

---

## ✨ Features

<table>
<tr>
<td width="50%" valign="top">

### 🤖 AI Chat (30+ models)
```
.chatgpt  .gemini  .claudeai
.deepseek .copilot  .blackbox
.bing     .bard    .cohere
.groq     .falcon  .dolphin
```
All powered by bundled XWOLF API key — no extra keys needed.

</td>
<td width="50%" valign="top">

### 📱 Pair Link Web
Premium glassmorphism UI with:
- Dark space + nebula + particles
- Purple→blue gradient theme
- Cyan/purple neon corner accents
- Auto-refreshing pair codes
- Session ID export

🔗 [klausmd.pairsite.space](https://klausmd.pairsite.space)

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🎮 30+ Command Categories
- **AI** — 30+ language models
- **Owner** — .setbotname, .restart, .sessionid
- **Utility** — .ping, .translate, .wiki, .calc
- **Downloaders** — .ytv, .facebook, .instagram
- **Games** — .chess, .wordle, .trivia, .slots
- **Design** — 20+ logo generators
- **Ephoto** — 30+ text effects
- **And more** — anime, sports, news, economy...

</td>
<td width="50%" valign="top">

### 🚀 Deploy Anywhere
- **Railway** — `railway.json` (Nixpacks)
- **Render** — `render.yaml` (Blueprint)
- **Docker** — `Dockerfile`
- **Fly.io** — `fly.toml`
- **Heroku** — `Procfile` + `app.json`
- **Pterodactyl** — `egg-nodejs-wolfbot.json`

</td>
</tr>
</table>

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Luffy-ui21/Klaus-Bot.git
cd Klaus-Bot
npm install
```

### 2. Configure `.env`

```env
BOT_NAME="KLASU MD"
OWNER_NUMBER=254711815459
BOT_PREFIX=.
BOT_MODE=public
BOT_TIMEZONE=Africa/Nairobi
SESSION_ID=
XWOLF_API_KEY=wxa_u_xwk7sch6xj
```

### 3. Start & Pair

```bash
npm start
```

The bot will show a pairing menu → choose `1` → enter your phone number → get an 8-character code → open WhatsApp → **Settings → Linked Devices → Link a Device → Link with phone number instead** → enter the code → your `SESSION_ID=KLAUS MD:...` appears.

### 4. Test

```
.menu          — show all commands
.ping          — health check
.chatgpt hello — ask ChatGPT
.sessionid     — get your SESSION_ID
```

---

## ⚙️ Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SESSION_ID` | ✅ | (empty) | WhatsApp session. Starts with `KLAUS MD:`. Leave empty on first boot. |
| `BOT_NAME` | No | `KLASU MD` | Display name |
| `OWNER_NUMBER` | No | (empty) | Your WhatsApp number (no `+`) |
| `BOT_PREFIX` | No | `.` | Command prefix |
| `BOT_MODE` | No | `public` | public / private / group / sudo / buttons / channel |
| `BOT_TIMEZONE` | No | `UTC` | e.g. `Africa/Nairobi` |
| `XWOLF_API_KEY` | No | `wxa_u_xwk7sch6xj` | Wolf API key (bundled) |

---

## 🔧 Pair Service (Mini-Service)

The pair-service runs on port 3003 and handles WhatsApp pairing:

```bash
cd mini-services/pair-service
npm install
node --import tsx index.ts
```

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pair/start` | POST | Start pairing `{ phone }` → `{ sessionId }` |
| `/api/pair/status?sessionId=` | GET | Poll for status |
| `/api/terminate-session` | POST | Kill a session |
| `/socket.io/` | WS | Real-time pair code + session ID |

---

## 📁 Project Structure

```
Klaus-Bot/
├── index.js                 # Main entry (9.8K lines)
├── package.json             # Dependencies
├── lib/                     # 50+ helper modules
│   ├── botname.js           # Bot name management
│   ├── authState.js         # WhatsApp session storage
│   ├── menuHelper.js        # Menu image + footer
│   ├── emojis.js            # Emoji constants
│   └── ...
├── commands/                # 30+ command categories
│   ├── ai/                  # ChatGPT, Gemini, Claude, ...
│   ├── owner/               # .setbotname, .restart, ...
│   ├── menus/               # .menu, .buttonmenu
│   ├── utility/             # .ping, .translate, .wiki
│   └── ...
├── mini-services/
│   └── pair-service/        # WhatsApp pair service (port 3003)
├── assets/                  # Banner images
├── klasu-md-pairsite.html   # Standalone pair HTML
├── Dockerfile               # Docker image
├── railway.json             # Railway deploy
├── render.yaml              # Render Blueprint
├── fly.toml                 # Fly.io config
├── Procfile                 # Heroku
└── README.md                # You are here ✨
```

---

## 🐛 Troubleshooting

<details>
<summary><b>Pair code not working?</b></summary>

WhatsApp does NOT send a push notification. You must manually:
1. Open WhatsApp on your phone
2. Go to **Settings → Linked Devices → Link a Device**
3. Tap **"Link with phone number instead"**
4. Type the 8-character code

The bot auto-generates a fresh code every ~60s when the old one expires.
</details>

<details>
<summary><b>Bot not responding?</b></summary>

- Check `SESSION_ID` is valid and starts with `KLAUS MD:`
- Check `OWNER_NUMBER` matches your WhatsApp number
- WhatsApp limits to 4 linked devices — remove old ones
- Make sure `BOT_MODE` is `public` (not `private`)
</details>

<details>
<summary><b>Deployment issues?</b></summary>

- **OOMKilled**: Bump to 512+ MB RAM
- **`better-sqlite3` build fails**: Install `python3 make g++`
- **Port in use**: Kill with `kill -9 $(lsof -t -i:PORT)`
</details>

---

## 🎨 Customizations (vs upstream WOLFBOT v1.1.5)

- ✅ Full de-wolfing (all `🐺` / `🐾` emojis removed)
- ✅ `[WOLF-AUTH]` → `[KLAUS-AUTH]` log tags
- ✅ `WOLFBOT CONTROL CORE` → `KLASU MD CONTROL CORE` boot banner
- ✅ `Silent Wolf Online` → `${botName} Online`
- ✅ Session prefix: `WOLF-BOT:` → `KLAUS MD:` (legacy removed)
- ✅ `lib/emojis.js` reconstructed (was missing upstream)
- ✅ `isGiftedBtnsAvailable` export added to `lib/buttonHelper.js`
- ✅ Auto-refreshing pair codes (every ~60s)
- ✅ Pair-service runs on Node.js (not bun) for stable WebSocket
- ✅ Premium glassmorphism pair link web app
- ✅ Standalone HTML for PairSite platform
- ✅ Custom bot menu image (KLAUS MD banner)
- ✅ Auto-update URLs neutralized in `settings.js`

---

## 👥 Credits

| Project | Author | Role |
|---------|--------|------|
| [WOLFBOT v1.1.5](https://github.com/WOLVAREX/v1.1.5-WOLFBOT-) | [WOLVAREX](https://github.com/WOLVAREX) | Upstream bot framework |
| [wolfsocket](https://github.com/WOLVAREX/wolfsocket) | WOLVAREX | Baileys fork with Group Status |
| [Baileys](https://github.com/WhiskeySockets/Baileys) | @WhiskeySockets | WhatsApp Web API |
| KLAUS MD branding | Klaus Labs | Customization & deployment |

---

<div align="center">

### ⚡ KLAUS MD BOT — Powered by Klaus Labs

<img src="https://img.shields.io/badge/Made_with_🔥_by-Klaus_Labs-7c3aed?style=for-the-badge&labelColor=1e1b4b" alt="Klaus Labs" height="30">

</div>
