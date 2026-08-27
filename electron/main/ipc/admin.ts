import { ipcMain } from 'electron'
import { guardCall, type BroadcastMessage } from '../controlPlane'

export interface AdminUserRow {
  id: string
  email: string
  name: string
  lastSeen: number | null
  online: boolean
  banned: boolean
  requestsLastMinute: number
}

export interface AdminStatus {
  users: AdminUserRow[]
  totalRequestsLastMinute: number
  broadcast: BroadcastMessage | null
}

/**
 * Экран администратора внутри самого приложения: доступен любому, кто его
 * найдёт, но реально работает только для тех, чей Zammad id сервер держит в
 * `ADMIN_ZAMMAD_USER_IDS` - это и есть настоящая граница, а не то, кому
 * показан пункт меню в интерфейсе.
 */
export function setupAdminIpc(): void {
  ipcMain.handle('admin:getUsers', () => guardCall<AdminStatus>('/api/admin/users', 'GET'))

  ipcMain.handle('admin:ban', (_event, userId: string | number) =>
    guardCall('/api/admin/ban', 'POST', { userId }))

  ipcMain.handle('admin:unban', (_event, userId: string | number) =>
    guardCall('/api/admin/unban', 'POST', { userId }))

  ipcMain.handle('admin:kick', (_event, userId: string | number) =>
    guardCall('/api/admin/kick', 'POST', { userId }))

  ipcMain.handle('admin:sendBroadcast', (_event, message: string) =>
    guardCall('/api/admin/broadcast', 'POST', { message }))

  ipcMain.handle('admin:clearBroadcast', () =>
    guardCall('/api/admin/broadcast/clear', 'POST'))
}
