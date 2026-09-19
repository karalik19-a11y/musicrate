import { clsx } from 'clsx';
import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { IconButton } from './Button';

/** Page wrapper with safe-area padding and the iOS-style entrance animation. */
export function Screen({ children, className, dock = true }: { children: ReactNode; className?: string; dock?: boolean }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
      className={clsx('mx-auto w-full max-w-lg safe-x safe-top', dock ? 'pb-dock' : 'safe-bottom', className)}
    >
      {children}
    </motion.main>
  );
}

export function ScreenHeader({
  overline,
  title,
  action,
  back,
  className,
}: {
  overline?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  back?: boolean | string;
  className?: string;
}) {
  const navigate = useNavigate();
  return (
    <header className={clsx('mb-6 flex items-end justify-between gap-4 pt-2', className)}>
      <div className="min-w-0">
        {back && (
          <IconButton
            size="sm"
            className="mb-4"
            aria-label="Назад"
            onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))}
          >
            <ChevronLeft className="size-5" />
          </IconButton>
        )}
        {overline && (
          <p className="mb-1 font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-fog">{overline}</p>
        )}
        <h1 className="font-display text-[30px] font-extrabold leading-[1.05] tracking-tight text-chrome text-balance">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0 pb-1">{action}</div>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-[12px] font-bold uppercase tracking-[0.2em] text-silver">{children}</h2>
      {action}
    </div>
  );
}
