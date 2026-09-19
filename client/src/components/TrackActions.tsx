import { Trash2 } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { Track } from '@shared/types';
import { useDeleteTrack } from '@/hooks/useTracks';
import { ApiError } from '@/lib/api';
import { tap } from '@/lib/haptics';
import { usePlayer } from '@/stores/player';
import { toast } from '@/stores/toast';
import { ConfirmSheet } from './ConfirmSheet';
import { TrackMenuSheet } from './TrackMenuSheet';

/**
 * Shared "•••" behaviour for a track: menu → (listen | open | delete) → confirm.
 * Returns an `openMenu` trigger and the sheets to render once per screen.
 */
export function useTrackActions(options: { queue?: Track[]; onDeleted?: (id: string) => void; allowDelete?: boolean } = {}) {
  const navigate = useNavigate();
  const play = usePlayer((s) => s.play);
  const remove = useDeleteTrack();
  const [menuTrack, setMenuTrack] = useState<Track | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmTrack, setConfirmTrack] = useState<Track | null>(null);

  const openMenu = useCallback((track: Track) => {
    tap();
    setMenuTrack(track);
    setMenuOpen(true);
  }, []);

  const confirmDelete = async () => {
    if (!confirmTrack) return;
    try {
      const id = confirmTrack.id;
      await remove.mutateAsync(id);
      setConfirmTrack(null);
      tap([10, 30, 10]);
      toast.success('TRACK DELETED', `«${confirmTrack.title}» больше недоступен`);
      options.onDeleted?.(id);
    } catch (err) {
      toast.error('Не удалось удалить', err instanceof ApiError ? err.message : undefined);
    }
  };

  const element: ReactNode = (
    <>
      <TrackMenuSheet
        track={menuTrack}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPlay={() => {
          if (menuTrack) play(menuTrack, options.queue);
          setMenuOpen(false);
        }}
        onOpen={() => {
          setMenuOpen(false);
          if (menuTrack) navigate(`/track/${menuTrack.id}`);
        }}
        onDelete={
          options.allowDelete === false || !menuTrack?.isMine
            ? undefined
            : () => {
                setMenuOpen(false);
                window.setTimeout(() => setConfirmTrack(menuTrack), 180);
              }
        }
      />
      <ConfirmSheet
        open={Boolean(confirmTrack)}
        onClose={() => !remove.isPending && setConfirmTrack(null)}
        onConfirm={confirmDelete}
        busy={remove.isPending}
        icon={<Trash2 className="size-6" />}
        title="Удалить трек?"
        description="Трек будет удалён из приложения и больше не будет доступен гостям."
        confirmLabel="Удалить"
      />
    </>
  );

  return { openMenu, element, deleting: remove.isPending };
}
