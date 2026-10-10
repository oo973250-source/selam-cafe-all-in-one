// Page 9 — "Profile": Cafe Profile & Business Settings, opened from the Manager hub.
// One white-outlined panel with a legend pill on its top edge; six field rows
// (colorful icon tile + label + control). Update PATCHes /api/admin-miniapp/profile
// (⚠️ INTEGRATION POINT, harness-stubbed) and refreshes the header brand block
// app-wide (Page 1 decision #2 wiring). INTERIM behaviors pending integration:
// location pin opens a Google Maps search; logo "Change" downscales the picked
// image to a data URL client-side (real picker/upload endpoints pending).
import React, { useEffect, useRef, useState } from 'react'
import Header from '../components/Header.jsx'
import VScroll from '../components/VScroll.jsx'
import { Spinner } from '../components/ui.jsx'
import { useApp } from '../store.jsx'
import { haptic, openLink } from '../telegram.js'

const DESC_MAX = 200

// 30-min steps 00:00→23:30 — display "08:00 AM", payload "08:00" (24h HH:MM)
const TIMES = []
for (let m = 0; m < 24 * 60; m += 30) {
  const h24 = Math.floor(m / 60)
  const mm = String(m % 60).padStart(2, '0')
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  TIMES.push({ v: `${String(h24).padStart(2, '0')}:${mm}`, l: `${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'}` })
}

// Client-side downscale (max 256px JPEG data URL) — keeps the PATCH payload small
// until a real upload endpoint exists (⚠️ INTEGRATION POINT: logo upload).
function fileToLogo(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      try {
        const k = Math.min(1, 256 / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.max(1, Math.round(img.width * k))
        c.height = Math.max(1, Math.round(img.height * k))
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        URL.revokeObjectURL(url)
        resolve(c.toDataURL('image/jpeg', 0.85))
      } catch (err) {
        URL.revokeObjectURL(url)
        reject(err)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('bad image'))
    }
    img.src = url
  })
}

