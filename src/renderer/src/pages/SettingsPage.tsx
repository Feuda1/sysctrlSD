import { motion, AnimatePresence } from 'framer-motion'
import {
  Camera, Check, ChevronDown, Clipboard, X, LogOut,
  Puzzle, FolderOpen, Copy, Volume2, Play, Upload, User, Sliders, Bell,
  Command, Trash2, ArrowLeft, Plus, Clock, Users, EyeOff, MessageSquare,
  Type, Info, Minus, Activity, Tags, Palette, Search, RefreshCw, DownloadCloud, CheckCircle2, AlertCircle
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getUserDisplayName, getUserInitials, cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useUIStore } from '@/store/ui'
import { useTabsStore } from '@/store/tabs'
import { useTicketFilters } from '@/hooks/useTickets'
import { useNotificationsStore } from '@/store/notifications'
import { useMacrosStore } from '@/store/macros'

type ClientProfileSettings = Awaited<ReturnType<typeof window.api.auth.getClientProfileSettings>>

const SETTINGS_TABS = [
  { id: 'profile', label: 'Профиль', icon: User },
  { id: 'ui', label: 'Интерфейс', icon: Sliders },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'macros', label: 'Макросы', icon: Command },
  { id: 'extension', label: 'Расширение', icon: Puzzle },
  { id: 'about', label: 'Обновления', icon: RefreshCw }
] as const

type SettingsTab = typeof SETTINGS_TABS[number]['id']

const PRESET_COLORS = [
  { name: 'Изумрудный', value: '#10b981' },
  { name: 'Алый', value: '#ef4444' },
  { name: 'Синий', value: '#3b82f6' },
  { name: 'Розовый', value: '#ec4899' },
  { name: 'Фиолетовый', value: '#8b5cf6' },
  { name: 'Янтарный', value: '#f59e0b' },
  { name: 'Голубой', value: '#06b6d4' },
  { name: 'Оранжевый', value: '#f97316' },
  { name: 'Индиго', value: '#6366f1' },
  { name: 'Бирюзовый', value: '#14b8a6' },
  { name: 'Лайм', value: '#84cc16' },
  { name: 'Серый', value: '#94a3b8' }
]

function SettingsHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
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

function Switch({ checked, onChange, disabled }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
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
function SettingRow({ title, description, control }: { title: string; description?: string; control: ReactNode }) {
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

function SegmentControl<T extends string | number>({
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

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useUIStore()
  const isDark = resolvedTheme === 'dark'

  return (
    <SettingRow
      title="Тема оформления"
      description={isDark ? 'Тёмная тема' : 'Светлая тема'}
      control={<Switch checked={isDark} onChange={() => setTheme(isDark ? 'light' : 'dark')} />}
    />
  )
}

function TraySettings() {
  const settings = useNotificationsStore((s) => s.settings)
  const saveSettings = useNotificationsStore((s) => s.saveSettings)

  if (!settings) return null

  const isEnabled = settings.closeToTrayEnabled !== false

  return (
    <SettingRow
      title="Сворачивать в трей при закрытии"
      description="При нажатии на крестик приложение будет сворачиваться в трей вместо закрытия"
      control={
        <Switch
          checked={isEnabled}
          onChange={(val) => saveSettings({ ...settings, closeToTrayEnabled: val })}
        />
      }
    />
  )
}

function SecretToggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}

function SecretSettingsModal({ onClose }: { onClose: () => void }) {
  const allowTicketPendingWithoutReason = useUIStore(s => s.allowTicketPendingWithoutReason)
  const setAllowTicketPendingWithoutReason = useUIStore(s => s.setAllowTicketPendingWithoutReason)
  const allowTicketStatusWithoutPublicComment = useUIStore(s => s.allowTicketStatusWithoutPublicComment)
  const setAllowTicketStatusWithoutPublicComment = useUIStore(s => s.setAllowTicketStatusWithoutPublicComment)
  const allowScoreWithoutClientsRight = useUIStore(s => s.allowScoreWithoutClientsRight)
  const setAllowScoreWithoutClientsRight = useUIStore(s => s.setAllowScoreWithoutClientsRight)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Секретные настройки</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <SecretToggle
            checked={allowTicketPendingWithoutReason}
            onChange={setAllowTicketPendingWithoutReason}
            label="Закрывать без причины обращения"
          />
          <SecretToggle
            checked={allowTicketStatusWithoutPublicComment}
            onChange={setAllowTicketStatusWithoutPublicComment}
            label="Откладывать без комментария"
          />
          <SecretToggle
            checked={allowScoreWithoutClientsRight}
            onChange={setAllowScoreWithoutClientsRight}
            label="Игнорировать запрет clients на баллы"
          />
        </div>
      </motion.div>
    </motion.div>
  )
}

function AvatarSettings() {
  const inputRef = useRef<HTMLInputElement>(null)
  const user = useAuthStore(s => s.user)
  const updateAvatar = useAuthStore(s => s.updateAvatar)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayName = user ? getUserDisplayName(user.firstname, user.lastname) : ''
  const initials = user ? getUserInitials(user.firstname, user.lastname) : '??'

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Выберите файл изображения')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
        reader.readAsDataURL(file)
      })
      await updateAvatar(dataUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить аватар')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Аватар профиля"
        description="Смените изображение вашего профиля в приложении"
      />
      <div className="flex items-center justify-between gap-4 bg-muted/10 rounded-xl p-4 border border-border/40 shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-12 w-12">
            {user?.avatarDataUrl && <AvatarImage src={user.avatarDataUrl} alt={displayName} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{displayName || 'Пользователь'}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email || 'Аватар Zammad'}</p>
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSaving}
          onClick={() => inputRef.current?.click()}
          className="h-9 shrink-0 gap-1.5 rounded-lg hover:bg-accent"
        >
          <Camera className="h-3.5 w-3.5" />
          {isSaving ? 'Сохранение…' : 'Сменить'}
        </Button>
      </div>
    </div>
  )
}



