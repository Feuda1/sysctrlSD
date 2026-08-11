import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { filterCalls, mergeCalls, mostCommonOperator, onlyDigits } from '@/lib/callSearch'
import { ErrorNotice } from '@/components/ui/error-notice'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Pause,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Play,
  RefreshCw,
  Search,
  Volume2,
  X,
  Plus,
  Link,
  ExternalLink,
  ChevronDown,
  Loader2,
  Calendar,
  Check,
  Paperclip,
  FileText,
  FileImage,
  FileArchive
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, readFileAsDataUrl, dataUrlPayload } from '@/lib/utils'
import { useTicketFilters } from '@/hooks/useTickets'
import { getStateBadgeClass, getTicketTypeBadgeClass } from '@/types/ticket'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { AiAssistButton } from '@/components/ai/AiAssistButton'

type CallsResponse = Awaited<ReturnType<typeof window.api.calls.getAll>>
type CallRecord = CallsResponse['history'][number]
type SectionKey = 'history' | 'mine' | 'current'

// При поиске сервер прекращает перебор, набрав страницу, поэтому она мельче.
const SEARCH_PAGE_SIZE = 15
const BROWSE_PAGE_SIZE = 50

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: 'history', title: 'История звонков' },
  { key: 'mine',    title: 'Мои звонки' },
  { key: 'current', title: 'Текущие звонки' }
]

const PLAYER_SETTINGS_KEY = 'calls.player.settings'

function readPlayerSettings() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PLAYER_SETTINGS_KEY) || '{}')
    return {
      speed: typeof parsed.speed === 'number' ? parsed.speed : 1,
      volume: typeof parsed.volume === 'number' ? parsed.volume : 0.85
    }
  } catch { return { speed: 1, volume: 0.85 } }
}

function writePlayerSettings(s: { speed: number; volume: number }) {
  window.localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(s))
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function DirectionIcon({ direction }: { direction: CallRecord['direction'] }) {
  if (direction === 'in')     return <PhoneIncoming className="h-3.5 w-3.5 text-green-400" />
  if (direction === 'out')    return <PhoneOutgoing  className="h-3.5 w-3.5 text-sky-400" />
  if (direction === 'missed') return <PhoneMissed    className="h-3.5 w-3.5 text-destructive" />
  return <PhoneCall className="h-3.5 w-3.5 text-muted-foreground" />
}

interface BottomPlayerHandle {
  toggle: () => void
}

