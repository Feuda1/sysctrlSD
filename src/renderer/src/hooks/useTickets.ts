import { useQuery } from '@tanstack/react-query'
import type { Ticket, TicketFiltersResponse, TicketListParams, TicketListResponse } from '@/types/ticket'

export function useTickets(params: TicketListParams, enabled = true) {
  return useQuery<TicketListResponse, Error>({
    queryKey: ['tickets', params.wrapperId, params.page, params.perPage, params.sortField, params.sortAsc, params.searchQuery, params.myTicketsStateId],
    queryFn: () => window.api.tickets.list(params),
    enabled: enabled && (params.wrapperId > 0 || (!!params.searchQuery && params.searchQuery.trim().length > 0) || params.myTicketsStateId !== undefined),
    staleTime: 15000,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    retry: 1,
    placeholderData: (prev) => prev
  })
}

export function useMyTicketsCounts() {
  return useQuery<{ tickets: Ticket[]; counts: Record<number, number> }, Error>({
    queryKey: ['tickets', 'my-counts'],
    queryFn: () => window.api.tickets.getMyTicketsCounts(),
    staleTime: 15000,
    refetchInterval: 15000,
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
