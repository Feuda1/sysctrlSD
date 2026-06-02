import { contextBridge, ipcRenderer } from 'electron'

export type AppUser = {
  id?: number
  email: string
  login: string
  firstname: string
  lastname: string
  image?: string | null
  avatarDataUrl?: string | null
}

export type AuthResult = {
  user: AppUser
  zammadTokenSet: boolean
}

export type ClientProfileSettings = {
  zammadApiKey: string
  internalPhone: string
  defaultGroupId: string
  defaultGroupName: string
  groupOptions: { value: string; label: string }[]
}

export type ClientProfileSettingsPatch = Partial<{
  zammadApiKey: string
  internalPhone: string
  defaultGroupId: string
}>

export type UpdateInfo = {
  version: string
  releaseDate?: string
}

export type UpdateStatus =
  | 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'

export type UpdateState = {
  status: UpdateStatus
  version?: string
  percent?: number
  error?: string
}

export interface FilterNotificationRule {
  wrapperId: number
  enabled: boolean
  sound: string
  volume: number
  soundEnabled?: boolean
  toastEnabled?: boolean
}

export interface NotificationSettings {
  myTicketsEnabled: boolean
  myTicketsSound: string
  myTicketsVolume: number
  myTicketsSoundEnabled?: boolean
  myTicketsToastEnabled?: boolean
  rules: FilterNotificationRule[]
  closeToTrayEnabled?: boolean
}

export interface NotificationItem {
  id: string
  ticketId: number
  ticketNumber: string
  title: string
  body: string
  sound: string
  volume: number
  soundEnabled: boolean
  toastEnabled: boolean
  isRead: boolean
  createdAt: string
  type: 'message' | 'status' | 'owner' | 'other'
}

export type CallSectionKey = 'history' | 'mine' | 'current'

export type CallRecord = {
  id: string
  callId: string | null
  section: CallSectionKey
  direction: 'in' | 'out' | 'missed' | 'unknown'
  phone: string | null
  client: string | null
  organization: string | null
  operator: string | null
  startedAt: string | null
  duration: string | null
  status: string | null
  recordingUrl: string | null
  sourceUrl: string | null
  raw: Record<string, string>
  isLinked?: boolean
  linkedTicketId?: string | null
  createCandidates?: { clientId: string; name: string }[]
  bindCandidates?: { ticketId: string; name: string }[]
}

export type CallsResponse = {
  history: CallRecord[]
  mine: CallRecord[]
  current: CallRecord[]
  fetchedAt: string
}

export type CallRecording = {
  dataUrl: string
  contentType: string
}