const BottomPlayer = forwardRef<BottomPlayerHandle, {
  call: CallRecord
  onClose: () => void
  onPlayingChange: (playing: boolean) => void
}>(function BottomPlayer({ call, onClose, onPlayingChange }, ref) {
  const audioRef   = useRef<HTMLAudioElement>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [playing,  setPlaying]  = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration,    setDuration]    = useState(0)
  const [speed,  setSpeed]  = useState(() => readPlayerSettings().speed)
  const [volume, setVolume] = useState(() => readPlayerSettings().volume)
  const [error,  setError]  = useState<string | null>(null)

  // Notify parent of playing state changes
  useEffect(() => { onPlayingChange(playing) }, [playing, onPlayingChange])

  // Expose toggle to parent via ref
  useImperativeHandle(ref, () => ({
    toggle: async () => {
      const a = audioRef.current
      if (!a || !audioUrl) return
      if (a.paused) {
        try { await a.play(); setPlaying(true) } catch (e) {
          const msg = e instanceof Error ? e.message : ''
          if (!/interrupted|abort/i.test(msg)) setError(msg || 'не удалось воспроизвести')
        }
      } else { a.pause(); setPlaying(false) }
    }
  }), [audioUrl])

  // Stop audio on unmount
  useEffect(() => () => {
    const a = audioRef.current
    if (a) { a.pause(); a.src = '' }
  }, [])

  // Load recording when call changes
  useEffect(() => {
    const a = audioRef.current
    if (a) { a.pause(); a.src = '' }
    setAudioUrl(null); setCurrentTime(0); setDuration(0); setPlaying(false); setError(null)
    if (!call.recordingUrl) { setError('нет записи'); return }
    setLoading(true)
    window.api.calls.getRecording(call.recordingUrl)
      .then(r  => setAudioUrl(r.dataUrl))
      .catch(e  => setError(e instanceof Error ? e.message : 'ошибка'))
      .finally(() => setLoading(false))
  }, [call.id, call.recordingUrl])

  // Auto-play after load
  useEffect(() => {
    const a = audioRef.current
    if (!audioUrl || !a) return
    a.src = audioUrl; a.load()
    a.play()
      .then(() => setPlaying(true))
      .catch(e => {
        const msg = e instanceof Error ? e.message : ''
        if (!/interrupted|abort/i.test(msg)) setError(msg || 'не удалось воспроизвести')
      })
  }, [audioUrl])

  // Sync volume / speed — re-apply on audioUrl change too, since a.load()
  // resets playbackRate and the restored settings would otherwise never be applied.
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = volume; a.playbackRate = speed
    writePlayerSettings({ speed, volume })
  }, [speed, volume, audioUrl])

  const toggle = async () => {
    const a = audioRef.current
    if (!a || !audioUrl) return
    if (a.paused) {
      try { await a.play(); setPlaying(true) } catch (e) {
        const msg = e instanceof Error ? e.message : ''
        if (!/interrupted|abort/i.test(msg)) setError(msg || 'не удалось воспроизвести')
      }
    } else { a.pause(); setPlaying(false) }
  }

  const seek = (v: number) => {
    if (!audioRef.current) return
    audioRef.current.currentTime = v; setCurrentTime(v)
  }

  const progress = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0
  const source = call.client || call.organization || call.phone || call.raw['Источник'] || call.raw['source'] || '—'

  return (
    <div
      className="mt-2 grid shrink-0 items-center gap-3 rounded-lg border border-border bg-card/90 px-4 py-2.5 shadow-sm"
      style={{ gridTemplateColumns: '1fr auto 1fr' }}
    >
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
      />

      {/* Left — call identity */}
      <div className="flex min-w-0 items-center gap-2">
        <DirectionIcon direction={call.direction} />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-xs font-medium text-foreground">{source}</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">{call.startedAt || '—'}</span>
        </div>
      </div>

      {/* Center — play controls */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          disabled={loading || !!error}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          {loading
            ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            : playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />
          }
        </button>
        <span className="text-[11px] tabular-nums text-muted-foreground">{formatTime(currentTime)}</span>
        <input
          type="range" min={0} max={duration || 0} step={0.1}
          value={Math.min(currentTime, duration || 0)}
          disabled={!audioUrl}
          onChange={e => seek(Number(e.target.value))}
          className="h-1 w-52 cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-30"
          style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${progress}%, hsl(var(--muted)) ${progress}%)` }}
        />
        <span className="text-[11px] tabular-nums text-muted-foreground">{formatTime(duration)}</span>
      </div>

      {/* Right — speed, volume, close */}
      <div className="flex items-center justify-end gap-3">
        <div className="flex items-center gap-0.5">
          {[1, 1.25, 1.5, 2].map(v => (
            <button
              key={v} type="button" onClick={() => setSpeed(v)}
              className={cn(
                'h-6 rounded px-1.5 text-[10px] tabular-nums transition-colors',
                speed === v ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {v}x
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Volume2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            type="range" min={0} max={1} step={0.05} value={volume}
            onChange={e => setVolume(Number(e.target.value))}
            className="h-1 w-16 cursor-pointer appearance-none rounded-full"
            style={{ background: `linear-gradient(to right, hsl(var(--primary)) ${volume * 100}%, hsl(var(--muted)) ${volume * 100}%)` }}
          />
        </div>
        {error && <span className="max-w-20 truncate text-[10px] text-destructive" title={error}>{error}</span>}
        <button
          type="button" onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
})

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

// "Закрыта" — but not "В ожидании закрытия" (that one is a pending state).
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

// Settings store the wrapper's group id/name, which may not match Zammad group ids.
// Resolve to a Zammad group id by id first, then by name.
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

type ComposerAttachment = {
  id: string
  filename: string
  mimeType: string
  size: number
  dataUrl: string
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
        const portalContainer = document.getElementById('custom-datetime-portal-root')
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
          id="custom-datetime-portal-root"
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
        const portalContainer = document.getElementById('custom-select-portal-root')
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
          id="custom-select-portal-root"
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
        const portalContainer = document.getElementById('custom-multiselect-portal-root')
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
          id="custom-multiselect-portal-root"
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
        <div className="absolute left-0 z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg">
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

function parseDurationToSeconds(str: string): number {
  if (!str) return 0
  const clean = str.toLowerCase()
  let seconds = 0
  const minMatch = clean.match(/(\d+)\s*(?:мин|m)/)
  const secMatch = clean.match(/(\d+)\s*(?:сек|s)/)
  if (minMatch) {
    seconds += parseInt(minMatch[1], 10) * 60
  }
  if (secMatch) {
    seconds += parseInt(secMatch[1], 10)
  } else if (!minMatch) {
    const num = parseInt(clean.replace(/\D/g, ''), 10)
    if (!isNaN(num)) seconds = num
  }
  return seconds
}

function normalizePhoneToDigits(phone: string): string {
  let clean = phone.replace(/\D/g, '')
  if (clean.length === 11 && clean.startsWith('8')) {
    clean = '7' + clean.slice(1)
  }
  return clean
}

export default function CallsPage() {
  const navigate = useNavigate()
  const openCreatedTicket = useUIStore(s => s.openCreatedTicket)
  const { user: currentUser } = useAuthStore()
  const [activeSection, setActiveSection] = useState<SectionKey>('history')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  // «Показать ещё» при поиске: страницу увеличиваем, а не листаем.
  const [extraRows, setExtraRows] = useState(0)
  const [playingCall, setPlayingCall] = useState<CallRecord | null>(null)
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false)
  const playerRef = useRef<BottomPlayerHandle>(null)

  const [activeCreateDropdownCallId, setActiveCreateDropdownCallId] = useState<string | null>(null)
  const [activeBindDropdownCallId, setActiveBindDropdownCallId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const { data: filtersData } = useTicketFilters()

  const [createTicketModalCall, setCreateTicketModalCall] = useState<CallRecord | null>(null)
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
    window.api.auth.getClientProfileSettings().then(settings => {
      if (settings?.defaultGroupId) setDefaultGroupId(settings.defaultGroupId)
      if (settings?.defaultGroupName) setDefaultGroupName(settings.defaultGroupName)
    }).catch(err => console.error(err))
  }, [])

  useEffect(() => {
    if (createTicketModalCall) {
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
    }
  }, [createTicketModalCall, currentUser])

  // Resolve the default group once filters/settings are loaded. Only fills an
  // empty selection, so it never overrides a manual choice or fires on data refresh.
  useEffect(() => {
    if (!createTicketModalCall) return
    const resolved = resolveDefaultGroupId(filtersData?.groups ?? [], defaultGroupId, defaultGroupName)
    if (resolved) setCreateTicketGroupId(prev => prev || resolved)
  }, [createTicketModalCall, defaultGroupId, defaultGroupName, filtersData?.groups])

  const [bindTicketModalCall, setBindTicketModalCall] = useState<CallRecord | null>(null)
  const [bindTicketId, setBindTicketId] = useState('')
  const [bindTicketLoading, setBindTicketLoading] = useState(false)
  const [bindTicketError, setBindTicketError] = useState('')

  // Поиск запускается только по Enter. Раньше он срывался на каждый набранный
  // символ, а каждый такой поиск на стороне clients — это перебор архива до
  // полуминуты; половина запусков была по недописанному номеру.
  const applySearch = () => setDebouncedSearch(search.trim())
  const clearSearch = () => {
    setSearch('')
    setDebouncedSearch('')
  }

  useEffect(() => {
    setPage(1)
    setExtraRows(0)
  }, [debouncedSearch, activeSection])

  useEffect(() => {
    if (!activeCreateDropdownCallId && !activeBindDropdownCallId) return
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveCreateDropdownCallId(null)
        setActiveBindDropdownCallId(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [activeCreateDropdownCallId, activeBindDropdownCallId])

  // При поиске страница берётся маленькая: clients прекращает перебор, как
  // только набрал её, и по номеру это разница между четырьмя секундами и
  // восемнадцатью. Для обычного просмотра размер прежний.
  const callsPerPage = (debouncedSearch ? SEARCH_PAGE_SIZE : BROWSE_PAGE_SIZE) + extraRows

  // Запрашивается только открытый раздел. Раньше на каждый поиск уходило три
  // запроса и ждали самый медленный: поиск в «Истории» стоил ещё и времени
  // «Моих», а редкий запрос там сканируется по двадцать секунд.
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['calls', activeSection, debouncedSearch, page, callsPerPage],
    queryFn: () => window.api.calls.getSection(activeSection, {
      query: debouncedSearch,
      page,
      perPage: callsPerPage
    }),
    staleTime: 15_000,
    // Пока идёт поиск, не дёргаем сервер по кругу: он и так занят перебором.
    refetchInterval: debouncedSearch ? false : 30_000,
    placeholderData: previous => previous
  })

  // Список текущих звонков нужен для счётчика на вкладке и стоит копейки
  // (полтораста миллисекунд), поэтому он живёт отдельно от открытого раздела.
  const { data: currentCalls } = useQuery({
    queryKey: ['calls', 'current', '', 1, BROWSE_PAGE_SIZE],
    queryFn: () => window.api.calls.getSection('current', { query: '', page: 1, perPage: BROWSE_PAGE_SIZE }),
    staleTime: 15_000,
    refetchInterval: 30_000
  })

  const serverCalls = data?.records ?? []

  // Последняя просмотренная страница раздела — по ней ищем мгновенно, пока
  // сервер перебирает архив.
  const loadedBySection = useRef<Record<SectionKey, CallRecord[]>>({ history: [], mine: [], current: [] })
  useEffect(() => {
    if (!debouncedSearch && data?.records) loadedBySection.current[activeSection] = data.records
  }, [data, debouncedSearch, activeSection])

  // Свой добавочный: в звонках «ответчик» — это он. Берём из профиля clients, а
  // если там не заполнено — из уже загруженных «моих» звонков, где ответчик я.
  const { data: clientProfile } = useQuery({
    queryKey: ['client-profile'],
    queryFn: () => window.api.auth.getClientProfileSettings(),
    staleTime: Infinity
  })
  // Первая страница «моих» без поиска: стоит полсекунды, зато по ней сразу
  // виден свой добавочный и есть по чему искать мгновенно — даже если человек
  // начал с поиска и раздел ни разу не открывал.
  const { data: minePreview } = useQuery({
    queryKey: ['calls', 'mine', '', 1, BROWSE_PAGE_SIZE],
    queryFn: () => window.api.calls.getSection('mine', { query: '', page: 1, perPage: BROWSE_PAGE_SIZE }),
    staleTime: 60_000
  })

  const localMatches = useMemo(
    () => (debouncedSearch
      ? filterCalls(
          activeSection === 'mine' && loadedBySection.current.mine.length === 0
            ? (minePreview?.records ?? [])
            : loadedBySection.current[activeSection],
          debouncedSearch
        )
      : []),
    [debouncedSearch, activeSection, data, minePreview]
  )

  const myExtension = useMemo(() => {
    const fromProfile = onlyDigits(clientProfile?.internalPhone ?? '')
    if (fromProfile) return fromProfile
    return mostCommonOperator(minePreview?.records ?? loadedBySection.current.mine)
  }, [clientProfile, minePreview, data])

  // «Мои» на стороне clients ищутся в разы дольше общей истории: по одному и
  // тому же номеру 19 секунд против полутора. Поэтому пока идёт долгий поиск,
  // спрашиваем общую историю и оставляем из неё свои звонки — список получается
  // тот же, но виден почти сразу.
  const historyFastPath = useQuery({
    queryKey: ['calls', 'history', debouncedSearch, 1, callsPerPage],
    queryFn: () => window.api.calls.getSection('history', {
      query: debouncedSearch,
      page: 1,
      perPage: callsPerPage
    }),
    enabled: activeSection === 'mine' && !!debouncedSearch && !!myExtension,
    staleTime: 15_000
  })
  const fastMineMatches = useMemo(() => {
    if (activeSection !== 'mine' || !myExtension) return []
    return (historyFastPath.data?.records ?? [])
      .filter(record => onlyDigits(record.operator ?? '') === myExtension)
      .map(record => ({ ...record, section: 'mine' as const }))
  }, [historyFastPath.data, myExtension, activeSection])

  // Пока полный ответ не пришёл, показываем всё, что уже известно: найденное
  // среди загруженного и свои звонки из быстрой общей истории. Ждать двадцать
  // секунд, глядя в пустоту, невозможно.
  const awaitingServer = !!debouncedSearch && (isLoading || isFetching)
  const preliminary = useMemo(
    () => mergeCalls(fastMineMatches, localMatches),
    [fastMineMatches, localMatches]
  )
  const showingPreliminary = awaitingServer && preliminary.length > 0 && serverCalls.length === 0
  const calls = showingPreliminary ? preliminary : serverCalls

  const hasRecordingCol = activeSection !== 'current'

  const handleBindCall = async (call: CallRecord, ticketId: string) => {
    try {
      const src = call.phone || call.raw['Источник'] || call.raw['source'] || ''
      const dst = call.operator || call.raw['Ответчик'] || call.raw['operator'] || ''
      await window.api.calls.bindToTicket({
        ticketId,
        src,
        dst,
        callId: call.callId || '',
        duration: String(parseDurationToSeconds(call.duration || '')),
        date: call.startedAt || ''
      })
      refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Ошибка привязки звонка')
    }
  }

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

  // Native paste event fires on Ctrl+V regardless of keyboard layout (incl. Russian).
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

  // Builds the call-derived body + cleaned phone number shared by create/close.
  const composeCallTicketArgs = (call: CallRecord) => {
    const directionText = call.direction === 'in' ? 'Входящий звонок с номера' : call.direction === 'out' ? 'Исходящий звонок на номер' : 'Звонок'
    let phoneNum = call.phone || ''
    const isInternal = (p: string) => /^\d{1,4}$/.test(p.trim().replace(/\D/g, ''))
    if (isInternal(phoneNum)) phoneNum = ''
    let callInfo = ''
    if (phoneNum) {
      callInfo = `${directionText}: ${phoneNum}\nВремя звонка: ${call.startedAt || ''}\nПродолжительность звонка: ${call.duration || '0'} сек.\n\n`
    }
    return { finalBody: callInfo + createTicketBody, phoneNum }
  }

  const handleCreateTicket = async () => {
    if (!createTicketModalCall) return
    setCreateTicketLoading(true)
    setCreateTicketError('')
    try {
      const call = createTicketModalCall
      const { finalBody, phoneNum } = composeCallTicketArgs(call)

      const res = await window.api.tickets.createFromCall({
        clientId: createTicketModalClient ? createTicketModalClient.id : null,
        title: createTicketTitle,
        body: finalBody,
        phone: normalizePhoneToDigits(phoneNum),
        callId: call.callId || '',
        date: call.startedAt || '',
        duration: String(parseDurationToSeconds(call.duration || '')),
        ticketType: createTicketType,
        groupId: createTicketGroupId,
        userId: createTicketUserId,
        priorityId: createTicketPriorityId,
        stateId: createTicketStateId,
        pendingTime: isPendingState('', Number(createTicketStateId)) ? new Date(createTicketPendingTime).toISOString() : null
      })
      if (res.ok && res.newTicketId) {
        // Wrapper-based create cannot upload files; attach them as a follow-up
        // Zammad article on the freshly created ticket.
        if (createTicketAttachments.length > 0) {
          await window.api.tickets.addComment({
            ticketId: res.newTicketId,
            body: '',
            internal: false,
            articleType: 'note',
            attachments: attachmentsPayload()
          })
        }
        setCreateTicketModalCall(null)
        refetch()
        if (openCreatedTicket) navigate(`/dashboard/tickets/${res.newTicketId}`)
      } else {
        throw new Error('Не удалось получить ID новой заявки')
      }
    } catch (err) {
      setCreateTicketError(err instanceof Error ? err.message : 'Ошибка при создании заявки')
    } finally {
      setCreateTicketLoading(false)
    }
  }

  // Closing follows the same rules as normal ticket work: reason + spent time +
  // closing comment are required. The ticket is created open, then closed via the
  // Zammad API (which the wrapper-based create cannot do — it has no reason field).
  const handleCloseTicket = async () => {
    if (!createTicketModalCall) return
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
      const call = createTicketModalCall
      const { finalBody, phoneNum } = composeCallTicketArgs(call)

      const res = await window.api.tickets.createFromCall({
        clientId: createTicketModalClient ? createTicketModalClient.id : null,
        title: createTicketTitle,
        body: finalBody,
        phone: normalizePhoneToDigits(phoneNum),
        callId: call.callId || '',
        date: call.startedAt || '',
        duration: String(parseDurationToSeconds(call.duration || '')),
        ticketType: createTicketType,
        groupId: createTicketGroupId,
        userId: createTicketUserId,
        priorityId: createTicketPriorityId,
        stateId: '',          // create in the wrapper's default open state
        pendingTime: null,
        timeUnit: '0'         // spent time is accounted on the closing article below
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

      setCreateTicketModalCall(null)
      refetch()
      if (openCreatedTicket) navigate(`/dashboard/tickets/${res.newTicketId}`)
    } catch (err) {
      setCreateTicketError(err instanceof Error ? err.message : 'Ошибка при закрытии заявки')
    } finally {
      setCreateTicketLoading(false)
    }
  }

  const handleManualBind = async () => {
    if (!bindTicketModalCall) return
    setBindTicketLoading(true)
    setBindTicketError('')
    try {
      const call = bindTicketModalCall
      const src = call.phone || call.raw['Источник'] || call.raw['source'] || ''
      const dst = call.operator || call.raw['Ответчик'] || call.raw['operator'] || ''
      await window.api.calls.bindToTicket({
        ticketId: bindTicketId,
        src,
        dst,
        callId: call.callId || '',
        duration: String(parseDurationToSeconds(call.duration || '')),
        date: call.startedAt || ''
      })
      setBindTicketModalCall(null)
      refetch()
    } catch (err) {
      setBindTicketError(err instanceof Error ? err.message : 'Ошибка привязки звонка')
    } finally {
      setBindTicketLoading(false)
    }
  }

  const selectedStateName = (filtersData?.states ?? []).find(s => Number(s.id) === Number(createTicketStateId))?.name || ''
  const closeMode = isClosedState(selectedStateName)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">

      <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted/25 p-1">
          {SECTIONS.map(s => (
            <button
              key={s.key} type="button"
              onClick={() => setActiveSection(s.key)}
              className={cn(
                'h-8 rounded px-3 text-xs',
                activeSection === s.key ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s.title}
              {s.key === 'current' && (currentCalls?.records.length ?? 0) > 0 && (
                <span className="ml-1.5 text-[10px] tabular-nums opacity-60">{currentCalls?.records.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            {/* Обычное текстовое поле, а не type="search": у того браузер рисует
                свой крестик, чужой всему остальному интерфейсу. */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') applySearch()
                if (e.key === 'Escape') clearSearch()
              }}
              placeholder="Номер, клиент, организация — и Enter"
              className="h-9 w-full rounded-md border border-border bg-muted/50 pl-8 pr-8 text-xs text-foreground outline-none focus:border-primary/60"
            />
            {search && (
              <button
                type="button"
                onClick={clearSearch}
                title="Очистить"
                className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
            {/* Ход поиска — полоской под самим полем: крутящееся колесо рядом с
                текстом выглядело чужеродно. */}
            {awaitingServer && (
              <span className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 overflow-hidden rounded-full bg-primary/15">
                <motion.span
                  className="block h-full w-1/3 rounded-full bg-primary"
                  animate={{ x: ['-100%', '300%'] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                />
              </span>
            )}
          </div>
          {activeSection === 'current' && (
            <Button type="button" variant="ghost" size="sm" disabled={isFetching} onClick={() => refetch()} className="h-9 gap-1.5 rounded-md border border-border/60 px-3 text-xs">
              <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              Обновить
            </Button>
          )}
        </div>
      </div>

      {isError && (
        <ErrorNotice
          className="mb-3"
          error={error}
          fallback="Ошибка загрузки звонков"
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      )}

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-card/40">
        <div className="sticky top-0 z-10 flex items-center border-b border-border bg-card/95 px-3 py-2.5">
          <div className="w-7 shrink-0" />
          <div className="w-36 shrink-0 text-xs font-semibold text-foreground">Дата</div>
          <div className="w-72 shrink-0 text-xs font-semibold text-foreground">Источник</div>
          <div className="w-44 shrink-0 text-xs font-semibold text-foreground">Ответчик</div>
          <div className="w-28 shrink-0 text-xs font-semibold text-foreground">Длительность</div>
          {hasRecordingCol && <div className="w-8 shrink-0" />}
          <div className="w-60 shrink-0 text-xs font-semibold text-foreground pl-2">Действия</div>
        </div>

        <div className="divide-y divide-border/30">
          {isLoading ? (
            Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="px-3 py-3">
                <div className="h-7 animate-pulse rounded bg-muted/40" />
              </div>
            ))
          ) : calls.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <PhoneCall className="mx-auto mb-2 h-8 w-8 opacity-40" />
              <p className="text-sm">Звонков нет</p>
            </div>
          ) : calls.map(call => {
            const isActive = playingCall?.id === call.id
            const source = call.client || call.organization || call.phone || call.raw['Источник'] || call.raw['source'] || '—'
            const isCreateOpen = activeCreateDropdownCallId === call.id
            const isBindOpen = activeBindDropdownCallId === call.id

            return (
              <div
                key={`${call.section}-${call.id}`}
                className={cn(
                  'flex items-center px-3 py-2.5 text-sm transition-colors',
                  call.isLinked
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/15'
                    : isActive
                      ? 'bg-primary/5'
                      : 'hover:bg-accent/20'
                )}
              >
                <div className="w-7 shrink-0">
                  <DirectionIcon direction={call.direction} />
                </div>
                <div className="w-36 shrink-0 select-text tabular-nums text-foreground/70" title={call.startedAt || ''}>
                  {call.startedAt || '—'}
                </div>
                <div className="w-72 shrink-0 select-text text-foreground pr-4 truncate" title={source}>{source}</div>
                <div className="w-44 shrink-0 select-text truncate text-foreground/80" title={call.operator || ''}>{call.operator || '—'}</div>
                <div className="w-28 shrink-0 select-text tabular-nums text-foreground/70">{call.duration || '—'}</div>
                {hasRecordingCol && (
                  <div className="w-8 shrink-0">
                    {call.recordingUrl ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (isActive) {
                            playerRef.current?.toggle()
                          } else {
                            setPlayingCall(call)
                          }
                        }}
                        className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
                          isActive
                            ? 'bg-primary/20 text-primary hover:bg-primary/30'
                            : 'text-muted-foreground/40 hover:bg-accent hover:text-foreground'
                        )}
                      >
                        {isActive && isPlayerPlaying
                          ? <Pause className="h-3.5 w-3.5" />
                          : <Play className="h-3.5 w-3.5" />
                        }
                      </button>
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center text-[10px] text-muted-foreground/20">—</span>
                    )}
                  </div>
                )}
                <div className="w-60 shrink-0 flex items-center gap-2 pl-2">
                  {call.isLinked ? (
                    <div className="w-28 shrink-0 flex items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        data-tab-path={`/dashboard/tickets/${call.linkedTicketId}`}
                        onClick={() => navigate(`/dashboard/tickets/${call.linkedTicketId}`)}
                        className="h-8 gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/25"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Открыть заявку
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="w-28 shrink-0 relative flex items-center" ref={isCreateOpen ? dropdownRef : undefined}>
                        {call.createCandidates && call.createCandidates.length > 0 ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveBindDropdownCallId(null)
                                setActiveCreateDropdownCallId(isCreateOpen ? null : call.id)
                              }}
                              className="h-8 w-full justify-start gap-1 text-xs text-primary hover:bg-primary/10 px-2"
                            >
                              <Plus className="h-3.5 w-3.5 shrink-0" />
                              Создать
                              <ChevronDown className="h-3 w-3 ml-auto shrink-0" />
                            </Button>

                            {isCreateOpen && (
                              <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border border-border bg-popover bg-opacity-100 p-1 shadow-xl text-foreground flex flex-col text-left">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveCreateDropdownCallId(null)
                                    setCreateTicketModalCall(call)
                                    setCreateTicketModalClient(null)
                                    setCreateTicketTitle('')
                                    setCreateTicketBody('')
                                    setCreateTicketError('')
                                  }}
                                  className="w-full text-left rounded px-2.5 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Быстрая заявка
                                </button>
                                <div className="h-px bg-border my-1" />
                                <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Создать для клиента:</div>
                                {call.createCandidates.map((c) => (
                                  <button
                                    key={c.clientId}
                                    type="button"
                                    onClick={() => {
                                      setActiveCreateDropdownCallId(null)
                                      setCreateTicketModalCall(call)
                                      setCreateTicketModalClient({ id: Number(c.clientId), name: c.name })
                                      setCreateTicketTitle('')
                                      setCreateTicketBody('')
                                      setCreateTicketError('')
                                    }}
                                    className="w-full text-left rounded px-2.5 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground whitespace-normal break-words"
                                    title={c.name}
                                  >
                                    {c.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setCreateTicketModalCall(call)
                              setCreateTicketModalClient(null)
                              setCreateTicketTitle('')
                              setCreateTicketBody('')
                              setCreateTicketError('')
                            }}
                            className="h-8 w-full justify-start gap-1 text-xs text-primary hover:bg-primary/10 px-2"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            Создать
                          </Button>
                        )}
                      </div>

                      <div className="w-28 shrink-0 relative flex items-center" ref={isBindOpen ? dropdownRef : undefined}>
                        {call.bindCandidates && call.bindCandidates.length > 0 ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveCreateDropdownCallId(null)
                                setActiveBindDropdownCallId(isBindOpen ? null : call.id)
                              }}
                              className="h-8 w-full justify-start gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 px-2"
                            >
                              <Link className="h-3.5 w-3.5 shrink-0" />
                              Привязать
                              <ChevronDown className="h-3 w-3 ml-auto shrink-0" />
                            </Button>

                            {isBindOpen && (
                              <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border border-border bg-popover bg-opacity-100 p-1 shadow-xl text-foreground flex flex-col text-left">
                                <div className="px-2.5 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Привязать к заявке:</div>
                                {call.bindCandidates.map((t) => (
                                  <button
                                    key={t.ticketId}
                                    type="button"
                                    onClick={() => {
                                      setActiveBindDropdownCallId(null)
                                      handleBindCall(call, t.ticketId)
                                    }}
                                    className="w-full text-left rounded px-2.5 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground whitespace-normal break-words"
                                    title={t.name}
                                  >
                                    #{t.ticketId} {t.name}
                                  </button>
                                ))}
                                <div className="h-px bg-border my-1" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveBindDropdownCallId(null)
                                    setBindTicketModalCall(call)
                                    setBindTicketId('')
                                    setBindTicketError('')
                                  }}
                                  className="w-full text-left rounded px-2.5 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5"
                                >
                                  <Link className="h-3.5 w-3.5" />
                                  Привязать вручную...
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBindTicketModalCall(call)
                              setBindTicketId('')
                              setBindTicketError('')
                            }}
                            className="h-8 w-full justify-start gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 px-2"
                          >
                            <Link className="h-3.5 w-3.5 shrink-0" />
                            Привязать
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {playingCall && (
        <BottomPlayer
          ref={playerRef}
          call={playingCall}
          onClose={() => setPlayingCall(null)}
          onPlayingChange={setIsPlayerPlaying}
        />
      )}

      <div className="mt-3 flex shrink-0 items-center justify-between gap-3 px-1">
        {debouncedSearch ? (
          // При поиске листать нечем: сервер отдаёт ровно столько, сколько
          // успел найти, — поэтому не страницы, а «показать ещё».
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {awaitingServer && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
            {showingPreliminary
              ? `Найдено: ${preliminary.length} · ищем остальные звонки, это может занять до полуминуты`
              : awaitingServer
                ? 'Ищем по всем звонкам, это может занять до полуминуты…'
                : `Найдено: ${calls.length}`}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Страница {page}</span>
        )}

        <div className="flex items-center gap-1.5">
          {debouncedSearch ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isFetching || calls.length < callsPerPage}
              onClick={() => setExtraRows(value => value + SEARCH_PAGE_SIZE)}
              className="h-8 gap-1 px-2.5 text-xs"
            >
              {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Показать ещё
            </Button>
          ) : (
            <>
          <Button type="button" variant="ghost" size="sm" disabled={page <= 1 || isLoading} onClick={() => setPage(page - 1)} className="h-8 gap-1 px-2.5 text-xs">
            <ChevronLeft className="h-3.5 w-3.5" />
            Пред
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={isLoading || calls.length < callsPerPage} onClick={() => setPage(page + 1)} className="h-8 gap-1 px-2.5 text-xs">
            След
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
            </>
          )}
        </div>
      </div>

      {createTicketModalCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 text-foreground animate-in fade-in zoom-in duration-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Быстрая заявка
              </h3>
              <button
                type="button"
                onClick={() => setCreateTicketModalCall(null)}
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
                onClick={() => setCreateTicketModalCall(null)}
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
                {closeMode ? 'Закрыть' : 'Создать'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {bindTicketModalCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 text-foreground animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Привязать звонок вручную</h3>
              <button
                type="button"
                onClick={() => setBindTicketModalCall(null)}
                className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {bindTicketError && (
              <div className="flex items-center gap-2 rounded bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{bindTicketError}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bind-ticket-id" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Номер заявки (ID)</label>
              <input
                id="bind-ticket-id"
                type="text"
                value={bindTicketId}
                onChange={(e) => setBindTicketId(e.target.value.replace(/\D/g, ''))}
                placeholder="Например, 605598"
                className="h-9 w-full rounded border border-border bg-muted/30 px-3 text-xs outline-none focus:border-primary/60"
              />
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={bindTicketLoading}
                onClick={() => setBindTicketModalCall(null)}
                className="h-9 text-xs"
              >
                Отмена
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={bindTicketLoading || !bindTicketId.trim()}
                onClick={handleManualBind}
                className="h-9 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {bindTicketLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Link className="h-3.5 w-3.5" />
                )}
                Привязать
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
