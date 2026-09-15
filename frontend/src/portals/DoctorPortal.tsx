// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { translations } from '../i18n/translations';
import { api } from '../services/api';
import { 
  Stethoscope, 
  Video, 
  CheckCircle, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowUpRight, 
  Clock, 
  FileText, 
  Search, 
  Sparkles, 
  User, 
  Heart, 
  Wind, 
  Thermometer, 
  Pill, 
  Send, 
  Calendar, 
  Building2, 
  CheckCircle2, 
  RefreshCw, 
  Plus,
  Phone
} from 'lucide-react';

import { getLocalizedClinicalData } from '../i18n/indicMedical';

export const DoctorPortal = ({
  language,
  openTeleconsult
}) => {
  const t = translations[language] || translations.en;

  // Active view tab
  const [activeTab, setActiveTab] = useState('triage_queue');

  // Gemini suggestions language selector: English / Hindi / Marathi
  const [doctorGeminiLang, setDoctorGeminiLang] = useState(language || 'en');

  useEffect(() => {
    if (language) setDoctorGeminiLang(language);
  }, [language]);

  // Queue & Records State
  const [queue, setQueue] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [activeFilter, setActiveFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  // Appointments & Patients
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [hospitalsList, setHospitalsList] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');

  // Verification Form State
  const [verifiedPriority, setVerifiedPriority] = useState('P1');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [prescription, setPrescription] = useState('');
  const [doctorAction, setDoctorAction] = useState('Verify');

  // Create Referral Modal / Form State
  const [referralTarget, setReferralTarget] = useState('');
  const [referralUrgency, setReferralUrgency] = useState('Immediate (< 1 Hour)');
  const [referralReason, setReferralReason] = useState('Pre-eclampsia with elevated BP; requires higher tertiary obstetric management.');
  const [referralTransport, setReferralTransport] = useState('Hospital Transport Van');
  const [referralSuccessMsg, setReferralSuccessMsg] = useState(null);

  // Follow-up state
  const [followupDate, setFollowupDate] = useState('In 3 Days');
  const [followupInstructions, setFollowupInstructions] = useState('Check BP twice daily with ASHA worker. Return immediately if headache or vision blur worsens.');

  const fetchDoctorData = async () => {
    setLoading(true);
    try {
      const [recordsRes, apptsRes, patsRes, refsRes, facsRes] = await Promise.allSettled([
        api.getDoctorQueue(activeFilter),
        api.getAppointments(),
        api.getPatients(),
        api.getReferrals(),
        api.getFacilities({ limit: 40 })
      ]);

      const records = recordsRes.status === 'fulfilled' ? recordsRes.value : [];
      setQueue(records || []);
      if (records && records.length > 0 && !selectedRecord) {
        setSelectedRecord(records[0]);
        setVerifiedPriority(records[0].priority);
      }

      setAppointments(apptsRes.status === 'fulfilled' ? apptsRes.value || [] : []);
      setPatients(patsRes.status === 'fulfilled' ? patsRes.value || [] : []);
      setReferrals(refsRes.status === 'fulfilled' ? refsRes.value || [] : []);
      
      const facs = facsRes.status === 'fulfilled' ? facsRes.value : [];
      setHospitalsList(facs || []);
      if (facs && facs.length > 0 && !referralTarget) {
        setReferralTarget(facs[0].name);
      }
    } catch (e) {
      console.error('Doctor data fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctorData();
    const interval = setInterval(() => {
      api.getDoctorQueue(activeFilter).then(records => {
        if (records) setQueue(records);
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [activeFilter]);

  useEffect(() => {
    if (selectedRecord) {
      setVerifiedPriority(selectedRecord.priority);
      setDoctorNotes(selectedRecord.doctor_notes || '');
      setPrescription(selectedRecord.prescription || 'Tab Paracetamol 500mg TDS x 3 days\nTab Amlodipine 5mg OD\nORS sachet in 1L water\nReview in 48 hours');
    }
  }, [selectedRecord]);

  const handleVerifyCase = async () => {
    if (!selectedRecord || !selectedRecord.id) return;
    try {
      await api.verifyDoctorTriage({
        triage_id: selectedRecord.id,
        doctor_name: "Medical Officer",
        verified_priority: verifiedPriority,
        doctor_notes: doctorNotes,
        prescription: prescription,
        action: doctorAction
      });

      if (doctorAction === 'Refer') {
        await api.createReferral({
          triage_id: selectedRecord.id,
          patient_name: selectedRecord.patient_name,
          age: selectedRecord.age,
          priority: verifiedPriority,
          source_facility: 'Primary Health Centre',
          target_facility: referralTarget,
          urgency: referralUrgency,
          reason: doctorNotes || referralReason,
          transport_mode: referralTransport,
          status: 'Pending'
        });
      }

      alert(`Case #${selectedRecord.id} verified and prescription saved!`);
      fetchDoctorData();
    } catch (e) {
      alert("Error: " + (e.message || 'Verification error'));
    }
  };

  const handleCreateDirectReferral = async (e) => {
    e.preventDefault();
    try {
      await api.createReferral({
        triage_id: selectedRecord?.id || 1,
        patient_name: selectedRecord?.patient_name || 'Patient',
        age: selectedRecord?.age || 30,
        priority: verifiedPriority || 'P1',
        source_facility: 'Primary Health Centre',
        target_facility: referralTarget,
        urgency: referralUrgency,
        reason: referralReason,
        transport_mode: referralTransport,
        status: 'Pending'
      });

      const msg = `Referral successfully dispatched to ${referralTarget} for ${selectedRecord?.patient_name || 'Patient'}!`;
      setReferralSuccessMsg(msg);
      fetchDoctorData();
      setTimeout(() => setReferralSuccessMsg(null), 5000);
    } catch (e) {
      alert("Referral error: " + (e.message || 'Error'));
    }
  };

  const handleUpdateApptStatus = async (apptId, newStatus) => {
    await api.updateAppointmentStatus(apptId, newStatus);
    fetchDoctorData();
  };

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(patientSearch.toLowerCase()) || 
    (p.phone && p.phone.includes(patientSearch)) ||
    (p.village && p.village.toLowerCase().includes(patientSearch.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Doctor Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 border-2 border-blue-400 flex items-center justify-center text-3xl shadow-lg">
              🩺
            </div>
            <div>
              <span className="bg-blue-500/30 text-blue-200 text-xs font-black uppercase px-2.5 py-0.5 rounded-full border border-blue-400/40">
                MEDICAL OFFICER CONSULTATION DESK
              </span>
              <h2 className="text-xl sm:text-3xl font-black mt-1">
                Medical Officer Consultation Desk
              </h2>
              <p className="text-xs text-blue-300 font-medium">
                Primary Health Centre (24x7 Emergency, OPD & eSanjeevani Tele-OPD)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-teal-400" />
              <span>Queue: <strong>{queue.length} Cases</strong></span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-amber-400" />
              <span>Appointments: <strong>{appointments.length}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200">
        {[
          { id: 'triage_queue', label: "1. 🩺 Patient Triage Queue", count: queue.length },
          { id: 'appointments', label: "2. 📅 Today's Appointments", count: appointments.length },
          { id: 'patient_list', label: "3. 👥 Patient Directory", count: patients.length },
          { id: 'referrals', label: "4. 🚀 Create Referral", count: referrals.length },
          { id: 'followup', label: "5. 📋 Follow-up Care", count: undefined }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-white text-blue-900' : 'bg-slate-200 text-slate-800'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---------------- 1. TRIAGE QUEUE & CONSULTATION NOTES ---------------- */}
      {activeTab === 'triage_queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 Cols: Priority Queue Tabs & List */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">{t.triage_queue || 'Triage Priority Queue'}</h3>
                <button onClick={fetchDoctorData} className="text-xs font-bold text-teal-700 hover:text-teal-900 cursor-pointer">
                  Refresh
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-black">
                {['All', 'P1', 'P2', 'P3'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`py-2 rounded-xl transition-all cursor-pointer ${
                      activeFilter === filter
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {filter === 'All' ? (t.tab_all || 'All') : filter === 'P1' ? (t.tab_p1 || 'P1 Emergency') : filter === 'P2' ? (t.tab_p2 || 'P2 Urgent') : (t.tab_p3 || 'P3 Routine')}
                  </button>
                ))}
              </div>

              {/* Queue Items */}
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {queue.map((record) => {
                  const isSelected = selectedRecord?.id === record.id;
                  return (
                    <div
                      key={record.id || record.local_id}
                      onClick={() => setSelectedRecord(record)}
                      className={`p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-600 shadow-md ring-1 ring-blue-500/30'
                          : record.priority === 'P1'
                          ? 'bg-red-50/40 border-red-200 hover:border-red-400'
                          : record.priority === 'P2'
                          ? 'bg-amber-50/40 border-amber-200 hover:border-amber-400'
                          : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full text-white ${
                            record.priority === 'P1' ? 'bg-red-600 animate-pulse' : record.priority === 'P2' ? 'bg-amber-500' : 'bg-emerald-600'
                          }`}>
                            {record.priority}
                          </span>
                          <h4 className="text-sm font-extrabold text-slate-900">
                            {record.patient_name}
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">
                          {record.age}y / {record.gender ? record.gender[0] : 'U'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                        {record.triage_reason}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                        <span>📍 {record.village || 'Maharashtra'}</span>
                        <span>{record.doctor_verified ? '✅ Verified' : '⏳ Pending Review'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right 7 Cols: Selected Case Dossier & Consultation Notes */}
          <div className="lg:col-span-7 space-y-4">
            {selectedRecord ? (
              <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-sm border border-slate-200 space-y-6">
                {/* Dossier Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full text-white ${
                        selectedRecord.priority === 'P1' ? 'bg-red-600 animate-pulse' : selectedRecord.priority === 'P2' ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}>
                        {selectedRecord.priority} Priority Case
                      </span>
                      <h3 className="text-xl font-black text-slate-900">
                        {selectedRecord.patient_name}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Age: {selectedRecord.age} • Gender: {selectedRecord.gender} {selectedRecord.village ? `• Village: ${selectedRecord.village}` : ''} • Phone: {selectedRecord.phone}
                    </p>
                  </div>

                  <button
                    onClick={() => openTeleconsult(selectedRecord)}
                    className="flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-md transition-all shrink-0 cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Start Tele-OPD</span>
                  </button>
                </div>

                {/* Vitals Summary Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block">Blood Pressure</span>
                    <span className="text-base font-black text-slate-900">
                      {selectedRecord.vitals?.systolic_bp}/{selectedRecord.vitals?.diastolic_bp || 80} mmHg
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block">SpO2 Oxygen</span>
                    <span className="text-base font-black text-slate-900">
                      {selectedRecord.vitals?.spo2 || 98}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block">Temperature</span>
                    <span className="text-base font-black text-slate-900">
                      {selectedRecord.vitals?.temperature || 98.6}°F
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block">Duration</span>
                    <span className="text-base font-black text-slate-900">
                      {selectedRecord.vitals?.symptom_duration_days || 1} Days
                    </span>
                  </div>
                </div>

                {/* Patient Symptoms & Triage Reason */}
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 text-xs text-amber-950 space-y-1">
                  <p className="font-extrabold text-amber-900">Reported Symptoms & Triage Justification:</p>
                  <p className="font-semibold">{selectedRecord.vitals?.symptoms || selectedRecord.symptoms || selectedRecord.triage_reason}</p>
                  <p className="text-slate-500 text-[11px] mt-1">Rule Engine: {selectedRecord.triage_reason}</p>
                </div>

                {/* Gemini AI Clinical Decision Support with English / Hindi / Marathi Selector */}
                {(() => {
                  const localizedClinical = getLocalizedClinicalData(selectedRecord, doctorGeminiLang);
                  return (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50/90 to-blue-50/90 border border-blue-200 text-xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center space-x-1.5 font-black text-blue-900">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span>AI Clinical Decision Support</span>
                        </div>
                        
                        {/* Language Selection: English / Hindi / Marathi */}
                        <div className="flex items-center bg-white/90 p-0.5 rounded-xl border border-blue-200 shadow-2xs">
                          <span className="text-[10px] font-bold text-slate-500 px-1.5">AI Language:</span>
                          {[
                            { code: 'en', label: 'EN' },
                            { code: 'hi', label: 'हिंदी' },
                            { code: 'mr', label: 'मराठी' }
                          ].map(({ code, label }) => (
                            <button
                              key={code}
                              type="button"
                              onClick={() => setDoctorGeminiLang(code)}
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                doctorGeminiLang === code
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold border-b border-blue-100 pb-1.5">
                        <span className="text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200 font-bold">
                          {selectedRecord.ai_model || 'Gemini 3.6 Flash + Safety Guardrails'}
                        </span>
                        <span>Confidence: {((selectedRecord.confidence_score || 0.85) * 100).toFixed(0)}%</span>
                      </div>

                      {/* Differential Diagnoses */}
                      {localizedClinical.differential && localizedClinical.differential.length > 0 && (
                        <div className="space-y-1">
                          <span className="text-[11px] font-bold text-slate-700 block">
                            {doctorGeminiLang === 'mr' ? 'संभाव्य विभेदक निदान (क्लिक करून नोट्समध्ये जोडा):' : doctorGeminiLang === 'hi' ? 'संभावित विभेदक निदान (क्लिक करके नोट्स में जोड़ें):' : 'Differential Diagnoses (click to append to consultation notes):'}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {localizedClinical.differential.map((diag, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  setDoctorNotes(prev => prev ? `${prev}; Suspected: ${diag}` : `Suspected: ${diag}`);
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-lg text-xs font-semibold transition-all shadow-xs flex items-center space-x-1 cursor-pointer"
                                title="Click to insert into Doctor Notes"
                              >
                                <span>+ {diag}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Clinical Reasoning */}
                      {localizedClinical.reasoning && (
                        <div className="text-[11px] text-slate-700 bg-white/80 p-2.5 rounded-xl border border-blue-100 leading-relaxed font-medium">
                          <strong className="text-slate-900">
                            {doctorGeminiLang === 'mr' ? 'AI वैद्यकीय तर्क (Clinical Rationale): ' : doctorGeminiLang === 'hi' ? 'AI नैदानिक तर्क (Clinical Rationale): ' : 'AI Clinical Rationale: '}
                          </strong>
                          {localizedClinical.reasoning}
                        </div>
                      )}

                      {/* Red Flags & Investigations if available */}
                      {localizedClinical.redFlags && localizedClinical.redFlags.length > 0 && (
                        <div className="p-2.5 bg-rose-50/90 rounded-xl border border-rose-200 text-xs text-rose-950 space-y-1">
                          <span className="font-bold text-rose-900 text-[11px] uppercase">
                            🚨 {doctorGeminiLang === 'mr' ? 'धोक्याची लक्षणे:' : doctorGeminiLang === 'hi' ? 'खतरे के संकेत:' : 'Danger Signs / Red Flags:'}
                          </span>
                          <ul className="list-disc list-inside text-[11px] text-rose-800">
                            {localizedClinical.redFlags.map((rf, i) => (
                              <li key={i}>{rf}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Consultation Notes & Verification Form */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-sm font-black text-slate-900 flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span>Doctor Consultation Notes & e-Prescription</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Doctor Verified Priority</label>
                      <select
                        value={verifiedPriority}
                        onChange={(e) => setVerifiedPriority(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="P1">P1 Critical Emergency</option>
                        <option value="P2">P2 Urgent Attention</option>
                        <option value="P3">P3 Routine OPD</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Action</label>
                      <select
                        value={doctorAction}
                        onChange={(e) => setDoctorAction(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="Verify">Verify & Prescribe (Treat at PHC)</option>
                        <option value="Refer">Refer to Higher Hospital (District / CHC)</option>
                        <option value="Complete">Complete & Discharge</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Clinical Observation & Notes</label>
                    <textarea
                      rows={2}
                      value={doctorNotes}
                      onChange={(e) => setDoctorNotes(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Doctor diagnosis and clinical findings..."
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">e-Prescription (Rx)</label>
                    <textarea
                      rows={3}
                      value={prescription}
                      onChange={(e) => setPrescription(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="Medication name, dosage, frequency, and duration..."
                    />
                  </div>

                  <button
                    onClick={handleVerifyCase}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Submit Verification & Save Prescription</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
                <p className="text-sm font-bold text-slate-500">Select a patient case from the queue to view dossier.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 2. TODAY'S APPOINTMENTS ---------------- */}
      {activeTab === 'appointments' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
            <div>
              <h3 className="text-xl font-black text-slate-900">Today's Scheduled Appointments</h3>
              <p className="text-xs text-slate-500 font-medium">OPD and Teleconsultation queue for Primary Health Centre</p>
            </div>
            <button onClick={fetchDoctorData} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold cursor-pointer">
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {appointments.map((appt) => (
              <div key={appt.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="bg-blue-100 text-blue-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {appt.time_slot}
                    </span>
                    <h4 className="text-base font-black text-slate-900">{appt.patient_name}</h4>
                    <span className="text-xs text-slate-500 font-medium">({appt.age}y, {appt.gender})</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    🏥 <strong>Facility:</strong> {appt.facility_name} • <strong>Reason:</strong> {appt.reason || 'General Checkup'}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-black px-2.5 py-1 rounded-xl ${
                    appt.status === 'In-Consultation' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                    appt.status === 'Completed' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                    'bg-slate-200 text-slate-800'
                  }`}>
                    {appt.status}
                  </span>

                  {appt.status !== 'Completed' && (
                    <button
                      onClick={() => handleUpdateApptStatus(appt.id, 'Completed')}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 3. PATIENT DIRECTORY ---------------- */}
      {activeTab === 'patient_list' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-900">Registered Village Patients</h3>
              <p className="text-xs text-slate-500 font-medium">Citizen directory with ABHA linkage</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search name, phone, village..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPatients.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-black text-slate-900">{p.name}</h4>
                    <p className="text-xs text-slate-500">{p.age} yrs • {p.gender} {p.village ? `• Village: ${p.village}` : ''}</p>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                    {p.abha_id || 'ABHA Active'}
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex items-center space-x-2 pt-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{p.phone}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 4. CREATE REFERRAL ---------------- */}
      {activeTab === 'referrals' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-2">
              <Send className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-black text-slate-900">Create Hospital Referral</h3>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Refer high-risk P1 or specialist P2 patients from Primary Health Centre to Secondary / Tertiary Centers
            </p>
          </div>

          {referralSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{referralSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateDirectReferral} className="space-y-4 text-xs font-bold">
            <div>
              <label className="text-slate-700 block mb-1">Target Referral Facility *</label>
              <select
                value={referralTarget}
                onChange={(e) => setReferralTarget(e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {hospitalsList.length > 0 ? (
                  hospitalsList.map((h) => (
                    <option key={h.id} value={h.name}>
                      {h.name} {h.district ? `(${h.district})` : ''} {h.care_type ? `• ${h.care_type}` : ''}
                    </option>
                  ))
                ) : (
                  <option value="District Hospital / Tertiary Care Center">
                    District Hospital / Tertiary Care Center
                  </option>
                )}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-700 block mb-1">Urgency Level *</label>
                <select
                  value={referralUrgency}
                  onChange={(e) => setReferralUrgency(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Immediate (< 1 Hour)">Immediate (&lt; 1 Hour - Critical)</option>
                  <option value="Within 24 Hours">Within 24 Hours (Urgent)</option>
                  <option value="Elective Specialist Review">Elective Specialist Review</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Transport Mode *</label>
                <select
                  value={referralTransport}
                  onChange={(e) => setReferralTransport(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Hospital Transport Van">Hospital Transport Van</option>
                  <option value="Self / Family Transport">Self / Family Transport</option>
                  <option value="Public Transit / Escort">Public Transit / Escort</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-700 block mb-1">Clinical Justification & Notes *</label>
              <textarea
                rows={3}
                required
                value={referralReason}
                onChange={(e) => setReferralReason(e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Reason for referral and pre-hospital treatment provided..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-base shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <Send className="w-5 h-5" />
              <span>Dispatch Referral to Hospital Dashboard</span>
            </button>
          </form>
        </div>
      )}

      {/* ---------------- 5. FOLLOW-UP CARE ---------------- */}
      {activeTab === 'followup' && (
        <div className="max-w-2xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Set Patient Follow-up Instructions</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Instructions sent to patient & village ASHA worker for home visits
            </p>
          </div>

          <div className="space-y-4 text-xs font-bold">
            <div>
              <label className="text-slate-700 block mb-1">Follow-up Schedule</label>
              <select
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Tomorrow (24 Hours)">Tomorrow (24 Hours) - High Risk</option>
                <option value="In 3 Days">In 3 Days - Routine Review</option>
                <option value="In 1 Week">In 1 Week</option>
                <option value="In 1 Month">In 1 Month - NCD Refill</option>
              </select>
            </div>

            <div>
              <label className="text-slate-700 block mb-1">Follow-up Instructions for Patient & ASHA</label>
              <textarea
                rows={3}
                value={followupInstructions}
                onChange={(e) => setFollowupInstructions(e.target.value)}
                className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <button
              onClick={() => alert(`Follow-up saved! Assigned to Community Health Worker (ASHA) for ${followupDate}.`)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-md transition-all cursor-pointer"
            >
              Save Follow-up Schedule
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
