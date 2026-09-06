export type Language = 'mr' | 'hi' | 'en';
export type PortalType = 'patient' | 'asha' | 'doctor' | 'admin';
export type PriorityLevel = 'P1' | 'P2' | 'P3';

export interface Vitals {
  systolic_bp?: number;
  diastolic_bp?: number;
  spo2?: number;
  pulse_rate?: number;
  temperature?: number;
  symptom_duration_days?: number;
  symptoms?: string;
  high_risk_maternal?: boolean;
  maternal_note?: string;
}

export interface Patient {
  id?: number;
  abha_id?: string;
  name: string;
  age: number;
  gender: string;
  phone: string;
  village?: string;
  wadi?: string;
  preferred_language?: Language;
  created_at?: string;
}

export interface TriageRecord {
  id?: number;
  local_id?: string;
  patient_id?: number;
  patient_name: string;
  age: number;
  gender: string;
  village: string;
  phone?: string;
  vitals: Vitals;
  priority: PriorityLevel;
  triage_reason: string;
  confidence_score: number;
  doctor_verification_required: boolean;
  doctor_verified?: boolean;
  doctor_name?: string;
  doctor_notes?: string;
  prescription?: string;
  status: 'Pending' | 'Verified' | 'Referred' | 'Completed';
  source: 'Patient' | 'ASHA_Offline' | 'ASHA_Online';
  created_at: string;
  is_synced?: boolean;
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  distance_km: number;
  village: string;
  phone: string;
  doctor: string;
  status: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface Referral {
  id?: number;
  triage_id?: number;
  patient_name: string;
  age: number;
  priority: PriorityLevel;
  source_facility: string;
  target_facility: string;
  urgency: string;
  reason: string;
  transport_mode: string;
  status: 'Referred' | 'En Route' | 'Admitted' | 'Completed';
  created_at?: string;
}

export interface InventoryItem {
  id: number;
  medicine_name: string;
  category: string;
  current_stock: number;
  min_threshold: number;
  unit: string;
  is_low_stock: boolean;
  last_updated?: string;
}

export interface OutbreakCluster {
  id: number;
  village: string;
  wadi: string;
  disease: string;
  cases: number;
  risk_level: 'Low' | 'Medium' | 'High';
  reported_date?: string;
}

export interface AshaIncentiveActivity {
  id: number;
  activity_type: string;
  patient_name: string;
  amount: number;
  status: 'Pending' | 'Approved' | 'Disbursed';
  recorded_at?: string;
}
