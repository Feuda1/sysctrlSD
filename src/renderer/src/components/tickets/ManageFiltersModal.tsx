import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Trash2, Plus, ArrowUp, ArrowDown, ShieldAlert, Check, Search, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { TicketFilter, MetadataItem, TicketTypeItem, TicketReasonItem, TicketTagItem } from '@/types/ticket'
import { DEFAULT_COLUMNS } from '@/types/ticket'

const AVAILABLE_COLUMNS: MetadataItem[] = [
  { id: 1,  name: 'Номер' },
  { id: 2,  name: 'Тема' },
  { id: 3,  name: 'Статус' },
  { id: 4,  name: 'Приоритет' },
  { id: 5,  name: 'Организация' },
  { id: 6,  name: 'Группа' },
  { id: 7,  name: 'Ответственный' },
  { id: 8,  name: 'Дата создания' },
  { id: 9,  name: 'Обновлена' },
  { id: 10, name: 'Отложено до' },
  { id: 11, name: 'Баллы за заявку' },
  { id: 12, name: 'Тип заявки' },
  { id: 13, name: 'Причина обращения (IIKO)' },
  { id: 14, name: 'Теги' },
]

const COLUMN_KEY_MAP: Record<number, string> = {
  1: 'number', 2: 'title', 3: 'state', 4: 'priority', 5: 'organization',
  6: 'group', 7: 'owner', 8: 'createdAt', 9: 'updatedAt', 10: 'pendingTime', 11: 'score', 12: 'ticketType', 13: 'iikoReasons', 14: 'tags'
}

const COLUMN_NAME_MAP: Record<string, string> = {
  number: 'Номер',
  title: 'Тема',
  state: 'Статус',
  priority: 'Приоритет',
  organization: 'Организация',
  group: 'Группа',
  owner: 'Ответственный',
  createdAt: 'Дата создания',
  updatedAt: 'Обновлена',
  pendingTime: 'Отложено до',
  score: 'Баллы за заявку',
  ticketType: 'Тип заявки',
  iikoReasons: 'Причина обращения (IIKO)',
  tags: 'Теги'
}

const SCORE_OPTIONS = [
  { value: 'any', label: 'Не важно' },
  { value: '0', label: '0' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: 'no_score', label: 'Без оценки' },
] as const

const YESNO_OPTIONS = [
  { value: 'any', label: 'Не важно' },
  { value: 'yes', label: 'Да' },
  { value: 'no',  label: 'Нет' },
] as const

