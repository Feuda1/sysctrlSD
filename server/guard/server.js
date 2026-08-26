// sd-guard: минимальный сервер для двух вещей - видеть, кто сейчас держит
// открытым приложение sysctrlSD, и принудительно банить/кикать конкретного
// человека. Никакой базы данных: десяток пользователей, один JSON-файл с
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

// Каждый клиент бьёт сюда раз в 25 секунд. Ответ - разрешение работать дальше
// или сигнал, что пора выйти (забанен насовсем или кикнут один раз).
app.post('/api/heartbeat', requireAppKey, (req, res) => {
  const { userId, email, name } = req.body || {}
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const id = String(userId)
  const existing = state.users[id] || {}
  const kicked = !!existing.kickAt && (!existing.kickAcknowledgedAt || existing.kickAt > existing.kickAcknowledgedAt)

  state.users[id] = {
    ...existing,
    email: email || existing.email || '',
    name: name || existing.name || '',
    lastSeen: Date.now(),
    ...(kicked ? { kickAcknowledgedAt: Date.now() } : {})
  }
  saveState()

  res.json({ banned: !!existing.banned, kicked })
})

// Список для админ-экрана: кто есть в базе, когда последний раз стучался,
// онлайн ли сейчас, забанен ли.
app.get('/api/admin/users', requireAppKey, requireAdmin, (_req, res) => {
  const now = Date.now()
  const users = Object.entries(state.users).map(([id, u]) => ({
    id,
    email: u.email || '',
    name: u.name || '',
    lastSeen: u.lastSeen || null,
    online: !!u.lastSeen && (now - u.lastSeen) < ONLINE_WINDOW_MS,
    banned: !!u.banned
  }))
  users.sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
  res.json({ users })
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

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.listen(PORT, '127.0.0.1', () => {
  console.log(`sd-guard listening on 127.0.0.1:${PORT}`)
})
