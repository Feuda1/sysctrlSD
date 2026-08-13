import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TicketFiltersResponse, TicketListParams, TicketListResponse } from '@/types/ticket'
import { backoffInterval } from '@/lib/pollInterval'
import { applyPendingStates, type MyCounts } from '@/lib/myCounts'
import { usePendingStatesStore } from '@/store/pendingStates'

/**
 * Как часто перечитываем списки и счётчики.
 *
 * Минута, а не пятнадцать секунд. Опрос по таймеру здесь - подстраховка, а не
 * основной способ узнать новость: главный процесс сам следит за изменениями и
 * шлёт `tickets:list-updated`, по которому эти запросы перечитываются сразу. А
 * стоит такой опрос дорого - за счётчиками стоит поиск на 250 заявок со всеми
 * связями, самый тяжёлый запрос приложения. Четыре таких в минуту с каждого
 * рабочего места складывались в постоянную нагрузку на поиск Zammad.
 *
 * Отступ при неудачах сохраняется: если сервер не отвечает, ждём ещё дольше.
 */
const listPoll = (query: { state: { fetchFailureCount: number } }) =>
  Math.max(60_000, backoffInterval(query.state.fetchFailureCount))

export function useTickets(params: TicketListParams, enabled = true) {
  return useQuery<TicketListResponse, Error>({
    queryKey: ['tickets', params.wrapperId, params.page, params.perPage, params.sortField, params.sortAsc, params.searchQuery, params.myTicketsStateId, params.createdFrom, params.createdTo, params.dateField],
    queryFn: () => window.api.tickets.list(params),
    enabled: enabled && (params.wrapperId > 0 || (!!params.searchQuery && params.searchQuery.trim().length > 0) || params.myTicketsStateId !== undefined),
    staleTime: 15000,
    refetchInterval: listPoll,
    refetchOnWindowFocus: true,
    // Повторять неудачу здесь незачем: следующий опрос и есть повтор, причём с
    // отступом. Повтор же бьёт сразу, а на 504 это значит послать серверу второй
    // такой же тяжёлый поиск ровно тогда, когда он с первым не справился.
    retry: false,
    placeholderData: (prev) => prev
  })
}

export function useMyTicketsCounts() {
  const overrides = usePendingStatesStore(s => s.overrides)
  // Наши переводы накладываются на каждый ответ, а не правят кэш один раз:
  // счётчики перечитываются раз в 15 секунд, и ответ из ещё не обновлённого
  // индекса возвращал заявку в прежний статус.
  const select = useCallback((data: MyCounts) => applyPendingStates(data, overrides)!, [overrides])

  return useQuery<MyCounts, Error, MyCounts>({
    queryKey: ['tickets', 'my-counts'],
    queryFn: () => window.api.tickets.getMyTicketsCounts(),
    select,
    staleTime: 15000,
    refetchInterval: listPoll,
    refetchOnWindowFocus: true,
    // Never garbage-collect: the state chips must stay populated even after long
    // visits inside a ticket. Combined with an always-mounted observer in the
    // dashboard shell, data is served from cache instantly and refreshed in the
    // background (it is not cleared on invalidation).
    gcTime: Infinity,
    // Как и у списка: повтор здесь - это ещё один поиск на 250 заявок сразу
    // вслед за не удавшимся. Ждём следующего опроса.
    retry: false,
    placeholderData: (prev) => prev
  })
}

export function useTicketFilters() {
  return useQuery<TicketFiltersResponse, Error>({
    queryKey: ['ticket-filters'],
    queryFn: () => window.api.tickets.getFilters(),
    staleTime: 300000,
    gcTime: Infinity,
    retry: 1,
    placeholderData: (prev) => prev
  })
}
