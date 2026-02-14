import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Custom User Type
export interface CustomUser {
  id: string;
  username: string;
}

interface AuthState {
  user: CustomUser | null;
  loading: boolean;
  initializeAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<{ error: string | null }>;
  register: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  initializeAuth: async () => {
    set({ loading: true });
    try {
      const storedUser = localStorage.getItem('poker_user');
      if (storedUser) {
        set({ user: JSON.parse(storedUser) });
      }
    } catch (e) {
      console.error('Failed to parse stored user', e);
      localStorage.removeItem('poker_user');
    } finally {
      set({ loading: false });
    }
  },

  login: async (username, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.rpc('login_user', {
        p_username: username,
        p_password: password
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      const user = data.user;
      localStorage.setItem('poker_user', JSON.stringify(user));
      set({ user });
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    } finally {
      set({ loading: false });
    }
  },

  register: async (username, password) => {
    set({ loading: true });
    try {
      const { data, error } = await supabase.rpc('register_user', {
        p_username: username,
        p_password: password
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message);

      const user = data.user;
      localStorage.setItem('poker_user', JSON.stringify(user));
      set({ user });
      return { error: null };
    } catch (err: any) {
      return { error: err.message };
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    localStorage.removeItem('poker_user');
    set({ user: null });
  },
}));
