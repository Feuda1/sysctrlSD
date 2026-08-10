import { describe, expect, it } from 'vitest'
import {
  attachmentIdFromSrc,
  extensionForMime,
  htmlToMarkdown,
  humanSize,
  sanitizeFilename
} from '../electron/main/export/markdown'

/** Inline images are replaced by whatever the caller resolved them to. */
const keepImages = (src: string, alt: string) => `![${alt || 'изображение'}](${src})`

describe('htmlToMarkdown', () => {
  it('keeps line breaks and paragraphs', () => {
    expect(htmlToMarkdown('<p>раз</p><p>два</p>', keepImages)).toBe('раз\n\nдва')
    expect(htmlToMarkdown('раз<br>два', keepImages)).toBe('раз\nдва')
  })

  it('converts links, emphasis and lists', () => {
    expect(htmlToMarkdown('<a href="https://x.ru">сайт</a>', keepImages)).toBe('[сайт](https://x.ru)')
    expect(htmlToMarkdown('<b>жирный</b>', keepImages)).toBe('**жирный**')
    expect(htmlToMarkdown('<ul><li>раз</li><li>два</li></ul>', keepImages)).toBe('- раз\n- два')
  })

  it('shows where an image stood in the message', () => {
    const md = htmlToMarkdown('до<img src="images/01.png" alt="скрин">после', keepImages)
    expect(md).toContain('![скрин](images/01.png)')
    expect(md.indexOf('до')).toBeLessThan(md.indexOf('!['))
    expect(md.indexOf('![')).toBeLessThan(md.indexOf('после'))
  })

  it('decodes entities and drops scripts', () => {
    expect(htmlToMarkdown('<script>alert(1)</script>&#x41F;&#x440;&#x438;&#x432;&#x435;&#x442;&nbsp;мир', keepImages))
      .toBe('Привет мир')
  })

  it('collapses runs of empty lines', () => {
    expect(htmlToMarkdown('<div>раз</div><div></div><div></div><div>два</div>', keepImages)).toBe('раз\n\nдва')
  })
})

describe('file naming', () => {
  it('strips characters Windows refuses', () => {
    expect(sanitizeFilename('отчёт: 10/08 "итог"?.txt')).not.toMatch(/[\\/:*?"<>|]/)
  })

  it('never returns an empty name', () => {
    expect(sanitizeFilename('  ')).toBe('file')
  })

  it('maps image mime types to extensions', () => {
    expect(extensionForMime('image/png')).toBe('png')
    expect(extensionForMime('image/jpeg')).toBe('jpg')
    expect(extensionForMime('application/octet-stream')).toBe('bin')
  })
})

describe('misc', () => {
  it('formats sizes', () => {
    expect(humanSize(512)).toBe('512 Б')
    expect(humanSize(2048)).toBe('2 КБ')
    expect(humanSize(3 * 1024 * 1024)).toBe('3.0 МБ')
    expect(humanSize(0)).toBe('')
  })

  it('reads the attachment id out of an inline src', () => {
    expect(attachmentIdFromSrc('/api/v1/ticket_attachment/616943/12345/678')).toBe(678)
    expect(attachmentIdFromSrc('data:image/png;base64,AAA')).toBeNull()
  })
})
