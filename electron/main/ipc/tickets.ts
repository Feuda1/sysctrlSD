import { ipcMain, net, app, session } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import logger from 'electron-log/main'
import { isWrapperSessionAlive, loginWrapper, readStored, writeStored, setZammadTokenCache, markClientsSessionAlive, markClientsSessionDead } from './auth'
import { exportTicket, type TicketExportOptions } from '../ticketExport'
import {
  attrValue,
  clientsFormErrorMessage,
  decodeHtml,
  extractSelectedOptions,
  firstMatchText,
  isClientsCreateForm,
  isClientsLoginPage,
  labelValueFromHtml,
  normalizeChannelLabel,
  parseClientsScoreControl,
  parseTicketIdValue,
  stripHtml,
  ticketIdFromUrl,
  CLIENTS_CREATE_FORM_RE,
} from '../clients/parse'
import { dateRangeQuery, isInDateRange, zammadSearchValue } from '../zammad/query'
import { cancelUpload, putWithProgress } from '../zammad/upload'
import {
  getAvailableSounds,
  readNotificationHistory,
  readNotificationSettings,
  soundsDir,
  writeNotificationHistory,
  writeNotificationSettings
} from '../notifications/storage'
export { readNotificationSettings }
import {
  buildZammadQuery as buildZammadQueryFor,
  filterTicketsLocally as filterTicketsLocallyWith,
  ticketReasonIds,
  ticketTagIds
} from '../zammad/filter'

// The reason field name is discovered at runtime, so it is bound here once
// instead of being threaded through every call site.
function buildZammadQuery(cond: Conditions, myUserId: number | null): string {
  return buildZammadQueryFor(cond, myUserId, meta.iikoReasonField)
}

function filterTicketsLocally(tickets: any[], cond: Conditions, myUserId: number | null): any[] {
  return filterTicketsLocallyWith(tickets, cond, myUserId, meta.iikoReasonField)
}
import type { NotificationItem } from '../../preload/index'

const ZAMMAD_BASE = 'https://zammad.denvic.ru'
const WRAPPER_BASE = 'https://clients.denvic.ru'
const CLIENTS_FILTER_IDS = [522, 540, 541, 1067]

const activeSystemNotifications = new Set<any>()

async function zammadFetch(url: string | URL, options: any = {}) {
  const ses = session.fromPartition('zammad-api')
  try {
    await ses.clearStorageData({ storages: ['cookies'] })
  } catch (err) {
    logger.warn('Failed to clear zammad-api cookies:', err)
  }
  const headers = {
    ...options.headers,
    Origin: 'https://zammad.denvic.ru',
    Referer: 'https://zammad.denvic.ru/'
  }
  const opt = {
    ...options,
    headers,
    session: ses
  }
  return net.fetch(url.toString(), opt)
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

export interface AddTicketCommentParams {
  ticketId: number
  body: string
  internal?: boolean
  articleType?: string
  stateId?: number
  ticketTypeId?: string | null
  groupId?: number | null
  ownerId?: number | null
  priorityId?: number | null
  iikoReasonIds?: string[]
  tagIds?: string[]
  pendingTime?: string | null
  timeUnit?: number | null
  attachments?: {
    filename: string
    data: string
    mimeType: string
  }[]
  /** Lets the renderer follow and cancel an upload that carries attachments. */
  uploadId?: string
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

export interface MetadataItem {
  id: number
  name: string
}

export interface UserSearchResult extends MetadataItem {
  email: string
  organizationId: number | null
  organizationName: string
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

export interface OrganizationMember {
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

type CallSectionKey = 'history' | 'mine' | 'current'

interface CallRecord {
  id: string
  callId: string | null
  section: CallSectionKey
  direction: 'in' | 'out' | 'missed' | 'unknown'
  phone: string | null
  client: string | null
  organization: string | null
  operator: string | null
  startedAt: string | null
  duration: string | null
  status: string | null
  recordingUrl: string | null
  sourceUrl: string | null
  raw: Record<string, string>
  isLinked?: boolean
  linkedTicketId?: string | null
  createCandidates?: { clientId: string; name: string }[]
  bindCandidates?: { ticketId: string; name: string }[]
}

interface CallsResponse {
  history: CallRecord[]
  mine: CallRecord[]
  current: CallRecord[]
  fetchedAt: string
}

interface ClientsArticleMeta {
  callRecordId?: string
  callRecordUrl?: string
  displaySide?: 'left' | 'right'
  avatarDataUrl?: string | null
}

interface SubTicket {
  id: number
  title: string
  group: string
  owner: string
  state: string
  createdAt: string
}

interface ClientsTicketDetailsMeta {
  title?: string
  channel?: string
  customer?: {
    id?: number
    firstname?: string
    lastname?: string
    email?: string
    phone?: string
    mobile?: string
    telegram?: string
  }
  organization?: {
    id?: number
    name?: string
    phone?: string
    email?: string
    contracts?: string
  }
  tags?: TicketTagItem[]
  subTickets?: SubTicket[]
  /** Options of the "БАЛЛЫ ЗА ЗАЯВКУ" select, exactly as clients defines them. */
  scoreOptions?: { value: string; label: string }[]
  scoreValue?: string | null
  /** clients renders the select disabled for agents without the right. */
  canEditScore?: boolean
}

const DEFAULT_FILTERS: TicketFilter[] = [
  {
    wrapperId: 1,
    name: 'L1',
    enabled: true,
    order: 0,
    conditions: {
      groups: [{ id: -1, name: 'Айко: L1 (Л1)' }],
      owners: [{ id: 'unassigned', name: 'Не назначена' }],
      states: [
        { id: -2, name: 'В работе' },
        { id: -3, name: 'Открыта' },
        { id: -4, name: 'Отложена' },
        { id: -5, name: 'В ожидании закрытия' },
        { id: -6, name: 'Ждём ответа заявителя' }
      ]
    }
  },
  {
    wrapperId: 2,
    name: 'L2',
    enabled: true,
    order: 1,
    conditions: {
      groups: [{ id: -7, name: 'Айко: L2 (Л2)' }],
      owners: [{ id: 'unassigned', name: 'Не назначена' }],
      states: [
        { id: -2, name: 'В работе' },
        { id: -3, name: 'Открыта' },
        { id: -4, name: 'Отложена' },
        { id: -5, name: 'В ожидании закрытия' },
        { id: -6, name: 'Ждём ответа заявителя' }
      ]
    }
  },
  {
    wrapperId: 3,
    name: 'L3',
    enabled: true,
    order: 2,
    conditions: {
      groups: [{ id: -8, name: 'Айко: L3 (Л3)' }],
      owners: [{ id: 'unassigned', name: 'Не назначена' }],
      states: [
        { id: -2, name: 'В работе' },
        { id: -3, name: 'Открыта' },
        { id: -4, name: 'Отложена' },
        { id: -5, name: 'В ожидании закрытия' },
        { id: -6, name: 'Ждём ответа заявителя' }
      ]
    }
  },
  {
    wrapperId: 4,
    name: 'L1/L2',
    enabled: true,
    order: 3,
    conditions: {
      groups: [
        { id: -1, name: 'Айко: L1 (Л1)' },
        { id: -7, name: 'Айко: L2 (Л2)' }
      ],
      owners: [{ id: 'unassigned', name: 'Не назначена' }],
      states: [
        { id: -2, name: 'В работе' },
        { id: -3, name: 'Открыта' },
        { id: -4, name: 'Отложена' },
        { id: -5, name: 'В ожидании закрытия' },
        { id: -6, name: 'Ждём ответа заявителя' }
      ]
    }
  },
  {
    wrapperId: 5,
    name: 'Моё',
    enabled: true,
    order: 4,
    conditions: {
      owners: [{ id: 'me', name: 'Я (текущий пользователь)' }],
      states: [
        { id: -2, name: 'В работе' },
        { id: -3, name: 'Открыта' },
        { id: -4, name: 'Отложена' },
        { id: -5, name: 'В ожидании закрытия' },
        { id: -6, name: 'Ждём ответа заявителя' }
      ]
    }
  },
  {
    wrapperId: 6,
    name: 'Закрытые',
    enabled: true,
    order: 5,
    conditions: {
      owners: [{ id: 'me', name: 'Я (текущий пользователь)' }],
      states: [
        { id: -9, name: 'Закрыта' }
      ]
    }
  },
  {
    wrapperId: 7,
    name: 'Открытые у сотрудников',
    enabled: true,
    order: 6,
    conditions: {
      states: [
        { id: -2, name: 'В работе' },
        { id: -3, name: 'Открыта' }
      ]
    },
    query: 'state_id:({state_new} OR {state_open}) AND NOT owner_id:1'
  }
]

function filtersPath(): string {
  return join(app.getPath('userData'), 'filters.json')
}

function resolveFilterPlaceholderIds(filters: TicketFilter[]): TicketFilter[] {
  const normalizeName = (s: string) => s.toLowerCase().replace(/ё/g, 'е').trim()

  const groupNameToId: Record<string, number> = {}
  for (const [id, name] of Object.entries(meta.groups)) {
    groupNameToId[normalizeName(name)] = Number(id)
  }

  const stateNameToId: Record<string, number> = {}
  for (const [id, name] of Object.entries(meta.states)) {
    stateNameToId[normalizeName(name)] = Number(id)
  }

  const ticketTypeNameToId: Record<string, string> = {}
  for (const [id, name] of Object.entries(meta.ticketTypes)) {
    ticketTypeNameToId[normalizeName(name)] = id
    ticketTypeNameToId[normalizeName(id)] = id
  }

  const iikoReasonNameToId: Record<string, string> = {}
  for (const [id, name] of Object.entries(meta.iikoReasons)) {
    iikoReasonNameToId[normalizeName(name)] = id
    iikoReasonNameToId[normalizeName(id)] = id
  }

  const tagNameToId: Record<string, string> = {}
  for (const [id, name] of Object.entries(meta.tags)) {
    tagNameToId[normalizeName(name)] = id
    tagNameToId[normalizeName(id)] = id
  }

  return filters.map(f => {
    const copy = JSON.parse(JSON.stringify(f)) as TicketFilter

    if (copy.conditions?.groups) {
      copy.conditions.groups = copy.conditions.groups.map(g => {
        const key = normalizeName(g.name)
        if (groupNameToId[key]) {
          return { id: groupNameToId[key], name: g.name }
        }
        return g
      })
    }

    if (copy.conditions?.states) {
      copy.conditions.states = copy.conditions.states.map(s => {
        const key = normalizeName(s.name)
        if (stateNameToId[key]) {
          return { id: stateNameToId[key], name: s.name }
        }
        return s
      })
    }

    if (copy.conditions?.ticketTypes) {
      copy.conditions.ticketTypes = copy.conditions.ticketTypes.map(t => {
        const key = normalizeName(t.name)
        const idKey = normalizeName(t.id)
        const realId = ticketTypeNameToId[key] ?? ticketTypeNameToId[idKey]
        if (realId) {
          return { id: realId, name: meta.ticketTypes[realId] ?? t.name }
        }
        return t
      })
    }

    if (copy.conditions?.iikoReasons) {
      copy.conditions.iikoReasons = copy.conditions.iikoReasons.map(reason => {
        const key = normalizeName(reason.name)
        const idKey = normalizeName(reason.id)
        const realId = iikoReasonNameToId[key] ?? iikoReasonNameToId[idKey]
        if (realId) {
          return { id: realId, name: meta.iikoReasons[realId] ?? reason.name }
        }
        return reason
      })
    }

    if (copy.conditions?.tags) {
      copy.conditions.tags = copy.conditions.tags.map(tag => {
        const key = normalizeName(tag.name)
        const idKey = normalizeName(tag.id)
        const realId = tagNameToId[key] ?? tagNameToId[idKey]
        if (realId) {
          return { id: realId, name: meta.tags[realId] ?? tag.name }
        }
        return tag
      })
    }

    if (copy.query) {
      const stateNewId = stateNameToId['открыта'] || 1
      const stateOpenId = stateNameToId['в работе'] || 2
      copy.query = copy.query
        .replace(/{state_new}/g, String(stateNewId))
        .replace(/{state_open}/g, String(stateOpenId))
        .replace(/\bticket_reason:/g, `${meta.iikoReasonField}:`)
    } else if (copy.conditions) {
      copy.query = buildZammadQuery(copy.conditions, cachedUserId)
    }

    return copy
  })
}

function readFilters(): TicketFilter[] {
  let list = DEFAULT_FILTERS
  try {
    const p = filtersPath()
    if (existsSync(p)) {
      list = JSON.parse(readFileSync(p, 'utf8'))
    }
  } catch (err) {
    logger.error(err)
  }
  return resolveFilterPlaceholderIds(list)
}

function writeFilters(filters: TicketFilter[]): void {
  try {
    writeFileSync(filtersPath(), JSON.stringify(filters, null, 2), 'utf8')
  } catch (err) {
    logger.error(err)
  }
}

function colorsPath(): string {
  return join(app.getPath('userData'), 'state_colors.json')
}

const DEFAULT_STATE_COLORS: Record<number, string> = {
  1: '#f97316',
  2: '#ea580c',
  3: '#0284c7',
  7: '#16a34a',
  4: '#22c55e'
}

function defaultStateColor(name: string): string | null {
  const n = name.toLowerCase().replace(/ё/g, 'е')
  if (n.includes('повторно')) return '#ef4444'
  if (n.includes('продаж')) return '#ec4899'
  if (
    n.includes('запланирован') ||
    n.includes('недел') ||
    n.includes('тестир') ||
    n.includes('вендор') ||
    n.includes('ждем ответа') ||
    n.includes('ждём ответа') ||
    n.includes('заявит') ||
    n.includes('отлож') ||
    n.includes('ожидан') ||
    n.includes('pend')
  ) return '#0284c7'
  if (n.includes('объедин') || n.includes('merged') || n.includes('закрыт') || n.includes('заверш')) return '#22c55e'
  if (n.includes('открыт') || n.includes('new')) return '#f97316'
  if (n.includes('работ') || n.includes('open')) return '#ea580c'
  return null
}

function readStateColors(): Record<number, string> {
  try {
    const p = colorsPath()
    if (existsSync(p)) {
      return JSON.parse(readFileSync(p, 'utf8'))
    }
  } catch (err) {
    logger.error(err)
  }
  return DEFAULT_STATE_COLORS
}

function readStateColorsWithDefaults(): Record<number, string> {
  const colors = { ...DEFAULT_STATE_COLORS, ...readStateColors() }
  for (const [id, name] of Object.entries(meta.states)) {
    const stateId = Number(id)
    if (!colors[stateId]) {
      const color = defaultStateColor(name)
      if (color) colors[stateId] = color
    }
  }
  return colors
}

function writeStateColors(colors: Record<number, string>): void {
  try {
    writeFileSync(colorsPath(), JSON.stringify(colors, null, 2), 'utf8')
  } catch (err) {
    logger.error(err)
  }
}

const STATE_RU: Record<string, string> = {
  'new': 'Открыта',
  'open': 'В работе',
  'pending reminder': 'Отложена',
  'pending close': 'В ожидании закрытия',
  'closed': 'Закрыта',
  'merged': 'Объединена',
  'removed': 'Удалена'
}

const FALLBACK_TICKET_TYPES: TicketTypeItem[] = [
  { id: 'in', name: 'Внутренняя' },
  { id: 'Incident', name: 'Заявка' },
  { id: 'service', name: 'Плановая' },
  { id: 'pay', name: 'Платная' },
  { id: 'Problem', name: 'Проблема' },
  { id: 'Request for Change', name: 'Проект' },
  { id: 'kkt', name: 'Регистрация ККТ/Замена ФН' },
  { id: 'repair', name: 'Ремонт техники' }
]

const FALLBACK_IIKO_REASONS: TicketReasonItem[] = [
  '1С',
  'Банк(ошибки, подключение)',
  'Выезд',
  'Доставка',
  'ЕГАИС (консультация)',
  'ЕГАИС (что-то не работает)',
  'Запрос на услугу',
  'Интеграции (любые)',
  'Киоск',
  'Лицензии',
  'Лояльность (работа, отчёты, настройки)',
  'Моккано',
  'Неактуально (нет ответа)',
  'Обновление и его последствия',
  'Обучение',
  'Переферийное оборудование (принтеры, сканеры, ККТ и т.д.)',
  'Плагины',
  'Подменка',
  'Проект',
  'Прочее',
  'Пуско-наладка',
  'Рег-перерег',
  'Сервер iiko',
  'Сканер',
  'Сотрудники',
  'Чек коррекции',
  'Честный знак, ОФД, Меркурий',
  'Шаблоны(редактирование, консультация)',
  'Экран очереди(Аррайвлс)',
  'DoxInBox',
  'iikoFront (консультации, настройка)',
  'iikoOffice (консультации, настройка)',
  'iikoWeb',
  'SystemSwap',
  'Windows'
].map(name => ({ id: name, name }))

const FALLBACK_TICKET_TAGS: TicketTagItem[] = [
  'Договоры',
  'ПП',
  'Повторный инцидент',
  'Документооборот уведомлен',
  'Моккано Арора',
  'Автообработка',
  'ОП уведомлен',
  'Не отработана 1-я линия',
  'Арсений',
  'Это База!',
  'Я это уже делал',
  'Разрабы помогли',
  'Мы закрыли в ТопСервис',
  'Моккано Сотрудники',
  'Моккано Баллы',
  'Моккано Майндбокс',
  'Автоэскалация',
  'iiko: ТопСервис. Сами закрыли',
  'QA.Проект',
  'QA.Подменка'
].map(name => ({ id: name, name }))

interface Meta {
  states: Record<number, string>
  priorities: Record<number, string>
  groups: Record<number, string>
  ticketTypes: Record<string, string>
  iikoReasons: Record<string, string>
  iikoReasonField: string
  tags: Record<string, string>
  users: Record<number, string>
  usersLoaded: Record<number, boolean>
  agents: Record<number, boolean>
  /** Zammad's `active` flag: disabled accounts must not be offered in filters. */
  usersActive: Record<number, boolean>
  /** login/email, used to tell apart two accounts with the same display name. */
  userLogins: Record<number, string>
  userImages: Record<number, string | null>
  userAvatars: Record<number, string | null>
}

const meta: Meta = { states: {}, priorities: {}, groups: {}, ticketTypes: {}, iikoReasons: {}, iikoReasonField: 'ticket_reason', tags: {}, users: {}, usersLoaded: {}, agents: {}, usersActive: {}, userLogins: {}, userImages: {}, userAvatars: {} }
let metaLoaded = false
let cachedUserId: number | null = null
let clientsIndexCache: { expiresAt: number; index: ClientsTicketIndex } | null = null
interface ActiveTicketsCache {
  userId: number
  tickets: any[]
  assets: any
  timestamp: number
}
let activeTicketsCache: ActiveTicketsCache | null = null
const ACTIVE_TICKETS_TTL = 30000
const clientsAvatarCache = new Map<string, string | null>()

// Turns an HTTP failure into a short, human message. Gateway timeouts and HTML
// error pages (nginx 502/503/504) are summarised instead of dumped into the UI.
function describeHttpError(status: number, text: string, fallback: string): string {
  if (status === 502 || status === 503 || status === 504) {
    return `Сервер не ответил вовремя (${status}). Возможно, изменения не сохранились — обновите заявку и при необходимости повторите.`
  }
  if (status === 401 || status === 403) {
    return `Нет доступа (${status}). Проверьте Zammad API ключ в настройках.`
  }
  // The server rejects the body before reading it; the raw "413" tells the user
  // nothing, and the file is always the reason.
  if (status === 413) {
    return 'Вложение слишком большое — сервер не принимает файл такого размера. Отправьте файл меньше или ссылкой.'
  }
  const trimmed = (text || '').trim()
  let detail = ''
  if (trimmed && !/^\s*<(?:!doctype|html|head|body)/i.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed)
      detail = parsed?.error_human || parsed?.error || ''
    } catch {
      if (trimmed.length <= 200 && !trimmed.includes('<')) detail = trimmed
    }
  }
  return detail ? `${fallback}: ${detail}` : `${fallback} (ошибка ${status}).`
}

function notifyFrontend(channel: string, ...args: any[]) {
  const { BrowserWindow } = require('electron')
  const wins = BrowserWindow.getAllWindows()
  for (const win of wins) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, ...args)
    }
  }
}

const ticketHtmlCache = new Map<number, { html: string; timestamp: number }>()
const ticketHtmlPromises = new Map<number, Promise<string>>()
const TICKET_HTML_CACHE_TTL = 300000

function fetchTicketHtml(ticketId: number): Promise<string> {
  const now = Date.now()
  const cached = ticketHtmlCache.get(ticketId)
  if (cached && (now - cached.timestamp < TICKET_HTML_CACHE_TTL)) {
    return Promise.resolve(cached.html)
  }

  let promise = ticketHtmlPromises.get(ticketId)
  if (!promise) {
    promise = (async () => {
      try {
        const detailResp = await net.fetch(`${WRAPPER_BASE}/Tickets/Details/${ticketId}`, {
          session: wrapperSession()
        } as any)
        if (!detailResp.ok) {
          throw new Error(`Ошибка загрузки деталей заявки: ${detailResp.status}`)
        }
        const html = await detailResp.text()
        ticketHtmlCache.set(ticketId, { html, timestamp: Date.now() })
        return html
      } finally {
        ticketHtmlPromises.delete(ticketId)
      }
    })()
    ticketHtmlPromises.set(ticketId, promise)
  }
  return promise
}

interface CachedTicketList {
  data: TicketListResponse
  timestamp: number
}
interface CachedTicketDetails {
  data: { ticket: Ticket; customer: any; organization: any }
  timestamp: number
}
interface CachedTicketArticles {
  data: any[]
  timestamp: number
}
interface CachedCalls {
  data: CallsResponse
  timestamp: number
}
interface CachedOrgList {
  data: OrganizationDetails[]
  timestamp: number
}
interface CachedOrgMembers {
  data: OrganizationMember[]
  timestamp: number
}
interface CachedOrgTickets {
  data: Ticket[]
  timestamp: number
}

