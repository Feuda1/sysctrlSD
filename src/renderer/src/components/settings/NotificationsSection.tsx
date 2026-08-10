import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Upload, Volume2 } from 'lucide-react'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useNotificationsStore } from '@/store/notifications'
import { useTicketFilters } from '@/hooks/useTickets'
import { CustomSelect, SettingsHeader, Switch } from './SettingsControls'

export function NotificationSettingsSection() {
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
