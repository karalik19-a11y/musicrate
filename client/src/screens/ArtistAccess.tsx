import { Check, Eye, EyeOff, KeyRound } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { AuthResponse } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { tap } from '@/lib/haptics';
import { homeFor, useAuth } from '@/stores/auth';
import { EntryLayout } from './EntryLayout';

export function ArtistAccess() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const artistKey = useAuth((s) => s.artistKey);
  const setSession = useAuth((s) => s.setSession);
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState(false);
  const [shake, setShake] = useState(0);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<AuthResponse>('/auth/artist', {
        method: 'POST',
        body: { password: code.trim(), artistKey: artistKey ?? undefined },
        silent401: true,
      });
      setGranted(true);
      tap([10, 30, 10]);
      window.setTimeout(() => {
        setSession(res);
        navigate('/studio', { replace: true });
      }, 900);
    } catch (err) {
      setBusy(false);
      setShake((n) => n + 1);
      tap([20, 40, 20]);
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    }
  };

  return (
    <EntryLayout overline="Artists only" title="ARTIST ACCESS" subtitle="Введите пароль, чтобы открыть панель публикации.">
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <motion.div
          key={shake}
          animate={shake ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
          transition={{ duration: 0.45 }}
          className="relative"
        >
          <input
            type={show ? 'text' : 'password'}
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            disabled={busy}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            placeholder="••••••••"
            aria-label="Пароль"
            className={`h-20 w-full rounded-[26px] px-6 pr-16 text-center font-display text-[26px] font-bold tracking-[0.42em] transition-all duration-300 placeholder:text-smoke placeholder:tracking-[0.42em] ${
              granted
                ? 'border border-acid bg-acid/15 text-acid shadow-glow-acid'
                : error
                  ? 'border border-danger/60 bg-graphite-2 text-chrome'
                  : 'glass text-chrome focus:border-white/30'
            }`}
          />
          <button
            type="button"
            aria-label={show ? 'Скрыть пароль' : 'Показать пароль'}
            onClick={() => setShow((v) => !v)}
            className="absolute right-4 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-fog"
          >
            {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </motion.div>

        <div className="mt-3 min-h-6 text-center">
          <AnimatePresence mode="wait">
            {error && (
              <motion.p
                key="err"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[14px] font-medium text-danger"
              >
                {error}
              </motion.p>
            )}
            {granted && (
              <motion.p
                key="ok"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="inline-flex items-center gap-2 font-display text-[12px] font-bold uppercase tracking-[0.22em] text-acid"
              >
                <Check className="size-4" strokeWidth={3} /> Access granted
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-auto space-y-3 pt-8">
          <Button type="submit" variant={granted ? 'acid' : 'chrome'} size="xl" block loading={busy && !granted} disabled={!code.trim()} icon={<KeyRound className="size-5" />}>
            {granted ? 'Открываем студию' : 'Войти'}
          </Button>
          <Button type="button" variant="ghost" size="md" block onClick={() => navigate('/')}>
            Назад
          </Button>
        </div>
      </form>
    </EntryLayout>
  );
}
