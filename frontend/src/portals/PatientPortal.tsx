import React, { useState, useEffect } from 'react';
import { Language, Patient, TriageRecord, Facility, Referral } from '../types';
import { translations } from '../i18n/translations';
import { api } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import { 
  Heart, 
  Activity, 
  Thermometer, 
  Wind, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Phone, 
  MapPin, 
  Mic, 
  MicOff, 
  UserPlus, 
  FileText, 
  ShieldAlert, 
  Send, 
  ArrowRight,
  Stethoscope,
  HeartHandshake,
  Pill,
  Sparkles
} from 'lucide-react';

interface PatientPortalProps {
  language: Language;
  openSOS: () => void;
  openAbha: (p: Patient) => void;
  gpsLocation: {
    lat: number;
    lng: number;
    accuracy: number | null;
    villageName: string;
    calculateDistanceKm: (lat: number, lng: number) => number;
  };
  isOffline: boolean;
}

export const PatientPortal: React.FC<PatientPortalProps> = ({
  language,
  openSOS,
  openAbha,
  gpsLocation,
  isOffline
}) => {
  const t = translations[language];
  const { isListening, transcript, startListening, stopListening } = useSpeech(language);

  // Active section tab
  const [activeTab, setActiveTab] = useState<'health_check' | 'register' | 'nearby_phc' | 'requests' | 'referrals'>('health_check');

  // Patient Registration Form State (DO NOT PREFILL)
  const [regForm, setRegForm] = useState<Patient>({
    name: '',
    age: 0,
    gender: 'Male',
    phone: '',
    village: 'Kharpudi',
    wadi: 'Gavthan'
  });
  const [registeredPatient, setRegisteredPatient] = useState<Patient | null>(null);

  // Vitals & Symptoms Form State
  const [systolicBp, setSystolicBp] = useState<string>('120');
  const [diastolicBp, setDiastolicBp] = useState<string>('80');
  const [spo2, setSpo2] = useState<string>('98');
  const [pulseRate, setPulseRate] = useState<string>('76');
  const [temperature, setTemperature] = useState<string>('98.4');
  const [durationDays, setDurationDays] = useState<number>(1);
  const [symptoms, setSymptoms] = useState<string>('');
  const [isMaternalHighRisk, setIsMaternalHighRisk] = useState<boolean>(false);
  const [maternalNote, setMaternalNote] = useState<string>('');

  // Triage Result State
  const [triageLoading, setTriageLoading] = useState<boolean>(false);
  const [triageResult, setTriageResult] = useState<any | null>(null);

  // Facilities & Referrals
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);

  // Load facilities and referrals on mount
  useEffect(() => {
    api.getFacilities(gpsLocation.lat, gpsLocation.lng).then(setFacilities);
    api.getReferrals().then(setReferrals);
  }, [gpsLocation]);

  // Sync voice transcript to symptoms input
  useEffect(() => {
    if (transcript) {
      setSymptoms(prev => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, [transcript]);

  // Quick symptom chips (monolingual per language)
  const symptomChips = language === 'mr' ? [
    { label: 'ताप', value: 'तीव्र ताप व हुडहुडी' },
    { label: 'खोकला', value: 'सतत कोरडा खोकला' },
    { label: 'छातीत दुखणे', value: 'छातीत जडपणा व दुखणे' },
    { label: 'श्वास घेण्यास त्रास', value: 'श्वास घेण्यास धाप लागणे' },
    { label: 'तीव्र डोकेदुखी', value: 'तीव्र डोकेदुखी व चक्कर' },
    { label: 'उलटी / जुलाब', value: 'उलटी व अशक्तपणा' },
  ] : language === 'hi' ? [
    { label: 'बुखार', value: 'तेज बुखार और ठंड' },
    { label: 'खांसी', value: 'लगातार सूखी खांसी' },
    { label: 'सीने में दर्द', value: 'सीने में भारीपन और दर्द' },
    { label: 'सांस फूलना', value: 'सांस लेने में तकलीफ' },
    { label: 'तेज सिरदर्द', value: 'सिरदर्द और चक्कर आना' },
    { label: 'उल्टी / दस्त', value: 'उल्टी और कमजोरी' },
  ] : [
    { label: 'Fever', value: 'High fever with chills' },
    { label: 'Cough', value: 'Continuous dry cough' },
    { label: 'Chest Pain', value: 'Severe chest heaviness' },
    { label: 'Shortness of Breath', value: 'Breathlessness on exertion' },
    { label: 'Severe Headache', value: 'Persistent sharp headache' },
    { label: 'Vomiting / Diarrhea', value: 'Persistent vomiting & dehydration' },
  ];

  const handleSymptomChipClick = (val: string) => {
    if (symptoms.includes(val)) {
      setSymptoms(symptoms.replace(val, '').trim());
    } else {
      setSymptoms(symptoms ? `${symptoms}, ${val}` : val);
    }
  };

  // Run Triage
  const handleRunTriage = async () => {
    setTriageLoading(true);
    try {
      const defaultName = language === 'mr' ? 'रुग्ण (तपासणी)' : language === 'hi' ? 'मरीज (जांच)' : 'Patient (Checkup)';
      const payload = {
        patient_name: registeredPatient?.name || defaultName,
        age: registeredPatient?.age || 35,
        gender: registeredPatient?.gender || 'Male',
        phone: registeredPatient?.phone || '9800000000',
        village: registeredPatient?.village || 'Kharpudi',
        vitals: {
          systolic_bp: systolicBp ? parseFloat(systolicBp) : undefined,
          diastolic_bp: diastolicBp ? parseFloat(diastolicBp) : undefined,
          spo2: spo2 ? parseFloat(spo2) : undefined,
          pulse_rate: pulseRate ? parseFloat(pulseRate) : undefined,
          temperature: temperature ? parseFloat(temperature) : undefined,
          symptom_duration_days: durationDays,
          symptoms: symptoms,
          high_risk_maternal: isMaternalHighRisk,
          maternal_note: maternalNote
        },
        source: isOffline ? 'ASHA_Offline' : 'Patient'
      };

      const result = await api.evaluateTriage(payload, isOffline);
      setTriageResult(result);
    } catch (err) {
      console.error('Triage error:', err);
    } finally {
      setTriageLoading(false);
    }
  };

  // Handle Patient Registration
  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.name || !regForm.phone) {
      const alertMsg = language === 'mr' 
        ? "कृपया नाव व फोन नंबर भरा." 
        : language === 'hi' 
        ? "कृपया नाम और फोन नंबर भरें।" 
        : "Please enter Full Name and Mobile Number.";
      alert(alertMsg);
      return;
    }
    const newPat = { 
      ...regForm, 
      id: Date.now(), 
      abha_id: `14-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${regForm.phone.slice(-4)}` 
    };
    setRegisteredPatient(newPat);

    const successMsg = language === 'mr'
      ? `नोंदणी यशस्वी! आभा क्रमांक (ABHA ID): ${newPat.abha_id}`
      : language === 'hi'
      ? `पंजीकरण सफल! आभा संख्या (ABHA ID): ${newPat.abha_id}`
      : `Registration successful! ABHA Number: ${newPat.abha_id}`;
    alert(successMsg);
    setActiveTab('health_check');
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner / Quick Action Bar */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 rounded-3xl text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{t.app_title}</span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
            {t.quick_health_check}
          </h2>
          <p className="text-teal-100 text-sm sm:text-base font-medium mt-2">
            {t.hero_desc}
          </p>

          {/* Quick Shortcuts */}
          <div className="flex flex-wrap gap-2.5 mt-5">
            <button
              onClick={() => setActiveTab('health_check')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center space-x-2 transition-all ${
                activeTab === 'health_check' ? 'bg-white text-teal-900 shadow-md' : 'bg-teal-900/60 text-white hover:bg-teal-900'
              }`}
            >
              <Activity className="w-4 h-4 text-teal-600" />
              <span>{t.quick_health_check}</span>
            </button>

            <button
              onClick={() => setActiveTab('nearby_phc')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center space-x-2 transition-all ${
                activeTab === 'nearby_phc' ? 'bg-white text-teal-900 shadow-md' : 'bg-teal-900/60 text-white hover:bg-teal-900'
              }`}
            >
              <MapPin className="w-4 h-4 text-red-400" />
              <span>{t.find_phc}</span>
            </button>

            <button
              onClick={() => setActiveTab('register')}
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center space-x-2 transition-all ${
                activeTab === 'register' ? 'bg-white text-teal-900 shadow-md' : 'bg-teal-900/60 text-white hover:bg-teal-900'
              }`}
            >
              <UserPlus className="w-4 h-4 text-amber-300" />
              <span>{registeredPatient ? `${t.name}: ${registeredPatient.name}` : t.register_patient}</span>
            </button>

            {registeredPatient && (
              <button
                onClick={() => openAbha(registeredPatient)}
                className="px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold bg-amber-400 text-slate-950 hover:bg-amber-300 flex items-center space-x-2 shadow-md transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>{t.abha_card}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- 1. HEALTH CHECK & AI TRIAGE TAB ---------------- */}
      {activeTab === 'health_check' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Vitals Form Column */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                    ❤️
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{t.vitals_title}</h3>
                    <p className="text-xs text-slate-500 font-medium">{t.app_subtitle}</p>
                  </div>
                </div>

                {/* Test Presets for Evaluators */}
                <div className="flex items-center space-x-1.5 text-xs">
                  <span className="text-slate-400 hidden sm:inline mr-1 font-medium">{t.demo_presets}</span>
                  <button
                    onClick={() => {
                      setSystolicBp('165');
                      setDiastolicBp('104');
                      setSpo2('89');
                      setTemperature('99.0');
                      setDurationDays(2);
                      setSymptoms(language === 'mr' ? 'तीव्र डोकेदुखी व धाप लागणे' : language === 'hi' ? 'तेज सिरदर्द और सांस फूलना' : 'Severe headache with breathlessness and chest heaviness');
                      setIsMaternalHighRisk(false);
                    }}
                    className="px-2.5 py-1 bg-red-100 text-red-800 rounded-lg font-bold hover:bg-red-200 text-[11px]"
                  >
                    {t.preset_p1}
                  </button>
                  <button
                    onClick={() => {
                      setSystolicBp('122');
                      setDiastolicBp('78');
                      setSpo2('97');
                      setTemperature('102.8');
                      setDurationDays(4);
                      setSymptoms(language === 'mr' ? '४ दिवसांपासून तीव्र ताप' : language === 'hi' ? '4 दिनों से तेज बुखार' : 'High grade fever for 4 days with body chills');
                      setIsMaternalHighRisk(false);
                    }}
                    className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg font-bold hover:bg-amber-200 text-[11px]"
                  >
                    {t.preset_p2}
                  </button>
                  <button
                    onClick={() => {
                      setSystolicBp('120');
                      setDiastolicBp('80');
                      setSpo2('98');
                      setTemperature('98.4');
                      setDurationDays(1);
                      setSymptoms(language === 'mr' ? 'अंगदुखी, नियमित तपासणी' : language === 'hi' ? 'हल्का बदन दर्द, नियमित जांच' : 'Mild body ache, routine checkup');
                      setIsMaternalHighRisk(false);
                    }}
                    className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold hover:bg-emerald-200 text-[11px]"
                  >
                    {t.preset_p3}
                  </button>
                </div>
              </div>

              {/* Large Touch Numeric Inputs for Vitals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Systolic BP */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.bp_sys}</label>
                    <span className="text-[11px] font-bold text-slate-400">&ge; 160: P1</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={systolicBp}
                      onChange={(e) => setSystolicBp(e.target.value)}
                      className="w-full text-2xl font-black text-slate-900 bg-white p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-center"
                      placeholder="120"
                    />
                    <span className="text-xs font-bold text-slate-500">mmHg</span>
                  </div>
                </div>

                {/* SpO2 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.spo2}</label>
                    <span className="text-[11px] font-bold text-slate-400">&le; 90%: P1</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={spo2}
                      onChange={(e) => setSpo2(e.target.value)}
                      className="w-full text-2xl font-black text-slate-900 bg-white p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-center"
                      placeholder="98"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                </div>

                {/* Temperature */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.temp}</label>
                    <span className="text-[11px] font-bold text-slate-400">&ge; 102°F: P2</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => setTemperature(e.target.value)}
                      className="w-full text-2xl font-black text-slate-900 bg-white p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-center"
                      placeholder="98.6"
                    />
                    <span className="text-xs font-bold text-slate-500">°F</span>
                  </div>
                </div>

                {/* Symptom Duration */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">{t.duration_days}</label>
                    <span className="text-[11px] font-bold text-slate-400">&gt; 3: P2</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={durationDays}
                      onChange={(e) => setDurationDays(parseInt(e.target.value) || 1)}
                      className="w-full text-2xl font-black text-slate-900 bg-white p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-center"
                      placeholder="1"
                    />
                    <span className="text-xs font-bold text-slate-500">
                      {language === 'mr' ? 'दिवस' : language === 'hi' ? 'दिन' : 'Days'}
                    </span>
                  </div>
                </div>
              </div>

              {/* High Risk Maternal Alert Checkbox */}
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isMaternalHighRisk}
                    onChange={(e) => setIsMaternalHighRisk(e.target.checked)}
                    className="w-6 h-6 mt-0.5 rounded-lg text-rose-600 focus:ring-rose-500 border-rose-300"
                  />
                  <div>
                    <span className="text-sm font-extrabold text-rose-950 block">
                      {t.maternal_alert}
                    </span>
                    <p className="text-xs text-rose-800 font-medium mt-0.5">
                      {t.maternal_hint}
                    </p>
                  </div>
                </label>
              </div>

              {/* Symptoms Input with Voice Support & Quick Chips */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-800">{t.symptoms_label}:</label>
                  
                  {/* Web Speech Voice Dictation Button */}
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm ${
                      isListening
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                    }`}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isListening ? t.listening : t.voice_input}</span>
                  </button>
                </div>

                {/* Quick Tap Symptom Chips */}
                <div className="flex flex-wrap gap-2">
                  {symptomChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSymptomChipClick(chip.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        symptoms.includes(chip.value)
                          ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>

                {/* Textarea for symptoms */}
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  rows={3}
                  className="w-full p-3.5 rounded-2xl border border-slate-300 focus:ring-2 focus:ring-teal-500 text-sm font-medium text-slate-900 outline-none"
                  placeholder={language === 'mr' ? 'लक्षणे नमूद करा किंवा वरील बटणे वापरा...' : language === 'hi' ? 'लक्षण दर्ज करें या ऊपर दिए गए विकल्प चुनें...' : 'Describe symptoms or select quick chips above...'}
                />
              </div>

              {/* Submit Triage Button */}
              <button
                onClick={handleRunTriage}
                disabled={triageLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-98 text-white font-black text-lg shadow-lg shadow-teal-600/30 flex items-center justify-center space-x-3 transition-all"
              >
                {triageLoading ? (
                  <span>{language === 'mr' ? 'AI तपासणी सुरू आहे...' : language === 'hi' ? 'AI जांच जारी है...' : 'Evaluating with Clinical AI...'}</span>
                ) : (
                  <>
                    <Activity className="w-6 h-6" />
                    <span>{t.calculate_triage}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Triage Result Display Column */}
          <div className="space-y-6">
            {triageResult ? (
              <div className={`rounded-3xl p-6 shadow-xl border-4 text-white animate-scaleUp ${
                triageResult.priority === 'P1'
                  ? 'bg-gradient-to-br from-red-600 to-rose-700 border-red-500'
                  : triageResult.priority === 'P2'
                  ? 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400'
                  : 'bg-gradient-to-br from-emerald-600 to-teal-700 border-emerald-500'
              }`}>
                {/* Result Title */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full">
                    {t.triage_result_title}
                  </span>
                  <span className="text-xs font-extrabold bg-white/20 px-2.5 py-0.5 rounded-full">
                    {t.confidence}: {(triageResult.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Big Priority Headline */}
                <div className="my-4">
                  <h3 className="text-3xl font-black tracking-tight">
                    {triageResult.priority === 'P1'
                      ? t.p1_title
                      : triageResult.priority === 'P2'
                      ? t.p2_title
                      : t.p3_title}
                  </h3>
                  <p className="text-sm font-semibold text-white/90 mt-1">
                    {triageResult.triage_reason}
                  </p>
                </div>

                {/* Mandatory Disclaimer Badge */}
                <div className="bg-black/30 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 my-4">
                  <div className="flex items-center space-x-2 text-amber-300 text-xs font-extrabold mb-1">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                    <span>
                      {language === 'mr' ? 'डॉक्टर पडताळणी आवश्यक' : language === 'hi' ? 'डॉक्टर सत्यापन आवश्यक' : 'Doctor Verification Required'}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/80 leading-relaxed">
                    {t.verification_warning}
                  </p>
                </div>

                {/* Recommended Action */}
                <div className="p-3 bg-white/10 rounded-xl text-xs font-medium mb-5">
                  <strong className="block text-white font-bold mb-0.5">{t.next_steps}</strong>
                  <span>{triageResult.recommended_action}</span>
                </div>

                {/* Direct Action Buttons based on Priority */}
                <div className="space-y-2.5">
                  {triageResult.priority === 'P1' && (
                    <button
                      onClick={openSOS}
                      className="w-full py-3.5 bg-white text-red-700 hover:bg-red-50 rounded-2xl font-black text-sm shadow-md flex items-center justify-center space-x-2 active:scale-95 transition-all"
                    >
                      <Phone className="w-5 h-5 animate-bounce" />
                      <span>{t.call_ambulance_btn}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setActiveTab('nearby_phc')}
                    className="w-full py-3 bg-black/30 hover:bg-black/40 text-white rounded-2xl font-bold text-xs flex items-center justify-center space-x-2 transition-all"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>{t.nearest_hospital_btn}</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Placeholder before running triage */
              <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-teal-50 border-2 border-teal-200 flex items-center justify-center mx-auto text-3xl text-teal-600">
                  🩺
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    {t.quick_health_check}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                    {language === 'mr' 
                      ? 'डाव्या बाजूला लक्षणे व शारीरिक तपासणी भरा आणि चाचणी निकाल तपासा.'
                      : language === 'hi'
                      ? 'बाईं ओर लक्षण और शारीरिक जांच भरें और परिणाम जांचें।'
                      : 'Record vitals and symptoms on the left to evaluate triage priority.'}
                  </p>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-[11px] text-slate-600 text-left space-y-1">
                  <p className="font-bold text-slate-800">
                    {language === 'mr' ? 'नियम निकष:' : language === 'hi' ? 'वर्गीकरण नियम:' : 'Clinical Criteria:'}
                  </p>
                  <p>• <strong>P1 Critical:</strong> BP &ge; 160 | SpO2 &le; 90% | High-Risk Maternal</p>
                  <p>• <strong>P2 Urgent:</strong> Temp &ge; 102°F | Symptoms &gt; 3 Days</p>
                  <p>• <strong>P3 Routine:</strong> Normal baseline vitals</p>
                </div>
              </div>
            )}

            {/* ASHA Home Visit / Medicine Quick Card */}
            <div className="bg-purple-50 rounded-3xl p-6 border border-purple-200 space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-bold">
                  👩‍⚕️
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-purple-950">
                    {t.contact_asha}
                  </h4>
                  <p className="text-xs text-purple-700">{t.asha_name}</p>
                </div>
              </div>
              <p className="text-xs text-purple-900 font-medium">
                {language === 'mr' 
                  ? 'औषधे घरपोच मागवण्यासाठी किंवा आशा सेविकेला घरी बोलावण्यासाठी विनंती पाठवा.' 
                  : language === 'hi' 
                  ? 'दवाएं घर पर मंगवाने या आशा दीदी को घर पर बुलाने के लिए अनुरोध भेजें।' 
                  : 'Request medicines delivered at home or request an ASHA worker home visit.'}
              </p>
              <button
                onClick={() => {
                  const reqMsg = language === 'mr' 
                    ? "आशा सेविकेला गृहभेटीचा संदेश पाठवला आहे!" 
                    : language === 'hi' 
                    ? "आशा दीदी को गृह भेंट का संदेश भेजा गया है!" 
                    : "ASHA home visit request sent successfully!";
                  alert(reqMsg);
                }}
                className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all"
              >
                {language === 'mr' ? 'आशा सेविकेला घरी बोलवा' : language === 'hi' ? 'आशा दीदी को घर पर बुलाएं' : 'Request Home Visit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 2. PATIENT REGISTRATION TAB ---------------- */}
      {activeTab === 'register' && (
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">{t.register_patient}</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {language === 'mr' ? 'नवीन रुग्णांचे तपशील भरा' : language === 'hi' ? 'नए मरीज का विवरण भरें' : 'Enter patient details to generate ABHA card'}
            </p>
          </div>

          <form onSubmit={handleRegisterPatient} className="space-y-4 text-xs font-bold">
            <div>
              <label className="text-slate-700 block mb-1">{t.name} *</label>
              <input
                type="text"
                required
                value={regForm.name}
                onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
                className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder={language === 'mr' ? 'उदा. सविता ताई जाधव' : language === 'hi' ? 'उदा. सविता जाधव' : 'e.g. Savita Jadhav'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-700 block mb-1">{t.age} *</label>
                <input
                  type="number"
                  required
                  value={regForm.age || ''}
                  onChange={(e) => setRegForm({ ...regForm, age: parseInt(e.target.value) || 0 })}
                  className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="28"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">{t.gender} *</label>
                <select
                  value={regForm.gender}
                  onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                  className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value="Female">{t.female}</option>
                  <option value="Male">{t.male}</option>
                  <option value="Other">{t.other}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-slate-700 block mb-1">{t.phone} *</label>
              <input
                type="tel"
                required
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="9822XXXXXX"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-700 block mb-1">{t.village}</label>
                <input
                  type="text"
                  value={regForm.village}
                  onChange={(e) => setRegForm({ ...regForm, village: e.target.value })}
                  className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Kharpudi"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">
                  {language === 'mr' ? 'वाडी / वस्ती' : language === 'hi' ? 'बस्ती / क्षेत्र' : 'Wadi / Area'}
                </label>
                <input
                  type="text"
                  value={regForm.wadi}
                  onChange={(e) => setRegForm({ ...regForm, wadi: e.target.value })}
                  className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Gavthan"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-2xl font-black text-base shadow-lg shadow-teal-600/30 transition-all mt-4"
            >
              {language === 'mr' 
                ? 'नोंदणी करा व आभा कार्ड मिळवा' 
                : language === 'hi' 
                ? 'पंजीकरण करें और आभा कार्ड प्राप्त करें' 
                : 'Register & Generate ABHA Card'}
            </button>
          </form>
        </div>
      )}

      {/* ---------------- 3. NEARBY PHC & GEOLOCATION TAB ---------------- */}
      {activeTab === 'nearby_phc' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-2">
              <div>
                <h3 className="text-xl font-black text-slate-900">{t.phc_list_title}</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {t.phc_subtitle}
                </p>
              </div>

              <div className="flex items-center space-x-1 bg-emerald-50 text-emerald-800 text-xs font-extrabold px-3 py-1.5 rounded-xl border border-emerald-200">
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>GPS: {gpsLocation.villageName}</span>
              </div>
            </div>

            {/* Facility Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {facilities.map((fac) => {
                const distance = gpsLocation.calculateDistanceKm(fac.coordinates.lat, fac.coordinates.lng);
                return (
                  <div
                    key={fac.id}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="bg-teal-100 text-teal-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                          {fac.type}
                        </span>
                        <h4 className="text-base font-extrabold text-slate-900 mt-1">
                          {fac.name}
                        </h4>
                      </div>
                      <span className="text-sm font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200 font-mono">
                        {distance} km
                      </span>
                    </div>

                    <div className="text-xs text-slate-600 space-y-1">
                      <p>
                        👨‍⚕️ <strong>{language === 'mr' ? 'वैद्यकीय प्रमुख:' : language === 'hi' ? 'चिकित्सा प्रभारी:' : 'Officer in Charge:'}</strong> {fac.doctor}
                      </p>
                      <p>
                        🟢 <strong>{t.status}:</strong> {fac.status}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      <a
                        href={`tel:${fac.phone}`}
                        className="flex items-center justify-center space-x-1.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{t.call_now}</span>
                      </a>
                      <a
                        href={`https://www.google.com/maps?q=${fac.coordinates.lat},${fac.coordinates.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center space-x-1.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{t.get_directions}</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
