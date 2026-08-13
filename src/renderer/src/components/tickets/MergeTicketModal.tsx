import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, GitMerge, Loader2, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Merges this ticket into another one. Owns the search and the merge request;
 * the page only says which ticket is being merged and where to go afterwards.
 */
export function MergeTicketModal({
  ticketId,
  ticketNumber,
  ticketTitle,
  onClose,
  onMerged
}: {
  ticketId: number
  ticketNumber: string
  ticketTitle: string
  onClose: () => void
  onMerged: (target: { id: number; number: string }) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [target, setTarget] = useState<any | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    try {
      const found = await window.api.tickets.searchForMerge(query)
      setResults(found.filter((ticket: any) => ticket.id !== ticketId))
    } catch (err: any) {
      setError(err?.message || 'Ошибка поиска')
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    if (!target) return
    setLoading(true)
    setError('')
    try {
      await window.api.tickets.merge(ticketId, target.number)
      onMerged(target)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Ошибка объединения')
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh]"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <GitMerge className="h-[18px] w-[18px] text-primary" />
            Объединение заявок
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onClose(); setTarget(null); setResults([]); setQuery(''); setError('') }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {!target ? (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            <form onSubmit={search} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ID, номер Zammad или тема..."
                  className="h-9 w-full rounded-md border border-border bg-muted/30 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
              <Button type="submit" size="sm" disabled={loading} className="h-9">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Найти'}
              </Button>
            </form>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                {error}
              </div>
            )}

            <div className="space-y-2 mt-2">
              {results.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setTarget(t)}
                  className="flex flex-col gap-1.5 p-3 rounded-lg border border-border/60 bg-muted/10 hover:border-primary/50 hover:bg-muted/20 cursor-pointer transition-all duration-100"
                >
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-mono">#{t.clientNumber || t.id} (Zammad: #{t.number})</span>
                    <span>{t.state.name}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-foreground line-clamp-2 leading-relaxed">
                    {t.title}
                  </h4>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/20">
                    <span>{t.organization?.name || 'Без организации'}</span>
                    <span>{t.owner?.name || 'Не назначен'}</span>
                  </div>
                </div>
              ))}
              {!loading && query && results.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  Подходящие заявки не найдены
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 flex gap-3 text-xs leading-relaxed text-foreground">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-600 dark:text-amber-400 mb-1">Объединить текущую заявку:</p>
                <div className="my-1.5 pl-2 border-l-2 border-amber-500/50 font-medium">
                  #{ticketNumber} - {ticketTitle}
                </div>
                с выбранной заявкой:
                <div className="my-1.5 pl-2 border-l-2 border-amber-500/50 font-medium">
                  #{target.clientNumber || target.id} - {target.title}
                </div>
              </div>
            </div>

            {error && (
              <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-2 border-t border-border pt-3">
              <Button variant="outline" size="sm" onClick={() => setTarget(null)} disabled={loading}>
                Назад
              </Button>
              <Button variant="destructive" size="sm" onClick={submit} disabled={loading}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Объединить
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
