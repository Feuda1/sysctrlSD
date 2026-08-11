import type { Ticket } from '@/types/ticket'

/**
 * Сколько ждать, прежде чем перечитать счётчики с сервера. Меньше — и ответ
 * придёт из ещё не обновившегося индекса, вернув заявку в прежний статус.
 */
export const COUNTS_REINDEX_DELAY_MS = 10_000

export interface MyCounts {
  tickets: Ticket[]
  counts: Record<number, number>
}

/**
 * Zammad считает мои заявки поиском, а поиск ходит через индекс — он догоняет
 * изменение через несколько секунд. Всё это время чипы наверху показывали
 * старый статус, хотя заявка уже переведена. Здесь тот же переход применяется
 * к уже загруженным данным, чтобы цифры сходились сразу.
 *
 * Заявка, которой нет в списке (например, чужая), ничего не меняет.
 */
export function applyStateChange(
  data: MyCounts | undefined,
  ticketId: number,
  newState: { id: number; name: string }
): MyCounts | undefined {
  if (!data) return data

  const current = data.tickets.find(ticket => ticket.id === ticketId)
  if (!current || current.state.id === newState.id) return data

  const counts = { ...data.counts }
  const previous = counts[current.state.id] ?? 0
  // До нуля и не ниже: отрицательное число в чипе выглядело бы поломкой.
  if (previous > 0) counts[current.state.id] = previous - 1
  counts[newState.id] = (counts[newState.id] ?? 0) + 1

  return {
    counts,
    tickets: data.tickets.map(ticket =>
      ticket.id === ticketId ? { ...ticket, state: newState } : ticket
    )
  }
}
