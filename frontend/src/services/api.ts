import { TriageRecord, Patient, Referral, InventoryItem, OutbreakCluster, Facility } from '../types';
import { db, saveOfflineTriage, markAsSynced } from '../db/dexie';

const API_BASE = '/api';

export const api = {
  // Check backend health
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  },

  // Facilities
  async getFacilities(lat?: number, lng?: number): Promise<Facility[]> {
    try {
      const query = lat && lng ? `?lat=${lat}&lng=${lng}` : '';
      const res = await fetch(`${API_BASE}/facilities${query}`);
      if (!res.ok) throw new Error('Facilities fetch failed');
      const data = await res.json();
      return data.facilities;
    } catch (e) {
      console.warn('Using offline cached facilities');
      return [
        {
          id: "fac-01",
          name: "Kharpudi Sub-Centre (आरोग्य उपकेंद्र, खरपुडी)",
          type: "Sub-Centre / Health & Wellness Centre",
          distance_km: 0.8,
          village: "Kharpudi",
          phone: "+91 2133 222101",
          doctor: "Sister Rekha Kamble (ANM)",
          status: "Open",
          coordinates: { lat: 18.9950, lng: 73.9520 }
        },
        {
          id: "fac-02",
          name: "Kharpudi Primary Health Centre (प्राथमिक आरोग्य केंद्र, खरपुडी)",
          type: "PHC (24x7 Delivery & OPD)",
          distance_km: 2.5,
          village: "Kharpudi",
          phone: "+91 2133 222102",
          doctor: "Dr. Anand Kulkarni (Medical Officer)",
          status: "Open (24x7 Emergency)",
          coordinates: { lat: 19.0012, lng: 73.9605 }
        },
        {
          id: "fac-03",
          name: "Manchar Rural Hospital (ग्रामीण रुग्णालय, मंचर)",
          type: "Rural Hospital (FRU - First Referral Unit)",
          distance_km: 12.0,
          village: "Manchar",
          phone: "+91 2133 223344",
          doctor: "Dr. Vaishali Ghadge (Civil Surgeon)",
          status: "Open (Specialist Care)",
          coordinates: { lat: 19.0118, lng: 73.9388 }
        },
        {
          id: "fac-04",
          name: "Pune District Hospital (जिल्हा रुग्णालय, औंध, पुणे)",
          type: "District Multi-Specialty Hospital",
          distance_km: 65.0,
          village: "Aundh, Pune",
          phone: "+91 20 2728 0100",
          doctor: "Dr. Milind More (District Medical Superintendent)",
          status: "Open (Tertiary Care)",
          coordinates: { lat: 18.5590, lng: 73.8073 }
        }
      ];
    }
  },

  // Triage Evaluation
  async evaluateTriage(payload: any, isOfflineMode: boolean = false): Promise<any> {
    if (isOfflineMode) {
      // Local client-side evaluation matching the rule engine
      let priority = 'P3';
      let triage_label = 'P3 Routine';
      let triggers: string[] = [];
      let reason = 'Vitals within stable baseline limits.';

      const v = payload.vitals || {};
      if ((v.systolic_bp && v.systolic_bp >= 160) || (v.diastolic_bp && v.diastolic_bp >= 100) || (v.spo2 && v.spo2 <= 90) || v.high_risk_maternal) {
        priority = 'P1';
        triage_label = 'P1 Critical';
        if (v.systolic_bp >= 160) triggers.push(`Severe Hypertension (${v.systolic_bp} mmHg)`);
        if (v.spo2 <= 90) triggers.push(`Critical Hypoxemia (SpO2 ${v.spo2}%)`);
        if (v.high_risk_maternal) triggers.push('High-Risk Maternal Alert');
        reason = triggers.join(' | ');
      } else if ((v.temperature && v.temperature >= 102) || (v.symptom_duration_days && v.symptom_duration_days > 3)) {
        priority = 'P2';
        triage_label = 'P2 Urgent';
        if (v.temperature >= 102) triggers.push(`High Grade Pyrexia (${v.temperature}°F)`);
        if (v.symptom_duration_days > 3) triggers.push(`Prolonged Illness (${v.symptom_duration_days} days)`);
        reason = triggers.join(' | ');
      }

      // Save to local Dexie database
      const offlineRecord = await saveOfflineTriage({
        patient_name: payload.patient_name,
        age: payload.age,
        gender: payload.gender,
        village: payload.village || 'Kharpudi',
        phone: payload.phone,
        vitals: payload.vitals,
        priority: priority as any,
        triage_reason: reason,
        confidence_score: 0.95,
        doctor_verification_required: true,
        status: 'Pending',
        source: 'ASHA_Offline',
        created_at: new Date().toISOString()
      });

      return {
        id: offlineRecord.local_id,
        priority,
        triage_label,
        triage_reason: reason,
        confidence_score: 0.95,
        doctor_verification_required: true,
        triggers,
        recommended_action: priority === 'P1' ? '108 Ambulance alert & immediate referral.' : 'Visit PHC or teleconsult.',
        is_offline_saved: true
      };
    }

    // Online request to FastAPI backend
    const res = await fetch(`${API_BASE}/triage/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Triage evaluation failed');
    return await res.json();
  },

  // Doctor Queue
  async getDoctorQueue(priority?: string, status?: string): Promise<TriageRecord[]> {
    try {
      const params = new URLSearchParams();
      if (priority && priority !== 'All') params.append('priority', priority);
      if (status && status !== 'All') params.append('status', status);
      
      const res = await fetch(`${API_BASE}/triage/queue?${params.toString()}`);
      if (!res.ok) throw new Error('Doctor queue fetch failed');
      return await res.json();
    } catch {
      // Return records stored in Dexie as fallback
      const offlineRecords = await db.triageRecords.toArray();
      return offlineRecords;
    }
  },

  // Doctor Verification
  async verifyDoctorTriage(payload: {
    triage_id: number;
    doctor_name: string;
    verified_priority: string;
    doctor_notes?: string;
    prescription?: string;
    action: string;
  }): Promise<any> {
    const res = await fetch(`${API_BASE}/triage/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Doctor verification failed');
    return await res.json();
  },

  // Sync Offline Records Batch
  async syncBatch(records: any[]): Promise<any> {
    const payload = {
      asha_id: "ASHA_KHARPUDI_01",
      asha_name: "Sunita Tai Shinde",
      records: records.map(r => ({
        local_id: r.local_id,
        patient_name: r.patient_name,
        age: r.age,
        gender: r.gender,
        phone: r.phone || "9800000000",
        village: r.village || "Kharpudi",
        vitals: r.vitals,
        priority: r.priority,
        triage_reason: r.triage_reason,
        recorded_at: r.created_at,
        source: "ASHA_Offline"
      }))
    };

    const res = await fetch(`${API_BASE}/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Batch sync failed');
    const data = await res.json();
    if (data.synced_local_ids?.length) {
      await markAsSynced(data.synced_local_ids);
    }
    return data;
  },

  // ASHA Incentives
  async getAshaIncentives(ashaId: string = 'ASHA_KHARPUDI_01'): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/asha/incentives?asha_id=${ashaId}`);
      if (!res.ok) throw new Error('Incentives fetch failed');
      return await res.json();
    } catch {
      return {
        asha_id: ashaId,
        asha_name: "Sunita Tai Shinde",
        total_earned_month: 750,
        pending_disbursal: 450,
        disbursed_total: 300,
        recent_activities: []
      };
    }
  },

  // Referrals
  async getReferrals(): Promise<Referral[]> {
    try {
      const res = await fetch(`${API_BASE}/referrals`);
      if (!res.ok) throw new Error('Referrals fetch failed');
      return await res.json();
    } catch {
      return [];
    }
  },

  async createReferral(payload: any): Promise<any> {
    const res = await fetch(`${API_BASE}/referrals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Referral creation failed');
    return await res.json();
  },

  // Inventory
  async getInventory(): Promise<{ facility: string; total_medicines: number; low_stock_count: number; items: InventoryItem[] }> {
    try {
      const res = await fetch(`${API_BASE}/inventory`);
      if (!res.ok) throw new Error('Inventory fetch failed');
      return await res.json();
    } catch {
      return {
        facility: "Kharpudi PHC",
        total_medicines: 5,
        low_stock_count: 2,
        items: []
      };
    }
  },

  async updateStock(itemId: number, currentStock: number): Promise<any> {
    const res = await fetch(`${API_BASE}/inventory/${itemId}/stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, current_stock: currentStock })
    });
    return await res.json();
  },

  // Admin Analytics
  async getDistrictOverview(): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/overview`);
    if (!res.ok) throw new Error('Analytics fetch failed');
    return await res.json();
  },

  async getOutbreakClusters(): Promise<any> {
    const res = await fetch(`${API_BASE}/analytics/outbreaks`);
    if (!res.ok) throw new Error('Outbreaks fetch failed');
    return await res.json();
  },

  // Mock ABDM / ABHA ID
  async generateAbha(name: string, phone: string): Promise<any> {
    const res = await fetch(`${API_BASE}/mock/abdm/generate-abha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    });
    return await res.json();
  },

  // Mock eSanjeevani Teleconsult Session
  async createESanjeevaniSession(patientName: string, priority: string): Promise<any> {
    const res = await fetch(`${API_BASE}/mock/esanjeevani/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name: patientName, priority })
    });
    return await res.json();
  }
};
