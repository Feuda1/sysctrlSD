import { BrowserWindow, dialog } from 'electron'
import { writeFileSync } from 'fs'
import logger from 'electron-log/main'
import { createZip, type ZipEntry } from './zip'
import {
  attachmentIdFromSrc,
  extensionForMime,
  formatDateTime,
  htmlToMarkdown,
  humanSize,
  sanitizeFilename
} from './export/markdown'
import { fetchTicketDetailsForExport, fetchTicketArticlesForExport, fetchTicketAttachmentForExport } from './ipc/tickets'

export interface TicketExportOptions {
  text: boolean
  images: boolean
  files: boolean
}

export interface TicketExportResult {
  ok: boolean
  canceled?: boolean
  path?: string
  savedImages?: number
  savedFiles?: number
}

interface SavedAttachment {
  /** Path inside the archive, empty when the attachment was not exported. */
  path: string
  filename: string
  isImage: boolean
  size: number
  exported: boolean
}

export async function exportTicket(
  ticketId: number,
  options: TicketExportOptions
): Promise<TicketExportResult> {
  if (!options.text && !options.images && !options.files) {
    throw new Error('Выберите хотя бы одно: текст, изображения или файлы')
  }

  const details = await fetchTicketDetailsForExport(ticketId)
  const articles = await fetchTicketArticlesForExport(ticketId)
  const ticket = details.ticket

  const entries: ZipEntry[] = []
  const usedNames = new Set<string>()
  let savedImages = 0
  let savedFiles = 0

  const uniquePath = (folder: string, filename: string): string => {
    const dot = filename.lastIndexOf('.')
    const base = dot > 0 ? filename.slice(0, dot) : filename
    const ext = dot > 0 ? filename.slice(dot) : ''
    let candidate = `${folder}/${base}${ext}`
    let counter = 2
    while (usedNames.has(candidate.toLowerCase())) {
      candidate = `${folder}/${base} (${counter})${ext}`
      counter += 1
    }
    usedNames.add(candidate.toLowerCase())
    return candidate
  }

  // Attachment bytes are fetched once per attachment and reused: the same file
  // can be both listed at the end of a message and shown inline in its text.
  const savedByAttachmentId = new Map<number, SavedAttachment>()

  const saveAttachment = async (articleId: number, attachment: any, index: number): Promise<SavedAttachment> => {
    const cached = savedByAttachmentId.get(attachment.id)
    if (cached) return cached

    const mime = String(attachment.mimeType || '').toLowerCase()
    const filename = sanitizeFilename(attachment.filename || `attachment-${attachment.id}`)
    const isImage = mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename)
    const wanted = isImage ? options.images : options.files

    let saved: SavedAttachment = { path: '', filename, isImage, size: Number(attachment.size) || 0, exported: false }

    if (wanted) {
      try {
        const { dataUrl } = await fetchTicketAttachmentForExport(ticketId, articleId, attachment.id)
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
        const data = Buffer.from(base64, 'base64')
        const numbered = `${String(index).padStart(2, '0')}-${filename}`
        const path = uniquePath(isImage ? 'images' : 'files', numbered)
        entries.push({ path, data })
        if (isImage) savedImages += 1
        else savedFiles += 1
        saved = { path, filename, isImage, size: data.length, exported: true }
      } catch (err) {
        logger.warn(`Не удалось выгрузить вложение ${attachment.id} заявки ${ticketId}:`, err)
      }
    }

    savedByAttachmentId.set(attachment.id, saved)
    return saved
  }

  const lines: string[] = []
  const ticketNumber = ticket.clientNumber || ticket.number || String(ticket.id)
  const customerName = [details.customer?.firstname, details.customer?.lastname].filter(Boolean).join(' ').trim()

  lines.push(`# Заявка №${ticketNumber} - ${ticket.title || 'без темы'}`, '')
  const meta: [string, string][] = [
    ['ID в Zammad', String(ticket.id)],
    ['Номер clients', ticket.clientNumber ? String(ticket.clientNumber) : ''],
    ['Клиент', customerName],
    ['Организация', ticket.organization?.name || details.organization?.name || ''],
    ['Телефон', details.customer?.phone || details.customer?.mobile || ''],
    ['Состояние', ticket.state?.name || ''],
    ['Тип', ticket.ticketType?.name || ''],
    ['Приоритет', ticket.priority?.name || ''],
    ['Группа', ticket.group?.name || ''],
    ['Ответственный', ticket.owner?.name || ''],
    ['Теги', (ticket.tags ?? []).map((tag: any) => tag.name).join(', ')],
    ['Причины обращения', (ticket.iikoReasons ?? []).map((reason: any) => reason.name).join(', ')],
    ['Создана', formatDateTime(ticket.createdAt)],
    ['Обновлена', formatDateTime(ticket.updatedAt)],
    ['Учтённое время', ticket.accountedTime ? `${ticket.accountedTime} мин` : '']
  ]
  for (const [label, value] of meta) {
    if (value) lines.push(`- **${label}:** ${value}`)
  }
  lines.push('', `Сообщений: ${articles.length}`, '', '---', '')

  for (let index = 0; index < articles.length; index += 1) {
    const article = articles[index]
    const number = index + 1
    const attachments: any[] = Array.isArray(article.attachments) ? article.attachments : []

    // Saved before the body is converted so inline images can point at real files.
    const savedForArticle: SavedAttachment[] = []
    for (const attachment of attachments) {
      savedForArticle.push(await saveAttachment(article.id, attachment, number))
    }

    const inlineImages: string[] = []
    const resolveImage = (src: string, alt: string): string => {
      const attachmentId = attachmentIdFromSrc(src)
      const saved = attachmentId ? savedByAttachmentId.get(attachmentId) : undefined
      if (saved?.exported) {
        inlineImages.push(saved.path)
        return `![${saved.filename}](${saved.path})`
      }

      if (src.startsWith('data:image/') && options.images) {
        try {
          const mime = src.slice(5, src.indexOf(';'))
          const data = Buffer.from(src.slice(src.indexOf(',') + 1), 'base64')
          const path = uniquePath('images', `${String(number).padStart(2, '0')}-встроенное.${extensionForMime(mime)}`)
          entries.push({ path, data })
          savedImages += 1
          inlineImages.push(path)
          return `![${alt || 'изображение'}](${path})`
        } catch (err) {
          logger.warn('Не удалось сохранить встроенное изображение:', err)
        }
      }

      const label = alt || saved?.filename || 'изображение'
      return `_[${label} - изображение не выгружено]_`
    }

    const sender = article.internal ? 'внутренняя заметка' : (article.sender === 'customer' ? 'от клиента' : 'от сотрудника')
    lines.push(`## Сообщение ${number} - ${article.creatorName || 'Неизвестно'}`)
    lines.push(`*${formatDateTime(article.createdAt)} · ${sender}*`, '')

    const body = htmlToMarkdown(article.body || '', resolveImage)
    lines.push(body || '_(пустое сообщение)_', '')

    // Only the files that were not already shown inline, so the list stays a
    // list of attachments rather than a repetition of the message.
    const listed = savedForArticle.filter(saved => !(saved.path && inlineImages.includes(saved.path)))
    if (listed.length > 0) {
      lines.push('**Вложения:**')
      for (const saved of listed) {
        const size = humanSize(saved.size)
        const kind = saved.isImage ? 'изображение' : 'файл'
        lines.push(saved.exported
          ? `- [${saved.filename}](${saved.path}) - ${kind}${size ? `, ${size}` : ''}`
          : `- ${saved.filename} - ${kind}${size ? `, ${size}` : ''} (не выгружен)`)
      }
      lines.push('')
    }

    if (article.callRecordUrl || article.callRecordId) {
      lines.push('_К сообщению приложена запись разговора (в выгрузку не входит)._', '')
    }

    lines.push('---', '')
  }

  const markdown = lines.join('\n')
  const baseName = sanitizeFilename(`Заявка ${ticketNumber} - ${ticket.title || ''}`.trim())
  // Plain .md when the export is text and nothing else - an archive around a
  // single file would only get in the way.
  const asZip = entries.length > 0

  if (options.text) {
    entries.unshift({ path: 'заявка.md', data: Buffer.from(markdown, 'utf8') })
  }

  if (entries.length === 0) {
    throw new Error('Выгружать нечего: в заявке нет вложений выбранных типов')
  }

  const dialogOptions = {
    title: 'Сохранить выгрузку заявки',
    defaultPath: asZip ? `${baseName}.zip` : `${baseName}.md`,
    filters: asZip
      ? [{ name: 'Архив ZIP', extensions: ['zip'] }]
      : [{ name: 'Markdown', extensions: ['md'] }]
  }
  // Диалог обязан знать своё окно. Без него Windows отдаёт владение временному
  // окну, которое закрывается раньше диалога, и после сохранения приложение
  // перестаёт принимать клики целиком - помогает только перезапуск.
  const owner = BrowserWindow.getFocusedWindow()
    ?? BrowserWindow.getAllWindows().find(win => !win.isDestroyed() && win.isVisible())
    ?? null

  let saveResult: Electron.SaveDialogReturnValue
  try {
    saveResult = owner
      ? await dialog.showSaveDialog(owner, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions)
  } finally {
    // Страховка на случай, если окно осталось выключенным: без неё оно выглядит
    // рабочим, но не реагирует ни на что.
    if (owner && !owner.isDestroyed()) {
      owner.setEnabled(true)
      owner.focus()
    }
  }

  if (saveResult.canceled || !saveResult.filePath) {
    return { ok: false, canceled: true }
  }

  const target = saveResult.filePath
  if (asZip) {
    writeFileSync(target, createZip(entries))
  } else {
    writeFileSync(target, markdown, 'utf8')
  }

  logger.info('Выгрузка заявки сохранена:', { ticketId, target, savedImages, savedFiles })
  return { ok: true, path: target, savedImages, savedFiles }
}
