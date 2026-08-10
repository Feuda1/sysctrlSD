import type { TicketAttachment } from '@/types/ticket'

/**
 * Pure helpers of the ticket page: formatting, classification and small parsers.
 * They were living inside TicketDetailsPage.tsx, where they made a 4900-line file
 * hard to navigate — and they are exactly the kind of code worth testing on its own.
 */

/** One entry in the media viewer. `preloadedDataUrl` is set for inline images
 * (already loaded in the message body) so they open without a refetch. */
export type ViewerItem = {
  articleId: number
  id: number
  filename: string
  mimeType: string
  size: number
  preloadedDataUrl?: string
}

export type ComposerAttachment = {
  id: string
  filename: string
  mimeType: string
  size: number
  dataUrl: string
  file: File
}

export type ArticleAttachment = TicketAttachment & {
  articleId: number
  articleDate: string
  isPrivate: boolean
}

export const ARTICLE_TYPE_OPTIONS = [
  { id: 'email', name: 'E-mail' },
  { id: 'phone', name: 'Телефонный звонок' },
  { id: 'fax', name: 'Telegram-bot' },
  { id: 'telegram personal-message', name: 'Telegram' },
  { id: 'note', name: 'Заметка' }
]

export function cleanBody(html: string): string {
  if (!html) return ''
  let cleaned = html
  const denvicSigPatterns = [
    /сайт\s+["']Денвик["']/i,
    /Техподдержка\s*-\s*88002002774/i,
    /Чат-бот\s+TELEGRAM\s+DenvicSupportBot/i
  ]
  for (const pattern of denvicSigPatterns) {
    const match = cleaned.match(pattern)
    if (match && match.index !== undefined) {
      cleaned = cleaned.substring(0, match.index).trim()
      break
    }
  }

  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(cleaned, 'text/html')
    const allElements = doc.getElementsByTagName('*')
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i] as HTMLElement
      if (el.style) {
        el.style.color = ''
        el.style.backgroundColor = ''
        el.style.background = ''
        el.style.fontFamily = ''
      }
      el.removeAttribute('bgcolor')
      el.removeAttribute('background')
      el.removeAttribute('text')
      if (el.tagName.toLowerCase() === 'font') {
        el.removeAttribute('color')
        el.removeAttribute('face')
        el.removeAttribute('size')
      }
    }
    cleaned = doc.body.innerHTML
  } catch (err) {
    console.error('Ошибка очистки стилей HTML:', err)
  }

  return cleaned
}

export function isAutoReplyArticle(body: string, creatorName: string): boolean {
  const text = body.toLowerCase()
  const cName = creatorName.toLowerCase()
  return text.includes('получена и поставлена в очередь') ||
         text.includes('поставлена в очередь обработки') ||
         text.includes('оценка качества') ||
         cName.includes('автоответ') ||
         cName.includes('система') ||
         cName.includes('оценка качества')
}

export function isTechnicalAttachment(attachment: Pick<TicketAttachment, 'filename' | 'mimeType'>): boolean {
  const name = attachment.filename.trim().toLowerCase()
  return name === 'message.html' || name === 'message.htm'
}

export function getVisibleAttachments(attachments?: TicketAttachment[]): TicketAttachment[] {
  return (attachments ?? []).filter(att => !isTechnicalAttachment(att))
}