const ticketListCache = new Map<string, CachedTicketList>()
const ticketDetailsCache = new Map<number, CachedTicketDetails>()
const ticketArticlesCache = new Map<number, CachedTicketArticles>()
const callsCache = new Map<string, CachedCalls>()
const orgListCache = new Map<string, CachedOrgList>()
const orgMembersCache = new Map<number, CachedOrgMembers>()
const orgTicketsCache = new Map<number, CachedOrgTickets>()

const LIST_CACHE_TTL = 300000
const DETAILS_CACHE_TTL = 600000
const ARTICLES_CACHE_TTL = 600000
const CALLS_CACHE_TTL = 15000
const ORG_LIST_CACHE_TTL = 300000
const ORG_MEMBERS_CACHE_TTL = 300000
const ORG_TICKETS_CACHE_TTL = 120000

function clearTicketCaches(ticketId?: number): void {
  activeTicketsCache = null
  ticketListCache.clear()
  ticketHtmlCache.clear()
  ticketHtmlPromises.clear()
  orgTicketsCache.clear()
  if (ticketId) {
    ticketDetailsCache.delete(ticketId)
    ticketArticlesCache.delete(ticketId)
  } else {
    ticketDetailsCache.clear()
    ticketArticlesCache.clear()
  }
}

const L_MAP: Record<string, string> = {
  'bogoslavskij': 'Богославский',
  'barmina': 'Бармина',
  'shebyreva': 'Шебырева',
  'annenko': 'Анненко',
  'zavarzin': 'Заварзин',
  'monahova': 'Монахова',
  'mokkanobot@denvic.ru': 'Бот Моккано',
  'denvicsupportbot': 'DenvicSupportBot',
  'bogoslavsky': 'Богославский'
}

function cleanUserName(firstName?: string, lastName?: string, login?: string, userId?: number): string {
  const fName = String(firstName || '').trim()
  const lName = String(lastName || '').trim()
  const fullName = [fName, lName].filter(Boolean).join(' ')
  if (fullName) return fullName

  const uLogin = String(login || '').trim().toLowerCase()
  if (L_MAP[uLogin]) return L_MAP[uLogin]

  if (/^[a-z]+$/i.test(uLogin)) {
    return uLogin.charAt(0).toUpperCase() + uLogin.slice(1)
  }
  return uLogin || String(userId ?? '')
}

function isFallbackUserName(name?: string): boolean {
  const value = String(name || '').trim()
  if (!value) return true
  return value.includes('@') || /^[a-z][a-z0-9._-]*$/i.test(value)
}

interface ClientsTicketIndex {
  byZammadId: Map<string, string>
  byZammadNumber: Map<string, string>
  byClientNumber: Map<string, { zammadId?: string; zammadNumber?: string }>
}

// net.fetch() ignores the `session` option — that option belongs to
// net.request() — so every clients request has always gone through the default
// session, and that is where the login cookie lives. Pointing this helper at the
// same session is what makes the cookie checks agree with reality.
function wrapperSession() {
  return session.defaultSession
}

/**
 * Reads the "БАЛЛЫ ЗА ЗАЯВКУ" select off a clients ticket page. The right to
 * award points lives in clients, and it shows in the markup: an agent who may
 * set them gets a normal select (id="ticket_Score"), everyone else gets the same
 * select rendered `disabled`.
 */
// One line per app run: enough to tell a missing right from a parsing miss.
let scoreParseLogged = false

function parseClientsTicketDetails(html: string): ClientsTicketDetailsMeta {
  const decodedHtml = decodeHtml(html)
  const headerMatch = decodedHtml.match(/<div class="card"\s+id="tecketHeader"[\s\S]*?(?=<div class="card">\s*<div class="card-body">\s*<ul class="nav nav-tabs"|$)/i)
  const headerHtml = headerMatch?.[0] ?? decodedHtml
  const clientTabHtml = decodedHtml.match(/<div class="tab-pane p-3"\s+id="Client"[\s\S]*?(?=<div class="tab-pane p-3"\s+id=|$)/i)?.[0] ?? ''

  const customerLink = headerHtml.match(/<a\s+href="\/Customers\/Details\/(\d+)"[^>]*>\s*<h5[^>]*>([\s\S]*?)<\/h5>\s*<\/a>/i)
  const organizationLink = headerHtml.match(/<a\s+href="\/Organizations\/Details\/(\d+)"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/a>/i)
  const title = firstMatchText(decodedHtml, /<b\s+id="titleB"[\s\S]*?>([\s\S]*?)<\/b>/i) ?? undefined
  const channel = normalizeChannelLabel(decodedHtml.match(/id="titleDivCaption"[\s\S]*?title="([^"]+)"/i)?.[1])
    ?? undefined
  const phone = labelValueFromHtml(headerHtml, 'Телефон') || firstMatchText(clientTabHtml, /<label[^>]*>\s*(?:Телефон|Мобильный)\s*<\/label>\s*<br>\s*<div class="mb-3">([\s\S]*?)<\/div>/i)
  const email = labelValueFromHtml(headerHtml, 'Email') || firstMatchText(clientTabHtml, /<label[^>]*>\s*ЭЛЕКТРОННАЯ ПОЧТА\s*<\/label>\s*<br>\s*<div class="mb-3">([\s\S]*?)<\/div>/i)
  const contracts = labelValueFromHtml(headerHtml, 'Договоры')
  const customerName = customerLink ? stripHtml(customerLink[2]) : firstMatchText(clientTabHtml, /<h4>([\s\S]*?)<\/h4>/i)
  const organizationName = organizationLink ? stripHtml(organizationLink[2]) : null
  const selectedTags = extractSelectedOptions(decodedHtml, 'ticket_tags').map(name => ({ id: name, name }))

  const subTickets: SubTicket[] = []
  const childrenTabMatch = decodedHtml.match(/<div class="tab-pane p-3"\s+id="ChildrenTickets" role="tabpanel">([\s\S]*?)<\/div>\s*<script>/i)
  if (childrenTabMatch) {
    const tabHtml = childrenTabMatch[1]
    const trRegex = /<tr class=['"]clickable-row['"]>([\s\S]*?)<\/tr>/gi
    const trMatches = Array.from(tabHtml.matchAll(trRegex))

    for (const trMatch of trMatches) {
      const trHtml = trMatch[1]
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
      const tds = Array.from(trHtml.matchAll(tdRegex)).map(m => m[1].trim())
      if (tds.length >= 8) {
        const subId = tds[0]
        const subTitleMatch = tds[2].match(/<b>([\s\S]*?)<\/b>/i)
        const subTitle = subTitleMatch ? subTitleMatch[1].trim() : tds[2]

        const subGroup = tds[3]
        const subOwnerMatch = tds[4].match(/<a[^>]*getMeSubTicketOwner-[^>]*>([\s\S]*?)<\/a>/i)
        const subOwner = subOwnerMatch ? subOwnerMatch[1].trim() : tds[4].replace(/<[^>]*>/g, '').trim()

        const subStateMatch = tds[6].match(/<div[^>]*>([\s\S]*?)<\/div>/i)
        const subState = subStateMatch ? subStateMatch[1].trim() : tds[6]

        const subCreatedAt = tds[7]

        subTickets.push({
          id: parseInt(subId, 10),
          title: decodeHtml(subTitle.replace(/<[^>]*>/g, '').trim()),
          group: decodeHtml(subGroup.replace(/<[^>]*>/g, '').trim()),
          owner: decodeHtml(subOwner.replace(/<[^>]*>/g, '').trim()),
          state: decodeHtml(subState.replace(/<[^>]*>/g, '').trim()),
          createdAt: subCreatedAt
        })
      }
    }
  }

  const score = parseClientsScoreControl(decodedHtml)

  const nameParts = (customerName ?? '').split(/\s+/).filter(Boolean)
  return {
    title,
    channel,
    scoreOptions: score.options.length > 0 ? score.options : undefined,
    scoreValue: score.value,
    canEditScore: score.canEdit,
    customer: customerName ? {
      id: customerLink ? parseInt(customerLink[1], 10) : undefined,
      firstname: nameParts[0] ?? customerName,
      lastname: nameParts.slice(1).join(' '),
      email: email ?? undefined,
      phone: phone ?? undefined,
      mobile: phone ?? undefined
    } : undefined,
    organization: organizationName ? {
      id: organizationLink ? parseInt(organizationLink[1], 10) : undefined,
      name: organizationName,
      phone: phone ?? undefined,
      email: email ?? undefined,
      contracts: contracts ?? undefined
    } : undefined,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    subTickets: subTickets.length > 0 ? subTickets : undefined
  }
}

function getToken(): string {
  const stored = readStored()
  if (!stored.zammadToken) {
    throw new Error('Zammad токен не задан. Сначала войдите в систему.')
  }
  return stored.zammadToken
}

function zHeaders(token: string) {
  return {
    Authorization: `Token token=${token}`,
    'Content-Type': 'application/json'
  }
}

function addTicketType(id: string, name: string): void {
  const value = String(id || '').trim()
  const label = String(name || '').trim()
  if (!value || !label) return
  meta.ticketTypes[value] = label
}

function registerStringOptions(options: any, add: (id: string, name: string) => void): void {
  if (!options) return
  if (Array.isArray(options)) {
    options.forEach((option: any) => {
      if (Array.isArray(option)) {
        add(String(option[0] ?? ''), String(option[1] ?? option[0] ?? ''))
      } else if (option && typeof option === 'object') {
        add(
          String(option.value ?? option.id ?? option.key ?? option.name ?? ''),
          String(option.label ?? option.name ?? option.value ?? option.id ?? option.key ?? '')
        )
      } else {
        add(String(option), String(option))
      }
    })
    return
  }

  if (typeof options === 'object') {
    for (const [key, value] of Object.entries(options)) {
      if (value && typeof value === 'object') {
        const opt = value as any
        add(String(opt.value ?? opt.id ?? key), String(opt.label ?? opt.name ?? opt.title ?? key))
      } else {
        add(key, String(value ?? key))
      }
    }
  }
}

function registerTicketTypesFromOptions(options: any): void {
  registerStringOptions(options, addTicketType)
}

function registerFallbackTicketTypes(): void {
  FALLBACK_TICKET_TYPES.forEach(t => addTicketType(t.id, t.name))
}

function addIikoReason(id: string, name: string): void {
  const value = String(id || '').trim()
  const label = String(name || '').trim()
  if (!value || !label || value === '-') return
  meta.iikoReasons[value] = label
}

function registerIikoReasonsFromOptions(options: any): void {
  registerStringOptions(options, addIikoReason)
}

function registerFallbackIikoReasons(): void {
  FALLBACK_IIKO_REASONS.forEach(reason => addIikoReason(reason.id, reason.name))
}

function addTicketTag(id: string, name: string): void {
  const value = String(id || '').trim()
  const label = String(name || '').trim()
  if (!value || !label) return
  meta.tags[value] = label
}

function registerFallbackTicketTags(): void {
  FALLBACK_TICKET_TAGS.forEach(tag => addTicketTag(tag.id, tag.name))
}

function getTicketTypeName(typeId: string | null | undefined): string {
  const value = String(typeId || '').trim()
  if (!value) return ''
  if (meta.ticketTypes[value]) return meta.ticketTypes[value]
  const fallback = FALLBACK_TICKET_TYPES.find(type => type.id.toLowerCase() === value.toLowerCase())
  return fallback?.name ?? value
}

async function loadTicketTypes(h: ReturnType<typeof zHeaders>): Promise<void> {
  const candidates = [
    `${ZAMMAD_BASE}/api/v1/object_manager_attributes?object=Ticket`,
    `${ZAMMAD_BASE}/api/v1/object_manager_attributes`
  ]

  for (const endpoint of candidates) {
    try {
      const resp = await zammadFetch(endpoint, { headers: h })
      if (!resp.ok) continue
      const payload = await resp.json()
      const attrs = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.object_manager_attributes) ? payload.object_manager_attributes : [])

      const typeAttr = attrs.find((attr: any) => {
        const objectName = String(attr.object ?? attr.object_name ?? attr.object_lookup_name ?? '').toLowerCase()
        const attrName = String(attr.name ?? attr.attribute ?? attr.key ?? '').toLowerCase()
        const display = String(attr.display ?? attr.label ?? attr.title ?? '').toLowerCase()
        return (!objectName || objectName === 'ticket') && (
          attrName === 'type' ||
          attrName === 'ticket_type' ||
          display === 'тип' ||
          display === 'тип заявки'
        )
      })

      if (typeAttr) {
        registerTicketTypesFromOptions(typeAttr.data_option?.options)
        registerTicketTypesFromOptions(typeAttr.data_option?.default)
        registerTicketTypesFromOptions(typeAttr.options)
        if (Object.keys(meta.ticketTypes).length > 0) return
      }
    } catch (err) {
      logger.warn('Ошибка загрузки типов заявок:', err)
    }
  }

  registerFallbackTicketTypes()
}

async function loadIikoReasons(h: ReturnType<typeof zHeaders>): Promise<void> {
  const candidates = [
    `${ZAMMAD_BASE}/api/v1/object_manager_attributes?object=Ticket`,
    `${ZAMMAD_BASE}/api/v1/object_manager_attributes`
  ]

  for (const endpoint of candidates) {
    try {
      const resp = await zammadFetch(endpoint, { headers: h })
      if (!resp.ok) continue
      const payload = await resp.json()
      const attrs = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.object_manager_attributes) ? payload.object_manager_attributes : [])

      const reasonAttr = attrs.find((attr: any) => {
        const objectName = String(attr.object ?? attr.object_name ?? attr.object_lookup_name ?? '').toLowerCase()
        const attrName = String(attr.name ?? attr.attribute ?? attr.key ?? '').toLowerCase()
        const display = String(attr.display ?? attr.label ?? attr.title ?? '').toLowerCase()
        const combined = `${attrName} ${display}`
        return (!objectName || objectName === 'ticket') && (
          attrName === 'ticket_reason' ||
          attrName === 'ticketreason' ||
          combined.includes('причин') ||
          (combined.includes('reason') && combined.includes('iiko')) ||
          (combined.includes('iiko') && combined.includes('обращ'))
        )
      })

      if (reasonAttr) {
        const attrName = String(reasonAttr.name ?? reasonAttr.attribute ?? reasonAttr.key ?? '').trim()
        if (attrName) meta.iikoReasonField = attrName
        registerIikoReasonsFromOptions(reasonAttr.data_option?.options)
        registerIikoReasonsFromOptions(reasonAttr.data_option?.default)
        registerIikoReasonsFromOptions(reasonAttr.options)
        if (Object.keys(meta.iikoReasons).length > 0) return
      }
    } catch (err) {
      logger.warn('Ошибка загрузки причин обращения iiko:', err)
    }
  }

  registerFallbackIikoReasons()
}

async function loadTicketTags(h: ReturnType<typeof zHeaders>): Promise<void> {
  const candidates = [
    `${ZAMMAD_BASE}/api/v1/tags?object=Ticket`,
    `${ZAMMAD_BASE}/api/v1/tags`
  ]

  for (const endpoint of candidates) {
    try {
      const resp = await zammadFetch(endpoint, { headers: h })
      if (!resp.ok) continue
      const payload = await resp.json()
      const list = Array.isArray(payload)
        ? payload
        : (Array.isArray(payload?.tags) ? payload.tags : [])

      list.forEach((tag: any) => {
        if (typeof tag === 'string') {
          addTicketTag(tag, tag)
        } else if (tag && typeof tag === 'object') {
          const value = String(tag.name ?? tag.tag ?? tag.value ?? tag.id ?? '').trim()
          addTicketTag(value, value)
        }
      })

      if (Object.keys(meta.tags).length > 0) return
    } catch (err) {
      logger.warn('Ошибка загрузки тегов:', err)
    }
  }

  registerFallbackTicketTags()
}

async function loadMeta(token: string): Promise<void> {
  if (metaLoaded) return
  const h = zHeaders(token)
  try {
    const stR = await zammadFetch(`${ZAMMAD_BASE}/api/v1/ticket_states`, { headers: h })
    if (stR.ok) {
      const list = await stR.json() as { id: number; name: string }[]
      list.forEach(s => {
        meta.states[s.id] = STATE_RU[s.name] ?? s.name
      })
    } else {
      logger.error(`Ошибка загрузки состояний: ${stR.status}`)
    }

    const prR = await zammadFetch(`${ZAMMAD_BASE}/api/v1/ticket_priorities`, { headers: h })
    if (prR.ok) {
      const PRIO_RU: Record<string, string> = {
        '1 low': 'Низкий',
        '2 normal': 'Обычный',
        '3 high': 'Высокий',
        '4 critical': 'Высокий'
      }
      const pl = await prR.json() as { id: number; name: string }[]
      pl.forEach(p => {
        meta.priorities[p.id] = PRIO_RU[p.name] ?? p.name
      })
    } else {
      logger.error(`Ошибка загрузки приоритетов: ${prR.status}`)
    }

    await loadTicketTypes(h)
    await loadIikoReasons(h)
    await loadTicketTags(h)

    const agR = await zammadFetch(`${ZAMMAD_BASE}/api/v1/users/search?query=role:Agent&per_page=150`, { headers: h })
    if (agR.ok) {
      const agData = await agR.json()
      logger.info(`Успешно загружено агентов: ${Array.isArray(agData) ? agData.length : (agData?.users?.length ?? 0)}`)
      if (Array.isArray(agData)) {
        agData.forEach(u => {
          registerUser(u, true)
        })
      } else if (agData && typeof agData === 'object') {
        const usersList = Array.isArray(agData.users) ? agData.users : []
        usersList.forEach((u: any) => {
          registerUser(u, true)
        })
        registerUsersFromAssets(agData.assets)
      }
    } else {
      logger.error(`Ошибка поиска агентов: ${agR.status}`)
      const errText = await agR.text().catch(() => '')
      logger.error(`Детали ошибки: ${errText}`)
    }

    await loadDenvicUsers(h)
    await applyClientsAgentNames()

    metaLoaded = true
  } catch (err) {
    logger.error('Исключение при загрузке метаданных:', err)
  }
}

let clientsAgentNamesCache: { at: number; names: Map<number, string> } | null = null

// Zammad stores many agents without firstname/lastname, so their name degrades
// to a transliterated login ("Podgajnyj"). clients keeps the real names in the
// owner picker of its create form, keyed by the same user ids the app already
// posts there.
async function fetchClientsAgentNames(): Promise<Map<number, string>> {
  if (clientsAgentNamesCache && Date.now() - clientsAgentNamesCache.at < 30 * 60_000) {
    return clientsAgentNamesCache.names
  }

  const names = new Map<number, string>()
  try {
    await ensureClientsSession()
    const resp = await net.fetch(`${WRAPPER_BASE}/Tickets/Create`, {
      session: wrapperSession(),
      headers: { 'User-Agent': CLIENTS_USER_AGENT }
    } as any)
    if (resp.ok) {
      const html = await resp.text()
      const select = html.match(/<select[^>]*id="selectedUserId"[\s\S]*?<\/select>/i)?.[0] ?? ''
      for (const option of select.matchAll(/<option[^>]*value="(\d+)"[^>]*>([\s\S]*?)<\/option>/gi)) {
        const userId = parseInt(option[1], 10)
        const name = decodeHtml(stripHtml(option[2])).trim()
        if (userId > 0 && name) names.set(userId, name)
      }
    }
  } catch (err) {
    logger.warn('Не удалось получить имена сотрудников из clients:', err)
  }

  if (names.size > 0) {
    clientsAgentNamesCache = { at: Date.now(), names }
    return names
  }
  return clientsAgentNamesCache?.names ?? names
}

// Only names that degraded to a login are replaced — a real name in Zammad
// always wins.
async function applyClientsAgentNames(): Promise<void> {
  const needsName = Object.keys(meta.users)
    .map(Number)
    .filter(id => id > 0 && isFallbackUserName(meta.users[id]))
  if (needsName.length === 0) return

  const names = await fetchClientsAgentNames()
  if (names.size === 0) return

  let replaced = 0
  for (const userId of needsName) {
    const name = names.get(userId)
    if (name && name !== meta.users[userId]) {
      meta.users[userId] = name
      replaced += 1
    }
  }
  if (replaced > 0) {
    logger.info(`Имена сотрудников уточнены по данным clients: ${replaced}`)
  }
}

async function ensureUsersLoaded(userIds: number[]): Promise<void> {
  const token = getToken()
  const h = zHeaders(token)
  const missingIds = Array.from(new Set(userIds))
    .filter(id => id > 0 && (!meta.usersLoaded[id] || !meta.users[id]))
  if (missingIds.length === 0) return

  const batchSize = 50
  for (let i = 0; i < missingIds.length; i += batchSize) {
    const batch = missingIds.slice(i, i + batchSize)
    const query = `id:(${batch.join(' OR ')})`
    try {
      const url = new URL(`${ZAMMAD_BASE}/api/v1/users/search`)
      url.searchParams.set('query', query)
      url.searchParams.set('per_page', String(batch.length))
      const resp = await zammadFetch(url.toString(), { headers: h })
      if (resp.ok) {
        const agData = await resp.json()
        const usersList = Array.isArray(agData) ? agData : (Array.isArray(agData?.users) ? agData.users : [])
        usersList.forEach((u: any) => {
          const userId = Number(u.id)
          meta.users[userId] = cleanUserName(u.firstname, u.lastname, u.login, userId)
          meta.usersLoaded[userId] = true
          meta.usersActive[userId] = u.active !== false
          const login = String(u.login || u.email || '').trim()
          if (login) meta.userLogins[userId] = login
          const email = String(u.email || u.login || '').toLowerCase()
          const isAgentRole = Array.isArray(u.roles) && u.roles.some((r: any) => {
            const nr = String(r).toLowerCase()
            return nr === 'agent' || nr === 'admin'
          })
          const hasDenvicEmail = email.endsWith('@denvic.ru')
          meta.agents[userId] = isAgentRole || hasDenvicEmail
        })
      }
    } catch (err) {
      logger.warn('Не удалось загрузить недостающих пользователей:', err)
    }
  }

  await applyClientsAgentNames()
}

