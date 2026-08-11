import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CheckCheck, ChevronDown, ChevronUp, ListChecks, Loader2, Plus, Trash2 } from 'lucide-react'
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
  const [menuOpen, setMenuOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [addError, setAddError] = useState('')
  // Удаление всего чек-листа необратимо, поэтому спрашивается прямо в меню.
  const [confirmClear, setConfirmClear] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  // Меню закрывается по клику мимо: иначе оно остаётся висеть поверх переписки.
  useEffect(() => {
    if (!menuOpen) { setConfirmClear(false); return }
    const onDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

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

  const addFromTemplate = useMutation({
    mutationFn: (templateId: number) => window.api.tickets.applyChecklistTemplate(ticketId, templateId),
    onSuccess: () => {
      setMenuOpen(false)
      queryClient.invalidateQueries({ queryKey: ['ticket-checklist', ticketId] })
    },
    onError: (err: unknown) => setAddError(err instanceof Error ? err.message : 'Не удалось добавить чек-лист')
  })

  const addOwnItem = useMutation({
    mutationFn: () => window.api.tickets.addChecklistItems(ticketId, [{
      name: newName,
      category: newCategory,
      description: newDescription
    }]),
    onSuccess: () => {
      setNewName('')
      setNewDescription('')
      setFormOpen(false)
      setAddError('')
      queryClient.invalidateQueries({ queryKey: ['ticket-checklist', ticketId] })
    },
    onError: (err: unknown) => setAddError(err instanceof Error ? err.message : 'Не удалось добавить пункт')
  })

  const wholeChecklist = useMutation({
    mutationFn: (action: 'check' | 'uncheck' | 'clear') =>
      window.api.tickets.updateWholeChecklist(ticketId, action),
    onSuccess: () => {
      setMenuOpen(false)
      setConfirmClear(false)
      queryClient.invalidateQueries({ queryKey: ['ticket-checklist', ticketId] })
    },
    onError: (err: unknown) => {
      setConfirmClear(false)
      setAddError(err instanceof Error ? err.message : 'Не удалось изменить чек-лист')
    }
  })

  const removeItem = useMutation({
    mutationFn: (itemId: number) => window.api.tickets.deleteChecklistItem(itemId),
    onMutate: (itemId: number) => setBusyItemId(itemId),
    onSettled: () => {
      setBusyItemId(null)
      queryClient.invalidateQueries({ queryKey: ['ticket-checklist', ticketId] })
    }
  })

  const groups = data?.groups ?? []
  const items = groups.flatMap(group => group.items)
  const done = items.filter(item => item.checked).length
  const templates = data?.templates ?? []
  // Разделы уже существующих пунктов — чаще всего новый пункт кладут в один из них.
  const knownCategories = [...new Set(groups.map(group => group.category).filter(Boolean))]

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

        <div className="flex items-center gap-2.5">
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

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => { setMenuOpen(value => !value); setAddError('') }}
              className="flex select-none items-center gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              {addFromTemplate.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                : <Plus className="h-3.5 w-3.5 text-primary" />}
              Добавить
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.14, ease: 'easeOut' }}
                  className="absolute right-0 top-full z-30 mt-1.5 w-64 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl"
                >
                  {templates.length > 0 && (
                    <>
                      <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Из шаблона
                      </p>
                      {templates.map(template => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => addFromTemplate.mutate(template.id)}
                          disabled={addFromTemplate.isPending}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                        >
                          <ListChecks className="h-3.5 w-3.5 shrink-0 text-primary" />
                          <span className="truncate">{template.name}</span>
                        </button>
                      ))}
                      <div className="my-1 h-px bg-border" />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => { setFormOpen(true); setMenuOpen(false); setIsOpen(true) }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                    Свой пункт
                  </button>

                  {items.length > 0 && (
                    <>
                      <div className="my-1 h-px bg-border" />
                      <button
                        type="button"
                        onClick={() => wholeChecklist.mutate(done === items.length ? 'uncheck' : 'check')}
                        disabled={wholeChecklist.isPending}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                      >
                        <CheckCheck className="h-3.5 w-3.5 shrink-0 text-primary" />
                        {done === items.length ? 'Снять все отметки' : 'Отметить всё'}
                      </button>

                      <button
                        type="button"
                        onClick={() => confirmClear ? wholeChecklist.mutate('clear') : setConfirmClear(true)}
                        disabled={wholeChecklist.isPending}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors disabled:opacity-60',
                          confirmClear
                            ? 'bg-destructive/10 text-destructive hover:bg-destructive/15'
                            : 'text-foreground hover:bg-accent'
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0 text-destructive" />
                        {confirmClear
                          ? `Точно удалить ${items.length}?`
                          : 'Удалить чек-лист целиком'}
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {addError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {addError}
        </p>
      )}

      <AnimatePresence initial={false}>
        {formOpen && (
          <motion.form
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            onSubmit={event => { event.preventDefault(); addOwnItem.mutate() }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/15 p-3">
              <input
                autoFocus
                value={newName}
                onChange={event => setNewName(event.target.value)}
                placeholder="Что нужно сделать"
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
              <input
                value={newCategory}
                onChange={event => setNewCategory(event.target.value)}
                placeholder="Раздел (необязательно)"
                list="checklist-categories"
                className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
              {/* Разделы существующих пунктов подсказываются, чтобы не плодить
                  почти одинаковые названия: clients группирует их дословно. */}
              <datalist id="checklist-categories">
                {knownCategories.map(category => <option key={category} value={category} />)}
              </datalist>
              <textarea
                value={newDescription}
                onChange={event => setNewDescription(event.target.value)}
                placeholder="Описание (необязательно)"
                rows={2}
                className="resize-y rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs leading-5 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setFormOpen(false); setAddError('') }}
                  className="select-none rounded-lg px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || addOwnItem.isPending}
                  className="flex select-none items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {addOwnItem.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                  Добавить
                </button>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Загружаем чек-лист…
        </div>
      )}

      {/* Пустой чек-лист — обычное дело, поэтому карточка остаётся тонкой
          строкой: она нужна только чтобы было куда нажать «Добавить». */}
      {!isLoading && !error && items.length === 0 && !formOpen && (
        <p className="text-xs text-muted-foreground">
          Пунктов пока нет — добавьте из шаблона или свой.
        </p>
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
                    <div
                      key={item.id}
                      className="group/item relative flex items-start gap-2.5 rounded-lg border border-border/50 bg-muted/15 px-3 py-2 transition-colors hover:bg-muted/35"
                    >
                    <button
                      type="button"
                      onClick={() => toggle.mutate(item)}
                      disabled={busyItemId === item.id}
                      className="flex min-w-0 flex-1 items-start gap-2.5 text-left outline-none disabled:opacity-60"
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

                    {/* Проступает при наведении: удаление — не то действие,
                        которое должно быть под рукой постоянно. */}
                    <button
                      type="button"
                      onClick={() => removeItem.mutate(item.id)}
                      disabled={busyItemId === item.id}
                      title="Удалить пункт"
                      className="mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-destructive focus-visible:opacity-100 group-hover/item:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                    </div>
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
