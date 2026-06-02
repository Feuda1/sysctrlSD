import { ipcMain, net, session, app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import log from 'electron-log/main'

const WRAPPER_BASE = 'https://clients.denvic.ru'
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

function stripTags(val: string): string {
  return decodeHtml(val).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function getCachePath(): string {
  const dir = join(app.getPath('userData'), 'cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'forms.json')
}

interface CacheData {
  [uuid: string]: number
}

function readCache(): CacheData {
  try {
    const path = getCachePath()
    if (!existsSync(path)) return {}
    return JSON.parse(readFileSync(path, 'utf-8')) as CacheData
  } catch {
    return {}
  }
}

function writeCache(data: CacheData): void {
  try {
    writeFileSync(getCachePath(), JSON.stringify(data), 'utf-8')
  } catch (err) {
    log.error('Failed to write forms cache:', err)
  }
}

export function setupFormsIpc(): void {
  ipcMain.handle('forms:list', async () => {
    log.info('Fetching forms list from clients.denvic.ru...')
    const resp = await net.fetch(`${WRAPPER_BASE}/Users/Profile`, { session: wrapperSession() } as any)
    if (!resp.ok) throw new Error(`Не удалось загрузить страницу для парсинга форм: ${resp.status}`)
    const html = await resp.text()

    const cache = readCache()
    let cacheUpdated = false

    const categoriesMap: { [name: string]: { id: number; name: string }[] } = {
      'Работа с ККТ': [],
      'Выезд': [],
      'Формы': [],
      'Перевод задач': []
    }

    const blockRegex = /<a[^>]*data-bs-toggle="collapse"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<div[^>]*class="collapse[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
    const blocks = Array.from(html.matchAll(blockRegex))

    for (const block of blocks) {
      const catName = stripTags(block[1]).trim()
      if (!categoriesMap[catName]) continue

      const linkRegex = /<a[^>]*href="\/AdditionalPage\/Index\/([a-f0-9\-]+)"[^>]*>([\s\S]*?)<\/a>/gi
      const links = Array.from(block[2].matchAll(linkRegex))

      for (const link of links) {
        const uuid = link[1]
        const name = stripTags(link[2]).trim()

        if (name.toLowerCase().includes('разработке')) continue

        let pyrusFormId = cache[uuid]

        if (!pyrusFormId) {
          try {
            log.info(`Fetching Pyrus form ID for ${name} (${uuid})...`)
            const pageResp = await net.fetch(`${WRAPPER_BASE}/AdditionalPage/Index/${uuid}`, { session: wrapperSession() } as any)
            if (pageResp.ok) {
              const pageHtml = await pageResp.text()
              const idMatch = pageHtml.match(/externalformstarter[^\n]*?id=(\d+)/i) || pageHtml.match(/pyrus\.com\/form\/(\d+)/i)
              if (idMatch) {
                pyrusFormId = parseInt(idMatch[1], 10)
                cache[uuid] = pyrusFormId
                cacheUpdated = true
                log.info(`Found Pyrus form ID: ${pyrusFormId} for ${name}`)
              }
            }
          } catch (err) {
            log.error(`Failed to fetch Pyrus form ID for ${uuid}:`, err)
          }
        }

        if (pyrusFormId) {
          categoriesMap[catName].push({ id: pyrusFormId, name })
        }
      }
    }

    if (cacheUpdated) {
      writeCache(cache)
    }

    return Object.keys(categoriesMap).map(name => ({
      name,
      forms: categoriesMap[name]
    }))
  })
}
