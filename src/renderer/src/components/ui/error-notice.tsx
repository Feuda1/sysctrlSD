import { AlertCircle, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { describeError, type ErrorKind } from '@/lib/errorKind'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const ICONS: Record<ErrorKind, typeof AlertCircle> = {
  offline: WifiOff,
  network: WifiOff,
  auth: ShieldAlert,
  server: AlertCircle,
  data: AlertCircle
}

interface ErrorNoticeProps {
  error: unknown
  /** Текст на случай, когда у ошибки нет собственного сообщения. */
  fallback: string
  onRetry?: () => void
  isRetrying?: boolean
  className?: string
}

/**
 * Разбирает ошибку запроса и говорит, что произошло и стоит ли повторять.
 * Пропавшая сеть больше не выглядит как поломка данных.
 */
export function ErrorNotice({ error, fallback, onRetry, isRetrying, className }: ErrorNoticeProps) {
  const isOnline = useOnlineStatus()
  const described = describeError(error, fallback, isOnline)
  const Icon = ICONS[described.kind]
  // Пропавшая сеть - это не поломка, поэтому и цвет спокойнее красного.
  const isCalm = described.kind === 'offline' || described.kind === 'network'

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shrink-0',
        isCalm
          ? 'border-border bg-muted/40 text-foreground'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
        className
      )}
    >
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', isCalm && 'text-muted-foreground')} />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{described.title}</p>
        {described.hint && <p className="mt-0.5 text-xs text-muted-foreground">{described.hint}</p>}
        {described.detail && (
          <p className="mt-1 break-words text-[11px] text-muted-foreground/70">{described.detail}</p>
        )}
      </div>
      {onRetry && described.canRetry && (
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="flex shrink-0 select-none items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
        >
          <RefreshCw className={cn('h-3 w-3', isRetrying && 'animate-spin')} />
          Повторить
        </button>
      )}
    </div>
  )
}
