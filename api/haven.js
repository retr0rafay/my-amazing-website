import express from 'express'
import crypto from 'crypto'
import { Storage } from '@google-cloud/storage'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const router = express.Router()
const ALLOWED_MEDIA_TYPES = new Set(['image', 'video', 'other'])
const MAX_CAPTION_LENGTH = 500
const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable'

function getServiceAccountFromEnv() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set')
  const parsed = JSON.parse(raw)
  if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing client_email/private_key/project_id')
  }
  return parsed
}

function initFirebaseAdmin() {
  if (getApps().length > 0) return
  const serviceAccount = getServiceAccountFromEnv()
  initializeApp({ credential: cert(serviceAccount) })
}

function parseAllowlist(value) {
  return new Set(
    (value || '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  )
}

function requireAllowlistedOwner(decodedToken) {
  const emails = parseAllowlist(process.env.OWNER_EMAILS)
  const uids = parseAllowlist(process.env.OWNER_UIDS)
  const email = (decodedToken.email || '').toLowerCase()
  const uid = (decodedToken.uid || '').toLowerCase()

  if (emails.size === 0 && uids.size === 0) {
    throw new Error('OWNER_EMAILS or OWNER_UIDS must be configured')
  }
  if ((emails.size > 0 && emails.has(email)) || (uids.size > 0 && uids.has(uid))) return
  throw new Error('Forbidden')
}

async function requireOwner(req, res, next) {
  try {
    initFirebaseAdmin()
    const authHeader = req.headers.authorization || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return res.status(401).json({ error: 'Missing auth token' })
    const decoded = await getAuth().verifyIdToken(token)
    requireAllowlistedOwner(decoded)
    req.owner = decoded
    return next()
  } catch (err) {
    const msg = err.message || 'Unauthorized'
    const status = msg === 'Forbidden' ? 403 : 401
    return res.status(status).json({ error: msg })
  }
}

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

export default router
