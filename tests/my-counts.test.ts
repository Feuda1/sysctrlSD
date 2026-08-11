import { describe, expect, it } from 'vitest'
import { applyPendingStates, PENDING_STATE_TTL_MS, type MyCounts } from '../src/renderer/src/lib/myCounts'
import type { PendingState } from '../src/renderer/src/store/pendingStates'
import type { Ticket } from '../src/renderer/src/types/ticket'

const NOW = 1_800_000_000_000

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

const pending = (stateId: number, stateName: string, at = NOW): PendingState => ({ stateId, stateName, at })

describe('applyPendingStates', () => {
  it('переносит заявку из одного статуса в другой', () => {
    const next = applyPendingStates(data(), { 1: pending(4, 'Отложена') }, NOW)!
    expect(next.counts).toEqual({ 2: 1, 4: 2 })
    expect(next.tickets.find(t => t.id === 1)!.state).toEqual({ id: 4, name: 'Отложена' })
  })

  it('накладывает несколько переводов сразу', () => {
    const next = applyPendingStates(data(), { 1: pending(4, 'Отложена'), 2: pending(4, 'Отложена') }, NOW)!
    expect(next.counts).toEqual({ 2: 0, 4: 3 })
  })

  it('ничего не меняет, когда сервер уже согласен', () => {
    const before = data()
    expect(applyPendingStates(before, { 3: pending(4, 'Отложена') }, NOW)).toBe(before)
  })

  it('забывает перевод, которому сервер так и не поверил', () => {
    const stale = { 1: pending(4, 'Отложена', NOW - PENDING_STATE_TTL_MS - 1) }
    const before = data()
    expect(applyPendingStates(before, stale, NOW)).toBe(before)
  })

  it('не трогает заявку, которой нет в списке', () => {
    const before = data()
    expect(applyPendingStates(before, { 999: pending(4, 'Отложена') }, NOW)).toBe(before)
  })

  it('не уводит счётчик в минус', () => {
    const broken: MyCounts = { tickets: [ticket(1, 2, 'Открыта')], counts: {} }
    expect(applyPendingStates(broken, { 1: pending(4, 'Отложена') }, NOW)!.counts).toEqual({ 4: 1 })
  })

  it('переживает отсутствие данных', () => {
    expect(applyPendingStates(undefined, { 1: pending(4, 'Отложена') }, NOW)).toBeUndefined()
  })

  it('не меняет исходный объект', () => {
    const before = data()
    applyPendingStates(before, { 1: pending(4, 'Отложена') }, NOW)
    expect(before.counts).toEqual({ 2: 2, 4: 1 })
    expect(before.tickets[0].state.name).toBe('Открыта')
  })
})
