import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Shared building blocks of the settings screens. */

export function SettingsHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[22px] w-10 shrink-0 rounded-full border transition-colors duration-200 outline-none",
        disabled ? "cursor-default opacity-40" : "cursor-pointer",
        checked ? "border-primary/50 bg-primary/30" : "border-border bg-muted/60"
      )}
    >
      <motion.span
        className="absolute top-[2px] h-4 w-4 rounded-full bg-foreground shadow-sm pointer-events-none"
        animate={{ left: checked ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 450, damping: 30 }}
      />
    </button>
  )
}



// Standard row: label + description on the left, control on the right. Used for
// every single toggle/segment setting so they share the same rhythm.
export function SettingRow({ title, description, control }: { title: string; description?: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function SegmentControl<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="relative flex p-1 rounded-xl border border-border bg-muted/30 text-xs font-medium w-full">
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 flex h-8 items-center justify-center rounded-lg transition-all duration-150 outline-none",
              active
                ? "bg-card text-foreground shadow-sm font-semibold border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function CustomSelect<T extends { id: number | string; name: string }>({
  value,
  options,
  onChange,
  placeholder = 'Выберите',
  searchable = true,
  clearable = true
}: {
  value: string | number
  options: T[]
  onChange: (value: T | null) => void
  placeholder?: string
  searchable?: boolean
  clearable?: boolean
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find(option => String(option.id) === String(value))
  const filteredOptions = query.trim()
    ? options.filter(option => option.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const select = (item: T) => {
    onChange(item)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-left text-xs text-foreground outline-none transition-all hover:bg-muted/40"
      >
        <span className="truncate">
          {selected ? selected.name : <span className="text-muted-foreground">{placeholder}</span>}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {clearable && selected && (
            <span
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="rounded p-0.5 hover:bg-accent/80 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl">
          {searchable && (
            <div className="sticky top-0 z-10 bg-card p-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Поиск..."
                  className="h-8 w-full rounded-md border border-border bg-muted/25 pl-8 pr-2 text-xs text-foreground outline-none focus:border-primary/60"
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="space-y-0.5">
            {filteredOptions.map(option => {
              const active = String(option.id) === String(value)
              return (
                <button
                  key={String(option.id)}
                  type="button"
                  onClick={() => select(option)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs hover:bg-accent",
                    active && "bg-primary/10 text-primary font-semibold"
                  )}
                >
                  <span className="truncate">{option.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary stroke-[3px]" />}
                </button>
              )
            })}
            {filteredOptions.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">Ничего не найдено</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function CustomMultiSelect<T extends { id: number | string; name: string }>({
  values,
  options,
  onChange,
  placeholder = 'Выберите',
  searchable = true,
  renderChip
}: {
  values: Array<number | string>
  options: T[]
  onChange: (values: T[]) => void
  placeholder?: string
  searchable?: boolean
  renderChip?: (value: T) => ReactNode
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.filter(option => values.some(value => String(value) === String(option.id)))
  const selectedIds = new Set(values.map(value => String(value)))
  const filteredOptions = query.trim()
    ? options.filter(option => option.name.toLowerCase().includes(query.trim().toLowerCase()))
    : options

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const toggle = (item: T) => {
    const exists = selectedIds.has(String(item.id))
    const next = exists
      ? selected.filter(option => String(option.id) !== String(item.id))
      : [...selected, item]
    onChange(next)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-left text-xs text-foreground outline-none transition-colors hover:bg-muted/40"
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : selected.slice(0, 3).map(item => (
            <span key={String(item.id)} className="inline-flex max-w-full items-center rounded-full border border-border bg-background/40 px-2 py-0.5 text-[11px]">
              {renderChip ? renderChip(item) : <span className="truncate">{item.name}</span>}
            </span>
          ))}
          {selected.length > 3 && <span className="text-[11px] text-muted-foreground">+{selected.length - 3}</span>}
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-xl">
          {searchable && (
            <div className="sticky top-0 z-10 bg-card p-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3 w-3 text-muted-foreground" />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Поиск..."
                  className="h-8 w-full rounded-md border border-border bg-muted/25 pl-8 pr-2 text-xs text-foreground outline-none focus:border-primary/60"
                  autoFocus
                />
              </div>
            </div>
          )}
          <div className="space-y-0.5">
            {filteredOptions.map(option => {
              const active = selectedIds.has(String(option.id))
              return (
                <button
                  key={String(option.id)}
                  type="button"
                  onClick={() => toggle(option)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded px-2.5 py-1.5 text-left text-xs hover:bg-accent",
                    active && "bg-primary/10 text-primary font-semibold"
                  )}
                >
                  <span className="truncate">{option.name}</span>
                  {active && <Check className="h-3.5 w-3.5 text-primary stroke-[3px]" />}
                </button>
              )
            })}
            {filteredOptions.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">Ничего не найдено</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
