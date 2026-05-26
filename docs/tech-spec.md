# Words PWA — Technical Specification

> Version 1.1 · 2026-05-26  
> Repository: `D:\Projects\Words-PWA`

---

## 1. Overview

**Words** is a client-side Progressive Web App for vocabulary learning using spaced repetition. The user stores word pairs in a Google Sheets spreadsheet; the app reads and writes that sheet directly from the browser using the Google Sheets API v4. There is no backend.

**Key design decisions:**
- **No server required.** All data lives in the user's own Google Drive. The app is a static bundle deployable to any CDN.
- **Google Sheets as the database.** This makes it trivially easy for users to add, edit, and import vocabulary with no special tooling.
- **Three-stage spaced repetition.** Words pass through Flash-cards → Multiple-choice → Matching-grid before being marked learned. Counters (m1, m2, m3) are stored in the sheet.
- **Settings are also stored in the sheet** (tab `_settings`), so preferences sync across devices automatically.
- **Offline shell.** A service worker caches the app shell (`/`, `/index.html`) so the UI loads without a network connection. API calls (Google) always go over the network.

---

## 2. Tech Stack

| Layer | Library / API | Version | Notes |
|---|---|---|---|
| UI framework | React | 18.3.1 | Functional components + hooks |
| Routing | react-router-dom | 6.28.0 | `BrowserRouter`, `Routes`, `Route` |
| Build tool | Vite | 6.0.5 | Dev server on port 3000 |
| React Vite plugin | @vitejs/plugin-react | 4.3.4 | Babel-based fast refresh |
| Auth | Google Identity Services (GIS) | CDN | `accounts.google.com/gsi/client` |
| Data storage | Google Sheets API v4 | REST | Direct browser `fetch` calls |
| File discovery | Google Drive API v3 | REST | Used to find/list spreadsheet files |
| PWA | Service Worker (custom) | — | `dist/sw.js`, cache name `words-v1` |
| Styling | CSS Modules + global `theme.css` | — | CSS custom properties, light/dark |

**Environment variables:**

| Variable | Required | Purpose |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Yes | Google OAuth 2.0 client ID |
| `VITE_FEEDBACK_URL` | No | POST endpoint for the Feedback screen; if absent, screen shows "not configured" |

---

## 3. Architecture

**Pattern:** Flat React component tree with state hoisted to `App.jsx`. No Redux or context providers. Shared state flows down as props; events flow up as callbacks.

```
┌──────────────────────────────────────────┐
│              Browser (SPA)               │
│                                          │
│  App.jsx (root state: user, sheetId,     │
│           currentLang, sessionCategory,  │
│           modeSettings)                  │
│       │                                  │
│  ┌────▼──────────────────────────────┐   │
│  │  React Router <Routes>            │   │
│  │  / /session /words /language      │   │
│  │  /category /settings /help        │   │
│  │  /feedback                        │   │
│  └────────────────────────────────┬──┘   │
│                                   │      │
│  ┌──────────────┐  ┌──────────────▼───┐  │
│  │  auth.js     │  │  sheetsApi.js    │  │
│  │  GIS token   │  │  Drive + Sheets  │  │
│  │  localStorage│  │  API v4 / v3     │  │
│  └──────────────┘  └──────────────────┘  │
└──────────────────────────────────────────┘
         │                    │
         ▼                    ▼
  Google Identity     Google Sheets API v4
  Services            Google Drive API v3
  (accounts.google.com)  (googleapis.com)
```

**Write path (session save):**
1. User completes a session step → `incrementCounter()` updates `pendingUpdates` ref (in-memory Map: `row → {m1, m2, m3, learned}`)
2. On the final step (`stepIndex + 1 >= stepsPerSession`), `handleNext()` collects the Map into an array and calls `onSessionComplete(updates)`
3. `App.jsx → saveSessionUpdates(updates)` → `batchUpdateWords(sheetId, tab, updates)` writes columns D–F via Sheets API `values:batchUpdate`
4. Words that became learned are additionally written to column G via `markLearned()` (PUT to single cell)
5. Local state (`words` array in `useWords`) is updated optimistically by merging the updates

**Write path (immediate learn):**
1. User clicks "Learn and hide" during a step → `handleLearn(row)` in `SessionScreen`
2. Sets `learned: true` in `pendingUpdates`, calls `onSessionComplete([{row,...}], immediate=true)`
3. `App.jsx` routes to `setLearned(row, true)` → optimistic local update + `markLearned()` API call

**Read path:**
1. After login, `findOrCreateWordsFile()` returns the sheet ID (from localStorage cache or Drive search)
2. `useWords(sheetId, tab)` effect fires → `getWords(sheetId, tab)` fetches `A1:G` of the current language tab
3. Rows are mapped to word objects and stored in local state; screen re-renders

**Error handling:**
- All API calls go through `request()` wrapper in `sheetsApi.js`, which calls `refreshTokenIfNeeded()` before every request
- HTTP errors throw `new Error('API error {status}: {body}')` — caught by callers and shown as UI messages
- 401s trigger a silent token refresh (`trySilentSignIn`)
- Settings read errors are silently swallowed; localStorage values are kept as fallback
- Drive search lag: `findOrCreateWordsFile()` retries once after 2 500 ms before creating a new file

