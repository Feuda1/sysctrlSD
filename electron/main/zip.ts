import { deflateRawSync } from 'zlib'

/**
 * Minimal ZIP writer. A whole archiving library would be a heavy dependency for
 * the one thing the ticket export needs: a handful of files in one .zip that
 * Windows Explorer, 7-Zip and every unzip tool open without complaint.
 */

export interface ZipEntry {
  /** Path inside the archive, always with forward slashes. */
  path: string
  data: Buffer
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let value = i
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1
    }
    table[i] = value
  }
  return table
})()

function crc32(data: Buffer): number {
  let crc = -1
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ data[i]) & 0xff]
  }
  return (crc ^ -1) >>> 0
}

// ZIP stores the timestamp in the MS-DOS format: 2-second resolution, years
// counted from 1980.
function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear())
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  }
}

export function createZip(entries: ZipEntry[], now = new Date()): Buffer {
  const { time, date } = dosDateTime(now)
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.path.replace(/\\/g, '/'), 'utf8')
    const crc = crc32(entry.data)
    const compressed = deflateRawSync(entry.data)
    // Deflate can grow already-compressed data (PNG, JPEG, ZIP inside ZIP);
    // storing it as-is is both smaller and faster to read back.
    const useDeflate = compressed.length < entry.data.length
    const payload = useDeflate ? compressed : entry.data
    const method = useDeflate ? 8 : 0

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)          // version needed
    local.writeUInt16LE(0x0800, 6)      // UTF-8 names
    local.writeUInt16LE(method, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(date, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(payload.length, 18)
    local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)          // no extra field

    chunks.push(local, name, payload)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)         // version made by
    header.writeUInt16LE(20, 6)         // version needed
    header.writeUInt16LE(0x0800, 8)
    header.writeUInt16LE(method, 10)
    header.writeUInt16LE(time, 12)
    header.writeUInt16LE(date, 14)
    header.writeUInt32LE(crc, 16)
    header.writeUInt32LE(payload.length, 20)
    header.writeUInt32LE(entry.data.length, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt16LE(0, 30)         // extra
    header.writeUInt16LE(0, 32)         // comment
    header.writeUInt16LE(0, 34)         // disk number
    header.writeUInt16LE(0, 36)         // internal attrs
    header.writeUInt32LE(0, 38)         // external attrs
    header.writeUInt32LE(offset, 42)

    central.push(header, name)
    offset += local.length + name.length + payload.length
  }

  const centralBuffer = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralBuffer.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...chunks, centralBuffer, end])
}