export default function Profile() {
  const { profile, reloadProfile, saveProfile, toast } = useApp()
  const [form, setForm] = useState(null) // null until seeded from the store profile
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)

  // Refetch on every entry to the page (boot already primed the store).
  useEffect(() => {
    reloadProfile()
  }, [reloadProfile])

  // Seed the form once the profile lands — first non-null wins; user edits are
  // never clobbered by the refetch landing later.
  useEffect(() => {
    if (!profile || form) return
    setForm({
      cafe_name: profile.cafe_name || '',
      phone: profile.phone || '',
      location: profile.location || '',
      logo_url: profile.logo_url || '',
      hours_open: profile.hours_open || '08:00',
      hours_close: profile.hours_close || '22:00',
      description: profile.description || '',
    })
  }, [profile, form])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e && e.target ? e.target.value : e }))

  if (!form) {
    return (
      <div className="page-scroll">
        <Header variant="badge" badge="Profile" badgeIcon="👤" />
        <div className="hr" />
        <Spinner label="Loading profile…" />
      </div>
    )
  }

  async function onPickLogo(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = '' // allow re-picking the same file later
    if (!file) return
    try {
      const dataUrl = await fileToLogo(file)
      setForm((f) => ({ ...f, logo_url: dataUrl }))
      haptic('select')
    } catch {
      toast('Could not read that image — try another file')
    }
  }

  function openMapPicker() {
    haptic('light')
    // INTERIM map "picker": search the typed address on Google Maps.
    openLink(`https://maps.google.com/?q=${encodeURIComponent(form.location.trim() || 'Addis Ababa')}`)
  }

  async function update() {
    if (saving) return
    if (!form.cafe_name.trim()) {
      haptic('error')
      toast('Cafe name is required')
      return
    }
    setSaving(true)
    const ok = await saveProfile({
      cafe_name: form.cafe_name.trim(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      logo_url: form.logo_url,
      hours_open: form.hours_open,
      hours_close: form.hours_close,
      description: form.description.slice(0, DESC_MAX),
    })
    setSaving(false)
    if (ok) {
      haptic('success')
      toast('Profile updated ✓')
    }
  }

  return (
    <div className="page-scroll">
      <Header variant="badge" badge="Profile" badgeIcon="👤" />

      <div className="hr" />

      <VScroll variant="thin">
        <div className="profile-panel">
          <div className="profile-legend">🏪 Cafe Profile Settings</div>

          {/* Cafe Name — drives the header brand block on save */}
          <div className="pf-row">
            <div className="pf-ico pf-ico-red">🏪</div>
            <div className="pf-label">Cafe Name</div>
            <div className="pf-ctl">
              <input
                className="pf-input"
                value={form.cafe_name}
                onChange={set('cafe_name')}
                maxLength={60}
                placeholder="Cafe name"
              />
            </div>
          </div>

          {/* Phone Number */}
          <div className="pf-row">
            <div className="pf-ico pf-ico-green">📞</div>
            <div className="pf-label">Phone Number</div>
            <div className="pf-ctl">
              <input
                className="pf-input"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={set('phone')}
                maxLength={24}
                placeholder="+251 …"
              />
            </div>
          </div>

          {/* Location — purple pin opens the interim maps search */}
          <div className="pf-row">
            <div className="pf-ico pf-ico-red">📍</div>
            <div className="pf-label">Location</div>
            <div className="pf-ctl">
              <input
                className="pf-input"
                value={form.location}
                onChange={set('location')}
                maxLength={120}
                placeholder="City, area"
              />
              <button className="pf-pin" aria-label="Open map picker" onClick={openMapPicker}>
                📍
              </button>
            </div>
          </div>

          {/* Profile Picture — preview + Change (file → downscaled data URL) + Remove */}
          <div className="pf-row">
            <div className="pf-ico pf-ico-blue">🖼️</div>
            <div className="pf-label">Profile Picture</div>
            <div className="pf-ctl pf-wrap">
              {form.logo_url ? (
                <img className="pf-preview" src={form.logo_url} alt="Cafe logo" />
              ) : (
                <div className="pf-preview" aria-hidden="true">
                  ☕
                </div>
              )}
              <button
                className="pf-btn-change"
                onClick={() => {
                  haptic('light')
                  if (fileRef.current) fileRef.current.click()
                }}
              >
                <svg className="pf-bi" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="currentColor" strokeWidth="2.2" />
                  <circle cx="9" cy="10" r="1.8" fill="currentColor" />
                  <path d="M5 18l5-5 3.5 3.5L16 14l4 4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
                </svg>
                Change
              </button>
              <button
                className="pf-btn-remove"
                onClick={() => {
                  haptic('warning')
                  setForm((f) => ({ ...f, logo_url: '' }))
                }}
              >
                <svg className="pf-bi" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M10 7V5h4v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Remove
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
            </div>
          </div>

          {/* Opening Hours — two dropdowns separated by "–" */}
          <div className="pf-row">
            <div className="pf-ico pf-ico-purple">🕒</div>
            <div className="pf-label">Opening Hours</div>
            <div className="pf-ctl pf-times">
              <select className="pf-select" value={form.hours_open} onChange={set('hours_open')} aria-label="Opening time">
                {TIMES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.l}
                  </option>
                ))}
              </select>
              <span className="pf-dash">–</span>
              <select className="pf-select" value={form.hours_close} onChange={set('hours_close')} aria-label="Closing time">
                {TIMES.map((t) => (
                  <option key={t.v} value={t.v}>
                    {t.l}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description — textarea + live N/200 counter */}
          <div className="pf-row pf-row-top">
            <div className="pf-ico pf-ico-yellow">📄</div>
            <div className="pf-label">Description</div>
            <div className="pf-ctl pf-ta">
              <textarea
                className="pf-area"
                value={form.description}
                onChange={set('description')}
                maxLength={DESC_MAX}
                placeholder="Short description shown to customers…"
              />
              <span className="pf-count">
                {form.description.length}/{DESC_MAX}
              </span>
            </div>
          </div>

          <button className="pf-update" onClick={update} disabled={saving}>
            💾 {saving ? 'Saving…' : 'Update'}
          </button>
        </div>
      </VScroll>
    </div>
  )
}
