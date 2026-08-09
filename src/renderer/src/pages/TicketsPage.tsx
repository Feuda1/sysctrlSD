import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { type SortingState } from '@tanstack/react-table'
import { AlertCircle, Search, Settings2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { FilterTabs } from '@/components/tickets/FilterTabs'
import { TicketTable } from '@/components/tickets/TicketTable'
import { useTickets, useTicketFilters, useMyTicketsCounts } from '@/hooks/useTickets'
import { getStateBadgeClass, type Ticket, type TicketFilter } from '@/types/ticket'
import { ManageFiltersModal } from '@/components/tickets/ManageFiltersModal'
import { DateRangePicker, EMPTY_RANGE, type DateRange } from '@/components/tickets/DateRangePicker'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'

interface StateChipProps {
  state: { id: number; name: string; count: number }
  color?: string
  tickets: Ticket[]
  onOpenTicket: (ticketId: number) => void
}

// A state chip that opens a compact, anchored dropdown listing the user's
// tickets in that state — instead of taking over the whole content area.
function StateChip({ state, color, tickets, onOpenTicket }: StateChipProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const badgeClass = getStateBadgeClass(state.name)
  const style = color ? {
    backgroundColor: open ? `${color}30` : `${color}12`,
    color,
    borderColor: open ? color : `${color}25`,
    borderWidth: '1px'
  } : undefined

  useEffect(() => {
    if (!open) return
    const update = () => {
      if (rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect()
        setCoords({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX })
      }
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        const portal = document.getElementById('state-chip-portal')
        if (!portal?.contains(e.target as Node)) setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={() => setOpen(v => !v)}
        style={style}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-all duration-150 shadow-sm min-h-[32px] border border-border/50",
          open ? "shadow-md ring-1 ring-primary/45 border-transparent font-bold" : "opacity-85 hover:opacity-100",
          !color && badgeClass,
          !color && open && "ring-1 ring-primary/45"
        )}
      >
        <span>{state.name}</span>
        <span className="rounded-full bg-background/50 px-1.5 py-0.2 text-[10px] font-bold tabular-nums">
          {state.count}
        </span>
      </motion.button>

      {open && createPortal(
        <div
          id="state-chip-portal"
          style={{ position: 'absolute', top: `${coords.top}px`, left: `${coords.left}px`, width: '340px' }}
          className="z-[9999] max-h-[60vh] overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-2xl"
        >
          {tickets.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">Нет заявок в этом статусе</div>
          ) : tickets.map(ticket => (
            <div
              key={ticket.id}
              data-tab-path={`/dashboard/tickets/${ticket.id}`}
              onClick={() => { setOpen(false); onOpenTicket(ticket.id) }}
              className="flex flex-col gap-1 rounded-lg border border-transparent px-2.5 py-2 cursor-pointer hover:border-border/50 hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                <span className="shrink-0 font-mono">#{ticket.clientNumber || ticket.id}</span>
                {ticket.organization?.name && (
                  <span className="min-w-0 truncate">{ticket.organization.name}</span>
                )}
              </div>
              <span className="whitespace-normal break-words text-xs font-medium leading-snug text-foreground">{ticket.title}</span>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

const SORTING_STORAGE_KEY = 'tickets.sorting'
const ACTIVE_FILTER_STORAGE_KEY = 'tickets.activeFilterWrapperId'
const DATE_RANGE_STORAGE_KEY = 'tickets.dateRange'

// Same reason as the filter above: opening a ticket unmounts the list, and the
// chosen period has to survive that.
function readStoredDateRange(): DateRange {
  try {
    const raw = window.localStorage.getItem(DATE_RANGE_STORAGE_KEY)
    if (!raw) return EMPTY_RANGE
    const parsed = JSON.parse(raw) as DateRange
    const isDay = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    return {
      from: isDay(parsed?.from) ? parsed.from : null,
      to: isDay(parsed?.to) ? parsed.to : null
    }
  } catch {
    return EMPTY_RANGE
  }
}
const DEFAULT_SORTING: SortingState = [{ id: 'updatedAt', desc: true }]

// Opening a ticket unmounts this page, so the chosen filter has to outlive the
// component — otherwise coming back always lands on the first tab.
function readStoredFilterWrapperId(): number | null {
  const raw = Number(window.localStorage.getItem(ACTIVE_FILTER_STORAGE_KEY))
  return Number.isFinite(raw) && raw > 0 ? raw : null
}

function readStoredSorting(): SortingState {
  try {
    const raw = window.localStorage.getItem(SORTING_STORAGE_KEY)
    if (!raw) return DEFAULT_SORTING

    const parsed = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      typeof parsed[0]?.id === 'string' &&
      typeof parsed[0]?.desc === 'boolean'
    ) {
      return [{ id: parsed[0].id, desc: parsed[0].desc }]
    }
  } catch {}

  return DEFAULT_SORTING
}

export default function TicketsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [activeFilterWrapperId, setActiveFilterWrapperId] = useState<number | null>(() => readStoredFilterWrapperId())
  const [dateRange, setDateRange] = useState<DateRange>(() => readStoredDateRange())
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [sorting, setSorting] = useState<SortingState>(() => readStoredSorting())

  const sortField = sorting[0]?.id ?? 'updatedAt'
  const sortAsc = sorting[0] ? !sorting[0].desc : false

  const searchQuery = useUIStore(s => s.searchQuery)
  const setSearchQuery = useUIStore(s => s.setSearchQuery)
  const [localSearchQuery, setLocalSearchQuery] = useState(searchQuery)

  const { data: myCountsData } = useMyTicketsCounts()
  const activeMyCounts = myCountsData?.counts ?? {}
  const myActiveTickets = myCountsData?.tickets ?? []

  useEffect(() => {
    setLocalSearchQuery(searchQuery)
  }, [searchQuery])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchQuery(localSearchQuery)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [localSearchQuery, setSearchQuery])

  useEffect(() => {
    setPage(1)
  }, [searchQuery])

  const { data: filtersData, isLoading: filtersLoading } = useTicketFilters()
  const allFilters = filtersData?.allFilters ?? []
  const tabs = allFilters
    .filter(f => f.enabled !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const currentFilter = tabs.find(f => f.wrapperId === activeFilterWrapperId) ?? tabs[0] ?? null

  const activeStatesWithCounts = (filtersData?.states ?? [])
    .map(state => ({
      ...state,
      count: activeMyCounts[state.id] ?? 0
    }))
    .filter(state => {
      const name = state.name.toLowerCase()
      return state.count > 0 && name !== 'закрыта' && name !== 'closed'
    })

  const params = {
    wrapperId: currentFilter?.wrapperId ?? 0,
    page,
    perPage: 50,
    sortField,
    sortAsc,
    searchQuery,
    myTicketsStateId: undefined,
    createdFrom: dateRange.from ?? undefined,
    createdTo: dateRange.to ?? undefined
  }

  const { data, isLoading, isPlaceholderData, isError, error } = useTickets(
    params,
    !!currentFilter || (!!searchQuery && searchQuery.trim().length > 0)
  )

  const handleFilterSelect = (filter: TicketFilter) => {
    setActiveFilterWrapperId(filter.wrapperId)
    window.localStorage.setItem(ACTIVE_FILTER_STORAGE_KEY, String(filter.wrapperId))
    setPage(1)
  }

  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range)
    if (range.from || range.to) {
      window.localStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify(range))
    } else {
      window.localStorage.removeItem(DATE_RANGE_STORAGE_KEY)
    }
    setPage(1)
  }

  const handleSortChange = (newSorting: SortingState) => {
    const nextSorting = newSorting.length > 0 ? newSorting : DEFAULT_SORTING
    setSorting(nextSorting)
    window.localStorage.setItem(SORTING_STORAGE_KEY, JSON.stringify(nextSorting))
    setPage(1)
  }

  if (filtersLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 min-h-0">
      <div className="shrink-0 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <DateRangePicker value={dateRange} onChange={handleDateRangeChange} />
          <FilterTabs
            tabs={tabs}
            activeFilter={currentFilter}
            onSelect={handleFilterSelect}
          />
          {activeStatesWithCounts.map(state => (
            <StateChip
              key={state.id}
              state={state}
              color={filtersData?.stateColors?.[state.id]}
              tickets={myActiveTickets.filter(t => t.state?.id === state.id)}
              onOpenTicket={(id) => navigate(`/dashboard/tickets/${id}`)}
            />
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={localSearchQuery}
              onChange={event => setLocalSearchQuery(event.target.value)}
              placeholder="Поиск заявок…"
              className="h-8 w-full rounded-md border border-border bg-muted/50 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground transition-colors duration-150 focus:border-primary/60 focus:outline-none"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsModalOpen(true)}
            className="h-8 w-8 rounded-full border border-border/40 hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error?.message ?? 'Ошибка загрузки заявок'}</span>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {(
          <TicketTable
            tickets={data?.tickets ?? []}
            total={data?.total ?? 0}
            page={data?.page ?? page}
            totalPages={data?.totalPages ?? 1}
            sorting={sorting}
            isLoading={isLoading || isPlaceholderData}
            onSortChange={handleSortChange}
            onPageChange={setPage}
            visibleColumns={currentFilter?.conditions?.columns}
            stateColors={filtersData?.stateColors}
            onRowClick={(ticketId) => navigate(`/dashboard/tickets/${ticketId}`)}
          />
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <ManageFiltersModal
            filters={allFilters}
            states={filtersData?.states ?? []}
            priorities={filtersData?.priorities ?? []}
            groups={filtersData?.groups ?? []}
            ticketTypes={filtersData?.ticketTypes ?? []}
            iikoReasons={filtersData?.iikoReasons ?? []}
            tags={filtersData?.tags ?? []}
            stateColors={filtersData?.stateColors ?? {}}
            onClose={() => {
              setIsModalOpen(false)
              queryClient.invalidateQueries({ queryKey: ['ticket-filters'] })
              queryClient.invalidateQueries({ queryKey: ['tickets'] })
            }}
            onSave={async (updatedFilters) => {
              await window.api.tickets.saveFilters(updatedFilters)
              queryClient.invalidateQueries({ queryKey: ['ticket-filters'] })
              queryClient.invalidateQueries({ queryKey: ['tickets'] })
            }}
            onSaveColors={async (updatedColors) => {
              await window.api.tickets.saveStateColors(updatedColors)
              queryClient.invalidateQueries({ queryKey: ['ticket-filters'] })
              queryClient.invalidateQueries({ queryKey: ['tickets'] })
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
