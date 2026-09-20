import type { Track } from '@shared/types';

/**
 * Anything that can announce a freshly published track. The Telegram bot is
 * the production implementation; tests inject a fake to assert the wiring.
 */
export interface NewTrackNotifier {
  notifyNewTrack(track: Track): Promise<void>;
}
