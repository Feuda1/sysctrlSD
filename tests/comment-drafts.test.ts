import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCommentDraft, readCommentDraft, writeCommentDraft } from '../src/renderer/src/lib/commentDrafts'

// A tiny stand-in for localStorage: the module only needs get/set/remove.
const store = new Map<string, string>()
vi.stubGlobal('window', {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) }
  }
})

beforeEach(() => store.clear())

describe('comment drafts', () => {
  it('gives back what was written for that ticket', () => {
    writeCommentDraft(616943, 'половина ответа')
    expect(readCommentDraft(616943)).toBe('половина ответа')
    expect(readCommentDraft(616944)).toBe('')
  })

  it('forgets a draft that became empty', () => {
    writeCommentDraft(1, 'текст')
    writeCommentDraft(1, '   ')
    expect(readCommentDraft(1)).toBe('')
  })

  it('is cleared explicitly once the comment is sent', () => {
    writeCommentDraft(1, 'текст')
    clearCommentDraft(1)
    expect(readCommentDraft(1)).toBe('')
  })

  it('drops a draft older than a month', () => {
    const monthAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
    store.set('ticket.draft.1', JSON.stringify({ body: 'древний', at: monthAgo }))
    expect(readCommentDraft(1)).toBe('')
    expect(store.has('ticket.draft.1')).toBe(false)
  })

  it('survives broken storage content', () => {
    store.set('ticket.draft.1', 'не json')
    expect(readCommentDraft(1)).toBe('')
  })
})
