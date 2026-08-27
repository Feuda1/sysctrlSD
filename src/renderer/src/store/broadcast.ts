import { create } from 'zustand'

export interface BroadcastMessage {
  id: string
  message: string
  sentAt: number
}

const DISMISSED_KEY = 'broadcast.dismissedId'

/**
 * Сообщение от администратора всем сразу. Сервер хранит только одно активное
 * сообщение, а не очередь - каждый heartbeat приносит его текущее состояние
 * (или null), и здесь просто решается, показывать ли его именно этому
 * человеку: если он его уже закрыл (id совпадает с сохранённым), то нет.
 */
interface BroadcastState {
  current: BroadcastMessage | null
  dismissedId: string | null
  setCurrent: (broadcast: BroadcastMessage | null) => void
  dismiss: () => void
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  current: null,
  dismissedId: window.localStorage.getItem(DISMISSED_KEY),

  setCurrent: (broadcast) => set({ current: broadcast }),

  dismiss: () => {
    const id = get().current?.id ?? null
    if (id) window.localStorage.setItem(DISMISSED_KEY, id)
    set({ dismissedId: id })
  }
}))
