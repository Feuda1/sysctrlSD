import { create } from 'zustand'

/**
 * Кто ещё смотрит те же заявки, что открыты у меня прямо сейчас.
 *
 * Каждая открытая карточка заявки регистрирует свой номер здесь; получившийся
 * список уходит на guard-сервер вместе с обычным heartbeat (раз в 25 секунд),
 * а ответ - кто ещё сейчас смотрит эти же заявки - приходит туда же и
 * складывается в `coViewers`. Отдельного запроса на это не тратится.
 */
interface PresenceState {
  viewingIds: Set<number>
  coViewers: Record<string, string[]>
  registerViewing: (id: number) => void
  unregisterViewing: (id: number) => void
  setCoViewers: (coViewers: Record<string, string[]>) => void
}

// Собирает несколько mount/unmount подряд (переключение вкладок, StrictMode)
// в один поход к главному процессу, а не шлёт на каждый чих.
let pushTimer: ReturnType<typeof setTimeout> | null = null
function schedulePush(ids: number[]): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    window.api.tickets.setViewingTicketIds(ids).catch(() => {})
  }, 150)
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  viewingIds: new Set(),
  coViewers: {},

  registerViewing: (id) => {
    if (get().viewingIds.has(id)) return
    const next = new Set(get().viewingIds)
    next.add(id)
    set({ viewingIds: next })
    schedulePush([...next])
  },

  unregisterViewing: (id) => {
    if (!get().viewingIds.has(id)) return
    const next = new Set(get().viewingIds)
    next.delete(id)
    set({ viewingIds: next })
    schedulePush([...next])
  },

  setCoViewers: (coViewers) => set({ coViewers })
}))
