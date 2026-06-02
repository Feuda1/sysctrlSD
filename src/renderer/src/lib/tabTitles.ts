import { Ticket, Phone, Building2, FileText, Settings, type LucideIcon } from 'lucide-react'

export interface TabMeta {
  title: string
  Icon: LucideIcon
}

/** Maps a tab's route path to a display title + icon. */
export function pathToTabMeta(path: string): TabMeta {
  const p = path.split('?')[0]
  const ticketId = ticketIdFromPath(p)
  if (ticketId) return { title: `Заявка #${ticketId}`, Icon: Ticket }
  if (p.startsWith('/dashboard/tickets')) return { title: 'Заявки', Icon: Ticket }
  if (p.startsWith('/dashboard/calls')) return { title: 'Звонки', Icon: Phone }
  if (p.startsWith('/dashboard/organizations')) return { title: 'Организации', Icon: Building2 }
  if (p.startsWith('/dashboard/forms')) return { title: 'Формы', Icon: FileText }
  if (p.startsWith('/dashboard/settings')) return { title: 'Настройки', Icon: Settings }
  return { title: 'Заявки', Icon: Ticket }
}

/** Returns the ticket id segment of a detail route, or null. */
export function ticketIdFromPath(path: string): string | null {
  const m = path.split('?')[0].match(/^\/dashboard\/tickets\/([^/]+)$/)
  return m ? m[1] : null
}
