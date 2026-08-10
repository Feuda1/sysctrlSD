import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDown, ChevronLeft, ChevronRight, Mail, Phone, Calendar, Clock, StickyNote, Download, Loader2, Send, Globe, Award, Shield, MessageSquare, Info, ChevronDown, ChevronUp, Play, Pause, RefreshCw, AlertCircle, X, ZoomIn, ZoomOut, RotateCcw, FileText, FileImage, FileArchive, Building, User, ExternalLink, Search, Paperclip, Check, Hand, Copy, GitMerge, UserCheck, UserCog, PlusCircle, Volume2, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTicketFilters } from '@/hooks/useTickets'
import { useUIStore } from '@/store/ui'
import { useAuthStore } from '@/store/auth'
import { getStateBadgeClass, getTicketTypeBadgeClass, formatTicketDate, formatScore } from '@/types/ticket'
import type { Ticket, TicketArticle, TicketAttachment, TicketCustomer, OrganizationDetails, TicketHistoryItem } from '@/types/ticket'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { AiAssistButton } from '@/components/ai/AiAssistButton'
import { useTabsStore } from '@/store/tabs'
import { useMacrosStore } from '@/store/macros'
import {
  ARTICLE_TYPE_OPTIONS,
  cleanBody,
  dataUrlToText,
  dateTimeLocalFromRaw,
  formatAttachmentSize,
  formatAudioTime,
  getArticleTypeLabel,
  getAttachmentKind,
  getAutoArticleType,
  getPriorityOrder,
  getVisibleAttachments,
  historyActorColor,
  historyActorInitials,
  historyDateLabel,
  historyFormatTime,
  isAutoReplyArticle,
  isPendingOrClosedState,
  isReasonRequiredState,
  officeKind,
  parseFirstArticle,
  readPlayerSettings,
  toDateTimeLocalValue,
  toHtmlComment,
  tomorrowAtEleven,
  writePlayerSettings,
  type ArticleAttachment,
  type ComposerAttachment,
  type ViewerItem
} from '@/lib/ticketFormat'
import { readFileAsDataUrl, dataUrlPayload } from '@/lib/utils'

interface Member {
  id: number
  firstname: string
  lastname: string
  email: string | null
  phone: string | null
  mobile: string | null
  department: string | null
  max: string | null
  telegram: string | null
}

