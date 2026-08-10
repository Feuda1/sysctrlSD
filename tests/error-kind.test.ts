import { describe, expect, it } from 'vitest'
import { describeError } from '../src/renderer/src/lib/errorKind'

describe('describeError', () => {
  it('называет пропавшую сеть, когда браузер знает об этом', () => {
    const result = describeError(new Error('Ошибка загрузки'), 'Ошибка', false)
    expect(result.kind).toBe('offline')
    expect(result.canRetry).toBe(true)
  })

  it('узнаёт обрыв соединения по сообщению Chromium', () => {
    expect(describeError(new Error('net::ERR_INTERNET_DISCONNECTED'), 'Ошибка').kind).toBe('offline')
    expect(describeError(new Error('net::ERR_CONNECTION_REFUSED'), 'Ошибка').kind).toBe('network')
  })

  it('отличает недоступный сервер от испорченных данных', () => {
    expect(describeError(new Error('fetch failed'), 'Ошибка').kind).toBe('network')
    expect(describeError(new Error('Не удалось разобрать ответ'), 'Ошибка').kind).toBe('data')
  })

  it('не предлагает повтор там, где он не поможет', () => {
    const denied = describeError(new Error('Нет доступа (403). Проверьте Zammad API ключ в настройках.'), 'Ошибка')
    expect(denied.kind).toBe('auth')
    expect(denied.canRetry).toBe(false)
  })

  it('считает 5xx временным сбоем сервера', () => {
    const result = describeError(new Error('Сервер не ответил вовремя (503)'), 'Ошибка')
    expect(result.kind).toBe('server')
    expect(result.canRetry).toBe(true)
  })

  it('показывает человеческое сообщение как есть и не дублирует его', () => {
    const result = describeError(new Error('Вложение слишком большое'), 'Ошибка')
    expect(result.title).toBe('Вложение слишком большое')
    expect(result.detail).toBe('')
  })

  it('берёт запасной текст, когда у ошибки нет сообщения', () => {
    expect(describeError(undefined, 'Ошибка загрузки заявок').title).toBe('Ошибка загрузки заявок')
    expect(describeError({}, 'Ошибка загрузки заявок').title).toBe('Ошибка загрузки заявок')
  })
})
