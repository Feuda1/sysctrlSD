import type { Conditions } from '../ipc/tickets'
import { zammadSearchValue } from './query'

/**
 * Turning a filter's conditions into a Zammad query and applying the same
 * conditions locally. Both sides must agree, which is exactly why they live
 * together here - and why they are Electron-free and testable.
 */

/** Zammad field holding the iiko reason; the name differs between installations. */
export const DEFAULT_IIKO_REASON_FIELD = 'ticket_reason'

export function normalizeIikoReasonValues(value: any): string[] {
  if (value === null || value === undefined || value === '' || value === '-') return []
  if (Array.isArray(value)) {
    return value.flatMap(item => normalizeIikoReasonValues(item))
  }
  if (typeof value === 'object') {
    const objectValue = value.value ?? value.id ?? value.name ?? value.label
    return normalizeIikoReasonValues(objectValue)
  }

  const text = String(value).trim()
  if (!text || text === '-') return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return normalizeIikoReasonValues(parsed)
  } catch {
    // Not JSON - treat it as a plain value below.
  }
  return [text]
}

export function normalizeTicketTagValues(value: any): string[] {
  if (value === null || value === undefined || value === '') return []
  if (Array.isArray(value)) return value.flatMap(item => normalizeTicketTagValues(item))
  if (typeof value === 'object') {
    const objectValue = value.name ?? value.tag ?? value.value ?? value.id
    return normalizeTicketTagValues(objectValue)
  }

  const text = String(value).trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) return normalizeTicketTagValues(parsed)
  } catch {
    // Not JSON - split the plain string below.
  }
  return text.split(/\s*(?:\r?\n|\|\||;;)\s*/).map(item => item.trim()).filter(Boolean)
}

export function ticketReasonIds(raw: any, iikoReasonField = DEFAULT_IIKO_REASON_FIELD): string[] {
  const value = raw?.[iikoReasonField] ?? raw?.ticket_reason ?? raw?.ticketreason ?? raw?.TicketReason ?? raw?.ticketReason
  return normalizeIikoReasonValues(value)
}

export function ticketTagIds(raw: any): string[] {
  return Array.from(new Set(
    normalizeTicketTagValues(raw?.tags ?? raw?.tag_list ?? raw?.tagList ?? raw?.ticket_tags ?? raw?.TicketTags)
  ))
}

export function filterTicketsLocally(
  tickets: any[],
  cond: Conditions,
  myUserId: number | null,
  iikoReasonField = DEFAULT_IIKO_REASON_FIELD
): any[] {
  return tickets.filter(t => {
    const groupId = parseInt(String(t.group_id ?? '0'), 10)
    const stateId = parseInt(String(t.state_id ?? '0'), 10)
    const orgId = parseInt(String(t.organization_id ?? '0'), 10) || null
    const ownerId = parseInt(String(t.owner_id ?? '0'), 10) || null
    const priorityId = parseInt(String(t.priority_id ?? '0'), 10)
    const ticketTypeRaw = t.type ?? t.Type
    const ticketType = ticketTypeRaw === null || ticketTypeRaw === undefined ? '' : String(ticketTypeRaw).trim()
    const iikoReasons = ticketReasonIds(t, iikoReasonField)
    const tags = ticketTagIds(t)

    if (cond.groups?.length && !cond.groups.some(g => g.id === groupId)) return false
    if (cond.states?.length && !cond.states.some(s => s.id === stateId)) return false
    if (cond.ticketTypes?.length && ticketType && !cond.ticketTypes.some(type => type.id === ticketType)) return false
    if (cond.iikoReasons?.length && iikoReasons.length > 0 && !cond.iikoReasons.some(reason => iikoReasons.includes(reason.id))) return false
    if (cond.tags?.length && tags.length > 0 && !cond.tags.some(tag => tags.includes(tag.id))) return false
    if (cond.orgs?.length && !cond.orgs.some(o => o.id === orgId)) return false
    if (cond.owners?.length) {
      const match = cond.owners.some(o => {
        if (o.id === 'me') return ownerId === myUserId
        if (o.id === 'unassigned') return ownerId === 1 || !ownerId
        return ownerId === o.id
      })
      if (!match) return false
    }
    if (cond.priorities?.length && !cond.priorities.some(p => p.id === priorityId)) return false
    if (cond.checkInErp && cond.checkInErp !== 'any') {
      const isSet = t.check_in_erp === true || t.check_in_erp === 'true'
      const wantSet = cond.checkInErp === 'yes'
      if (isSet !== wantSet) return false
    }
    if (cond.erpBill && cond.erpBill !== 'any') {
      const isSet = !!t.erp_bill && t.erp_bill !== 'false' && t.erp_bill !== '0' && String(t.erp_bill).trim() !== ''
      const wantSet = cond.erpBill === 'yes'
      if (isSet !== wantSet) return false
    }
    if (cond.cost && cond.cost !== 'any') {
      const isSet = !!t.ticketcost && t.ticketcost !== 'false' && t.ticketcost !== '0' && String(t.ticketcost).trim() !== ''
      const wantSet = cond.cost === 'yes'
      if (isSet !== wantSet) return false
    }
    if (cond.score && cond.score !== 'any') {
      const rawVal = t.score === null || t.score === undefined ? '' : String(t.score).trim()
      const scoreVal = rawVal === '' ? null : parseFloat(rawVal)
      if (cond.score === 'no_score') {
        if (scoreVal !== null && scoreVal !== 0 && !isNaN(scoreVal)) return false
      } else {
        const val = parseFloat(cond.score)
        if (scoreVal === null || isNaN(scoreVal) || scoreVal !== val) return false
      }
    }
    return true
  })
}

