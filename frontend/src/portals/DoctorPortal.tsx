import React, { useState, useEffect } from 'react';
import { Language, TriageRecord, PriorityLevel } from '../types';
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
  Send
} from 'lucide-react';

interface DoctorPortalProps {
  language: Language;
  openTeleconsult: (record: TriageRecord) => void;
}

export const DoctorPortal: React.FC<DoctorPortalProps> = ({
  language,
  openTeleconsult
}) => {
  const t = translations[language];
  const [queue, setQueue] = useState<TriageRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<TriageRecord | null>(null);
  const [activeFilter, setActiveFilter] = useState<'All' | 'P1' | 'P2' | 'P3'>('All');
  const [loading, setLoading] = useState<boolean>(true);

  // Verification Form State
  const [verifiedPriority, setVerifiedPriority] = useState<PriorityLevel>('P1');
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [prescription, setPrescription] = useState<string>('');
  const [doctorAction, setDoctorAction] = useState<'Verify' | 'Refer' | 'Complete'>('Verify');

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const records = await api.getDoctorQueue(activeFilter);
      setQueue(records);
      if (records.length > 0 && !selectedRecord) {
        setSelectedRecord(records[0]);
        setVerifiedPriority(records[0].priority);
      }
    } catch (e) {
      console.error('Queue fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [activeFilter]);

  useEffect(() => {
    if (selectedRecord) {
      setVerifiedPriority(selectedRecord.priority);
      setDoctorNotes(selectedRecord.doctor_notes || '');
      setPrescription(selectedRecord.prescription || 'Tab Paracetamol 500mg TDS x 3 days\nORS sachet in 1L water\nReview after 48 hours');
    }
  }, [selectedRecord]);

  const handleVerifyCase = async () => {
    if (!selectedRecord || !selectedRecord.id) return;
    try {
      await api.verifyDoctorTriage({
        triage_id: selectedRecord.id,
        doctor_name: "Dr. Anand Kulkarni (MO Kharpudi PHC)",
        verified_priority: verifiedPriority,
        doctor_notes: doctorNotes,
        prescription: prescription,
        action: doctorAction
      });

      const doneAlert = language === 'mr'
        ? `तपासणी पूर्ण झाली! केस #${selectedRecord.id} प्रमाणित करण्यात आली.`
        : language === 'hi'
        ? `जांच पूर्ण हुई! केस #${selectedRecord.id} सत्यापित किया गया।`
        : `Case #${selectedRecord.id} successfully verified and updated.`;
      alert(doneAlert);
      fetchQueue();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

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
                {language === 'mr' ? 'वैद्यकीय अधिकारी कक्ष' : language === 'hi' ? 'चिकित्सा अधिकारी कक्ष' : 'MEDICAL OFFICER DESK'}
              </span>
              <h2 className="text-xl sm:text-3xl font-black mt-1">
                {t.doctor_name_title}
              </h2>
              <p className="text-xs text-blue-300 font-medium">
                {language === 'mr' 
                  ? 'खरपुडी प्राथमिक आरोग्य केंद्र (२४x७ आपत्कालीन व टेलिकन्सल्टेशन)' 
                  : language === 'hi' 
                  ? 'खरपुडी प्राथमिक स्वास्थ्य केंद्र (24x7 आपातकालीन एवं टेलीपरामर्श)' 
                  : 'Kharpudi Primary Health Centre (24x7 Emergency & Tele-OPD)'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20">
            <Clock className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-bold text-slate-200">
              {language === 'mr' ? 'कतार:' : language === 'hi' ? 'कतार:' : 'Queue:'} <strong>{queue.length} {language === 'mr' ? 'रुग्ण' : language === 'hi' ? 'मरीज' : 'Patients'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column Queue, Right Column Patient Dossier & Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Priority Queue Tabs & List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">{t.triage_queue}</h3>
              <button
                onClick={fetchQueue}
                className="text-xs font-bold text-teal-700 hover:text-teal-900"
              >
                {language === 'mr' ? 'रिफ्रेश' : language === 'hi' ? 'रिफ्रेश' : 'Refresh'}
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl text-xs font-black">
              {(['All', 'P1', 'P2', 'P3'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`py-2 rounded-xl transition-all ${
                    activeFilter === filter
                      ? (filter === 'P1' ? 'bg-red-600 text-white' : filter === 'P2' ? 'bg-amber-500 text-white' : filter === 'P3' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white')
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter === 'All' ? (language === 'mr' ? 'सर्व' : language === 'hi' ? 'सभी' : 'All') : filter}
                </button>
              ))}
            </div>

            {/* Patients Queue List */}
            <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
              {loading ? (
                <p className="text-xs text-slate-400 text-center py-6">Loading queue...</p>
              ) : queue.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  {language === 'mr' ? 'या वर्गवारीत कोणतेही रुग्ण नाहीत.' : language === 'hi' ? 'इस श्रेणी में कोई मरीज नहीं है।' : 'No patients in this tier.'}
                </p>
              ) : (
                queue.map((record) => {
                  const isSelected = selectedRecord?.id === record.id;
                  return (
                    <div
                      key={record.id || record.local_id}
                      onClick={() => setSelectedRecord(record)}
                      className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/70 shadow-md ring-2 ring-blue-500/20'
                          : 'border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-sm text-slate-900">
                              {record.patient_name}
                            </span>
                            <span className="text-xs text-slate-500">
                              ({record.age} Y, {record.gender})
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 font-medium line-clamp-1">
                            {record.triage_reason}
                          </p>
                        </div>

                        {/* Priority Badge */}
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase ${
                          record.priority === 'P1'
                            ? 'bg-red-600 text-white animate-pulse'
                            : record.priority === 'P2'
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}>
                          {record.priority}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 pt-2 border-t border-slate-200/60">
                        <span>{t.village}: {record.village}</span>
                        <span>{record.doctor_verified ? `🟢 ${t.verified_badge}` : `🟡 ${t.unverified_badge}`}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Detailed Dossier, AI Confidence, Clinical Verification, Teleconsult */}
        <div className="lg:col-span-7 space-y-6">
          {selectedRecord ? (
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
              {/* Header with Name & Teleconsult Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-xl font-black text-slate-900">
                      {selectedRecord.patient_name}
                    </h3>
                    <span className="text-xs text-slate-500 font-bold">
                      #{selectedRecord.id || 'LIVE'} • {selectedRecord.age} {language === 'mr' ? 'वर्ष' : language === 'hi' ? 'वर्ष' : 'Yrs'}, {selectedRecord.gender}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {t.village}: <strong>{selectedRecord.village}</strong> • {t.phone}: {selectedRecord.phone || '9822XXXXXX'}
                  </p>
                </div>

                {/* Launch Teleconsultation Button */}
                <button
                  onClick={() => openTeleconsult(selectedRecord)}
                  className="flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-95 text-white rounded-2xl font-black text-xs shadow-md transition-all"
                >
                  <Video className="w-4 h-4" />
                  <span>{t.teleconsult_btn}</span>
                </button>
              </div>

              {/* Vitals Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{t.bp_sys}</span>
                  <strong className="text-base font-black text-slate-900">
                    {selectedRecord.vitals?.systolic_bp || 120}/{selectedRecord.vitals?.diastolic_bp || 80}
                  </strong>
                  <span className="text-[9px] text-slate-400 block">mmHg</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{t.spo2}</span>
                  <strong className={`text-base font-black ${
                    (selectedRecord.vitals?.spo2 || 98) <= 90 ? 'text-red-600' : 'text-slate-900'
                  }`}>
                    {selectedRecord.vitals?.spo2 || 98}%
                  </strong>
                  <span className="text-[9px] text-slate-400 block">Saturation</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{t.temp}</span>
                  <strong className={`text-base font-black ${
                    (selectedRecord.vitals?.temperature || 98.6) >= 102 ? 'text-amber-600' : 'text-slate-900'
                  }`}>
                    {selectedRecord.vitals?.temperature || 98.6}°F
                  </strong>
                  <span className="text-[9px] text-slate-400 block">Fahrenheit</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">{t.duration_days}</span>
                  <strong className="text-base font-black text-slate-900">
                    {selectedRecord.vitals?.symptom_duration_days || 1} {language === 'mr' ? 'दिवस' : language === 'hi' ? 'दिन' : 'Days'}
                  </strong>
                  <span className="text-[9px] text-slate-400 block">Duration</span>
                </div>
              </div>

              {/* AI Triage Rule Confidence & Triggers Banner */}
              <div className={`p-4 rounded-2xl border ${
                selectedRecord.priority === 'P1'
                  ? 'bg-red-50 border-red-200 text-red-950'
                  : selectedRecord.priority === 'P2'
                  ? 'bg-amber-50 border-amber-200 text-amber-950'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-950'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-black uppercase">
                      {t.rule_analysis} ({t.confidence}: {((selectedRecord.confidence_score || 0.95) * 100).toFixed(0)}%)
                    </span>
                  </div>
                  <span className="text-xs font-bold font-mono">
                    Priority: {selectedRecord.priority}
                  </span>
                </div>
                <p className="text-xs font-bold leading-snug">
                  {selectedRecord.triage_reason}
                </p>
                <p className="text-[10px] text-slate-600 mt-2 italic">
                  * {language === 'mr' 
                    ? 'क्लिनिकल AI विश्लेषण (IPHS मानके). अंतिम निर्णय वैद्यकीय अधिकाऱ्यांचा राहील.' 
                    : language === 'hi' 
                    ? 'क्लिनिकल AI विश्लेषण (IPHS मानक)। अंतिम निर्णय चिकित्सा अधिकारी का रहेगा।' 
                    : 'Clinical Decision Support Engine (IPHS Standards). Final clinical decision rests with Medical Officer.'}
                </p>
              </div>

              {/* Doctor Verification Form */}
              <div className="space-y-4 pt-2 border-t border-slate-100 text-xs font-bold">
                <div>
                  <label className="text-slate-700 block mb-1">
                    {language === 'mr' ? 'वैद्यकीय प्राधान्य पडताळणी:' : language === 'hi' ? 'चिकित्सकीय प्राथमिकता सत्यापन:' : 'Doctor Verified Priority:'}
                  </label>
                  <div className="flex gap-2">
                    {(['P1', 'P2', 'P3'] as const).map(p => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setVerifiedPriority(p)}
                        className={`flex-1 py-2 rounded-xl font-black ${
                          verifiedPriority === p
                            ? (p === 'P1' ? 'bg-red-600 text-white shadow' : p === 'P2' ? 'bg-amber-500 text-white shadow' : 'bg-emerald-600 text-white shadow')
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {p === 'P1' ? t.preset_p1 : p === 'P2' ? t.preset_p2 : t.preset_p3}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">
                    {t.prescription_label}:
                  </label>
                  <textarea
                    value={prescription}
                    onChange={(e) => setPrescription(e.target.value)}
                    rows={3}
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={language === 'mr' ? 'औषधोपचार व सूचना...' : language === 'hi' ? 'दवाएं और चिकित्सकीय सलाह...' : 'Clinical notes & prescription instructions...'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      setDoctorAction('Verify');
                      handleVerifyCase();
                    }}
                    className="py-3 bg-blue-700 hover:bg-blue-800 active:scale-95 text-white rounded-2xl font-black text-xs shadow-md transition-all flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>{t.doctor_verify_btn}</span>
                  </button>

                  <button
                    onClick={() => {
                      setDoctorAction('Refer');
                      handleVerifyCase();
                    }}
                    className="py-3 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-2xl font-black text-xs shadow-md transition-all flex items-center justify-center space-x-2"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>{language === 'mr' ? 'तज्ञांकडे रेफर करा (मंचर RH)' : language === 'hi' ? 'विशेषज्ञ को रेफर करें (मंचर RH)' : 'Refer to Specialist (Manchar RH)'}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400">
              <Stethoscope className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-bold">{t.select_patient_prompt}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