---

## 4. Package / Folder Structure

```
Words-PWA/
├── src/
│   ├── main.jsx              Entry point; registers service worker; renders <App> in BrowserRouter
│   ├── App.jsx               Root component; owns all global state; defines all routes
│   ├── auth.js               GIS token client — silent sign-in, popup sign-in, token refresh
│   ├── sheetsApi.js          Drive + Sheets API v4 — find/create file, read/write words & settings
│   ├── settingsUtils.js      isWordLearned(), isWordEligibleForMode(), DEFAULT_SETTINGS
│   ├── constants.js          M1_MAX=4, M2_MAX=8, M3_MAX=12, TOTAL_REPS=24
│   ├── langMap.js            ISO 639-1 + 639-2 language code → name lookup; parseLangLabel()
│   ├── theme.css             Global CSS variables (light/dark), utility classes, animations
│   ├── hooks/
│   │   ├── useWords.js       Loads words from Sheets; exposes saveSessionUpdates, setLearned, resetWord
│   │   └── useSession.js     buildSession() — session planning algorithm
│   ├── screens/
│   │   ├── LoginScreen.jsx   Google sign-in button; shown when user === null
│   │   ├── HomeScreen.jsx    Main menu: Start, Language, Category, Word List buttons + user menu
│   │   ├── SessionScreen.jsx Session runner: progress bar, step rendering, counter accumulation
│   │   ├── WordListScreen.jsx Browse all words; toggle learned status
│   │   ├── LanguageScreen.jsx Pick language tab from the spreadsheet
│   │   ├── CategoryScreen.jsx Multi-select category filter; saves on Back
│   │   ├── SettingsScreen.jsx Sheet picker, session length, mode toggles + max reps
│   │   ├── HelpScreen.jsx    Static help content
│   │   ├── FeedbackScreen.jsx Feedback form; POSTs to VITE_FEEDBACK_URL
│   │   └── *.module.css      Per-screen CSS modules
│   └── components/
│       ├── FlipCard.jsx      Mode 1 — flip-card exercise with swipe support
│       ├── MultipleChoice.jsx Mode 2 — 4-option choice grid
│       ├── MatchingGrid.jsx  Mode 3 — 6-pair two-column matching
│       ├── NextButton.jsx    Shared full-width "Next →" primary button
│       ├── Toast.jsx         Auto-dismiss notification (2 500 ms)
│       ├── CheckIcon.jsx     Shared SVG checkmark (24×24 viewBox, stroke)
│       └── *.module.css      Per-component CSS modules
├── dist/                     Built output (Vite)
│   ├── index.html            App shell HTML
│   ├── sw.js                 Service worker (manually maintained, not Vite-generated)
│   ├── manifest.json         PWA manifest
│   ├── assets/               Bundled JS + CSS (hashed filenames)
│   └── icons/                favicon.svg, icon-192.png, icon-512.png
├── docs/
│   ├── tech-spec.md          This document
│   ├── tech-spec.html        HTML render of this spec
│   └── tech-spec-example.css CSS template for the HTML spec
├── package.json
└── vite.config.js            port: 3000
```

---

## 5. Data Model

### Word object (in-memory)

| Field | Type | Source column | Description |
|---|---|---|---|
| `row` | `number` | — | 1-based sheet row number (used as stable ID for API writes) |
| `category` | `string` | A | Optional grouping label (e.g. "Colors"); empty string if absent |
| `word` | `string` | B | The word being studied; required (rows where B is empty are filtered out) |
| `translation` | `string` | C | Translation of the word |
| `m1` | `number` | D | Flash-card repetition counter; range 0–m1Max |
| `m2` | `number` | E | Multiple-choice repetition counter; range 0–m2Max |
| `m3` | `number` | F | Matching-grid repetition counter; range 0–m3Max |
| `learned` | `boolean` | G | `true` when G === `"TRUE"` or `=== true`; otherwise `false` |

**Important invariants:**
- `row` is assigned **before** filtering empty rows, so it always reflects the actual sheet row (gaps in the middle of the sheet are safe).
- `batchUpdateWords()` **never** writes column G. The learned flag can only be set via `markLearned()` or `resetWordCounters()`. This prevents a session result from overwriting a manually-set `learned=TRUE`.
- A word is considered learned when `word.learned === true` OR all enabled mode counters have reached their max. Disabled modes' counters are ignored entirely (see `isWordLearned()` in `settingsUtils.js`).

### Settings object (in-memory)

| Field | Type | Default | Description |
|---|---|---|---|
| `mode1` | `boolean` | `true` | Flash-cards mode enabled |
| `mode2` | `boolean` | `true` | Multiple-choice mode enabled |
| `mode3` | `boolean` | `true` | Matching-grid mode enabled |
| `stepsPerSession` | `number` | `12` | Total steps per session |
| `m1Max` | `number` | `4` | Repetitions to graduate from mode 1 |
| `m2Max` | `number` | `8` | Repetitions to graduate from mode 2 |
| `m3Max` | `number` | `12` | Repetitions to complete mode 3 |

---

## 6. External Storage Schema (Google Sheets)

