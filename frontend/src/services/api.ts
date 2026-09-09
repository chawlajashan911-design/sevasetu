import { TriageRecord, Patient, Referral, Appointment, InventoryItem, OutbreakCluster, Facility, VillageRecord } from '../types';
import { db, saveOfflineTriage, markAsSynced } from '../db/dexie';

// In production (single-instance or Render), defaults to relative '/api'.
// In local dev, falls back to '/api' which is proxied to localhost:8000 via vite.config.ts.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || '/api';

let cachedLocalVillages: VillageRecord[] | null = null;

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

  // Facilities & Hospital Directory
  async getFacilities(options?: {
    district?: string;
    taluka?: string;
    village?: string;
    query?: string;
    category?: string;
    lat?: number;
    lng?: number;
    limit?: number;
  } | number, lngParam?: number): Promise<Facility[]> {
    try {
      const params = new URLSearchParams();
      if (typeof options === 'number') {
        params.append('lat', options.toString());
        if (lngParam) params.append('lng', lngParam.toString());
      } else if (options && typeof options === 'object') {
        if (options.district) params.append('district', options.district);
        if (options.taluka) params.append('taluka', options.taluka);
        if (options.village) params.append('village', options.village);
        if (options.query) params.append('query', options.query);
        if (options.category) params.append('category', options.category);
        if (options.lat) params.append('lat', options.lat.toString());
        if (options.lng) params.append('lng', options.lng.toString());
        if (options.limit) params.append('limit', options.limit.toString());
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${API_BASE}/facilities${queryString}`);
      if (!res.ok) throw new Error('Facilities fetch failed');
      const data = await res.json();
      return data.facilities || [];
    } catch (e) {
      console.warn('Facilities fetch error:', e);
      return [];
    }
  },

  // Search hospitals by name for login / selector
  async searchHospitals(query: string, district?: string, limit: number = 30): Promise<Facility[]> {
    try {
      const params = new URLSearchParams({ q: query, limit: limit.toString() });
      if (district) params.append('district', district);
      const res = await fetch(`${API_BASE}/hospitals/search?${params.toString()}`);
      if (!res.ok) throw new Error('Hospital search failed');
      return await res.json();
    } catch (e) {
      console.warn('Hospital search error:', e);
      return [];
    }
  },

  async getHospitalById(id: string): Promise<Facility | null> {
    try {
      const res = await fetch(`${API_BASE}/hospitals/${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  // Triage Evaluation
  async evaluateTriage(payload: any, isOfflineMode: boolean = false): Promise<any> {
    if (isOfflineMode) {
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
        village: payload.village || '',
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
  async syncBatch(records: any[], ashaId: string = 'ASHA_01', ashaName: string = 'ASHA Worker'): Promise<any> {
    const payload = {
      asha_id: ashaId,
      asha_name: ashaName,
      records: records.map(r => ({
        local_id: r.local_id,
        patient_name: r.patient_name,
        age: r.age,
        gender: r.gender,
        phone: r.phone || "9800000000",
        village: r.village || "",
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
  async getAshaIncentives(ashaId: string = 'ASHA_01'): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/asha/incentives?asha_id=${ashaId}`);
      if (!res.ok) throw new Error('Incentives fetch failed');
      return await res.json();
    } catch {
      return {
        asha_id: ashaId,
        asha_name: "ASHA Worker",
        total_earned_month: 0,
        pending_disbursal: 0,
        disbursed_total: 0,
        recent_activities: []
      };
    }
  },

  // Referrals
  async getReferrals(status?: string): Promise<Referral[]> {
    try {
      const query = status && status !== 'All' ? `?status=${status}` : '';
      const res = await fetch(`${API_BASE}/referrals${query}`);
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

  async updateReferralStatus(referralId: number, status: string): Promise<any> {
    const res = await fetch(`${API_BASE}/referrals/${referralId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Referral status update failed');
    return await res.json();
  },

  // Appointments
  async getAppointments(facility?: string, doctor?: string, status?: string): Promise<Appointment[]> {
    try {
      const params = new URLSearchParams();
      if (facility && facility !== 'All') params.append('facility', facility);
      if (doctor && doctor !== 'All') params.append('doctor', doctor);
      if (status && status !== 'All') params.append('status', status);

      const res = await fetch(`${API_BASE}/appointments?${params.toString()}`);
      if (!res.ok) throw new Error('Appointments fetch failed');
      return await res.json();
    } catch {
      return [];
    }
  },

  async createAppointment(payload: Appointment): Promise<Appointment> {
    const res = await fetch(`${API_BASE}/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Appointment creation failed');
    return await res.json();
  },

  async updateAppointmentStatus(appointmentId: number, status: string): Promise<any> {
    const res = await fetch(`${API_BASE}/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Appointment status update failed');
    return await res.json();
  },

  // Patients
  async getPatients(limit: number = 50): Promise<Patient[]> {
    try {
      const res = await fetch(`${API_BASE}/patients?limit=${limit}`);
      if (!res.ok) throw new Error('Patients fetch failed');
      return await res.json();
    } catch {
      return [];
    }
  },

  async createPatient(patient: Patient): Promise<Patient> {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patient)
    });
    if (!res.ok) throw new Error('Patient registration failed');
    return await res.json();
  },

  // Inventory
  async getInventory(facility?: string): Promise<{ facility: string; total_medicines: number; low_stock_count: number; items: InventoryItem[] }> {
    try {
      const param = facility ? `?facility=${encodeURIComponent(facility)}` : '';
      const res = await fetch(`${API_BASE}/inventory${param}`);
      if (!res.ok) throw new Error('Inventory fetch failed');
      return await res.json();
    } catch {
      return {
        facility: facility || "Facility Inventory",
        total_medicines: 0,
        low_stock_count: 0,
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
  async createESanjeevaniSession(patientName: string, priority: string, facilityName?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/mock/esanjeevani/create-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_name: patientName, priority, facility_name: facilityName })
    });
    return await res.json();
  },

  // Maharashtra Village Search (44,810 authentic villages)
  async searchVillages(query: string, district?: string, taluka?: string, limit: number = 25): Promise<VillageRecord[]> {
    const q = query.trim();
    if (!q) return [];
    try {
      const params = new URLSearchParams({ q, limit: limit.toString() });
      if (district) params.append('district', district);
      if (taluka) params.append('taluka', taluka);

      const res = await fetch(`${API_BASE}/villages/search?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
      throw new Error('API search failed');
    } catch (err) {
      console.warn('Falling back to local maharashtra_villages_website.json dataset search');
      try {
        if (!cachedLocalVillages) {
          const fileRes = await fetch('/maharashtra_villages_website.json');
          if (fileRes.ok) {
            cachedLocalVillages = await fileRes.json();
          }
        }
        if (cachedLocalVillages) {
          const qLower = q.toLowerCase();
          const matches: VillageRecord[] = [];
          for (const v of cachedLocalVillages) {
            if (district && v.district.toLowerCase() !== district.toLowerCase()) continue;
            if (taluka && v.taluka.toLowerCase() !== taluka.toLowerCase()) continue;
            if (
              v.name.toLowerCase().includes(qLower) ||
              v.taluka.toLowerCase().includes(qLower) ||
              v.district.toLowerCase().includes(qLower)
            ) {
              matches.push(v);
              if (matches.length >= limit) break;
            }
          }
          return matches;
        }
      } catch (fileErr) {
        console.error('Local village dataset search error:', fileErr);
      }
      return [];
    }
  },

  async getDistricts(): Promise<string[]> {
    try {
      const res = await fetch(`${API_BASE}/districts`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to fetch districts');
    }
    return [];
  },

  async getTalukas(district?: string): Promise<string[]> {
    try {
      const param = district ? `?district=${encodeURIComponent(district)}` : '';
      const res = await fetch(`${API_BASE}/talukas${param}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to fetch talukas');
    }
    return [];
  }
};
