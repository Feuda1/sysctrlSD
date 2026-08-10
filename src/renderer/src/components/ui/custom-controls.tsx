import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toDateTimeLocalValue } from '@/lib/ticketFormat'

/**
 * Form controls of the ticket page: a select, a multi-select, a toggle and a
 * date-time picker. They are page-independent, and other screens carry their own
 * copies of the same widgets — this is the single place they should come from.
 */
export function CustomToggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
    >
      <span className={cn(
        "flex h-4 w-4 items-center justify-center rounded border transition-colors",
        checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/40"
      )}>
        {checked && <Check className="h-3 w-3" />}
      </span>
      {label}
    </button>
  )
}

export function CustomSelect<T extends { id: number | string; name: string }>({
  value,
  options,
  onChange,
  placeholder = 'Выберите',
  searchable = false,
  renderValue,
  renderOption
}: {
  value: number | string | null
  options: T[]
  onChange: (value: T) => void
  placeholder?: string
  searchable?: boolean
  renderValue?: (value: T | undefined) => ReactNode
  renderOption?: (value: T, active: boolean) => ReactNode
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const portalRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const selected = options.find(option => String(option.id) === String(value))
  const filteredOptions = query.trim()
    ? options.filter(option => option.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    const updateCoords = () => {
      if (rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect()
        setCoords({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        })
      }
    }
    updateCoords()
    window.addEventListener('resize', updateCoords)
    window.addEventListener('scroll', updateCoords, true)
    
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        // By ref, not by id: several instances of the control can be mounted at
        // once (tabs stay alive), and getElementById would answer with the wrong one.
        if (!portalRef.current?.contains(event.target as Node)) {
          setOpen(false)
          setQuery('')
        }
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords, true)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/25 px-2.5 text-left text-xs text-foreground outline-none transition-colors hover:bg-muted/45"
      >
        <span className="min-w-0 flex-1 truncate">{renderValue ? renderValue(selected) : (selected?.name || placeholder)}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && createPortal(
        <div
          ref={portalRef}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`
          }}
          className="z-[9999] mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl"
        >
          {searchable && (
            <div className="sticky top-0 z-10 bg-card p-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Поиск..."
                  className="h-8 w-full rounded-md border border-border bg-muted/25 pl-7 pr-2 text-xs text-foreground outline-none focus:border-primary/60"
                  autoFocus
                />
              </div>
            </div>
          )}
          {filteredOptions.map(option => {
            const active = String(option.id) === String(value)
            return (
              <button
                key={String(option.id)}
                type="button"
                onClick={() => {
                  onChange(option)
                  setOpen(false)
                  setQuery('')
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                  active && "bg-primary/10 text-primary font-semibold"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{renderOption ? renderOption(option, active) : option.name}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            )
          })}
          {filteredOptions.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">Не найдено</div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export function CustomMultiSelect<T extends { id: number | string; name: string }>({
  values,
  options,
  onChange,
  placeholder = 'Выберите',
  searchable = true,
  renderChip
}: {
  values: Array<number | string>
  options: T[]
  onChange: (values: T[]) => void
  placeholder?: string
  searchable?: boolean
  renderChip?: (value: T) => ReactNode
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.filter(option => values.some(value => String(value) === String(option.id)))
  const selectedIds = new Set(values.map(value => String(value)))
  const filteredOptions = query.trim()
    ? options.filter(option => option.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const toggle = (item: T) => {
    const exists = selectedIds.has(String(item.id))
    const next = exists
      ? selected.filter(option => String(option.id) !== String(item.id))
      : [...selected, item]
    onChange(next)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/25 px-2.5 py-1.5 text-left text-xs text-foreground outline-none transition-colors hover:bg-muted/45"
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : selected.slice(0, 3).map(item => (
            <span key={String(item.id)} className="inline-flex max-w-full items-center rounded-full border border-border bg-background/40 px-2 py-0.5 text-[11px]">
              {renderChip ? renderChip(item) : <span className="truncate">{item.name}</span>}
            </span>
          ))}
          {selected.length > 3 && <span className="text-[11px] text-muted-foreground">+{selected.length - 3}</span>}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-72 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-xl">
          {searchable && (
            <div className="sticky top-0 z-10 bg-card p-1">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Поиск..."
                  className="h-8 w-full rounded-md border border-border bg-muted/25 pl-7 pr-2 text-xs text-foreground outline-none focus:border-primary/60"
                  autoFocus
                />
              </div>
            </div>
          )}
          {filteredOptions.map(option => {
            const active = selectedIds.has(String(option.id))
            return (
              <button
                key={String(option.id)}
                type="button"
                onClick={() => toggle(option)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
                  active && "bg-primary/10 text-primary font-semibold"
                )}
              >
                <span className="truncate">{option.name}</span>
                <span className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border"
                )}>
                  {active && <Check className="h-3 w-3" />}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function CustomDateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const portalRef = useRef<HTMLDivElement | null>(null)
  const hasValue = !!value
  const baseDate = value ? new Date(value) : new Date()
  const validDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0 })
  const [viewDate, setViewDate] = useState(new Date(validDate.getFullYear(), validDate.getMonth(), 1))
  const selectedDay = new Date(validDate.getFullYear(), validDate.getMonth(), validDate.getDate())
  const hour = validDate.getHours()
  const minute = validDate.getMinutes()
  const monthLabel = viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  useEffect(() => {
    setViewDate(new Date(validDate.getFullYear(), validDate.getMonth(), 1))
  }, [value])

  // Rendered in a portal with fixed positioning so it isn't clipped by the
  // scrollable params panel; flips upward when there's no room below.
  useEffect(() => {
    if (!open) return
    const PICKER_W = 288
    const reposition = () => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const left = Math.max(8, Math.min(rect.right - PICKER_W, window.innerWidth - PICKER_W - 8))
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 380 && rect.top > spaceBelow) {
        setCoords({ left, bottom: window.innerHeight - rect.top + 6 })
      } else {
        setCoords({ left, top: rect.bottom + 6 })
      }
    }
    reposition()
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, true)
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        if (!portalRef.current?.contains(event.target as Node)) setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition, true)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [open])

  const update = (patch: Partial<{ year: number; month: number; day: number; hour: number; minute: number }>) => {
    const next = new Date(validDate)
    if (patch.year !== undefined) next.setFullYear(patch.year)
    if (patch.month !== undefined) next.setMonth(patch.month)
    if (patch.day !== undefined) next.setDate(patch.day)
    if (patch.hour !== undefined) next.setHours(patch.hour)
    if (patch.minute !== undefined) next.setMinutes(patch.minute)
    next.setSeconds(0, 0)
    onChange(toDateTimeLocalValue(next))
  }

  const updateNumber = (field: 'hour' | 'minute', rawValue: string) => {
    const digits = rawValue.replace(/\D/g, '')
    if (!digits) {
      update({ [field]: 0 })
      return
    }
    const max = field === 'hour' ? 23 : 59
    update({ [field]: Math.min(max, Math.max(0, Number(digits))) })
  }

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate()
  const firstDay = (new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay() + 6) % 7
  const cells = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ]

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/25 px-2.5 text-left text-xs text-foreground transition-colors hover:bg-muted/45"
      >
        <span className={cn("truncate", !hasValue && "text-muted-foreground")}>
          {hasValue ? validDate.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Не задано'}
        </span>
        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && createPortal(
        <div
          ref={portalRef}
          style={{ position: 'fixed', left: coords.left, top: coords.top, bottom: coords.bottom, width: 288 }}
          className="z-[9999] rounded-lg border border-border bg-card p-3 shadow-xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="rounded p-1 hover:bg-accent" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold capitalize text-foreground">{monthLabel}</span>
            <button type="button" className="rounded p-1 hover:bg-accent" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              const active = day !== null && selectedDay.getFullYear() === viewDate.getFullYear() && selectedDay.getMonth() === viewDate.getMonth() && selectedDay.getDate() === day
              return day === null ? (
                <span key={`empty-${index}`} className="h-8" />
              ) : (
                <button
                  key={day}
                  type="button"
                  onClick={() => update({ year: viewDate.getFullYear(), month: viewDate.getMonth(), day })}
                  className={cn("h-8 rounded-md text-xs hover:bg-accent", active && "bg-primary text-primary-foreground hover:bg-primary")}
                >
                  {day}
                </button>
              )
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border bg-muted/20 p-2">
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Часы</span>
              <div className="mt-1 flex items-center justify-between">
                <button type="button" className="rounded px-2 py-1 hover:bg-accent" onClick={() => update({ hour: (hour + 23) % 24 })}>-</button>
                <input
                  value={String(hour).padStart(2, '0')}
                  onChange={event => updateNumber('hour', event.target.value)}
                  inputMode="numeric"
                  className="w-10 bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none"
                />
                <button type="button" className="rounded px-2 py-1 hover:bg-accent" onClick={() => update({ hour: (hour + 1) % 24 })}>+</button>
              </div>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-2">
              <span className="block text-[10px] font-semibold uppercase text-muted-foreground">Минуты</span>
              <div className="mt-1 flex items-center justify-between">
                <button type="button" className="rounded px-2 py-1 hover:bg-accent" onClick={() => update({ minute: (minute + 59) % 60 })}>-</button>
                <input
                  value={String(minute).padStart(2, '0')}
                  onChange={event => updateNumber('minute', event.target.value)}
                  inputMode="numeric"
                  className="w-10 bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none"
                />
                <button type="button" className="rounded px-2 py-1 hover:bg-accent" onClick={() => update({ minute: (minute + 1) % 60 })}>+</button>
              </div>
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
              onClick={() => {
                if (!value) onChange(toDateTimeLocalValue(validDate))
                setOpen(false)
              }}
            >
              Готово
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
