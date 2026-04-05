/**
 * Append-only monthly aggregates for Anthropic + ElevenLabs (local JSON under data/).
 * Ephemeral on hosts without a persistent disk (e.g. Railway) unless you attach a volume.
 */
import fs from 'fs'
import path from 'path'

const LEDGER_PATH = path.join(process.cwd(), 'data', 'usage-ledger.json')

function readLedger() {
  try {
    if (!fs.existsSync(LEDGER_PATH)) return { version: 1, months: {} }
    const raw = fs.readFileSync(LEDGER_PATH, 'utf8')
    const j = JSON.parse(raw)
    if (!j.months) j.months = {}
    return j
  } catch {
    return { version: 1, months: {} }
  }
}

function writeLedger(data) {
  fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true })
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(data, null, 2))
}

export function currentMonthKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * @param {{ input_tokens?: number, output_tokens?: number }} usage
 */
export function recordAnthropicUsage(usage) {
  if (!usage) return
  const input = Number(usage.input_tokens) || 0
  const output = Number(usage.output_tokens) || 0
  if (!input && !output) return
  const ledger = readLedger()
  const m = currentMonthKey()
  if (!ledger.months[m]) ledger.months[m] = {}
  if (!ledger.months[m].anthropic) {
    ledger.months[m].anthropic = { input_tokens: 0, output_tokens: 0 }
  }
  ledger.months[m].anthropic.input_tokens += input
  ledger.months[m].anthropic.output_tokens += output
  ledger.months[m].updated_at = new Date().toISOString()
  writeLedger(ledger)
}

/**
 * @param {number} characters — billed characters (input text length)
 */
export function recordElevenLabsCharacters(characters) {
  const n = Math.max(0, Math.floor(Number(characters) || 0))
  if (!n) return
  const ledger = readLedger()
  const m = currentMonthKey()
  if (!ledger.months[m]) ledger.months[m] = {}
  if (!ledger.months[m].elevenlabs) {
    ledger.months[m].elevenlabs = { characters: 0 }
  }
  ledger.months[m].elevenlabs.characters += n
  ledger.months[m].updated_at = new Date().toISOString()
  writeLedger(ledger)
}

export function getLedgerMonth(monthKey = currentMonthKey()) {
  const ledger = readLedger()
  return ledger.months[monthKey] || null
}

export function getFullLedger() {
  return readLedger()
}
