import { ipcMain, net } from 'electron'
import { APP_SHARED_KEY, currentUser } from '../controlPlane'

const CONTROL_PLANE_BASE = import.meta.env.MAIN_VITE_CONTROL_PLANE_BASE ?? ''

export interface AdminUserRow {
  id: string
  email: string
  name: string
  lastSeen: number | null
  online: boolean
  banned: boolean
}

/**
 * Экран администратора внутри самого приложения: доступен любому, кто его
 * найдёт, но реально работает только для тех, чей Zammad id сервер держит в
 * `ADMIN_ZAMMAD_USER_IDS` - это и есть настоящая граница, а не то, кому
 * показан пункт меню в интерфейсе.
 */
async function adminCall<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  if (!CONTROL_PLANE_BASE || !APP_SHARED_KEY) {
    throw new Error('Контрольный сервер не настроен в этой сборке')
  }
  const user = currentUser()
  if (!user?.id) throw new Error('Нет активного пользователя')

  const resp = await net.fetch(`${CONTROL_PLANE_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-App-Key': APP_SHARED_KEY,
      'X-User-Id': String(user.id)
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000)
  })
  if (!resp.ok) {
    if (resp.status === 403) throw new Error('Нет прав администратора')
    throw new Error(`Сервер ответил ${resp.status}`)
  }
  return (await resp.json()) as T
}

export function setupAdminIpc(): void {
  ipcMain.handle('admin:getUsers', async () => {
    const data = await adminCall<{ users: AdminUserRow[] }>('/api/admin/users', 'GET')
    return data.users
  })

  ipcMain.handle('admin:ban', (_event, userId: string | number) =>
    adminCall('/api/admin/ban', 'POST', { userId }))

  ipcMain.handle('admin:unban', (_event, userId: string | number) =>
    adminCall('/api/admin/unban', 'POST', { userId }))

  ipcMain.handle('admin:kick', (_event, userId: string | number) =>
    adminCall('/api/admin/kick', 'POST', { userId }))
}
