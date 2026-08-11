import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

/**
 * Показывает, что изменение заявки уходит на сервер. Перевод статуса или смена
 * ответственного применялись молча, и понять, идёт ли что-то, было нельзя, пока
 * оно само не появлялось на экране.
 *
 * Стоит в шапке заявки, рядом с кнопкой возврата: плашка поверх переписки
 * перекрывала сообщения. Живёт только внутри заявки — в списках такой шум ни к
 * чему.
 */
export function TicketBusyBar({ busy, label }: { busy: boolean; label: string }) {
  return (
    <AnimatePresence>
      {busy && (
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 8 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="flex select-none items-center gap-2 overflow-hidden rounded-xl border border-primary/25 bg-primary/5 px-2.5 py-1.5"
        >
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="h-0.5 w-16 shrink-0 overflow-hidden rounded-full bg-primary/20">
            {/* Сколько осталось, никто не знает — полоска бегущая, а не по проценту. */}
            <motion.span
              className="block h-full w-1/3 rounded-full bg-primary"
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
