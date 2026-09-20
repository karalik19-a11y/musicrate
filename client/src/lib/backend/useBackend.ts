import { useSyncExternalStore } from 'react';
import { getBackendInfo, subscribeToBackend, type BackendInfo } from '@/lib/backend';

/** Reactive view of which data source the app booted with. */
export function useBackend(): BackendInfo {
  return useSyncExternalStore(subscribeToBackend, getBackendInfo, getBackendInfo);
}
