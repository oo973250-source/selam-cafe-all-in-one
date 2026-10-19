import React, { useCallback, useEffect, useRef, useState } from 'react'

/**
 * ImageCropper — Telegram/TikTok-style profile picture cropper
 * ------------------------------------------------------------
 * Pure-React, zero-dependency (HTML5 Canvas + Pointer Events + CSS).
 *
 * UX
 *   • Stage shows the uploaded image COVERED to the crop box; the user
 *     pans with one finger/mouse-drag and zooms with two-finger pinch,
 *     mouse wheel, or the range slider.
 *   • The crop mask is a CIRCLE (default) or 1:1 SQUARE; everything
 *     outside the mask is dimmed by a huge box-shadow "spotlight".
 *   • The image can never leave a gap: pan/zoom are clamped so the
 *     container stays covered at all times.
 *
 * EXPORT
 *   • onConfirm(dataUrl) receives the masked area re-rendered offscreen
 *     at `exportSize` (default 512px) — square canvas, JPEG 0.9 by
 *     default (PNG available via `format="png"`).
 *
 * PROPS
 *   src         string  — object URL / data URL of the picked image
 *   shape       'circle' | 'square'      (default 'circle')
 *   exportSize  number — output edge length in px (default 512)
 *   format      'jpeg' | 'png'           (default 'jpeg')
 *   quality     number — JPEG quality 0..1              (default 0.9)
 *   confirmLabel / cancelLabel — button texts
 *   onConfirm(dataUrl) — fired with the cropped output
 *   onCancel()         — dismissed without cropping
 */

// ── Pure helpers (unit-testable; the component is just wiring) ──────────

/** Smallest scale so the image fully covers a box of boxW×boxH. */
export function computeCoverScale(imgW, imgH, boxW, boxH) {
  if (!imgW || !imgH || !boxW || !boxH) return 1
  return Math.max(boxW / imgW, boxH / imgH)
}

/** Largest absolute |x|/|y| the image center may drift from the box center
    while still covering a boxW×boxH box at display size dispW×dispH. */
export function maxOffset(dispW, dispH, boxW, boxH) {
  return {
    x: Math.max(0, (dispW - boxW) / 2),
    y: Math.max(0, (dispH - boxH) / 2),
  }
}

export function clampOffset(offset, dispW, dispH, boxW, boxH) {
  const m = maxOffset(dispW, dispH, boxW, boxH)
  return {
    x: Math.min(m.x, Math.max(-m.x, offset.x)),
    y: Math.min(m.y, Math.max(-m.y, offset.y)),
  }
}

/** Zoom applied around a fixed "anchor" point (usually viewport center):
    keeps the image pixel under the anchor stationary while scaling. */
