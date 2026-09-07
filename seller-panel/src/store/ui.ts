import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface UIState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: number) => void;
}

let nextId = 0;

export const useUIStore = create<UIState>((set) => ({
  toasts: [],

  addToast: (message: string, type: ToastType = 'info') => {
    const id = ++nextId;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));

    // Автоматическое скрытие через 3 секунды
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 3000);
  },

  removeToast: (id: number) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));