import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { EntryLayout } from './EntryLayout';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <EntryLayout overline="404" title="LOST IN THE MIX" subtitle="Такой страницы нет.">
      <Button variant="chrome" size="lg" onClick={() => navigate('/')}>
        На главную
      </Button>
    </EntryLayout>
  );
}