export function buildZammadQuery(
  cond: Conditions,
  myUserId: number | null,
  iikoReasonField = DEFAULT_IIKO_REASON_FIELD
): string {
  const parts: string[] = []
  if (cond.groups?.length) {
    parts.push(`group_id:(${cond.groups.map(g => g.id).join(' OR ')})`)
  }
  if (cond.states?.length) {
    parts.push(`state_id:(${cond.states.map(s => s.id).join(' OR ')})`)
  }
  if (cond.ticketTypes?.length) {
    parts.push(`type:(${cond.ticketTypes.map(t => zammadSearchValue(t.id)).join(' OR ')})`)
  }
  if (cond.iikoReasons?.length) {
    parts.push(`${iikoReasonField}:(${cond.iikoReasons.map(reason => zammadSearchValue(reason.id)).join(' OR ')})`)
  }
  if (cond.tags?.length) {
    parts.push(`tags:(${cond.tags.map(tag => zammadSearchValue(tag.id)).join(' OR ')})`)
  }
  if (cond.owners?.length) {
    const ids = cond.owners.map(o => {
      if (o.id === 'me') return String(myUserId ?? '0')
      if (o.id === 'unassigned') return '1'
      return String(o.id)
    })
    parts.push(`owner_id:(${ids.join(' OR ')})`)
  }
  if (cond.orgs?.length) {
    parts.push(`organization_id:(${cond.orgs.map(o => o.id).join(' OR ')})`)
  }
  if (cond.priorities?.length) {
    parts.push(`priority_id:(${cond.priorities.map(p => p.id).join(' OR ')})`)
  }
  if (cond.checkInErp && cond.checkInErp !== 'any') {
    parts.push(cond.checkInErp === 'yes' ? 'check_in_erp:true' : 'NOT check_in_erp:true')
  }
  if (cond.erpBill && cond.erpBill !== 'any') {
    parts.push(cond.erpBill === 'yes'
      ? '_exists_:erp_bill AND NOT erp_bill:("" OR "false" OR "0")'
      : 'NOT (_exists_:erp_bill AND NOT erp_bill:("" OR "false" OR "0"))'
    )
  }
  if (cond.cost && cond.cost !== 'any') {
    parts.push(cond.cost === 'yes'
      ? '_exists_:ticketcost AND NOT ticketcost:("false" OR "0")'
      : 'NOT (_exists_:ticketcost AND NOT ticketcost:("false" OR "0"))'
    )
  }
  if (cond.score && cond.score !== 'any') {
    if (cond.score === 'no_score') {
      parts.push('NOT score:(1 OR 2 OR 3 OR 4 OR 5 OR "01.0" OR "02.0" OR "03.0" OR "04.0" OR "05.0")')
    } else {
      const val = cond.score
      parts.push(`score:(${val} OR "0${val}.0" OR "0${val}" OR "${val}.0")`)
    }
  }
  return parts.length > 0 ? parts.join(' AND ') : '*'
}
