// Section 4.3 — shared Photo Uploader used by the item Add/Edit modals.
// Replaces the old manual "Photo URL" field with a real file picker:
//   • validates type (jpeg/png/webp) + size (≤ 2 MB) BEFORE anything uploads
//   • downscales client-side to ≤ 800px and converts to a persistent data URL
//     — the same mechanism the Profile page already uses for the cafe logo
//     (works on Railway's ephemeral filesystem where nothing else is writable)
//   • shows a live preview, a Replace control, and clear uploading/OK/error
//     states. The data URL persists in `menu_items.image_url` in Postgres and
//     is rendered by BOTH the admin miniapp and the customer miniapp.
import React, { useRef, useState } from 'react'
import { useApp } from '../store.jsx'
import { haptic } from '../telegram.js'

const ACCEPTED = { 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1 }
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB pre-downscale ceiling

// Downscale with an <img>→<canvas> pipeline; keeps JPEG output small enough
// to store as a data URL (~100–250 KB typical) — persistent, unlike the
// device-local blob: URLs Telegram webviews hand out.
function downscaleToDataUrl(file, maxEdge = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('could not read the file'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('not a valid image file'))
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas unavailable'))
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export default function PhotoUploader({ value, onChange }) {
  const { toast } = useApp()
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  function pick() {
    setError(null)
    // Reset input.value so selecting the SAME file again still fires change.
    if (inputRef.current) inputRef.current.value = ''
    inputRef.current?.click()
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ACCEPTED[file.type]) {
      setError('Please choose a JPG, PNG or WebP image')
      haptic('error')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Image is too large — please use a file up to 2 MB')
      haptic('error')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const dataUrl = await downscaleToDataUrl(file)
      haptic('success')
      toast('Photo ready ✓')
      onChange(dataUrl)
    } catch (err) {
      setError(err?.message || 'Upload failed — please try another image')
      haptic('error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <div className="upload-tile">
        {value ? (
          <img src={value} alt="Item photo preview" />
        ) : (
          <span
            aria-hidden="true"
            style={{ fontSize: 26, color: 'var(--hint)', width: 56, textAlign: 'center', flexShrink: 0 }}
          >
            🖼️
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <button type="button" className="upload-tile-btn" onClick={pick} disabled={busy}>
            {busy ? 'Uploading…' : value ? 'Replace photo' : 'Upload photo'}
          </button>
          {value && !busy ? (
            <button
              type="button"
              className="upload-tile-btn"
              style={{ marginLeft: 8, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)' }}
              onClick={() => onChange('')}
            >
              Remove
            </button>
          ) : null}
          <div className={`upload-state ${error ? 'upload-state-err' : ''}`} role={error ? 'alert' : undefined}>
            {error || (busy ? 'Processing image…' : 'JPG / PNG / WebP · up to 2 MB')}
          </div>
        </div>
      </div>
    </div>
  )
}
