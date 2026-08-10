import { ipcMain, safeStorage, app, session, net } from 'electron'

let _zammadTokenCache: string | null = null
export function setZammadTokenCache(token: string) { _zammadTokenCache = token }
export function getZammadTokenCache() { return _zammadTokenCache }
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import logger from 'electron-log/main'

const WRAPPER_BASE = 'https://clients.denvic.ru'
const ZAMMAD_BASE = 'https://zammad.denvic.ru'

// Dedicated persistent session for the wrapper — behaves like a browser, handles cookies automatically
const WRAPPER_PARTITION = 'persist:clients-denvic'

function wrapperSession() {
  return session.fromPartition(WRAPPER_PARTITION)
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
}

function getAttr(tag: string, attr: string): string {
  const match = tag.match(new RegExp(`\\s${attr}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return decodeHtml(match?.[1] ?? match?.[2] ?? match?.[3] ?? '')
}

function hasAttr(tag: string, attr: string): boolean {
  return new RegExp(`\\s${attr}(?:\\s|=|>|/)`, 'i').test(tag)
}

function normalizeFieldName(value: string): string {
  return value.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '')
}

function chooseProfileForm(html: string): { tag: string; body: string } {
  const forms = Array.from(html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi))
  const form = forms.find(match => /ZammadApiKey|Внутрен|Группа/i.test(match[0])) ?? forms[0]
  if (!form) return { tag: '', body: html }
  return { tag: form[1], body: form[2] }
}

function labelMapFromHtml(html: string): Map<string, string> {
  const labels = new Map<string, string>()
  for (const match of html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/gi)) {
    const id = getAttr(match[1], 'for')
    if (id) labels.set(id, stripTags(match[2]))
  }
  return labels
}

function nearbyLabel(html: string, index: number): string {
  const before = html.slice(Math.max(0, index - 500), index)
  const label = Array.from(before.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi)).pop()
  return label ? stripTags(label[1]) : ''
}

function parseSelectOptions(selectHtml: string): { value: string; label: string; selected: boolean }[] {
  return Array.from(selectHtml.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)).map(match => ({
    value: getAttr(match[1], 'value'),
    label: stripTags(match[2]),
    selected: hasAttr(match[1], 'selected')
  }))
}

function parseProfileForm(html: string): ProfileForm {
  const { tag, body } = chooseProfileForm(html)
  const labels = labelMapFromHtml(body)
  const action = getAttr(tag, 'action') || '/Users/Profile'
  const method = (getAttr(tag, 'method') || 'POST').toUpperCase()
  const params = new URLSearchParams()
  const controls: ProfileControl[] = []

  for (const match of body.matchAll(/<input\b([^>]*)>/gi)) {
    const inputTag = match[1]
    const name = getAttr(inputTag, 'name')
    if (!name || hasAttr(inputTag, 'disabled')) continue
    const type = (getAttr(inputTag, 'type') || 'text').toLowerCase()
    if ((type === 'checkbox' || type === 'radio') && !hasAttr(inputTag, 'checked')) continue

    const id = getAttr(inputTag, 'id')
    const value = getAttr(inputTag, 'value') || (type === 'checkbox' ? 'true' : '')
    params.append(name, value)
    controls.push({
      name,
      id,
      value,
      label: labels.get(id) || nearbyLabel(body, match.index ?? 0),
      tag: 'input'
    })
  }

  for (const match of body.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi)) {
    const textareaTag = match[1]
    const name = getAttr(textareaTag, 'name')
    if (!name || hasAttr(textareaTag, 'disabled')) continue
    const id = getAttr(textareaTag, 'id')
    const value = decodeHtml(match[2])
    params.append(name, value)
    controls.push({
      name,
      id,
      value,
      label: labels.get(id) || nearbyLabel(body, match.index ?? 0),
      tag: 'textarea'
    })
  }

  for (const match of body.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
    const selectTag = match[1]
    const name = getAttr(selectTag, 'name')
    if (!name || hasAttr(selectTag, 'disabled')) continue
    const id = getAttr(selectTag, 'id')
    const options = parseSelectOptions(match[2])
    const selected = options.find(option => option.selected) ?? options[0]
    const value = selected?.value ?? ''
    params.append(name, value)
    controls.push({
      name,
      id,
      value,
      label: labels.get(id) || nearbyLabel(body, match.index ?? 0),
      tag: 'select',
      options
    })
  }

  return { action, method, params, controls }
}

function findControl(form: ProfileForm, candidates: string[], labelParts: string[]): ProfileControl | undefined {
  const normalizedCandidates = candidates.map(normalizeFieldName)
  const byName = form.controls.find(control => {
    const name = normalizeFieldName(control.name)
    const id = normalizeFieldName(control.id)
    return normalizedCandidates.some(candidate => name === candidate || id === candidate || name.endsWith(candidate) || id.endsWith(candidate))
  })
  if (byName) return byName

  return form.controls.find(control => {
    const label = normalizeFieldName(control.label)
    return labelParts.every(part => label.includes(normalizeFieldName(part)))
  })
}

function getProfileFields(form: ProfileForm) {
  const zammadApiKey = findControl(form, ['ZammadApiKey'], ['zammad'])
  const internalPhone = findControl(
    form,
    ['InternalPhone', 'InternalPhoneNumber', 'PhoneInternal', 'PhoneExtension', 'Extension', 'InnerPhone'],
    ['внутрен', 'тел']
  )
  const defaultGroup = findControl(
    form,
    ['DefaultGroupId', 'DefaultTicketGroupId', 'DefaultCreateTicketGroupId', 'TicketDefaultGroupId', 'GroupId'],
    ['группа', 'умолчан']
  )
  return { zammadApiKey, internalPhone, defaultGroup }
}

async function readClientProfileForm(): Promise<ProfileForm> {
  let resp = await net.fetch(`${WRAPPER_BASE}/Users/Profile`, { session: wrapperSession() } as any)
  if (!resp.ok) throw new Error(`Не удалось загрузить профиль clients: ${resp.status}`)
  let html = await resp.text()
  if (html.includes('/Account/Login')) {
    const stored = readStored()
    if (stored.savedEmail && stored.savedPassword) {
      try {
        await loginWrapper(stored.savedEmail, stored.savedPassword)
        resp = await net.fetch(`${WRAPPER_BASE}/Users/Profile`, { session: wrapperSession() } as any)
        if (resp.ok) {
          html = await resp.text()
          if (!html.includes('/Account/Login')) {
            return parseProfileForm(html)
          }
        }
      } catch (err) {
        logger.error('Auto-login during readClientProfileForm failed:', err)
      }
    }
    throw new Error('Сессия clients истекла')
  }
  return parseProfileForm(html)
}

async function getClientProfileSettings(): Promise<ClientProfileSettings> {
  const form = await readClientProfileForm()
  const { zammadApiKey, internalPhone, defaultGroup } = getProfileFields(form)
  const selectedGroup = defaultGroup?.options?.find(option => option.value === defaultGroup.value)

  return {
    zammadApiKey: zammadApiKey?.value ?? readStored().zammadToken ?? '',
    internalPhone: internalPhone?.value ?? '',
    defaultGroupId: defaultGroup?.value ?? '',
    defaultGroupName: selectedGroup?.label ?? '',
    groupOptions: defaultGroup?.options?.map(option => ({ value: option.value, label: option.label })) ?? []
  }
}

async function updateClientProfileSettings(patch: ClientProfileSettingsPatch): Promise<ClientProfileSettings> {
  const form = await readClientProfileForm()
  const fields = getProfileFields(form)

  const updates: { control: ProfileControl | undefined; value: string | undefined; label: string }[] = [
    { control: fields.zammadApiKey, value: patch.zammadApiKey, label: 'ZammadApiKey' },
    { control: fields.internalPhone, value: patch.internalPhone, label: 'Внутренний номер телефона' },
    { control: fields.defaultGroup, value: patch.defaultGroupId, label: 'Группа по умолчанию' }
  ]

  for (const update of updates) {
    if (update.value === undefined) continue
    if (!update.control) throw new Error(`Поле "${update.label}" не найдено на странице профиля clients`)
    form.params.set(update.control.name, update.value)
  }

  const actionUrl = new URL(form.action, WRAPPER_BASE).toString()
  const resp = await net.fetch(actionUrl, {
    method: form.method === 'GET' ? 'GET' : 'POST',
    session: wrapperSession(),
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `${WRAPPER_BASE}/Users/Profile`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: form.method === 'GET' ? undefined : form.params.toString()
  } as any)

  if (!resp.ok) throw new Error(`Не удалось сохранить профиль clients: ${resp.status}`)

  if (patch.zammadApiKey !== undefined) {
    const stored = readStored()
    writeStored({ ...stored, zammadToken: patch.zammadApiKey })
    setZammadTokenCache(patch.zammadApiKey)
  }

  return getClientProfileSettings()
}

// ---------------------------------------------------------------------------
// Session storage (encrypted file for Zammad token + user info)
// ---------------------------------------------------------------------------

function getStoragePath(): string {
  const dir = join(app.getPath('userData'), 'secure')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'session.dat')
}

interface StoredData {
  zammadToken?: string
  userJson?: string
  savedEmail?: string
  savedPassword?: string
}

interface ClientProfileSettings {
  zammadApiKey: string
  internalPhone: string
  defaultGroupId: string
  defaultGroupName: string
  groupOptions: { value: string; label: string }[]
}

interface ClientProfileSettingsPatch {
  zammadApiKey?: string
  internalPhone?: string
  defaultGroupId?: string
}

interface ProfileControl {
  name: string
  id: string
  value: string
  label: string
  tag: 'input' | 'select' | 'textarea'
  options?: { value: string; label: string; selected: boolean }[]
}

interface ProfileForm {
  action: string
  method: string
  params: URLSearchParams
  controls: ProfileControl[]
}

export function readStored(): StoredData {
  try {
    const path = getStoragePath()
    if (!existsSync(path)) return {}
    const raw = readFileSync(path)
    if (!safeStorage.isEncryptionAvailable()) return {}
    return JSON.parse(safeStorage.decryptString(raw)) as StoredData
  } catch {
    return {}
  }
}

export function writeStored(data: StoredData): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) return
    writeFileSync(getStoragePath(), safeStorage.encryptString(JSON.stringify(data)))
  } catch (err) {
    logger.error('Failed to write stored data:', err)
  }
}

// A mere mention of /Account/Login is not enough to call a page the login page —
// the profile page links to account actions too, and that false positive used to
// fail the login of perfectly fine accounts. Only a real login form counts.
function isClientsLoginPage(html: string): boolean {
  if (!html) return false
  if (/<form[^>]+action="[^"]*\/Account\/Login/i.test(html)) return true
  return /name="password"/i.test(html) && /\/Account\/Login/i.test(html)
}

function clientsValidationMessage(html: string): string {
  const match =
    html.match(/<div[^>]*class="[^"]*validation-summary-errors[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<span[^>]*class="[^"]*text-danger[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
  return match ? stripTags(match[1]) : ''
}

export async function loginWrapper(email: string, password: string): Promise<AppUser> {
  const ses = wrapperSession()

  await ses.clearStorageData({ storages: ['cookies'] })

  const pageResp = await net.fetch(`${WRAPPER_BASE}/`, {
    session: ses,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  } as any)
  const html = await pageResp.text()

  const csrfMatch = html.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)
  if (!csrfMatch) throw new Error('CSRF token не найден на странице входа')
  const csrfToken = csrfMatch[1]

  const loginResp = await net.fetch(`${WRAPPER_BASE}/Account/Login?returnUrl=%2F`, {
    method: 'POST',
    session: ses,
    redirect: 'follow',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: new URLSearchParams({
      Email: email,
      password,
      RememberMe: 'false',
      __RequestVerificationToken: csrfToken
    }).toString()
  } as any)

  // net.fetch does not always fill in the final url, so the answer itself is what
  // decides: clients re-renders the login form when the credentials are refused.
  const loginHtml = await loginResp.text()
  if (loginResp.url.includes('/Account/Login') || loginResp.url.includes('returnUrl') || isClientsLoginPage(loginHtml)) {
    const validation = clientsValidationMessage(loginHtml)
    throw new Error(validation || 'Неверный логин или пароль')
  }

  logger.info('Wrapper login successful, landed on:', loginResp.url)
  logger.info('Wrapper login OK, fetching Zammad API key from profile...')

  // The cookie is the actual proof that a session exists; the page contents only
  // tell us whether this particular request was answered with it.
  const identityCookieSet = async (): Promise<boolean> => {
    try {
      const cookies = await ses.cookies.get({ url: WRAPPER_BASE })
      return cookies.some(cookie => cookie.name === '.AspNetCore.Identity.Application')
    } catch {
      return false
    }
  }

  if (!await identityCookieSet()) {
    logger.error('Кука сессии clients не установлена после входа')
    throw new Error(
      'Сессия не была создана: clients не выдал куку входа. ' +
      'Проверьте системные дату и время, а затем повторите вход.'
    )
  }

  const loadProfile = async () => {
    const resp = await net.fetch(`${WRAPPER_BASE}/Users/Profile`, {
      session: ses,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    } as any)
    return { url: String(resp.url ?? ''), html: await resp.text() }
  }

  let profile = await loadProfile()

  if (profile.url.includes('/Account/Login') || isClientsLoginPage(profile.html)) {
    logger.warn('Профиль clients вернул страницу входа, повторяю запрос', {
      url: profile.url,
      length: profile.html.length
    })
    profile = await loadProfile()
  }

  if (profile.url.includes('/Account/Login') || isClientsLoginPage(profile.html)) {
    logger.error('Профиль clients недоступен после входа', {
      url: profile.url,
      length: profile.html.length,
      snippet: profile.html.slice(0, 300)
    })
    throw new Error(
      'Вход выполнен, но clients не отдаёт профиль. ' +
      'Повторите попытку; если ошибка остаётся — проверьте доступ к clients.denvic.ru и системное время.'
    )
  }

  const profileHtml = profile.html

  const keyMatch =
    profileHtml.match(/ZammadApiKey[^>]*value="([^"]{10,})"/) ||
    profileHtml.match(/value="([^"]{10,})"[^>]*ZammadApiKey/) ||
    profileHtml.match(/id="ZammadApiKey"[^>]*value="([^"]+)"/) ||
    profileHtml.match(/name="ZammadApiKey"[^>]*value="([^"]+)"/) ||
    profileHtml.match(/ZammadApiKey["\s:]+([A-Za-z0-9_\-]{20,})/)

  const zammadToken = keyMatch?.[1] ?? null

  if (zammadToken) {
    logger.info('ZammadApiKey extracted successfully')
    const stored = readStored()
    writeStored({ ...stored, zammadToken })
  } else {
    logger.warn('ZammadApiKey not found in profile page')
    logger.debug('Profile HTML snippet:', profileHtml.substring(0, 2000))
  }

  const token = zammadToken ?? readStored().zammadToken
  if (!token) {
    // Without the key nothing in the app works, and failing here says why
    // instead of letting every later request break on its own.
    throw new Error(
      'В профиле clients не найден API-ключ Zammad. ' +
      'Откройте clients.denvic.ru → Профиль и убедитесь, что ключ выдан.'
    )
  }

  const zUser = await fetchZammadUser(token)
  if (zUser) return zUser

  const login = email.split('@')[0]
  return { email, login, firstname: login, lastname: '' }
}

export async function isWrapperSessionAlive(): Promise<boolean> {
  try {
    const ses = wrapperSession()
    const cookies = await ses.cookies.get({ url: WRAPPER_BASE })
    return cookies.some((c) => c.name === '.AspNetCore.Identity.Application')
  } catch {
    return false
  }
}
async function cleanZammadFetch(url: string, options: any = {}) {
  const ses = session.fromPartition('zammad-api')
  try {
    await ses.clearStorageData({ storages: ['cookies'] })
  } catch {}
  const headers = {
    ...options.headers,
    Origin: 'https://zammad.denvic.ru',
    Referer: 'https://zammad.denvic.ru/'
  }
  return net.fetch(url, { ...options, headers, session: ses } as any)
}

export async function fetchZammadUser(token: string): Promise<AppUser | null> {
  try {
    const resp = await cleanZammadFetch(`${ZAMMAD_BASE}/api/v1/users/me`, {
      headers: { Authorization: `Token token=${token}` }
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as {
      id: number
      firstname: string
      lastname: string
      email: string
      login: string
      image?: string | null
    }
    return {
      id: data.id,
      email: data.email,
      login: data.login,
      firstname: data.firstname,
      lastname: data.lastname,
      image: data.image ?? null,
      avatarDataUrl: await fetchZammadAvatarDataUrl(token, data.image)
    }
  } catch (err) {
    logger.warn('Zammad user fetch failed:', err)
    return null
  }
}

async function fetchZammadAvatarDataUrl(token: string, imageHash?: string | null): Promise<string | null> {
  if (!imageHash) return null

  try {
    const resp = await cleanZammadFetch(`${ZAMMAD_BASE}/api/v1/users/image/${encodeURIComponent(imageHash)}`, {
      headers: { Authorization: `Token token=${token}` }
    })
    if (!resp.ok) return null

    const contentType = resp.headers.get('content-type') || 'image/png'
    if (!contentType.startsWith('image/')) return null

    const bytes = Buffer.from(await resp.arrayBuffer())
    return `data:${contentType};base64,${bytes.toString('base64')}`
  } catch (err) {
    logger.warn('Zammad avatar fetch failed:', err)
    return null
  }
}

async function updateZammadAvatar(avatarDataUrl: string): Promise<AppUser> {
  const stored = readStored()
  const token = stored.zammadToken
  if (!token) throw new Error('Zammad токен не задан')
  if (!avatarDataUrl.startsWith('data:image/')) {
    throw new Error('Выберите файл изображения')
  }

  const resp = await cleanZammadFetch(`${ZAMMAD_BASE}/api/v1/users/avatar`, {
    method: 'POST',
    headers: {
      Authorization: `Token token=${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      avatar_full: avatarDataUrl,
      avatar_resize: avatarDataUrl
    })
  })

  if (!resp.ok) {
    let message = 'Не удалось обновить аватар'
    try {
      const payload = await resp.json() as { error?: string; message?: string }
      message = payload.error || payload.message || message
    } catch {}
    throw new Error(message)
  }

  const user = await fetchZammadUser(token)
  if (!user) throw new Error('Аватар обновлён, но профиль Zammad не загрузился')

  writeStored({ ...readStored(), userJson: JSON.stringify(user) })
  return user
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppUser {
  id?: number
  email: string
  login: string
  firstname: string
  lastname: string
  image?: string | null
  avatarDataUrl?: string | null
}

