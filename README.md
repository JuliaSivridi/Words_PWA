# Words

[![Live PWA](https://img.shields.io/badge/Stler_Words-Live_PWA-E07E38?style=for-the-badge)](https://stler-words.vercel.app/)

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![React](https://img.shields.io/badge/React_18-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite_6-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router_v6-CA4245?style=for-the-badge&logo=reactrouter&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google_Sheets_API-34A853?style=for-the-badge&logo=googlesheets&logoColor=white)
![Google OAuth](https://img.shields.io/badge/Google_OAuth_2.0-4285F4?style=for-the-badge&logo=google&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com)

A personal vocabulary learning app built as a **Progressive Web App**. Runs in any browser and installs on Android/iOS home screens as a standalone app. No backend — Google Sheets is the database.

---

## Features

- **Three learning modes** — FlipCard (passive recall) → MultipleChoice (active recall) → MatchingGrid (pairs) — progressively harder as a word advances
- **Spaced repetition** — each word moves through modes based on repetition counts (4 → 8 → 12); 24 total reps before auto-learned
- **Any language pair** — add a sheet tab named like `RU-EN`, `RU-FI`, or `RU-EL`; the app reads it automatically
- **Category filter** — tag words in column A, then filter sessions and word list by category
- **"Learn and hide"** — instantly mark a word as learned and skip it from future sessions
- **Cross-device sync** — language selection and category filter saved to the sheet and restored on every login
- **Word list** — browse all words, toggle learned/active status per word
- **PWA** — installable on Android and iOS, works as a standalone app with its own icon

## Learning Modes

| Mode | Trigger | Mechanic | Reps to graduate |
|------|---------|----------|-----------------|
| 🃏 1 — FlipCard | New words (m1 < 4) | Tap to flip; see translation | 4 |
| 🔤 2 — MultipleChoice | After 4 flip-card views | Pick correct translation from 4 options | 8 |
| 🔗 3 — MatchingGrid | After 8 multiple-choice answers | Match 6 word–translation pairs | 12 |

## Tech Stack

| Layer | Technology |
|---|---|
| 🖼️ Framework | React 18 (JavaScript) |
| ⚡ Build | Vite 6 |
| 🎨 Styling | CSS Modules + CSS variables (light / dark theme) |
| 🔀 Routing | React Router DOM v6 |
| 🗄️ Database | Google Sheets API v4 |
| 🔐 Auth | Google Identity Services (OAuth 2.0) |
| 📱 PWA | manifest.json + service worker |
| 🚀 Hosting | Any static host (Vercel, Netlify, GitHub Pages) |

## Setup

### Prerequisites

- Google account
- Google Cloud project with **Google Sheets API v4** and **Google Drive API** enabled
- OAuth 2.0 Client ID (type: Web application)
- Node.js ≥ 18

### Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Enable **Google Sheets API v4** and **Google Drive API**
3. Create an **OAuth 2.0 Client ID** → type: Web application
4. Add to **Authorized JavaScript origins** (not Redirect URIs):
   ```
   http://localhost:5173
   https://your-app.vercel.app
   ```
5. Add your Google account as a **test user** in the OAuth consent screen

### Prepare your Google Sheet

1. Create a Google Sheet named **db_words**
2. Add a tab named like `RU-EN` (format: `TRANSLATION-STUDY`)
3. Fill columns:
   - **A** — category (optional grouping; e.g. "Verbs", "Food")
   - **B** — word (the language you're studying)
   - **C** — translation (your native language)
4. Row 1 can be a header or start with data directly — the app auto-detects

### Local Development

```bash
git clone https://github.com/JuliaSivridi/Words.git
cd Words
npm install
```

Create `.env` in the project root:
```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

```bash
npm run dev    # http://localhost:5173
npm run build  # production build → dist/
```

### Deploy to Vercel

1. Import the repository at [vercel.com](https://vercel.com)
2. Add environment variable in project Settings → Environment Variables:
   - `VITE_GOOGLE_CLIENT_ID`
3. Every push to `main` triggers automatic deployment
4. Add the Vercel URL to Google Cloud Console Authorized JavaScript Origins

## Data Model

All data lives in the user's **db_words** Google Spreadsheet (found or created automatically on first login).

| Sheet | Purpose |
|---|---|
| 📗 `RU-EN` (or any tab) | Word pairs with repetition counters |
| ⚙️ `_settings` | Last selected language (A1) and category filter (A2) |

**Word tab columns:**

| Col | Field | Description |
|-----|-------|-------------|
| A | category | Optional grouping label (e.g. "Verbs", "Food") |
| B | word | Target language word |
| C | translation | Native language meaning |
| D | m1 | FlipCard repetition count (0–4) |
| E | m2 | MultipleChoice repetition count (0–8) |
| F | m3 | MatchingGrid repetition count (0–12) |
| G | learned | TRUE / FALSE |

## Install as Mobile App

**Android:** Chrome prompts automatically, or use the browser menu → *Install app*

**iOS:** Safari → Share button → *Add to Home Screen*

## Technical Documentation

See [`docs/technical-doc.html`](docs/technical-doc.html) for the full technical reference covering architecture, data model, game mechanics, auth flow, API integration, and deployment.
