/**
 * Dev-only API server. Vite proxies /api to this.
 * Production uses the main server.js which mounts the same router.
 */
import 'dotenv/config'
import express from 'express'
import gamingRouter from './gaming.js'
import havenRouter from './haven.js'

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use('/api', gamingRouter)
app.use('/api', havenRouter)

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => {
  console.log(`[api] Gaming API on http://localhost:${PORT}`)
})
