import { useState, useRef, useEffect } from 'react'
import {
  Wand2,
  Sparkles,
  SpellCheck,
  Settings2,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Undo2
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import {
  useAiAssistStore,
  getAllPresets,
  callAiApi,
  CORRECTION_PROMPT,
  BUILT_IN_PRESETS,
  type StylePreset
} from '@/store/aiAssist'
import { Button } from '@/components/ui/button'
import { withAiContext } from '@/lib/aiContext'
import { CustomCheckbox } from '@/components/ui/custom-controls'

interface AiAssistButtonProps {
  /** Последние сообщения заявки: помогают не путать имена, термины и тон. */
  ticketContext?: string
  text: string
  onTextChange: (text: string) => void
}

export function AiAssistButton({ text, onTextChange, ticketContext }: AiAssistButtonProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState<'stylize' | 'correct' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [undoText, setUndoText] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const aiChangedRef = useRef(false)

  const store = useAiAssistStore()
  const allPresets = getAllPresets(store.customPresets)
  const activePreset = allPresets.find(p => p.id === store.activePresetId) ?? allPresets[0]

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [menuOpen])

  // Auto-hide error
  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(t)
  }, [error])

  // Clear undo when user manually edits text
  useEffect(() => {
    if (aiChangedRef.current) {
      aiChangedRef.current = false
      return
    }
    setUndoText(null)
  }, [text])

  // Ctrl+Z / Ctrl+я keyboard shortcut for undo
  useEffect(() => {
    if (undoText === null) return
    const handler = (e: KeyboardEvent) => {
      const isUndo =
        e.ctrlKey &&
        (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я' || e.code === 'KeyZ')
      if (!isUndo) return
      e.preventDefault()
      aiChangedRef.current = true
      onTextChange(undoText)
      setUndoText(null)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [undoText, onTextChange])

  const doUndo = () => {
    if (undoText === null) return
    aiChangedRef.current = true
    onTextChange(undoText)
    setUndoText(null)
  }

  const runAi = async (type: 'stylize' | 'correct') => {
    if (!text.trim()) return
    if (!store.apiKey.trim()) {
      setError('API ключ не задан')
      setMenuOpen(false)
      return
    }
    setMenuOpen(false)
    setLoading(type)
    setError(null)
    try {
      const prompt =
        type === 'correct'
          ? CORRECTION_PROMPT
          : (activePreset?.instruction ?? BUILT_IN_PRESETS[0].instruction)
      const withContext = store.useTicketContext && ticketContext
        ? withAiContext(prompt, ticketContext)
        : prompt
      const result = await callAiApi(withContext, text, store.apiKey, store.provider)
      if (result) {
        aiChangedRef.current = true
        setUndoText(text)
        onTextChange(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка AI')
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      {/* Button row: undo + wand */}
      <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5">
        {/* Undo button */}
        <AnimatePresence>
          {undoText !== null && (
            <motion.button
              key="undo"
              type="button"
              onClick={doUndo}
              title="Отменить изменение AI (Ctrl+Z)"
              initial={{ opacity: 0, scale: 0.7, x: 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.7, x: 8 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex h-6 w-6 items-center justify-center rounded-md text-amber-400/70 transition-all hover:text-amber-400 hover:bg-amber-400/10"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Wand button + popup */}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            disabled={!!loading}
            onClick={() => setMenuOpen(v => !v)}
            title="AI Ассистент"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md transition-all duration-150',
              'text-muted-foreground/35 hover:text-violet-400 hover:bg-violet-400/10',
              (loading || menuOpen) && 'text-violet-400 bg-violet-400/10'
            )}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -6 }}
                transition={{ duration: 0.1, ease: 'easeOut' }}
                className="absolute right-0 top-8 z-50 min-w-[172px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
              >
                <div className="p-1">
                  <button
                    type="button"
                    onClick={() => runAi('stylize')}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-accent"
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                    <span className="flex-1 text-left font-medium">Стилизация</span>
                    <span className="max-w-[56px] truncate text-[10px] text-muted-foreground">
                      {activePreset?.name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => runAi('correct')}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-foreground hover:bg-accent"
                  >
                    <SpellCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    <span className="font-medium">Исправление</span>
                  </button>
                  <div className="my-0.5 mx-1 h-px bg-border" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setSettingsOpen(true)
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Settings2 className="h-3.5 w-3.5 shrink-0" />
                    <span>Стили</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-4 right-4 z-[200] flex items-center gap-2 rounded-xl border border-destructive/30 bg-card px-3 py-2.5 text-xs text-destructive shadow-xl"
          >
            <Wand2 className="h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-1 opacity-60 hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Style settings modal */}
      <AnimatePresence>
        {settingsOpen && <AiStylesModal onClose={() => setSettingsOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

function AiStylesModal({ onClose }: { onClose: () => void }) {
  const { activePresetId, customPresets, setActivePresetId, addPreset, updatePreset, deletePreset, useTicketContext, setUseTicketContext } =
    useAiAssistStore()

  const allPresets = getAllPresets(customPresets)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editInstruction, setEditInstruction] = useState('')

  const startEdit = (preset: StylePreset) => {
    setEditId(preset.id)
    setEditName(preset.name)
    setEditInstruction(preset.instruction)
  }

  const startNew = () => {
    setEditId('new')
    setEditName('')
    setEditInstruction('')
  }

  const cancelEdit = () => setEditId(null)

  const saveEdit = () => {
    if (!editName.trim() || !editInstruction.trim()) return
    if (editId === 'new') {
      const newId = addPreset(editName.trim(), editInstruction.trim())
      setActivePresetId(newId)
    } else if (editId) {
      updatePreset(editId, editName.trim(), editInstruction.trim())
    }
    setEditId(null)
  }

  const activePreset = allPresets.find(p => p.id === activePresetId)

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-end bg-black/40 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.97 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15">
              <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Стили стилизации</h3>
              <p className="text-[10px] text-muted-foreground">
                Активный:{' '}
                <span className="font-medium text-violet-400">{activePreset?.name}</span>
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Переписка заявки в помощь правке — с прямой оговоркой, куда она уходит. */}
        <div className="border-b border-border/50 px-3 py-3">
          <CustomCheckbox checked={useTicketContext} onChange={setUseTicketContext}>
            Учитывать последние сообщения заявки
          </CustomCheckbox>
          <p className="mt-1 pl-6 text-[11px] leading-4 text-muted-foreground">
            Помогает не путать имена, названия и обращение на «вы». Вместе с черновиком
            в сервис ИИ уходят три последних сообщения заявки — если это нежелательно, отключите.
          </p>
        </div>

        {/* Presets list */}
        <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
          {allPresets.map(preset => {
            const isActive = activePresetId === preset.id
            const isEditing = editId === preset.id
            return (
              <div key={preset.id}>
                <div
                  className={cn(
                    'group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all cursor-pointer',
                    isActive
                      ? 'border-violet-500/30 bg-violet-500/8 shadow-sm shadow-violet-500/5'
                      : 'border-border/60 bg-muted/15 hover:bg-muted/30 hover:border-border'
                  )}
                  onClick={() => setActivePresetId(preset.id)}
                >
                  {/* Radio */}
                  <div
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                      isActive ? 'border-violet-400 bg-violet-400' : 'border-border bg-background/40'
                    )}
                  >
                    {isActive && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-xs font-semibold', isActive ? 'text-foreground' : 'text-foreground/80')}>
                      {preset.name}
                    </span>
                    {preset.isBuiltIn && (
                      <span className="ml-2 text-[10px] text-muted-foreground/60">встроенный</span>
                    )}
                    {isActive && !preset.isBuiltIn && !isEditing && (
                      <span className="ml-2 text-[10px] text-violet-400">активный</span>
                    )}
                  </div>

                  {/* Actions */}
                  {!preset.isBuiltIn && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          startEdit(preset)
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        title="Редактировать"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          deletePreset(preset.id)
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Удалить"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline edit form for this preset */}
                <AnimatePresence>
                  {isEditing && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <PresetEditForm
                        isNew={false}
                        name={editName}
                        instruction={editInstruction}
                        onNameChange={setEditName}
                        onInstructionChange={setEditInstruction}
                        onSave={saveEdit}
                        onCancel={cancelEdit}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* Add new form */}
        <AnimatePresence>
          {editId === 'new' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden border-t border-border/50"
            >
              <div className="p-3">
                <PresetEditForm
                  isNew
                  name={editName}
                  instruction={editInstruction}
                  onNameChange={setEditName}
                  onInstructionChange={setEditInstruction}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="border-t border-border/50 px-4 py-3 flex items-center justify-end">
          {editId !== 'new' && (
            <button
              type="button"
              onClick={startNew}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/20 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
            >
              <Plus className="h-3 w-3" />
              Новый стиль
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function PresetEditForm({
  isNew,
  name,
  instruction,
  onNameChange,
  onInstructionChange,
  onSave,
  onCancel
}: {
  isNew: boolean
  name: string
  instruction: string
  onNameChange: (v: string) => void
  onInstructionChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-1.5 space-y-2 rounded-xl border border-border/60 bg-muted/10 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {isNew ? 'Новый стиль' : 'Редактирование'}
      </p>
      <input
        value={name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Название стиля"
        autoFocus
        className="h-8 w-full rounded-lg border border-border bg-muted/20 px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-500/50 focus:bg-muted/30"
      />
      <textarea
        value={instruction}
        onChange={e => onInstructionChange(e.target.value)}
        placeholder="Инструкция для AI — опиши в свободной форме как переписывать текст..."
        className="min-h-[72px] w-full resize-y rounded-lg border border-border bg-muted/20 px-2.5 py-2 text-xs leading-5 text-foreground outline-none placeholder:text-muted-foreground focus:border-violet-500/50 focus:bg-muted/30"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border bg-transparent px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!name.trim() || !instruction.trim()}
          className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/15 px-3 py-1 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-3 w-3" />
          Сохранить
        </button>
      </div>
    </div>
  )
}
