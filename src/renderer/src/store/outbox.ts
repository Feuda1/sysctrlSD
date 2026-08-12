import { create } from 'zustand'
import { queryClient } from '@/lib/queryClient'
import { dataUrlPayload } from '@/lib/utils'
import { usePendingStatesStore } from '@/store/pendingStates'

import type { ComposerAttachment } from '@/lib/ticketFormat'

export type OutboxAttachment = ComposerAttachment

/** Всё, что нужно, чтобы отправить сообщение и изменения заявки повторно. */
export interface OutboxPayload {
  ticketId: number
  body: string
  internal: boolean
  articleType: string
  stateId?: number
  ticketTypeId?: string | null
  groupId?: number | null
  ownerId?: number | null
  priorityId?: number | null
  iikoReasonIds?: string[]
  tagIds?: string[]
  pendingTime?: string | null
  timeUnit: number | null
  attachments: OutboxAttachment[]
  /** Показывать ли сообщение в ленте как отправляемое (иначе меняются только параметры). */
  includeArticle: boolean
  /** Текст как его набрали — им заполняется поле, если отправку решат отменить. */
  draftBody: string
  /** Куда перевели заявку: нужно, чтобы поправить чипы, пока поиск не догнал. */
  nextState?: { id: number; name: string } | null
  /** Название заявки для общего индикатора. */
  ticketTitle: string
}

export interface OutboxJob {
  id: string
  payload: OutboxPayload
  at: string
  /** sending — в пути, sent — принято сервером, ждём появления в ленте. */
  status: 'sending' | 'sent' | 'failed'
  error?: string
  /** Задан, только когда едут вложения: за ними можно следить и отменять. */
  uploadId?: string
}

interface OutboxStore {
  jobs: OutboxJob[]
  /** Ставит отправку в работу. Возвращает id — по нему страница находит своё сообщение. */
  send: (payload: OutboxPayload) => string
  retry: (jobId: string) => void
  /** Убирает задание из очереди (после отмены или когда сообщение уже пришло). */
  drop: (jobId: string) => void
  jobsForTicket: (ticketId: number) => OutboxJob[]
}

/** Сколько ждать появления доставленного сообщения в ленте, прежде чем забыть. */
const FORGET_SENT_AFTER_MS = 90_000

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Отправка живёт здесь, а не на странице заявки, потому что страница исчезает
 * вместе с вкладкой. Раньше уход из заявки сразу после отправки означал, что
 * ответ никто не дождётся: данные не обновятся, а об ошибке никто не узнает.
 */
export const useOutboxStore = create<OutboxStore>((set, get) => {
  const run = async (job: OutboxJob) => {
    const { payload } = job
    try {
      await window.api.tickets.addComment({
        ticketId: payload.ticketId,
        body: payload.body,
        internal: payload.internal,
        articleType: payload.articleType,
        stateId: payload.stateId,
        ticketTypeId: payload.ticketTypeId,
        groupId: payload.groupId,
        ownerId: payload.ownerId,
        priorityId: payload.priorityId,
        iikoReasonIds: payload.iikoReasonIds,
        tagIds: payload.tagIds,
        pendingTime: payload.pendingTime,
        timeUnit: payload.timeUnit,
        attachments: payload.attachments.map(attachment => ({
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          data: dataUrlPayload(attachment.dataUrl)
        })),
        uploadId: job.uploadId
      })

      if (payload.nextState) {
        usePendingStatesStore.getState().setPendingState(
          payload.ticketId,
          payload.nextState.id,
          payload.nextState.name
        )
      }

      queryClient.invalidateQueries({ queryKey: ['ticket-details', payload.ticketId] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      await queryClient.invalidateQueries({ queryKey: ['ticket-articles', payload.ticketId] })

      // Сервер принял сообщение, но в перечитанной переписке его может ещё не
      // быть: с вложениями оно появляется с задержкой. Снять задание сейчас —
      // значит убрать сообщение с экрана и вернуть его через несколько секунд,
      // когда придёт настоящее. Поэтому задание остаётся, но уже без пометки
      // «отправляется»: сообщение доставлено, ждём только его появления.
      const delivered = !payload.includeArticle || (queryClient.getQueryData<{ id: number; createdAt: string }[]>(
        ['ticket-articles', payload.ticketId]
      ) ?? []).some(article => Date.parse(article.createdAt) >= Date.parse(job.at) - 5000)

      // Без сообщения ждать нечего: показывать в ленте нечего, задание закрыто.
      if (delivered) {
        get().drop(job.id)
        return
      }

      set(store => ({
        jobs: store.jobs.map(item => (item.id === job.id ? { ...item, status: 'sent' } : item))
      }))
      // Страховка: если настоящее сообщение так и не показалось, задание не
      // должно висеть вечно.
      setTimeout(() => get().drop(job.id), FORGET_SENT_AFTER_MS)
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Не удалось отправить комментарий'
      set(store => ({
        jobs: store.jobs.map(item =>
          item.id === job.id ? { ...item, status: 'failed', error: reason } : item
        )
      }))
    }
  }

  return {
    jobs: [],

    send: (payload) => {
      const job: OutboxJob = {
        id: newId('job'),
        payload,
        at: new Date().toISOString(),
        status: 'sending',
        uploadId: payload.attachments.length > 0 ? newId('upload') : undefined
      }
      set(store => ({ jobs: [...store.jobs, job] }))
      void run(job)
      return job.id
    },

    retry: (jobId) => {
      const job = get().jobs.find(item => item.id === jobId)
      if (!job) return
      const restarted: OutboxJob = { ...job, status: 'sending', error: undefined }
      set(store => ({ jobs: store.jobs.map(item => (item.id === jobId ? restarted : item)) }))
      void run(restarted)
    },

    drop: (jobId) => set(store => ({ jobs: store.jobs.filter(item => item.id !== jobId) })),

    jobsForTicket: (ticketId) => get().jobs.filter(job => job.payload.ticketId === ticketId)
  }
})
