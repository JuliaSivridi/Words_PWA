// Google Picker — the native Drive file-open dialog.
// With the drive.file scope, a file selected here is permanently granted to
// the app (the grant lives on Google's side, not on this device).

import { refreshTokenIfNeeded, getAccessToken } from './auth.js'

const GAPI_SRC = 'https://apis.google.com/js/api.js'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
export const PICKER_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || ''
// Cloud project number — the numeric prefix of the OAuth client id
export const PICKER_APP_ID = CLIENT_ID.split('-')[0] || ''

let pickerReady = null

function loadPickerApi() {
  if (pickerReady) return pickerReady
  pickerReady = new Promise((resolve, reject) => {
    const onGapi = () => window.gapi.load('picker', { callback: () => resolve() })
    if (window.gapi?.load) { onGapi(); return }
    const s = document.createElement('script')
    s.src = GAPI_SRC
    s.async = true
    s.onload = onGapi
    s.onerror = () => reject(new Error('Failed to load Google API script'))
    document.head.appendChild(s)
  })
  return pickerReady
}

/**
 * Opens the Google Picker limited to spreadsheets.
 * Resolves with {id, name}, or null if the user cancelled.
 */
export async function openSpreadsheetPicker() {
  await refreshTokenIfNeeded()
  const token = getAccessToken()
  if (!token) throw new Error('Not authorized')
  await loadPickerApi()

  const picker = window.google.picker
  return new Promise((resolve) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)

    const dialog = new picker.PickerBuilder()
      .setAppId(PICKER_APP_ID)
      .setOAuthToken(token)
      .setDeveloperKey(PICKER_API_KEY)
      .addView(view)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED && data.docs?.[0]) {
          resolve({ id: data.docs[0].id, name: data.docs[0].name })
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
    dialog.setVisible(true)
  })
}