function ClientsProfileSettings() {
  const [settings, setSettings] = useState<ClientProfileSettings | null>(null)
  const [savedSettings, setSavedSettings] = useState<ClientProfileSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    window.api.auth.getClientProfileSettings()
      .then(data => {
        if (cancelled) return
        setSettings(data)
        setSavedSettings(data)
      })
      .catch(err => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль clients')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const savePatch = async (patch: Partial<Pick<ClientProfileSettings, 'zammadApiKey' | 'internalPhone' | 'defaultGroupId'>>) => {
    setSaving(true)
    setError(null)
    try {
      const next = await window.api.auth.updateClientProfileSettings(patch)
      setSavedSettings(next)
      setSettings(current => current ? {
        ...next,
        zammadApiKey: patch.zammadApiKey !== undefined && current.zammadApiKey !== patch.zammadApiKey ? current.zammadApiKey : next.zammadApiKey,
        internalPhone: patch.internalPhone !== undefined && current.internalPhone !== patch.internalPhone ? current.internalPhone : next.internalPhone
      } : next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить профиль clients')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!settings || !savedSettings) return

    const patch: Partial<Pick<ClientProfileSettings, 'zammadApiKey' | 'internalPhone'>> = {}
    if (settings.zammadApiKey !== savedSettings.zammadApiKey) patch.zammadApiKey = settings.zammadApiKey
    if (settings.internalPhone !== savedSettings.internalPhone) patch.internalPhone = settings.internalPhone
    if (Object.keys(patch).length === 0) return

    const timer = window.setTimeout(() => {
      savePatch(patch)
    }, 650)

    return () => window.clearTimeout(timer)
  }, [settings?.zammadApiKey, settings?.internalPhone, savedSettings?.zammadApiKey, savedSettings?.internalPhone])

  const handleCopy = async () => {
    if (!settings?.zammadApiKey) return
    await navigator.clipboard.writeText(settings.zammadApiKey)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!settings) {
    return <p className="text-xs text-destructive">{error || 'Профиль clients не загружен'}</p>
  }

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Синхронизация Zammad"
        description="Настройте ключи доступа и параметры интеграции с Zammad"
        action={saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Zammad API Key</span>
        <div className="flex gap-2">
          <input
            value={settings.zammadApiKey}
            onChange={event => setSettings({ ...settings, zammadApiKey: event.target.value })}
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-muted/20 px-3 font-mono text-xs text-foreground outline-none focus:border-primary/60 focus:bg-background transition-all"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg hover:bg-accent"
            onClick={handleCopy}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Clipboard className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Внутренний номер телефона</span>
        <input
          value={settings.internalPhone}
          onChange={event => setSettings({ ...settings, internalPhone: event.target.value })}
          className="h-9 w-full rounded-lg border border-border bg-muted/20 px-3 text-xs text-foreground outline-none focus:border-primary/60 focus:bg-background transition-all"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Группа по умолчанию при создании заявок</span>
        <CustomSelect
          value={settings.defaultGroupId}
          options={settings.groupOptions.map(g => ({ id: g.value, name: g.label }))}
          onChange={val => {
            const nextGroupId = val ? String(val.id) : ''
            setSettings({ ...settings, defaultGroupId: nextGroupId })
            savePatch({ defaultGroupId: nextGroupId })
          }}
          placeholder={settings.defaultGroupName || "Выберите группу"}
          searchable
          clearable={false}
        />
      </div>

      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}

function MiniBubble({ align, variant, name, time, text }: {
  align: 'left' | 'right'
  variant: 'agent' | 'client'
  name: string
  time: string
  text: string
}) {
  const isRight = align === 'right'
  const avatar = variant === 'agent'
    ? <div className="h-6 w-6 shrink-0 rounded-full bg-blue-500/20 dark:bg-blue-500/25 border border-blue-300 dark:border-blue-500/35 flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-300">АГ</div>
    : <div className="h-6 w-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-700 dark:text-zinc-300">ИИ</div>
  const bubble = variant === 'agent'
    ? "bg-blue-50/70 dark:bg-blue-950/45 border-blue-200/60 dark:border-blue-900/50 text-blue-950 dark:text-zinc-100"
    : "bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60 text-zinc-900 dark:text-zinc-100"
  const headBorder = variant === 'agent' ? "border-blue-200/60 dark:border-blue-900/30" : "border-zinc-200 dark:border-zinc-700/30"
  return (
    <div className={cn("flex gap-2 items-start", isRight ? "justify-end" : "justify-start")}>
      {!isRight && avatar}
      <div className={cn("max-w-[80%] rounded-2xl border p-2.5 text-[11px] flex flex-col gap-1 shadow-sm", bubble, isRight ? "rounded-tr-none" : "rounded-tl-none")}>
        <div className={cn("flex items-center justify-between gap-4 border-b pb-1 text-[9px] opacity-70", headBorder)}>
          <span className="font-bold">{name}</span>
          <span className="font-mono">{time}</span>
        </div>
        <span>{text}</span>
      </div>
      {isRight && avatar}
    </div>
  )
}

function ChatStyleSettings() {
  const { chatStyle, setChatStyle, bubbleSide, setBubbleSide } = useUIStore()

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Стиль чата в заявках</p>
        <p className="text-xs text-muted-foreground">Выберите предпочтительный вид отображения комментариев</p>
      </div>

      <SegmentControl
        value={chatStyle}
        options={[
          { value: 'modern', label: 'Бабблы' },
          { value: 'classic', label: 'Классический' }
        ]}
        onChange={setChatStyle}
      />

      {chatStyle === 'modern' && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs font-semibold text-muted-foreground">Сообщения клиента</p>
          <div className="w-52 shrink-0">
            <SegmentControl
              value={bubbleSide}
              options={[
                { value: 'client-right', label: 'Справа' },
                { value: 'client-left', label: 'Слева' }
              ]}
              onChange={setBubbleSide}
            />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 text-center">Предпросмотр</p>
        
        <div className="space-y-3 pointer-events-none select-none">
          {chatStyle === 'modern' ? (
            <div className="space-y-2.5">
              <MiniBubble
                align={bubbleSide === 'client-left' ? 'right' : 'left'}
                variant="agent"
                name="Агент Поддержки"
                time="12:30"
                text="Добрый день! Чем могу помочь?"
              />
              <MiniBubble
                align={bubbleSide === 'client-right' ? 'right' : 'left'}
                variant="client"
                name="Иван Иванов"
                time="12:32"
                text="Не работает интеграция со звонками."
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 text-[11px] text-blue-950 dark:text-zinc-100 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-blue-900/30 pb-1 text-[9px] text-blue-900/60 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-blue-950 dark:text-zinc-300">Агент Поддержки</span>
                    <span className="bg-blue-100 dark:bg-blue-900/45 text-blue-800 dark:text-blue-200 text-[8px] px-1.5 py-0.2 rounded-full font-medium">Агент</span>
                  </div>
                  <span className="font-mono">31.05.2026 12:30:15</span>
                </div>
                <span>Добрый день! Чем могу помочь?</span>
              </div>

              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-zinc-50/50 dark:bg-zinc-800/30 p-2.5 text-[11px] text-zinc-900 dark:text-zinc-100 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700/30 pb-1 text-[9px] text-zinc-650 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-zinc-900 dark:text-zinc-300">Иван Иванов</span>
                    <span className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300 text-[8px] px-1.5 py-0.2 rounded-full font-medium">Клиент</span>
                  </div>
                  <span className="font-mono">31.05.2026 12:32:40</span>
                </div>
                <span>Не работает интеграция со звонками.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AfterCommentSubmitSettings() {
  const { afterCommentSubmitAction, setAfterCommentSubmitAction } = useUIStore()

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">После отправки сообщения в заявку</p>
        <p className="text-xs text-muted-foreground">Выберите действие после отправки вашего комментария или ответа</p>
      </div>

      <SegmentControl
        value={afterCommentSubmitAction}
        options={[
          { value: 'stay', label: 'Оставаться в заявке' },
          { value: 'close', label: 'Закрывать и выходить' }
        ]}
        onChange={setAfterCommentSubmitAction}
      />
    </div>
  )
}

function OpenCreatedTicketSettings() {
  const { openCreatedTicket, setOpenCreatedTicket } = useUIStore()

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">После создания заявки</p>
        <p className="text-xs text-muted-foreground">Открывать ли только что созданную заявку — быструю, по звонку или вложенную</p>
      </div>

      <SegmentControl
        value={openCreatedTicket ? 'open' : 'stay'}
        options={[
          { value: 'open', label: 'Переходить на созданную заявку' },
          { value: 'stay', label: 'Не переходить' }
        ]}
        onChange={(value) => setOpenCreatedTicket(value === 'open')}
      />
    </div>
  )
}

function ScrollDownArrowSettings() {
  const { hideScrollDownArrow, setHideScrollDownArrow } = useUIStore()

  return (
    <SettingRow
      title="Скрывать стрелку прокрутки вниз"
      description="Кнопка быстрой прокрутки к последним сообщениям в заявке"
      control={<Switch checked={hideScrollDownArrow} onChange={setHideScrollDownArrow} />}
    />
  )
}

const EXTENSION_GUIDES: { id: string; name: string; steps: string[] }[] = [
  {
    id: 'chromium',
    name: 'Chrome, Edge, Яндекс, Opera',
    steps: [
      'Откройте страницу расширений: chrome://extensions (в Edge — edge://extensions, в Яндексе — browser://extensions).',
      'Включите «Режим разработчика» в правом верхнем углу.',
      'Нажмите «Загрузить распакованное расширение» и выберите папку расширения (путь — выше).'
    ]
  },
  {
    id: 'firefox',
    name: 'Firefox',
    steps: [
      'Откройте about:debugging#/runtime/this-firefox.',
      'Нажмите «Загрузить временное дополнение».',
      'Выберите файл manifest.json внутри папки расширения.'
    ]
  }
]

function ExtensionSettings() {
  const [info, setInfo] = useState<{ path: string; packaged: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const [openGuide, setOpenGuide] = useState<string | null>('chromium')

  useEffect(() => {
    window.api.app.getExtensionInfo().then(setInfo).catch(() => {})
  }, [])

  const copyPath = async () => {
    if (!info?.path) return
    await navigator.clipboard.writeText(info.path)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Расширение для браузера"
        description="Открывает ссылки на заявки clients.denvic.ru сразу в приложении"
      />
      
      <p className="text-xs text-muted-foreground leading-relaxed">
        Установите его один раз в ваш браузер. После этого все ссылки на заявки из писем или мессенджеров будут автоматически перенаправляться в приложение.
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">Папка с расширением</span>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
          <FolderOpen className="h-4 w-4 shrink-0 text-primary/80" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground select-text" title={info?.path || ''}>
            {info?.path || 'Загрузка…'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyPath}
            className="h-7 shrink-0 gap-1.5 rounded-lg text-xs"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Скопировано' : 'Копировать'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {EXTENSION_GUIDES.map(guide => {
          const open = openGuide === guide.id
          return (
            <div key={guide.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setOpenGuide(open ? null : guide.id)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-foreground hover:bg-accent/40 transition-colors"
              >
                {guide.name}
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
              </button>
              {open && (
                <ol className="space-y-2 border-t border-border/50 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground bg-muted/5">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">{i + 1}</span>
                      <span className="select-text pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
        После установки нажмите на иконку расширения в панели браузера, чтобы активировать интеграцию и включить опцию автозакрытия пустых вкладок.
      </p>
    </div>
  )
}

function NotificationSettingsSection() {
  const { data: filtersData } = useTicketFilters()
  const settings = useNotificationsStore((s) => s.settings)
  const sounds = useNotificationsStore((s) => s.sounds)
  const saveSettings = useNotificationsStore((s) => s.saveSettings)
  const loadSounds = useNotificationsStore((s) => s.loadSounds)
  const playSound = useNotificationsStore((s) => s.playSound)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploadError, setUploadError] = useState<string | null>(null)

  if (!settings) return null

  const allFilters = filtersData?.allFilters?.filter((f) => f.enabled !== false) || []

  const updateMyTickets = (patch: Partial<typeof settings>) => {
    saveSettings({
      ...settings,
      ...patch
    })
  }

  const updateFilterRule = (
    wrapperId: number,
    enabled: boolean,
    sound?: string,
    volume?: number,
    soundEnabled?: boolean,
    toastEnabled?: boolean
  ) => {
    const rules = [...settings.rules]
    const idx = rules.findIndex((r) => r.wrapperId === wrapperId)
    const ruleSound = sound !== undefined ? sound : (rules[idx]?.sound || 'synth-chime')
    const ruleVolume = volume !== undefined ? volume : (rules[idx]?.volume !== undefined ? rules[idx].volume : 1.0)
    const ruleSoundEnabled = soundEnabled !== undefined ? soundEnabled : (rules[idx]?.soundEnabled !== false)
    const ruleToastEnabled = toastEnabled !== undefined ? toastEnabled : (rules[idx]?.toastEnabled !== false)

    if (idx !== -1) {
      rules[idx] = {
        wrapperId,
        enabled,
        sound: ruleSound,
        volume: ruleVolume,
        soundEnabled: ruleSoundEnabled,
        toastEnabled: ruleToastEnabled
      }
    } else {
      rules.push({
        wrapperId,
        enabled,
        sound: ruleSound,
        volume: ruleVolume,
        soundEnabled: ruleSoundEnabled,
        toastEnabled: ruleToastEnabled
      } as any)
    }

    saveSettings({
      ...settings,
      rules
    })
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setUploadError(null)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
        reader.readAsDataURL(file)
      })
      await window.api.notifications.uploadSound(file.name, dataUrl)
      await loadSounds()
    } catch (err) {
      setUploadError('Ошибка загрузки звука')
    }
  }

  return (
    <div className="space-y-5">
      <SettingsHeader
        title="Настройки уведомлений"
        description="Настройте звуки и правила оповещений по заявкам и фильтрам"
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="h-8 shrink-0 gap-1.5 text-xs rounded-lg hover:bg-accent"
          >
            <Upload className="h-3.5 w-3.5" />
            Добавить звук
          </Button>
        }
      />
      
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

      <div className="space-y-4 rounded-xl border border-border/40 bg-muted/10 backdrop-blur-md p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Мои заявки</p>
            <p className="text-xs text-muted-foreground mt-0.5">Уведомления на все ваши заявки</p>
          </div>
          <Switch
            checked={settings.myTicketsEnabled}
            onChange={(val) => updateMyTickets({ myTicketsEnabled: val })}
          />
        </div>

        <AnimatePresence>
          {settings.myTicketsEnabled && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="space-y-4 border-t border-border/40 pt-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateMyTickets({ myTicketsSoundEnabled: settings.myTicketsSoundEnabled === false })}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 outline-none select-none",
                      settings.myTicketsSoundEnabled !== false
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <Volume2 className={cn("h-4 w-4 shrink-0", settings.myTicketsSoundEnabled !== false ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="text-xs font-semibold">Звук</p>
                      <p className="text-[10px] opacity-75">Звуковое оповещение</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateMyTickets({ myTicketsToastEnabled: settings.myTicketsToastEnabled === false })}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 outline-none select-none",
                      settings.myTicketsToastEnabled !== false
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/30"
                    )}
                  >
                    <MessageSquare className={cn("h-4 w-4 shrink-0", settings.myTicketsToastEnabled !== false ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="text-xs font-semibold">Баннер</p>
                      <p className="text-[10px] opacity-75">Всплывающее окно</p>
                    </div>
                  </button>
                </div>

                {settings.myTicketsSoundEnabled !== false && (
                  <div className="flex flex-col sm:flex-row sm:items-end gap-4 pt-1">
                    <div className="flex-1 min-w-[180px] flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Звук</span>
                      <CustomSelect
                        value={settings.myTicketsSound}
                        options={sounds.map((s) => ({ id: s.name, name: s.name.replace(/\.[^/.]+$/, "") }))}
                        onChange={(val) => {
                          if (val) updateMyTickets({ myTicketsSound: String(val.id) })
                        }}
                        placeholder="Выберите звук"
                        searchable
                        clearable={false}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Громкость</span>
                        <div className="flex items-center gap-2.5 h-9 bg-muted/20 border border-border/60 px-3 rounded-lg">
                          <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={settings.myTicketsVolume}
                            onChange={(e) => updateMyTickets({ myTicketsVolume: parseFloat(e.target.value) })}
                            className="w-24 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => playSound(settings.myTicketsSound, settings.myTicketsVolume)}
                        className="h-9 w-9 shrink-0 self-end rounded-lg hover:bg-accent"
                        title="Прослушать"
                      >
                        <Play className="h-4 w-4 text-foreground" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="rounded-xl border border-border/40 bg-muted/10 backdrop-blur-md p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Баллы за заявку</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Уведомлять, когда за вашу заявку выставили или изменили баллы
            </p>
          </div>
          <Switch
            checked={settings.scoreEnabled !== false}
            onChange={(val) => updateMyTickets({ scoreEnabled: val })}
          />
        </div>
      </div>

      {allFilters.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-2">Правила по фильтрам</p>
          <div className="space-y-3 pr-1">
            {allFilters.map((filter) => {
              const rule = settings.rules.find((r) => r.wrapperId === filter.wrapperId)
              const enabled = !!rule?.enabled
              const sound = rule?.sound || 'synth-chime'
              const volume = rule?.volume !== undefined ? rule.volume : 1.0
              const soundEnabled = rule?.soundEnabled !== false
              const toastEnabled = rule?.toastEnabled !== false

              return (
                <div key={filter.wrapperId} className="space-y-4 rounded-xl border border-border/40 bg-muted/10 backdrop-blur-md p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{filter.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Правила оповещений для данного фильтра</p>
                    </div>
                    <Switch
                      checked={enabled}
                      onChange={(val) => updateFilterRule(filter.wrapperId, val, sound, volume, soundEnabled, toastEnabled)}
                    />
                  </div>

                  <AnimatePresence>
                    {enabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-4 border-t border-border/40 pt-4 mt-4">
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => updateFilterRule(filter.wrapperId, enabled, sound, volume, !soundEnabled, toastEnabled)}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 outline-none select-none",
                                soundEnabled
                                  ? "border-primary/50 bg-primary/10 text-foreground"
                                  : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/30"
                              )}
                            >
                              <Volume2 className={cn("h-4 w-4 shrink-0", soundEnabled ? "text-primary" : "text-muted-foreground")} />
                              <div>
                                <p className="text-xs font-semibold">Звук</p>
                                <p className="text-[10px] opacity-75">Звуковое оповещение</p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => updateFilterRule(filter.wrapperId, enabled, sound, volume, soundEnabled, !toastEnabled)}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-200 outline-none select-none",
                                toastEnabled
                                  ? "border-primary/50 bg-primary/10 text-foreground"
                                  : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/30"
                              )}
                            >
                              <MessageSquare className={cn("h-4 w-4 shrink-0", toastEnabled ? "text-primary" : "text-muted-foreground")} />
                              <div>
                                <p className="text-xs font-semibold">Баннер</p>
                                <p className="text-[10px] opacity-75">Всплывающее окно</p>
                              </div>
                            </button>
                          </div>

                          {soundEnabled && (
                            <div className="flex flex-col sm:flex-row sm:items-end gap-4 pt-1">
                              <div className="flex-1 min-w-[180px] flex flex-col gap-1.5">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Звук</span>
                                <CustomSelect
                                  value={sound}
                                  options={sounds.map((s) => ({ id: s.name, name: s.name.replace(/\.[^/.]+$/, "") }))}
                                  onChange={(val) => {
                                    if (val) updateFilterRule(filter.wrapperId, enabled, String(val.id), volume, soundEnabled, toastEnabled)
                                  }}
                                  placeholder="Выберите звук"
                                  searchable
                                  clearable={false}
                                />
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="flex flex-col gap-1.5">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Громкость</span>
                                  <div className="flex items-center gap-2.5 h-9 bg-muted/20 border border-border/60 px-3 rounded-lg">
                                    <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <input
                                      type="range"
                                      min="0"
                                      max="1"
                                      step="0.05"
                                      value={volume}
                                      onChange={(e) => updateFilterRule(filter.wrapperId, enabled, sound, parseFloat(e.target.value), soundEnabled, toastEnabled)}
                                      className="w-24 h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                                    />
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => playSound(sound, volume)}
                                  className="h-9 w-9 shrink-0 self-end rounded-lg hover:bg-accent"
                                  title="Прослушать"
                                >
                                  <Play className="h-4 w-4 text-foreground" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CustomSelect<T extends { id: number | string; name: string }>({
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

function CustomMultiSelect<T extends { id: number | string; name: string }>({
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

function MacroSettingsSection() {
  const { macros, addMacro, updateMacro, deleteMacro } = useMacrosStore()
  const { data: filtersData } = useTicketFilters()

  const [editingMacro, setEditingMacro] = useState<any | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const [label, setLabel] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [internal, setInternal] = useState(false)
  const [stateId, setStateId] = useState('')
  const [groupId, setGroupId] = useState('')
  const [iikoReasonIds, setIikoReasonIds] = useState<string[]>([])
  const [tagNames, setTagNames] = useState<string[]>([])
  const [timeUnit, setTimeUnit] = useState('')
  const [colorClass, setColorClass] = useState('#94a3b8')

  useEffect(() => {
    if (editingMacro) {
      setLabel(editingMacro.label)
      setBodyText(editingMacro.bodyText || '')
      setInternal(!!editingMacro.internal)
      setStateId(editingMacro.stateId ? String(editingMacro.stateId) : '')
      setGroupId(editingMacro.groupId ? String(editingMacro.groupId) : '')
      setIikoReasonIds(editingMacro.iikoReasonIds || [])
      setTagNames(editingMacro.tagNames || [])
      setTimeUnit(editingMacro.timeUnit !== undefined && editingMacro.timeUnit !== null ? String(editingMacro.timeUnit) : '')
      setColorClass(editingMacro.colorClass || '#94a3b8')
    } else {
      setLabel('')
      setBodyText('')
      setInternal(false)
      setStateId('')
      setGroupId('')
      setIikoReasonIds([])
      setTagNames([])
      setTimeUnit('')
      setColorClass('#94a3b8')
    }
  }, [editingMacro, isCreating])

  const handleSave = () => {
    if (!label.trim()) return

    const payload = {
      label,
      description: '',
      bodyText,
      internal,
      stateId: stateId ? Number(stateId) : undefined,
      groupId: groupId ? Number(groupId) : undefined,
      iikoReasonIds: iikoReasonIds.length > 0 ? iikoReasonIds : undefined,
      tagNames: tagNames.length > 0 ? tagNames : undefined,
      timeUnit: timeUnit ? Number(timeUnit) : undefined,
      colorClass
    }

    if (editingMacro) {
      updateMacro(editingMacro.id, payload)
      setEditingMacro(null)
    } else {
      addMacro(payload)
      setIsCreating(false)
    }
  }

  return (
    <AnimatePresence mode="wait">
      {editingMacro || isCreating ? (
        <motion.div
          key="form"
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -15 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full border border-border/60 bg-card shadow-sm hover:bg-accent"
              onClick={() => {
                setEditingMacro(null)
                setIsCreating(false)
              }}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-foreground">
              {editingMacro ? 'Редактирование макроса' : 'Создание нового макроса'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pr-1">
            <div className="space-y-4 rounded-xl border border-border/40 bg-muted/10 backdrop-blur-md p-5 shadow-sm">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="macro-label" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5 text-primary/85" />
                  Название макроса
                </label>
                <input
                  id="macro-label"
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Например: Ответ клиенту"
                  className="h-9 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-xs text-foreground outline-none focus:border-primary/60 focus:bg-background transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="macro-body" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary/85" />
                  Шаблон ответа
                </label>
                <textarea
                  id="macro-body"
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Текст сообщения, который будет автоматически подставлен в поле ответа..."
                  rows={7}
                  className="w-full rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-foreground outline-none focus:border-primary/60 focus:bg-background transition-all resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between gap-4 bg-muted/20 rounded-xl border border-border/40 p-3.5">
                <div>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <EyeOff className="h-3.5 w-3.5 text-amber-500/80" />
                    Приватное сообщение
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Отправить как внутреннюю заметку</p>
                </div>
                <Switch checked={internal} onChange={setInternal} />
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-border/40 bg-muted/10 backdrop-blur-md p-5 shadow-sm">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-primary/85" />
                  Смена состояния
                </span>
                <CustomSelect
                  value={stateId}
                  options={filtersData?.states ?? []}
                  onChange={(val) => setStateId(val ? String(val.id) : '')}
                  placeholder="Не менять состояние"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary/85" />
                  Смена группы
                </span>
                <CustomSelect
                  value={groupId}
                  options={filtersData?.groups ?? []}
                  onChange={(val) => setGroupId(val ? String(val.id) : '')}
                  placeholder="Не менять группу"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary/85" />
                  Причины обращения (iiko)
                </span>
                <CustomMultiSelect
                  values={iikoReasonIds}
                  options={filtersData?.iikoReasons ?? []}
                  onChange={(reasons) => setIikoReasonIds(reasons.map(r => String(r.id)))}
                  placeholder="Выберите причины обращения"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Tags className="h-3.5 w-3.5 text-primary/85" />
                  Теги заявки
                </span>
                <CustomMultiSelect
                  values={tagNames}
                  options={(filtersData?.tags ?? []).map(t => ({ id: t.name, name: t.name }))}
                  onChange={(selectedTags) => setTagNames(selectedTags.map(t => String(t.id)))}
                  placeholder="Выберите теги"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="macro-time" className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary/85" />
                  Потраченное время
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTimeUnit(prev => String(Math.max(0, Number(prev || 0) - 5)))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/20 text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <div className="relative flex-1">
                    <input
                      id="macro-time"
                      type="text"
                      inputMode="numeric"
                      value={timeUnit}
                      onChange={(e) => setTimeUnit(e.target.value.replace(/\D/g, ''))}
                      placeholder="Укажите минуты..."
                      className="h-9 w-full rounded-lg border border-border/60 bg-muted/20 px-3 text-xs text-center text-foreground outline-none focus:border-primary/60 focus:bg-background transition-all"
                    />
                    {timeUnit && <span className="absolute right-3 top-2.5 text-[10px] font-semibold text-muted-foreground uppercase">мин</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTimeUnit(prev => String(Number(prev || 0) + 5))}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/20 text-foreground hover:bg-muted/40 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-primary/85" />
                  Цвет оформления макроса
                </span>
                <div className="flex flex-wrap items-center gap-2 py-1">
                  {PRESET_COLORS.map((col) => {
                    const active = colorClass.toLowerCase() === col.value.toLowerCase()
                    return (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => setColorClass(col.value)}
                        title={col.name}
                        className={cn(
                          "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-150 border-2",
                          active ? "border-foreground scale-110 shadow-md" : "border-transparent hover:scale-105"
                        )}
                      >
                        <span className="h-full w-full rounded-full border border-black/10 dark:border-white/10" style={{ backgroundColor: col.value }} />
                        {active && <Check className="absolute h-4 w-4 text-white stroke-[3px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />}
                      </button>
                    )
                  })}
                  
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border hover:border-foreground/40 transition-all duration-150">
                    <span
                      className="h-full w-full rounded-full flex items-center justify-center bg-gradient-to-tr from-rose-400 via-violet-400 to-emerald-400 cursor-pointer overflow-hidden border border-black/10 dark:border-white/10"
                      style={colorClass.startsWith('#') && !PRESET_COLORS.some(c => c.value.toLowerCase() === colorClass.toLowerCase()) ? {
                        backgroundColor: colorClass,
                        backgroundImage: 'none'
                      } : undefined}
                    >
                      <Plus className={cn("h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]", colorClass.startsWith('#') && !PRESET_COLORS.some(c => c.value.toLowerCase() === colorClass.toLowerCase()) && "hidden")} />
                      {colorClass.startsWith('#') && !PRESET_COLORS.some(c => c.value.toLowerCase() === colorClass.toLowerCase()) && (
                        <Check className="h-4 w-4 text-white stroke-[3px] drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                      )}
                    </span>
                    <input
                      type="color"
                      value={colorClass.startsWith('#') ? colorClass : '#10b981'}
                      onChange={(e) => setColorClass(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      title="Выбрать свой цвет"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditingMacro(null)
                setIsCreating(false)
              }}
              className="h-9 px-4 text-xs rounded-lg"
            >
              Отмена
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!label.trim()}
              onClick={handleSave}
              className="h-9 px-4 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/95"
            >
              Сохранить
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 15 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          <div className="flex items-center justify-between border-b border-border/40 pb-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Конструктор макросов</p>
              <p className="text-xs text-muted-foreground mt-0.5">Создавайте шаблоны быстрых ответов и автоматических действий для заявок</p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => setIsCreating(true)}
              className="h-9 gap-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Создать макрос
            </Button>
          </div>

          {/* No nested scroller: the settings card already scrolls, and a second
              one clipped the last macros with a scrollbar nobody could see. */}
          <div className="pr-1">
            {macros.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 px-4 rounded-xl border border-dashed border-border/80 bg-muted/5">
                <Command className="h-8 w-8 text-muted-foreground/60 mb-2.5 animate-pulse" />
                <p className="text-xs font-medium text-foreground">Макросы отсутствуют</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">Создайте свой первый макрос, чтобы автоматизировать рутинные операции в заявках</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {macros.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col justify-between p-4 rounded-xl border border-border/40 text-xs bg-muted/10 backdrop-blur-md shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-200 border-l-[3px]",
                      m.colorClass && !m.colorClass.startsWith('#') ? m.colorClass : 'border-border'
                    )}
                    style={m.colorClass && m.colorClass.startsWith('#') ? {
                      borderLeftColor: m.colorClass,
                      backgroundColor: `${m.colorClass}07`
                    } : undefined}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-foreground leading-snug line-clamp-1">{m.label}</span>
                        <div className="flex gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingMacro(m)}
                            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md"
                            title="Редактировать"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMacro(m.id)}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-md"
                            title="Удалить"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {m.internal && (
                          <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] px-2 py-0.5 rounded-full border border-amber-500/20 font-semibold shadow-sm">
                            <EyeOff className="h-2.5 w-2.5 text-amber-500" />
                            Приватный
                          </span>
                        )}
                        {m.stateId && (
                          <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] px-2 py-0.5 rounded-full border border-blue-500/20 font-semibold shadow-sm">
                            <Activity className="h-2.5 w-2.5 text-blue-500" />
                            Статус: {(filtersData?.states ?? []).find(s => Number(s.id) === Number(m.stateId))?.name || m.stateId}
                          </span>
                        )}
                        {m.groupId && (
                          <span className="inline-flex items-center gap-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[9px] px-2 py-0.5 rounded-full border border-purple-500/20 font-semibold shadow-sm">
                            <Users className="h-2.5 w-2.5 text-purple-500" />
                            Группа: {(filtersData?.groups ?? []).find(g => Number(g.id) === Number(m.groupId))?.name || m.groupId}
                          </span>
                        )}
                        {m.timeUnit !== undefined && m.timeUnit !== null && (
                          <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[9px] px-2 py-0.5 rounded-full border border-rose-500/20 font-semibold shadow-sm">
                            <Clock className="h-2.5 w-2.5 text-rose-500" />
                            {m.timeUnit} мин
                          </span>
                        )}
                        {m.iikoReasonIds && m.iikoReasonIds.length > 0 && (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold shadow-sm">
                            <Info className="h-2.5 w-2.5 text-emerald-500" />
                            Причин: {m.iikoReasonIds.length}
                          </span>
                        )}
                        {m.tagNames && m.tagNames.length > 0 && (
                          <span className="inline-flex items-center gap-1 bg-violet-500/10 text-violet-600 dark:text-violet-400 text-[9px] px-2 py-0.5 rounded-full border border-violet-500/20 font-semibold shadow-sm">
                            <Tags className="h-2.5 w-2.5 text-violet-500" />
                            Теги: {m.tagNames.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function UpdateSettings() {
  const update = useUIStore((s) => s.update)
  const checkForUpdate = useUIStore((s) => s.checkForUpdate)
  const installUpdate = useUIStore((s) => s.installUpdate)
  const [version, setVersion] = useState('')

  useEffect(() => {
    window.api.app.getVersion().then(setVersion).catch(() => {})
  }, [])

  const checking = update.status === 'checking'
  const downloading = update.status === 'downloading'
  const ready = update.status === 'downloaded'

  const statusMeta = (() => {
    switch (update.status) {
      case 'checking': return { icon: RefreshCw, spin: true, color: 'text-muted-foreground', text: 'Проверяем наличие обновлений…' }
      case 'available': return { icon: DownloadCloud, color: 'text-primary', text: `Найдено обновление${update.version ? ` ${update.version}` : ''}. Загрузка…` }
      case 'downloading': return { icon: DownloadCloud, color: 'text-primary', text: `Загрузка обновления… ${update.percent ?? 0}%` }
      case 'downloaded': return { icon: CheckCircle2, color: 'text-emerald-500', text: `Версия ${update.version || ''} загружена и готова к установке.` }
      case 'not-available': return { icon: CheckCircle2, color: 'text-emerald-500', text: 'Установлена последняя версия.' }
      case 'error': return { icon: AlertCircle, color: 'text-destructive', text: update.error || 'Не удалось проверить обновления.' }
      default: return null
    }
  })()

  return (
    <div className="space-y-5">
      <SettingsHeader title="Обновления" description="Версия приложения и установка обновлений" />

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/15 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-blue-400 text-base font-bold text-primary-foreground shadow-md">
            SD
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">sysctrlSD</p>
            <p className="text-xs text-muted-foreground">Версия {version || '—'}</p>
          </div>
        </div>
      </div>

      {statusMeta && (
        <div className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/10 px-3.5 py-3 text-xs">
          <statusMeta.icon className={cn('h-4 w-4 shrink-0', statusMeta.color, statusMeta.spin && 'animate-spin')} />
          <span className="text-foreground/90">{statusMeta.text}</span>
        </div>
      )}

      {downloading && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${update.percent ?? 0}%` }} />
        </div>
      )}

      <div className="flex items-center gap-2">
        {ready ? (
          <Button
            type="button"
            size="sm"
            onClick={installUpdate}
            className="h-9 gap-2 rounded-lg bg-primary text-xs text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Перезапустить и установить
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={checking || downloading}
            onClick={() => checkForUpdate()}
            className="h-9 gap-2 rounded-lg text-xs hover:bg-accent"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', checking && 'animate-spin')} />
            Проверить обновления
          </Button>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Обновления загружаются автоматически в фоне. Когда новая версия будет готова, появится уведомление — установить можно сразу или позже отсюда.
      </p>
    </div>
  )
}

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
