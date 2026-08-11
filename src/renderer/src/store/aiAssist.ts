import { create } from 'zustand'

export interface StylePreset {
  id: string
  name: string
  instruction: string
  isBuiltIn?: boolean
}

const LS_KEY = 'sysctrl-ai-assist'

type AiProvider = 'groq' | 'deepseek' | 'openrouter'

interface Stored {
  v?: number
  apiKey: string
  provider: AiProvider
  activePresetId: string
  customPresets: StylePreset[]
  /** Показывать ли нейросети последние сообщения заявки. */
  useTicketContext?: boolean
}

// Default keys are injected at build time from .env so they ship in the packaged
// app for every user while staying out of the source. DeepSeek is the primary
// provider (paid key, no free-tier queues); OpenRouter's rotating free models
// stay as the fallback when no DeepSeek key was built in.
const DEEPSEEK_KEY = import.meta.env.VITE_DEEPSEEK_KEY || ''
const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY || ''
const DEFAULT_PROVIDER: AiProvider = DEEPSEEK_KEY ? 'deepseek' : 'openrouter'
const DEFAULT_API_KEY = DEEPSEEK_KEY || OPENROUTER_KEY

// Bumped whenever the built-in provider changes: stored settings from an older
// version carry a key for the previous provider, which would keep the app on a
// provider it no longer has a working key for.
const STORED_VERSION = 2

function load(): Stored {
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Stored
      // Own key entered by hand — keep it, whatever the built-in default is.
      if (parsed.v === STORED_VERSION && parsed.apiKey) {
        return { ...parsed, v: STORED_VERSION }
      }
      return { ...parsed, v: STORED_VERSION, provider: DEFAULT_PROVIDER, apiKey: DEFAULT_API_KEY }
    }
  } catch {}
  return { v: STORED_VERSION, apiKey: DEFAULT_API_KEY, provider: DEFAULT_PROVIDER, activePresetId: 'tech-support', customPresets: [], useTicketContext: true }
}

function save(data: Omit<Stored, 'v'>) {
  window.localStorage.setItem(LS_KEY, JSON.stringify({ ...data, v: STORED_VERSION }))
}

export const BUILT_IN_PRESETS: StylePreset[] = [
  {
    id: 'tech-support',
    name: 'Техподдержка',
    isBuiltIn: true,
    instruction:
      'Ты редактор моих рабочих сообщений для технической поддержки.\n\n' +
      'Я присылаю черновик - часто сбивчивый, надиктованный или написанный на бегу. Твоя задача не вычитка, а нормальное рабочее сообщение из этого черновика: понятное с первого прочтения, в моей манере, без воды.\n\n' +
      'Что делать:\n\n' +
      '1. Переформулируй корявое и сбивчивое. Это твоя работа, а не крайняя мера.\n' +
      '2. Разбивай перегруженные предложения, убирай повторы и слова-паразиты.\n' +
      '3. Наводи порядок в последовательности мыслей: сначала суть, потом детали.\n' +
      '4. Если в черновике перечисление, оформи его как перечисление в одну строку через запятую или с новой строки - как читается лучше.\n' +
      '5. Восстанавливай пропущенные предлоги, окончания и знаки препинания.\n\n' +
      'Чего не делать никогда:\n\n' +
      '6. Не меняй смысл и не переставляй акценты.\n' +
      '7. Не добавляй информацию, которой не было: ни причин, ни выводов, ни решений, ни технических деталей.\n' +
      '8. Не превращай предположение в утверждение. "Вероятнее всего", "судя по всему", "предположительно" обязаны сохраниться.\n' +
      '9. Не усиливай и не ослабляй сказанное. "Не видим проблем" - это не "проблем точно нет".\n' +
      '10. Не добавляй приветствия, благодарности, извинения и фразы вроде "Будем рады помочь", если их не было.\n' +
      '11. Не раздувай объём. Два предложения черновика - примерно два предложения на выходе.\n' +
      '12. Не пиши канцеляритом: "в рамках данного обращения", "на текущий момент времени", "с целью осуществления" - это мимо.\n' +
      '13. Не будь приторно вежливым. Это сообщение инженера, а не письмо из банка.\n\n' +
      'Оформление:\n\n' +
      '14. Сохраняй названия и термины как есть: iikoFront, iikoWaiter, iikoCard, iikoWeb, SellKit, Яндекс, Нетмонет, ТОП Сервис, API, IP.\n' +
      '15. Кавычки оставляй такими, какими написал я.\n' +
      '16. Только обычный дефис "-", никакого длинного тире.\n' +
      '17. Markdown, списки и выделение - только если они были в черновике.\n' +
      '18. Клиенту - спокойный профессиональный тон, коллегам - можно проще и прямее.\n' +
      '19. В ответе только готовый текст. Не объясняй, что изменил.\n\n' +
      'Пример:\n\n' +
      'Черновик:\n' +
      '"смотрел логи там ошибка при обращении к серверу айко в 15 44 примерно, потом соединение восстановилось в 21 01. чеки касса сохранила локально и потом уже передала в офд когда связь появилась. то есть по факту оба заказа фискализировались просто позже ушли"\n\n' +
      'Правильно:\n' +
      '"Посмотрел логи: примерно в 15:44 была ошибка при обращении к серверу iiko, соединение восстановилось в 21:01. Чеки касса сохранила локально и передала в ОФД после восстановления связи. Оба заказа фискализировались, просто ушли позже."\n\n' +
      'Неправильно (вычитка вместо стилизации):\n' +
      '"Смотрел логи, там ошибка при обращении к серверу айко в 15:44 примерно, потом соединение восстановилось в 21:01."\n\n' +
      'Неправильно (вода и канцелярит):\n' +
      '"Добрый день! В рамках анализа предоставленных журналов событий было выявлено, что в период времени с 15:44 наблюдалась недоступность сервера. Благодарим за обращение!"'
  }
]

