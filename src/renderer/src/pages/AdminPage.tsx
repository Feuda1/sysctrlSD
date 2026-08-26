import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ShieldAlert, ShieldCheck, LogOut, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
}

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
  const myId = useAuthStore(s => s.user?.id)

  const { data: allUsers = [], isLoading, isError, error, refetch } = useQuery<AdminUserRow[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => window.api.admin.getUsers(),
    refetchInterval: 10_000,
    placeholderData: (prev) => prev
  })

  // Себя в этом списке видеть незачем - это про остальных.
  const users = useMemo(() => allUsers.filter(u => u.id !== String(myId)), [allUsers, myId])

  const run = async (userId: string, action: 'ban' | 'unban' | 'kick') => {
    setPendingId(userId)
    try {
      await window.api.admin[action](userId)
      await queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-foreground">Кто в приложении</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Обновить</Button>
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
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
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
