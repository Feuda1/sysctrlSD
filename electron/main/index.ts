import { app, shell, BrowserWindow, ipcMain, nativeTheme, session, Menu, MenuItem, Tray, net, clipboard } from 'electron'
import { join, resolve } from 'path'
import { setupUpdater, quitAndInstallUpdate } from './updater'
import { setupAuthIpc } from './ipc/auth'
import { setupTicketsIpc, readNotificationSettings } from './ipc/tickets'
import { setupFormsIpc } from './ipc/forms'
import { setupAdminIpc } from './ipc/admin'
import { startControlPlaneHeartbeat } from './controlPlane'
import log from 'electron-log/main'

log.initialize({ preload: false })

let mainWindow: BrowserWindow | null = null
const windows = new Set<BrowserWindow>()
let tray: Tray | null = null
let isQuitting = false

// ── Deep linking (sysctrlsd://ticket/<clientsNumber>) ──────────────────────
const DEEPLINK_PROTOCOL = 'sysctrlsd'
let pendingDeepLink: string | null = null

function extractTicketNumber(url?: string): string | null {
  if (!url) return null
  const m = url.match(/^sysctrlsd:\/\/ticket\/(\d+)/i)
  return m ? m[1] : null
}

function handleDeepLinkFromArgv(argv: string[]): void {
  const urlArg = argv.find(a => typeof a === 'string' && a.startsWith(`${DEEPLINK_PROTOCOL}://`))
  const num = extractTicketNumber(urlArg)
  if (num) queueDeepLink(num)
}

function primaryWindow(): BrowserWindow | null {
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow
  return windows.values().next().value ?? null
}

function queueDeepLink(num: string): void {
  pendingDeepLink = num
  dispatchDeepLink()
}

// Hands the clients ticket number to the renderer, which resolves it to a
// Zammad id and opens it in a tab. Buffered in the renderer until authenticated.
function dispatchDeepLink(): void {
  if (!pendingDeepLink) return
  const win = primaryWindow()
  if (!win) return
  const num = pendingDeepLink
  pendingDeepLink = null
  const send = () => win.webContents.send('deeplink:open-ticket', num)
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', send)
  else send()
  if (win.isMinimized()) win.restore()
  win.focus()
}

const gotInstanceLock = app.requestSingleInstanceLock()
if (!gotInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    handleDeepLinkFromArgv(argv)
    const win = primaryWindow()
    if (win) { if (win.isMinimized()) win.restore(); win.focus() }
  })
  app.on('open-url', (event, url) => {
    event.preventDefault()
    const num = extractTicketNumber(url)
    if (num) queueDeepLink(num)
  })
}

function extensionPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'extension')
    : join(app.getAppPath(), 'extension')
}

// Системные кнопки окна (titleBarOverlay) больше не используются: они рисуются
// поверх всего содержимого, накрывая крестики диалогов, и не поддаются нашей
// теме. Кнопки нарисованы в интерфейсе - см. WindowControls.

function attachContextMenu(win: BrowserWindow): void {
  win.webContents.on('context-menu', (_event, params) => {
    const menu = new Menu()

    for (const suggestion of params.dictionarySuggestions) {
      menu.append(new MenuItem({
        label: suggestion,
        click: () => win.webContents.replaceMisspelling(suggestion)
      }))
    }

    if (params.misspelledWord) {
      if (params.dictionarySuggestions.length > 0) {
        menu.append(new MenuItem({ type: 'separator' }))
      }
      menu.append(new MenuItem({
        label: 'Добавить в словарь',
        click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
      }))
    }

    // Works for any rendered image regardless of where it came from - an
    // attachment thumbnail, an image inside an article, or the media viewer -
    // because copyImageAt takes what is painted at that point.
    if (params.mediaType === 'image') {
      if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({
        label: 'Копировать изображение',
        click: () => win.webContents.copyImageAt(params.x, params.y)
      }))
      if (params.srcURL) {
        menu.append(new MenuItem({
          label: 'Сохранить изображение…',
          click: () => win.webContents.downloadURL(params.srcURL)
        }))
        // A data: URL is the image itself - copying it as text is useless.
        if (/^https?:/i.test(params.srcURL)) {
          menu.append(new MenuItem({
            label: 'Копировать ссылку на изображение',
            click: () => clipboard.writeText(params.srcURL)
          }))
        }
      }
    }

    // Only offer editing where editing is possible. "Выбрать всё" used to appear
    // on every right click anywhere in the app, which is noise - the renderer
    // builds its own menu for tabs, tickets and the like.
    const hasSelection = !!params.selectionText.trim()
    if (params.isEditable) {
      if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }))
      if (params.editFlags.canCut && hasSelection) menu.append(new MenuItem({ label: 'Вырезать', role: 'cut' }))
      if (params.editFlags.canCopy && hasSelection) menu.append(new MenuItem({ label: 'Копировать', role: 'copy' }))
      if (params.editFlags.canPaste) menu.append(new MenuItem({ label: 'Вставить', role: 'paste' }))
      if (params.editFlags.canSelectAll) menu.append(new MenuItem({ label: 'Выбрать всё', role: 'selectAll' }))
    } else if (hasSelection && params.editFlags.canCopy) {
      if (menu.items.length > 0) menu.append(new MenuItem({ type: 'separator' }))
      menu.append(new MenuItem({ label: 'Копировать', role: 'copy' }))
    }

    if (menu.items.length > 0) menu.popup({ window: win })
  })
}

