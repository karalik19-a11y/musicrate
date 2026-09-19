import { clsx } from 'clsx';
import { AnimatePresence, motion, useDragControls, type PanInfo } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Extra classes for the sheet panel. */
  className?: string;
  /** Prevent closing by backdrop/drag (e.g. while a request is running). */
  locked?: boolean;
}

/** iOS-style bottom sheet: spring in, drag-to-dismiss, safe-area aware. */
export function Sheet({ open, onClose, children, title, className, locked }: SheetProps) {
  const controls = useDragControls();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !locked && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, locked]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (locked) return;
    if (info.offset.y > 110 || info.velocity.y > 600) onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet-root"
          className="fixed inset-0 z-[80] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => !locked && onClose()} />
          <motion.div
            role="dialog"
            aria-modal
            aria-label={title}
            className={clsx(
              'relative w-full max-w-lg rounded-t-[28px] glass-strong shadow-soft',
              'max-h-[calc(100dvh-var(--sat)-16px)] overflow-y-auto no-scrollbar overscroll-contain',
              className,
            )}
            style={{ paddingBottom: 'max(var(--sab), 16px)' }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 40, mass: 0.9 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div
              className="sticky top-0 z-10 flex cursor-grab touch-none flex-col items-center pt-3 pb-1 active:cursor-grabbing"
              onPointerDown={(e) => controls.start(e)}
            >
              <span className="h-1.5 w-11 rounded-full bg-white/20" />
            </div>
            {title && (
              <h2 className="px-6 pt-2 pb-1 font-display text-[15px] font-bold uppercase tracking-[0.14em] text-chrome">
                {title}
              </h2>
            )}
            <div className="px-5 pt-2">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
