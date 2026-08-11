/** Обычный интервал опроса открытой заявки. */
export const POLL_BASE_MS = 5_000
/** Дальше отступать некуда: раз в минуту проверяем, ожил ли сервер. */
export const POLL_MAX_MS = 60_000

/**
 * Когда сервер перестаёт отвечать, опрос каждые пять секунд только добавляет
 * ему нагрузки и ничего не даёт. Интервал растёт вдвое с каждой неудачей подряд
 * и возвращается к обычному, как только запрос прошёл.
 */
export function backoffInterval(failureCount: number): number {
  if (failureCount <= 0) return POLL_BASE_MS
  return Math.min(POLL_BASE_MS * 2 ** failureCount, POLL_MAX_MS)
}
