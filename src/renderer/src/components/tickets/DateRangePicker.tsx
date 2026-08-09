import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DateRange {
  from: string | null
  to: string | null
}

export const EMPTY_RANGE: DateRange = { from: null, to: null }

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

/** YYYY-MM-DD in local time — the calendar works in days, never in instants. */
export function toDayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDayKey(key: string | null): Date | null {
  if (!key) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatRu(key: string | null): string {
  const date = parseDayKey(key)
  if (!date) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

/**
 * Types the dots in as digits arrive and stops at a full дд.мм.гггг, so nothing
 * but the digits ever has to be typed. Days above 31 and months above 12 are
 * refused on the spot instead of turning into an invalid date later.
 */
function maskDayInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (!digits) return ''

  let day = digits.slice(0, 2)
  if (day.length === 1 && Number(day) > 3) day = `0${day}`
  if (day.length === 2 && Number(day) > 31) day = '31'
  if (day.length === 2 && Number(day) === 0) day = '01'

  let month = digits.slice(2, 4)
  if (month.length === 1 && Number(month) > 1) month = `0${month}`
  if (month.length === 2 && Number(month) > 12) month = '12'
  if (month.length === 2 && Number(month) === 0) month = '01'

  const year = digits.slice(4, 8)

  // Trailing dots are added only once the part before them is complete, so the
  // caret never has to jump over a separator the user is still typing into.
  let result = day
  if (day.length === 2 && (month.length > 0 || digits.length > 2)) result += `.${month}`
  if (month.length === 2 && (year.length > 0 || digits.length > 4)) result += `.${year}`
  return result
}

/** Accepts 07.08.2026, 7.8.2026, 07082026 and 2026-08-07. */
function parseTyped(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseDayKey(value) ? value : null

  const digits = value.replace(/\D/g, '')
  if (digits.length === 8) {
    const day = Number(digits.slice(0, 2))
    const month = Number(digits.slice(2, 4))
    const year = Number(digits.slice(4))
    const date = new Date(year, month - 1, day)
    if (date.getDate() === day && date.getMonth() === month - 1) return toDayKey(date)
    return null
  }

  const parts = value.split(/[.\-/\s]+/).filter(Boolean)
  if (parts.length === 3) {
    const day = Number(parts[0])
    const month = Number(parts[1])
    const year = Number(parts[2].length === 2 ? `20${parts[2]}` : parts[2])
    const date = new Date(year, month - 1, day)
    if (date.getDate() === day && date.getMonth() === month - 1) return toDayKey(date)
  }
  return null
}

function startOfWeek(date: Date): Date {
  const result = new Date(date)
  // Monday-based, matching the weekday header.
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

function shiftDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

interface Preset {
  id: string
  label: string
  build: () => DateRange
}

const PRESETS: Preset[] = [
  {
    id: 'today',
    label: 'Сегодня',
    build: () => ({ from: toDayKey(new Date()), to: toDayKey(new Date()) })
  },
  {
    id: 'yesterday',
    label: 'Вчера',
    build: () => {
      const day = toDayKey(shiftDays(new Date(), -1))
      return { from: day, to: day }
    }
  },
  {
    id: 'week',
    label: 'Эта неделя',
    build: () => ({ from: toDayKey(startOfWeek(new Date())), to: toDayKey(new Date()) })
  },
  {
    id: 'month',
    label: 'Этот месяц',
    build: () => {
      const now = new Date()
      return { from: toDayKey(new Date(now.getFullYear(), now.getMonth(), 1)), to: toDayKey(now) }
    }
  },
  {
    id: 'days30',
    label: 'За 30 дней',
    build: () => ({ from: toDayKey(shiftDays(new Date(), -29)), to: toDayKey(new Date()) })
  }
]

export function rangeLabel(range: DateRange): string {
  if (!range.from && !range.to) return 'Период'
  const matched = PRESETS.find(preset => {
    const built = preset.build()
    return built.from === range.from && built.to === range.to
  })
  if (matched) return matched.label
  if (range.from && range.to) {
    return range.from === range.to ? formatRu(range.from) : `${formatRu(range.from)} — ${formatRu(range.to)}`
  }
  return range.from ? `с ${formatRu(range.from)}` : `по ${formatRu(range.to)}`
}

interface DateRangePickerProps {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [viewDate, setViewDate] = useState(() => parseDayKey(value.from) ?? new Date())
  // The day picked first while a new range is being drawn; the second click
  // closes it, and until then the calendar previews the range under the cursor.
  const [anchor, setAnchor] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [fromText, setFromText] = useState(formatRu(value.from))
  const [toText, setToText] = useState(formatRu(value.to))

  const hasValue = !!(value.from || value.to)

  useEffect(() => {
    setFromText(formatRu(value.from))
    setToText(formatRu(value.to))
  }, [value.from, value.to])

  useEffect(() => {
    if (!open) return
    setViewDate(parseDayKey(value.from) ?? new Date())
    setAnchor(null)
    setHovered(null)

    const updateCoords = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (rect) setCoords({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX })
    }
    updateCoords()
    window.addEventListener('resize', updateCoords)
    window.addEventListener('scroll', updateCoords, true)

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (document.getElementById('date-range-portal')?.contains(target)) return
      setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKey)

    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords, true)
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, value.from])

  const cells = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const leading = (new Date(year, month, 1).getDay() + 6) % 7
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => toDayKey(new Date(year, month, index + 1)))
    ]
  }, [viewDate])

  // While drawing, the preview end follows the cursor so the range is visible
  // before the second click lands.
  const previewFrom = anchor ?? value.from
  const previewTo = anchor ? (hovered ?? anchor) : value.to
  const [rangeStart, rangeEnd] = previewFrom && previewTo && previewFrom > previewTo
    ? [previewTo, previewFrom]
    : [previewFrom, previewTo]

  const todayKey = toDayKey(new Date())

  const commit = (range: DateRange) => {
    onChange(range)
  }

  const handleDayClick = (day: string) => {
    if (!anchor) {
      setAnchor(day)
      setHovered(day)
      return
    }
    const from = anchor <= day ? anchor : day
    const to = anchor <= day ? day : anchor
    setAnchor(null)
    setHovered(null)
    commit({ from, to })
    setOpen(false)
  }

  const applyTyped = (which: 'from' | 'to', text: string) => {
    const typed = parseTyped(text)
    // A typed future date would select a period that cannot contain anything.
    const parsed = typed && typed > todayKey ? todayKey : typed
    if (!text.trim()) {
      commit({ ...value, [which]: null })
      return
    }
    if (!parsed) {
      // Keep what the user typed on screen, but do not filter by garbage.
      return
    }
    const next: DateRange = { ...value, [which]: parsed }
    if (next.from && next.to && next.from > next.to) {
      commit(which === 'from' ? { from: parsed, to: parsed } : { from: parsed, to: parsed })
      return
    }
    commit(next)
    setViewDate(parseDayKey(parsed) ?? new Date())
  }

  const activePresetId = PRESETS.find(preset => {
    const built = preset.build()
    return built.from === value.from && built.to === value.to
  })?.id

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex min-h-[32px] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors',
          hasValue
            ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/15'
            : 'border-border bg-card text-foreground hover:bg-accent'
        )}
      >
        <CalendarRange className={cn('h-3.5 w-3.5 shrink-0', hasValue ? 'text-primary' : 'text-muted-foreground')} />
        <span className="max-w-[190px] truncate">{rangeLabel(value)}</span>
        {hasValue && (
          <span
            role="button"
            title="Сбросить период"
            onClick={(event) => { event.stopPropagation(); commit(EMPTY_RANGE) }}
            className="flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-primary/20"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              id="date-range-portal"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{ position: 'absolute', top: coords.top, left: coords.left }}
              className="z-[9999] w-[430px] origin-top rounded-xl border border-border bg-card p-3 shadow-2xl"
            >
              <div className="flex gap-3">
                <div className="flex w-[130px] shrink-0 flex-col gap-1">
                  <p className="px-1 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Быстрый выбор
                  </p>
                  {PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => { commit(preset.build()); setOpen(false) }}
                      className={cn(
                        'rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
                        activePresetId === preset.id
                          ? 'bg-primary/12 text-primary'
                          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <div className="mt-auto pt-2">
                    <button
                      type="button"
                      onClick={() => { commit(EMPTY_RANGE); setAnchor(null); setOpen(false) }}
                      className="w-full rounded-lg border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    >
                      Сбросить
                    </button>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="mb-2 grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">С</span>
                      <input
                        inputMode="numeric"
                        value={fromText}
                        onChange={(event) => {
                          const masked = maskDayInput(event.target.value)
                          setFromText(masked)
                          // A complete date applies immediately — no Enter needed.
                          if (masked.length === 10) applyTyped('from', masked)
                        }}
                        onBlur={() => applyTyped('from', fromText)}
                        onKeyDown={(event) => { if (event.key === 'Enter') applyTyped('from', fromText) }}
                        placeholder="дд.мм.гггг"
                        className="h-8 rounded-md border border-border bg-muted/30 px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">По</span>
                      <input
                        inputMode="numeric"
                        value={toText}
                        onChange={(event) => {
                          const masked = maskDayInput(event.target.value)
                          setToText(masked)
                          if (masked.length === 10) applyTyped('to', masked)
                        }}
                        onBlur={() => applyTyped('to', toText)}
                        onKeyDown={(event) => { if (event.key === 'Enter') applyTyped('to', toText) }}
                        placeholder="дд.мм.гггг"
                        className="h-8 rounded-md border border-border bg-muted/30 px-2 text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="mb-1.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={`${viewDate.getFullYear()}-${viewDate.getMonth()}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="text-xs font-semibold text-foreground"
                      >
                        {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
                      </motion.span>
                    </AnimatePresence>
                    <button
                      type="button"
                      onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div
                    className="grid grid-cols-7 gap-1 text-center"
                    onMouseLeave={() => setHovered(anchor)}
                  >
                    {WEEKDAYS.map(day => (
                      <span key={day} className="pb-1 text-[10px] font-semibold text-muted-foreground/70">{day}</span>
                    ))}
                    {cells.map((day, index) => {
                      if (!day) return <span key={`empty-${index}`} />

                      const isStart = !!rangeStart && day === rangeStart
                      const isEnd = !!rangeEnd && day === rangeEnd
                      const inRange = !!rangeStart && !!rangeEnd && day > rangeStart && day < rangeEnd
                      const isEdge = isStart || isEnd
                      // While a range is being drawn the preview is what tells the
                      // user what the second click will select, so it is painted
                      // stronger than the settled range.
                      const isDrawing = !!anchor
                      // Nothing can have been created later than today, so future
                      // days stay visible for orientation but out of reach.
                      const isFuture = day > todayKey

                      return (
                        <button
                          key={day}
                          type="button"
                          disabled={isFuture}
                          onClick={() => { if (!isFuture) handleDayClick(day) }}
                          onMouseEnter={() => { if (anchor && !isFuture) setHovered(day) }}
                          onMouseMove={() => { if (anchor && !isFuture && hovered !== day) setHovered(day) }}
                          className={cn(
                            'relative flex h-8 items-center justify-center rounded-lg text-xs transition-colors duration-100',
                            isFuture && 'cursor-default text-muted-foreground/30',
                            !isFuture && inRange && (isDrawing ? 'bg-primary/25 text-foreground' : 'bg-primary/18 text-foreground'),
                            !isFuture && !inRange && !isEdge && 'hover:bg-accent/60',
                            !isFuture && day === todayKey && !isEdge && 'font-bold text-primary'
                          )}
                        >
                          {isEdge && !isFuture && (
                            <motion.span
                              layoutId={isStart && !isEnd ? 'range-start' : isEnd && !isStart ? 'range-end' : `range-${day}`}
                              transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                              className="absolute inset-0 rounded-lg bg-primary shadow-sm"
                            />
                          )}
                          <span className={cn('relative z-10', isEdge && !isFuture && 'font-semibold text-primary-foreground')}>
                            {Number(day.slice(-2))}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
