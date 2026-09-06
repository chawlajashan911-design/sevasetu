import React, { useState, useEffect } from 'react';
import { Language, TriageRecord, AshaIncentiveActivity } from '../types';
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
  UserCheck
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

  // Form State for ASHA Screening
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState<number>(30);
  const [gender, setGender] = useState('Female');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('Kharpudi');
  const [wadi, setWadi] = useState('Wadarwadi');
  
  // Vitals
  const [systolicBp, setSystolicBp] = useState('130');
  const [diastolicBp, setDiastolicBp] = useState('85');
  const [spo2, setSpo2] = useState('97');
  const [temperature, setTemperature] = useState('98.6');
  const [durationDays, setDurationDays] = useState(1);
  const [symptoms, setSymptoms] = useState('');
  const [isMaternal, setIsMaternal] = useState(false);
  const [maternalNote, setMaternalNote] = useState('');

  // Referral Modal / Form State
  const [referralPatient, setReferralPatient] = useState('');
  const [referralTarget, setReferralTarget] = useState('Kharpudi PHC');
  const [referralReason, setReferralReason] = useState('');
  const [referralPriority, setReferralPriority] = useState<'P1' | 'P2' | 'P3'>('P1');

  // Offline Records and Incentives
  const [offlineRecords, setOfflineRecords] = useState<TriageRecord[]>([]);
  const [incentives, setIncentives] = useState<any>({
    total_earned_month: 950,
    pending_disbursal: 450,
    disbursed_total: 500,
    recent_activities: []
  });
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  // Update symptoms from voice
  useEffect(() => {
    if (transcript) {
      setSymptoms(prev => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, [transcript]);

  // Load offline records from Dexie and incentives from API
  const refreshRecords = async () => {
    const records = await db.triageRecords.toArray();
    setOfflineRecords(records);
    const count = await getPendingSyncCount();
    setPendingSyncCount(count);
    api.getAshaIncentives().then(setIncentives);
  };

  useEffect(() => {
    refreshRecords();
  }, []);

  // Save Screening (works online and offline via Dexie)
  const handleSaveScreening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !phone) {
      const alertMsg = language === 'mr' 
        ? "कृपया रुग्णाचे नाव आणि फोन नंबर भरा." 
        : language === 'hi' 
        ? "कृपया मरीज का नाम और फोन नंबर भरें।" 
        : "Please enter Patient Name and Phone Number.";
      alert(alertMsg);
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

      // Trigger confetti celebration on successful save
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });

      const savedMsg = isOffline
        ? (language === 'mr' 
            ? `[ऑफलाइन सेव्ह झाले] तपासणी स्थानिक नोंदवहीत सेव्ह झाली. निकाल: ${result.priority} (${result.triage_label}). इंटरनेट सुरू झाल्यावर सिंक करा.`
            : language === 'hi'
            ? `[ऑफलाइन सुरक्षित] जांच स्थानीय रजिस्टर में सुरक्षित हुई। परिणाम: ${result.priority} (${result.triage_label})। इंटरनेट आने पर सिंक करें।`
            : `[Saved Offline] Screening saved locally in Dexie. Result: ${result.priority} (${result.triage_label}). Sync to server when online.`)
        : (language === 'mr'
            ? `[सर्व्हरवर सेव्ह झाले] तपासणी यशस्वी! AI निकाल: ${result.priority} (${result.triage_label})`
            : language === 'hi'
            ? `[सर्वर पर सुरक्षित] जांच सफल! AI परिणाम: ${result.priority} (${result.triage_label})`
            : `[Saved to Server] Screening successful! AI Triage Result: ${result.priority} (${result.triage_label})`);

      alert(savedMsg);

      // Reset form
      setPatientName('');
      setPhone('');
      setSymptoms('');
      setIsMaternal(false);

      await refreshRecords();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Sync Offline Records Now
  const handleSyncNow = async () => {
    if (isOffline) {
      const offAlert = language === 'mr'
        ? "इंटरनेट बंद आहे. कृपया सिंक करण्यासाठी वरील स्विच ऑन करा."
        : language === 'hi'
        ? "इंटरनेट बंद है। कृपया सिंक करने के लिए ऑनलाइन मोड चालू करें।"
        : "System is in Offline Mode. Switch to Online Mode to synchronize.";
      alert(offAlert);
      return;
    }

    const startSyncMsg = language === 'mr'
      ? "सिंक सुरू आहे (सर्व नोंदी मुख्य सर्व्हरला पाठवत आहे)..."
      : language === 'hi'
      ? "सिंक जारी है (सभी रिकॉर्ड मुख्य सर्वर को भेजे जा रहे हैं)..."
      : "Synchronizing offline records with central PHC server...";
    setSyncStatus(startSyncMsg);

    try {
      const pendingItems = await db.offlineQueue.where('status').equals('PENDING').toArray();
      if (pendingItems.length === 0) {
        const noPendingMsg = language === 'mr'
          ? "सर्व नोंदी आधीच सिंक झालेल्या आहेत."
          : language === 'hi'
          ? "सभी रिकॉर्ड पहले से सिंक हैं।"
          : "All records are already synchronized.";
        setSyncStatus(noPendingMsg);
        setTimeout(() => setSyncStatus(null), 3000);
        return;
      }

      const recordsToSync = pendingItems.map(item => item.payload);
      const res = await api.syncBatch(recordsToSync);

      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });

      const syncDoneMsg = language === 'mr'
        ? `यशस्वी! ${res.synced_count} नोंदी सर्व्हरवर सिंक झाल्या. मानधन जमा: ₹${res.incentives_credited_inr}`
        : language === 'hi'
        ? `सफल! ${res.synced_count} रिकॉर्ड सर्वर पर सिंक हुए। प्रोत्साहन राशि: ₹${res.incentives_credited_inr}`
        : `Success! Synchronized ${res.synced_count} records to server. Incentive credited: ₹${res.incentives_credited_inr}`;
      setSyncStatus(syncDoneMsg);

      await refreshRecords();
      setTimeout(() => setSyncStatus(null), 5000);
    } catch (err: any) {
      setSyncStatus("Sync error: " + err.message);
    }
  };

  // Create Referral
  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralPatient) {
      alert(language === 'mr' ? "कृपया रुग्णाचे नाव टाका." : language === 'hi' ? "कृपया मरीज का नाम भरें।" : "Please enter patient name.");
      return;
    }

    await api.createReferral({
      patient_name: referralPatient,
      age: 28,
      priority: referralPriority,
      source_facility: "Kharpudi Sub-Centre",
      target_facility: referralTarget,
      urgency: referralPriority === 'P1' ? 'Immediate' : 'Routine',
      reason: referralReason || "Referred for specialist medical examination",
      transport_mode: referralPriority === 'P1' ? '108 Ambulance' : 'Transport Van / Auto'
    });

    const refAlert = language === 'mr'
      ? `रेफरल नोंदवले गेले: ${referralPatient} -> ${referralTarget}`
      : language === 'hi'
      ? `रेफरल दर्ज हुआ: ${referralPatient} -> ${referralTarget}`
      : `Referral submitted: ${referralPatient} -> ${referralTarget}`;
    alert(refAlert);
    setReferralPatient('');
    setReferralReason('');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner with ASHA Profile & Sync Action */}
      <div className="bg-gradient-to-r from-purple-800 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-600 border-2 border-purple-400 flex items-center justify-center text-3xl shadow-lg">
              👩‍⚕️
            </div>
            <div>
              <span className="bg-purple-500/30 text-purple-200 text-xs font-black uppercase px-2.5 py-0.5 rounded-full border border-purple-400/40">
                {language === 'mr' ? 'आशा कार्यकर्ता डिजिटल डेस्क' : language === 'hi' ? 'आशा कार्यकर्ता डिजिटल डेस्क' : 'ASHA FIELD DESK'}
              </span>
              <h2 className="text-xl sm:text-3xl font-black mt-1">
                {t.asha_name}
              </h2>
              <p className="text-xs text-purple-300 font-medium">
                {t.asha_area}
              </p>
            </div>
          </div>

          {/* Sync Button & Status */}
          <div className="flex items-center space-x-3 bg-white/10 backdrop-blur-md p-2 rounded-2xl border border-white/20">
            <div className="px-3">
              <span className="text-[10px] text-purple-200 uppercase font-bold block">{t.pending_sync}:</span>
              <p className="text-xl font-black text-amber-300 font-mono">
                {pendingSyncCount} {language === 'mr' ? 'नोंदी' : language === 'hi' ? 'रिकॉर्ड' : 'Records'}
              </p>
            </div>

            <button
              onClick={handleSyncNow}
              disabled={pendingSyncCount === 0}
              className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-extrabold text-xs shadow-md transition-all ${
                pendingSyncCount > 0
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 active:scale-95 animate-pulse'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${pendingSyncCount > 0 ? 'animate-spin' : ''}`} />
              <span>{t.sync_now}</span>
            </button>
          </div>
        </div>

        {syncStatus && (
          <div className="mt-4 p-3 bg-emerald-500/20 border border-emerald-400/50 rounded-xl text-emerald-200 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{syncStatus}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Form & Offline Records + Incentive Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Screening Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div className="flex items-center space-x-2">
                <PlusCircle className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-black text-slate-900">{t.record_screening}</h3>
              </div>

              {/* Mode indicator */}
              <div className="flex items-center space-x-2">
                {isOffline ? (
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-xs font-extrabold px-3 py-1 rounded-full flex items-center space-x-1">
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                    <span>{language === 'mr' ? 'स्थानिक मेमरीमध्ये सेव्ह होईल' : language === 'hi' ? 'स्थानीय मेमोरी में सुरक्षित होगा' : 'Local Offline Storage'}</span>
                  </span>
                ) : (
                  <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-extrabold px-3 py-1 rounded-full flex items-center space-x-1">
                    <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{language === 'mr' ? 'सर्व्हर कनेक्टेड' : language === 'hi' ? 'सर्वर कनेक्टेड' : 'Central Server Connected'}</span>
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleSaveScreening} className="space-y-4">
              {/* Patient Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{t.name} *</label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder={language === 'mr' ? 'उदा. मंदाकिनी थोरात' : language === 'hi' ? 'उदा. मंदाकिनी थोरात' : 'e.g. Mandakini Thorat'}
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{t.age} & {t.gender} *</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={age}
                      onChange={(e) => setAge(parseInt(e.target.value) || 0)}
                      className="w-20 p-3 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none text-center"
                      placeholder="वय"
                    />
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="flex-1 p-3 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="Female">{t.female}</option>
                      <option value="Male">{t.male}</option>
                      <option value="Other">{t.other}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">{t.phone} *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                    placeholder="9822XXXXXX"
                  />
                </div>
              </div>

              {/* Vitals Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t.bp_sys}</label>
                  <input
                    type="number"
                    value={systolicBp}
                    onChange={(e) => setSystolicBp(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-center"
                    placeholder="120"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t.bp_dia}</label>
                  <input
                    type="number"
                    value={diastolicBp}
                    onChange={(e) => setDiastolicBp(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-center"
                    placeholder="80"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t.spo2}</label>
                  <input
                    type="number"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-center"
                    placeholder="98"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">{t.temp}</label>
                  <input
                    type="number"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-sm font-bold text-center"
                    placeholder="98.6"
                  />
                </div>
              </div>

              {/* High Risk Maternal Alert */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMaternal}
                    onChange={(e) => setIsMaternal(e.target.checked)}
                    className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-purple-950">
                    {language === 'mr' 
                      ? 'गरोदर माता तपासणी (Antenatal High-Risk Check) — ₹३०० प्रोत्साहन भत्ता' 
                      : language === 'hi' 
                      ? 'गर्भवती महिला जांच (Antenatal Check) — ₹300 प्रोत्साहन राशि' 
                      : 'Antenatal High-Risk Screening — ₹300 Incentive'}
                  </span>
                </label>
              </div>

              {/* Symptoms with Voice */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">{t.symptoms_label}:</label>
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isListening ? t.listening : t.voice_input}</span>
                  </button>
                </div>
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  rows={2}
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-purple-500 outline-none"
                  placeholder={language === 'mr' ? 'उदा. ३ दिवसांपासून खोकला, ताप आणि अशक्तपणा...' : language === 'hi' ? 'उदा. 3 दिनों से खांसी, बुखार और कमजोरी...' : 'e.g. Cough, high fever, and body weakness for 3 days...'}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-purple-700 hover:bg-purple-800 active:scale-98 text-white rounded-2xl font-black text-sm shadow-md transition-all"
              >
                {t.save_screening_btn}
              </button>
            </form>
          </div>

          {/* Offline Local Records Table */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-base font-black text-slate-900 mb-4 flex items-center justify-between">
              <span>{language === 'mr' ? 'स्थानिक नोंदवही' : language === 'hi' ? 'स्थानीय रजिस्टर' : 'Field Register (Offline Records)'}:</span>
              <span className="text-xs font-bold text-slate-500">
                {offlineRecords.length} {language === 'mr' ? 'नोंदी' : language === 'hi' ? 'रिकॉर्ड' : 'Records'}
              </span>
            </h3>

            <div className="space-y-2">
              {offlineRecords.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  {language === 'mr' ? 'कोणतीही नोंद नाही.' : language === 'hi' ? 'कोई रिकॉर्ड नहीं है।' : 'No records yet.'}
                </p>
              ) : (
                offlineRecords.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900">{r.patient_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          r.priority === 'P1' ? 'bg-red-100 text-red-800' : r.priority === 'P2' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {r.priority}
                        </span>
                      </div>
                      <p className="text-slate-500 text-[11px] mt-0.5">{r.triage_reason}</p>
                    </div>

                    <div className="text-right">
                      {r.is_synced ? (
                        <span className="inline-flex items-center text-emerald-700 font-bold text-[11px]">
                          <Check className="w-3.5 h-3.5 mr-0.5" /> {t.synced_label}
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-amber-700 font-bold text-[11px]">
                          <Clock className="w-3.5 h-3.5 mr-0.5" /> {t.pending_label}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: ASHA Incentive Tracker & Quick Referral */}
        <div className="space-y-6">
          {/* Incentive Dashboard */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <Coins className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-black text-slate-900">{t.incentive_tracker}</h3>
            </div>

            {/* Total Earnings Card */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-md">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-100 block">
                {t.total_earned}
              </span>
              <p className="text-3xl font-black font-mono mt-1">
                ₹{incentives.total_earned_month || 950}
              </p>
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/20 text-xs">
                <div>
                  <span className="text-amber-100 text-[10px] block">{language === 'mr' ? 'मंजूर:' : language === 'hi' ? 'स्वीकृत:' : 'Approved:'}</span>
                  <strong className="font-mono">₹{incentives.pending_disbursal || 450}</strong>
                </div>
                <div>
                  <span className="text-amber-100 text-[10px] block">{language === 'mr' ? 'जमा:' : language === 'hi' ? 'जमा:' : 'Disbursed:'}</span>
                  <strong className="font-mono">₹{incentives.disbursed_total || 500}</strong>
                </div>
              </div>
            </div>

            {/* Incentive Slabs */}
            <div className="text-xs space-y-2 text-slate-700">
              <p className="font-bold text-slate-900">
                {language === 'mr' ? 'प्रोत्साहन भत्त्याचे दर:' : language === 'hi' ? 'प्रोत्साहन राशि दर:' : 'Incentive Slabs (NHM):'}
              </p>
              <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                <span>{language === 'mr' ? 'गरोदर माता तपासणी (P1):' : language === 'hi' ? 'गर्भवती जांच (P1):' : 'Antenatal Screening (P1):'}</span>
                <span className="font-bold text-purple-800">₹३००</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                <span>{language === 'mr' ? 'आपत्कालीन ट्रायज (P1/P2):' : language === 'hi' ? 'आपातकालीन जांच (P1/P2):' : 'Emergency Triage (P1/P2):'}</span>
                <span className="font-bold text-purple-800">₹१५०</span>
              </div>
              <div className="flex justify-between p-2 bg-slate-50 rounded-xl">
                <span>{language === 'mr' ? 'सामान्य आरोग्य तपासणी:' : language === 'hi' ? 'सामान्य स्वास्थ्य जांच:' : 'Routine Checkup:'}</span>
                <span className="font-bold text-purple-800">₹१००</span>
              </div>
            </div>
          </div>

          {/* Quick Referral Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <ArrowUpRight className="w-5 h-5 text-teal-600" />
              <h3 className="text-base font-black text-slate-900">{t.create_referral}</h3>
            </div>

            <form onSubmit={handleCreateReferral} className="space-y-3 text-xs font-bold">
              <div>
                <label className="text-slate-700 block mb-1">{t.name}:</label>
                <input
                  type="text"
                  required
                  value={referralPatient}
                  onChange={(e) => setReferralPatient(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold"
                  placeholder={language === 'mr' ? 'उदा. सविता ताई जाधव' : language === 'hi' ? 'उदा. सविता जाधव' : 'e.g. Savita Jadhav'}
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">
                  {language === 'mr' ? 'कुठे पाठवायचे:' : language === 'hi' ? 'कहां भेजना है:' : 'Target Facility:'}
                </label>
                <select
                  value={referralTarget}
                  onChange={(e) => setReferralTarget(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-semibold"
                >
                  <option value="Kharpudi PHC">{t.facility_phc}</option>
                  <option value="Manchar Rural Hospital">{t.facility_rh}</option>
                  <option value="Pune District Hospital">{t.facility_dh}</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">
                  {language === 'mr' ? 'प्राधान्य:' : language === 'hi' ? 'प्राथमिकता:' : 'Priority Level:'}
                </label>
                <div className="flex gap-2">
                  {(['P1', 'P2', 'P3'] as const).map(p => (
                    <button
                      type="button"
                      key={p}
                      onClick={() => setReferralPriority(p)}
                      className={`flex-1 py-1.5 rounded-xl font-black ${
                        referralPriority === p
                          ? (p === 'P1' ? 'bg-red-600 text-white' : p === 'P2' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white')
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">
                  {language === 'mr' ? 'रेफरलचे कारण:' : language === 'hi' ? 'रेफरल का कारण:' : 'Referral Reason:'}
                </label>
                <textarea
                  value={referralReason}
                  onChange={(e) => setReferralReason(e.target.value)}
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-slate-300 font-medium"
                  placeholder={language === 'mr' ? 'तपासणीसाठी...' : language === 'hi' ? 'जांच के लिए...' : 'Clinical reasoning for referral...'}
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold shadow-md transition-all"
              >
                {language === 'mr' ? 'रेफरल पाठवा' : language === 'hi' ? 'रेफरल भेजें' : 'Submit Referral'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
