import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, Role, User } from '@shared/types';
import { ApiError } from '@/lib/api';
import { getBackend, initBackend } from '@/lib/backend';

type BootStatus = 'booting' | 'ready';

interface AuthState {
  status: BootStatus;
  token: string | null;
  user: User | null;
  /** Artist device key — survives logout so the same artist identity is restored. */
  artistKey: string | null;
  /** True right after an automatic sign-in on app open (drives the "welcome back" moment). */
  restored: boolean;
  /** Set when a configured API did not answer, so screens can explain themselves. */
  offline: boolean;

  boot: () => Promise<void>;
  setSession: (res: AuthResponse) => void;
  setUser: (user: User) => void;
  signOut: (options?: { forgetArtist?: boolean }) => Promise<void>;
  clearLocal: () => void;
}

export const homeFor = (role: Role): string => (role === 'artist' ? '/studio' : '/home');

/**
 * Fired whenever the signed-in identity changes. The query cache is per-user
 * (`isMine`, `myRating`, and the feed ordering all depend on the viewer), so
 * App drops it here — otherwise a second profile on the same device would read
 * the first one's cached view of a track.
 */
export function announceSessionChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('musicrate:session'));
}

/** Applies a token to the active backend and keeps `configure` in one place. */
function useToken(token: string | null): void {
  try {
    getBackend().setToken(token);
  } catch {
    /* boot has not resolved the backend yet */
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      status: 'booting',
      token: null,
      user: null,
      artistKey: null,
      restored: false,
      offline: false,

      async boot() {
        // 1. pick the data source (API vs. on-device vault), 2. restore the session.
        try {
          await initBackend();
        } catch {
          set({ status: 'ready', offline: true });
          return;
        }
        const token = get().token;
        useToken(token);
        if (!token) {
          set({ status: 'ready' });
          return;
        }
        try {
          const { user } = await getBackend().me();
          set({ user, status: 'ready', restored: true, offline: false });
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            set({ token: null, user: null, status: 'ready' });
            useToken(null);
          } else {
            // unreachable: keep the cached profile so the app still opens
            set({ status: 'ready', restored: Boolean(get().user), offline: true });
          }
        }
      },

      setSession(res) {
        useToken(res.token);
        announceSessionChange();
        set({
          token: res.token,
          user: res.user,
          artistKey: res.artistKey ?? get().artistKey,
          restored: false,
          offline: false,
        });
      },

      setUser(user) {
        set({ user });
      },

      async signOut(options = {}) {
        const { token } = get();
        if (token) {
          try {
            await getBackend().logout();
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
        useToken(null);
        announceSessionChange();
      },

      clearLocal() {
        set({ token: null, user: null, restored: false });
        useToken(null);
        announceSessionChange();
      },
    }),
    {
      name: 'musicrate.auth.v1',
      partialize: (state) => ({ token: state.token, user: state.user, artistKey: state.artistKey }),
    },
  ),
);

/** The 401 handler the backends raise when a stored session stops working. */
window.addEventListener('musicrate:unauthorized', () => {
  useAuth.getState().clearLocal();
});
