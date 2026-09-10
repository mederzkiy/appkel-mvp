import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: any | null;
  loading: boolean;
  checkAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  checkAuth: async () => {
    try {
      // Только классическая авторизация Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      set({ user: session?.user || null, loading: false });

      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user || null });
      });
    } catch (err) {
      console.error('[Admin Auth] Error:', err);
      set({ user: null, loading: false });
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));