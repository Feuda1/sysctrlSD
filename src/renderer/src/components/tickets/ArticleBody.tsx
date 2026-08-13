import { memo, useEffect, useMemo, useRef } from 'react'
import { cn } from '@/lib/utils'
import { cleanBody } from '@/lib/ticketFormat'

/** Renders an article body: sanitises inline styles, resolves attachment images
 * and makes every picture open in the media viewer.
 *
 * Обёрнут в memo и считает разметку через useMemo не для красоты: cleanBody
 * поднимает целый DOM через DOMParser и обходит каждый элемент. Пока это шло на
 * каждую отрисовку страницы, набор текста в поле комментария перезапускал разбор
 * всех сообщений заявки на каждую нажатую клавишу - отсюда и рывки. */

export const ArticleBody = memo(function ArticleBody({ html, ticketId, articleId, className, onImageOpen }: { html: string; ticketId: number; articleId: number; className?: string; onImageOpen?: (dataUrl: string, filename: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onImageOpenRef = useRef(onImageOpen)
  onImageOpenRef.current = onImageOpen
  const cleanedHtml = useMemo(() => cleanBody(html), [html])

  useEffect(() => {
    if (!containerRef.current) return

    const imgs = containerRef.current.querySelectorAll('img')
    imgs.forEach(async (img) => {
      const src = img.getAttribute('src')
      if (!src) return

      // Make every image zoomable - clicking opens it in the media viewer.
      img.style.cursor = 'zoom-in'
      if (!img.dataset.viewerBound) {
        img.dataset.viewerBound = '1'
        img.addEventListener('click', () => {
          if (img.src) onImageOpenRef.current?.(img.src, img.getAttribute('alt') || 'Изображение')
        })
      }

      let tId = ticketId
      let aId = articleId
      let attId = 0
      let isMatch = false

      const taMatch = src.match(/\/ticket_attachment\/(\d+)\/(\d+)\/(\d+)/)
      if (taMatch) {
        tId = parseInt(taMatch[1], 10)
        aId = parseInt(taMatch[2], 10)
        attId = parseInt(taMatch[3], 10)
        isMatch = true
      } else {
        const mimeMatch = src.match(/\/mime_attachment\/(\d+)\/(\d+)/)
        if (mimeMatch) {
          aId = parseInt(mimeMatch[1], 10)
          attId = parseInt(mimeMatch[2], 10)
          isMatch = true
        }
      }

      if (isMatch && attId > 0) {
        try {
          const result = await window.api.tickets.getAttachment(tId, aId, attId)
          if (result && result.dataUrl) {
            img.src = result.dataUrl
          }
        } catch (err) {
          console.error('Ошибка загрузки inline-изображения:', err)
        }
      }
    })
  }, [html, ticketId, articleId])

  return (
    <div 
      ref={containerRef}
      className={cn(
        "select-text prose prose-sm dark:prose-invert max-w-none text-sm text-zinc-800 dark:text-zinc-100 break-words leading-6",
        "[&_*]:!bg-transparent [&_*]:!text-inherit [&_a]:!text-primary [&_table]:!border-border [&_td]:!border-border [&_th]:!border-border",
        className
      )}
      dangerouslySetInnerHTML={{ __html: cleanedHtml }}
    />
  )
})
