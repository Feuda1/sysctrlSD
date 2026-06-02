import { MemoryRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useTabsStore } from '@/store/tabs'
import { cn } from '@/lib/utils'
import { ticketIdFromPath } from '@/lib/tabTitles'
import { TabNavBridge } from './TabNavBridge'
import TicketsPage from '@/pages/TicketsPage'
import TicketDetailsPage from '@/pages/TicketDetailsPage'
import OrganizationsPage from '@/pages/OrganizationsPage'
import CallsPage from '@/pages/CallsPage'
import FormsPage from '@/pages/FormsPage'
import SettingsPage from '@/pages/SettingsPage'

// A tab opened directly on a ticket detail (e.g. middle-click) gets the list
// seeded as its previous entry, so Back returns to the list like in a browser.
function seedEntries(path: string): { entries: string[]; index: number } {
  if (ticketIdFromPath(path)) return { entries: ['/dashboard/tickets', path], index: 1 }
  return { entries: [path], index: 0 }
}

function TabRoutes() {
  return (
    <Routes>
      <Route path="/dashboard/tickets" element={<TicketsPage />} />
      <Route path="/dashboard/tickets/:ticketId" element={<TicketDetailsPage />} />
      <Route path="/dashboard/organizations" element={<OrganizationsPage />} />
      <Route path="/dashboard/calls" element={<CallsPage />} />
      <Route path="/dashboard/forms" element={<FormsPage />} />
      <Route path="/dashboard/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/dashboard/tickets" replace />} />
    </Routes>
  )
}

/**
 * Renders every tab mounted at once; only the active one is visible. Keeping
 * inactive tabs mounted preserves their React state, scroll and form inputs —
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