### Language tabs (e.g. `ENG-DEU`, `RU-EN`)

Tab names follow the format `NATIVE-STUDY` (e.g. `RU-EN` = native Russian, studying English).

| Column | Header label | Type | Value format |
|---|---|---|---|
| A | category | string | Optional grouping label; empty string if unused |
| B | word | string | The studied word (required; empty = row skipped) |
| C | translation | string | Translation of the word |
| D | m1_count | integer | Numeric string, e.g. `"3"`; empty → parsed as 0 |
| E | m2_count | integer | Numeric string |
| F | m3_count | integer | Numeric string |
| G | learned | boolean | `"TRUE"` or `"FALSE"`; empty → `false` |

**Header row detection:** If `row[0][1].trim().toLowerCase() === 'word'` (i.e. column B of row 1 is exactly "word", case-insensitive), row 1 is treated as a header and skipped. Otherwise all rows are data. The seeded ENG-DEU tab uses `['category', 'word', 'translation']` as row 1.

**Tab name filtering:** `getLanguageTabs()` excludes tabs named `"Sheet1"`, `"Лист1"`, and `"_settings"`.

### `_settings` tab (key-value format)

| Row | Column A (key) | Column B (value) | Example |
|---|---|---|---|
| 1 | `language` | Tab name | `ENG-DEU` |
| 2 | `category` | Comma-separated categories or `""` | `Colors,Numbers` |
| 3 | `mode1` | `"TRUE"` or `"FALSE"` | `TRUE` |
| 4 | `mode2` | `"TRUE"` or `"FALSE"` | `TRUE` |
| 5 | `mode3` | `"TRUE"` or `"FALSE"` | `FALSE` |
| 6 | `stepsPerSession` | Integer string or `""` | `12` |
| 7 | `m1Max` | Integer string or `""` | `4` |
| 8 | `m2Max` | Integer string or `""` | `8` |
| 9 | `m3Max` | Integer string or `""` | `12` |

**Legacy format detection:** If `rows[0][0] !== 'language'`, the legacy format is assumed: A1 = language value, A2 = category value. All mode settings default to `true`, threshold overrides to `null`.

**Seed defaults** (written when creating a fresh file):

```
language=ENG-DEU, category="", mode1=TRUE, mode2=TRUE, mode3=TRUE,
stepsPerSession=12, m1Max=4, m2Max=8, m3Max=12
```

### File discovery

The default spreadsheet name is `db_words`. Discovery flow:
1. Check `localStorage.getItem('words_sheet_id')` — if present, use it directly
2. Drive query: `name='db_words' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
3. If empty result: wait 2 500 ms, retry query once (workaround for Drive indexing lag)
4. If still no result: create a new spreadsheet with tabs `ENG-DEU` (seeded vocabulary) and `_settings`
5. Cache the resulting ID in `localStorage`

The user can also pick any other spreadsheet via **Settings → Spreadsheet → Change**, which lists all Google Sheets in their Drive ordered by `modifiedTime desc`.

---

## 7. Authentication & First-Launch Setup

### OAuth 2.0 scopes

```
email
profile
https://www.googleapis.com/auth/spreadsheets
https://www.googleapis.com/auth/drive.metadata.readonly
```

### Sign-in flow (step by step)

1. **App loads** → `initAuth(onReady)` polls `window.google?.accounts?.oauth2` every 100 ms until GIS script is ready
2. **Silent sign-in attempt:** `trySilentSignIn()` creates a token client with `prompt: ''` and calls `requestAccessToken({ prompt: '' })`
   - **Success:** token stored in memory variable `accessToken`; `tokenExpiresAt = Date.now() + expires_in * 1000`
   - If no saved profile in `localStorage.words_user`: fetches `https://www.googleapis.com/oauth2/v3/userinfo` and saves `{ email, name, picture }` to `words_user`
   - `setUser(getUser())` → app proceeds, `LoginScreen` is not shown
   - **Failure (no prior consent, popup closed, etc.):** `setUser(null)` → `LoginScreen` rendered
3. **Login screen:** user clicks "Sign in with Google" → `signInWithPopup()` with `prompt: 'consent'` → GIS popup opens
4. **After login:** same token + profile save flow as step 2; `onLogin()` callback updates root state
5. **Token refresh:** before every API call, `refreshTokenIfNeeded()` checks if `Date.now() >= tokenExpiresAt - 30_000`. If stale, calls `trySilentSignIn()` again
6. **Sign out:** `accessToken = null`, `tokenExpiresAt = 0`, `localStorage.removeItem('words_user')`, `google.accounts.oauth2.revoke(email)`

### First launch (no existing sheet)

After sign-in, `findOrCreateWordsFile()` runs the discovery flow described in §6 and creates a new `db_words` spreadsheet seeded with 35 German words in 3 categories (Numbers, Greetings, Colors) and the default `_settings` values.

### localStorage keys

| Key | Content | Written by |
|---|---|---|
| `words_user` | JSON `{ email, name, picture }` | `auth.js` after profile fetch |
| `words_sheet_id` | Spreadsheet file ID string | `sheetsApi.js` after discovery |
| `words_sheet_name` | Display name of the file | `App.jsx` after `getSheetFileName()` |
| `words_lang` | Selected tab name e.g. `"ENG-DEU"` | `App.jsx` on language select |
| `words_category` | JSON array of selected categories, or absent | `App.jsx` on category select |

