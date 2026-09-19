import { ArrowRight } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import type { AuthResponse } from '@shared/types';
import { MAX_NAME_LENGTH } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api, ApiError } from '@/lib/api';
import { tap } from '@/lib/haptics';
import { homeFor, useAuth } from '@/stores/auth';
import { EntryLayout } from './EntryLayout';

export function GuestNew() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const setSession = useAuth((s) => s.setSession);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = name.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<AuthResponse>('/auth/guest', { method: 'POST', body: { name: clean } });
      tap([10, 30, 10]);
      setSession(res);
      navigate('/home', { replace: true, state: { welcome: true } });
    } catch (err) {
      setBusy(false);
      setError(err instanceof ApiError ? err.message : 'Не получилось. Попробуй ещё раз.');
    }
  };

  return (
    <EntryLayout back="/guest" overline="New guest" title="Как тебя зовут?" subtitle="Имя увидят только в твоём профиле.">
      <form onSubmit={submit} className="flex flex-1 flex-col">
        <Input
          name="name"
          big
          autoFocus
          autoComplete="nickname"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={MAX_NAME_LENGTH}
          placeholder="Например, Daniel"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          error={error}
        />
        <div className="mt-auto pt-8">
          <Button type="submit" variant="acid" size="xl" block loading={busy} disabled={!name.trim()} icon={<ArrowRight className="size-5" />}>
            Поехали
          </Button>
        </div>
      </form>
    </EntryLayout>
  );
}
