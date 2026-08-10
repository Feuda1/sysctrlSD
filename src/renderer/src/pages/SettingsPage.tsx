import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Bell, Command, LogOut, Puzzle, RefreshCw, Sliders, User } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useTabsStore } from '@/store/tabs'
import { SecretSettingsModal } from '@/components/settings/SecretSettings'
import { AvatarSettings, ClientsProfileSettings } from '@/components/settings/ProfileSection'
import {
  AfterCommentSubmitSettings,
  ChatStyleSettings,
  OpenCreatedTicketSettings,
  ScrollDownArrowSettings,
  SendSuggestionSettings,
  ThemeToggle,
  TraySettings
} from '@/components/settings/InterfaceSection'
import { NotificationSettingsSection } from '@/components/settings/NotificationsSection'
import { MacroSettingsSection } from '@/components/settings/MacrosSection'
import { ExtensionSettings } from '@/components/settings/ExtensionSection'
import { UpdateSettings } from '@/components/settings/UpdateSection'

const SETTINGS_TABS = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'ui', label: 'Интерфейс', icon: Sliders },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'macros', label: 'Макросы', icon: Command },
  { id: 'extension', label: 'Расширение', icon: Puzzle },
  { id: 'about', label: 'Обновления', icon: RefreshCw }
] as const

type SettingsTab = typeof SETTINGS_TABS[number]['id']

export default function SettingsPage() {
  const secretClickCountRef = useRef(0)
  const [isSecretOpen, setIsSecretOpen] = useState(false)
  const navigateActive = useTabsStore(s => s.navigateActive)
  const logout = useAuthStore(s => s.logout)
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile')

  const handleSettingsTitleClick = () => {
    secretClickCountRef.current += 1
    if (secretClickCountRef.current >= 10) {
      secretClickCountRef.current = 0
      setIsSecretOpen(true)
    }
  }

  return (
    <>
      {isSecretOpen && <SecretSettingsModal onClose={() => setIsSecretOpen(false)} />}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6 pt-8 px-4 pb-2"
      >
        <div className="flex shrink-0 items-center justify-between">
          <h2 onClick={handleSettingsTitleClick} className="text-base font-bold tracking-tight text-foreground">Настройки</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateActive('/dashboard/tickets')}
            className="h-8 gap-2 text-muted-foreground hover:text-foreground text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Назад к заявкам
          </Button>
        </div>

        {/* The row fills whatever height is left and the card scrolls inside it:
            sizing the card by its content made the whole page grow and shrink
            with every tab, and a vh-based height did not match the real
            viewport. */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row gap-6">
          <div className="flex flex-row md:flex-col w-full md:w-48 shrink-0 self-start gap-1 rounded-xl border border-border/60 bg-card p-1.5 shadow-sm">
            {SETTINGS_TABS.map((tab) => {
              const TabIcon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 md:flex-initial items-center justify-center md:justify-start gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  )}
                >
                  <TabIcon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground/80")} />
                  <span className="hidden md:inline">{tab.label}</span>
                </button>
              )
            })}
          </div>

          <div className="flex-1 w-full min-w-0 min-h-0 overflow-y-auto rounded-xl border border-border/60 bg-card p-6 shadow-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 5 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -5 }}
                transition={{ duration: 0.15 }}
                className="space-y-6"
              >
                {activeTab === 'profile' && (
                  <div className="space-y-6">
                    <AvatarSettings />
                    <div className="h-px bg-border/40" />
                    <ClientsProfileSettings />
                    <div className="h-px bg-border/40" />
                    <Button
                      variant="ghost"
                      onClick={() => logout()}
                      className="w-full justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Выйти из аккаунта
                    </Button>
                  </div>
                )}

                {activeTab === 'ui' && (
                  <div className="space-y-6">
                    <ThemeToggle />
                    <div className="h-px bg-border/40" />
                    <TraySettings />
                    <div className="h-px bg-border/40" />
                    <ChatStyleSettings />
                    <div className="h-px bg-border/40" />
                    <AfterCommentSubmitSettings />
                    <div className="h-px bg-border/40" />
                    <OpenCreatedTicketSettings />
                    <div className="h-px bg-border/40" />
                    <SendSuggestionSettings />
                    <div className="h-px bg-border/40" />
                    <ScrollDownArrowSettings />
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <NotificationSettingsSection />
                )}

                {activeTab === 'macros' && (
                  <MacroSettingsSection />
                )}

                {activeTab === 'extension' && (
                  <ExtensionSettings />
                )}

                {activeTab === 'about' && (
                  <UpdateSettings />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </>
  )
}