---

## 8. Onboarding Seed Data

`seedNewSpreadsheet()` is called once immediately after a brand-new `db_words` spreadsheet is created. It writes all data via a single `values:batchUpdate` call with `valueInputOption: 'RAW'`.

### Tab `ENG-DEU` — header row

| Column A | Column B | Column C |
|---|---|---|
| `category` | `word` | `translation` |

### Tab `ENG-DEU` — seed words (34 rows)

**Category: Numbers** (12 words)

| word (B) | translation (C) |
|---|---|
| eins | one |
| zwei | two |
| drei | three |
| vier | four |
| fünf | five |
| sechs | six |
| sieben | seven |
| acht | eight |
| neun | nine |
| zehn | ten |
| elf | eleven |
| zwölf | twelve |

**Category: Greetings** (11 words)

| word (B) | translation (C) |
|---|---|
| Hallo | Hello |
| Guten Morgen | Good morning |
| Guten Tag | Good day |
| Guten Abend | Good evening |
| Auf Wiedersehen | Goodbye |
| Tschüss | Bye |
| Bitte | Please |
| Danke | Thank you |
| Entschuldigung | Excuse me |
| Ja | Yes |
| Nein | No |

**Category: Colors** (11 words)

| word (B) | translation (C) |
|---|---|
| rot | red |
| blau | blue |
| grün | green |
| gelb | yellow |
| schwarz | black |
| weiß | white |
| orange | orange |
| rosa | pink |
| lila | purple |
| braun | brown |
| grau | grey |

All seeded words have columns D–G empty (m1=0, m2=0, m3=0, learned=FALSE by default).

### Tab `_settings` — seed values

| key (A) | value (B) |
|---|---|
| `language` | `ENG-DEU` |
| `category` | `""` |
| `mode1` | `TRUE` |
| `mode2` | `TRUE` |
| `mode3` | `TRUE` |
| `stepsPerSession` | `12` |
| `m1Max` | `4` |
| `m2Max` | `8` |
| `m3Max` | `12` |

### First-run user experience

After the seed is written the user lands on HomeScreen with language `ENG-DEU` pre-selected (read back from `_settings`). They can press **Start** immediately and begin practising German vocabulary — the three categories give enough words for all three learning modes to become available as counters accumulate.

---

## 9. API Layer

All API calls go through `request(url, options)` in `sheetsApi.js`:
1. Calls `refreshTokenIfNeeded()` (silent token refresh if needed)
2. Attaches `Authorization: Bearer <token>` and `Content-Type: application/json`
3. On non-OK response: throws `Error('API error {status}: {body}')`

### API methods

| Method | Endpoint | Description |
|---|---|---|
| `findOrCreateWordsFile()` | Drive Files list + Sheets create | Finds or creates `db_words` spreadsheet |
| `listUserSheets()` | Drive Files list | All user Sheets, ordered by modifiedTime desc |
| `getSheetFileName(id)` | Drive Files get | Returns display name of a file |
| `getLanguageTabs(id)` | Sheets spreadsheets get | Returns sheet tab titles (excluding system tabs) |
| `getWords(id, tab)` | Sheets values get `A1:G` | Reads all words from a language tab |
| `batchUpdateWords(id, tab, updates)` | Sheets `values:batchUpdate` | Writes D:F for each changed word |
| `markLearned(id, tab, row, learned)` | Sheets values update PUT | Writes `"TRUE"`/`"FALSE"` to cell G{row} |
| `resetWordCounters(id, tab, row)` | Sheets values update PUT | Writes `[0,0,0,"FALSE"]` to D{row}:G{row} |
| `readSettings(id)` | Sheets values get `_settings!A1:B10` | Reads settings tab; handles legacy format |
| `writeSettings(id, settings)` | Sheets values update PUT `_settings!A1:B9` | Writes all 9 settings rows |
| `seedNewSpreadsheet(id)` | Sheets `values:batchUpdate` | Writes header + 35 words + settings (called once at creation) |

**Offline behavior:** No queue. If the network is unavailable, API calls throw and the error propagates to the UI. Local state changes (optimistic updates) persist in React state for the session but are lost on reload if the API write failed.

---

## 10. UI Screens

### 10.1 LoginScreen

- **Route:** Not a route — rendered conditionally by `App.jsx` when `user === null`
- **Props:** `onLogin: () => void`
- **Layout:** Centered card with horizontal logo row (icon-192.png + "Words" h1 + tagline "Learn vocabulary with flashcards"), two description lines, "Sign in with Google" button
- **State:** `loading` (bool), `error` (string | null)
- **Actions:** Button click → `signInWithPopup()` → `onLogin()` on success; "Sign in failed. Please try again." on error

### 10.2 HomeScreen

- **Route:** `/`
- **Props:** `sheetId`, `currentLang`, `currentCategory`, `onSignOut`

