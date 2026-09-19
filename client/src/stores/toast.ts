import { create } from 'zustand';

export type ToastTone = 'neutral' | 'success' | 'danger';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: Toast[];
  show: (title: string, options?: { description?: string; tone?: ToastTone; duration?: number }) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show(title, options = {}) {
    const id = ++counter;
    set({ toasts: [...get().toasts.slice(-2), { id, title, description: options.description, tone: options.tone ?? 'neutral' }] });
    window.setTimeout(() => get().dismiss(id), options.duration ?? 2600);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  show: (title: string, options?: Parameters<ToastState['show']>[1]) => useToast.getState().show(title, options),
  success: (title: string, description?: string) => useToast.getState().show(title, { description, tone: 'success' }),
  error: (title: string, description?: string) =>
    useToast.getState().show(title, { description, tone: 'danger', duration: 3600 }),
};