async function getUserId(): Promise<number | null> {
  if (cachedUserId) return cachedUserId
  try {
    const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/users/me`, { headers: zHeaders(getToken()) })
    if (!resp.ok) return null
    const me = await resp.json() as { id: number; firstname?: string; lastname?: string; login?: string }
    cachedUserId = me.id
    meta.users[me.id] = cleanUserName(me.firstname, me.lastname, me.login, me.id)
    meta.usersLoaded[me.id] = true
    meta.agents[me.id] = true
    return me.id
  } catch {
    return null
  }
}

function extractUserImageHash(user: any): string | null {
  const candidates = [
    user?.image,
    user?.avatar,
    user?.preferences?.image,
    user?.preferences?.avatar,
    user?.preferences?.profile_image,
    user?.preferences?.avatar_image,
    user?.preferences?.['image']
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    if (candidate && typeof candidate === 'object') {
      const nested = candidate.url ?? candidate.src ?? candidate.hash ?? candidate.image ?? candidate.full ?? candidate.resize
      if (typeof nested === 'string' && nested.trim()) return nested.trim()
    }
  }

  return null
}

function registerUsersFromAssets(assets: any): void {
  if (assets && assets.User) {
    for (const [id, u] of Object.entries(assets.User)) {
      const userId = Number(id)
      const user = u as { firstname?: string; lastname?: string; login?: string; email?: string; roles?: string[]; image?: string | null; active?: boolean }
      if (user) {
        meta.users[userId] = cleanUserName(user.firstname, user.lastname, user.login, userId)
        meta.usersLoaded[userId] = true
        meta.usersActive[userId] = user.active !== false
        const login = String(user.login || user.email || '').trim()
        if (login) meta.userLogins[userId] = login
        const email = String(user.email || user.login || '').toLowerCase()
        const isAgentRole = Array.isArray(user.roles) && user.roles.some(r => {
          const nr = String(r).toLowerCase()
          return nr === 'agent' || nr === 'admin'
        })
        const hasDenvicEmail = email.endsWith('@denvic.ru')
        meta.agents[userId] = isAgentRole || hasDenvicEmail
        const imageHash = extractUserImageHash(user)
        if (imageHash) {
          meta.userImages[userId] = imageHash
          delete meta.userAvatars[userId]
        } else if (!Object.prototype.hasOwnProperty.call(meta.userImages, userId)) {
          meta.userImages[userId] = null
        }
      }
    }
  }
}

// One person can have more than one live account in Zammad, and both would show
// up in the owner picker as the same name with nothing to choose between them.
// The accounts are kept — tickets do hang on both — but the duplicates get their
// login appended so it is clear which is which.
function dedupeAgentNames(agents: { id: number; name: string }[]): { id: number; name: string }[] {
  const byName = new Map<string, { id: number; name: string }[]>()
  for (const agent of agents) {
    const key = agent.name.trim().toLowerCase()
    const list = byName.get(key)
    if (list) list.push(agent)
    else byName.set(key, [agent])
  }

  const duplicated = Array.from(byName.values()).filter(list => list.length > 1)
  if (duplicated.length > 0) {
    logger.info('Одноимённые сотрудники в списке ответственных:', duplicated.map(list => ({
      name: list[0].name,
      ids: list.map(agent => agent.id)
    })))
  }

  return agents.map(agent => {
    const twins = byName.get(agent.name.trim().toLowerCase()) ?? []
    if (twins.length < 2) return agent
    const login = meta.userLogins[agent.id] || String(agent.id)
    return { id: agent.id, name: `${agent.name} (${login})` }
  })
}

function registerUser(user: any, forceAgent = false): void {
  const userId = Number(user?.id)
  if (!userId) return
  meta.users[userId] = cleanUserName(user.firstname, user.lastname, user.login, userId)
  meta.usersLoaded[userId] = true
  meta.usersActive[userId] = user.active !== false
  const login = String(user.login || user.email || '').trim()
  if (login) meta.userLogins[userId] = login
  const email = String(user.email || user.login || '').toLowerCase()
  const isAgentRole = Array.isArray(user.roles) && user.roles.some((r: any) => {
    const nr = String(r).toLowerCase()
    return nr === 'agent' || nr === 'admin'
  })
  const hasDenvicEmail = email.endsWith('@denvic.ru')
  meta.agents[userId] = forceAgent || isAgentRole || hasDenvicEmail
  const imageHash = extractUserImageHash(user)
  if (imageHash) {
    meta.userImages[userId] = imageHash
    delete meta.userAvatars[userId]
  } else if (!Object.prototype.hasOwnProperty.call(meta.userImages, userId)) {
    meta.userImages[userId] = null
  }
}

async function loadDenvicUsers(h: ReturnType<typeof zHeaders>): Promise<void> {
  const queries = ['email:*@denvic.ru', 'login:*@denvic.ru', 'denvic.ru']
  for (const query of queries) {
    try {
      const url = new URL(`${ZAMMAD_BASE}/api/v1/users/search`)
      url.searchParams.set('query', query)
      url.searchParams.set('per_page', '500')
      const resp = await zammadFetch(url.toString(), { headers: h })
      if (!resp.ok) continue
      const data = await resp.json()
      const usersList = Array.isArray(data) ? data : (Array.isArray(data?.users) ? data.users : [])
      usersList.forEach((u: any) => {
        const email = String(u.email || u.login || '').toLowerCase()
        if (email.endsWith('@denvic.ru')) {
          registerUser(u, email.endsWith('@denvic.ru'))
        }
      })
      registerUsersFromAssets(data?.assets)
    } catch (err) {
      logger.warn('Ошибка загрузки сотрудников Denvic:', err)
    }
  }
}

async function fetchUserAvatarDataUrl(userId: number): Promise<string | null> {
  if (Object.prototype.hasOwnProperty.call(meta.userAvatars, userId)) {
    return meta.userAvatars[userId]
  }

  let imageHash = meta.userImages[userId]
  if (!imageHash) {
    try {
      const userResp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/users/${userId}`, { headers: zHeaders(getToken()) })
      if (userResp.ok) {
        const user = await userResp.json()
        if (user) {
          meta.users[userId] = cleanUserName(user.firstname, user.lastname, user.login, userId) || meta.users[userId] || String(userId)
          meta.usersLoaded[userId] = true
          imageHash = extractUserImageHash(user)
          meta.userImages[userId] = imageHash ?? null
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch Zammad user for avatar:', { userId, err })
    }
  }

  if (!imageHash) {
    meta.userAvatars[userId] = null
    return null
  }

  try {
    if (imageHash.startsWith('data:image/')) {
      meta.userAvatars[userId] = imageHash
      return imageHash
    }

    const urls = imageHash.startsWith('http') || imageHash.startsWith('/')
      ? [new URL(imageHash, ZAMMAD_BASE).toString()]
      : [`${ZAMMAD_BASE}/api/v1/users/image/${encodeURIComponent(imageHash)}`]

    for (const avatarUrl of urls) {
      const resp = await zammadFetch(avatarUrl, { headers: zHeaders(getToken()) })
      if (!resp.ok) continue

      const contentType = resp.headers.get('content-type') || 'image/png'
      if (!contentType.startsWith('image/')) continue

      const bytes = Buffer.from(await resp.arrayBuffer())
      meta.userAvatars[userId] = `data:${contentType};base64,${bytes.toString('base64')}`
      return meta.userAvatars[userId]
    }

    meta.userAvatars[userId] = null
    return null
  } catch (err) {
    logger.warn('Failed to fetch Zammad user avatar:', err)
    meta.userAvatars[userId] = null
    return null
  }
}

async function fetchClientsAvatarDataUrl(url: string): Promise<string | null> {
  const avatarUrl = absoluteClientsUrl(url)
  if (clientsAvatarCache.has(avatarUrl)) {
    return clientsAvatarCache.get(avatarUrl) ?? null
  }

  try {
    const resp = await net.fetch(avatarUrl, { session: wrapperSession() } as any)
    if (!resp.ok) {
      clientsAvatarCache.set(avatarUrl, null)
      return null
    }

    const contentType = resp.headers.get('content-type') || 'image/png'
    if (!contentType.startsWith('image/')) {
      clientsAvatarCache.set(avatarUrl, null)
      return null
    }

    const bytes = Buffer.from(await resp.arrayBuffer())
    const dataUrl = `data:${contentType};base64,${bytes.toString('base64')}`
    clientsAvatarCache.set(avatarUrl, dataUrl)
    return dataUrl
  } catch (err) {
    logger.warn('Failed to fetch clients avatar:', { avatarUrl, err })
    clientsAvatarCache.set(avatarUrl, null)
    return null
  }
}

function normalizeZammadTicket(raw: any): Ticket {
  const groupId = parseInt(String(raw.group_id ?? '0'), 10)
  const groupName = String(raw.group ?? '')
  if (groupId && groupName) {
    meta.groups[groupId] = groupName
  }

  const stateId = parseInt(String(raw.state_id ?? '0'), 10)
  const stateName = meta.states[stateId] || STATE_RU[raw.state] || String(raw.state ?? '')
  if (stateId && stateName && !meta.states[stateId]) {
    meta.states[stateId] = stateName
  }

  const priorityId = parseInt(String(raw.priority_id ?? '0'), 10)
  const priorityName = meta.priorities[priorityId] || String(raw.priority ?? '')

  const ownerId = parseInt(String(raw.owner_id ?? '0'), 10) || null
  if (ownerId && ownerId !== 1) {
    meta.agents[ownerId] = true
    if (!meta.users[ownerId] && raw.owner) {
      meta.users[ownerId] = cleanUserName(undefined, undefined, String(raw.owner), ownerId)
      meta.usersLoaded[ownerId] = !isFallbackUserName(meta.users[ownerId])
    }
  }
  const ownerName = ownerId && meta.users[ownerId] ? meta.users[ownerId] : String(raw.owner ?? '')

  const orgId = parseInt(String(raw.organization_id ?? '0'), 10) || null
  const orgName = String(raw.organization ?? '').replace(/\([^)]+\)/g, '').trim()
  const ticketTypeId = raw.type === null || raw.type === undefined ? null : String(raw.type).trim()
  const ticketTypeName = getTicketTypeName(ticketTypeId)
  const iikoReasons = getIikoReasons(raw)
  const tags = getTicketTags(raw)

  const pendingTime = raw.pending_time ? String(raw.pending_time) : null
  // clients awards halves ("01.5"), so parseInt turned 1,5 балла into 1 — the
  // list looked like the change had not applied.
  const rawScore = raw.score !== null && raw.score !== undefined && raw.score !== '' ? parseFloat(String(raw.score)) : null
  const score = rawScore !== null && Number.isFinite(rawScore) ? rawScore : null
  const rawAccountedTime = raw.accounted_time ?? raw.accountedTime ?? raw.time_unit ?? raw.timeUnit ?? raw.time_units
  const accountedTime = rawAccountedTime !== null && rawAccountedTime !== undefined && rawAccountedTime !== ''
    ? Number(rawAccountedTime)
    : null

  return {
    id: parseInt(String(raw.id ?? '0'), 10),
    number: String(raw.number ?? ''),
    clientNumber: pickClientNumberFromZammad(raw),
    title: String(raw.title ?? ''),
    state: { id: stateId, name: stateName },
    priority: { id: priorityId, name: priorityName },
    group: { id: groupId, name: groupName },
    owner: { id: ownerId, name: ownerName },
    organization: { id: orgId, name: orgName },
    ticketType: { id: ticketTypeId, name: ticketTypeName },
    iikoReasons,
    tags,
    createdAt: String(raw.created_at ?? ''),
    updatedAt: String(raw.updated_at ?? raw.created_at ?? ''),
    closedAt: raw.close_at ? String(raw.close_at) : null,
    pendingTime,
    score,
    accountedTime: Number.isFinite(accountedTime) ? accountedTime : null,
    channel: raw.create_article_type ? String(raw.create_article_type) : null,
    checkInErp: raw.check_in_erp === true || raw.check_in_erp === 'true' ? true : (raw.check_in_erp === false || raw.check_in_erp === 'false' ? false : null),
    erpBill: firstString(raw, ['erp_bill']) ?? null,
    bitrixDeal: firstString(raw, ['bitrix_deal', 'bitrix24_deal', 'deal_id', 'bitrix_id']) ?? null,
    iikoCost: firstString(raw, ['ticketcost', 'ticket_cost', 'iiko_cost']) ?? null
  }
}

function firstString(raw: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw?.[key]
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim()
    }
  }
  return null
}

function pickClientNumberFromZammad(raw: any): string | null {
  return firstString(raw, [
    'client_number',
    'clientNumber',
    'clients_number',
    'clientsNumber',
    'wrapper_number',
    'wrapperNumber',
    'ticket_id',
    'ticketId',
    'TicketId',
    'Number'
  ])
}

function pickClientsNumber(raw: any): string | null {
  return firstString(raw, ['number', 'Number', 'id', 'Id', 'ticketId', 'TicketId'])
}

function pickClientsZammadId(raw: any): string | null {
  return firstString(raw, ['zammadId', 'ZammadId', 'zammad_id', 'ZammadTicketId', 'ticketZammadId'])
}

function pickClientsZammadNumber(raw: any): string | null {
  return firstString(raw, ['zammadNumber', 'ZammadNumber', 'zammad_number', 'TicketNumber', 'ticketNumber'])
}

function getClientsTicketsFromPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['tickets', 'Tickets', 'data', 'Data', 'items', 'Items', 'rows', 'Rows']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  return []
}

function addClientsTicketToIndex(index: ClientsTicketIndex, raw: any): void {
  const clientNumber = pickClientsNumber(raw)
  if (!clientNumber) return
  const zammadId = pickClientsZammadId(raw)
  const zammadNumber = pickClientsZammadNumber(raw)
  if (zammadId) index.byZammadId.set(zammadId, clientNumber)
  if (zammadNumber) index.byZammadNumber.set(zammadNumber, clientNumber)
  index.byClientNumber.set(clientNumber, {
    zammadId: zammadId ?? undefined,
    zammadNumber: zammadNumber ?? undefined
  })
}

async function fetchClientsTicketIndex(): Promise<ClientsTicketIndex> {
  const cached = clientsIndexCache
  if (cached && cached.expiresAt > Date.now()) return cached.index

  const index: ClientsTicketIndex = {
    byZammadId: new Map(),
    byZammadNumber: new Map(),
    byClientNumber: new Map()
  }

  try {
    const ses = wrapperSession()
    const cookies = await ses.cookies.get({ url: WRAPPER_BASE })
    if (!cookies.some(c => c.name === '.AspNetCore.Identity.Application')) {
      clientsIndexCache = { expiresAt: Date.now() + 60_000, index }
      return index
    }

    await Promise.all(CLIENTS_FILTER_IDS.map(async (filterId) => {
      try {
        const url = new URL(`${WRAPPER_BASE}/Tickets/GetTickets`)
        url.searchParams.set('id', String(filterId))
        url.searchParams.set('ticketsPerPage', '100')
        url.searchParams.set('page', '1')
        url.searchParams.set('columnSort', 'updatedAt')
        url.searchParams.set('sortingDirectionAsc', 'false')
        const resp = await net.fetch(url.toString(), { session: ses } as any)
        if (!resp.ok) return
        const payload = await resp.json()
        getClientsTicketsFromPayload(payload).forEach(ticket => addClientsTicketToIndex(index, ticket))
      } catch (err) {
        logger.warn('Failed to read clients ticket list:', err)
      }
    }))
  } catch (err) {
    logger.warn('Failed to build clients ticket index:', err)
  }

  clientsIndexCache = { expiresAt: Date.now() + 5 * 60_000, index }
  return index
}

function applyClientsNumbers(tickets: Ticket[], index: ClientsTicketIndex): Ticket[] {
  return tickets.map(ticket => ({
    ...ticket,
    clientNumber:
      ticket.clientNumber ||
      index.byZammadId.get(String(ticket.id)) ||
      index.byZammadNumber.get(ticket.number) ||
      null
  }))
}



function getIikoReasons(raw: any): TicketReasonItem[] {
  return ticketReasonIds(raw, meta.iikoReasonField).map(id => ({
    id,
    name: meta.iikoReasons[id] ?? id
  }))
}


function getTicketTags(raw: any): TicketTagItem[] {
  return ticketTagIds(raw).map(id => ({
    id,
    name: meta.tags[id] ?? id
  }))
}





async function getActiveTickets(myUserId: number, token: string): Promise<{ tickets: any[]; assets: any }> {
  const now = Date.now()
  if (activeTicketsCache && activeTicketsCache.userId === myUserId && (now - activeTicketsCache.timestamp) < ACTIVE_TICKETS_TTL) {
    return {
      tickets: activeTicketsCache.tickets,
      assets: activeTicketsCache.assets
    }
  }

  const h = zHeaders(token)
  const query = `owner_id:${myUserId} AND NOT state:(closed OR merged OR removed)`
  const url = new URL(`${ZAMMAD_BASE}/api/v1/tickets/search`)
  url.searchParams.set('query', query)
  url.searchParams.set('per_page', '250')
  url.searchParams.set('expand', 'true')

  const resp = await zammadFetch(url.toString(), { headers: h })
  if (!resp.ok) {
    if (activeTicketsCache && activeTicketsCache.userId === myUserId) {
      return {
        tickets: activeTicketsCache.tickets,
        assets: activeTicketsCache.assets
      }
    }
    throw new Error(`Ошибка загрузки активных заявок: ${resp.status}`)
  }

  const data = await resp.json()
  let rawTickets: any[] = []
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    rawTickets = Array.isArray(data.tickets) ? data.tickets : []
  } else if (Array.isArray(data)) {
    rawTickets = data
  }

  activeTicketsCache = {
    userId: myUserId,
    tickets: rawTickets,
    assets: data?.assets,
    timestamp: now
  }

  return {
    tickets: rawTickets,
    assets: data?.assets
  }
}





async function executeFetchZammadTickets(params: TicketListParams): Promise<TicketListResponse> {
  const token = getToken()
  const h = zHeaders(token)

  const filters = readFilters()
  const filter = filters.find(f => f.wrapperId === params.wrapperId)
  const cond = filter?.conditions ?? {}
  const myUserId = await getUserId()

  let rawTickets: any[] = []
  let assets: any = null

  if (params.myTicketsStateId) {
    if (myUserId) {
      const cached = await getActiveTickets(myUserId, token)
      rawTickets = cached.tickets
      assets = cached.assets
    }
  } else {
    let query = ''
    if (params.searchQuery && params.searchQuery.trim()) {
      const s = params.searchQuery.trim()
      if (/^\d+$/.test(s)) {
        const clientsIndex = await fetchClientsTicketIndex()
        const mapped = clientsIndex.byClientNumber.get(s)
        const parts = [`id:${s}`, `number:${s}`, `"${s}"`]
        if (mapped?.zammadId) parts.push(`id:${mapped.zammadId}`)
        if (mapped?.zammadNumber) parts.push(`number:${mapped.zammadNumber}`, `"${mapped.zammadNumber}"`)
        query = parts.join(' OR ')
      } else {
        query = `"${s}" OR ${s}`
      }
    } else {
      query = filter?.query || ''
      if (!query) {
        query = buildZammadQuery(cond, myUserId)
      } else {
        query = query.replace(/{my_id}/g, String(myUserId ?? '0'))
      }
    }

    const periodQuery = dateRangeQuery(params.createdFrom, params.createdTo, params.dateField)
    if (periodQuery) {
      query = query.trim() ? `(${query}) AND ${periodQuery}` : periodQuery
    }

    const SORT_FIELD_MAP: Record<string, string> = {
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      number: 'id',
      id: 'id'
    }
    const sortBy = SORT_FIELD_MAP[params.sortField] ?? 'updated_at'
    const orderBy = params.sortAsc ? 'asc' : 'desc'

    const url = new URL(`${ZAMMAD_BASE}/api/v1/tickets/search`)
    url.searchParams.set('query', query)
    url.searchParams.set('page', String(params.page))
    url.searchParams.set('per_page', String(params.perPage))
    url.searchParams.set('sort_by', sortBy)
    url.searchParams.set('order_by', orderBy)
    url.searchParams.set('expand', 'true')
    url.searchParams.set('with_total_count', 'true')

    const resp = await zammadFetch(url.toString(), { headers: h })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      logger.error('Ошибка загрузки заявок:', { status: resp.status, text: text.slice(0, 300) })
      throw new Error(describeHttpError(resp.status, text, 'Не удалось загрузить заявки'))
    }

    const data = await resp.json()
    assets = data?.assets
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      rawTickets = Array.isArray(data.tickets) ? data.tickets : []
    } else if (Array.isArray(data)) {
      rawTickets = data
    }
  }

  registerUsersFromAssets(assets)

  let filteredRaw = rawTickets
  if (params.myTicketsStateId !== undefined) {
    filteredRaw = rawTickets.filter(t => parseInt(String(t.state_id ?? '0'), 10) === params.myTicketsStateId)
  } else if (!(params.searchQuery && params.searchQuery.trim())) {
    filteredRaw = filterTicketsLocally(rawTickets, cond, myUserId)
  }

  // The cached "my tickets" path never went through the search query, and the
  // search index can be a moment behind, so the period is enforced here too.
  if (params.createdFrom || params.createdTo) {
    filteredRaw = filteredRaw.filter(t => isInDateRange(t, params.createdFrom, params.createdTo, params.dateField))
  }

  const ownerIds = filteredRaw.map(t => parseInt(String(t.owner_id ?? '0'), 10)).filter(id => id > 0)
  await ensureUsersLoaded(ownerIds)

  let total = filteredRaw.length
  if (!params.myTicketsStateId) {
    if (rawTickets.length === params.perPage) {
      total = params.page * params.perPage + 1
    } else {
      total = (params.page - 1) * params.perPage + filteredRaw.length
    }
  }

  const clientsIndex = await fetchClientsTicketIndex()
  let tickets: Ticket[] = []

  if (params.myTicketsStateId) {
    const allNormalized = filteredRaw.map(normalizeZammadTicket)
    const field = params.sortField
    const asc = params.sortAsc
    allNormalized.sort((a: any, b: any) => {
      let va = a[field]
      let vb = b[field]
      if (field === 'state' || field === 'priority' || field === 'group' || field === 'owner' || field === 'organization') {
        va = a[field]?.name ?? ''
        vb = b[field]?.name ?? ''
      } else if (field === 'ticketType') {
        va = a.ticketType?.name ?? ''
        vb = b.ticketType?.name ?? ''
      } else if (field === 'iikoReasons') {
        va = (a.iikoReasons ?? []).map((reason: TicketReasonItem) => reason.name).join(', ')
        vb = (b.iikoReasons ?? []).map((reason: TicketReasonItem) => reason.name).join(', ')
      } else if (field === 'tags') {
        va = (a.tags ?? []).map((tag: TicketTagItem) => tag.name).join(', ')
        vb = (b.tags ?? []).map((tag: TicketTagItem) => tag.name).join(', ')
      }
      if (va === null || va === undefined) return asc ? 1 : -1
      if (vb === null || vb === undefined) return asc ? -1 : 1
      if (va < vb) return asc ? -1 : 1
      if (va > vb) return asc ? 1 : -1
      return 0
    })

    const pageRaw = allNormalized.slice((params.page - 1) * params.perPage, params.page * params.perPage)
    tickets = applyClientsNumbers(pageRaw, clientsIndex)
  } else {
    const pageRaw = filteredRaw
    const ticketsRaw = pageRaw.map(normalizeZammadTicket)
    tickets = applyClientsNumbers(ticketsRaw, clientsIndex)

    const SORT_FIELD_MAP: Record<string, string> = {
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      number: 'id',
      id: 'id'
    }
    if (params.sortField && !SORT_FIELD_MAP[params.sortField]) {
      const field = params.sortField
      const asc = params.sortAsc
      tickets.sort((a: any, b: any) => {
        let va = a[field]
        let vb = b[field]
        if (field === 'state' || field === 'priority' || field === 'group' || field === 'owner' || field === 'organization') {
          va = a[field]?.name ?? ''
          vb = b[field]?.name ?? ''
        } else if (field === 'ticketType') {
          va = a.ticketType?.name ?? ''
          vb = b.ticketType?.name ?? ''
        } else if (field === 'iikoReasons') {
          va = (a.iikoReasons ?? []).map((reason: TicketReasonItem) => reason.name).join(', ')
          vb = (b.iikoReasons ?? []).map((reason: TicketReasonItem) => reason.name).join(', ')
        } else if (field === 'tags') {
          va = (a.tags ?? []).map((tag: TicketTagItem) => tag.name).join(', ')
          vb = (b.tags ?? []).map((tag: TicketTagItem) => tag.name).join(', ')
        }
        if (va < vb) return asc ? -1 : 1
        if (va > vb) return asc ? 1 : -1
        return 0
      })
    }
  }

  const totalPages = Math.max(params.page, Math.ceil(total / params.perPage))
  return { tickets, total, page: params.page, totalPages }
}

