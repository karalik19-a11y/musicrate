import { clsx } from 'clsx';
import { Compass, Disc3, House, LayoutGrid, ListMusic, Plus, User } from 'lucide-react';
import { motion } from 'motion/react';
import { NavLink } from 'react-router';
import type { Role } from '@shared/types';
import { tap } from '@/lib/haptics';
import { usePlayer } from '@/stores/player';

interface TabItem {
  to?: string;
  label: string;
  icon: typeof House;
  player?: boolean;
  end?: boolean;
}

const GUEST_TABS: TabItem[] = [
  { to: '/home', label: 'Home', icon: House },
  { to: '/discover', label: 'Discover', icon: Compass },
  { label: 'Player', icon: Disc3, player: true },
  { to: '/profile', label: 'Profile', icon: User },
];

const ARTIST_TABS: TabItem[] = [
  { to: '/studio', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/studio/tracks', label: 'Tracks', icon: ListMusic },
  { to: '/studio/upload', label: 'Upload', icon: Plus },
  { to: '/studio/profile', label: 'Profile', icon: User },
];

function TabContent({ item, active }: { item: TabItem; active: boolean }) {
  const playing = usePlayer((s) => s.status === 'playing');
  const Icon = item.icon;
  return (
    <>
      <span className="relative grid h-7 place-items-center">
        {active && (
          <motion.span
            layoutId="tab-glow"
            className="absolute -inset-x-3 -inset-y-1 rounded-full bg-acid/12"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          />
        )}
        <Icon
          className={clsx('relative size-[22px] transition-colors', item.player && playing && 'animate-spin-slow')}
          strokeWidth={active ? 2.4 : 2}
        />
      </span>
      <span className="font-display text-[9px] font-semibold uppercase tracking-[0.16em]">{item.label}</span>
    </>
  );
}

export function TabBar({ role }: { role: Role }) {
  const openSheet = usePlayer((s) => s.openSheet);
  const sheetOpen = usePlayer((s) => s.sheetOpen);
  const tabs = role === 'artist' ? ARTIST_TABS : GUEST_TABS;

  return (
    <nav
      aria-label="Навигация"
      className="pointer-events-auto glass-strong border-x-0 border-b-0"
      style={{ paddingBottom: 'max(var(--sab), 10px)' }}
    >
      <ul className="mx-auto flex h-[var(--tabbar-h)] max-w-lg items-stretch justify-around px-2">
        {tabs.map((item) => {
          const cls = (active: boolean) =>
            clsx(
              'flex min-w-[64px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl transition-colors',
              active ? 'text-acid' : 'text-fog active:text-silver',
            );
          return (
            <li key={item.label} className="flex flex-1">
              {item.player ? (
                <button
                  type="button"
                  className={cls(sheetOpen)}
                  onClick={() => {
                    tap();
                    openSheet();
                  }}
                >
                  <TabContent item={item} active={sheetOpen} />
                </button>
              ) : (
                <NavLink to={item.to!} end={item.end} className={({ isActive }) => cls(isActive)} onClick={() => tap()}>
                  {({ isActive }) => <TabContent item={item} active={isActive} />}
                </NavLink>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
