/**
 * Building blocks of Zammad search queries. Pure and Electron-free, so the
 * boundary arithmetic can be checked without launching the app.
 */

export type TicketDateField = 'created' | 'closed'

export function zammadSearchValue(value: string): string {
  const raw = String(value)
  return /^[a-z0-9_.:-]+$/i.test(raw) ? raw : `"${raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/** Local day boundaries: the user picks days in their own timezone, while Zammad
 * compares against UTC timestamps. */
export function dayRangeBounds(from?: string, to?: string): { start: number | null; end: number | null } {
  const start = from ? new Date(`${from}T00:00:00`).getTime() : NaN
  const end = to ? new Date(`${to}T23:59:59.999`).getTime() : NaN
  return {
    start: Number.isFinite(start) ? start : null,
    end: Number.isFinite(end) ? end : null
  }
}

export function zammadDateField(dateField?: TicketDateField): string {
  return dateField === 'closed' ? 'close_at' : 'created_at'
}

export function dateRangeQuery(from: string | undefined, to: string | undefined, dateField?: TicketDateField): string {
  const { start, end } = dayRangeBounds(from, to)
  if (start === null && end === null) return ''
  const lower = start === null ? '*' : new Date(start).toISOString()
  const upper = end === null ? '*' : new Date(end).toISOString()
  return `${zammadDateField(dateField)}:[${lower} TO ${upper}]`
}

export function isInDateRange(
  raw: any,
  from: string | undefined,
  to: string | undefined,
  dateField?: TicketDateField
): boolean {
  const { start, end } = dayRangeBounds(from, to)
  if (start === null && end === null) return true
  const value = dateField === 'closed' ? raw?.close_at : raw?.created_at
  const timestamp = Date.parse(String(value ?? ''))
  // A ticket that is not closed yet simply has no date to match against.
  if (!Number.isFinite(timestamp)) return false
  if (start !== null && timestamp < start) return false
  if (end !== null && timestamp > end) return false
  return true
}
