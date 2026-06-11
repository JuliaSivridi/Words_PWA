import { useNavigate } from 'react-router-dom'
import CheckIcon from '../components/CheckIcon.jsx'
import { DEFAULT_SETTINGS } from '../settingsUtils.js'
import styles from './WordListScreen.module.css'

// categoryFilter: null = show all; string = show only words in that category
export default function WordListScreen({ words, loading, categoryFilter, onToggleLearned, settings = DEFAULT_SETTINGS }) {
  const navigate = useNavigate()

  // categoryFilter: null = show all; string[] = show only matching categories
  const visibleWords = categoryFilter && categoryFilter.length > 0
    ? words.filter(w => categoryFilter.includes(w.category))
    : words

  return (
    <div className={styles.screen}>
      {/* Sticky header */}
      <div className={styles.header}>
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ padding: '8px 16px' }}>
          ← Back
        </button>
        <div className={styles.titleArea}>
          <span className={styles.title}>Word List</span>
          {categoryFilter && categoryFilter.length > 0 && (
            <span className={styles.filterLabel}>
              {categoryFilter.length === 1 ? categoryFilter[0] : `${categoryFilter.length} categories`}
            </span>
          )}
        </div>
        <span className={styles.count}>
          <span>Learned {visibleWords.filter(w => w.learned).length}</span>
          <span>Total {visibleWords.length}</span>
        </span>
      </div>

      <div className={styles.list}>
        {loading && (
          <p className="text-muted" style={{ textAlign: 'center', padding: '32px 0' }}>Loading…</p>
        )}

        {!loading && words.length === 0 && (
          <div className={styles.empty}>
            <p>No words found.</p>
            <p className="text-muted" style={{ marginTop: 8, fontSize: '1rem' }}>
              Add words to your <strong>Words</strong> Google Sheet under the current language tab.
            </p>
          </div>
        )}

        {!loading && words.length > 0 && visibleWords.length === 0 && (
          <div className={styles.empty}>
            <p>No words in this category.</p>
          </div>
        )}

        {visibleWords.map(word => (
          <WordItem
            key={word.row}
            word={word}
            settings={settings}
            onToggle={() => onToggleLearned(word)}
          />
        ))}
      </div>
    </div>
  )
}

function WordItem({ word, settings, onToggle }) {
  const isLearned = word.learned

  // Per-mode progress bars (only enabled modes), thresholds come from settings
  const modes = [
    settings.mode1 && { value: word.m1, max: settings.m1Max, cls: styles.barM1 },
    settings.mode2 && { value: word.m2, max: settings.m2Max, cls: styles.barM2 },
    settings.mode3 && { value: word.m3, max: settings.m3Max, cls: styles.barM3 },
  ].filter(Boolean)

  const progress = modes.reduce((s, m) => s + Math.min(m.value, m.max), 0)
  const total    = modes.reduce((s, m) => s + m.max, 0)

  return (
    <div className={`${styles.item} ${isLearned ? styles.learned : ''}`}>
      <div className={styles.texts}>
        <span className={styles.wordText}>{word.word}</span>
        <span className={styles.translationText}>{word.translation}</span>
        {!isLearned && (
          <div className={styles.bars} title="Progress per exercise mode">
            {modes.map((m, i) => (
              <span key={i} className={styles.barTrack}>
                <span
                  className={`${styles.barFill} ${m.cls}`}
                  style={{ width: `${Math.min(100, (m.value / m.max) * 100)}%` }}
                />
              </span>
            ))}
          </div>
        )}
      </div>

      <span className={`${styles.progress} ${isLearned ? styles.progressCheck : ''}`} title="Repetitions done / total">
        {isLearned ? <CheckIcon size={18} /> : `${progress}\u200A/\u200A${total}`}
      </span>

      <button
        className={styles.eyeBtn}
        onClick={onToggle}
        title={isLearned ? 'Mark as active' : 'Mark as learned'}
        aria-label={isLearned ? 'Show word again' : 'Mark as learned'}
      >
        {isLearned ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  )
}

function EyeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}
