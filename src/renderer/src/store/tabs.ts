import { create } from 'zustand'

export interface Tab {
  id: string
  /** Fixed entry used to seed the tab's MemoryRouter. */
  initialPath: string
  /** Current path, kept in sync by TabNavBridge. */
  path: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
}

/** Imperative per-tab navigation, registered by each tab's TabNavBridge. */
interface TabController {
  navigate: (path: string) => void
  back: () => void
  forward: () => void
}

// Controllers live outside reactive state - they change only on mount/unmount
// and should not trigger re-renders.
const controllers = new Map<string, TabController>()

const DEFAULT_PATH = '/dashboard/tickets'

function newId(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

function makeTab(path: string): Tab {
  return { id: newId(), initialPath: path, path, title: '', canGoBack: false, canGoForward: false }
}

interface TabsState {
  tabs: Tab[]
  activeTabId: string

  openTab: (path: string, opts?: { background?: boolean }) => void
  closeTab: (id: string) => void
  setActive: (id: string) => void
  navigateActive: (path: string) => void
  back: () => void
  forward: () => void
  openInNewWindow: (path: string, bounds?: { x?: number; y?: number; width?: number; height?: number }) => void
  moveTab: (dragId: string, targetId: string) => void

  registerController: (id: string, ctrl: TabController) => void
  unregisterController: (id: string) => void
  updateTabNav: (id: string, nav: { path: string; canGoBack: boolean; canGoForward: boolean }) => void
  setTabTitle: (id: string, title: string) => void
}

function initialTab(): Tab {
  const seeded = window.api?.windows?.getInitialPath?.() || DEFAULT_PATH
  return makeTab(seeded.startsWith('/dashboard') ? seeded : DEFAULT_PATH)
}

const first = initialTab()

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: [first],
  activeTabId: first.id,

  openTab: (path, opts) => {
    const tab = makeTab(path)
    set(state => ({
      tabs: [...state.tabs, tab],
      activeTabId: opts?.background ? state.activeTabId : tab.id
    }))
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get()
    const index = tabs.findIndex(t => t.id === id)
    if (index === -1) return
    const nextTabs = tabs.filter(t => t.id !== id)
    controllers.delete(id)

    if (nextTabs.length === 0) {
      const fresh = makeTab(DEFAULT_PATH)
      set({ tabs: [fresh], activeTabId: fresh.id })
      return
    }

    let nextActive = activeTabId
    if (activeTabId === id) {
      const neighbor = nextTabs[index] ?? nextTabs[index - 1] ?? nextTabs[0]
      nextActive = neighbor.id
    }
    set({ tabs: nextTabs, activeTabId: nextActive })
  },

  setActive: (id) => set({ activeTabId: id }),

  navigateActive: (path) => {
    const { activeTabId } = get()
    controllers.get(activeTabId)?.navigate(path)
  },

  back: () => controllers.get(get().activeTabId)?.back(),
  forward: () => controllers.get(get().activeTabId)?.forward(),

  openInNewWindow: (path, bounds) => {
    window.api.windows.open(path, bounds)
  },

  moveTab: (dragId, targetId) => {
    if (dragId === targetId) return
    set(state => {
      const from = state.tabs.findIndex(t => t.id === dragId)
      const to = state.tabs.findIndex(t => t.id === targetId)
      if (from === -1 || to === -1) return {}
      const next = [...state.tabs]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return { tabs: next }
    })
  },

  registerController: (id, ctrl) => { controllers.set(id, ctrl) },
  unregisterController: (id) => { controllers.delete(id) },

  updateTabNav: (id, nav) => set(state => ({
    tabs: state.tabs.map(t => t.id === id ? { ...t, ...nav } : t)
  })),

  setTabTitle: (id, title) => set(state => ({
    tabs: state.tabs.map(t => (t.id === id && t.title !== title) ? { ...t, title } : t)
  }))
}))
