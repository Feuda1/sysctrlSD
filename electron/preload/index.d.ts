import { AppUser, AuthResult, CallRecording, CallsResponse, ClientProfileSettings, ClientProfileSettingsPatch, UpdateInfo, UpdateState, FilterNotificationRule, NotificationSettings, NotificationItem } from './index'

declare global {
  interface Window {
    api: {
      auth: {
        login: (email: string, password: string) => Promise<AuthResult>
        logout: () => Promise<void>
        restore: () => Promise<AuthResult | null>
        setZammadToken: (token: string) => Promise<AppUser>
        updateAvatar: (avatarDataUrl: string) => Promise<AppUser>
        getClientProfileSettings: () => Promise<ClientProfileSettings>
        updateClientProfileSettings: (patch: ClientProfileSettingsPatch) => Promise<ClientProfileSettings>
        hasZammadToken: () => Promise<boolean>
      }
      window: {
        minimize: () => Promise<void>
        maximize: () => Promise<void>
        close: () => Promise<void>
        isMaximized: () => Promise<boolean>
        onStateChange: (callback: (state: { maximized: boolean }) => void) => () => void
      }
      windows: {
        open: (initialPath: string, bounds?: { x?: number; y?: number; width?: number; height?: number }) => Promise<void>
        getInitialPath: () => string | null
      }
      app: {
        getExtensionInfo: () => Promise<{ path: string; packaged: boolean }>
        getVersion: () => Promise<string>
      }
      deeplink: {
        onOpenTicket: (callback: (clientsNumber: string) => void) => () => void
      }
      theme: {
        get: () => Promise<'dark' | 'light'>
        set: (theme: 'dark' | 'light' | 'system') => Promise<'dark' | 'light'>
      }
      tickets: {
        list: (params: {
          wrapperId: number
          page: number
          perPage: number
          sortField: string
          sortAsc: boolean
          searchQuery?: string
          myTicketsStateId?: number
        }) => Promise<any>
        getMyTicketsCounts: () => Promise<any>
        getFilters: () => Promise<any>
        savePinned: (pinned: { wrapperId: number; name: string }[]) => Promise<void>
        saveFilters: (filters: any[]) => Promise<void>
        saveStateColors: (colors: Record<number, string>) => Promise<void>
        setToken: (token: string) => Promise<void>
        getDetails: (ticketId: number) => Promise<{ ticket: any; customer: any; organization: any }>
        getArticles: (ticketId: number) => Promise<any[]>
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
        }) => Promise<any>
        getAttachment: (ticketId: number, articleId: number, attachmentId: number) => Promise<{ dataUrl: string; contentType: string }>
        getHistory: (ticketId: number) => Promise<any[]>
        searchForMerge: (query: string) => Promise<any[]>
        merge: (sourceTicketId: number, targetTicketNumber: string) => Promise<{ ok: boolean }>
        changeCustomer: (ticketId: number, customerId: number) => Promise<{ ok: boolean }>
        createSubTicket: (params: {
          parentTicketId: number
          title: string
          body: string
          groupId: number
          ownerId: number
          type: string
          priorityId: number
          stateId: number
          timeUnit: number
        }) => Promise<{ ok: boolean; newTicketId?: number }>
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
        }) => Promise<{ ok: boolean; newTicketId?: number }>
        resolveClientsNumber: (num: string) => Promise<number | null>
        onTicketUpdated: (callback: (ticketId: number) => void) => () => void
        onArticlesUpdated: (callback: (ticketId: number) => void) => () => void
        onListUpdated: (callback: () => void) => () => void
      }
      organizations: {
        list: (params: { query: string; page?: number; perPage?: number }) => Promise<any>
        getMembers: (orgId: number) => Promise<any>
        getTickets: (orgId: number) => Promise<any>
        onOrganizationsUpdated: (callback: (orgId?: number) => void) => () => void
      }
      users: {
        search: (query: string) => Promise<any>
        create: (userPayload: any) => Promise<any>
        update: (userId: number, userPayload: any) => Promise<{ ok: boolean }>
      }
      forms: {
        list: () => Promise<{ name: string; forms: { id: number; name: string }[] }[]>
      }
      calls: {
        getAll: (params?: { query?: string; page?: number; perPage?: number }) => Promise<CallsResponse>
        getRecording: (url: string) => Promise<CallRecording>
        bindToTicket: (params: {
          ticketId: string
          src: string
          dst: string
          callId: string
          duration: string
          date: string
        }) => Promise<{ ok: boolean }>
        onCallsUpdated: (callback: () => void) => () => void
      }
      updater: {
        check: () => Promise<{ ok: boolean; dev?: boolean }>
        install: () => Promise<void>
        getState: () => Promise<UpdateState>
        onStatus: (callback: (state: UpdateState) => void) => () => void
      }
      notifications: {
        getSettings: () => Promise<NotificationSettings>
        saveSettings: (settings: NotificationSettings) => Promise<void>
        getSounds: () => Promise<{ name: string; dataUrl: string | null }[]>
        uploadSound: (name: string, dataUrl: string) => Promise<void>
        getHistory: () => Promise<NotificationItem[]>
        markAsRead: (id: string) => Promise<void>
        markAllAsRead: () => Promise<void>
        onNewNotification: (callback: (notif: NotificationItem) => void) => () => void
        onClickAction: (callback: (ticketId: number) => void) => () => void
      }
      navigation: {
        onGoToTab: (callback: (path: string) => void) => () => void
      }
    }
  }
}
