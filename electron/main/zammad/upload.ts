import { BrowserWindow, net } from 'electron'
import logger from 'electron-log/main'

/**
 * Sending a ticket update that carries attachments. Zammad takes them inside the
 * article itself, so the whole thing is one request - but written to the socket
 * in pieces, which is what makes progress and cancelling possible at all.
 * Without this the user stared at a frozen button for the length of a 20 MB
 * upload with no way out.
 */

const CHUNK_SIZE = 256 * 1024

interface ActiveUpload {
  abort: () => void
}

const activeUploads = new Map<string, ActiveUpload>()

export function cancelUpload(uploadId: string): boolean {
  const upload = activeUploads.get(uploadId)
  if (!upload) return false
  upload.abort()
  return true
}

function reportProgress(uploadId: string, sent: number, total: number): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('tickets:upload-progress', { uploadId, sent, total })
    }
  }
}

export interface UploadResult {
  ok: boolean
  status: number
  body: string
}

export function putWithProgress(options: {
  url: string
  headers: Record<string, string>
  body: Buffer
  uploadId?: string
}): Promise<UploadResult> {
  const { url, headers, body, uploadId } = options

  return new Promise<UploadResult>((resolve, reject) => {
    const request = net.request({ method: 'PUT', url })
    for (const [name, value] of Object.entries(headers)) request.setHeader(name, value)
    // Content-Length is Electron's to set: writing it by hand while streaming
    // the body makes the request fail with ERR_INVALID_ARGUMENT.

    let settled = false
    let cancelled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      if (uploadId) activeUploads.delete(uploadId)
      fn()
    }

    if (uploadId) {
      activeUploads.set(uploadId, {
        abort: () => {
          cancelled = true
          request.abort()
        }
      })
    }

    request.on('response', response => {
      const chunks: Buffer[] = []
      response.on('data', chunk => chunks.push(Buffer.from(chunk)))
      response.on('end', () => finish(() => resolve({
        ok: response.statusCode >= 200 && response.statusCode < 300,
        status: response.statusCode,
        body: Buffer.concat(chunks).toString('utf8')
      })))
      response.on('error', (err: Error) => finish(() => reject(err)))
    })

    request.on('abort', () => finish(() => reject(new Error(
      cancelled ? 'Отправка отменена' : 'Отправка прервана'
    ))))
    request.on('error', err => finish(() => reject(err)))

    // Written piece by piece, each one waiting for the previous to be accepted:
    // that acknowledgement is the only honest measure of how much has really
    // left, and it is what gives cancelling a chance to interrupt.
    let offset = 0
    const writeNext = (): void => {
      if (settled) return
      if (offset >= body.length) {
        request.end()
        return
      }
      const end = Math.min(offset + CHUNK_SIZE, body.length)
      const chunk = body.subarray(offset, end)
      offset = end
      // The three-argument form is the one that takes a completion callback;
      // for a Buffer the encoding argument is ignored.
      request.write(chunk, 'utf-8', () => {
        if (uploadId) reportProgress(uploadId, offset, body.length)
        writeNext()
      })
    }

    try {
      writeNext()
    } catch (err) {
      logger.error('Ошибка отправки вложений:', err)
      finish(() => reject(err as Error))
    }
  })
}
