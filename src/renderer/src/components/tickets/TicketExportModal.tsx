import { useEffect, useState } from 'react'
import { AlertCircle, Check, FileDown, Loader2, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
export function TicketExportModal({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const [withText, setWithText] = useState(true)
  const [withImages, setWithImages] = useState(true)
  const [withFiles, setWithFiles] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ path: string; images: number; files: number } | null>(null)

  const nothingSelected = !withText && !withImages && !withFiles

  // The overlay covers the whole window, so it must always be dismissable —
  // otherwise a modal left standing looks exactly like a frozen app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await window.api.tickets.exportTicket(ticketId, {
        text: withText,
        images: withImages,
        files: withFiles
      })
      if (res.canceled) return
      if (res.ok && res.path) {
        setDone({ path: res.path, images: res.savedImages ?? 0, files: res.savedFiles ?? 0 })
      }
    } catch (err: any) {
      setError(err?.message || 'Не удалось сохранить выгрузку')
    } finally {
      setSaving(false)
    }
  }

  const toggles: { label: string; hint: string; value: boolean; onChange: (value: boolean) => void }[] = [
    { label: 'Сохранить текст', hint: 'Markdown со всей перепиской и параметрами заявки', value: withText, onChange: setWithText },
    { label: 'Сохранить изображения', hint: 'Картинки из сообщений, на своих местах в тексте', value: withImages, onChange: setWithImages },
    { label: 'Сохранить файлы', hint: 'Остальные вложения, со ссылками из сообщений', value: withFiles, onChange: setWithFiles }
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => { if (!saving) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={event => event.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-foreground">
            <FileDown className="h-[18px] w-[18px] text-primary" />
            Выгрузка заявки
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {done ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-xs text-green-400">
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">Выгрузка сохранена</p>
                <p className="mt-1 break-all text-[11px] text-green-400/80">{done.path}</p>
                <p className="mt-1 text-[11px] text-green-400/80">
                  Изображений: {done.images} · Файлов: {done.files}
                </p>
              </div>
            </div>
            <Button onClick={onClose} className="w-full">Готово</Button>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Переписка сохраняется в Markdown: у каждого сообщения указан автор, дата и то,
              какие файлы и изображения были в нём приложены. Если выбраны вложения, всё
              складывается в ZIP рядом с текстом.
            </p>

            <div className="flex flex-col gap-2">
              {toggles.map(toggle => (
                <button
                  key={toggle.label}
                  type="button"
                  onClick={() => toggle.onChange(!toggle.value)}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-foreground">{toggle.label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{toggle.hint}</span>
                  </span>
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors',
                      toggle.value ? 'bg-primary' : 'bg-muted-foreground/30'
                    )}
                  >
                    <motion.span
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                      className={cn(
                        'h-4 w-4 rounded-full bg-white shadow-sm',
                        toggle.value ? 'ml-auto' : 'mr-auto'
                      )}
                    />
                  </span>
                </button>
              ))}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button variant="ghost" onClick={onClose} disabled={saving}>Отмена</Button>
              <Button onClick={handleSave} disabled={saving || nothingSelected} className="gap-2">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                {saving ? 'Собираю…' : 'Сохранить'}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
