import { create } from 'zustand'

type Theme = 'dark' | 'light' | 'gray' | 'system'
type ResolvedTheme = 'dark' | 'light' | 'gray'

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
const SIDEBAR_SIDE_KEY = 'ui.sidebarSide'
const TICKET_PANEL_SIDE_KEY = 'ui.ticketPanelSide'
const SCROLL_DOWN_SIDE_KEY = 'ui.scrollDownSide'
const OPEN_CREATED_TICKET_KEY = 'ui.openCreatedTicket'
const OPEN_TAB_IN_BACKGROUND_KEY = 'ui.openTabInBackground'
const SUGGEST_STATE_KEY = 'ui.suggestStateOnSend'
const SUGGEST_REASON_KEY = 'ui.suggestReasonOnSend'

// По умолчанию выключено: «открыть в новой вкладке» до сих пор сразу
// переключало на неё, и менять это без спроса значит ломать привычку.
function getStoredOpenTabInBackground(): boolean {
  return window.localStorage.getItem(OPEN_TAB_IN_BACKGROUND_KEY) === '1'
}

// Both suggestions are on by default: they only appear when something is
// actually missing, so they cost nothing until they are useful.
function getStoredSuggestState(): boolean {
  return window.localStorage.getItem(SUGGEST_STATE_KEY) !== '0'
}

function getStoredSuggestReason(): boolean {
  return window.localStorage.getItem(SUGGEST_REASON_KEY) !== '0'
}

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

function getStoredSidebarSide(): SidebarSide {
  return window.localStorage.getItem(SIDEBAR_SIDE_KEY) === 'right' ? 'right' : 'left'
}

function getStoredTicketPanelSide(): TicketPanelSide {
  return window.localStorage.getItem(TICKET_PANEL_SIDE_KEY) === 'left' ? 'left' : 'right'
}

function getStoredScrollDownSide(): ScrollDownSide {
  const stored = window.localStorage.getItem(SCROLL_DOWN_SIDE_KEY)
  return stored === 'left' || stored === 'right' ? stored : 'auto'
}

function getStoredChatStyle(): 'modern' | 'classic' {
  const stored = window.localStorage.getItem(CHAT_STYLE_STORAGE_KEY)
  return stored === 'classic' ? 'classic' : 'modern'
}

type BubbleSide = 'client-right' | 'client-left'

/** Which edge of the window the navigation rail is docked to. */
export type SidebarSide = 'left' | 'right'
/** Which side of the ticket screen holds the "Параметры заявки" column. */
export type TicketPanelSide = 'right' | 'left'
/** Corner of the scroll-to-bottom button; 'auto' keeps it away from the panel. */
export type ScrollDownSide = 'auto' | 'left' | 'right'

/** Resolves 'auto' against the panel side, so the two never end up stacked. */
export function resolveScrollDownSide(side: ScrollDownSide, panelSide: TicketPanelSide): 'left' | 'right' {
  if (side !== 'auto') return side
  return panelSide === 'left' ? 'right' : 'left'
}

function getStoredBubbleSide(): BubbleSide {
  return window.localStorage.getItem(BUBBLE_SIDE_STORAGE_KEY) === 'client-left' ? 'client-left' : 'client-right'
}

function getStoredTheme(): Theme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'gray' || stored === 'system' ? stored : 'dark'
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
  /** Edge the navigation rail is docked to. */
  sidebarSide: SidebarSide
  setSidebarSide: (side: SidebarSide) => void
  /** Side of the ticket screen the parameters panel sits on. */
  ticketPanelSide: TicketPanelSide
  setTicketPanelSide: (side: TicketPanelSide) => void
  /** Corner of the scroll-to-bottom button inside a ticket. */
  scrollDownSide: ScrollDownSide
  setScrollDownSide: (side: ScrollDownSide) => void
  openCreatedTicket: boolean
  setOpenCreatedTicket: (open: boolean) => void
  /** Открывать вкладку из контекстного меню в фоне, не переключаясь на неё. */
  openTabInBackground: boolean
  setOpenTabInBackground: (enabled: boolean) => void
  /** Offer the ticket state in the send dialog when it was not changed. */
  suggestStateOnSend: boolean
  setSuggestStateOnSend: (enabled: boolean) => void
  /** Offer the iiko reason in the send dialog when it is empty. */
  suggestReasonOnSend: boolean
  setSuggestReasonOnSend: (enabled: boolean) => void
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
  sidebarSide: getStoredSidebarSide(),
  ticketPanelSide: getStoredTicketPanelSide(),
  scrollDownSide: getStoredScrollDownSide(),
  openCreatedTicket: getStoredOpenCreatedTicket(),
  openTabInBackground: getStoredOpenTabInBackground(),
  suggestStateOnSend: getStoredSuggestState(),
  suggestReasonOnSend: getStoredSuggestReason(),
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
    document.documentElement.classList.toggle('gray', resolved === 'gray')
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

  setSidebarSide: (side) => {
    window.localStorage.setItem(SIDEBAR_SIDE_KEY, side)
    set({ sidebarSide: side })
  },

  setTicketPanelSide: (side) => {
    window.localStorage.setItem(TICKET_PANEL_SIDE_KEY, side)
    set({ ticketPanelSide: side })
  },

  setScrollDownSide: (side) => {
    window.localStorage.setItem(SCROLL_DOWN_SIDE_KEY, side)
    set({ scrollDownSide: side })
  },

  setOpenTabInBackground: (enabled) => {
    window.localStorage.setItem(OPEN_TAB_IN_BACKGROUND_KEY, enabled ? '1' : '0')
    set({ openTabInBackground: enabled })
  },

  setSuggestStateOnSend: (enabled) => {
    window.localStorage.setItem(SUGGEST_STATE_KEY, enabled ? '1' : '0')
    set({ suggestStateOnSend: enabled })
  },

  setSuggestReasonOnSend: (enabled) => {
    window.localStorage.setItem(SUGGEST_REASON_KEY, enabled ? '1' : '0')
    set({ suggestReasonOnSend: enabled })
  },

  setOpenCreatedTicket: (open) => {
    window.localStorage.setItem(OPEN_CREATED_TICKET_KEY, open ? '1' : '0')
    set({ openCreatedTicket: open })
  }
}))
