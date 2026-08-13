export interface SubTicket {
  id: number
  title: string
  group: string
  owner: string
  state: string
  createdAt: string
}

export interface Ticket {
  id: number
  number: string
  clientNumber?: string | null
  title: string
  state: { id: number; name: string }
  priority: { id: number; name: string }
  group: { id: number; name: string }
  owner: { id: number | null; name: string }
  organization: { id: number | null; name: string }
  ticketType?: { id: string | null; name: string }
  iikoReasons?: TicketReasonItem[]
  tags?: TicketTagItem[]
  createdAt: string
  updatedAt: string
  closedAt?: string | null
  pendingTime?: string | null
  score?: number | null
  accountedTime?: number | null
  channel?: string | null
  checkInErp?: boolean | null
  erpBill?: string | null
  bitrixDeal?: string | null
  iikoCost?: string | null
  subTickets?: SubTicket[]
}

export interface TicketAttachment {
  id: number
  filename: string
  size: number
  mimeType: string
}

export interface TicketArticle {
  id: number
  ticketId: number
  body: string
  contentType: string
  type: string
  sender: 'agent' | 'customer' | 'system'
  internal: boolean
  createdAt: string
  creatorName: string
  creatorAvatarDataUrl?: string | null
  attachments: TicketAttachment[]
  callRecordId?: string
  callRecordUrl?: string
  displaySide?: 'left' | 'right'
}

export interface TicketCustomer {
  id: number
  firstname: string
  lastname: string
  email: string
  phone: string
  mobile: string
  telegram: string
  address?: string | null
  tg_id_for_notice?: string | null
  organization_id?: number | null
}


export interface MetadataItem {
  id: number
  name: string
}

export interface TicketTypeItem {
  id: string
  name: string
}

export interface TicketReasonItem {
  id: string
  name: string
}

export interface TicketTagItem {
  id: string
  name: string
}

export interface TicketHistoryItem {
  id: string
  createdAt: string
  actorName: string
  action: string
  fieldName?: string
  from?: string | null
  to?: string | null
}

export interface Conditions {
  groups?: MetadataItem[]
  states?: MetadataItem[]
  ticketTypes?: TicketTypeItem[]
  iikoReasons?: TicketReasonItem[]
  tags?: TicketTagItem[]
  orgs?: MetadataItem[]
  owners?: { id: number | 'me' | 'unassigned'; name: string }[]
  priorities?: MetadataItem[]
  checkInErp?: 'any' | 'yes' | 'no'
  erpBill?: 'any' | 'yes' | 'no'
  cost?: 'any' | 'yes' | 'no'
  score?: 'any' | '0' | '1' | '2' | '3' | '4' | '5' | 'no_score'
  columns?: string[]
}

export interface TicketFilter {
  wrapperId: number
  name: string
  enabled?: boolean
  order?: number
  conditions?: Conditions
  query?: string
}

export interface TicketListParams {
  wrapperId: number
  page: number
  perPage: number
  sortField: string
  sortAsc: boolean
  searchQuery?: string
  myTicketsStateId?: number
  /** Inclusive period, as YYYY-MM-DD, applied to `dateField`. */
  createdFrom?: string
  createdTo?: string
  /** Which date the period filters on. Defaults to the creation date. */
  dateField?: 'created' | 'closed'
}

export interface TicketListResponse {
  tickets: Ticket[]
  total: number
  page: number
  totalPages: number
}

export interface TicketFiltersResponse {
  allFilters: TicketFilter[]
  hasZammadToken: boolean
  states: MetadataItem[]
  priorities: MetadataItem[]
  groups: MetadataItem[]
  ticketTypes?: TicketTypeItem[]
  iikoReasons?: TicketReasonItem[]
  tags?: TicketTagItem[]
  stateColors?: Record<number, string>
  agents?: MetadataItem[]
}

export function getStateBadgeClass(stateName: string): string {
  const n = stateName.toLowerCase().replace(/ё/g, 'е')
  if (n.includes('открыт') || n.includes('new')) {
    if (n.includes('повторно')) return 'bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-500/30'
    return 'bg-orange-500/10 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-transparent'
  }
  if (n.includes('работ') || n.includes('open')) return 'bg-orange-600/10 dark:bg-orange-600/15 text-orange-700 dark:text-orange-400 border border-orange-200/50 dark:border-transparent'
  if (n.includes('отложен') || n.includes('ожидан') || n.includes('pend') || n.includes('заявит') || n.includes('недел') || n.includes('тестир') || n.includes('вендор') || n.includes('ждем ответа') || n.includes('запланирован')) return 'bg-sky-500/10 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-200/50 dark:border-transparent'
  if (n.includes('закрыт') || n.includes('заверш') || n.includes('clos') || n.includes('объединен') || n.includes('merged')) return 'bg-green-500/10 dark:bg-green-500/15 text-green-600 dark:text-green-400 border border-green-200/50 dark:border-transparent'
  if (n.includes('продаж')) return 'bg-pink-500/10 dark:bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-200/60 dark:border-pink-500/30'
  return 'bg-muted/40 text-muted-foreground border border-border/40'
}

export function getPriorityColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('4') || n.includes('critical') || n.includes('критич')) return 'bg-red-500'
  if (n.includes('3') || n.includes('high') || n.includes('высок')) return 'bg-orange-400'
  if (n.includes('2') || n.includes('normal') || n.includes('нормал')) return 'bg-blue-400'
  return 'bg-muted-foreground/50'
}

export function getPriorityLabel(name: string): string {
  return name
}

export function getTicketTypeBadgeClass(typeId?: string | null, typeName?: string): string {
  const value = `${typeId ?? ''} ${typeName ?? ''}`.toLowerCase().replace(/ё/g, 'е')
  if (value.includes('problem') || value.includes('проблем')) {
    return 'bg-pink-500/10 dark:bg-pink-500/15 text-pink-600 dark:text-pink-300 border border-pink-200/60 dark:border-pink-500/30'
  }
  if (value.includes('request for change') || value.includes('проект')) {
    return 'bg-cyan-500/10 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-500/30'
  }
  if (value.includes('pay') || value.includes('kkt') || value.includes('платн') || value.includes('регистрация ккт')) {
    return 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-500/30'
  }
  if (value.includes('incident') || value.includes('repair') || value.includes('заявк') || value.includes('ремонт')) {
    return 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-500/30'
  }
  if (value.includes('service') || value.includes('план')) {
    return 'bg-slate-500/10 dark:bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-500/30'
  }
  if (value.includes('in') || value.includes('внутрен')) {
    return 'bg-zinc-500/10 dark:bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border border-zinc-200/60 dark:border-zinc-500/30'
  }
  return 'bg-muted/40 text-muted-foreground border border-border/40'
}

/** Points come in halves, and 1.5 must read as "1,5", not "1.5" or "1". */
export function formatScore(value: number): string {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
}

export function formatTicketDate(raw: string): string {
  if (!raw) return '-'
  try {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const timePart = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      return `${datePart} ${timePart}`
    }
  } catch {}
  return raw
}

export const DEFAULT_COLUMNS = [
  'number',
  'organization',
  'title',
  'group',
  'owner',
  'priority',
  'state',
  'createdAt',
  'pendingTime',
  'score'
]

export interface OrganizationDetails {
  id: number
  name: string
  active: boolean
  vip: boolean
  responsible_group: string | null
  manager: string | null
  contracts: string | null
  contracts_and_comments: string | null
  sum_debt: number
  deposit_balance_minutes: number | null
  note: string | null
  link_wiki: string | null
  keepass: string | null
  phone: string | null
  email: string | null
}
