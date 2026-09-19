import { Check, LogOut, Pencil, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { User } from '@shared/types';
import { MAX_NAME_LENGTH } from '@shared/types';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen, ScreenHeader } from '@/components/ui/Screen';
import { useArtistOverview } from '@/hooks/useTracks';
import { api } from '@/lib/api';
import { nameGradient } from '@/lib/cover';
import { formatDate, formatInt } from '@/lib/format';
import { useAuth } from '@/stores/auth';
import { usePlayer } from '@/stores/player';
import { toast } from '@/stores/toast';

export function ArtistProfile() {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const signOut = useAuth((s) => s.signOut);
  const navigate = useNavigate();
  const overview = useArtistOverview();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const saveName = async () => {
    const clean = name.trim();
    if (!clean || clean === user.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ user: User }>('/me', { method: 'PATCH', body: { name: clean } });
      setUser(res.user);
      setEditing(false);
      toast.success('Имя обновлено');
    } catch {
      toast.error('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const leave = async () => {
    setLeaving(true);
    usePlayer.getState().stop();
    await signOut();
    navigate('/', { replace: true });
  };

  return (
    <Screen>
      <ScreenHeader overline="Artist" title="PROFILE" />

      <section className="rounded-[28px] glass p-5">
        <div className="flex items-center gap-4">
          <div className="grid size-16 shrink-0 place-items-center rounded-full font-display text-[26px] font-black text-ink" style={{ background: nameGradient(user.id) }}>
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
            <p className="mt-0.5 text-[13px] text-fog">в студии с {formatDate(user.createdAt)}</p>
          </div>
        </div>
        <p className="mt-4 text-[13px] text-fog">Имя подставляется как «Имя музыканта» при публикации — его можно менять для каждого трека.</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ['Треки', overview.data ? formatInt(overview.data.tracks) : '—'],
            ['Оценки', overview.data ? formatInt(overview.data.ratings) : '—'],
            ['Прослуш.', overview.data ? formatInt(overview.data.plays) : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-black/25 px-3 py-2.5">
              <p className="font-display text-[20px] font-black tabular text-chrome">{value}</p>
              <p className="text-[11px] uppercase tracking-wider text-fog">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 flex items-start gap-3 rounded-[28px] glass p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-acid/12 text-acid">
          <ShieldCheck className="size-5" />
        </span>
        <div className="text-[13px] leading-relaxed text-fog">
          <p className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-chrome">Сессия сохранена</p>
          <p className="mt-1">Код доступа больше не нужно вводить на этом устройстве. После выхода твои треки останутся привязаны к тебе — при следующем входе с этого устройства студия восстановится.</p>
        </div>
      </section>

      <div className="mt-6">
        <Button variant="outline" size="lg" block icon={<LogOut className="size-4" />} onClick={() => setConfirm(true)}>
          Выйти
        </Button>
      </div>

      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={leave}
        busy={leaving}
        danger={false}
        title="Выйти из студии?"
        description="Для повторного входа понадобится код доступа."
        confirmLabel="Выйти"
      />
    </Screen>
  );
}