export function formatAttachmentSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return ''
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} КБ`
  return `${(size / 1024 / 1024).toFixed(1)} МБ`
}

export function getAttachmentKind(
  attachment: Pick<TicketAttachment, 'filename' | 'mimeType'>,
  contentType = attachment.mimeType
) {
  const name = attachment.filename.toLowerCase()
  const type = contentType.toLowerCase()
  if (type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) return 'image'
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (type.startsWith('text/') || /\.(txt|log|csv|json|xml|html|md|ini|conf)$/i.test(name)) return 'text'
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'archive'
  if (type.startsWith('audio/')) return 'audio'
  if (type.startsWith('video/')) return 'video'
  return 'file'
}

export function officeKind(filename: string): 'word' | 'excel' | 'powerpoint' | null {
  const n = filename.toLowerCase()
  if (/\.(docx?|rtf|odt)$/.test(n)) return 'word'
  if (/\.(xlsx?|csv|ods)$/.test(n)) return 'excel'
  if (/\.(pptx?|odp)$/.test(n)) return 'powerpoint'
  return null
}

export function dataUrlToText(dataUrl: string): string {
  const comma = dataUrl.indexOf(',')
  if (comma === -1) return ''
  const meta = dataUrl.slice(0, comma)
  const payload = dataUrl.slice(comma + 1)
  try {
    if (meta.includes(';base64')) {
      return decodeURIComponent(escape(window.atob(payload)))
    }
    return decodeURIComponent(payload)
  } catch {
    try { return window.atob(payload) } catch { return '' }
  }
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

const PLAYER_SETTINGS_KEY = 'calls.player.settings'

export function readPlayerSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PLAYER_SETTINGS_KEY) || '{}')
    return {
      speed: typeof parsed.speed === 'number' ? parsed.speed : 1,
      volume: typeof parsed.volume === 'number' ? parsed.volume : 0.85
    }
  } catch {
    return { speed: 1, volume: 0.85 }
  }
}

export function writePlayerSettings(s: { speed: number; volume: number }) {
  window.localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(s))
}

/** Reads the "Клиент / Объект / Заявитель" block clients puts in the first article. */
export function parseFirstArticle(bodyHtml: string): {
  client?: string
  object?: string
  address?: string
  applicant?: string
} {
  const temp = document.createElement('div')
  temp.innerHTML = bodyHtml
  const text = temp.innerText || temp.textContent || ''

  const clientMatch = text.match(/Клиент:\s*([^\r\n]+)/i)
  const objectMatch = text.match(/Объект:\s*([^\r\n]+)/i)
  const applicantMatch = text.match(/(?:Заявитель|Заявители):\s*([^\r\n]+)/i)

  let address = ''
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const objectLineIndex = lines.findIndex(l => l.startsWith('Объект:'))
  if (objectLineIndex !== -1 && lines[objectLineIndex + 1]) {
    const nextLine = lines[objectLineIndex + 1]
    if (!nextLine.startsWith('Заявител') && !nextLine.startsWith('Описание:')) {
      address = nextLine
    }
  }

  return {
    client: clientMatch?.[1]?.trim(),
    object: objectMatch?.[1]?.trim(),
    address: address.trim(),
    applicant: applicantMatch?.[1]?.trim()
  }
}

export function toHtmlComment(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  if (!escaped.trim()) return ''
  // Zammad strips the style attribute when it sanitizes an article, so white-space
  // alone lost every line break and the comment arrived as a single line — the
  // breaks have to be real <br> elements.
  return `<div>${escaped.replace(/\r\n|\r|\n/g, '<br>')}</div>`
}

export function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function tomorrowAtEleven(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(11, 0, 0, 0)
  return toDateTimeLocalValue(date)
}

export function dateTimeLocalFromRaw(raw?: string | null): string {
  if (!raw) return ''
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? '' : toDateTimeLocalValue(date)
}

export function getAutoArticleType(channel?: string | null): string {
  const c = String(channel || '').toLowerCase()
  if (c.includes('mail') || c.includes('email')) return 'note'
  if (c.includes('phone') || c.includes('call') || c.includes('telephon')) return 'phone'
  if (c.includes('telegram') || c.includes('fax') || c.includes('bot')) return 'fax'
  return 'note'
}

export function getArticleTypeLabel(type: string): string {
  if (type === 'email') return 'E-mail'
  if (type === 'phone') return 'Телефонный звонок'
  if (type === 'telegram personal-message') return 'Telegram'
  if (type === 'fax') return 'Telegram-bot'
  return 'Заметка'
}

export function isReasonRequiredState(stateName?: string | null): boolean {
  const normalized = String(stateName || '').toLowerCase().replace(/ё/g, 'е').trim()
  return normalized.includes('закрыт') || normalized.includes('ожидании закрытия') || normalized.includes('ожидание закрытия')
}

export function isPendingOrClosedState(stateName?: string | null): boolean {
  const normalized = String(stateName || '').toLowerCase().replace(/ё/g, 'е').trim()
  return normalized.includes('ожидан') || normalized.includes('закрыт')
}

export function getPriorityOrder(priority: { id: number; name: string }): number {
  const normalized = priority.name.toLowerCase()
  if (normalized.includes('низ') || normalized.includes('low') || priority.id === 1) return 1
  if (normalized.includes('обыч') || normalized.includes('норм') || normalized.includes('normal') || priority.id === 2) return 2
  if (normalized.includes('выс') || normalized.includes('high') || priority.id === 3) return 3
  return priority.id || 99
}

export function historyActorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function historyActorColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (name.charCodeAt(i) + ((h << 5) - h)) | 0
  const palette = [
    'bg-blue-500/20 text-blue-300',
    'bg-violet-500/20 text-violet-300',
    'bg-emerald-500/20 text-emerald-300',
    'bg-amber-500/20 text-amber-300',
    'bg-rose-500/20 text-rose-300',
    'bg-cyan-500/20 text-cyan-300',
    'bg-orange-500/20 text-orange-300',
    'bg-pink-500/20 text-pink-300',
  ]
  return palette[Math.abs(h) % palette.length]
}

export function historyFormatTime(raw: string): string {
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

export function historyDateLabel(raw: string): string {
  try {
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return ''
    const today = new Date()
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return 'Сегодня'
    if (d.toDateString() === yesterday.toDateString()) return 'Вчера'
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return '' }
}
