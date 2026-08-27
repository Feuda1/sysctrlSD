import { useUIStore, type Theme } from '@/store/ui'

/**
 * Личные настройки, которые следуют за аккаунтом, а не остаются на одном
 * компьютере. Сознательно не всё подряд из useUIStore - только то, что
 * реально "моя привычка", а не разовые/отладочные переключатели вроде
 * секретных тумблеров заявки.
 */
const SYNCED_FIELDS = [
  'theme', 'chatStyle', 'bubbleSide', 'sidebarSide', 'ticketPanelSide',
  'scrollDownSide', 'afterCommentSubmitAction', 'hideScrollDownArrow',
  'openCreatedTicket', 'openTabInBackground', 'suggestStateOnSend', 'suggestReasonOnSend'
] as const

function currentSyncedValues(): Record<string, unknown> {
  const state = useUIStore.getState()
  const out: Record<string, unknown> = {}
  for (const field of SYNCED_FIELDS) out[field] = state[field]
  return out
}

let pushTimer: ReturnType<typeof setTimeout> | null = null
// Пока применяется то, что только что пришло с сервера, свои же значения
// обратно не отправляем - иначе pull и push гоняли бы одно и то же по кругу.
let applyingRemote = false

function schedulePush(): void {
  if (applyingRemote) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    window.api.settings.push(currentSyncedValues()).catch(() => {})
  }, 1500)
}

let unsubscribeStore: (() => void) | null = null

/** Один раз за сессию: любое изменение отслеживаемых полей уходит на сервер
 * с небольшой задержкой (гасит быстрые повторные щелчки по переключателю). */
export function startSettingsSync(): void {
  if (unsubscribeStore) return
  unsubscribeStore = useUIStore.subscribe((state, prevState) => {
    for (const field of SYNCED_FIELDS) {
      if (state[field] !== prevState[field]) {
        schedulePush()
        break
      }
    }
  })
}

/**
 * Вызывается один раз после входа - подтягивает сохранённое за аккаунтом и
 * применяет через штатные setXxx, тем же путём, каким это происходит при
 * обычном клике в настройках (тема заодно уходит и в nativeTheme, а не
 * только в CSS-класс).
 */
export async function pullSettingsOnce(): Promise<void> {
  try {
    const { settings } = await window.api.settings.get()
    if (!settings) return

    applyingRemote = true
    const store = useUIStore.getState()
    if (typeof settings.theme === 'string') await store.setTheme(settings.theme as Theme)
    if (typeof settings.chatStyle === 'string') store.setChatStyle(settings.chatStyle as 'modern' | 'classic')
    if (typeof settings.bubbleSide === 'string') store.setBubbleSide(settings.bubbleSide as 'client-right' | 'client-left')
    if (typeof settings.sidebarSide === 'string') store.setSidebarSide(settings.sidebarSide as 'left' | 'right')
    if (typeof settings.ticketPanelSide === 'string') store.setTicketPanelSide(settings.ticketPanelSide as 'left' | 'right')
    if (typeof settings.scrollDownSide === 'string') store.setScrollDownSide(settings.scrollDownSide as 'auto' | 'left' | 'right')
    if (typeof settings.afterCommentSubmitAction === 'string') store.setAfterCommentSubmitAction(settings.afterCommentSubmitAction as 'stay' | 'close')
    if (typeof settings.hideScrollDownArrow === 'boolean') store.setHideScrollDownArrow(settings.hideScrollDownArrow)
    if (typeof settings.openCreatedTicket === 'boolean') store.setOpenCreatedTicket(settings.openCreatedTicket)
    if (typeof settings.openTabInBackground === 'boolean') store.setOpenTabInBackground(settings.openTabInBackground)
    if (typeof settings.suggestStateOnSend === 'boolean') store.setSuggestStateOnSend(settings.suggestStateOnSend)
    if (typeof settings.suggestReasonOnSend === 'boolean') store.setSuggestReasonOnSend(settings.suggestReasonOnSend)
  } catch {
    // Сервер недоступен - продолжаем с тем, что уже есть локально.
  } finally {
    applyingRemote = false
  }
}