**Layout:**
- Top bar: app name "Words" (left) + avatar button (right)
- Content area (max-width 600px, 16px padding):
  - **Start** button (primary, full-width) — disabled if `!sheetId || !currentLang`
  - **Language** button (secondary) — sub-label: `"${langName} — ${nativeName}"` or `"Not selected"`
  - **Category** button (secondary) — disabled if `!sheetId || !currentLang` — sub-label: `"All categories"` | single category name | `"Multiple…"` (when `currentCategory.length > 1`)
  - **Word List** button (secondary) — disabled if `!sheetId || !currentLang`
  - Hint text "Loading your Words sheet…" shown when `!sheetId`

**User menu** (opens on avatar click, closes on outside click via `mousedown`/`touchstart`):
- Header: user name + email
- Menu items: Settings (`/settings`), Help (`/help`), Feedback (`/feedback`)
- Sign Out button → `signOut()` + `onSignOut()`

### 10.3 SessionScreen

- **Route:** `/session` — redirects to `/` if `!sheetId || !currentLang`
- **Props:** `sheetId`, `tab`, `words`, `categoryFilter`, `settings`, `onSessionComplete`
- **State:** `session` (steps array | null), `stepIndex`, `done`, `allLearned`
- **Ref:** `pendingUpdates` (Map: `row → {m1,m2,m3,learned}`), `sessionBuilt` (guard against re-build)

**Session build:** runs once on mount (when `words.length > 0` and `!sessionBuilt.current`). Calls `buildSession(words, categoryFilter, settings)`.

**Layout (active session):**
- Progress bar: width = `(stepIndex / stepsPerSession) * 100%`
- Top bar: `✕` close button (→ `/`) | step counter `"{stepIndex+1} / {stepsPerSession}"` | spacer (40px)
- Step area (animated with `fade-in 0.25s ease-out`, keyed by `stepIndex`): renders `<FlipCard>`, `<MultipleChoice>`, or `<MatchingGrid>` depending on `step.mode`

**Counter logic:**
- Mode 1: `m1 = Math.min(state.m1 + 1, settings.m1Max ?? 4)`
- Mode 2: `m2 = Math.min(state.m2 + 1, settings.m2Max ?? 8)`
- Mode 3: all 6 words in group get `m3 = Math.min(state.m3 + 1, settings.m3Max ?? 12)`
- `learned` flag recomputed by `isWordLearned(next, settings)` after each increment

**Completion states:**

| Condition | UI |
|---|---|
| `allLearned === true` | 🎉 emoji + "All words learned!" + "You've mastered all the words in this language." + "Back to Home" |
| `done === true` | `<CheckIcon size={64}>` + "Session complete!" + "Great job! Keep practising." + "Back to Home" |
| `session === null` | "Loading session…" centered |

### 10.4 WordListScreen

- **Route:** `/words` — redirects to `/` if `!sheetId || !currentLang`
- **Props:** `words`, `loading`, `categoryFilter`, `onToggleLearned`

**Filtering:** `categoryFilter && categoryFilter.length > 0` → filter `words` by category; otherwise show all.

**Header (sticky):** "← Back" | "Word List" title + filter label (`category name` or `"{n} categories"`) | learned count `"{learned} / {total}"` (thin spaces)

**Word item:**
- Word text | translation text
- Progress: if learned → `<CheckIcon size={18}>` ; otherwise `"{m1+m2+m3} / 24"` (thin spaces around slash, TOTAL_REPS=24)
- Eye icon (open = not learned, crossed = learned): click → `onToggleLearned(word)`

**Empty states:**
- `words.length === 0`: "No words found." + "Add words to your **Words** Google Sheet under the current language tab."
- `words.length > 0 && visibleWords.length === 0`: "No words in this category."
- `loading === true`: "Loading…" centered

### 10.5 LanguageScreen

- **Route:** `/language`
- **Props:** `sheetId`, `currentLang`, `onSelect`, `onReconnect`
- **State:** `tabs` (string[]), `loading`, `error`

Fetches language tabs on mount via `getLanguageTabs(sheetId)`. Tab names are formatted as `"{StudyLang} ({NativeLang})"` using `parseLangLabel()`.

**Empty state:** "No language sheets found." + instructions referencing `db_words` + "Reconnect to sheet" button (calls `onReconnect()` which clears `localStorage.words_sheet_id` and re-triggers file discovery).

**Tab item:** formatted name + raw code (e.g. `ENG-DEU`) + `<CheckIcon>` for the currently selected tab.

### 10.6 CategoryScreen

- **Route:** `/category` — redirects to `/` if `!sheetId || !currentLang`
- **Props:** `words`, `currentCategory`, `onSelect`

Categories are derived from `words[].category` (non-empty values), sorted alphabetically via `localeCompare`.

**Initial selection state:**
- If `currentCategory === null` → all categories selected
- Otherwise → `new Set(currentCategory)`

**"All categories" button:** if all selected → deselect all; if not all → select all.

**Save:** triggered by **← Back** button:
- All selected or none selected → `onSelect(null)` (no filter)
- Otherwise → `onSelect([...selected])` (array of selected categories)

**Empty state:** "No categories found. Add a category in column G of your Google Sheet." *(Note: this message incorrectly references column G — the actual category column is A.)*

