import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { OfflineBanner } from '@/components/layout/OfflineBanner'
import { BroadcastBanner } from '@/components/layout/BroadcastBanner'
import { OutboxIndicator } from '@/components/layout/OutboxIndicator'
import { QuickActionModal } from '@/components/tickets/QuickActionModal'
import { useAuthStore } from '@/store/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { TabBar } from '@/components/layout/TabBar'
import { TabHost } from '@/components/layout/TabHost'
import { useTabsStore } from '@/store/tabs'
import { useTicketFilters, useMyTicketsCounts } from '@/hooks/useTickets'
import { queryClient } from '@/lib/queryClient'
import { QuickTicketModal } from '@/components/tickets/QuickTicketModal'
import { showContextMenu, separator } from '@/lib/contextMenu'
import { ticketIdFromPath } from '@/lib/tabTitles'
import { useUIStore } from '@/store/ui'

export default function DashboardPage() {
  const status = useAuthStore((s) => s.status)
  const openTab = useTabsStore((s) => s.openTab)
  const navigateActive = useTabsStore((s) => s.navigateActive)
  const openInNewWindow = useTabsStore((s) => s.openInNewWindow)
  const openTabInBackground = useUIStore((s) => s.openTabInBackground)

  useTicketFilters()
  useMyTicketsCounts()

  useEffect(() => {
    if (status !== 'authenticated') return

    queryClient.prefetchQuery({
      queryKey: ['ticket-filters'],
      queryFn: () => window.api.tickets.getFilters(),
      staleTime: 300_000
    }).then((filtersData: any) => {
      const firstFilter = filtersData?.allFilters
        ?.filter((filter: any) => filter.enabled !== false)
        ?.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))[0]
      if (!firstFilter) return

      const params = {
        wrapperId: firstFilter.wrapperId,
        page: 1,
        perPage: 50,
        sortField: 'updatedAt',
        sortAsc: false,
        searchQuery: ''
      }
      queryClient.prefetchQuery({
        queryKey: ['tickets', params.wrapperId, params.page, params.perPage, params.sortField, params.sortAsc, params.searchQuery],
        queryFn: () => window.api.tickets.list(params),
        staleTime: 30_000
      })
    })

    queryClient.prefetchQuery({
      queryKey: ['organizations', '', 1],
      queryFn: () => window.api.organizations.list({ query: '*', page: 1, perPage: 50 }),
      staleTime: 30_000
    })

    queryClient.prefetchQuery({
      queryKey: ['calls', '', 1],
      queryFn: () => window.api.calls.getAll({ query: '', page: 1, perPage: 50 }),
      staleTime: 15_000
    })
  }, [status])

  // Anything tagged with data-tab-path (ticket rows, my-ticket cards, links in
  // articles) gets the same menu, so the actions follow the target instead of
  // the generic edit menu.
  const [quickAction, setQuickAction] = useState<{ ticketId: number; title: string } | null>(null)

  const showTargetContextMenu = async (e: React.MouseEvent) => {
    // An image carries its own menu (copy/save), built in the main process from
    // what is painted under the cursor - never shadow it.
    if ((e.target as HTMLElement).tagName === 'IMG') return

    const el = (e.target as HTMLElement).closest('[data-tab-path]')
    const path = el?.getAttribute('data-tab-path')
    if (!path) return

    e.preventDefault()
    const ticketId = ticketIdFromPath(path)
    const picked = await showContextMenu([
      { id: 'open', label: 'Открыть' },
      { id: 'new-tab', label: 'Открыть в новой вкладке' },
      { id: 'new-window', label: 'Открыть в отдельном окне' },
      ...(ticketId
        ? [
            separator(),
            { id: 'quick-action', label: 'Быстрое действие…' },
            separator(),
            { id: 'copy-id', label: `Копировать номер заявки (${ticketId})` }
          ]
        : [])
    ])

    if (picked === 'open') navigateActive(path)
    // Настройкой можно оставаться на месте: вкладка открывается, но фокус с
    // текущей заявки не уводит - так удобно набирать список и разбирать его потом.
    else if (picked === 'new-tab') openTab(path, { background: openTabInBackground })
    else if (picked === 'new-window') openInNewWindow(path)
    else if (picked === 'copy-id' && ticketId) navigator.clipboard.writeText(ticketId)
    else if (picked === 'quick-action' && ticketId) {
      // Заголовок берём из строки таблицы: он же попадёт в плашку отправки.
      const title = el?.getAttribute('data-ticket-title') || `Заявка #${ticketId}`
      setQuickAction({ ticketId: Number(ticketId), title })
    }
  }

  const openFromEvent = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-tab-path]')
    const path = el?.getAttribute('data-tab-path')
    if (!path) return false
    e.preventDefault()
    e.stopPropagation()
    openTab(path, { background: true })
    return true
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-background"
      onMouseDownCapture={(e) => {
        if (e.button === 1 && (e.target as HTMLElement).closest('[data-tab-path]')) e.preventDefault()
      }}
      onAuxClickCapture={(e) => { if (e.button === 1) openFromEvent(e) }}
      onContextMenuCapture={(e) => { showTargetContextMenu(e) }}
      onClickCapture={(e) => { if (e.ctrlKey || e.metaKey) openFromEvent(e) }}
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TabBar />
        <OfflineBanner />
        <BroadcastBanner />
        <TabHost />
      </div>
      <QuickTicketModal />
      <AnimatePresence>
        {quickAction && (
          <QuickActionModal
            ticketId={quickAction.ticketId}
            ticketTitle={quickAction.title}
            onClose={() => setQuickAction(null)}
          />
        )}
      </AnimatePresence>
      <OutboxIndicator />
    </div>
  )
}
