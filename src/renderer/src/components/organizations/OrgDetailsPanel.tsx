import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Building, X, Search, User, Mail, Phone, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTicketFilters } from '@/hooks/useTickets'
import { getStateBadgeClass, formatTicketDate, type Ticket } from '@/types/ticket'

interface Member {
  id: number
  firstname: string
  lastname: string
  email: string | null
  phone: string | null
  mobile: string | null
  department: string | null
  max: string | null
  telegram: string | null
}

export interface OrgInfo {
  id: number
  name: string
  responsible_group?: string | null
  manager?: string | null
  sum_debt?: number
  deposit_balance_minutes?: number | null
  note?: string | null
  contracts?: string | null
  contracts_and_comments?: string | null
  link_wiki?: string | null
}

/**
 * The rich organization panel (info / employees / tickets with filters) shared
 * between the ticket details view and the Organizations page. Renders as a
 * slide-in overlay inside the nearest `relative` parent.
 */
export function OrgDetailsPanel({
  org,
  onClose,
  onOpenTicket
}: {
  org: OrgInfo
  onClose: () => void
  onOpenTicket: (ticketId: number) => void
}) {
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'tickets'>('info')
  const [search, setSearch] = useState('')
  const [owner, setOwner] = useState('all')
  const [state, setState] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [ownerDropdownOpen, setOwnerDropdownOpen] = useState(false)
  const [ownerSearch, setOwnerSearch] = useState('')

  const { data: filtersData } = useTicketFilters()

  const { data: orgTickets = [], isLoading: orgTicketsLoading } = useQuery<Ticket[]>({
    queryKey: ['org-tickets', org.id],
    queryFn: () => window.api.organizations.getTickets(org.id),
    staleTime: 30_000
  })

  const { data: orgMembers = [], isLoading: orgMembersLoading } = useQuery<Member[]>({
    queryKey: ['org-members', org.id],
    queryFn: () => window.api.organizations.getMembers(org.id),
    staleTime: 60_000
  })

  useEffect(() => {
    setSearch(''); setOwner('all'); setState('all'); setDateFilter('all'); setOwnerDropdownOpen(false); setOwnerSearch('')
  }, [org.id, activeTab])

  const uniqueStates = Array.from(new Set(orgTickets.map(t => t.state.name).filter((n): n is string => !!n)))
  const ticketOwners = orgTickets.map(t => t.owner.name).filter((n): n is string => !!n)
  const filterAgents = (filtersData?.agents ?? []).map(a => String(a.name))
  const allAvailableOwners = Array.from(new Set([...ticketOwners, ...filterAgents]))
    .filter(name => { const n = name.trim(); return n && /[a-zA-Zа-яА-Я0-9]/.test(n) })
    .sort((a, b) => a.localeCompare(b, 'ru'))

  const filteredOrgTickets = orgTickets.filter(t => {
    const query = search.toLowerCase().trim()
    if (query) {
      const matchTitle = t.title.toLowerCase().includes(query)
      const matchNum = String(t.clientNumber || t.id).toLowerCase().includes(query)
      const matchZammadNum = String(t.number || '').toLowerCase().includes(query)
      if (!matchTitle && !matchNum && !matchZammadNum) return false
    }
    if (owner !== 'all' && t.owner.name !== owner) return false
    if (state !== 'all' && t.state.name !== state) return false
    if (dateFilter !== 'all') {
      const createdDate = new Date(t.createdAt)
      const now = new Date()
      if (dateFilter === 'today') {
        if (createdDate < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return false
      } else if (dateFilter === 'week') {
        if (createdDate < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return false
      } else if (dateFilter === 'month') {
        if (createdDate < new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())) return false
      } else if (dateFilter === 'year') {
        if (createdDate < new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())) return false
      }
    }
    return true
  })

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value || 0)

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="absolute right-0 top-0 bottom-0 z-30 w-[450px] max-w-full border-l border-border bg-card flex flex-col shadow-2xl"
      >
        <div className="p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2 truncate">
            <Building className="h-5 w-5 text-primary shrink-0" />
            <h3 className="font-semibold text-sm truncate select-text" title={org.name}>{org.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-border px-4 shrink-0 bg-muted/20">
          {(['info', 'members', 'tickets'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors duration-150',
                activeTab === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'info' && 'Информация'}
              {tab === 'members' && (orgMembersLoading ? 'Сотрудники' : `Сотрудники (${orgMembers.length})`)}
              {tab === 'tickets' && (orgTicketsLoading ? 'Заявки' : `Заявки (${orgTickets.length})`)}
            </button>
          ))}
        </div>

        <div className="p-5 flex-1 overflow-y-auto min-h-0 space-y-5 select-text">
          {activeTab === 'info' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Группа обслуживания</span>
                  <span className="font-medium text-foreground">{org.responsible_group || '—'}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Менеджер</span>
                  <span className="font-medium text-foreground">{org.manager || '—'}</span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Задолженность</span>
                  <span className={cn('font-semibold', (org.sum_debt ?? 0) > 0 ? 'text-destructive' : 'text-green-500')}>
                    {formatCurrency(org.sum_debt ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Остаток на депозите (мин)</span>
                  <span className="font-medium text-foreground tabular-nums">
                    {org.deposit_balance_minutes !== null && org.deposit_balance_minutes !== undefined
                      ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(org.deposit_balance_minutes)
                      : '—'}
                  </span>
                </div>
                {org.link_wiki && (
                  <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                    <span className="text-muted-foreground">Wiki</span>
                    <a href={org.link_wiki} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline flex items-center gap-1">
                      Открыть <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {org.note && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-muted-foreground">Заметки</h4>
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed whitespace-pre-wrap">{org.note}</div>
                </div>
              )}

              {(org.contracts || org.contracts_and_comments) && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-muted-foreground">Договоры и комментарии</h4>
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {[org.contracts, org.contracts_and_comments].filter(Boolean).join('\n\n')}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-3">
              {orgMembersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-3 animate-pulse">
                    <div className="h-3 w-2/3 bg-muted/80 rounded mb-2" />
                    <div className="h-2 w-1/2 bg-muted/80 rounded" />
                  </div>
                ))
              ) : orgMembers.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">Нет зарегистрированных сотрудников</div>
              ) : (
                orgMembers.map((member) => (
                  <div key={member.id} className="rounded-xl border border-border/30 bg-muted/10 p-3 space-y-1.5 hover:border-border transition-colors duration-100">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <User className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                      <span>{member.firstname} {member.lastname}</span>
                    </div>
                    {member.email && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Mail className="h-3 w-3 shrink-0" /><span className="truncate select-all">{member.email}</span>
                      </div>
                    )}
                    {(member.phone || member.mobile) && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" /><span className="truncate select-all">{member.phone || member.mobile}</span>
                      </div>
                    )}
                    {member.department && <div className="text-[11px] text-muted-foreground">Отдел: <span className="select-all text-foreground/80">{member.department}</span></div>}
                    {member.max && <div className="text-[11px] text-muted-foreground">MAX: <span className="select-all text-foreground/80">{member.max}</span></div>}
                    {member.telegram && <div className="text-[11px] text-muted-foreground">Telegram: <span className="select-all text-foreground/80">{member.telegram}</span></div>}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="space-y-3">
              {!orgTicketsLoading && orgTickets.length > 0 && (
                <div className="space-y-2 pb-2 border-b border-border/30">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Поиск по теме или номеру..."
                      className="h-8 w-full rounded-md border border-border bg-muted/30 pl-8 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <div className="relative flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => setOwnerDropdownOpen(!ownerDropdownOpen)}
                        className="w-full text-left rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/60 truncate min-h-[26px]"
                      >
                        {owner === 'all' ? 'Все ответственные' : owner}
                      </button>
                      {ownerDropdownOpen && (
                        <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-2xl flex flex-col gap-1">
                          <input
                            type="text"
                            value={ownerSearch}
                            onChange={e => setOwnerSearch(e.target.value)}
                            placeholder="Поиск ответственного..."
                            className="w-full rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
                            onClick={e => e.stopPropagation()}
                          />
                          <div className="overflow-y-auto max-h-36 flex flex-col gap-0.5 pr-0.5">
                            <button
                              type="button"
                              onClick={() => { setOwner('all'); setOwnerDropdownOpen(false); setOwnerSearch('') }}
                              className={cn("w-full text-left px-1.5 py-1 text-[10px] rounded hover:bg-accent transition-colors flex items-center min-w-0", owner === 'all' && "bg-primary/10 text-primary font-semibold")}
                            >
                              <span className="truncate w-full">Все ответственные</span>
                            </button>
                            {allAvailableOwners
                              .filter(name => name.toLowerCase().includes(ownerSearch.toLowerCase().trim()))
                              .map(name => (
                                <button
                                  key={name}
                                  type="button"
                                  onClick={() => { setOwner(name); setOwnerDropdownOpen(false); setOwnerSearch('') }}
                                  className={cn("w-full text-left px-1.5 py-1 text-[10px] rounded hover:bg-accent transition-colors flex items-center min-w-0", owner === name && "bg-primary/10 text-primary font-semibold")}
                                >
                                  <span className="truncate w-full">{name}</span>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <select value={state} onChange={(e) => setState(e.target.value)} className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/60 min-h-[26px]">
                      <option value="all" className="bg-card">Все состояния</option>
                      {uniqueStates.map((s) => <option key={s} value={s} className="bg-card">{s}</option>)}
                    </select>
                    <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/60 min-h-[26px]">
                      <option value="all" className="bg-card">За всё время</option>
                      <option value="today" className="bg-card">За сегодня</option>
                      <option value="week" className="bg-card">За неделю</option>
                      <option value="month" className="bg-card">За месяц</option>
                      <option value="year" className="bg-card">За год</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-2.5">
                {orgTicketsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-3 animate-pulse">
                      <div className="h-3.5 w-1/4 bg-muted/80 rounded mb-2" />
                      <div className="h-4 w-3/4 bg-muted/80 rounded mb-2.5" />
                      <div className="h-3 w-1/3 bg-muted/80 rounded" />
                    </div>
                  ))
                ) : orgTickets.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">Заявки не найдены</div>
                ) : filteredOrgTickets.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">Нет заявок, соответствующих фильтрам</div>
                ) : (
                  filteredOrgTickets.map((t) => {
                    const stateColor = filtersData?.stateColors?.[t.state.id]
                    const stateBadgeStyle = stateColor ? { backgroundColor: `${stateColor}15`, color: stateColor, borderColor: `${stateColor}30`, borderWidth: '1px' } : undefined
                    return (
                      <div
                        key={t.id}
                        data-tab-path={`/dashboard/tickets/${t.id}`}
                        onClick={() => onOpenTicket(t.id)}
                        className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-all duration-100 group"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">#{t.clientNumber || t.id}</span>
                          <span style={stateBadgeStyle} className={cn("inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-medium border border-border/30 whitespace-nowrap", !stateColor && getStateBadgeClass(t.state.name))}>
                            {t.state.name}
                          </span>
                        </div>
                        <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-relaxed">{t.title}</h4>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{formatTicketDate(t.createdAt)}</span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </>
  )
}
