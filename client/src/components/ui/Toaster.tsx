import { clsx } from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { Check, TriangleAlert } from 'lucide-react';
import { useToast } from '@/stores/toast';

export function Toaster() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4"
      style={{ paddingTop: 'calc(var(--sat) + 10px)' }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.button
            key={t.id}
            layout
            initial={{ opacity: 0, y: -24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            onClick={() => dismiss(t.id)}
            className={clsx(
              'pointer-events-auto flex max-w-sm items-center gap-3 rounded-full py-2.5 pl-3 pr-5 text-left glass-strong shadow-soft',
            )}
          >
            <span
              className={clsx(
                'grid size-8 shrink-0 place-items-center rounded-full',
                t.tone === 'success' && 'bg-acid text-ink',
                t.tone === 'danger' && 'bg-danger/20 text-danger',
                t.tone === 'neutral' && 'bg-white/10 text-chrome',
              )}
            >
              {t.tone === 'danger' ? <TriangleAlert className="size-4" /> : <Check className="size-4" strokeWidth={3} />}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[12px] font-bold uppercase tracking-[0.14em]">{t.title}</span>
              {t.description && <span className="block truncate text-[13px] text-silver">{t.description}</span>}
            </span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
}
