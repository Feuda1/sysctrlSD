// Собственные переменные окружения, доступные в main-процессе через
// `import.meta.env` (electron-vite прокидывает туда всё с префиксом
// `MAIN_VITE_` из `.env` в корне репозитория). Дополняет `ImportMetaEnv` из
// `electron-vite/node`, а не заменяет её.
interface ImportMetaEnv {
  readonly MAIN_VITE_APP_SHARED_KEY?: string
  readonly MAIN_VITE_CONTROL_PLANE_BASE?: string
}
