import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useRef } from 'react'
import { ArrowDown, ChevronLeft, Mail, Phone, Calendar, Clock, StickyNote, Loader2, Send, Award, Shield, MessageSquare, Info, ChevronDown, ChevronUp, AlertCircle, RefreshCw, X, FileText, FileImage, FileArchive, Building, User, ExternalLink, Search, Paperclip, Check, Hand, Copy, GitMerge, UserCheck, UserCog, PlusCircle, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTicketFilters } from '@/hooks/useTickets'
import { useUIStore } from '@/store/ui'
import { useAuthStore } from '@/store/auth'
import { getStateBadgeClass, getTicketTypeBadgeClass, formatTicketDate, formatScore } from '@/types/ticket'
import type { Ticket, TicketArticle, TicketAttachment, TicketCustomer, OrganizationDetails, TicketHistoryItem } from '@/types/ticket'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { AiAssistButton } from '@/components/ai/AiAssistButton'
import { useTabsStore } from '@/store/tabs'
import { useMacrosStore } from '@/store/macros'
import {
  ARTICLE_TYPE_OPTIONS,
  dateTimeLocalFromRaw,
  formatAttachmentSize,
  getAttachmentKind,
  getArticleTypeLabel,
  getAutoArticleType,
  getPriorityOrder,
  getVisibleAttachments,
  htmlToPlainText,
  isAutoReplyArticle,
  isPendingOrClosedState,
  isReasonRequiredState,
  parseFirstArticle,
  toHtmlComment,
  tomorrowAtEleven,
  type ArticleAttachment,
  type ComposerAttachment,
  type ViewerItem
} from '@/lib/ticketFormat'
import { readFileAsDataUrl, dataUrlPayload, getUserDisplayName } from '@/lib/utils'
import { CustomToggle, CustomSelect, CustomMultiSelect, CustomDateTimePicker } from '@/components/ui/custom-controls'
import { AttachmentTile, AttachmentPreviewCard, MediaViewer, MiniAudioPlayer } from '@/components/tickets/TicketAttachments'
import { TicketExportModal } from '@/components/tickets/TicketExportModal'
import { ArticleBody } from '@/components/tickets/ArticleBody'
import { TicketHistoryModal } from '@/components/tickets/TicketHistoryModal'
import { LinkOrganizationModal } from '@/components/tickets/LinkOrganizationModal'
import { EditCustomerModal } from '@/components/tickets/EditCustomerModal'
import { ChangeCustomerModal } from '@/components/tickets/ChangeCustomerModal'
import { MergeTicketModal } from '@/components/tickets/MergeTicketModal'
import { CreateSubTicketModal } from '@/components/tickets/CreateSubTicketModal'
import { ChannelIcon, PriorityCircles } from '@/components/tickets/TicketBadges'

/** Everything needed to send a comment — and to send it again if it fails. */
interface CommentSubmission {
  draft: {
    body: string
    attachments: ComposerAttachment[]
    internal: boolean
    articleType: string
  }
  timeUnit: number | null
  includeArticle: boolean
}

/** Id of the not-yet-delivered message; negative so it never clashes with a real one. */
const PENDING_ARTICLE_ID = -1