async function fetchZammadTickets(params: TicketListParams): Promise<TicketListResponse> {
  const cacheKey = JSON.stringify(params)
  const cached = ticketListCache.get(cacheKey)
  const now = Date.now()
  if (cached) {
    const age = now - cached.timestamp
    if (age < 5000) {
      return cached.data
    } else if (age < LIST_CACHE_TTL) {
      executeFetchZammadTickets(params).then(data => {
        ticketListCache.set(cacheKey, { data, timestamp: Date.now() })
        notifyFrontend('tickets:list-updated')
      }).catch(() => {})
      return cached.data
    }
  }
  const data = await executeFetchZammadTickets(params)
  ticketListCache.set(cacheKey, { data, timestamp: Date.now() })
  return data
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '')
}

function pickRawValue(raw: any, keys: string[]): any {
  if (!raw || typeof raw !== 'object') return null
  const wanted = keys.map(normalizeKey)
  const entries = Object.entries(raw)
  for (const [key, value] of entries) {
    const normalized = normalizeKey(key)
    if (wanted.some(w => normalized === w || normalized.includes(w) || w.includes(normalized))) {
      if (value !== null && value !== undefined && String(value).trim() !== '') return value
    }
  }
  return null
}

function pickString(raw: any, keys: string[]): string | null {
  const value = pickRawValue(raw, keys)
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || null
  if (typeof value === 'object') return String(value.name ?? value.title ?? value.login ?? JSON.stringify(value))
  const text = String(value).trim()
  return text || null
}

function pickNumber(raw: any, keys: string[]): number {
  const value = pickRawValue(raw, keys)
  if (value === null || value === undefined || value === '') return 0
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function pickNullableNumber(raw: any, keys: string[]): number | null {
  const value = pickRawValue(raw, keys)
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : null
}

function pickBool(raw: any, keys: string[]): boolean {
  const value = pickRawValue(raw, keys)
  if (typeof value === 'boolean') return value
  const text = String(value ?? '').toLowerCase()
  return ['true', '1', 'yes', 'да', 'vip'].includes(text)
}

function normalizeOrganization(raw: any): OrganizationDetails {
  return {
    id: parseInt(String(raw.id ?? '0'), 10),
    name: String(raw.name ?? raw.fullname ?? ''),
    active: raw.active !== false,
    vip: pickBool(raw, ['vip', 'is_vip', 'important', 'важный']),
    responsible_group: pickString(raw, ['responsible_group', 'service_group', 'support_group', 'группа_обслуживания', 'группа обслуживания']),
    manager: pickString(raw, ['manager', 'account_manager', 'менеджер', 'ответственный_менеджер']),
    contracts: pickString(raw, ['contracts', 'contract', 'договора', 'договоры']),
    contracts_and_comments: pickString(raw, ['contracts_and_comments', 'contract_comments', 'договоры_и_комментарии', 'комментарии_по_договорам']),
    sum_debt: pickNumber(raw, ['sum_debt', 'debt', 'задолженность', 'долг']),
    deposit_balance_minutes: pickNullableNumber(raw, ['deposit_balance_minutes', 'deposit_minutes', 'остаток_на_депозите_мин', 'остаток на депозите', 'депозит']),
    note: pickString(raw, ['note', 'notes', 'comment', 'comments', 'заметка', 'комментарий']),
    link_wiki: pickString(raw, ['link_wiki', 'wiki', 'wiki_url', 'ссылка_wiki']),
    keepass: pickString(raw, ['keepass', 'keepass_url', 'кипасс']),
    phone: pickString(raw, ['phone', 'telephone', 'телефон']),
    email: pickString(raw, ['email', 'mail', 'почта', 'электронная почта'])
  }
}

function normalizeOrganizationMember(raw: any): OrganizationMember {
  return {
    id: parseInt(String(raw.id ?? '0'), 10),
    firstname: String(raw.firstname ?? ''),
    lastname: String(raw.lastname ?? ''),
    email: pickString(raw, ['email', 'login']),
    phone: pickString(raw, ['phone', 'phone_office', 'телефон', 'номер_телефона']),
    mobile: pickString(raw, ['mobile', 'mobile_phone', 'мобильный']),
    department: pickString(raw, ['department', 'отдел', 'unit', 'division']),
    max: pickString(raw, ['max', 'max_login', 'max_id', 'макс']),
    telegram: pickString(raw, ['telegram', 'telegram_login', 'tg', 'телеграм'])
  }
}

async function executeFetchOrgs(query: string, page = 1, perPage = 50): Promise<OrganizationDetails[]> {
  const token = getToken()
  const url = new URL(`${ZAMMAD_BASE}/api/v1/organizations/search`)
  url.searchParams.set('query', query || '*')
  url.searchParams.set('page', String(page))
  url.searchParams.set('per_page', String(perPage))
  url.searchParams.set('expand', 'true')
  const resp = await zammadFetch(url.toString(), { headers: zHeaders(token) })
  if (!resp.ok) return []
  const payload = await resp.json()
  const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.organizations) ? payload.organizations : [])
  return list.map(normalizeOrganization)
}

async function fetchOrgs(query: string, page = 1, perPage = 50): Promise<OrganizationDetails[]> {
  const cacheKey = JSON.stringify({ query, page, perPage })
  const cached = orgListCache.get(cacheKey)
  const now = Date.now()
  if (cached) {
    const age = now - cached.timestamp
    if (age < 5000) {
      return cached.data
    } else if (age < ORG_LIST_CACHE_TTL) {
      executeFetchOrgs(query, page, perPage).then(data => {
        orgListCache.set(cacheKey, { data, timestamp: Date.now() })
        notifyFrontend('organizations:list-updated')
      }).catch(() => {})
      return cached.data
    }
  }
  const data = await executeFetchOrgs(query, page, perPage)
  orgListCache.set(cacheKey, { data, timestamp: Date.now() })
  return data
}

async function executeFetchOrgMembers(orgId: number): Promise<OrganizationMember[]> {
  const token = getToken()
  const url = new URL(`${ZAMMAD_BASE}/api/v1/users/search`)
  url.searchParams.set('query', `organization_id:${orgId}`)
  url.searchParams.set('per_page', '500')
  url.searchParams.set('expand', 'true')
  const resp = await zammadFetch(url.toString(), { headers: zHeaders(token) })
  if (!resp.ok) return []
  const payload = await resp.json()
  const list = Array.isArray(payload) ? payload : (Array.isArray(payload?.users) ? payload.users : [])
  return list.map(normalizeOrganizationMember)
}

async function fetchOrgMembers(orgId: number): Promise<OrganizationMember[]> {
  const cached = orgMembersCache.get(orgId)
  const now = Date.now()
  if (cached) {
    const age = now - cached.timestamp
    if (age < 5000) {
      return cached.data
    } else if (age < ORG_MEMBERS_CACHE_TTL) {
      executeFetchOrgMembers(orgId).then(data => {
        orgMembersCache.set(orgId, { data, timestamp: Date.now() })
        notifyFrontend('organizations:members-updated', orgId)
      }).catch(() => {})
      return cached.data
    }
  }
  const data = await executeFetchOrgMembers(orgId)
  orgMembersCache.set(orgId, { data, timestamp: Date.now() })
  return data
}

async function executeFetchOrgTickets(orgId: number): Promise<Ticket[]> {
  const token = getToken()
  const h = zHeaders(token)
  const url = new URL(`${ZAMMAD_BASE}/api/v1/tickets/search`)
  url.searchParams.set('query', `organization_id:${orgId}`)
  url.searchParams.set('per_page', '500')
  url.searchParams.set('expand', 'true')
  const resp = await zammadFetch(url.toString(), { headers: h })
  if (!resp.ok) return []
  const data = await resp.json()
  registerUsersFromAssets(data?.assets)
  let rawTickets: any[] = []
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    rawTickets = Array.isArray(data.tickets) ? data.tickets : []
  } else if (Array.isArray(data)) {
    rawTickets = data
  }
  const ownerIds = rawTickets.map(t => parseInt(String(t.owner_id ?? '0'), 10)).filter(id => id > 0)
  await ensureUsersLoaded(ownerIds)
  const clientsIndex = await fetchClientsTicketIndex()
  return applyClientsNumbers(rawTickets.map(normalizeZammadTicket), clientsIndex)
}

async function fetchOrgTickets(orgId: number): Promise<Ticket[]> {
  const cached = orgTicketsCache.get(orgId)
  const now = Date.now()
  if (cached) {
    const age = now - cached.timestamp
    if (age < 5000) {
      return cached.data
    } else if (age < ORG_TICKETS_CACHE_TTL) {
      executeFetchOrgTickets(orgId).then(data => {
        orgTicketsCache.set(orgId, { data, timestamp: Date.now() })
        notifyFrontend('organizations:tickets-updated', orgId)
      }).catch(() => {})
      return cached.data
    }
  }
  const data = await executeFetchOrgTickets(orgId)
  orgTicketsCache.set(orgId, { data, timestamp: Date.now() })
  return data
}

function absoluteClientsUrl(url: string): string {
  return new URL(url, WRAPPER_BASE).toString()
}

async function ensureClientsSession(): Promise<void> {
  if (await isWrapperSessionAlive()) return

  const stored = readStored()
  if (!stored.savedEmail || !stored.savedPassword) {
    throw new Error('Сессия clients не активна. Выполните вход заново.')
  }

  try {
    logger.info('Clients session is not alive, refreshing it before calls request...')
    await loginWrapper(stored.savedEmail, stored.savedPassword)
  } catch (err) {
    logger.warn('Failed to refresh clients session:', err)
    throw new Error('Не удалось восстановить сессию clients. Выполните вход заново.')
  }
}

function getPayloadItems(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const key of ['calls', 'Calls', 'data', 'Data', 'items', 'Items', 'rows', 'Rows']) {
    if (Array.isArray(payload[key])) return payload[key]
  }
  return []
}

function extractRecordingUrlFromText(raw: any): string | null {
  if (!raw || typeof raw !== 'object') return null
  for (const [key, value] of Object.entries(raw)) {
    const normalized = normalizeKey(key)
    if (!/(record|recording|audio|запис|play|url|file)/.test(normalized)) continue
    const text = String(value ?? '').trim()
    if (text && /^(https?:\/\/|\/)/.test(text)) return absoluteClientsUrl(text)
  }
  return null
}

function extractCallIdFromUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url, WRAPPER_BASE)
    return parsed.searchParams.get('id') || parsed.searchParams.get('callId')
  } catch {
    return null
  }
}

function recordingUrlFromCallId(callId: string | null): string | null {
  return callId ? absoluteClientsUrl(`/PhoneCalls/GetCallRecord?id=${encodeURIComponent(callId)}`) : null
}

function normalizeCallDirection(text: string): CallRecord['direction'] {
  const n = text.toLowerCase().replace(/ё/g, 'е')
  if (n.includes('пропущ') || n.includes('miss')) return 'missed'
  if (n.includes('исход') || n.includes('out')) return 'out'
  if (n.includes('вход') || n.includes('in')) return 'in'
  return 'unknown'
}

function normalizeCallRecord(raw: any, section: CallSectionKey, sourceUrl: string, index: number): CallRecord {
  const rawMap: Record<string, string> = {}
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw)) {
      rawMap[key] = String(value ?? '')
    }
  }
  const directionText = pickString(raw, ['direction', 'type', 'направление', 'тип', 'status', 'статус']) ?? ''
  const rawRecordingUrl = extractRecordingUrlFromText(raw)
  const callId = pickString(raw, ['id', 'call_id', 'callid', 'звонок']) ?? extractCallIdFromUrl(rawRecordingUrl)
  const recordingUrl = rawRecordingUrl ?? recordingUrlFromCallId(callId)
  const id = `${section}-${index}-${callId ?? 'nocallid'}-${pickString(raw, ['date', 'datetime', 'started_at', 'дата']) ?? ''}`

  return {
    id,
    callId,
    section,
    direction: normalizeCallDirection(directionText),
    phone: (() => {
      const candidates = [
        pickString(raw, ['phone', 'number', 'caller', 'source', 'src', 'источник', 'номер', 'абонент', 'column_2']),
        pickString(raw, ['callee', 'destination', 'dst'])
      ].filter((p): p is string => !!p)
      const externalPhone = candidates.find(p => !/^\d{1,4}$/.test(p.trim().replace(/\D/g, '')))
      return externalPhone || null
    })(),
    client: pickString(raw, ['client', 'customer', 'контакт', 'клиент']),
    organization: pickString(raw, ['organization', 'company', 'организация', 'компания']),
    operator: pickString(raw, ['operator', 'user', 'employee', 'manager', 'answerer', 'answered_by', 'ответчик', 'сотрудник', 'оператор', 'менеджер', 'column_3']),
    startedAt: pickString(raw, ['started_at', 'created_at', 'datetime', 'date', 'time', 'дата', 'время', 'начало', 'column_1']),
    duration: pickString(raw, ['duration', 'length', 'talk_time', 'длительность', 'продолжительность', 'column_4']),
    status: pickString(raw, ['status', 'state', 'result', 'статус', 'результат']) ?? (directionText || null),
    recordingUrl,
    sourceUrl,
    raw: rawMap
  }
}

function isTechnicalAttachment(att: any): boolean {
  const filename = String(att?.filename ?? '').trim().toLowerCase()
  const disposition = String(att?.preferences?.ContentDisposition ?? att?.preferences?.contentDisposition ?? att?.preferences?.['Content-Disposition'] ?? '').toLowerCase()
  return filename === 'message.html' || (filename === 'message.htm' && disposition.includes('inline'))
}

function extractLinks(html: string): { href: string; text: string }[] {
  return Array.from(html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi))
    .map(match => ({
      href: attrValue(match[1], 'href') ?? '',
      text: stripHtml(match[2])
    }))
    .filter(link => link.href)
}

