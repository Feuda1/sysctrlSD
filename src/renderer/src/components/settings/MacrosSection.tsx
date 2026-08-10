import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Activity, ArrowLeft, Check, Clock, Command, EyeOff, Info, MessageSquare, Minus, Palette, Plus, Sliders, Tags, Trash2, Type, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useMacrosStore } from '@/store/macros'
import { useTicketFilters } from '@/hooks/useTickets'
import { CustomMultiSelect, CustomSelect, Switch } from './SettingsControls'

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


export function MacroSettingsSection() {
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
