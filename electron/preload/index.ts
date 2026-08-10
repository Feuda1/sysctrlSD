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
  /** Notify when someone awards points on my ticket. */
  scoreEnabled?: boolean
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
  type: 'message' | 'status' | 'owner' | 'score' | 'other'
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

/**
 * Electron wraps everything an IPC handler throws into
 * "Error invoking remote method 'tickets:create': Error: <текст>", and that whole
 * string used to end up in front of the user. Only the message the handler wrote
 * is of any use to them; the channel name goes to the console instead.
 */
function cleanIpcError(error: unknown, channel: string): Error {
  const raw = error instanceof Error ? error.message : String(error)
  const withoutChannel = raw.replace(/^Error invoking remote method '[^']*':\s*/, '')
  const message = withoutChannel.replace(/^(?:Error|TypeError|RangeError):\s*/, '').trim()
  const cleaned = new Error(message || 'Не удалось выполнить операцию')
  cleaned.stack = error instanceof Error ? error.stack : undefined
  console.error(`IPC ${channel} failed:`, raw)
  return cleaned
}

async function invoke(channel: string, ...args: unknown[]): Promise<any> {
  try {
    return await ipcRenderer.invoke(channel, ...args)
  } catch (error) {
    throw cleanIpcError(error, channel)
  }
}

