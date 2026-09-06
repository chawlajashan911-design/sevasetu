import Dexie, { Table } from 'dexie';
import { TriageRecord, Patient, Referral, InventoryItem } from '../types';

export interface OfflineSyncItem {
  id?: number;
  local_id: string;
  type: 'TRIAGE_SUBMISSION' | 'PATIENT_REGISTRATION' | 'REFERRAL';
  payload: any;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  created_at: string;
}

export class RuralHealthcareDB extends Dexie {
  patients!: Table<Patient, number>;
  triageRecords!: Table<TriageRecord, string>;
  referrals!: Table<Referral, number>;
  inventory!: Table<InventoryItem, number>;
  offlineQueue!: Table<OfflineSyncItem, number>;

  constructor() {
    super('RuralHealthcareDB_Kharpudi');
    this.version(1).stores({
      patients: '++id, phone, abha_id, name',
      triageRecords: 'local_id, priority, status, created_at, is_synced',
      referrals: '++id, triage_id, priority, status',
      inventory: 'id, medicine_name, is_low_stock',
      offlineQueue: '++id, local_id, type, status, created_at'
    });
  }
}

export const db = new RuralHealthcareDB();

// Helper to save offline triage screening
export async function saveOfflineTriage(record: Omit<TriageRecord, 'local_id'>) {
  const local_id = 'OFFLINE_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  const triageWithId: TriageRecord = {
    ...record,
    local_id,
    is_synced: false
  };

  await db.triageRecords.add(triageWithId);
  await db.offlineQueue.add({
    local_id,
    type: 'TRIAGE_SUBMISSION',
    payload: triageWithId,
    status: 'PENDING',
    created_at: new Date().toISOString()
  });

  return triageWithId;
}

// Get pending offline sync items
export async function getPendingSyncCount(): Promise<number> {
  return await db.offlineQueue.where('status').equals('PENDING').count();
}

// Clear or mark synced
export async function markAsSynced(localIds: string[]) {
  await db.transaction('rw', db.offlineQueue, db.triageRecords, async () => {
    for (const lid of localIds) {
      await db.offlineQueue.where('local_id').equals(lid).modify({ status: 'SYNCED' });
      await db.triageRecords.where('local_id').equals(lid).modify({ is_synced: true });
    }
  });
}
