import { Check, Copy, LogOut, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { User } from '@shared/types';
import { MAX_NAME_LENGTH } from '@shared/types';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { DataSourcePanel } from '@/components/DataSourcePanel';
import { useBackend } from '@/lib/backend/useBackend';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useFeed } from '@/hooks/useTracks';
import { getBackend } from '@/lib/backend';
import { nameGradient } from '@/lib/cover';
import { formatDate, plural } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { usePlayer } from '@/stores/player';
import { toast } from '@/stores/toast';

export function GuestProfile() {
  const user = useAuth((s) => s.user)!;
  const info = useBackend();
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);
  const navigate = useNavigate();
  const feed = useFeed('new');
  const rated = (feed.data ?? []).filter((t) => t.myRating).length;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState(false);
  const [switching, setSwitching] = useState(false);

  const saveName = async () => {
    const clean = name.trim();
    if (!clean || clean === user.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await getBackend().rename(clean);
      setUser(res.user);
      setEditing(false);
      toast.success('Имя обновлено');
    } catch {
      toast.error('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const copyCode = async () => {
    if (!user.recoveryCode) return;
    try {
      await navigator.clipboard.writeText(user.recoveryCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.show(user.recoveryCode);
    }
  };

  const switchUser = async () => {
    setSwitching(true);
    usePlayer.getState().stop();
    await signOut();
    navigate('/guest', { replace: true });
  };

  return (
    <Screen>
      <ScreenHeader overline="Guest" title="PROFILE" />

      <section className="relative overflow-hidden rounded-[28px] glass p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-full font-display text-[26px] font-black text-ink" style={{ background: nameGradient(user.name) }}>
            {user.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <Input name="name" value={name} maxLength={MAX_NAME_LENGTH} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveName()} className="!h-12" />
                <IconButton variant="acid" size="md" aria-label="Сохранить" onClick={saveName} disabled={saving}>
                  <Check className="size-5" strokeWidth={3} />
                </IconButton>
              </div>
            ) : (
              <button type="button" onClick={() => setEditing(true)} className="flex max-w-full items-center gap-2 text-left">
                <span className="truncate font-display text-[22px] font-extrabold tracking-tight text-chrome">{user.name}</span>
                <Pencil className="size-4 shrink-0 text-fog" />
              </button>
            )}
            <p className="mt-0.5 text-[13px] text-fog">с {formatDate(user.createdAt)}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-black/25 px-4 py-3">
            <p className="font-display text-[22px] font-black tabular text-chrome">{rated}</p>
            <p className="text-[12px] text-fog">{plural(rated, ['трек оценён', 'трека оценено', 'треков оценено'], false)}</p>
          </div>
          <div className="rounded-2xl bg-black/25 px-4 py-3">
            <p className="font-display text-[22px] font-black tabular text-chrome">{feed.data?.length ?? '—'}</p>
            <p className="text-[12px] text-fog">треков в ленте</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-[28px] glass p-5">
        <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-fog">Код восстановления</p>
        <div className="mt-3 flex items-center gap-3">
          <p className="flex-1 font-display text-[24px] font-black tracking-[0.18em] text-chrome">{user.recoveryCode ?? '—'}</p>
          <IconButton size="md" aria-label="Скопировать" onClick={copyCode}>
            {copied ? <Check className="size-5 text-acid" strokeWidth={3} /> : <Copy className="size-5" />}
          </IconButton>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-fog">
          {info.kind === 'local'
            ? 'На этом устройстве код возвращает профиль после «Сменить пользователя». Для переноса на другое нужен общий сервер.'
            : 'Введи этот код на другом устройстве → «Я гость» → «Я уже здесь», чтобы вернуть профиль и свои оценки.'}
        </p>
      </section>

      <DataSourcePanel />

      <div className="mt-6">
        <Button variant="outline" size="lg" block icon={<LogOut className="size-4" />} onClick={() => setConfirmSwitch(true)}>
          Сменить пользователя
        </Button>
        <p className="mt-3 text-center text-[12px] text-fog">Профиль на этом устройстве будет забыт. Вернуть его можно по коду выше.</p>
      </div>

      <ConfirmSheet
        open={confirmSwitch}
        onClose={() => setConfirmSwitch(false)}
        onConfirm={switchUser}
        busy={switching}
        danger={false}
        title="Сменить пользователя?"
        description="Текущий профиль будет отвязан от этого устройства. Сохрани код восстановления, если захочешь вернуться."
        confirmLabel="Сменить"
      />
    </Screen>
  );
}