function DropdownSearchableList({
  label,
  all,
  selected,
  onToggle,
}: {
  label: string
  all: { id: number | string; name: string }[]
  selected: { id: number | string; name: string }[]
  onToggle: (item: { id: number | string; name: string }) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [q, setQ] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = all.filter(i => i.name.toLowerCase().includes(q.toLowerCase()))
  const selIds = new Set(selected.map(s => s.id))

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full text-left rounded-lg border border-input bg-input/40 px-3 py-2 text-xs outline-none hover:border-primary/40 flex items-center justify-between min-h-[32px]"
        >
          <span className="truncate max-w-[90%] font-medium">
            {selected.length === 0 
              ? `Все / Не важно` 
              : selected.map(s => s.name).join(', ')
            }
          </span>
          <span className="text-[10px] text-muted-foreground ml-1">▼</span>
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-border shadow-xl bg-card p-2 space-y-2 max-h-[250px] flex flex-col">
            <div className="relative shrink-0">
              <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground/50 pointer-events-none" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Поиск..."
                className="w-full rounded-lg border border-input bg-input/60 pl-7 pr-2 py-1 text-xs outline-none focus:border-primary/60"
                autoFocus
              />
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
              {filtered.length === 0 ? (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">Не найдено</p>
              ) : (
                filtered.map(item => {
                  const isSelected = selIds.has(item.id)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggle(item)}
                      className={cn(
                        'w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors',
                        isSelected && 'bg-primary/5 text-primary font-medium'
                      )}
                    >
                      <span className="truncate mr-2">{item.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FormSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (v: any) => void
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full rounded-lg border border-input bg-input/40 pl-3 pr-8 py-2 text-xs outline-none hover:border-primary/40 cursor-pointer min-h-[32px] appearance-none"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-card text-foreground">{opt.label}</option>
          ))}
        </select>
        <span className="absolute right-3 top-2.5 text-[8px] text-muted-foreground pointer-events-none">▼</span>
      </div>
    </div>
  )
}

function AsyncSearch({
  label,
  placeholder,
  selected,
  onSearch,
  onSelect,
  onRemove,
  extraOptions,
}: {
  label: string
  placeholder: string
  selected: { id: number | 'me' | 'unassigned'; name: string }[]
  onSearch: (q: string) => Promise<{ id: number; name: string }[]>
  onSelect: (item: { id: number | 'me' | 'unassigned'; name: string }) => void
  onRemove: (id: number | 'me' | 'unassigned') => void
  extraOptions?: { id: 'me' | 'unassigned'; name: string }[]
}) {
  const [q, setQ] = useState('')
  const [suggestions, setSuggestions] = useState<{ id: number; name: string }[]>([])
  const [focused, setFocused] = useState(false)
  const selIds = new Set(selected.map(s => s.id))
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = (v: string) => {
    setQ(v)
    if (timer.current) clearTimeout(timer.current)
    if (v.length < 2) { setSuggestions([]); return }
    timer.current = setTimeout(async () => {
      try { setSuggestions(await onSearch(v)) } catch { setSuggestions([]) }
    }, 300)
  }

  const pick = (item: { id: number | 'me' | 'unassigned'; name: string }) => {
    if (!selIds.has(item.id)) onSelect(item)
    setQ('')
    setSuggestions([])
  }

  const showDropdown = focused && (suggestions.length > 0 || (q.length === 0 && (extraOptions?.length ?? 0) > 0))

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</label>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {selected.map(s => (
          <span key={String(s.id)} className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[11px] text-primary font-medium">
            {s.name}
            <button type="button" onClick={() => onRemove(s.id)} className="hover:opacity-70 leading-none">×</button>
          </span>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
        <input
          value={q}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-input bg-input/60 pl-7 pr-2 py-1.5 text-xs outline-none focus:border-primary/60"
        />
        {showDropdown && (
          <div className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-border shadow-xl bg-card max-h-[150px] overflow-y-auto p-1">
            {q.length === 0 && extraOptions?.map(opt => (
              <button key={opt.id} onMouseDown={e => { e.preventDefault(); pick(opt) }}
                className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs hover:bg-accent transition-colors font-medium">
                {opt.name}
              </button>
            ))}
            {suggestions.filter(s => !selIds.has(s.id)).map(s => (
              <button key={s.id} onMouseDown={e => { e.preventDefault(); pick(s) }}
                className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs hover:bg-accent transition-colors">
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type Conditions = NonNullable<TicketFilter['conditions']>

interface FilterFormProps {
  isNew: boolean
  name: string; setName: (v: string) => void
  cond: Conditions; setCond: (c: Conditions) => void
  states: MetadataItem[]
  priorities: MetadataItem[]
  groups: MetadataItem[]
  ticketTypes: TicketTypeItem[]
  iikoReasons: TicketReasonItem[]
  tags: TicketTagItem[]
  error: string
}

function FilterForm({
  isNew, name, setName, cond, setCond,
  states, priorities, groups, ticketTypes, iikoReasons, tags, error
}: FilterFormProps) {
  const patch = (p: Partial<Conditions>) => setCond({ ...cond, ...p })

  const toggleList = <T extends { id: any; name: string }>(
    item: T, list: T[] | undefined, key: keyof Conditions
  ) => {
    const cur = (list ?? []) as T[]
    const next = cur.some(x => x.id === item.id) ? cur.filter(x => x.id !== item.id) : [...cur, item]
    patch({ [key]: next } as Partial<Conditions>)
  }

  const addOwner = (item: { id: number | 'me' | 'unassigned'; name: string }) => {
    const owners = cond.owners ?? []
    if (!owners.some(o => o.id === item.id)) patch({ owners: [...owners, item] })
  }
  const removeOwner = (id: number | 'me' | 'unassigned') =>
    patch({ owners: (cond.owners ?? []).filter(o => o.id !== id) })

  const addOrg = (item: { id: number; name: string }) => {
    const orgs = cond.orgs ?? []
    if (!orgs.some(o => o.id === item.id)) patch({ orgs: [...orgs, item] })
  }
  const removeOrg = (id: number) => patch({ orgs: (cond.orgs ?? []).filter(o => o.id !== id) })

  const curCols = cond.columns ?? []

  const moveColumn = (index: number, direction: 'left' | 'right') => {
    const nextIndex = direction === 'left' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= curCols.length) return
    const nextCols = [...curCols]
    const temp = nextCols[index]
    nextCols[index] = nextCols[nextIndex]
    nextCols[nextIndex] = temp
    patch({ columns: nextCols })
  }

  const removeColumn = (index: number) => {
    const nextCols = curCols.filter((_, i) => i !== index)
    patch({ columns: nextCols })
  }

  const addColumn = (key: string) => {
    const nextCols = [...curCols, key]
    patch({ columns: nextCols })
  }

  return (
    <div className="space-y-5 rounded-xl border border-border/40 bg-muted/5 p-5 text-xs">
      <h4 className="font-semibold text-foreground text-sm">{isNew ? 'Новый фильтр' : 'Редактирование'}</h4>

      {error && (
        <div className="flex items-center gap-1.5 text-destructive rounded-lg border border-destructive/20 bg-destructive/5 p-2">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Название фильтра</label>
        <input
          value={name} onChange={e => setName(e.target.value)}
          placeholder="Например: Вторая линия"
          className="w-full rounded-lg border border-input bg-input px-3 py-2 outline-none focus:border-primary/60"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <DropdownSearchableList
          label="Группы"
          all={groups}
          selected={cond.groups ?? []}
          onToggle={item => toggleList(item, cond.groups, 'groups')}
        />

        <DropdownSearchableList
          label="Состояния"
          all={states}
          selected={cond.states ?? []}
          onToggle={item => toggleList(item, cond.states, 'states')}
        />

        <div className="col-span-2">
          <DropdownSearchableList
            label="Тип заявки"
            all={ticketTypes}
            selected={cond.ticketTypes ?? []}
            onToggle={item => toggleList(item, cond.ticketTypes, 'ticketTypes')}
          />
        </div>

        <div className="col-span-2">
          <DropdownSearchableList
            label="Причина обращения (IIKO)"
            all={iikoReasons}
            selected={cond.iikoReasons ?? []}
            onToggle={item => toggleList(item, cond.iikoReasons, 'iikoReasons')}
          />
        </div>

        <div className="col-span-2">
          <DropdownSearchableList
            label="Теги"
            all={tags}
            selected={cond.tags ?? []}
            onToggle={item => toggleList(item, cond.tags, 'tags')}
          />
        </div>

        <div className="col-span-2">
          <AsyncSearch
            label="Организация"
            placeholder="Начните вводить название…"
            selected={(cond.orgs ?? []).map(o => ({ id: o.id, name: o.name }))}
            onSearch={q => window.api.organizations.list({ query: q, page: 1, perPage: 10 })}
            onSelect={item => addOrg(item as { id: number; name: string })}
            onRemove={id => removeOrg(id as number)}
          />
        </div>

        <div className="col-span-2">
          <AsyncSearch
            label="Ответственный"
            placeholder="Поиск сотрудников…"
            selected={cond.owners ?? []}
            onSearch={q => window.api.users.search(q)}
            onSelect={addOwner}
            onRemove={removeOwner}
            extraOptions={[
              { id: 'me', name: 'Я (текущий пользователь)' },
              { id: 'unassigned', name: 'Не назначена' }
            ]}
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Приоритет</label>
          <div className="flex flex-wrap gap-1.5">
            {priorities.map(p => {
              const sel = (cond.priorities ?? []).some(x => x.id === p.id)
              return (
                <button
                  key={p.id} type="button"
                  onClick={() => toggleList(p, cond.priorities, 'priorities')}
                  className={cn(
                    'rounded-full border px-3.5 py-1 transition-colors',
                    sel ? 'border-primary/30 bg-primary/10 text-primary font-medium'
                        : 'border-border/60 text-muted-foreground hover:text-foreground'
                  )}
                >
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-border/30 pt-4 grid grid-cols-2 gap-4">
        <FormSelect label="Заведено в ERP"   options={YESNO_OPTIONS}  value={cond.checkInErp ?? 'any'} onChange={v => patch({ checkInErp: v })} />
        <FormSelect label="Счёт в ERP"       options={YESNO_OPTIONS}  value={cond.erpBill    ?? 'any'} onChange={v => patch({ erpBill: v })} />
        <FormSelect label="Стоимость (iiko)"  options={YESNO_OPTIONS}  value={cond.cost       ?? 'any'} onChange={v => patch({ cost: v })} />
        <FormSelect label="Баллы за заявку"   options={SCORE_OPTIONS}  value={cond.score      ?? 'any'} onChange={v => patch({ score: v })} />
      </div>

      <div className="border-t border-border/30 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
            Отображаемые колонки и их порядок
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => patch({ columns: [...DEFAULT_COLUMNS] })}
            className="h-6 px-2 text-[10px] text-primary hover:bg-primary/5 border border-primary/20 rounded-lg font-medium"
          >
            Сбросить по умолчанию
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-xl border border-dashed border-border/60 bg-muted/5 items-center">
          {curCols.length === 0 ? (
            <p className="text-muted-foreground/60 text-[11px] px-1">
              Колонки не настроены (отображаются стандартные). Нажмите «Сбросить по умолчанию» для настройки.
            </p>
          ) : (
            curCols.map((key, idx) => {
              const name = COLUMN_NAME_MAP[key] || key
              return (
                <div
                  key={key}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/8 pl-2.5 pr-1.5 py-0.5 text-xs text-primary font-medium select-none"
                >
                  <span>{name}</span>
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveColumn(idx, 'left')}
                      className="hover:bg-primary/10 rounded p-0.5 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp className="h-2.5 w-2.5 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === curCols.length - 1}
                      onClick={() => moveColumn(idx, 'right')}
                      className="hover:bg-primary/10 rounded p-0.5 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown className="h-2.5 w-2.5 -rotate-90" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeColumn(idx)}
                      className="hover:bg-primary/10 rounded p-0.5 ml-0.5 text-primary/70 hover:text-primary"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {AVAILABLE_COLUMNS.some(c => !curCols.includes(COLUMN_KEY_MAP[c.id])) && (
          <div className="space-y-1">
            <p className="text-muted-foreground/60 text-[10px]">Доступные для добавления:</p>
            <div className="flex flex-wrap gap-1.5">
              {AVAILABLE_COLUMNS.filter(col => !curCols.includes(COLUMN_KEY_MAP[col.id])).map(col => {
                const key = COLUMN_KEY_MAP[col.id]
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => addColumn(key)}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-border px-2.5 py-0.5 text-xs font-medium transition-colors"
                  >
                    <Plus className="h-2.5 w-2.5" />
                    {col.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ColorConfigForm({
  states,
  colors,
  onChange
}: {
  states: MetadataItem[]
  colors: Record<number, string>
  onChange: (stateId: number, color: string) => void
}) {
  const PRESET_COLORS = [
    '#f97316',
    '#ea580c',
    '#0284c7',
    '#16a34a',
    '#22c55e',
    '#6b7280',
    '#ef4444',
    '#3b82f6',
    '#a855f7',
    '#ec4899',
  ]

  return (
    <div className="space-y-5 rounded-xl border border-border/40 bg-muted/5 p-5 text-xs">
      <div>
        <h4 className="font-semibold text-foreground text-sm">Настройка цветов статусов</h4>
        <p className="text-muted-foreground text-[11px] mt-0.5">Выберите цвета для отображения статусов заявок в таблице.</p>
      </div>

      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
        {states.map(state => {
          const curColor = colors[state.id] || '#6b7280'
          return (
            <div key={state.id} className="flex items-center justify-between gap-4 p-2 rounded-lg border border-border/30 bg-card/40">
              <span className="font-medium text-foreground">{state.name}</span>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChange(state.id, c)}
                      className={cn(
                        "h-3.5 w-3.5 rounded-full border border-transparent transition-transform",
                        curColor === c ? "scale-125 border-foreground/50 shadow-sm" : "hover:scale-110"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={curColor}
                  onChange={e => onChange(state.id, e.target.value)}
                  className="h-6 w-6 rounded border border-border cursor-pointer bg-transparent shrink-0"
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function buildQuery(_name: string, cond: Conditions): string {
  const parts: string[] = []
  const searchValue = (value: string) => /^[a-z0-9_.:-]+$/i.test(value)
    ? value
    : `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

  if (cond.groups?.length)
    parts.push(`group_id:(${cond.groups.map(g => g.id).join(' OR ')})`)

  if (cond.states?.length)
    parts.push(`state_id:(${cond.states.map(s => s.id).join(' OR ')})`)

  if (cond.ticketTypes?.length)
    parts.push(`type:(${cond.ticketTypes.map(t => searchValue(t.id)).join(' OR ')})`)

  if (cond.iikoReasons?.length)
    parts.push(`ticket_reason:(${cond.iikoReasons.map(reason => searchValue(reason.id)).join(' OR ')})`)

  if (cond.tags?.length)
    parts.push(`tags:(${cond.tags.map(tag => searchValue(tag.id)).join(' OR ')})`)

  if (cond.owners?.length) {
    const ids = cond.owners.map(o => {
      if (o.id === 'me') return '{my_id}'
      if (o.id === 'unassigned') return '1'
      return String(o.id)
    })
    parts.push(`owner_id:(${ids.join(' OR ')})`)
  }

  if (cond.orgs?.length)
    parts.push(`organization_id:(${cond.orgs.map(o => o.id).join(' OR ')})`)

  if (cond.priorities?.length)
    parts.push(`priority_id:(${cond.priorities.map(p => p.id).join(' OR ')})`)

  if (cond.checkInErp && cond.checkInErp !== 'any')
    parts.push(cond.checkInErp === 'yes' ? 'check_in_erp:true' : 'NOT check_in_erp:true')

  if (cond.erpBill && cond.erpBill !== 'any')
    parts.push(cond.erpBill === 'yes'
      ? '_exists_:erp_bill AND NOT erp_bill:("" OR "false" OR "0")'
      : 'NOT (_exists_:erp_bill AND NOT erp_bill:("" OR "false" OR "0"))'
    )

  if (cond.cost && cond.cost !== 'any')
    parts.push(cond.cost === 'yes'
      ? '_exists_:ticketcost AND NOT ticketcost:("false" OR "0")'
      : 'NOT (_exists_:ticketcost AND NOT ticketcost:("false" OR "0"))'
    )

  if (cond.score && cond.score !== 'any') {
    if (cond.score === 'no_score') {
      parts.push('NOT score:(1 OR 2 OR 3 OR 4 OR 5 OR "01.0" OR "02.0" OR "03.0" OR "04.0" OR "05.0")')
    } else {
      const val = cond.score
      parts.push(`score:(${val} OR "0${val}.0" OR "0${val}" OR "${val}.0")`)
    }
  }

  return parts.length > 0 ? parts.join(' AND ') : '*'
}

interface ManageFiltersModalProps {
  filters: TicketFilter[]
  states: MetadataItem[]
  priorities: MetadataItem[]
  groups: MetadataItem[]
  ticketTypes: TicketTypeItem[]
  iikoReasons: TicketReasonItem[]
  tags: TicketTagItem[]
  stateColors: Record<number, string>
  onClose: () => void
  onSave: (updatedFilters: TicketFilter[]) => void
  onSaveColors: (updatedColors: Record<number, string>) => void
}

export function ManageFiltersModal({
  filters: initialFilters, states, priorities, groups, ticketTypes, iikoReasons, tags, stateColors,
  onClose, onSave, onSaveColors
}: ManageFiltersModalProps) {
  const [filters, setFilters] = useState<TicketFilter[]>([...initialFilters])
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isConfiguringColors, setIsConfiguringColors] = useState(false)
  const [tempColors, setTempColors] = useState<Record<number, string>>({})
  const [error, setError] = useState('')

  const [editName, setEditName] = useState('')
  const [editCond, setEditCond] = useState<NonNullable<TicketFilter['conditions']>>({})

  const updateFilters = (nextFilters: TicketFilter[]) => {
    setFilters(nextFilters)
    onSave(nextFilters)
  }

  const startEdit = (idx: number) => {
    const f = filters[idx]
    setIsConfiguringColors(false)
    setEditingIdx(idx); setIsAdding(false); setError('')
    setEditName(f.name)
    setEditCond({ ...(f.conditions ?? {}) })
  }

  const startAdd = () => {
    setIsConfiguringColors(false)
    setIsAdding(true); setEditingIdx(null); setError('')
    setEditName(''); setEditCond({})
  }

  const startConfigureColors = () => {
    setIsConfiguringColors(true)
    setEditingIdx(null)
    setIsAdding(false)
    setTempColors({ ...stateColors })
  }

  const saveForm = () => {
    if (!editName.trim()) { setError('Введите название фильтра'); return }
    const currentId = editingIdx !== null ? filters[editingIdx].wrapperId : Date.now()
    const enabled = editingIdx !== null ? filters[editingIdx].enabled : true
    const order = editingIdx !== null ? filters[editingIdx].order : filters.length

    const newFilter: TicketFilter = {
      wrapperId: currentId,
      name: editName.trim(),
      query: buildQuery(editName, editCond),
      conditions: editCond,
      enabled,
      order
    }
    const updated = [...filters]
    if (editingIdx !== null) updated[editingIdx] = newFilter
    else updated.push(newFilter)
    updateFilters(updated)
    setEditingIdx(null); setIsAdding(false); setError('')
  }

  const cancelForm = () => { setEditingIdx(null); setIsAdding(false); setError('') }

  const saveColors = async () => {
    await onSaveColors(tempColors)
    setIsConfiguringColors(false)
  }

  const cancelColors = () => {
    setIsConfiguringColors(false)
  }

  const handleColorChange = (stateId: number, color: string) => {
    setTempColors(prev => ({ ...prev, [stateId]: color }))
  }

  const move = (idx: number, dir: 'up' | 'down') => {
    const next = dir === 'up' ? idx - 1 : idx + 1
    if (next < 0 || next >= filters.length) return
    const a = [...filters];
    [a[idx], a[next]] = [a[next], a[idx]];
    a.forEach((f, i) => { f.order = i })
    updateFilters(a)
  }

  const removeFilter = (idx: number) => {
    const next = filters.filter((_, i) => i !== idx)
    next.forEach((f, i) => { f.order = i })
    updateFilters(next)
  }

  const showForm = isAdding || editingIdx !== null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.18 }}
        className="glass rounded-2xl p-6 w-full max-w-5xl shadow-2xl flex flex-col border border-border"
        style={{ maxHeight: '90vh' }}
      >
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4 shrink-0">
          <h3 className="text-sm font-semibold">Настройка фильтров</h3>
          <button onClick={onClose} className="h-6 w-6 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 flex flex-col gap-3 min-h-0">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Список фильтров</span>
              <Button onClick={startAdd} variant="outline" size="sm" className="h-7 px-2 text-xs border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:text-primary">
                <Plus className="h-3.5 w-3.5 mr-1" /> Добавить
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filters.map((f, idx) => {
                const isEditing = editingIdx === idx
                return (
                  <div
                    key={idx}
                    onClick={() => startEdit(idx)}
                    className={cn(
                      'group flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs transition-all duration-150 cursor-pointer',
                      isEditing
                        ? 'border-primary/40 bg-primary/5 shadow-sm'
                        : 'border-border/40 bg-muted/10 hover:bg-accent/40'
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const next = [...filters]
                        next[idx] = { ...f, enabled: f.enabled === false ? true : false }
                        updateFilters(next)
                      }}
                      className={cn(
                        'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors mr-0.5',
                        f.enabled !== false ? 'border-primary bg-primary' : 'border-border hover:border-primary/60'
                      )}
                    >
                      {f.enabled !== false && (
                        <svg className="h-2.5 w-2.5 text-primary-foreground" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={cn("font-semibold text-foreground truncate", f.enabled === false && "text-muted-foreground line-through")}>
                        {f.name}
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); move(idx, 'up') }}
                        className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === filters.length - 1}
                        onClick={(e) => { e.stopPropagation(); move(idx, 'down') }}
                        className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeFilter(idx) }}
                        className="h-6 w-6 rounded hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}

              {filters.length === 0 && (
                <div className="text-center py-8 text-muted-foreground/60 border border-dashed border-border/40 rounded-xl">
                  Нет сохраненных фильтров
                </div>
              )}
            </div>

            <div className="mt-auto pt-3 border-t border-border shrink-0">
              <Button
                type="button"
                variant={isConfiguringColors ? "secondary" : "ghost"}
                onClick={startConfigureColors}
                className={cn(
                  "w-full justify-start text-xs h-9 rounded-xl font-medium",
                  isConfiguringColors ? "bg-primary/10 text-primary hover:bg-primary/15" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Settings2 className="h-4 w-4 mr-2" /> Настройка цветов статусов
              </Button>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col min-h-0 border-l border-border/40 pl-6">
            {isConfiguringColors ? (
              <div className="flex-1 overflow-y-auto pr-1">
                <ColorConfigForm
                  states={states}
                  colors={tempColors}
                  onChange={handleColorChange}
                />
              </div>
            ) : showForm ? (
              <div className="flex-1 overflow-y-auto pr-1">
                <FilterForm
                  isNew={isAdding}
                  name={editName} setName={setEditName}
                  cond={editCond} setCond={setEditCond}
                  states={states} priorities={priorities} groups={groups} ticketTypes={ticketTypes} iikoReasons={iikoReasons} tags={tags}
                  error={error}
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground/60 p-8 border border-dashed border-border/40 rounded-2xl bg-muted/5">
                <Settings2 className="h-8 w-8 mb-2 opacity-40 text-primary" />
                <h4 className="font-semibold text-foreground/80 mb-1 text-sm">Редактирование фильтров</h4>
                <p className="text-xs max-w-sm">Выберите фильтр из списка слева, чтобы изменить его настройки, или настройте цвета статусов заявок.</p>
              </div>
            )}
          </div>
        </div>

        {(showForm || isConfiguringColors) && (
          <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-border shrink-0">
            {isConfiguringColors ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelColors} className="h-8">Отмена</Button>
                <Button size="sm" onClick={saveColors} className="h-8">Сохранить</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={cancelForm} className="h-8">Отмена</Button>
                <Button size="sm" onClick={saveForm} className="h-8">Сохранить</Button>
              </>
            )}
          </div>
        )}
      </motion.div>
    </div>
  )
}
