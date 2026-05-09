import express from 'express'
import crypto from 'crypto'
import { Storage } from '@google-cloud/storage'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { getServiceAccountFromEnv, initFirebaseAdmin, requireOwner } from './authOwner.js'
import { parseRepcountWorkout } from '../shared/repcountParse.js'

const router = express.Router()
const ALLOWED_MEDIA_TYPES = new Set(['image', 'video', 'other'])
const MAX_CAPTION_LENGTH = 500
const MAX_THOUGHT_LENGTH = 280
const MAX_WORKOUT_RAW_CHARS = 32000
const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable'

function getBucketName() {
  const bucket = process.env.GCS_BUCKET_NAME
  if (!bucket) throw new Error('GCS_BUCKET_NAME is not set')
  return bucket
}

function sanitizeFilename(name) {
  return (name || 'upload')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
}

function getStorageClient() {
  const serviceAccount = getServiceAccountFromEnv()
  return new Storage({
    projectId: serviceAccount.project_id,
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
  })
}

/** Same shape as GET /haven/workouts list entries (signed photo URL when applicable). */
async function workoutDocToListItem(doc) {
  const storage = getStorageClient()
  const bucketName = getBucketName()
  const data = doc.data() || {}
  let photoUrl = null
  const pop = data.photoObjectPath
  if (typeof pop === 'string' && pop.startsWith('haven/')) {
    try {
      const [url] = await storage.bucket(bucketName).file(pop).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      })
      photoUrl = url
    } catch {
      photoUrl = null
    }
  }
  return {
    id: doc.id,
    exercises: Array.isArray(data.exercises) ? data.exercises : [],
    workoutDateMs: data.workoutDateMs ?? null,
    createdAtMs: typeof data.sortAt === 'number' ? data.sortAt : 0,
    photoUrl,
  }
}

/** Wait until client PUT is visible and non-empty before patching metadata (avoids races). */
async function waitForGcsObjectReady(fileRef, { tries = 30, delayMs = 200 } = {}) {
  for (let i = 0; i < tries; i++) {
    try {
      const [exists] = await fileRef.exists()
      if (exists) {
        const [meta] = await fileRef.getMetadata()
        const size = Number(meta.size ?? 0)
        if (size > 0) return true
      }
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return false
}

function getBaseUrl(req) {
  const env = process.env.SITE_URL
  if (env) return env.replace(/\/$/, '')
  return `${req.protocol}://${req.get('host')}`
}

router.post('/haven/upload-url', requireOwner, async (req, res) => {
  try {
    const { filename, contentType, mediaType } = req.body || {}
    if (!filename || !contentType || !mediaType) {
      return res.status(400).json({ error: 'filename, contentType and mediaType are required' })
    }
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return res.status(400).json({ error: 'Invalid mediaType' })
    }

    const storage = getStorageClient()
    const bucketName = getBucketName()
    const safe = sanitizeFilename(filename)
    const ext = safe.includes('.') ? safe.split('.').pop() : ''
    const objectPath = `haven/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext ? `.${ext}` : ''}`
    const file = storage.bucket(bucketName).file(objectPath)

    const [uploadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    })
    return res.json({ uploadUrl, objectPath })
  } catch (err) {
    console.error('[haven/upload-url]', err.message)
    return res.status(500).json({
      error: 'Could not create upload URL',
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined,
    })
  }
})

router.post('/haven/posts', requireOwner, async (req, res) => {
  try {
    initFirebaseAdmin()
    const { caption = '', objectPath, mediaType, contentType = null, sizeBytes = null } = req.body || {}
    if (!objectPath || !mediaType) {
      return res.status(400).json({ error: 'objectPath and mediaType are required' })
    }
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return res.status(400).json({ error: 'Invalid mediaType' })
    }
    if (caption.length > MAX_CAPTION_LENGTH) {
      return res.status(400).json({ error: `Caption cannot exceed ${MAX_CAPTION_LENGTH} chars` })
    }

    const storage = getStorageClient()
    const bucketName = getBucketName()
    const file = storage.bucket(bucketName).file(objectPath)
    await file.setMetadata({
      cacheControl: MEDIA_CACHE_CONTROL,
      contentType: contentType || undefined,
      metadata: {
        uploadedBy: req.owner.uid,
      },
    })

    const db = getFirestore()
    const docRef = db.collection('havenPosts').doc()
    await docRef.set({
      caption: caption.trim(),
      objectPath,
      mediaType,
      contentType,
      sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : null,
      createdAt: FieldValue.serverTimestamp(),
      sortAt: Date.now(),
      ownerUid: req.owner.uid,
      ownerEmail: req.owner.email || null,
    })
    return res.status(201).json({ id: docRef.id })
  } catch (err) {
    console.error('[haven/posts:create]', err.message)
    return res.status(500).json({ error: 'Could not create post' })
  }
})

