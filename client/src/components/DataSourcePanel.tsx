import { AlertTriangle, Database, Server, ShieldAlert, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ConfirmSheet } from '@/components/ConfirmSheet';
import { Button, IconButton } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { getLocalBackend, switchBackend } from '@/lib/backend';
import { useBackend } from '@/lib/backend/useBackend';
import { useAuth } from '@/stores/auth';
import { usePlayer } from '@/stores/player';
import { toast } from '@/stores/toast';

function normalizeBase(value: string): string | null {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    // tolerate "api.example.com" and "http://localhost:8080"
    return /^[\w-]+(:\d+)?([/.]|$)/.test(trimmed) ? `https://${trimmed}` : null;
  }
  return trimmed;
}

/**
 * Tells the user where their data actually lives, and lets them point the same
 * static bundle at a real API without a rebuild. That matters on GitHub Pages:
 * the link is static, so by default the device itself is the database.
 */
export function DataSourcePanel() {
  const info = useBackend();
  const clearLocal = useAuth((s) => s.clearLocal);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(info.apiBase ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  const connect = () => {
    const base = normalizeBase(value);
    if (!base) {
      setError('Нужен полный адрес, например https://musicrate.onrender.com');
      return;
    }
    switchBackend(base); // persists + reloads into the API backend
  };

  const resetVault = async () => {
    const local = getLocalBackend();
    if (!local) return;
    setResetting(true);
    try {
      usePlayer.getState().stop();
      await local.resetVault();
      clearLocal();
      window.localStorage.removeItem('musicrate.auth.v1');
      window.location.reload();
    } catch {
      setResetting(false);
      setConfirmReset(false);
      toast.error('Не удалось очистить хранилище');
    }
  };

  return (
    <section className="mt-4 rounded-[28px] glass p-5">
      <div className="flex items-start gap-3">
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-2xl ${
            info.kind === 'http' && !info.unreachable ? 'bg-acid/15 text-acid' : info.unreachable ? 'bg-danger/15 text-danger' : 'bg-white/8 text-silver'
          }`}
        >
          {info.kind === 'http' ? <Server className="size-4" /> : <Database className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-fog">Источник данных</p>
          {info.kind === 'http' ? (
            <>
              <p className="mt-1.5 truncate text-[15px] font-medium text-chrome">
                {info.unreachable ? 'Сервер не отвечает' : 'Общий сервер'}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-fog">
                {info.apiBase ? <span className="break-all">{info.apiBase}</span> : 'Тот же адрес, что и у приложения'}
                {info.unreachable
                  ? ' — публикации и оценки вернутся, как только API снова ответит.'
                  : ' — треки, оценки и профили видны всем, кто заходит в это же приложение.'}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-[15px] font-medium text-chrome">Хранилище этого устройства</p>
              <p className="mt-1 text-[13px] leading-relaxed text-fog">
                Приложение открыто со статической ссылки, поэтому настоящий движок работает внутри браузера: треки, оценки и
                сессии сохраняются на устройстве и переживают перезагрузку. Чтобы общая база появилась у всех, подключи API
                ниже — интерфейс при этом не меняется.
              </p>
            </>
          )}
        </div>
      </div>

      {info.unreachable && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-danger/10 px-3 py-2.5 text-[13px] leading-snug text-danger">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          Проверь, что адрес API запущен и разрешает запросы с этого домена (CORS).
        </p>
      )}

      {info.kind === 'http' && (
        <div className="mt-4">
          <Button variant="outline" size="md" block onClick={() => switchBackend(null)}>
            Отключить сервер и работать локально
          </Button>
        </div>
      )}

      {editing ? (
        <div className="mt-4 space-y-3">
          <Input
            name="apiBase"
            autoFocus
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="https://musicrate.onrender.com"
            value={value}
            error={error}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && connect()}
          />
          <div className="flex gap-2">
            <Button variant="acid" size="md" className="flex-1" onClick={connect}>
              Подключить
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setEditing(false);
                setValue(info.apiBase ?? '');
                setError(null);
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-2">
          <Button variant="outline" size="md" className="flex-1" onClick={() => setEditing(true)}>
            {info.kind === 'http' ? 'Сменить адрес API' : 'Подключить общий сервер'}
          </Button>
          {info.kind === 'local' && (
            <IconButton size="md" variant="outline" aria-label="Очистить локальные данные" onClick={() => setConfirmReset(true)}>
              <Trash2 className="size-4" />
            </IconButton>
          )}
        </div>
      )}

      {info.kind === 'local' && (
        <p className="mt-3 flex items-start gap-2 text-[12px] leading-snug text-smoke">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
          В локальном режиме приложение — личная коллекция: код артиста проверяется на устройстве. Для настоящей защиты
          доступа и оценок нужен бэкенд.
        </p>
      )}

      <ConfirmSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetVault}
        busy={resetting}
        danger
        title="Стереть данные устройства?"
        description="Локальные треки, профили, оценки и сессии будут удалены из браузера. Отменить это нельзя."
        confirmLabel="Стереть"
      />
    </section>
  );
}
