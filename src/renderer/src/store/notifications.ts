import { create } from 'zustand'
import { useTabsStore } from './tabs'

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

export interface ToastItem {
  id: string
  ticketId: number
  title: string
  body: string
}

interface NotificationsState {
  settings: NotificationSettings | null
  sounds: { name: string; dataUrl: string | null }[]
  history: NotificationItem[]
  toasts: ToastItem[]
  
  init: () => Promise<void>
  loadSettings: () => Promise<void>
  saveSettings: (settings: NotificationSettings) => Promise<void>
  loadSounds: () => Promise<void>
  loadHistory: () => Promise<void>
  
  addToast: (toast: Omit<ToastItem, 'id'>) => void
  removeToast: (id: string) => void
  
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  
  playSound: (name: string, volume: number) => void
}

function playSynthChime(volume = 1.0) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime
    
    const frequencies = [440, 554.37, 659.25, 880]
    const gains = [0.4, 0.2, 0.1, 0.05]
    
    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(volume, now)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
    masterGain.connect(ctx.destination)
    
    frequencies.forEach((f, i) => {
      const osc = ctx.createOscillator()
      const gNode = ctx.createGain()
      
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, now)
      
      gNode.gain.setValueAtTime(gains[i], now)
      gNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.0)
      
      osc.connect(gNode)
      gNode.connect(masterGain)
      
      osc.start(now)
      osc.stop(now + 1.3)
    })
  } catch {}
}

export const useNotificationsStore = create<NotificationsState>((set, get) => {
  let isInitialized = false
  let lastSoundTime = 0

  return {
    settings: null,
    sounds: [],
    history: [],
    toasts: [],

    init: async () => {
      if (isInitialized) return
      isInitialized = true

      await get().loadSettings()
      await get().loadSounds()
      await get().loadHistory()

      window.api.notifications.onClickAction((ticketId) => {
        window.focus()
        const targetPath = `/dashboard/tickets/${ticketId}`
        const { tabs, setActive, openTab } = useTabsStore.getState()
        const existingTab = tabs.find(t => t.path === targetPath || t.initialPath === targetPath)
        if (existingTab) {
          setActive(existingTab.id)
        } else {
          openTab(targetPath)
        }
        const { history, markAsRead } = get()
        const unread = history.filter(item => item.ticketId === ticketId && !item.isRead)
        for (const item of unread) {
          markAsRead(item.id)
        }
      })

      window.api.notifications.onNewNotification((notif) => {
        set((state) => {
          // Three changes in a row on one ticket used to become three entries.
          // An unread notification about the same ticket is replaced by the
          // newer one instead: it says the same thing, only fresher.
          const withoutSameTicket = state.history.filter(
            item => !(item.ticketId === notif.ticketId && !item.isRead)
          )
          return { history: [notif, ...withoutSameTicket].slice(0, 100) }
        })

        if (notif.soundEnabled) {
          get().playSound(notif.sound, notif.volume)
        }

        if (notif.toastEnabled) {
          const isFocused = document.hasFocus()
          if (isFocused) {
            get().addToast({
              ticketId: notif.ticketId,
              title: notif.title,
              body: notif.body
            })
          }
        }
      })
    },

    loadSettings: async () => {
      try {
        const settings = await window.api.notifications.getSettings()
        set({ settings })
      } catch {}
    },

    saveSettings: async (settings) => {
      try {
        await window.api.notifications.saveSettings(settings)
        set({ settings })
      } catch {}
    },

    loadSounds: async () => {
      try {
        const sounds = await window.api.notifications.getSounds()
        set({ sounds })
      } catch {}
    },

    loadHistory: async () => {
      try {
        const history = await window.api.notifications.getHistory()
        set({ history })
      } catch {}
    },

    addToast: (toast) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      set((state) => {
        // One ticket - one toast on screen: a burst of changes replaces its own
        // message instead of stacking three of them.
        const nextToasts = [...state.toasts.filter(t => t.ticketId !== toast.ticketId), { ...toast, id }]
        if (nextToasts.length > 3) {
          nextToasts.shift()
        }
        return { toasts: nextToasts }
      })

      setTimeout(() => {
        get().removeToast(id)
      }, 12000)
    },

    removeToast: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }))
    },

    markAsRead: async (id) => {
      try {
        await window.api.notifications.markAsRead(id)
        set((state) => ({
          history: state.history.map((item) =>
            item.id === id ? { ...item, isRead: true } : item
          )
        }))
      } catch {}
    },

    markAllAsRead: async () => {
      try {
        await window.api.notifications.markAllAsRead()
        set((state) => ({
          history: state.history.map((item) => ({ ...item, isRead: true }))
        }))
      } catch {}
    },

    playSound: (name, volume) => {
      const now = Date.now()
      if (now - lastSoundTime < 1000) {
        return
      }
      lastSoundTime = now

      if (name === 'synth-chime') {
        playSynthChime(volume)
        return
      }

      const sound = get().sounds.find((s) => s.name === name)
      if (sound && sound.dataUrl) {
        try {
          const audio = new Audio(sound.dataUrl)
          audio.volume = volume
          audio.play().catch(() => {})
        } catch {}
      }
    }
  }
})