### 10.7 SettingsScreen

- **Route:** `/settings`
- **Props:** `settings`, `onChange`, `sheetId`, `sheetName`, `onChangeSheet`
- **State:** `toast` (string | null), `pickerOpen`, `pickerFiles`, `pickerLoading`

**Sections:**

*Spreadsheet:* Shows `sheetName ?? 'db_words'` with "Google Sheets data source" sub-text. "Change" button opens inline picker listing all Drive Sheets (via `listUserSheets()`). Selecting a different file calls `onChangeSheet(id, name)` which updates localStorage and re-triggers settings read.

*Session:* Number input for `stepsPerSession` — commits on `blur`, resets to default if `parseInt` returns falsy or ≤ 0.

*Learning modes:* Three rows, one per mode:

| key | maxKey | Label | Description |
|---|---|---|---|
| `mode1` | `m1Max` | Flash-cards | Flip card — see the translation |
| `mode2` | `m2Max` | Choice | Pick the correct translation from 4 options |
| `mode3` | `m3Max` | Match | Match 6 word–translation pairs |

Each row: checkbox (left) + label/description (middle) + "Max" number input (right). At least one mode must remain active — if toggling would disable all, shows Toast "At least one mode must be active".

*Reset:* "Reset to defaults" → `onChange({ ...DEFAULT_SETTINGS })`.

### 10.8 HelpScreen

- **Route:** `/help`
- **Props:** none (static content)

Three sections: "Spreadsheet" (setup instructions, column layout A/B/C), "Session modes" (table of 3 modes with availability conditions), "Main screen" (table of 5 navigation targets).

### 10.9 FeedbackScreen

- **Route:** `/feedback`
- **Props:** none
- **State:** `message`, `sending`, `toast`
- **Env:** `VITE_FEEDBACK_URL`

If `VITE_FEEDBACK_URL` is not set: shows "Feedback is not configured yet." Otherwise: textarea + "Send" button. POST to `VITE_FEEDBACK_URL` with `mode: 'no-cors'`, form-encoded body `{ email, message }`. Toast: "Thank you! Your feedback has been sent." on success; "Could not send feedback. Please try again." on error.

---

## 11. Key Components

### 11.1 FlipCard

**Props:** `step` (mode 1 step object), `onNext: () => void`, `onLearn: () => void`

**State:** `flipped` (bool), `hasFlipped` (bool), `markedLearned` (bool), `touchStartY` (ref)

**Layout:**
- "Learn and hide" button (top) — after click: disabled, label becomes "Learned ✓"; calls `onLearn()`
- Flip container (card area) — click, Enter/Space keydown, or vertical swipe > 50 px triggers flip
  - Front face: `step.word.word` + hint "tap to flip"
  - Back face: `step.word.translation` + hint "tap to flip back"
  - CSS: `rotateX(180deg)` on `.flipped`, `transform-style: preserve-3d`, `backface-visibility: hidden`
- `<NextButton>` — disabled until `hasFlipped || markedLearned`

**Touch handling:** `touchstart` saves Y coordinate; `touchend` computes `|deltaY|`; if > 50 px → flip.

### 11.2 MultipleChoice

**Props:** `step` (mode 2 step object), `onNext: () => void`, `onLearn: () => void`

**State:** `selected` (row | null), `correct` (bool), `markedLearned` (bool)

**Layout:**
- Top half: "Learn and hide" button + word card displaying `step.word.word`
- Bottom half: 2×2 grid of 4 choice buttons showing `choice.translation`

**Card states:** `'correct'` (correct answer after selection), `'wrong'` (wrong answer selected this attempt), `'idle'` (default). Once `correct === true` all choice buttons are disabled.

**Next:** enabled when `correct || markedLearned`.

### 11.3 MatchingGrid

**Props:** `step` (mode 3 step object), `onNext: () => void`

**State:** `matched` (Set of rows), `selected` ({side, row} | null), `wrongLeft` (row|null), `wrongRight` (row|null)

**Layout:** Two columns — left (words), right (translations) — each with 6 buttons. Both columns are independently shuffled by `buildSession()` before being passed in.

**Match logic:**
1. Tap a card → stored in `selected`
2. Tap same column again → switches selection (or deselects if same card tapped twice)
3. Tap opposite column → compare rows
   - Same row → correct: add to `matched`, clear `selected`
   - Different rows → wrong: set `wrongLeft`/`wrongRight`, clear `selected`, reset after 500 ms

**Card states:** `'matched'` (disabled), `'wrong'` (red flash 500 ms), `'selected'` (highlighted), `'idle'`

**Next:** enabled when `matched.size === step.words.length` (all 6 pairs matched).

*No "Learn and hide" button in mode 3.*

### 11.4 NextButton

**Props:** `onClick: () => void`, `disabled: boolean`, `label: string` (default `"Next →"`)

Full-width primary button (`btn btn-primary btn-full`) in a bottom wrapper div.

### 11.5 Toast

**Props:** `message: string`, `onDone: () => void`

Auto-dismiss: visible for 2 500 ms, CSS fade-out, then `onDone()` called after additional 300 ms.

### 11.6 CheckIcon

**Props:** `size: number` (default 20)

