import { describe, expect, it } from 'vitest'
import {
  formatAttachmentSize,
  getArticleTypeLabel,
  getAttachmentKind,
  getAutoArticleType,
  getPriorityOrder,
  historyActorInitials,
  isReasonRequiredState,
  officeKind,
  toHtmlComment
} from '../src/renderer/src/lib/ticketFormat'

describe('toHtmlComment', () => {
  it('turns line breaks into <br>', () => {
    // Zammad strips the style attribute, so pre-wrap alone lost every break and
    // the comment arrived as a single line.
    expect(toHtmlComment('раз\nдва')).toBe('<div>раз<br>два</div>')
    expect(toHtmlComment('раз\r\nдва')).toBe('<div>раз<br>два</div>')
  })

  it('escapes markup', () => {
    expect(toHtmlComment('<b>&"')).toBe('<div>&lt;b&gt;&amp;&quot;</div>')
  })

  it('is empty for blank input', () => {
    expect(toHtmlComment('   ')).toBe('')
  })
})

describe('attachments', () => {
  it('classifies by mime type and by extension', () => {
    expect(getAttachmentKind({ filename: 'a.png', mimeType: 'image/png' })).toBe('image')
    expect(getAttachmentKind({ filename: 'log.txt', mimeType: 'application/octet-stream' })).toBe('text')
    expect(getAttachmentKind({ filename: 'arc.7z', mimeType: 'application/x-7z-compressed' })).toBe('archive')
    expect(getAttachmentKind({ filename: 'doc.bin', mimeType: 'application/octet-stream' })).toBe('file')
  })

  it('formats sizes and hides empty ones', () => {
    expect(formatAttachmentSize(2048)).toBe('2 КБ')
    expect(formatAttachmentSize(5 * 1024 * 1024)).toBe('5.0 МБ')
    expect(formatAttachmentSize(0)).toBe('')
  })

  it('knows office files', () => {
    expect(officeKind('смета.xlsx')).toBe('excel')
    expect(officeKind('акт.docx')).toBe('word')
    expect(officeKind('image.png')).toBeNull()
  })
})

describe('article types', () => {
  it('picks the type from the ticket channel', () => {
    expect(getAutoArticleType('Email')).toBe('note')
    expect(getAutoArticleType('Телефонный звонок / phone')).toBe('phone')
    expect(getAutoArticleType('telegram')).toBe('fax')
    expect(getAutoArticleType(null)).toBe('note')
  })

  it('labels every known type', () => {
    expect(getArticleTypeLabel('email')).toBe('E-mail')
    expect(getArticleTypeLabel('fax')).toBe('Telegram-bot')
    expect(getArticleTypeLabel('whatever')).toBe('Заметка')
  })
})

describe('states and priorities', () => {
  it('requires a reason when closing', () => {
    expect(isReasonRequiredState('Закрыта')).toBe(true)
    expect(isReasonRequiredState('В ожидании закрытия')).toBe(true)
    expect(isReasonRequiredState('Открыта')).toBe(false)
  })

  it('orders priorities by meaning, not by id alone', () => {
    expect(getPriorityOrder({ id: 1, name: 'Низкий' })).toBe(1)
    expect(getPriorityOrder({ id: 2, name: 'Обычный' })).toBe(2)
    expect(getPriorityOrder({ id: 3, name: 'Высокий' })).toBe(3)
  })
})

describe('history', () => {
  it('builds initials from a name', () => {
    expect(historyActorInitials('Иван Глущенко')).toBe('ИГ')
    expect(historyActorInitials('Система')).toBe('СИ')
    expect(historyActorInitials('   ')).toBe('?')
  })
})
