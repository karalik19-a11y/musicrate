import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createHashRouter, Navigate, RouterProvider } from 'react-router';
import { AppShell } from '@/components/AppShell';
import { Splash } from '@/components/Splash';
import { Toaster } from '@/components/ui/Toaster';
import { ArtistAccess } from '@/screens/ArtistAccess';
import { GuestEntry } from '@/screens/GuestEntry';
import { GuestNew } from '@/screens/GuestNew';
import { GuestRestore } from '@/screens/GuestRestore';
import { NotFound } from '@/screens/NotFound';
import { TrackPage } from '@/screens/TrackPage';
import { Welcome } from '@/screens/Welcome';
import { ArtistDashboard } from '@/screens/artist/Dashboard';
import { ArtistProfile } from '@/screens/artist/Profile';
import { ArtistTracks } from '@/screens/artist/Tracks';
import { ArtistUpload } from '@/screens/artist/Upload';
import { Discover } from '@/screens/guest/Discover';
import { GuestHome } from '@/screens/guest/Home';
import { GuestProfile } from '@/screens/guest/Profile';
import { useAuth } from '@/stores/auth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: true },
  },
});

/**
 * Hash routing is a deployment decision, not a stylistic one: on GitHub Pages
 * (and on a `file://` copy of the build) there is no server to rewrite deep
 * links, so `/#/track/abc` is the only form that survives a refresh.
 */
const router = createHashRouter([
  { path: '/', element: <Welcome /> },
  { path: '/artist/access', element: <ArtistAccess /> },
  { path: '/guest', element: <GuestEntry /> },
  { path: '/guest/new', element: <GuestNew /> },
  { path: '/guest/restore', element: <GuestRestore /> },
  {
    element: <AppShell role="guest" />,
    children: [
      { path: '/home', element: <GuestHome /> },
      { path: '/discover', element: <Discover /> },
      { path: '/profile', element: <GuestProfile /> },
    ],
  },
  {
    element: <AppShell role="artist" />,
    children: [
      { path: '/studio', element: <ArtistDashboard /> },
      { path: '/studio/tracks', element: <ArtistTracks /> },
      { path: '/studio/upload', element: <ArtistUpload /> },
      { path: '/studio/profile', element: <ArtistProfile /> },
    ],
  },
  {
    element: <AppShell />,
    children: [{ path: '/track/:id', element: <TrackPage /> }],
  },
  { path: '/index.html', element: <Navigate to="/" replace /> },
  { path: '*', element: <NotFound /> },
]);

export default function App() {
  const status = useAuth((s) => s.status);
  const boot = useAuth((s) => s.boot);
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    void boot();
    const t = window.setTimeout(() => setMinSplashDone(true), 350);
    return () => window.clearTimeout(t);
  }, [boot]);

  /** A new identity means a new view of the same data. */
  useEffect(() => {
    const onSession = () => queryClient.clear();
    window.addEventListener('musicrate:session', onSession);
    return () => window.removeEventListener('musicrate:session', onSession);
  }, []);
  /**
   * Every write to the on-device vault (here or in another tab) re-syncs the
   * cached views, so a rating submitted on one screen shows up on the artist's
   * dashboard without a reload.
   */
  useEffect(() => {
    const resync = () => {
      void queryClient.invalidateQueries({ queryKey: ['tracks'] });
      void queryClient.invalidateQueries({ queryKey: ['artist'] });
    };
    window.addEventListener('musicrate:vault', resync);
    return () => window.removeEventListener('musicrate:vault', resync);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {status === 'booting' || !minSplashDone ? <Splash /> : <RouterProvider router={router} />}
      <Toaster />
    </QueryClientProvider>
  );
}
