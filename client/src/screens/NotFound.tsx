import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EntryLayout } from './EntryLayout';
import { normalizeTelegramHash, telegramStartParam, trackIdFromStartParam } from '@/lib/telegram';

export function NotFound() {
  const navigate = useNavigate();

  useEffect(() => {
    // Last-resort guard: if we landed here because Telegram's hash
    // overwrote the route (#tgWebAppData=...), recover immediately.
    try {
      const hash = window.location.hash;
      const isTelegramHash =
        hash.includes('tgWebAppData') ||
        hash.includes('tgWebAppVersion') ||
        hash.includes('tgWebAppPlatform');
      if (isTelegramHash) {
        const raw = telegramStartParam();
        const trackId = raw ? trackIdFromStartParam(raw) : null;
        if (trackId) {
          navigate(`/track/${trackId}`, { replace: true });
          return;
        }
        // Try to normalize and go home
        normalizeTelegramHash();
        navigate('/', { replace: true });
      }
    } catch {
      /* ignore */
    }
  }, [navigate]);

  return (
    <EntryLayout overline="404" title="LOST IN THE MIX" subtitle="Такой страницы нет.">
      <Button variant="chrome" size="lg" onClick={() => navigate('/')}>
        На главную
      </Button>
    </EntryLayout>
  );
}
