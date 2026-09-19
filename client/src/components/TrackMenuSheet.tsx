import { clsx } from 'clsx';
import { ExternalLink, Pause, Play, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { Track } from '@shared/types';
import { useIsCurrent } from '@/stores/player';
import { CoverArt } from './CoverArt';
import { Sheet } from './ui/Sheet';

interface Action {
  label: string;
  icon: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
}

function Item({ action, index }: { action: Action; index: number }) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index, type: 'spring', stiffness: 400, damping: 30 }}
      whileTap={{ scale: 0.97 }}
      onClick={action.onSelect}
      className={clsx(
        'flex h-14 w-full items-center gap-4 rounded-2xl px-4 text-left text-[16px] font-medium',
        action.danger ? 'bg-danger/10 text-danger' : 'bg-white/5 text-chrome',
      )}
    >
      <span className="grid size-9 place-items-center rounded-full bg-black/30">{action.icon}</span>
      {action.label}
    </motion.button>
  );
}

/** The "•••" menu for a track: listen / open / delete. */
export function TrackMenuSheet({
  track,
  open,
  onClose,
  onPlay,
  onOpen,
  onDelete,
}: {
  track: Track | null;
  open: boolean;
  onClose: () => void;
  onPlay: () => void;
  onOpen: () => void;
  onDelete?: () => void;
}) {
  const { isPlaying } = useIsCurrent(track?.id ?? '');
  const actions: Action[] = [
    { label: isPlaying ? 'Пауза' : 'Прослушать', icon: isPlaying ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />, onSelect: onPlay },
    { label: 'Открыть', icon: <ExternalLink className="size-4" />, onSelect: onOpen },
  ];
  if (onDelete) actions.push({ label: 'Удалить', icon: <Trash2 className="size-4" />, onSelect: onDelete, danger: true });

  return (
    <Sheet open={open && Boolean(track)} onClose={onClose}>
      {track && (
        <>
          <div className="flex items-center gap-3 px-1 pb-4 pt-1">
            <CoverArt seed={track.coverSeed} title={track.title} className="size-12" rounded="rounded-xl" />
            <div className="min-w-0">
              <p className="truncate font-display text-[15px] font-bold text-chrome">{track.title}</p>
              <p className="truncate text-[13px] text-fog">{track.artistName}</p>
            </div>
          </div>
          <div className="space-y-2">
            {actions.map((a, i) => (
              <Item key={a.label} action={a} index={i} />
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
