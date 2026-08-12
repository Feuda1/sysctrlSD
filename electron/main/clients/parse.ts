/**
 * Pure parsing of clients.denvic.ru pages. No Electron and no app state here on
 * purpose: this is the code that misreads markup and quietly breaks a feature,
 * so it has to be testable on its own.
 */

export function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

export function attrValue(tag: string, attr: string): string | null {
  const match = tag.match(new RegExp(`\\s${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  const value = match?.[1] ?? match?.[2] ?? match?.[3]
  return value ? decodeHtml(value) : null
}

export function firstMatchText(html: string, regex: RegExp): string | null {
  const match = html.match(regex)
  if (!match) return null
  const text = stripHtml(match[1] ?? '')
  return text || null
}

export function labelValueFromHtml(html: string, label: string): string | null {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return firstMatchText(
    html,
    new RegExp(`<b>\\s*${escapedLabel}\\s*<\\/b>\\s*:\\s*([\\s\\S]*?)<\\/li>`, 'i')
  )
}

export function normalizeChannelLabel(channel: string | null | undefined): string | null {
  if (!channel) return null
  const text = channel.trim()
  if (!text) return null
  const normalized = text.toLowerCase()
  if (normalized === 'fax') return 'Telegram-bot'
  if (normalized.includes('telegram-bot') || normalized.includes('telegram bot')) return 'Telegram-bot'
  return text
}

export function extractSelectedOptions(html: string, selectId: string): string[] {
  const selectMatch = html.match(new RegExp(`<select\\b[^>]*\\bid=["']${selectId}["'][^>]*>([\\s\\S]*?)<\\/select>`, 'i'))
  if (!selectMatch) return []
  const options = Array.from(selectMatch[1].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi))
  return options
    .filter(match => /\bselected\b/i.test(match[1]))
    .map(match => attrValue(match[1], 'value') ?? stripHtml(match[2]))
    .map(value => value.trim())
    .filter(value => value && value !== '-')
}

export interface ClientsScoreControl {
  options: { value: string; label: string }[]
  value: string | null
  canEdit: boolean
  /** True when a score select was found but its options are not score codes. */
  unrecognised: boolean
}

/**
 * Reads the "БАЛЛЫ ЗА ЗАЯВКУ" select off a clients ticket page. The right to
 * award points lives in clients, and it shows in the markup: an agent who may
 * set them gets a normal select (id="ticket_Score"), everyone else gets the same
 * select rendered `disabled`.
 */
export function parseClientsScoreControl(html: string): ClientsScoreControl {
  const empty: ClientsScoreControl = { options: [], value: null, canEdit: false, unrecognised: false }
  if (!html) return empty

  // Case-sensitive and anchored to a <label>: the ticket history table also
  // contains the words "Баллы за заявку", and matching that row picked up
  // whatever select came next — the article type list.
  const labelMatch = /<label\b[^>]*>\s*БАЛЛЫ ЗА ЗАЯВКУ\s*<\/label>/.exec(html)
  if (!labelMatch) return empty

  const selectMatch = html.slice(labelMatch.index).match(/<select\b([^>]*)>([\s\S]*?)<\/select>/i)
  if (!selectMatch) return empty

  const attrs = selectMatch[1]
  const options: { value: string; label: string }[] = []
  let value: string | null = null

  for (const option of selectMatch[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
    const optionValue = option[1].match(/value\s*=\s*"([^"]*)"/i)?.[1]
    if (optionValue === undefined) continue
    const label = stripHtml(option[2]).trim() || optionValue
    options.push({ value: optionValue, label })
    if (/\bselected\b/i.test(option[1])) value = optionValue
  }

  // Points are numeric codes like "00", "00.5", "01.0". Anything else means the
  // select found is not the score one, and showing it would be worse than
  // showing nothing.
  const looksLikeScores = options.length > 0 && options.every(option => /^\d{1,2}(\.\d)?$/.test(option.value))
  if (!looksLikeScores) return { ...empty, unrecognised: true }

  return { options, value, canEdit: !/\bdisabled\b/i.test(attrs), unrecognised: false }
}

/**
 * A mere mention of /Account/Login is not enough — the profile page links to
 * account actions too. Only a real login form counts.
 */
export function isClientsLoginPage(html: string): boolean {
  if (!html) return false
  if (/<form[^>]+action="[^"]*\/Account\/Login/i.test(html)) return true
  return /returnUrl=%2f/i.test(html) || (/Account\/Login/i.test(html) && /name="password"/i.test(html))
}

/** The caption field only exists on the create form itself. */
export const CLIENTS_CREATE_FORM_RE = /\b(?:id|name)="newCaption"/i

export function isClientsCreateForm(html: string): boolean {
  return CLIENTS_CREATE_FORM_RE.test(html)
}

export function clientsFormErrorMessage(html: string): string | null {
  if (!html) return null
  const patterns = [
    /<div[^>]*class="[^"]*validation-summary-errors[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*alert-danger[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="text-danger"[^>]*>([\s\S]*?)<\/span>/i
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    const text = match ? stripHtml(match[1]) : ''
    if (text) return text
  }
  return null
}

export function parseTicketIdValue(value: unknown): number | null {
  const id = parseInt(String(value ?? '').trim(), 10)
  return Number.isFinite(id) && id > 0 ? id : null
}

export const TICKET_DETAILS_URL_RE = /\/Tickets\/(?:Details|Edit)\/(\d+)/i

export function ticketIdFromUrl(value: unknown): number | null {
  const match = String(value ?? '').match(TICKET_DETAILS_URL_RE)
  return match ? parseTicketIdValue(match[1]) : null
}

/**
 * Даты clients отдаёт как «13.08.2026\r15:00:00» — с переводом строки посреди
 * значения. Приводим к обычному ISO, чтобы дальше по приложению они выглядели
 * так же, как даты из Zammad.
 */
export function parseClientsDateTime(value: unknown): string | null {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  const match = text.match(/(\d{2})\.(\d{2})\.(\d{4})[^\d]+(\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  const [, day, month, year, hour, minute, second] = match
  const date = new Date(
    Number(year), Number(month) - 1, Number(day),
    Number(hour), Number(minute), Number(second ?? '0')
  )
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
