import { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomSelect, CustomMultiSelect, CustomDateTimePicker, CustomToggle } from '@/components/ui/custom-controls'
import { useTicketFilters } from '@/hooks/useTickets'
import { useOutboxStore } from '@/store/outbox'
import { isPendingOrClosedState, toHtmlComment, tomorrowAtEleven } from '@/lib/ticketFormat'
import { cn } from '@/lib/utils'

const TIME_PRESETS = [0, 5, 10, 20, 30, 60]

/**
 * Быстрое действие по заявке из списка: отложить, сменить статус, указать
 * причину и при необходимости написать комментарий — не открывая саму заявку.
 *
 * Отправка уходит в общую очередь, поэтому окно закрывается сразу: можно тут же
 * взяться за следующую заявку, а очередь доведёт каждую до конца сама.
 */
export function QuickActionModal({
  ticketId,
  ticketTitle,
  onClose
}: {
  ticketId: number
  ticketTitle: string
  onClose: () => void
}) {
  const { data: filtersData } = useTicketFilters()
  const send = useOutboxStore(store => store.send)

  const [timeUnit, setTimeUnit] = useState('')
  const [stateId, setStateId] = useState<number | null>(null)
  const [pendingTime, setPendingTime] = useState('')
  const [reasonIds, setReasonIds] = useState<string[]>([])
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [error, setError] = useState('')

  const states = filtersData?.states ?? []
  const reasons = filtersData?.iikoReasons ?? []
  const selectedState = states.find(state => Number(state.id) === stateId)
  // «Отложено до» имеет смысл только для отложенных и закрываемых состояний.
  const needsPendingTime = isPendingOrClosedState(selectedState?.name)

  const pickState = (id: number) => {
    setStateId(id)
    const name = states.find(state => Number(state.id) === id)?.name
    // Раз уж откладываем — сразу предлагаем завтра на 11:00, как и в заявке.
    if (isPendingOrClosedState(name) && !pendingTime) setPendingTime(tomorrowAtEleven())
  }

  const submit = () => {
    const minutes = Number(timeUnit || 0)
    const hasComment = body.trim().length > 0
    if (!stateId && !hasComment && !minutes && reasonIds.length === 0) {
      setError('Нечего применять: укажите время, статус, причину или комментарий')
      return
    }

    send({
      ticketId,
      body: hasComment ? toHtmlComment(body) : '',
      internal,
      articleType: 'note',
      stateId: stateId ?? undefined,
      // Причины и время передаются, только когда заданы: пустой список стёр бы
      // уже выставленные причины, а нулевое время ничего не значит.
      iikoReasonIds: reasonIds.length > 0 ? reasonIds : undefined,
      pendingTime: needsPendingTime && pendingTime ? new Date(pendingTime).toISOString() : null,
      timeUnit: minutes > 0 ? minutes : null,
      attachments: [],
      includeArticle: hasComment,
      draftBody: body,
      nextState: selectedState ? { id: Number(selectedState.id), name: selectedState.name } : null,
      ticketTitle
    })
    onClose()
  }

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={event => event.target === event.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onKeyDown={event => {
          if (event.key === 'Escape') onClose()
          // Ctrl+Enter — привычная отправка, не отрывая рук от клавиатуры.
          if (event.key === 'Enter' && event.ctrlKey) submit()
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Быстрое действие
            </h3>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{ticketTitle}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Затраченное время
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TIME_PRESETS.map(minutes => (
              <button
                key={minutes}
                type="button"
                onClick={() => setTimeUnit(minutes === 0 ? '' : String(minutes))}
                className={cn(
                  'rounded-md border px-2 py-1 text-xs transition-colors',
                  Number(timeUnit || 0) === minutes
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/45 hover:text-foreground'
                )}
              >
                {minutes === 0 ? 'Без времени' : `${minutes} мин`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Состояние
          </label>
          <CustomSelect
            value={stateId}
            options={states}
            onChange={state => pickState(Number(state.id))}
            placeholder="Не менять"
          />
        </div>

        {needsPendingTime && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              В ожидании до
            </label>
            <CustomDateTimePicker value={pendingTime} onChange={setPendingTime} />
          </div>
        )}

        {reasons.length > 0 && (
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Причина обращения
            </label>
            <CustomMultiSelect
              values={reasonIds}
              options={reasons}
              onChange={items => setReasonIds(items.map(item => String(item.id)))}
              placeholder="Не менять"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Комментарий
            </label>
            <CustomToggle checked={internal} onChange={setInternal} label="Приватно" />
          </div>
          <textarea
            value={body}
            onChange={event => setBody(event.target.value)}
            placeholder="Необязательно"
            rows={3}
            className="w-full resize-y rounded-lg border border-border bg-muted/25 px-3 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
          <Button size="sm" onClick={submit} className="gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Применить
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
