import { create } from 'zustand';
import { ProductItem } from '../api/client';

export interface CartItem {
  product: ProductItem;
  quantity: number;
}

interface CartState {
  items: Record<string, CartItem>;
  addItem: (product: ProductItem) => void;
  removeItem: (productId: string) => void;
  getItemQuantity: (productId: string) => number;
  clearCart: () => void;
  totalItems: () => number;
  subtotal: () => number;
}

const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

export const useCartStore = create<CartState>((set, get) => ({
  items: {},

  addItem: (product) => {
    // Виброотклик Telegram при добавлении
    tg?.HapticFeedback?.impactOccurred('light');

    set((state) => {
      const current = state.items[product.id];
      const newQty = (current?.quantity || 0) + 1;
      return {
        items: {
          ...state.items,
          [product.id]: { product, quantity: newQty },
        },
      };
    });
  },

  removeItem: (productId) => {
    tg?.HapticFeedback?.impactOccurred('light');

    set((state) => {
      const current = state.items[productId];
      if (!current) return state;

      if (current.quantity <= 1) {
        const next = { ...state.items };
        delete next[productId];
        return { items: next };
      }

      return {
        items: {
          ...state.items,
          [productId]: { ...current, quantity: current.quantity - 1 },
        },
      };
    });
  },

  getItemQuantity: (productId) => {
    return get().items[productId]?.quantity || 0;
  },

  clearCart: () => set({ items: {} }),

  totalItems: () => {
    return Object.values(get().items).reduce((sum, item) => sum + item.quantity, 0);
  },

  subtotal: () => {
    return Object.values(get().items).reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  },
}));