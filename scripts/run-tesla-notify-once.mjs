/**
 * One-shot: send Tesla charge summary to Pushover (loads .env from project root).
 * Usage: node scripts/run-tesla-notify-once.mjs
 */
import 'dotenv/config'
import { runTeslaChargeNotifyJob } from '../api/teslaChargeNotify.js'

runTeslaChargeNotifyJob()
  .then(() => {
    console.log('Done.')
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
