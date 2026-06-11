// Google Identity Services – client-side OAuth 2.0
// Token is persisted in localStorage so page refresh doesn't require GIS popup.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// drive.file: access only to files this app created or the user picked via
// the Google Picker — the app can no longer see the rest of Drive/Sheets.
const SCOPES = [
  'email',
  'profile',
  'https://www.googleapis.com/auth/drive.file',
].join(' ')

const TOKEN_KEY        = 'words_token'
const TOKEN_EXPIRY_KEY = 'words_token_expiry'

let accessToken = null
let tokenClient = null
let tokenExpiresAt = 0

function persistToken(token, expiresIn) {
  const expiry = Date.now() + expiresIn * 1000
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry))
  accessToken = token
  tokenExpiresAt = expiry
}

function loadPersistedToken() {
  const token = localStorage.getItem(TOKEN_KEY)
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '0')
  if (token && Date.now() < expiry - 30_000) {
    accessToken = token
    tokenExpiresAt = expiry
    return true
  }
  return false
}

function clearPersistedToken() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(TOKEN_EXPIRY_KEY)
  accessToken = null
  tokenExpiresAt = 0
}

// Listeners that want to know when auth state changes
const listeners = new Set()

export function onAuthChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  listeners.forEach(fn => fn(getUser()))
}

export function getUser() {
  try {
    const raw = localStorage.getItem('words_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getAccessToken() {
  return accessToken
}

export function isTokenFresh() {
  return accessToken && Date.now() < tokenExpiresAt - 30_000
}

function saveUser(profile) {
  localStorage.setItem('words_user', JSON.stringify(profile))
}

export function signOut() {
  if (accessToken) google.accounts.oauth2.revoke(accessToken, () => {})
  clearPersistedToken()
  localStorage.removeItem('words_user')
  notify()
}

// Fetch user profile from Google using the access token
async function fetchProfile(token) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('Failed to fetch profile')
  return res.json()
}

// Initialize the token client (call once when GIS is loaded)
function initTokenClient(onSuccess, onError) {
  const user = getUser()
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    hint: user?.email ?? undefined,
    callback: async (response) => {
      if (response.error) {
        onError?.(response.error)
        return
      }
      persistToken(response.access_token, response.expires_in ?? 3600)

      // If we don't have a saved profile yet, fetch it
      if (!getUser()) {
        try {
          const profile = await fetchProfile(accessToken)
          saveUser({ email: profile.email, name: profile.name, picture: profile.picture })
        } catch {
          // profile fetch failed – still usable
        }
      }
      notify()
      onSuccess?.()
    },
    error_callback: (err) => {
      // popup_closed or other non-error situations are expected
      if (err.type !== 'popup_closed') {
        onError?.(err.type)
      }
    },
  })
}

// Attempt silent sign-in (no UI). Returns a Promise that resolves to true/false.
export function trySilentSignIn() {
  return new Promise((resolve) => {
    // Fast path: stored token still valid — no GIS round-trip needed
    if (loadPersistedToken()) {
      resolve(true)
      return
    }
    if (!window.google?.accounts?.oauth2) {
      resolve(false)
      return
    }
    initTokenClient(
      () => resolve(true),
      () => resolve(false)
    )
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

// Show the Google sign-in popup
export function signInWithPopup() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'))
      return
    }
    initTokenClient(
      () => resolve(getUser()),
      (err) => reject(new Error(err ?? 'Sign in failed'))
    )
    tokenClient.requestAccessToken({ prompt: 'consent' })
  })
}

// Re-request token silently when it's about to expire
export async function refreshTokenIfNeeded() {
  if (isTokenFresh()) return true
  return trySilentSignIn()
}

// Wait for GIS script to load, then try silent sign-in
export function initAuth(onReady) {
  function tryInit() {
    if (window.google?.accounts?.oauth2) {
      onReady()
    } else {
      setTimeout(tryInit, 100)
    }
  }
  tryInit()
}
