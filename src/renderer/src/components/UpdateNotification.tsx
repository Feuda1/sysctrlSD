import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, RefreshCw } from 'lucide-react'
import { useUIStore } from '@/store/ui'
import { cn } from '@/lib/utils'

/**
 * Custom in-app update prompt (not an OS notification). Appears bottom-right when
 * a new version has been downloaded and is ready to install. "Позже" hides it -
 * the user can still install from Настройки → Обновления.
 */
export function UpdateNotification() {
  const update = useUIStore((s) => s.update)
  const dismissed = useUIStore((s) => s.updateDismissed)
  const installUpdate = useUIStore((s) => s.installUpdate)
  const dismissUpdate = useUIStore((s) => s.dismissUpdate)
  const sidebarSide = useUIStore((s) => s.sidebarSide)

  const show = update.status === 'downloaded' && !dismissed

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'fixed bottom-4 z-[200] w-80 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl',
            sidebarSide === 'right' ? 'right-[72px]' : 'right-4'
          )}
        >
          <div className="flex items-start gap-3 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400 text-primary-foreground shadow-md">
              <Download className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">Доступно обновление</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {update.version ? `Версия ${update.version} загружена и готова к установке.` : 'Новая версия загружена и готова к установке.'}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissUpdate}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 border-t border-border/60 bg-muted/20 px-4 py-3">
            <button
              type="button"
              onClick={installUpdate}
              className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Перезапустить
            </button>
            <button
              type="button"
              onClick={dismissUpdate}
              className="flex h-8 items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Позже
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
