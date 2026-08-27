import { net, BrowserWindow, ipcMain } from 'electron'
import logger from 'electron-log/main'
import { readStored, forceLogout, type AppUser } from './ipc/auth'
import { getZammadRequestRate } from './ipc/tickets'

/**
 * Клиент guard-сервера (`server/guard/`): раз в 25 секунд сообщает, что это
 * рабочее место открыто, и слушает в ответ "забанен"/"кикнут". Сервер не
 * обязателен для работы приложения - если он недоступен, ничего не ломается,
 * просто человека никто не видит и не может выкинуть. Это тот же урок, что и
 * с самим Zammad: сторонний сервис не должен становиться новой точкой отказа.
 */

const CONTROL_PLANE_BASE = import.meta.env.MAIN_VITE_CONTROL_PLANE_BASE ?? ''
export const APP_SHARED_KEY = import.meta.env.MAIN_VITE_APP_SHARED_KEY ?? ''

const HEARTBEAT_INTERVAL_MS = 25_000
const HEARTBEAT_TIMEOUT_MS = 5_000
const RESTORE_CHECK_TIMEOUT_MS = 3_000

/**
 * Любой вызов guard-сервера от имени текущего пользователя - используется и
 * для админ-действий (бан/кик/рассылка, сервер сам проверяет права по
 * `X-User-Id`), и для личных настроек (там прав не требуется, граница - это
 * просто "свои", а не "чужие"). Общий для обоих случаев, а не два похожих
 * куска кода.
 */
export async function guardCall<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  if (!CONTROL_PLANE_BASE || !APP_SHARED_KEY) {
    throw new Error('Контрольный сервер не настроен в этой сборке')
  }
  const user = currentUser()
  if (!user?.id) throw new Error('Нет активного пользователя')

  const resp = await net.fetch(`${CONTROL_PLANE_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Key': APP_SHARED_KEY,
      'X-User-Id': String(user.id)
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000)
  })
  if (!resp.ok) {
    if (resp.status === 403) throw new Error('Нет прав администратора')
    throw new Error(`Сервер ответил ${resp.status}`)
  }
  return (await resp.json()) as T
}

/** Читает текущего пользователя ровно тем же способом, что и `auth:restore` -
 * без похода в Zammad, из уже сохранённого на диске снимка. */
export function currentUser(): AppUser | null {
  try {
    const stored = readStored()
    return stored.userJson ? (JSON.parse(stored.userJson) as AppUser) : null
  } catch {
    return null
  }
}

function fullName(user: AppUser): string {
  return `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim() || user.login
}

