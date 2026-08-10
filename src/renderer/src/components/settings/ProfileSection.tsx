import { useEffect, useRef, useState } from 'react'
import { Camera, Check, Clipboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getUserDisplayName, getUserInitials } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { CustomSelect, SettingsHeader } from './SettingsControls'

type ClientProfileSettings = Awaited<ReturnType<typeof window.api.auth.getClientProfileSettings>>

export function AvatarSettings() {
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



export function ClientsProfileSettings() {
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
