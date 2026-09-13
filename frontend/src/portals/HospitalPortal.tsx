// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { translations } from '../i18n/translations';
import { api } from '../services/api';
import { HospitalSearchSelect } from '../components/HospitalSearchSelect';
import { 
  Building2, 
  AlertOctagon, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  Search, 
  Calendar, 
  FileText, 
  Activity, 
  Phone, 
  Sparkles,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  CheckCircle,
  Truck,
  MapPin,
  Bed
} from 'lucide-react';

export const HospitalPortal = ({ language }) => {
  const t = translations[language] || translations.en;

  const [activeTab, setActiveTab] = useState('incoming_referrals');

  const [currentHospital, setCurrentHospital] = useState(null);
  const [showChangeHospital, setShowChangeHospital] = useState(false);

  const [referrals, setReferrals] = useState([]);
  const [triageQueue, setTriageQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReferral, setSelectedReferral] = useState(null);

  // Load active hospital from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sevasetu_hospital_details');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name) {
          setCurrentHospital(parsed);
        }
      }
    } catch (e) {
      console.error('Error loading stored hospital:', e);
    }
  }, []);

  const loadHospitalData = async () => {
    setLoading(true);
    try {
      const [refsRes, queueRes, patsRes, apptsRes] = await Promise.allSettled([
        api.getReferrals(),
        api.getDoctorQueue(),
        api.getPatients(),
        api.getAppointments()
      ]);

      const refs = refsRes.status === 'fulfilled' ? refsRes.value : [];
      setReferrals(refs || []);
      if (refs && refs.length > 0 && !selectedReferral) {
        setSelectedReferral(refs[0]);
      }
      setTriageQueue(queueRes.status === 'fulfilled' ? queueRes.value || [] : []);
      setPatients(patsRes.status === 'fulfilled' ? patsRes.value || [] : []);
      setAppointments(apptsRes.status === 'fulfilled' ? apptsRes.value || [] : []);
    } catch (e) {
      console.error('Hospital data fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHospitalData();
  }, []);

  const handleUpdateStatus = async (refId, nextStatus) => {
    try {
      await api.updateReferralStatus(refId, nextStatus);
      loadHospitalData();
    } catch (e) {
      alert("Status update error: " + (e.message || 'Error'));
    }
  };

  const handleSelectHospital = (hosp) => {
    setCurrentHospital(hosp);
    if (hosp) {
      localStorage.setItem('sevasetu_hospital_details', JSON.stringify(hosp));
      setShowChangeHospital(false);
    } else {
      localStorage.removeItem('sevasetu_hospital_details');
    }
  };

  const statusLifecycle = ['Pending', 'Accepted', 'Patient Arrived', 'Completed', 'Follow-up'];

  const getNextStatus = (currentStatus) => {
    const idx = statusLifecycle.indexOf(currentStatus);
    if (idx >= 0 && idx < statusLifecycle.length - 1) {
      return statusLifecycle[idx + 1];
    }
    return null;
  };

  const hospitalName = currentHospital?.name || 'Secondary / Tertiary Referral Hospital';
  const hospitalDistrict = currentHospital?.district || 'Maharashtra';
  const hospitalAddress = currentHospital?.address || `${hospitalDistrict}, Maharashtra`;

  const highRiskCases = referrals.filter(r => r.priority === 'P1').concat(
    triageQueue.filter(q => q.priority === 'P1' && !referrals.some(r => r.patient_name === q.patient_name)).map(q => ({
      id: q.id,
      triage_id: q.id,
      patient_name: q.patient_name,
      age: q.age,
      priority: 'P1',
      source_facility: q.village ? `${q.village} Primary Centre` : 'Rural Healthcare Centre',
      target_facility: hospitalName,
      urgency: 'Immediate (< 1 Hour)',
      reason: q.triage_reason,
      transport_mode: '108 Emergency Ambulance',
      status: 'Pending',
      created_at: q.created_at
    }))
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Hospital Header Banner with Authentic Government CSV Dataset info */}
      <div className="bg-gradient-to-r from-rose-900 via-red-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-600 border-2 border-rose-400 flex items-center justify-center text-3xl shadow-lg shrink-0">
              🏥
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2 flex-wrap gap-1">
                <span className="bg-rose-500/30 text-rose-200 text-xs font-black uppercase px-2.5 py-0.5 rounded-full border border-rose-400/40">
                  {currentHospital?.care_type || 'REFERRAL & TERTIARY CARE'}
                </span>
                {currentHospital?.category && (
                  <span className="bg-white/10 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {currentHospital.category}
                  </span>
                )}
                <span className="bg-rose-950/80 text-rose-300 text-[10px] font-mono px-2 py-0.5 rounded-md border border-rose-800">
                  Govt Dataset (CSV)
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black">
                {hospitalName}
              </h2>
              
              <p className="text-xs text-rose-200/80 font-medium flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                <span>{hospitalAddress}</span>
                {currentHospital?.pincode && <span>(PIN: {currentHospital.pincode})</span>}
              </p>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {currentHospital?.beds && Number(currentHospital.beds) > 0 && (
                  <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-lg">
                    🛏️ {currentHospital.beds} Beds
                  </span>
                )}
                {currentHospital?.phone && (
                  <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-0.5 rounded-lg flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-rose-300" />
                    <span>{currentHospital.phone}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowChangeHospital(!showChangeHospital)}
                  className="text-[11px] font-bold underline text-rose-200 hover:text-white ml-1 cursor-pointer"
                >
                  {showChangeHospital ? 'Close Switcher' : 'Switch Hospital'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Truck className="w-4 h-4 text-rose-300 animate-pulse" />
              <span>Incoming Referrals: <strong>{referrals.length}</strong></span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/20 text-xs font-bold text-slate-200 flex items-center space-x-2">
              <AlertOctagon className="w-4 h-4 text-amber-300" />
              <span>P1 Critical: <strong>{highRiskCases.length}</strong></span>
            </div>
          </div>
        </div>

        {/* Change Hospital Dropdown Panel */}
        {showChangeHospital && (
          <div className="mt-5 p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 animate-fadeIn">
            <HospitalSearchSelect
              selectedHospital={currentHospital}
              onSelect={handleSelectHospital}
              language={language}
            />
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200">
        {[
          { id: 'incoming_referrals', label: "1. 📥 Incoming Referrals", count: referrals.length },
          { id: 'high_risk', label: "2. 🚨 High-Risk Critical Board", count: highRiskCases.length },
          { id: 'patient_records', label: "3. 📂 Patient Health Dossiers", count: patients.length },
          { id: 'appointments', label: "4. 📅 Specialist Appointments", count: appointments.length }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-white text-rose-900' : 'bg-slate-200 text-slate-800'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---------------- 1. INCOMING REFERRALS & STATUS PROGRESSION ---------------- */}
      {activeTab === 'incoming_referrals' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div>
                <h3 className="text-xl font-black text-slate-900">Incoming Referrals Queue</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Update Referral Status Workflow: <strong className="text-slate-900">Pending &rarr; Accepted &rarr; Patient Arrived &rarr; Completed &rarr; Follow-up</strong>
                </p>
              </div>
              <button onClick={loadHospitalData} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer">
                Refresh
              </button>
            </div>

            {referrals.length > 0 ? (
              <div className="space-y-4">
                {referrals.map((ref) => {
                  const currentIdx = statusLifecycle.indexOf(ref.status);
                  const nextStatus = getNextStatus(ref.status);

                  return (
                    <div
                      key={ref.id}
                      className="p-5 sm:p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 hover:border-rose-300 transition-all space-y-4"
                    >
                      {/* Top Row: Patient Info & Source Facility */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full text-white ${
                              ref.priority === 'P1' ? 'bg-red-600 animate-pulse' : 'bg-amber-500'
                            }`}>
                              {ref.priority} {ref.urgency}
                            </span>
                            <h4 className="text-lg font-black text-slate-900">{ref.patient_name}</h4>
                            <span className="text-xs text-slate-500 font-medium">({ref.age} yrs)</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Source: <strong className="text-teal-700">{ref.source_facility || 'Primary Care Centre'}</strong> &rarr; Target: <strong className="text-rose-700">{ref.target_facility || hospitalName}</strong>
                          </p>
                        </div>

                        {/* Current Status Pill */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-extrabold bg-rose-100 text-rose-950 px-3 py-1.5 rounded-xl border border-rose-300">
                            Status: {ref.status}
                          </span>

                          {/* 1-Click Status Progression Button */}
                          {nextStatus && (
                            <button
                              onClick={() => handleUpdateStatus(ref.id, nextStatus)}
                              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white rounded-xl text-xs font-black shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                            >
                              <span>Advance to: {nextStatus}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar through 5 Stages */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                        <div className="grid grid-cols-5 gap-2">
                          {statusLifecycle.map((st, idx) => {
                            const isDone = currentIdx >= idx;
                            const isCurrent = currentIdx === idx;
                            return (
                              <button
                                key={st}
                                onClick={() => handleUpdateStatus(ref.id, st)}
                                className={`p-2 rounded-xl text-center text-xs font-extrabold border transition-all cursor-pointer ${
                                  isCurrent
                                    ? 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-300'
                                    : isDone
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                    : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <span className="block text-[10px] opacity-75">Step {idx + 1}</span>
                                <span className="block truncate">{st}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Referral Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-white p-3.5 rounded-2xl border border-slate-200 text-slate-700">
                        <div>
                          <strong>Reason:</strong> {ref.reason}
                        </div>
                        <div>
                          <strong>Transport:</strong> {ref.transport_mode} • <strong>Urgency:</strong> {ref.urgency}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl space-y-2">
                <Truck className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700">No incoming referrals in queue</p>
                <p className="text-slate-400">Referrals dispatched by Doctors or Clinics will appear here in real time.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 2. HIGH-RISK CRITICAL BOARD ---------------- */}
      {activeTab === 'high_risk' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Emergency & High-Risk Case Board (P1 Critical)</h3>
            <p className="text-xs text-slate-500 font-medium">
              Patients requiring immediate ICU/OT/Specialist readiness upon 108 Ambulance arrival
            </p>
          </div>

          {highRiskCases.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {highRiskCases.map((c) => (
                <div key={c.id} className="p-5 rounded-3xl bg-red-50/80 border-2 border-red-300 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="bg-red-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase animate-pulse">
                        P1 Emergency Alert
                      </span>
                      <h4 className="text-base font-black text-red-950 mt-1">{c.patient_name}</h4>
                      <p className="text-xs text-red-800 font-medium">{c.age} yrs • Source: {c.source_facility}</p>
                    </div>
                    <span className="text-xs font-extrabold bg-white text-red-900 px-3 py-1 rounded-xl border border-red-200">
                      {c.status}
                    </span>
                  </div>

                  <p className="text-xs text-red-950 font-semibold bg-white/80 p-3 rounded-2xl border border-red-200">
                    ⚠️ {c.reason}
                  </p>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="font-bold text-slate-600">🚑 {c.transport_mode}</span>
                    <button
                      onClick={() => handleUpdateStatus(c.id, 'Patient Arrived')}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all cursor-pointer"
                    >
                      Mark Arrived at Trauma Bay
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl space-y-2">
              <AlertOctagon className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No active P1 emergency cases</p>
              <p className="text-slate-400">All emergency arrivals and high-risk referrals will show on this board.</p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- 3. PATIENT RECORDS ---------------- */}
      {activeTab === 'patient_records' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Hospital Patient Records & Pre-hospital Vitals</h3>
            <p className="text-xs text-slate-500 font-medium">Consolidated health dossiers for admitted and referred cases</p>
          </div>

          {patients.length > 0 ? (
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
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl space-y-2">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No registered patient records yet</p>
              <p className="text-slate-400">Registered patients and triaged cases will appear in this dossier.</p>
            </div>
          )}
        </div>
      )}

      {/* ---------------- 4. SPECIALIST APPOINTMENTS ---------------- */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Hospital Specialist Appointments</h3>
            <p className="text-xs text-slate-500 font-medium">Specialist OPD appointments booked for {hospitalName}</p>
          </div>

          {appointments.length > 0 ? (
            <div className="space-y-3">
              {appointments.map((appt) => (
                <div key={appt.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="bg-rose-100 text-rose-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                        {appt.time_slot}
                      </span>
                      <h4 className="text-sm font-black text-slate-900">{appt.patient_name}</h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Facility: {appt.facility_name} • Reason: {appt.reason || 'Specialist OPD'}
                    </p>
                  </div>

                  <span className="text-xs font-bold bg-slate-200 text-slate-800 px-2.5 py-1 rounded-xl">
                    {appt.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl space-y-2">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No specialist appointments scheduled</p>
              <p className="text-slate-400">Appointments scheduled by patients or PHC doctors will appear here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
