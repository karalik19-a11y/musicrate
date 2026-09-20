import { RotateCcw } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ApiError } from '@/lib/api';
import { getBackend } from '@/lib/backend';
import { tap } from '@/lib/haptics';
import { homeFor, useAuth } from '@/stores/auth';
import { EntryLayout } from './EntryLayout';

export function GuestRestore() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const setSession = useAuth((s) => s.setSession);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await getBackend().restoreGuest(code.trim());
      tap([10, 30, 10]);
      setSession(res);
      navigate('/home', { replace: true, state: { welcome: true } });
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : 'Не получилось. Попробуй ещё раз.');
    }
  };

  return (
    <EntryLayout
      back="/guest"
      overline="Welcome back"
      title="Я уже здесь"
      subtitle="На этом устройстве нет сохранённого профиля. Введи код восстановления — он в разделе Profile на твоём прошлом устройстве."
    >
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Input
          name="code"
          big
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="K7QD-3MPX"
          className="text-center font-display tracking-[0.3em] uppercase"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          error={error}
        />
        <div className="mt-auto space-y-3 pt-8">
          <Button type="submit" variant="chrome" size="xl" block loading={busy} disabled={!code.trim()} icon={<RotateCcw className="size-5" />}>
            Восстановить
          </Button>
          <Button type="button" variant="ghost" size="md" block onClick={() => navigate('/guest/new')}>
            Нет кода — создать новый профиль
          </Button>
        </div>
      </form>
    </EntryLayout>
  );
}
