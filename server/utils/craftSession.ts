import { randomBytes } from 'crypto'

interface CraftSession {
  charId: number
  pillId: string
  expiresAt: number
}

const TTL_MS = 60_000
const sessions = new Map<string, CraftSession>()

function sweep() {
  const now = Date.now()
  for (const [token, s] of sessions) {
    if (s.expiresAt <= now) sessions.delete(token)
  }
}

export function issueCraftToken(charId: number, pillId: string): string {
  if (sessions.size > 5000) sweep()
  const token = randomBytes(16).toString('hex')
  sessions.set(token, { charId, pillId, expiresAt: Date.now() + TTL_MS })
  return token
}

export function consumeCraftToken(token: string, charId: number, pillId: string): boolean {
  const s = sessions.get(token)
  if (!s) return false
  sessions.delete(token)
  if (s.charId !== charId || s.pillId !== pillId) return false
  if (s.expiresAt <= Date.now()) return false
  return true
}
