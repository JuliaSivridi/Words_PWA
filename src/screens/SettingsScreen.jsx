import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Toast from '../components/Toast.jsx'
import { DEFAULT_SETTINGS } from '../settingsUtils.js'
import { openSpreadsheetPicker } from '../picker.js'
import UserMenu from '../components/UserMenu.jsx'
import styles from './SettingsScreen.module.css'

const MODES = [
  { key: 'mode1', maxKey: 'm1Max', label: 'Flash-cards', description: 'Flip card — see the translation' },
  { key: 'mode2', maxKey: 'm2Max', label: 'Choice',      description: 'Pick the correct translation from 4 options' },
  { key: 'mode3', maxKey: 'm3Max', label: 'Match',       description: 'Match 6 word–translation pairs' },
]

export default function SettingsScreen({ settings, onChange, sheetId, sheetName, onChangeSheet }) {
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)

  // ── Sheet picker — native Google Picker: picking a file also grants the
  // app access to it (we only have the drive.file scope) ─────────────────────
  async function handleOpenPicker() {
    try {
      const file = await openSpreadsheetPicker()
      if (file && file.id !== sheetId) {
        onChangeSheet(file.id, file.name)
      }
    } catch {
      setToast('Could not open the file picker')
    }
  }

  // ── Checkbox toggle ────────────────────────────────────────────────────────
  function handleToggle(key) {
    const next = { ...settings, [key]: !settings[key] }
    const anyActive = next.mode1 || next.mode2 || next.mode3
    if (!anyActive) {
      setToast('At least one mode must be active')
      return
    }
    onChange(next)
  }

  // ── Number field: commit on blur, reset to default if invalid ──────────────
  function handleNumberBlur(field, value) {
    const num = parseInt(value)
    if (!num || num <= 0) {
      onChange({ ...settings, [field]: DEFAULT_SETTINGS[field] })
    } else {
      onChange({ ...settings, [field]: num })
    }
  }

  // ── Reset all settings to defaults ────────────────────────────────────────
  function handleReset() {
    onChange({ ...DEFAULT_SETTINGS })
  }

  return (
    <div className={styles.screen}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Back">
          <BackIcon />
        </button>
        <span className={styles.title}>Settings</span>
        <UserMenu />
      </div>

      <div className={styles.content}>

        {/* ── Spreadsheet ─────────────────────────────────────────────────── */}
        <p className={styles.sectionLabel}>Spreadsheet</p>
        <div className={styles.list}>
          <div className={styles.row} style={{ cursor: 'default' }}>
            <SheetIcon />
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>{sheetName ?? 'db_words'}</span>
              <span className={styles.rowDesc}>Google Sheets data source</span>
            </div>
            <button
              className={styles.changeBtn}
              onClick={handleOpenPicker}
            >
              Change
            </button>
          </div>
        </div>

        {/* ── Session ─────────────────────────────────────────────────────── */}
        <p className={styles.sectionLabel}>Session</p>
        <div className={styles.list}>
          <div className={styles.row}>
            <div className={styles.rowText}>
              <span className={styles.rowLabel}>Steps per session</span>
              <span className={styles.rowDesc}>Number of exercises in one session</span>
            </div>
            <input
              type="number"
              className={styles.numInput}
              defaultValue={settings.stepsPerSession ?? DEFAULT_SETTINGS.stepsPerSession}
              key={settings.stepsPerSession}
              min="1"
              onBlur={e => handleNumberBlur('stepsPerSession', e.target.value)}
            />
          </div>
        </div>

        {/* ── Learning modes ──────────────────────────────────────────────── */}
        <p className={styles.sectionLabel}>Learning modes</p>
        <div className={styles.list}>
          {MODES.map(({ key, maxKey, label, description }) => (
            <div key={key} className={styles.row}>
              {/* Checkbox on the left */}
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={!!settings[key]}
                onChange={() => handleToggle(key)}
              />
              {/* Label in the middle */}
              <div className={styles.rowText}>
                <span className={styles.rowLabel}>{label}</span>
                <span className={styles.rowDesc}>{description}</span>
              </div>
              {/* Max reps on the right */}
              <div className={styles.maxWrapper}>
                <span className={styles.maxLabel}>Max</span>
                <input
                  type="number"
                  className={styles.numInput}
                  defaultValue={settings[maxKey] ?? DEFAULT_SETTINGS[maxKey]}
                  key={settings[maxKey]}
                  min="1"
                  onBlur={e => handleNumberBlur(maxKey, e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ── Reset ───────────────────────────────────────────────────────── */}
        <button className={styles.resetBtn} onClick={handleReset}>
          Reset to defaults
        </button>

      </div>

      {toast && (
        <Toast message={toast} onDone={() => setToast(null)} />
      )}
    </div>
  )
}

function BackIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function SheetIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, color: 'var(--text-muted)' }}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="9" x2="9" y2="21" />
    </svg>
  )
}

function CheckMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, color: 'var(--accent)' }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
