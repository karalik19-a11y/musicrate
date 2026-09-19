import { AnimatePresence } from 'motion/react';
import { useEffect } from 'react';
import { Navigate, useLocation, useOutlet } from 'react-router';
import type { Role } from '@shared/types';
import { homeFor, useAuth } from '@/stores/auth';
import { usePlayer } from '@/stores/player';
import { FullPlayer } from './FullPlayer';
import { MiniPlayer } from './MiniPlayer';
import { TabBar } from './TabBar';

/**
 * Authenticated layout: animated page outlet + fixed dock (mini player + tabs).
 * `role` restricts the subtree; users with the other role are sent home.
 */
export function AppShell({ role }: { role?: Role }) {
  const user = useAuth((s) => s.user);
  const hasTrack = usePlayer((s) => s.index >= 0);
  const location = useLocation();
  const outlet = useOutlet();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.style.setProperty('--mini-h', hasTrack ? '72px' : '0px');
  }, [hasTrack]);

  if (!user) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <div className="min-h-dvh">
      <AnimatePresence mode="wait" initial={false}>
        <div key={location.pathname} className="min-h-dvh">
          {outlet}
        </div>
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col">
        <AnimatePresence>{hasTrack && <MiniPlayer key="mini" />}</AnimatePresence>
        <TabBar role={user.role} />
      </div>

      <FullPlayer />
    </div>
  );
}
