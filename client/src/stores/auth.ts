import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, Role, User } from '@shared/types';
import { api, ApiError, configureApi } from '@/lib/api';

type BootStatus = 'booting' | 'ready';

interface AuthState {
  status: BootStatus;
  token: string | null;
  user: User | null;
  /** Artist device key — survives logout so the same artist identity is restored. */
  artistKey: string | null;
  /** True right after an automatic sign-in on app open (drives the "welcome back" moment). */
  restored: boolean;

  boot: () => Promise<void>;
  setSession: (res: AuthResponse) => void;
  setUser: (user: User) => void;
  signOut: (options?: { forgetArtist?: boolean }) => Promise<void>;
  clearLocal: () => void;
}

export const homeFor = (role: Role): string => (role === 'artist' ? '/studio' : '/home');

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      status: 'booting',
      token: null,
      user: null,
      artistKey: null,
      restored: false,

      async boot() {
        const { token } = get();
        configureApi({ token, onUnauthorized: () => get().clearLocal() });
        if (!token) {
          set({ status: 'ready' });
          return;
        }
        try {
          const { user } = await api<{ user: User }>('/me', { silent401: true });
          set({ user, status: 'ready', restored: true });
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            set({ token: null, user: null, status: 'ready' });
            configureApi({ token: null, onUnauthorized: () => get().clearLocal() });
          } else {
            // offline: keep the cached profile so the app still opens
            set({ status: 'ready', restored: Boolean(get().user) });
          }
        }
      },

      setSession(res) {
        configureApi({ token: res.token, onUnauthorized: () => get().clearLocal() });
        set({
          token: res.token,
          user: res.user,
          artistKey: res.artistKey ?? get().artistKey,
          restored: false,
        });
      },

      setUser(user) {
        set({ user });
      },

      async signOut(options = {}) {
        const { token } = get();
        if (token) {
          try {
            await api('/auth/logout', { method: 'POST', silent401: true });
          } catch {
            /* the local state is what matters to the user */
          }
        }
        set({
          token: null,
          user: null,
          restored: false,
          artistKey: options.forgetArtist ? null : get().artistKey,
        });
        configureApi({ token: null, onUnauthorized: () => get().clearLocal() });
      },

      clearLocal() {
        set({ token: null, user: null, restored: false });
        configureApi({ token: null, onUnauthorized: () => get().clearLocal() });
      },
    }),
    {
      name: 'musicrate.auth.v1',
      partialize: (state) => ({ token: state.token, user: state.user, artistKey: state.artistKey }),
    },
  ),
);
