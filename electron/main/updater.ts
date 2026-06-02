import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import logger from 'electron-log/main'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'

export interface UpdateState {
  status: UpdateStatus
  version?: string
  percent?: number
  error?: string
}

let initialized = false
let lastState: UpdateState = { status: 'idle' }

function broadcast(state: UpdateState): void {
  lastState = state
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('updater:status', state)
  }
}

/** Quit the app and install a downloaded update. Caller sets the quitting flag. */
export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall()
}

export function setupUpdater(_win: BrowserWindow): void {
  if (initialized) return
  initialized = true

  autoUpdater.logger = logger
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => broadcast({ status: 'checking' }))
  autoUpdater.on('update-available', (info) => broadcast({ status: 'available', version: info.version }))
  autoUpdater.on('update-not-available', (info) => broadcast({ status: 'not-available', version: info.version }))
  autoUpdater.on('download-progress', (p) => broadcast({ status: 'downloading', percent: Math.round(p.percent ?? 0) }))
  autoUpdater.on('update-downloaded', (info) => broadcast({ status: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) => broadcast({ status: 'error', error: String(err?.message || err) }))

  ipcMain.handle('updater:get-state', () => lastState)
  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) {
      // Auto-update only works on packaged builds; report the current version as up to date.
      broadcast({ status: 'not-available', version: app.getVersion() })
      return { ok: false, dev: true }
    }
    try {
      await autoUpdater.checkForUpdates()
      return { ok: true }
    } catch (err) {
      broadcast({ status: 'error', error: String((err as any)?.message || err) })
      return { ok: false }
    }
  })

  // Silent check on startup (packaged only). Available updates download in the
  // background and the renderer is notified when ready to install.
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((err) => logger.error('Update check failed:', err))
  }
}
