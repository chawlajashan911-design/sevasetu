import React, { useState, useEffect } from 'react';
import { Language, TriageRecord, AshaIncentiveActivity, Patient, Referral } from '../types';
import { translations } from '../i18n/translations';
import { api } from '../services/api';
import { db, getPendingSyncCount } from '../db/dexie';
import { useSpeech } from '../hooks/useSpeech';
import confetti from 'canvas-confetti';
import { 
  HeartHandshake, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  PlusCircle, 
  Mic, 
  MicOff, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  ArrowUpRight, 
  FileText, 
  Coins, 
  Check, 
  Clock,
  UserCheck,
  Users,
  Send,
  AlertOctagon,
  Calendar,
  CheckCircle2
} from 'lucide-react';

interface AshaPortalProps {
  language: Language;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  pendingSyncCount: number;
  setPendingSyncCount: (count: number) => void;
}

export const AshaPortal: React.FC<AshaPortalProps> = ({
  language,
  isOffline,
  setIsOffline,
  pendingSyncCount,
  setPendingSyncCount
}) => {
  const t = translations[language];
  const { isListening, transcript, startListening, stopListening } = useSpeech(language);

  // Active view tab
  const [activeTab, setActiveTab] = useState<'screening' | 'village_patients' | 'risk_overview' | 'referrals' | 'followups' | 'incentives'>('screening');

  // Form State for ASHA Screening
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState<number>(30);
  const [gender, setGender] = useState('Female');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [wadi, setWadi] = useState('Main Area');
  
  // Vitals
  const [systolicBp, setSystolicBp] = useState('130');
  const [diastolicBp, setDiastolicBp] = useState('85');
  const [spo2, setSpo2] = useState('97');
  const [temperature, setTemperature] = useState('98.6');
  const [durationDays, setDurationDays] = useState(1);
  const [symptoms, setSymptoms] = useState('');
  const [isMaternal, setIsMaternal] = useState(false);
  const [maternalNote, setMaternalNote] = useState('');

  // Data lists
  const [offlineRecords, setOfflineRecords] = useState<TriageRecord[]>([]);
  const [villagePatients, setVillagePatients] = useState<Patient[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [incentives, setIncentives] = useState<any>({
    total_earned_month: 950,
    pending_disbursal: 450,
    disbursed_total: 500,
    recent_activities: []
  });
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Follow-up home visit tasks state
  const [completedFollowups, setCompletedFollowups] = useState<number[]>([1]);

  // Update symptoms from voice
  useEffect(() => {
    if (transcript) {
      setSymptoms(prev => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, [transcript]);

  // Load records from Dexie and API
  const refreshRecords = async () => {
    const records = await db.triageRecords.toArray();
    setOfflineRecords(records);
    const count = await getPendingSyncCount();
    setPendingSyncCount(count);
    
    try {
      const pats = await api.getPatients();
      setVillagePatients(pats);
      const refs = await api.getReferrals();
      setReferrals(refs);
      const inc = await api.getAshaIncentives();
      setIncentives(inc);
    } catch (e) {
      console.warn('ASHA portal data load:', e);
    }
  };

  useEffect(() => {
    refreshRecords();
  }, []);

  // Save Screening (works online and offline via Dexie)
  const handleSaveScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !phone) {
      alert("Please enter Patient Name and Phone Number.");
      return;
    }

    try {
      const payload = {
        patient_name: patientName,
        age: Number(age),
        gender,
        phone,
        village,
        vitals: {
          systolic_bp: systolicBp ? parseFloat(systolicBp) : undefined,
          diastolic_bp: diastolicBp ? parseFloat(diastolicBp) : undefined,
          spo2: spo2 ? parseFloat(spo2) : undefined,
          temperature: temperature ? parseFloat(temperature) : undefined,
          symptom_duration_days: durationDays,
          symptoms,
          high_risk_maternal: isMaternal,
          maternal_note: maternalNote
        },
        source: isOffline ? 'ASHA_Offline' : 'ASHA_Online'
      };

      const result = await api.evaluateTriage(payload, isOffline);

      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });

      const savedMsg = isOffline
        ? `[Saved Offline] Record saved locally in Dexie database. Priority: ${result.priority} (${result.triage_label}). Sync when internet is restored.`
        : `[Saved to Server] Screening registered successfully! AI Priority: ${result.priority} (${result.triage_label}).`;

      alert(savedMsg);

      // Reset Form
      setPatientName('');
      setPhone('');
      setSymptoms('');
      setIsMaternal(false);
      setMaternalNote('');
      refreshRecords();
    } catch (err: any) {
      alert("Screening Error: " + err.message);
    }
  };

  // 1-Click Batch Synchronization
  const handleBatchSync = async () => {
    const unsynced = offlineRecords.filter(r => !r.is_synced);
    if (unsynced.length === 0) {
      alert("All records are already synchronized!");
      return;
    }

    setSyncStatus('syncing');
    try {
      const res = await api.syncBatch(unsynced);
      confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      setSyncStatus('success');
      alert(`Synchronized ${res.synced_count} records to server! ₹${res.incentives_credited_inr} incentives credited.`);
      refreshRecords();
    } catch (e: any) {
      setSyncStatus('error');
      alert("Sync failed: " + e.message);
    }
  };

  const p1Count = offlineRecords.filter(r => r.priority === 'P1').length;
  const p2Count = offlineRecords.filter(r => r.priority === 'P2').length;
  const p3Count = offlineRecords.filter(r => r.priority === 'P3').length;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* ASHA Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-fuchsia-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-600 border-2 border-purple-400 flex items-center justify-center text-3xl shadow-lg">
              👩‍⚕️
            </div>
            <div>
              <span className="bg-purple-500/30 text-purple-200 text-xs font-black uppercase px-2.5 py-0.5 rounded-full border border-purple-400/40">
                COMMUNITY HEALTH WORKER & ASHA PORTAL
              </span>
              <h2 className="text-xl sm:text-3xl font-black mt-1">
                Community Health Mobilizer Desk
              </h2>
              <p className="text-xs text-purple-200/80 font-medium">
                Field Health Circle • Offline-First Dexie.js Field Register
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBatchSync}
              disabled={pendingSyncCount === 0}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl font-black text-xs shadow-lg transition-all ${
                pendingSyncCount > 0
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 animate-pulse'
                  : 'bg-white/10 text-white/60 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span>{pendingSyncCount > 0 ? `Sync ${pendingSyncCount} Records` : 'All Synced'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200">
        {[
          { id: 'screening', label: "1. 📝 Field Screening Form", count: undefined },
          { id: 'village_patients', label: "2. 👥 Village Patients", count: villagePatients.length },
          { id: 'risk_overview', label: "3. 📊 Risk-Level Overview", count: p1Count },
          { id: 'referrals', label: "4. 🚀 Pending Referrals", count: referrals.length },
          { id: 'followups', label: "5. 🏠 Home Visit Follow-ups", count: 3 },
          { id: 'incentives', label: "6. 💰 NHM Incentive Ledger", count: undefined }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                activeTab === tab.id ? 'bg-white text-purple-900' : 'bg-slate-200 text-slate-800'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---------------- 1. FIELD SCREENING FORM TAB ---------------- */}
      {activeTab === 'screening' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-slate-900">Field Patient Health Screening</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Works 100% offline in remote hamlets using Dexie.js IndexedDB
                </p>
              </div>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-xl ${
                isOffline ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'
              }`}>
                {isOffline ? 'Offline Mode' : 'Online Mode'}
              </span>
            </div>

            <form onSubmit={handleSaveScreening} className="space-y-4 text-xs font-bold">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-slate-700 block mb-1">Patient Full Name *</label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="e.g. Maruti Baban Shinde"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Age *</label>
                  <input
                    type="number"
                    required
                    value={age}
                    onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-slate-700 block mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="9422XXXXXX"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Village / Hamlet</label>
                  <input
                    type="text"
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-[11px] text-slate-500 block mb-1">Systolic BP</label>
                  <input
                    type="number"
                    value={systolicBp}
                    onChange={(e) => setSystolicBp(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-sm font-bold text-center"
                    placeholder="120"
                  />
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-[11px] text-slate-500 block mb-1">SpO2 %</label>
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-sm font-bold text-center"
                    placeholder="98"
                  />
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-[11px] text-slate-500 block mb-1">Temp (°F)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-sm font-bold text-center"
                    placeholder="98.6"
                  />
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="text-[11px] text-slate-500 block mb-1">Duration (Days)</label>
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                    className="w-full p-2 bg-white rounded-lg border border-slate-300 text-sm font-bold text-center"
                    placeholder="1"
                  />
                </div>
              </div>

              {/* Maternal Risk Toggle */}
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMaternal}
                    onChange={(e) => setIsMaternal(e.target.checked)}
                    className="w-5 h-5 rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs font-extrabold text-rose-950">
                    High-Risk Maternal Case (Pre-eclampsia, Gestational Alert - +₹300 Incentive)
                  </span>
                </label>
              </div>

              {/* Symptoms Input with Voice */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 block">Symptoms / Observations</label>
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center space-x-1"
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5 text-red-600" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isListening ? 'Listening...' : 'Voice Dictation'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder="Record patient complaints..."
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 active:scale-98 text-white font-black text-sm rounded-2xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Save Screening to Field Register</span>
              </button>
            </form>
          </div>

          {/* Quick Right Side Status */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h4 className="text-base font-black text-slate-900">ASHA Sync & Register Status</h4>
              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-semibold">Total Offline Records:</span>
                  <span className="font-black text-purple-900">{offlineRecords.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 font-semibold">Pending Server Sync:</span>
                  <span className="font-black text-amber-700">{pendingSyncCount}</span>
                </div>
              </div>

              <button
                onClick={handleBatchSync}
                disabled={pendingSyncCount === 0}
                className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
                  pendingSyncCount > 0 ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-md' : 'bg-slate-100 text-slate-400'
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                <span>Upload {pendingSyncCount} Records to Server</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 2. VILLAGE PATIENTS ---------------- */}
      {activeTab === 'village_patients' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Village Household Directory</h3>
            <p className="text-xs text-slate-500 font-medium">Assigned households and screened village citizens</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {villagePatients.map((p) => (
              <div key={p.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-base font-black text-slate-900">{p.name}</h4>
                    <p className="text-xs text-slate-500">{p.age} yrs • {p.gender} {p.village ? `• Village: ${p.village}` : ''}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-200">
                    {p.abha_id || 'ABHA Linked'}
                  </span>
                </div>
                <p className="text-xs text-slate-600">📱 Mobile: {p.phone}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 3. RISK-LEVEL OVERVIEW ---------------- */}
      {activeTab === 'risk_overview' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Village Risk-Level Surveillance</h3>
            <p className="text-xs text-slate-500 font-medium">Population stratification by clinical severity</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-red-50 border border-red-200">
              <h4 className="text-base font-black text-red-950">P1 High-Risk & Maternal</h4>
              <p className="text-xs text-red-800 mt-1">Requiring immediate PHC escort & 108 ambulance referral.</p>
              <div className="text-3xl font-black text-red-600 mt-3">{p1Count || 2} Cases</div>
            </div>

            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200">
              <h4 className="text-base font-black text-amber-950">P2 Urgent Attention</h4>
              <p className="text-xs text-amber-800 mt-1">High fever &gt;3 days requiring medical officer review.</p>
              <div className="text-3xl font-black text-amber-600 mt-3">{p2Count || 1} Cases</div>
            </div>

            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <h4 className="text-base font-black text-emerald-950">P3 Routine Care</h4>
              <p className="text-xs text-emerald-800 mt-1">Stable baselines and monthly chronic medicine refills.</p>
              <div className="text-3xl font-black text-emerald-600 mt-3">{p3Count || 1} Cases</div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 4. PENDING REFERRALS ---------------- */}
      {activeTab === 'referrals' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Village Referral Follow-up Tracker</h3>
            <p className="text-xs text-slate-500 font-medium">Track village patients referred to Health Centres or Hospitals</p>
          </div>

          <div className="space-y-3">
            {referrals.map((r) => (
              <div key={r.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="bg-purple-100 text-purple-900 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {r.priority} Priority
                    </span>
                    <h4 className="text-base font-black text-slate-900">{r.patient_name}</h4>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Destination: <strong className="text-slate-900">{r.target_facility}</strong> • Transport: {r.transport_mode}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{r.reason}</p>
                </div>

                <span className="text-xs font-extrabold bg-teal-100 text-teal-900 px-3 py-1 rounded-xl border border-teal-300">
                  Status: {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- 5. HOME VISIT FOLLOW-UPS ---------------- */}
      {activeTab === 'followups' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Home Visit Care Tasks Checklist</h3>
            <p className="text-xs text-slate-500 font-medium">Post-discharge monitoring, antenatal visits & routine blood pressure checks</p>
          </div>

          <div className="space-y-3">
            {[
              { id: 1, name: villagePatients[0]?.name || "Maternal Care Patient", task: "High-risk pregnancy BP check & pre-eclampsia symptom review", time: "Today, 10:00 AM", status: "Completed" },
              { id: 2, name: villagePatients[1]?.name || "Elderly Care Patient", task: "Post-treatment pulse oximetry SpO2 check (target >95%)", time: "Today, 02:00 PM", status: "Pending" },
              { id: 3, name: villagePatients[2]?.name || "Chronic Care Patient", task: "Hypertension & monthly medicine refill verification", time: "Tomorrow, 11:00 AM", status: "Pending" }
            ].map((task) => {
              const isCompleted = completedFollowups.includes(task.id);
              return (
                <div key={task.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => {
                        setCompletedFollowups(prev => 
                          prev.includes(task.id) ? prev.filter(i => i !== task.id) : [...prev, task.id]
                        );
                      }}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                        isCompleted ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isCompleted && <Check className="w-4 h-4" />}
                    </button>
                    <div>
                      <h4 className={`text-sm font-black ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                        {task.name}
                      </h4>
                      <p className="text-xs text-slate-500">{task.task}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-400">{task.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- 6. NHM INCENTIVES ---------------- */}
      {activeTab === 'incentives' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">National Health Mission (NHM) Incentives</h3>
            <p className="text-xs text-slate-500 font-medium">Monthly screening, maternal tracking & emergency escort earnings ledger</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-purple-50 border border-purple-200">
              <h4 className="text-xs font-bold text-purple-900 uppercase">Total Earned This Month</h4>
              <div className="text-3xl font-black text-purple-700 mt-2">₹{incentives.total_earned_month || 1250}</div>
            </div>
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200">
              <h4 className="text-xs font-bold text-amber-900 uppercase">Pending Disbursal (DBT)</h4>
              <div className="text-3xl font-black text-amber-700 mt-2">₹{incentives.pending_disbursal || 450}</div>
            </div>
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200">
              <h4 className="text-xs font-bold text-emerald-900 uppercase">Disbursed to Bank</h4>
              <div className="text-3xl font-black text-emerald-700 mt-2">₹{incentives.disbursed_total || 800}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
