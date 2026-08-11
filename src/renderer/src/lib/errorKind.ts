// Ошибка сети и ошибка данных требуют разных действий: первую лечит повтор,
// вторую — нет. Раньше и то и другое показывалось одной красной строкой с
// техническим текстом, и понять, стоит ли ждать, было невозможно.
export type ErrorKind = 'offline' | 'network' | 'auth' | 'server' | 'data'

export interface DescribedError {
  kind: ErrorKind
  /** Короткая строка о сути — её видно первой. */
  title: string
  /** Что делать дальше; пусто, если советовать нечего. */
  hint: string
  /** Есть ли смысл в кнопке «Повторить». */
  canRetry: boolean
  /** Исходный текст — показывается мелким шрифтом под подсказкой. */
  detail: string
}

const NETWORK_MARKERS = [
  'net::err_',
  'fetch failed',
  'failed to fetch',
  'econnrefused',
  'econnreset',
  'etimedout',
  'enotfound',
  'eai_again',
  'getaddrinfo',
  'socket hang up',
  'network error',
  'сеть недоступна',
  'не удалось подключиться'
]

const OFFLINE_MARKERS = [
  'err_internet_disconnected',
  'err_network_changed',
  'err_name_not_resolved',
  'err_proxy_connection_failed',
  'err_address_unreachable'
]

const AUTH_MARKERS = ['нет доступа', 'unauthorized', 'forbidden', 'api ключ']

const SERVER_MARKERS = ['сервер не ответил', 'internal server error', 'bad gateway', 'gateway timeout']

/**
 * Код статуса встречается по-разному: «(502)», «ошибка 502», просто «: 502».
 * Ищем число как отдельное слово, иначе «Заявка 5023» сойдёт за ошибку сервера.
 */
function statusCodeIn(message: string): number | null {
  const match = message.match(/(?:^|[^\d])([45]\d{2})(?![\d])/)
  return match ? Number(match[1]) : null
}

function messageOf(error: unknown): string {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  const maybe = (error as { message?: unknown }).message
  return typeof maybe === 'string' ? maybe : ''
}

/**
 * @param isOnline состояние подключения по данным браузера; когда его нет,
 *   сетевая ошибка объясняется отсутствием интернета, а не поломкой сервера.
 */
export function describeError(error: unknown, fallback: string, isOnline = true): DescribedError {
  const detail = messageOf(error).trim()
  const lower = detail.toLowerCase()
  const has = (markers: string[]) => markers.some(marker => lower.includes(marker))
  const status = statusCodeIn(lower)

  if (!isOnline || has(OFFLINE_MARKERS)) {
    return {
      kind: 'offline',
      title: 'Нет подключения к сети',
      hint: 'Данные показаны на момент последней загрузки. Как только связь вернётся, обновите страницу.',
      canRetry: true,
      detail
    }
  }

  if (has(NETWORK_MARKERS)) {
    return {
      kind: 'network',
      title: 'Сервер недоступен',
      hint: 'Связи с сервером нет — данные не потеряны, попробуйте повторить.',
      canRetry: true,
      detail
    }
  }

  if (status === 401 || status === 403 || has(AUTH_MARKERS)) {
    return {
      kind: 'auth',
      title: 'Нет доступа',
      hint: 'Проверьте вход и Zammad API ключ в настройках — повтор не поможет.',
      canRetry: false,
      detail
    }
  }

  if ((status !== null && status >= 500) || has(SERVER_MARKERS)) {
    return {
      kind: 'server',
      title: status === 502 || status === 503 || status === 504
        ? 'Сервер недоступен'
        : 'Сервер ответил ошибкой',
      hint: 'Сбой на стороне сервера, к данным он отношения не имеет. Повторите через минуту.',
      canRetry: true,
      detail
    }
  }

  return {
    kind: 'data',
    // Сообщение с сервера уже написано для человека — оно и есть заголовок,
    // дублировать его ниже мелким шрифтом незачем.
    title: detail || fallback,
    hint: '',
    canRetry: true,
    detail: ''
  }
}