function broadcastToAllWindows(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

function broadcastForcedLogout(reason: string): void {
  broadcastToAllWindows('auth:forced-logout', reason)
}

export interface BroadcastMessage {
  id: string
  message: string
  sentAt: number
}

interface HeartbeatResult {
  banned: boolean
  kicked: boolean
  coViewers?: Record<string, string[]>
  broadcast?: BroadcastMessage | null
}

/** Номера открытых заявок на этом рабочем месте прямо сейчас - выставляется
 * рендерером через IPC при открытии/закрытии вкладки заявки, читается
 * heartbeat'ом. Без отдельного запроса ради этого: едет тем же путём. */
let viewingTicketIds: number[] = []
export function setViewingTicketIds(ids: number[]): void {
  viewingTicketIds = ids
}

async function sendHeartbeat(user: AppUser, timeoutMs: number): Promise<HeartbeatResult | null> {
  if (!CONTROL_PLANE_BASE || !APP_SHARED_KEY) return null
  // Едет вместе с heartbeat, а не отдельным запросом - админ-экран видит
  // нагрузку с каждого места без ещё одного похода на сервер ради этого.
  const requestsLastMinute = getZammadRequestRate().lastMinute
  const resp = await net.fetch(`${CONTROL_PLANE_BASE}/api/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Key': APP_SHARED_KEY },
    body: JSON.stringify({
      userId: user.id,
      email: user.email,
      name: fullName(user),
      requestsLastMinute,
      viewingTicketIds
    }),
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!resp.ok) throw new Error(`guard heartbeat -> ${resp.status}`)
  return (await resp.json()) as HeartbeatResult
}

/**
 * Прямая проверка бана для `auth:login`/`auth:restore`.
 *
 * Раньше бан ловил только фоновый heartbeat раз в 25 секунд - значит, забаненный
 * человек мог либо тихо восстановить сессию (гонка с первым тактом опроса),
 * либо просто вручную ввести пароль в форме входа: `auth:login` вообще не
 * спрашивал guard-сервер. Теперь обе точки входа проверяют бан сами, до того
 * как отдать доступ, а не постфактум. Как и всё остальное здесь - терпимо к
 * недоступности сервера: ошибка сети означает "не забанен", а не отказ входа.
 */
export async function isBanned(user: AppUser): Promise<boolean> {
  if (!user.id) return false
  try {
    const result = await sendHeartbeat(user, RESTORE_CHECK_TIMEOUT_MS)
    return !!result?.banned
  } catch (err) {
    logger.warn('sd-guard: проверка бана не прошла (пускаем как есть):', err instanceof Error ? err.message : err)
    return false
  }
}

async function applyHeartbeatResult(result: HeartbeatResult | null): Promise<void> {
  if (!result) return
  if (result.banned) {
    await forceLogout()
    broadcastForcedLogout('Доступ отключён администратором.')
    return
  }
  if (result.kicked) {
    await forceLogout()
    broadcastForcedLogout('Вас принудительно вывели из приложения. Можно зайти снова.')
    return
  }
  // Оба поля шлём всегда, даже пустыми/null - у рендерера тогда нет нужды
  // хранить своё "было раньше", он просто отражает то, что прислал сервер.
  broadcastToAllWindows('tickets:co-viewers', result.coViewers ?? {})
  broadcastToAllWindows('admin:broadcast', result.broadcast ?? null)
}

async function runHeartbeat(timeoutMs: number): Promise<void> {
  const user = currentUser()
  if (!user?.id) return
  try {
    const result = await sendHeartbeat(user, timeoutMs)
    await applyHeartbeatResult(result)
  } catch (err) {
    // Молча: сервер недоступен - работа продолжается как обычно. Он тут ради
    // удобства и подстраховки, а не как ещё одна точка отказа.
    logger.warn('sd-guard: heartbeat не прошёл:', err instanceof Error ? err.message : err)
  }
}

let heartbeatInterval: ReturnType<typeof setInterval> | null = null

/**
 * Запускается один раз при старте приложения, ещё до того, как рендерер
 * успеет что-то отрисовать. Первый вызов - сразу, с коротким таймаутом: если
 * человека забанили, пока приложение было закрыто, он не должен тихо зайти
 * обратно по сохранённому паролю. Дальше - раз в 25 секунд, уже с обычным
 * таймаутом, пока приложение открыто.
 */
export function startControlPlaneHeartbeat(): void {
  if (heartbeatInterval) return
  if (!CONTROL_PLANE_BASE || !APP_SHARED_KEY) {
    logger.warn('sd-guard: MAIN_VITE_APP_SHARED_KEY/MAIN_VITE_CONTROL_PLANE_BASE не заданы - онлайн-статус и бан выключены.')
    return
  }

  runHeartbeat(RESTORE_CHECK_TIMEOUT_MS)
  heartbeatInterval = setInterval(() => runHeartbeat(HEARTBEAT_TIMEOUT_MS), HEARTBEAT_INTERVAL_MS)
}

/** Рендерер сообщает, какие заявки у него сейчас открыты - используется
 * следующим же heartbeat'ом, отдельного запроса ради этого нет. */
export function setupPresenceIpc(): void {
  ipcMain.handle('tickets:setViewingTicketIds', (_event, ids: number[]) => {
    setViewingTicketIds(Array.isArray(ids) ? ids.filter(id => Number.isFinite(id)) : [])
  })
}
