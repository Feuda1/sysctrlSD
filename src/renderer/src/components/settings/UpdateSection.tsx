import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, DownloadCloud, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'
import { SettingsHeader } from './SettingsControls'

export function UpdateSettings() {
  const update = useUIStore((s) => s.update)
  const checkForUpdate = useUIStore((s) => s.checkForUpdate)
  const installUpdate = useUIStore((s) => s.installUpdate)
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.app.getVersion().then(setVersion).catch(() => {})
  }, [])

  const checking = update.status === 'checking'
  const downloading = update.status === 'downloading'
  const ready = update.status === 'downloaded'

  const statusMeta = (() => {
    switch (update.status) {
      case 'checking': return { icon: RefreshCw, spin: true, color: 'text-muted-foreground', text: 'Проверяем наличие обновлений…' }
      case 'available': return { icon: DownloadCloud, color: 'text-primary', text: `Найдено обновление${update.version ? ` ${update.version}` : ''}. Загрузка…` }
      case 'downloading': return { icon: DownloadCloud, color: 'text-primary', text: `Загрузка обновления… ${update.percent ?? 0}%` }
      case 'downloaded': return { icon: CheckCircle2, color: 'text-emerald-500', text: `Версия ${update.version || ''} загружена и готова к установке.` }
      case 'not-available': return { icon: CheckCircle2, color: 'text-emerald-500', text: 'Установлена последняя версия.' }
      case 'error': return { icon: AlertCircle, color: 'text-destructive', text: update.error || 'Не удалось проверить обновления.' }
      default: return null
    }
  })()

  return (
    <div className="space-y-5">
      <SettingsHeader title="Обновления" description="Версия приложения и установка обновлений" />

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/15 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400 text-base font-bold text-primary-foreground shadow-md">
            SD
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">sysctrlSD</p>
            <p className="text-xs text-muted-foreground">Версия {version || '—'}</p>
          </div>
        </div>
      </div>

      {statusMeta && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/10 px-3.5 py-3 text-xs">
          <statusMeta.icon className={cn('h-4 w-4 shrink-0', statusMeta.color, statusMeta.spin && 'animate-spin')} />
          <span className="text-foreground/90">{statusMeta.text}</span>
        </div>
      )}

      {downloading && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${update.percent ?? 0}%` }} />
        </div>
      )}

      <div className="flex items-center gap-2">
        {ready ? (
          <Button
            type="button"
            size="sm"
            onClick={installUpdate}
            className="h-9 gap-2 rounded-lg bg-primary text-xs text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Перезапустить и установить
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={checking || downloading}
            onClick={() => checkForUpdate()}
            className="h-9 gap-2 rounded-lg text-xs hover:bg-accent"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} />
            Проверить обновления
          </Button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Обновления загружаются автоматически в фоне. Когда новая версия будет готова, появится уведомление — установить можно сразу или позже отсюда.
      </p>
    </div>
  )
}
