import { describe, expect, it } from 'vitest'
import { dateRangeQuery, isInDateRange, zammadSearchValue } from '../electron/main/zammad/query'

describe('dateRangeQuery', () => {
  it('filters by creation date by default', () => {
    expect(dateRangeQuery('2026-08-01', '2026-08-09')).toMatch(/^created_at:\[/)
  })

  it('filters by close date when asked', () => {
    expect(dateRangeQuery('2026-08-01', '2026-08-09', 'closed')).toMatch(/^close_at:\[/)
  })

  it('covers the whole last day', () => {
    // A period that ended at 00:00 of the last day used to hide everything
    // created during that day.
    const query = dateRangeQuery('2026-08-09', '2026-08-09')
    const [, upper] = /TO ([^\]]+)\]/.exec(query) ?? []
    expect(new Date(upper).getTime() - new Date('2026-08-09T00:00:00').getTime()).toBe(86_399_999)
  })

  it('leaves an open end as a wildcard', () => {
    expect(dateRangeQuery('2026-08-01', undefined)).toContain('TO *]')
    expect(dateRangeQuery(undefined, '2026-08-01')).toContain('[* TO')
  })

  it('is empty without a period', () => {
    expect(dateRangeQuery(undefined, undefined)).toBe('')
  })
})

describe('isInDateRange', () => {
  const ticket = { created_at: '2026-08-05T10:00:00Z', close_at: '2026-08-07T10:00:00Z' }

  it('accepts a ticket inside the period', () => {
    expect(isInDateRange(ticket, '2026-08-01', '2026-08-09')).toBe(true)
  })

  it('rejects a ticket outside the period', () => {
    expect(isInDateRange(ticket, '2026-08-06', '2026-08-09')).toBe(false)
  })

  it('uses the close date when asked', () => {
    expect(isInDateRange(ticket, '2026-08-06', '2026-08-09', 'closed')).toBe(true)
    expect(isInDateRange(ticket, '2026-08-01', '2026-08-06', 'closed')).toBe(false)
  })

  it('drops tickets that are not closed yet', () => {
    expect(isInDateRange({ created_at: ticket.created_at }, '2026-08-01', '2026-08-09', 'closed')).toBe(false)
  })

  it('keeps everything when no period is set', () => {
    expect(isInDateRange(ticket, undefined, undefined)).toBe(true)
  })
})

describe('zammadSearchValue', () => {
  it('leaves a simple value as is', () => {
    expect(zammadSearchValue('616943')).toBe('616943')
  })

  it('quotes a value with spaces', () => {
    expect(zammadSearchValue('Не работает iikoCard')).toBe('"Не работает iikoCard"')
  })

  it('escapes quotes inside the value', () => {
    expect(zammadSearchValue('кафе "Пекарня"')).toBe('"кафе \\"Пекарня\\""')
  })
})
