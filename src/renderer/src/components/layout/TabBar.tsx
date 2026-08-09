import { useEffect, useRef, useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Bell,
  RefreshCw,
  Settings,
  Hash
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTabsStore } from '@/store/tabs'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { getUserInitials, getUserDisplayName, cn } from '@/lib/utils'
import { pathToTabMeta, ticketIdFromPath } from '@/lib/tabTitles'
import { showContextMenu, separator } from '@/lib/contextMenu'
import { useNotificationsStore } from '@/store/notifications'

const DEFAULT_PATH = '/dashboard/tickets'

export function TabBar() {
  const tabs = useTabsStore(s => s.tabs)
  const activeTabId = useTabsStore(s => s.activeTabId)
  const setActive = useTabsStore(s => s.setActive)
  const closeTab = useTabsStore(s => s.closeTab)
  const openTab = useTabsStore(s => s.openTab)
  const navigateActive = useTabsStore(s => s.navigateActive)
  const back = useTabsStore(s => s.back)
  const forward = useTabsStore(s => s.forward)
  const openInNewWindow = useTabsStore(s => s.openInNewWindow)
  const moveTab = useTabsStore(s => s.moveTab)

  const user = useAuthStore(s => s.user)
  const installUpdate = useUIStore(s => s.installUpdate)
  const updateReady = useUIStore(s => s.update.status === 'downloaded')

  const draggingId = useRef<string | null>(null)

  const activeTab = tabs.find(t => t.id === activeTabId)
  const activePath = activeTab?.path ?? DEFAULT_PATH
  const activeTicketId = ticketIdFromPath(activePath)

  const [idInput, setIdInput] = useState('')
  useEffect(() => {
    setIdInput(activeTicketId ?? '')
  }, [activeTicketId, activeTabId])

  const submitId = () => {
    const id = idInput.trim().replace(/\D/g, '')
    if (id) navigateActive(`/dashboard/tickets/${id}`)
  }

  const handleTabContextMenu = async (tabId: string, path: string) => {
    const ticketId = ticketIdFromPath(path)
    const picked = await showContextMenu([
      { id: 'duplicate', label: 'Открыть в новой вкладке' },
      { id: 'new-window', label: 'Открыть в отдельном окне' },
      ...(ticketId ? [separator(), { id: 'copy-id', label: `Копировать номер заявки (${ticketId})` }] : []),
      separator(),
      { id: 'close', label: 'Закрыть вкладку' },
      { id: 'close-others', label: 'Закрыть остальные вкладки', enabled: tabs.length > 1 }
    ])

    if (picked === 'duplicate') openTab(path)
    else if (picked === 'new-window') openInNewWindow(path)
    else if (picked === 'copy-id' && ticketId) navigator.clipboard.writeText(ticketId)
    else if (picked === 'close') closeTab(tabId)
    else if (picked === 'close-others') {
      tabs.filter(t => t.id !== tabId).forEach(t => closeTab(t.id))
    }
  }

  const initials = user ? getUserInitials(user.firstname, user.lastname) : '??'
  const displayName = user ? getUserDisplayName(user.firstname, user.lastname) : ''

  const history = useNotificationsStore((s) => s.history)
  const markAsRead = useNotificationsStore((s) => s.markAsRead)
  const markAllAsRead = useNotificationsStore((s) => s.markAllAsRead)
  const unreadCount = history.filter((item) => !item.isRead).length
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (isNotifOpen) {
      wasOpenRef.current = true
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      markAllAsRead()
    }
  }, [isNotifOpen, markAllAsRead])

  useEffect(() => {
    if (!isNotifOpen) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!notifRef.current?.contains(e.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [isNotifOpen])

  // Drop a tab outside this window's bounds → detach it into a new OS window
  // positioned at the drop point (works across monitors).
  const handleTabDragEnd = (tabId: string, path: string, e: React.DragEvent) => {
    draggingId.current = null
    const { screenX, screenY } = e
    if (!screenX && !screenY) return
    const left = window.screenX
    const top = window.screenY
    const right = left + window.outerWidth
    const bottom = top + window.outerHeight
    const outside = screenX < left || screenX > right || screenY < top || screenY > bottom
    if (!outside) return
    openInNewWindow(path, { x: Math.round(screenX - 180), y: Math.round(screenY - 16) })
    if (tabs.length > 1) closeTab(tabId)
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="drag-region relative z-50 flex h-[38px] shrink-0 items-center gap-1.5 border-b border-border bg-background pl-1.5 pr-[138px] backdrop-blur-sm">
        <div className="no-drag flex items-center gap-0.5">
          <button
            type="button"
            onClick={back}
            disabled={!activeTab?.canGoBack}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            title="Назад"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={forward}
            disabled={!activeTab?.canGoForward}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
            title="Вперёд"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* ID address bar */}
        <div className="no-drag relative flex h-7 w-44 shrink-0 items-center rounded-md border border-border bg-muted/40 px-2 transition-colors focus-within:border-primary/60">
          <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            value={idInput}
            onChange={(e) => setIdInput(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') submitId() }}
            placeholder="ID заявки…"
            className="h-full w-full bg-transparent px-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
          />
          {idInput && (
            <button
              type="button"
              onClick={submitId}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-primary"
              title="Перейти"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tabs — shrink to fit instead of overflowing; empty area stays draggable */}
        <div
          className="flex min-w-0 flex-1 items-center gap-1"
          onDragOver={(e) => { if (draggingId.current) e.preventDefault() }}
        >
          {tabs.map(tab => {
            const meta = pathToTabMeta(tab.path)
            const Icon = meta.Icon
            const title = tab.title || meta.title
            const isActive = tab.id === activeTabId
            return (
              <div
                key={tab.id}
                draggable
                onDragStart={(e) => { draggingId.current = tab.id; e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={(e) => {
                  if (draggingId.current && draggingId.current !== tab.id) {
                    e.preventDefault()
                    moveTab(draggingId.current, tab.id)
                  }
                }}
                onDragEnd={(e) => handleTabDragEnd(tab.id, tab.path, e)}
                onClick={() => setActive(tab.id)}
                onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(tab.id) } }}
                onContextMenu={(e) => { e.preventDefault(); handleTabContextMenu(tab.id, tab.path) }}
                title={title}
                className={cn(
                  'no-drag group flex h-7 min-w-[44px] max-w-[180px] flex-1 cursor-pointer select-none items-center gap-1.5 rounded-md border px-2 text-xs transition-colors',
                  isActive
                    ? 'border-border bg-card text-foreground shadow-sm'
                    : 'border-transparent text-muted-foreground hover:bg-accent/40 hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:bg-background/60 hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
          <button
            type="button"
            onClick={() => openTab(DEFAULT_PATH)}
            className="no-drag flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            title="Новая вкладка"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Guaranteed empty draggable gap so tabs never crowd the move/handle area */}
        <div className="h-full w-16 shrink-0" />

        {/* Actions */}
        <div className="no-drag flex items-center gap-1">
          {updateReady && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={installUpdate}
                  className="h-7 gap-1.5 rounded-md bg-primary/15 px-2 text-[11px] font-medium text-primary hover:bg-primary/25"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Обновить
                </Button>
              </TooltipTrigger>
              <TooltipContent>Перезапустить и установить обновление</TooltipContent>
            </Tooltip>
          )}

          <div ref={notifRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 relative"
              onClick={() => setIsNotifOpen(!isNotifOpen)}
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-red-500 ring-1 ring-background" />
              )}
            </Button>

            <AnimatePresence>
              {isNotifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 mt-1.5 w-80 rounded-xl border border-border bg-popover p-3 shadow-2xl z-50 text-foreground"
                >
                  <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
                    <span className="text-xs font-semibold">Уведомления</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-[10px] text-primary hover:underline"
                      >
                        Прочитать все
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1 pr-1 select-none">
                    {history.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Нет уведомлений
                      </div>
                    ) : (
                      history.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            markAsRead(item.id)
                            openTab(`/dashboard/tickets/${item.ticketId}`)
                            setIsNotifOpen(false)
                          }}
                          className={cn(
                            "p-2 rounded-lg text-left transition-colors cursor-pointer text-xs flex flex-col gap-0.5",
                            item.isRead
                              ? "hover:bg-accent/40 text-muted-foreground"
                              : "bg-primary/5 hover:bg-primary/10 border-l-2 border-primary pl-1.5 font-medium text-foreground"
                          )}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <span className={cn("truncate font-semibold", item.isRead ? "text-foreground" : "text-primary")}>
                              {item.title}
                            </span>
                            <span className="text-[9px] opacity-60 shrink-0 font-mono">
                              {new Date(item.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <span className="text-[10px] line-clamp-2 leading-normal">
                            {item.body}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigateActive('/dashboard/settings')}>
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Настройки</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6 cursor-default" title={displayName}>
                {user?.avatarDataUrl && <AvatarImage src={user.avatarDataUrl} alt={displayName} />}
                <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{displayName}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}
