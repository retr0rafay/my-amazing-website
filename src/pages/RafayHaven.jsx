import { useMemo, useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import SEO from '../components/SEO/SEO'
import { auth, provider } from '../lib/firebase'
import './RafayHaven.css'

function parseAllowlist(value) {
  return (value || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export default function RafayHaven() {
  const [user, setUser] = useState(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [savingLabel, setSavingLabel] = useState('')
  const ownerEmails = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_EMAILS), [])
  const ownerUids = useMemo(() => parseAllowlist(import.meta.env.VITE_OWNER_UIDS), [])

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser || null)
    })
    return () => unsub()
  }, [])

  const isOwner = !!user && (
    (user.email && ownerEmails.includes(user.email.toLowerCase())) ||
    (user.uid && ownerUids.includes(user.uid.toLowerCase()))
  )

  async function handleSignIn() {
    await signInWithPopup(auth, provider)
  }

  async function compressImageIfNeeded(inputFile) {
    if (!inputFile.type.startsWith('image/')) return inputFile
    const targetMime = 'image/webp'
    const maxSide = 1600
    const quality = 0.82

    const bitmap = await createImageBitmap(inputFile)
    const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * ratio))
    const height = Math.max(1, Math.round(bitmap.height * ratio))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bitmap, 0, 0, width, height)

    const compressed = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Image compression failed'))
        resolve(blob)
      }, targetMime, quality)
    })

    if (compressed.size >= inputFile.size) {
      setSavingLabel('Image already optimized.')
      return inputFile
    }

    const pct = Math.round(((inputFile.size - compressed.size) / inputFile.size) * 100)
    setSavingLabel(`Compressed image by ${pct}% before upload.`)
    return new File([compressed], inputFile.name.replace(/\.[^.]+$/, '.webp'), { type: targetMime })
  }

  function onFileChange(nextFile) {
    setFile(nextFile)
    setSavingLabel('')
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : '')
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!user || !isOwner || !file || isSubmitting) return

    try {
      setIsSubmitting(true)
      setStatus('Preparing upload...')
      const token = await user.getIdToken()
      const uploadFile = await compressImageIfNeeded(file)
      const mediaType = uploadFile.type.startsWith('image/')
        ? 'image'
        : uploadFile.type.startsWith('video/')
          ? 'video'
          : 'other'

      const signedRes = await fetch('/api/haven/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: uploadFile.name,
          contentType: uploadFile.type || 'application/octet-stream',
          mediaType,
        }),
      })
      if (!signedRes.ok) throw new Error('Could not get upload URL')
      const { uploadUrl, objectPath } = await signedRes.json()

      setStatus('Uploading file...')
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadFile.type || 'application/octet-stream' },
        body: uploadFile,
      })
      if (!uploadRes.ok) throw new Error('Upload failed')

      setStatus('Publishing post...')
      const createRes = await fetch('/api/haven/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          caption,
          objectPath,
          mediaType,
          contentType: uploadFile.type || 'application/octet-stream',
          sizeBytes: uploadFile.size,
        }),
      })
      if (!createRes.ok) throw new Error('Could not create post')

      setCaption('')
      setFile(null)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setPreviewUrl('')
      setStatus('Post published.')
    } catch {
      setStatus('Upload failed. Check auth/env/bucket permissions.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="haven page">
      <SEO title="Rafay Haven" description="Private upload area for Rafay." path="/rafay-haven" />
      <div className="haven__inner">
        <h1 className="haven__title">Rafay Haven</h1>
        {!user && (
          <button className="haven__btn" type="button" onClick={handleSignIn}>
            Sign in with Google
          </button>
        )}
        {user && !isOwner && (
          <>
            <p className="haven__state">Signed in as {user.email || user.uid}, but not allowlisted.</p>
            <button className="haven__btn" type="button" onClick={() => signOut(auth)}>Sign out</button>
          </>
        )}
        {user && isOwner && (
          <form className="haven__form" onSubmit={handleUpload}>
            <p className="haven__state">Signed in as {user.email || user.uid}</p>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              required
            />
            {previewUrl && file?.type.startsWith('image/') && (
              <img className="haven__preview" src={previewUrl} alt="Upload preview" />
            )}
            {previewUrl && file?.type.startsWith('video/') && (
              <video className="haven__preview" src={previewUrl} controls preload="metadata" />
            )}
            {savingLabel && <p className="haven__hint">{savingLabel}</p>}
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
              placeholder="Write a caption..."
            />
            <div className="haven__actions">
              <button className="haven__btn" type="submit" disabled={!file || isSubmitting}>
                {isSubmitting ? 'Uploading...' : 'Upload & Publish'}
              </button>
              <button className="haven__btn haven__btn--ghost" type="button" onClick={() => signOut(auth)}>Sign out</button>
            </div>
            {status && <p className="haven__state">{status}</p>}
          </form>
        )}
      </div>
    </main>
  )
}
