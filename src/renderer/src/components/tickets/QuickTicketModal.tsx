import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X, AlertCircle, Loader2, Check, Plus, Calendar, Paperclip,
  FileImage, FileText, FileArchive, ChevronLeft, ChevronRight,
  Search, ChevronDown
} from 'lucide-react'
import { useTabsStore } from '@/store/tabs'
import { Button } from '@/components/ui/button'
import { cn, readFileAsDataUrl, dataUrlPayload } from '@/lib/utils'
import { useTicketFilters } from '@/hooks/useTickets'
import { getStateBadgeClass, getTicketTypeBadgeClass } from '@/types/ticket'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { AiAssistButton } from '@/components/ai/AiAssistButton'

type ComposerAttachment = {
  id: string
  filename: string
  mimeType: string
  size: number
  dataUrl: string
}

function toDateTimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function tomorrowAtEleven(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(11, 0, 0, 0)
  return toDateTimeLocalValue(date)
}

function isPendingState(stateName: string, stateId: number): boolean {
  const n = stateName.toLowerCase()
  return n.includes('отложен') || n.includes('ожидан') || n.includes('pend') || stateId === 3 || stateId === 7 || stateId === 4
}

function isClosedState(stateName: string): boolean {
  const n = (stateName || '').toLowerCase().replace(/ё/g, 'е')
  return n.includes('закрыт') && !n.includes('ожида')
}

function toHtmlComment(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  if (!escaped.trim()) return ''
  // Zammad strips the style attribute, so line breaks must be real <br> elements.
  return `<div>${escaped.replace(/\r\n|\r|\n/g, '<br>')}</div>`
}

function resolveDefaultGroupId(
  groups: { id: number; name: string }[],
  id: string,
  name: string
): string {
  if (!id && !name) return ''
  const byId = groups.find(g => String(g.id) === String(id))
  if (byId) return String(byId.id)
  if (name) {
    const target = name.trim().toLowerCase()
    const byName = groups.find(g => g.name.trim().toLowerCase() === target)
    if (byName) return String(byName.id)
  }
  return ''
}

function attachmentKind(att: { filename: string; mimeType: string }): 'image' | 'text' | 'archive' | 'file' {
  const name = att.filename.toLowerCase()
  const type = att.mimeType.toLowerCase()
  if (type.startsWith('image/') || /\.(jpe?g|png|gif|webp|bmp)$/i.test(name)) return 'image'
  if (type.startsWith('text/') || /\.(txt|log|csv|json|xml|html|md|ini|conf)$/i.test(name)) return 'text'
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'archive'
  return 'file'
}

const TICKET_TYPE_NAMES: Record<string, string> = {
  'in': 'Внутренняя',
  'Incident': 'Заявка',
  'service': 'Плановая',
  'pay': 'Платная',
  'Problem': 'Проблема',
  'Request for Change': 'Проект',
  'kkt': 'Регистрация ККТ/Замена ФН',
  'repair': 'Ремонт техники'
}

function CustomDateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const hasValue = !!value
  const baseDate = value ? new Date(value) : new Date()
  const validDate = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState(new Date(validDate.getFullYear(), validDate.getMonth(), 1))
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const selectedDay = new Date(validDate.getFullYear(), validDate.getMonth(), validDate.getDate())
  const hour = validDate.getHours()
  const minute = validDate.getMinutes()
  const monthLabel = viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  useEffect(() => {
    setViewDate(new Date(validDate.getFullYear(), validDate.getMonth(), 1))
  }, [value])

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
        const portalContainer = document.getElementById('custom-datetime-portal-root-quick')
        if (!portalContainer?.contains(event.target as Node)) {
          setOpen(false)
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
          id="custom-datetime-portal-root-quick"
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left + coords.width - 288}px`,
            width: '288px'
          }}
          className="z-[9999] mt-1 rounded-lg border border-border bg-card p-3 shadow-xl"
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

function CustomSelect<T extends { id: number | string; name: string }>({
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
  renderValue?: (value: T | undefined) => React.ReactNode
  renderOption?: (value: T, active: boolean) => React.ReactNode
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
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
        const portalContainer = document.getElementById('custom-select-portal-root-quick')
        if (!portalContainer?.contains(event.target as Node)) {
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
          id="custom-select-portal-root-quick"
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

function CustomMultiSelect<T extends { id: number | string; name: string }>({
  values,
  options,
  onChange,
  placeholder = 'Выберите',
  searchable = true
}: {
  values: Array<number | string>
  options: T[]
  onChange: (values: T[]) => void
  placeholder?: string
  searchable?: boolean
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 })
  const selectedIds = new Set(values.map(value => String(value)))
  const selected = options.filter(option => selectedIds.has(String(option.id)))
  const filteredOptions = query.trim()
    ? options.filter(option => option.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    const updateCoords = () => {
      if (rootRef.current) {
        const rect = rootRef.current.getBoundingClientRect()
        setCoords({ top: rect.bottom + window.scrollY, left: rect.left + window.scrollX, width: rect.width })
      }
    }
    updateCoords()
    window.addEventListener('resize', updateCoords)
    window.addEventListener('scroll', updateCoords, true)
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        const portalContainer = document.getElementById('custom-multiselect-portal-root-quick')
        if (!portalContainer?.contains(event.target as Node)) {
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
              <span className="truncate">{item.name}</span>
            </span>
          ))}
          {selected.length > 3 && <span className="text-[11px] text-muted-foreground">+{selected.length - 3}</span>}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && createPortal(
        <div
          id="custom-multiselect-portal-root-quick"
          style={{ position: 'absolute', top: `${coords.top}px`, left: `${coords.left}px`, width: `${coords.width}px` }}
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
                <span className="min-w-0 flex-1 truncate">{option.name}</span>
                <span className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border"
                )}>
                  {active && <Check className="h-3 w-3" />}
                </span>
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

function PriorityCircles({ name }: { name: string }) {
  const n = name.toLowerCase()
  let level = 2
  let colorClass = 'bg-blue-400'
  let tooltip = 'Нормальный'

  if (n.includes('4') || n.includes('critical') || n.includes('критич')) {
    level = 4
    colorClass = 'bg-red-500'
    tooltip = 'Критический'
  } else if (n.includes('3') || n.includes('high') || n.includes('высок')) {
    level = 3
    colorClass = 'bg-orange-400'
    tooltip = 'Высокий'
  } else if (n.includes('2') || n.includes('normal') || n.includes('нормал')) {
    level = 2
    colorClass = 'bg-blue-400'
    tooltip = 'Нормальный'
  } else if (n.includes('1') || n.includes('low') || n.includes('низк')) {
    level = 1
    colorClass = 'bg-slate-400'
    tooltip = 'Низкий'
  }

  const maxCircles = Math.max(3, level)

  return (
    <span className="flex items-center gap-1" title={`${tooltip} (${name})`}>
      {Array.from({ length: maxCircles }).map((_, i) => {
        const isActive = i < level
        return (
          <span
            key={i}
            className={cn(
              'h-2 w-2 rounded-full shrink-0 transition-colors duration-150',
              isActive ? colorClass : 'bg-muted/40 border border-border/40'
            )}
          />
        )
      })}
    </span>
  )
}

function ClientAutocomplete({
  value,
  onChange
}: {
  value: { id: number; name: string } | null
  onChange: (value: { id: number; name: string } | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const res = await window.api.users.search(query)
        setResults(res)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  if (value) {
    return (
      <div className="relative flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/25 px-2.5 text-xs text-foreground">
        <span className="truncate font-medium">{value.name}</span>
        <button
          type="button"
          onClick={() => {
            onChange(null)
            setQuery('')
          }}
          className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Поиск клиента по имени, телефону, email..."
          className="h-9 w-full rounded-md border border-border bg-muted/25 pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary/60 transition-colors"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {open && (query.trim() || results.length > 0) && (
        <div className="absolute left-0 z-[9999] mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg">
          {results.map(user => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                onChange(user)
                setOpen(false)
              }}
              className="w-full rounded px-2.5 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground truncate"
            >
              {user.name}
            </button>
          ))}
          {!loading && results.length === 0 && query.trim() && (
            <div className="px-2.5 py-2 text-xs text-muted-foreground">Клиенты не найдены</div>
          )}
        </div>
      )}
    </div>
  )
}

export function QuickTicketModal() {
  const openTab = useTabsStore(s => s.openTab)
  const { user: currentUser } = useAuthStore()
  const { isQuickTicketOpen, setQuickTicketOpen } = useUIStore()
  const openCreatedTicket = useUIStore(s => s.openCreatedTicket)

  const { data: filtersData } = useTicketFilters()

  const [createTicketModalClient, setCreateTicketModalClient] = useState<{ id: number; name: string } | null>(null)
  const [createTicketTitle, setCreateTicketTitle] = useState('')
  const [createTicketBody, setCreateTicketBody] = useState('')
  const [createTicketType, setCreateTicketType] = useState('Incident')
  const [createTicketGroupId, setCreateTicketGroupId] = useState('')
  const [createTicketUserId, setCreateTicketUserId] = useState('')
  const [createTicketStateId, setCreateTicketStateId] = useState('1')
  const [createTicketPriorityId, setCreateTicketPriorityId] = useState('2')
  const [createTicketPendingTime, setCreateTicketPendingTime] = useState('')
  const [createTicketReasonIds, setCreateTicketReasonIds] = useState<string[]>([])
  const [createTicketTimeUnit, setCreateTicketTimeUnit] = useState('')
  const [createTicketCloseComment, setCreateTicketCloseComment] = useState('')
  const [createTicketAttachments, setCreateTicketAttachments] = useState<ComposerAttachment[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [createTicketLoading, setCreateTicketLoading] = useState(false)
  const [createTicketError, setCreateTicketError] = useState('')
  const [defaultGroupId, setDefaultGroupId] = useState('')
  const [defaultGroupName, setDefaultGroupName] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(420, Math.max(140, textarea.scrollHeight))}px`
    }
  }, [createTicketBody])

  useEffect(() => {
    if (!isQuickTicketOpen) return
    window.api.auth.getClientProfileSettings().then(settings => {
      if (settings?.defaultGroupId) setDefaultGroupId(settings.defaultGroupId)
      if (settings?.defaultGroupName) setDefaultGroupName(settings.defaultGroupName)
    }).catch(err => console.error(err))
  }, [isQuickTicketOpen])

  useEffect(() => {
    if (isQuickTicketOpen) {
      setCreateTicketModalClient(null)
      setCreateTicketTitle('')
      setCreateTicketBody('')
      setCreateTicketType('Incident')
      setCreateTicketGroupId('')
      setCreateTicketUserId(currentUser?.id ? String(currentUser.id) : '')
      setCreateTicketStateId('1')
      setCreateTicketPriorityId('2')
      setCreateTicketPendingTime(tomorrowAtEleven())
      setCreateTicketReasonIds([])
      setCreateTicketTimeUnit('')
      setCreateTicketCloseComment('')
      setCreateTicketAttachments([])
      setCreateTicketError('')
    }
  }, [isQuickTicketOpen, currentUser])

  useEffect(() => {
    if (!isQuickTicketOpen) return
    const resolved = resolveDefaultGroupId(filtersData?.groups ?? [], defaultGroupId, defaultGroupName)
    if (resolved) setCreateTicketGroupId(prev => prev || resolved)
  }, [isQuickTicketOpen, defaultGroupId, defaultGroupName, filtersData?.groups])

  if (!isQuickTicketOpen) return null

  const addModalFiles = async (files: File[]) => {
    if (files.length === 0) return
    try {
      const next = await Promise.all(files.map(async (file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        filename: file.name || `clipboard-${index + 1}`,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: await readFileAsDataUrl(file)
      })))
      setCreateTicketAttachments(current => [...current, ...next])
    } catch (err) {
      setCreateTicketError(err instanceof Error ? err.message : 'Не удалось добавить файл')
    }
  }

  const handleModalPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    void addModalFiles(files)
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void addModalFiles(files)
  }

  const removeModalAttachment = (id: string) => {
    setCreateTicketAttachments(current => current.filter(att => att.id !== id))
  }

  const attachmentsPayload = () =>
    createTicketAttachments.map(att => ({
      filename: att.filename,
      mimeType: att.mimeType,
      data: dataUrlPayload(att.dataUrl)
    }))

  const handleCreateTicket = async () => {
    // clients refuses a ticket without a client and answers with a page that
    // carries no ticket id, which used to surface as an unrelated "не удалось
    // определить номер" error.
    if (!createTicketModalClient) {
      setCreateTicketError('Выберите клиента - без него заявка не создаётся')
      return
    }
    setCreateTicketLoading(true)
    setCreateTicketError('')
    try {
      const res = await window.api.tickets.createFromCall({
        clientId: createTicketModalClient ? createTicketModalClient.id : null,
        title: createTicketTitle,
        body: createTicketBody,
        phone: '',
        callId: '',
        date: '',
        duration: '0',
        ticketType: createTicketType,
        groupId: createTicketGroupId,
        userId: createTicketUserId,
        priorityId: createTicketPriorityId,
        stateId: createTicketStateId,
        pendingTime: isPendingState('', Number(createTicketStateId)) ? new Date(createTicketPendingTime).toISOString() : null
      })
      if (res.ok && res.newTicketId) {
        if (createTicketAttachments.length > 0) {
          await window.api.tickets.addComment({
            ticketId: res.newTicketId,
            body: '',
            internal: false,
            articleType: 'note',
            attachments: attachmentsPayload()
          })
        }
        setQuickTicketOpen(false)
        if (openCreatedTicket) openTab(`/dashboard/tickets/${res.newTicketId}`)
      } else {
        throw new Error('Не удалось получить ID новой заявки')
      }
    } catch (err) {
      setCreateTicketError(err instanceof Error ? err.message : 'Ошибка при создании заявки')
    } finally {
      setCreateTicketLoading(false)
    }
  }

  const handleCloseTicket = async () => {
    if (!createTicketModalClient) {
      setCreateTicketError('Выберите клиента - без него заявка не создаётся')
      return
    }
    if (!createTicketTitle.trim() || !createTicketBody.trim()) {
      setCreateTicketError('Заполните тему и описание заявки')
      return
    }
    if (createTicketReasonIds.length === 0) {
      setCreateTicketError('Необходимо выбрать причину обращения чтобы закрыть заявку')
      return
    }
    if (!createTicketCloseComment.trim()) {
      setCreateTicketError('Необходимо написать комментарий перед закрытием заявки')
      return
    }
    const timeNum = Number(createTicketTimeUnit)
    if (!createTicketTimeUnit.trim() || !Number.isFinite(timeNum) || timeNum <= 0) {
      setCreateTicketError('Укажите потраченное время')
      return
    }

    setCreateTicketLoading(true)
    setCreateTicketError('')
    try {
      const res = await window.api.tickets.createFromCall({
        clientId: createTicketModalClient ? createTicketModalClient.id : null,
        title: createTicketTitle,
        body: createTicketBody,
        phone: '',
        callId: '',
        date: '',
        duration: '0',
        ticketType: createTicketType,
        groupId: createTicketGroupId,
        userId: createTicketUserId,
        priorityId: createTicketPriorityId,
        stateId: '',
        pendingTime: null,
        timeUnit: '0'
      })
      if (!res.ok || !res.newTicketId) {
        throw new Error('Не удалось получить ID новой заявки')
      }

      await window.api.tickets.addComment({
        ticketId: res.newTicketId,
        body: toHtmlComment(createTicketCloseComment),
        internal: false,
        articleType: 'note',
        stateId: Number(createTicketStateId),
        iikoReasonIds: createTicketReasonIds,
        timeUnit: timeNum,
        attachments: createTicketAttachments.length > 0 ? attachmentsPayload() : undefined
      })

      setQuickTicketOpen(false)
      if (openCreatedTicket) openTab(`/dashboard/tickets/${res.newTicketId}`)
    } catch (err) {
      setCreateTicketError(err instanceof Error ? err.message : 'Ошибка при закрытии заявки')
    } finally {
      setCreateTicketLoading(false)
    }
  }

  const selectedStateName = (filtersData?.states ?? []).find(s => Number(s.id) === Number(createTicketStateId))?.name || ''
  const closeMode = isClosedState(selectedStateName)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 text-foreground animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Быстрая заявка
          </h3>
          <button
            type="button"
            onClick={() => setQuickTicketOpen(false)}
            className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {createTicketError && (
          <div className="sticky top-0 z-20 flex items-center gap-2 rounded border border-destructive/30 bg-destructive/15 p-3 text-xs text-destructive shadow-md backdrop-blur">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{createTicketError}</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ticket-title" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Тема заявки</label>
          <input
            id="ticket-title"
            type="text"
            value={createTicketTitle}
            onChange={(e) => setCreateTicketTitle(e.target.value)}
            placeholder="Введите тему..."
            className="h-9 w-full rounded border border-border bg-muted/30 px-3 text-xs outline-none focus:border-primary/60"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Клиент</label>
          <ClientAutocomplete
            value={createTicketModalClient}
            onChange={setCreateTicketModalClient}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Тип заявки</label>
            <CustomSelect
              value={createTicketType}
              options={Object.entries(TICKET_TYPE_NAMES).map(([id, name]) => ({ id, name }))}
              onChange={(val) => setCreateTicketType(String(val.id))}
              renderValue={(val) => val ? (
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", getTicketTypeBadgeClass(String(val.id), val.name))}>
                  {val.name}
                </span>
              ) : 'Выберите'}
              renderOption={(val) => (
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", getTicketTypeBadgeClass(String(val.id), val.name))}>
                  {val.name}
                </span>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Группа</label>
            <CustomSelect
              value={createTicketGroupId ? Number(createTicketGroupId) : null}
              options={[...(filtersData?.groups ?? [])]
                .map(g => ({ id: Number(g.id), name: g.name }))
                .sort((a, b) => a.name.localeCompare(b.name, 'ru'))}
              onChange={(val) => setCreateTicketGroupId(String(val.id))}
              placeholder="Выберите группу"
              searchable
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ответственный</label>
            <CustomSelect
              value={createTicketUserId}
              options={[
                { id: '', name: 'Не назначен' },
                ...(filtersData?.agents ?? []).map(a => ({ id: String(a.id), name: a.name }))
              ]}
              onChange={(val) => setCreateTicketUserId(String(val.id))}
              placeholder="Не назначен"
              searchable
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Состояние</label>
            <CustomSelect
              value={createTicketStateId ? Number(createTicketStateId) : 1}
              options={(filtersData?.states ?? []).map(s => ({ id: Number(s.id), name: s.name }))}
              onChange={(val) => setCreateTicketStateId(String(val.id))}
              renderValue={(val) => {
                if (!val) return 'Выберите'
                const color = filtersData?.stateColors?.[Number(val.id)]
                const style = color ? {
                  backgroundColor: `${color}15`,
                  color: color,
                  borderColor: `${color}30`,
                  borderWidth: '1px'
                } : undefined
                return (
                  <span
                    className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", !color && getStateBadgeClass(val.name))}
                    style={style}
                  >
                    {val.name}
                  </span>
                )
              }}
              renderOption={(val) => {
                const color = filtersData?.stateColors?.[Number(val.id)]
                const style = color ? {
                  backgroundColor: `${color}15`,
                  color: color,
                  borderColor: `${color}30`,
                  borderWidth: '1px'
                } : undefined
                return (
                  <span
                    className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", !color && getStateBadgeClass(val.name))}
                    style={style}
                  >
                    {val.name}
                  </span>
                )
              }}
            />
          </div>
        </div>

        {!closeMode && isPendingState('', Number(createTicketStateId)) && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Время откладывания</label>
            <CustomDateTimePicker
              value={createTicketPendingTime}
              onChange={setCreateTicketPendingTime}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Приоритет</label>
          <CustomSelect
            value={createTicketPriorityId ? Number(createTicketPriorityId) : 2}
            options={(filtersData?.priorities ?? []).map(p => ({ id: Number(p.id), name: p.name }))}
            onChange={(val) => setCreateTicketPriorityId(String(val.id))}
            renderValue={(val) => val ? (
              <div className="flex items-center gap-2">
                <PriorityCircles name={val.name} />
                <span>{val.name}</span>
              </div>
            ) : 'Выберите'}
            renderOption={(val) => (
              <div className="flex items-center gap-2">
                <PriorityCircles name={val.name} />
                <span>{val.name}</span>
              </div>
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="ticket-body" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Описание проблемы</label>
          <div className="relative">
            <textarea
              ref={textareaRef}
              id="ticket-body"
              value={createTicketBody}
              onChange={(e) => setCreateTicketBody(e.target.value)}
              onPaste={handleModalPaste}
              placeholder="Опишите проблему..."
              rows={6}
              className="min-h-[140px] w-full rounded border border-border bg-muted/30 p-3 pr-9 text-xs outline-none focus:border-primary/60 resize-none"
            />
            <AiAssistButton text={createTicketBody} onTextChange={setCreateTicketBody} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Вложения</label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-muted/25 px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Paperclip className="h-3.5 w-3.5 text-primary" />
              Прикрепить
            </button>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInputChange} />
          </div>
          {createTicketAttachments.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {createTicketAttachments.map(att => {
                const kind = attachmentKind(att)
                const Icon = kind === 'image' ? FileImage : kind === 'text' ? FileText : FileArchive
                return (
                  <div key={att.id} className="group flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-2">
                    {kind === 'image' ? (
                      <img src={att.dataUrl} alt={att.filename} className="h-8 w-8 shrink-0 rounded object-cover" />
                    ) : (
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-[11px] text-foreground" title={att.filename}>{att.filename}</span>
                    <button
                      type="button"
                      onClick={() => removeModalAttachment(att.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground opacity-70 transition-colors hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {closeMode && (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Причина обращения</label>
              <CustomMultiSelect
                values={createTicketReasonIds}
                options={(filtersData?.iikoReasons ?? []).map(r => ({ id: String(r.id), name: r.name }))}
                onChange={(reasons) => setCreateTicketReasonIds(reasons.map(r => String(r.id)))}
                placeholder="Выберите причину"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ticket-close-comment" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Комментарий перед закрытием</label>
              <div className="relative">
                <textarea
                  id="ticket-close-comment"
                  value={createTicketCloseComment}
                  onChange={(e) => setCreateTicketCloseComment(e.target.value)}
                  onPaste={handleModalPaste}
                  placeholder="Что было сделано..."
                  rows={4}
                  className="min-h-[110px] w-full rounded border border-border bg-muted/30 p-3 pr-9 text-xs outline-none focus:border-primary/60 resize-none"
                />
                <AiAssistButton text={createTicketCloseComment} onTextChange={setCreateTicketCloseComment} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="ticket-time-unit" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Потраченное время (мин)</label>
              <input
                id="ticket-time-unit"
                type="text"
                inputMode="numeric"
                value={createTicketTimeUnit}
                onChange={(e) => setCreateTicketTimeUnit(e.target.value.replace(/\D/g, ''))}
                placeholder="Например, 15"
                className="h-9 w-full rounded border border-border bg-muted/30 px-3 text-xs outline-none focus:border-primary/60"
              />
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={createTicketLoading}
            onClick={() => setQuickTicketOpen(false)}
            className="h-9 text-xs"
          >
            Отмена
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={createTicketLoading || !createTicketTitle.trim() || !createTicketBody.trim()}
            onClick={closeMode ? handleCloseTicket : handleCreateTicket}
            className={cn(
              "h-9 gap-1.5 text-xs text-primary-foreground",
              closeMode ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            )}
          >
            {createTicketLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : closeMode ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