/** Stands in for the timestamp until the message is delivered. */
function PendingStatus({ failed, bytes, progress }: { failed: boolean; bytes: number; progress: { sent: number; total: number } | null }) {
  if (failed) {
    return (
      <span className="flex items-center gap-1 text-destructive">
        <AlertCircle className="h-3 w-3" />
        Не отправлено
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 opacity-70">
      <Loader2 className="h-3 w-3 animate-spin" />
      {/* Attachments travel inside the same request, so their size explains the
          wait — there is no per-file progress to show. */}
      {progress
        ? `Отправляется… ${formatAttachmentSize(progress.sent)} из ${formatAttachmentSize(progress.total)}`
        : bytes > 0 ? `Отправляется… ${formatAttachmentSize(bytes)}` : 'Отправляется…'}
    </span>
  )
}

interface PendingComment extends CommentSubmission {
  failed: boolean
  at: string
  /** Set only when attachments ride along: they are what can be followed and cancelled. */
  uploadId?: string
}

interface Member {
  id: number
  firstname: string
  lastname: string
  email: string | null
  phone: string | null
  mobile: string | null
  department: string | null
  max: string | null
  telegram: string | null
}




export default function TicketDetailsPage() {
  const { ticketId } = useParams<{ ticketId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const idNum = parseInt(ticketId ?? '0', 10)
  const macros = useMacrosStore(s => s.macros)
  const ticketScrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  const [expandedAutoReplies, setExpandedAutoReplies] = useState<Record<number, boolean>>({})
  const [previewItems, setPreviewItems] = useState<ViewerItem[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewLoadingKey, setPreviewLoadingKey] = useState<string | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'tickets'>('info')
  const [orgTicketsSearch, setOrgTicketsSearch] = useState('')
  const [orgTicketsOwner, setOrgTicketsOwner] = useState('all')
  const [orgTicketsState, setOrgTicketsState] = useState('all')
  const [orgTicketsDate, setOrgTicketsDate] = useState('all')
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false)
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('')
  const [attachmentsOpen, setAttachmentsOpen] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [commentAttachments, setCommentAttachments] = useState<ComposerAttachment[]>([])
  const [commentInternal, setCommentInternal] = useState(false)
  // The message shown in the thread while it is on its way to Zammad.
  const [pendingComment, setPendingComment] = useState<PendingComment | null>(null)
  const [uploadProgress, setUploadProgress] = useState<{ sent: number; total: number } | null>(null)
  const [commentArticleType, setCommentArticleType] = useState('')
  const [commentStateId, setCommentStateId] = useState<number | null>(null)
  const [ticketTypeId, setTicketTypeId] = useState<string | null>(null)
  const [groupId, setGroupId] = useState<number | null>(null)
  const [ownerId, setOwnerId] = useState<number | null>(null)
  const [priorityId, setPriorityId] = useState<number | null>(null)
  const [iikoReasonIds, setIikoReasonIds] = useState<string[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])
  const [commentPendingTime, setCommentPendingTime] = useState('')
  const [commentTimeUnit, setCommentTimeUnit] = useState('')
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false)
  const [commentError, setCommentError] = useState('')
  const [isMacroDropdownOpen, setIsMacroDropdownOpen] = useState(false)
  const [macroSearchQuery, setMacroSearchQuery] = useState('')
  const macroDropdownRef = useRef<HTMLDivElement | null>(null)
  const macroSearchInputRef = useRef<HTMLInputElement | null>(null)
  const [commentWarning, setCommentWarning] = useState('')
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [ticketMetaOpen, setTicketMetaOpen] = useState(false)
  const [copiedTicketMeta, setCopiedTicketMeta] = useState<string | null>(null)
  const [copiedClientsLink, setCopiedClientsLink] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [mergeModalOpen, setMergeModalOpen] = useState(false)
  const [changeCustomerModalOpen, setChangeCustomerModalOpen] = useState(false)
  const [editCustomerModalOpen, setEditCustomerModalOpen] = useState(false)
  const [createSubTicketModalOpen, setCreateSubTicketModalOpen] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [scoreSaving, setScoreSaving] = useState(false)
  const [scoreError, setScoreError] = useState('')
  // Shown while the write and the refetch are in flight: clients answers with a
  // noticeable delay, and without this the field sits on the old value as if the
  // click did nothing.
  const [pendingScore, setPendingScore] = useState<string | null>(null)
  const [isSubTicketsOpen, setIsSubTicketsOpen] = useState(false)
  const [linkOrgModalOpen, setLinkOrgModalOpen] = useState(false)

  const { data: filtersData } = useTicketFilters()
  const chatStyle = useUIStore(s => s.chatStyle)
  const bubbleSide = useUIStore(s => s.bubbleSide)
  const allowTicketPendingWithoutReason = useUIStore(s => s.allowTicketPendingWithoutReason)
  const allowTicketStatusWithoutPublicComment = useUIStore(s => s.allowTicketStatusWithoutPublicComment)
  const afterCommentSubmitAction = useUIStore(s => s.afterCommentSubmitAction)
  const hideScrollDownArrow = useUIStore(s => s.hideScrollDownArrow)
  const openCreatedTicket = useUIStore(s => s.openCreatedTicket)
  const allowScoreWithoutClientsRight = useUIStore(s => s.allowScoreWithoutClientsRight)
  const suggestStateOnSend = useUIStore(s => s.suggestStateOnSend)
  const suggestReasonOnSend = useUIStore(s => s.suggestReasonOnSend)
  const currentUser = useAuthStore(s => s.user)
  const closeTab = useTabsStore(s => s.closeTab)
  const activeTabId = useTabsStore(s => s.activeTabId)

  const { data: detailsData, isLoading: detailsLoading, error: detailsError } = useQuery<{ ticket: Ticket; customer: TicketCustomer | null; organization: OrganizationDetails | null }>({
    queryKey: ['ticket-details', idNum],
    queryFn: () => window.api.tickets.getDetails(idNum),
    enabled: idNum > 0,
    refetchInterval: 5000
  })

  const { data: articles, isLoading: articlesLoading } = useQuery<TicketArticle[]>({
    queryKey: ['ticket-articles', idNum],
    queryFn: () => window.api.tickets.getArticles(idNum),
    enabled: idNum > 0,
    refetchInterval: 5000
  })

  const { data: ticketHistory = [], isLoading: historyLoading } = useQuery<TicketHistoryItem[]>({
    queryKey: ['ticket-history', idNum],
    queryFn: () => window.api.tickets.getHistory(idNum),
    enabled: idNum > 0 && historyModalOpen,
    staleTime: 30_000
  })

  const { data: orgTickets = [], isLoading: orgTicketsLoading } = useQuery<Ticket[]>({
    queryKey: ['org-tickets', selectedOrgId],
    queryFn: () => window.api.organizations.getTickets(selectedOrgId!),
    enabled: !!selectedOrgId,
    staleTime: 30_000
  })

  const { data: orgMembers = [], isLoading: orgMembersLoading } = useQuery<Member[]>({
    queryKey: ['org-members', selectedOrgId],
    queryFn: () => window.api.organizations.getMembers(selectedOrgId!),
    enabled: !!selectedOrgId,
    staleTime: 60_000
  })

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (macroDropdownRef.current && !macroDropdownRef.current.contains(e.target as Node)) {
        setIsMacroDropdownOpen(false)
      }
    }
    if (isMacroDropdownOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [isMacroDropdownOpen])

  useEffect(() => {
    if (isMacroDropdownOpen) {
      setTimeout(() => {
        macroSearchInputRef.current?.focus()
      }, 50)
    }
  }, [isMacroDropdownOpen])

  useEffect(() => {
    setOrgTicketsSearch('')
    setOrgTicketsOwner('all')
    setOrgTicketsState('all')
    setOrgTicketsDate('all')
    setIsOwnerDropdownOpen(false)
    setOwnerSearchQuery('')
  }, [selectedOrgId, activeTab])

  const updateScrollDownVisibility = () => {
    const el = ticketScrollRef.current
    if (!el) return
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollDown(distanceToBottom > 180)
  }

  useEffect(() => {
    window.requestAnimationFrame(updateScrollDownVisibility)
  }, [detailsData?.ticket?.id, articles?.length, attachmentsOpen, chatStyle])

  useEffect(() => {
    const ticket = detailsData?.ticket
    if (!ticket) return
    setCommentArticleType(getAutoArticleType(ticket.channel))
    setCommentStateId(ticket.state.id || null)
    setTicketTypeId(ticket.ticketType?.id ?? null)
    setGroupId(ticket.group.id || null)
    setOwnerId(ticket.owner.id ?? null)
    setPriorityId(ticket.priority.id || null)
    setIikoReasonIds((ticket.iikoReasons ?? []).map(reason => reason.id))
    setTagIds((ticket.tags ?? []).map(tag => tag.id))
    setCommentPendingTime(dateTimeLocalFromRaw(ticket.pendingTime) || tomorrowAtEleven())
  }, [detailsData?.ticket?.id])


  // The options, the current value and the right to change it all come from the
  // clients ticket page — the app never decides on its own who may award points.
  const scoreOptions: { value: string; label: string }[] = (detailsData?.ticket as any)?.scoreOptions ?? []
  const scoreValue: string | null = (detailsData?.ticket as any)?.scoreValue ?? null
  const clientsAllowsScore: boolean = (detailsData?.ticket as any)?.canEditScore === true
  const canEditScore: boolean = (clientsAllowsScore || allowScoreWithoutClientsRight) && scoreOptions.length > 0

  // The pending value stops being needed as soon as the refetched ticket carries it.
  useEffect(() => {
    if (pendingScore !== null && scoreValue === pendingScore) setPendingScore(null)
  }, [scoreValue, pendingScore])

  const handleScoreChange = async (value: string) => {
    if (value === (pendingScore ?? scoreValue)) return
    setScoreSaving(true)
    setScoreError('')
    setPendingScore(value)
    try {
      // The override travels with the request: the main process refuses the write
      // on its own unless it is told, on purpose, to ignore the clients rule.
      await window.api.tickets.setScore(idNum, value, !clientsAllowsScore && allowScoreWithoutClientsRight)
      await queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
    } catch (err: any) {
      setPendingScore(null)
      setScoreError(err?.message || 'Не удалось выставить баллы')
    } finally {
      setScoreSaving(false)
    }
  }


  // The composer is cleared the moment the message is sent, so the payload has to
  // travel with the mutation instead of being read back from the state.
  // The real article can arrive from the poller before our own refetch finishes,
  // and then both were on screen at once. Whoever brings it first, the
  // placeholder goes as soon as the message itself is in the thread.
  useEffect(() => {
    if (!pendingComment || pendingComment.failed) return
    const sentAt = Date.parse(pendingComment.at)
    const draftText = pendingComment.draft.body.trim()
    const arrived = (articles ?? []).some(article => {
      const createdAt = Date.parse(article.createdAt)
      if (!Number.isFinite(createdAt) || createdAt < sentAt - 5000) return false
      return draftText
        ? htmlToPlainText(article.body).trim() === draftText
        : getVisibleAttachments(article.attachments).length > 0
    })
    if (arrived) setPendingComment(null)
  }, [articles, pendingComment])

  const addCommentMutation = useMutation({
    mutationFn: async ({ draft, timeUnit, includeArticle, uploadId }: CommentSubmission & { uploadId?: string }) => {
      const attachments = includeArticle ? draft.attachments.map(attachment => ({
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        data: dataUrlPayload(attachment.dataUrl)
      })) : []
      return window.api.tickets.addComment({
        ticketId: idNum,
        body: includeArticle && draft.body.trim() ? toHtmlComment(draft.body) : '',
        internal: draft.internal,
        articleType: draft.articleType,
        stateId: commentStateId ?? undefined,
        ticketTypeId,
        groupId,
        ownerId,
        priorityId,
        iikoReasonIds,
        tagIds,
        pendingTime: commentPendingTime ? new Date(commentPendingTime).toISOString() : null,
        timeUnit,
        attachments,
        uploadId
      })
    },
    onSuccess: async (_data, variables) => {
      if (variables.includeArticle) {
        setCommentTimeUnit('')
        setIsTimeModalOpen(false)
      }
      setCommentError('')
      setCommentWarning('')
      queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      // The placeholder is removed only once the real article is in the list.
      // Clearing it earlier made the message blink out and back in.
      await queryClient.invalidateQueries({ queryKey: ['ticket-articles', idNum] })
      setPendingComment(null)
      if (afterCommentSubmitAction === 'close' && activeTabId) {
        closeTab(activeTabId)
      }
    },
    onError: (error, variables) => {
      // The text is never thrown away: the message stays in the thread marked as
      // unsent, with a button to send it again.
      if (variables.includeArticle) {
        setPendingComment(previous => previous ? { ...previous, failed: true } : previous)
      }
      setCommentError(error instanceof Error ? error.message : 'Не удалось отправить комментарий')
    }
  })

  // Прогресс приходит из main по мере того, как байты уходят в сокет.
  useEffect(() => {
    return window.api.tickets.onUploadProgress(progress => {
      if (progress.uploadId === pendingComment?.uploadId) {
        setUploadProgress({ sent: progress.sent, total: progress.total })
      }
    })
  }, [pendingComment?.uploadId])

  const sendComment = (submission: CommentSubmission) => {
    const uploadId = submission.draft.attachments.length > 0
      ? `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : undefined
    if (submission.includeArticle && (submission.draft.body.trim() || submission.draft.attachments.length > 0)) {
      setPendingComment({ ...submission, uploadId, failed: false, at: new Date().toISOString() })
      setUploadProgress(null)
      setCommentBody('')
      setCommentAttachments([])
    }
    addCommentMutation.mutate({ ...submission, uploadId })
  }

  const cancelUpload = () => {
    if (pendingComment?.uploadId) window.api.tickets.cancelUpload(pendingComment.uploadId)
  }

  const retryPendingComment = () => {
    if (!pendingComment) return
    setPendingComment({ ...pendingComment, failed: false })
    setCommentError('')
    addCommentMutation.mutate({
      draft: pendingComment.draft,
      timeUnit: pendingComment.timeUnit,
      includeArticle: pendingComment.includeArticle
    })
  }

  /** Drops the unsent message and puts its text back into the composer. */
  const discardPendingComment = () => {
    if (!pendingComment) return
    setCommentBody(current => current.trim() ? current : pendingComment.draft.body)
    setCommentAttachments(current => current.length > 0 ? current : pendingComment.draft.attachments)
    setPendingComment(null)
    setCommentError('')
  }

  // Shown in the send dialog, and only for what is actually missing: the state
  // if it was left as it was, the reason if none was picked.
  const showStateSuggestion = suggestStateOnSend
    && isTimeModalOpen
    && commentStateId === detailsData?.ticket?.state?.id
  const showReasonSuggestion = suggestReasonOnSend
    && isTimeModalOpen
    && iikoReasonIds.length === 0

  const openTimeModal = (keepTime: boolean | any = false) => {
    const isKeepTime = keepTime === true
    const selectedStateName = filtersData?.states?.find(state => Number(state.id) === commentStateId)?.name || detailsData?.ticket?.state.name
    const requiresReason = isReasonRequiredState(selectedStateName)

    if (requiresReason && !allowTicketPendingWithoutReason && iikoReasonIds.length === 0) {
      setCommentWarning('Необходимо выбрать причину обращения чтобы закрыть заявку')
      return
    }

    const isChangingState = commentStateId !== detailsData?.ticket?.state?.id
    const isTargetPendingOrClosed = isPendingOrClosedState(selectedStateName)
    if (isChangingState && isTargetPendingOrClosed && !allowTicketStatusWithoutPublicComment && commentBody.trim() === '') {
      setCommentWarning('Необходимо написать комментарий для изменения состояния заявки')
      return
    }

    setCommentError('')
    setCommentWarning('')
    if (!isKeepTime) {
      setCommentTimeUnit('')
    }
    setIsTimeModalOpen(true)
  }

  const submitComment = () => {
    const parsedTime = commentTimeUnit.trim() === '' ? null : Number(commentTimeUnit)
    if (parsedTime !== null && (!Number.isFinite(parsedTime) || parsedTime < 0)) {
      setCommentError('Укажите корректное время')
      return
    }
    sendComment({
      draft: {
        body: commentBody,
        attachments: commentAttachments,
        internal: commentInternal,
        articleType: commentArticleType || getAutoArticleType(detailsData?.ticket?.channel)
      },
      timeUnit: parsedTime,
      includeArticle: true
    })
  }

  const updateCommentTimeUnit = (value: string) => {
    const digits = value.replace(/\D/g, '')
    setCommentTimeUnit(digits)
  }

  const addComposerFiles = async (files: File[]) => {
    if (files.length === 0) return
    try {
      const nextAttachments = await Promise.all(files.map(async (file, index) => ({
        id: `${Date.now()}-${index}-${file.name}`,
        filename: file.name || `clipboard-${index + 1}`,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: await readFileAsDataUrl(file),
        file
      })))
      setCommentAttachments(current => [...current, ...nextAttachments])
    } catch (error) {
      setCommentWarning(error instanceof Error ? error.message : 'Не удалось добавить файл')
    }
  }

  const insertCommentText = (text: string) => {
    if (!text) return
    const textarea = commentTextareaRef.current
    if (!textarea) {
      setCommentBody(current => `${current}${text}`)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    setCommentBody(current => `${current.slice(0, start)}${text}${current.slice(end)}`)
    window.requestAnimationFrame(() => {
      const cursor = start + text.length
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const handleCommentPaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    insertCommentText(event.clipboardData.getData('text/plain'))
    void addComposerFiles(files)
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    void addComposerFiles(files)
  }

  const removeCommentAttachment = (id: string) => {
    setCommentAttachments(current => current.filter(attachment => attachment.id !== id))
  }

  const scrollTicketToBottom = () => {
    const el = ticketScrollRef.current
    if (!el) return
    const start = el.scrollTop
    const end = el.scrollHeight - el.clientHeight
    const distance = end - start
    const duration = 720
    const startedAt = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const impulse = progress < 0.72
        ? 1 - Math.pow(1 - progress / 0.72, 3)
        : 1 - Math.pow(1 - progress, 2) * 0.08
      el.scrollTop = start + distance * Math.min(1, impulse)
      if (progress < 1) window.requestAnimationFrame(tick)
    }

    window.requestAnimationFrame(tick)
  }

  const copyTicketMeta = async (key: string, value?: string | null) => {
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopiedTicketMeta(key)
    window.setTimeout(() => setCopiedTicketMeta(current => current === key ? null : current), 1200)
  }

  const handleDownload = async (articleId: number, attachment: TicketAttachment) => {
    try {
      const result = await window.api.tickets.getAttachment(idNum, articleId, attachment.id)
      const link = document.createElement('a')
      link.href = result.dataUrl
      link.download = attachment.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error(err)
    }
  }

  // Opens the viewer on the clicked attachment, with every visible attachment of
  // the ticket as the navigable set (arrows move across all of them).
  const handleOpenAttachment = (articleId: number, attachment: TicketAttachment) => {
    setPreviewLoadingKey(null)
    const items: ViewerItem[] = allAttachments.map(a => ({
      articleId: a.articleId,
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size
    }))
    const idx = items.findIndex(i => i.articleId === articleId && i.id === attachment.id)
    if (idx === -1) {
      items.push({ articleId, id: attachment.id, filename: attachment.filename, mimeType: attachment.mimeType, size: attachment.size })
    }
    setPreviewItems(items)
    setPreviewIndex(idx === -1 ? items.length - 1 : idx)
  }

  // Opens the viewer directly on an inline image clicked inside a message body.
  const openInlineImage = (dataUrl: string, filename: string) => {
    setPreviewItems([{ articleId: 0, id: 0, filename: filename || 'Изображение', mimeType: 'image/*', size: 0, preloadedDataUrl: dataUrl }])
    setPreviewIndex(0)
  }

  const toggleAutoReply = (id: number) => {
    setExpandedAutoReplies(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (detailsLoading || articlesLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (detailsError || !detailsData) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive font-medium">Не удалось загрузить данные заявки</p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>Назад</Button>
      </div>
    )
  }

  const { ticket, customer, organization } = detailsData
  const copyClientsLink = async () => {
    const link = `https://clients.denvic.ru/Tickets/Details/${ticket.clientNumber || ticket.id}`
    await navigator.clipboard.writeText(link)
    setCopiedClientsLink(true)
    window.setTimeout(() => setCopiedClientsLink(false), 1200)
  }
  const selectedArticleType = commentArticleType || getAutoArticleType(ticket.channel)
  const ticketTypeOptions = [
    ...(ticket.ticketType?.id ? [{ id: ticket.ticketType.id, name: ticket.ticketType.name }] : []),
    ...(filtersData?.ticketTypes ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => String(other.id) === String(item.id)) === index)
  const groupOptions = [
    ticket.group,
    ...(filtersData?.groups ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => Number(other.id) === Number(item.id)) === index)
  const ownerOptions = [
    ...(ticket.owner.id ? [ticket.owner as { id: number; name: string }] : []),
    ...(currentUser?.id ? [{ id: currentUser.id, name: [currentUser.firstname, currentUser.lastname].filter(Boolean).join(' ').trim() || currentUser.login || currentUser.email }] : []),
    ...(filtersData?.agents ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => other.id === item.id) === index)
  const priorityOptions = [
    ticket.priority,
    ...(filtersData?.priorities ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => Number(other.id) === Number(item.id)) === index)
    .sort((a, b) => getPriorityOrder(a) - getPriorityOrder(b))
  const iikoReasonOptions = [
    ...(ticket.iikoReasons ?? []),
    ...(filtersData?.iikoReasons ?? [])
  ].filter((item, index, list) => list.findIndex(other => String(other.id) === String(item.id)) === index)
  const tagOptions = [
    ...(ticket.tags ?? []),
    ...(filtersData?.tags ?? [])
  ].filter((item, index, list) => list.findIndex(other => String(other.id) === String(item.id)) === index)
  const stateOptions = [
    ticket.state,
    ...(filtersData?.states ?? [])
  ].filter((item, index, list) => item.id && list.findIndex(other => Number(other.id) === Number(item.id)) === index)
  const uniqueStates = Array.from(new Set(orgTickets.map(t => t.state.name).filter((name): name is string => !!name)))

  const ticketOwners = orgTickets.map(t => t.owner.name).filter((name): name is string => !!name)
  const filterAgents = (filtersData?.agents ?? []).map(a => String(a.name))
  const allAvailableOwners = Array.from(new Set([...ticketOwners, ...filterAgents]))
    .filter(name => {
      const n = name.trim()
      return n && /[a-zA-Zа-яА-Я0-9]/.test(n)
    })
    .sort((a, b) => a.localeCompare(b, 'ru'))

  const filteredOrgTickets = orgTickets.filter(t => {
    const query = orgTicketsSearch.toLowerCase().trim()
    if (query) {
      const matchTitle = t.title.toLowerCase().includes(query)
      const matchNum = String(t.clientNumber || t.id).toLowerCase().includes(query)
      const matchZammadNum = String(t.number || '').toLowerCase().includes(query)
      if (!matchTitle && !matchNum && !matchZammadNum) return false
    }

    if (orgTicketsOwner !== 'all' && t.owner.name !== orgTicketsOwner) {
      return false
    }

    if (orgTicketsState !== 'all' && t.state.name !== orgTicketsState) {
      return false
    }

    if (orgTicketsDate !== 'all') {
      const createdDate = new Date(t.createdAt)
      const now = new Date()
      if (orgTicketsDate === 'today') {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        if (createdDate < today) return false
      } else if (orgTicketsDate === 'week') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        if (createdDate < oneWeekAgo) return false
      } else if (orgTicketsDate === 'month') {
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        if (createdDate < oneMonthAgo) return false
      } else if (orgTicketsDate === 'year') {
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        if (createdDate < oneYearAgo) return false
      }
    }

    return true
  })
  const sortedArticles = articles ? [...articles].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) : []
  const firstArticle = sortedArticles[0]
  const chatArticles = sortedArticles.slice(1)

  // The message being sent is rendered by the very same code as a delivered one,
  // as the last entry of the thread. Nothing is swapped when the server answers:
  // the bubble simply stops saying "Отправляется…" and shows its time, so the
  // list never reflows.
  const pendingAttachmentBytes = (pendingComment?.draft.attachments ?? []).reduce((sum, item) => sum + (item.size || 0), 0)

  const displayArticles: TicketArticle[] = pendingComment
    ? [...chatArticles, {
        id: PENDING_ARTICLE_ID,
        ticketId: idNum,
        body: toHtmlComment(pendingComment.draft.body),
        contentType: 'text/html',
        type: pendingComment.draft.articleType,
        sender: 'agent',
        internal: pendingComment.draft.internal,
        createdAt: pendingComment.at,
        creatorName: currentUser ? getUserDisplayName(currentUser.firstname, currentUser.lastname) : 'Вы',
        creatorAvatarDataUrl: currentUser?.avatarDataUrl ?? null,
        attachments: pendingComment.draft.attachments.map((attachment, index) => ({
          id: PENDING_ARTICLE_ID - index,
          filename: attachment.filename,
          size: attachment.size,
          mimeType: attachment.mimeType
        }))
      }]
    : chatArticles

