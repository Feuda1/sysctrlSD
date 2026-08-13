import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  email: z.string().min(1, 'Введите логин').email('Некорректный email'),
  password: z.string().min(1, 'Введите пароль')
})
type Form = z.infer<typeof schema>

function BackgroundOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-32 -top-32 h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle, hsl(217 91% 60% / 0.12) 0%, transparent 70%)' }}
        animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-48 -right-16 h-[500px] w-[500px] rounded-full"
        style={{ background: 'radial-gradient(circle, hsl(217 91% 60% / 0.15) 0%, transparent 65%)' }}
        animate={{ x: [0, -25, 0], y: [0, 20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
    </div>
  )
}

export default function LoginPage() {
  const { login, status, error, clearError } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [shake, setShake] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema)
  })

  // No redirect needed - App swaps to the dashboard when status becomes authenticated.

  useEffect(() => {
    if (!error) return
    setShake(true)
    const t = setTimeout(() => setShake(false), 500)
    return () => clearTimeout(t)
  }, [error])

  const onSubmit = async (data: Form) => {
    clearError()
    try { await login(data.email, data.password) } catch { /* handled in store */ }
  }

  const isLoading = status === 'loading'

  return (
    // drag-region on root - the whole window background is draggable
    <div className="drag-region relative flex h-screen w-screen items-center justify-center overflow-hidden bg-background">
      <BackgroundOrbs />

      <motion.div
        className="no-drag relative z-10 w-full max-w-[340px] px-4"
        animate={shake ? { x: [-8, 8, -5, 5, -2, 2, 0] } : { x: 0 }}
        transition={shake ? { duration: 0.45, ease: 'easeOut' } : {}}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="glass rounded-2xl p-8 shadow-2xl"
          style={{
            boxShadow: '0 0 0 1px var(--glass-border), 0 24px 64px rgba(0,0,0,0.4)'
          }}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Логин</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@it.denvic.ru"
                autoComplete="email"
                autoFocus
                {...register('email')}
                className={errors.email ? 'border-destructive/60' : ''}
              />
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-destructive"
                  >
                    {errors.email.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Пароль</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  {...register('password')}
                  className={`pr-10 ${errors.password ? 'border-destructive/60' : ''}`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-destructive"
                  >
                    {errors.password.message}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Выполняется вход…
                </>
              ) : (
                'Войти'
              )}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </div>
  )
}
