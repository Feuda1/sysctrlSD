import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TicketFilter } from '@/types/ticket'

interface FilterTabsProps {
  tabs: TicketFilter[]
  activeFilter: TicketFilter | null
  onSelect: (filter: TicketFilter) => void
}

export function FilterTabs({ tabs, activeFilter, onSelect }: FilterTabsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [q, setQ] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = tabs.filter(t => t.name.toLowerCase().includes(q.trim().toLowerCase()))

  const handleSelect = (tab: TicketFilter) => {
    onSelect(tab)
    setIsOpen(false)
    setQ('')
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-56 items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-sm min-h-[32px]"
      >
        <span className="truncate">Фильтр: {activeFilter?.name || 'Не выбран'}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-30 mt-1 w-80 rounded-2xl border border-border shadow-xl bg-card p-2 space-y-2 flex flex-col max-h-[350px]">
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Поиск фильтра..."
              className="w-full rounded-lg border border-input bg-input/60 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-primary/60"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5 pr-0.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground text-center">Фильтры не найдены</p>
            ) : (
              filtered.map(tab => {
                const isActive = activeFilter?.wrapperId === tab.wrapperId
                return (
                  <button
                    key={tab.wrapperId}
                    type="button"
                    onClick={() => handleSelect(tab)}
                    className={cn(
                      'w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-accent',
                      isActive && 'bg-primary/5 text-primary font-medium'
                    )}
                  >
                      <span className="truncate pr-3">{tab.name}</span>
                    {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
