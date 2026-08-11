import type { Ticket } from '@/types/ticket'
import type { PendingState } from '@/store/pendingStates'

/**
 * Сколько держим свой перевод, пока сервер о нём не знает. Индекс поиска
 * обновляется за секунды, но под нагрузкой может задержаться; дольше двух минут
 * настаивать на своём опасно — вдруг статус успели поменять из Zammad.
 */
export const PENDING_STATE_TTL_MS = 120_000

export interface MyCounts {
  tickets: Ticket[]
  counts: Record<number, number>
}

function moveTicket(data: MyCounts, ticketId: number, state: { id: number; name: string }): MyCounts {
  const current = data.tickets.find(ticket => ticket.id === ticketId)
  if (!current || current.state.id === state.id) return data

  const counts = { ...data.counts }
  const previous = counts[current.state.id] ?? 0
  // До нуля и не ниже: отрицательное число в чипе выглядело бы поломкой.
  if (previous > 0) counts[current.state.id] = previous - 1
  counts[state.id] = (counts[state.id] ?? 0) + 1

  return {
    counts,
    tickets: data.tickets.map(ticket => (ticket.id === ticketId ? { ...ticket, state } : ticket))
  }
}

/**
 * Накладывает наши ещё не проиндексированные переводы на ответ сервера, чтобы
 * чипы наверху показывали статус сразу после изменения, а не через несколько
 * секунд. Перевод, который сервер уже подтвердил, ничего не меняет.
 *
 * @param now время для проверки срока — параметром, чтобы это можно было проверить тестами.
 */
export function applyPendingStates(
  data: MyCounts | undefined,
  overrides: Record<number, PendingState>,
  now = Date.now()
): MyCounts | undefined {
  if (!data) return data

  let result = data
  for (const [key, override] of Object.entries(overrides)) {
    if (now - override.at > PENDING_STATE_TTL_MS) continue
    result = moveTicket(result, Number(key), { id: override.stateId, name: override.stateName })
  }
  return result
}
