import { ipcMain } from 'electron'
import { guardCall } from '../controlPlane'

/**
 * Личные настройки интерфейса, привязанные к аккаунту, а не к компьютеру:
 * сел за другую машину под тем же логином - тема, раскладка и остальное
 * подтянулись сами. Хранится на guard-сервере, тут же, где онлайн-статус и
 * бан - но это не про модерацию, доступ не ограничен списком админов: любой
 * читает и пишет только свои.
 */
export function setupUserSettingsIpc(): void {
  ipcMain.handle('settings:get', () =>
    guardCall<{ settings: Record<string, unknown> | null }>('/api/settings', 'GET'))

  ipcMain.handle('settings:push', (_event, settings: Record<string, unknown>) =>
    guardCall('/api/settings', 'POST', { settings }))
}
