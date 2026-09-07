import { create } from 'zustand';
import { StoreInfo } from '../api/client';

export type ViewType = 'catalog' | 'cart' | 'checkout' | 'payment' | 'order-status';

interface AppState {
  currentView: ViewType;
  history: ViewType[];
  storeId: string;
  storeInfo: StoreInfo | null;
  activeOrderId: string | null;
  lastOrderTotal: number;

  setStoreId: (id: string) => void;
  setStoreInfo: (info: StoreInfo) => void;
  setActiveOrder: (orderId: string, total: number) => void;
  navigate: (view: ViewType) => void;
  goBack: () => void;
}

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export const useAppStore = create<AppState>((set, get) => ({
  currentView: 'catalog',
  history: ['catalog'],
  storeId: '',
  storeInfo: null,
  activeOrderId: null,
  lastOrderTotal: 0,

  setStoreId: (id) => set({ storeId: id }),
  setStoreInfo: (info) => set({ storeInfo: info }),

  setActiveOrder: (orderId, total) =>
    set({ activeOrderId: orderId, lastOrderTotal: total }),

  navigate: (view) => {
    const { history, currentView } = get();
    if (currentView === view) return;

    const nextHistory = [...history, view];
    set({ currentView: view, history: nextHistory });

    // Управляем системной кнопкой «Назад» в Telegram
    if (nextHistory.length > 1 && view !== 'order-status') {
      tg?.BackButton?.show();
    } else {
      tg?.BackButton?.hide();
    }
  },

  goBack: () => {
    const { history } = get();
    if (history.length <= 1) return;

    const nextHistory = history.slice(0, -1);
    const prevView = nextHistory[nextHistory.length - 1];

    set({ currentView: prevView, history: nextHistory });

    if (nextHistory.length <= 1) {
      tg?.BackButton?.hide();
    }
  },
}));