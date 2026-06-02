import { useEffect, useRef } from 'react'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useTabsStore } from '@/store/tabs'
import { pathToTabMeta, ticketIdFromPath } from '@/lib/tabTitles'
import { queryClient } from '@/lib/queryClient'

/**
 * Lives inside each tab's MemoryRouter. Tracks the tab's own back/forward
 * history (via location keys, which survive POP in both directions), registers
 * an imperative controller in the tabs store, and keeps the tab's path/title
 * in sync for the chrome.
 */
export function TabNavBridge({ tabId, seededBack = false }: { tabId: string; seededBack?: boolean }) {
  const location = useLocation()
  const navType = useNavigationType()
  const navigate = useNavigate()

  const registerController = useTabsStore(s => s.registerController)
  const unregisterController = useTabsStore(s => s.unregisterController)
  const updateTabNav = useTabsStore(s => s.updateTabNav)
  const setTabTitle = useTabsStore(s => s.setTabTitle)

  // When the router was seeded with a previous entry (e.g. the list behind a
  // detail tab), represent that hidden entry with a placeholder so canGoBack is
  // correct; its real key is recorded the first time we navigate back into it.
  const stackRef = useRef<{ keys: string[]; index: number }>(
    seededBack ? { keys: ['__seed_back__', location.key], index: 1 } : { keys: [location.key], index: 0 }
  )

  useEffect(() => {
    registerController(tabId, {
      navigate: (path: string) => navigate(path),
      back: () => navigate(-1),
      forward: () => navigate(1)
    })
    return () => unregisterController(tabId)
  }, [tabId, navigate, registerController, unregisterController])

  useEffect(() => {
    const s = stackRef.current
    const known = s.keys.indexOf(location.key)
    if (navType === 'POP') {
      if (known !== -1) {
        s.index = known
      } else {
        // Navigated into a seeded (placeholder) entry — step back and record it.
        s.index = Math.max(0, s.index - 1)
        s.keys[s.index] = location.key
      }
    } else if (navType === 'REPLACE') {
      s.keys[s.index] = location.key
    } else {
      // PUSH — drop any forward entries and append.
      s.keys = [...s.keys.slice(0, s.index + 1), location.key]
      s.index = s.keys.length - 1
    }

    const path = location.pathname + location.search
    updateTabNav(tabId, {
      path,
      canGoBack: s.index > 0,
      canGoForward: s.index < s.keys.length - 1
    })

    // Title — prefer the client-facing ticket number from cache when available.
    const meta = pathToTabMeta(path)
    let title = meta.title
    const ticketId = ticketIdFromPath(path)
    if (ticketId) {
      const cached = queryClient.getQueryData(['ticket-details', Number(ticketId)]) as
        | { ticket?: { clientNumber?: string | number } }
        | undefined
      const num = cached?.ticket?.clientNumber
      title = `Заявка #${num || ticketId}`
    }
    setTabTitle(tabId, title)
  }, [location.key, location.pathname, location.search, navType, tabId, updateTabNav, setTabTitle])

  return null
}
