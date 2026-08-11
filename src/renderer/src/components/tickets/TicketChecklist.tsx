import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, ChevronUp, ListChecks, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ErrorNotice } from '@/components/ui/error-notice'

interface ChecklistItem {
  id: number
  name: string
  description: string
  checked: boolean
  checkedBy: string
  checkedAt: string
  category: string
}

interface ChecklistGroup {
  category: string
  items: ChecklistItem[]
}

interface ChecklistData {
  groups: ChecklistGroup[]
  templates: { id: number; name: string }[]
}

/** Дата приходит от clients двумя видами: как на странице и как ISO из ответа на отметку. */
function formatChecked(value: string): string {
  if (!value) return ''
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

/**
 * Чек-лист заявки из clients. Раньше его было видно только в вебе, и работать с
 * заявкой приходилось в двух местах сразу.
 */
export function TicketChecklist({ ticketId }: { ticketId: number }) {
  const queryClient = useQueryClient()
  const [isOpen, setIsOpen] = useState(true)
  const [busyItemId, setBusyItemId] = useState<number | null>(null)

  const { data, isLoading, error, refetch, isFetching } = useQuery<ChecklistData>({
    queryKey: ['ticket-checklist', ticketId],
    queryFn: () => window.api.tickets.getChecklist(ticketId),
    enabled: ticketId > 0,
    staleTime: 30_000
  })

  const toggle = useMutation({
    mutationFn: (item: ChecklistItem) =>
      window.api.tickets.setChecklistItem(ticketId, {
        id: item.id,
        name: item.name,
        description: item.description,
        category: item.category,
        checked: !item.checked
      }),
    onMutate: async (item) => {
      setBusyItemId(item.id)
      // Отметка ставится сразу: ждать ответа, глядя на неизменившийся пункт,
      // — это ровно то, из-за чего кажется, что нажатие не сработало.
      const previous = queryClient.getQueryData<ChecklistData>(['ticket-checklist', ticketId])
      queryClient.setQueryData<ChecklistData>(['ticket-checklist', ticketId], current =>
        current
          ? {
              ...current,
              groups: current.groups.map(group => ({
                ...group,
                items: group.items.map(existing =>
                  existing.id === item.id
                    ? { ...existing, checked: !existing.checked, checkedBy: '', checkedAt: '' }
                    : existing
                )
              }))
            }
          : current
      )
      return { previous }
    },
    onError: (_error, _item, context) => {
      // Сервер не принял — возвращаем как было, иначе отметка соврёт.
      if (context?.previous) {
        queryClient.setQueryData(['ticket-checklist', ticketId], context.previous)
      }
    },
    onSettled: () => {
      setBusyItemId(null)
      queryClient.invalidateQueries({ queryKey: ['ticket-checklist', ticketId] })
    }
  })

  const groups = data?.groups ?? []
  const items = groups.flatMap(group => group.items)
  const done = items.filter(item => item.checked).length

  // Пустой чек-лист — обычное дело: он есть далеко не у каждой заявки.
  if (!isLoading && !error && items.length === 0) return null

  return (
    <div className="bg-card rounded-2xl border border-border/55 p-5 shadow-sm shrink-0 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(value => !value)}
          className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground"
        >
          <ListChecks className="h-3.5 w-3.5 text-primary" />
          Чек-лист {items.length > 0 && `(${done} из ${items.length})`}
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {items.length > 0 && (
          <div className="h-1 w-24 shrink-0 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${Math.round((done / items.length) * 100)}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Загружаем чек-лист…
        </div>
      )}

      {error && (
        <ErrorNotice
          error={error}
          fallback="Не удалось загрузить чек-лист"
          onRetry={() => void refetch()}
          isRetrying={isFetching}
        />
      )}

      <AnimatePresence initial={false}>
        {isOpen && groups.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4">
              {groups.map(group => (
                <div key={group.category || 'без раздела'} className="flex flex-col gap-1.5">
                  {group.category && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.category}
                    </span>
                  )}

                  {group.items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggle.mutate(item)}
                      disabled={busyItemId === item.id}
                      className="flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/15 px-3 py-2 text-left transition-colors hover:bg-muted/35 disabled:opacity-60"
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          item.checked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/40'
                        )}
                      >
                        {busyItemId === item.id
                          ? <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          : item.checked && <Check className="h-3 w-3" />}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-xs font-medium',
                            item.checked ? 'text-muted-foreground line-through' : 'text-foreground'
                          )}
                        >
                          {item.name}
                        </span>
                        {item.description && (
                          <span className="mt-0.5 block whitespace-pre-wrap break-words text-[11px] leading-4 text-muted-foreground">
                            {item.description}
                          </span>
                        )}
                        {item.checked && item.checkedBy && (
                          <span className="mt-1 block text-[10px] text-muted-foreground/80">
                            {item.checkedBy}
                            {item.checkedAt && ` · ${formatChecked(item.checkedAt)}`}
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
