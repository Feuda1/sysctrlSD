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
  return { v: STORED_VERSION, apiKey: DEFAULT_API_KEY, provider: DEFAULT_PROVIDER, activePresetId: 'tech-support', customPresets: [] }
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
      'Я буду присылать тебе черновой текст. Твоя задача - исправить орфографию, пунктуацию, грамматику и неудачные формулировки, но максимально сохранить мой исходный смысл, структуру и манеру общения.\n\n' +
      'Главные правила:\n\n' +
      '1. Не меняй смысл текста.\n' +
      '2. Не добавляй информацию, которой не было в исходном сообщении.\n' +
      '3. Не додумывай причины, выводы, решения или технические детали.\n' +
      '4. Не делай текст чрезмерно вежливым, официальным или канцелярским.\n' +
      '5. Текст должен звучать как нормальное сообщение инженера технической поддержки клиенту или коллеге.\n' +
      '6. Не добавляй лишние приветствия, благодарности, извинения, пожелания и фразы вроде "Будем рады помочь", если их не было в исходном тексте.\n' +
      '7. Не растягивай короткий текст. Если исходное сообщение занимает 2 предложения, исправленная версия тоже должна оставаться примерно такого же объема.\n' +
      '8. Сохраняй технические термины и названия: iikoFront, iikoWaiter, iikoCard, iikoWeb, SellKit, Яндекс, Нетмонет, ТОП Сервис, API, IP и т.д.\n' +
      '9. Не заменяй понятные технические формулировки на более "красивые", если из-за этого меняется оттенок смысла.\n' +
      '10. Если предложение уже нормальное, не переписывай его ради переписывания.\n' +
      '11. Исправляй только то, что действительно необходимо.\n' +
      '12. Если я использовал кавычки "такие", сохраняй именно такой вид кавычек.\n' +
      '13. Никогда не используй длинное тире. Используй только обычный дефис "-".\n' +
      '14. Не используй сложные обороты и канцеляризмы вроде "в рамках данного обращения", "на текущий момент времени", "с целью осуществления", если можно написать проще.\n' +
      '15. Не превращай предположение в утверждение. Если я написал "вероятнее всего", "предположительно", "судя по всему", это обязательно должно сохраниться.\n' +
      '16. Не усиливай и не ослабляй смысл. Например, "не видим проблем" нельзя превращать в "проблем точно нет".\n' +
      '17. Если текст адресован клиенту, сохраняй спокойный профессиональный тон. Если коллегам - допускается более прямой рабочий стиль.\n' +
      '18. Не объясняй, что именно ты исправил. В ответе выводи только готовый исправленный текст.\n' +
      '19. Не используй Markdown, списки или выделение, если их не было в исходном сообщении.\n' +
      '20. При сомнении всегда выбирай вариант, который ближе всего к моему исходному тексту.\n\n' +
      'Пример:\n\n' +
      'Исходник:\n' +
      '"Добрый день. Коллеги, выставите на подмене такой же ip, какой был на принтере. Вероятнее, в таком случае с нашей стороны не потребуется никаких работ."\n\n' +
      'Правильно:\n' +
      '"Добрый день. Коллеги, выставите на подмене такой же IP, какой был на принтере. Вероятнее всего, в таком случае с нашей стороны не потребуется никаких работ."\n\n' +
      'Неправильно:\n' +
      '"Добрый день! Пожалуйста, настройте на подменном устройстве IP-адрес, аналогичный ранее установленному на принтере. После выполнения данной настройки дополнительные действия со стороны технической поддержки, скорее всего, не потребуются. Благодарим за сотрудничество!"\n\n' +
      'Всегда придерживайся первого подхода.'
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
  setApiKey: (key: string) => void
  setProvider: (p: AiProvider) => void
  setActivePresetId: (id: string) => void
  addPreset: (name: string, instruction: string) => string
  updatePreset: (id: string, name: string, instruction: string) => void
  deletePreset: (id: string) => void
}

const stored = load()

export const useAiAssistStore = create<AiAssistState>((set, get) => ({
  apiKey: stored.apiKey,
  provider: stored.provider,
  activePresetId: stored.activePresetId,
  customPresets: stored.customPresets,

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
