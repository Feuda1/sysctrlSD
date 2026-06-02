/// <reference types="vite/client" />

declare module '*.png' {
  const content: string
  export default content
}

interface ImportMetaEnv {
  readonly VITE_GROQ_KEY?: string
  readonly VITE_OPENROUTER_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