function ChannelIcon({ channel, className }: { channel?: string | null; className?: string }) {
  if (!channel) return null
  const c = channel.toLowerCase()
  if (c.includes('mail') || c.includes('email')) {
    return <span title="Почта" className={cn("flex shrink-0", className)}><Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" /></span>
  }
  if (c.includes('phone') || c.includes('call') || c.includes('telephon')) {
    return <span title="Телефон" className={cn("flex shrink-0", className)}><Phone className="h-3.5 w-3.5 text-green-400 shrink-0" /></span>
  }
  if (c.includes('telegram') || c.includes('max') || c.includes('chat') || c.includes('fax')) {
    return <span title="Telegram / Бот" className={cn("flex shrink-0", className)}><Send className="h-3.5 w-3.5 text-sky-400 shrink-0" /></span>
  }
  if (c.includes('web')) {
    return <span title="Web" className={cn("flex shrink-0", className)}><Globe className="h-3.5 w-3.5 text-orange-400 shrink-0" /></span>
  }
  if (c.includes('note')) {
    return <span title="Заметка" className={cn("flex shrink-0", className)}><StickyNote className="h-3.5 w-3.5 text-amber-400 shrink-0" /></span>
  }
  return null
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

function AttachmentTile({
  ticketId,
  articleId,
  attachment,
  isPrivate,
  onOpen,
  onDownload
}: {
  ticketId: number
  articleId: number
  attachment: TicketAttachment
  isPrivate?: boolean
  onOpen: (articleId: number, attachment: TicketAttachment) => void
  onDownload: (articleId: number, attachment: TicketAttachment) => void
}) {
  const kind = getAttachmentKind(attachment)
  const Icon = kind === 'image' ? FileImage : kind === 'text' ? FileText : FileArchive
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    if (kind !== 'image') {
      setThumbUrl(null)
      return
    }

    window.api.tickets.getAttachment(ticketId, articleId, attachment.id)
      .then(result => {
        if (alive) setThumbUrl(result.dataUrl)
      })
      .catch(() => {
        if (alive) setThumbUrl(null)
      })

    return () => { alive = false }
  }, [kind, ticketId, articleId, attachment.id])

  return (
    <div
      className={cn(
        "group flex min-w-48 max-w-80 items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-all duration-150",
        isPrivate
          ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
          : "border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(articleId, attachment)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        title="Открыть вложение"
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt={attachment.filename} className="h-12 w-16 shrink-0 rounded-md object-cover" />
        ) : (
          <Icon className="h-4 w-4 shrink-0 opacity-80" />
        )}
        <span className="min-w-0 truncate font-semibold">{attachment.filename}</span>
      </button>
      <button
        type="button"
        onClick={() => onDownload(articleId, attachment)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-70 hover:bg-background/30 hover:opacity-100"
        title="Скачать"
      >
        <Download className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function AttachmentPreviewCard({
  ticketId,
  attachment,
  onOpen,
  onDownload,
  loading
}: {
  ticketId: number
  attachment: ArticleAttachment
  onOpen: (articleId: number, attachment: TicketAttachment) => void
  onDownload: (articleId: number, attachment: TicketAttachment) => void
  loading?: boolean
}) {
  const kind = getAttachmentKind(attachment)
  const Icon = kind === 'image' ? FileImage : kind === 'text' ? FileText : FileArchive
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const sizeLabel = formatAttachmentSize(attachment.size)

  useEffect(() => {
    let alive = true
    if (kind !== 'image') {
      setThumbUrl(null)
      return
    }

    window.api.tickets.getAttachment(ticketId, attachment.articleId, attachment.id)
      .then(result => {
        if (alive) setThumbUrl(result.dataUrl)
      })
      .catch(() => {
        if (alive) setThumbUrl(null)
      })

    return () => { alive = false }
  }, [kind, ticketId, attachment.articleId, attachment.id])

  return (
    <div
      className={cn(
        "group relative grid min-h-24 grid-cols-[72px_minmax(0,1fr)_28px] gap-3 rounded-lg border p-2.5 transition-colors",
        attachment.isPrivate
          ? "border-red-800/45 bg-red-950/20 hover:bg-red-950/35"
          : "border-border bg-muted/25 hover:bg-muted/45"
      )}
    >
      <button
        type="button"
        onClick={() => onOpen(attachment.articleId, attachment)}
        className="relative h-[72px] w-[72px] overflow-hidden rounded-md border border-border/60 bg-background/40"
        title="Открыть вложение"
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt={attachment.filename} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Icon className="h-7 w-7 text-muted-foreground" />
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onOpen(attachment.articleId, attachment)}
        className="flex min-w-0 flex-col justify-center text-left"
      >
        <span className="truncate text-xs font-semibold text-foreground" title={attachment.filename}>
          {attachment.filename}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
          <span>{kind.toUpperCase()}</span>
          {sizeLabel && <span>{sizeLabel}</span>}
          <span>{formatTicketDate(attachment.articleDate)}</span>
        </span>
        {attachment.isPrivate && (
          <span className="mt-1 w-fit rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-300">
            Приватное
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onDownload(attachment.articleId, attachment)}
        className="flex h-7 w-7 items-center justify-center self-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground"
        title="Скачать"
      >
        <Download className="h-3.5 w-3.5" />
      </button>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/60">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}

function MediaViewer({
  ticketId,
  items,
  index,
  onIndexChange,
  onClose
}: {
  ticketId: number
  items: ViewerItem[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
}) {
  const item = items[index]
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [contentType, setContentType] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [wrap, setWrap] = useState(true)

  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  useEffect(() => {
    setScale(1); setOffset({ x: 0, y: 0 }); setDrag(null); setError(null)
    if (!item) return
    if (item.preloadedDataUrl) {
      setDataUrl(item.preloadedDataUrl)
      setContentType(item.mimeType)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    setDataUrl(null)
    window.api.tickets.getAttachment(ticketId, item.articleId, item.id)
      .then(r => { if (alive) { setDataUrl(r.dataUrl); setContentType(r.contentType || item.mimeType) } })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Не удалось загрузить файл') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [ticketId, item?.articleId, item?.id, item?.preloadedDataUrl])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1)
      else if (e.key === 'ArrowRight' && hasNext) onIndexChange(index + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, hasPrev, hasNext, onClose, onIndexChange])

  if (!item) return null

  const kind = dataUrl ? getAttachmentKind({ filename: item.filename, mimeType: item.mimeType }, contentType) : 'file'
  const office = officeKind(item.filename)
  const text = kind === 'text' && dataUrl ? dataUrlToText(dataUrl) : ''
  const zoomImage = (delta: number) => setScale(v => Math.min(8, Math.max(0.25, Number((v + delta).toFixed(2)))))
  const resetImageView = () => { setScale(1); setOffset({ x: 0, y: 0 }) }

  const download = () => {
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = item.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="fixed inset-x-0 bottom-0 top-10 z-[80] flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4 pr-12">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-semibold text-foreground">{item.filename}</span>
          {item.size > 0 && <span className="shrink-0 text-xs text-muted-foreground">{Math.ceil(item.size / 1024)} КБ</span>}
          {items.length > 1 && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">{index + 1} / {items.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {kind === 'text' && (
            <button
              type="button"
              onClick={() => setWrap(w => !w)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
                wrap ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
              )}
            >
              <span className={cn("flex h-3.5 w-3.5 items-center justify-center rounded border", wrap ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {wrap && <Check className="h-2.5 w-2.5" />}
              </span>
              Перенос строки
            </button>
          )}
          {kind === 'image' && (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomImage(-0.25)}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => zoomImage(0.25)}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetImageView}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={download} disabled={!dataUrl}>
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-border bg-card shadow-sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden p-4"
        onWheel={kind === 'image'
          ? event => { event.preventDefault(); zoomImage(event.deltaY > 0 ? -0.12 : 0.12) }
          : undefined}
      >
        {/* Prev / next */}
        {hasPrev && (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent"
            aria-label="Предыдущее"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card/90 text-foreground shadow-lg backdrop-blur transition-colors hover:bg-accent"
            aria-label="Следующее"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}

        {loading && <Loader2 className="h-7 w-7 animate-spin text-primary" />}
        {error && !loading && (
          <div className="flex flex-col items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-8 w-8" />
            {error}
          </div>
        )}

        {!loading && !error && dataUrl && (
          <>
            {kind === 'image' && (
              <img
                src={dataUrl}
                alt={item.filename}
                className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  cursor: drag ? 'grabbing' : (scale > 1 ? 'grab' : 'default')
                }}
                onLoad={resetImageView}
                onMouseDown={event => { if (scale <= 1) return; setDrag({ x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y }) }}
                onMouseMove={event => { if (!drag) return; setOffset({ x: drag.ox + event.clientX - drag.x, y: drag.oy + event.clientY - drag.y }) }}
                onMouseUp={() => setDrag(null)}
                onMouseLeave={() => setDrag(null)}
                draggable={false}
              />
            )}
            {kind === 'pdf' && <iframe title={item.filename} src={dataUrl} className="h-full w-full rounded-lg border border-border bg-white" />}
            {kind === 'text' && (
              <pre className={cn(
                "h-full w-full overflow-auto rounded-lg border border-border bg-zinc-950 p-4 text-xs leading-5 text-zinc-100",
                wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"
              )}>
                {text || 'Не удалось прочитать текст файла'}
              </pre>
            )}
            {kind === 'audio' && <audio src={dataUrl} controls className="w-full max-w-2xl" />}
            {kind === 'video' && <video src={dataUrl} controls className="max-h-full max-w-full rounded-lg" />}
            {kind === 'file' && (
              <div className="flex max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-card p-8 text-center">
                {office === 'excel'
                  ? <FileText className="h-12 w-12 text-emerald-500" />
                  : office === 'word'
                    ? <FileText className="h-12 w-12 text-blue-500" />
                    : office === 'powerpoint'
                      ? <FileText className="h-12 w-12 text-orange-500" />
                      : <FileArchive className="h-12 w-12 text-muted-foreground" />}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {office === 'excel' ? 'Документ Excel' : office === 'word' ? 'Документ Word' : office === 'powerpoint' ? 'Презентация PowerPoint' : 'Предпросмотр недоступен'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Встроенный просмотр этого формата недоступен — скачайте файл, чтобы открыть его.
                  </p>
                </div>
                <Button size="sm" onClick={download} className="gap-2">
                  <Download className="h-4 w-4" />
                  Скачать
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}


function MiniAudioPlayer({ url, isPrivate }: { url: string; isPrivate?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(() => readPlayerSettings().speed)
  const [volume, setVolume] = useState(() => readPlayerSettings().volume)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      audio.src = ''
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    audio.playbackRate = speed
    writePlayerSettings({ speed, volume })
  }, [speed, volume])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return

    try {
      if (!audioUrl) {
        setLoading(true)
        setError(null)
        const recording = await window.api.calls.getRecording(url)
        setAudioUrl(recording.dataUrl)
        audio.src = recording.dataUrl
        audio.load()
        audio.volume = volume
        audio.playbackRate = speed
        await audio.play()
        setPlaying(true)
        return
      }

      if (audio.paused) {
        await audio.play()
        setPlaying(true)
      } else {
        audio.pause()
        setPlaying(false)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Не удалось воспроизвести запись'
      if (!/interrupted|abort/i.test(msg)) setError(msg)
      setPlaying(false)
    } finally {
      setLoading(false)
    }
  }

  const seek = (value: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = value
    setCurrentTime(value)
  }

  const progress = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0

  return (
    <div className={cn(
      "mt-1.5 flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2",
      isPrivate ? "border-red-900/45 bg-red-950/35" : "border-zinc-700/50 bg-zinc-950/25"
    )}>
      <audio
        ref={audioRef}
        onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={event => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
          isPrivate ? "bg-red-500/20 text-red-200 hover:bg-red-500/30" : "bg-primary/20 text-primary hover:bg-primary/30"
        )}
        title="Воспроизвести запись звонка"
      >
        {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <span className="w-8 shrink-0 text-[10px] tabular-nums text-zinc-400">{formatAudioTime(currentTime)}</span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(currentTime, duration || 0)}
        disabled={!audioUrl}
        onChange={event => seek(Number(event.target.value))}
        className="h-1 min-w-24 flex-1 cursor-pointer appearance-none rounded-full disabled:cursor-not-allowed disabled:opacity-40"
        style={{ background: `linear-gradient(to right, ${isPrivate ? '#f87171' : 'hsl(var(--primary))'} ${progress}%, rgba(113,113,122,.45) ${progress}%)` }}
      />
      <span className="w-8 shrink-0 text-right text-[10px] tabular-nums text-zinc-400">{formatAudioTime(duration)}</span>

      <div className="flex items-center gap-0.5 ml-2">
        {[1, 1.25, 1.5, 2].map(v => (
          <button
            key={v}
            type="button"
            onClick={() => setSpeed(v)}
            className={cn(
              'h-6 rounded px-1 transition-colors text-[9px] tabular-nums',
              speed === v ? 'bg-primary/20 text-primary font-medium' : 'text-zinc-400 hover:text-zinc-200'
            )}
          >
            {v}x
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 ml-2 mr-1">
        <Volume2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={event => setVolume(Number(event.target.value))}
          className="h-1 w-12 cursor-pointer appearance-none rounded-full"
          style={{ background: `linear-gradient(to right, ${isPrivate ? '#f87171' : 'hsl(var(--primary))'} ${volume * 100}%, rgba(113,113,122,.45) ${volume * 100}%)` }}
        />
      </div>

      {error && (
        <span className="flex min-w-0 items-center gap-1 text-[10px] text-red-300" title={error}>
          <AlertCircle className="h-3 w-3 shrink-0" />
          <span className="max-w-28 truncate">{error}</span>
        </span>
      )}
    </div>
  )
}

function TicketExportModal({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const [withText, setWithText] = useState(true)
  const [withImages, setWithImages] = useState(true)
  const [withFiles, setWithFiles] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ path: string; images: number; files: number } | null>(null)

  const nothingSelected = !withText && !withImages && !withFiles

  // The overlay covers the whole window, so it must always be dismissable —
  // otherwise a modal left standing looks exactly like a frozen app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await window.api.tickets.exportTicket(ticketId, {
        text: withText,
        images: withImages,
        files: withFiles
      })
      if (res.canceled) return
      if (res.ok && res.path) {
        setDone({ path: res.path, images: res.savedImages ?? 0, files: res.savedFiles ?? 0 })
      }
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить выгрузку')
    } finally {
      setSaving(false)
    }
  }

  const toggles: { label: string; hint: string; value: boolean; onChange: (value: boolean) => void }[] = [
    { label: 'Сохранить текст', hint: 'Markdown со всей перепиской и параметрами заявки', value: withText, onChange: setWithText },
    { label: 'Сохранить изображения', hint: 'Картинки из сообщений, на своих местах в тексте', value: withImages, onChange: setWithImages },
    { label: 'Сохранить файлы', hint: 'Остальные вложения, со ссылками из сообщений', value: withFiles, onChange: setWithFiles }
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => { if (!saving) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={event => event.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-foreground">
            <FileDown className="h-[18px] w-[18px] text-primary" />
            Выгрузка заявки
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-xs text-green-400">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Выгрузка сохранена</p>
                <p className="mt-1 break-all text-[11px] text-green-400/80">{done.path}</p>
                <p className="mt-1 text-[11px] text-green-400/80">
                  Изображений: {done.images} · Файлов: {done.files}
                </p>
              </div>
            </div>
            <Button onClick={onClose} className="w-full">Готово</Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Переписка сохраняется в Markdown: у каждого сообщения указан автор, дата и то,
              какие файлы и изображения были в нём приложены. Если выбраны вложения, всё
              складывается в ZIP рядом с текстом.
            </p>

            <div className="flex flex-col gap-2">
              {toggles.map(toggle => (
                <button
                  key={toggle.label}
                  type="button"
                  onClick={() => toggle.onChange(!toggle.value)}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">{toggle.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{toggle.hint}</span>
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                      toggle.value ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  >
                    <motion.span
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className={cn(
                        'h-4 w-4 rounded-full bg-white shadow-sm',
                        toggle.value ? 'ml-auto' : 'mr-auto'
                      )}
                    />
                  </span>
                </button>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="ghost" onClick={onClose} disabled={saving}>Отмена</Button>
              <Button onClick={handleSave} disabled={saving || nothingSelected} className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                {saving ? 'Собираю…' : 'Сохранить'}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

function ArticleBody({ html, ticketId, articleId, className, onImageOpen }: { html: string; ticketId: number; articleId: number; className?: string; onImageOpen?: (dataUrl: string, filename: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onImageOpenRef = useRef(onImageOpen)
  onImageOpenRef.current = onImageOpen

  useEffect(() => {
    if (!containerRef.current) return

    const imgs = containerRef.current.querySelectorAll('img')
    imgs.forEach(async (img) => {
      const src = img.getAttribute('src')
      if (!src) return

      // Make every image zoomable — clicking opens it in the media viewer.
      img.style.cursor = 'zoom-in'
      if (!img.dataset.viewerBound) {
        img.dataset.viewerBound = '1'
        img.addEventListener('click', () => {
          if (img.src) onImageOpenRef.current?.(img.src, img.getAttribute('alt') || 'Изображение')
        })
      }

      let tId = ticketId
      let aId = articleId
      let attId = 0
      let isMatch = false

      const taMatch = src.match(/\/ticket_attachment\/(\d+)\/(\d+)\/(\d+)/)
      if (taMatch) {
        tId = parseInt(taMatch[1], 10)
        aId = parseInt(taMatch[2], 10)
        attId = parseInt(taMatch[3], 10)
        isMatch = true
      } else {
        const mimeMatch = src.match(/\/mime_attachment\/(\d+)\/(\d+)/)
        if (mimeMatch) {
          aId = parseInt(mimeMatch[1], 10)
          attId = parseInt(mimeMatch[2], 10)
          isMatch = true
        }
      }

      if (isMatch && attId > 0) {
        try {
          const result = await window.api.tickets.getAttachment(tId, aId, attId)
          if (result && result.dataUrl) {
            img.src = result.dataUrl
          }
        } catch (err) {
          console.error('Ошибка загрузки inline-изображения:', err)
        }
      }
    })
  }, [html, ticketId, articleId])

  return (
    <div 
      ref={containerRef}
      className={cn(
        "select-text prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-800 dark:text-zinc-100 break-words leading-6",
        "[&_*]:!bg-transparent [&_*]:!text-inherit [&_a]:!text-primary [&_table]:!border-border [&_td]:!border-border [&_th]:!border-border",
        className
      )}
      dangerouslySetInnerHTML={{ __html: cleanBody(html) }}
    />
  )
}

function CustomToggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
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
  renderValue?: (value: T | undefined) => ReactNode
  renderOption?: (value: T, active: boolean) => ReactNode
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

function CustomDateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null)
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
        const portal = document.getElementById('ticket-datetime-portal')
        if (!portal?.contains(event.target as Node)) setOpen(false)
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
          id="ticket-datetime-portal"
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

function TicketHistoryModal({
  items,
  loading,
  onClose
}: {
  items: TicketHistoryItem[]
  loading: boolean
  onClose: () => void
}) {
  const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const groups: { label: string; items: TicketHistoryItem[] }[] = []
  for (const item of sorted) {
    const label = historyDateLabel(item.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-end bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-full w-full max-w-[420px] flex-col border-l border-border bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4 text-primary" />
            История изменений
            {!loading && sorted.length > 0 && (
              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                {sorted.length}
              </span>
            )}
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загружаю...
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Clock className="h-10 w-10 opacity-15" />
              <span className="text-sm">История недоступна</span>
            </div>
          ) : (
            <div>
              {groups.map(group => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 flex items-center gap-3 bg-card/95 px-5 py-2 backdrop-blur-sm">
                    <div className="h-px flex-1 bg-border/40" />
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      {group.label}
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>

                  <div className="px-4">
                    {group.items.map((item, idx) => {
                      const hasChange = !!(item.fieldName && (item.from || item.to))
                      const isSystem = /служеб|систем|system|автомат/i.test(item.actorName)
                      const initials = historyActorInitials(item.actorName)
                      const avatarColor = isSystem
                        ? 'bg-zinc-700/40 text-zinc-500'
                        : historyActorColor(item.actorName)

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex gap-3 py-3',
                            idx < group.items.length - 1 && 'border-b border-border/25'
                          )}
                        >
                          <div className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                            avatarColor
                          )}>
                            {initials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                              <span className={cn(
                                'truncate text-xs font-semibold',
                                isSystem ? 'text-muted-foreground/70' : 'text-foreground'
                              )}>
                                {item.actorName}
                              </span>
                              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60">
                                {historyFormatTime(item.createdAt)}
                              </span>
                            </div>

                            {hasChange ? (
                              <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                                  {item.fieldName}
                                </span>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  {item.from ? (
                                    <span className="inline-flex max-w-[140px] items-center truncate rounded border border-red-900/50 bg-red-950/50 px-2 py-0.5 text-[11px] text-red-400/80 line-through">
                                      {item.from}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground/30">пусто</span>
                                  )}
                                  <span className="text-muted-foreground/40 text-xs">→</span>
                                  {item.to ? (
                                    <span className="inline-flex max-w-[140px] items-center truncate rounded border border-emerald-900/50 bg-emerald-950/50 px-2 py-0.5 text-[11px] text-emerald-400">
                                      {item.to}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground/30">пусто</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className={cn(
                                'text-xs leading-5',
                                isSystem ? 'text-muted-foreground/50' : 'text-foreground/70'
                              )}>
                                {item.action}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}



export default function TicketDetailsPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const idNum = parseInt(ticketId ?? '0', 10)
  const macros = useMacrosStore(s => s.macros)
  const ticketScrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [expandedAutoReplies, setExpandedAutoReplies] = useState<Record<number, boolean>>({})
  const [previewItems, setPreviewItems] = useState<ViewerItem[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewLoadingKey, setPreviewLoadingKey] = useState<string | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'tickets'>('info')
  const [orgTicketsSearch, setOrgTicketsSearch] = useState('')
  const [orgTicketsOwner, setOrgTicketsOwner] = useState('all')
  const [orgTicketsState, setOrgTicketsState] = useState('all')
  const [orgTicketsDate, setOrgTicketsDate] = useState('all')
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false)
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('')
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [commentAttachments, setCommentAttachments] = useState<ComposerAttachment[]>([])
  const [commentInternal, setCommentInternal] = useState(false)
  const [commentArticleType, setCommentArticleType] = useState('')
  const [commentStateId, setCommentStateId] = useState<number | null>(null)
  const [ticketTypeId, setTicketTypeId] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [priorityId, setPriorityId] = useState<number | null>(null)
  const [iikoReasonIds, setIikoReasonIds] = useState<string[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])
  const [commentPendingTime, setCommentPendingTime] = useState('')
  const [commentTimeUnit, setCommentTimeUnit] = useState('')
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [isMacroDropdownOpen, setIsMacroDropdownOpen] = useState(false)
  const [macroSearchQuery, setMacroSearchQuery] = useState('')
  const macroDropdownRef = useRef<HTMLDivElement | null>(null)
  const macroSearchInputRef = useRef<HTMLInputElement | null>(null)
  const [commentWarning, setCommentWarning] = useState('')
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [ticketMetaOpen, setTicketMetaOpen] = useState(false)
  const [copiedTicketMeta, setCopiedTicketMeta] = useState<string | null>(null)
  const [copiedClientsLink, setCopiedClientsLink] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [changeCustomerModalOpen, setChangeCustomerModalOpen] = useState(false)
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false)
  const [createSubTicketModalOpen, setCreateSubTicketModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [scoreSaving, setScoreSaving] = useState(false)
  const [scoreError, setScoreError] = useState('')
  // Shown while the write and the refetch are in flight: clients answers with a
  // noticeable delay, and without this the field sits on the old value as if the
  // click did nothing.
  const [pendingScore, setPendingScore] = useState<string | null>(null)
  const [createSubTicketLoading, setCreateSubTicketLoading] = useState(false)
  const [createSubTicketError, setCreateSubTicketError] = useState('')
  const [subTitle, setSubTitle] = useState('')
  const [subBody, setSubBody] = useState('')
  const [subType, setSubType] = useState('')
  const [subGroup, setSubGroup] = useState<number>(0)
  const [subOwner, setSubOwner] = useState<number>(1)
  const [subPriority, setSubPriority] = useState<number>(2)
  const [subState, setSubState] = useState<number>(2)
  const [subTime, setSubTime] = useState<number>(0)
  const [linkExistingToOrg, setLinkExistingToOrg] = useState(true)
  const [isSubTicketsOpen, setIsSubTicketsOpen] = useState(false)
  const [linkOrgModalOpen, setLinkOrgModalOpen] = useState(false)
  const [linkOrgId, setLinkOrgId] = useState<number | null>(null)
  const [linkOrgSearchQuery, setLinkOrgSearchQuery] = useState('')
  const [linkOrgSearchResults, setLinkOrgSearchResults] = useState<any[]>([])
  const [linkOrgSearchLoading, setLinkOrgSearchLoading] = useState(false)
  const [linkOrgLoading, setLinkOrgLoading] = useState(false)
  const [linkOrgError, setLinkOrgError] = useState('')

  const { data: filtersData } = useTicketFilters()
  const chatStyle = useUIStore(s => s.chatStyle)
  const bubbleSide = useUIStore(s => s.bubbleSide)
  const allowTicketPendingWithoutReason = useUIStore(s => s.allowTicketPendingWithoutReason)
  const allowTicketStatusWithoutPublicComment = useUIStore(s => s.allowTicketStatusWithoutPublicComment)
  const afterCommentSubmitAction = useUIStore(s => s.afterCommentSubmitAction)
  const hideScrollDownArrow = useUIStore(s => s.hideScrollDownArrow)
  const openCreatedTicket = useUIStore(s => s.openCreatedTicket)
  const allowScoreWithoutClientsRight = useUIStore(s => s.allowScoreWithoutClientsRight)
  const currentUser = useAuthStore(s => s.user)
  const closeTab = useTabsStore(s => s.closeTab)
  const activeTabId = useTabsStore(s => s.activeTabId)

  const { data: detailsData, isLoading: detailsLoading, error: detailsError } = useQuery<{ ticket: Ticket; customer: TicketCustomer | null; organization: OrganizationDetails | null }>({
    queryKey: ['ticket-details', idNum],
    queryFn: () => window.api.tickets.getDetails(idNum),
    enabled: idNum > 0,
    refetchInterval: 5000
  })

  const { data: articles, isLoading: articlesLoading } = useQuery<TicketArticle[]>({
    queryKey: ['ticket-articles', idNum],
    queryFn: () => window.api.tickets.getArticles(idNum),
    enabled: idNum > 0,
    refetchInterval: 5000
  })

  const { data: ticketHistory = [], isLoading: historyLoading } = useQuery<TicketHistoryItem[]>({
    queryKey: ['ticket-history', idNum],
    queryFn: () => window.api.tickets.getHistory(idNum),
    enabled: idNum > 0 && historyModalOpen,
    staleTime: 30_000
  })

  const { data: orgTickets = [], isLoading: orgTicketsLoading } = useQuery<Ticket[]>({
    queryKey: ['org-tickets', selectedOrgId],
    queryFn: () => window.api.organizations.getTickets(selectedOrgId!),
    enabled: !!selectedOrgId,
    staleTime: 30_000
  })

  const { data: orgMembers = [], isLoading: orgMembersLoading } = useQuery<Member[]>({
    queryKey: ['org-members', selectedOrgId],
    queryFn: () => window.api.organizations.getMembers(selectedOrgId!),
    enabled: !!selectedOrgId,
    staleTime: 60_000
  })

  useEffect(() => {
    if (createSubTicketModalOpen && detailsData?.ticket) {
      setSubTitle('')
      setSubBody('')
      setSubType(detailsData.ticket.ticketType?.id || 'Incident')
      setSubGroup(detailsData.ticket.group.id || 0)
      setSubOwner(detailsData.ticket.owner.id || 1)
      setSubPriority(detailsData.ticket.priority.id || 2)
      setSubState(2)
      setSubTime(0)
      setCreateSubTicketError('')
    }
  }, [createSubTicketModalOpen, detailsData])

  const handleCreateSubTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subTitle.trim() || !subBody.trim() || !subType || !subGroup) {
      setCreateSubTicketError('Пожалуйста, заполните обязательные поля')
      return
    }
    setCreateSubTicketLoading(true)
    setCreateSubTicketError('')
    try {
      const res = await window.api.tickets.createSubTicket({
        parentTicketId: idNum,
        title: subTitle,
        body: subBody,
        groupId: subGroup,
        ownerId: subOwner,
        type: subType,
        priorityId: subPriority,
        stateId: subState,
        timeUnit: subTime
      })
      if (res.ok && res.newTicketId) {
        setCreateSubTicketModalOpen(false)
        queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
        if (openCreatedTicket) navigate(`/dashboard/tickets/${res.newTicketId}`)
      } else {
        // The subtask may still have been created — refresh so the list shows it
        // instead of leaving the modal hanging without a hint.
        queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
        setCreateSubTicketError('Не удалось определить номер созданной подзадачи. Обновите заявку и проверьте список вложенных заявок.')
      }
    } catch (err: any) {
      setCreateSubTicketError(err.message || 'Ошибка создания подзадачи')
    } finally {
      setCreateSubTicketLoading(false)
    }
  }

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (macroDropdownRef.current && !macroDropdownRef.current.contains(e.target as Node)) {
        setIsMacroDropdownOpen(false)
      }
    }
    if (isMacroDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isMacroDropdownOpen])

  useEffect(() => {
    if (isMacroDropdownOpen) {
      setTimeout(() => {
        macroSearchInputRef.current?.focus()
      }, 50)
    }
  }, [isMacroDropdownOpen])

  useEffect(() => {
    setOrgTicketsSearch('')
    setOrgTicketsOwner('all')
    setOrgTicketsState('all')
    setOrgTicketsDate('all')
    setIsOwnerDropdownOpen(false)
    setOwnerSearchQuery('')
  }, [selectedOrgId, activeTab])

  const updateScrollDownVisibility = () => {
    const el = ticketScrollRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollDown(distanceToBottom > 180)
  }

  useEffect(() => {
    window.requestAnimationFrame(updateScrollDownVisibility)
  }, [detailsData?.ticket?.id, articles?.length, attachmentsOpen, chatStyle])

  useEffect(() => {
    const ticket = detailsData?.ticket
    if (!ticket) return
    setCommentArticleType(getAutoArticleType(ticket.channel))
    setCommentStateId(ticket.state.id || null)
    setTicketTypeId(ticket.ticketType?.id ?? null)
    setGroupId(ticket.group.id || null)
    setOwnerId(ticket.owner.id ?? null)
    setPriorityId(ticket.priority.id || null)
    setIikoReasonIds((ticket.iikoReasons ?? []).map(reason => reason.id))
    setTagIds((ticket.tags ?? []).map(tag => tag.id))
    setCommentPendingTime(dateTimeLocalFromRaw(ticket.pendingTime) || tomorrowAtEleven())
  }, [detailsData?.ticket?.id])

  const [mergeSearch, setMergeSearch] = useState('')
  const [mergeResults, setMergeResults] = useState<any[]>([])
  const [mergeLoading, setMergeLoading] = useState(false)
  const [selectedMergeTarget, setSelectedMergeTarget] = useState<any | null>(null)
  const [mergeError, setMergeError] = useState('')

  const handleMergeSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mergeSearch.trim()) return
    setMergeLoading(true)
    setMergeError('')
    try {
      const res = await window.api.tickets.searchForMerge(mergeSearch)
      setMergeResults(res.filter((t: any) => t.id !== idNum))
    } catch (err: any) {
      setMergeError(err.message || 'Ошибка поиска')
    } finally {
      setMergeLoading(false)
    }
  }

  const handleMergeSubmit = async () => {
    if (!selectedMergeTarget) return
    setMergeLoading(true)
    setMergeError('')
    try {
      await window.api.tickets.merge(idNum, selectedMergeTarget.number)
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
      setMergeModalOpen(false)
      navigate(`/dashboard/tickets/${selectedMergeTarget.id}`)
    } catch (err: any) {
      setMergeError(err.message || 'Ошибка объединения')
      setMergeLoading(false)
    }
  }

  // The options, the current value and the right to change it all come from the
  // clients ticket page — the app never decides on its own who may award points.
  const scoreOptions: { value: string; label: string }[] = (detailsData?.ticket as any)?.scoreOptions ?? []
  const scoreValue: string | null = (detailsData?.ticket as any)?.scoreValue ?? null
  const clientsAllowsScore: boolean = (detailsData?.ticket as any)?.canEditScore === true
  const canEditScore: boolean = (clientsAllowsScore || allowScoreWithoutClientsRight) && scoreOptions.length > 0

  // The pending value stops being needed as soon as the refetched ticket carries it.
  useEffect(() => {
    if (pendingScore !== null && scoreValue === pendingScore) setPendingScore(null)
  }, [scoreValue, pendingScore])

  const handleScoreChange = async (value: string) => {
    if (value === (pendingScore ?? scoreValue)) return
    setScoreSaving(true)
    setScoreError('')
    setPendingScore(value)
    try {
      // The override travels with the request: the main process refuses the write
      // on its own unless it is told, on purpose, to ignore the clients rule.
      await window.api.tickets.setScore(idNum, value, !clientsAllowsScore && allowScoreWithoutClientsRight)
      await queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    } catch (err: any) {
      setPendingScore(null)
      setScoreError(err?.message || 'Не удалось выставить баллы')
    } finally {
      setScoreSaving(false)
    }
  }

  const [customerSearch, setCustomerSearch] = useState('')
  const [customerResults, setCustomerResults] = useState<any[]>([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [activeCustomerTab, setActiveCustomerTab] = useState<'search' | 'create'>('search')
  const [newCustomerFirstname, setNewCustomerFirstname] = useState('')
  const [newCustomerLastname, setNewCustomerLastname] = useState('')
  const [newCustomerEmail, setNewCustomerEmail] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')
  const [newCustomerMobile, setNewCustomerMobile] = useState('')
  const [newCustomerTelegram, setNewCustomerTelegram] = useState('')
  const [linkToOrg, setLinkToOrg] = useState(true)
  const [changeCustomerError, setChangeCustomerError] = useState('')
  const [changeCustomerLoading, setChangeCustomerLoading] = useState(false)
  const [selectingCustomerId, setSelectingCustomerId] = useState<number | null>(null)

  const handleCustomerSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!customerSearch.trim()) return
    setCustomerSearchLoading(true)
    setChangeCustomerError('')
    try {
      const res = await window.api.users.search(customerSearch)
      setCustomerResults(res)
    } catch (err: any) {
      setChangeCustomerError(err.message || 'Ошибка поиска')
    } finally {
      setCustomerSearchLoading(false)
    }
  }

  const handleChangeCustomer = async (userId: number) => {
    setChangeCustomerLoading(true)
    setSelectingCustomerId(userId)
    setChangeCustomerError('')
    try {
      if (linkExistingToOrg && detailsData?.organization?.id) {
        await window.api.users.update(userId, {
          organization_id: detailsData.organization.id,
          ticketId: idNum
        })
      }
      await window.api.tickets.changeCustomer(idNum, userId)
      queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
      setChangeCustomerModalOpen(false)
    } catch (err: any) {
      setChangeCustomerError(err.message || 'Ошибка изменения клиента')
    } finally {
      setChangeCustomerLoading(false)
      setSelectingCustomerId(null)
    }
  }

  const handleLinkOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailsData?.customer?.id || !linkOrgId) return
    setLinkOrgLoading(true)
    setLinkOrgError('')
    try {
      await window.api.users.update(detailsData.customer.id, {
        organization_id: linkOrgId,
        ticketId: idNum
      })
      queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
      setLinkOrgModalOpen(false)
    } catch (err: any) {
      setLinkOrgError(err.message || 'Ошибка привязки организации')
    } finally {
      setLinkOrgLoading(false)
    }
  }

  const handleLinkOrgSearch = async (q: string) => {
    setLinkOrgSearchQuery(q)
    if (!q.trim()) {
      setLinkOrgSearchResults([])
      return
    }
    setLinkOrgSearchLoading(true)
    try {
      const res = await window.api.organizations.list({ query: q, page: 1, perPage: 15 })
      setLinkOrgSearchResults(res || [])
    } catch {
    } finally {
      setLinkOrgSearchLoading(false)
    }
  }

  useEffect(() => {
    if (linkOrgModalOpen) {
      if (detailsData?.organization) {
        setLinkOrgId(detailsData.organization.id)
        setLinkOrgSearchQuery(detailsData.organization.name)
      } else {
        setLinkOrgId(null)
        setLinkOrgSearchQuery('')
      }
      setLinkOrgSearchResults([])
      setLinkOrgError('')
    }
  }, [linkOrgModalOpen, detailsData])

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCustomerFirstname.trim() && !newCustomerLastname.trim()) {
      setChangeCustomerError('Укажите имя или фамилию')
      return
    }
    setChangeCustomerLoading(true)
    setChangeCustomerError('')
    try {
      const payload: any = {
        firstname: newCustomerFirstname.trim(),
        lastname: newCustomerLastname.trim(),
        email: newCustomerEmail.trim() || undefined,
        phone: newCustomerPhone.trim() || undefined,
        mobile: newCustomerMobile.trim() || undefined,
        tg_id_for_notice: newCustomerTelegram.trim() || undefined,
        organization_id: (linkToOrg && detailsData?.organization?.id) ? detailsData.organization.id : null
      }
      const createdUser = await window.api.users.create(payload)
      await window.api.tickets.changeCustomer(idNum, createdUser.id)
      queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
      setChangeCustomerModalOpen(false)
    } catch (err: any) {
      setChangeCustomerError(err.message || 'Ошибка создания клиента')
    } finally {
      setChangeCustomerLoading(false)
    }
  }

  const [editFirstname, setEditFirstname] = useState('')
  const [editLastname, setEditLastname] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editTelegram, setEditTelegram] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editOrgId, setEditOrgId] = useState<number | null>(null)
  const [editCustomerLoading, setEditCustomerLoading] = useState(false)
  const [editCustomerError, setEditCustomerError] = useState('')
  const [orgSearchQuery, setOrgSearchQuery] = useState('')
  const [orgSearchResults, setOrgSearchResults] = useState<any[]>([])
  const [orgSearchLoading, setOrgSearchLoading] = useState(false)

  useEffect(() => {
    if (editCustomerModalOpen && detailsData?.customer) {
      const c = detailsData.customer
      setEditFirstname(c.firstname || '')
      setEditLastname(c.lastname || '')
      setEditEmail(c.email || '')
      setEditPhone(c.phone || '')
      setEditMobile(c.mobile || '')
      setEditTelegram(c.telegram || c.tg_id_for_notice || '')
      setEditAddress(c.address || '')
      setEditOrgId(detailsData.organization?.id || null)
      setOrgSearchQuery(detailsData.organization?.name || '')
      setOrgSearchResults([])
      setEditCustomerError('')
    }
  }, [editCustomerModalOpen, detailsData])

  const handleOrgSearch = async (q: string) => {
    setOrgSearchQuery(q)
    if (!q.trim()) {
      setOrgSearchResults([])
      return
    }
    setOrgSearchLoading(true)
    try {
      const res = await window.api.organizations.list({ query: q, page: 1, perPage: 15 })
      setOrgSearchResults(res || [])
    } catch {
    } finally {
      setOrgSearchLoading(false)
    }
  }

  const handleEditCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailsData?.customer) return
    if (!editFirstname.trim() && !editLastname.trim()) {
      setEditCustomerError('Укажите имя или фамилию')
      return
    }
    setEditCustomerLoading(true)
    setEditCustomerError('')
    try {
      const payload = {
        firstname: editFirstname.trim(),
        lastname: editLastname.trim(),
        email: editEmail.trim() || null,
        phone: editPhone.trim() || null,
        mobile: editMobile.trim() || null,
        tg_id_for_notice: editTelegram.trim() || null,
        address: editAddress.trim() || null,
        organization_id: editOrgId,
        ticketId: idNum
      }
      await window.api.users.update(detailsData.customer.id, payload)
      queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
      setEditCustomerModalOpen(false)
    } catch (err: any) {
      setEditCustomerError(err.message || 'Ошибка обновления профиля')
    } finally {
      setEditCustomerLoading(false)
    }
  }

  const addCommentMutation = useMutation({
    mutationFn: async ({ timeUnit, includeArticle }: { timeUnit: number | null; includeArticle: boolean }) => {
      const attachments = includeArticle ? await Promise.all(commentAttachments.map(async attachment => ({
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        data: dataUrlPayload(attachment.dataUrl)
      }))) : []
      return window.api.tickets.addComment({
        ticketId: idNum,
        body: includeArticle && commentBody.trim() ? toHtmlComment(commentBody) : '',
        internal: commentInternal,
        articleType: commentArticleType || getAutoArticleType(detailsData?.ticket?.channel),
        stateId: commentStateId ?? undefined,
        ticketTypeId,
        groupId,
        ownerId,
        priorityId,
        iikoReasonIds,
        tagIds,
        pendingTime: commentPendingTime ? new Date(commentPendingTime).toISOString() : null,
        timeUnit,
        attachments
      })
    },
    onSuccess: (_data, variables) => {
      if (variables.includeArticle) {
        setCommentBody('')
        setCommentAttachments([])
        setCommentTimeUnit('')
        setIsTimeModalOpen(false)
      }
      setCommentError('')
      setCommentWarning('')
      queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
      queryClient.invalidateQueries({ queryKey: ['ticket-articles', idNum] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      if (afterCommentSubmitAction === 'close' && activeTabId) {
        closeTab(activeTabId)
      }
    },
    onError: (error) => {
      setCommentError(error instanceof Error ? error.message : 'Не удалось отправить комментарий')
    }
  })

  const openTimeModal = (keepTime: boolean | any = false) => {
    const isKeepTime = keepTime === true
    const selectedStateName = filtersData?.states?.find(state => Number(state.id) === commentStateId)?.name || detailsData?.ticket?.state.name
    const requiresReason = isReasonRequiredState(selectedStateName)

    if (requiresReason && !allowTicketPendingWithoutReason && iikoReasonIds.length === 0) {
      setCommentWarning('Необходимо выбрать причину обращения чтобы закрыть заявку')
      return
    }

    const isChangingState = commentStateId !== detailsData?.ticket?.state?.id
    const isTargetPendingOrClosed = isPendingOrClosedState(selectedStateName)
    if (isChangingState && isTargetPendingOrClosed && !allowTicketStatusWithoutPublicComment && commentBody.trim() === '') {
      setCommentWarning('Необходимо написать комментарий для изменения состояния заявки')
      return
    }

    setCommentError('')
    setCommentWarning('')
    if (!isKeepTime) {
      setCommentTimeUnit('')
    }
    setIsTimeModalOpen(true)
  }

  const submitComment = () => {
    const parsedTime = commentTimeUnit.trim() === '' ? null : Number(commentTimeUnit)
    if (parsedTime !== null && (!Number.isFinite(parsedTime) || parsedTime < 0)) {
      setCommentError('Укажите корректное время')
      return
    }
    addCommentMutation.mutate({ timeUnit: parsedTime, includeArticle: true })
  }

  const updateCommentTimeUnit = (value: string) => {
    const digits = value.replace(/\D/g, '')
    setCommentTimeUnit(digits)
  }

  const addComposerFiles = async (files: File[]) => {
    if (files.length === 0) return
    try {
      const nextAttachments = await Promise.all(files.map(async (file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        filename: file.name || `clipboard-${index + 1}`,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
        file
      })))
      setCommentAttachments(current => [...current, ...nextAttachments])
    } catch (error) {
      setCommentWarning(error instanceof Error ? error.message : 'Не удалось добавить файл')
    }
  }

  const insertCommentText = (text: string) => {
    if (!text) return
    const textarea = commentTextareaRef.current
    if (!textarea) {
      setCommentBody(current => `${current}${text}`)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    setCommentBody(current => `${current.slice(0, start)}${text}${current.slice(end)}`)
    window.requestAnimationFrame(() => {
      const cursor = start + text.length
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const handleCommentPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    insertCommentText(event.clipboardData.getData('text/plain'))
    void addComposerFiles(files)
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void addComposerFiles(files)
  }

  const removeCommentAttachment = (id: string) => {
    setCommentAttachments(current => current.filter(attachment => attachment.id !== id))
  }

  const scrollTicketToBottom = () => {
    const el = ticketScrollRef.current
    if (!el) return
    const start = el.scrollTop
    const end = el.scrollHeight - el.clientHeight
    const distance = end - start
    const duration = 720
    const startedAt = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const impulse = progress < 0.72
        ? 1 - Math.pow(1 - progress / 0.72, 3)
        : 1 - Math.pow(1 - progress, 2) * 0.08
      el.scrollTop = start + distance * Math.min(1, impulse)
      if (progress < 1) window.requestAnimationFrame(tick)
    }

    window.requestAnimationFrame(tick)
  }

  const copyTicketMeta = async (key: string, value?: string | null) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedTicketMeta(key)
    window.setTimeout(() => setCopiedTicketMeta(current => current === key ? null : current), 1200)
  }

  const handleDownload = async (articleId: number, attachment: TicketAttachment) => {
    try {
      const result = await window.api.tickets.getAttachment(idNum, articleId, attachment.id)
      const link = document.createElement('a')
      link.href = result.dataUrl
      link.download = attachment.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error(err)
    }
  }

  // Opens the viewer on the clicked attachment, with every visible attachment of
  // the ticket as the navigable set (arrows move across all of them).
  const handleOpenAttachment = (articleId: number, attachment: TicketAttachment) => {
    setPreviewLoadingKey(null)
    const items: ViewerItem[] = allAttachments.map(a => ({
      articleId: a.articleId,
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size
    }))
    const idx = items.findIndex(i => i.articleId === articleId && i.id === attachment.id)
    if (idx === -1) {
      items.push({ articleId, id: attachment.id, filename: attachment.filename, mimeType: attachment.mimeType, size: attachment.size })
    }
    setPreviewItems(items)
    setPreviewIndex(idx === -1 ? items.length - 1 : idx)
  }

  // Opens the viewer directly on an inline image clicked inside a message body.
  const openInlineImage = (dataUrl: string, filename: string) => {
    setPreviewItems([{ articleId: 0, id: 0, filename: filename || 'Изображение', mimeType: 'image/*', size: 0, preloadedDataUrl: dataUrl }])
    setPreviewIndex(0)
  }

  const toggleAutoReply = (id: number) => {
    setExpandedAutoReplies(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (detailsLoading || articlesLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (detailsError || !detailsData) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive font-medium">Не удалось загрузить данные заявки</p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    )
  }

  const { ticket, customer, organization } = detailsData
  const copyClientsLink = async () => {
    const link = `https://clients.denvic.ru/Tickets/Details/${ticket.clientNumber || ticket.id}`
    await navigator.clipboard.writeText(link)
    setCopiedClientsLink(true)
    window.setTimeout(() => setCopiedClientsLink(false), 1200)
  }
  const selectedArticleType = commentArticleType || getAutoArticleType(ticket.channel)
  const ticketTypeOptions = [
    ...(ticket.ticketType?.id ? [{ id: ticket.ticketType.id, name: ticket.ticketType.name }] : []),
    ...(filtersData?.ticketTypes ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => String(other.id) === String(item.id)) === index)
  const groupOptions = [
    ticket.group,
    ...(filtersData?.groups ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => Number(other.id) === Number(item.id)) === index)
  const ownerOptions = [
    ...(ticket.owner.id ? [ticket.owner as { id: number; name: string }] : []),
    ...(currentUser?.id ? [{ id: currentUser.id, name: [currentUser.firstname, currentUser.lastname].filter(Boolean).join(' ').trim() || currentUser.login || currentUser.email }] : []),
    ...(filtersData?.agents ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => other.id === item.id) === index)
  const priorityOptions = [
    ticket.priority,
    ...(filtersData?.priorities ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => Number(other.id) === Number(item.id)) === index)
    .sort((a, b) => getPriorityOrder(a) - getPriorityOrder(b))
  const iikoReasonOptions = [
    ...(ticket.iikoReasons ?? []),
    ...(filtersData?.iikoReasons ?? [])
  ].filter((item, index, list) => list.findIndex(other => String(other.id) === String(item.id)) === index)
  const tagOptions = [
    ...(ticket.tags ?? []),
    ...(filtersData?.tags ?? [])
  ].filter((item, index, list) => list.findIndex(other => String(other.id) === String(item.id)) === index)
  const stateOptions = [
    ticket.state,
    ...(filtersData?.states ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => Number(other.id) === Number(item.id)) === index)
  const uniqueStates = Array.from(new Set(orgTickets.map(t => t.state.name).filter((name): name is string => !!name)))

  const ticketOwners = orgTickets.map(t => t.owner.name).filter((name): name is string => !!name)
  const filterAgents = (filtersData?.agents ?? []).map(a => String(a.name))
  const allAvailableOwners = Array.from(new Set([...ticketOwners, ...filterAgents]))
    .filter(name => {
      const n = name.trim()
      return n && /[a-zA-Zа-яА-Я0-9]/.test(n)
    })
    .sort((a, b) => a.localeCompare(b, 'ru'))

  const filteredOrgTickets = orgTickets.filter(t => {
    const query = orgTicketsSearch.toLowerCase().trim()
    if (query) {
      const matchTitle = t.title.toLowerCase().includes(query)
      const matchNum = String(t.clientNumber || t.id).toLowerCase().includes(query)
      const matchZammadNum = String(t.number || '').toLowerCase().includes(query)
      if (!matchTitle && !matchNum && !matchZammadNum) return false
    }

    if (orgTicketsOwner !== 'all' && t.owner.name !== orgTicketsOwner) {
      return false
    }

    if (orgTicketsState !== 'all' && t.state.name !== orgTicketsState) {
      return false
    }

    if (orgTicketsDate !== 'all') {
      const createdDate = new Date(t.createdAt)
      const now = new Date()
      if (orgTicketsDate === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        if (createdDate < today) return false
      } else if (orgTicketsDate === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        if (createdDate < oneWeekAgo) return false
      } else if (orgTicketsDate === 'month') {
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        if (createdDate < oneMonthAgo) return false
      } else if (orgTicketsDate === 'year') {
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        if (createdDate < oneYearAgo) return false
      }
    }

    return true
  })
  const sortedArticles = articles ? [...articles].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : []
  const firstArticle = sortedArticles[0]
  const chatArticles = sortedArticles.slice(1)
const allAttachments: ArticleAttachment[] = sortedArticles.flatMap(article =>
    getVisibleAttachments(article.attachments).map(attachment => ({
      ...attachment,
      articleId: article.id,
      articleDate: article.createdAt,
      isPrivate: article.internal
    }))
  )
  const parsedHeader = firstArticle ? parseFirstArticle(firstArticle.body) : {}
  const customerName = [customer?.firstname, customer?.lastname].filter(Boolean).join(' ').trim() || parsedHeader.applicant || 'Заявитель не указан'
  const organizationName = organization?.name || ticket.organization.name || parsedHeader.client || 'Организация не найдена'
  const contactPhones = Array.from(new Set([
    customer?.mobile,
    customer?.phone,
    organization?.phone
  ].filter((value): value is string => !!value && value.trim() !== '')))
  const contactEmail = customer?.email || organization?.email || ''
  const contractText = organization?.contracts || organization?.contracts_and_comments || ''
  const objectText = [parsedHeader.object, parsedHeader.address].filter(Boolean).join(', ')

  const applyMacro = (macro: any) => {
    setCommentBody(macro.bodyText)
    setCommentInternal(macro.internal)
    setCommentArticleType('note')
    if (macro.stateId) {
      setCommentStateId(Number(macro.stateId))
    }
    if (macro.groupId) {
      setGroupId(Number(macro.groupId))
    }
    if (macro.iikoReasonIds && macro.iikoReasonIds.length > 0) {
      setIikoReasonIds(macro.iikoReasonIds)
    }
    if (macro.timeUnit !== undefined && macro.timeUnit !== null) {
      setCommentTimeUnit(String(macro.timeUnit))
    }
    if (macro.tagNames && macro.tagNames.length > 0) {
      const tagIdsToAdd = macro.tagNames.map(tagName => {
        const foundTag = tagOptions.find(t => t.name.toLowerCase() === tagName.toLowerCase())
        return foundTag ? String(foundTag.id) : null
      }).filter((id): id is string => !!id)
      
      if (tagIdsToAdd.length > 0) {
        setTagIds(prev => {
          const next = [...prev]
          tagIdsToAdd.forEach(id => {
            if (!next.includes(id)) next.push(id)
          })
          return next
        })
      }
    }
    openTimeModal(true)
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-4">
      <MediaViewer ticketId={idNum} items={previewItems} index={previewIndex} onIndexChange={setPreviewIndex} onClose={() => setPreviewItems([])} />
      <AnimatePresence>
        {historyModalOpen && (
          <TicketHistoryModal
            items={ticketHistory}
            loading={historyLoading}
            onClose={() => setHistoryModalOpen(false)}
          />
        )}
        {commentWarning && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Предупреждение</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCommentWarning('')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-sm leading-6 text-foreground">{commentWarning}</p>
              </div>
              <div className="mt-5 flex justify-end">
                <Button size="sm" onClick={() => setCommentWarning('')}>Понятно</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {isTimeModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Учет времени</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsTimeModalOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Добавить минут</label>
                <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
                  <button
                    type="button"
                    className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/20 text-sm font-semibold hover:bg-muted/45"
                    onClick={() => setCommentTimeUnit(String(Math.max(0, Number(commentTimeUnit || 0) - 5)))}
                  >
                    -
                  </button>
                  <div className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/30 text-sm font-semibold tabular-nums text-foreground">
                    <input
                      value={commentTimeUnit}
                      onChange={event => updateCommentTimeUnit(event.target.value)}
                      inputMode="numeric"
                      autoFocus
                      className="w-16 bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none"
                    />
                    <span>мин</span>
                  </div>
                  <button
                    type="button"
                    className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/20 text-sm font-semibold hover:bg-muted/45"
                    onClick={() => setCommentTimeUnit(String(Number(commentTimeUnit || 0) + 5))}
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 5, 10, 20, 30, 60].map(minutes => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setCommentTimeUnit(minutes === 0 ? '' : String(minutes))}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors",
                        Number(commentTimeUnit || 0) === minutes
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/45 hover:text-foreground"
                      )}
                    >
                      {minutes === 0 ? 'Без времени' : `${minutes} мин`}
                    </button>
                  ))}
                </div>
              </div>

              {commentError && (
                <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {commentError}
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <Button size="sm" onClick={submitComment} disabled={addCommentMutation.isPending}>
                  {addCommentMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Сохранить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .gmail_quote, blockquote, .mz_quote, [class*="quote"] {
          display: none !important;
        }
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="shrink-0 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl border border-border/40 hover:bg-accent/40"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к списку
        </Button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-h-0 relative">
          <div
            ref={ticketScrollRef}
            onScroll={updateScrollDownVisibility}
            className="h-full min-h-0 overflow-y-auto pr-1 flex flex-col gap-4"
          >
          <div className="bg-card rounded-2xl border border-border/55 shadow-sm shrink-0 overflow-hidden">
            <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[minmax(240px,0.8fr)_1fr]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between relative">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Клиент</span>
                </div>
                <div className="flex flex-col items-start">
                  <span data-selectable className="text-xl font-bold leading-7 text-foreground">{customerName}</span>
                  {organization ? (
                    <button
                      type="button"
                      onClick={() => {
                        // Selecting the name inside a button still ends in a click;
                        // opening the organization then would throw the selection away.
                        if (window.getSelection()?.toString().trim()) return
                        setSelectedOrgId(organization.id)
                        setActiveTab('info')
                      }}
                      className="text-sm font-medium text-primary hover:underline text-left flex items-center gap-1 group/org transition-colors"
                    >
                      <span data-selectable className="cursor-text">{organizationName}</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover/org:opacity-100 transition-opacity" />
                    </button>
                  ) : (
                    <span data-selectable className="text-sm font-medium text-muted-foreground">{organizationName}</span>
                  )}
                </div>
                {organization?.note && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{organization.note}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border/40 pt-4 text-sm sm:grid-cols-2 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                {contactPhones.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Телефон</span>
                    <span className="font-mono text-foreground">{contactPhones.join(', ')}</span>
                  </div>
                )}
                {contactEmail && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Email</span>
                    <span className="truncate text-foreground">{contactEmail}</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Договор</span>
                  <span className={cn(
                    "font-semibold",
                    contractText ? "text-foreground" : "text-red-600 dark:text-red-300"
                  )}>
                    {contractText || 'Договор не найден'}
                  </span>
                </div>
                {objectText && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Объект</span>
                    <span className="text-foreground">{objectText}</span>
                  </div>
                )}
                {!contactPhones.length && !contactEmail && !objectText && (
                  <span className="text-sm text-muted-foreground">Контактные данные не найдены</span>
                )}
              </div>
            </div>

            {firstArticle && (
              <div className="border-t border-border/50 p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Обращение</span>
                      <h1 className="text-lg font-bold text-foreground leading-7">
                        {ticket.clientNumber ? `[${ticket.clientNumber}] ` : ''}{ticket.title}
                      </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon channel={ticket.channel} className="h-3.5 w-3.5" />
                        {ticket.channel || 'Zammad'}
                      </span>
                      <span>{formatTicketDate(ticket.createdAt)}</span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-700/30 pt-4">
                    <ArticleBody html={firstArticle.body} ticketId={idNum} articleId={firstArticle.id} onImageOpen={openInlineImage} />
                    {firstArticle.callRecordUrl && (
                      <MiniAudioPlayer url={firstArticle.callRecordUrl} isPrivate={firstArticle.internal} />
                    )}
                    {getVisibleAttachments(firstArticle.attachments).length > 0 && (
                      <div className="border-t border-zinc-700/30 mt-4 pt-3 flex flex-wrap gap-2">
                        {getVisibleAttachments(firstArticle.attachments).map((att) => (
                          <div key={att.id} className="relative">
                            <AttachmentTile ticketId={idNum} articleId={firstArticle.id} attachment={att} onOpen={handleOpenAttachment} onDownload={handleDownload} />
                            {previewLoadingKey === `${firstArticle.id}-${att.id}` && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {(detailsData?.ticket?.subTickets && detailsData.ticket.subTickets.length > 0 || true) && (
            <div className="bg-card rounded-2xl border border-border/55 p-5 shadow-sm shrink-0 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsSubTicketsOpen(!isSubTicketsOpen)}
                  className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors outline-none"
                >
                  <GitMerge className="h-3.5 w-3.5 text-primary" />
                  Вложенные заявки {detailsData?.ticket?.subTickets ? `(${detailsData.ticket.subTickets.length})` : '(0)'}
                  {isSubTicketsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateSubTicketModalOpen(true)}
                  className="h-8 gap-1.5 px-3 text-xs"
                >
                  Создать подзадачу
                </Button>
              </div>

              {isSubTicketsOpen && (
                <>
                  {detailsData?.ticket?.subTickets && detailsData.ticket.subTickets.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-border/50">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-muted/15 border-b border-border/50 text-[10px] uppercase font-bold text-muted-foreground">
                            <th className="p-3">Номер</th>
                            <th className="p-3">Заголовок</th>
                            <th className="p-3">Группа</th>
                            <th className="p-3">Ответственный</th>
                            <th className="p-3">Состояние</th>
                            <th className="p-3">Дата создания</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 text-xs">
                          {detailsData.ticket.subTickets.map((sub) => (
                            <tr
                              key={sub.id}
                              data-tab-path={`/dashboard/tickets/${sub.id}`}
                              onClick={() => navigate(`/dashboard/tickets/${sub.id}`)}
                              className="hover:bg-muted/15 cursor-pointer transition-colors"
                            >
                              <td className="p-3 font-mono font-semibold text-primary">{sub.id}</td>
                              <td className="p-3 font-medium text-foreground max-w-xs truncate">{sub.title}</td>
                              <td className="p-3 text-muted-foreground">{sub.group}</td>
                              <td className="p-3 text-muted-foreground">{sub.owner}</td>
                              <td className="p-3">
                                <span className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border border-border/30 whitespace-nowrap",
                                  getStateBadgeClass(sub.state)
                                )}>
                                  {sub.state}
                                </span>
                              </td>
                              <td className="p-3 text-muted-foreground font-mono">{sub.createdAt}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                      Нет вложенных заявок
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border/55 p-5 shadow-sm shrink-0 flex flex-col">
            <div className="border-b border-border/40 pb-3 mb-5 shrink-0 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  Комментарии ({chatArticles.length})
                </h2>
                {allAttachments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAttachmentsOpen(value => !value)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted/25 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                    Вложения ({allAttachments.length})
                    {attachmentsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              {allAttachments.length > 0 && attachmentsOpen && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {allAttachments.map((att) => (
                    <AttachmentPreviewCard
                      key={`${att.articleId}-${att.id}`}
                      ticketId={idNum}
                      attachment={att}
                      onOpen={handleOpenAttachment}
                      onDownload={handleDownload}
                      loading={previewLoadingKey === `${att.articleId}-${att.id}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5">
              {chatArticles.length > 0 ? (
                chatArticles.map((article) => {
                  const isNote = !!article.internal
                  const sender = String(article.sender).toLowerCase()
                  const isAgent = sender === 'agent'
                  // bubbleSide: 'client-right' (default) keeps clients on the right;
                  // 'client-left' puts clients left and our (agent) messages right.
                  const isRightAligned = bubbleSide === 'client-left' ? isAgent : sender === 'customer'
                  const isAuto = isAutoReplyArticle(article.body, article.creatorName) || String(article.sender).toLowerCase() === 'system'
                  const isExpanded = !!expandedAutoReplies[article.id]

                  if (isAuto) {
                    const isQuality = article.body.toLowerCase().includes('оценка качества') || article.creatorName.toLowerCase().includes('оценка качества')
                    const label = isQuality 
                      ? 'Системное уведомление: Оценка качества Денвик'
                      : 'Системное уведомление: Автоответ о регистрации заявки'

                    return (
                      <div key={article.id} className="w-full flex flex-col items-center py-1">
                        <button
                          onClick={() => toggleAutoReply(article.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/40 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/60 text-[10px] text-zinc-700 dark:text-zinc-300 transition-all duration-100"
                        >
                          <Info className="h-3 w-3 text-sky-500 dark:text-sky-400" />
                          <span>{label}</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 w-full max-w-[88%] rounded-xl border border-zinc-300 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-900/40 p-4 text-sm text-zinc-800 dark:text-zinc-100 leading-6 break-words">
                            <ArticleBody html={article.body} ticketId={idNum} articleId={article.id} onImageOpen={openInlineImage} />
                          </div>
                        )}
                      </div>
                    )
                  }

                  if (chatStyle === 'classic') {
                    return (
                      <div 
                        key={article.id} 
                        className={cn(
                          "w-full rounded-xl border p-4 shadow-sm flex flex-col gap-3",
                          isNote
                            ? "bg-red-50/50 dark:bg-red-950/25 border-red-200/60 dark:border-red-800/40 text-red-950 dark:text-zinc-100"
                            : isAgent
                              ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-800/40 text-blue-950 dark:text-zinc-100"
                              : "bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-100"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-between gap-6 border-b pb-2 text-xs text-zinc-500 dark:text-zinc-400",
                          isNote 
                            ? "border-red-200 dark:border-red-900/30" 
                            : "border-zinc-200 dark:border-zinc-700/30"
                        )}>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 overflow-hidden rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200">
                              {article.creatorAvatarDataUrl
                                ? <img src={article.creatorAvatarDataUrl} alt={article.creatorName} className="h-full w-full object-cover" />
                                : article.creatorName.slice(0, 2).toUpperCase()
                              }
                            </div>
                            <span className="font-bold text-zinc-850 dark:text-zinc-300">
                              {article.creatorName}
                            </span>
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-medium",
                              isNote 
                                ? "bg-red-100 dark:bg-red-900/45 text-red-800 dark:text-red-200" 
                                : isAgent 
                                  ? "bg-blue-100 dark:bg-blue-900/45 text-blue-800 dark:text-blue-200" 
                                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300"
                            )}>
                              {isNote ? 'Приватный комментарий' : isAgent ? 'Агент' : 'Клиент'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-550 dark:text-zinc-400 font-mono">
                            <ChannelIcon channel={isNote ? 'note' : article.type} />
                            <span>{formatTicketDate(article.createdAt)}</span>
                          </div>
                        </div>

                        <ArticleBody html={article.body} ticketId={idNum} articleId={article.id} onImageOpen={openInlineImage} />

                        {article.callRecordUrl && (
                          <MiniAudioPlayer url={article.callRecordUrl} isPrivate={isNote} />
                        )}

                        {getVisibleAttachments(article.attachments).length > 0 && (
                          <div className={cn(
                            "border-t mt-2.5 pt-2.5 flex flex-wrap gap-2",
                            isNote ? "border-red-900/30" : "border-zinc-700/30"
                          )}>
                            {getVisibleAttachments(article.attachments).map((att) => (
                              <div key={att.id} className="relative">
                                <AttachmentTile
                                  articleId={article.id}
                                  ticketId={idNum}
                                  attachment={att}
                                  isPrivate={isNote}
                                  onOpen={handleOpenAttachment}
                                  onDownload={handleDownload}
                                />
                                {previewLoadingKey === `${article.id}-${att.id}` && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div 
                      key={article.id} 
                      className={cn(
                        "w-full flex gap-2.5 items-start",
                        isRightAligned ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isRightAligned && (
                        <div className="h-8 w-8 overflow-hidden rounded-full flex items-center justify-center shrink-0 text-xs font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600">
                          {article.creatorAvatarDataUrl
                            ? <img src={article.creatorAvatarDataUrl} alt={article.creatorName} className="h-full w-full object-cover" />
                            : article.creatorName.slice(0, 2).toUpperCase()
                          }
                        </div>
                      )}

                      <div 
                        className={cn(
                          "max-w-[88%] rounded-2xl px-5 py-4 border shadow-sm flex flex-col gap-3",
                          isNote
                            ? "bg-red-50/70 dark:bg-red-950/35 border-red-200/60 dark:border-red-900/40 text-red-950 dark:text-zinc-100 rounded-tr-none"
                            : isAgent
                              ? cn("bg-blue-50/70 dark:bg-blue-950/45 border-blue-200/60 dark:border-blue-900/50 text-blue-950 dark:text-zinc-100", isRightAligned ? "rounded-tr-none" : "rounded-tl-none")
                              : cn("bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60 text-zinc-900 dark:text-zinc-100", isRightAligned ? "rounded-tr-none" : "rounded-tl-none")
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-between gap-6 border-b pb-2 text-xs text-zinc-550 dark:text-zinc-400",
                          isNote ? "border-red-200 dark:border-red-900/30" : "border-zinc-200 dark:border-zinc-700/30"
                        )}>
                          <div className="flex items-center gap-1.5 font-bold">
                            <ChannelIcon channel={isNote ? 'note' : article.type} />
                            <span className="text-zinc-850 dark:text-zinc-300">
                              {article.creatorName}
                              {isNote && <span className="text-amber-500 dark:text-amber-400 font-semibold ml-1">(Внутренняя заметка)</span>}
                            </span>
                          </div>
                          <span className="font-mono">{formatTicketDate(article.createdAt)}</span>
                        </div>

                        <ArticleBody html={article.body} ticketId={idNum} articleId={article.id} onImageOpen={openInlineImage} />

                        {article.callRecordUrl && (
                          <MiniAudioPlayer url={article.callRecordUrl} isPrivate={isNote} />
                        )}

                        {getVisibleAttachments(article.attachments).length > 0 && (
                          <div className={cn(
                            "border-t mt-2.5 pt-2.5 flex flex-wrap gap-2",
                            isNote ? "border-red-200 dark:border-red-900/30" : "border-zinc-200 dark:border-zinc-700/30"
                          )}>
                            {getVisibleAttachments(article.attachments).map((att) => (
                              <div key={att.id} className="relative">
                                <AttachmentTile
                                  articleId={article.id}
                                  ticketId={idNum}
                                  attachment={att}
                                  isPrivate={isNote}
                                  onOpen={handleOpenAttachment}
                                  onDownload={handleDownload}
                                />
                                {previewLoadingKey === `${article.id}-${att.id}` && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {isRightAligned && (
                        <div className="h-8 w-8 overflow-hidden rounded-full flex items-center justify-center shrink-0 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
                          {article.creatorAvatarDataUrl
                            ? <img src={article.creatorAvatarDataUrl} alt={article.creatorName} className="h-full w-full object-cover" />
                            : article.creatorName.slice(0, 2).toUpperCase()
                          }
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <p className="text-xs">Нет комментариев к заявке</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/55 p-5 shadow-sm shrink-0 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <StickyNote className="h-3.5 w-3.5 text-primary" />
                Новый комментарий
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <CustomSelect
                    value={selectedArticleType}
                    options={ARTICLE_TYPE_OPTIONS}
                    onChange={type => setCommentArticleType(String(type.id))}
                    placeholder={getArticleTypeLabel(selectedArticleType)}
                  />
                </div>
                <CustomToggle checked={commentInternal} onChange={setCommentInternal} label="Приватно" />
              </div>
            </div>

            <div className="relative">
              <textarea
                ref={commentTextareaRef}
                value={commentBody}
                onChange={event => setCommentBody(event.target.value)}
                onPaste={handleCommentPaste}
                placeholder="Напишите комментарий..."
                spellCheck
                className="min-h-32 w-full resize-y rounded-lg border border-border bg-muted/25 px-3 py-2 pr-9 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
              <AiAssistButton text={commentBody} onTextChange={setCommentBody} />
            </div>

            {commentAttachments.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {commentAttachments.map(attachment => {
                  const kind = getAttachmentKind(attachment)
                  const isImage = kind === 'image'
                  return (
                    <div
                      key={attachment.id}
                      className="group flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/20 p-2"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background/40">
                        {isImage ? (
                          <img src={attachment.dataUrl} alt={attachment.filename} className="h-full w-full object-cover" />
                        ) : kind === 'archive' ? (
                          <FileArchive className="h-5 w-5 text-amber-400" />
                        ) : kind === 'file' ? (
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <FileImage className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">{attachment.filename}</p>
                        <p className="text-[11px] text-muted-foreground">{formatAttachmentSize(attachment.size) || attachment.mimeType}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCommentAttachment(attachment.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-colors hover:bg-accent hover:text-foreground group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={addCommentMutation.isPending}
                className="h-9 gap-2"
              >
                <Paperclip className="h-4 w-4" />
                Прикрепить
              </Button>
              <div className="relative flex items-center shrink-0" ref={macroDropdownRef}>
                <Button
                  onClick={openTimeModal}
                  disabled={addCommentMutation.isPending}
                  className="h-9 gap-2 rounded-r-none border-r border-primary-foreground/10"
                >
                  <Send className="h-4 w-4" />
                  Отправить всё
                </Button>
                <Button
                  type="button"
                  disabled={addCommentMutation.isPending}
                  onClick={() => setIsMacroDropdownOpen(prev => !prev)}
                  className="h-9 px-2 rounded-l-none border-l-0"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {isMacroDropdownOpen && (
                  <div className="absolute bottom-full right-0 mb-1.5 z-50 w-80 max-h-80 rounded-xl border border-border bg-card p-1 shadow-2xl flex flex-col gap-1">
                    <div className="relative p-1">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        ref={macroSearchInputRef}
                        type="text"
                        value={macroSearchQuery}
                        onChange={e => setMacroSearchQuery(e.target.value)}
                        placeholder="Поиск макроса..."
                        className="w-full rounded border border-border bg-muted/40 pl-8 pr-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-60 flex flex-col gap-0.5 pr-0.5">
                      {macros
                        .filter(m => {
                          const q = macroSearchQuery.toLowerCase().trim()
                          return m.label.toLowerCase().includes(q) || (m.bodyText && m.bodyText.toLowerCase().includes(q))
                        })
                        .map(macro => (
                          <button
                            key={macro.id}
                            type="button"
                            onClick={() => {
                              applyMacro(macro)
                              setIsMacroDropdownOpen(false)
                              setMacroSearchQuery('')
                            }}
                            className={cn(
                              "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors flex items-center min-w-0 border-l-2",
                              macro.colorClass && !macro.colorClass.startsWith('#') ? macro.colorClass : 'border-primary/40'
                            )}
                            style={macro.colorClass && macro.colorClass.startsWith('#') ? {
                              borderLeftColor: macro.colorClass,
                              backgroundColor: `${macro.colorClass}0a`
                            } : undefined}
                          >
                            <span className="font-medium text-foreground truncate">{macro.label}</span>
                          </button>
                        ))
                      }
                      {macros.filter(m => {
                        const q = macroSearchQuery.toLowerCase().trim()
                        return m.label.toLowerCase().includes(q) || (m.bodyText && m.bodyText.toLowerCase().includes(q))
                      }).length === 0 && (
                        <div className="text-[10px] text-muted-foreground text-center py-3">
                          Макросы не найдены
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
          </div>
          <AnimatePresence>
            {!hideScrollDownArrow && showScrollDown && previewItems.length === 0 && (
              <motion.button
                type="button"
                onClick={scrollTicketToBottom}
                initial={{ opacity: 0, y: 10, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.92 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="fixed bottom-6 left-[62px] z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-card/95 text-primary shadow-xl shadow-black/20 backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground"
                aria-label="Прокрутить вниз"
              >
                <ArrowDown className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="min-h-0 overflow-y-auto flex flex-col gap-4">
          <div className="bg-card rounded-2xl border border-border/55 p-4 shadow-sm flex flex-col gap-3.5">
            <div className="mb-1 flex items-center justify-between relative">
              <h2 className="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Параметры заявки
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTicketMetaOpen(value => !value)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
                  title="ID и номера заявки"
                >
                  {ticketMetaOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {ticketMetaOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 rounded-lg border border-border bg-muted/15 p-3">
                    {([
                      { key: 'zammad', label: 'Zammad №', value: ticket.number },
                      { key: 'clients', label: 'Clients ID', value: ticket.clientNumber || String(ticket.id) }
                    ] as { key: string; label: string; value: string | null }[]).map(({ key, label, value }) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                          <span className="block truncate font-mono text-xs font-semibold text-foreground">{value || '—'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyTicketMeta(key, value)}
                          disabled={!value}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          title="Скопировать"
                        >
                          {copiedTicketMeta === key ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                    <div className="mt-1 border-t border-border/40 pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={copyClientsLink}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          {copiedClientsLink ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-primary" />}
                        </span>
                        {copiedClientsLink ? 'Ссылка скопирована!' : 'Скопировать ссылку'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setHistoryModalOpen(true); setTicketMetaOpen(false) }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                        </span>
                        История изменений
                      </button>
                      {!detailsData?.customer?.organization_id && detailsData?.customer && (
                        <button
                          type="button"
                          onClick={() => {
                            setLinkOrgModalOpen(true)
                            setTicketMetaOpen(false)
                          }}
                          className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                        >
                          <span className="flex w-4 items-center justify-center shrink-0">
                            <Building className="h-3.5 w-3.5 text-primary" />
                          </span>
                          Привязать к организации
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setChangeCustomerModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <UserCheck className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Сменить клиента
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditCustomerModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <UserCog className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Изменить профиль
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMergeModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <GitMerge className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Объединить заявку
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateSubTicketModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <PlusCircle className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Создать подзадачу
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExportModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <FileDown className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Сохранить выгрузку задачи
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Тип заявки</span>
              <CustomSelect
                value={ticketTypeId}
                options={ticketTypeOptions}
                onChange={type => setTicketTypeId(String(type.id))}
                placeholder="Выберите тип"
                renderValue={type => type ? (
                  <span className={cn("inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium", getTicketTypeBadgeClass(String(type.id), type.name))}>
                    <span className="truncate">{type.name}</span>
                  </span>
                ) : <span className="text-muted-foreground">Выберите тип</span>}
                renderOption={type => (
                  <span className={cn("inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium", getTicketTypeBadgeClass(String(type.id), type.name))}>
                    <span className="truncate">{type.name}</span>
                  </span>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Состояние</span>
              <CustomSelect
                value={commentStateId}
                options={stateOptions}
                onChange={state => setCommentStateId(Number(state.id))}
                placeholder={ticket.state.name || 'Выберите состояние'}
                renderValue={state => state ? (
                  <span
                    className={cn(
                      "inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      !filtersData?.stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                    )}
                    style={filtersData?.stateColors?.[Number(state.id)] ? {
                      backgroundColor: `${filtersData.stateColors[Number(state.id)]}15`,
                      color: filtersData.stateColors[Number(state.id)],
                      borderColor: `${filtersData.stateColors[Number(state.id)]}30`
                    } : undefined}
                  >
                    <span className="truncate">{state.name}</span>
                  </span>
                ) : <span className="text-muted-foreground">Выберите состояние</span>}
                renderOption={state => (
                  <span
                    className={cn(
                      "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      !filtersData?.stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                    )}
                    style={filtersData?.stateColors?.[Number(state.id)] ? {
                      backgroundColor: `${filtersData.stateColors[Number(state.id)]}15`,
                      color: filtersData.stateColors[Number(state.id)],
                      borderColor: `${filtersData.stateColors[Number(state.id)]}30`
                    } : undefined}
                  >
                    <span className="truncate">{state.name}</span>
                  </span>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">В ожидании до</span>
              <CustomDateTimePicker value={commentPendingTime} onChange={setCommentPendingTime} />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Группа обслуживания</span>
              <CustomSelect
                value={groupId}
                options={groupOptions}
                onChange={group => setGroupId(Number(group.id))}
                placeholder="Выберите группу"
                searchable
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Ответственный</span>
              <div className="grid grid-cols-[1fr_36px] gap-2">
                <CustomSelect
                  value={ownerId}
                  options={ownerOptions}
                  onChange={owner => setOwnerId(Number(owner.id))}
                  placeholder="Не назначен"
                  searchable
                />
                <button
                  type="button"
                  onClick={() => currentUser?.id && setOwnerId(currentUser.id)}
                  disabled={!currentUser?.id}
                  title="Взять на себя"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/20 disabled:text-muted-foreground"
                >
                  <Hand className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Приоритет</span>
              <CustomSelect
                value={priorityId}
                options={priorityOptions}
                onChange={priority => setPriorityId(Number(priority.id))}
                placeholder="Выберите приоритет"
                renderValue={priority => priority ? (
                  <span className="flex items-center gap-2">
                    <PriorityCircles name={priority.name} />
                    <span className="truncate">{priority.name}</span>
                  </span>
                ) : <span className="text-muted-foreground">Выберите приоритет</span>}
                renderOption={priority => (
                  <span className="flex items-center gap-2">
                    <PriorityCircles name={priority.name} />
                    <span className="truncate">{priority.name}</span>
                  </span>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Причина обращения (IIKO)</span>
              <CustomMultiSelect
                values={iikoReasonIds}
                options={iikoReasonOptions}
                onChange={reasons => setIikoReasonIds(reasons.map(reason => String(reason.id)))}
                placeholder="Выберите причину"
                renderChip={reason => <span className="truncate text-sky-700 dark:text-sky-300">{reason.name}</span>}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Теги</span>
              <CustomMultiSelect
                values={tagIds}
                options={tagOptions}
                onChange={tags => setTagIds(tags.map(tag => String(tag.id)))}
                placeholder="Выберите теги"
                renderChip={tag => <span className="truncate text-violet-700 dark:text-violet-300">{tag.name}</span>}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/15 p-2">
                <span className="text-[10px] text-muted-foreground">Баллы</span>
                {canEditScore ? (
                  <div className="flex items-center gap-1">
                    {scoreSaving
                      ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-yellow-500" />
                      : <Award className="h-3.5 w-3.5 shrink-0 text-yellow-500" />}
                    <div className={cn('min-w-0 flex-1 transition-opacity', scoreSaving && 'pointer-events-none opacity-60')}>
                      <CustomSelect
                        value={(pendingScore ?? scoreValue) ?? ''}
                        options={scoreOptions.map(option => ({ id: option.value, name: option.label }))}
                        onChange={option => handleScoreChange(String(option.id))}
                        placeholder="Без оценки"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-yellow-500" />
                    {ticket.score !== null && ticket.score !== undefined ? formatScore(ticket.score) : '—'}
                  </span>
                )}
                {scoreError && <span className="text-[10px] leading-tight text-destructive">{scoreError}</span>}
              </div>
              <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/15 p-2">
                <span className="text-[10px] text-muted-foreground">Учётное время</span>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/75" />
                  {ticket.accountedTime !== null && ticket.accountedTime !== undefined ? `${ticket.accountedTime} мин` : '—'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Создана</span>
              <span className="text-xs font-medium text-foreground font-mono flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                {formatTicketDate(ticket.createdAt)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Обновлена</span>
              <span className="text-xs font-medium text-foreground font-mono flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                {formatTicketDate(ticket.updatedAt)}
              </span>
            </div>

            {ticket.pendingTime && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground">Отложено до</span>
                <span className="text-xs font-medium text-foreground font-mono flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/75" />
                  {formatTicketDate(ticket.pendingTime)}
                </span>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border/55 p-4 shadow-sm flex flex-col gap-2">
            <h2 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 mb-1">
              <Building className="h-3.5 w-3.5" />
              Интеграции
            </h2>
            {[
              {
                label: 'Заведено в ERP',
                value: ticket.checkInErp === true ? 'Да' : ticket.checkInErp === false ? 'Нет' : null,
                accent: ticket.checkInErp === true ? 'text-emerald-400' : undefined
              },
              { label: 'Счёт ERP', value: ticket.erpBill ?? null, accent: undefined },
              { label: 'Сделка Битрикс24', value: ticket.bitrixDeal ?? null, accent: undefined },
              { label: 'Стоимость задачи (IIKO)', value: ticket.iikoCost ?? null, accent: undefined }
            ].map(({ label, value, accent }) => (
              <div key={label} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/10 px-2.5 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">{label}</span>
                <span className={cn(
                  'text-xs font-semibold truncate text-right',
                  value ? (accent ?? 'text-foreground') : 'text-muted-foreground/30'
                )}>
                  {value ?? '—'}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
      <AnimatePresence>
        {selectedOrgId && detailsData?.organization && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrgId(null)}
              className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-0 bottom-0 z-30 w-[450px] border-l border-border bg-card flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <Building className="h-5 w-5 text-primary shrink-0" />
                  <h3 className="font-semibold text-sm truncate" title={detailsData.organization.name}>
                    {detailsData.organization.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOrgId(null)}
                  className="h-6 w-6 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex border-b border-border px-4 shrink-0 bg-muted/20">
                {(['info', 'members', 'tickets'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors duration-150',
                      activeTab === tab
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab === 'info' && 'Информация'}
                    {tab === 'members' && (orgMembersLoading ? 'Сотрудники' : `Сотрудники (${orgMembers.length})`)}
                    {tab === 'tickets' && (orgTicketsLoading ? 'Заявки' : `Заявки (${orgTickets.length})`)}
                  </button>
                ))}
              </div>

              <div className="p-5 flex-1 overflow-y-auto min-h-0 space-y-5">
                {activeTab === 'info' && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground">Группа обслуживания</span>
                        <span className="font-medium text-foreground">{detailsData.organization.responsible_group || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground">Менеджер</span>
                        <span className="font-medium text-foreground">{detailsData.organization.manager || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground">Задолженность</span>
                        <span className={cn('font-semibold', detailsData.organization.sum_debt > 0 ? 'text-destructive' : 'text-green-500')}>
                          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(detailsData.organization.sum_debt || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground">Остаток на депозите (мин)</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {detailsData.organization.deposit_balance_minutes !== null && detailsData.organization.deposit_balance_minutes !== undefined
                            ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(detailsData.organization.deposit_balance_minutes)
                            : '—'
                          }
                        </span>
                      </div>
                      {detailsData.organization.link_wiki && (
                        <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Wiki</span>
                          <a
                            href={detailsData.organization.link_wiki}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            Открыть <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {detailsData.organization.note && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold text-muted-foreground">Заметки</h4>
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                          {detailsData.organization.note}
                        </div>
                      </div>
                    )}

                    {(detailsData.organization.contracts || detailsData.organization.contracts_and_comments) && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold text-muted-foreground">Договоры и комментарии</h4>
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                          {[detailsData.organization.contracts, detailsData.organization.contracts_and_comments].filter(Boolean).join('\n\n')}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'members' && (
                  <div className="space-y-3">
                    {orgMembersLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-3 animate-pulse">
                          <div className="h-3 w-2/3 bg-muted/80 rounded mb-2" />
                          <div className="h-2 w-1/2 bg-muted/80 rounded" />
                        </div>
                      ))
                    ) : orgMembers.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                        Нет зарегистрированных сотрудников
                      </div>
                    ) : (
                      orgMembers.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-xl border border-border/30 bg-muted/10 p-3 space-y-1.5 hover:border-border transition-colors duration-100"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <User className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            <span>{member.firstname} {member.lastname}</span>
                          </div>
                          {member.email && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate select-all">{member.email}</span>
                            </div>
                          )}
                          {(member.phone || member.mobile) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate select-all">{member.phone || member.mobile}</span>
                            </div>
                          )}
                          {member.department && (
                            <div className="text-[11px] text-muted-foreground">
                              Отдел: <span className="select-all text-foreground/80">{member.department}</span>
                            </div>
                          )}
                          {member.max && (
                            <div className="text-[11px] text-muted-foreground">
                              MAX: <span className="select-all text-foreground/80">{member.max}</span>
                            </div>
                          )}
                          {member.telegram && (
                            <div className="text-[11px] text-muted-foreground">
                              Telegram: <span className="select-all text-foreground/80">{member.telegram}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'tickets' && (
                  <div className="space-y-3">
                    {!orgTicketsLoading && orgTickets.length > 0 && (
                      <div className="space-y-2 pb-2 border-b border-border/30">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            type="search"
                            value={orgTicketsSearch}
                            onChange={(e) => setOrgTicketsSearch(e.target.value)}
                            placeholder="Поиск по теме или номеру..."
                            className="h-8 w-full rounded-md border border-border bg-muted/30 pl-8 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <div className="relative flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => setIsOwnerDropdownOpen(!isOwnerDropdownOpen)}
                              className="w-full text-left rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/60 truncate min-h-[26px]"
                            >
                              {orgTicketsOwner === 'all' ? 'Все ответственные' : orgTicketsOwner}
                            </button>
                            {isOwnerDropdownOpen && (
                              <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-2xl flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={ownerSearchQuery}
                                  onChange={e => setOwnerSearchQuery(e.target.value)}
                                  placeholder="Поиск ответственного..."
                                  className="w-full rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
                                  onClick={e => e.stopPropagation()}
                                />
                                <div className="overflow-y-auto max-h-36 flex flex-col gap-0.5 pr-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOrgTicketsOwner('all')
                                      setIsOwnerDropdownOpen(false)
                                      setOwnerSearchQuery('')
                                    }}
                                    className={cn(
                                      "w-full text-left px-1.5 py-1 text-[10px] rounded hover:bg-accent transition-colors flex items-center min-w-0",
                                      orgTicketsOwner === 'all' && "bg-primary/10 text-primary font-semibold"
                                    )}
                                  >
                                    <span className="truncate w-full">Все ответственные</span>
                                  </button>
                                  {allAvailableOwners
                                    .filter(ownerName => ownerName.toLowerCase().includes(ownerSearchQuery.toLowerCase().trim()))
                                    .map(ownerName => (
                                      <button
                                        key={ownerName}
                                        type="button"
                                        onClick={() => {
                                          setOrgTicketsOwner(ownerName)
                                          setIsOwnerDropdownOpen(false)
                                          setOwnerSearchQuery('')
                                        }}
                                        className={cn(
                                          "w-full text-left px-1.5 py-1 text-[10px] rounded hover:bg-accent transition-colors flex items-center min-w-0",
                                          orgTicketsOwner === ownerName && "bg-primary/10 text-primary font-semibold"
                                        )}
                                      >
                                        <span className="truncate w-full">{ownerName}</span>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <select
                            value={orgTicketsState}
                            onChange={(e) => setOrgTicketsState(e.target.value)}
                            className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/60 min-h-[26px]"
                          >
                            <option value="all" className="bg-card">Все состояния</option>
                            {uniqueStates.map((state) => (
                              <option key={state} value={state} className="bg-card">
                                {state}
                              </option>
                            ))}
                          </select>
                          <select
                            value={orgTicketsDate}
                            onChange={(e) => setOrgTicketsDate(e.target.value)}
                            className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/60 min-h-[26px]"
                          >
                            <option value="all" className="bg-card">За всё время</option>
                            <option value="today" className="bg-card">За сегодня</option>
                            <option value="week" className="bg-card">За неделю</option>
                            <option value="month" className="bg-card">За месяц</option>
                            <option value="year" className="bg-card">За год</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {orgTicketsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-3 animate-pulse">
                            <div className="h-3.5 w-1/4 bg-muted/80 rounded mb-2" />
                            <div className="h-4 w-3/4 bg-muted/80 rounded mb-2.5" />
                            <div className="h-3 w-1/3 bg-muted/80 rounded" />
                          </div>
                        ))
                      ) : orgTickets.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                          Заявки не найдены
                        </div>
                      ) : filteredOrgTickets.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                          Нет заявок, соответствующих фильтрам
                        </div>
                      ) : (
                        filteredOrgTickets.map((t) => {
                          const stateColor = filtersData?.stateColors?.[t.state.id]
                          const stateBadgeStyle = stateColor ? {
                            backgroundColor: `${stateColor}15`,
                            color: stateColor,
                            borderColor: `${stateColor}30`,
                            borderWidth: '1px'
                          } : undefined

                          return (
                            <div
                              key={t.id}
                              data-tab-path={`/dashboard/tickets/${t.id}`}
                              onClick={() => {
                                setSelectedOrgId(null)
                                navigate(`/dashboard/tickets/${t.id}`)
                              }}
                              className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-all duration-100 group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  #{t.clientNumber || t.id}
                                </span>
                                <span
                                  style={stateBadgeStyle}
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-medium border border-border/30 whitespace-nowrap",
                                    !stateColor && getStateBadgeClass(t.state.name)
                                  )}
                                >
                                  {t.state.name}
                                </span>
                              </div>
                              <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-relaxed">
                                {t.title}
                              </h4>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{formatTicketDate(t.createdAt)}</span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
        {mergeModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <GitMerge className="h-[18px] w-[18px] text-primary" />
                  Объединение заявок
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setMergeModalOpen(false); setSelectedMergeTarget(null); setMergeResults([]); setMergeSearch(''); setMergeError('') }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {!selectedMergeTarget ? (
                <div className="flex flex-col gap-4 overflow-y-auto pr-1">
                  <form onSubmit={handleMergeSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={mergeSearch}
                        onChange={(e) => setMergeSearch(e.target.value)}
                        placeholder="ID, номер Zammad или тема..."
                        className="h-9 w-full rounded-md border border-border bg-muted/30 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={mergeLoading} className="h-9">
                      {mergeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Найти'}
                    </Button>
                  </form>

                  {mergeError && (
                    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                      {mergeError}
                    </div>
                  )}

                  <div className="space-y-2 mt-2">
                    {mergeResults.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedMergeTarget(t)}
                        className="flex flex-col gap-1.5 p-3 rounded-lg border border-border/60 bg-muted/10 hover:border-primary/50 hover:bg-muted/20 cursor-pointer transition-all duration-100"
                      >
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="font-mono">#{t.clientNumber || t.id} (Zammad: #{t.number})</span>
                          <span>{t.state.name}</span>
                        </div>
                        <h4 className="text-xs font-semibold text-foreground line-clamp-2 leading-relaxed">
                          {t.title}
                        </h4>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/20">
                          <span>{t.organization?.name || 'Без организации'}</span>
                          <span>{t.owner?.name || 'Не назначен'}</span>
                        </div>
                      </div>
                    ))}
                    {!mergeLoading && mergeSearch && mergeResults.length === 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                        Подходящие заявки не найдены
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex gap-3 text-xs leading-relaxed text-foreground">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-600 dark:text-amber-400 mb-1">Объединить текущую заявку:</p>
                      <div className="my-1.5 pl-2 border-l-2 border-amber-500/50 font-medium">
                        #{detailsData?.ticket?.clientNumber || detailsData?.ticket?.id} — {detailsData?.ticket?.title}
                      </div>
                      с выбранной заявкой:
                      <div className="my-1.5 pl-2 border-l-2 border-amber-500/50 font-medium">
                        #{selectedMergeTarget.clientNumber || selectedMergeTarget.id} — {selectedMergeTarget.title}
                      </div>
                    </div>
                  </div>

                  {mergeError && (
                    <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                      {mergeError}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-2 border-t border-border pt-3">
                    <Button variant="outline" size="sm" onClick={() => setSelectedMergeTarget(null)} disabled={mergeLoading}>
                      Назад
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleMergeSubmit} disabled={mergeLoading}>
                      {mergeLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                      Объединить
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}

        {changeCustomerModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-[18px] w-[18px] text-primary" />
                  Смена клиента заявки
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setChangeCustomerModalOpen(false); setCustomerResults([]); setCustomerSearch(''); setChangeCustomerError('') }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex border-b border-border bg-muted/10 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => { setActiveCustomerTab('search'); setChangeCustomerError(''); }}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors",
                    activeCustomerTab === 'search'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Поиск
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveCustomerTab('create'); setChangeCustomerError(''); }}
                  className={cn(
                    "flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors",
                    activeCustomerTab === 'create'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Создать нового
                </button>
              </div>

              {changeCustomerError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                  {changeCustomerError}
                </div>
              )}

              {activeCustomerTab === 'search' ? (
                <div className="flex flex-col gap-4 overflow-y-auto pr-1">
                  <form onSubmit={handleCustomerSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Имя, email, телефон..."
                        className="h-9 w-full rounded-md border border-border bg-muted/30 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={customerSearchLoading} className="h-9">
                      {customerSearchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Найти'}
                    </Button>
                  </form>

                  {detailsData?.organization && (
                    <div className="flex items-center gap-2 mt-1 px-1">
                      <input
                        type="checkbox"
                        id="linkExistingToOrg"
                        checked={linkExistingToOrg}
                        onChange={(e) => setLinkExistingToOrg(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary bg-muted/30 focus:ring-0 focus:ring-offset-0"
                      />
                      <label htmlFor="linkExistingToOrg" className="text-xs text-muted-foreground select-none">
                        Привязать выбранного клиента к организации «{detailsData.organization.name}»
                      </label>
                    </div>
                  )}

                  <div className="space-y-2 mt-2">
                    {customerResults.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          if (!changeCustomerLoading) handleChangeCustomer(u.id)
                        }}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10 hover:border-primary/50 hover:bg-muted/20 cursor-pointer transition-all duration-100 group",
                          changeCustomerLoading && "pointer-events-none opacity-60"
                        )}
                      >
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{u.name}</span>
                          <span className="text-[10px] text-muted-foreground truncate">{u.email || 'Нет почты'}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[10px] shrink-0"
                          disabled={changeCustomerLoading}
                        >
                          {changeCustomerLoading && selectingCustomerId === u.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            'Выбрать'
                          )}
                        </Button>
                      </div>
                    ))}
                    {!customerSearchLoading && customerSearch && customerResults.length === 0 && (
                      <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                        Пользователи не найдены
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateCustomer} className="flex flex-col gap-3 overflow-y-auto pr-1">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Имя</label>
                      <input
                        type="text"
                        value={newCustomerFirstname}
                        onChange={(e) => setNewCustomerFirstname(e.target.value)}
                        className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Фамилия</label>
                      <input
                        type="text"
                        value={newCustomerLastname}
                        onChange={(e) => setNewCustomerLastname(e.target.value)}
                        className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Email</label>
                    <input
                      type="email"
                      value={newCustomerEmail}
                      onChange={(e) => setNewCustomerEmail(e.target.value)}
                      className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Телефон</label>
                      <input
                        type="text"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Мобильный</label>
                      <input
                        type="text"
                        value={newCustomerMobile}
                        onChange={(e) => setNewCustomerMobile(e.target.value)}
                        className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Telegram ID</label>
                    <input
                      type="text"
                      value={newCustomerTelegram}
                      onChange={(e) => setNewCustomerTelegram(e.target.value)}
                      className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                    />
                  </div>
                  {detailsData?.organization && (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="checkbox"
                        id="linkToOrg"
                        checked={linkToOrg}
                        onChange={(e) => setLinkToOrg(e.target.checked)}
                        className="h-4 w-4 rounded border-border text-primary bg-muted/30 focus:ring-0 focus:ring-offset-0"
                      />
                      <label htmlFor="linkToOrg" className="text-xs text-muted-foreground select-none">
                        Привязать к организации «{detailsData.organization.name}»
                      </label>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 mt-4 border-t border-border pt-3">
                    <Button variant="outline" size="sm" type="button" onClick={() => setChangeCustomerModalOpen(false)} disabled={changeCustomerLoading}>
                      Отмена
                    </Button>
                    <Button size="sm" type="submit" disabled={changeCustomerLoading}>
                      {changeCustomerLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                      Создать и сменить
                    </Button>
                  </div>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}

        {editCustomerModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh]"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <User className="h-[18px] w-[18px] text-primary" />
                  Редактирование профиля клиента
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditCustomerModalOpen(false); setEditCustomerError('') }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {editCustomerError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                  {editCustomerError}
                </div>
              )}

              <form onSubmit={handleEditCustomerSubmit} className="flex flex-col gap-3 overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Имя</label>
                    <input
                      type="text"
                      value={editFirstname}
                      onChange={(e) => setEditFirstname(e.target.value)}
                      className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Фамилия</label>
                    <input
                      type="text"
                      value={editLastname}
                      onChange={(e) => setEditLastname(e.target.value)}
                      className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                      required
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Телефон</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Мобильный</label>
                    <input
                      type="text"
                      value={editMobile}
                      onChange={(e) => setEditMobile(e.target.value)}
                      className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Telegram ID</label>
                  <input
                    type="text"
                    value={editTelegram}
                    onChange={(e) => setEditTelegram(e.target.value)}
                    className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Адрес</label>
                  <textarea
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="h-16 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground resize-none focus:border-primary/60 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1 relative">
                  <label className="text-[10px] font-semibold text-muted-foreground">Организация</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={orgSearchQuery}
                      onChange={(e) => handleOrgSearch(e.target.value)}
                      placeholder="Поиск организации..."
                      className="h-9 w-full rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                    />
                    {orgSearchQuery && editOrgId && (
                      <button
                        type="button"
                        onClick={() => { setEditOrgId(null); setOrgSearchQuery(''); }}
                        className="absolute right-2 top-2 h-5 w-5 text-muted-foreground hover:text-foreground flex items-center justify-center rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {orgSearchLoading && (
                    <div className="absolute right-2 top-8">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                  {orgSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-background shadow-md">
                      {orgSearchResults.map((org) => (
                        <div
                          key={org.id}
                          onClick={() => {
                            setEditOrgId(org.id)
                            setOrgSearchQuery(org.name)
                            setOrgSearchResults([])
                          }}
                          className="px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-sm"
                        >
                          {org.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-4 border-t border-border pt-3">
                  <Button variant="outline" size="sm" type="button" onClick={() => setEditCustomerModalOpen(false)} disabled={editCustomerLoading}>
                    Отмена
                  </Button>
                  <Button size="sm" type="submit" disabled={editCustomerLoading}>
                    {editCustomerLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Сохранить
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {linkOrgModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="h-[18px] w-[18px] text-primary" />
                  Привязка клиента к организации
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setLinkOrgModalOpen(false); setLinkOrgError(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {linkOrgError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                  {linkOrgError}
                </div>
              )}

              <form onSubmit={handleLinkOrgSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1 relative">
                  <label className="text-[10px] font-semibold text-muted-foreground">Организация</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={linkOrgSearchQuery}
                      onChange={(e) => handleLinkOrgSearch(e.target.value)}
                      placeholder="Поиск организации..."
                      className="h-9 w-full rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                      required
                    />
                    {linkOrgSearchQuery && linkOrgId && (
                      <button
                        type="button"
                        onClick={() => { setLinkOrgId(null); setLinkOrgSearchQuery(''); }}
                        className="absolute right-2 top-2 h-5 w-5 text-muted-foreground hover:text-foreground flex items-center justify-center rounded"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {linkOrgSearchLoading && (
                    <div className="absolute right-2 top-8">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                  {linkOrgSearchResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-background shadow-md">
                      {linkOrgSearchResults.map((org) => (
                        <div
                          key={org.id}
                          onClick={() => {
                            setLinkOrgId(org.id)
                            setLinkOrgSearchQuery(org.name)
                            setLinkOrgSearchResults([])
                          }}
                          className="px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-sm"
                        >
                          {org.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-4 border-t border-border pt-3">
                  <Button variant="outline" size="sm" type="button" onClick={() => setLinkOrgModalOpen(false)} disabled={linkOrgLoading}>
                    Отмена
                  </Button>
                  <Button size="sm" type="submit" disabled={linkOrgLoading || !linkOrgId}>
                    {linkOrgLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Привязать
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {exportModalOpen && (
          <TicketExportModal
            ticketId={idNum}
            onClose={() => setExportModalOpen(false)}
          />
        )}

        {createSubTicketModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh]"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <GitMerge className="h-[18px] w-[18px] text-primary" />
                  Создание подзадачи
                </h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreateSubTicketModalOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {createSubTicketError && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                  {createSubTicketError}
                </div>
              )}

              <form onSubmit={handleCreateSubTicketSubmit} className="flex flex-col gap-4 overflow-y-auto pr-1">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Тема подзадачи</label>
                  <input
                    type="text"
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    placeholder="Введите заголовок подзадачи..."
                    className="h-9 w-full rounded-md border border-border bg-muted/25 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Описание</label>
                  <textarea
                    value={subBody}
                    onChange={(e) => setSubBody(e.target.value)}
                    placeholder="Подробное описание задачи..."
                    className="min-h-24 w-full resize-y rounded-md border border-border bg-muted/25 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Тип</label>
                    <CustomSelect
                      value={subType}
                      options={ticketTypeOptions}
                      onChange={(type) => setSubType(String(type.id))}
                      placeholder="Выберите тип"
                      renderValue={type => type ? (
                        <span className={cn("inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium", getTicketTypeBadgeClass(String(type.id), type.name))}>
                          <span className="truncate">{type.name}</span>
                        </span>
                      ) : <span className="text-muted-foreground">Выберите тип</span>}
                      renderOption={type => (
                        <span className={cn("inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium", getTicketTypeBadgeClass(String(type.id), type.name))}>
                          <span className="truncate">{type.name}</span>
                        </span>
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Группа</label>
                    <CustomSelect
                      value={subGroup || null}
                      options={groupOptions}
                      onChange={(group) => setSubGroup(Number(group.id))}
                      placeholder="Выберите группу"
                      searchable
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Ответственный</label>
                    <CustomSelect
                      value={subOwner || null}
                      options={ownerOptions}
                      onChange={(owner) => setSubOwner(Number(owner.id))}
                      placeholder="Не назначен"
                      searchable
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Приоритет</label>
                    <CustomSelect
                      value={subPriority}
                      options={priorityOptions}
                      onChange={(priority) => setSubPriority(Number(priority.id))}
                      placeholder="Выберите приоритет"
                      renderValue={priority => priority ? (
                        <span className="flex items-center gap-2">
                          <PriorityCircles name={priority.name} />
                          <span className="truncate">{priority.name}</span>
                        </span>
                      ) : <span className="text-muted-foreground">Выберите приоритет</span>}
                      renderOption={priority => (
                        <span className="flex items-center gap-2">
                          <PriorityCircles name={priority.name} />
                          <span className="truncate">{priority.name}</span>
                        </span>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Состояние</label>
                    <CustomSelect
                      value={subState}
                      options={stateOptions}
                      onChange={(state) => setSubState(Number(state.id))}
                      placeholder="Выберите состояние"
                      renderValue={state => state ? (
                        <span
                          className={cn(
                            "inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                            !filtersData?.stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                          )}
                          style={filtersData?.stateColors?.[Number(state.id)] ? {
                            backgroundColor: `${filtersData.stateColors[Number(state.id)]}15`,
                            color: filtersData.stateColors[Number(state.id)],
                            borderColor: `${filtersData.stateColors[Number(state.id)]}30`
                          } : undefined}
                        >
                          <span className="truncate">{state.name}</span>
                        </span>
                      ) : <span className="text-muted-foreground">Выберите состояние</span>}
                      renderOption={state => (
                        <span
                          className={cn(
                            "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            !filtersData?.stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                          )}
                          style={filtersData?.stateColors?.[Number(state.id)] ? {
                            backgroundColor: `${filtersData.stateColors[Number(state.id)]}15`,
                            color: filtersData.stateColors[Number(state.id)],
                            borderColor: `${filtersData.stateColors[Number(state.id)]}30`
                          } : undefined}
                        >
                          <span className="truncate">{state.name}</span>
                        </span>
                      )}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-semibold text-muted-foreground">Затраченное время (минуты)</label>
                    <div className="flex h-9 items-center rounded-md border border-border bg-muted/25 px-3 focus-within:border-primary/60 transition-colors">
                      <input
                        type="number"
                        min={0}
                        value={subTime || ''}
                        onChange={(e) => setSubTime(Number(e.target.value))}
                        placeholder="0"
                        className="w-full bg-transparent text-xs text-foreground outline-none font-mono"
                      />
                      <span className="text-[10px] text-muted-foreground ml-2 shrink-0">мин</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-4 border-t border-border pt-3">
                  <Button variant="outline" size="sm" type="button" onClick={() => setCreateSubTicketModalOpen(false)} disabled={createSubTicketLoading}>
                    Отмена
                  </Button>
                  <Button size="sm" type="submit" disabled={createSubTicketLoading}>
                    {createSubTicketLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                    Создать подзадачу
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
