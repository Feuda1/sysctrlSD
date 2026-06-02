import { create } from 'zustand'

export interface StylePreset {
  id: string
  name: string
  instruction: string
  isBuiltIn?: boolean
}

const LS_KEY = 'sysctrl-ai-assist'

interface Stored {
  apiKey: string
  provider: 'groq' | 'deepseek'
  activePresetId: string
  customPresets: StylePreset[]
}

// Default key is injected at build time from .env (VITE_GROQ_KEY) so it ships
// in the packaged app for every user, while staying out of the source / git.
const DEFAULT_API_KEY = import.meta.env.VITE_GROQ_KEY || ''

function load(): Stored {
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Stored
      // Fall back to the build key if the stored one is empty (older builds).
      return { ...parsed, apiKey: parsed.apiKey || DEFAULT_API_KEY }
    }
  } catch {}
  return { apiKey: DEFAULT_API_KEY, provider: 'groq', activePresetId: 'tech-support', customPresets: [] }
}

function save(data: Stored) {
  window.localStorage.setItem(LS_KEY, JSON.stringify(data))
}

export const BUILT_IN_PRESETS: StylePreset[] = [
  {
    id: 'tech-support',
    name: 'Техподдержка',
    isBuiltIn: true,
    instruction:
      'Ты — специалист техподдержки. Слегка причеши текст: исправь грамматику, структуру предложений, добавь "Добрый день." если нет приветствия.\n' +
      'Не раздувай текст, не добавляй лишних слов и корпоративных фраз — просто сделай немного чище и понятнее.\n' +
      'Верни только готовый текст без пояснений.'
  }
]

export const CORRECTION_PROMPT =
  'Исправь орфографические и пунктуационные ошибки в тексте. ' +
  'Не меняй смысл, структуру, стиль и не добавляй слова. ' +
  'Верни только исправленный текст без пояснений.'

interface AiAssistState {
  apiKey: string
  provider: 'groq' | 'deepseek'
  activePresetId: string
  customPresets: StylePreset[]
  setApiKey: (key: string) => void
  setProvider: (p: 'groq' | 'deepseek') => void
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
  provider: 'groq' | 'deepseek'
): Promise<string> {
  return window.api.ai.complete({ systemPrompt, userText, apiKey, provider })
}
