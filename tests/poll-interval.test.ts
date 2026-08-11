import { describe, expect, it } from 'vitest'
import { backoffInterval, POLL_BASE_MS, POLL_MAX_MS } from '../src/renderer/src/lib/pollInterval'

describe('backoffInterval', () => {
  it('пока всё хорошо, опрашивает с обычной частотой', () => {
    expect(backoffInterval(0)).toBe(POLL_BASE_MS)
  })

  it('удваивает паузу с каждой неудачей подряд', () => {
    expect(backoffInterval(1)).toBe(POLL_BASE_MS * 2)
    expect(backoffInterval(2)).toBe(POLL_BASE_MS * 4)
  })

  it('дальше минуты не отступает — иначе не заметит, что сервер ожил', () => {
    expect(backoffInterval(10)).toBe(POLL_MAX_MS)
    expect(backoffInterval(1000)).toBe(POLL_MAX_MS)
  })

  it('не спотыкается об отрицательное значение', () => {
    expect(backoffInterval(-1)).toBe(POLL_BASE_MS)
  })
})
