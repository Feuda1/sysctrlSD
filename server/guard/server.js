// sd-guard: онлайн-статус, бан/кик, плюс три вещи для удобства - кто ещё
// смотрит ту же заявку, рассылка от админа и личные настройки, которые
// следуют за аккаунтом, а не остаются на одном компьютере. Всё это только
// наш собственный сервис - ничего из этого не трогает сам Zammad и не ходит
// в его API. Никакой базы данных: десяток пользователей, один JSON-файл с
// атомарной записью (пишем во временный файл и переименовываем поверх
// основного - так частичная запись при падении процесса никогда не оставит
// файл битым).
'use strict'

const express = require('express')
const fs = require('node:fs')
const path = require('node:path')

const PORT = Number(process.env.PORT || 8010)
const APP_SHARED_KEY = process.env.APP_SHARED_KEY || ''
const ADMIN_USER_IDS = new Set(
  String(process.env.ADMIN_ZAMMAD_USER_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
)

if (!APP_SHARED_KEY) {
  console.error('APP_SHARED_KEY не задан в .env - без него любой мог бы слать heartbeat от чужого имени.')
  process.exit(1)
}

const DATA_DIR = path.join(__dirname, 'data')
const STATE_PATH = path.join(DATA_DIR, 'state.json')

// Пять минут без heartbeat - человек закрыл приложение или у него легла сеть;
// heartbeat шлётся каждые 25 секунд, так что пропуск в разы больше нормального
// интервала уже значит "не онлайн", а не "просто редкий тик".
const ONLINE_WINDOW_MS = 5 * 60 * 1000

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'))
  } catch {
    return { users: {} }
  }
}

let state = loadState()

function saveState() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const tmp = STATE_PATH + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2))
  fs.renameSync(tmp, STATE_PATH)
}

function requireAppKey(req, res, next) {
  if (req.get('X-App-Key') !== APP_SHARED_KEY) {
    return res.status(401).json({ error: 'bad app key' })
  }
  next()
}

function requireAdmin(req, res, next) {
  const callerId = req.get('X-User-Id')
  if (!callerId || !ADMIN_USER_IDS.has(String(callerId))) {
    return res.status(403).json({ error: 'not an admin' })
  }
  next()
}

const app = express()
app.use(express.json())

// Инициалы для маленького кружка-аватарки - своей картинки у guard-сервера
// нет, и гонять base64-аватар в каждом heartbeat было бы накладно.
function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// Каждый клиент бьёт сюда раз в 25 секунд (или сразу, если у него реально
// что-то изменилось - см. controlPlane.ts). Ответ - разрешение работать
// дальше или сигнал, что пора выйти (забанен насовсем или кикнут один раз).
app.post('/api/heartbeat', requireAppKey, (req, res) => {
  const { userId, email, name, requestsLastMinute, viewing } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const id = String(userId)
  const existing = state.users[id] || {}
  const kicked = !!existing.kickAt && (!existing.kickAcknowledgedAt || existing.kickAt > existing.kickAcknowledgedAt)
  const myViewing = Array.isArray(viewing)
    ? viewing.filter(v => v && Number.isFinite(v.ticketId) && (v.activity === 'viewing' || v.activity === 'typing'))
    : []

  state.users[id] = {
    ...existing,
    email: email || existing.email || '',
    name: name || existing.name || '',
    lastSeen: Date.now(),
    requestsLastMinute: Number.isFinite(requestsLastMinute) ? requestsLastMinute : 0,
    viewing: myViewing,
    ...(kicked ? { kickAcknowledgedAt: Date.now() } : {})
  }
  saveState()

  // Кто ещё (реально онлайн, не просто когда-то был) сейчас смотрит те же
  // заявки, что и я, и что каждый из них там делает - только по тем id,
  // что я сам только что прислал.
  const coViewers = {}
  if (myViewing.length > 0) {
    const myTicketIds = myViewing.map(v => v.ticketId)
    const now = Date.now()
    for (const [otherId, u] of Object.entries(state.users)) {
      if (otherId === id) continue
      if (!u.lastSeen || (now - u.lastSeen) > ONLINE_WINDOW_MS) continue
      for (const v of (u.viewing || [])) {
        if (!myTicketIds.includes(v.ticketId)) continue
        const key = String(v.ticketId)
        ;(coViewers[key] = coViewers[key] || []).push({
          name: u.name || 'Коллега',
          initials: initialsOf(u.name),
          activity: v.activity
        })
      }
    }
  }

  res.json({ banned: !!existing.banned, kicked, coViewers, broadcast: state.broadcast || null })
})

