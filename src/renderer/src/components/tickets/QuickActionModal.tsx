import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { Clock, Loader2, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomSelect, CustomMultiSelect, CustomDateTimePicker, CustomToggle } from '@/components/ui/custom-controls'
import { useTicketFilters } from '@/hooks/useTickets'
import { useOutboxStore } from '@/store/outbox'
import {
  dateTimeLocalFromRaw,
  isPendingOrClosedState,
  isReasonRequiredState,
  toHtmlComment,
  tomorrowAtEleven
} from '@/lib/ticketFormat'
import { useUIStore } from '@/store/ui'
import { getStateBadgeClass } from '@/types/ticket'
import { cn } from '@/lib/utils'

const TIME_PRESETS = [0, 5, 10, 20, 30, 60]

/**
 * Быстрое действие по заявке из списка: отложить, сменить статус, указать
 * причину и при необходимости написать комментарий - не открывая саму заявку.
 *
 * Поля те же и выглядят так же, как в самой заявке, и заполнены её текущими
 * значениями: иначе непонятно, что меняешь, а пустая причина затёрла бы
 * выставленную.
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
  const allowStatusWithoutComment = useUIStore(s => s.allowTicketStatusWithoutPublicComment)
  const allowPendingWithoutReason = useUIStore(s => s.allowTicketPendingWithoutReason)
  const send = useOutboxStore(store => store.send)

  // Тот же ключ, что и у страницы заявки: если она открыта, данные возьмутся из
  // кэша мгновенно.
  const { data: detailsData, isLoading } = useQuery<{ ticket: any }>({
    queryKey: ['ticket-details', ticketId],
    queryFn: () => window.api.tickets.getDetails(ticketId),
    staleTime: 15_000
  })
  const ticket = detailsData?.ticket

  const [timeUnit, setTimeUnit] = useState('')
  const [stateId, setStateId] = useState<number | null>(null)
  const [pendingTime, setPendingTime] = useState('')
  const [reasonIds, setReasonIds] = useState<string[]>([])
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [error, setError] = useState('')
  /** Дата, с которой окно открылось: по ней видно, переносил ли срок пользователь. */
  const [initialPendingTime, setInitialPendingTime] = useState('')

  useEffect(() => {
    if (!ticket) return
    setStateId(ticket.state?.id ?? null)
    setReasonIds((ticket.iikoReasons ?? []).map((reason: { id: string }) => reason.id))
    // Прошлое время ожидания подставлять бессмысленно: сюда заходят, чтобы
    // отложить заново. Оставляем дату заявки, только если она ещё впереди.
    const current = ticket.pendingTime ? new Date(ticket.pendingTime) : null
    const stillAhead = current && !Number.isNaN(current.getTime()) && current.getTime() > Date.now()
    const initial = stillAhead ? dateTimeLocalFromRaw(ticket.pendingTime) : tomorrowAtEleven()
    setPendingTime(initial)
    setInitialPendingTime(initial)
  }, [ticket?.id])

  const stateOptions = [
    ...(ticket?.state ? [ticket.state] : []),
    ...(filtersData?.states ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => Number(other.id) === Number(item.id)) === index)

  const reasonOptions = [
    ...((ticket?.iikoReasons ?? []) as { id: string; name: string }[]),
    ...(filtersData?.iikoReasons ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => String(other.id) === String(item.id)) === index)

  const stateBadge = (state: { id: number | string; name: string }) => (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        !filtersData?.stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
      )}
      style={filtersData?.stateColors?.[Number(state.id)] ? {
        backgroundColor: `${filtersData.stateColors[Number(state.id)]}15`,
        color: filtersData.stateColors[Number(state.id)],
        borderColor: `${filtersData.stateColors[Number(state.id)]}30`
      } : undefined}
    >
      <span className="truncate">{state.name}</span>
    </span>
  )

  const submit = () => {
    const minutes = Number(timeUnit || 0)
    const hasComment = body.trim().length > 0
    const selectedState = stateOptions.find(state => Number(state.id) === stateId)

    if (!ticket) return
    const stateChanged = stateId !== null && stateId !== ticket.state?.id
    const reasonsChanged = reasonIds.join(',') !== (ticket.iikoReasons ?? []).map((r: { id: string }) => r.id).join(',')
    // Перенос срока - тоже изменение: без этого смена одной даты считалась
    // «нечего применять» и молча ничего не делала.
    const pendingChanged = pendingTime !== initialPendingTime

    // Те же требования, что и в самой заявке, и так же отключаются скрытыми
    // настройками: закрывать без причины и переводить без комментария нельзя,
    // пока это не разрешено явно.
    const stateName = stateOptions.find(state => Number(state.id) === stateId)?.name
    if (isReasonRequiredState(stateName) && !allowPendingWithoutReason && reasonIds.length === 0) {
      setError('Необходимо выбрать причину обращения, чтобы закрыть заявку')
      return
    }
    if (stateChanged && isPendingOrClosedState(stateName) && !allowStatusWithoutComment && !hasComment) {
      setError('Необходимо написать комментарий для изменения состояния заявки')
      return
    }

    if (!stateChanged && !reasonsChanged && !pendingChanged && !hasComment && !minutes) {
      setError('Нечего применять: укажите время, состояние, причину или комментарий')
      return
    }

    send({
      ticketId,
      body: hasComment ? toHtmlComment(body) : '',
      internal,
      articleType: 'note',
      stateId: stateId ?? undefined,
      // Причины отправляются только если их меняли: пустой список стёр бы уже
      // выставленные.
      iikoReasonIds: reasonsChanged ? reasonIds : undefined,
      pendingTime: pendingTime ? new Date(pendingTime).toISOString() : null,
      timeUnit: minutes > 0 ? minutes : null,
      attachments: [],
      includeArticle: hasComment,
      draftBody: body,
      nextState: selectedState && stateChanged
        ? { id: Number(selectedState.id), name: selectedState.name }
        : null,
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
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
        onKeyDown={event => {
          if (event.key === 'Escape') onClose()
          if (event.key === 'Enter' && event.ctrlKey) submit()
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
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

        {isLoading && !ticket ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Загружаем заявку…
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Добавить минут
              </span>
              {/* Тот же ввод, что в окне отправки заявки: минус, поле, плюс. */}
              <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/20 text-sm font-semibold hover:bg-muted/45"
                  onClick={() => setTimeUnit(String(Math.max(0, Number(timeUnit || 0) - 5)))}
                >
                  -
                </button>
                {/* label, а не div: тогда попадание в любую точку строки ставит
                    курсор в поле, а не только по узкому вводу посередине. */}
                <label className="flex h-10 cursor-text items-center justify-center gap-1 rounded-md border border-border bg-muted/30 text-sm font-semibold tabular-nums text-foreground focus-within:border-primary/60">
                  <input
                    value={timeUnit}
                    onChange={event => setTimeUnit(event.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                    autoFocus
                    className="w-16 bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none"
                  />
                  <span>мин</span>
                </label>
                <button
                  type="button"
                  className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/20 text-sm font-semibold hover:bg-muted/45"
                  onClick={() => setTimeUnit(String(Number(timeUnit || 0) + 5))}
                >
                  +
                </button>
              </div>
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

            <div className="mt-4 grid gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground">Состояние</span>
                <CustomSelect
                  value={stateId}
                  options={stateOptions}
                  onChange={state => setStateId(Number(state.id))}
                  placeholder={ticket?.state?.name || 'Выберите состояние'}
                  renderValue={state => state ? stateBadge(state) : <span className="text-muted-foreground">Выберите состояние</span>}
                  renderOption={state => stateBadge(state)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground">В ожидании до</span>
                <CustomDateTimePicker value={pendingTime} onChange={setPendingTime} />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground">Причина обращения (ИКО)</span>
                <CustomMultiSelect
                  values={reasonIds}
                  options={reasonOptions}
                  onChange={reasons => setReasonIds(reasons.map(reason => String(reason.id)))}
                  placeholder="Выберите причину"
                  renderChip={reason => <span className="truncate text-sky-700 dark:text-sky-300">{reason.name}</span>}
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Комментарий</span>
                  <CustomToggle checked={internal} onChange={setInternal} label="Приватно" />
                </div>
                <textarea
                  value={body}
                  onChange={event => setBody(event.target.value)}
                  placeholder="Напишите комментарий..."
                  rows={3}
                  className="w-full resize-y rounded-lg border border-border bg-muted/25 px-3 py-2 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
                />
              </div>
            </div>

            {error && (
              <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
              <Button size="sm" onClick={submit} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Применить
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
