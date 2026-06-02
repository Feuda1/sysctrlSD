import { create } from 'zustand'

export interface AppUser {
  id?: number
  email: string
  login: string
  firstname: string
  lastname: string
  image?: string | null
  avatarDataUrl?: string | null
}

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error'

let restoreInFlight: Promise<void> | null = null

interface AuthState {
  status: AuthStatus
  user: AppUser | null
  zammadTokenSet: boolean
  error: string | null

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  restore: () => Promise<void>
  clearError: () => void
  setZammadToken: (token: string) => Promise<void>
  updateAvatar: (avatarDataUrl: string) => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'idle',
  user: null,
  zammadTokenSet: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ status: 'loading', error: null })
    try {
      const result = await window.api.auth.login(email, password)
      set({
        status: 'authenticated',
        user: result.user,
        zammadTokenSet: result.zammadTokenSet,
        error: null
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка входа'
      set({ status: 'error', error: message })
      throw err
    }
  },

  logout: async () => {
    await window.api.auth.logout()
    set({ status: 'unauthenticated', user: null, zammadTokenSet: false, error: null })
  },

  restore: () => {
    if (restoreInFlight) return restoreInFlight

    restoreInFlight = (async () => {
      set({ status: 'loading' })
      try {
        const result = await window.api.auth.restore()
        if (result) {
          set({
            status: 'authenticated',
            user: result.user,
            zammadTokenSet: result.zammadTokenSet,
            error: null
          })
        } else {
          set({ status: 'unauthenticated' })
        }
      } catch {
        set({ status: 'unauthenticated' })
      } finally {
        restoreInFlight = null
      }
    })()

    return restoreInFlight
  },

  clearError: () => set({ error: null }),

  setZammadToken: async (token: string) => {
    const user = await window.api.auth.setZammadToken(token)
    set({ user, zammadTokenSet: true })
  },

  updateAvatar: async (avatarDataUrl: string) => {
    const user = await window.api.auth.updateAvatar(avatarDataUrl)
    set({ user, zammadTokenSet: true })
  }
}))
