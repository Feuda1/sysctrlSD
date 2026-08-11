import { AnimatePresence, motion } from 'framer-motion'

/**
 * Тонкая полоска поверх заявки, пока изменение уходит на сервер. Перевод
 * статуса или смена ответственного применялись молча, и понять, идёт ли что-то,
 * было невозможно — оставалось ждать и гадать.
 *
 * Живёт только внутри заявки: в списках и на других экранах такой шум не нужен.
 */
export function TicketBusyBar({ busy, label }: { busy: boolean; label: string }) {
  return (
    <AnimatePresence>
      {busy && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-center"
        >
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-primary/15">
            {/* Сколько осталось, никто не знает — поэтому полоска бегущая, а не по проценту. */}
            <motion.div
              className="h-full w-1/3 rounded-full bg-primary"
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <span className="mt-1.5 select-none rounded-full border border-border bg-card/95 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur">
            {label}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
