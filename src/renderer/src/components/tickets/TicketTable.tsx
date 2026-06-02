import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { ArrowUp, ArrowDown, ChevronsUpDown, Inbox, ChevronLeft, ChevronRight, Mail, Phone, Send, Globe, StickyNote } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { getStateBadgeClass, getTicketTypeBadgeClass, formatTicketDate, DEFAULT_COLUMNS } from '@/types/ticket'
import type { Ticket } from '@/types/ticket'

const FALLBACK_COLUMN_WIDTH = 160
const COLUMN_WIDTHS: Record<string, number> = {
  number: 72,
  organization: 170,
  title: 300,
  group: 120,
  owner: 130,
  priority: 90,
  ticketType: 120,
  iikoReasons: 180,
  tags: 180,
  state: 120,
  createdAt: 116,
  updatedAt: 116,
  pendingTime: 116,
  score: 64
}

function getColumnWidth(column: ColumnDef<Ticket>): number {
  const id = column.id
  return column.size ?? (id ? COLUMN_WIDTHS[id] : undefined) ?? FALLBACK_COLUMN_WIDTH
}

function truncateText(value: string | null | undefined, maxLength: number): string {
  const text = value?.trim() || '—'
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}




function StateBadge({ name, color }: { name: string; color?: string }) {
  const style = color ? {
    backgroundColor: `${color}15`,
    color: color,
    borderColor: `${color}30`,
    borderWidth: '1px'
  } : undefined
  return (
    <span
      className={cn('inline-flex max-w-full items-center overflow-hidden text-ellipsis rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', !color && getStateBadgeClass(name))}
      style={style}
      title={name}
    >
      {name || '—'}
    </span>
  )
}

function PriorityCell({ name }: { name: string }) {
  const n = name.toLowerCase()
  let level = 2
  let colorClass = 'bg-blue-400'
  let tooltip = 'Нормальный'

  if (n.includes('4') || n.includes('critical') || n.includes('критич')) {
    level = 4
    colorClass = 'bg-red-500'
    tooltip = 'Критический'
  } else if (n.includes('3') || n.includes('high') || n.includes('высок')) {
    level = 3
    colorClass = 'bg-orange-400'
    tooltip = 'Высокий'
  } else if (n.includes('2') || n.includes('normal') || n.includes('нормал')) {
    level = 2
    colorClass = 'bg-blue-400'
    tooltip = 'Нормальный'
  } else if (n.includes('1') || n.includes('low') || n.includes('низк')) {
    level = 1
    colorClass = 'bg-slate-400'
    tooltip = 'Низкий'
  }

  const maxCircles = Math.max(3, level)

  return (
    <span className="flex items-center gap-1" title={`${tooltip} (${name})`}>
      {Array.from({ length: maxCircles }).map((_, i) => {
        const isActive = i < level
        return (
          <span
            key={i}
            className={cn(
              'h-2 w-2 rounded-full shrink-0 transition-colors duration-150',
              isActive ? colorClass : 'bg-muted/40 border border-border/40'
            )}
          />
        )
      })}
    </span>
  )
}

function ChannelIcon({ channel }: { channel?: string | null }) {
  if (!channel) return null
  const c = channel.toLowerCase()
  if (c.includes('mail') || c.includes('email')) {
    return <span title="Почта" className="flex shrink-0"><Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" /></span>
  }
  if (c.includes('phone') || c.includes('call') || c.includes('telephon')) {
    return <span title="Телефон" className="flex shrink-0"><Phone className="h-3.5 w-3.5 text-green-400 shrink-0" /></span>
  }
  if (c.includes('telegram') || c.includes('max') || c.includes('chat') || c.includes('fax')) {
    return <span title="Telegram / Бот" className="flex shrink-0"><Send className="h-3.5 w-3.5 text-sky-400 shrink-0" /></span>
  }
  if (c.includes('web')) {
    return <span title="Web" className="flex shrink-0"><Globe className="h-3.5 w-3.5 text-orange-400 shrink-0" /></span>
  }
  if (c.includes('note')) {
    return <span title="Заметка" className="flex shrink-0"><StickyNote className="h-3.5 w-3.5 text-amber-400 shrink-0" /></span>
  }
  return null
}