const allAttachments: ArticleAttachment[] = sortedArticles.flatMap(article =>
    getVisibleAttachments(article.attachments).map(attachment => ({
      ...attachment,
      articleId: article.id,
      articleDate: article.createdAt,
      isPrivate: article.internal
    }))
  )
  const parsedHeader = firstArticle ? parseFirstArticle(firstArticle.body) : {}
  const customerName = [customer?.firstname, customer?.lastname].filter(Boolean).join(' ').trim() || parsedHeader.applicant || 'Заявитель не указан'
  const organizationName = organization?.name || ticket.organization.name || parsedHeader.client || 'Организация не найдена'
  const contactPhones = Array.from(new Set([
    customer?.mobile,
    customer?.phone,
    organization?.phone
  ].filter((value): value is string => !!value && value.trim() !== '')))
  const contactEmail = customer?.email || organization?.email || ''
  const contractText = organization?.contracts || organization?.contracts_and_comments || ''
  const objectText = [parsedHeader.object, parsedHeader.address].filter(Boolean).join(', ')

  const applyMacro = (macro: any) => {
    setCommentBody(macro.bodyText)
    setCommentInternal(macro.internal)
    setCommentArticleType('note')
    if (macro.stateId) {
      setCommentStateId(Number(macro.stateId))
    }
    if (macro.groupId) {
      setGroupId(Number(macro.groupId))
    }
    if (macro.iikoReasonIds && macro.iikoReasonIds.length > 0) {
      setIikoReasonIds(macro.iikoReasonIds)
    }
    if (macro.timeUnit !== undefined && macro.timeUnit !== null) {
      setCommentTimeUnit(String(macro.timeUnit))
    }
    if (macro.tagNames && macro.tagNames.length > 0) {
      const tagIdsToAdd = macro.tagNames.map(tagName => {
        const foundTag = tagOptions.find(t => t.name.toLowerCase() === tagName.toLowerCase())
        return foundTag ? String(foundTag.id) : null
      }).filter((id): id is string => !!id)
      
      if (tagIdsToAdd.length > 0) {
        setTagIds(prev => {
          const next = [...prev]
          tagIdsToAdd.forEach(id => {
            if (!next.includes(id)) next.push(id)
          })
          return next
        })
      }
    }
    openTimeModal(true)
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 gap-4">
      <MediaViewer ticketId={idNum} items={previewItems} index={previewIndex} onIndexChange={setPreviewIndex} onClose={() => setPreviewItems([])} />
      <AnimatePresence>
        {historyModalOpen && (
          <TicketHistoryModal
            items={ticketHistory}
            loading={historyLoading}
            onClose={() => setHistoryModalOpen(false)}
          />
        )}
        {commentWarning && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Предупреждение</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCommentWarning('')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-sm leading-6 text-foreground">{commentWarning}</p>
              </div>
              <div className="mt-5 flex justify-end">
                <Button size="sm" onClick={() => setCommentWarning('')}>Понятно</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {isTimeModalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Учет времени</h3>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsTimeModalOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Добавить минут</label>
                <div className="grid grid-cols-[40px_1fr_40px] items-center gap-2">
                  <button
                    type="button"
                    className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/20 text-sm font-semibold hover:bg-muted/45"
                    onClick={() => setCommentTimeUnit(String(Math.max(0, Number(commentTimeUnit || 0) - 5)))}
                  >
                    -
                  </button>
                  <div className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/30 text-sm font-semibold tabular-nums text-foreground">
                    <input
                      value={commentTimeUnit}
                      onChange={event => updateCommentTimeUnit(event.target.value)}
                      inputMode="numeric"
                      autoFocus
                      className="w-16 bg-transparent text-center text-sm font-semibold tabular-nums text-foreground outline-none"
                    />
                    <span>мин</span>
                  </div>
                  <button
                    type="button"
                    className="flex h-10 items-center justify-center rounded-md border border-border bg-muted/20 text-sm font-semibold hover:bg-muted/45"
                    onClick={() => setCommentTimeUnit(String(Number(commentTimeUnit || 0) + 5))}
                  >
                    +
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[0, 5, 10, 20, 30, 60].map(minutes => (
                    <button
                      key={minutes}
                      type="button"
                      onClick={() => setCommentTimeUnit(minutes === 0 ? '' : String(minutes))}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs transition-colors",
                        Number(commentTimeUnit || 0) === minutes
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-muted/20 text-muted-foreground hover:bg-muted/45 hover:text-foreground"
                      )}
                    >
                      {minutes === 0 ? 'Без времени' : `${minutes} мин`}
                    </button>
                  ))}
                </div>
              </div>

              {(showStateSuggestion || showReasonSuggestion) && (
                <div className="mt-4 space-y-3 rounded-lg border border-border/60 bg-muted/15 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Заодно можно указать
                  </p>

                  {showStateSuggestion && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">Статус заявки не менялся</p>
                      <CustomSelect
                        value={commentStateId}
                        options={stateOptions}
                        onChange={state => setCommentStateId(Number(state.id))}
                        placeholder={ticket.state.name || 'Выберите состояние'}
                        renderValue={state => state ? (
                          <span
                            className={cn(
                              'inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                              !filtersData?.stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                            )}
                            style={filtersData?.stateColors?.[Number(state.id)] ? {
                              backgroundColor: `${filtersData.stateColors[Number(state.id)]}15`,
                              color: filtersData.stateColors[Number(state.id)],
                              borderColor: `${filtersData.stateColors[Number(state.id)]}30`
                            } : undefined}
                          >
                            <span className="truncate">{state.name}</span>
                          </span>
                        ) : <span className="text-muted-foreground">Выберите состояние</span>}
                        renderOption={state => (
                          <span
                            className={cn(
                              'inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              !filtersData?.stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                            )}
                            style={filtersData?.stateColors?.[Number(state.id)] ? {
                              backgroundColor: `${filtersData.stateColors[Number(state.id)]}15`,
                              color: filtersData.stateColors[Number(state.id)],
                              borderColor: `${filtersData.stateColors[Number(state.id)]}30`
                            } : undefined}
                          >
                            <span className="truncate">{state.name}</span>
                          </span>
                        )}
                      />
                    </div>
                  )}

                  {showReasonSuggestion && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] text-muted-foreground">Причина обращения не указана</p>
                      <CustomMultiSelect
                        values={iikoReasonIds}
                        options={iikoReasonOptions}
                        onChange={reasons => setIikoReasonIds(reasons.map(reason => String(reason.id)))}
                        placeholder="Выберите причину"
                        renderChip={reason => <span className="truncate text-sky-700 dark:text-sky-300">{reason.name}</span>}
                      />
                    </div>
                  )}
                </div>
              )}

              {commentError && (
                <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {commentError}
                </div>
              )}

              <div className="mt-5 flex justify-end">
                <Button size="sm" onClick={submitComment} disabled={addCommentMutation.isPending}>
                  {addCommentMutation.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Сохранить
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`
        .gmail_quote, blockquote, .mz_quote, [class*="quote"] {
          display: none !important;
        }
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      <div className="shrink-0 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl border border-border/40 hover:bg-accent/40"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад к списку
        </Button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-3 min-h-0 relative">
          <div
            ref={ticketScrollRef}
            onScroll={updateScrollDownVisibility}
            className="h-full min-h-0 overflow-y-auto pr-1 flex flex-col gap-4"
          >
          <div className="bg-card rounded-2xl border border-border/55 shadow-sm shrink-0 overflow-hidden">
            <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[minmax(240px,0.8fr)_1fr]">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between relative">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Клиент</span>
                </div>
                <div className="flex flex-col items-start">
                  <span data-selectable className="text-xl font-bold leading-7 text-foreground">{customerName}</span>
                  {organization ? (
                    <button
                      type="button"
                      onClick={() => {
                        // Selecting the name inside a button still ends in a click;
                        // opening the organization then would throw the selection away.
                        if (window.getSelection()?.toString().trim()) return
                        setSelectedOrgId(organization.id)
                        setActiveTab('info')
                      }}
                      className="text-sm font-medium text-primary hover:underline text-left flex items-center gap-1 group/org transition-colors"
                    >
                      <span data-selectable className="cursor-text">{organizationName}</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover/org:opacity-100 transition-opacity" />
                    </button>
                  ) : (
                    <span data-selectable className="text-sm font-medium text-muted-foreground">{organizationName}</span>
                  )}
                </div>
                {organization?.note && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{organization.note}</p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-x-8 gap-y-3 border-t border-border/40 pt-4 text-sm sm:grid-cols-2 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                {contactPhones.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Телефон</span>
                    <span className="font-mono text-foreground">{contactPhones.join(', ')}</span>
                  </div>
                )}
                {contactEmail && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Email</span>
                    <span className="truncate text-foreground">{contactEmail}</span>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Договор</span>
                  <span className={cn(
                    "font-semibold",
                    contractText ? "text-foreground" : "text-red-600 dark:text-red-300"
                  )}>
                    {contractText || 'Договор не найден'}
                  </span>
                </div>
                {objectText && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Объект</span>
                    <span className="text-foreground">{objectText}</span>
                  </div>
                )}
                {!contactPhones.length && !contactEmail && !objectText && (
                  <span className="text-sm text-muted-foreground">Контактные данные не найдены</span>
                )}
              </div>
            </div>

            {firstArticle && (
              <div className="border-t border-border/50 p-5">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-primary">Обращение</span>
                      <h1 className="text-lg font-bold text-foreground leading-7">
                        {ticket.clientNumber ? `[${ticket.clientNumber}] ` : ''}{ticket.title}
                      </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon channel={ticket.channel} className="h-3.5 w-3.5" />
                        {ticket.channel || 'Zammad'}
                      </span>
                      <span>{formatTicketDate(ticket.createdAt)}</span>
                    </div>
                  </div>

                  <div className="border-t border-zinc-700/30 pt-4">
                    <ArticleBody html={firstArticle.body} ticketId={idNum} articleId={firstArticle.id} onImageOpen={openInlineImage} />
                    {firstArticle.callRecordUrl && (
                      <MiniAudioPlayer url={firstArticle.callRecordUrl} isPrivate={firstArticle.internal} />
                    )}
                    {getVisibleAttachments(firstArticle.attachments).length > 0 && (
                      <div className="border-t border-zinc-700/30 mt-4 pt-3 flex flex-wrap gap-2">
                        {getVisibleAttachments(firstArticle.attachments).map((att) => (
                          <div key={att.id} className="relative">
                            <AttachmentTile ticketId={idNum} articleId={firstArticle.id} attachment={att} onOpen={handleOpenAttachment} onDownload={handleDownload} />
                            {previewLoadingKey === `${firstArticle.id}-${att.id}` && (
                              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {(detailsData?.ticket?.subTickets && detailsData.ticket.subTickets.length > 0 || true) && (
            <div className="bg-card rounded-2xl border border-border/55 p-5 shadow-sm shrink-0 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsSubTicketsOpen(!isSubTicketsOpen)}
                  className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 hover:text-foreground transition-colors outline-none"
                >
                  <GitMerge className="h-3.5 w-3.5 text-primary" />
                  Вложенные заявки {detailsData?.ticket?.subTickets ? `(${detailsData.ticket.subTickets.length})` : '(0)'}
                  {isSubTicketsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateSubTicketModalOpen(true)}
                  className="h-8 gap-1.5 px-3 text-xs"
                >
                  Создать подзадачу
                </Button>
              </div>

              {isSubTicketsOpen && (
                <>
                  {detailsData?.ticket?.subTickets && detailsData.ticket.subTickets.length > 0 ? (
                    <div className="overflow-x-auto rounded-xl border border-border/50">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-muted/15 border-b border-border/50 text-[10px] uppercase font-bold text-muted-foreground">
                            <th className="p-3">Номер</th>
                            <th className="p-3">Заголовок</th>
                            <th className="p-3">Группа</th>
                            <th className="p-3">Ответственный</th>
                            <th className="p-3">Состояние</th>
                            <th className="p-3">Дата создания</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30 text-xs">
                          {detailsData.ticket.subTickets.map((sub) => (
                            <tr
                              key={sub.id}
                              data-tab-path={`/dashboard/tickets/${sub.id}`}
                              onClick={() => navigate(`/dashboard/tickets/${sub.id}`)}
                              className="hover:bg-muted/15 cursor-pointer transition-colors"
                            >
                              <td className="p-3 font-mono font-semibold text-primary">{sub.id}</td>
                              <td className="p-3 font-medium text-foreground max-w-xs truncate">{sub.title}</td>
                              <td className="p-3 text-muted-foreground">{sub.group}</td>
                              <td className="p-3 text-muted-foreground">{sub.owner}</td>
                              <td className="p-3">
                                <span className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold border border-border/30 whitespace-nowrap",
                                  getStateBadgeClass(sub.state)
                                )}>
                                  {sub.state}
                                </span>
                              </td>
                              <td className="p-3 text-muted-foreground font-mono">{sub.createdAt}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                      Нет вложенных заявок
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="bg-card rounded-2xl border border-border/55 p-5 shadow-sm shrink-0 flex flex-col">
            <div className="border-b border-border/40 pb-3 mb-5 shrink-0 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                  Комментарии ({displayArticles.length})
                </h2>
                {allAttachments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setAttachmentsOpen(value => !value)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted/25 px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-primary" />
                    Вложения ({allAttachments.length})
                    {attachmentsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
              {allAttachments.length > 0 && attachmentsOpen && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {allAttachments.map((att) => (
                    <AttachmentPreviewCard
                      key={`${att.articleId}-${att.id}`}
                      ticketId={idNum}
                      attachment={att}
                      onOpen={handleOpenAttachment}
                      onDownload={handleDownload}
                      loading={previewLoadingKey === `${att.articleId}-${att.id}`}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-5">
              {displayArticles.length > 0 ? (
                displayArticles.map((article) => {
                  const isNote = !!article.internal
                  const sender = String(article.sender).toLowerCase()
                  const isAgent = sender === 'agent'
                  // bubbleSide: 'client-right' (default) keeps clients on the right;
                  // 'client-left' puts clients left and our (agent) messages right.
                  const isRightAligned = bubbleSide === 'client-left' ? isAgent : sender === 'customer'
                  const isPending = article.id === PENDING_ARTICLE_ID
                  const isAuto = !isPending && (isAutoReplyArticle(article.body, article.creatorName) || String(article.sender).toLowerCase() === 'system')
                  const isExpanded = !!expandedAutoReplies[article.id]

                  if (isAuto) {
                    const isQuality = article.body.toLowerCase().includes('оценка качества') || article.creatorName.toLowerCase().includes('оценка качества')
                    const label = isQuality 
                      ? 'Системное уведомление: Оценка качества Денвик'
                      : 'Системное уведомление: Автоответ о регистрации заявки'

                    return (
                      <div key={article.id} className="w-full flex flex-col items-center py-1">
                        <button
                          onClick={() => toggleAutoReply(article.id)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100/50 dark:bg-zinc-800/40 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/60 text-[10px] text-zinc-700 dark:text-zinc-300 transition-all duration-100"
                        >
                          <Info className="h-3 w-3 text-sky-500 dark:text-sky-400" />
                          <span>{label}</span>
                          {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 w-full max-w-[88%] rounded-xl border border-zinc-300 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-900/40 p-4 text-sm text-zinc-800 dark:text-zinc-100 leading-6 break-words">
                            <ArticleBody html={article.body} ticketId={idNum} articleId={article.id} onImageOpen={openInlineImage} />
                          </div>
                        )}
                      </div>
                    )
                  }

                  if (chatStyle === 'classic') {
                    return (
                      <div 
                        key={article.id} 
                        className={cn(
                          "w-full rounded-xl border p-4 shadow-sm flex flex-col gap-3",
                          isNote
                            ? "bg-red-50/50 dark:bg-red-950/25 border-red-200/60 dark:border-red-800/40 text-red-950 dark:text-zinc-100"
                            : isAgent
                              ? "bg-blue-50/50 dark:bg-blue-950/30 border-blue-200/60 dark:border-blue-800/40 text-blue-950 dark:text-zinc-100"
                              : "bg-zinc-50/50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/50 text-zinc-900 dark:text-zinc-100"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-between gap-6 border-b pb-2 text-xs text-zinc-500 dark:text-zinc-400",
                          isNote 
                            ? "border-red-200 dark:border-red-900/30" 
                            : "border-zinc-200 dark:border-zinc-700/30"
                        )}>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 overflow-hidden rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200">
                              {article.creatorAvatarDataUrl
                                ? <img src={article.creatorAvatarDataUrl} alt={article.creatorName} className="h-full w-full object-cover" />
                                : article.creatorName.slice(0, 2).toUpperCase()
                              }
                            </div>
                            <span className="font-bold text-zinc-850 dark:text-zinc-300">
                              {article.creatorName}
                            </span>
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-medium",
                              isNote 
                                ? "bg-red-100 dark:bg-red-900/45 text-red-800 dark:text-red-200" 
                                : isAgent 
                                  ? "bg-blue-100 dark:bg-blue-900/45 text-blue-800 dark:text-blue-200" 
                                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300"
                            )}>
                              {isNote ? 'Приватный комментарий' : isAgent ? 'Агент' : 'Клиент'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-zinc-550 dark:text-zinc-400 font-mono">
                            <ChannelIcon channel={isNote ? 'note' : article.type} />
                            <span>{isPending ? <PendingStatus failed={!!pendingComment?.failed} bytes={pendingAttachmentBytes} progress={uploadProgress} /> : formatTicketDate(article.createdAt)}</span>
                          </div>
                        </div>

                        <ArticleBody html={article.body} ticketId={idNum} articleId={article.id} onImageOpen={openInlineImage} />

                        {isPending && !pendingComment?.failed && pendingComment?.uploadId && (
                          <div className="border-t border-border/40 pt-2.5">
                            <Button size="sm" variant="ghost" onClick={cancelUpload} className="h-7 gap-1.5 text-xs text-muted-foreground">
                              <X className="h-3 w-3" />
                              Отменить отправку
                            </Button>
                          </div>
                        )}

                        {isPending && pendingComment?.failed && (
                          <div className="flex items-center gap-2 border-t border-destructive/30 pt-2.5">
                            <Button size="sm" onClick={retryPendingComment} disabled={addCommentMutation.isPending} className="h-7 gap-1.5 text-xs">
                              <RefreshCw className="h-3 w-3" />
                              Повторить
                            </Button>
                            <Button size="sm" variant="ghost" onClick={discardPendingComment} className="h-7 text-xs text-muted-foreground">
                              Вернуть в поле ввода
                            </Button>
                          </div>
                        )}

                        {article.callRecordUrl && (
                          <MiniAudioPlayer url={article.callRecordUrl} isPrivate={isNote} />
                        )}

                        {getVisibleAttachments(article.attachments).length > 0 && (
                          <div className={cn(
                            "border-t mt-2.5 pt-2.5 flex flex-wrap gap-2",
                            isNote ? "border-red-900/30" : "border-zinc-700/30"
                          )}>
                            {getVisibleAttachments(article.attachments).map((att) => (
                              <div key={att.id} className="relative">
                                <AttachmentTile
                                  articleId={article.id}
                                  ticketId={idNum}
                                  attachment={att}
                                  isPrivate={isNote}
                                  onOpen={handleOpenAttachment}
                                  onDownload={handleDownload}
                                />
                                {previewLoadingKey === `${article.id}-${att.id}` && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div 
                      key={article.id} 
                      className={cn(
                        "w-full flex gap-2.5 items-start",
                        isRightAligned ? "justify-end" : "justify-start"
                      )}
                    >
                      {!isRightAligned && (
                        <div className="h-8 w-8 overflow-hidden rounded-full flex items-center justify-center shrink-0 text-xs font-bold bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-600">
                          {article.creatorAvatarDataUrl
                            ? <img src={article.creatorAvatarDataUrl} alt={article.creatorName} className="h-full w-full object-cover" />
                            : article.creatorName.slice(0, 2).toUpperCase()
                          }
                        </div>
                      )}

                      <div 
                        className={cn(
                          "max-w-[88%] rounded-2xl px-5 py-4 border shadow-sm flex flex-col gap-3",
                          isNote
                            ? "bg-red-50/70 dark:bg-red-950/35 border-red-200/60 dark:border-red-900/40 text-red-950 dark:text-zinc-100 rounded-tr-none"
                            : isAgent
                              ? cn("bg-blue-50/70 dark:bg-blue-950/45 border-blue-200/60 dark:border-blue-900/50 text-blue-950 dark:text-zinc-100", isRightAligned ? "rounded-tr-none" : "rounded-tl-none")
                              : cn("bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60 text-zinc-900 dark:text-zinc-100", isRightAligned ? "rounded-tr-none" : "rounded-tl-none")
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-between gap-6 border-b pb-2 text-xs text-zinc-550 dark:text-zinc-400",
                          isNote ? "border-red-200 dark:border-red-900/30" : "border-zinc-200 dark:border-zinc-700/30"
                        )}>
                          <div className="flex items-center gap-1.5 font-bold">
                            <ChannelIcon channel={isNote ? 'note' : article.type} />
                            <span className="text-zinc-850 dark:text-zinc-300">
                              {article.creatorName}
                              {isNote && <span className="text-amber-500 dark:text-amber-400 font-semibold ml-1">(Внутренняя заметка)</span>}
                            </span>
                          </div>
                          <span className="font-mono">{isPending ? <PendingStatus failed={!!pendingComment?.failed} bytes={pendingAttachmentBytes} progress={uploadProgress} /> : formatTicketDate(article.createdAt)}</span>
                        </div>

                        <ArticleBody html={article.body} ticketId={idNum} articleId={article.id} onImageOpen={openInlineImage} />

                        {isPending && pendingComment?.failed && (
                          <div className="flex items-center gap-2 border-t border-destructive/30 pt-2.5">
                            <Button size="sm" onClick={retryPendingComment} disabled={addCommentMutation.isPending} className="h-7 gap-1.5 text-xs">
                              <RefreshCw className="h-3 w-3" />
                              Повторить
                            </Button>
                            <Button size="sm" variant="ghost" onClick={discardPendingComment} className="h-7 text-xs text-muted-foreground">
                              Вернуть в поле ввода
                            </Button>
                          </div>
                        )}

                        {article.callRecordUrl && (
                          <MiniAudioPlayer url={article.callRecordUrl} isPrivate={isNote} />
                        )}

                        {getVisibleAttachments(article.attachments).length > 0 && (
                          <div className={cn(
                            "border-t mt-2.5 pt-2.5 flex flex-wrap gap-2",
                            isNote ? "border-red-200 dark:border-red-900/30" : "border-zinc-200 dark:border-zinc-700/30"
                          )}>
                            {getVisibleAttachments(article.attachments).map((att) => (
                              <div key={att.id} className="relative">
                                <AttachmentTile
                                  articleId={article.id}
                                  ticketId={idNum}
                                  attachment={att}
                                  isPrivate={isNote}
                                  onOpen={handleOpenAttachment}
                                  onDownload={handleDownload}
                                />
                                {previewLoadingKey === `${article.id}-${att.id}` && (
                                  <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50">
                                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {isRightAligned && (
                        <div className="h-8 w-8 overflow-hidden rounded-full flex items-center justify-center shrink-0 text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
                          {article.creatorAvatarDataUrl
                            ? <img src={article.creatorAvatarDataUrl} alt={article.creatorName} className="h-full w-full object-cover" />
                            : article.creatorName.slice(0, 2).toUpperCase()
                          }
                        </div>
                      )}
                    </div>
                  )
                })
              ) : !pendingComment ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <p className="text-xs">Нет комментариев к заявке</p>
                </div>
              ) : null}

            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/55 p-5 shadow-sm shrink-0 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <StickyNote className="h-3.5 w-3.5 text-primary" />
                Новый комментарий
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <CustomSelect
                    value={selectedArticleType}
                    options={ARTICLE_TYPE_OPTIONS}
                    onChange={type => setCommentArticleType(String(type.id))}
                    placeholder={getArticleTypeLabel(selectedArticleType)}
                  />
                </div>
                <CustomToggle checked={commentInternal} onChange={setCommentInternal} label="Приватно" />
              </div>
            </div>

            <div className="relative">
              <textarea
                ref={commentTextareaRef}
                value={commentBody}
                onChange={event => setCommentBody(event.target.value)}
                onPaste={handleCommentPaste}
                placeholder="Напишите комментарий..."
                spellCheck
                className="min-h-32 w-full resize-y rounded-lg border border-border bg-muted/25 px-3 py-2 pr-9 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
              />
              <AiAssistButton text={commentBody} onTextChange={setCommentBody} />
            </div>

            {commentAttachments.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {commentAttachments.map(attachment => {
                  const kind = getAttachmentKind(attachment)
                  const isImage = kind === 'image'
                  return (
                    <div
                      key={attachment.id}
                      className="group flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/20 p-2"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-background/40">
                        {isImage ? (
                          <img src={attachment.dataUrl} alt={attachment.filename} className="h-full w-full object-cover" />
                        ) : kind === 'archive' ? (
                          <FileArchive className="h-5 w-5 text-amber-400" />
                        ) : kind === 'file' ? (
                          <FileText className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <FileImage className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-foreground">{attachment.filename}</p>
                        <p className="text-[11px] text-muted-foreground">{formatAttachmentSize(attachment.size) || attachment.mimeType}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCommentAttachment(attachment.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-70 transition-colors hover:bg-accent hover:text-foreground group-hover:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-end gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileInputChange}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={addCommentMutation.isPending}
                className="h-9 gap-2"
              >
                <Paperclip className="h-4 w-4" />
                Прикрепить
              </Button>
              <div className="relative flex items-center shrink-0" ref={macroDropdownRef}>
                <Button
                  onClick={openTimeModal}
                  disabled={addCommentMutation.isPending}
                  className="h-9 gap-2 rounded-r-none border-r border-primary-foreground/10"
                >
                  <Send className="h-4 w-4" />
                  Отправить
                </Button>
                <Button
                  type="button"
                  disabled={addCommentMutation.isPending}
                  onClick={() => setIsMacroDropdownOpen(prev => !prev)}
                  className="h-9 px-2 rounded-l-none border-l-0"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                {isMacroDropdownOpen && (
                  <div className="absolute bottom-full right-0 mb-1.5 z-50 w-80 max-h-80 rounded-xl border border-border bg-card p-1 shadow-2xl flex flex-col gap-1">
                    <div className="relative p-1">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        ref={macroSearchInputRef}
                        type="text"
                        value={macroSearchQuery}
                        onChange={e => setMacroSearchQuery(e.target.value)}
                        placeholder="Поиск макроса..."
                        className="w-full rounded border border-border bg-muted/40 pl-8 pr-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-60 flex flex-col gap-0.5 pr-0.5">
                      {macros
                        .filter(m => {
                          const q = macroSearchQuery.toLowerCase().trim()
                          return m.label.toLowerCase().includes(q) || (m.bodyText && m.bodyText.toLowerCase().includes(q))
                        })
                        .map(macro => (
                          <button
                            key={macro.id}
                            type="button"
                            onClick={() => {
                              applyMacro(macro)
                              setIsMacroDropdownOpen(false)
                              setMacroSearchQuery('')
                            }}
                            className={cn(
                              "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors flex items-center min-w-0 border-l-2",
                              macro.colorClass && !macro.colorClass.startsWith('#') ? macro.colorClass : 'border-primary/40'
                            )}
                            style={macro.colorClass && macro.colorClass.startsWith('#') ? {
                              borderLeftColor: macro.colorClass,
                              backgroundColor: `${macro.colorClass}0a`
                            } : undefined}
                          >
                            <span className="font-medium text-foreground truncate">{macro.label}</span>
                          </button>
                        ))
                      }
                      {macros.filter(m => {
                        const q = macroSearchQuery.toLowerCase().trim()
                        return m.label.toLowerCase().includes(q) || (m.bodyText && m.bodyText.toLowerCase().includes(q))
                      }).length === 0 && (
                        <div className="text-[10px] text-muted-foreground text-center py-3">
                          Макросы не найдены
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
          </div>
          <AnimatePresence>
            {!hideScrollDownArrow && showScrollDown && previewItems.length === 0 && (
              <motion.button
                type="button"
                onClick={scrollTicketToBottom}
                initial={{ opacity: 0, y: 10, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.92 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="fixed bottom-6 left-[62px] z-[60] flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-card/95 text-primary shadow-xl shadow-black/20 backdrop-blur transition-colors hover:bg-primary hover:text-primary-foreground"
                aria-label="Прокрутить вниз"
              >
                <ArrowDown className="h-4 w-4" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <div className="min-h-0 overflow-y-auto flex flex-col gap-4">
          <div className="bg-card rounded-2xl border border-border/55 p-4 shadow-sm flex flex-col gap-3.5">
            <div className="mb-1 flex items-center justify-between relative">
              <h2 className="text-xs font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Параметры заявки
              </h2>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTicketMetaOpen(value => !value)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/45 hover:text-foreground"
                  title="ID и номера заявки"
                >
                  {ticketMetaOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {ticketMetaOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1.5 rounded-lg border border-border bg-muted/15 p-3">
                    {([
                      { key: 'zammad', label: 'Zammad №', value: ticket.number },
                      { key: 'clients', label: 'Clients ID', value: ticket.clientNumber || String(ticket.id) }
                    ] as { key: string; label: string; value: string | null }[]).map(({ key, label, value }) => (
                      <div key={key} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
                          <span className="block truncate font-mono text-xs font-semibold text-foreground">{value || '—'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyTicketMeta(key, value)}
                          disabled={!value}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                          title="Скопировать"
                        >
                          {copiedTicketMeta === key ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    ))}
                    <div className="mt-1 border-t border-border/40 pt-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={copyClientsLink}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          {copiedClientsLink ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-primary" />}
                        </span>
                        {copiedClientsLink ? 'Ссылка скопирована!' : 'Скопировать ссылку'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setHistoryModalOpen(true); setTicketMetaOpen(false) }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                        </span>
                        История изменений
                      </button>
                      {!detailsData?.customer?.organization_id && detailsData?.customer && (
                        <button
                          type="button"
                          onClick={() => {
                            setLinkOrgModalOpen(true)
                            setTicketMetaOpen(false)
                          }}
                          className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                        >
                          <span className="flex w-4 items-center justify-center shrink-0">
                            <Building className="h-3.5 w-3.5 text-primary" />
                          </span>
                          Привязать к организации
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setChangeCustomerModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <UserCheck className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Сменить клиента
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditCustomerModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <UserCog className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Изменить профиль
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMergeModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <GitMerge className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Объединить заявку
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreateSubTicketModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <PlusCircle className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Создать подзадачу
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setExportModalOpen(true)
                          setTicketMetaOpen(false)
                        }}
                        className="flex w-full items-center justify-start gap-3 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                      >
                        <span className="flex w-4 items-center justify-center shrink-0">
                          <FileDown className="h-3.5 w-3.5 text-primary" />
                        </span>
                        Сохранить выгрузку задачи
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Тип заявки</span>
              <CustomSelect
                value={ticketTypeId}
                options={ticketTypeOptions}
                onChange={type => setTicketTypeId(String(type.id))}
                placeholder="Выберите тип"
                renderValue={type => type ? (
                  <span className={cn("inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium", getTicketTypeBadgeClass(String(type.id), type.name))}>
                    <span className="truncate">{type.name}</span>
                  </span>
                ) : <span className="text-muted-foreground">Выберите тип</span>}
                renderOption={type => (
                  <span className={cn("inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium", getTicketTypeBadgeClass(String(type.id), type.name))}>
                    <span className="truncate">{type.name}</span>
                  </span>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Состояние</span>
              <CustomSelect
                value={commentStateId}
                options={stateOptions}
                onChange={state => setCommentStateId(Number(state.id))}
                placeholder={ticket.state.name || 'Выберите состояние'}
                renderValue={state => state ? (
                  <span
                    className={cn(
                      "inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      !filtersData?.stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                    )}
                    style={filtersData?.stateColors?.[Number(state.id)] ? {
                      backgroundColor: `${filtersData.stateColors[Number(state.id)]}15`,
                      color: filtersData.stateColors[Number(state.id)],
                      borderColor: `${filtersData.stateColors[Number(state.id)]}30`
                    } : undefined}
                  >
                    <span className="truncate">{state.name}</span>
                  </span>
                ) : <span className="text-muted-foreground">Выберите состояние</span>}
                renderOption={state => (
                  <span
                    className={cn(
                      "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      !filtersData?.stateColors?.[Number(state.id)] && getStateBadgeClass(state.name)
                    )}
                    style={filtersData?.stateColors?.[Number(state.id)] ? {
                      backgroundColor: `${filtersData.stateColors[Number(state.id)]}15`,
                      color: filtersData.stateColors[Number(state.id)],
                      borderColor: `${filtersData.stateColors[Number(state.id)]}30`
                    } : undefined}
                  >
                    <span className="truncate">{state.name}</span>
                  </span>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">В ожидании до</span>
              <CustomDateTimePicker value={commentPendingTime} onChange={setCommentPendingTime} />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Группа обслуживания</span>
              <CustomSelect
                value={groupId}
                options={groupOptions}
                onChange={group => setGroupId(Number(group.id))}
                placeholder="Выберите группу"
                searchable
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Ответственный</span>
              <div className="grid grid-cols-[1fr_36px] gap-2">
                <CustomSelect
                  value={ownerId}
                  options={ownerOptions}
                  onChange={owner => setOwnerId(Number(owner.id))}
                  placeholder="Не назначен"
                  searchable
                />
                <button
                  type="button"
                  onClick={() => currentUser?.id && setOwnerId(currentUser.id)}
                  disabled={!currentUser?.id}
                  title="Взять на себя"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/20 disabled:text-muted-foreground"
                >
                  <Hand className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Приоритет</span>
              <CustomSelect
                value={priorityId}
                options={priorityOptions}
                onChange={priority => setPriorityId(Number(priority.id))}
                placeholder="Выберите приоритет"
                renderValue={priority => priority ? (
                  <span className="flex items-center gap-2">
                    <PriorityCircles name={priority.name} />
                    <span className="truncate">{priority.name}</span>
                  </span>
                ) : <span className="text-muted-foreground">Выберите приоритет</span>}
                renderOption={priority => (
                  <span className="flex items-center gap-2">
                    <PriorityCircles name={priority.name} />
                    <span className="truncate">{priority.name}</span>
                  </span>
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Причина обращения (IIKO)</span>
              <CustomMultiSelect
                values={iikoReasonIds}
                options={iikoReasonOptions}
                onChange={reasons => setIikoReasonIds(reasons.map(reason => String(reason.id)))}
                placeholder="Выберите причину"
                renderChip={reason => <span className="truncate text-sky-700 dark:text-sky-300">{reason.name}</span>}
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Теги</span>
              <CustomMultiSelect
                values={tagIds}
                options={tagOptions}
                onChange={tags => setTagIds(tags.map(tag => String(tag.id)))}
                placeholder="Выберите теги"
                renderChip={tag => <span className="truncate text-violet-700 dark:text-violet-300">{tag.name}</span>}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/15 p-2">
                <span className="text-[10px] text-muted-foreground">Баллы</span>
                {canEditScore ? (
                  <div className="flex items-center gap-1">
                    {scoreSaving
                      ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-yellow-500" />
                      : <Award className="h-3.5 w-3.5 shrink-0 text-yellow-500" />}
                    <div className={cn('min-w-0 flex-1 transition-opacity', scoreSaving && 'pointer-events-none opacity-60')}>
                      <CustomSelect
                        value={(pendingScore ?? scoreValue) ?? ''}
                        options={scoreOptions.map(option => ({ id: option.value, name: option.label }))}
                        onChange={option => handleScoreChange(String(option.id))}
                        placeholder="Без оценки"
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-yellow-500" />
                    {ticket.score !== null && ticket.score !== undefined ? formatScore(ticket.score) : '—'}
                  </span>
                )}
                {scoreError && <span className="text-[10px] leading-tight text-destructive">{scoreError}</span>}
              </div>
              <div className="flex flex-col gap-1 rounded-md border border-border bg-muted/15 p-2">
                <span className="text-[10px] text-muted-foreground">Учётное время</span>
                <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/75" />
                  {ticket.accountedTime !== null && ticket.accountedTime !== undefined ? `${ticket.accountedTime} мин` : '—'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Создана</span>
              <span className="text-xs font-medium text-foreground font-mono flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                {formatTicketDate(ticket.createdAt)}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted-foreground">Обновлена</span>
              <span className="text-xs font-medium text-foreground font-mono flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/75" />
                {formatTicketDate(ticket.updatedAt)}
              </span>
            </div>

            {ticket.pendingTime && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-muted-foreground">Отложено до</span>
                <span className="text-xs font-medium text-foreground font-mono flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground/75" />
                  {formatTicketDate(ticket.pendingTime)}
                </span>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border/55 p-4 shadow-sm flex flex-col gap-2">
            <h2 className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 mb-1">
              <Building className="h-3.5 w-3.5" />
              Интеграции
            </h2>
            {[
              {
                label: 'Заведено в ERP',
                value: ticket.checkInErp === true ? 'Да' : ticket.checkInErp === false ? 'Нет' : null,
                accent: ticket.checkInErp === true ? 'text-emerald-400' : undefined
              },
              { label: 'Счёт ERP', value: ticket.erpBill ?? null, accent: undefined },
              { label: 'Сделка Битрикс24', value: ticket.bitrixDeal ?? null, accent: undefined },
              { label: 'Стоимость задачи (IIKO)', value: ticket.iikoCost ?? null, accent: undefined }
            ].map(({ label, value, accent }) => (
              <div key={label} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/10 px-2.5 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">{label}</span>
                <span className={cn(
                  'text-xs font-semibold truncate text-right',
                  value ? (accent ?? 'text-foreground') : 'text-muted-foreground/30'
                )}>
                  {value ?? '—'}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
      <AnimatePresence>
        {selectedOrgId && detailsData?.organization && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedOrgId(null)}
              className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="absolute right-0 top-0 bottom-0 z-30 w-[450px] border-l border-border bg-card flex flex-col shadow-2xl"
            >
              <div className="p-5 border-b border-border flex items-center justify-between bg-card shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <Building className="h-5 w-5 text-primary shrink-0" />
                  <h3 className="font-semibold text-sm truncate" title={detailsData.organization.name}>
                    {detailsData.organization.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedOrgId(null)}
                  className="h-6 w-6 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex border-b border-border px-4 shrink-0 bg-muted/20">
                {(['info', 'members', 'tickets'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'px-4 py-2.5 text-xs font-semibold border-b-2 -mb-px transition-colors duration-150',
                      activeTab === tab
                        ? 'border-primary text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab === 'info' && 'Информация'}
                    {tab === 'members' && (orgMembersLoading ? 'Сотрудники' : `Сотрудники (${orgMembers.length})`)}
                    {tab === 'tickets' && (orgTicketsLoading ? 'Заявки' : `Заявки (${orgTickets.length})`)}
                  </button>
                ))}
              </div>

              <div className="p-5 flex-1 overflow-y-auto min-h-0 space-y-5">
                {activeTab === 'info' && (
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground">Группа обслуживания</span>
                        <span className="font-medium text-foreground">{detailsData.organization.responsible_group || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground">Менеджер</span>
                        <span className="font-medium text-foreground">{detailsData.organization.manager || '—'}</span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground">Задолженность</span>
                        <span className={cn('font-semibold', detailsData.organization.sum_debt > 0 ? 'text-destructive' : 'text-green-500')}>
                          {new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(detailsData.organization.sum_debt || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                        <span className="text-muted-foreground">Остаток на депозите (мин)</span>
                        <span className="font-medium text-foreground tabular-nums">
                          {detailsData.organization.deposit_balance_minutes !== null && detailsData.organization.deposit_balance_minutes !== undefined
                            ? new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(detailsData.organization.deposit_balance_minutes)
                            : '—'
                          }
                        </span>
                      </div>
                      {detailsData.organization.link_wiki && (
                        <div className="flex justify-between text-xs py-1.5 border-b border-border/30">
                          <span className="text-muted-foreground">Wiki</span>
                          <a
                            href={detailsData.organization.link_wiki}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-primary hover:underline flex items-center gap-1"
                          >
                            Открыть <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    {detailsData.organization.note && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold text-muted-foreground">Заметки</h4>
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                          {detailsData.organization.note}
                        </div>
                      </div>
                    )}

                    {(detailsData.organization.contracts || detailsData.organization.contracts_and_comments) && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold text-muted-foreground">Договоры и комментарии</h4>
                        <div className="rounded-lg border border-border/40 bg-muted/20 p-3 text-xs leading-relaxed whitespace-pre-wrap">
                          {[detailsData.organization.contracts, detailsData.organization.contracts_and_comments].filter(Boolean).join('\n\n')}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'members' && (
                  <div className="space-y-3">
                    {orgMembersLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-3 animate-pulse">
                          <div className="h-3 w-2/3 bg-muted/80 rounded mb-2" />
                          <div className="h-2 w-1/2 bg-muted/80 rounded" />
                        </div>
                      ))
                    ) : orgMembers.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                        Нет зарегистрированных сотрудников
                      </div>
                    ) : (
                      orgMembers.map((member) => (
                        <div
                          key={member.id}
                          className="rounded-xl border border-border/30 bg-muted/10 p-3 space-y-1.5 hover:border-border transition-colors duration-100"
                        >
                          <div className="flex items-center gap-1.5 text-xs font-medium">
                            <User className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                            <span>{member.firstname} {member.lastname}</span>
                          </div>
                          {member.email && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate select-all">{member.email}</span>
                            </div>
                          )}
                          {(member.phone || member.mobile) && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate select-all">{member.phone || member.mobile}</span>
                            </div>
                          )}
                          {member.department && (
                            <div className="text-[11px] text-muted-foreground">
                              Отдел: <span className="select-all text-foreground/80">{member.department}</span>
                            </div>
                          )}
                          {member.max && (
                            <div className="text-[11px] text-muted-foreground">
                              MAX: <span className="select-all text-foreground/80">{member.max}</span>
                            </div>
                          )}
                          {member.telegram && (
                            <div className="text-[11px] text-muted-foreground">
                              Telegram: <span className="select-all text-foreground/80">{member.telegram}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'tickets' && (
                  <div className="space-y-3">
                    {!orgTicketsLoading && orgTickets.length > 0 && (
                      <div className="space-y-2 pb-2 border-b border-border/30">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                          <input
                            type="search"
                            value={orgTicketsSearch}
                            onChange={(e) => setOrgTicketsSearch(e.target.value)}
                            placeholder="Поиск по теме или номеру..."
                            className="h-8 w-full rounded-md border border-border bg-muted/30 pl-8 pr-3 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-1.5 items-center">
                          <div className="relative flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => setIsOwnerDropdownOpen(!isOwnerDropdownOpen)}
                              className="w-full text-left rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/60 truncate min-h-[26px]"
                            >
                              {orgTicketsOwner === 'all' ? 'Все ответственные' : orgTicketsOwner}
                            </button>
                            {isOwnerDropdownOpen && (
                              <div className="absolute left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-2xl flex flex-col gap-1">
                                <input
                                  type="text"
                                  value={ownerSearchQuery}
                                  onChange={e => setOwnerSearchQuery(e.target.value)}
                                  placeholder="Поиск ответственного..."
                                  className="w-full rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/60"
                                  onClick={e => e.stopPropagation()}
                                />
                                <div className="overflow-y-auto max-h-36 flex flex-col gap-0.5 pr-0.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOrgTicketsOwner('all')
                                      setIsOwnerDropdownOpen(false)
                                      setOwnerSearchQuery('')
                                    }}
                                    className={cn(
                                      "w-full text-left px-1.5 py-1 text-[10px] rounded hover:bg-accent transition-colors flex items-center min-w-0",
                                      orgTicketsOwner === 'all' && "bg-primary/10 text-primary font-semibold"
                                    )}
                                  >
                                    <span className="truncate w-full">Все ответственные</span>
                                  </button>
                                  {allAvailableOwners
                                    .filter(ownerName => ownerName.toLowerCase().includes(ownerSearchQuery.toLowerCase().trim()))
                                    .map(ownerName => (
                                      <button
                                        key={ownerName}
                                        type="button"
                                        onClick={() => {
                                          setOrgTicketsOwner(ownerName)
                                          setIsOwnerDropdownOpen(false)
                                          setOwnerSearchQuery('')
                                        }}
                                        className={cn(
                                          "w-full text-left px-1.5 py-1 text-[10px] rounded hover:bg-accent transition-colors flex items-center min-w-0",
                                          orgTicketsOwner === ownerName && "bg-primary/10 text-primary font-semibold"
                                        )}
                                      >
                                        <span className="truncate w-full">{ownerName}</span>
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                          <select
                            value={orgTicketsState}
                            onChange={(e) => setOrgTicketsState(e.target.value)}
                            className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/60 min-h-[26px]"
                          >
                            <option value="all" className="bg-card">Все состояния</option>
                            {uniqueStates.map((state) => (
                              <option key={state} value={state} className="bg-card">
                                {state}
                              </option>
                            ))}
                          </select>
                          <select
                            value={orgTicketsDate}
                            onChange={(e) => setOrgTicketsDate(e.target.value)}
                            className="flex-1 min-w-0 rounded-md border border-border bg-muted/30 px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary/60 min-h-[26px]"
                          >
                            <option value="all" className="bg-card">За всё время</option>
                            <option value="today" className="bg-card">За сегодня</option>
                            <option value="week" className="bg-card">За неделю</option>
                            <option value="month" className="bg-card">За месяц</option>
                            <option value="year" className="bg-card">За год</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {orgTicketsLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="rounded-xl border border-border/30 bg-muted/10 p-3 animate-pulse">
                            <div className="h-3.5 w-1/4 bg-muted/80 rounded mb-2" />
                            <div className="h-4 w-3/4 bg-muted/80 rounded mb-2.5" />
                            <div className="h-3 w-1/3 bg-muted/80 rounded" />
                          </div>
                        ))
                      ) : orgTickets.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                          Заявки не найдены
                        </div>
                      ) : filteredOrgTickets.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                          Нет заявок, соответствующих фильтрам
                        </div>
                      ) : (
                        filteredOrgTickets.map((t) => {
                          const stateColor = filtersData?.stateColors?.[t.state.id]
                          const stateBadgeStyle = stateColor ? {
                            backgroundColor: `${stateColor}15`,
                            color: stateColor,
                            borderColor: `${stateColor}30`,
                            borderWidth: '1px'
                          } : undefined

                          return (
                            <div
                              key={t.id}
                              data-tab-path={`/dashboard/tickets/${t.id}`}
                              onClick={() => {
                                setSelectedOrgId(null)
                                navigate(`/dashboard/tickets/${t.id}`)
                              }}
                              className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-all duration-100 group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  #{t.clientNumber || t.id}
                                </span>
                                <span
                                  style={stateBadgeStyle}
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.2 text-[9px] font-medium border border-border/30 whitespace-nowrap",
                                    !stateColor && getStateBadgeClass(t.state.name)
                                  )}
                                >
                                  {t.state.name}
                                </span>
                              </div>
                              <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-relaxed">
                                {t.title}
                              </h4>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{formatTicketDate(t.createdAt)}</span>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
        {mergeModalOpen && (
          <MergeTicketModal
            ticketId={idNum}
            ticketNumber={String(ticket.clientNumber || ticket.id)}
            ticketTitle={ticket.title}
            onClose={() => setMergeModalOpen(false)}
            onMerged={target => {
              queryClient.invalidateQueries({ queryKey: ['tickets'] })
              queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
              navigate(`/dashboard/tickets/${target.id}`)
            }}
          />
        )}

        {changeCustomerModalOpen && (
          <ChangeCustomerModal
            ticketId={idNum}
            organization={detailsData?.organization}
            onClose={() => setChangeCustomerModalOpen(false)}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })}
          />
        )}

        {editCustomerModalOpen && detailsData?.customer && (
          <EditCustomerModal
            customer={detailsData.customer}
            organization={detailsData.organization}
            ticketId={idNum}
            onClose={() => setEditCustomerModalOpen(false)}
            onSaved={() => queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })}
          />
        )}

        {linkOrgModalOpen && detailsData?.customer && (
          <LinkOrganizationModal
            customerId={detailsData.customer.id}
            ticketId={idNum}
            currentOrganization={detailsData.organization}
            onClose={() => setLinkOrgModalOpen(false)}
            onLinked={() => queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })}
          />
        )}

        {exportModalOpen && (
          <TicketExportModal
            ticketId={idNum}
            onClose={() => setExportModalOpen(false)}
          />
        )}

        {createSubTicketModalOpen && (
          <CreateSubTicketModal
            parent={ticket}
            ticketTypeOptions={ticketTypeOptions}
            groupOptions={groupOptions}
            ownerOptions={ownerOptions}
            priorityOptions={priorityOptions}
            stateOptions={stateOptions}
            stateColors={filtersData?.stateColors}
            onClose={() => setCreateSubTicketModalOpen(false)}
            onCreated={newTicketId => {
              queryClient.invalidateQueries({ queryKey: ['ticket-details', idNum] })
              if (newTicketId && openCreatedTicket) navigate(`/dashboard/tickets/${newTicketId}`)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
