import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { AiAssistButton } from '@/components/ai/AiAssistButton'
import { readCommentDraft, writeCommentDraft } from '@/lib/commentDrafts'

/**
 * Поле ввода комментария вместе с его текстом.
 *
 * Текст намеренно живёт здесь, а не на странице заявки. Пока он был состоянием
 * страницы, каждая нажатая клавиша перерисовывала её целиком — переписку, правую
 * панель, чек-лист, вложения, — и набор текста заметно отставал от клавиатуры,
 * особенно на зажатой букве. Теперь нажатие перерисовывает только это поле.
 *
 * Странице текст всё-таки нужен: при отправке, при вставке макроса, при возврате
 * неушедшего сообщения. Поэтому наружу торчит не состояние, а несколько команд —
 * их вызывают в обработчиках, а не на отрисовке.
 */

export interface CommentInputHandle {
  /** Текст поля на сейчас. */
  getValue: () => string
  /** Заменить текст: строкой или функцией от текущего значения. */
  setValue: (next: string | ((current: string) => string)) => void
  focus: () => void
}

interface CommentInputProps {
  ticketId: number
  /** Выжимка переписки для помощника правки — считается при нажатии на него. */
  getAiContext: () => string
  /** Файлы, вставленные в поле из буфера обмена. */
  onFilesPasted: (files: File[]) => void
}

export const CommentInput = forwardRef<CommentInputHandle, CommentInputProps>(function CommentInput(
  { ticketId, getAiContext, onFilesPasted },
  ref
) {
  const [value, setValue] = useState(() => readCommentDraft(ticketId))
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  // Команды снаружи должны видеть текст на момент вызова, а не на момент, когда
  // их создали, — поэтому значение дублируется ссылкой.
  const valueRef = useRef(value)
  valueRef.current = value

  useImperativeHandle(ref, () => ({
    getValue: () => valueRef.current,
    setValue: next => setValue(next),
    focus: () => textareaRef.current?.focus()
  }), [])

  // Сохраняется с задержкой, чтобы каждая клавиша не ходила на диск.
  useEffect(() => {
    const timer = window.setTimeout(() => writeCommentDraft(ticketId, value), 400)
    return () => window.clearTimeout(timer)
  }, [ticketId, value])

  const insertAtCursor = (text: string) => {
    if (!text) return
    const textarea = textareaRef.current
    if (!textarea) {
      setValue(current => `${current}${text}`)
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    setValue(current => `${current.slice(0, start)}${text}${current.slice(end)}`)
    window.requestAnimationFrame(() => {
      const cursor = start + text.length
      textarea.focus()
      textarea.setSelectionRange(cursor, cursor)
    })
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files)
    if (files.length === 0) return
    event.preventDefault()
    insertAtCursor(event.clipboardData.getData('text/plain'))
    onFilesPasted(files)
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={event => setValue(event.target.value)}
        onPaste={handlePaste}
        placeholder="Напишите комментарий..."
        spellCheck
        className="min-h-32 w-full resize-y rounded-lg border border-border bg-muted/25 px-3 py-2 pr-9 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground focus:border-primary/60"
      />
      <AiAssistButton text={value} onTextChange={setValue} ticketContext={getAiContext} />
    </div>
  )
})