SVG `24×24` viewBox, `polyline points="20 6 9 17 4 12"`, stroke `currentColor`, strokeWidth 2.5, round caps/joins.

---

## 12. Theme & Colors

| Variable | Light hex | Dark hex | Usage |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#1C1C1C` | Page background |
| `--surface` | `#F3F1EF` | `#363636` | Cards, top bars, secondary button bg |
| `--surface-2` | `#E8E8E8` | `#424242` | Secondary button hover |
| `--text` | `#1C1C1C` | `#EFEFEF` | Primary text |
| `--text-muted` | `#6B6B6B` | `#949494` | Secondary text, hints |
| `--accent` | `#E07E38` | `#E8935A` | Primary button bg, links, top-bar title |
| `--accent-hover` | `#C96E2F` | `#D4804A` | Primary button hover |
| `--accent-text` | `#FFFFFF` | `#FFFFFF` | Text on accent background |
| `--success` | `#6BBF7A` | `#5AA569` | Correct answer flash |
| `--error` | `#E07070` | `#C96060` | Wrong answer flash |
| `--border` | `#E0E0E0` | `#4A4A4A` | Card borders, input borders |
| `--card-bg` | `#FFFFFF` | `#363636` | Card background |
| `--card-shadow` | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.30)` | `0 2px 12px` box shadow |
| `--radius` | `14px` | `14px` | Card border radius |
| `--radius-sm` | `8px` | `8px` | Button border radius |

Dark theme is applied automatically via `@media (prefers-color-scheme: dark)`.

**Global animations:**
- `flash-red`: 0%,100% → `var(--card-bg)`; 40% → `var(--error)` + white text
- `flash-green`: 0% → `var(--card-bg)`; 100% → `var(--success)` + white text
- `fade-in`: `opacity 0 + translateY(8px)` → `opacity 1 + translateY(0)`, 0.25s ease-out
- `.animate-in` class applies `fade-in` to the session step area on each step change

**Font:** `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, sans-serif`; base 16px; line-height 1.5.

---

## 13. Navigation & Routes

| Route | Component | Guard | Notes |
|---|---|---|---|
| `/` | `HomeScreen` | — | Always accessible after login |
| `/session` | `SessionScreen` | `sheetId && currentLang` | Redirects to `/` if guard fails |
| `/words` | `WordListScreen` | `sheetId && currentLang` | Redirects to `/` if guard fails |
| `/language` | `LanguageScreen` | — | Always accessible after login |
| `/category` | `CategoryScreen` | `sheetId && currentLang` | Redirects to `/` if guard fails |
| `/settings` | `SettingsScreen` | — | Always accessible after login |
| `/help` | `HelpScreen` | — | Always accessible after login |
| `/feedback` | `FeedbackScreen` | — | Always accessible after login |
| `*` | — | — | Redirects to `/` |

No deeplink URI scheme. Standard browser history routing (`BrowserRouter`). The service worker handles navigation requests network-first with fallback to `/index.html`, so direct URL access to any route works after the shell is cached.

---

## 14. Loading & Empty States

| Screen | Loading state | Empty state |
|---|---|---|
| App.jsx (auth init) | "Loading…" full-screen centered | — |
| `SessionScreen` | "Loading session…" centered | "All words learned!" (🎉) or "Session complete!" (✓) |
| `WordListScreen` | "Loading…" centered | "No words found." or "No words in this category." |
| `LanguageScreen` | "Loading…" centered | "No language sheets found." + reconnect button |
| `SettingsScreen` (picker) | "Loading your sheets…" inside picker | "No Google Sheets found in your Drive." |
| `HomeScreen` | "Loading your Words sheet…" hint | — |

No shimmer/skeleton animations — all loading states are plain text.

---

## 15. Progressive Web App

**Service Worker** (`dist/sw.js`, cache name `words-v1`):

| Request type | Strategy |
|---|---|
| `*.googleapis.com` or `*.accounts.google.com` | Always network (never cached) |
| Navigation (`mode === 'navigate'`) | Network-first; fallback to `/index.html` |
| App shell assets (GET) | Cache-first; on cache miss: fetch + store in cache |

Install: pre-caches `/` and `/index.html`; calls `skipWaiting()`.  
Activate: deletes all caches except `words-v1`; calls `clients.claim()`.

**PWA Manifest** (`dist/manifest.json`):

| Property | Value |
|---|---|
| `name` | `"Words"` |
| `short_name` | `"Words"` |
| `description` | `"Learn vocabulary with flashcards"` |
| `start_url` | `"/"` |
| `display` | `"standalone"` |
| `orientation` | `"portrait"` |
| `theme_color` | `"#E07E38"` |
| `background_color` | `"#FFFFFF"` |
| Icons | 192×192 and 512×512 PNG, purpose `"any maskable"` |

`index.html` meta: `viewport` with `user-scalable=no`, `theme-color #E07E38`, `apple-mobile-web-app-capable yes`, `apple-mobile-web-app-title Words`.

---

## 16. First-Time Setup (New Developer)

