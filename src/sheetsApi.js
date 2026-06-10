// Google Sheets API v4 + Drive API v3 – direct browser calls
import { getAccessToken, refreshTokenIfNeeded } from './auth.js'

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'

async function request(url, options = {}) {
  await refreshTokenIfNeeded()
  const token = getAccessToken()
  if (!token) throw new Error('Сессия истекла — войдите заново')
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── Drive: find or create "db_words" spreadsheet ───────────────────────────

const DB_FILE_NAME = 'db_words'

export async function findOrCreateWordsFile() {
  const cached = localStorage.getItem('words_sheet_id')
  if (cached) return cached

  // Search for existing file
  async function searchDrive() {
    const query = encodeURIComponent(
      `name='${DB_FILE_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
    )
    const list = await request(`${DRIVE_BASE}/files?q=${query}&fields=files(id,name)`)
    return list.files ?? []
  }

  let files = await searchDrive()

  // Drive search can lag for recently-created files — retry once after a short delay
  // before concluding no file exists and creating a new one.
  if (files.length === 0) {
    await new Promise(r => setTimeout(r, 2500))
    files = await searchDrive()
  }

  if (files.length > 0) {
    const id = files[0].id
    localStorage.setItem('words_sheet_id', id)
    return id
  }

  // No existing file found — create a new spreadsheet with sample content
  const created = await request(SHEETS_BASE, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: DB_FILE_NAME },
      sheets: [
        { properties: { title: 'ENG-DEU' } },
        { properties: { title: '_settings' } },
      ],
    }),
  })
  await seedNewSpreadsheet(created.spreadsheetId)
  localStorage.setItem('words_sheet_id', created.spreadsheetId)
  return created.spreadsheetId
}

// ─── Seed data for a freshly-created spreadsheet ─────────────────────────────

async function seedNewSpreadsheet(id) {
  // Sample beginner German vocabulary — 3 categories × 10-12 words
  // Column layout: A=category, B=word (German), C=translation (English)
  const words = [
    // ── Numbers ──────────────────────────────────────────────────────────────
    ['Numbers', 'eins',    'one'],
    ['Numbers', 'zwei',    'two'],
    ['Numbers', 'drei',    'three'],
    ['Numbers', 'vier',    'four'],
    ['Numbers', 'fünf',    'five'],
    ['Numbers', 'sechs',   'six'],
    ['Numbers', 'sieben',  'seven'],
    ['Numbers', 'acht',    'eight'],
    ['Numbers', 'neun',    'nine'],
    ['Numbers', 'zehn',    'ten'],
    ['Numbers', 'elf',     'eleven'],
    ['Numbers', 'zwölf',   'twelve'],
    // ── Greetings ─────────────────────────────────────────────────────────────
    ['Greetings', 'Hallo',           'Hello'],
    ['Greetings', 'Guten Morgen',    'Good morning'],
    ['Greetings', 'Guten Tag',       'Good day'],
    ['Greetings', 'Guten Abend',     'Good evening'],
    ['Greetings', 'Auf Wiedersehen', 'Goodbye'],
    ['Greetings', 'Tschüss',         'Bye'],
    ['Greetings', 'Bitte',           'Please'],
    ['Greetings', 'Danke',           'Thank you'],
    ['Greetings', 'Entschuldigung',  'Excuse me'],
    ['Greetings', 'Ja',              'Yes'],
    ['Greetings', 'Nein',            'No'],
    // ── Colors ────────────────────────────────────────────────────────────────
    ['Colors', 'rot',    'red'],
    ['Colors', 'blau',   'blue'],
    ['Colors', 'grün',   'green'],
    ['Colors', 'gelb',   'yellow'],
    ['Colors', 'schwarz','black'],
    ['Colors', 'weiß',   'white'],
    ['Colors', 'orange', 'orange'],
    ['Colors', 'rosa',   'pink'],
    ['Colors', 'lila',   'purple'],
    ['Colors', 'braun',  'brown'],
    ['Colors', 'grau',   'grey'],
  ]

  const settings = [
    ['language',        'ENG-DEU'],
    ['category',        ''],
    ['mode1',           'TRUE'],
    ['mode2',           'TRUE'],
    ['mode3',           'TRUE'],
    ['stepsPerSession', '12'],
    ['m1Max',           '4'],
    ['m2Max',           '8'],
    ['m3Max',           '12'],
  ]

  await request(`${SHEETS_BASE}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: [
        {
          range: `ENG-DEU!A1:C${words.length + 1}`,
          values: [['category', 'word', 'translation'], ...words],
        },
        {
          range: '_settings!A1:B9',
          values: settings,
        },
      ],
    }),
  })
}

// ─── Drive: list all Google Sheets owned by the user ────────────────────────

