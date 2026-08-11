import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Building, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Attaches a customer without an organisation to one. Keeps its own state: the
 * ticket page only says which customer is being linked and what to do afterwards.
 */
export function LinkOrganizationModal({
  customerId,
  ticketId,
  currentOrganization,
  onClose,
  onLinked
}: {
  customerId: number
  ticketId: number
  currentOrganization?: { id: number; name: string } | null
  onClose: () => void
  onLinked: () => void
}) {
  const [orgId, setOrgId] = useState<number | null>(currentOrganization?.id ?? null)
  const [query, setQuery] = useState(currentOrganization?.name ?? '')
  const [results, setResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setOrgId(currentOrganization?.id ?? null)
    setQuery(currentOrganization?.name ?? '')
    setResults([])
    setError('')
  }, [currentOrganization?.id, currentOrganization?.name])

  const search = async (text: string) => {
    setQuery(text)
    if (!text.trim()) {
      setResults([])
      return
    }
    setSearchLoading(true)
    try {
      const found = await window.api.organizations.list({ query: text, page: 1, perPage: 15 })
      setResults(found || [])
    } catch {
      // A failed lookup just leaves the list empty; the field stays usable.
    } finally {
      setSearchLoading(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!orgId) return
    setLoading(true)
    setError('')
    try {
      await window.api.users.update(customerId, { organization_id: orgId, ticketId })
      onLinked()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Ошибка привязки организации')
    } finally {
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
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Building className="h-[18px] w-[18px] text-primary" />
            Привязка клиента к организации
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
            {error}
          </div>
        )}

        {/* Привязка меняет организацию в профиле клиента, а не только у заявки —
            последствие слишком серьёзное, чтобы догадываться о нём по названию. */}
        <p className="flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-amber-500" />
          Организация меняется в профиле клиента, а не только у этой заявки: он увидит все заявки выбранной организации.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 relative">
            <label className="text-[10px] font-semibold text-muted-foreground">Организация</label>
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={event => search(event.target.value)}
                placeholder="Поиск организации..."
                className="h-9 w-full rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                required
              />
              {query && orgId && (
                <button
                  type="button"
                  onClick={() => { setOrgId(null); setQuery('') }}
                  className="absolute right-2 top-2 h-5 w-5 text-muted-foreground hover:text-foreground flex items-center justify-center rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {searchLoading && (
              <div className="absolute right-2 top-8">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
            {results.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-background shadow-md">
                {results.map(org => (
                  <div
                    key={org.id}
                    onClick={() => {
                      setOrgId(org.id)
                      setQuery(org.name)
                      setResults([])
                    }}
                    className="px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-sm"
                  >
                    {org.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-4 border-t border-border pt-3">
            <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={loading}>
              Отмена
            </Button>
            <Button size="sm" type="submit" disabled={loading || !orgId}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Привязать
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
