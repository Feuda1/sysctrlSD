import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resolveScrollDownSide, useUIStore, type ResolvedTheme } from '@/store/ui'
import { useNotificationsStore } from '@/store/notifications'
import { SegmentControl, SettingRow, Switch } from './SettingsControls'

/** Appearance and behaviour options of the Интерфейс tab. */

const THEME_OPTIONS: { value: ResolvedTheme; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'gray', label: 'Серая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'oled', label: 'OLED' },
  { value: 'warm', label: 'Тёплая' },
  { value: 'indigo', label: 'Индиго' },
  { value: 'nord', label: 'Nord' }
]

/** Настоящий кусочек интерфейса в цветах темы, а не подписанный квадратик -
 * заворачивает разметку в класс темы, и переменные внутри переопределяются
 * сами, независимо от того, какая тема активна у всего окна сейчас. */
function ThemeMiniPreview({ themeClass }: { themeClass: ResolvedTheme }) {
  return (
    <div className={cn(themeClass, 'flex h-16 w-full gap-1 overflow-hidden rounded-lg border border-border bg-background p-1.5')}>
      <div className="flex w-2.5 shrink-0 flex-col items-center gap-1 rounded-sm bg-sidebar py-1.5">
        <div className="h-1 w-1 rounded-sm bg-primary/80" />
        <div className="h-1 w-1 rounded-sm bg-foreground/25" />
        <div className="h-1 w-1 rounded-sm bg-foreground/25" />
      </div>
      <div className="flex flex-1 flex-col gap-1 rounded-sm border border-border bg-card p-1.5">
        <div className="h-1 w-2/5 rounded-full bg-foreground/30" />
        <div className="h-[3px] w-full rounded-full bg-muted-foreground/30" />
        <div className="h-[3px] w-4/5 rounded-full bg-muted-foreground/30" />
        <div className="mt-auto h-2 w-3/5 self-end rounded-sm bg-primary/85" />
      </div>
    </div>
  )
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useUIStore()

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Тема оформления</p>
        <p className="text-xs text-muted-foreground">Выберите внешний вид приложения</p>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {THEME_OPTIONS.map(opt => {
          const isActive = resolvedTheme === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={cn(
                'group relative flex flex-col gap-1.5 rounded-xl border-2 p-1.5 text-left transition-colors',
                isActive ? 'border-primary' : 'border-transparent hover:border-border'
              )}
            >
              <ThemeMiniPreview themeClass={opt.value} />
              {isActive && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
              <span className={cn('px-0.5 text-xs font-medium', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TraySettings() {
  const settings = useNotificationsStore((s) => s.settings)
  const saveSettings = useNotificationsStore((s) => s.saveSettings)

  if (!settings) return null

  const isEnabled = settings.closeToTrayEnabled !== false

  return (
    <SettingRow
      title="Сворачивать в трей при закрытии"
      description="При нажатии на крестик приложение будет сворачиваться в трей вместо закрытия"
      control={
        <Switch
          checked={isEnabled}
          onChange={(val) => saveSettings({ ...settings, closeToTrayEnabled: val })}
        />
      }
    />
  )
}

export function MiniBubble({ align, variant, name, time, text }: {
  align: 'left' | 'right'
  variant: 'agent' | 'client'
  name: string
  time: string
  text: string
}) {
  const isRight = align === 'right'
  const avatar = variant === 'agent'
    ? <div className="h-6 w-6 shrink-0 rounded-full bg-blue-500/20 dark:bg-blue-500/25 border border-blue-300 dark:border-blue-500/35 flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-300">АГ</div>
    : <div className="h-6 w-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-700 dark:text-zinc-300">ИИ</div>
  const bubble = variant === 'agent'
    ? "bg-blue-50/70 dark:bg-blue-950/45 border-blue-200/60 dark:border-blue-900/50 text-blue-950 dark:text-zinc-100"
    : "bg-zinc-100/80 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60 text-zinc-900 dark:text-zinc-100"
  const headBorder = variant === 'agent' ? "border-blue-200/60 dark:border-blue-900/30" : "border-zinc-200 dark:border-zinc-700/30"
  return (
    <div className={cn("flex gap-2 items-start", isRight ? "justify-end" : "justify-start")}>
      {!isRight && avatar}
      <div className={cn("max-w-[80%] rounded-2xl border p-2.5 text-[11px] flex flex-col gap-1 shadow-sm", bubble, isRight ? "rounded-tr-none" : "rounded-tl-none")}>
        <div className={cn("flex items-center justify-between gap-4 border-b pb-1 text-[9px] opacity-70", headBorder)}>
          <span className="font-bold">{name}</span>
          <span className="font-mono">{time}</span>
        </div>
        <span>{text}</span>
      </div>
      {isRight && avatar}
    </div>
  )
}

export function ChatStyleSettings() {
  const { chatStyle, setChatStyle, bubbleSide, setBubbleSide } = useUIStore()

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Стиль чата в заявках</p>
        <p className="text-xs text-muted-foreground">Выберите предпочтительный вид отображения комментариев</p>
      </div>

      <SegmentControl
        value={chatStyle}
        options={[
          { value: 'modern', label: 'Бабблы' },
          { value: 'classic', label: 'Классический' }
        ]}
        onChange={setChatStyle}
      />

      {chatStyle === 'modern' && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs font-semibold text-muted-foreground">Сообщения клиента</p>
          <div className="w-52 shrink-0">
            <SegmentControl
              value={bubbleSide}
              options={[
                { value: 'client-right', label: 'Справа' },
                { value: 'client-left', label: 'Слева' }
              ]}
              onChange={setBubbleSide}
            />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 text-center">Предпросмотр</p>
        
        <div className="space-y-3 pointer-events-none select-none">
          {chatStyle === 'modern' ? (
            <div className="space-y-2.5">
              <MiniBubble
                align={bubbleSide === 'client-left' ? 'right' : 'left'}
                variant="agent"
                name="Агент Поддержки"
                time="12:30"
                text="Добрый день! Чем могу помочь?"
              />
              <MiniBubble
                align={bubbleSide === 'client-right' ? 'right' : 'left'}
                variant="client"
                name="Иван Иванов"
                time="12:32"
                text="Не работает интеграция со звонками."
              />
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-lg border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 text-[11px] text-blue-950 dark:text-zinc-100 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-blue-200/60 dark:border-blue-900/30 pb-1 text-[9px] text-blue-900/60 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-blue-950 dark:text-zinc-300">Агент Поддержки</span>
                    <span className="bg-blue-100 dark:bg-blue-900/45 text-blue-800 dark:text-blue-200 text-[8px] px-1.5 py-0.2 rounded-full font-medium">Агент</span>
                  </div>
                  <span className="font-mono">31.05.2026 12:30:15</span>
                </div>
                <span>Добрый день! Чем могу помочь?</span>
              </div>

              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-zinc-50/50 dark:bg-zinc-800/30 p-2.5 text-[11px] text-zinc-900 dark:text-zinc-100 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700/30 pb-1 text-[9px] text-zinc-650 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="text-zinc-900 dark:text-zinc-300">Иван Иванов</span>
                    <span className="bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-300 text-[8px] px-1.5 py-0.2 rounded-full font-medium">Клиент</span>
                  </div>
                  <span className="font-mono">31.05.2026 12:32:40</span>
                </div>
                <span>Не работает интеграция со звонками.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AfterCommentSubmitSettings() {
  const { afterCommentSubmitAction, setAfterCommentSubmitAction } = useUIStore()

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">После отправки сообщения в заявку</p>
        <p className="text-xs text-muted-foreground">Выберите действие после отправки вашего комментария или ответа</p>
      </div>

      <SegmentControl
        value={afterCommentSubmitAction}
        options={[
          { value: 'stay', label: 'Оставаться в заявке' },
          { value: 'close', label: 'Закрывать и выходить' }
        ]}
        onChange={setAfterCommentSubmitAction}
      />
    </div>
  )
}

export function OpenCreatedTicketSettings() {
  const { openCreatedTicket, setOpenCreatedTicket } = useUIStore()

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">После создания заявки</p>
        <p className="text-xs text-muted-foreground">Открывать ли только что созданную заявку - быструю, по звонку или вложенную</p>
      </div>

      <SegmentControl
        value={openCreatedTicket ? 'open' : 'stay'}
        options={[
          { value: 'open', label: 'Переходить на созданную заявку' },
          { value: 'stay', label: 'Не переходить' }
        ]}
        onChange={(value) => setOpenCreatedTicket(value === 'open')}
      />
    </div>
  )
}

export function TabOpeningSettings() {
  const { openTabInBackground, setOpenTabInBackground } = useUIStore()

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Открытие вкладок</p>
        <p className="text-xs text-muted-foreground">
          Что делать по правой кнопке - «Открыть в новой вкладке»
        </p>
      </div>

      <SegmentControl
        value={openTabInBackground ? 'background' : 'switch'}
        options={[
          { value: 'switch', label: 'Переходить на новую вкладку' },
          { value: 'background', label: 'Открывать в фоне' }
        ]}
        onChange={(value) => setOpenTabInBackground(value === 'background')}
      />
    </div>
  )
}

export function SendSuggestionSettings() {
  const { suggestStateOnSend, setSuggestStateOnSend, suggestReasonOnSend, setSuggestReasonOnSend } = useUIStore()

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Подсказки при отправке</p>
        <p className="text-xs text-muted-foreground">
          В окне учёта времени предлагать то, что осталось незаполненным
        </p>
      </div>

      <SettingRow
        title="Предлагать выставить статус заявки"
        description="Появляется, если статус не меняли перед отправкой"
        control={<Switch checked={suggestStateOnSend} onChange={setSuggestStateOnSend} />}
      />
      <SettingRow
        title="Предлагать выставить причину обращения"
        description="Появляется, если причина не выбрана"
        control={<Switch checked={suggestReasonOnSend} onChange={setSuggestReasonOnSend} />}
      />
    </div>
  )
}

export function ScrollDownArrowSettings() {
  const { hideScrollDownArrow, setHideScrollDownArrow, scrollDownSide, setScrollDownSide } = useUIStore()

  return (
    <div className="space-y-3">
      <SettingRow
        title="Скрывать стрелку прокрутки вниз"
        description="Кнопка быстрой прокрутки к последним сообщениям в заявке"
        control={<Switch checked={hideScrollDownArrow} onChange={setHideScrollDownArrow} />}
      />

      {!hideScrollDownArrow && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-xs font-semibold text-muted-foreground">Угол кнопки</p>
          <div className="w-72 shrink-0">
            <SegmentControl
              value={scrollDownSide}
              options={[
                { value: 'auto', label: 'Автоматически' },
                { value: 'left', label: 'Слева' },
                { value: 'right', label: 'Справа' }
              ]}
              onChange={setScrollDownSide}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** Miniature of the whole window: nav rail, content column, panel, button. */
function LayoutPreview({ panelOnLeft, arrowOnLeft, showArrow, railOnRight }: {
  panelOnLeft: boolean
  arrowOnLeft: boolean
  showArrow: boolean
  railOnRight: boolean
}) {
  const content = (
    <div key="content" className="flex-[3] rounded-lg border border-border bg-muted/25 p-2 flex flex-col gap-1.5">
      <div className="h-2 w-1/3 rounded-full bg-primary/50" />
      <div className="h-1.5 w-full rounded-full bg-foreground/15" />
      <div className="h-1.5 w-4/5 rounded-full bg-foreground/15" />
      <div className="mt-auto flex flex-col gap-1 pt-2">
        <div className="h-4 w-3/5 self-start rounded-md border border-border bg-card" />
        <div className="h-4 w-3/5 self-end rounded-md border border-primary/30 bg-primary/10" />
      </div>
    </div>
  )
  const panel = (
    <div key="panel" className="flex-1 rounded-lg border border-border bg-card p-2 flex flex-col gap-1.5">
      <div className="h-2 w-4/5 rounded-full bg-muted-foreground/40" />
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-3.5 w-full rounded-md border border-border bg-muted/30" />
      ))}
    </div>
  )

  const rail = (
    <div key="rail" className="flex w-5 shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-sidebar py-2">
      <div className="h-2 w-2 rounded-sm bg-emerald-500/60" />
      <div className="h-2 w-2 rounded-sm bg-primary/70" />
      <div className="h-2 w-2 rounded-sm bg-foreground/20" />
      <div className="h-2 w-2 rounded-sm bg-foreground/20" />
    </div>
  )

  return (
    <div className="relative flex h-32 gap-2 rounded-xl border border-border bg-background/40 p-2">
      {!railOnRight && rail}
      {panelOnLeft ? [panel, content] : [content, panel]}
      {railOnRight && rail}
      {showArrow && (
        <div className={cn(
          "absolute bottom-3 flex h-5 w-5 items-center justify-center rounded-full border border-primary/40 bg-card text-primary shadow",
          // Кнопка обходит панель навигации ровно так же, как в самом окне.
          arrowOnLeft
            ? (railOnRight ? "left-3" : "left-9")
            : (railOnRight ? "right-9" : "right-3")
        )}>
          <span className="text-[10px] leading-none">↓</span>
        </div>
      )}
    </div>
  )
}

export function TicketLayoutSettings() {
  const {
    sidebarSide, setSidebarSide,
    ticketPanelSide, setTicketPanelSide,
    scrollDownSide, hideScrollDownArrow
  } = useUIStore()
  const arrowOnLeft = resolveScrollDownSide(scrollDownSide, ticketPanelSide) === 'left'

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Расположение блоков</p>
        <p className="text-xs text-muted-foreground">С какой стороны держать панель навигации и параметры заявки</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground">Панель навигации</p>
          <div className="w-52 shrink-0">
            <SegmentControl
              value={sidebarSide}
              options={[
                { value: 'left', label: 'Слева' },
                { value: 'right', label: 'Справа' }
              ]}
              onChange={setSidebarSide}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground">Параметры заявки</p>
          <div className="w-52 shrink-0">
            <SegmentControl
              value={ticketPanelSide}
              options={[
                { value: 'left', label: 'Слева' },
                { value: 'right', label: 'Справа' }
              ]}
              onChange={setTicketPanelSide}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 text-center">Предпросмотр</p>
        <div className="pointer-events-none select-none">
          <LayoutPreview
            railOnRight={sidebarSide === 'right'}
            panelOnLeft={ticketPanelSide === 'left'}
            arrowOnLeft={arrowOnLeft}
            showArrow={!hideScrollDownArrow}
          />
        </div>
      </div>
    </div>
  )
}
