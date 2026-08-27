import { AnimatePresence, motion } from 'framer-motion'
import { Megaphone, X } from 'lucide-react'
import { useBroadcastStore } from '@/store/broadcast'

/**
 * Сообщение от администратора всем сразу - "Zammad ляжет на обслуживание в
 * 15:00" и подобное. Одна активная рассылка на всю команду, а не очередь;
 * закрыл - больше не покажется именно это сообщение, но новое от админа
 * появится как обычно.
 */
export function BroadcastBanner() {
  const current = useBroadcastStore(s => s.current)
  const dismissedId = useBroadcastStore(s => s.dismissedId)
  const dismiss = useBroadcastStore(s => s.dismiss)

  const show = !!current && current.id !== dismissedId

  return (
    <AnimatePresence initial={false}>
      {show && current && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="shrink-0 overflow-hidden border-b border-primary/30 bg-primary/10"
        >
          <div className="flex select-none items-center gap-2 px-4 py-1.5 text-xs text-foreground">
            <Megaphone className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="flex-1">{current.message}</span>
            <button
              type="button"
              onClick={dismiss}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Закрыть"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
