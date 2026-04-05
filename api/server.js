/**
 * Dev-only API server. Vite proxies /api to this.
 * Production uses the main server.js which mounts the same router.
 */
import 'dotenv/config'
import express from 'express'
import googleHomeBridgeRouter from './googleHomeBridge.js'
import havenRouter from './haven.js'
import a2aRouter from './a2a.js'
import ownerChatRouter from './ownerChat.js'
import ownerTtsRouter from './ownerTts.js'
import { setupTeslaChargeNotifications } from './teslaChargeNotify.js'

const app = express()
app.use(express.json({ limit: '2mb' }))
app.use('/api', googleHomeBridgeRouter)
app.use('/api', havenRouter)
app.use('/api', a2aRouter)
app.use('/api', ownerChatRouter)
app.use('/api', ownerTtsRouter)
setupTeslaChargeNotifications(app)

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => {
  console.log(`[api] listening on http://localhost:${PORT}`)
})
