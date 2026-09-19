import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Aurora } from '@/components/Aurora';
import { Logo } from '@/components/Logo';
import { IconButton } from '@/components/ui/Button';

/** Shared frame for the auth/onboarding screens. */
export function EntryLayout({
  children,
  back = '/',
  overline,
  title,
  subtitle,
}: {
  children: ReactNode;
  back?: string | false;
  overline?: string;
  title: string;
  subtitle?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink">
      <Aurora intensity={0.7} />
      <motion.main
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col safe-x"
        style={{ paddingTop: 'calc(var(--sat) + 14px)', paddingBottom: 'max(var(--sab), 20px)' }}
      >
        <div className="flex items-center justify-between">
          {back ? (
            <IconButton size="md" aria-label="Назад" onClick={() => navigate(back)}>
              <ChevronLeft className="size-5" />
            </IconButton>
          ) : (
            <span />
          )}
          <Logo className="text-[14px]" />
          <span className="size-11" />
        </div>

        <div className="mt-12">
          {overline && (
            <p className="mb-2 font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-fog">{overline}</p>
          )}
          <h1 className="font-display text-[34px] font-black leading-[1.02] tracking-tight text-chrome text-balance">{title}</h1>
          {subtitle && <p className="mt-3 text-[16px] text-silver">{subtitle}</p>}
        </div>

        <div className="mt-8 flex flex-1 flex-col">{children}</div>
      </motion.main>
    </div>
  );
}
