import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TicketFiltersResponse, TicketListParams, TicketListResponse } from '@/types/ticket'
import { backoffInterval } from '@/lib/pollInterval'
import { applyPendingStates, type MyCounts } from '@/lib/myCounts'
import { usePendingStatesStore } from '@/store/pendingStates'

// Списки обновляются реже одной заявки, но так же отступают, когда сервер
// перестал отвечать: иначе каждая вкладка продолжает стучаться раз в 15 секунд
// в сервер, который и так не справляется.
const listPoll = (query: { state: { fetchFailureCount: number } }) =>
  Math.max(15_000, backoffInterval(query.state.fetchFailureCount))

export function useTickets(params: TicketListParams, enabled = true) {
  return useQuery<TicketListResponse, Error>({
    queryKey: ['tickets', params.wrapperId, params.page, params.perPage, params.sortField, params.sortAsc, params.searchQuery, params.myTicketsStateId, params.createdFrom, params.createdTo, params.dateField],
    queryFn: () => window.api.tickets.list(params),
    enabled: enabled && (params.wrapperId > 0 || (!!params.searchQuery && params.searchQuery.trim().length > 0) || params.myTicketsStateId !== undefined),
    staleTime: 15000,
    refetchInterval: listPoll,
    refetchOnWindowFocus: true,
    retry: 1,
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
    retry: 1,
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
