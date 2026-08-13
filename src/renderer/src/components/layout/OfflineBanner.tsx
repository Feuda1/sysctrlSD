import { AnimatePresence, motion } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

/**
 * Без сети приложение продолжает показывать последние загруженные данные, и
 * отличить их от свежих нельзя. Полоска говорит, что список мог устареть.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()

  return (
    <AnimatePresence initial={false}>
      {!isOnline && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="shrink-0 overflow-hidden border-b border-border bg-muted/60"
        >
          <div className="flex select-none items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground">
            <WifiOff className="h-3.5 w-3.5" />
            Нет подключения к сети - данные показаны на момент последней загрузки
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
