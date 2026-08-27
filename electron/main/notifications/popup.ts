import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'

/**
 * Свой всплывающий тост вместо голого системного (`new Notification(...)`) -
 * маленькое безрамочное окно поверх всех остальных, оформленное как
 * остальное приложение, а не как стандартный OS-баннер. Грузит тот же
 * renderer-бандл, что и обычные окна, отличаясь только query-параметром
 * (`?popup=notification&...`) - `App.tsx` сам решает, какую ветку рисовать,
 * отдельного Vite-входа под это заводить не нужно.
 */

const POPUP_WIDTH = 340
const POPUP_HEIGHT = 96
const POPUP_GAP = 10
const POPUP_MARGIN = 16
const POPUP_LIFETIME_MS = 7000
// Столько же, сколько уже допускает встроенный тост (`notifications.ts`,
// addToast) - не заваливать экран, если пришло сразу много уведомлений.
const MAX_VISIBLE_POPUPS = 3

export interface PopupNotification {
  id: string
  title: string
  body: string
  ticketId: number
}

interface OpenPopup {
  win: BrowserWindow
  timer: ReturnType<typeof setTimeout> | null
}

const openPopups: OpenPopup[] = []
let ipcRegistered = false

function reflow(): void {
  const { workArea } = screen.getPrimaryDisplay()
  openPopups.forEach((p, i) => {
    if (p.win.isDestroyed()) return
    const x = workArea.x + workArea.width - POPUP_MARGIN - POPUP_WIDTH
    const y = workArea.y + workArea.height - POPUP_MARGIN - (POPUP_HEIGHT + POPUP_GAP) * (i + 1)
    p.win.setBounds({ x, y, width: POPUP_WIDTH, height: POPUP_HEIGHT })
  })
}

function findEntry(webContentsId: number): OpenPopup | undefined {
  return openPopups.find(p => !p.win.isDestroyed() && p.win.webContents.id === webContentsId)
}

function closeEntry(entry: OpenPopup): void {
  if (entry.timer) clearTimeout(entry.timer)
  const idx = openPopups.indexOf(entry)
  if (idx >= 0) openPopups.splice(idx, 1)
  if (!entry.win.isDestroyed()) entry.win.close()
  reflow()
}

function scheduleClose(entry: OpenPopup, ms: number): void {
  if (entry.timer) clearTimeout(entry.timer)
  entry.timer = setTimeout(() => closeEntry(entry), ms)
}

/** Регистрируется один раз - хендлеры общие для всех попапов, конкретное
 * окно определяется по `event.sender`, а не отдельным набором на каждое. */
function ensureIpc(onOpenTicket: (ticketId: number) => void): void {
  if (ipcRegistered) return
  ipcRegistered = true

  ipcMain.on('notifications:popup-pause', (event) => {
    const entry = findEntry(event.sender.id)
    if (entry?.timer) { clearTimeout(entry.timer); entry.timer = null }
  })
  ipcMain.on('notifications:popup-resume', (event) => {
    const entry = findEntry(event.sender.id)
    if (entry) scheduleClose(entry, POPUP_LIFETIME_MS)
  })
  ipcMain.on('notifications:popup-dismiss', (event) => {
    const entry = findEntry(event.sender.id)
    if (entry) closeEntry(entry)
  })
  ipcMain.on('notifications:popup-click', (event, ticketId: number) => {
    const entry = findEntry(event.sender.id)
    if (entry) closeEntry(entry)
    onOpenTicket(ticketId)
  })
}

export function showNotificationPopup(notif: PopupNotification, onOpenTicket: (ticketId: number) => void): void {
  ensureIpc(onOpenTicket)
  if (openPopups.length >= MAX_VISIBLE_POPUPS) return

  const win = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    show: false,
    icon: join(__dirname, '../../resources/icon.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  const query = { popup: 'notification', title: notif.title, body: notif.body, ticketId: String(notif.ticketId) }
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL']
    const qs = new URLSearchParams(query).toString()
    win.loadURL(`${base}?${qs}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query })
  }

  const entry: OpenPopup = { win, timer: null }
  win.once('ready-to-show', () => {
    win.showInactive()
    reflow()
  })
  win.on('closed', () => {
    const idx = openPopups.indexOf(entry)
    if (idx >= 0) openPopups.splice(idx, 1)
  })

  openPopups.push(entry)
  scheduleClose(entry, POPUP_LIFETIME_MS)
}
