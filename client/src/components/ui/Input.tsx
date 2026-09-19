import { clsx } from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  big?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, big, className, id, ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label htmlFor={inputId} className="block">
      {label && (
        <span className="mb-2 block font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-fog">{label}</span>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          'w-full rounded-2xl bg-graphite-2 text-chrome placeholder:text-smoke hairline',
          'transition-[box-shadow,border-color] duration-200 focus:border-white/25 focus:shadow-[0_0_0_4px_rgba(255,255,255,0.05)]',
          big ? 'h-16 px-5 text-[19px]' : 'h-14 px-4 text-[17px]',
          error && 'border-danger/60',
          className,
        )}
        {...rest}
      />
      {(error || hint) && (
        <span className={clsx('mt-2 block text-[13px]', error ? 'text-danger' : 'text-fog')}>{error ?? hint}</span>
      )}
    </label>
  );
});
