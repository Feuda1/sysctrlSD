import { describe, expect, it } from 'vitest'
import {
  buildZammadQuery,
  filterTicketsLocally,
  normalizeTicketTagValues,
  ticketReasonIds,
  ticketTagIds
} from '../electron/main/zammad/filter'

const ticket = (patch: Record<string, any> = {}) => ({
  id: 1,
  group_id: 10,
  state_id: 2,
  organization_id: 100,
  owner_id: 5,
  priority_id: 2,
  type: 'Incident',
  ...patch
})

describe('filterTicketsLocally', () => {
  it('keeps everything when there are no conditions', () => {
    expect(filterTicketsLocally([ticket(), ticket({ id: 2 })], {}, 5)).toHaveLength(2)
  })

  it('filters by group, state and priority', () => {
    const tickets = [ticket(), ticket({ id: 2, group_id: 11 })]
    expect(filterTicketsLocally(tickets, { groups: [{ id: 10, name: 'L2' }] }, 5)).toHaveLength(1)
    expect(filterTicketsLocally(tickets, { states: [{ id: 2, name: 'Открыта' }] }, 5)).toHaveLength(2)
    expect(filterTicketsLocally(tickets, { priorities: [{ id: 3, name: 'Высокий' }] }, 5)).toHaveLength(0)
  })

  it('understands "me" and "unassigned" owners', () => {
    const mine = ticket({ owner_id: 5 })
    const nobodys = ticket({ id: 2, owner_id: 1 })
    const someone = ticket({ id: 3, owner_id: 7 })
    const tickets = [mine, nobodys, someone]

    expect(filterTicketsLocally(tickets, { owners: [{ id: 'me', name: 'Я' }] }, 5)).toEqual([mine])
    expect(filterTicketsLocally(tickets, { owners: [{ id: 'unassigned', name: 'Не назначена' }] }, 5)).toEqual([nobodys])
    expect(filterTicketsLocally(tickets, { owners: [{ id: 7, name: 'Коллега' }] }, 5)).toEqual([someone])
  })

  it('treats half points as their own value', () => {
    const tickets = [ticket({ score: '01.0' }), ticket({ id: 2, score: '01.5' }), ticket({ id: 3 })]
    expect(filterTicketsLocally(tickets, { score: '1' }, 5).map(t => t.id)).toEqual([1])
    expect(filterTicketsLocally(tickets, { score: 'no_score' }, 5).map(t => t.id)).toEqual([3])
  })

  it('checks the erp flag both ways', () => {
    const tickets = [ticket({ erp_bill: 'СЧ-1' }), ticket({ id: 2, erp_bill: '' })]
    expect(filterTicketsLocally(tickets, { erpBill: 'yes' }, 5).map(t => t.id)).toEqual([1])
    expect(filterTicketsLocally(tickets, { erpBill: 'no' }, 5).map(t => t.id)).toEqual([2])
    expect(filterTicketsLocally(tickets, { erpBill: 'any' }, 5)).toHaveLength(2)
  })

  it('does not drop tickets that carry no tags at all', () => {
    // A tag condition narrows tickets that have tags; an untagged ticket is not
    // evidence against itself.
    const tagged = ticket({ tags: 'важное' })
    const untagged = ticket({ id: 2 })
    const result = filterTicketsLocally([tagged, untagged], { tags: [{ id: 'срочное', name: 'срочное' }] }, 5)
    expect(result.map(t => t.id)).toEqual([2])
  })
})

describe('buildZammadQuery', () => {
  it('is a wildcard without conditions', () => {
    expect(buildZammadQuery({}, 5)).toBe('*')
  })

  it('joins conditions with AND', () => {
    const query = buildZammadQuery({
      groups: [{ id: 10, name: 'L2' }],
      states: [{ id: 2, name: 'Открыта' }]
    }, 5)
    expect(query).toBe('group_id:(10) AND state_id:(2)')
  })

  it('substitutes the current user for "me"', () => {
    expect(buildZammadQuery({ owners: [{ id: 'me', name: 'Я' }] }, 42)).toBe('owner_id:(42)')
    expect(buildZammadQuery({ owners: [{ id: 'unassigned', name: '—' }] }, 42)).toBe('owner_id:(1)')
  })

  it('uses the reason field name it was given', () => {
    const query = buildZammadQuery({ iikoReasons: [{ id: 'iiko_front', name: 'iikoFront' }] }, 5, 'ticket_reason_v2')
    expect(query).toBe('ticket_reason_v2:(iiko_front)')
  })

  it('matches every written form of a score', () => {
    expect(buildZammadQuery({ score: '2' }, 5)).toBe('score:(2 OR "02.0" OR "02" OR "2.0")')
  })
})

describe('value normalisation', () => {
  it('splits tags written as one string', () => {
    expect(normalizeTicketTagValues('первый\nвторой')).toEqual(['первый', 'второй'])
    expect(normalizeTicketTagValues('["a","b"]')).toEqual(['a', 'b'])
    expect(normalizeTicketTagValues(null)).toEqual([])
  })

  it('drops the empty placeholder of a reason', () => {
    expect(ticketReasonIds({ ticket_reason: '-' })).toEqual([])
    expect(ticketReasonIds({ ticket_reason: 'iiko_front' })).toEqual(['iiko_front'])
  })

  it('reads tags from any of the field spellings', () => {
    expect(ticketTagIds({ tag_list: ['a', 'a', 'b'] })).toEqual(['a', 'b'])
  })
})
