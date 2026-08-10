import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, ChevronLeft, ChevronRight, Download, FileArchive, FileImage, FileText, Loader2, Pause, Play, RefreshCw, RotateCcw, Volume2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatTicketDate } from '@/types/ticket'
import type { TicketAttachment } from '@/types/ticket'
import {
  dataUrlToText,
  formatAttachmentSize,
  formatAudioTime,
  getAttachmentKind,
  officeKind,
  readPlayerSettings,
  writePlayerSettings,
  type ArticleAttachment,
  type ViewerItem
} from '@/lib/ticketFormat'

/** Attachment tiles, the preview card, the full-screen media viewer and the
 * inline audio player of the ticket page. */
export function AttachmentTile({
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

export function AttachmentPreviewCard({
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

export function MediaViewer({
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


export function MiniAudioPlayer({ url, isPrivate }: { url: string; isPrivate?: boolean }) {
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