const api = {
  auth: {
    login: (email: string, password: string): Promise<AuthResult> =>
      ipcRenderer.invoke('auth:login', email, password),
    logout: (): Promise<void> =>
      ipcRenderer.invoke('auth:logout'),
    restore: (): Promise<AuthResult | null> =>
      ipcRenderer.invoke('auth:restore'),
    setZammadToken: (token: string): Promise<AppUser> =>
      ipcRenderer.invoke('auth:setZammadToken', token),
    updateAvatar: (avatarDataUrl: string): Promise<AppUser> =>
      ipcRenderer.invoke('auth:updateAvatar', avatarDataUrl),
    getClientProfileSettings: (): Promise<ClientProfileSettings> =>
      ipcRenderer.invoke('auth:getClientProfileSettings'),
    updateClientProfileSettings: (patch: ClientProfileSettingsPatch): Promise<ClientProfileSettings> =>
      ipcRenderer.invoke('auth:updateClientProfileSettings', patch),
    hasZammadToken: (): Promise<boolean> =>
      ipcRenderer.invoke('auth:hasZammadToken')
  },
  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onStateChange: (callback: (state: { maximized: boolean }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, state: { maximized: boolean }) =>
        callback(state)
      ipcRenderer.on('window:state', handler)
      return () => ipcRenderer.removeListener('window:state', handler)
    }
  },
  windows: {
    open: (initialPath: string, bounds?: { x?: number; y?: number; width?: number; height?: number }): Promise<void> =>
      ipcRenderer.invoke('windows:open', initialPath, bounds),
    // Initial route for a freshly opened window, read from the URL query.
    getInitialPath: (): string | null =>
      new URLSearchParams(window.location.search).get('initialPath')
  },
  app: {
    getExtensionInfo: (): Promise<{ path: string; packaged: boolean }> =>
      ipcRenderer.invoke('app:getExtensionInfo'),
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion')
  },
  ai: {
    complete: (params: { systemPrompt: string; userText: string; apiKey: string; provider: 'groq' | 'deepseek' }): Promise<string> =>
      ipcRenderer.invoke('ai:complete', params)
  },
  deeplink: {
    onOpenTicket: (callback: (clientsNumber: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, num: string) => callback(num)
      ipcRenderer.on('deeplink:open-ticket', handler)
      return () => ipcRenderer.removeListener('deeplink:open-ticket', handler)
    }
  },
  theme: {
    get: (): Promise<'dark' | 'light'> => ipcRenderer.invoke('theme:get'),
    set: (theme: 'dark' | 'light' | 'system'): Promise<'dark' | 'light'> =>
      ipcRenderer.invoke('theme:set', theme)
  },
  tickets: {
    list: (params: {
      wrapperId: number
      page: number
      perPage: number
      sortField: string
      sortAsc: boolean
      searchQuery?: string
      myTicketsStateId?: number
    }) => ipcRenderer.invoke('tickets:list', params),
    getMyTicketsCounts: (): Promise<any> =>
      ipcRenderer.invoke('tickets:getMyTicketsCounts'),
    getFilters: () => ipcRenderer.invoke('tickets:getFilters'),
    savePinned: (pinned: { wrapperId: number; name: string }[]) =>
      ipcRenderer.invoke('tickets:savePinned', pinned),
    saveFilters: (filters: any[]) =>
      ipcRenderer.invoke('tickets:saveFilters', filters),
    saveStateColors: (colors: Record<number, string>) =>
      ipcRenderer.invoke('tickets:saveStateColors', colors),
    setToken: (token: string) => ipcRenderer.invoke('tickets:setToken', token),
    getDetails: (ticketId: number): Promise<{ ticket: any; customer: any; organization: any }> =>
      ipcRenderer.invoke('tickets:getDetails', ticketId),
    getArticles: (ticketId: number): Promise<any[]> =>
      ipcRenderer.invoke('tickets:getArticles', ticketId),
    addComment: (params: {
      ticketId: number
      body: string
      internal?: boolean
      articleType?: string
      stateId?: number
      ticketTypeId?: string | null
      groupId?: number | null
      ownerId?: number | null
      priorityId?: number | null
      iikoReasonIds?: string[]
      tagIds?: string[]
      pendingTime?: string | null
      timeUnit?: number | null
      attachments?: { filename: string; data: string; mimeType: string }[]
    }) => ipcRenderer.invoke('tickets:addComment', params),
    getAttachment: (ticketId: number, articleId: number, attachmentId: number): Promise<{ dataUrl: string; contentType: string }> =>
      ipcRenderer.invoke('tickets:getAttachment', ticketId, articleId, attachmentId),
    getHistory: (ticketId: number): Promise<any[]> =>
      ipcRenderer.invoke('tickets:getHistory', ticketId),
    searchForMerge: (query: string): Promise<any[]> =>
      ipcRenderer.invoke('tickets:searchForMerge', query),
    merge: (sourceTicketId: number, targetTicketNumber: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('tickets:merge', sourceTicketId, targetTicketNumber),
    changeCustomer: (ticketId: number, customerId: number): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('tickets:changeCustomer', ticketId, customerId),
    createSubTicket: (params: any): Promise<{ ok: boolean; newTicketId?: number }> =>
      ipcRenderer.invoke('tickets:createSubTicket', params),
    createFromCall: (params: {
      clientId?: number | null
      title: string
      body: string
      phone: string
      callId: string
      date: string
      duration: string
      ticketType?: string
      groupId?: string
      userId?: string
      priorityId?: string
      stateId?: string
      pendingTime?: string | null
      timeUnit?: string
    }): Promise<{ ok: boolean; newTicketId?: number }> =>
      ipcRenderer.invoke('tickets:createFromCall', params),
    resolveClientsNumber: (num: string): Promise<number | null> =>
      ipcRenderer.invoke('tickets:resolveClientsNumber', num),
    onTicketUpdated: (callback: (ticketId: number) => void) => {
      const handler = (_: any, ticketId: number) => callback(ticketId)
      ipcRenderer.on('tickets:details-updated', handler)
      return () => { ipcRenderer.removeListener('tickets:details-updated', handler) }
    },
    onArticlesUpdated: (callback: (ticketId: number) => void) => {
      const handler = (_: any, ticketId: number) => callback(ticketId)
      ipcRenderer.on('tickets:articles-updated', handler)
      return () => { ipcRenderer.removeListener('tickets:articles-updated', handler) }
    },
    onListUpdated: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('tickets:list-updated', handler)
      return () => { ipcRenderer.removeListener('tickets:list-updated', handler) }
    }
  },
  organizations: {
    list: (params: { query: string; page: number; perPage: number }) =>
      ipcRenderer.invoke('organizations:list', params),
    getMembers: (orgId: number) =>
      ipcRenderer.invoke('organizations:getMembers', orgId),
    getTickets: (orgId: number) =>
      ipcRenderer.invoke('organizations:getTickets', orgId),
    onOrganizationsUpdated: (callback: (orgId?: number) => void) => {
      const listHandler = () => callback()
      const membersHandler = (_: any, orgId?: number) => callback(orgId)
      const ticketsHandler = (_: any, orgId?: number) => callback(orgId)
      ipcRenderer.on('organizations:list-updated', listHandler)
      ipcRenderer.on('organizations:members-updated', membersHandler)
      ipcRenderer.on('organizations:tickets-updated', ticketsHandler)
      return () => {
        ipcRenderer.removeListener('organizations:list-updated', listHandler)
        ipcRenderer.removeListener('organizations:members-updated', membersHandler)
        ipcRenderer.removeListener('organizations:tickets-updated', ticketsHandler)
      }
    }
  },
  users: {
    search: (query: string) => ipcRenderer.invoke('users:search', query),
    create: (userPayload: any): Promise<any> =>
      ipcRenderer.invoke('users:create', userPayload),
    update: (userId: number, userPayload: any): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('users:update', userId, userPayload)
  },
  forms: {
    list: (): Promise<{ name: string; forms: { id: number; name: string }[] }[]> =>
      ipcRenderer.invoke('forms:list')
  },
  calls: {
    getAll: (params?: { query?: string; page?: number; perPage?: number }): Promise<CallsResponse> =>
      ipcRenderer.invoke('calls:getAll', params),
    getRecording: (url: string): Promise<CallRecording> => ipcRenderer.invoke('calls:getRecording', url),
    bindToTicket: (params: { ticketId: string; src: string; dst: string; callId: string; duration: string; date: string }): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('calls:bindToTicket', params),
    onCallsUpdated: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('calls:updated', handler)
      return () => { ipcRenderer.removeListener('calls:updated', handler) }
    }
  },
  updater: {
    check: (): Promise<{ ok: boolean; dev?: boolean }> => ipcRenderer.invoke('updater:check'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    getState: (): Promise<UpdateState> => ipcRenderer.invoke('updater:get-state'),
    onStatus: (callback: (state: UpdateState) => void) => {
      const handler = (_: Electron.IpcRendererEvent, state: UpdateState) => callback(state)
      ipcRenderer.on('updater:status', handler)
      return () => { ipcRenderer.removeListener('updater:status', handler) }
    }
  },
  notifications: {
    getSettings: (): Promise<NotificationSettings> => ipcRenderer.invoke('notifications:getSettings'),
    saveSettings: (settings: NotificationSettings): Promise<void> => ipcRenderer.invoke('notifications:saveSettings', settings),
    getSounds: (): Promise<string[]> => ipcRenderer.invoke('notifications:getSounds'),
    uploadSound: (name: string, dataUrl: string): Promise<void> => ipcRenderer.invoke('notifications:uploadSound', name, dataUrl),
    getHistory: (): Promise<NotificationItem[]> => ipcRenderer.invoke('notifications:getHistory'),
    markAsRead: (id: string): Promise<void> => ipcRenderer.invoke('notifications:markAsRead', id),
    markAllAsRead: (): Promise<void> => ipcRenderer.invoke('notifications:markAllAsRead'),
    onNewNotification: (callback: (notif: NotificationItem) => void) => {
      const handler = (_: any, notif: NotificationItem) => callback(notif)
      ipcRenderer.on('notifications:new', handler)
      return () => { ipcRenderer.removeListener('notifications:new', handler) }
    },
    onClickAction: (callback: (ticketId: number) => void) => {
      const handler = (_: any, ticketId: number) => callback(ticketId)
      ipcRenderer.on('notifications:click-action', handler)
      return () => { ipcRenderer.removeListener('notifications:click-action', handler) }
    }
  },
  navigation: {
    onGoToTab: (callback: (path: string) => void) => {
      const handler = (_: any, path: string) => callback(path)
      ipcRenderer.on('navigation:go-to-tab', handler)
      return () => { ipcRenderer.removeListener('navigation:go-to-tab', handler) }
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
