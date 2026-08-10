import { describe, expect, it } from 'vitest'
import { inflateRawSync } from 'zlib'
import { createZip } from '../electron/main/zip'

/** Reads an entry back out of the archive using the central directory. */
function readEntries(zip: Buffer): { path: string; data: Buffer }[] {
  const entries: { path: string; data: Buffer }[] = []
  let offset = 0
  while (offset < zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8)
    const compressedSize = zip.readUInt32LE(offset + 18)
    const nameLength = zip.readUInt16LE(offset + 26)
    const extraLength = zip.readUInt16LE(offset + 28)
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString('utf8')
    const dataStart = offset + 30 + nameLength + extraLength
    const payload = zip.subarray(dataStart, dataStart + compressedSize)
    entries.push({ path: name, data: method === 8 ? inflateRawSync(payload) : Buffer.from(payload) })
    offset = dataStart + compressedSize
  }
  return entries
}

describe('createZip', () => {
  const stamp = new Date('2026-08-10T12:00:00')

  it('round-trips text and binary entries', () => {
    const text = Buffer.from('# Заявка №616943\n\nПривет'.repeat(20), 'utf8')
    const png = Buffer.from('89504e470d0a1a0a', 'hex')
    const zip = createZip([
      { path: 'заявка.md', data: text },
      { path: 'images/01-скрин.png', data: png }
    ], stamp)

    const entries = readEntries(zip)
    expect(entries.map(e => e.path)).toEqual(['заявка.md', 'images/01-скрин.png'])
    expect(entries[0].data.toString('utf8')).toBe(text.toString('utf8'))
    expect(entries[1].data.equals(png)).toBe(true)
  })

  it('ends with the central directory record', () => {
    const zip = createZip([{ path: 'a.txt', data: Buffer.from('a') }], stamp)
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50)
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(1)
  })

  it('stores incompressible data instead of growing it', () => {
    // Random bytes stand in for an already-compressed attachment.
    const noise = Buffer.alloc(2048)
    for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761) % 256
    const zip = createZip([{ path: 'noise.bin', data: noise }], stamp)
    expect(readEntries(zip)[0].data.equals(noise)).toBe(true)
  })

  it('normalises backslashes in paths', () => {
    const zip = createZip([{ path: 'files\\log.txt', data: Buffer.from('x') }], stamp)
    expect(readEntries(zip)[0].path).toBe('files/log.txt')
  })
})
