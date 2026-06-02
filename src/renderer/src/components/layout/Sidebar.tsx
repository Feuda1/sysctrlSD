import { Ticket, Phone, Building2, FileText, Plus } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'

const formItems = [
  { to: '/dashboard/forms', label: 'Формы', icon: FileText, tooltip: 'Переводы, Внедрение…' }
]

interface NavItemProps {
  to: string
  label: string
  icon: React.FC<{ className?: string }>
  tooltip?: string
}

function SidebarNavItem({ to, label, icon: Icon, tooltip }: NavItemProps) {
  const navigateActive = useTabsStore(s => s.navigateActive)
  const activeTab = useTabsStore(s => s.tabs.find(t => t.id === s.activeTabId))
  const section = to.split('/')[2]
  const isActive = (activeTab?.path ?? '').split('/')[2] === section

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-tab-path={to}
          onClick={() => navigateActive(to)}
          className={cn(
            'no-drag group relative flex h-9 w-full items-center justify-center rounded-md transition-colors duration-150',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-sidebar-foreground/45 hover:bg-sidebar-accent/55 hover:text-sidebar-foreground/80'
          )}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-full bg-primary/80" />
          )}
          <Icon className={cn('h-[17px] w-[17px] shrink-0', isActive && 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]')} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="font-medium">
        <p>{label}</p>
        {tooltip && <p className="text-xs text-muted-foreground">{tooltip}</p>}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const setQuickTicketOpen = useUIStore(s => s.setQuickTicketOpen)

  return (
    <TooltipProvider delayDuration={180}>
      <aside className="flex h-full w-14 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
        <div className="drag-region flex h-[38px] shrink-0 items-center justify-center border-b border-sidebar-border" />

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setQuickTicketOpen(true)}
                className="no-drag group relative flex h-9 w-full items-center justify-center rounded-md text-emerald-500 hover:bg-emerald-500/10 transition-colors duration-150"
              >
                <Plus className="h-[18px] w-[18px] shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              <p>Быстрая заявка</p>
            </TooltipContent>
          </Tooltip>

          <SidebarNavItem to="/dashboard/tickets" label="Заявки" icon={Ticket} />
          <SidebarNavItem to="/dashboard/calls" label="Звонки" icon={Phone} />
          <SidebarNavItem to="/dashboard/organizations" label="Организации" icon={Building2} />

          <div className="my-2 h-px bg-sidebar-border/50" />

          {formItems.map((item) => (
            <SidebarNavItem key={item.to} {...item} />
          ))}
        </nav>
      </aside>
    </TooltipProvider>
  )
}
