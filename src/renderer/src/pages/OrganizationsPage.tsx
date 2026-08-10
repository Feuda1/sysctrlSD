import { useState, useEffect } from 'react'
import { ErrorNotice } from '@/components/ui/error-notice'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Building, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OrgDetailsPanel } from '@/components/organizations/OrgDetailsPanel'

interface Organization {
  id: number
  name: string
  active: boolean
  vip: boolean
  responsible_group: string | null
  manager: string | null
  sum_debt: number
  deposit_balance_minutes: number | null
  contracts: string | null
  contracts_and_comments: string | null
  note: string | null
  link_wiki: string | null
  keepass: string | null
}

export default function OrganizationsPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const perPage = 50

  const { data: orgs = [], isLoading, isFetching, isError, error, refetch } = useQuery<Organization[]>({
    queryKey: ['organizations', query, page],
    queryFn: () => window.api.organizations.list({ query: query || '*', page, perPage }),
    staleTime: 30_000,
    placeholderData: (prev) => prev
  })

  useEffect(() => {
    setPage(1)
  }, [query])

  const handleOrgClick = (org: Organization) => {
    setSelectedOrg(selectedOrg?.id === org.id ? null : org)
  }

  const formatCurrency = (value: number) => {
    if (!value) return '0 ₽'
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value)
  }

  const formatMinutes = (value: number | null) => {
    if (value === null || value === undefined) return '—'
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value)
  }

  return (
    <div className="flex h-full gap-4 overflow-hidden relative">
      <div className="flex-1 flex flex-col gap-3 min-h-0 bg-background">
        <div className="flex items-center justify-between shrink-0">
          <div className="relative w-60">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Поиск организации..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-input pl-9 pr-3 py-2 text-sm focus:border-primary/60 outline-none"
            />
          </div>
        </div>

        {isError && (
          <ErrorNotice
            error={error}
            fallback="Ошибка загрузки организаций"
            onRetry={() => void refetch()}
            isRetrying={isFetching}
          />
        )}

        <div className="relative flex-1 min-h-0 overflow-hidden rounded-xl border border-border">
          {isFetching && orgs.length > 0 && (
            <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-primary/10">
              <motion.div
                className="h-full w-1/3 bg-primary"
                animate={{ x: ['-100%', '300%'] }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>
          )}
          <div className="h-full overflow-auto">
          <table className="w-full table-fixed text-left border-collapse">
            <colgroup>
              <col />
              <col style={{ width: 150 }} />
              <col style={{ width: 130 }} />
              <col style={{ width: 110 }} />
              <col style={{ width: 90 }} />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
              <tr>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Название</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Группа</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Менеджер</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Долг</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground">Депозит</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {isLoading && orgs.length === 0 ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/30">
                    <td className="px-4 py-3"><div className="h-4 w-2/3 rounded bg-muted/60 animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-muted/60 animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-muted/60 animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-muted/60 animate-pulse" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-12 rounded bg-muted/60 animate-pulse" /></td>
                  </tr>
                ))
              ) : orgs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-muted-foreground">
                    <Building className="h-8 w-8 mx-auto opacity-35 mb-2" />
                    <p className="text-sm">Организации не найдены</p>
                  </td>
                </tr>
              ) : (
                orgs.map((org) => {
                  const isSelected = selectedOrg?.id === org.id
                  return (
                    <tr
                      key={org.id}
                      onClick={() => handleOrgClick(org)}
                      className={cn(
                        'cursor-pointer transition-colors duration-75 text-sm',
                        isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-accent/30'
                      )}
                    >
                      <td className="px-4 py-2.5 font-medium truncate" title={org.name}>
                        {org.name}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate" title={org.responsible_group || ''}>
                        {org.responsible_group || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground truncate" title={org.manager || ''}>
                        {org.manager || '—'}
                      </td>
                      <td className={cn('px-4 py-2.5 font-medium tabular-nums', org.sum_debt > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                        {formatCurrency(org.sum_debt)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                        {formatMinutes(org.deposit_balance_minutes)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          </div>
        </div>

        {!isLoading && orgs.length > 0 && (
          <div className="flex items-center justify-between shrink-0 px-1 mt-1">
            <span className="text-xs text-muted-foreground">Страница {page}</span>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="h-8 gap-1 px-2.5 text-xs">
                <ChevronLeft className="h-3.5 w-3.5" />
                Пред
              </Button>
              <Button variant="ghost" size="sm" disabled={orgs.length < perPage} onClick={() => setPage(page + 1)} className="h-8 gap-1 px-2.5 text-xs">
                След
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedOrg && (
          <OrgDetailsPanel
            org={selectedOrg}
            onClose={() => setSelectedOrg(null)}
            onOpenTicket={(id) => navigate(`/dashboard/tickets/${id}`)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
