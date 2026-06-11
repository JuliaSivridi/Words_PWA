import { useNavigate } from 'react-router-dom'
import styles from './HelpScreen.module.css'

export default function HelpScreen() {
  const navigate = useNavigate()

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <span className={styles.title}>Short guide</span>
      </div>

      <div className={styles.content}>

        {/* ── Spreadsheet setup ───────────────────────────────────────────── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Spreadsheet</p>
          <div className={styles.card}>
            <p className={styles.para}>
              The app reads word pairs from a Google Sheets file. By default it looks for a
              file named <strong>db_words</strong> in your Google Drive.
            </p>
            <ul className={styles.list}>
              <li>
                If the file is not found, go to <strong>Settings → Spreadsheet → Change</strong> to
                pick any file manually.
              </li>
              <li>
                Your file needs at least one tab (sheet) named in the format{' '}
                <strong>Language1-Language2</strong>, e.g. <strong>EN-FI</strong> or{' '}
                <strong>TUR-FIN</strong>.
              </li>
              <li><strong>Column A</strong> — category (optional grouping label, e.g. "verbs")</li>
              <li><strong>Column B</strong> — the word you are learning</li>
              <li><strong>Column C</strong> — translation</li>
              <li>Row 1 can be a header row or start with data directly.</li>
            </ul>
            <div className={styles.note}>
              To practice in both directions, add a second tab with reversed languages,
              e.g. <strong>FI-EN</strong>.
            </div>
          </div>
        </section>

        {/* ── Session modes ───────────────────────────────────────────────── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Session modes</p>
          <div className={styles.card}>
            <p className={styles.para}>
              Each session contains a fixed number of steps (default 12, adjustable in Settings).
            </p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Mode</th>
                  <th>How it works</th>
                  <th>Available after</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Flash-cards</strong></td>
                  <td>See a word — tap to flip and reveal the translation</td>
                  <td>From the start</td>
                </tr>
                <tr>
                  <td><strong>Choice</strong></td>
                  <td>Pick the correct translation from 4 options</td>
                  <td>After Flash-cards stage</td>
                </tr>
                <tr>
                  <td><strong>Match</strong></td>
                  <td>Connect 6 word–translation pairs on a grid</td>
                  <td>After Choice stage</td>
                </tr>
              </tbody>
            </table>
            <p className={styles.para}>
              Enable/disable modes and adjust max repetitions in{' '}
              <strong>Settings → Learning modes</strong>.
            </p>
          </div>
        </section>

        {/* ── Main screen ─────────────────────────────────────────────────── */}
        <section className={styles.section}>
          <p className={styles.sectionLabel}>Main screen</p>
          <div className={styles.card}>
            <table className={styles.table}>
              <tbody>
                <tr>
                  <td className={styles.tdLabel}><strong>Start</strong></td>
                  <td>Begin a practice session</td>
                </tr>
                <tr>
                  <td className={styles.tdLabel}><strong>Language</strong></td>
                  <td>Switch between tabs (sheets) in your spreadsheet file</td>
                </tr>
                <tr>
                  <td className={styles.tdLabel}><strong>Category</strong></td>
                  <td>Filter practice words by category (Column A)</td>
                </tr>
                <tr>
                  <td className={styles.tdLabel}><strong>Word list</strong></td>
                  <td>
                    Browse all words; tap the eye icon to mark a word as learned
                    (it will no longer appear in sessions; tap again to undo).
                    The number like 7&thinsp;/&thinsp;24 is repetitions done out of the
                    total required by your mode settings; the three colored bars
                    show progress in each exercise mode separately.
                  </td>
                </tr>
                <tr>
                  <td className={styles.tdLabel}><strong>Avatar</strong></td>
                  <td>Settings, Help, Feedback, Sign out</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>
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