1. **Google Cloud project**
   - Go to [console.cloud.google.com](https://console.cloud.google.com)
   - Create a new project
   - Enable **Google Sheets API** and **Google Drive API**
   - Create an **OAuth 2.0 Client ID** (type: Web application)
   - Add authorized JavaScript origins (e.g. `http://localhost:3000`, production domain)
   - Add test users under "OAuth consent screen" (app stays in "Testing" mode until published)

2. **Environment file**
   ```
   # .env  (project root, not committed)
   VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   VITE_FEEDBACK_URL=https://your-form-endpoint   # optional
   ```

3. **Install and run**
   ```bash
   npm install
   npm run dev   # http://localhost:3000
   ```

4. **Build for production**
   ```bash
   npm run build   # output → dist/
   ```
   Deploy `dist/` to any static host (Vercel, Netlify, GitHub Pages).

5. **Google Sheet (optional — auto-created on first login)**
   - App creates `db_words` in the user's Drive with sample German vocabulary
   - To use custom data: create any Google Sheet, add a tab named `NATIVE-STUDY` (e.g. `EN-FI`), fill columns A (category), B (word), C (translation)
   - In **Settings → Spreadsheet → Change**, pick the file

---

## 17. Key Algorithms

### 16.1 `isWordLearned(word, settings)`

```
function isWordLearned(word, settings):
  if word.learned == true:
    return true
  if settings.mode1 and word.m1 < settings.m1Max:
    return false
  if settings.mode2 and word.m2 < settings.m2Max:
    return false
  if settings.mode3 and word.m3 < settings.m3Max:
    return false
  return true
```

### 16.2 `isWordEligibleForMode(word, modeNum, settings)`

```
function isWordEligibleForMode(word, modeNum, settings):
  if modeNum == 1:
    return settings.mode1 AND word.m1 < m1Max

  if modeNum == 2:
    return settings.mode2
      AND word.m2 < m2Max
      AND (NOT settings.mode1 OR word.m1 >= m1Max)

  if modeNum == 3:
    return settings.mode3
      AND word.m3 < m3Max
      AND (NOT settings.mode2 OR word.m2 >= m2Max)
      AND (NOT settings.mode1 OR word.m1 >= m1Max)
```

A disabled mode does not gate the next mode — its counter requirement is skipped entirely.

### 16.3 `buildMode3Pool(active, categoryFilter, settings)`

```
function buildMode3Pool(active, categoryFilter, settings):
  qualified = active
    .filter(w => isWordEligibleForMode(w, 3, settings))
    .sort by w.m3 ascending

  if categoryFilter is null or len(categoryFilter) <= 1:
    return qualified

  presentCats = { w.category for w in qualified }
  missingCats = categoryFilter - presentCats

  if missingCats is empty:
    return qualified

  slotsPerCat = ceil(6 / len(categoryFilter))
  supplements = for each cat in missingCats:
    take top slotsPerCat words from active where w.category == cat,
    sorted by (m2 + m1) descending

  return qualified + supplements
```

This ensures all selected categories appear in the matching grid even before they reach the mode 3 threshold.

### 16.4 `buildSession(words, categoryFilter, settings)`

```
function buildSession(words, categoryFilter, settings):
  TOTAL   = settings.stepsPerSession        // default 12

  filtered = categoryFilter ? words.filter(in categoryFilter) : words
  active   = filtered.filter(NOT isWordLearned)

  mode1Pool   = active.filter(isWordEligibleForMode(_, 1))
  mode2Pool   = active.filter(isWordEligibleForMode(_, 2))
  mode3Pool   = buildMode3Pool(active, categoryFilter, settings)
  mode3Groups = slice mode3Pool into non-overlapping groups of 6

  availableModes = []
  if mode1Pool not empty: append 1
  if mode2Pool not empty: append 2
  if mode3Groups not empty: append 3    // requires at least one complete group of 6

  if availableModes is empty:
    return { steps: [], allLearned: true }

  // Equal distribution; earlier modes absorb remainder steps
  perMode   = floor(TOTAL / len(availableModes))
  remainder = TOTAL mod len(availableModes)
  plan = flatten([mode repeated (perMode + (1 if index < remainder))
                  for index, mode in enumerate(availableModes)])
  shuffledPlan = shuffle(plan)    // interleave modes randomly

  queue1 = shuffle(mode1Pool)     // cycle: all words before repeating
  queue2 = shuffle(mode2Pool)
  i1 = i2 = i3 = 0

  steps = []
  for mode in shuffledPlan:
    if mode == 1:
      word = queue1[i1 % len(queue1)]; i1++
      steps.append({ mode:1, word })

    elif mode == 2:
      word = queue2[i2 % len(queue2)]; i2++
      wrongPool = filtered.filter(w.row != word.row)
      if len(wrongPool) < 3: wrongPool = words.filter(w.row != word.row)
      wrong = pick 3 random from wrongPool
      steps.append({ mode:2, word, choices: shuffle([word]+wrong) })

    elif mode == 3:
      group = mode3Groups[i3 % len(mode3Groups)]; i3++
      leftCards  = shuffle(group.map({ row, text: word }))
      rightCards = shuffle(group.map({ row, text: translation }))
      steps.append({ mode:3, words:group, leftCards, rightCards })

  return { steps, allLearned: false }
```
