import { ArrowRight, Sparkles, UserRound } from 'lucide-react';
import { motion } from 'motion/react';
import { Navigate, useNavigate } from 'react-router';
import { tap } from '@/lib/haptics';
import { homeFor, useAuth } from '@/stores/auth';
import { EntryLayout } from './EntryLayout';

function Choice({
  title,
  subtitle,
  icon,
  accent,
  onClick,
  delay,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accent?: boolean;
  onClick: () => void;
  delay: number;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 28 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-[28px] p-5 text-left ${
        accent ? 'bg-acid text-ink shadow-glow-acid' : 'glass text-chrome'
      }`}
    >
      <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${accent ? 'bg-black/12' : 'bg-white/8'}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[17px] font-extrabold uppercase tracking-tight">{title}</span>
        <span className={`mt-0.5 block text-[14px] ${accent ? 'text-ink/70' : 'text-fog'}`}>{subtitle}</span>
      </span>
      <ArrowRight className="size-5 shrink-0 opacity-70" />
    </motion.button>
  );
}

export function GuestEntry() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <EntryLayout overline="Listeners" title="GUEST" subtitle="Без почты, телефона и паролей. Несколько секунд — и ты внутри.">
      <div className="space-y-3">
        <Choice
          title="Новый гость"
          subtitle="Назови имя и заходи"
          icon={<Sparkles className="size-6" />}
          accent
          delay={0.05}
          onClick={() => {
            tap();
            navigate('/guest/new');
          }}
        />
        <Choice
          title="Я уже здесь"
          subtitle="Восстановить профиль по коду"
          icon={<UserRound className="size-6" />}
          delay={0.12}
          onClick={() => {
            tap();
            navigate('/guest/restore');
          }}
        />
      </div>
      <p className="mt-6 text-center text-[13px] leading-relaxed text-fog">
        На этом устройстве профиль запоминается автоматически — в следующий раз приложение откроется сразу.
      </p>
    </EntryLayout>
  );
}
