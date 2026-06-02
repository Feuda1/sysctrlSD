import { create } from 'zustand'

export interface Macro {
  id: string
  label: string
  description?: string
  bodyText: string
  internal: boolean
  stateId?: number
  groupId?: number
  tagNames?: string[]
  iikoReasonIds?: string[]
  timeUnit?: number
  colorClass?: string
}

const MACROS_STORAGE_KEY = 'macros.list'

const DEFAULT_MACROS: Macro[] = [
  {
    id: 'buh_soglasovanie',
    label: 'МК: Согласование Бухгалтерии',
    description: 'Требуется согласование Бухгалтерии Моккано',
    bodyText: 'Требуестя согласование Бухгалтерии Моккано',
    internal: false,
    colorClass: 'border-emerald-500 hover:bg-emerald-500/5'
  },
  {
    id: 'marketing_soglasovanie',
    label: 'МК: Согласование Маркетинг',
    description: 'Требуется согласование Маркетинга Моккано',
    bodyText: 'Требуестя согласование Маркетинга Моккано',
    internal: false,
    colorClass: 'border-emerald-500 hover:bg-emerald-500/5'
  },
  {
    id: 'agora_soglasovanie',
    label: 'МК: Согласование Агора (Сайт)',
    description: 'Требуется согласование Arora Моккано',
    bodyText: 'Требуется согласование Arora Моккано',
    internal: false,
    colorClass: 'border-emerald-500 hover:bg-emerald-500/5'
  },
  {
    id: 'hr_soglasovanie',
    label: 'МК: Согласование HR',
    description: 'Передаём на отдел Моккано HR',
    bodyText: 'Передаём на отдел Моккано HR',
    internal: false,
    colorClass: 'border-emerald-500 hover:bg-emerald-500/5'
  },
  {
    id: 'it_soglasovanie',
    label: 'МК: Согласование IT',
    description: 'Требуется согласование IT Моккано',
    bodyText: 'Требуется согласование IT Моккано',
    internal: false,
    colorClass: 'border-emerald-500 hover:bg-emerald-500/5'
  },
  {
    id: 'topservice_not_processed_1',
    label: 'ТопСервис: Не отработана 1-я линия',
    description: 'Требуется уточнение по задаче + тег',
    bodyText: 'Коллеги, требуется уточнение по задаче.',
    internal: false,
    tagNames: ['Не отработана 1-я линия'],
    colorClass: 'border-rose-500 hover:bg-rose-500/5'
  },
  {
    id: 'topservice_awaiting_reply',
    label: 'ТопСервис: Ожидаем ответа',
    description: 'Ожидаем ответа на стороне дилера + статус «Отложена»',
    bodyText: 'Ожидаем ответа на стороне дилера',
    internal: false,
    stateId: 3,
    colorClass: 'border-rose-500 hover:bg-rose-500/5'
  },
  {
    id: 'iiko_awaiting_feedback',
    label: 'iiko: Ждём обратной связи',
    description: 'Запрос обратной связи + статус «Отложена»',
    bodyText: 'Здравствуйте. Ждем от вас обратной связи по задаче.',
    internal: false,
    stateId: 3,
    colorClass: 'border-blue-500 hover:bg-blue-500/5'
  },
  {
    id: 'iiko_close_task',
    label: 'iiko: Закрытие задачи',
    description: 'Задачу закрываем + статус «Завершена»',
    bodyText: 'Задачу закрываем. Были рады помочь, спасибо за обращение. Если Вас не затруднит, прошу оставить оценку моей работе.',
    internal: false,
    stateId: 4,
    colorClass: 'border-blue-500 hover:bg-blue-500/5'
  },
  {
    id: 'iiko_reaction',
    label: 'iiko: Реакция на задачу',
    description: 'Получили обращение + статус «В работе»',
    bodyText: "Здравствуйте.\nМы получили ваше обращение и уже работаем над ним. В течении получаса дадим вам обратную связь.\nПостараемся раньше этого срока.",
    internal: false,
    stateId: 2,
    colorClass: 'border-blue-500 hover:bg-blue-500/5'
  },
  {
    id: 'iiko_escalation_l2',
    label: 'iiko: Эскалация L2',
    description: 'Приватная заметка L2 + группа L2',
    bodyText: 'Эскалация L2',
    internal: true,
    groupId: 32,
    colorClass: 'border-pink-500 hover:bg-pink-500/5'
  },
  {
    id: 'iiko_escalation_l3',
    label: 'iiko: Эскалация L3',
    description: 'Приватная заметка L3 + группа L3',
    bodyText: 'Эскалация L3',
    internal: true,
    groupId: 10,
    colorClass: 'border-pink-500 hover:bg-pink-500/5'
  }
]

function getStoredMacros(): Macro[] {
  const stored = window.localStorage.getItem(MACROS_STORAGE_KEY)
  if (!stored) {
    window.localStorage.setItem(MACROS_STORAGE_KEY, JSON.stringify(DEFAULT_MACROS))
    return DEFAULT_MACROS
  }
  try {
    return JSON.parse(stored)
  } catch {
    return DEFAULT_MACROS
  }
}

interface MacrosState {
  macros: Macro[]
  addMacro: (macro: Omit<Macro, 'id'>) => void
  updateMacro: (id: string, patch: Partial<Macro>) => void
  deleteMacro: (id: string) => void
}

export const useMacrosStore = create<MacrosState>((set, get) => ({
  macros: getStoredMacros(),

  addMacro: (newMacro) => {
    const id = `macro-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const macro: Macro = { ...newMacro, id }
    const nextMacros = [...get().macros, macro]
    window.localStorage.setItem(MACROS_STORAGE_KEY, JSON.stringify(nextMacros))
    set({ macros: nextMacros })
  },

  updateMacro: (id, patch) => {
    const nextMacros = get().macros.map(m => m.id === id ? { ...m, ...patch } : m)
    window.localStorage.setItem(MACROS_STORAGE_KEY, JSON.stringify(nextMacros))
    set({ macros: nextMacros })
  },

  deleteMacro: (id) => {
    const nextMacros = get().macros.filter(m => m.id !== id)
    window.localStorage.setItem(MACROS_STORAGE_KEY, JSON.stringify(nextMacros))
    set({ macros: nextMacros })
  }
}))
