import { useEffect, useState } from 'react'
import { Check, ChevronDown, Copy, FolderOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SettingsHeader } from './SettingsControls'

export const EXTENSION_GUIDES: { id: string; name: string; steps: string[] }[] = [
  {
    id: 'chromium',
    name: 'Chrome, Edge, Яндекс, Opera',
    steps: [
      'Откройте страницу расширений: chrome://extensions (в Edge — edge://extensions, в Яндексе — browser://extensions).',
      'Включите «Режим разработчика» в правом верхнем углу.',
      'Нажмите «Загрузить распакованное расширение» и выберите папку расширения (путь — выше).'
    ]
  },
  {
    id: 'firefox',
    name: 'Firefox',
    steps: [
      'Откройте about:debugging#/runtime/this-firefox.',
      'Нажмите «Загрузить временное дополнение».',
      'Выберите файл manifest.json внутри папки расширения.'
    ]
  }
]

export function ExtensionSettings() {
  const [info, setInfo] = useState<{ path: string; packaged: boolean } | null>(null)
  const [copied, setCopied] = useState(false)
  const [openGuide, setOpenGuide] = useState<string | null>('chromium')

  useEffect(() => {
    window.api.app.getExtensionInfo().then(setInfo).catch(() => {})
  }, [])

  const copyPath = async () => {
    if (!info?.path) return
    await navigator.clipboard.writeText(info.path)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-4">
      <SettingsHeader
        title="Расширение для браузера"
        description="Открывает ссылки на заявки clients.denvic.ru сразу в приложении"
      />
      
      <p className="text-xs text-muted-foreground leading-relaxed">
        Установите его один раз в ваш браузер. После этого все ссылки на заявки из писем или мессенджеров будут автоматически перенаправляться в приложение.
      </p>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">Папка с расширением</span>
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5">
          <FolderOpen className="h-4 w-4 shrink-0 text-primary/80" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground select-text" title={info?.path || ''}>
            {info?.path || 'Загрузка…'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyPath}
            className="h-7 shrink-0 gap-1.5 rounded-lg text-xs"
          >
            {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Скопировано' : 'Копировать'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {EXTENSION_GUIDES.map(guide => {
          const open = openGuide === guide.id
          return (
            <div key={guide.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <button
                type="button"
                onClick={() => setOpenGuide(open ? null : guide.id)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs font-semibold text-foreground hover:bg-accent/40 transition-colors"
              >
                {guide.name}
                <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
              </button>
              {open && (
                <ol className="space-y-2 border-t border-border/50 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground bg-muted/5">
                  {guide.steps.map((step, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">{i + 1}</span>
                      <span className="select-text pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-muted-foreground leading-relaxed mt-2">
        После установки нажмите на иконку расширения в панели браузера, чтобы активировать интеграцию и включить опцию автозакрытия пустых вкладок.
      </p>
    </div>
  )
}
