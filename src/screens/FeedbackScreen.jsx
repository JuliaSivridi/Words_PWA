import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUser } from '../auth.js'
import Toast from '../components/Toast.jsx'
import UserMenu from '../components/UserMenu.jsx'
import styles from './FeedbackScreen.module.css'

const FEEDBACK_URL = import.meta.env.VITE_FEEDBACK_URL

export default function FeedbackScreen() {
  const navigate = useNavigate()
  const user = getUser()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState(null)

  async function handleSend() {
    if (!message.trim() || !FEEDBACK_URL) return
    setSending(true)
    try {
      await fetch(FEEDBACK_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          app: 'Words',
          email: user?.email ?? '',
          message: message.trim(),
        }),
      })
      setMessage('')
      setToast('Thank you! Your feedback has been sent.')
    } catch {
      setToast('Could not send feedback. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/')} aria-label="Back">
          <BackIcon />
        </button>
        <span className={styles.title}>Feedback</span>
        <UserMenu />
      </div>

      <div className={styles.content}>
        {FEEDBACK_URL ? (
          <>
            <p className={styles.subtitle}>
              Share your thoughts, suggestions, or report a problem.
            </p>
            <textarea
              className={styles.textarea}
              placeholder="Write your message…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              disabled={sending}
            />
            <button
              className={styles.sendBtn}
              onClick={handleSend}
              disabled={!message.trim() || sending}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
          </>
        ) : (
          <p className={styles.unconfigured}>
            Feedback is not configured yet.
          </p>
        )}
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
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
