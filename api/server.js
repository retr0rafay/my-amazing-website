/**
 * Dev-only API server. Vite proxies /api to this.
 * Production uses the main server.js which mounts the same router.
 */
import 'dotenv/config'
import express from 'express'
import gamingRouter from './gaming.js'

const app = express()
app.use('/api', gamingRouter)

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => {
  console.log(`[api] Gaming API on http://localhost:${PORT}`)
})
