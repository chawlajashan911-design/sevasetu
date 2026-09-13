// @ts-nocheck
import { useState, useEffect, useCallback } from 'react';
import { db, getPendingSyncCount, markAsSynced } from '../db/dexie';
import { api } from '../services/api';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [wasOffline, setWasOffline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Update pending sync count
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await getPendingSyncCount();
      setPendingCount(count);
    } catch (e) {
      console.warn('Error reading pending sync count:', e);
    }
  }, []);

  // Flush pending Dexie records to SQLite via api.syncBatch
  const syncPendingRecords = useCallback(async () => {
    try {
      const pendingItems = await db.offlineQueue.where('status').equals('PENDING').toArray();
      if (!pendingItems || pendingItems.length === 0) {
        refreshPendingCount();
        return;
      }

      setIsSyncing(true);
      const recordsToSync = pendingItems.map(item => item.payload || item);
      const result = await api.syncBatch(recordsToSync);

      if (result && result.synced_local_ids?.length) {
        await markAsSynced(result.synced_local_ids);
        setSyncSuccessMsg(`Online — Batch Synced Successfully (${result.synced_count || result.synced_local_ids.length} records saved to Server)`);
        setTimeout(() => setSyncSuccessMsg(null), 6000);
      }
    } catch (e) {
      console.warn('Auto-sync error on network restoration:', e);
    } finally {
      setIsSyncing(false);
      refreshPendingCount();
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = async () => {
      setIsOnline(true);
      // If we reconnected, automatically trigger batch sync
      await syncPendingRecords();
      setWasOffline(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(refreshPendingCount, 4000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshPendingCount, syncPendingRecords]);

  return {
    isOnline,
    wasOffline,
    isSyncing,
    syncSuccessMsg,
    pendingCount,
    refreshPendingCount,
    triggerManualSync: syncPendingRecords
  };
}
