type CallRecord = Awaited<ReturnType<typeof window.api.calls.getAll>>['history'][number]

/**
 * Поиск по уже загруженным звонкам. Нужен потому, что поиск на стороне clients
 * идёт перебором: по частому номеру ответ мгновенный, а по редкому — до двадцати
 * секунд. Всё это время у нас на руках уже есть последняя страница звонков, и
 * ответ чаще всего в ней: искали-то обычно свежий звонок.
 */

/** Цифры номера: «+7 (978) 691-86-26» и «79786918626» должны совпадать. */
function digitsOf(value: string): string {
  return value.replace(/\D/g, '')
}

function fieldsOf(call: CallRecord): string[] {
  return [
    call.phone ?? '',
    call.client ?? '',
    call.organization ?? '',
    call.operator ?? '',
    call.status ?? '',
    call.startedAt ?? '',
    call.duration ?? '',
    call.linkedTicketId ?? '',
    ...Object.values(call.raw ?? {})
  ]
}

export function matchesCallQuery(call: CallRecord, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true

  const fields = fieldsOf(call)
  if (fields.some(field => field.toLowerCase().includes(trimmed))) return true

  // По цифрам ищем отдельно: разделители в номере не должны мешать.
  const queryDigits = digitsOf(trimmed)
  if (queryDigits.length >= 3) {
    return fields.some(field => digitsOf(field).includes(queryDigits))
  }
  return false
}

export function filterCalls(calls: CallRecord[], query: string): CallRecord[] {
  if (!query.trim()) return calls
  return calls.filter(call => matchesCallQuery(call, query))
}
