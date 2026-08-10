import { Mail, Phone, Send, Globe, StickyNote } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Small visual bits of a ticket: the channel icon and the priority dots. */
export function ChannelIcon({ channel, className }: { channel?: string | null; className?: string }) {
  if (!channel) return null
  const c = channel.toLowerCase()
  if (c.includes('mail') || c.includes('email')) {
    return <span title="Почта" className={cn("flex shrink-0", className)}><Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" /></span>
  }
  if (c.includes('phone') || c.includes('call') || c.includes('telephon')) {
    return <span title="Телефон" className={cn("flex shrink-0", className)}><Phone className="h-3.5 w-3.5 text-green-400 shrink-0" /></span>
  }
  if (c.includes('telegram') || c.includes('max') || c.includes('chat') || c.includes('fax')) {
    return <span title="Telegram / Бот" className={cn("flex shrink-0", className)}><Send className="h-3.5 w-3.5 text-sky-400 shrink-0" /></span>
  }
  if (c.includes('web')) {
    return <span title="Web" className={cn("flex shrink-0", className)}><Globe className="h-3.5 w-3.5 text-orange-400 shrink-0" /></span>
  }
  if (c.includes('note')) {
    return <span title="Заметка" className={cn("flex shrink-0", className)}><StickyNote className="h-3.5 w-3.5 text-amber-400 shrink-0" /></span>
  }
  return null
}

export function PriorityCircles({ name }: { name: string }) {
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
