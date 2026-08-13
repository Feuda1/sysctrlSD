import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { GitMerge, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-controls'
import { getStateBadgeClass, getTicketTypeBadgeClass } from '@/types/ticket'
import { PriorityCircles } from '@/components/tickets/TicketBadges'
import type { Ticket } from '@/types/ticket'

/**
 * Creates a subtask of the ticket. Starts from the parent's own group, owner,
 * type and priority, and keeps the form and the request to itself.
 */
export function CreateSubTicketModal({
  parent,
  ticketTypeOptions,
  groupOptions,
  ownerOptions,
  priorityOptions,
  stateOptions,
  stateColors,
  onClose,
  onCreated
}: {
  parent: Ticket
  ticketTypeOptions: { id: string; name: string }[]
  groupOptions: { id: number; name: string }[]
  ownerOptions: { id: number; name: string }[]
  priorityOptions: { id: number; name: string }[]
  stateOptions: { id: number; name: string }[]
  stateColors?: Record<number, string>
  onClose: () => void
  onCreated: (newTicketId: number | null) => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [type, setType] = useState(parent.ticketType?.id || 'Incident')
  const [group, setGroup] = useState<number>(parent.group.id || 0)
  const [owner, setOwner] = useState<number>(parent.owner.id || 1)
  const [priority, setPriority] = useState<number>(parent.priority.id || 2)
  const [state, setState] = useState<number>(2)
  const [time, setTime] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setTitle('')
    setBody('')
    setType(parent.ticketType?.id || 'Incident')
    setGroup(parent.group.id || 0)
    setOwner(parent.owner.id || 1)
    setPriority(parent.priority.id || 2)
    setState(2)
    setTime(0)
    setError('')
  }, [parent.id])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !body.trim() || !type || !group) {
      setError('Пожалуйста, заполните обязательные поля')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await window.api.tickets.createSubTicket({
        parentTicketId: parent.id,
        title,
        body,
        groupId: group,
        ownerId: owner,
        type,
        priorityId: priority,
        stateId: state,
        timeUnit: time
      })
      if (res.ok && res.newTicketId) {
        onCreated(res.newTicketId)
        onClose()
      } else {
        // The subtask may still have been created - refresh so the list shows it
        // instead of leaving the modal hanging without a hint.
        onCreated(null)
        setError('Не удалось определить номер созданной подзадачи. Обновите заявку и проверьте список вложенных заявок.')
      }
    } catch (err: any) {
      setError(err?.message || 'Ошибка создания подзадачи')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 max-h-[90vh]"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <GitMerge className="h-[18px] w-[18px] text-primary" />
            Создание подзадачи
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onClose()}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground">Тема подзадачи</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Введите заголовок подзадачи..."
              className="h-9 w-full rounded-md border border-border bg-muted/25 px-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition-colors"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground">Описание</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Подробное описание задачи..."
              className="min-h-24 w-full resize-y rounded-md border border-border bg-muted/25 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Тип</label>
              <CustomSelect
                value={type}
                options={ticketTypeOptions}
                onChange={(type) => setType(String(type.id))}
                placeholder="Выберите тип"
                renderValue={type => type ? (
                  <span className={cn("inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium", getTicketTypeBadgeClass(String(type.id), type.name))}>
                    <span className="truncate">{type.name}</span>
                  </span>
                ) : <span className="text-muted-foreground">Выберите тип</span>}
                renderOption={type => (
                  <span className={cn("inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium", getTicketTypeBadgeClass(String(type.id), type.name))}>
                    <span className="truncate">{type.name}</span>
                  </span>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Группа</label>
              <CustomSelect
                value={group || null}
                options={groupOptions}
                onChange={(group) => setGroup(Number(group.id))}
                placeholder="Выберите группу"
                searchable
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Ответственный</label>
              <CustomSelect
                value={owner || null}
                options={ownerOptions}
                onChange={(owner) => setOwner(Number(owner.id))}
                placeholder="Не назначен"
                searchable
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Приоритет</label>
              <CustomSelect
                value={priority}
                options={priorityOptions}
                onChange={(priority) => setPriority(Number(priority.id))}
                placeholder="Выберите приоритет"
                renderValue={priority => priority ? (
                  <span className="flex items-center gap-2">
                    <PriorityCircles name={priority.name} />
                    <span className="truncate">{priority.name}</span>
                  </span>
                ) : <span className="text-muted-foreground">Выберите приоритет</span>}
                renderOption={priority => (
                  <span className="flex items-center gap-2">
                    <PriorityCircles name={priority.name} />
                    <span className="truncate">{priority.name}</span>
                  </span>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Состояние</label>
              <CustomSelect
                value={state}
                options={stateOptions}
                onChange={(state) => setState(Number(state.id))}
                placeholder="Выберите состояние"
                renderValue={state => state ? (
                  <span
                    className={cn(
                      "inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      !stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                    )}
                    style={stateColors?.[Number(state.id)] ? {
                      backgroundColor: `${stateColors[Number(state.id)]}15`,
                      color: stateColors[Number(state.id)],
                      borderColor: `${stateColors[Number(state.id)]}30`
                    } : undefined}
                  >
                    <span className="truncate">{state.name}</span>
                  </span>
                ) : <span className="text-muted-foreground">Выберите состояние</span>}
                renderOption={state => (
                  <span
                    className={cn(
                      "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      !stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                    )}
                    style={stateColors?.[Number(state.id)] ? {
                      backgroundColor: `${stateColors[Number(state.id)]}15`,
                      color: stateColors[Number(state.id)],
                      borderColor: `${stateColors[Number(state.id)]}30`
                    } : undefined}
                  >
                    <span className="truncate">{state.name}</span>
                  </span>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Затраченное время (минуты)</label>
              <div className="flex h-9 items-center rounded-md border border-border bg-muted/25 px-3 focus-within:border-primary/60 transition-colors">
                <input
                  type="number"
                  min={0}
                  value={time || ''}
                  onChange={(e) => setTime(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-transparent text-xs text-foreground outline-none font-mono"
                />
                <span className="text-[10px] text-muted-foreground ml-2 shrink-0">мин</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 border-t border-border pt-3">
            <Button variant="outline" size="sm" type="button" onClick={() => onClose()} disabled={loading}>
              Отмена
            </Button>
            <Button size="sm" type="submit" disabled={loading}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Создать подзадачу
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
