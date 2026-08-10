import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useUIStore } from '@/store/ui'
import { Switch } from './SettingsControls'

export function SecretToggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}

export function SecretSettingsModal({ onClose }: { onClose: () => void }) {
  const allowTicketPendingWithoutReason = useUIStore(s => s.allowTicketPendingWithoutReason)
  const setAllowTicketPendingWithoutReason = useUIStore(s => s.setAllowTicketPendingWithoutReason)
  const allowTicketStatusWithoutPublicComment = useUIStore(s => s.allowTicketStatusWithoutPublicComment)
  const setAllowTicketStatusWithoutPublicComment = useUIStore(s => s.setAllowTicketStatusWithoutPublicComment)
  const allowScoreWithoutClientsRight = useUIStore(s => s.allowScoreWithoutClientsRight)
  const setAllowScoreWithoutClientsRight = useUIStore(s => s.setAllowScoreWithoutClientsRight)

  return (
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
          <h3 className="text-sm font-semibold text-foreground">Секретные настройки</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2">
          <SecretToggle
            checked={allowTicketPendingWithoutReason}
            onChange={setAllowTicketPendingWithoutReason}
            label="Закрывать без причины обращения"
          />
          <SecretToggle
            checked={allowTicketStatusWithoutPublicComment}
            onChange={setAllowTicketStatusWithoutPublicComment}
            label="Откладывать без комментария"
          />
          <SecretToggle
            checked={allowScoreWithoutClientsRight}
            onChange={setAllowScoreWithoutClientsRight}
            label="Игнорировать запрет clients на баллы"
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
