import { clsx } from 'clsx';
import { motion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { Spinner } from './Spinner';

type Variant = 'chrome' | 'acid' | 'glass' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  chrome: 'bg-chrome text-ink shadow-[0_10px_40px_-14px_rgba(255,255,255,0.45)]',
  acid: 'bg-acid text-ink shadow-glow-acid',
  glass: 'glass text-chrome',
  ghost: 'bg-transparent text-silver',
  danger: 'bg-danger/15 text-danger border border-danger/30',
  outline: 'bg-transparent text-chrome border border-white/15',
};

const sizes: Record<Size, string> = {
  sm: 'h-10 px-4 text-[11px] gap-1.5 rounded-full',
  md: 'h-12 px-5 text-[12px] gap-2 rounded-full',
  lg: 'h-14 px-6 text-[13px] gap-2 rounded-full',
  xl: 'h-16 px-7 text-[14px] gap-2.5 rounded-full',
};

export function Button({
  variant = 'chrome',
  size = 'md',
  block,
  loading,
  icon,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      whileTap={disabled || loading ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={clsx(
        'relative inline-flex items-center justify-center font-display font-semibold uppercase tracking-[0.12em] select-none',
        'transition-[opacity,box-shadow,background-color] duration-200 disabled:opacity-45 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      <span className={clsx('inline-flex items-center gap-[inherit]', loading && 'opacity-0')}>
        {icon}
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner className="size-5" />
        </span>
      )}
    </motion.button>
  );
}

/** Round icon-only button (back, close, more). */
export function IconButton({
  className,
  children,
  size = 'md',
  variant = 'glass',
  ...rest
}: Omit<ButtonProps, 'icon' | 'block'>) {
  const dims = { sm: 'size-9', md: 'size-11', lg: 'size-14', xl: 'size-16' }[size];
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        variants[variant],
        variant === 'chrome' && 'shadow-none',
        dims,
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