function extractUrlLikeStrings(html: string): string[] {
  const decoded = decodeHtml(html)
  const urls = new Set<string>()

  for (const match of decoded.matchAll(/(?:"|'|`)(\/[^"'`<> ]*PhoneCalls[^"'`<> ]*)(?:"|'|`)/gi)) {
    urls.add(match[1])
  }
  for (const match of decoded.matchAll(/\burl\s*:\s*(?:"|'|`)([^"'`]+)(?:"|'|`)/gi)) {
    if (match[1].includes('PhoneCalls')) urls.add(match[1])
  }
  for (const match of decoded.matchAll(/\b(?:href|src|data-url|data-src)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi)) {
    const value = match[1] ?? match[2] ?? match[3]
    if (value?.includes('PhoneCalls')) urls.add(value)
  }

  return Array.from(urls)
}

function looksLikeCurrentCallsUrl(url: string): boolean {
  const normalized = url.toLowerCase()
  return normalized.includes('phonecalls') && /(current|active|live|online|now|progress|текущ|актив)/i.test(normalized)
}

function findRecordingUrl(rowHtml: string): string | null {
  const sourceMatch = rowHtml.match(/<(?:source|audio)\b[^>]*(?:src|data-src)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
  const sourceUrl = sourceMatch?.[1] ?? sourceMatch?.[2] ?? sourceMatch?.[3]
  if (sourceUrl && /(getcallrecord|record|audio|mp3|wav|ogg)/i.test(sourceUrl)) {
    return absoluteClientsUrl(decodeHtml(sourceUrl))
  }

  const dataUrlMatch = rowHtml.match(/\bdata-(?:url|src|href|record)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i)
  const dataUrl = dataUrlMatch?.[1] ?? dataUrlMatch?.[2] ?? dataUrlMatch?.[3]
  if (dataUrl && /(getcallrecord|record|audio|mp3|wav|ogg)/i.test(dataUrl)) {
    return absoluteClientsUrl(decodeHtml(dataUrl))
  }

  const directMatch = decodeHtml(rowHtml).match(/\/PhoneCalls\/GetCallRecord\?id=([^"'&\s<>]+)/i)
  if (directMatch?.[1]) {
    return recordingUrlFromCallId(directMatch[1])
  }

  const jsCallIdMatch = decodeHtml(rowHtml).match(/(?:GetCallRecord|play|record)[^"'0-9]*["']?([0-9]{6,}(?:\.[0-9]+)?)["']?/i)
  if (jsCallIdMatch?.[1]) {
    return recordingUrlFromCallId(jsCallIdMatch[1])
  }

  const links = extractLinks(rowHtml)
  const link = links.find(item => {
    const target = `${item.href} ${item.text}`.toLowerCase()
    return /(getcallrecord|record|audio|play|download|запис|прослуш|mp3|wav|ogg)/.test(target)
  })
  return link ? absoluteClientsUrl(link.href) : null
}

function parseHtmlTable(tableHtml: string, section: CallSectionKey, sourceUrl: string): CallRecord[] {
  const headerMatch = tableHtml.match(/<thead[\s\S]*?<\/thead>/i)
  const headerSource = headerMatch?.[0] ?? tableHtml.match(/<tr[\s\S]*?<\/tr>/i)?.[0] ?? ''
  const headers = Array.from(headerSource.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)).map(match => stripHtml(match[1]))
  const body = tableHtml.match(/<tbody[\s\S]*?<\/tbody>/i)?.[0] ?? tableHtml
  const rows = Array.from(body.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi))

  const records = rows.map((rowMatch, rowIndex): CallRecord | null => {
    const trHtml = rowMatch[0]
    const trInner = rowMatch[2]

    const cells = Array.from(trInner.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi))
    if (cells.length === 0) return null

    const raw: Record<string, string> = {}
    cells.forEach((cell, cellIndex) => {
      const key = headers[cellIndex] || `column_${cellIndex + 1}`
      raw[key] = stripHtml(cell[1])
    })

    const recordingUrl = findRecordingUrl(trInner)
    if (recordingUrl) raw.recordingUrl = recordingUrl

    const record = normalizeCallRecord(raw, section, sourceUrl, rowIndex)
    if (!record) return null

    const isLinked = trHtml.includes('table-success') || trInner.includes('Открыть заявку')
    let linkedTicketId: string | null = null
    if (isLinked) {
      const ticketLinkMatch = trInner.match(/\/Tickets\/Details\/(\d+)/i)
      if (ticketLinkMatch) {
        linkedTicketId = ticketLinkMatch[1]
      }
    }

    const createCandidates: { clientId: string; name: string }[] = []
    const createMatches = Array.from(trInner.matchAll(/<a\b[^>]*href=["']\/Tickets\/Create\?id=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi))
    createMatches.forEach(match => {
      const clientId = match[1]
      const name = decodeHtml(match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
      if (clientId && name && !createCandidates.some(c => c.clientId === clientId)) {
        createCandidates.push({ clientId, name })
      }
    })

    const bindCandidates: { ticketId: string; name: string }[] = []
    const bindMatches = Array.from(trInner.matchAll(/<a\b[^>]*onclick=["']addCallToTicket\(\s*['"](\d+)['"][^"']*["'][^>]*>([\s\S]*?)<\/a>/gi))
    bindMatches.forEach(match => {
      const ticketId = match[1]
      const name = decodeHtml(match[2].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim())
      if (ticketId && name && !bindCandidates.some(b => b.ticketId === ticketId)) {
        bindCandidates.push({ ticketId, name })
      }
    })

    return {
      ...record,
      isLinked,
      linkedTicketId,
      createCandidates,
      bindCandidates
    }
  }).filter((record): record is CallRecord => !!record && (Object.values(record.raw).some(Boolean) || !!record.isLinked))

  logger.info('PhoneCalls table parsed:', {
    section,
    sourceUrl,
    headers,
    rows: rows.length,
    records: records.length,
    withRecording: records.filter(record => !!record.recordingUrl).length,
    sample: records.slice(0, 3).map(record => ({
      id: record.id,
      callId: record.callId,
      startedAt: record.startedAt,
      phone: record.phone,
      operator: record.operator,
      duration: record.duration,
      recordingUrl: record.recordingUrl,
      rawKeys: Object.keys(record.raw)
    }))
  })

  return records
}

function parsePhoneCallsHtml(html: string, section: CallSectionKey, sourceUrl: string): CallRecord[] {
  const preferredTables = Array.from(html.matchAll(/<table\b[^>]*class=["'][^"']*table-sm[^"']*["'][^>]*>[\s\S]*?<\/table>/gi)).map(match => match[0])
  const tables = preferredTables.length > 0 ? preferredTables : Array.from(html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)).map(match => match[0])
  return tables.flatMap(table => parseHtmlTable(table, section, sourceUrl))
}

function parseCallsHtml(html: string, section: CallSectionKey, sourceUrl: string): CallRecord[] {
  const tables = Array.from(html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)).map(match => match[0])
  const records = tables.flatMap(table => parseHtmlTable(table, section, sourceUrl))
  if (records.length > 0) return records

  const listItems = Array.from(html.matchAll(/<(?:li|div)\b([^>]*)>([\s\S]*?)<\/(?:li|div)>/gi))
    .filter(match => /(call|звон)/i.test(`${match[1]} ${stripHtml(match[2])}`))
    .slice(0, 100)

  return listItems.map((match, index) => {
    const text = stripHtml(match[2])
    const phone = text.match(/(?:\+7|8)?[\s(.-]*\d{3}[\s)._-]*\d{3}[\s._-]*\d{2}[\s._-]*\d{2}/)?.[0] ?? ''
    return normalizeCallRecord({
      text,
      phone,
      recordingUrl: findRecordingUrl(match[2])
    }, section, sourceUrl, index)
  }).filter(record => record.phone || record.raw.text)
}

function normalizeJsonCalls(payload: any, section: CallSectionKey, sourceUrl: string): CallRecord[] {
  return getPayloadItems(payload).map((item, index) => normalizeCallRecord(item, section, sourceUrl, index))
}

async function fetchCallsFromUrl(url: string, section: CallSectionKey): Promise<CallRecord[]> {
  const absoluteUrl = absoluteClientsUrl(url)
  const resp = await net.fetch(absoluteUrl, {
    session: wrapperSession(),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  } as any)
  const contentType = resp.headers.get('content-type') || ''
  // A 404 here is the normal answer for an address clients does not serve, so
  // it is not worth a line in the log; anything else is.
  if (!resp.ok) {
    if (resp.status !== 404) logger.warn('PhoneCalls fetch failed:', { section, url: absoluteUrl, status: resp.status })
    return []
  }

  const body = await resp.text()
  if (contentType.includes('application/json') || body.trim().startsWith('{') || body.trim().startsWith('[')) {
    try {
      return normalizeJsonCalls(JSON.parse(body), section, absoluteUrl)
    } catch {
      return []
    }
  }

  return url.includes('/PhoneCalls') ? parsePhoneCallsHtml(body, section, absoluteUrl) : parseCallsHtml(body, section, absoluteUrl)
}

async function fetchPhoneCalls(section: CallSectionKey, query: string, page: number, perPage: number): Promise<CallRecord[]> {
  const url = new URL(`${WRAPPER_BASE}/PhoneCalls`)
  url.searchParams.set('callsPerPage', String(perPage))
  url.searchParams.set('query', query)
  url.searchParams.set('page', String(page))
  url.searchParams.set('onlyMy', section === 'mine' ? 'true' : 'false')
  const records = await fetchCallsFromUrl(url.toString(), section)
  return records.map(record => ({ ...record, section }))
}

function parseCallDate(str: string): Date | null {
  const m = str.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!m) return null
  return new Date(
    parseInt(m[3], 10),
    parseInt(m[2], 10) - 1,
    parseInt(m[1], 10),
    parseInt(m[4], 10),
    parseInt(m[5], 10),
    parseInt(m[6], 10)
  )
}

// clients answers only one of the addresses below; the rest are 404. Probing all
// of them on every refresh meant dozens of pointless requests a minute, so the
// one that worked is remembered and tried first.
let knownCurrentCallsPath: string | null = null

async function fetchCurrentPhoneCalls(query: string, page: number, perPage: number): Promise<CallRecord[]> {
  const discovered = knownCurrentCallsPath ? [] : await discoverCurrentPhoneCallsUrls()
  const candidates = [
    ...(knownCurrentCallsPath
      ? [`${knownCurrentCallsPath}?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`]
      : []),
    ...discovered,
    `/PhoneCalls/Current?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/Active?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/GetCurrent?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/GetActive?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/GetCurrentCalls?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/GetActiveCalls?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/GetCurrentPhoneCalls?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/GetActivePhoneCalls?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/CurrentCalls?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/ActiveCalls?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/Online?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/GetOnline?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`,
    `/PhoneCalls/GetOnlineCalls?callsPerPage=${perPage}&query=${encodeURIComponent(query)}&page=${page}`
  ]

  const now = new Date()
  for (const url of Array.from(new Set(candidates))) {
    const records = await fetchCallsFromUrl(url, 'current')
    if (records.length > 0) {
      const filtered = records
        .map(record => ({ ...record, section: 'current' as const }))
        .filter(record => {
          if (record.recordingUrl) return false
          if (record.startedAt) {
            const dt = parseCallDate(record.startedAt)
            if (dt) {
              const diffMins = (now.getTime() - dt.getTime()) / 60000
              if (diffMins > 60) return false
            }
          }
          return true
        })
      if (filtered.length > 0) {
        knownCurrentCallsPath = url.split('?')[0]
        return filtered
      }
    }
  }

  // Nothing answered: forget the remembered address so the next refresh looks
  // for it again instead of asking a dead endpoint forever.
  knownCurrentCallsPath = null
  return []
}

async function discoverCurrentPhoneCallsUrls(): Promise<string[]> {
  try {
    const resp = await net.fetch(`${WRAPPER_BASE}/PhoneCalls`, {
      session: wrapperSession(),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    } as any)
    if (!resp.ok) return []

    const html = await resp.text()
    const links = extractLinks(html).map(link => link.href)
    const urlLikes = extractUrlLikeStrings(html)
    const candidates = Array.from(new Set([...links, ...urlLikes])).filter(looksLikeCurrentCallsUrl)

    logger.info('PhoneCalls current discovery:', { candidates })

    return candidates
  } catch (err) {
    logger.warn('Failed to discover current PhoneCalls urls:', err)
    return []
  }
}

async function executeFetchAllCalls(params: { query?: string; page?: number; perPage?: number } = {}): Promise<CallsResponse> {
  await ensureClientsSession()
  const query = params.query?.trim() ?? ''
  const page = params.page ?? 1
  const perPage = params.perPage ?? 100
  const [history, mine, current] = await Promise.all([
    fetchPhoneCalls('history', query, page, perPage),
    fetchPhoneCalls('mine', query, page, perPage),
    fetchCurrentPhoneCalls(query, page, perPage)
  ])

  return {
    history,
    mine,
    current,
    fetchedAt: new Date().toISOString()
  }
}

async function fetchAllCalls(params: { query?: string; page?: number; perPage?: number } = {}): Promise<CallsResponse> {
  const cacheKey = JSON.stringify(params)
  const cached = callsCache.get(cacheKey)
  const now = Date.now()
  if (cached) {
    const age = now - cached.timestamp
    if (age < 3000) {
      return cached.data
    } else if (age < CALLS_CACHE_TTL) {
      executeFetchAllCalls(params).then(data => {
        callsCache.set(cacheKey, { data, timestamp: Date.now() })
        notifyFrontend('calls:updated')
      }).catch(() => {})
      return cached.data
    }
  }
  const data = await executeFetchAllCalls(params)
  callsCache.set(cacheKey, { data, timestamp: Date.now() })
  return data
}

async function fetchCallRecording(url: string, retryOnFail = true): Promise<{ dataUrl: string; contentType: string }> {
  await ensureClientsSession()
  const absoluteUrl = absoluteClientsUrl(url)
  logger.info('PhoneCalls recording fetch start:', { url: absoluteUrl })
  const resp = await net.fetch(absoluteUrl, {
    session: wrapperSession(),
    headers: {
      Accept: 'audio/mpeg,audio/*,*/*',
      Referer: `${WRAPPER_BASE}/PhoneCalls`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  } as any)
  logger.info('PhoneCalls recording response:', {
    url: absoluteUrl,
    status: resp.status,
    contentType: resp.headers.get('content-type') || '',
    contentLength: resp.headers.get('content-length') || ''
  })
  if (!resp.ok) {
    try { await resp.text() } catch {} // consume body to free the connection
    if (retryOnFail) {
      logger.warn('Recording fetch failed with status', resp.status, '— forcing session refresh and retrying')
      const stored = readStored()
      if (stored.savedEmail && stored.savedPassword) {
        try { await loginWrapper(stored.savedEmail, stored.savedPassword) } catch (e) { logger.warn('Session refresh for recording failed:', e) }
        await new Promise(r => setTimeout(r, 600))
        return fetchCallRecording(url, false)
      }
    }
    throw new Error(`Не удалось загрузить запись звонка: ${resp.status}`)
  }

  const responseContentType = resp.headers.get('content-type') || 'audio/mpeg'
  const contentType = responseContentType.includes('application/octet-stream') ? 'audio/mpeg' : responseContentType
  if (contentType.includes('text/html')) {
    const html = await resp.text()
    logger.warn('PhoneCalls recording returned HTML:', {
      url: absoluteUrl,
      length: html.length,
      hasGetCallRecord: /GetCallRecord/i.test(html),
      startsWith: html.slice(0, 180).replace(/\s+/g, ' ')
    })
    const nestedUrl = findRecordingUrl(html)
    if (nestedUrl && nestedUrl !== absoluteUrl) return fetchCallRecording(nestedUrl, false)
    throw new Error('Сервер clients вернул HTML вместо аудио')
  }

  const bytes = Buffer.from(await resp.arrayBuffer())
  logger.info('PhoneCalls recording loaded:', { url: absoluteUrl, bytes: bytes.length, contentType, responseContentType })
  return {
    contentType,
    dataUrl: `data:${contentType};base64,${bytes.toString('base64')}`
  }
}

async function executeFetchTicketDetails(ticketId: number): Promise<{ ticket: Ticket; customer: any; organization: any }> {
  let clientsMeta: ClientsTicketDetailsMeta = {}
  try {
    const html = await fetchTicketHtml(ticketId)
    clientsMeta = parseClientsTicketDetails(html)
  } catch (err) {
    logger.warn('Failed to read clients ticket details:', err)
  }

  const token = getToken()
  const h = zHeaders(token)
  const url = `${ZAMMAD_BASE}/api/v1/tickets/${ticketId}?expand=true`
  const resp = await zammadFetch(url, { headers: h })
  if (!resp.ok) {
    throw new Error(`Ошибка загрузки деталей заявки: ${resp.status}`)
  }
  const raw = await resp.json()
  registerUsersFromAssets(raw?.assets)

  const customerId = raw.customer_id
  let customer: any = null
  if (customerId && raw.assets?.User?.[customerId]) {
    const u = raw.assets.User[customerId]
    customer = {
      id: u.id,
      firstname: u.firstname ?? '',
      lastname: u.lastname ?? '',
      email: u.email ?? '',
      phone: u.phone ?? '',
      mobile: u.mobile ?? '',
      telegram: u.telegram ?? '',
      organization_id: u.organization_id || null
    }
  }
  if (clientsMeta.customer) {
    customer = {
      id: clientsMeta.customer.id ?? customer?.id ?? 0,
      firstname: clientsMeta.customer.firstname ?? customer?.firstname ?? '',
      lastname: clientsMeta.customer.lastname ?? customer?.lastname ?? '',
      email: clientsMeta.customer.email ?? customer?.email ?? '',
      phone: clientsMeta.customer.phone ?? customer?.phone ?? '',
      mobile: clientsMeta.customer.mobile ?? customer?.mobile ?? '',
      telegram: clientsMeta.customer.telegram ?? customer?.telegram ?? '',
      organization_id: customer?.organization_id ?? null
    }
  }

  const orgId = raw.organization_id
  let organization: any = null
  if (orgId && raw.assets?.Organization?.[orgId]) {
    organization = normalizeOrganization(raw.assets.Organization[orgId])
  }
  if (clientsMeta.organization) {
    organization = {
      ...(organization ?? {
        id: clientsMeta.organization.id ?? 0,
        name: '',
        active: true,
        vip: false,
        responsible_group: null,
        manager: null,
        contracts: null,
        contracts_and_comments: null,
        sum_debt: 0,
        deposit_balance_minutes: null,
        note: null,
        link_wiki: null,
        keepass: null,
        phone: null,
        email: null
      }),
      id: clientsMeta.organization.id ?? organization?.id ?? 0,
      name: clientsMeta.organization.name ?? organization?.name ?? '',
      phone: clientsMeta.organization.phone ?? organization?.phone ?? null,
      email: clientsMeta.organization.email ?? organization?.email ?? null,
      contracts: clientsMeta.organization.contracts ?? organization?.contracts ?? null
    }
  }

  const normalized = normalizeZammadTicket(raw)
  if (clientsMeta.title) normalized.title = clientsMeta.title
  normalized.channel = clientsMeta.channel ?? normalizeChannelLabel(normalized.channel) ?? normalized.channel
  if (clientsMeta.tags?.length) normalized.tags = clientsMeta.tags
  if (clientsMeta.subTickets) {
    (normalized as any).subTickets = clientsMeta.subTickets
  }
  // Points: the raw clients value ("01.0") plus who may change it, so the sidebar
  // can offer the same choice clients offers — and only to the same people.
  ;(normalized as any).scoreOptions = clientsMeta.scoreOptions ?? []
  ;(normalized as any).scoreValue = clientsMeta.scoreValue ?? null
  ;(normalized as any).canEditScore = clientsMeta.canEditScore === true
  if (!scoreParseLogged) {
    scoreParseLogged = true
    logger.info('Баллы со страницы clients:', {
      options: clientsMeta.scoreOptions?.length ?? 0,
      value: clientsMeta.scoreValue,
      canEdit: clientsMeta.canEditScore === true
    })
  }
  if (!normalized.clientNumber) {
    try {
      const idx = await fetchClientsTicketIndex()
      normalized.clientNumber =
        idx.byZammadId.get(String(ticketId)) ||
        idx.byZammadNumber.get(normalized.number) ||
        null
    } catch {}
  }
  return { ticket: normalized, customer, organization }
}

async function fetchTicketDetails(ticketId: number): Promise<{ ticket: Ticket; customer: any; organization: any }> {
  const cached = ticketDetailsCache.get(ticketId)
  const now = Date.now()
  if (cached) {
    const age = now - cached.timestamp
    if (age < 5000) {
      return cached.data
    } else if (age < DETAILS_CACHE_TTL) {
      executeFetchTicketDetails(ticketId).then(data => {
        ticketDetailsCache.set(ticketId, { data, timestamp: Date.now() })
        notifyFrontend('tickets:details-updated', ticketId)
      }).catch(() => {})
      return cached.data
    }
  }
  const data = await executeFetchTicketDetails(ticketId)
  ticketDetailsCache.set(ticketId, { data, timestamp: Date.now() })
  return data
}

async function executeFetchTicketArticles(ticketId: number): Promise<any[]> {
  let detailsHtml = ''
  try {
    detailsHtml = await fetchTicketHtml(ticketId)
  } catch (err) {
    logger.warn(err)
  }

  const articleMeta = new Map<number, ClientsArticleMeta>()
  let topAudioMatchId: string | null = null
  if (detailsHtml) {
    const decodedHtml = decodeHtml(detailsHtml)
    const regex = /id="Articles-(\d+)"/g
    const matches = Array.from(decodedHtml.matchAll(regex))
    const firstMatchIndex = matches[0]?.index ?? decodedHtml.length
    const topHtml = decodedHtml.substring(0, firstMatchIndex)
    const topAudioMatch = topHtml.match(/\/PhoneCalls\/GetCallRecord\?id=([^"'&\s<>]+)/i)
    if (topAudioMatch) {
      topAudioMatchId = topAudioMatch[1]
    }
    const findAuthorSide = (startIndex: number): 'left' | 'right' | undefined => {
      const beforeArticle = decodedHtml.substring(Math.max(0, startIndex - 2500), startIndex)
      const authorMatches = Array.from(beforeArticle.matchAll(/<div\s+class="[^"]*\bcol-auto\b[^"]*\border-(first|last)\b[^"]*"[^>]*>\s*<h4\b/gi))
      const order = authorMatches.length > 0 ? authorMatches[authorMatches.length - 1][1] : undefined
      if (order === 'first') return 'left'
      if (order === 'last') return 'right'
      return undefined
    }

    let match: RegExpExecArray | null
    for (let index = 0; index < matches.length; index += 1) {
      match = matches[index] as RegExpExecArray
      const articleId = parseInt(match[1], 10)
      const startIndex = match.index
      const endIndex = matches[index + 1]?.index ?? decodedHtml.length
      const subHtml = decodedHtml.substring(startIndex, endIndex)
      const audioMatch = subHtml.match(/\/PhoneCalls\/GetCallRecord\?id=([^"'&\s<>]+)/i)
      const avatarMatch = subHtml.match(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*\/api\/avatar\/[^"]+)"|'([^']*\/api\/avatar\/[^']+)')/i)
      const displaySide = findAuthorSide(startIndex)
      const meta: ClientsArticleMeta = {}

      if (audioMatch) {
        meta.callRecordId = audioMatch[1]
        meta.callRecordUrl = absoluteClientsUrl(`/PhoneCalls/GetCallRecord?id=${encodeURIComponent(audioMatch[1])}`)
      }
      if (displaySide) {
        meta.displaySide = displaySide
      }
      const avatarUrl = avatarMatch?.[1] ?? avatarMatch?.[2]
      if (avatarUrl) {
        meta.avatarDataUrl = await fetchClientsAvatarDataUrl(avatarUrl)
      }
      if (Object.keys(meta).length > 0) {
        articleMeta.set(articleId, meta)
      }
    }
  }

  const token = getToken()
  const h = zHeaders(token)
  const url = `${ZAMMAD_BASE}/api/v1/ticket_articles/by_ticket/${ticketId}?expand=true`
  const resp = await zammadFetch(url, { headers: h })
  if (!resp.ok) {
    throw new Error(`Ошибка загрузки комментариев: ${resp.status}`)
  }
  const data = await resp.json()
  let articles = Array.isArray(data) ? data : []
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    registerUsersFromAssets(data.assets)
    articles = Array.isArray(data.articles) ? data.articles : []
  }

  const creatorIds = Array.from(new Set(articles
    .map((art: any) => parseInt(String(art.created_by_id || art.user_id || '0'), 10))
    .filter((id: number) => id > 0)))
  await Promise.all(creatorIds.map(id => fetchUserAvatarDataUrl(id)))

  return articles.map((art: any, artIndex: number) => {
    const creatorId = art.created_by_id || art.user_id
    const creatorName = creatorId && meta.users[creatorId] ? meta.users[creatorId] : (art.from ?? 'Неизвестно')
    const attachments = Array.isArray(art.attachments)
      ? art.attachments.filter((att: any) => !isTechnicalAttachment(att)).map((att: any) => ({
          id: att.id,
          filename: att.filename,
          size: att.size,
          mimeType: att.preferences?.['Mime-Type'] ?? att.preferences?.['mime-type'] ?? 'application/octet-stream'
        }))
      : []

    const isAgentSender = String(art.sender || '').toLowerCase() === 'agent'
    const isSystemSender = String(art.sender || '').toLowerCase() === 'system'
    const isInternal = !!art.internal
    const isAgent = isAgentSender || isInternal

    let clientsMeta = articleMeta.get(art.id)
    if (artIndex === 0 && topAudioMatchId) {
      clientsMeta = {
        ...clientsMeta,
        callRecordId: topAudioMatchId,
        callRecordUrl: absoluteClientsUrl(`/PhoneCalls/GetCallRecord?id=${encodeURIComponent(topAudioMatchId)}`)
      }
    }

    return {
      id: art.id,
      ticketId: art.ticket_id,
      body: art.body ?? '',
      contentType: art.content_type ?? 'text/plain',
      type: art.type ?? 'note',
      sender: isAgent ? 'agent' : (isSystemSender ? 'system' : 'customer'),
      internal: isInternal,
      createdAt: art.created_at,
      creatorName,
      creatorAvatarDataUrl: clientsMeta?.avatarDataUrl ?? (creatorId ? meta.userAvatars[creatorId] ?? null : null),
      attachments,
      callRecordId: clientsMeta?.callRecordId,
      callRecordUrl: clientsMeta?.callRecordUrl,
      displaySide: clientsMeta?.displaySide
    }
  })
}

async function fetchTicketArticles(ticketId: number): Promise<any[]> {
  const cached = ticketArticlesCache.get(ticketId)
  const now = Date.now()
  if (cached) {
    const age = now - cached.timestamp
    if (age < 5000) {
      return cached.data
    } else if (age < ARTICLES_CACHE_TTL) {
      executeFetchTicketArticles(ticketId).then(data => {
        ticketArticlesCache.set(ticketId, { data, timestamp: Date.now() })
        notifyFrontend('tickets:articles-updated', ticketId)
      }).catch(() => {})
      return cached.data
    }
  }
  const data = await executeFetchTicketArticles(ticketId)
  ticketArticlesCache.set(ticketId, { data, timestamp: Date.now() })
  return data
}

// Re-exported under explicit names for the ticket export, which needs the same
// data the details page shows.
export const fetchTicketDetailsForExport = (ticketId: number) => fetchTicketDetails(ticketId)
export const fetchTicketArticlesForExport = (ticketId: number) => fetchTicketArticles(ticketId)
export const fetchTicketAttachmentForExport = (ticketId: number, articleId: number, attachmentId: number) =>
  fetchTicketAttachment(ticketId, articleId, attachmentId)

async function fetchTicketAttachment(ticketId: number, articleId: number, attachmentId: number): Promise<{ dataUrl: string; contentType: string }> {
  const token = getToken()
  const h = zHeaders(token)
  const url = `${ZAMMAD_BASE}/api/v1/ticket_attachment/${ticketId}/${articleId}/${attachmentId}`
  const resp = await zammadFetch(url, { headers: h })
  if (!resp.ok) {
    throw new Error(`Ошибка загрузки вложения: ${resp.status}`)
  }
  const contentType = resp.headers.get('content-type') || 'application/octet-stream'
  const bytes = Buffer.from(await resp.arrayBuffer())
  return {
    contentType,
    dataUrl: `data:${contentType};base64,${bytes.toString('base64')}`
  }
}

// Fields that are technical/internal and not useful to display
const HISTORY_FIELD_BLACKLIST = new Set([
  'created',
  'updated_at',
  'email',
  'email_address',
  'email_addresses',
  'last_owner_update_at',
  'cc',
  'bcc',
  'by_customer_id',
  'lock_version',
  'first_response_at',
  'first_response_escal_at',
  'first_response_escalation_at',
  'close_at',
  'close_escal_at',
  'close_escalation_at',
  'update_escal_at',
  'update_escalation_at',
  'escalation_at',
  'last_contact_at',
  'last_contact_customer_at',
  'last_contact_agent_at',
  'created_at'
])

const ZAMMAD_STATE_RU: Record<string, string> = {
  'new': 'Новый',
  'open': 'Открытый',
  'closed': 'Закрыт',
  'pending reminder': 'Отложена (напоминание)',
  'pending action': 'Ожидание действия',
  'pending close': 'Ожидание закрытия',
  'waiting for closure': 'Ожидание закрытия',
  'merged': 'Объединён'
}

function historyFieldName(field: string): string {
  const normalized = field.toLowerCase()
  if (normalized === 'state_id' || normalized === 'state') return 'состояние'
  if (normalized === 'owner_id' || normalized === 'owner') return 'ответственный'
  if (normalized === 'group_id' || normalized === 'group') return 'группа обслуживания'
  if (normalized === 'priority_id' || normalized === 'priority') return 'приоритет'
  if (normalized === 'pending_time') return 'в ожидании до'
  if (normalized === 'type') return 'тип заявки'
  if (normalized === meta.iikoReasonField.toLowerCase() || normalized.includes('reason')) return 'причина обращения'
  if (normalized === 'tags' || normalized === 'tag_list') return 'теги'
  if (normalized === 'title') return 'тема'
  if (normalized === 'customer_id' || normalized === 'customer') return 'клиент'
  if (normalized === 'organization_id' || normalized === 'organization') return 'организация'
  if (normalized === 'body') return 'текст'
  if (normalized === 'note') return 'заметка'
  if (normalized === 'time_unit' || normalized === 'time_units' || normalized === 'timeunit' || normalized === 'accounted_time') return 'затраченное время (мин)'
  return field.replace(/_/g, ' ')
}

function historyValue(field: string, value: any): string | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = field.toLowerCase()
  const text = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value).trim()
  if (!text || text === 'null') return null
  const num = Number(text)
  if ((normalized === 'state_id' || normalized === 'state') && Number.isFinite(num)) return meta.states[num] ?? text
  if (normalized === 'state_id' || normalized === 'state') return ZAMMAD_STATE_RU[text.toLowerCase()] ?? text
  if (normalized === 'owner_id' || normalized === 'owner') {
    if (num === 1 || text === '1') return 'Не назначена'
    return meta.users[num] ?? text
  }
  if ((normalized === 'customer_id' || normalized === 'customer') && Number.isFinite(num)) return meta.users[num] ?? text
  if ((normalized === 'group_id' || normalized === 'group') && Number.isFinite(num)) return meta.groups[num] ?? text
  if ((normalized === 'priority_id' || normalized === 'priority') && Number.isFinite(num)) return meta.priorities[num] ?? text
  if (normalized === 'type') return meta.ticketTypes[text] ?? text
  if (normalized === 'pending_time' && text) {
    try {
      const d = new Date(text)
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      }
    } catch {}
  }
  if (text.length > 120) return text.slice(0, 120) + '…'
  return text
}

async function normalizeHistoryPayload(payload: any): Promise<TicketHistoryItem[]> {
  const assets = payload?.assets ?? payload?.result?.assets
  registerUsersFromAssets(assets)
  const rawList = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.history) ? payload.history
      : (Array.isArray(payload?.histories) ? payload.histories
        : (Array.isArray(payload?.items) ? payload.items : [])))

  const userIds = new Set<number>()
  const filteredList = rawList.filter((item: any) => {
    const attribute = String(item.history_attribute ?? item.attribute ?? item.field ?? item.key ?? '').trim().toLowerCase()
    if (attribute && HISTORY_FIELD_BLACKLIST.has(attribute)) {
      return false
    }

    const type = String(item.type ?? '').toLowerCase()
    const action = String(item.action ?? '').toLowerCase()
    if (type === 'notification' || type === 'email' || type === 'email-out' || type === 'email-in' || action === 'notification') {
      return false
    }

    if (item.sourceable_type === 'Trigger') {
      return false
    }

    if (Number(item.created_by_id) === 1 && item.object === 'Ticket::Article') {
      return false
    }

    return true
  })

  filteredList.forEach((item: any) => {
    const actorId = Number(item.created_by_id ?? item.created_by ?? item.updated_by_id ?? item.user_id ?? 0)
    if (actorId > 0) userIds.add(actorId)

    const attribute = String(item.history_attribute ?? item.attribute ?? item.field ?? item.key ?? '').trim().toLowerCase()
    if (attribute === 'owner_id' || attribute === 'customer_id') {
      const fromVal = Number(item.value_from ?? item.old_value ?? 0)
      const toVal = Number(item.value_to ?? item.new_value ?? 0)
      if (fromVal > 0) userIds.add(fromVal)
      if (toVal > 0) userIds.add(toVal)
    }
  })

  if (userIds.size > 0) {
    await ensureUsersLoaded(Array.from(userIds))
  }

  return filteredList.map((item: any, index: number) => {
    const attribute = String(item.history_attribute ?? item.attribute ?? item.field ?? item.key ?? '').trim()
    const actorId = Number(item.created_by_id ?? item.created_by ?? item.updated_by_id ?? item.user_id ?? 0)
    const actorName = (actorId && meta.users[actorId]) ? meta.users[actorId] : String(item.created_by ?? item.actor ?? item.user ?? 'Система')

    if (attribute) {
      const from = historyValue(attribute, item.value_from ?? item.from ?? item.old_value ?? item.previous_value)
      const to = historyValue(attribute, item.value_to ?? item.to ?? item.new_value ?? item.value)

      return {
        id: String(item.id ?? `${item.created_at ?? index}-${attribute}-${index}`),
        createdAt: String(item.created_at ?? item.createdAt ?? item.updated_at ?? ''),
        actorName,
        action: '',
        fieldName: historyFieldName(attribute),
        from,
        to
      }
    }

    const type = String(item.type ?? '').toLowerCase()
    const actionVal = String(item.action ?? '').toLowerCase()

    let action = 'Изменение заявки'
    if (item.object === 'Ticket' && (type === 'created' || actionVal === 'create')) {
      action = 'Создана заявка'
    } else if (item.object === 'Ticket::Article' && (type === 'created' || type === 'note' || actionVal === 'create')) {
      action = 'Добавлен комментарий'
    } else if (type === 'closed') {
      action = 'Заявка закрыта'
    } else if (type === 'merged') {
      action = 'Заявка объединена'
    } else if (type === 'linked') {
      action = 'Связь создана'
    } else if (type === 'unlinked') {
      action = 'Связь удалена'
    } else {
      const derivedAction = String(item.action ?? item.event ?? item.type ?? 'Изменение заявки')
      const TRANSLATIONS: Record<string, string> = {
        'create': 'Создана заявка',
        'update': 'Заявка обновлена',
        'created': 'Создана заявка',
        'updated': 'Заявка обновлена'
      }
      action = TRANSLATIONS[derivedAction.toLowerCase()] ?? derivedAction
    }

    return {
      id: String(item.id ?? `${item.created_at ?? index}-event-${index}`),
      createdAt: String(item.created_at ?? item.createdAt ?? item.updated_at ?? ''),
      actorName,
      action,
      fieldName: undefined,
      from: null,
      to: null
    }
  })
}

async function fetchTicketHistory(ticketId: number): Promise<TicketHistoryItem[]> {
  const token = getToken()
  const h = zHeaders(token)
  const candidates = [
    `${ZAMMAD_BASE}/api/v1/ticket_history/${ticketId}`,
    `${ZAMMAD_BASE}/api/v1/tickets/${ticketId}/history`,
    `${ZAMMAD_BASE}/api/v1/history/ticket/${ticketId}`,
    `${ZAMMAD_BASE}/api/v1/histories?object=Ticket&o_id=${ticketId}`
  ]

  for (const url of candidates) {
    try {
      const resp = await zammadFetch(url, { headers: h })
      if (!resp.ok) continue
      const payload = await resp.json()
      const normalized = await normalizeHistoryPayload(payload)
      if (normalized.length > 0) return normalized
    } catch (err) {
      logger.warn('Не удалось загрузить историю заявки:', { url, err })
    }
  }

  return []
}

async function addTicketComment(params: AddTicketCommentParams): Promise<{ ok: true }> {
  const token = getToken()
  const rawBody = String(params.body || '').trim()
  const attachments = Array.isArray(params.attachments)
    ? params.attachments.filter(att => att?.filename && att?.data)
    : []
  const body = rawBody || (attachments.length > 0 ? '<p>&nbsp;</p>' : '')
  const payload: Record<string, any> = {}

  if (body || attachments.length > 0) {
    const article: Record<string, any> = {
      type: params.articleType || 'note',
      internal: !!params.internal,
      body,
      content_type: 'text/html'
    }

    if (attachments.length > 0) {
      article.attachments = attachments.map(att => ({
        filename: att.filename,
        data: att.data,
        'mime-type': att.mimeType || 'application/octet-stream'
      }))
    }

    if (params.timeUnit !== null && params.timeUnit !== undefined && Number.isFinite(params.timeUnit) && params.timeUnit > 0) {
      article.time_unit = params.timeUnit
    }

    payload.article = article
  }

  if (params.stateId && params.stateId > 0) {
    payload.state_id = params.stateId
  }
  if (params.ticketTypeId !== undefined) {
    payload.type = params.ticketTypeId || null
  }
  if (params.groupId !== undefined && params.groupId !== null && params.groupId > 0) {
    payload.group_id = params.groupId
  }
  if (params.ownerId !== undefined && params.ownerId !== null && params.ownerId > 0) {
    payload.owner_id = params.ownerId
  }
  if (params.priorityId !== undefined && params.priorityId !== null && params.priorityId > 0) {
    payload.priority_id = params.priorityId
  }
  if (Array.isArray(params.iikoReasonIds)) {
    payload[meta.iikoReasonField] = params.iikoReasonIds
  }
  if (Array.isArray(params.tagIds)) {
    payload.tags = params.tagIds
  }
  if (params.pendingTime) {
    payload.pending_time = params.pendingTime
  }
  if (Object.keys(payload).length === 0) {
    throw new Error('Комментарий не может быть пустым')
  }

  // With attachments the request is streamed so it can be followed and
  // cancelled; without them it is a small JSON body and the plain path is fine.
  const serialized = Buffer.from(JSON.stringify(payload), 'utf8')
  if (attachments.length > 0) {
    const uploaded = await putWithProgress({
      url: `${ZAMMAD_BASE}/api/v1/tickets/${params.ticketId}`,
      headers: zHeaders(token) as Record<string, string>,
      body: serialized,
      uploadId: params.uploadId
    })
    if (!uploaded.ok) {
      logger.error('Ошибка отправки комментария:', { status: uploaded.status, text: uploaded.body.slice(0, 500) })
      throw new Error(describeHttpError(uploaded.status, uploaded.body, 'Не удалось отправить комментарий'))
    }
  } else {
    const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/tickets/${params.ticketId}`, {
      method: 'PUT',
      headers: zHeaders(token),
      body: serialized
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      logger.error('Ошибка отправки комментария:', { status: resp.status, text: text.slice(0, 500) })
      throw new Error(describeHttpError(resp.status, text, 'Не удалось отправить комментарий'))
    }
  }

  await markTicketSelfUpdated(params.ticketId)
  clearTicketCaches(params.ticketId)
  return { ok: true }
}

// The right to award points is a clients rule, and Zammad would happily accept
// the change from anyone — so it is re-checked against the live clients page
// right before writing, not taken on the renderer's word.
async function setTicketScore(ticketId: number, score: string, ignoreClientsRight = false): Promise<{ ok: true }> {
  const html = await fetchTicketHtml(ticketId)
  const control = parseClientsScoreControl(html)
  if (!control.canEdit) {
    if (!ignoreClientsRight) {
      throw new Error('У вашей учётной записи нет права выставлять баллы за заявку')
    }
    // Deliberate override from the hidden settings. Zammad still has the last
    // word, and the change is recorded in the ticket history under this user.
    logger.warn(`Баллы заявки ${ticketId} меняются в обход запрета clients`)
  }
  const allowed = control.options.some(option => option.value === score)
  if (!allowed) {
    throw new Error('Такого значения баллов нет в списке clients')
  }

  const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/tickets/${ticketId}`, {
    method: 'PUT',
    headers: zHeaders(getToken()),
    body: JSON.stringify({ score })
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    logger.error('Ошибка выставления баллов:', { status: resp.status, text: text.slice(0, 500) })
    throw new Error(describeHttpError(resp.status, text, 'Не удалось выставить баллы'))
  }

  await markTicketSelfUpdated(ticketId)
  ticketHtmlCache.delete(ticketId)
  clearTicketCaches(ticketId)
  return { ok: true }
}

async function setTicketTitle(ticketId: number, title: string): Promise<{ ok: true; title: string }> {
  const trimmed = title.trim()
  if (!trimmed) {
    throw new Error('Заголовок не может быть пустым')
  }
  // Zammad хранит заголовок строкой без ограничения, но в списках он обрезается,
  // а перенос строки ломает вёрстку — поэтому в одну строку и в разумный предел.
  const normalized = trimmed.replace(/\s+/g, ' ').slice(0, 250)

  const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/tickets/${ticketId}`, {
    method: 'PUT',
    headers: zHeaders(getToken()),
    body: JSON.stringify({ title: normalized })
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    logger.error('Ошибка изменения заголовка:', { status: resp.status, text: text.slice(0, 500) })
    throw new Error(describeHttpError(resp.status, text, 'Не удалось изменить заголовок'))
  }

  await markTicketSelfUpdated(ticketId)
  ticketHtmlCache.delete(ticketId)
  clearTicketCaches(ticketId)
  notifyFrontend('tickets:ticket-updated', ticketId)
  notifyFrontend('tickets:list-updated')
  return { ok: true, title: normalized }
}

// Организация возвращается вместе с пользователем не для красоты: смена клиента
// заявки может перевесить его в другую организацию, и без этого не видно, у кого
// именно она отбирается.
async function searchUsers(query: string): Promise<UserSearchResult[]> {
  const token = getToken()
  const url = new URL(`${ZAMMAD_BASE}/api/v1/users/search`)
  url.searchParams.set('query', query || '*')
  url.searchParams.set('per_page', '15')
  // expand отдаёт название организации строкой — иначе пришлось бы тянуть её
  // отдельным запросом на каждого найденного.
  url.searchParams.set('expand', 'true')
  const resp = await zammadFetch(url.toString(), { headers: zHeaders(token) })
  if (!resp.ok) return []
  const payload = await resp.json()
  const list = (Array.isArray(payload) ? payload : (Array.isArray(payload?.users) ? payload.users : [])) as {
    id: number
    firstname?: string
    lastname?: string
    login?: string
    email?: string
    organization?: string
    organization_id?: number | null
  }[]
  return list.map(u => {
    const name = cleanUserName(u.firstname, u.lastname, u.login, u.id)
    meta.users[u.id] = name
    meta.usersLoaded[u.id] = true
    const organizationId = u.organization_id ? Number(u.organization_id) : null
    return {
      id: u.id,
      name,
      email: u.email || '',
      organizationId,
      organizationName: String(u.organization || '')
    }
  })
}

// Resolves a clients.denvic.ru ticket number to the Zammad ticket id used by
// the app's routes (used by the browser-extension deep link).
async function resolveClientsNumberToZammadId(num: string): Promise<number | null> {
  const clean = String(num || '').replace(/\D/g, '')
  if (!clean) return null
  try {
    const idx = await fetchClientsTicketIndex()
    const mapped = idx.byClientNumber.get(clean)
    if (mapped?.zammadId) return Number(mapped.zammadId)
  } catch (err) {
    logger.error('resolveClientsNumber index error', err)
  }
  try {
    const results = await searchTicketsForMerge(clean)
    if (results[0]?.id) return results[0].id
  } catch (err) {
    logger.error('resolveClientsNumber search error', err)
  }
  return null
}

async function searchTicketsForMerge(query: string): Promise<Ticket[]> {
  const token = getToken()
  const h = zHeaders(token)
  const s = query.trim()
  if (!s) return []

  let zammadQuery = ''
  if (/^\d+$/.test(s)) {
    const clientsIndex = await fetchClientsTicketIndex()
    const mapped = clientsIndex.byClientNumber.get(s)
    const parts = [`id:${s}`, `number:${s}`, `client_number:${s}`, `"${s}"`]
    if (mapped?.zammadId) parts.push(`id:${mapped.zammadId}`)
    if (mapped?.zammadNumber) parts.push(`number:${mapped.zammadNumber}`, `"${mapped.zammadNumber}"`)
    zammadQuery = parts.join(' OR ')
  } else {
    zammadQuery = `"${s}" OR title:${s}`
  }

  const url = new URL(`${ZAMMAD_BASE}/api/v1/tickets/search`)
  url.searchParams.set('query', zammadQuery)
  url.searchParams.set('per_page', '15')
  url.searchParams.set('expand', 'true')

  const resp = await zammadFetch(url.toString(), { headers: h })
  if (!resp.ok) return []

  const data = await resp.json()
  let rawTickets: any[] = []
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    rawTickets = Array.isArray(data.tickets) ? data.tickets : []
  } else if (Array.isArray(data)) {
    rawTickets = data
  }

  registerUsersFromAssets(data?.assets)

  const ownerIds = rawTickets.map(t => parseInt(String(t.owner_id ?? '0'), 10)).filter(id => id > 0)
  await ensureUsersLoaded(ownerIds)

  const clientsIndex = await fetchClientsTicketIndex()
  return applyClientsNumbers(rawTickets.map(normalizeZammadTicket), clientsIndex)
}

async function mergeTickets(sourceTicketId: number, targetTicketNumber: string): Promise<{ ok: boolean }> {
  const token = getToken()
  const url = `${ZAMMAD_BASE}/api/v1/ticket_merge/${sourceTicketId}/${targetTicketNumber}`
  const resp = await zammadFetch(url, {
    method: 'PUT',
    headers: zHeaders(token),
    body: JSON.stringify({})
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    logger.error('Ошибка объединения заявок:', { status: resp.status, text: text.slice(0, 500) })
    throw new Error(describeHttpError(resp.status, text, 'Не удалось объединить заявки'))
  }

  await markTicketSelfUpdated(sourceTicketId)
  clearTicketCaches(sourceTicketId)
  clearTicketCaches()
  return { ok: true }
}

async function changeTicketCustomer(ticketId: number, customerId: number): Promise<{ ok: boolean }> {
  const token = getToken()
  const payload = { customer_id: customerId }
  const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/tickets/${ticketId}`, {
    method: 'PUT',
    headers: zHeaders(token),
    body: JSON.stringify(payload)
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    logger.error('Ошибка смены клиента заявки:', { status: resp.status, text: text.slice(0, 500) })
    throw new Error(describeHttpError(resp.status, text, 'Не удалось сменить клиента'))
  }

  await markTicketSelfUpdated(ticketId)
  clearTicketCaches(ticketId)
  return { ok: true }
}

async function createUser(userPayload: any): Promise<any> {
  const token = getToken()
  const payload = { ...userPayload }
  if (!payload.email && !payload.login) {
    payload.login = `user_${Date.now()}`
  }
  const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/users`, {
    method: 'POST',
    headers: zHeaders(token),
    body: JSON.stringify(payload)
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    logger.error('Ошибка создания пользователя Zammad:', { status: resp.status, text: text.slice(0, 500) })
    throw new Error(describeHttpError(resp.status, text, 'Не удалось создать пользователя'))
  }

  const user = await resp.json()
  registerUser(user)
  return user
}

async function updateUser(userId: number, userPayload: any): Promise<{ ok: boolean }> {
  const { ticketId, ...zammadPayload } = userPayload

  if ('organization_id' in zammadPayload) {
    const orgId = zammadPayload.organization_id
    delete zammadPayload.organization_id

    const ses = wrapperSession()
    const changeUrl = `https://clients.denvic.ru/Tickets/ChangeOrganization?userId=${userId}&organizationId=${orgId || ''}${ticketId ? `&ticketId=${ticketId}` : ''}`
    logger.info('Запрос смены организации:', changeUrl)
    const changeResp = await net.fetch(changeUrl, {
      session: ses,
      headers: {
        Referer: `https://clients.denvic.ru/Tickets/Details/${ticketId || ''}`
      }
    } as any)

    logger.info('Ответ смены организации:', changeResp.status, changeResp.url)

    if (!changeResp.ok) {
      const text = await changeResp.text().catch(() => '')
      logger.error('Ошибка смены организации через wrapper:', { status: changeResp.status, text })
      throw new Error(`Ошибка смены организации: ${changeResp.status}`)
    }
  }

  const token = getToken()
  if (Object.keys(zammadPayload).length > 0) {
    const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/users/${userId}`, {
      method: 'PUT',
      headers: zHeaders(token),
      body: JSON.stringify(zammadPayload)
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      logger.error('Ошибка обновления профиля пользователя Zammad:', { status: resp.status, text: text.slice(0, 500) })
      throw new Error(describeHttpError(resp.status, text, 'Не удалось обновить профиль'))
    }

    const user = await resp.json()
    registerUser(user)
  } else {
    const userResp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/users/${userId}`, {
      headers: zHeaders(token)
    })
    if (userResp.ok) {
      const user = await userResp.json()
      registerUser(user)
    }
  }

  clearTicketCaches()
  return { ok: true }
}

function preloadTicketsCache(myUserId: number, token: string): void {
  getActiveTickets(myUserId, token).catch(() => {})
  const preloads = [1, 2, 5]
  preloads.forEach(wrapperId => {
    fetchZammadTickets({
      wrapperId,
      page: 1,
      perPage: 50,
      sortField: 'updatedAt',
      sortAsc: false
    }).catch(() => {})
  })
}

export function setupTicketsIpc(): void {
  const stored = readStored()
  if (stored.zammadToken) {
    setZammadTokenCache(stored.zammadToken)
  }

  ipcMain.handle('tickets:getFilters', async () => {
    const hasToken = !!readStored().zammadToken
    if (hasToken) {
      try {
        const token = getToken()
        await loadMeta(token)
        const myUserId = await getUserId()
        if (myUserId) {
          preloadTicketsCache(myUserId, token)
        }
        if (Object.keys(meta.groups).length === 0) {
          try {
            const token = getToken()
            const h = zHeaders(token)
            const groupsResp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/groups`, { headers: h })
            if (groupsResp.ok) {
              const groupsList = await groupsResp.json() as { id: number; name: string }[]
              groupsList.forEach(g => {
                meta.groups[g.id] = g.name
              })
            } else {
              const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/tickets/search?query=*&per_page=100&expand=true`, { headers: h })
              if (resp.ok) {
                const data = await resp.json()
                registerUsersFromAssets(data?.assets)
                const tickets = Array.isArray(data) ? data : (data.tickets || [])
                tickets.forEach(normalizeZammadTicket)
              }
            }
          } catch (err) {
            logger.error(err)
          }
        }
      } catch (err) {
        logger.error(err)
      }
    }

    const allFilters = readFilters()
    const states = Object.entries(meta.states).map(([id, name]) => ({ id: Number(id), name }))
    const priorities = Object.entries(meta.priorities)
      .map(([id, name]) => ({ id: Number(id), name }))
      .sort((a, b) => a.id - b.id)
    const groups = Object.entries(meta.groups).map(([id, name]) => ({ id: Number(id), name }))
    const ticketTypes = Object.entries(meta.ticketTypes).map(([id, name]) => ({ id, name }))
    const iikoReasons = Object.entries(meta.iikoReasons).map(([id, name]) => ({ id, name }))
    const tags = Object.entries(meta.tags).map(([id, name]) => ({ id, name }))
    const agents = dedupeAgentNames(
      Object.entries(meta.users)
        .filter(([id]) => meta.agents[Number(id)] && meta.usersActive[Number(id)] !== false)
        .map(([id, name]) => ({ id: Number(id), name }))
        .filter(a => {
          const n = a.name.trim()
          return n && /[a-zA-Zа-яА-Я0-9]/.test(n)
        })
    ).sort((a, b) => a.name.localeCompare(b.name, 'ru'))

    const stateColors = readStateColorsWithDefaults()

    return {
      allFilters,
      hasZammadToken: hasToken,
      states,
      priorities,
      groups,
      ticketTypes,
      iikoReasons,
      tags,
      stateColors,
      agents
    }
  })

  ipcMain.handle('tickets:getMyTicketsCounts', async () => {
    try {
      const myUserId = await getUserId()
      if (!myUserId) return { tickets: [], counts: {} }
      const token = getToken()
      const { tickets: rawTickets, assets } = await getActiveTickets(myUserId, token)
      registerUsersFromAssets(assets)

      const counts: Record<number, number> = {}
      for (const t of rawTickets) {
        const stateId = parseInt(String(t.state_id ?? '0'), 10)
        if (stateId) {
          counts[stateId] = (counts[stateId] || 0) + 1
        }
      }

      const clientsIndex = await fetchClientsTicketIndex()
      const normalized = rawTickets.map(normalizeZammadTicket)
      const tickets = applyClientsNumbers(normalized, clientsIndex)

      return { tickets, counts }
    } catch (err) {
      logger.error('Ошибка получения количества моих заявок:', err)
      return { tickets: [], counts: {} }
    }
  })

  ipcMain.handle('tickets:list', async (_event, params: TicketListParams) => {
    return fetchZammadTickets(params)
  })

  ipcMain.handle('tickets:savePinned', async () => {})

  ipcMain.handle('tickets:saveFilters', async (_event, filters: TicketFilter[]) => {
    writeFilters(filters)
    clearTicketCaches()
  })

  ipcMain.handle('tickets:saveStateColors', async (_event, colors: Record<number, string>) => {
    writeStateColors(colors)
    clearTicketCaches()
  })

  ipcMain.handle('tickets:setToken', (_event, token: string) => {
    const s = readStored()
    writeStored({ ...s, zammadToken: token })
    setZammadTokenCache(token)
    cachedUserId = null
    metaLoaded = false
    clearTicketCaches()
  })

  ipcMain.handle('organizations:list', async (_event, params: { query: string; page?: number; perPage?: number }) => {
    return fetchOrgs(params.query, params.page ?? 1, params.perPage ?? 50)
  })

  ipcMain.handle('organizations:getMembers', async (_event, orgId: number) => {
    return fetchOrgMembers(orgId)
  })

  ipcMain.handle('organizations:getTickets', async (_event, orgId: number) => {
    return fetchOrgTickets(orgId)
  })

  ipcMain.handle('users:search', async (_event, query: string) => {
    return searchUsers(query)
  })

  ipcMain.handle('calls:getAll', async (_event, params?: { query?: string; page?: number; perPage?: number }) => {
    return fetchAllCalls(params)
  })

  ipcMain.handle('calls:getRecording', async (_event, url: string) => {
    return fetchCallRecording(url)
  })

  ipcMain.handle('tickets:getDetails', async (_event, ticketId: number) => {
    return fetchTicketDetails(ticketId)
  })

  ipcMain.handle('tickets:getArticles', async (_event, ticketId: number) => {
    return fetchTicketArticles(ticketId)
  })

  ipcMain.handle('tickets:addComment', async (_event, params: AddTicketCommentParams) => {
    return addTicketComment(params)
  })

  ipcMain.handle('tickets:getAttachment', async (_event, ticketId: number, articleId: number, attachmentId: number) => {
    return fetchTicketAttachment(ticketId, articleId, attachmentId)
  })

  ipcMain.handle('tickets:export', async (_event, ticketId: number, options: TicketExportOptions) => {
    return exportTicket(ticketId, options)
  })

  ipcMain.handle('tickets:cancelUpload', async (_event, uploadId: string) => {
    return cancelUpload(uploadId)
  })

  ipcMain.handle('tickets:setScore', async (_event, ticketId: number, score: string, ignoreClientsRight?: boolean) => {
    return setTicketScore(ticketId, score, ignoreClientsRight === true)
  })

  ipcMain.handle('tickets:setTitle', async (_event, ticketId: number, title: string) => {
    return setTicketTitle(ticketId, title)
  })

  ipcMain.handle('tickets:getHistory', async (_event, ticketId: number) => {
    return fetchTicketHistory(ticketId)
  })

  ipcMain.handle('tickets:searchForMerge', async (_event, query: string) => {
    return searchTicketsForMerge(query)
  })

  ipcMain.handle('tickets:merge', async (_event, sourceTicketId: number, targetTicketNumber: string) => {
    return mergeTickets(sourceTicketId, targetTicketNumber)
  })

  ipcMain.handle('tickets:changeCustomer', async (_event, ticketId: number, customerId: number) => {
    return changeTicketCustomer(ticketId, customerId)
  })

  ipcMain.handle('tickets:createSubTicket', async (_event, params: any) => {
    return createSubTicket(params)
  })

  ipcMain.handle('users:create', async (_event, userPayload: any) => {
    return createUser(userPayload)
  })

  ipcMain.handle('users:update', async (_event, userId: number, userPayload: any) => {
    return updateUser(userId, userPayload)
  })

  ipcMain.handle('calls:bindToTicket', async (_event, params: { ticketId: string; src: string; dst: string; callId: string; duration: string; date: string }) => {
    return bindCallToTicket(params)
  })

  ipcMain.handle('tickets:createFromCall', async (_event, params: any) => {
    return createTicketFromCall(params)
  })

  ipcMain.handle('tickets:resolveClientsNumber', async (_event, num: string) => {
    return resolveClientsNumberToZammadId(num)
  })

  ipcMain.handle('notifications:getSettings', async () => {
    return readNotificationSettings()
  })

  ipcMain.handle('notifications:saveSettings', async (_event, settings: any) => {
    writeNotificationSettings(settings)
  })

  ipcMain.handle('notifications:getSounds', async () => {
    return getAvailableSounds()
  })

  ipcMain.handle('notifications:uploadSound', async (_event, name: string, dataUrl: string) => {
    try {
      const fs = require('fs')
      const dir = soundsDir()
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const base64Data = dataUrl.replace(/^data:audio\/\w+;base64,/, "")
      const buffer = Buffer.from(base64Data, 'base64')
      fs.writeFileSync(join(dir, name), buffer)
    } catch (err) {
      logger.error(err)
      throw err
    }
  })

  ipcMain.handle('notifications:getHistory', async () => {
    return readNotificationHistory()
  })

  ipcMain.handle('notifications:markAsRead', async (_event, id: string) => {
    const history = readNotificationHistory()
    const item = history.find(i => i.id === id)
    if (item) {
      item.isRead = true
      writeNotificationHistory(history)
    }
  })

  ipcMain.handle('notifications:markAllAsRead', async () => {
    const history = readNotificationHistory()
    history.forEach(item => {
      item.isRead = true
    })
    writeNotificationHistory(history)
  })

  startNotificationPoller()

  logger.info('Tickets IPC registered')
}

