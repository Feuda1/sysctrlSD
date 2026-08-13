import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Loader2, X } from 'lucide-react'
import { useOutboxStore } from '@/store/outbox'
import { useTabsStore } from '@/store/tabs'
import { cn } from '@/lib/utils'

/**
 * Отправка продолжается и после ухода из заявки, поэтому её состояние должно
 * быть видно откуда угодно. Раньше уход из заявки означал тишину: получилось
 * или нет, узнать было негде.
 */
export function OutboxIndicator() {
  const jobs = useOutboxStore(store => store.jobs)
  const retry = useOutboxStore(store => store.retry)
  const drop = useOutboxStore(store => store.drop)
  const openTab = useTabsStore(store => store.openTab)

  // Заявка, открытая прямо сейчас, показывает ход отправки у себя в шапке -
  // вторая такая же плашка снизу была просто дублем.
  const openTicketId = useTabsStore(store => {
    const active = store.tabs.find(tab => tab.id === store.activeTabId)
    const match = (active?.path ?? '').match(/\/dashboard\/tickets\/(\d+)/)
    return match ? Number(match[1]) : null
  })

  const failed = jobs.filter(job => job.status === 'failed')
  const sending = jobs.filter(job => job.status === 'sending' && job.payload.ticketId !== openTicketId)
  // Неудача показывается всегда: о ней иначе не узнать, даже не уходя из заявки.
  const shown = failed.length > 0 ? failed : sending

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 flex-col gap-2">
      <AnimatePresence initial={false}>
        {shown.map(job => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'pointer-events-auto flex max-w-lg items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs shadow-lg backdrop-blur',
              job.status === 'failed'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-border bg-card/95 text-foreground'
            )}
          >
            {job.status === 'failed'
              ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              : <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}

            <div className="min-w-0">
              <button
                type="button"
                onClick={() => openTab(`/dashboard/tickets/${job.payload.ticketId}`)}
                className="block max-w-full truncate text-left font-medium hover:underline"
              >
                {job.payload.ticketTitle}
              </button>
              <p className={cn('mt-0.5 leading-4', job.status === 'failed' ? 'text-destructive/80' : 'text-muted-foreground')}>
                {job.status === 'failed'
                  ? job.error || 'Не удалось отправить'
                  : 'Отправляется…'}
              </p>
            </div>

            {job.status === 'failed' && (
              <div className="ml-1 flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => retry(job.id)}
                  className="select-none rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                >
                  Повторить
                </button>
                <button
                  type="button"
                  onClick={() => drop(job.id)}
                  title="Убрать"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
