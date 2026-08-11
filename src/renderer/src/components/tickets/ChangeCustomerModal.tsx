import { useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Building, Loader2, Search, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OrganizationDetails } from '@/types/ticket'

/**
 * Replaces the customer of a ticket: either by finding an existing one or by
 * creating a new profile. Owns its search, its form and both requests.
 */
export function ChangeCustomerModal({
  ticketId,
  organization,
  onClose,
  onChanged
}: {
  ticketId: number
  organization?: OrganizationDetails | null
  onClose: () => void
  onChanged: () => void
}) {
  const [tab, setTab] = useState<'search' | 'create'>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [telegram, setTelegram] = useState('')
  const [linkNewToOrg, setLinkNewToOrg] = useState(true)
  // Выключено по умолчанию намеренно. Отметка меняет организацию в профиле
  // самого клиента, а не привязку заявки: клиент начинает видеть все заявки
  // новой организации. Один раз так и утекли внутренние заявки наружу.
  const [linkFoundToOrg, setLinkFoundToOrg] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectingId, setSelectingId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const search = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return
    setSearchLoading(true)
    setError('')
    try {
      setResults(await window.api.users.search(query))
    } catch (err: any) {
      setError(err?.message || 'Ошибка поиска')
    } finally {
      setSearchLoading(false)
    }
  }

  const pickCustomer = async (userId: number) => {
    setLoading(true)
    setSelectingId(userId)
    setError('')
    try {
      if (linkFoundToOrg && organization?.id) {
        await window.api.users.update(userId, { organization_id: organization.id, ticketId })
      }
      await window.api.tickets.changeCustomer(ticketId, userId)
      onChanged()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Ошибка изменения клиента')
    } finally {
      setLoading(false)
      setSelectingId(null)
    }
  }

  const createCustomer = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!firstname.trim() && !lastname.trim()) {
      setError('Укажите имя или фамилию')
      return
    }
    setLoading(true)
    setError('')
    try {
      const created = await window.api.users.create({
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        mobile: mobile.trim() || undefined,
        tg_id_for_notice: telegram.trim() || undefined,
        organization_id: (linkNewToOrg && organization?.id) ? organization.id : null
      })
      await window.api.tickets.changeCustomer(ticketId, created.id)
      onChanged()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Ошибка создания клиента')
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
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh]"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <User className="h-[18px] w-[18px] text-primary" />
            Смена клиента заявки
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onClose(); setResults([]); setQuery(''); setError('') }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex border-b border-border bg-muted/10 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => { setTab('search'); setError(''); }}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors",
              tab === 'search'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Поиск
          </button>
          <button
            type="button"
            onClick={() => { setTab('create'); setError(''); }}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors",
              tab === 'create'
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Создать нового
          </button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
            {error}
          </div>
        )}

        {tab === 'search' ? (
          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            <form onSubmit={search} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Имя, email, телефон..."
                  className="h-9 w-full rounded-md border border-border bg-muted/30 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
              <Button type="submit" size="sm" disabled={searchLoading} className="h-9">
                {searchLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Найти'}
              </Button>
            </form>

            {organization && (
              <div className="mt-1 flex flex-col gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="linkFoundToOrg"
                    checked={linkFoundToOrg}
                    onChange={(e) => setLinkFoundToOrg(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary bg-muted/30 focus:ring-0 focus:ring-offset-0"
                  />
                  <label htmlFor="linkFoundToOrg" className="select-none text-xs text-foreground">
                    Перевести выбранного клиента в организацию «{organization?.name}»
                  </label>
                </div>
                {/* Последствие названо прямо: раньше отметка стояла по умолчанию,
                    и клиента незаметно переносили во внутреннюю организацию. */}
                <p className="flex items-start gap-1.5 pl-6 text-[11px] leading-4 text-muted-foreground">
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0 text-amber-500" />
                  Меняет организацию в профиле клиента, а не только у этой заявки: он увидит все заявки организации «{organization?.name}». Для смены клиента заявки отметка не нужна.
                </p>
              </div>
            )}

            <div className="space-y-2 mt-2">
              {results.map((u) => (
                <div
                  key={u.id}
                  onClick={() => {
                    if (!loading) pickCustomer(u.id)
                  }}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/10 hover:border-primary/50 hover:bg-muted/20 cursor-pointer transition-all duration-100 group",
                    loading && "pointer-events-none opacity-60"
                  )}
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{u.name}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{u.email || 'Нет почты'}</span>
                    {/* Видно, из какой организации клиента заберут, если отметка стоит. */}
                    <span className="truncate text-[10px] text-muted-foreground">
                      <Building className="mr-1 inline h-2.5 w-2.5" />
                      {u.organizationName || 'Без организации'}
                      {linkFoundToOrg && organization?.id && u.organizationId !== organization.id && (
                        <span className="ml-1 text-amber-500">→ {organization.name}</span>
                      )}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] shrink-0"
                    disabled={loading}
                  >
                    {loading && selectingId === u.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      'Выбрать'
                    )}
                  </Button>
                </div>
              ))}
              {!searchLoading && query && results.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  Пользователи не найдены
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={createCustomer} className="flex flex-col gap-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground">Имя</label>
                <input
                  type="text"
                  value={firstname}
                  onChange={(e) => setFirstname(e.target.value)}
                  className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground">Фамилия</label>
                <input
                  type="text"
                  value={lastname}
                  onChange={(e) => setLastname(e.target.value)}
                  className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground">Телефон</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-muted-foreground">Мобильный</label>
                <input
                  type="text"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold text-muted-foreground">Telegram ID</label>
              <input
                type="text"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                className="h-9 rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              />
            </div>
            {organization && (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="linkNewToOrg"
                  checked={linkNewToOrg}
                  onChange={(e) => setLinkNewToOrg(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary bg-muted/30 focus:ring-0 focus:ring-offset-0"
                />
                <label htmlFor="linkNewToOrg" className="text-xs text-muted-foreground select-none">
                  Привязать к организации «{organization?.name}»
                </label>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4 border-t border-border pt-3">
              <Button variant="outline" size="sm" type="button" onClick={() => onClose()} disabled={loading}>
                Отмена
              </Button>
              <Button size="sm" type="submit" disabled={loading}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
                Создать и сменить
              </Button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
