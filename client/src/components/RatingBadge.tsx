import { clsx } from 'clsx';
import { Star } from 'lucide-react';
import type { RatingSummary } from '@shared/types';
import { formatTotal, ratingsLabel, scoreTier } from '@/lib/format';

export function RatingBadge({
  rating,
  size = 'sm',
  showCount = true,
  className,
}: {
  rating: RatingSummary;
  size?: 'sm' | 'md';
  showCount?: boolean;
  className?: string;
}) {
  const tier = scoreTier(rating.total, rating.count);
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-display font-bold tabular hairline',
        size === 'sm' ? 'h-6 px-2 text-[10px]' : 'h-8 px-3 text-[12px]',
        tier === 'high' && 'bg-acid/12 text-acid border-acid/25',
        tier === 'mid' && 'bg-white/8 text-chrome',
        tier === 'low' && 'bg-white/5 text-silver',
        tier === 'none' && 'bg-white/5 text-fog',
        className,
      )}
      title={rating.count ? ratingsLabel(rating.count) : 'Пока без оценок'}
    >
      <Star className={clsx(size === 'sm' ? 'size-3' : 'size-3.5', tier === 'high' && 'fill-current')} strokeWidth={2.5} />
      {rating.count ? (
        <>
          {formatTotal(rating.total)}
          <span className="opacity-50">/90</span>
          {showCount && <span className="ml-0.5 font-sans font-medium normal-case tracking-normal opacity-60">· {rating.count}</span>}
        </>
      ) : (
        <span className="font-sans font-medium tracking-normal">нет оценок</span>
      )}
    </span>
  );
}
