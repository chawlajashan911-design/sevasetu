import React, { useState, useEffect } from 'react';
import { Language, TriageRecord, PriorityLevel, Appointment, Referral, Patient, Facility } from '../types';
import { translations } from '../i18n/translations';
import { api } from '../services/api';
import { 
  Building, 
  Clock, 
  Calendar, 
  Users, 
  Activity, 
  Stethoscope, 
  Send, 
  CheckCircle2, 
  Search, 
  Sparkles,
  FileText,
  AlertTriangle,
  RefreshCw,
  Plus,
  ShieldCheck,
  CheckCircle,
  Video
} from 'lucide-react';

interface ClinicPortalProps {
  language: Language;
  openTeleconsult: (record: TriageRecord) => void;
}

export const ClinicPortal: React.FC<ClinicPortalProps> = ({
  language,
  openTeleconsult
}) => {
  const t = translations[language];

  const [activeTab, setActiveTab] = useState<'queue' | 'appointments' | 'records' | 'triage' | 'consultation' | 'referral'>('queue');

  const [queue, setQueue] = useState<TriageRecord[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [selectedCase, setSelectedCase] = useState<TriageRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Consultation state
  const [rxNotes, setRxNotes] = useState<string>('');
  const [rxPrescription, setRxPrescription] = useState<string>('Tab Paracetamol 500mg TDS x 3 days\nORS sachet in 1L clean water');

  // Referral state
  const [hospitalsList, setHospitalsList] = useState<Facility[]>([]);
  const [targetHospital, setTargetHospital] = useState<string>('');
  const [referralUrgency, setReferralUrgency] = useState<string>('Immediate (< 1 Hour)');
  const [referralReason, setReferralReason] = useState<string>('Patient requires emergency evaluation and higher center specialist care.');
  const [referralSuccessMsg, setReferralSuccessMsg] = useState<string | null>(null);

  const loadClinicData = async () => {
    setLoading(true);
    try {
      const q = await api.getDoctorQueue();
      setQueue(q);
      if (q.length > 0 && !selectedCase) {
        setSelectedCase(q[0]);
      }
      const appts = await api.getAppointments();
      setAppointments(appts);
      const pats = await api.getPatients();
      setPatients(pats);
      const refs = await api.getReferrals();
      setReferrals(refs);
      const facs = await api.getFacilities({ limit: 40 });
      setHospitalsList(facs);
      if (facs.length > 0 && !targetHospital) {
        setTargetHospital(facs[0].name);
      }
    } catch (e) {
      console.error('Clinic data fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClinicData();
  }, []);

  const handleStartConsultation = (rec: TriageRecord) => {
    setSelectedCase(rec);
    setRxNotes(rec.doctor_notes || '');
    setRxPrescription(rec.prescription || 'Tab Paracetamol 500mg TDS x 3 days\nORS sachet in 1L clean water');
    setActiveTab('consultation');
  };

  const handleSaveConsultation = async () => {
    if (!selectedCase || !selectedCase.id) return;
    try {
      await api.verifyDoctorTriage({
        triage_id: selectedCase.id,
        doctor_name: "Medical Officer / PHC Physician",
        verified_priority: selectedCase.priority,
        doctor_notes: rxNotes,
        prescription: rxPrescription,
        action: "Verify"
      });
      alert(`Consultation complete for ${selectedCase.patient_name}! Prescription saved.`);
      loadClinicData();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createReferral({
        triage_id: selectedCase?.id || 1,
        patient_name: selectedCase?.patient_name || 'Patient',
        age: selectedCase?.age || 30,
        priority: selectedCase?.priority || 'P1',
        source_facility: 'Primary Health Centre',
        target_facility: targetHospital,
        urgency: referralUrgency,
        reason: referralReason,
        transport_mode: '108 Emergency Ambulance',
        status: 'Pending'
      });
      setReferralSuccessMsg(`Referral successfully dispatched to ${targetHospital}!`);
      loadClinicData();
      setTimeout(() => setReferralSuccessMsg(null), 5000);
    } catch (e: any) {
      alert("Error creating referral: " + e.message);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Clinic Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 border-2 border-emerald-400 flex items-center justify-center text-3xl shadow-lg">
              🏪
            </div>
            <div>
              <span className="bg-emerald-500/30 text-emerald-200 text-xs font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                CLINIC & PRIMARY HEALTH CENTRE DESK
              </span>
              <h2 className="text-xl sm:text-3xl font-black mt-1">
                Primary Health Centre & OPD Desk
              </h2>
              <p className="text-xs text-emerald-200/80 font-medium">
                OPD Desk, Patient Registry, Digital Triage & Direct Referral Dispatch
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-xs font-bold text-slate-200">
              Active OPD Queue: <strong>{queue.length}</strong>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-xs font-bold text-slate-200">
              Appointments: <strong>{appointments.length}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200">
        {[
          { id: 'queue', label: "1. 🚶 Patient Queue", count: queue.length },
          { id: 'appointments', label: "2. 📅 Appointments", count: appointments.length },
          { id: 'records', label: "3. 📂 Patient Records", count: patients.length },
          { id: 'triage', label: "4. 📊 Triage Results", count: undefined },
          { id: 'consultation', label: "5. 🩺 Start Consultation", count: undefined },
          { id: 'referral', label: "6. 🚀 Create Referral", count: referrals.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-white text-emerald-900' : 'bg-slate-200 text-slate-800'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---------------- 1. PATIENT QUEUE TAB ---------------- */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
            <div>
              <h3 className="text-xl font-black text-slate-900">Live Clinic Patient Queue</h3>
              <p className="text-xs text-slate-500 font-medium">Walk-ins and triaged patients waiting at Primary Health Centre</p>
            </div>
            <button onClick={loadClinicData} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer">
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {queue.map((rec) => (
              <div
                key={rec.id || rec.local_id}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-emerald-400 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full text-white ${
                      rec.priority === 'P1' ? 'bg-red-600 animate-pulse' : rec.priority === 'P2' ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}>
                      {rec.priority} Priority
                    </span>
                    <h4 className="text-base font-black text-slate-900">{rec.patient_name}</h4>
                    <span className="text-xs text-slate-500 font-medium">({rec.age}y, {rec.gender})</span>
                  </div>

                  <p className="text-xs text-slate-600">
                    <strong>Vitals:</strong> BP {rec.vitals?.systolic_bp || 120}/{rec.vitals?.diastolic_bp || 80} mmHg • SpO2 {rec.vitals?.spo2 || 98}% • Temp {rec.vitals?.temperature || 98.6}°F
                  </p>

                  <p className="text-xs text-slate-500">
                    <strong>Symptoms:</strong> {rec.vitals?.symptoms || rec.triage_reason}
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => handleStartConsultation(rec)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center space-x-1.5"
                  >
                    <Stethoscope className="w-4 h-4" />
                    <span>Start Consultation</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCase(rec);
                      setActiveTab('referral');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm flex items-center space-x-1.5"
                  >
                    <Send className="w-4 h-4" />
                    <span>Refer</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 2. APPOINTMENTS TAB ---------------- */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Clinic Booked Appointments</h3>
            <p className="text-xs text-slate-500 font-medium">Scheduled OPD consultations for Primary Health Centre</p>
          </div>

          <div className="space-y-3">
            {appointments.map((appt) => (
              <div key={appt.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {appt.time_slot}
                    </span>
                    <h4 className="text-sm font-black text-slate-900">{appt.patient_name}</h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Facility: {appt.facility_name} • Reason: {appt.reason || 'OPD Checkup'}
                  </p>
                </div>

                <span className="text-xs font-bold bg-slate-200 text-slate-800 px-2.5 py-1 rounded-xl">
                  {appt.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 3. PATIENT RECORDS TAB ---------------- */}
      {activeTab === 'records' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Patient Electronic Health Records</h3>
            <p className="text-xs text-slate-500 font-medium">Village health dossiers with longitudinal vitals and prescriptions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patients.map((p) => (
              <div key={p.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-black text-slate-900">{p.name}</h4>
                    <p className="text-xs text-slate-500">{p.age} yrs • {p.gender} {p.village ? `• Village: ${p.village}` : ''}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200">
                    {p.abha_id || 'ABHA Active'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">📱 Mobile: {p.phone}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 4. TRIAGE RESULTS TAB ---------------- */}
      {activeTab === 'triage' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Clinical Triage Results Breakdown</h3>
            <p className="text-xs text-slate-500 font-medium">Deterministic Rule Engine v1.2 Triaged Cases</p>
          </div>

          <div className="space-y-3">
            {queue.map((rec) => (
              <div key={rec.id || rec.local_id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full text-white ${
                      rec.priority === 'P1' ? 'bg-red-600 animate-pulse' : rec.priority === 'P2' ? 'bg-amber-500' : 'bg-emerald-600'
                    }`}>
                      {rec.priority}
                    </span>
                    <h4 className="text-sm font-black text-slate-900">{rec.patient_name}</h4>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{rec.triage_reason}</p>
                </div>

                <button
                  onClick={() => handleStartConsultation(rec)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm"
                >
                  Examine
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 5. START CONSULTATION TAB ---------------- */}
      {activeTab === 'consultation' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-5">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-900">Physician Clinical Consultation</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Patient: <strong>{selectedCase?.patient_name || 'Walk-in Patient'}</strong> ({selectedCase?.age || 28}y)
              </p>
            </div>
            {selectedCase && (
              <button
                onClick={() => openTeleconsult(selectedCase)}
                className="flex items-center space-x-1 px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-xs font-bold shadow-md"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Tele-OPD</span>
              </button>
            )}
          </div>

          <div className="space-y-4 text-xs font-bold">
            <div>
              <label className="text-slate-700 block mb-1">Clinical Impressions & Notes</label>
              <textarea
                value={rxNotes}
                onChange={(e) => setRxNotes(e.target.value)}
                rows={3}
                placeholder="Doctor clinical observation notes..."
                className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="text-slate-700 block mb-1">e-Prescription & Advice</label>
              <textarea
                value={rxPrescription}
                onChange={(e) => setRxPrescription(e.target.value)}
                rows={4}
                className="w-full p-3 rounded-2xl border border-slate-200 text-xs font-medium font-mono focus:ring-2 focus:ring-emerald-500 outline-none bg-slate-50"
              />
            </div>

            <button
              onClick={handleSaveConsultation}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Complete Consultation & Issue e-Prescription</span>
            </button>
          </div>
        </div>
      )}

      {/* ---------------- 6. CREATE REFERRAL TAB ---------------- */}
      {activeTab === 'referral' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Refer Patient to Higher Center</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Dispatch referral from Primary Care to Secondary / Tertiary Hospitals
            </p>
          </div>

          {referralSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{referralSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateReferral} className="space-y-4 text-xs font-bold">
            <div>
              <label className="text-slate-700 block mb-1">Target Hospital (from Government Directory) *</label>
              <select
                value={targetHospital}
                onChange={(e) => setTargetHospital(e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {hospitalsList.map((h) => (
                  <option key={h.id} value={h.name}>
                    {h.name} ({h.care_type || 'Hospital'} • {h.district || 'MH'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-700 block mb-1">Urgency Level</label>
              <select
                value={referralUrgency}
                onChange={(e) => setReferralUrgency(e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="Immediate (< 1 Hour)">Immediate (&lt; 1 Hour - Emergency)</option>
                <option value="Within 24 Hours">Within 24 Hours</option>
              </select>
            </div>

            <div>
              <label className="text-slate-700 block mb-1">Referral Reason *</label>
              <textarea
                rows={3}
                required
                value={referralReason}
                onChange={(e) => setReferralReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2"
            >
              <Send className="w-5 h-5" />
              <span>Send Referral to Hospital Dashboard</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
