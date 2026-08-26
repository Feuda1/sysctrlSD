import { Ticket, Phone, Building2, FileText, Plus, ShieldAlert } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTabsStore } from '@/store/tabs'
import { useUIStore } from '@/store/ui'
import { useAuthStore } from '@/store/auth'
import { isAdminUser } from '@/lib/admin'

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
  const sidebarSide = useUIStore(s => s.sidebarSide)
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
            // Полоска активного пункта всегда прижата к внешнему краю окна.
            <span className={cn(
              'absolute top-1/2 h-[18px] w-[3px] -translate-y-1/2 bg-primary/80',
              sidebarSide === 'right' ? 'right-0 rounded-l-full' : 'left-0 rounded-r-full'
            )} />
          )}
          <Icon className={cn('h-[17px] w-[17px] shrink-0', isActive && 'drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]')} />
        </button>
      </TooltipTrigger>
      <TooltipContent side={sidebarSide === 'right' ? 'left' : 'right'} className="font-medium">
        <p>{label}</p>
        {tooltip && <p className="text-xs text-muted-foreground">{tooltip}</p>}
      </TooltipContent>
    </Tooltip>
  )
}

export function Sidebar() {
  const setQuickTicketOpen = useUIStore(s => s.setQuickTicketOpen)
  const sidebarSide = useUIStore(s => s.sidebarSide)
  const onRight = sidebarSide === 'right'
  const isAdmin = useAuthStore(s => isAdminUser(s.user?.id))

  return (
    <TooltipProvider delayDuration={180}>
      {/* Панель остаётся первой в разметке - переход к навигации с клавиатуры не
          зависит от того, к какому краю она прижата. */}
      <aside className={cn(
        'flex h-full w-14 shrink-0 flex-col',
        // Справа верхние 38px отданы кнопкам окна: панель туда не заходит ни
        // фоном, ни рамкой, иначе заливка ложится прямо под крестик. Фон и край
        // в этом случае несёт сама навигация, начинаясь под строкой заголовка.
        onRight ? 'order-last' : 'border-r border-sidebar-border bg-sidebar'
      )}>
        {/* Слева это часть шапки и её можно тянуть; справа под ней кнопки окна,
            поэтому здесь остаётся только пустой отступ. */}
        {/* Справа 37px, а не 38: панель вкладок рисует нижнюю рамку внутри своей
            высоты, и верхняя грань навигации должна встать ровно на неё, иначе
            линия ломается на стыке. */}
        <div className={cn(
          'shrink-0',
          onRight ? 'h-[37px]' : 'drag-region h-[38px] border-b border-sidebar-border'
        )} />

        <nav className={cn(
          'flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3',
          // Верхняя грань продолжает линию под панелью вкладок, поэтому берёт
          // её цвет, а не более тёмный цвет краёв боковой панели.
          onRight && 'border-l border-sidebar-border border-t border-t-border bg-sidebar'
        )}>
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
            <TooltipContent side={onRight ? 'left' : 'right'} className="font-medium">
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

          {isAdmin && (
            <>
              <div className="my-2 h-px bg-sidebar-border/50" />
              <SidebarNavItem to="/dashboard/admin" label="Админ" icon={ShieldAlert} tooltip="Кто онлайн, бан/кик" />
            </>
          )}
        </nav>
      </aside>
    </TooltipProvider>
  )
}
