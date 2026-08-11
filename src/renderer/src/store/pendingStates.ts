import { create } from 'zustand'

export interface PendingState {
  stateId: number
  stateName: string
  at: number
}

interface PendingStatesStore {
  overrides: Record<number, PendingState>
  setPendingState: (ticketId: number, stateId: number, stateName: string) => void
  clearPendingState: (ticketId: number) => void
}

/**
 * Статусы, которые мы уже перевели, но поиск Zammad об этом ещё не знает.
 *
 * Разовой правки кэша не хватало: счётчики перечитываются раз в 15 секунд, и
 * ответ из непроиндексированного поиска возвращал заявку в прежний статус.
 * Поэтому перевод хранится отдельно и накладывается на каждый ответ сервера,
 * пока индекс не догонит.
 */
export const usePendingStatesStore = create<PendingStatesStore>((set) => ({
  overrides: {},
  setPendingState: (ticketId, stateId, stateName) =>
    set(store => ({
      overrides: { ...store.overrides, [ticketId]: { stateId, stateName, at: Date.now() } }
    })),
  clearPendingState: (ticketId) =>
    set(store => {
      if (!store.overrides[ticketId]) return store
      const overrides = { ...store.overrides }
      delete overrides[ticketId]
      return { overrides }
    })
}))
