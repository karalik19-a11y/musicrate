import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { createHashRouter, Navigate, Outlet, RouterProvider, useLocation, useNavigate } from 'react-router';
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
import { usePlayer } from '@/stores/player';
import { detectTelegram } from '@/lib/telegram';

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
  {
    // Pathless layout around every route: hosts the Telegram bridge below.
    element: (
      <>
        <TelegramBridge />
        <Outlet />
      </>
    ),
    children: [
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
    ],
  },
]);

/**
 * Telegram mini-app chrome, wired to the router: the native ← BackButton
 * mirrors in-app navigation (hidden on tab roots and when there is nothing to
 * go back to), and closing the app mid-track asks for confirmation first.
 * Renders null outside Telegram.
 */
function TelegramBridge() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasTrack = usePlayer((s) => s.index >= 0);

  // Tab roots: screens where "back" would mean leaving the app entirely.
  const isRoot = ['/', '/home', '/discover', '/profile', '/studio'].includes(location.pathname);

  useEffect(() => {
    const app = detectTelegram();
    const backButton = app?.BackButton;
    if (!app || !backButton) return;

    // react-router keeps its history index in window.history.state.idx; a deep
    // link (notification → straight to a track) starts at 0, so the button
    // stays hidden there instead of looking broken.
    const canGoBack = Number(window.history.state?.idx ?? 0) > 0;
    const onBack = () => navigate(-1);

    if (!isRoot && canGoBack) {
      backButton.onClick(onBack);
      backButton.show();
    } else {
      backButton.hide();
    }
    return () => {
      backButton.offClick(onBack);
      backButton.hide();
    };
  }, [isRoot, location, navigate]);

  useEffect(() => {
    const app = detectTelegram();
    if (!app) return;
    try {
      // A track in the player is worth one "really close?" tap.
      if (hasTrack) app.enableClosingConfirmation();
      else app.disableClosingConfirmation();
    } catch {
      /* older Telegram clients */
    }
  }, [hasTrack]);

  return null;
}

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