const columns: ColumnDef<Ticket>[] = [
  {
    id: 'number',
    accessorFn: row => row.clientNumber || row.id,
    header: 'Номер',
    size: 92,
    enableSorting: true,
    cell: ({ row }) => (
      <span
        className="block truncate font-mono text-[11px] text-muted-foreground tabular-nums whitespace-nowrap"
        title={`Clients #: ${row.original.clientNumber || 'не найден'} | Zammad id: ${row.original.id} | Zammad #: ${row.original.number || '—'}`}
      >
        {row.original.clientNumber || row.original.id}
      </span>
    )
  },
  {
    id: 'title',
    accessorKey: 'title',
    header: 'Тема',
    enableSorting: true,
    cell: ({ row }) => (
      <div className="flex items-start gap-1.5 min-w-0">
        <div className="pt-0.5 shrink-0">
          <ChannelIcon channel={row.original.channel} />
        </div>
        <span className="block max-h-[4.25rem] overflow-hidden text-sm leading-5 text-foreground whitespace-normal break-words" title={row.original.title}>
          {truncateText(row.original.title, 140)}
        </span>
      </div>
    )
  },
  {
    id: 'state',
    accessorKey: 'state',
    header: 'Статус',
    size: 150,
    enableSorting: true,
    cell: ({ row, table }) => {
      const stateColors = (table.options.meta as any)?.stateColors ?? {}
      const color = stateColors[row.original.state.id]
      return <StateBadge name={row.original.state.name} color={color} />
    }
  },
  {
    id: 'priority',
    accessorKey: 'priority',
    header: 'Приоритет',
    size: 100,
    enableSorting: true,
    cell: ({ row }) => <PriorityCell name={row.original.priority.name} />
  },
  {
    id: 'ticketType',
    accessorKey: 'ticketType',
    header: 'Тип',
    size: 140,
    enableSorting: true,
    cell: ({ row }) => (
      <span
        className={cn(
          'inline-flex max-w-full items-center overflow-hidden text-ellipsis rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
          getTicketTypeBadgeClass(row.original.ticketType?.id, row.original.ticketType?.name)
        )}
        title={row.original.ticketType?.id || row.original.ticketType?.name || undefined}
      >
        {row.original.ticketType?.name || '—'}
      </span>
    )
  },
  {
    id: 'organization',
    accessorKey: 'organization',
    header: 'Организация',
    size: 200,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="block max-h-12 overflow-hidden text-xs leading-4 text-muted-foreground whitespace-normal break-words" title={row.original.organization.name}>
        {truncateText(row.original.organization.name, 90)}
      </span>
    )
  },
  {
    id: 'iikoReasons',
    accessorKey: 'iikoReasons',
    header: 'Причина IIKO',
    size: 190,
    enableSorting: true,
    cell: ({ row }) => {
      const reasons = row.original.iikoReasons ?? []
      if (reasons.length === 0) {
        return <span className="text-xs text-muted-foreground">—</span>
      }
      return (
        <div className="flex max-h-12 flex-wrap gap-1 overflow-hidden">
          {reasons.map(reason => (
            <span
              key={reason.id}
              className="inline-flex max-w-full items-center rounded-full border border-sky-500/25 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300"
              title={reason.id}
            >
              <span className="truncate">{reason.name}</span>
            </span>
          ))}
        </div>
      )
    }
  },
  {
    id: 'tags',
    accessorKey: 'tags',
    header: 'Теги',
    size: 190,
    enableSorting: true,
    cell: ({ row }) => {
      const tags = row.original.tags ?? []
      if (tags.length === 0) {
        return <span className="text-xs text-muted-foreground">—</span>
      }
      return (
        <div className="flex max-h-12 flex-wrap gap-1 overflow-hidden">
          {tags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex max-w-full items-center rounded-full border border-violet-500/25 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300"
              title={tag.id}
            >
              <span className="truncate">{tag.name}</span>
            </span>
          ))}
        </div>
      )
    }
  },
  {
    id: 'group',
    accessorKey: 'group',
    header: 'Группа',
    size: 150,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground block truncate" title={row.original.group.name}>
        {row.original.group.name || '—'}
      </span>
    )
  },
  {
    id: 'owner',
    accessorKey: 'owner',
    header: 'Ответственный',
    size: 160,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground block truncate" title={row.original.owner.name}>
        {row.original.owner.name || '—'}
      </span>
    )
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: 'Создана',
    size: 140,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="block text-xs leading-4 text-muted-foreground tabular-nums whitespace-normal">
        {formatTicketDate(row.original.createdAt)}
      </span>
    )
  },
  {
    id: 'updatedAt',
    accessorKey: 'updatedAt',
    header: 'Обновлена',
    size: 140,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="block text-xs leading-4 text-muted-foreground tabular-nums whitespace-normal">
        {formatTicketDate(row.original.updatedAt || row.original.createdAt)}
      </span>
    )
  },
  {
    id: 'pendingTime',
    accessorKey: 'pendingTime',
    header: 'Отложено до',
    size: 140,
    enableSorting: true,
    cell: ({ row }) => (
      <span className="block text-xs leading-4 text-muted-foreground tabular-nums whitespace-normal">
        {formatTicketDate(row.original.pendingTime || '')}
      </span>
    )
  },
  {
    id: 'score',
    accessorKey: 'score',
    header: 'Баллы',
    size: 80,
    enableSorting: true,
    cell: ({ row }) => {
      const val = row.original.score
      return (
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">
          {val !== null && val !== undefined ? String(val) : '—'}
        </span>
      )
    }
  }
]

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function TableSkeleton({ columnsCount }: { columnsCount: number }) {
  return (
    <>
      {Array.from({ length: 12 }).map((_, i) => (
        <tr key={i} className="border-b border-border/30">
          {Array.from({ length: columnsCount }).map((_, cellIdx) => (
            <td key={cellIdx} className="px-3 py-2.5">
              <div className="h-3 rounded bg-muted/60 animate-pulse w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

function SortIcon({ sorted }: { sorted: 'asc' | 'desc' | false }) {
  if (sorted === 'asc') return <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
  if (sorted === 'desc') return <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
  return <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-25" />
}

interface TicketTableProps {
  tickets: Ticket[]
  total: number
  page: number
  totalPages: number
  sorting: SortingState
  isLoading: boolean
  onSortChange: (sorting: SortingState) => void
  onPageChange: (page: number) => void
  visibleColumns?: string[]
  stateColors?: Record<number, string>
  onRowClick?: (ticketId: number) => void
}

export function TicketTable({
  tickets,
  total,
  page,
  totalPages,
  sorting,
  isLoading,
  onSortChange,
  onPageChange,
  visibleColumns,
  stateColors,
  onRowClick
}: TicketTableProps) {
  const filteredColumns = useMemo(() => {
    const activeCols = visibleColumns && visibleColumns.length > 0 ? visibleColumns : DEFAULT_COLUMNS
    const colMap = new Map(columns.map(c => [c.id!, c]))
    const sortedColumnId = sorting[0]?.id
    const columnIds = sortedColumnId && colMap.has(sortedColumnId) && !activeCols.includes(sortedColumnId)
      ? [...activeCols, sortedColumnId]
      : activeCols

    return columnIds
      .map(id => colMap.get(id))
      .filter((c): c is ColumnDef<Ticket> => !!c)
  }, [sorting, visibleColumns])

  const tableMinWidth = useMemo(
    () => filteredColumns.reduce((width, col) => width + getColumnWidth(col), 0),
    [filteredColumns]
  )

  const table = useReactTable({
    data: tickets,
    columns: filteredColumns,
    meta: { stateColors },
    state: { sorting },
    onSortingChange: (updaterOrValue) => {
      const nextSorting = typeof updaterOrValue === 'function' ? updaterOrValue(sorting) : updaterOrValue
      onSortChange(nextSorting)
    },
    manualSorting: true,
    manualPagination: true,
    pageCount: totalPages,
    getCoreRowModel: getCoreRowModel()
  })

  const perPage = 50
  const firstRow = total > 0 ? (page - 1) * perPage + 1 : 0
  const lastRow = Math.min(page * perPage, total)

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="shrink-0 flex-1 min-h-0 overflow-auto rounded-xl border border-border">
        <table className="w-full table-fixed text-left border-collapse">
          <colgroup>
            {filteredColumns.map(col => (
              <col key={col.id} style={{ width: `${(getColumnWidth(col) / tableMinWidth) * 100}%` }} />
            ))}
          </colgroup>

          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className="overflow-hidden px-2.5 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap select-none first:rounded-tl-xl last:rounded-tr-xl"
                    >
                      <button
                        className="flex w-full min-w-0 items-center gap-1 hover:text-foreground transition-colors duration-100"
                        onClick={() => {
                          if (!sorted || sorted === 'desc') {
                            onSortChange([{ id: header.id, desc: false }])
                          } else {
                            onSortChange([{ id: header.id, desc: true }])
                          }
                        }}
                      >
                        <span className="min-w-0 truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        <SortIcon sorted={sorted} />
                      </button>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>

          <tbody className="divide-y divide-border/30">
            {isLoading ? (
              <TableSkeleton columnsCount={filteredColumns.length} />
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={filteredColumns.length} className="py-16 text-center">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-2 text-muted-foreground"
                  >
                    <Inbox className="h-8 w-8 opacity-40" />
                    <p className="text-sm">Заявок нет</p>
                  </motion.div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-tab-path={`/dashboard/tickets/${row.original.id}`}
                  className="cursor-pointer hover:bg-accent/30 transition-colors duration-75"
                  onClick={() => onRowClick?.(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="h-11 px-2.5 py-2 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between shrink-0 px-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {firstRow}–{lastRow} из {total}
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-8 gap-1 px-2.5 text-xs">
              <ChevronLeft className="h-3.5 w-3.5" />
              Пред
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[48px] text-center">
              {page} / {totalPages}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="h-8 gap-1 px-2.5 text-xs">
              След
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
