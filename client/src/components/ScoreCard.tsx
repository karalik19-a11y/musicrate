import { clsx } from 'clsx';
import { motion } from 'motion/react';
import type { MyRating, RatingSummary } from '@shared/types';
import { RATING_COMPONENT_MAX, RATING_TOTAL_MAX } from '@shared/types';
import { formatScore, formatTotal, ratingsLabel } from '@/lib/format';
import { AnimatedNumber } from './AnimatedNumber';

export const COMPONENTS = [
  { key: 'quality', label: 'Качество', accent: 'bg-ice' },
  { key: 'listenability', label: 'Слушабельность', accent: 'bg-violet' },
  { key: 'personal', label: 'Личная оценка', accent: 'bg-magenta' },
] as const;

function Row({ label, value, accent, precise }: { label: string; value: number; accent: string; precise: boolean }) {
  const pct = Math.min(100, Math.max(0, (value / RATING_COMPONENT_MAX) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
        <span className="text-silver">{label}</span>
        <span className="font-display text-[13px] font-bold tabular text-chrome">
          <AnimatedNumber value={value} format={precise ? formatScore : (n) => String(Math.round(n))} />
          <span className="text-fog"> / {RATING_COMPONENT_MAX}</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className={clsx('h-full rounded-full', accent)}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 22 }}
        />
      </div>
    </div>
  );
}

/** Community score block: total /90, count, three averaged components. */
export function PublicScoreCard({ rating, className }: { rating: RatingSummary; className?: string }) {
  const empty = rating.count === 0;
  return (
    <section className={clsx('relative overflow-hidden rounded-[26px] glass p-5', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-acid/12 blur-3xl"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-fog">Общая оценка</p>
          <p className="mt-2 font-display text-[44px] font-black leading-none tracking-tight text-chrome">
            {empty ? <span className="text-smoke">—</span> : <AnimatedNumber value={rating.total} format={formatTotal} />}
            <span className="text-[20px] font-bold text-fog"> / {RATING_TOTAL_MAX}</span>
          </p>
          <p className="mt-2 text-[14px] text-silver">{empty ? 'Пока никто не оценил' : ratingsLabel(rating.count)}</p>
        </div>
      </div>
      <div className="relative mt-5 space-y-3.5">
        {COMPONENTS.map((c) => (
          <Row key={c.key} label={c.label} value={rating[c.key]} accent={c.accent} precise />
        ))}
      </div>
    </section>
  );
}

export function MyScoreCard({ rating, className }: { rating: MyRating; className?: string }) {
  return (
    <section className={clsx('rounded-[26px] border border-acid/25 bg-acid/6 p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.22em] text-acid">Моя оценка</p>
          <p className="mt-2 font-display text-[36px] font-black leading-none tracking-tight text-chrome">
            <AnimatedNumber value={rating.total} format={formatTotal} />
            <span className="text-[18px] font-bold text-fog"> / {RATING_TOTAL_MAX}</span>
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {COMPONENTS.map((c) => (
          <div key={c.key} className="rounded-2xl bg-black/25 px-3 py-2.5">
            <p className="truncate text-[11px] text-fog">{c.label}</p>
            <p className="mt-0.5 font-display text-[15px] font-bold tabular text-chrome">
              {rating[c.key]}
              <span className="text-fog">/{RATING_COMPONENT_MAX}</span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