const CLIENTS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'


interface ClientsFormResponse {
  status: number
  location: string | null
  body: string
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// net.request() is not usable here: even with useSessionCookies it posts without
// the .AspNetCore.Identity.Application cookie, so clients answers every create
// with a 302 to /Account/Login and nothing is ever saved. net.fetch() carries the
// session cookies (it is what the login itself uses), and the redirect it follows
// lands on /Tickets/Details/<id> — the id of the ticket just created.
async function postClientsForm(url: string, body: string, referer: string): Promise<ClientsFormResponse> {
  const response = await net.fetch(url, {
    method: 'POST',
    session: wrapperSession(),
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: referer,
      Origin: WRAPPER_BASE,
      'User-Agent': CLIENTS_USER_AGENT
    },
    body
  } as any)

  const html = await response.text()
  return {
    status: response.status,
    // After a followed redirect this is the landing page, which is exactly what
    // the Location header would have carried.
    location: response.url || null,
    body: html
  }
}


// clients answers an unauthenticated POST with a redirect to the login page, so
// nothing was created and the request can safely be replayed after logging in.
function isLoginRedirect(response: ClientsFormResponse): boolean {
  if (/\/Account\/Login/i.test(String(response.location ?? ''))) return true
  return isClientsLoginPage(response.body)
}

