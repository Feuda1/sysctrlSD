import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useTabsStore } from '@/store/tabs'
import { cn } from '@/lib/utils'
import { ticketIdFromPath } from '@/lib/tabTitles'
import { TabNavBridge } from './TabNavBridge'

// Every screen is its own chunk: the window used to wait for one 1.9 MB bundle
// before showing anything, while a session usually touches two or three screens.
const TicketsPage = lazy(() => import('@/pages/TicketsPage'))
const TicketDetailsPage = lazy(() => import('@/pages/TicketDetailsPage'))
const OrganizationsPage = lazy(() => import('@/pages/OrganizationsPage'))
const CallsPage = lazy(() => import('@/pages/CallsPage'))
const FormsPage = lazy(() => import('@/pages/FormsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

/** Pulls the neighbouring screens in once the first one is on screen, so opening
 * them later feels instant. */
function usePrefetchScreens() {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      import('@/pages/TicketDetailsPage')
      import('@/pages/CallsPage')
    }, 2000)
    return () => window.clearTimeout(timer)
  }, [])
}

function ScreenFallback() {
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )
}

// A tab opened directly on a ticket detail (e.g. middle-click) gets the list
// seeded as its previous entry, so Back returns to the list like in a browser.
function seedEntries(path: string): { entries: string[]; index: number } {
  if (ticketIdFromPath(path)) return { entries: ['/dashboard/tickets', path], index: 1 }
  return { entries: [path], index: 0 }
}

function TabRoutes() {
  usePrefetchScreens()

  return (
    <Suspense fallback={<ScreenFallback />}>
    <Routes>
      <Route path="/dashboard/tickets" element={<TicketsPage />} />
      <Route path="/dashboard/tickets/:ticketId" element={<TicketDetailsPage />} />
      <Route path="/dashboard/organizations" element={<OrganizationsPage />} />
      <Route path="/dashboard/calls" element={<CallsPage />} />
      <Route path="/dashboard/forms" element={<FormsPage />} />
      <Route path="/dashboard/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/dashboard/tickets" replace />} />
    </Routes>
    </Suspense>
  )
}

/**
 * Renders every tab mounted at once; only the active one is visible. Keeping
 * inactive tabs mounted preserves their React state, scroll and form inputs -
 * the same trick the old dashboard used for the forms page.
 */
export function TabHost() {
  const tabs = useTabsStore(s => s.tabs)
  const activeTabId = useTabsStore(s => s.activeTabId)

  return (
    <div className="relative min-h-0 flex-1">
      {tabs.map(tab => {
        const seed = seedEntries(tab.initialPath)
        return (
        <div
          key={tab.id}
          className={cn('absolute inset-0', tab.id === activeTabId ? 'flex flex-col' : 'hidden')}
        >
          <MemoryRouter initialEntries={seed.entries} initialIndex={seed.index}>
            <TabNavBridge tabId={tab.id} seededBack={seed.index > 0} />
            <main className="select-text relative flex min-h-0 flex-1 flex-col overflow-auto p-6">
              <TabRoutes />
            </main>
          </MemoryRouter>
        </div>
        )
      })}
    </div>
  )
}