router.post('/haven/workouts', requireOwner, async (req, res) => {
  try {
    initFirebaseAdmin()
    const rawText = String(req.body?.rawText ?? '').trim()
    if (!rawText) return res.status(400).json({ error: 'rawText is required' })
    if (rawText.length > MAX_WORKOUT_RAW_CHARS) {
      return res.status(400).json({ error: `Workout text cannot exceed ${MAX_WORKOUT_RAW_CHARS} characters` })
    }

    const parsed = parseRepcountWorkout(rawText)
    if (!parsed.ok) return res.status(400).json({ error: parsed.error })

    const photoObjectPath =
      typeof req.body?.photoObjectPath === 'string' && req.body.photoObjectPath.trim()
        ? req.body.photoObjectPath.trim()
        : null
    const photoContentType =
      typeof req.body?.photoContentType === 'string' ? req.body.photoContentType.trim() || null : null
    const photoMediaType =
      typeof req.body?.photoMediaType === 'string' ? req.body.photoMediaType.trim() || null : null
    const photoSizeBytes = Number.isFinite(Number(req.body?.photoSizeBytes))
      ? Number(req.body.photoSizeBytes)
      : null

    if (photoObjectPath && !photoObjectPath.startsWith('haven/')) {
      return res.status(400).json({ error: 'Invalid photo path' })
    }
    if (photoObjectPath && photoMediaType !== 'image') {
      return res.status(400).json({ error: 'Workout photo must be an image' })
    }

    const { workoutDateMs, exercises } = parsed.value
    const sortAt = typeof workoutDateMs === 'number' && !Number.isNaN(workoutDateMs) ? workoutDateMs : Date.now()

    if (photoObjectPath) {
      const storage = getStorageClient()
      const bucketName = getBucketName()
      const file = storage.bucket(bucketName).file(photoObjectPath)
      const ready = await waitForGcsObjectReady(file)
      if (!ready) {
        console.error('[haven/workouts:create] photo object missing or empty after upload:', photoObjectPath)
        return res.status(502).json({
          error:
            'Photo did not finish uploading to storage. Check browser network/CORS or try again.',
        })
      }
      await file.setMetadata({
        cacheControl: MEDIA_CACHE_CONTROL,
        contentType: photoContentType || undefined,
        metadata: {
          uploadedBy: req.owner.uid,
        },
      })
    }

    const db = getFirestore()
    const docRef = db.collection('havenWorkouts').doc()
    await docRef.set({
      rawText,
      exercises,
      workoutDateMs: workoutDateMs ?? null,
      photoObjectPath,
      photoContentType,
      photoMediaType: photoMediaType || null,
      photoSizeBytes,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      sortAt,
      ownerUid: req.owner.uid,
      ownerEmail: req.owner.email || null,
    })
    const createdSnap = await docRef.get()
    const item = await workoutDocToListItem(createdSnap)
    return res.status(201).json({ id: docRef.id, item })
  } catch (err) {
    console.error('[haven/workouts:create]', err.message)
    return res.status(500).json({ error: 'Could not save workout' })
  }
})

router.get('/haven/workouts', async (req, res) => {
  try {
    initFirebaseAdmin()
    const db = getFirestore()
    const limit = Math.min(Math.max(Number(req.query.limit || 40), 1), 250)

    const snap = await db.collection('havenWorkouts').orderBy('sortAt', 'desc').limit(limit).get()
    const items = await Promise.all(snap.docs.map((doc) => workoutDocToListItem(doc)))

    res.setHeader('Cache-Control', 'no-store')
    return res.json({ items })
  } catch (err) {
    console.error('[haven/workouts:list]', err.message)
    return res.status(500).json({ error: 'Could not load workouts' })
  }
})

router.delete('/haven/workouts/:id', requireOwner, async (req, res) => {
  try {
    initFirebaseAdmin()
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Workout id is required' })

    const db = getFirestore()
    const docRef = db.collection('havenWorkouts').doc(id)
    const snap = await docRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'Workout not found' })

    const data = snap.data() || {}
    if (data.ownerUid && data.ownerUid !== req.owner.uid) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const pop = data.photoObjectPath
    if (typeof pop === 'string' && pop.startsWith('haven/')) {
      try {
        const storage = getStorageClient()
        const bucketName = getBucketName()
        await storage.bucket(bucketName).file(pop).delete({ ignoreNotFound: true })
      } catch {
        /* ignore storage errors; still delete doc */
      }
    }

    await docRef.delete()
    return res.status(204).send()
  } catch (err) {
    console.error('[haven/workouts:delete]', err.message)
    return res.status(500).json({ error: 'Could not delete workout' })
  }
})

