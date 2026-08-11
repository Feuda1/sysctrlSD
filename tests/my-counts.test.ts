import { describe, expect, it } from 'vitest'
import { applyStateChange, type MyCounts } from '../src/renderer/src/lib/myCounts'
import type { Ticket } from '../src/renderer/src/types/ticket'

const ticket = (id: number, stateId: number, stateName: string): Ticket => ({
  id,
  number: String(id),
  title: `Заявка ${id}`,
  state: { id: stateId, name: stateName },
  priority: { id: 2, name: 'Обычный' },
  group: { id: 1, name: 'Поддержка' },
  owner: { id: 623, name: 'Я' },
  organization: { id: null, name: '' },
  createdAt: '2026-08-11T08:00:00Z',
  updatedAt: '2026-08-11T08:00:00Z'
} as Ticket)

const data = (): MyCounts => ({
  tickets: [ticket(1, 2, 'Открыта'), ticket(2, 2, 'Открыта'), ticket(3, 4, 'Отложена')],
  counts: { 2: 2, 4: 1 }
})

const PENDING = { id: 4, name: 'Отложена' }

describe('applyStateChange', () => {
  it('переносит заявку из одного статуса в другой', () => {
    const next = applyStateChange(data(), 1, PENDING)!
    expect(next.counts).toEqual({ 2: 1, 4: 2 })
    expect(next.tickets.find(t => t.id === 1)!.state).toEqual(PENDING)
  })

  it('не трогает данные, если статус тот же', () => {
    const before = data()
    expect(applyStateChange(before, 3, PENDING)).toBe(before)
  })

  it('не трогает данные, если заявки нет в списке', () => {
    const before = data()
    expect(applyStateChange(before, 999, PENDING)).toBe(before)
  })

  it('не уводит счётчик в минус', () => {
    const broken: MyCounts = { tickets: [ticket(1, 2, 'Открыта')], counts: {} }
    expect(applyStateChange(broken, 1, PENDING)!.counts).toEqual({ 4: 1 })
  })

  it('переживает отсутствие данных', () => {
    expect(applyStateChange(undefined, 1, PENDING)).toBeUndefined()
  })

  it('не меняет исходный объект', () => {
    const before = data()
    applyStateChange(before, 1, PENDING)
    expect(before.counts).toEqual({ 2: 2, 4: 1 })
    expect(before.tickets[0].state.name).toBe('Открыта')
  })
})
