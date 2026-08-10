/**
 * Unsent comment text, kept per ticket. A half-written answer used to disappear
 * with the app; now it is waiting when the ticket is opened again.
 *
 * Only the text is stored — attachments are files the browser cannot re-open on
 * its own, and pretending otherwise would be worse than saying nothing.
 */

const PREFIX = 'ticket.draft.'
const MAX_AGE = 30 * 24 * 60 * 60 * 1000

interface StoredDraft {
  body: string
  at: number
}

function key(ticketId: number): string {
  return `${PREFIX}${ticketId}`
}

export function readCommentDraft(ticketId: number): string {
  try {
    const raw = window.localStorage.getItem(key(ticketId))
    if (!raw) return ''
    const parsed = JSON.parse(raw) as StoredDraft
    if (typeof parsed?.body !== 'string') return ''
    if (Number.isFinite(parsed.at) && Date.now() - parsed.at > MAX_AGE) {
      window.localStorage.removeItem(key(ticketId))
      return ''
    }
    return parsed.body
  } catch {
    return ''
  }
}

export function writeCommentDraft(ticketId: number, body: string): void {
  try {
    if (!body.trim()) {
      window.localStorage.removeItem(key(ticketId))
      return
    }
    window.localStorage.setItem(key(ticketId), JSON.stringify({ body, at: Date.now() } satisfies StoredDraft))
  } catch {
    // A full storage must not break typing.
  }
}

export function clearCommentDraft(ticketId: number): void {
  try {
    window.localStorage.removeItem(key(ticketId))
  } catch {
    // Nothing to do — the draft simply stays until it ages out.
  }
}
