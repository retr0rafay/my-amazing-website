/**
 * Rough markdown → plain text for TTS (avoid reading asterisks and backticks aloud).
 */
export function stripMarkdownForSpeech(s) {
  let t = String(s || '')
  t = t.replace(/\r\n/g, '\n')
  t = t.replace(/```[\s\S]*?```/g, '\n')
  t = t.replace(/`([^`]+)`/g, '$1')
  t = t.replace(/\*\*(.+?)\*\*/g, '$1')
  t = t.replace(/\*(.+?)\*/g, '$1')
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  t = t.replace(/^#{1,6}\s+/gm, '')
  t = t.replace(/^\s*[-*+]\s+/gm, '')
  t = t.replace(/^\s*\d+\.\s+/gm, '')
  t = t.replace(/\n{3,}/g, '\n\n')
  t = t
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
  t = t.replace(/\s+/g, ' ')
  return t.trim()
}