export const CORRECTION_PROMPT =
  'Исправь орфографические и пунктуационные ошибки в тексте. ' +
  'Не меняй смысл, структуру, стиль и не добавляй слова. ' +
  'Верни только исправленный текст без пояснений.'

interface AiAssistState {
  apiKey: string
  provider: AiProvider
  activePresetId: string
  customPresets: StylePreset[]
  useTicketContext: boolean
  setApiKey: (key: string) => void
  setProvider: (p: AiProvider) => void
  setActivePresetId: (id: string) => void
  addPreset: (name: string, instruction: string) => string
  updatePreset: (id: string, name: string, instruction: string) => void
  deletePreset: (id: string) => void
  setUseTicketContext: (value: boolean) => void
}

const stored = load()

export const useAiAssistStore = create<AiAssistState>((set, get) => ({
  apiKey: stored.apiKey,
  provider: stored.provider,
  activePresetId: stored.activePresetId,
  customPresets: stored.customPresets,
  // По умолчанию включено: без переписки правка хуже узнаёт имена и термины.
  // Выключается в настройках помощника.
  useTicketContext: stored.useTicketContext !== false,

  setUseTicketContext: (useTicketContext) => {
    const s = get()
    save({
      apiKey: s.apiKey,
      provider: s.provider,
      activePresetId: s.activePresetId,
      customPresets: s.customPresets,
      useTicketContext
    })
    set({ useTicketContext })
  },

  setApiKey: (apiKey) => {
    const s = get()
    save({ apiKey, provider: s.provider, activePresetId: s.activePresetId, customPresets: s.customPresets })
    set({ apiKey })
  },
  setProvider: (provider) => {
    const s = get()
    save({ apiKey: s.apiKey, provider, activePresetId: s.activePresetId, customPresets: s.customPresets })
    set({ provider })
  },
  setActivePresetId: (activePresetId) => {
    const s = get()
    save({ apiKey: s.apiKey, provider: s.provider, activePresetId, customPresets: s.customPresets })
    set({ activePresetId })
  },
  addPreset: (name, instruction) => {
    const id = `custom-${Date.now()}`
    const s = get()
    const customPresets = [...s.customPresets, { id, name, instruction }]
    save({ apiKey: s.apiKey, provider: s.provider, activePresetId: s.activePresetId, customPresets })
    set({ customPresets })
    return id
  },
  updatePreset: (id, name, instruction) => {
    const s = get()
    const customPresets = s.customPresets.map(p => (p.id === id ? { ...p, name, instruction } : p))
    save({ apiKey: s.apiKey, provider: s.provider, activePresetId: s.activePresetId, customPresets })
    set({ customPresets })
  },
  deletePreset: (id) => {
    const s = get()
    const customPresets = s.customPresets.filter(p => p.id !== id)
    const activePresetId = s.activePresetId === id ? 'tech-support' : s.activePresetId
    save({ apiKey: s.apiKey, provider: s.provider, activePresetId, customPresets })
    set({ customPresets, activePresetId })
  }
}))

export function getAllPresets(customPresets: StylePreset[]): StylePreset[] {
  return [...BUILT_IN_PRESETS, ...customPresets]
}

// Runs through the main process (window.api.ai.complete) to avoid renderer CORS
// and use the same network path as the working Zammad requests.
export async function callAiApi(
  systemPrompt: string,
  userText: string,
  apiKey: string,
  provider: AiProvider
): Promise<string> {
  return window.api.ai.complete({ systemPrompt, userText, apiKey, provider })
}
