import type { ReactNode } from 'react';
import { motion } from 'motion/react';

export function EmptyState({
  title,
  subtitle,
  action,
  compact,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className={`relative overflow-hidden rounded-[28px] glass grain-local text-center ${compact ? 'px-6 py-10' : 'px-6 py-14'}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 left-1/2 size-64 -translate-x-1/2 rounded-full bg-violet/25 blur-3xl"
      />
      <div className="relative mx-auto mb-6 flex h-12 items-end justify-center gap-1">
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={i}
            className="w-1.5 origin-bottom rounded-full bg-white/25 animate-bars"
            style={{ height: `${30 + ((i * 37) % 60)}%`, animationDelay: `${i * 90}ms`, animationDuration: `${1000 + (i % 3) * 200}ms` }}
          />
        ))}
      </div>
      <h3 className="relative font-display text-[22px] font-extrabold uppercase tracking-tight text-chrome">{title}</h3>
      {subtitle && <p className="relative mt-2 text-[15px] text-fog">{subtitle}</p>}
      {action && <div className="relative mt-6 flex justify-center">{action}</div>}
    </motion.div>
  );
}
