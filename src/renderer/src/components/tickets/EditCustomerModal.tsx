import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, User, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OrganizationDetails, TicketCustomer } from '@/types/ticket'

/**
 * Editing the customer profile of a ticket. Owns the form state and the save
 * itself; the page only supplies the customer and hears when it is saved.
 */
export function EditCustomerModal({
  customer,
  organization,
  ticketId,
  onClose,
  onSaved
}: {
  customer: TicketCustomer
  organization?: OrganizationDetails | null
  ticketId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [firstname, setFirstname] = useState('')
  const [lastname, setLastname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [mobile, setMobile] = useState('')
  const [telegram, setTelegram] = useState('')
  const [address, setAddress] = useState('')
  const [orgId, setOrgId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [orgQuery, setOrgQuery] = useState('')
  const [orgResults, setOrgResults] = useState<any[]>([])
  const [orgLoading, setOrgLoading] = useState(false)

  useEffect(() => {
    setFirstname(customer.firstname || '')
    setLastname(customer.lastname || '')
    setEmail(customer.email || '')
    setPhone(customer.phone || '')
    setMobile(customer.mobile || '')
    setTelegram(customer.telegram || customer.tg_id_for_notice || '')
    setAddress(customer.address || '')
    setOrgId(organization?.id || null)
    setOrgQuery(organization?.name || '')
    setOrgResults([])
    setError('')
  }, [customer, organization])

  const searchOrganisations = async (text: string) => {
    setOrgQuery(text)
    if (!text.trim()) {
      setOrgResults([])
      return
    }
    setOrgLoading(true)
    try {
      const found = await window.api.organizations.list({ query: text, page: 1, perPage: 15 })
      setOrgResults(found || [])
    } catch {
      // Leave the list empty; the field itself keeps working.
    } finally {
      setOrgLoading(false)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!firstname.trim() && !lastname.trim()) {
      setError('Укажите имя или фамилию')
      return
    }
    setLoading(true)
    setError('')
    try {
      await window.api.users.update(customer.id, {
        firstname: firstname.trim(),
        lastname: lastname.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        mobile: mobile.trim() || null,
        tg_id_for_notice: telegram.trim() || null,
        address: address.trim() || null,
        organization_id: orgId,
        ticketId
      })
      onSaved()
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Ошибка обновления профиля')
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
            Редактирование профиля клиента
          </h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { onClose(); setError('') }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {error && (
          <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="flex flex-col gap-3 overflow-y-auto pr-1">
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
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground">Адрес</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="h-16 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground resize-none focus:border-primary/60 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1 relative">
            <label className="text-[10px] font-semibold text-muted-foreground">Организация</label>
            <div className="relative">
              <input
                type="text"
                value={orgQuery}
                onChange={(e) => searchOrganisations(e.target.value)}
                placeholder="Поиск организации..."
                className="h-9 w-full rounded-md border border-border bg-muted/30 px-3 text-xs text-foreground focus:border-primary/60 focus:outline-none"
              />
              {orgQuery && orgId && (
                <button
                  type="button"
                  onClick={() => { setOrgId(null); setOrgQuery(''); }}
                  className="absolute right-2 top-2 h-5 w-5 text-muted-foreground hover:text-foreground flex items-center justify-center rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {orgLoading && (
              <div className="absolute right-2 top-8">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            )}
            {orgResults.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-background shadow-md">
                {orgResults.map((org) => (
                  <div
                    key={org.id}
                    onClick={() => {
                      setOrgId(org.id)
                      setOrgQuery(org.name)
                      setOrgResults([])
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
            <Button variant="outline" size="sm" type="button" onClick={() => onClose()} disabled={loading}>
              Отмена
            </Button>
            <Button size="sm" type="submit" disabled={loading}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              Сохранить
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}