// Список для админ-экрана: кто есть в базе, когда последний раз стучался,
// онлайн ли сейчас, забанен ли, сколько запросов к Zammad шлёт. Нагрузка
// в запросах/минуту берётся только у тех, кто реально онлайн - у остальных
// это число просто устарело и ничего не значит.
app.get('/api/admin/users', requireAppKey, requireAdmin, (_req, res) => {
  const now = Date.now()
  const users = Object.entries(state.users).map(([id, u]) => {
    const online = !!u.lastSeen && (now - u.lastSeen) < ONLINE_WINDOW_MS
    return {
      id,
      email: u.email || '',
      name: u.name || '',
      lastSeen: u.lastSeen || null,
      online,
      banned: !!u.banned,
      requestsLastMinute: online ? (u.requestsLastMinute || 0) : 0
    }
  })
  users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
  const totalRequestsLastMinute = users.reduce((sum, u) => sum + u.requestsLastMinute, 0)
  res.json({ users, totalRequestsLastMinute, broadcast: state.broadcast || null })
})

function setBanned(userId, banned) {
  const id = String(userId)
  state.users[id] = { ...(state.users[id] || {}), banned }
  saveState()
}

app.post('/api/admin/ban', requireAppKey, requireAdmin, (req, res) => {
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  setBanned(userId, true)
  res.json({ ok: true })
})

app.post('/api/admin/unban', requireAppKey, requireAdmin, (req, res) => {
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  setBanned(userId, false)
  res.json({ ok: true })
})

// Кик - разовый: следующий heartbeat этого человека вернёт kicked:true один
// раз (kickAcknowledgedAt в heartbeat это фиксирует), после чего он снова
// может зайти как обычно - в отличие от бана, ничего постоянного не остаётся.
app.post('/api/admin/kick', requireAppKey, requireAdmin, (req, res) => {
  const { userId } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })
  const id = String(userId)
  state.users[id] = { ...(state.users[id] || {}), kickAt: Date.now(), kickAcknowledgedAt: null }
  saveState()
  res.json({ ok: true })
})

// Одно активное сообщение сразу всем - каждый клиент получает его следующим
// heartbeat (то есть в пределах ~25 секунд) и показывает, если ещё не видел
// именно это id. Второй broadcast молча заменяет первый - это не очередь.
app.post('/api/admin/broadcast', requireAppKey, requireAdmin, (req, res) => {
  const message = String(req.body?.message || '').trim()
  if (!message) return res.status(400).json({ error: 'message required' })
  state.broadcast = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, message, sentAt: Date.now() }
  saveState()
  res.json({ ok: true, broadcast: state.broadcast })
})

app.post('/api/admin/broadcast/clear', requireAppKey, requireAdmin, (_req, res) => {
  state.broadcast = null
  saveState()
  res.json({ ok: true })
})

// Личные настройки интерфейса - привязаны к аккаунту, а не к компьютеру.
// Каждый читает и пишет только свои: границу задаёт сам X-User-Id, отдельного
// разрешения на "не админ" не нужно - это не про модерацию.
app.get('/api/settings', requireAppKey, (req, res) => {
  const id = String(req.get('X-User-Id') || '')
  if (!id) return res.status(400).json({ error: 'X-User-Id required' })
  res.json({ settings: state.users[id]?.settings || null })
})

app.post('/api/settings', requireAppKey, (req, res) => {
  const id = String(req.get('X-User-Id') || '')
  if (!id) return res.status(400).json({ error: 'X-User-Id required' })
  const settings = req.body?.settings
  if (!settings || typeof settings !== 'object') return res.status(400).json({ error: 'settings required' })
  state.users[id] = { ...(state.users[id] || {}), settings }
  saveState()
  res.json({ ok: true })
})

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, '127.0.0.1', () => {
  console.log(`sd-guard listening on 127.0.0.1:${PORT}`)
})
