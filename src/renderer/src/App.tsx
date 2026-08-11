import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAuthStore } from './store/auth'
import { useUIStore } from './store/ui'
import { useTabsStore } from './store/tabs'
import { queryClient } from './lib/queryClient'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import { useNotificationsStore } from './store/notifications'
import { NotificationToast } from './components/notifications/NotificationToast'
import { UpdateNotification } from './components/UpdateNotification'
import { WindowControls } from './components/layout/WindowControls'

function RestoreScreen() {
  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-background">
      <motion.div
        className="pointer-events-none absolute"
        style={{
          width: 720, height: 520,
          top: '-5%', left: '-12%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, hsl(217 91% 60% / 0.17) 0%, transparent 68%)',
          filter: 'blur(48px)',
        }}
        animate={{ x: [0, 55, 20, 0], y: [0, -35, 25, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute"
        style={{
          width: 640, height: 580,
          bottom: '-18%', right: '-8%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, hsl(240 70% 65% / 0.13) 0%, transparent 65%)',
          filter: 'blur(64px)',
        }}
        animate={{ x: [0, -45, 12, 0], y: [0, 28, -18, 0] }}
        transition={{ duration: 21, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div
        className="pointer-events-none absolute"
        style={{
          width: 480, height: 420,
          top: '45%', left: '38%',
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, hsl(195 90% 55% / 0.1) 0%, transparent 60%)',
          filter: 'blur(52px)',
        }}
        animate={{ x: [0, 32, -38, 0], y: [0, -48, 18, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />
      <motion.p
        className="relative z-10 select-none text-[11px] font-semibold tracking-[0.3em] text-foreground/20 uppercase"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 0.15, ease: 'easeOut' }}
      >
        sysctrlsd
      </motion.p>
    </div>
  )
}

export default function App() {
  const status = useAuthStore((s) => s.status)
  const restore = useAuthStore((s) => s.restore)
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const setUpdateState = useUIStore((s) => s.setUpdateState)
  const initNotifications = useNotificationsStore((s) => s.init)

  useEffect(() => { restore() }, [restore])

  // A file dropped anywhere but a drop target would make the window navigate to
  // it — the app would simply vanish and show the file instead.
  useEffect(() => {
    const swallow = (event: DragEvent) => event.preventDefault()
    window.addEventListener('dragover', swallow)
    window.addEventListener('drop', swallow)
    return () => {
      window.removeEventListener('dragover', swallow)
      window.removeEventListener('drop', swallow)
    }
  }, [])

  useEffect(() => { setTheme(theme) }, [setTheme, theme])

  useEffect(() => {
    if (status === 'authenticated') {
      initNotifications()
    }
  }, [status, initNotifications])

  useEffect(() => {
    const unsubTicket = window.api.tickets.onTicketUpdated((ticketId) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-details', ticketId] })
    })
    const unsubArticles = window.api.tickets.onArticlesUpdated((ticketId) => {
      queryClient.invalidateQueries({ queryKey: ['ticket-articles', ticketId] })
    })
    const unsubList = window.api.tickets.onListUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    })
    const unsubCalls = window.api.calls.onCallsUpdated(() => {
      queryClient.invalidateQueries({ queryKey: ['calls'] })
    })
    const unsubOrgs = window.api.organizations.onOrganizationsUpdated((orgId) => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ['org-members', orgId] })
        queryClient.invalidateQueries({ queryKey: ['org-tickets', orgId] })
      } else {
        queryClient.invalidateQueries({ queryKey: ['organizations'] })
      }
    })

    return () => {
      unsubTicket()
      unsubArticles()
      unsubList()
      unsubCalls()
      unsubOrgs()
    }
  }, [])

  useEffect(() => {
    const unsubNav = window.api.navigation.onGoToTab((targetPath) => {
      const { tabs, setActive, openTab } = useTabsStore.getState()
      const existingTab = tabs.find(t => t.path === targetPath || t.initialPath === targetPath)
      if (existingTab) {
        setActive(existingTab.id)
      } else {
        openTab(targetPath)
      }
    })
    return () => {
      unsubNav()
    }
  }, [])

  useEffect(() => {
    window.api.updater.getState().then(setUpdateState).catch(() => {})
    return window.api.updater.onStatus(setUpdateState)
  }, [setUpdateState])

  // Deep links (sysctrlsd://ticket/<clientsNumber>) from the browser extension.
  // The clients number is resolved to a Zammad id and opened in a tab; if it
  // arrives before login it is buffered and flushed once authenticated.
  const pendingDeepLink = useRef<string | null>(null)
  const processDeepLink = (num: string) => {
    window.api.tickets.resolveClientsNumber(num)
      .then((zammadId) => {
        if (zammadId) useTabsStore.getState().openTab(`/dashboard/tickets/${zammadId}`)
      })
      .catch((err) => console.error('Не удалось открыть заявку из ссылки:', err))
  }
  useEffect(() => {
    return window.api.deeplink.onOpenTicket((num) => {
      if (useAuthStore.getState().status === 'authenticated') processDeepLink(num)
      else pendingDeepLink.current = num
    })
  }, [])
  useEffect(() => {
    if (status === 'authenticated' && pendingDeepLink.current) {
      const num = pendingDeepLink.current
      pendingDeepLink.current = null
      processDeepLink(num)
    }
  }, [status])

  // Кнопки окна рисуем сами и показываем всегда: они нужны и на входе, и на
  // восстановлении сессии, а не только внутри приложения.
  return (
    <>
      <WindowControls />
      {status === 'idle' || status === 'loading' ? (
        <RestoreScreen />
      ) : status !== 'authenticated' ? (
        <LoginPage />
      ) : (
        <>
          <DashboardPage />
          <NotificationToast />
          <UpdateNotification />
        </>
      )}
    </>
  )
}
