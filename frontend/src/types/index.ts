/**
 * SevaSetu Core Constants & Enums (converted to JavaScript)
 */

export const LANGUAGES = ['mr', 'hi', 'en'];

export const USER_ROLES = {
  PATIENT: 'patient',
  DOCTOR: 'doctor',
  CLINIC: 'clinic',
  HOSPITAL: 'hospital',
  HEALTH_WORKER: 'health_worker',
  ADMIN: 'admin'
};

export const PRIORITY_LEVELS = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3'
};

export const REFERRAL_STATUSES = [
  'Pending',
  'Accepted',
  'Patient Arrived',
  'Completed',
  'Follow-up'
];

export interface DoctorSlot {
  day: string;
  start_time: string;
  end_time: string;
  label?: string;
}

export interface HospitalDoctor {
  id: number;
  hospital_id: string;
  hospital_name?: string;
  name: string;
  speciality: string;
  qualification?: string;
  experience_years?: number;
  phone?: string;
  availability_slots: DoctorSlot[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HospitalTest {
  id: number;
  hospital_id: string;
  hospital_name?: string;
  test_name: string;
  category: string;
  price: number;
  prep_notes?: string;
  turnaround_time?: string;
  is_available: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface HospitalPharmacyItem {
  id: number;
  hospital_id: string;
  hospital_name?: string;
  medicine_name: string;
  generic_name: string;
  quantity: number;
  unit: string;
  reorder_threshold: number;
  status: 'LOW_STOCK' | 'IN_STOCK';
  batch_number?: string;
  expiry_date?: string;
  last_updated?: string;
}

export interface HospitalPharmacyResponse {
  hospital_id: string;
  total_items: number;
  low_stock_count: number;
  in_stock_count: number;
  items: HospitalPharmacyItem[];
}

