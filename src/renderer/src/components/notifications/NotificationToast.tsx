import { motion, AnimatePresence } from 'framer-motion'
import { X, Bell } from 'lucide-react'
import { useNotificationsStore } from '@/store/notifications'
import { useTabsStore } from '@/store/tabs'

export function NotificationToast() {
  const toasts = useNotificationsStore((s) => s.toasts)
  const removeToast = useNotificationsStore((s) => s.removeToast)
  const openTab = useTabsStore((s) => s.openTab)

  const history = useNotificationsStore((s) => s.history)
  const markAsRead = useNotificationsStore((s) => s.markAsRead)
  const tabs = useTabsStore((s) => s.tabs)
  const setActive = useTabsStore((s) => s.setActive)

  const handleToastClick = (ticketId: number, id: string) => {
    const targetPath = `/dashboard/tickets/${ticketId}`
    const existingTab = tabs.find(t => t.path === targetPath || t.initialPath === targetPath)
    if (existingTab) {
      setActive(existingTab.id)
    } else {
      openTab(targetPath)
    }

    const unread = history.filter(item => item.ticketId === ticketId && !item.isRead)
    for (const item of unread) {
      markAsRead(item.id)
    }

    removeToast(id)
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="pointer-events-auto flex gap-3 overflow-hidden rounded-xl border border-border/60 bg-card/80 p-3.5 shadow-xl backdrop-blur-md cursor-pointer group select-none hover:bg-accent/40"
            onClick={() => handleToastClick(toast.ticketId, toast.id)}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bell className="h-[18px] w-[18px]" />
            </div>
            
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-xs font-semibold text-foreground leading-tight truncate">
                {toast.title}
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                {toast.body}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                removeToast(toast.id)
              }}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/40 transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
