import { Clock, Loader2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TicketHistoryItem } from '@/types/ticket'
import { historyActorColor, historyActorInitials, historyDateLabel, historyFormatTime } from '@/lib/ticketFormat'
export function TicketHistoryModal({
  items,
  loading,
  onClose
}: {
  items: TicketHistoryItem[]
  loading: boolean
  onClose: () => void
}) {
  const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const groups: { label: string; items: TicketHistoryItem[] }[] = []
  for (const item of sorted) {
    const label = historyDateLabel(item.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-end bg-black/40 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        // Ящик начинается ниже полосы с кнопками окна: иначе его крестик
        // оказывался ровно под кнопкой закрытия приложения.
        className="mt-[38px] flex h-[calc(100%-38px)] w-full max-w-[420px] flex-col border-l border-border bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Clock className="h-4 w-4 text-primary" />
            История изменений
            {!loading && sorted.length > 0 && (
              <span className="rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-normal text-muted-foreground">
                {sorted.length}
              </span>
            )}
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Загружаю...
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Clock className="h-10 w-10 opacity-15" />
              <span className="text-sm">История недоступна</span>
            </div>
          ) : (
            <div>
              {groups.map(group => (
                <div key={group.label}>
                  <div className="sticky top-0 z-10 flex items-center gap-3 bg-card/95 px-5 py-2 backdrop-blur-sm">
                    <div className="h-px flex-1 bg-border/40" />
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                      {group.label}
                    </span>
                    <div className="h-px flex-1 bg-border/40" />
                  </div>

                  <div className="px-4">
                    {group.items.map((item, idx) => {
                      const hasChange = !!(item.fieldName && (item.from || item.to))
                      const isSystem = /служеб|систем|system|автомат/i.test(item.actorName)
                      const initials = historyActorInitials(item.actorName)
                      const avatarColor = isSystem
                        ? 'bg-zinc-700/40 text-zinc-500'
                        : historyActorColor(item.actorName)

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            'flex gap-3 py-3',
                            idx < group.items.length - 1 && 'border-b border-border/25'
                          )}
                        >
                          <div className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                            avatarColor
                          )}>
                            {initials}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1.5 flex items-baseline justify-between gap-2">
                              <span className={cn(
                                'truncate text-xs font-semibold',
                                isSystem ? 'text-muted-foreground/70' : 'text-foreground'
                              )}>
                                {item.actorName}
                              </span>
                              <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/60">
                                {historyFormatTime(item.createdAt)}
                              </span>
                            </div>

                            {hasChange ? (
                              <div>
                                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                                  {item.fieldName}
                                </span>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  {item.from ? (
                                    <span className="inline-flex max-w-[140px] items-center truncate rounded border border-red-900/50 bg-red-950/50 px-2 py-0.5 text-[11px] text-red-400/80 line-through">
                                      {item.from}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground/30">пусто</span>
                                  )}
                                  <span className="text-muted-foreground/40 text-xs">→</span>
                                  {item.to ? (
                                    <span className="inline-flex max-w-[140px] items-center truncate rounded border border-emerald-900/50 bg-emerald-950/50 px-2 py-0.5 text-[11px] text-emerald-400">
                                      {item.to}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground/30">пусто</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <p className={cn(
                                'text-xs leading-5',
                                isSystem ? 'text-muted-foreground/50' : 'text-foreground/70'
                              )}>
                                {item.action}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
