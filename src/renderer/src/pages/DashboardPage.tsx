import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { Sidebar } from '@/components/layout/Sidebar'
import { TabBar } from '@/components/layout/TabBar'
import { TabHost } from '@/components/layout/TabHost'
import { useTabsStore } from '@/store/tabs'
import { useTicketFilters, useMyTicketsCounts } from '@/hooks/useTickets'
import { queryClient } from '@/lib/queryClient'
import { QuickTicketModal } from '@/components/tickets/QuickTicketModal'

export default function DashboardPage() {
  const status = useAuthStore((s) => s.status)
  const openTab = useTabsStore((s) => s.openTab)

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
      onClickCapture={(e) => { if (e.ctrlKey || e.metaKey) openFromEvent(e) }}
    >
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TabBar />
        <TabHost />
      </div>
      <QuickTicketModal />
    </div>
  )
}