export function applyZoom(prevZoom, nextZoom, anchor, offset) {
  const k = Math.max(1e-6, nextZoom / Math.max(1e-6, prevZoom))
  return {
    x: anchor.x - (anchor.x - offset.x) * k,
    y: anchor.y - (anchor.y - offset.y) * k,
  }
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

export default function ImageCropper({
  src,
  shape = 'circle',
  exportSize = 512,
  format = 'jpeg',
  quality = 0.9,
  confirmLabel = 'Crop & Save',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  onError,
}) {
  const stageRef = useRef(null)
  const imgRef = useRef(null)

  // Natural image size (via useCallback load effect below)
  const [imgDims, setImgDims] = useState({ w: 0, h: 0 })

  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  // Live box size (responsive): measured from the stage element.
  const [box, setBox] = useState({ w: 0, h: 0 })

  // Pointer tracking (pinch + pan in one unified model)
  const pointers = useRef(new Map())
  const pinchRef = useRef(null) // { dist, center } while 2 pointers down

  useEffect(() => {
    if (!src) return
    const img = new Image()
    img.onload = () => {
      setImgDims({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
    }
    img.onerror = () => onError?.(new Error('not a valid image file'))
    img.src = src
    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src, onError])

  // Measure the responsive stage.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () =>
      setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const coverScale = computeCoverScale(imgDims.w, imgDims.h, box.w, box.h)
  const dispW = imgDims.w * coverScale * zoom
  const dispH = imgDims.h * coverScale * zoom

  const pushOffset = useCallback(
    (next) => {
      setOffset(clampOffset(next, dispW, dispH, box.w, box.h))
    },
    [dispW, dispH, box.w, box.h]
  )

  // ── Wheel zoom (desktop) ────────────────────────────────────────────
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const from = zoom
      const to = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
      if (to === from) return
      const rect = el.getBoundingClientRect()
      const anchor = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      setZoom(to)
      setOffset((o) => clampOffset(applyZoom(from, to, anchor, o), dispW, dispH, box.w, box.h))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, dispW, dispH, box.w, box.h])

  // ── Pointer pan + pinch (mobile-ready, mouse too) ───────────────────
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinchRef.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return
    const prev = pointers.current.get(e.pointerId)
    const cur = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, cur)

    if (pointers.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const from = pinchRef.current.zoom
      const to = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, from * (dist / Math.max(1, pinchRef.current.dist))))
      if (Math.abs(to - from) > 0.001) {
        pinchRef.current.zoom = to
        setZoom(to)
        setOffset((o) => clampOffset(applyZoom(from, to, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, o),
          dispW, dispH, box.w, box.h))
      }
      return
    }

    // Single-pointer pan
    const dx = cur.x - prev.x
    const dy = cur.y - prev.y
    setOffset((o) => clampOffset({ x: o.x + dx, y: o.y + dy }, dispW, dispH, box.w, box.h))
  }

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinchRef.current = null
    if (pointers.current.size === 0) e.currentTarget?.releasePointerCapture?.(e.pointerId)
  }

  // Zoom slider (keyboard/a11y + a precise on-screen control)
  const onSlider = (e) => {
    const from = zoom
    const to = Number(e.target.value)
    setZoom(to)
    const rect = stageRef.current?.getBoundingClientRect()
    const anchor = rect
      ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
      : { x: 0, y: 0 }
    setOffset((o) => clampOffset(applyZoom(from, to, anchor, o), dispW, dispH, box.w, box.h))
  }

  // ── Export: masked area → offscreen canvas → compressed data URL ────
  const handleConfirm = () => {
    const img = imgRef.current
    if (!img || !box.w) return
    const canvas = document.createElement('canvas')
    canvas.width = exportSize
    canvas.height = exportSize
    const ctx = canvas.getContext('2d')
    if (!ctx) return onError?.(new Error('canvas unavailable'))
    // Map CSS px → export px.
    const k = exportSize / Math.min(box.w, box.h)
    const drawW = dispW * k
    const drawH = dispH * k
    const dx = exportSize / 2 + offset.x * k - drawW / 2
    const dy = exportSize / 2 + offset.y * k - drawH / 2
    if (shape === 'circle') {
      ctx.save()
      ctx.beginPath()
      ctx.arc(exportSize / 2, exportSize / 2, exportSize / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, dx, dy, drawW, drawH)
      ctx.restore()
    } else {
      ctx.drawImage(img, dx, dy, drawW, drawH)
    }
    onConfirm(
      format === 'png'
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality)
    )
  }

  const circular = shape === 'circle'

  return (
    <div className="cropper-overlay" role="dialog" aria-modal="true" aria-label="Crop profile picture">
      <div className="cropper-modal">
        <h3 className="cropper-title">Crop your picture</h3>

        <div
          ref={stageRef}
          className={`cropper-stage ${circular ? 'is-circle' : 'is-square'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: dispW ? `${dispW}px` : '100%',
              height: dispH ? `${dispH}px` : '100%',
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
              transformOrigin: 'center',
              userSelect: 'none',
              pointerEvents: 'none',
              // The mask "spotlight": darkened outside the crop area.
              filter: 'none',
            }}
          />
          {/* Mask on TOP of the image: transparent center circle/square,
              giant shadow dims everything outside. Non-interactive. */}
          <div
            aria-hidden
            className={`cropper-mask ${circular ? 'is-circle' : 'is-square'}`}
          />
        </div>

        <label className="cropper-zoom-row">
          <span aria-hidden>🔍</span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={onSlider}
          />
        </label>

        <div className="cropper-actions">
          <button type="button" className="pcancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="pcrop" onClick={handleConfirm} disabled={!imgDims.w}>
            {confirmLabel}
          </button>
        </div>
        <p className="cropper-hint">Drag to reposition · pinch or scroll to zoom</p>
      </div>
    </div>
  )
}