router.post('/haven/thoughts', requireOwner, async (req, res) => {
  try {
    initFirebaseAdmin()
    const text = String(req.body?.text || '').trim()
    if (!text) return res.status(400).json({ error: 'text is required' })
    if (text.length > MAX_THOUGHT_LENGTH) {
      return res.status(400).json({ error: `Text cannot exceed ${MAX_THOUGHT_LENGTH} chars` })
    }

    const db = getFirestore()
    const docRef = db.collection('havenThoughts').doc()
    await docRef.set({
      text,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      sortAt: Date.now(),
      ownerUid: req.owner.uid,
      ownerEmail: req.owner.email || null,
    })
    return res.status(201).json({ id: docRef.id })
  } catch (err) {
    console.error('[haven/thoughts:create]', err.message)
    return res.status(500).json({ error: 'Could not create thought' })
  }
})

router.get('/haven/posts', async (req, res) => {
  try {
    initFirebaseAdmin()
    const db = getFirestore()
    const storage = getStorageClient()
    const bucketName = getBucketName()
    const limit = Math.min(Number(req.query.limit || 30), 100)

    const snap = await db.collection('havenPosts').orderBy('sortAt', 'desc').limit(limit).get()
    const items = await Promise.all(
      snap.docs.map(async (doc) => {
        const data = doc.data()
        const [mediaUrl] = await storage.bucket(bucketName).file(data.objectPath).getSignedUrl({
          version: 'v4',
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        })
        return {
          id: doc.id,
          caption: data.caption || '',
          mediaType: data.mediaType || 'other',
          mediaUrl,
          createdAtMs: data.sortAt || 0,
          contentType: data.contentType || null,
          sizeBytes: data.sizeBytes || null,
        }
      }),
    )

    res.setHeader('Cache-Control', 'public, max-age=120')
    return res.json({ items })
  } catch (err) {
    console.error('[haven/posts:list]', err.message)
    return res.status(500).json({ error: 'Could not load posts' })
  }
})

router.get('/haven/thoughts', async (req, res) => {
  try {
    initFirebaseAdmin()
    const db = getFirestore()
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100)

    const snap = await db.collection('havenThoughts').orderBy('sortAt', 'desc').limit(limit).get()
    const items = snap.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        text: data.text || '',
        createdAtMs: data.sortAt || 0,
      }
    })

    // Thoughts should reflect new posts/deletes immediately for owner UX.
    res.setHeader('Cache-Control', 'no-store')
    return res.json({ items })
  } catch (err) {
    console.error('[haven/thoughts:list]', err.message)
    return res.status(500).json({ error: 'Could not load thoughts' })
  }
})

router.get('/haven/og-image', async (req, res) => {
  try {
    initFirebaseAdmin()
    const db = getFirestore()
    const storage = getStorageClient()
    const bucketName = getBucketName()

    const snap = await db.collection('havenPosts').orderBy('sortAt', 'desc').limit(20).get()
    const post = snap.docs
      .map((doc) => doc.data())
      .find((data) => data?.objectPath && (data.mediaType === 'image' || data.mediaType === 'video'))

    if (!post?.objectPath) {
      const fallbackUrl = `${getBaseUrl(req)}/hero-illustration.png`
      res.setHeader('Cache-Control', 'public, max-age=300')
      return res.redirect(302, fallbackUrl)
    }

    const [signedUrl] = await storage.bucket(bucketName).file(post.objectPath).getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    })
    res.setHeader('Cache-Control', 'public, max-age=300')
    return res.redirect(302, signedUrl)
  } catch (err) {
    console.error('[haven/og-image]', err.message)
    const fallbackUrl = `${getBaseUrl(req)}/hero-illustration.png`
    return res.redirect(302, fallbackUrl)
  }
})

router.delete('/haven/posts/:id', requireOwner, async (req, res) => {
  try {
    initFirebaseAdmin()
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Post id is required' })

    const db = getFirestore()
    const docRef = db.collection('havenPosts').doc(id)
    const snap = await docRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'Post not found' })

    const data = snap.data() || {}
    if (data.ownerUid && data.ownerUid !== req.owner.uid) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (data.objectPath) {
      const storage = getStorageClient()
      const bucketName = getBucketName()
      await storage.bucket(bucketName).file(data.objectPath).delete({ ignoreNotFound: true })
    }

    await docRef.delete()
    return res.status(204).send()
  } catch (err) {
    console.error('[haven/posts:delete]', err.message)
    return res.status(500).json({ error: 'Could not delete post' })
  }
})

router.delete('/haven/thoughts/:id', requireOwner, async (req, res) => {
  try {
    initFirebaseAdmin()
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Thought id is required' })

    const db = getFirestore()
    const docRef = db.collection('havenThoughts').doc(id)
    const snap = await docRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'Thought not found' })

    const data = snap.data() || {}
    if (data.ownerUid && data.ownerUid !== req.owner.uid) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    await docRef.delete()
    return res.status(204).send()
  } catch (err) {
    console.error('[haven/thoughts:delete]', err.message)
    return res.status(500).json({ error: 'Could not delete thought' })
  }
})

export default router
