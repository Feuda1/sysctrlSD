import { useEffect, useState } from 'react'

/**
 * Состояние подключения по данным браузера. Оно не знает, доступен ли именно
 * наш сервер, поэтому годится только чтобы объяснить уже случившуюся ошибку.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return isOnline
}
