import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Свои кнопки окна вместо системных. Системные рисуются поверх всего
 * содержимого: они накрывали крестики диалогов, не подчинялись теме и не
 * попадали в стиль остального интерфейса.
 *
 * Слой выше любых модалок - чтобы окно можно было свернуть или закрыть, даже
 * когда открыт диалог.
 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    window.api.window.isMaximized().then(setMaximized).catch(() => {})
    return window.api.window.onStateChange(state => setMaximized(state.maximized))
  }, [])

  return (
    <div
      className="no-drag fixed right-0 top-0 z-[200] flex h-[38px] items-stretch"
      // Дублируется стилем: класс задаёт то же самое, но область перетаскивания
      // окна считается системой, и полагаться тут на порядок CSS не хочется.
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <ControlButton label="Свернуть" onClick={() => window.api.window.minimize()}>
        {/* Тонкие линии рисуются в SVG, а не шрифтом: символы окна в разных
            шрифтах разъезжаются по толщине и высоте. */}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M0 5.5h10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </ControlButton>

      <ControlButton
        label={maximized ? 'Свернуть в окно' : 'Развернуть'}
        onClick={() => window.api.window.maximize()}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M2.5 2.5V0.5h7v7h-2" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </ControlButton>

      <ControlButton label="Закрыть" danger onClick={() => window.api.window.close()}>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M0.5 0.5l9 9M9.5 0.5l-9 9" stroke="currentColor" strokeWidth="1" />
        </svg>
      </ControlButton>
    </div>
  )
}

function ControlButton({
  label,
  onClick,
  danger,
  children
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      // Именно по отпусканию кнопки: пока нажатие обрабатывается, Windows
      // отбрасывает смену состояния окна, и «свернуть» просто теряется.
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      className={cn(
        'pointer-events-auto flex w-[46px] select-none items-center justify-center text-muted-foreground transition-colors',
        danger
          ? 'hover:bg-red-600 hover:text-white'
          : 'hover:bg-accent hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}
