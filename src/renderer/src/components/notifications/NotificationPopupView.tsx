import { useEffect, useMemo, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { RESOLVED_THEMES, THEME_STORAGE_KEY, type ResolvedTheme } from '@/store/ui'

// Совпадает с POPUP_LIFETIME_MS в electron/main/notifications/popup.ts - там
// живёт настоящий таймер закрытия, здесь только визуальная полоска обратного
// отсчёта поверх него.
const POPUP_LIFETIME_MS = 7000

/**
 * Содержимое окна-попапа (`?popup=notification`) - маленькая карточка поверх
 * всех окон, в духе Discord/Telegram, а не голый системный тост. Окно само
 * прозрачное (задано в `popup.ts`), так что фон здесь должен быть прозрачным
 * до самой карточки - иначе прямоугольник окна был бы виден целиком.
 */
export function NotificationPopupView() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const title = params.get('title') ?? ''
  const body = params.get('body') ?? ''
  const ticketId = Number(params.get('ticketId') ?? '0')

  const [paused, setPaused] = useState(false)

  useEffect(() => {
    // Тема - синхронно из localStorage: это то же происхождение `file://`,
    // что и у основного окна, так что данные общие, а IPC не нужен.
    document.body.style.background = 'transparent'
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    const theme: ResolvedTheme = (RESOLVED_THEMES as readonly string[]).includes(stored ?? '')
      ? (stored as ResolvedTheme)
      : 'dark'
    document.documentElement.classList.add(theme)
  }, [])

  const handleMouseEnter = () => {
    setPaused(true)
    window.api.notifications.popupPause()
  }
  const handleMouseLeave = () => {
    setPaused(false)
    window.api.notifications.popupResume()
  }
  const handleClick = () => {
    if (ticketId) window.api.notifications.popupClick(ticketId)
  }
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.api.notifications.popupDismiss()
  }

  return (
    <div
      className="drag-region flex h-screen w-screen cursor-pointer select-none items-stretch p-1.5"
      style={{ background: 'transparent' }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="no-drag relative flex flex-1 flex-col gap-1 overflow-hidden rounded-xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md">
        <div className="flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{body}</p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-border/50">
          <div
            className="h-full bg-primary"
            style={{
              animation: `sd-popup-countdown ${POPUP_LIFETIME_MS}ms linear forwards`,
              animationPlayState: paused ? 'paused' : 'running'
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes sd-popup-countdown {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  )
}