export async function listUserSheets() {
  const query = encodeURIComponent(
    `mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  )
  const data = await request(
    `${DRIVE_BASE}/files?q=${query}&fields=files(id,name)&orderBy=modifiedTime+desc`
  )
  return data.files ?? []
}

// ─── Drive: get display name of a specific file ──────────────────────────────

export async function getSheetFileName(sheetId) {
  const data = await request(`${DRIVE_BASE}/files/${sheetId}?fields=name`)
  return data.name
}

// ─── Sheets: list language tabs ─────────────────────────────────────────────

export async function getLanguageTabs(sheetId) {
  const data = await request(`${SHEETS_BASE}/${sheetId}?fields=sheets.properties.title`)
  return data.sheets
    .map(s => s.properties.title)
    .filter(t => t !== 'Sheet1' && t !== 'Лист1' && t !== '_settings')
}

// ─── Sheets: read words ──────────────────────────────────────────────────────

// Returns array of word objects:
// { row, word, translation, m1, m2, m3, learned, category }
// row is 1-based sheet row number.
// Column layout: A=category, B=word, C=translation, D=m1, E=m2, F=m3, G=learned
// Handles sheets with or without a header row:
//   - If row 1 column B is exactly "word" (case-insensitive), treat as header and skip.
//   - Otherwise all non-empty rows are data.
export async function getWords(sheetId, tab) {
  const range = encodeURIComponent(`${tab}!A1:G`)
  const data = await request(`${SHEETS_BASE}/${sheetId}/values/${range}`)
  const rows = data.values ?? []

  const hasHeader = rows.length > 0 &&
    rows[0][1]?.toString().trim().toLowerCase() === 'word'

  const dataRows = hasHeader ? rows.slice(1) : rows
  const rowOffset = hasHeader ? 2 : 1

  // Map with actual sheet row number BEFORE filtering.
  // Filtering after mapping ensures empty rows in the middle of the sheet
  // don't shift the row indices of subsequent words.
  return dataRows
    .map((r, i) => ({
      row: rowOffset + i,
      category: r[0]?.trim() ?? '',
      word: r[1]?.trim() ?? '',
      translation: r[2]?.trim() ?? '',
      m1: parseInt(r[3]) || 0,
      m2: parseInt(r[4]) || 0,
      m3: parseInt(r[5]) || 0,
      learned: r[6] === 'TRUE' || r[6] === true,
    }))
    .filter(w => w.word)
}

// ─── Sheets: batch-update counters after session ─────────────────────────────

// updates is array of { row, m1, m2, m3 }
// Only writes counters (D:F) — the learned column (G) is NEVER touched here.
// Marking as learned is done separately via markLearned(), so a manually-set
// learned=TRUE can never be overwritten by session results.
export async function batchUpdateWords(sheetId, tab, updates) {
  if (!updates.length) return

  const data = updates.map(u => ({
    range: `${tab}!D${u.row}:F${u.row}`,
    values: [[u.m1, u.m2, u.m3]],
  }))

  await request(`${SHEETS_BASE}/${sheetId}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  })
}

// ─── Sheets: mark single word learned immediately ───────────────────────────

export async function markLearned(sheetId, tab, row, learned) {
  const range = encodeURIComponent(`${tab}!G${row}`)
  await request(`${SHEETS_BASE}/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[learned ? 'TRUE' : 'FALSE']] }),
  })
}

// ─── Sheets: reset word counters (un-learn) ──────────────────────────────────

export async function resetWordCounters(sheetId, tab, row) {
  const range = encodeURIComponent(`${tab}!D${row}:G${row}`)
  await request(`${SHEETS_BASE}/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [[0, 0, 0, 'FALSE']] }),
  })
}

// ─── Sheets: _settings tab ───────────────────────────────────────────────────
// Stores app settings as key-value pairs for human readability:
//   A1=language   B1=RU-EN
//   A2=category   B2=Animals
//   A3=mode1      B3=TRUE
//   A4=mode2      B4=FALSE
//   A5=mode3      B5=TRUE
// Backward compat: old format had only column A (positional). Detected by
// checking whether A1 contains the literal key "language".

async function ensureSettingsTab(sheetId) {
  const data = await request(`${SHEETS_BASE}/${sheetId}?fields=sheets.properties.title`)
  const titles = data.sheets.map(s => s.properties.title)
  if (titles.includes('_settings')) return

  await request(`${SHEETS_BASE}/${sheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: '_settings' } } }],
    }),
  })
}

export async function readSettings(sheetId) {
  try {
    const range = encodeURIComponent('_settings!A1:B10')
    const data = await request(`${SHEETS_BASE}/${sheetId}/values/${range}`)
    const rows = data.values ?? []

    // New key-value format: A1 = "language"
    if (rows[0]?.[0] === 'language') {
      const map = {}
      for (const row of rows) {
        if (row[0]) map[row[0]] = row[1] ?? ''
      }
      return {
        language:        map.language || null,
        category:        map.category || null,
        mode1:           map.mode1 !== 'FALSE',
        mode2:           map.mode2 !== 'FALSE',
        mode3:           map.mode3 !== 'FALSE',
        stepsPerSession: parseInt(map.stepsPerSession) || null,
        m1Max:           parseInt(map.m1Max) || null,
        m2Max:           parseInt(map.m2Max) || null,
        m3Max:           parseInt(map.m3Max) || null,
      }
    }

    // Legacy format: A1=language value, A2=category value
    return {
      language: rows[0]?.[0] || null,
      category: rows[1]?.[0] || null,
      mode1: true, mode2: true, mode3: true,
      stepsPerSession: null, m1Max: null, m2Max: null, m3Max: null,
    }
  } catch {
    return { language: null, category: null, mode1: true, mode2: true, mode3: true }
  }
}

export async function writeSettings(sheetId, {
  language, category,
  mode1, mode2, mode3,
  stepsPerSession, m1Max, m2Max, m3Max,
}) {
  await ensureSettingsTab(sheetId)
  const range = encodeURIComponent('_settings!A1:B9')
  await request(`${SHEETS_BASE}/${sheetId}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({
      values: [
        ['language',        language ?? ''],
        ['category',        category ?? ''],
        ['mode1',           mode1 !== false ? 'TRUE' : 'FALSE'],
        ['mode2',           mode2 !== false ? 'TRUE' : 'FALSE'],
        ['mode3',           mode3 !== false ? 'TRUE' : 'FALSE'],
        ['stepsPerSession', stepsPerSession ?? ''],
        ['m1Max',           m1Max ?? ''],
        ['m2Max',           m2Max ?? ''],
        ['m3Max',           m3Max ?? ''],
      ],
    }),
  })
}
