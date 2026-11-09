'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/nextjs';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface UseAuthSyncResult {
  syncStatus: SyncStatus;
  syncError: string | null;
  retrySync: () => void;
}

/**
 * Calls /api/auth/sync exactly once per authenticated browser session.
 *
 * Rules:
 * - Only fires when Clerk session is loaded and a userId is present.
 * - Skips if already synced in this session (uses sessionStorage flag).
 * - Provides retrySync() so the UI can offer a retry action on failure.
 * - Does NOT re-run on every render or component mount — it uses a ref guard
 *   plus a sessionStorage flag so navigation between tabs won't re-trigger it.
 * - Does NOT interfere with Google OAuth or any other API calls.
 */
export function useAuthSync(): UseAuthSyncResult {
  const { isLoaded, isSignedIn } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  // Ref guard prevents double-invoke in React Strict Mode or concurrent renders
  const hasFired = useRef(false);

  const runSync = async () => {
    // Skip if already successfully synced this session
    if (typeof window !== 'undefined' && sessionStorage.getItem('auth_synced') === '1') {
      setSyncStatus('synced');
      return;
    }

    setSyncStatus('syncing');
    setSyncError(null);

    try {
      const res = await fetch('/api/auth/sync', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        setSyncStatus('synced');
        // Mark as synced so navigation doesn't re-trigger
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('auth_synced', '1');
        }
      } else {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error || `Sync failed (HTTP ${res.status})`;
        setSyncError(msg);
        setSyncStatus('error');
        console.error('[useAuthSync] Sync error:', msg);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error during sync';
      setSyncError(msg);
      setSyncStatus('error');
      console.error('[useAuthSync] Sync fetch error:', err);
    }
  };

  useEffect(() => {
    // Wait for Clerk to finish loading and confirm the user is signed in
    if (!isLoaded || !isSignedIn) return;
    // Ref guard: only fire once per component lifecycle
    if (hasFired.current) return;
    hasFired.current = true;

    runSync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn]);

  const retrySync = () => {
    if (syncStatus === 'syncing') return;
    hasFired.current = false;
    // Clear the session flag so a forced retry actually re-runs
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('auth_synced');
    }
    hasFired.current = true;
    runSync();
  };

  return { syncStatus, syncError, retrySync };
}

