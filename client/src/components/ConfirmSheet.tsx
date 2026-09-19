import type { ReactNode } from 'react';
import { Button } from './ui/Button';
import { Sheet } from './ui/Sheet';

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Удалить',
  cancelLabel = 'Отмена',
  danger = true,
  busy,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Sheet open={open} onClose={onClose} locked={busy}>
      <div className="px-1 pb-2 pt-3 text-center">
        {icon && <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-danger/15 text-danger">{icon}</div>}
        <h2 className="font-display text-[20px] font-extrabold tracking-tight text-chrome">{title}</h2>
        {description && <p className="mx-auto mt-2 max-w-xs text-[15px] leading-snug text-fog">{description}</p>}
      </div>
      <div className="mt-4 flex gap-3">
        <Button variant="glass" size="lg" className="flex-1" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          size="lg"
          className={danger ? 'flex-1 !bg-danger !text-white shadow-[0_10px_40px_-12px_rgba(255,77,94,0.6)]' : 'flex-1'}
          variant={danger ? 'chrome' : 'acid'}
          loading={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
