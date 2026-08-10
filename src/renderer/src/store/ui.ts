import { create } from 'zustand'

type Theme = 'dark' | 'light' | 'system'
type ResolvedTheme = 'dark' | 'light'

const THEME_STORAGE_KEY = 'ui.theme'
const CHAT_STYLE_STORAGE_KEY = 'ui.chatStyle'
const BUBBLE_SIDE_STORAGE_KEY = 'ui.bubbleSide'
const SECRET_TICKET_CONTROLS_KEY = 'ui.secretTicketControls'
const SECRET_TICKET_REASON_CONTROLS_KEY = 'ui.secretTicketReasonControls'
const SECRET_SCORE_OVERRIDE_KEY = 'ui.secretScoreOverride'

function getStoredScoreOverride(): boolean {
  return window.localStorage.getItem(SECRET_SCORE_OVERRIDE_KEY) === '1'
}
const AFTER_COMMENT_SUBMIT_KEY = 'ui.afterCommentSubmitAction'
const HIDE_SCROLL_DOWN_ARROW_KEY = 'ui.hideScrollDownArrow'
const OPEN_CREATED_TICKET_KEY = 'ui.openCreatedTicket'

// Opening the new ticket is the long-standing behaviour, so only an explicit
// '0' turns it off.
function getStoredOpenCreatedTicket(): boolean {
  return window.localStorage.getItem(OPEN_CREATED_TICKET_KEY) !== '0'
}

function getStoredAfterCommentSubmitAction(): 'stay' | 'close' {
  const stored = window.localStorage.getItem(AFTER_COMMENT_SUBMIT_KEY)
  return stored === 'close' ? 'close' : 'stay'
}

function getStoredHideScrollDownArrow(): boolean {
  return window.localStorage.getItem(HIDE_SCROLL_DOWN_ARROW_KEY) === '1'
}

function getStoredChatStyle(): 'modern' | 'classic' {
  const stored = window.localStorage.getItem(CHAT_STYLE_STORAGE_KEY)
  return stored === 'classic' ? 'classic' : 'modern'
}

type BubbleSide = 'client-right' | 'client-left'

function getStoredBubbleSide(): BubbleSide {
  return window.localStorage.getItem(BUBBLE_SIDE_STORAGE_KEY) === 'client-left' ? 'client-left' : 'client-right'
}

function getStoredTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'dark'
}

function getStoredSecretTicketControls(): boolean {
  return window.localStorage.getItem(SECRET_TICKET_CONTROLS_KEY) === '1'
}

function getStoredSecretTicketReasonControls(): boolean {
  return window.localStorage.getItem(SECRET_TICKET_REASON_CONTROLS_KEY) === '1'
}

export type UpdateStatus =
  | 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'

export interface UpdateState {
  status: UpdateStatus
  version?: string
  percent?: number
  error?: string
}

interface UIState {
  theme: Theme
  resolvedTheme: ResolvedTheme
  sidebarCollapsed: boolean

  update: UpdateState
  updateDismissed: boolean
  setUpdateState: (state: UpdateState) => void
  dismissUpdate: () => void
  installUpdate: () => void
  checkForUpdate: () => Promise<void>

  setTheme: (theme: Theme) => Promise<void>
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void

  searchQuery: string
  setSearchQuery: (query: string) => void

  chatStyle: 'modern' | 'classic'
  setChatStyle: (style: 'modern' | 'classic') => void

  bubbleSide: BubbleSide
  setBubbleSide: (side: BubbleSide) => void

  allowTicketStatusWithoutPublicComment: boolean
  setAllowTicketStatusWithoutPublicComment: (enabled: boolean) => void
  allowTicketPendingWithoutReason: boolean
  setAllowTicketPendingWithoutReason: (enabled: boolean) => void
  /** Offer the score control even when clients marks it read-only. */
  allowScoreWithoutClientsRight: boolean
  setAllowScoreWithoutClientsRight: (enabled: boolean) => void

  isQuickTicketOpen: boolean
  setQuickTicketOpen: (open: boolean) => void

  afterCommentSubmitAction: 'stay' | 'close'
  setAfterCommentSubmitAction: (action: 'stay' | 'close') => void
  hideScrollDownArrow: boolean
  setHideScrollDownArrow: (hide: boolean) => void
  openCreatedTicket: boolean
  setOpenCreatedTicket: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: getStoredTheme(),
  chatStyle: getStoredChatStyle(),
  bubbleSide: getStoredBubbleSide(),
  allowTicketStatusWithoutPublicComment: getStoredSecretTicketControls(),
  allowTicketPendingWithoutReason: getStoredSecretTicketReasonControls(),
  allowScoreWithoutClientsRight: getStoredScoreOverride(),
  afterCommentSubmitAction: getStoredAfterCommentSubmitAction(),
  hideScrollDownArrow: getStoredHideScrollDownArrow(),
  openCreatedTicket: getStoredOpenCreatedTicket(),
  isQuickTicketOpen: false,
  resolvedTheme: 'dark',
  sidebarCollapsed: false,
  update: { status: 'idle' },
  updateDismissed: false,

  setUpdateState: (state) => set((s) => ({
    update: state,
    // A fresh "available/downloaded" cycle un-dismisses the prompt.
    updateDismissed: state.status === 'available' || state.status === 'downloading' ? false : s.updateDismissed
  })),
  dismissUpdate: () => set({ updateDismissed: true }),
  checkForUpdate: async () => {
    set({ update: { status: 'checking' } })
    await window.api.updater.check()
  },

  setTheme: async (theme: Theme) => {
    const resolved = await window.api.theme.set(theme)
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    set({ theme, resolvedTheme: resolved })
    document.documentElement.classList.toggle('dark', resolved === 'dark')
    document.documentElement.classList.toggle('light', resolved === 'light')
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  installUpdate: () => {
    window.api.updater.install()
  },

  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  setChatStyle: (style) => {
    window.localStorage.setItem(CHAT_STYLE_STORAGE_KEY, style)
    set({ chatStyle: style })
  },

  setBubbleSide: (side) => {
    window.localStorage.setItem(BUBBLE_SIDE_STORAGE_KEY, side)
    set({ bubbleSide: side })
  },

  setAllowTicketStatusWithoutPublicComment: (enabled) => {
    window.localStorage.setItem(SECRET_TICKET_CONTROLS_KEY, enabled ? '1' : '0')
    set({ allowTicketStatusWithoutPublicComment: enabled })
  },

  setAllowTicketPendingWithoutReason: (enabled) => {
    window.localStorage.setItem(SECRET_TICKET_REASON_CONTROLS_KEY, enabled ? '1' : '0')
    set({ allowTicketPendingWithoutReason: enabled })
  },

  setAllowScoreWithoutClientsRight: (enabled) => {
    window.localStorage.setItem(SECRET_SCORE_OVERRIDE_KEY, enabled ? '1' : '0')
    set({ allowScoreWithoutClientsRight: enabled })
  },

  setQuickTicketOpen: (open) => set({ isQuickTicketOpen: open }),

  setAfterCommentSubmitAction: (action) => {
    window.localStorage.setItem(AFTER_COMMENT_SUBMIT_KEY, action)
    set({ afterCommentSubmitAction: action })
  },

  setHideScrollDownArrow: (hide) => {
    window.localStorage.setItem(HIDE_SCROLL_DOWN_ARROW_KEY, hide ? '1' : '0')
    set({ hideScrollDownArrow: hide })
  },

  setOpenCreatedTicket: (open) => {
    window.localStorage.setItem(OPEN_CREATED_TICKET_KEY, open ? '1' : '0')
    set({ openCreatedTicket: open })
  }
}))
