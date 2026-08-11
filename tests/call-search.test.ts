import { describe, expect, it } from 'vitest'
import { filterCalls, matchesCallQuery, mergeCalls, mostCommonOperator } from '../src/renderer/src/lib/callSearch'

const call = (over: Record<string, unknown> = {}) => ({
  id: '1',
  callId: '1786350473.135457',
  section: 'history',
  direction: 'in',
  phone: '+7 (978) 691-86-26',
  client: 'Кравчук Евгений Васильевич ИП',
  organization: 'РИБАМБЕЛЬ ООО',
  operator: '622',
  startedAt: '11.08.2026 15:44:07',
  duration: '00:02:13',
  status: 'Отвечен',
  recordingUrl: null,
  sourceUrl: null,
  raw: { 'Источник': '79786918626' },
  ...over
}) as any

describe('matchesCallQuery', () => {
  it('находит по имени клиента без учёта регистра', () => {
    expect(matchesCallQuery(call(), 'кравчук')).toBe(true)
    expect(matchesCallQuery(call(), 'КРАВЧУК')).toBe(true)
  })

  it('находит по организации и по добавочному ответчика', () => {
    expect(matchesCallQuery(call(), 'рибамбель')).toBe(true)
    expect(matchesCallQuery(call(), '622')).toBe(true)
  })

  it('находит номер, как бы он ни был записан', () => {
    expect(matchesCallQuery(call(), '9786918626')).toBe(true)
    expect(matchesCallQuery(call(), '978 691')).toBe(true)
    expect(matchesCallQuery(call(), '+7 (978)')).toBe(true)
  })

  it('не считает совпадением чужой номер', () => {
    expect(matchesCallQuery(call(), '9998887766')).toBe(false)
  })

  it('короткие цифры ищет как есть, а не как номер', () => {
    // «13» есть в длительности, но не в номере — совпадение по тексту.
    expect(matchesCallQuery(call({ raw: {} }), '13')).toBe(true)
    expect(matchesCallQuery(call({ startedAt: '', duration: '', raw: {} }), '13')).toBe(false)
  })

  it('пустой запрос подходит всем', () => {
    expect(matchesCallQuery(call(), '   ')).toBe(true)
  })

  it('переживает пустые поля', () => {
    const empty = call({ phone: null, client: null, organization: null, operator: null, status: null, startedAt: null, raw: undefined })
    expect(matchesCallQuery(empty, 'что-нибудь')).toBe(false)
  })
})

describe('mostCommonOperator', () => {
  it('находит свой добавочный по загруженным «моим» звонкам', () => {
    const list = [call(), call({ id: '2' }), call({ id: '3', operator: '777' })]
    expect(mostCommonOperator(list)).toBe('622')
  })

  it('на пустом списке отдаёт пустую строку', () => {
    expect(mostCommonOperator([])).toBe('')
    expect(mostCommonOperator([call({ operator: null })])).toBe('')
  })
})

describe('mergeCalls', () => {
  it('склеивает без повторов, сохраняя порядок', () => {
    const a = call()
    const b = call({ id: '2' })
    expect(mergeCalls([a], [b, a]).map(item => item.id)).toEqual(['1', '2'])
  })

  it('различает записи без id по звонку и времени', () => {
    const a = call({ id: '', callId: 'x', startedAt: '1' })
    const b = call({ id: '', callId: 'y', startedAt: '2' })
    expect(mergeCalls([a, b]).length).toBe(2)
    expect(mergeCalls([a], [a]).length).toBe(1)
  })
})

describe('filterCalls', () => {
  it('оставляет только подходящие', () => {
    const list = [call(), call({ id: '2', phone: '+7 (999) 111-22-33', client: 'Другой', organization: '', operator: '', raw: {} })]
    expect(filterCalls(list, '9786918626').map(item => item.id)).toEqual(['1'])
    expect(filterCalls(list, '').map(item => item.id)).toEqual(['1', '2'])
  })
})