const api = {
  auth: {
    login: (email: string, password: string): Promise<AuthResult> =>
      invoke('auth:login', email, password),
    logout: (): Promise<void> =>
      invoke('auth:logout'),
    restore: (): Promise<AuthResult | null> =>
      invoke('auth:restore'),
    setZammadToken: (token: string): Promise<AppUser> =>
      invoke('auth:setZammadToken', token),
    updateAvatar: (avatarDataUrl: string): Promise<AppUser> =>
      invoke('auth:updateAvatar', avatarDataUrl),
    getClientProfileSettings: (): Promise<ClientProfileSettings> =>
      invoke('auth:getClientProfileSettings'),
    updateClientProfileSettings: (patch: ClientProfileSettingsPatch): Promise<ClientProfileSettings> =>
      invoke('auth:updateClientProfileSettings', patch),
    hasZammadToken: (): Promise<boolean> =>
      invoke('auth:hasZammadToken')
  },
  window: {
    minimize: (): Promise<void> => invoke('window:minimize'),
    maximize: (): Promise<void> => invoke('window:maximize'),
    close: (): Promise<void> => invoke('window:close'),
    isMaximized: (): Promise<boolean> => invoke('window:isMaximized'),
    onStateChange: (callback: (state: { maximized: boolean }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, state: { maximized: boolean }) =>
        callback(state)
      ipcRenderer.on('window:state', handler)
      return () => ipcRenderer.removeListener('window:state', handler)
    }
  },
  windows: {
    open: (initialPath: string, bounds?: { x?: number; y?: number; width?: number; height?: number }): Promise<void> =>
      invoke('windows:open', initialPath, bounds),
    // Initial route for a freshly opened window, read from the URL query.
    getInitialPath: (): string | null =>
      new URLSearchParams(window.location.search).get('initialPath')
  },
  app: {
    getExtensionInfo: (): Promise<{ path: string; packaged: boolean }> =>
      invoke('app:getExtensionInfo'),
    getVersion: (): Promise<string> => invoke('app:getVersion'),
    showContextMenu: (
      items: { id?: string; label?: string; type?: 'separator'; enabled?: boolean }[]
    ): Promise<string | null> => invoke('app:showContextMenu', items)
  },
  ai: {
    complete: (params: { systemPrompt: string; userText: string; apiKey: string; provider: 'groq' | 'deepseek' | 'openrouter' }): Promise<string> =>
      invoke('ai:complete', params)
  },
  deeplink: {
    onOpenTicket: (callback: (clientsNumber: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, num: string) => callback(num)
      ipcRenderer.on('deeplink:open-ticket', handler)
      return () => ipcRenderer.removeListener('deeplink:open-ticket', handler)
    }
  },
  theme: {
    get: (): Promise<'dark' | 'light'> => invoke('theme:get'),
    set: (theme: 'dark' | 'light' | 'system'): Promise<'dark' | 'light'> =>
      invoke('theme:set', theme)
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
      createdFrom?: string
      createdTo?: string
      dateField?: 'created' | 'closed'
    }) => invoke('tickets:list', params),
    getMyTicketsCounts: (): Promise<any> =>
      invoke('tickets:getMyTicketsCounts'),
    getFilters: () => invoke('tickets:getFilters'),
    savePinned: (pinned: { wrapperId: number; name: string }[]) =>
      invoke('tickets:savePinned', pinned),
    saveFilters: (filters: any[]) =>
      invoke('tickets:saveFilters', filters),
    saveStateColors: (colors: Record<number, string>) =>
      invoke('tickets:saveStateColors', colors),
    setToken: (token: string) => invoke('tickets:setToken', token),
    getDetails: (ticketId: number): Promise<{ ticket: any; customer: any; organization: any }> =>
      invoke('tickets:getDetails', ticketId),
    getArticles: (ticketId: number): Promise<any[]> =>
      invoke('tickets:getArticles', ticketId),
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
      uploadId?: string
    }) => invoke('tickets:addComment', params),
    getAttachment: (ticketId: number, articleId: number, attachmentId: number): Promise<{ dataUrl: string; contentType: string }> =>
      invoke('tickets:getAttachment', ticketId, articleId, attachmentId),
    cancelUpload: (uploadId: string): Promise<boolean> => invoke('tickets:cancelUpload', uploadId),
    onUploadProgress: (callback: (progress: { uploadId: string; sent: number; total: number }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, progress: { uploadId: string; sent: number; total: number }) => callback(progress)
      ipcRenderer.on('tickets:upload-progress', handler)
      return () => { ipcRenderer.removeListener('tickets:upload-progress', handler) }
    },
    setScore: (ticketId: number, score: string, ignoreClientsRight?: boolean): Promise<{ ok: true }> =>
      invoke('tickets:setScore', ticketId, score, ignoreClientsRight),
    exportTicket: (
      ticketId: number,
      options: { text: boolean; images: boolean; files: boolean }
    ): Promise<{ ok: boolean; canceled?: boolean; path?: string; savedImages?: number; savedFiles?: number }> =>
      invoke('tickets:export', ticketId, options),
    getHistory: (ticketId: number): Promise<any[]> =>
      invoke('tickets:getHistory', ticketId),
    searchForMerge: (query: string): Promise<any[]> =>
      invoke('tickets:searchForMerge', query),
    merge: (sourceTicketId: number, targetTicketNumber: string): Promise<{ ok: boolean }> =>
      invoke('tickets:merge', sourceTicketId, targetTicketNumber),
    changeCustomer: (ticketId: number, customerId: number): Promise<{ ok: boolean }> =>
      invoke('tickets:changeCustomer', ticketId, customerId),
    createSubTicket: (params: any): Promise<{ ok: boolean; newTicketId?: number }> =>
      invoke('tickets:createSubTicket', params),
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
      invoke('tickets:createFromCall', params),
    resolveClientsNumber: (num: string): Promise<number | null> =>
      invoke('tickets:resolveClientsNumber', num),
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
      invoke('organizations:list', params),
    getMembers: (orgId: number) =>
      invoke('organizations:getMembers', orgId),
    getTickets: (orgId: number) =>
      invoke('organizations:getTickets', orgId),
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
    search: (query: string) => invoke('users:search', query),
    create: (userPayload: any): Promise<any> =>
      invoke('users:create', userPayload),
    update: (userId: number, userPayload: any): Promise<{ ok: boolean }> =>
      invoke('users:update', userId, userPayload)
  },
  forms: {
    list: (): Promise<{ name: string; forms: { id: number; name: string }[] }[]> =>
      invoke('forms:list')
  },
  calls: {
    getAll: (params?: { query?: string; page?: number; perPage?: number }): Promise<CallsResponse> =>
      invoke('calls:getAll', params),
    getRecording: (url: string): Promise<CallRecording> => invoke('calls:getRecording', url),
    bindToTicket: (params: { ticketId: string; src: string; dst: string; callId: string; duration: string; date: string }): Promise<{ ok: boolean }> =>
      invoke('calls:bindToTicket', params),
    onCallsUpdated: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('calls:updated', handler)
      return () => { ipcRenderer.removeListener('calls:updated', handler) }
    }
  },
  updater: {
    check: (): Promise<{ ok: boolean; dev?: boolean }> => invoke('updater:check'),
    install: (): Promise<void> => invoke('updater:install'),
    getState: (): Promise<UpdateState> => invoke('updater:get-state'),
    onStatus: (callback: (state: UpdateState) => void) => {
      const handler = (_: Electron.IpcRendererEvent, state: UpdateState) => callback(state)
      ipcRenderer.on('updater:status', handler)
      return () => { ipcRenderer.removeListener('updater:status', handler) }
    }
  },
  notifications: {
    getSettings: (): Promise<NotificationSettings> => invoke('notifications:getSettings'),
    saveSettings: (settings: NotificationSettings): Promise<void> => invoke('notifications:saveSettings', settings),
    getSounds: (): Promise<string[]> => invoke('notifications:getSounds'),
    uploadSound: (name: string, dataUrl: string): Promise<void> => invoke('notifications:uploadSound', name, dataUrl),
    getHistory: (): Promise<NotificationItem[]> => invoke('notifications:getHistory'),
    markAsRead: (id: string): Promise<void> => invoke('notifications:markAsRead', id),
    markAllAsRead: (): Promise<void> => invoke('notifications:markAllAsRead'),
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