function setupTray(): void {
  const iconPath = join(__dirname, '../../resources/icon.ico')
  tray = new Tray(iconPath)
  tray.setToolTip('sysctrlSD')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Показать приложение',
      click: () => {
        const win = primaryWindow() ?? createWindow()
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Заявки',
      click: () => {
        const win = primaryWindow() ?? createWindow()
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
        win.webContents.send('navigation:go-to-tab', '/dashboard/tickets')
      }
    },
    {
      label: 'Звонки',
      click: () => {
        const win = primaryWindow() ?? createWindow()
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
        win.webContents.send('navigation:go-to-tab', '/dashboard/calls')
      }
    },
    {
      label: 'Организации',
      click: () => {
        const win = primaryWindow() ?? createWindow()
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
        win.webContents.send('navigation:go-to-tab', '/dashboard/organizations')
      }
    },
    {
      label: 'Формы',
      click: () => {
        const win = primaryWindow() ?? createWindow()
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
        win.webContents.send('navigation:go-to-tab', '/dashboard/forms')
      }
    },
    {
      label: 'Настройки',
      click: () => {
        const win = primaryWindow() ?? createWindow()
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
        win.webContents.send('navigation:go-to-tab', '/dashboard/settings')
      }
    },
    { type: 'separator' },
    {
      label: 'Выйти из приложения',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    const win = primaryWindow() ?? createWindow()
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
}

interface WindowBounds { x?: number; y?: number; width?: number; height?: number }

function createWindow(initialPath?: string, bounds?: WindowBounds): BrowserWindow {
  const isDark = nativeTheme.shouldUseDarkColors

  const win = new BrowserWindow({
    width: bounds?.width ?? 1500,
    height: bounds?.height ?? 900,
    x: bounds?.x,
    y: bounds?.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    icon: join(__dirname, '../../resources/icon.ico'),
    backgroundColor: isDark ? '#0b0f1a' : '#f8fafc',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  windows.add(win)
  win.on('close', (event) => {
    if (!isQuitting) {
      const settings = readNotificationSettings()
      if (settings.closeToTrayEnabled !== false) {
        event.preventDefault()
        win.hide()
      }
    }
  })
  win.on('closed', () => {
    windows.delete(win)
    if (mainWindow === win) {
      mainWindow = windows.values().next().value ?? null
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('maximize', () => win.webContents.send('window:state', { maximized: true }))
  win.on('unmaximize', () => win.webContents.send('window:state', { maximized: false }))

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  attachContextMenu(win)

  const query = initialPath ? { initialPath } : undefined
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    const base = process.env['ELECTRON_RENDERER_URL']
    const url = initialPath ? `${base}?initialPath=${encodeURIComponent(initialPath)}` : base
    win.loadURL(url)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), query ? { query } : undefined)
  }

  return win
}

app.whenReady().then(() => {
  const chromeUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  session.defaultSession.setUserAgent(chromeUserAgent)
  session.fromPartition('persist:clients-denvic').setUserAgent(chromeUserAgent)
  session.defaultSession.setSpellCheckerLanguages(['ru', 'en-US'])

  if (process.platform === 'win32') {
    app.setAppUserModelId('ru.denvic.sysctrlsd')
  }

  // Register the custom protocol so sysctrlsd:// links launch/focus the app.
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DEEPLINK_PROTOCOL, process.execPath, [resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(DEEPLINK_PROTOCOL)
  }

  app.on('browser-window-created', (_, window) => {
    if (!app.isPackaged) {
      window.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12') {
          window.webContents.toggleDevTools()
          event.preventDefault()
        }
      })
    }
  })

  const senderWindow = (event: Electron.IpcMainInvokeEvent) => BrowserWindow.fromWebContents(event.sender)

  // Свернуть и развернуть выполняются следующим тиком. Вызванные прямо из
  // обработки нажатия, они молча ничего не делали: окно в этот момент занято
  // системным циклом ввода, и смена его состояния до него не доходит. Закрытие
  // работало, потому что окно просто уничтожается.
  /**
   * Пока Windows обрабатывает нажатие в окне, смена его состояния молча
   * отбрасывается: команда не откладывается, а теряется совсем. Поэтому действие
   * повторяется, пока окно не примет его - но не бесконечно.
   */
  const applyWindowState = (
    win: BrowserWindow | null,
    apply: (win: BrowserWindow) => void,
    done: (win: BrowserWindow) => boolean,
    attemptsLeft = 8
  ): void => {
    if (!win || win.isDestroyed()) return
    apply(win)
    if (done(win) || attemptsLeft <= 0) return
    setTimeout(() => applyWindowState(win, apply, done, attemptsLeft - 1), 60)
  }

  ipcMain.handle('window:minimize', (event) => {
    applyWindowState(senderWindow(event), win => win.minimize(), win => win.isMinimized())
  })
  ipcMain.handle('window:maximize', (event) => {
    const win = senderWindow(event)
    if (!win) return
    const wasMaximized = win.isMaximized()
    applyWindowState(
      win,
      target => (wasMaximized ? target.unmaximize() : target.maximize()),
      target => target.isMaximized() !== wasMaximized
    )
  })
  ipcMain.handle('window:close', (event) => senderWindow(event)?.close())
  ipcMain.handle('window:isMaximized', (event) => senderWindow(event)?.isMaximized() ?? false)

  ipcMain.handle('windows:open', (_event, initialPath?: string, bounds?: WindowBounds) => {
    createWindow(typeof initialPath === 'string' ? initialPath : undefined, bounds)
  })

  // Native context menu built by the renderer, which is the only side that knows
  // what was right-clicked. Resolves with the id of the chosen item, or null.
  ipcMain.handle('app:showContextMenu', (event, items: { id?: string; label?: string; type?: 'separator'; enabled?: boolean }[]) => {
    const win = senderWindow(event)
    if (!win || !Array.isArray(items) || items.length === 0) return null

    return new Promise<string | null>(resolve => {
      let picked: string | null = null
      const menu = new Menu()

      for (const item of items) {
        if (item?.type === 'separator') {
          menu.append(new MenuItem({ type: 'separator' }))
          continue
        }
        if (!item?.id || !item?.label) continue
        menu.append(new MenuItem({
          label: item.label,
          enabled: item.enabled !== false,
          click: () => { picked = item.id as string }
        }))
      }

      if (menu.items.length === 0) {
        resolve(null)
        return
      }
      menu.popup({ window: win, callback: () => resolve(picked) })
    })
  })

  // Installing an update must bypass close-to-tray and actually quit.
  ipcMain.handle('updater:install', () => {
    isQuitting = true
    quitAndInstallUpdate()
  })

  ipcMain.handle('app:getExtensionInfo', () => ({
    path: extensionPath(),
    packaged: app.isPackaged
  }))

  // OpenRouter free models, grouped into chunks of 3 (OpenRouter caps the
  // `models` fallback array at 3). We try chunk by chunk: within a chunk
  // OpenRouter itself falls back across the 3; across chunks we retry on
  // rate-limit. Providers are interleaved so a single busy provider doesn't
  // block a whole chunk - for ~10 users the free limit practically never runs
  // out. All are general-purpose instruct models (no reasoning/coder) and
  // reachable from RU.
  const OPENROUTER_MODEL_CHUNKS: string[][] = [
    ['openai/gpt-oss-120b:free', 'google/gemma-4-31b-it:free', 'z-ai/glm-4.5-air:free'],
    ['qwen/qwen3-next-80b-a3b-instruct:free', 'moonshotai/kimi-k2.6:free', 'meta-llama/llama-3.3-70b-instruct:free'],
    ['nvidia/nemotron-3-super-120b-a12b:free', 'google/gemma-4-26b-a4b-it:free', 'openai/gpt-oss-20b:free']
  ]

  // AI completion runs in the main process (no renderer CORS, uses system proxy
  // - same path as the working Zammad requests).
  ipcMain.handle('ai:complete', async (_event, params: {
    systemPrompt: string; userText: string; apiKey: string; provider: 'groq' | 'deepseek' | 'openrouter'
  }) => {
    const messages = [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userText }
    ]

    const callOnce = async (url: string, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}) => {
      const resp = await net.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.apiKey}`, ...extraHeaders },
        body: JSON.stringify({ messages, temperature: 0.3, max_tokens: 2048, ...body })
      })
      if (!resp.ok) {
        const raw = await resp.text().catch(() => '')
        let msg = ''
        try { msg = JSON.parse(raw)?.error?.message || '' } catch {}
        const err = new Error(msg || (resp.status === 401 || resp.status === 403
          ? `Сервис AI отклонил запрос (${resp.status}). Ключ недействителен или сервис недоступен.`
          : `Ошибка AI: ${resp.status}`)) as Error & { status?: number }
        err.status = resp.status
        throw err
      }
      const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
      return data.choices?.[0]?.message?.content?.trim() || ''
    }

    if (params.provider === 'openrouter') {
      const headers = { 'HTTP-Referer': 'https://github.com/Feuda1/sysctrlSD', 'X-Title': 'sysctrlSD' }
      let lastError: Error | null = null
      // Walk chunk by chunk: each request lets OpenRouter fall back across its 3
      // models; on rate-limit we move to the next chunk (different providers).
      for (const chunk of OPENROUTER_MODEL_CHUNKS) {
        try {
          return await callOnce('https://openrouter.ai/api/v1/chat/completions', { model: chunk[0], models: chunk }, headers)
        } catch (e) {
          lastError = e as Error
          const status = (e as { status?: number }).status
          // Only keep trying on rate-limit / transient errors; bail on auth errors.
          if (status === 401 || status === 403) break
          if (status && status !== 429 && status < 500) break
        }
      }
      if ((lastError as { status?: number } | null)?.status === 429) {
        throw new Error('Все бесплатные модели сейчас перегружены. Повторите через несколько секунд.')
      }
      throw lastError || new Error('Не удалось получить ответ AI')
    }

    const url = params.provider === 'deepseek'
      ? 'https://api.deepseek.com/chat/completions'
      : 'https://api.groq.com/openai/v1/chat/completions'
    const model = params.provider === 'deepseek' ? 'deepseek-chat' : 'llama-3.3-70b-versatile'
    return callOnce(url, { model })
  })

  ipcMain.handle('theme:get', () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light'))
  ipcMain.handle('theme:set', (_event, theme: 'dark' | 'light' | 'gray' | 'oled' | 'warm' | 'indigo' | 'nord' | 'system') => {
    // У nativeTheme (заголовок окна, системные меню) есть только "тёмный" и
    // "светлый" источник. Любая наша тема средней/низкой яркости - не только
    // серая - ближе к тёмному источнику, чем к светлому.
    const isNativeChoice = theme === 'light' || theme === 'dark' || theme === 'system'
    nativeTheme.themeSource = isNativeChoice ? theme : 'dark'
    if (!isNativeChoice) return theme
    if (theme !== 'system') return theme
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  setupPyrusInterceptor(session.defaultSession)
  setupPyrusInterceptor(session.fromPartition('persist:clients-denvic'))

  setupAuthIpc()
  setupTicketsIpc()
  setupFormsIpc()
  setupAdminIpc()
  startControlPlaneHeartbeat()
  mainWindow = createWindow()
  setupUpdater(mainWindow)
  setupTray()

  handleDeepLinkFromArgv(process.argv)
  dispatchDeepLink()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })

  app.on('before-quit', () => {
    isQuitting = true
  })
})

function setupPyrusInterceptor(ses: Electron.Session): void {
  ses.webRequest.onBeforeSendHeaders(
    { urls: ['*://pyrus.com/*', '*://*.pyrus.com/*'] },
    (details, callback) => {
      const referer = details.referrer || details.requestHeaders['Referer'] || ''
      if (referer.includes('pyrus.com')) {
        callback({ requestHeaders: details.requestHeaders })
        return
      }
      details.requestHeaders['Referer'] = 'https://clients.denvic.ru/'
      details.requestHeaders['Origin'] = 'https://clients.denvic.ru'
      callback({ requestHeaders: details.requestHeaders })
    }
  )

  ses.webRequest.onBeforeRequest(
    { urls: ['*://pyrus.com/*', '*://*.pyrus.com/*'] },
    (details, callback) => {
      log.info('Pyrus Request:', details.url, details.resourceType)
      callback({})
    }
  )

  ses.webRequest.onHeadersReceived(
    { urls: ['*://pyrus.com/*', '*://*.pyrus.com/*'] },
    (details, callback) => {
      log.info('Pyrus Response:', details.url, details.statusCode)
      callback({})
    }
  )

  ses.webRequest.onErrorOccurred(
    { urls: ['*://pyrus.com/*', '*://*.pyrus.com/*'] },
    (details) => {
      log.error('Pyrus Error:', details.url, details.error)
    }
  )
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