// The cookie can still be present while the server already dropped the session,
// so a login page coming back means "log in again", not "give up".
async function reloginClientsSession(): Promise<void> {
  const stored = readStored()
  if (!stored.savedEmail || !stored.savedPassword) {
    throw new Error('Сессия clients истекла. Выполните вход в приложение заново.')
  }
  await loginWrapper(stored.savedEmail, stored.savedPassword)
}

// `expected` is the marker that proves we really got the requested page: a login
// page can come back with status 200, and its antiforgery token would then be
// posted into the void.
async function loadClientsPage(url: string, what: string, expected: RegExp): Promise<string> {
  const fetchOnce = async (): Promise<string> => {
    const resp = await net.fetch(url, {
      session: wrapperSession(),
      headers: { 'User-Agent': CLIENTS_USER_AGENT }
    } as any)
    if (!resp.ok) {
      throw new Error(`Не удалось загрузить страницу ${what}: ${resp.status}`)
    }
    return resp.text()
  }

  let html = await fetchOnce()
  if (expected.test(html)) {
    markClientsSessionAlive()
    return html
  }

  logger.warn(`Страница ${what} не загрузилась (сессия clients истекла?), выполняю вход заново`)
  markClientsSessionDead()
  await reloginClientsSession()

  html = await fetchOnce()
  if (!expected.test(html)) {
    throw new Error(isClientsLoginPage(html)
      ? 'Сессия clients истекла. Выполните вход в приложение заново.'
      : `Страница ${what} на clients вернулась в неожиданном виде — создание отменено.`)
  }

  markClientsSessionAlive()
  return html
}

function extractRequestVerificationToken(html: string): string | null {
  const match =
    html.match(/name="__RequestVerificationToken"[^>]*\bvalue="([^"]+)"/i) ||
    html.match(/value="([^"]+)"[^>]*name="__RequestVerificationToken"/i)
  return match ? match[1] : null
}



function ticketIdFromJsonPayload(payload: any, depth = 0): number | null {
  if (!payload || typeof payload !== 'object' || depth > 3) return null
  for (const key of ['newTicketId', 'ticketId', 'TicketId', 'ticket_id', 'zammadTicketId', 'id', 'Id']) {
    const id = parseTicketIdValue(payload[key])
    if (id) return id
  }
  for (const key of ['url', 'Url', 'redirectUrl', 'RedirectUrl', 'location', 'href']) {
    const id = ticketIdFromUrl(payload[key])
    if (id) return id
  }
  for (const key of ['data', 'Data', 'ticket', 'Ticket', 'result', 'Result', 'value', 'model']) {
    const id = ticketIdFromJsonPayload(payload[key], depth + 1)
    if (id) return id
  }
  return null
}

// The caption field only exists on the create form itself, so it doubles as the
// proof that the page we loaded is the form and not a login page served with 200.


// A re-rendered create form means nothing was saved — its ticket links belong to
// other tickets and must never be mistaken for the new one.

// Loads the create form, posts it, and — if clients bounced the request to the
// login page — logs in again and replays it. A login redirect means the POST was
// never processed, so the replay cannot produce a duplicate ticket.
async function submitClientsCreateForm(opts: {
  createPageUrl: string
  what: string
  buildBody: (html: string, csrfToken: string) => URLSearchParams
}): Promise<ClientsFormResponse> {
  let lastResponse: ClientsFormResponse | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const html = await loadClientsPage(opts.createPageUrl, opts.what, CLIENTS_CREATE_FORM_RE)
    const csrfToken = extractRequestVerificationToken(html)
    if (!csrfToken) {
      throw new Error(`Не удалось извлечь CSRF токен для ${opts.what}`)
    }

    const response = await postClientsForm(
      `${WRAPPER_BASE}/Tickets/Create`,
      opts.buildBody(html, csrfToken).toString(),
      opts.createPageUrl
    )
    logger.info(`Ответ ${opts.what}:`, {
      status: response.status,
      location: response.location,
      createFormReturned: isClientsCreateForm(response.body),
      loginPageReturned: isClientsLoginPage(response.body)
    })
    lastResponse = response

    if (attempt === 0 && isLoginRedirect(response)) {
      logger.warn(`Запрос ${opts.what} отклонён: сессия clients истекла, выполняю вход заново и повторяю`)
      await reloginClientsSession()
      continue
    }
    return response
  }

  return lastResponse as ClientsFormResponse
}

function ticketIdFromHtml(html: string, excludeIds: number[]): number | null {
  if (!html) return null
  // Only unambiguous markers: a page full of ticket links must not be guessed at.
  const urlPatterns = [
    /<meta[^>]+http-equiv=["']refresh["'][^>]*url=([^"'>\s]+)/i,
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
    /(?:window\.)?location(?:\.href|\.replace|\.assign)?\s*(?:=|\()\s*["']([^"']+)["']/i
  ]
  for (const pattern of urlPatterns) {
    const id = ticketIdFromUrl(html.match(pattern)?.[1])
    if (id && !excludeIds.includes(id)) return id
  }
  const fieldPatterns = [
    /\b(?:id|name)=["']ticketId["'][^>]*\bvalue=["'](\d+)["']/i,
    /\bvalue=["'](\d+)["'][^>]*\b(?:id|name)=["']ticketId["']/i
  ]
  for (const pattern of fieldPatterns) {
    const id = parseTicketIdValue(html.match(pattern)?.[1])
    if (id && !excludeIds.includes(id)) return id
  }
  const candidates = Array.from(new Set(
    Array.from(html.matchAll(/\/Tickets\/(?:Details|Edit)\/(\d+)/gi))
      .map(match => parseTicketIdValue(match[1]))
      .filter((id): id is number => !!id && !excludeIds.includes(id))
  ))
  return candidates.length === 1 ? candidates[0] : null
}


// Reads the parent's children table again and returns the row that was not there
// before the POST — the most direct proof of which subtask was created.
async function findNewChildTicketId(parentTicketId: number, title: string, knownChildIds: number[]): Promise<number | null> {
  const wanted = title.trim().toLowerCase()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const resp = await net.fetch(`${WRAPPER_BASE}/Tickets/Details/${parentTicketId}`, {
        session: wrapperSession(),
        headers: { 'User-Agent': CLIENTS_USER_AGENT }
      } as any)
      if (resp.ok) {
        const children = (parseClientsTicketDetails(await resp.text()).subTickets ?? [])
          .filter(child => child.id > 0 && !knownChildIds.includes(child.id))
        const byTitle = children.find(child => child.title.trim().toLowerCase() === wanted)
        if (byTitle) return byTitle.id
        const newest = children.sort((a, b) => b.id - a.id)[0]
        if (newest) return newest.id
      }
    } catch (err) {
      logger.warn('Не удалось перечитать подзадачи родительской заявки:', err)
    }
    if (attempt < 2) await wait(1000)
  }
  return null
}

// Last resort when the wrapper tells us nothing: find the ticket we just created
// in Zammad by title. The customer ticket list is served from the database, so it
// is checked first — the search index can lag a few seconds behind a new ticket.
async function findRecentlyCreatedTicketId(opts: {
  title: string
  customerId?: number | null
  since: number
  excludeIds: number[]
}): Promise<number | null> {
  const wanted = opts.title.trim().toLowerCase()
  if (!wanted) return null

  let token = ''
  try {
    token = getToken()
  } catch {
    return null
  }
  const h = zHeaders(token)
  const customerId = opts.customerId ? parseTicketIdValue(opts.customerId) : null

  const isCandidate = (raw: any): boolean => {
    const id = parseTicketIdValue(raw?.id)
    if (!id || opts.excludeIds.includes(id)) return false
    if (String(raw.title ?? '').trim().toLowerCase() !== wanted) return false
    const createdAt = Date.parse(String(raw.created_at ?? ''))
    return !Number.isFinite(createdAt) || createdAt >= opts.since - 5 * 60_000
  }
  // The clients id of a customer is not guaranteed to be the Zammad user id, so a
  // customer match only breaks ties instead of filtering candidates out.
  const pickBest = (candidates: any[]): number | null => {
    if (candidates.length === 0) return null
    const sameCustomer = customerId
      ? candidates.find(raw => parseTicketIdValue(raw.customer_id) === customerId)
      : null
    return parseTicketIdValue((sameCustomer ?? candidates[0]).id)
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (customerId) {
      try {
        const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/ticket_customer?customer_id=${customerId}`, { headers: h })
        if (resp.ok) {
          const payload = await resp.json()
          const ids = [
            ...(Array.isArray(payload?.ticket_ids_open) ? payload.ticket_ids_open : []),
            ...(Array.isArray(payload?.ticket_ids_closed) ? payload.ticket_ids_closed : [])
          ]
            .map(parseTicketIdValue)
            .filter((id): id is number => !!id && !opts.excludeIds.includes(id))
            .sort((a, b) => b - a)
            .slice(0, 15)
          for (const id of ids) {
            const ticketResp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/tickets/${id}`, { headers: h })
            if (!ticketResp.ok) continue
            const raw = await ticketResp.json()
            if (isCandidate(raw)) return id
          }
        }
      } catch (err) {
        logger.warn('Не удалось получить список заявок клиента из Zammad:', err)
      }
    }

    for (const query of [`title:${zammadSearchValue(opts.title.trim())}`, zammadSearchValue(opts.title.trim())]) {
      try {
        const url = new URL(`${ZAMMAD_BASE}/api/v1/tickets/search`)
        url.searchParams.set('query', query)
        url.searchParams.set('per_page', '25')
        url.searchParams.set('sort_by', 'created_at')
        url.searchParams.set('order_by', 'desc')
        url.searchParams.set('expand', 'true')
        const resp = await zammadFetch(url.toString(), { headers: h })
        if (!resp.ok) continue
        const data = await resp.json()
        const list: any[] = Array.isArray(data) ? data : Array.isArray(data?.tickets) ? data.tickets : []
        const found = pickBest(list.filter(isCandidate))
        if (found) return found
      } catch (err) {
        logger.warn('Поиск созданной заявки в Zammad не удался:', err)
      }
    }

    if (attempt < 2) await wait(1500)
  }
  return null
}

