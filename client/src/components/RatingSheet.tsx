import { useEffect, useState } from 'react';
import type { MyRating, RatingInput } from '@shared/types';
import { RATING_COMPONENT_MAX, RATING_TOTAL_MAX } from '@shared/types';
import { tap } from '@/lib/haptics';
import { AnimatedNumber } from './AnimatedNumber';
import { COMPONENTS } from './ScoreCard';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';

const FILL: Record<(typeof COMPONENTS)[number]['key'], string> = {
  quality: 'var(--color-ice)',
  listenability: 'var(--color-violet)',
  personal: 'var(--color-magenta)',
};

const HINTS: Record<(typeof COMPONENTS)[number]['key'], string> = {
  quality: 'Сведение, звук, исполнение',
  listenability: 'Хочется ли переслушать',
  personal: 'Твоё честное впечатление',
};

export function RatingSheet({
  open,
  onClose,
  initial,
  onSubmit,
  submitting,
  title,
}: {
  open: boolean;
  onClose: () => void;
  initial: MyRating | null;
  onSubmit: (rating: RatingInput) => void;
  submitting: boolean;
  title: string;
}) {
  const [values, setValues] = useState<RatingInput>({ quality: 20, listenability: 20, personal: 20 });

  useEffect(() => {
    if (open) {
      setValues(
        initial
          ? { quality: initial.quality, listenability: initial.listenability, personal: initial.personal }
          : { quality: 20, listenability: 20, personal: 20 },
      );
    }
  }, [open, initial]);

  const total = values.quality + values.listenability + values.personal;

  return (
    <Sheet open={open} onClose={onClose} locked={submitting} title={initial ? 'Изменить оценку' : 'Оценить трек'}>
      <p className="truncate text-[14px] text-fog">{title}</p>

      <div className="mt-5 flex items-end justify-between rounded-3xl bg-black/30 px-5 py-4">
        <div>
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-fog">Итог</p>
          <p className="mt-1 font-display text-[40px] font-black leading-none tracking-tight text-chrome">
            <AnimatedNumber value={total} format={(n) => String(Math.round(n))} duration={0.25} />
            <span className="text-[18px] font-bold text-fog"> / {RATING_TOTAL_MAX}</span>
          </p>
        </div>
        <div className="flex h-10 items-end gap-1 pb-1" aria-hidden>
          {COMPONENTS.map((c) => (
            <span
              key={c.key}
              className={`w-2.5 rounded-full ${c.accent} transition-[height] duration-200`}
              style={{ height: `${Math.max(8, (values[c.key] / RATING_COMPONENT_MAX) * 100)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {COMPONENTS.map((c) => {
          const v = values[c.key];
          return (
            <div key={c.key} className="py-2">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-chrome">{c.label}</p>
                  <p className="text-[12px] text-fog">{HINTS[c.key]}</p>
                </div>
                <p className="font-display text-[22px] font-black tabular text-chrome">
                  {v}
                  <span className="text-[13px] font-bold text-fog">/{RATING_COMPONENT_MAX}</span>
                </p>
              </div>
              <input
                type="range"
                min={0}
                max={RATING_COMPONENT_MAX}
                step={1}
                value={v}
                aria-label={c.label}
                className="score-range mt-1"
                style={
                  {
                    '--fill': `${(v / RATING_COMPONENT_MAX) * 100}%`,
                    '--fill-color': FILL[c.key],
                  } as React.CSSProperties
                }
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (next !== v) tap(4);
                  setValues((prev) => ({ ...prev, [c.key]: next }));
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex gap-3">
        <Button variant="glass" size="lg" className="flex-1" onClick={onClose} disabled={submitting}>
          Отмена
        </Button>
        <Button variant="acid" size="lg" className="flex-[1.6]" loading={submitting} onClick={() => onSubmit(values)}>
          {initial ? 'Обновить' : 'Отправить'}
        </Button>
      </div>
    </Sheet>
  );
}
