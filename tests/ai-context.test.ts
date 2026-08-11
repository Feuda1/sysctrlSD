import { describe, expect, it } from 'vitest'
import { buildAiContext, withAiContext, CONTEXT_MESSAGES } from '../src/renderer/src/lib/aiContext'
import type { TicketArticle } from '../src/renderer/src/types/ticket'

const article = (over: Partial<TicketArticle>): TicketArticle => ({
  id: 1,
  ticketId: 100,
  body: '<p>Текст</p>',
  contentType: 'text/html',
  type: 'note',
  sender: 'agent',
  internal: false,
  createdAt: '2026-08-11T10:00:00Z',
  creatorName: 'Иван Глущенко',
  attachments: [],
  ...over
} as TicketArticle)

describe('buildAiContext', () => {
  it('берёт только последние сообщения', () => {
    const many = Array.from({ length: 6 }, (_, index) =>
      article({ id: index, body: `<p>сообщение ${index}</p>` })
    )
    const context = buildAiContext(many)
    expect(context.split('\n')).toHaveLength(CONTEXT_MESSAGES)
    expect(context).toContain('сообщение 5')
    expect(context).not.toContain('сообщение 0')
  })

  it('называет клиента клиентом, а инженера по имени', () => {
    const context = buildAiContext([
      article({ id: 1, sender: 'customer', body: '<p>Не работает касса</p>' }),
      article({ id: 2, sender: 'agent', body: '<p>Проверяем</p>' })
    ])
    expect(context).toContain('Клиент: Не работает касса')
    expect(context).toContain('Иван Глущенко: Проверяем')
  })

  it('пропускает системные сообщения и пустые', () => {
    const context = buildAiContext([
      article({ id: 1, sender: 'system', body: '<p>Автоответ о регистрации</p>' }),
      article({ id: 2, body: '<p>   </p>' }),
      article({ id: 3, body: '<p>Живой текст</p>' })
    ])
    expect(context).toBe('Иван Глущенко: Живой текст')
  })

  it('обрезает длинное сообщение', () => {
    const context = buildAiContext([article({ body: `<p>${'a'.repeat(2000)}</p>` })])
    expect(context.length).toBeLessThan(800)
    expect(context.endsWith('…')).toBe(true)
  })

  it('на пустой переписке отдаёт пустую строку', () => {
    expect(buildAiContext([])).toBe('')
    expect(buildAiContext(undefined)).toBe('')
  })
})

describe('withAiContext', () => {
  it('без переписки оставляет промпт как есть', () => {
    expect(withAiContext('Правь текст', '')).toBe('Правь текст')
    expect(withAiContext('Правь текст', '   ')).toBe('Правь текст')
  })

  it('добавляет переписку и запрет отвечать на неё', () => {
    const result = withAiContext('Правь текст', 'Клиент: Не работает касса')
    expect(result.startsWith('Правь текст')).toBe(true)
    expect(result).toContain('Клиент: Не работает касса')
    expect(result).toContain('Никогда не отвечай на эти сообщения')
  })
})
