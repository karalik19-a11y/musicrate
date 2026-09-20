import { Mic2, Headphones } from 'lucide-react';
import { motion } from 'motion/react';
import { Navigate, useNavigate } from 'react-router';
import { Aurora } from '@/components/Aurora';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { useBackend } from '@/lib/backend/useBackend';
import { tap } from '@/lib/haptics';
import { homeFor, useAuth } from '@/stores/auth';

const BARS = Array.from({ length: 34 }, (_, i) => ({
  height: 18 + ((i * 53) % 70),
  delay: (i * 97) % 900,
  duration: 1100 + ((i * 31) % 700),
}));

export function Welcome() {
  const user = useAuth((s) => s.user);
  const info = useBackend();
  const navigate = useNavigate();

  // Returning users never see this screen: straight into the app.
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-ink">
      <Aurora />

      {/* rotating vinyl rings */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2">
        <div className="size-[92vmin] max-h-[560px] max-w-[560px] rounded-full border border-white/5 animate-spin-slow [animation-duration:40s]">
          <div className="absolute inset-[12%] rounded-full border border-white/6" />
          <div className="absolute inset-[26%] rounded-full border border-white/8" />
          <div className="absolute inset-[40%] rounded-full border border-acid/25" />
          <div className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-acid shadow-glow-acid" />
        </div>
      </div>

      {/* animated waveform */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[54%] flex h-20 items-center justify-center gap-[5px] px-8 opacity-70">
        {BARS.map((b, i) => (
          <span
            key={i}
            className="w-[3px] origin-center rounded-full bg-gradient-to-t from-white/10 via-white/50 to-white/10 animate-bars"
            style={{ height: `${b.height}%`, animationDelay: `${b.delay}ms`, animationDuration: `${b.duration}ms` }}
          />
        ))}
      </div>

      <main
        className="relative mx-auto flex w-full max-w-lg flex-1 flex-col safe-x"
        style={{ paddingTop: 'calc(var(--sat) + 24px)', paddingBottom: 'max(var(--sab), 20px)' }}
      >
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="font-display text-[10px] font-semibold uppercase tracking-[0.34em] text-fog"
        >
          Closed platform · est. 2026
        </motion.p>

        {/* Where the music actually lives — honest label for a static link. */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
          className="mt-3 inline-flex w-fit items-center gap-2 rounded-full glass px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-fog"
        >
          <span
            className={`size-1.5 rounded-full ${
              info.kind === 'http' && !info.unreachable ? 'bg-acid shadow-glow-acid' : info.unreachable ? 'bg-danger' : 'bg-silver'
            }`}
          />
          {info.kind === 'http' ? (info.unreachable ? 'Сервер офлайн' : 'Общий каталог') : 'Каталог на этом устройстве'}
        </motion.p>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 24, filter: 'blur(10px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <Logo className="text-[clamp(40px,12vw,64px)]" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, letterSpacing: '0.6em' }}
            animate={{ opacity: 1, letterSpacing: '0.34em' }}
            transition={{ delay: 0.35, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="mt-5 font-display text-[11px] font-semibold uppercase text-silver"
          >
            Your sound. Your space.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, type: 'spring', stiffness: 260, damping: 28 }}
          className="space-y-3 pb-2"
        >
          <Button
            variant="chrome"
            size="xl"
            block
            icon={<Mic2 className="size-5" />}
            onClick={() => {
              tap();
              navigate('/artist/access');
            }}
          >
            Я артист
          </Button>
          <Button
            variant="acid"
            size="xl"
            block
            icon={<Headphones className="size-5" />}
            onClick={() => {
              tap();
              navigate('/guest');
            }}
          >
            Я гость
          </Button>
          <p className="pt-3 text-center text-[12px] text-fog">Артисты публикуют. Гости слушают и оценивают.</p>
        </motion.div>
      </main>
    </div>
  );
}
