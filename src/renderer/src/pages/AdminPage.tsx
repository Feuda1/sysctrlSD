import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ShieldAlert, ShieldCheck, LogOut, Circle, Gauge, Megaphone, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorNotice } from '@/components/ui/error-notice'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface AdminUserRow {
  id: string
  email: string
  name: string
  lastSeen: number | null
  online: boolean
  banned: boolean
  requestsLastMinute: number
}

interface BroadcastMessage {
  id: string
  message: string
  sentAt: number
}

interface AdminStatus {
  users: AdminUserRow[]
  totalRequestsLastMinute: number
  broadcast: BroadcastMessage | null
}

// Дублирует ZAMMAD_REQUEST_WARN_PER_MINUTE из electron/main/ipc/tickets.ts -
// это порог для подсветки, а не общий с сервером контракт, так что держать
// его отдельной константой (а не тащить через API) осознанно.
const PER_USER_WARN_THRESHOLD = 100
const TOTAL_WARN_THRESHOLD = 300

function formatLastSeen(ts: number | null): string {
  if (!ts) return 'ещё не заходил'
  const diffSec = Math.round((Date.now() - ts) / 1000)
  if (diffSec < 60) return 'только что'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} мин назад`
  return new Date(ts).toLocaleString('ru-RU')
}

export default function AdminPage() {
  const queryClient = useQueryClient()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [broadcastText, setBroadcastText] = useState('')
  const [broadcastPending, setBroadcastPending] = useState(false)
  const myId = useAuthStore(s => s.user?.id)

  const { data, isLoading, isError, error, refetch } = useQuery<AdminStatus>({
    queryKey: ['admin', 'users'],
    queryFn: () => window.api.admin.getUsers(),
    refetchInterval: 10_000,
    placeholderData: (prev) => prev
  })

  // Себя в этом списке видеть незачем - это про остальных.
  const users = useMemo(() => (data?.users ?? []).filter(u => u.id !== String(myId)), [data, myId])
  const totalRequestsLastMinute = data?.totalRequestsLastMinute ?? 0
  const broadcast = data?.broadcast ?? null

  const run = async (userId: string, action: 'ban' | 'unban' | 'kick') => {
    setPendingId(userId)
    try {
      await window.api.admin[action](userId)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    } finally {
      setPendingId(null)
    }
  }

  const sendBroadcast = async () => {
    const message = broadcastText.trim()
    if (!message) return
    setBroadcastPending(true)
    try {
      await window.api.admin.sendBroadcast(message)
      setBroadcastText('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    } finally {
      setBroadcastPending(false)
    }
  }

  const clearBroadcast = async () => {
    setBroadcastPending(true)
    try {
      await window.api.admin.clearBroadcast()
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    } finally {
      setBroadcastPending(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Кто в приложении</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Обновить</Button>
      </div>

      {/* Рассылка всем сразу - баннер появится у каждого в течение одного
          такта heartbeat (до ~25 секунд), без Telegram и завязки на Zammad. */}
      <div className="rounded-lg border border-border p-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <Megaphone className="h-4 w-4 text-muted-foreground" />
          Сообщение всем
        </div>
        {broadcast ? (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
            <span className="flex-1">{broadcast.message}</span>
            <Button variant="ghost" size="sm" disabled={broadcastPending} onClick={clearBroadcast}>
              <X className="h-3.5 w-3.5" />
              Снять
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              placeholder="Например: Zammad ляжет на обслуживание в 15:00"
              onKeyDown={(e) => { if (e.key === 'Enter') sendBroadcast() }}
            />
            <Button disabled={broadcastPending || !broadcastText.trim()} onClick={sendBroadcast}>
              Отправить
            </Button>
          </div>
        )}
      </div>

      {/* То же число, что раньше было видно только в логе на конкретной
          машине - здесь оно суммарное по всей команде, ради этого весь
          экран и затевался. */}
      <div className={cn(
        'flex items-center gap-3 rounded-lg border p-3',
        totalRequestsLastMinute > TOTAL_WARN_THRESHOLD
          ? 'border-destructive/40 bg-destructive/10'
          : 'border-border bg-muted/20'
      )}>
        <Gauge className={cn('h-5 w-5 shrink-0', totalRequestsLastMinute > TOTAL_WARN_THRESHOLD ? 'text-destructive' : 'text-muted-foreground')} />
        <div>
          <p className={cn('text-sm font-semibold', totalRequestsLastMinute > TOTAL_WARN_THRESHOLD ? 'text-destructive' : 'text-foreground')}>
            {totalRequestsLastMinute} запросов к Zammad за последнюю минуту
          </p>
          <p className="text-xs text-muted-foreground">Сумма по всем, кто сейчас онлайн</p>
        </div>
      </div>

      {isError && (
        <ErrorNotice error={error} fallback="Не удалось получить список" onRetry={() => refetch()} />
      )}

      {isLoading && !users.length ? (
        <div className="text-sm text-muted-foreground">Загрузка…</div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Статус</th>
                <th className="px-4 py-2.5 font-medium">Имя</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Был онлайн</th>
                <th className="px-4 py-2.5 font-medium">Запросов/мин</th>
                <th className="px-4 py-2.5 font-medium">Бан</th>
                <th className="px-4 py-2.5 font-medium text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-accent/30">
                  <td className="px-4 py-2.5">
                    <Circle className={cn('h-2.5 w-2.5', u.online ? 'fill-emerald-500 text-emerald-500' : 'fill-muted-foreground/40 text-muted-foreground/40')} />
                  </td>
                  <td className="px-4 py-2.5 text-foreground">{u.name || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{u.email || '—'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatLastSeen(u.lastSeen)}</td>
                  <td className={cn('px-4 py-2.5', u.online && u.requestsLastMinute > PER_USER_WARN_THRESHOLD ? 'font-semibold text-destructive' : 'text-muted-foreground')}>
                    {u.online ? u.requestsLastMinute : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.banned && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">забанен</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === u.id || !u.online}
                        onClick={() => run(u.id, 'kick')}
                        title="Разовый выход прямо сейчас"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Кик
                      </Button>
                      {u.banned ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingId === u.id}
                          onClick={() => run(u.id, 'unban')}
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Разбанить
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={pendingId === u.id}
                          onClick={() => run(u.id, 'ban')}
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Забанить
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Пока никто не заходил
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
