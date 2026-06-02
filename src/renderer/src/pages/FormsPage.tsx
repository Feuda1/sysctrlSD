import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Cpu, Truck, FileText, ArrowRightLeft, Inbox, ChevronRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui'

interface FormItem {
  id: number
  name: string
}

interface FormCategory {
  name: string
  icon: any
  forms: FormItem[]
}

const LABEL_MAP: Record<string, string> = {
  'Работа с ККТ': 'ККТ',
  'Выезд': 'Выезд',
  'Формы': 'Формы',
  'Перевод задач': 'Переводы'
}

interface PyrusFormLoaderProps {
  formId: number
  onLoaded: () => void
}

function PyrusFormLoader({ formId, onLoaded }: PyrusFormLoaderProps) {
  const [formInstanceId] = useState(() => (Math.random() * 10000).toFixed())
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const resolvedTheme = useUIStore((s) => s.resolvedTheme)
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      const data = e.data
      if (!(data && data.type === 'pyrus_form_update')) return

      if (!data.formInstanceId || data.formInstanceId === formInstanceId) {
        if (iframeRef.current) {
          iframeRef.current.style.height = `${data.height}px`
          onLoaded()
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [formInstanceId, onLoaded])

  return (
    <iframe
      ref={iframeRef}
      src={`https://pyrus.com/form/${formId}?inframe=true&formInstanceId=${formInstanceId}`}
      style={{
        border: 0,
        overflow: 'hidden',
        width: '100%',
        height: '600px',
        backgroundColor: 'white',
        borderRadius: '12px',
        filter: isDark ? 'invert(0.9) hue-rotate(200deg) saturate(1.2) brightness(0.95) contrast(1.05)' : 'none'
      }}
      onLoad={() => {
        setTimeout(onLoaded, 1000)
      }}
    />
  )
}

export default function FormsPage() {
  const [categories, setCategories] = useState<FormCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [isLoadingList, setIsLoadingList] = useState(true)
  const [selectedForm, setSelectedForm] = useState<FormItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFormIds, setActiveFormIds] = useState<number[]>([])
  const [isFormLoading, setIsFormLoading] = useState<Record<number, boolean>>({})
  const [reloadKeys, setReloadKeys] = useState<Record<number, number>>({})

  useEffect(() => {
    window.api.forms.list().then(data => {
      const mapped = data.map(cat => {
        let icon = FileText
        if (cat.name === 'Работа с ККТ') icon = Cpu
        else if (cat.name === 'Выезд') icon = Truck
        else if (cat.name === 'Перевод задач') icon = ArrowRightLeft
        return {
          name: cat.name,
          icon,
          forms: cat.forms
        }
      })
      setCategories(mapped)
      if (mapped.length > 0) {
        setActiveCategory(mapped[0].name)
      }
      setIsLoadingList(false)
    }).catch(err => {
      console.error(err)
      setIsLoadingList(false)
    })
  }, [])

  const handleFormSelect = (form: FormItem) => {
    if (!activeFormIds.includes(form.id)) {
      setActiveFormIds(prev => [...prev, form.id])
      setIsFormLoading(prev => ({ ...prev, [form.id]: true }))
    }
    setSelectedForm(form)
  }

  const handleReloadForm = (formId: number) => {
    setReloadKeys(prev => ({
      ...prev,
      [formId]: (prev[formId] || 0) + 1
    }))
    setIsFormLoading(prev => ({ ...prev, [formId]: true }))
  }

  if (isLoadingList) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  const isSearchActive = searchQuery.trim().length > 0

  const allFormsWithCategory = categories.flatMap(cat =>
    cat.forms.map(form => ({ ...form, categoryName: cat.name }))
  )

  const filteredForms = isSearchActive
    ? allFormsWithCategory.filter(form =>
        form.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : categories.find(cat => cat.name === activeCategory)?.forms ?? []

  return (
    <div className="flex h-full w-full gap-4 overflow-hidden min-h-0">
      <div className="w-80 shrink-0 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 min-h-0 shadow-sm">
        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск форм..."
            className="h-9 w-full rounded-xl border border-border bg-muted/30 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/75 outline-none transition-all duration-150 focus:border-primary/60 focus:bg-background"
          />
        </div>

        {!isSearchActive && (
          <div className="grid grid-cols-4 gap-1 p-0.5 rounded-xl bg-muted/40 shrink-0 select-none">
            {categories.map(cat => {
              const Icon = cat.icon
              const isActive = activeCategory === cat.name
              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setActiveCategory(cat.name)}
                  title={cat.name}
                  className={cn(
                    "flex flex-col items-center justify-center py-1.5 px-1 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-150 relative select-none focus:outline-none",
                    isActive && "text-primary hover:text-primary"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeCategoryBg"
                      className="absolute inset-0 bg-background rounded-lg shadow-sm border border-border/40"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="h-4 w-4 relative z-10" />
                  <span className="text-[9px] font-medium mt-1 truncate max-w-full relative z-10 select-none">
                    {LABEL_MAP[cat.name] || cat.name}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
          {filteredForms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground select-none">
              <Inbox className="h-8 w-8 opacity-30 mb-2" />
              <p className="text-xs">Формы не найдены</p>
            </div>
          ) : (
            filteredForms.map(form => {
              const isSelected = selectedForm?.id === form.id
              const catName = (form as any).categoryName
              return (
                <button
                  key={form.id}
                  type="button"
                  onClick={() => handleFormSelect(form)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border border-border/40 transition-all duration-150 flex items-center justify-between gap-2 select-none focus:outline-none",
                    isSelected
                      ? "bg-primary/5 border-primary/30 shadow-sm"
                      : "bg-background/40 hover:bg-muted/40"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        "text-xs font-semibold truncate select-none",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        {form.name}
                      </span>
                      {isSearchActive && catName && (
                        <span className="shrink-0 text-[8px] bg-muted/60 text-muted-foreground px-1.5 py-0.2 rounded-md font-medium select-none">
                          {catName}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-all duration-150",
                    isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/40"
                  )} />
                </button>
              )
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-card border border-border rounded-2xl shadow-sm relative overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedForm ? (
            <motion.div
              key="forms-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col min-h-0 p-6"
            >
              <div className="shrink-0 border-b border-border pb-4 mb-4 select-none flex items-center justify-between">
                <div className="h-7 flex items-center">
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={selectedForm.id}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.15 }}
                      className="text-sm font-bold text-foreground"
                    >
                      {selectedForm.name}
                    </motion.h2>
                  </AnimatePresence>
                </div>
                <button
                  type="button"
                  onClick={() => handleReloadForm(selectedForm.id)}
                  title="Очистить форму"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-150 focus:outline-none flex items-center gap-1.5 text-xs font-medium"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Очистить</span>
                </button>
              </div>

              <div className="flex-1 min-h-0 relative overflow-y-auto p-4 bg-muted/10">
                {selectedForm && isFormLoading[selectedForm.id] && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3 select-none">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-xs text-muted-foreground font-medium animate-pulse">Загрузка формы...</span>
                  </div>
                )}
                {activeFormIds.map(formId => {
                  const isCurrent = selectedForm?.id === formId
                  return (
                    <div
                      key={formId}
                      className={cn(
                        "max-w-[860px] w-full mx-auto shadow-sm border border-border/40 rounded-xl overflow-hidden bg-white dark:bg-card",
                        !isCurrent && "invisible absolute pointer-events-none h-0 w-0 overflow-hidden"
                      )}
                    >
                      <PyrusFormLoader
                        key={`${formId}-${reloadKeys[formId] || 0}`}
                        formId={formId}
                        onLoaded={() => setIsFormLoading(prev => ({ ...prev, [formId]: false }))}
                      />
                    </div>
                  )
                })}
              </div>
            </motion.div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
              <div className="h-12 w-12 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground/40">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground/80">Форма не выбрана</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Выберите необходимую форму в меню слева для заполнения и отправки
                </p>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
