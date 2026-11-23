import { DatabaseSync } from 'node:sqlite'

const sessionLimit = 12
const appLimit = 24

// Each row reserves one observation and its single referee call. Keeping the receipt
// across restarts also counts timeouts and a process exit after the provider was called.
export function openObservationQuota(path: string) {
  const ledger = new DatabaseSync(path)
  ledger.exec('PRAGMA busy_timeout = 2000; CREATE TABLE IF NOT EXISTS reservations (day TEXT NOT NULL, session TEXT NOT NULL)')
  const clear = ledger.prepare('DELETE FROM reservations WHERE day != ?')
  const count = ledger.prepare('SELECT COUNT(*) AS total, COUNT(CASE WHEN session = ? THEN 1 END) AS personal FROM reservations WHERE day = ?')
  const insert = ledger.prepare('INSERT INTO reservations(day, session) VALUES (?, ?)')
  return {
    close: () => ledger.close(),
    claim(sessionId: string, at: number) {
      const day = new Date(at).toISOString().slice(0, 10)
      ledger.exec('BEGIN IMMEDIATE')
      try {
        clear.run(day)
        const { total, personal } = count.get(sessionId, day)!
        const allowed = Number(total) < appLimit && Number(personal) < sessionLimit
        if (allowed) insert.run(day, sessionId)
        ledger.exec('COMMIT')
        return allowed
      } catch (error) {
        ledger.exec('ROLLBACK')
        throw error
      }
    },
  }
}
