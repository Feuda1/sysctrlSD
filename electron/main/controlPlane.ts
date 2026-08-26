import { net, BrowserWindow } from 'electron'
import logger from 'electron-log/main'
import { readStored, forceLogout, type AppUser } from './ipc/auth'

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

function broadcastForcedLogout(reason: string): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('auth:forced-logout', reason)
  }
}

interface HeartbeatResult {
  banned: boolean
  kicked: boolean
}

async function sendHeartbeat(user: AppUser, timeoutMs: number): Promise<HeartbeatResult | null> {
  if (!CONTROL_PLANE_BASE || !APP_SHARED_KEY) return null
  const resp = await net.fetch(`${CONTROL_PLANE_BASE}/api/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-App-Key': APP_SHARED_KEY },
    body: JSON.stringify({ userId: user.id, email: user.email, name: fullName(user) }),
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
  } else if (result.kicked) {
    await forceLogout()
    broadcastForcedLogout('Вас принудительно вывели из приложения. Можно зайти снова.')
  }
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
