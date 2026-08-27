import { create } from 'zustand'

export type ViewerActivity = 'viewing' | 'typing'
export interface CoViewer {
  name: string
  initials: string
  activity: ViewerActivity
}

/**
 * Кто ещё смотрит те же заявки, что открыты у меня прямо сейчас, и что там
 * делает - молча читает или уже печатает ответ.
 *
 * Каждая открытая карточка заявки регистрирует свой номер здесь, а поле ввода
 * комментария - обновляет его активность; итог уходит на guard-сервер вместе
 * с обычным heartbeat (раз в 25 секунд, или сразу, если что-то реально
 * изменилось - см. `controlPlane.ts`). Ответ - кто ещё сейчас смотрит эти же
 * заявки - приходит туда же и складывается в `coViewers`.
 */
interface PresenceState {
  viewing: Map<number, ViewerActivity>
  coViewers: Record<string, CoViewer[]>
  registerViewing: (id: number) => void
  unregisterViewing: (id: number) => void
  setActivity: (id: number, activity: ViewerActivity) => void
  setCoViewers: (coViewers: Record<string, CoViewer[]>) => void
}

// Собирает несколько изменений подряд (переключение вкладок, набор текста) в
// один поход к главному процессу, а не шлёт на каждый чих.
let pushTimer: ReturnType<typeof setTimeout> | null = null
function schedulePush(viewing: Map<number, ViewerActivity>): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    const entries = [...viewing.entries()].map(([ticketId, activity]) => ({ ticketId, activity }))
    window.api.tickets.setViewing(entries).catch(() => {})
  }, 150)
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  viewing: new Map(),
  coViewers: {},

  registerViewing: (id) => {
    if (get().viewing.has(id)) return
    const next = new Map(get().viewing)
    next.set(id, 'viewing')
    set({ viewing: next })
    schedulePush(next)
  },

  unregisterViewing: (id) => {
    if (!get().viewing.has(id)) return
    const next = new Map(get().viewing)
    next.delete(id)
    set({ viewing: next })
    schedulePush(next)
  },

  setActivity: (id, activity) => {
    if (get().viewing.get(id) === activity) return
    const next = new Map(get().viewing)
    next.set(id, activity)
    set({ viewing: next })
    schedulePush(next)
  },

  setCoViewers: (coViewers) => set({ coViewers })
}))