// ---------------------------------------------------------------------------
export function setupAuthIpc(): void {
  ipcMain.handle('auth:login', async (_event, email: string, password: string) => {
    logger.info('Login attempt:', email)

    const user = await loginWrapper(email, password)

    const stored = readStored()
    let finalUser = user
    if (stored.zammadToken) {
      const zUser = await fetchZammadUser(stored.zammadToken)
      if (zUser) finalUser = zUser
    }

    writeStored({
      ...stored,
      userJson: JSON.stringify(finalUser),
      savedEmail: email,
      savedPassword: password
    })
    logger.info('Login OK:', finalUser.email)
    return { user: finalUser, zammadTokenSet: !!stored.zammadToken }
  })

  ipcMain.handle('auth:restore', async () => {
    let alive = await isWrapperSessionAlive()
    const stored = readStored()

    if (!alive && stored.savedEmail && stored.savedPassword) {
      try {
        logger.info('Session not alive, attempting auto-login using saved credentials...')
        await loginWrapper(stored.savedEmail, stored.savedPassword)
        alive = true
      } catch (err) {
        logger.warn('Auto-login failed:', err)
      }
    }

    if (!alive) return null
    if (!stored.userJson) return null

    let user = JSON.parse(stored.userJson) as AppUser

    if (stored.zammadToken) {
      const zUser = await fetchZammadUser(stored.zammadToken)
      if (zUser) {
        user = zUser
        writeStored({ ...stored, userJson: JSON.stringify(user) })
      }
    }

    return { user, zammadTokenSet: !!stored.zammadToken }
  })

  ipcMain.handle('auth:logout', async () => {
    await wrapperSession().clearStorageData({ storages: ['cookies'] })
    writeStored({})
    logger.info('Logged out')
  })

  ipcMain.handle('auth:setZammadToken', async (_event, token: string) => {
    const zUser = await fetchZammadUser(token)
    if (!zUser) throw new Error('Токен невалидный или нет доступа к Zammad')

    const stored = readStored()
    writeStored({ ...stored, zammadToken: token, userJson: JSON.stringify(zUser) })
    logger.info('Zammad token saved for:', zUser.email)
    return zUser
  })

  ipcMain.handle('auth:updateAvatar', async (_event, avatarDataUrl: string) => {
    return updateZammadAvatar(avatarDataUrl)
  })

  ipcMain.handle('auth:getClientProfileSettings', async () => {
    return getClientProfileSettings()
  })

  ipcMain.handle('auth:updateClientProfileSettings', async (_event, patch: ClientProfileSettingsPatch) => {
    return updateClientProfileSettings(patch)
  })

  ipcMain.handle('auth:hasZammadToken', () => !!readStored().zammadToken)
}