// clients numbers its tickets on its own, so an id read off the wrapper can be
// either the Zammad ticket id or the internal clients number. Everything the app
// does afterwards (opening a tab, posting the closing article) speaks Zammad ids.
async function toZammadTicketId(rawId: number, title: string, since: number): Promise<number | null> {
  const wanted = title.trim().toLowerCase()
  let token = ''
  try {
    token = getToken()
  } catch {
    return rawId
  }

  try {
    const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/tickets/${rawId}`, { headers: zHeaders(token) })
    if (resp.ok) {
      const raw = await resp.json()
      const sameTitle = String(raw?.title ?? '').trim().toLowerCase() === wanted
      const createdAt = Date.parse(String(raw?.created_at ?? ''))
      const fresh = Number.isFinite(createdAt) && createdAt >= since - 5 * 60_000
      if (sameTitle || fresh) return rawId
      logger.info(`Заявка ${rawId} в Zammad не совпадает с созданной — трактую номер как внутренний номер clients`)
    }
  } catch (err) {
    logger.warn('Не удалось проверить id созданной заявки в Zammad:', err)
  }

  // The freshly created ticket cannot be in a cached index yet.
  clientsIndexCache = null
  try {
    const mapped = await resolveClientsNumberToZammadId(String(rawId))
    if (mapped) {
      logger.info(`Внутренний номер clients ${rawId} сопоставлен с заявкой Zammad ${mapped}`)
      return mapped
    }
  } catch (err) {
    logger.warn('Не удалось сопоставить номер clients с заявкой Zammad:', err)
  }

  return null
}

async function resolveCreatedTicketId(opts: {
  response: ClientsFormResponse
  title: string
  customerId?: number | null
  parentTicketId?: number
  knownChildIds?: number[]
  since: number
  excludeIds: number[]
}): Promise<number | null> {
  const candidates: number[] = []
  const addCandidate = (id: number | null) => {
    if (id && !candidates.includes(id)) candidates.push(id)
  }

  addCandidate(ticketIdFromUrl(opts.response.location))

  const body = opts.response.body ?? ''
  const trimmed = body.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      addCandidate(ticketIdFromJsonPayload(JSON.parse(trimmed)))
    } catch {
      // not JSON after all — fall through to the HTML paths
    }
  }

  if (!isClientsCreateForm(body)) {
    addCandidate(ticketIdFromHtml(body, opts.excludeIds))
  }

  if (opts.parentTicketId) {
    addCandidate(await findNewChildTicketId(opts.parentTicketId, opts.title, opts.knownChildIds ?? []))
  }

  for (const candidate of candidates) {
    const zammadId = await toZammadTicketId(candidate, opts.title, opts.since)
    if (zammadId) return zammadId
  }

  return findRecentlyCreatedTicketId({
    title: opts.title,
    customerId: opts.customerId,
    since: opts.since,
    excludeIds: opts.excludeIds
  })
}

// Turns a create response that carries no ticket id into an error, but only after
// making sure the ticket really was not created — an error on a saved ticket is
// what makes agents create the same ticket twice.
function createFailureError(response: ClientsFormResponse, fallback: string): Error {
  const validation = clientsFormErrorMessage(response.body)
  if (validation) return new Error(`Ошибка валидации формы: ${validation}`)
  if (isClientsLoginPage(response.body)) {
    return new Error('Сессия clients истекла. Выполните вход в приложение заново и повторите.')
  }
  if (response.status >= 500) {
    return new Error(`Сервер clients ответил ошибкой ${response.status}. Проверьте, не создалась ли заявка, и повторите.`)
  }
  return new Error(fallback)
}

async function createSubTicket(params: {
  parentTicketId: number
  title: string
  body: string
  groupId: number
  ownerId: number
  type: string
  priorityId: number
  stateId: number
  timeUnit: number
}): Promise<{ ok: boolean; newTicketId?: number }> {
  await ensureClientsSession()

  const createPageUrl = `${WRAPPER_BASE}/Tickets/Create?baseTicketId=${params.parentTicketId}`

  const parentDetails = await fetchTicketDetails(params.parentTicketId)
  const clientId = parentDetails.customer?.id || 0
  const knownChildIds = ((parentDetails.ticket as any)?.subTickets ?? [])
    .map((child: any) => parseTicketIdValue(child?.id))
    .filter((id: number | null): id is number => !!id)

  const since = Date.now()
  const postResp = await submitClientsCreateForm({
    createPageUrl,
    what: 'создания подзадачи',
    buildBody: (_html, csrfToken) => {
      const bodyParams = new URLSearchParams()
      bodyParams.append('__RequestVerificationToken', csrfToken)
      bodyParams.append('newCaption', params.title)
      bodyParams.append('selectedClientId', String(clientId))
      bodyParams.append('selectedTicketType', params.type || 'Incident')
      bodyParams.append('selectedGroupId', String(params.groupId))
      bodyParams.append('selectedUserId', String(params.ownerId || 1))
      bodyParams.append('selectedTcketPriorityId', String(params.priorityId || 2))
      bodyParams.append('selectedTcketStateId', String(params.stateId || 2))
      bodyParams.append('TimeUnit', String(params.timeUnit || 0))
      bodyParams.append('newArticleText', params.body)
      bodyParams.append('baseTicketId', String(params.parentTicketId))
      bodyParams.append('CurrentCall', 'False')
      return bodyParams
    }
  })

  const validation = clientsFormErrorMessage(postResp.body)
  if (validation && isClientsCreateForm(postResp.body)) {
    throw new Error(`Ошибка валидации формы: ${validation}`)
  }

  const newTicketId = await resolveCreatedTicketId({
    response: postResp,
    title: params.title,
    customerId: clientId,
    parentTicketId: params.parentTicketId,
    knownChildIds,
    since,
    excludeIds: [params.parentTicketId, ...knownChildIds]
  })

  rememberSelfCreatedTicket(newTicketId)
  clearTicketCaches(params.parentTicketId)
  clearTicketCaches()

  if (!newTicketId) {
    throw createFailureError(postResp, `Не удалось создать подзадачу (ответ сервера ${postResp.status}). Обновите заявку — возможно, подзадача всё же создана.`)
  }

  return { ok: true, newTicketId }
}

async function bindCallToTicket(params: {
  ticketId: string
  src: string
  dst: string
  callId: string
  duration: string
  date: string
}): Promise<{ ok: boolean }> {
  await ensureClientsSession()
  const ses = wrapperSession()
  const url = new URL(`${WRAPPER_BASE}/PhoneCalls/AddCallToTicket`)
  url.searchParams.set('ticketId', params.ticketId)
  url.searchParams.set('src', params.src)
  url.searchParams.set('dst', params.dst)
  url.searchParams.set('callId', params.callId)
  url.searchParams.set('duration', params.duration)
  url.searchParams.set('date', params.date)

  const resp = await net.fetch(url.toString(), {
    session: ses,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  } as any)

  if (!resp.ok) {
    throw new Error(`Не удалось привязать звонок: статус ${resp.status}`)
  }

  const text = await resp.text()
  return { ok: text === "" }
}

async function createTicketFromCall(params: {
  clientId?: number | null
  title: string
  body: string
  phone: string
  callId: string
  date: string
  duration: string
  ticketType?: string
  groupId?: string
  userId?: string
  priorityId?: string
  stateId?: string
  pendingTime?: string | null
  timeUnit?: string
}): Promise<{ ok: boolean; newTicketId?: number }> {
  await ensureClientsSession()

  const clientId = params.clientId || 0
  // A quick ticket carries no call. Asking clients for the call variant of the
  // form anyway makes it prefill the article with an empty "Входящий звонок с
  // номера: …" block, which then gets saved into a ticket that has nothing to do
  // with a call.
  const isCallTicket = !!(String(params.callId || '').trim() || String(params.phone || '').trim())
  const createPageUrl = isCallTicket
    ? `${WRAPPER_BASE}/Tickets/Create?selectedPhoneNuber=${encodeURIComponent(params.phone)}&linkedId=${encodeURIComponent(params.callId)}&selectedPhoneDate=${encodeURIComponent(params.date)}&selectedPhoneDuration=${encodeURIComponent(params.duration)}` + (clientId ? `&id=${clientId}` : '')
    : `${WRAPPER_BASE}/Tickets/Create` + (clientId ? `?id=${clientId}` : '')

  const since = Date.now()
  const postResp = await submitClientsCreateForm({
    createPageUrl,
    what: 'создания заявки',
    buildBody: (html, csrfToken) => {
      const groupId = params.groupId || findSelectedOption(html, 'selectedGroupId') || '1'
      const userId = params.userId || findSelectedOption(html, 'selectedUserId') || '1'
      const priorityId = params.priorityId || findSelectedOption(html, 'selectedTcketPriorityId') || '2'
      const stateId = params.stateId || findSelectedOption(html, 'selectedTcketStateId') || '2'
      const ticketType = params.ticketType || findSelectedOption(html, 'selectedTypeId') || 'Incident'

      // The prefilled block describes the call the ticket is being created from,
      // so it only belongs on a call ticket.
      const defaultArticleMatch = isCallTicket
        ? html.match(/<input[^>]*id="newArticleText"[^>]*value="([^"]*)"/i)
        : null
      const defaultArticleText = defaultArticleMatch ? decodeHtml(defaultArticleMatch[1]) : ''
      const description = String(params.body || '').trim()
      const finalArticleBody = defaultArticleText + (description ? `<div>${description.replace(/\n/g, '<br>')}</div>` : '')
      logger.info('Текст заявки для clients:', {
        isCallTicket,
        prefilledChars: defaultArticleText.length,
        descriptionChars: description.length
      })

      const bodyParams = new URLSearchParams()
      bodyParams.append('__RequestVerificationToken', csrfToken)
      bodyParams.append('newCaption', params.title)
      bodyParams.append('selectedClientId', String(clientId))
      bodyParams.append('selectedTicketType', ticketType)
      bodyParams.append('selectedGroupId', groupId)
      bodyParams.append('selectedUserId', userId)
      bodyParams.append('selectedTcketPriorityId', priorityId)
      bodyParams.append('selectedTcketStateId', stateId)
      bodyParams.append('TimeUnit', params.timeUnit ?? '10')
      bodyParams.append('newArticleText', finalArticleBody)
      if (isCallTicket) {
        bodyParams.append('linkedId', params.callId)
        bodyParams.append('phoneNuber', params.phone)
      }
      bodyParams.append('baseTicketId', '')
      bodyParams.append('CurrentCall', 'False')

      if (params.pendingTime) {
        bodyParams.append('pendingTime', params.pendingTime)
      }
      return bodyParams
    }
  })

  const validation = clientsFormErrorMessage(postResp.body)
  if (validation && isClientsCreateForm(postResp.body)) {
    throw new Error(`Ошибка валидации формы: ${validation}`)
  }

  const newTicketId = await resolveCreatedTicketId({
    response: postResp,
    title: params.title,
    customerId: clientId,
    since,
    excludeIds: []
  })

  rememberSelfCreatedTicket(newTicketId)
  clearTicketCaches()

  if (!newTicketId) {
    throw createFailureError(postResp, `Не удалось определить номер созданной заявки (ответ сервера ${postResp.status}). Проверьте список заявок — возможно, она уже создана.`)
  }

  return { ok: true, newTicketId }
}

function findSelectedOption(html: string, selectId: string): string {
  const selectMatch = html.match(new RegExp(`<select[^>]*id="${selectId}"[\\s\\S]*?<\\/select>`, 'i'))
  if (!selectMatch) return ''
  const options = Array.from(selectMatch[0].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi))
  const selected = options.find(opt => opt[1].includes('selected'))
  if (selected) {
    const valMatch = selected[1].match(/value="([^"]*)"/i)
    if (valMatch) return valMatch[1]
  }
  if (options.length > 0) {
    const valMatch = options[0][1].match(/value="([^"]*)"/i)
    if (valMatch) return valMatch[1]
  }
  return ''
}


let pollerInterval: any = null
const checkedTickets = new Map<number, { updatedAt: string; articleCount: number; stateId: number; ownerId: number | null; groupId: number; score: string }>()

// clients writes points as "01.0"/"00.5"; comparing the raw strings is enough to
// spot a change, and an empty value means the ticket has never been scored.
function scoreKey(raw: unknown): string {
  return raw === null || raw === undefined ? '' : String(raw).trim()
}

function scoreLabel(raw: unknown): string {
  const value = scoreKey(raw)
  if (!value) return 'снят'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return value
  if (numeric === 0) return 'без оценки'
  return numeric.toLocaleString('ru-RU')
}

// Tickets created from this app. clients saves them under its own service user,
// so created_by_id never matches the agent and the poller would announce a
// ticket the agent just filled in by hand. Consumed once, when the poller first
// sees the ticket — later changes to it are notified as usual.
const selfCreatedTicketIds = new Set<number>()

function rememberSelfCreatedTicket(ticketId: number | null | undefined): void {
  if (ticketId) selfCreatedTicketIds.add(ticketId)
}

// Folds a change the agent just made into the poller's baseline. Zammad records
// these edits under the clients service user, so `updated_by_id` never matches
// the agent and the poller would otherwise announce their own status change or
// comment back to them. Only this one change is absorbed — whatever happens to
// the ticket afterwards is still notified.
async function markTicketSelfUpdated(ticketId: number): Promise<void> {
  try {
    const resp = await zammadFetch(`${ZAMMAD_BASE}/api/v1/tickets/${ticketId}`, { headers: zHeaders(getToken()) })
    if (!resp.ok) return
    const t = await resp.json()
    checkedTickets.set(ticketId, {
      updatedAt: t.updated_at,
      articleCount: Array.isArray(t.article_ids) ? t.article_ids.length : 0,
      stateId: parseInt(String(t.state_id), 10),
      ownerId: parseInt(String(t.owner_id), 10) || null,
      groupId: parseInt(String(t.group_id), 10),
      score: scoreKey(t.score)
    })
  } catch (err) {
    logger.warn(`Не удалось обновить базовое состояние заявки ${ticketId} после своего изменения:`, err)
  }
}

function formatZammadSearchDate(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, 'Z')
}

function startNotificationPoller() {
  if (pollerInterval) return
  
  const fs = require('fs')
  const dir = soundsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  pollerInterval = setInterval(async () => {
    try {
      const stored = readStored()
      const token = stored.zammadToken
      if (!token) return

      const myUserId = await getUserId()
      if (!myUserId) return

      await loadMeta(token)

      const isFirstRun = checkedTickets.size === 0
      const minutesAgo = isFirstRun ? 180 : 3
      const checkTime = formatZammadSearchDate(new Date(Date.now() - minutesAgo * 60 * 1000))
      
      const h = zHeaders(token)
      const query = `updated_at:[${checkTime} TO *]`
      const url = new URL(`${ZAMMAD_BASE}/api/v1/tickets/search`)
      url.searchParams.set('query', query)
      url.searchParams.set('per_page', '100')
      url.searchParams.set('sort_by', 'updated_at')
      url.searchParams.set('order_by', 'desc')
      url.searchParams.set('expand', 'true')

      const resp = await zammadFetch(url.toString(), { headers: h })
      if (!resp.ok) return

      const data = await resp.json()
      registerUsersFromAssets(data?.assets)
      const tickets = Array.isArray(data) ? data : (data.tickets || [])

      for (const t of tickets) {
        const ticketId = t.id
        const updatedAt = t.updated_at
        const stateId = parseInt(String(t.state_id), 10)
        const ownerId = parseInt(String(t.owner_id), 10) || null
        const groupId = parseInt(String(t.group_id), 10)
        const score = scoreKey(t.score)

        const cached = checkedTickets.get(ticketId)
        
        if (!cached) {
          const isRecent = t.created_at && (Date.now() - new Date(t.created_at).getTime() < 300000)
          checkedTickets.set(ticketId, {
            updatedAt,
            articleCount: t.article_ids?.length || 0,
            stateId,
            ownerId,
            groupId,
            score
          })

          const createdHere = selfCreatedTicketIds.delete(ticketId)

          if (!isFirstRun) {
            clearTicketCaches()
            notifyFrontend('tickets:list-updated')
            if (createdHere) {
              // The agent created this ticket a moment ago — the list refresh
              // above is all that is needed, announcing it would be noise.
              logger.info(`Заявка ${ticketId} создана из приложения — уведомление о её появлении пропущено`)
            } else if (isRecent) {
              await checkAndNotify(t, null, 'create')
            } else {
              let changeDetails = ''
              try {
                const articles = await executeFetchTicketArticles(ticketId)
                const foreignArticles = articles.filter((art: any) => {
                  const creatorId = art.created_by_id || art.user_id
                  return creatorId && parseInt(String(creatorId), 10) !== myUserId
                })
                if (foreignArticles.length > 0) {
                  const lastArt = foreignArticles[foreignArticles.length - 1]
                  const authorName = lastArt.creatorName || 'Клиент'
                  const bodyPreview = stripHtml(lastArt.body).substring(0, 100)
                  changeDetails = `${authorName}: ${bodyPreview}`
                }
              } catch (err) {
                logger.error(err)
              }
              await checkAndNotify(t, changeDetails || null, 'other')
            }
          }
        } else {
          if (new Date(updatedAt).getTime() > new Date(cached.updatedAt).getTime()) {
            const articles = await executeFetchTicketArticles(ticketId)
            const oldArticleCount = cached.articleCount
            const newArticleCount = articles.length
            
            checkedTickets.set(ticketId, {
              updatedAt,
              articleCount: newArticleCount,
              stateId,
              ownerId,
              groupId,
              score
            })

            let changeType: 'message' | 'status' | 'owner' | 'score' | 'other' = 'other'
            let changeDetails = ''
            
            if (newArticleCount > oldArticleCount) {
              const newArticles = articles.slice(oldArticleCount)
              const foreignArticles = newArticles.filter((art: any) => {
                const creatorId = art.created_by_id || art.user_id
                return creatorId && parseInt(String(creatorId), 10) !== myUserId
              })

              if (foreignArticles.length > 0) {
                changeType = 'message'
                const lastArt = foreignArticles[foreignArticles.length - 1]
                const authorName = lastArt.creatorName || 'Клиент'
                const bodyPreview = stripHtml(lastArt.body).substring(0, 100)
                changeDetails = `${authorName}: ${bodyPreview}`
              }
            }

            if (stateId !== cached.stateId) {
              changeType = 'status'
              const oldStateName = meta.states[cached.stateId] || 'Неизвестно'
              const newStateName = meta.states[stateId] || 'Неизвестно'
              changeDetails = `Статус изменен: ${oldStateName} → ${newStateName}`
            }

            if (ownerId !== cached.ownerId) {
              changeType = 'owner'
              const newOwnerName = ownerId ? (meta.users[ownerId] || 'Неизвестно') : 'Не назначена'
              changeDetails = `Ответственный изменен: ${newOwnerName}`
            }

            if (groupId !== cached.groupId) {
              changeType = 'other'
              const oldGroupName = meta.groups[cached.groupId] || 'Неизвестно'
              const newGroupName = meta.groups[groupId] || 'Неизвестно'
              changeDetails = `Группа изменена: ${oldGroupName} → ${newGroupName}`
            }

            // Checked last so that awarding points is reported as such even when
            // it arrives together with a status change.
            if (score !== cached.score) {
              changeType = 'score'
              changeDetails = `Баллы за заявку: ${scoreLabel(score)}`
            }

            if (changeDetails) {
              clearTicketCaches(ticketId)
              notifyFrontend('tickets:details-updated', ticketId)
              notifyFrontend('tickets:articles-updated', ticketId)
              notifyFrontend('tickets:list-updated')
              await checkAndNotify(t, changeDetails, changeType)
            }
          }
        }
      }
    } catch (err) {
      logger.error(err)
    }
  }, 7000)
}

async function checkAndNotify(t: any, details: string | null, type: 'message' | 'status' | 'owner' | 'score' | 'create' | 'other') {
  try {
    const myUserId = await getUserId()
    if (!myUserId) return

    const actorId = parseInt(String(t.updated_by_id || t.created_by_id || '0'), 10)
    if (actorId === myUserId) return

    const normalized = normalizeZammadTicket(t)
    const settings = readNotificationSettings()
    
    let notify = false
    let sound = 'synth-chime'
    let volume = 1.0
    let soundEnabled = true
    let toastEnabled = true
    
    const isMyTicket = normalized.owner?.id === myUserId

    // Points are about the ticket's owner, so they are announced on own tickets
    // only — and by their own switch, independent of the general one.
    if (type === 'score') {
      if (!isMyTicket || settings.scoreEnabled === false) return
      notify = true
      sound = settings.myTicketsSound || 'synth-chime'
      volume = settings.myTicketsVolume !== undefined ? settings.myTicketsVolume : 1.0
      soundEnabled = settings.myTicketsSoundEnabled !== false
      toastEnabled = settings.myTicketsToastEnabled !== false
    } else if (settings.myTicketsEnabled && isMyTicket) {
      notify = true
      sound = settings.myTicketsSound || 'synth-chime'
      volume = settings.myTicketsVolume !== undefined ? settings.myTicketsVolume : 1.0
      soundEnabled = settings.myTicketsSoundEnabled !== false
      toastEnabled = settings.myTicketsToastEnabled !== false
    }

    const filters = resolveFilterPlaceholderIds(readFilters())
    for (const rule of settings.rules) {
      if (rule.enabled) {
        const filter = filters.find(f => f.wrapperId === rule.wrapperId)
        if (filter && filter.conditions) {
          const matched = filterTicketsLocally([t], filter.conditions, myUserId)
          if (matched.length > 0) {
            notify = true
            sound = rule.sound || 'synth-chime'
            volume = rule.volume !== undefined ? rule.volume : 1.0
            soundEnabled = rule.soundEnabled !== false
            toastEnabled = rule.toastEnabled !== false
            break
          }
        }
      }
    }

    if (notify) {
      const title = type === 'score' ? `Баллы · заявка №${normalized.number}` : `Заявка №${normalized.number}`
      const body = type === 'score'
        ? `${details ?? 'Баллы за заявку изменены'} — ${normalized.title}`
        : details || (type === 'create' ? `Создана новая заявка: ${normalized.title}` : `Обновление в заявке: ${normalized.title}`)
      
      const notification: NotificationItem = {
        id: `${Date.now()}-${normalized.id}-${Math.random().toString(36).substr(2, 5)}`,
        ticketId: normalized.id,
        ticketNumber: normalized.number,
        title,
        body,
        sound,
        volume,
        soundEnabled,
        toastEnabled,
        isRead: false,
        createdAt: new Date().toISOString(),
        type: type === 'create' ? 'other' : type
      }

      const history = readNotificationHistory()
      history.unshift(notification)
      if (history.length > 100) {
        history.pop()
      }
      writeNotificationHistory(history)

      notifyFrontend('notifications:new', notification)

      if (toastEnabled) {
        const { BrowserWindow, Notification: ElectronNotification } = require('electron')
        const getActiveWindow = () => BrowserWindow.getAllWindows().find((w: any) => !w.isDestroyed() && !w.getParentWindow())
        const win = getActiveWindow()
        const isFocused = win ? (win.isFocused() && !win.isMinimized()) : false
        if (!isFocused) {
          const systemNotif = new ElectronNotification({
            title: title,
            body: body,
            silent: true
          })
          activeSystemNotifications.add(systemNotif)
          systemNotif.on('click', () => {
            const activeWin = getActiveWindow()
            if (activeWin) {
              if (activeWin.isMinimized()) activeWin.restore()
              activeWin.show()
              activeWin.focus()
              activeWin.setAlwaysOnTop(true)
              activeWin.setAlwaysOnTop(false)
              activeWin.webContents.send('notifications:click-action', normalized.id)
            }
            activeSystemNotifications.delete(systemNotif)
          })
          systemNotif.on('close', () => {
            activeSystemNotifications.delete(systemNotif)
          })
          systemNotif.show()
        }
      }
    }
  } catch (err) {
    logger.error(err)
  }
}
