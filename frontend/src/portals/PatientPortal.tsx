// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { translations } from '../i18n/translations';
import { api } from '../services/api';
import { useSpeech } from '../hooks/useSpeech';
import { VoiceInput } from '../components/VoiceInput';
import { VillageSearchSelect } from '../components/VillageSearchSelect';
import { useDemoMode } from '../context/DemoContext';
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
  Send, 
  ArrowRight,
  Stethoscope,
  HeartHandshake,
  Pill,
  Sparkles,
  Calendar,
  Video,
  User,
  ShieldCheck,
  Building2,
  RefreshCw,
  CheckCircle,
  HelpCircle,
  Search,
  Plus,
  Minus,
  FlaskConical,
  X,
  Zap,
  Loader2,
  ChevronDown,
  ChevronUp,
  Star,
  TestTube2,
  Siren
} from 'lucide-react';

export const PatientPortal = ({
  language,
  openSOS,
  openAbha,
  gpsLocation,
  isOffline
}) => {
  const t = translations[language] || translations.en;
  const { isListening, transcript, startListening, stopListening } = useSpeech(language);

  // Active section tab
  const [activeTab, setActiveTab] = useState('triage');
  const { isDemoMode } = useDemoMode();

  // AI Symptom Matcher State
  const [aiSymptoms, setAiSymptoms] = useState('');
  const [aiAge, setAiAge] = useState('');
  const [aiSex, setAiSex] = useState('Male');
  const [aiDuration, setAiDuration] = useState('1 day');
  const [aiDistrict, setAiDistrict] = useState('');
  const [aiManualSpec, setAiManualSpec] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');
  const [aiEnums, setAiEnums] = useState({ specialities: [], suggested_tests: [], medicine_categories: [] });
  const [aiExpandedHosp, setAiExpandedHosp] = useState(null);

  // Load patient profile & village from localStorage if present
  const getInitialPatientData = () => {
    let village = '';
    let taluka = '';
    let district = '';
    let name = '';
    let phone = '';
    let abha_id = '';

    try {
      const savedUser = localStorage.getItem('sevasetu_user');
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u.name) name = u.name;
        if (u.phone) phone = u.phone;
        if (u.village) village = u.village;
        if (u.taluka) taluka = u.taluka;
        if (u.district) district = u.district;
        if (u.abha_number || u.abha_id) abha_id = u.abha_number || u.abha_id;
      }

      const savedVillage = localStorage.getItem('sevasetu_patient_village');
      if (savedVillage) {
        const parsed = JSON.parse(savedVillage);
        if (parsed.village && !village) village = parsed.village;
        if (parsed.taluka && !taluka) taluka = parsed.taluka;
        if (parsed.district && !district) district = parsed.district;
      }
    } catch (e) {
      console.warn('Error reading saved patient profile:', e);
    }

    // Only populate seed profile if Demo Mode is explicitly active
    if (!name && isDemoMode) {
      return {
        name: 'Sunita Patil',
        age: 28,
        gender: 'Female',
        phone: '9822104512',
        village: 'Kharpudi',
        taluka: 'Khed',
        district: 'Pune',
        wadi: 'Main Area',
        abha_id: '91-4829-1029-4512'
      };
    }

    return {
      name,
      age: name ? 28 : '',
      gender: 'Female',
      phone,
      village,
      taluka,
      district,
      wadi: '',
      abha_id
    };
  };

  // Patient Registration Form State
  const [regForm, setRegForm] = useState(getInitialPatientData);
  const [registeredPatient, setRegisteredPatient] = useState(getInitialPatientData);

  // Vitals & Symptoms Form State - clean state for custom testing or 1-click test scenarios
  const [systolicBp, setSystolicBp] = useState('');
  const [diastolicBp, setDiastolicBp] = useState('');
  const [spo2, setSpo2] = useState('');
  const [pulseRate, setPulseRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [isMaternalHighRisk, setIsMaternalHighRisk] = useState(false);
  const [maternalNote, setMaternalNote] = useState('');

  // Listen for Demo Header preset broadcasts
  useEffect(() => {
    const handlePreset = (e) => {
      const p = e.detail;
      if (p && p.role === 'patient') {
        setRegisteredPatient({
          name: p.name,
          age: p.age,
          gender: p.gender,
          phone: p.phone,
          village: p.village,
          taluka: p.taluka,
          district: p.district,
          abha_id: p.abha_number
        });
        setRegForm({
          name: p.name,
          age: p.age,
          gender: p.gender,
          phone: p.phone,
          village: p.village,
          taluka: p.taluka,
          district: p.district,
          abha_id: p.abha_number
        });
        if (p.vitals) {
          setSystolicBp(p.vitals.systolic_bp || '');
          setDiastolicBp(p.vitals.diastolic_bp || '');
          setSpo2(p.vitals.spo2 || '');
          setPulseRate(p.vitals.pulse_rate || '');
          setTemperature(p.vitals.temperature || '');
          setDurationDays(p.vitals.duration_days || 1);
          setSymptoms(p.vitals.symptoms || '');
        }
      }
    };
    window.addEventListener('sevasetu_apply_demo_preset', handlePreset);
    return () => window.removeEventListener('sevasetu_apply_demo_preset', handlePreset);
  }, []);

  // Triage Result State & Guardrail Tracking
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageResult, setTriageResult] = useState(null);
  const [lastEvaluatedFingerprint, setLastEvaluatedFingerprint] = useState(null);
  const [triageNotice, setTriageNotice] = useState(null);
  const [triageError, setTriageError] = useState(null);

  // Facilities, Referrals, Appointments, Records
  const [facilities, setFacilities] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [pastTriageRecords, setPastTriageRecords] = useState([]);

  // Hospital Directory Search & Filters
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitalCategoryFilter, setHospitalCategoryFilter] = useState('All');
  const [loadingFacilities, setLoadingFacilities] = useState(false);

  // Appointment Booking Form
  const [selectedFacilityForAppt, setSelectedFacilityForAppt] = useState('');
  const [apptDate, setApptDate] = useState(new Date().toISOString().split('T')[0]);
  const [apptTimeSlot, setApptTimeSlot] = useState('10:00 AM - 10:30 AM');
  const [apptReason, setApptReason] = useState('Routine OPD Consultation & Checkup');
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState(null);

  // Hospital Public Profile & Services Modal (Phase 1)
  const [selectedHospitalForServices, setSelectedHospitalForServices] = useState(null);
  const [hospitalServicesModalOpen, setHospitalServicesModalOpen] = useState(false);
  const [hospitalDoctors, setHospitalDoctors] = useState([]);
  const [hospitalTests, setHospitalTests] = useState([]);
  const [hospitalPharmacy, setHospitalPharmacy] = useState({ total_items: 0, low_stock_count: 0, in_stock_count: 0, items: [] });
  const [loadingHospitalServices, setLoadingHospitalServices] = useState(false);
  const [activeHospitalServiceTab, setActiveHospitalServiceTab] = useState('doctors');

  // Triage Referral Modal State & Handlers
  const [triageReferralModalOpen, setTriageReferralModalOpen] = useState(false);
  const [selectedFacilityForTriageReferral, setSelectedFacilityForTriageReferral] = useState(null);
  const [triageReferralReason, setTriageReferralReason] = useState('');
  const [triageReferralUrgency, setTriageReferralUrgency] = useState('Immediate');
  const [triageReferralTransport, setTriageReferralTransport] = useState('108 Emergency Ambulance');
  const [submittingTriageReferral, setSubmittingTriageReferral] = useState(false);
  const [triageReferralSuccessMsg, setTriageReferralSuccessMsg] = useState(null);

  const handleOpenTriageReferralModal = (facility) => {
    setSelectedFacilityForTriageReferral(facility);
    const reason = triageResult?.triage_reason 
      ? `AI Triage (${triageResult.triage_label || triageResult.priority}): ${triageResult.triage_reason}. Suspected: ${(triageResult.differential_diagnosis || []).join(', ')}`
      : 'Triage clinical evaluation referral.';
    setTriageReferralReason(reason);
    setTriageReferralUrgency(triageResult?.priority === 'P1' ? 'Immediate' : triageResult?.priority === 'P2' ? 'Urgent' : 'Routine');
    setTriageReferralTransport(triageResult?.priority === 'P1' ? '108 Emergency Ambulance' : 'Private / Public Transport');
    setTriageReferralModalOpen(true);
  };

  const handleConfirmTriageReferral = async (e) => {
    e?.preventDefault();
    if (!selectedFacilityForTriageReferral) return;
    setSubmittingTriageReferral(true);
    try {
      const payload = {
        triage_id: triageResult?.id || null,
        patient_name: patientName || 'Citizen Patient',
        age: parseInt(age) || 30,
        priority: triageResult?.priority || 'P3',
        source_facility: 'Field Screening / Digital Smart Triage',
        target_facility: selectedFacilityForTriageReferral.hospital_name,
        urgency: triageReferralUrgency,
        reason: triageReferralReason,
        transport_mode: triageReferralTransport,
        status: 'Pending',
      };
      const res = await api.createReferral(payload);
      setTriageReferralSuccessMsg(`Facility referral successfully created for ${selectedFacilityForTriageReferral.hospital_name}! Referral Ref: #${res.id || 'NEW'}`);
      setTriageReferralModalOpen(false);
      refreshPatientData();
      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
      } catch (err) {}
    } catch (err) {
      alert("Error creating referral: " + (err.message || 'Server error'));
    } finally {
      setSubmittingTriageReferral(false);
    }
  };

  const handleOpenHospitalServices = async (fac) => {
    setSelectedHospitalForServices(fac);
    setHospitalServicesModalOpen(true);
    setLoadingHospitalServices(true);
    setActiveHospitalServiceTab('doctors');
    const targetId = fac.id || 'hospital_aundh';
    try {
      const [docsRes, testsRes, pharmRes] = await Promise.allSettled([
        api.getHospitalDoctors(targetId, { active_only: true }),
        api.getHospitalTests(targetId, { available_only: true }),
        api.getHospitalPharmacy(targetId)
      ]);
      setHospitalDoctors(docsRes.status === 'fulfilled' ? docsRes.value || [] : []);
      setHospitalTests(testsRes.status === 'fulfilled' ? testsRes.value || [] : []);
      setHospitalPharmacy(pharmRes.status === 'fulfilled' ? pharmRes.value || { items: [] } : { items: [] });
    } catch (e) {
      console.error('Error loading hospital services:', e);
    } finally {
      setLoadingHospitalServices(false);
    }
  };


  // Load facilities from Government Hospital Directory (PostgreSQL)
  const refreshPatientData = async () => {
    try {
      setLoadingFacilities(true);
      const [facsRes, refsRes, apptsRes, qRes] = await Promise.allSettled([
        api.getFacilities({
          district: registeredPatient?.district || 'Pune',
          taluka: registeredPatient?.taluka || undefined,
          village: registeredPatient?.village || undefined,
          query: hospitalSearch || undefined,
          category: hospitalCategoryFilter !== 'All' ? hospitalCategoryFilter : undefined,
          lat: gpsLocation?.lat,
          lng: gpsLocation?.lng,
          limit: 50
        }),
        api.getReferrals(),
        api.getAppointments(),
        api.getDoctorQueue()
      ]);

      const facs = facsRes.status === 'fulfilled' ? facsRes.value : [];
      setFacilities(facs || []);
      if (facs && facs.length > 0 && !selectedFacilityForAppt) {
        setSelectedFacilityForAppt(facs[0].name);
      }
      setReferrals(refsRes.status === 'fulfilled' ? refsRes.value || [] : []);
      setAppointments(apptsRes.status === 'fulfilled' ? apptsRes.value || [] : []);
      setPastTriageRecords(qRes.status === 'fulfilled' ? qRes.value || [] : []);
    } catch (e) {
      console.warn('Patient portal data load:', e);
    } finally {
      setLoadingFacilities(false);
    }
  };

  useEffect(() => {
    refreshPatientData();
  }, [registeredPatient?.district, registeredPatient?.taluka, registeredPatient?.village, hospitalCategoryFilter, gpsLocation?.lat, gpsLocation?.lng]);

  // Sync voice transcript to symptoms input
  useEffect(() => {
    if (transcript) {
      setSymptoms(prev => (prev ? `${prev} ${transcript}` : transcript));
    }
  }, [transcript]);

  // Load AI Matcher enums when tab is selected
  useEffect(() => {
    if (activeTab === 'ai_matcher' && aiEnums.specialities.length === 0) {
      api.getSymptomMatchEnums().then(data => {
        if (data && data.specialities) setAiEnums(data);
      }).catch(() => {});
    }
  }, [activeTab]);

  // Quick symptom chips
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

  const handleSymptomChipClick = (val) => {
    const currentList = symptoms
      ? symptoms.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    const index = currentList.findIndex(s => s.toLowerCase() === val.toLowerCase());
    if (index >= 0) {
      currentList.splice(index, 1);
    } else {
      currentList.push(val);
    }
    setSymptoms(currentList.join(', '));
    if (triageNotice) setTriageNotice(null);
    if (triageError) setTriageError(null);
  };

  // Helper to step vitals: initializes from default baseline when empty, or steps from current value
  const stepVital = (
    currentVal,
    setter,
    defaultBase,
    delta,
    minVal = undefined,
    maxVal = undefined,
    isFloat = false
  ) => {
    let base;
    if (currentVal === '' || currentVal === null || currentVal === undefined || isNaN(Number(currentVal))) {
      base = defaultBase;
    } else {
      base = Number(currentVal);
    }
    let next = base + delta;
    if (minVal !== undefined && next < minVal) next = minVal;
    if (maxVal !== undefined && next > maxVal) next = maxVal;
    setter(isFloat ? next.toFixed(1) : String(Math.round(next)));
    if (triageNotice) setTriageNotice(null);
    if (triageError) setTriageError(null);
  };

  // Run Triage with Continuous POST Guardrail
  const handleRunTriage = async (force = false) => {
    const activeName = registeredPatient?.name || regForm?.name;
    const activePhone = registeredPatient?.phone || regForm?.phone;

    if (!activeName || !activePhone) {
      alert(language === 'mr' ? 'कृपया आधी रुग्णाचे नाव व मोबाईल क्रमांक प्रोफाइल टॅबमध्ये प्रविष्ट करा.' : 'Please enter patient name and mobile number in the Profile tab first.');
      setActiveTab('profile');
      return;
    }

    // Compute input fingerprint to prevent duplicate continuous POST requests on identical inputs
    const currentFingerprint = `${activePhone}|${systolicBp}|${diastolicBp}|${spo2}|${pulseRate}|${temperature}|${durationDays}|${(symptoms || '').trim().toLowerCase()}|${isMaternalHighRisk}|${maternalNote}`;

    if (!force && lastEvaluatedFingerprint === currentFingerprint && triageResult) {
      setTriageNotice(language === 'mr'
        ? 'याच लक्षणांचा निकाल आधीच उपलब्ध आहे. लक्षणे बदलल्यास पुन्हा तपासणी होईल, किंवा खालील बटण दाबून सक्तीने पुन्हा चाचणी करा.'
        : 'Displaying current evaluation for these exact inputs. Modify symptoms or vitals to evaluate new data, or click Force Re-evaluate.');
      return;
    }

    setTriageError(null);
    setTriageNotice(null);
    setTriageLoading(true);

    try {
      // 1. Ensure patient is registered in backend (only if ID not yet known)
      if (!registeredPatient?.id) {
        try {
          const pat = await api.createPatient({
            name: activeName,
            phone: activePhone,
            age: registeredPatient?.age ? parseInt(registeredPatient.age) : 30,
            gender: registeredPatient?.gender || 'Female',
            village: registeredPatient?.village || 'Primary Health Centre Area',
            taluka: registeredPatient?.taluka || '',
            district: registeredPatient?.district || 'Pune',
            lat: gpsLocation?.lat || null,
            lng: gpsLocation?.lng || null,
            abha_id: registeredPatient?.abha_id || registeredPatient?.abha_number
          });
          if (pat && pat.id) {
            setRegisteredPatient(prev => ({ ...prev, id: pat.id }));
          }
        } catch (e) {
          console.warn('Patient creation sync notice:', e);
        }
      }

      // 2. Submit triage (persists directly to TriageRecord)
      const payload = {
        patient_id: registeredPatient?.id || undefined,
        patient_name: activeName,
        age: registeredPatient?.age ? parseInt(registeredPatient.age) : 30,
        gender: registeredPatient?.gender || 'Female',
        phone: activePhone,
        village: registeredPatient?.village || 'Primary Health Centre Area',
        taluka: registeredPatient?.taluka || '',
        district: registeredPatient?.district || 'Pune',
        lat: gpsLocation?.lat || null,
        lng: gpsLocation?.lng || null,
        vitals: {
          systolic_bp: systolicBp ? parseFloat(systolicBp) : undefined,
          diastolic_bp: diastolicBp ? parseFloat(diastolicBp) : undefined,
          spo2: spo2 ? parseFloat(spo2) : undefined,
          pulse_rate: pulseRate ? parseFloat(pulseRate) : undefined,
          temperature: temperature ? parseFloat(temperature) : undefined,
          symptom_duration_days: durationDays ? parseInt(durationDays) : 1,
          symptoms: symptoms,
          high_risk_maternal: isMaternalHighRisk,
          maternal_note: maternalNote
        },
        source: isOffline ? 'ASHA_Offline' : 'Patient'
      };

      const result = await api.evaluateTriage(payload, isOffline);
      setTriageResult(result);
      setLastEvaluatedFingerprint(currentFingerprint);
      if (result.cached) {
        setTriageNotice(language === 'mr'
          ? 'अचूक व जलद निकाल (६० सेकंदांत आधी नोंदवलेल्या नोंदीवरून पुनर्प्राप्त).'
          : 'Instant cached evaluation loaded (identical inputs received within 60s).');
      }
      refreshPatientData();
    } catch (err) {
      console.error('Triage error:', err);
      setTriageError(err.message || 'Triage evaluation request failed. Please check your network or wait a moment.');
    } finally {
      setTriageLoading(false);
    }
  };

  // Handle Book Appointment
  const handleBookAppointment = async (e) => {
    e.preventDefault();
    try {
      const newAppt = {
        patient_name: registeredPatient?.name || 'Citizen Patient',
        phone: registeredPatient?.phone || '',
        age: registeredPatient?.age || 28,
        gender: registeredPatient?.gender || 'Female',
        facility_name: selectedFacilityForAppt,
        doctor_name: 'Medical Officer / Duty Physician',
        appointment_date: apptDate,
        time_slot: apptTimeSlot,
        reason: apptReason,
        priority: triageResult?.priority || 'P3',
        status: 'Scheduled'
      };

      await api.createAppointment(newAppt);
      const msg = language === 'mr' 
        ? `अपॉइंटमेंट यशस्वीरीत्या बुक झाली! (${selectedFacilityForAppt} • ${apptDate} ${apptTimeSlot})`
        : language === 'hi' 
        ? `अपॉइंटमेंट सफलतापूर्वक बुक हो गई! (${selectedFacilityForAppt} • ${apptDate} ${apptTimeSlot})`
        : `Appointment successfully booked at ${selectedFacilityForAppt} for ${apptDate} (${apptTimeSlot})!`;
      
      setBookingSuccessMsg(msg);
      refreshPatientData();
      setTimeout(() => setBookingSuccessMsg(null), 6000);
    } catch (e) {
      alert("Booking error: " + (e.message || 'Error occurred'));
    }
  };

  // Handle Patient Registration
  const handleRegisterPatient = async (e) => {
    e.preventDefault();
    if (!regForm.name || !regForm.phone) {
      alert("Please enter Full Name and Phone Number.");
      return;
    }
    const newPat = { 
      ...regForm, 
      id: Date.now(), 
      lat: gpsLocation?.lat || 18.5204,
      lng: gpsLocation?.lng || 73.8567,
      abha_id: registeredPatient?.abha_id || `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${regForm.phone.slice(-4)}` 
    };

    try {
      await api.createPatient(newPat);
    } catch (err) {
      console.warn('Backend patient save fallback:', err);
    }

    setRegisteredPatient(newPat);
    localStorage.setItem('sevasetu_patient_village', JSON.stringify({
      village: newPat.village,
      taluka: newPat.taluka,
      district: newPat.district
    }));
    alert(`ABHA Profile Updated! Village: ${newPat.village}, Taluka: ${newPat.taluka || 'Khed'}, District: ${newPat.district || 'Pune'}`);
    setActiveTab('triage');
  };

  const navTabs = [
    { id: 'triage', label: language === 'mr' ? '१. लक्षणे व AI तपासणी' : language === 'hi' ? '1. लक्षण व AI जांच' : '1. Enter Symptoms & Triage', icon: <Activity className="w-4 h-4" /> },
    { id: 'ai_matcher', label: language === 'mr' ? '२. AI रुग्णालय शोधा' : language === 'hi' ? '2. AI अस्पताल खोजें' : '2. AI Hospital Matcher', icon: <Zap className="w-4 h-4" /> },
    { id: 'facilities', label: language === 'mr' ? '३. शासकीय व नोंदणीकृत रुग्णालये' : language === 'hi' ? '3. सरकारी एवं पंजीकृत अस्पताल' : '3. Healthcare Facilities', icon: <Building2 className="w-4 h-4" /> },
    { id: 'book_appointment', label: language === 'mr' ? '४. अपॉइंटमेंट बुक करा' : language === 'hi' ? '4. अपॉइंटमेंट बुकिंग' : '4. Book Appointment', icon: <Calendar className="w-4 h-4" /> },
    { id: 'records', label: language === 'mr' ? '५. डिजिटल आरोग्य नोंदी' : language === 'hi' ? '5. स्वास्थ्य रिकॉर्ड' : '5. Health Records & ABHA', icon: <FileText className="w-4 h-4" /> },
    { id: 'referrals', label: language === 'mr' ? '६. रेफरल ट्रॅकिंग' : language === 'hi' ? '6. रेफरल ट्रैकिंग' : '6. Referral Tracking', icon: <Send className="w-4 h-4" />, badge: referrals.length },
    { id: 'followup', label: language === 'mr' ? '७. फॉलो-अप' : language === 'hi' ? '7. फॉलो-अप' : '7. Follow-up & Care', icon: <HeartHandshake className="w-4 h-4" /> },
    { id: 'profile', label: language === 'mr' ? '८. प्रोफाइल' : language === 'hi' ? '8. प्रोफाइल' : '8. Profile & Village', icon: <User className="w-4 h-4" /> }
  ];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Patient Header Banner */}
      <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-900 rounded-3xl text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{language === 'mr' ? 'रुग्ण डॅशबोर्ड • महाराष्ट्र आरोग्य ग्रिड' : language === 'hi' ? 'मरीज डैशबोर्ड • महाराष्ट्र स्वास्थ्य ग्रिड' : 'Patient Dashboard • Maharashtra Health Grid'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {registeredPatient?.name || (language === 'mr' ? 'नागरिक रुग्ण' : language === 'hi' ? 'नागरिक मरीज' : 'Citizen Patient')}
            </h2>
            <div className="text-teal-100 text-xs sm:text-sm font-medium mt-1 flex flex-wrap items-center gap-1.5">
              <span>📍 <strong className="text-white">{registeredPatient?.village || (language === 'mr' ? 'महाराष्ट्र आरोग्य केंद्र' : 'Primary Health Centre Area')}</strong></span>
              {registeredPatient?.taluka && (
                <>
                  <span>•</span>
                  <span>{language === 'mr' ? 'तालुका:' : language === 'hi' ? 'तालुका:' : 'Taluka:'} <strong className="text-teal-200">{registeredPatient.taluka}</strong></span>
                </>
              )}
              {registeredPatient?.district && (
                <>
                  <span>•</span>
                  <span>{language === 'mr' ? 'जिल्हा:' : language === 'hi' ? 'जिला:' : 'District:'} <strong className="text-teal-200">{registeredPatient.district}</strong></span>
                </>
              )}
              <span>•</span>
              <span>ABHA: <span className="font-mono font-bold text-amber-300">{registeredPatient?.abha_id || registeredPatient?.abha_number || (language === 'mr' ? 'नोंदणी आवश्यक' : language === 'hi' ? 'पंजीकरण आवश्यक' : 'Pending Registration')}</span></span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openAbha(registeredPatient)}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{t.abha_card || 'ABHA Card'}</span>
            </button>

            <button
              onClick={() => setActiveTab('book_appointment')}
              className="px-4 py-2 bg-white hover:bg-teal-50 text-teal-900 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-teal-600" />
              <span>{language === 'mr' ? 'अपॉइंटमेंट बुक करा' : language === 'hi' ? 'अपॉइंटमेंट बुक करें' : 'Book Appointment'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200">
        {navTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---------------- 1. ENTER SYMPTOMS & DIGITAL TRIAGE ---------------- */}
      {activeTab === 'triage' && (
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
                    <p className="text-xs text-slate-500 font-medium">Deterministic Rule Engine v1.2</p>
                  </div>
                </div>

                {/* Quick Test Scenarios for P1 / P2 / P3 Segregation Testing */}
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-700 bg-slate-200 px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase">
                    Test Scenarios
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSystolicBp('170');
                      setDiastolicBp('105');
                      setSpo2('88');
                      setPulseRate('110');
                      setTemperature('99.0');
                      setDurationDays('1');
                      setSymptoms(language === 'mr' ? 'छातीत तीव्र कळ येत आहे आणि डावा हात दुखत आहे' : language === 'hi' ? 'सीने में असहनीय दर्द और बायां हाथ दुख रहा है' : 'Severe crushing chest pain radiating to left arm and cold sweat');
                      setIsMaternalHighRisk(false);
                      setMaternalNote('');
                      if (triageNotice) setTriageNotice(null);
                      if (triageError) setTriageError(null);
                    }}
                    className="px-2.5 py-1 bg-red-100 text-red-800 hover:bg-red-200 rounded-lg font-black text-[11px] cursor-pointer border border-red-200 shadow-xs"
                    title="Loads P1 Critical Vitals & Symptoms"
                  >
                    🔴 P1 Critical
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSystolicBp('120');
                      setDiastolicBp('80');
                      setSpo2('97');
                      setPulseRate('96');
                      setTemperature('103.2');
                      setDurationDays('4');
                      setSymptoms(language === 'mr' ? '४ दिवसांपासून तीव्र ताप, थंडी वाजणे व उलट्या' : language === 'hi' ? '4 दिनों से तेज बुखार, कपकपी और उल्टी' : 'High grade fever for 4 days with severe chills and persistent vomiting');
                      setIsMaternalHighRisk(false);
                      setMaternalNote('');
                      if (triageNotice) setTriageNotice(null);
                      if (triageError) setTriageError(null);
                    }}
                    className="px-2.5 py-1 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg font-black text-[11px] cursor-pointer border border-amber-200 shadow-xs"
                    title="Loads P2 Urgent Vitals & Symptoms (>3 days, >102°F)"
                  >
                    🟡 P2 Urgent
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSystolicBp('120');
                      setDiastolicBp('80');
                      setSpo2('98');
                      setPulseRate('72');
                      setTemperature('98.4');
                      setDurationDays('1');
                      setSymptoms(language === 'mr' ? 'हलकी सर्दी आणि शिंका, नियमित तपासणी' : language === 'hi' ? 'हल्की सर्दी और छींक, सामान्य जांच' : 'Mild runny nose and sneezing since morning');
                      setIsMaternalHighRisk(false);
                      setMaternalNote('');
                      if (triageNotice) setTriageNotice(null);
                      if (triageError) setTriageError(null);
                    }}
                    className="px-2.5 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded-lg font-black text-[11px] cursor-pointer border border-emerald-200 shadow-xs"
                    title="Loads P3 Routine Normal Vitals & Mild Cold"
                  >
                    🟢 P3 Routine
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSystolicBp('');
                      setDiastolicBp('');
                      setSpo2('');
                      setPulseRate('');
                      setTemperature('');
                      setDurationDays('');
                      setSymptoms('');
                      setIsMaternalHighRisk(false);
                      setMaternalNote('');
                      setTriageResult(null);
                      setTriageNotice(null);
                      setTriageError(null);
                    }}
                    className="px-2.5 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg font-bold text-[11px] cursor-pointer border border-slate-300"
                    title="Clears all inputs and reset triage state"
                  >
                    🔄 Clear All
                  </button>
                </div>
              </div>

              {/* Numeric Inputs for Vitals with Large Tactile Steppers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Systolic BP */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">{t.bp_sys}</label>
                    <span className="text-[11px] font-bold text-slate-400">&ge; 160: P1</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => stepVital(systolicBp, setSystolicBp, 120, -1, 60, 260)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white hover:bg-teal-600 hover:text-white text-slate-700 border border-slate-300 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 select-none"
                      title="Decrease Systolic BP"
                    >
                      <Minus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={systolicBp}
                        onChange={(e) => {
                          setSystolicBp(e.target.value);
                          if (triageNotice) setTriageNotice(null);
                          if (triageError) setTriageError(null);
                        }}
                        className="w-full text-2xl font-black text-slate-900 bg-white py-2.5 px-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="120"
                      />
                      <span className="absolute right-2.5 bottom-1 text-[10px] font-bold text-slate-400 pointer-events-none">
                        mmHg
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => stepVital(systolicBp, setSystolicBp, 120, 1, 60, 260)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white hover:bg-teal-600 hover:text-white text-slate-700 border border-slate-300 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 select-none"
                      title="Increase Systolic BP"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* 2. SpO2 */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">{t.spo2}</label>
                    <span className="text-[11px] font-bold text-slate-400">&le; 90%: P1</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => stepVital(spo2, setSpo2, 98, -1, 50, 100)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white hover:bg-teal-600 hover:text-white text-slate-700 border border-slate-300 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 select-none"
                      title="Decrease SpO2"
                    >
                      <Minus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={spo2}
                        onChange={(e) => {
                          setSpo2(e.target.value);
                          if (triageNotice) setTriageNotice(null);
                          if (triageError) setTriageError(null);
                        }}
                        className="w-full text-2xl font-black text-slate-900 bg-white py-2.5 px-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="98"
                      />
                      <span className="absolute right-2.5 bottom-1 text-[10px] font-bold text-slate-400 pointer-events-none">
                        %
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => stepVital(spo2, setSpo2, 98, 1, 50, 100)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white hover:bg-teal-600 hover:text-white text-slate-700 border border-slate-300 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 select-none"
                      title="Increase SpO2"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* 3. Temperature */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">{t.temp}</label>
                    <span className="text-[11px] font-bold text-slate-400">&ge; 102°F: P2</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => stepVital(temperature, setTemperature, 98.6, -0.2, 94.0, 108.0, true)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white hover:bg-teal-600 hover:text-white text-slate-700 border border-slate-300 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 select-none"
                      title="Decrease Temperature"
                    >
                      <Minus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        step="0.1"
                        value={temperature}
                        onChange={(e) => {
                          setTemperature(e.target.value);
                          if (triageNotice) setTriageNotice(null);
                          if (triageError) setTriageError(null);
                        }}
                        className="w-full text-2xl font-black text-slate-900 bg-white py-2.5 px-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="98.6"
                      />
                      <span className="absolute right-2.5 bottom-1 text-[10px] font-bold text-slate-400 pointer-events-none">
                        °F
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => stepVital(temperature, setTemperature, 98.6, 0.2, 94.0, 108.0, true)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white hover:bg-teal-600 hover:text-white text-slate-700 border border-slate-300 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 select-none"
                      title="Increase Temperature"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>

                {/* 4. Duration Days */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-slate-700">{t.duration_days}</label>
                    <span className="text-[11px] font-bold text-slate-400">&gt; 3: P2</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => stepVital(durationDays, setDurationDays, 1, -1, 1, 90)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white hover:bg-teal-600 hover:text-white text-slate-700 border border-slate-300 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 select-none"
                      title="Decrease Days"
                    >
                      <Minus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={durationDays}
                        onChange={(e) => {
                          setDurationDays(e.target.value);
                          if (triageNotice) setTriageNotice(null);
                          if (triageError) setTriageError(null);
                        }}
                        className="w-full text-2xl font-black text-slate-900 bg-white py-2.5 px-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-teal-500 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        placeholder="1"
                      />
                      <span className="absolute right-2.5 bottom-1 text-[10px] font-bold text-slate-400 pointer-events-none">
                        {language === 'mr' ? 'दिवस' : language === 'hi' ? 'दिन' : 'Days'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => stepVital(durationDays, setDurationDays, 1, 1, 1, 90)}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white hover:bg-teal-600 hover:text-white text-slate-700 border border-slate-300 shadow-xs flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 select-none"
                      title="Increase Days"
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>

              {/* High Risk Maternal Alert */}
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
                  
                  {/* Indic Voice Input Component (Bhashini + Web Speech API) */}
                  <VoiceInput
                    language={language}
                    onTranscript={(recText) => {
                      setSymptoms(prev => (prev ? `${prev}, ${recText}` : recText));
                    }}
                  />
                </div>

                {/* Quick Tap Symptom Chips */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      {language === 'mr' ? 'लक्षणे निवडा (Quick Tap):' : language === 'hi' ? 'लक्षण चुनें (Quick Tap):' : 'Quick Tap Symptoms:'}
                    </span>
                    {symptoms && (
                      <button
                        type="button"
                        onClick={() => {
                          setSymptoms('');
                          if (triageNotice) setTriageNotice(null);
                          if (triageError) setTriageError(null);
                        }}
                        className="text-[11px] font-bold text-slate-500 hover:text-red-600 cursor-pointer"
                      >
                        ✕ {language === 'mr' ? 'लक्षणे हटवा' : language === 'hi' ? 'लक्षण हटाएं' : 'Clear Symptoms'}
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {symptomChips.map((chip, idx) => {
                      const isSelected = symptoms
                        ? symptoms.split(',').map(s => s.trim().toLowerCase()).includes(chip.value.toLowerCase())
                        : false;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSymptomChipClick(chip.value)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {isSelected ? '✓' : '+'} {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={symptoms}
                  onChange={(e) => {
                    setSymptoms(e.target.value);
                    if (triageNotice) setTriageNotice(null);
                    if (triageError) setTriageError(null);
                  }}
                  className="w-full p-4 rounded-2xl border border-slate-300 text-sm font-medium focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder={language === 'mr' ? 'उदा. ताप, खोकला, छातीत दुखणे...' : language === 'hi' ? 'उदा. बुखार, खांसी, सीने में दर्द...' : 'Describe symptoms or use voice dictation...'}
                />
              </div>

              {/* Run Triage Button */}
              <button
                type="button"
                onClick={() => handleRunTriage(false)}
                disabled={triageLoading}
                className="w-full py-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 active:scale-98 text-white rounded-2xl font-black text-base shadow-lg shadow-teal-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {triageLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>{language === 'mr' ? 'Gemini 3.6 Flash तपासणी सुरू...' : 'Analyzing with Gemini 3.6 Flash...'}</span>
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5" />
                    <span>{t.calculate_triage}</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Triage Output Column */}
          <div className="space-y-4">
            {/* Active AI Analyzing Banner */}
            {triageLoading && (
              <div className="p-5 rounded-3xl border-2 border-teal-500 bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 text-teal-950 shadow-md animate-pulse space-y-2">
                <div className="flex items-center space-x-2.5">
                  <RefreshCw className="w-5 h-5 animate-spin text-teal-700 shrink-0" />
                  <span className="text-sm font-black">
                    {language === 'mr' ? 'Gemini 3.6 Flash सह नवीन लक्षणांची तपासणी सुरू आहे...' : 'Gemini 3.6 Flash is analyzing updated symptoms & vitals...'}
                  </span>
                </div>
                <p className="text-xs text-teal-700 font-medium">
                  {language === 'mr' ? 'वैद्यकीय नियमावली व लक्षणांचा ताळमेळ तपासत आहे. काही सेकंदात निकाल दिसेल.' : 'Evaluating clinical red flags, physiological triggers, and differential conditions.'}
                </p>
              </div>
            )}

            {/* Notice Banner for Identical Inputs / Cache */}
            {triageNotice && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between gap-2 animate-fadeIn">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold">{triageNotice}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRunTriage(true)}
                  className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-lg text-[11px] shrink-0 cursor-pointer"
                >
                  {language === 'mr' ? 'पुन्हा तपासा' : 'Force Re-evaluate'}
                </button>
              </div>
            )}

            {/* User-Facing Error Banner */}
            {triageError && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 text-xs space-y-1.5 animate-fadeIn">
                <div className="flex items-center space-x-2 font-bold text-red-800">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{language === 'mr' ? 'तपासणी त्रुटी' : 'Evaluation Error'}</span>
                </div>
                <p className="font-medium text-red-700">{triageError}</p>
              </div>
            )}

            {triageResult ? (
              <div className={`p-6 sm:p-7 rounded-3xl border-2 shadow-lg space-y-4 transition-opacity duration-300 ${
                triageLoading ? 'opacity-40 pointer-events-none' : 'opacity-100'
              } ${
                triageResult.priority === 'P1'
                  ? 'bg-red-50/90 border-red-500 text-red-950'
                  : triageResult.priority === 'P2'
                  ? 'bg-amber-50/90 border-amber-500 text-amber-950'
                  : 'bg-emerald-50/90 border-emerald-500 text-emerald-950'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black uppercase px-3 py-1 rounded-full text-white shadow-sm ${
                    triageResult.priority === 'P1' ? 'bg-red-600 animate-pulse' : triageResult.priority === 'P2' ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}>
                    {triageResult.triage_label || `${triageResult.priority} Triage`}
                  </span>
                  <span className="text-xs font-bold text-slate-500">
                    Confidence: {(triageResult.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>

                <div>
                  <h4 className="text-xl font-black">
                    {triageResult.priority === 'P1' ? t.p1_title : triageResult.priority === 'P2' ? t.p2_title : t.p3_title}
                  </h4>
                  <p className="text-xs font-semibold mt-1">
                    {triageResult.triage_reason}
                  </p>
                </div>

                {/* AI Model Badge */}
                <div className="flex items-center space-x-1.5 text-[11px] font-bold text-teal-800 bg-teal-100/90 px-2.5 py-1 rounded-xl border border-teal-200">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>{triageResult.ai_model || 'Gemini 3.6 Flash Clinical AI'}</span>
                </div>

                {/* AI Differential Diagnosis */}
                {triageResult.differential_diagnosis && triageResult.differential_diagnosis.length > 0 && (
                  <div className="p-3.5 bg-white/90 rounded-2xl border border-slate-200 space-y-1.5">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                      🩺 AI Differential Impression:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {triageResult.differential_diagnosis.map((diag, i) => (
                        <span key={i} className="px-2.5 py-1 bg-slate-100 text-slate-800 text-[11px] font-bold rounded-lg border border-slate-300">
                          {diag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Clinical Reasoning */}
                {triageResult.clinical_reasoning && (
                  <div className="p-3 bg-white/70 rounded-2xl border border-slate-200 text-xs text-slate-700">
                    <span className="font-bold text-slate-900 block mb-0.5">Clinical Evaluation:</span>
                    <p className="text-[11px] leading-relaxed text-slate-600 font-medium">{triageResult.clinical_reasoning}</p>
                  </div>
                )}

                {/* Red Flag Warnings */}
                {triageResult.red_flag_warnings && triageResult.red_flag_warnings.length > 0 && (
                  <div className="p-3 bg-rose-50/90 rounded-2xl border border-rose-200 text-xs text-rose-950 space-y-1">
                    <span className="font-black text-rose-900 text-[11px] uppercase tracking-wide">
                      🚨 Danger Signs / Red Flags:
                    </span>
                    <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-800 font-medium">
                      {triageResult.red_flag_warnings.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommended Investigations */}
                {triageResult.recommended_investigations && triageResult.recommended_investigations.length > 0 && (
                  <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-200 text-xs text-blue-950 space-y-1">
                    <span className="font-bold text-blue-900 text-[11px] uppercase tracking-wide">
                      Recommended Investigations:
                    </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {triageResult.recommended_investigations.map((inv, i) => (
                        <span key={i} className="px-2 py-0.5 bg-blue-100/90 text-blue-800 rounded-md text-[10px] font-semibold">
                          {inv}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Facilities Card (Live DB Match: doctor availability > distance > stock) */}
                {triageResult.recommended_facilities && triageResult.recommended_facilities.length > 0 && (
                  <div className="p-4 bg-white/95 rounded-2xl border-2 border-teal-200/80 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-teal-700" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                          🏥 Recommended Facilities
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                        Doctor &gt; Distance &gt; Stock
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {triageResult.recommended_facilities.map((facility, idx) => (
                        <div key={facility.hospital_id || idx} className="p-3 bg-slate-50 hover:bg-teal-50/40 rounded-xl border border-slate-200/80 transition-colors space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                <span className="font-extrabold text-xs text-slate-900">{facility.hospital_name}</span>
                                {facility.category && (
                                  <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-md">
                                    {facility.category}
                                  </span>
                                )}
                                {facility.is_emergency_capable && (
                                  <span className="text-[10px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md border border-red-200">
                                    24x7 Emergency
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 font-semibold mt-0.5 flex items-center space-x-2">
                                <span>📍 {facility.distance_km} km away</span>
                                {facility.district && <span>• {facility.district}</span>}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-black text-teal-800 bg-teal-100 px-2 py-0.5 rounded-lg border border-teal-300">
                                {facility.score} pts
                              </span>
                            </div>
                          </div>

                          {/* Doctor & Availability Slot */}
                          {facility.doctor ? (
                            <div className="flex items-center space-x-1.5 text-[11px] text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 font-semibold">
                              <Stethoscope className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>
                                <strong>{facility.doctor.name}</strong> ({facility.doctor.speciality}) • Slot: {facility.doctor.next_slot || 'Today OPD'}
                              </span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg font-medium">
                              General OPD Consultation Available
                            </div>
                          )}

                          {/* Diagnostic Tests & Medicine Stock Status */}
                          <div className="flex items-center justify-between flex-wrap gap-1 text-[10px] font-semibold text-slate-600 pt-0.5">
                            <span>
                              🧪 Tests: <strong className="text-teal-800">{facility.tests_available?.length || 0} in stock</strong>
                            </span>
                            <span>
                              💊 Meds: <strong className="text-teal-800">{facility.medicine_stock_status?.filter(m => m.status === 'IN_STOCK').length || 0} ready</strong>
                            </span>
                          </div>

                          {/* Quick Action Button: Refer to this facility */}
                          <div className="flex items-center space-x-2 pt-1">
                            <button
                              type="button"
                              onClick={() => handleOpenTriageReferralModal(facility)}
                              className="flex-1 py-1.5 px-3 bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-800 hover:to-emerald-800 text-white font-extrabold text-[11px] rounded-lg shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer transition-all active:scale-98"
                            >
                              <Send className="w-3 h-3" />
                              <span>Refer to this facility</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedFacilityForAppt(facility.hospital_name);
                                setActiveTab('book_appointment');
                              }}
                              className="py-1.5 px-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[10px] rounded-lg border border-slate-300 flex items-center space-x-1 cursor-pointer"
                            >
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>Book OPD</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {triageReferralSuccessMsg && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{triageReferralSuccessMsg}</span>
                  </div>
                )}

                {triageResult.triggers && triageResult.triggers.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-200/60">
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-600">Clinical Triggers:</p>
                    {triageResult.triggers.map((trig, i) => (
                      <div key={i} className="flex items-center space-x-1.5 text-xs font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                        <span>{trig}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-3.5 bg-white/80 rounded-2xl border border-slate-200 text-xs font-semibold text-slate-700 space-y-1">
                  <p className="font-bold text-slate-900">Recommended Next Step:</p>
                  <p>{triageResult.recommended_action || "Visit nearest Primary Health Centre or book an OPD slot."}</p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => setActiveTab('book_appointment')}
                    className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Book Facility Appointment</span>
                  </button>

                  {triageResult.priority === 'P1' && (
                    <button
                      onClick={openSOS}
                      className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md animate-pulse cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>{t.call_ambulance_btn}</span>
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 text-center font-medium pt-1">
                  ⚠️ {t.verification_warning}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-16 h-16 bg-teal-50 text-teal-600 rounded-3xl flex items-center justify-center mx-auto text-2xl font-black">
                  🩺
                </div>
                <h4 className="text-base font-black text-slate-900">
                  {language === 'mr' ? 'AI प्राथमिक चाचणी निकाल येथे दिसेल' : language === 'hi' ? 'AI जांच परिणाम यहाँ दिखेगा' : 'Digital Triage Results'}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  {language === 'mr' 
                    ? 'डाव्या बाजूला रक्तदाब, SpO2, तापमान व लक्षणे भरा आणि "AI चाचणी निकाल तपासा" बटण दाबा.' 
                    : language === 'hi' 
                    ? 'बाईं ओर रक्तचाप, SpO2, तापमान व लक्षण दर्ज करें और "AI जांच परिणाम देखें" दबाएं।' 
                    : 'Fill vitals & symptoms on the left and click "Run AI Smart Triage" to calculate instant clinical priority.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 2. GOVERNMENT HOSPITAL DIRECTORY (CSV DATASET) ---------------- */}
      {/* ---------------- 2. AI SYMPTOM → HOSPITAL MATCHER ---------------- */}
      {activeTab === 'ai_matcher' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Input Form */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-5">
              <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">AI Hospital Matcher</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Describe your symptoms to find the best hospital</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block">Symptoms *</label>
                <textarea
                  id="ai-symptoms-input"
                  value={aiSymptoms}
                  onChange={e => setAiSymptoms(e.target.value)}
                  placeholder="e.g. Chest pain with breathlessness for 2 days, sweating..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-violet-400 outline-none resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Age</label>
                  <input
                    id="ai-age-input"
                    type="number"
                    value={aiAge}
                    onChange={e => setAiAge(e.target.value)}
                    placeholder="30"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-violet-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Sex</label>
                  <select
                    id="ai-sex-input"
                    value={aiSex}
                    onChange={e => setAiSex(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-violet-400 outline-none cursor-pointer"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">Duration</label>
                  <input
                    id="ai-duration-input"
                    value={aiDuration}
                    onChange={e => setAiDuration(e.target.value)}
                    placeholder="1 day"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-violet-400 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">District</label>
                  <input
                    id="ai-district-input"
                    value={aiDistrict}
                    onChange={e => setAiDistrict(e.target.value)}
                    placeholder="Pune"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-violet-400 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">Manual Specialty Override (optional)</label>
                <select
                  id="ai-manual-spec-input"
                  value={aiManualSpec}
                  onChange={e => setAiManualSpec(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-violet-400 outline-none cursor-pointer"
                >
                  <option value="">Let AI decide</option>
                  {aiEnums.specialities.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <button
                id="ai-match-submit"
                disabled={!aiSymptoms.trim() || aiLoading}
                onClick={async () => {
                  setAiLoading(true);
                  setAiError('');
                  setAiResult(null);
                  try {
                    const payload = {
                      symptoms: aiSymptoms,
                      age: parseInt(aiAge) || 30,
                      sex: aiSex,
                      duration: aiDuration || '1 day',
                      district: aiDistrict || registeredPatient?.district || undefined,
                      lat: gpsLocation?.lat || undefined,
                      lng: gpsLocation?.lng || undefined,
                      manual_speciality: aiManualSpec || undefined
                    };
                    const result = await api.matchSymptomToHospitals(payload);
                    setAiResult(result);
                  } catch (err) {
                    setAiError(err.message || 'Failed to match symptoms');
                  } finally {
                    setAiLoading(false);
                  }
                }}
                className={`w-full py-3.5 rounded-2xl text-sm font-black transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  !aiSymptoms.trim() || aiLoading
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-600/20'
                }`}
              >
                {aiLoading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Analyzing...</span></>
                ) : (
                  <><Zap className="w-4 h-4" /><span>Find Best Hospital</span></>
                )}
              </button>

              {aiError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />{aiError}
                </div>
              )}

              {/* Disclaimer */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                This is an AI-assisted navigational tool. It is <strong>not a substitute for clinical diagnosis</strong> or treatment by a qualified medical professional.
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="lg:col-span-2 space-y-4">
            {!aiResult && !aiLoading && (
              <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-200 text-center">
                <div className="w-16 h-16 rounded-3xl bg-violet-100 text-violet-500 flex items-center justify-center mx-auto mb-4">
                  <Stethoscope className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-800 mb-1">AI-Powered Hospital Matching</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto">Enter your symptoms on the left to get personalized hospital recommendations based on doctor availability, diagnostic tests, medicine stock, and proximity.</p>
              </div>
            )}

            {aiLoading && (
              <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-200 text-center">
                <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto mb-4" />
                <h3 className="text-base font-black text-slate-800 mb-1">Analyzing Symptoms...</h3>
                <p className="text-xs text-slate-500">AI is reasoning through your symptoms and ranking hospitals from live data.</p>
              </div>
            )}

            {aiResult && (
              <div className="space-y-4">
                {/* Emergency Override Banner */}
                {aiResult.emergency_override && (
                  <div className="bg-red-600 text-white rounded-2xl p-5 shadow-lg border-2 border-red-400 animate-pulse">
                    <div className="flex items-start space-x-3">
                      <Siren className="w-6 h-6 shrink-0 mt-0.5" />
                      <div>
                        <h3 className="text-base font-black">EMERGENCY ALERT</h3>
                        <p className="text-sm mt-1 opacity-95">{aiResult.emergency_override.alert_message}</p>
                        {aiResult.emergency_override.nearest_facility && (
                          <div className="mt-3 bg-white/15 backdrop-blur-sm rounded-xl p-3">
                            <p className="text-xs font-bold">Nearest Emergency Facility:</p>
                            <p className="text-sm font-black mt-0.5">{aiResult.emergency_override.nearest_facility.hospital_name}</p>
                            <p className="text-xs opacity-90 mt-0.5">{aiResult.emergency_override.nearest_facility.address}</p>
                            <div className="flex items-center space-x-3 mt-2 text-xs">
                              <span><Phone className="w-3 h-3 inline mr-1" />{aiResult.emergency_override.nearest_facility.phone || '108'}</span>
                              <span><MapPin className="w-3 h-3 inline mr-1" />{aiResult.emergency_override.nearest_facility.distance_km} km</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Assessment Summary */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-violet-600" />
                      <h3 className="text-sm font-black text-slate-900">AI Assessment</h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl ${
                        aiResult.assessment.urgency === 'EMERGENCY' ? 'bg-red-100 text-red-800 border border-red-300' :
                        aiResult.assessment.urgency === 'URGENT' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>{aiResult.assessment.urgency}</span>
                      {aiResult.assessment.cached && <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">Cached</span>}
                      {aiResult.assessment.fallback_used && <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg">Rule-Based</span>}
                    </div>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed mb-3">{aiResult.assessment.summary}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <p className="text-[10px] font-bold text-slate-500 mb-1">Specialities</p>
                      {aiResult.assessment.specialities.map((s, i) => (
                        <span key={i} className="inline-block text-[11px] font-bold text-violet-800 bg-violet-100 px-2 py-0.5 rounded-lg mr-1 mb-1">{s.name} ({Math.round(s.confidence * 100)}%)</span>
                      ))}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <p className="text-[10px] font-bold text-slate-500 mb-1">Suggested Tests</p>
                      {aiResult.assessment.suggested_tests.map((t, i) => (
                        <span key={i} className="inline-block text-[11px] font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-lg mr-1 mb-1">{t}</span>
                      ))}
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5">
                      <p className="text-[10px] font-bold text-slate-500 mb-1">Medicine Categories</p>
                      {aiResult.assessment.medicine_categories.map((m, i) => (
                        <span key={i} className="inline-block text-[11px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-lg mr-1 mb-1">{m}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Ranked Hospitals */}
                <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
                  <h3 className="text-sm font-black text-slate-900 mb-3 flex items-center space-x-2">
                    <Building2 className="w-4 h-4 text-teal-600" />
                    <span>Top {aiResult.ranked_hospitals.length} Matched Hospitals (Live Ranking)</span>
                  </h3>
                  <div className="space-y-3">
                    {aiResult.ranked_hospitals.map((hosp, idx) => {
                      const isExpanded = aiExpandedHosp === hosp.hospital_id;
                      return (
                        <div key={hosp.hospital_id} className={`rounded-2xl border transition-all ${
                          idx === 0 && aiResult.emergency_override ? 'border-red-300 bg-red-50/30' :
                          idx === 0 ? 'border-violet-300 bg-violet-50/30' : 'border-slate-200 bg-slate-50/30'
                        }`}>
                          <div
                            className="p-4 cursor-pointer"
                            onClick={() => setAiExpandedHosp(isExpanded ? null : hosp.hospital_id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${
                                  idx === 0 ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-600'
                                }`}>#{idx + 1}</div>
                                <div>
                                  <h4 className="text-sm font-black text-slate-900">{hosp.hospital_name}</h4>
                                  <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
                                    {hosp.category && <span>{hosp.category}</span>}
                                    {hosp.district && <><span>·</span><span>{hosp.district}</span></>}
                                    <span>·</span><span><MapPin className="w-3 h-3 inline" /> {hosp.distance_km} km</span>
                                    {hosp.is_emergency_capable && <span className="text-red-600 font-bold"><Siren className="w-3 h-3 inline" /> Emergency</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center space-x-3">
                                <div className="text-right">
                                  <p className="text-lg font-black text-violet-700">{hosp.score.toFixed(1)}</p>
                                  <p className="text-[10px] text-slate-400 font-bold">/ 100 pts</p>
                                </div>
                                {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                              </div>
                            </div>

                            {/* Score Bars */}
                            <div className="grid grid-cols-4 gap-2 mt-3">
                              {[
                                { label: 'Doctor', score: hosp.score_breakdown.doctor_score, max: 40, color: 'bg-violet-500' },
                                { label: 'Tests', score: hosp.score_breakdown.test_score, max: 25, color: 'bg-teal-500' },
                                { label: 'Medicines', score: hosp.score_breakdown.medicine_score, max: 20, color: 'bg-blue-500' },
                                { label: 'Distance', score: hosp.score_breakdown.distance_score, max: 15, color: 'bg-amber-500' }
                              ].map(bar => (
                                <div key={bar.label}>
                                  <div className="flex items-center justify-between text-[10px] mb-0.5">
                                    <span className="text-slate-500 font-bold">{bar.label}</span>
                                    <span className="text-slate-700 font-black">{bar.score}/{bar.max}</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${bar.color}`} style={{ width: `${(bar.score / bar.max) * 100}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                              {/* Doctor */}
                              {hosp.doctor && (
                                <div className="flex items-start space-x-3 p-3 bg-white rounded-xl border border-slate-200">
                                  <Stethoscope className="w-4 h-4 text-violet-600 mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-xs font-black text-slate-900">{hosp.doctor.name}</p>
                                    <p className="text-[11px] text-slate-600">{hosp.doctor.speciality}{hosp.doctor.qualification ? ` · ${hosp.doctor.qualification}` : ''}</p>
                                    {hosp.doctor.next_slot && <p className="text-[11px] text-teal-700 font-bold mt-0.5"><Clock className="w-3 h-3 inline mr-1" />Next: {hosp.doctor.next_slot}</p>}
                                  </div>
                                </div>
                              )}

                              {/* Tests */}
                              <div className="p-3 bg-white rounded-xl border border-slate-200">
                                <p className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center"><TestTube2 className="w-3.5 h-3.5 mr-1 text-teal-600" />Diagnostic Tests</p>
                                <div className="flex flex-wrap gap-1">
                                  {hosp.tests_available.map((t, i) => (
                                    <span key={i} className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-lg"><CheckCircle className="w-2.5 h-2.5 inline mr-0.5" />{t}</span>
                                  ))}
                                  {hosp.tests_missing.map((t, i) => (
                                    <span key={i} className="text-[10px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-lg"><X className="w-2.5 h-2.5 inline mr-0.5" />{t}</span>
                                  ))}
                                  {hosp.tests_available.length === 0 && hosp.tests_missing.length === 0 && (
                                    <span className="text-[10px] text-slate-400">No test data registered</span>
                                  )}
                                </div>
                              </div>

                              {/* Medicine Stock */}
                              {hosp.medicine_stock_status.length > 0 && (
                                <div className="p-3 bg-white rounded-xl border border-slate-200">
                                  <p className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center"><Pill className="w-3.5 h-3.5 mr-1 text-blue-600" />Medicine Stock</p>
                                  <div className="flex flex-wrap gap-1">
                                    {hosp.medicine_stock_status.map((m, i) => (
                                      <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                                        m.status === 'IN_STOCK' ? 'text-emerald-800 bg-emerald-100' :
                                        m.status === 'LOW_STOCK' ? 'text-amber-800 bg-amber-100' :
                                        'text-red-700 bg-red-100'
                                      }`}>{m.category}: {m.status.replace('_', ' ')}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Contact */}
                              <div className="flex items-center space-x-4 text-xs text-slate-600">
                                {hosp.phone && <span className="flex items-center space-x-1"><Phone className="w-3 h-3" /><span>{hosp.phone}</span></span>}
                                {hosp.address && <span className="flex items-center space-x-1"><MapPin className="w-3 h-3" /><span>{hosp.address}</span></span>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {aiResult.ranked_hospitals.length === 0 && (
                      <div className="p-6 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl">
                        No hospitals found matching the assessed specialities in your area.
                      </div>
                    )}
                  </div>
                </div>

                {/* Disclaimer Footer */}
                <div className="p-3 rounded-xl bg-slate-100 text-slate-600 text-[11px] font-medium text-center">
                  {aiResult.disclaimer}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'facilities' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-5 gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xl font-black text-slate-900">
                    {language === 'mr' ? 'शासकीय व नोंदणीकृत रुग्णालय निर्देशिका (महाराष्ट्र)' : language === 'hi' ? 'सरकारी एवं पंजीकृत अस्पताल निर्देशिका (महाराष्ट्र)' : 'Government & Registered Hospital Directory (Maharashtra)'}
                  </h3>
                  <span className="bg-teal-100 text-teal-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-teal-300">
                    Official Directory
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-1 flex flex-wrap items-center gap-1.5">
                  <span>📍 {language === 'mr' ? 'स्थानिक क्षेत्र:' : language === 'hi' ? 'स्थानीय क्षेत्र:' : 'Active Location:'} <strong>{registeredPatient?.village || 'Maharashtra'}</strong></span>
                  {registeredPatient?.taluka && (
                    <>
                      <span>•</span>
                      <span>{language === 'mr' ? 'तालुका:' : language === 'hi' ? 'तालुका:' : 'Taluka:'} <strong>{registeredPatient.taluka}</strong></span>
                    </>
                  )}
                  {registeredPatient?.district && (
                    <>
                      <span>•</span>
                      <span>{language === 'mr' ? 'जिल्हा:' : language === 'hi' ? 'जिला:' : 'District:'} <strong className="text-teal-700">{registeredPatient.district}</strong></span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center space-x-2 bg-slate-50 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200">
                <Building2 className="w-4 h-4 text-teal-600" />
                <span>{facilities.length} Hospitals Found</span>
              </div>
            </div>

            {/* Search Bar & Category Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={hospitalSearch}
                  onChange={(e) => setHospitalSearch(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                  placeholder={
                    language === 'mr'
                      ? 'रुग्णालयाचे नाव, विशेषता किंवा पत्ता शोधा...'
                      : language === 'hi'
                      ? 'अस्पताल का नाम, विशेषता या पता खोजें...'
                      : 'Search hospital by name, specialty or address...'
                  }
                />
              </div>

              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
                {['All', 'Hospital', 'Nursing Home', 'Clinic'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setHospitalCategoryFilter(cat)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      hospitalCategoryFilter === cat
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Hospital Cards Grid from CSV Dataset */}
            {loadingFacilities ? (
              <div className="py-12 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                <span>Loading authentic Maharashtra hospital records...</span>
              </div>
            ) : facilities.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {facilities.map((fac) => {
                  const specialtiesList = fac.specialties
                    ? fac.specialties.split(/,|\n/).map(s => s.trim()).filter(s => s && s !== '0' && s !== '0.0')
                    : [];
                  const facilitiesList = fac.facilities
                    ? fac.facilities.split(/,|\n/).map(f => f.trim()).filter(f => f && f !== '0' && f !== '0.0')
                    : [];

                  return (
                    <div
                      key={fac.id}
                      className="p-5 rounded-3xl bg-slate-50 border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all space-y-3.5 flex flex-col justify-between"
                    >
                      <div className="space-y-2.5">
                        {/* Header Badges */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="bg-teal-100 text-teal-900 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-teal-200 uppercase">
                              {fac.care_type || 'Hospital'}
                            </span>
                            {fac.category && fac.category !== '0' && (
                              <span className="bg-slate-200 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {fac.category}
                              </span>
                            )}
                          </div>

                          {fac.distance_km !== undefined && (
                            <span className="text-xs font-black text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200 font-mono shrink-0">
                              {fac.distance_km} km
                            </span>
                          )}
                        </div>

                        {/* Hospital Name */}
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                            {fac.name}
                          </h4>
                          <p className="text-xs text-slate-500 font-medium mt-1 flex items-start space-x-1">
                            <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                            <span>
                              {fac.address || `${fac.district}, Maharashtra`}
                              {fac.pincode && ` (PIN: ${fac.pincode})`}
                            </span>
                          </p>
                        </div>

                        {/* Metric Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          {fac.beds && typeof fac.beds === 'number' && fac.beds > 0 && (
                            <span className="bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                              🛏️ {fac.beds} Beds
                            </span>
                          )}
                          {fac.doctors && (typeof fac.doctors === 'number' ? fac.doctors > 0 : true) && (
                            <span className="bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                              👨‍⚕️ {fac.doctors} Doctors / Experts
                            </span>
                          )}
                          {fac.emergency_services && fac.emergency_services !== '0' && (
                            <span className="bg-red-50 text-red-800 border border-red-200 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                              🚨 Emergency: {fac.emergency_services}
                            </span>
                          )}
                          {fac.ambulance && fac.ambulance !== '0' && (
                            <span className="bg-amber-50 text-amber-900 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                              🚑 Ambulance: {fac.ambulance}
                            </span>
                          )}
                          {fac.status && (
                            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                              🟢 {fac.status}
                            </span>
                          )}
                        </div>

                        {/* Specialties Tags */}
                        {specialtiesList.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Specialties:</p>
                            <div className="flex flex-wrap gap-1">
                              {specialtiesList.slice(0, 5).map((spec, i) => (
                                <span key={i} className="bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                                  {spec}
                                </span>
                              ))}
                              {specialtiesList.length > 5 && (
                                <span className="text-[10px] text-teal-700 font-bold self-center">
                                  +{specialtiesList.length - 5} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Facilities Tags */}
                        {facilitiesList.length > 0 && (
                          <div className="space-y-1 pt-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Facilities:</p>
                            <div className="flex flex-wrap gap-1">
                              {facilitiesList.slice(0, 4).map((f, i) => (
                                <span key={i} className="bg-emerald-50/60 border border-emerald-200 text-emerald-900 text-[10px] font-medium px-2 py-0.5 rounded-md">
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Action Buttons */}
                      <div className="space-y-2 pt-3 border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFacilityForAppt(fac.name);
                              setActiveTab('book_appointment');
                            }}
                            className="flex items-center justify-center space-x-1.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Book OPD</span>
                          </button>
                          {fac.phone ? (
                            <a
                              href={`tel:${fac.phone}`}
                              className="flex items-center justify-center space-x-1.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5 text-teal-600" />
                              <span className="truncate">{fac.phone}</span>
                            </a>
                          ) : (
                            <div className="flex items-center justify-center space-x-1.5 py-2.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-xs font-semibold">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>In-person Walk-in</span>
                            </div>
                          )}
                        </div>

                        {/* Phase 1: Public Services, Doctors & Pharmacy Catalog */}
                        <button
                          type="button"
                          onClick={() => handleOpenHospitalServices(fac)}
                          className="w-full flex items-center justify-center space-x-1.5 py-2 bg-slate-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-300 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        >
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                          <span>View Specialist Doctors, Tests & Rates</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl space-y-2">
                <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-bold text-slate-700">No matching hospital found in {registeredPatient?.district || 'this area'}</p>
                <p className="text-slate-400">Try clearing your search query or selecting another district in your profile.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- 3. BOOK APPOINTMENT TAB ---------------- */}
      {activeTab === 'book_appointment' && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <Calendar className="w-6 h-6 text-teal-600" />
                <h3 className="text-xl font-black text-slate-900">
                  {language === 'mr' ? 'आरोग्य केंद्र अपॉइंटमेंट बुकिंग' : language === 'hi' ? 'स्वास्थ्य केंद्र अपॉइंटमेंट बुकिंग' : 'Book Facility Appointment'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Book a consultation at Health Centres, Clinics or Referral Hospitals. Shared instantly with the Doctor & Clinic queues.
              </p>
            </div>

            {bookingSuccessMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{bookingSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleBookAppointment} className="space-y-4 text-xs font-bold">
              <div>
                <label className="text-slate-700 block mb-1">Select Healthcare Facility *</label>
                <select
                  value={selectedFacilityForAppt}
                  onChange={(e) => setSelectedFacilityForAppt(e.target.value)}
                  className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                >
                  {facilities.map((f) => (
                    <option key={f.id} value={f.name}>
                      {f.name} ({f.distance_km} km) - {f.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-700 block mb-1">Appointment Date *</label>
                  <input
                    type="date"
                    required
                    value={apptDate}
                    onChange={(e) => setApptDate(e.target.value)}
                    className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1">Preferred Time Slot *</label>
                  <select
                    value={apptTimeSlot}
                    onChange={(e) => setApptTimeSlot(e.target.value)}
                    className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  >
                    <option value="09:30 AM - 10:00 AM">09:30 AM - 10:00 AM</option>
                    <option value="10:00 AM - 10:30 AM">10:00 AM - 10:30 AM (Recommended)</option>
                    <option value="11:00 AM - 11:30 AM">11:00 AM - 11:30 AM</option>
                    <option value="02:00 PM - 02:30 PM">02:00 PM - 02:30 PM</option>
                    <option value="03:30 PM - 04:00 PM">03:30 PM - 04:00 PM</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Consultation Reason / Symptoms</label>
                <input
                  type="text"
                  value={apptReason}
                  onChange={(e) => setApptReason(e.target.value)}
                  className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none bg-slate-50"
                  placeholder="e.g. High blood pressure checkup, fever review..."
                />
              </div>

              <div className="p-4 bg-teal-50/80 rounded-2xl border border-teal-200 text-teal-900 text-xs space-y-1">
                <p>👤 <strong>Patient:</strong> {registeredPatient?.name} ({registeredPatient?.age} yrs, {registeredPatient?.phone})</p>
                <p>🏥 <strong>Assigned Facility:</strong> {selectedFacilityForAppt || 'Selected Primary Care Center'}</p>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-2xl font-black text-base shadow-lg shadow-teal-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Confirm & Book Appointment</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ---------------- 4. DIGITAL HEALTH RECORDS & ABHA ---------------- */}
      {activeTab === 'records' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {language === 'mr' ? 'डिजिटल आरोग्य नोंदी व आभा कार्ड' : language === 'hi' ? 'डिजिटल स्वास्थ्य रिकॉर्ड व आभा कार्ड' : 'Digital Health Records & ABHA History'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Unified Longitudinal Health Records aligned with Ayushman Bharat Digital Mission (ABDM)
                </p>
              </div>
              <button
                onClick={() => openAbha(registeredPatient)}
                className="px-4 py-2 bg-amber-400 text-slate-950 rounded-xl font-black text-xs hover:bg-amber-300 transition-all shadow-sm cursor-pointer"
              >
                View ABHA Card
              </button>
            </div>

            {/* Official ABDM Longitudinal Clinical Records */}
            {registeredPatient?.records && registeredPatient.records.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-extrabold text-teal-900 flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-teal-600" />
                  <span>Official ABDM Clinical Records & Lab Reports:</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {registeredPatient.records.map((rec, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-teal-200 text-teal-900 border border-teal-300">
                          {rec.type}
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">{rec.date}</span>
                      </div>
                      <h5 className="font-extrabold text-slate-900 text-sm">{rec.title}</h5>
                      {rec.code && <p className="text-[11px] font-mono text-teal-800">Code: {rec.code}</p>}
                      {rec.doctor && <p className="text-slate-600"><strong>Practitioner:</strong> {rec.doctor}</p>}
                      {rec.facility && <p className="text-slate-500"><strong>Facility:</strong> {rec.facility}</p>}
                      {rec.notes && <p className="text-slate-700 bg-white p-2.5 rounded-xl border border-teal-100">{rec.notes}</p>}
                      {rec.results && <p className="text-slate-700 bg-white p-2.5 rounded-xl border border-teal-100"><strong>Lab Results:</strong> {rec.results}</p>}
                      {rec.medications && (
                        <div className="bg-white p-2.5 rounded-xl border border-teal-100">
                          <strong className="text-slate-800 block mb-1">Medications:</strong>
                          <ul className="list-disc list-inside space-y-0.5 text-slate-700">
                            {rec.medications.map((m, mIdx) => (
                              <li key={mIdx}>{m}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Past Triage & Prescription List */}
            <div className="space-y-3">
              <h4 className="text-sm font-extrabold text-slate-800">Local Grid Triage & Doctor Consultations:</h4>
              {pastTriageRecords.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                  No local consultations recorded yet. Submit symptoms on Tab 1 to initiate triage.
                </div>
              ) : (
                pastTriageRecords.map((r) => (
                  <div key={r.id || r.local_id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                          r.priority === 'P1' ? 'bg-red-100 text-red-800' : r.priority === 'P2' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {r.priority} Priority
                        </span>
                        <span className="font-extrabold text-slate-900 text-sm">{r.patient_name}</span>
                      </div>
                      <span className="text-slate-400 font-mono text-[11px]">{r.created_at?.slice(0, 10)}</span>
                    </div>

                    <p className="text-slate-600"><strong>Triage Reason:</strong> {r.triage_reason}</p>
                    
                    {r.prescription && (
                      <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-950 font-mono text-xs">
                        <strong>Rx Prescribed by {r.doctor_name || 'Medical Officer'}:</strong>
                        <p className="whitespace-pre-line mt-1">{r.prescription}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 5. REFERRAL TRACKING TAB ---------------- */}
      {activeTab === 'referrals' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-xl font-black text-slate-900">
                {language === 'mr' ? 'सक्रिय रेफरल स्थिती ट्रॅकर' : language === 'hi' ? 'सक्रिय रेफरल स्थिति ट्रैकर' : 'Live Referral Tracking'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Real-time lifecycle tracking across Primary, Secondary, and Tertiary facilities
              </p>
            </div>

            <div className="space-y-4">
              {referrals.map((ref) => {
                const statuses = ['Pending', 'Accepted', 'Patient Arrived', 'Completed', 'Follow-up'];
                const currentIdx = statuses.indexOf(ref.status);

                return (
                  <div key={ref.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          ref.priority === 'P1' ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
                        }`}>
                          {ref.priority} {ref.urgency}
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-1">
                          {ref.patient_name} ({ref.age} yrs)
                        </h4>
                        <p className="text-xs text-slate-500">
                          {ref.source_facility} &rarr; <strong className="text-teal-700">{ref.target_facility}</strong>
                        </p>
                      </div>

                      <span className="text-xs font-extrabold bg-teal-100 text-teal-900 px-3 py-1 rounded-xl border border-teal-300">
                        Status: {ref.status}
                      </span>
                    </div>

                    {/* Progression Bar */}
                    <div className="grid grid-cols-5 gap-1.5 pt-2">
                      {statuses.map((st, idx) => {
                        const isDone = currentIdx >= idx;
                        const isCurrent = currentIdx === idx;
                        return (
                          <div key={st} className="text-center space-y-1">
                            <div className={`h-2 rounded-full transition-all ${
                              isCurrent ? 'bg-teal-600 animate-pulse' : isDone ? 'bg-emerald-500' : 'bg-slate-200'
                            }`} />
                            <span className={`text-[10px] font-bold block truncate ${
                              isDone ? 'text-teal-900' : 'text-slate-400'
                            }`}>
                              {st}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                      <strong>Clinical Reason:</strong> {ref.reason} <br />
                      <strong>Transport:</strong> {ref.transport_mode}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 6. FOLLOW-UP & HOME CARE TAB ---------------- */}
      {activeTab === 'followup' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h3 className="text-xl font-black text-slate-900">
                {language === 'mr' ? 'फॉलो-अप व गृहदेखभाल सूचना' : language === 'hi' ? 'फॉलो-अप व गृह देखभाल निर्देश' : 'Post-Consultation Follow-up & Care'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Care plans, ASHA home checkups, and medication schedules
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-teal-50/80 border border-teal-200 space-y-3">
                <div className="flex items-center space-x-2">
                  <Pill className="w-5 h-5 text-teal-700" />
                  <h4 className="text-sm font-black text-teal-950">Active Medication Regimen</h4>
                </div>
                <div className="text-xs text-teal-900 space-y-1.5 font-medium">
                  <p>💊 <strong>Tab Paracetamol 500mg</strong> - 1 tab TDS after food x 3 days</p>
                  <p>💊 <strong>Tab Calcium + Vit D3</strong> - 1 tab OD after breakfast x 30 days</p>
                  <p>💧 <strong>ORS Hydration Solution</strong> - 1 sachet in 1 liter clean water</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-purple-50/80 border border-purple-200 space-y-3">
                <div className="flex items-center space-x-2">
                  <HeartHandshake className="w-5 h-5 text-purple-700" />
                  <h4 className="text-sm font-black text-purple-950">ASHA Home Visit Follow-up</h4>
                </div>
                <p className="text-xs text-purple-900 font-medium leading-relaxed">
                  Assigned Community Health Worker (ASHA) is scheduled for routine blood pressure monitoring and health checkup on <strong>Tomorrow, 11:00 AM</strong>.
                </p>
                <button
                  onClick={() => alert("Community Health Worker notified of your follow-up checkup request!")}
                  className="w-full py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  Request Early ASHA Visit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- 7. PROFILE & ABHA EDIT TAB ---------------- */}
      {activeTab === 'profile' && (
        <div className="max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-xl font-black text-slate-900">Patient Profile & ABHA Identity</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Manage personal details and Ayushman Bharat Health Account
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
              />
            </div>

            {/* Maharashtra Village Search & Selection */}
            <div>
              <VillageSearchSelect
                selectedVillage={regForm.village}
                selectedTaluka={regForm.taluka}
                selectedDistrict={regForm.district}
                onSelect={(val) => {
                  setRegForm({
                    ...regForm,
                    village: val.village,
                    taluka: val.taluka,
                    district: val.district
                  });
                }}
                language={language}
                required={true}
              />
            </div>

            <div>
              <label className="text-slate-700 block mb-1">
                {language === 'mr' ? 'वाडा / गल्ली / परिसर' : language === 'hi' ? 'वाडा / गली / क्षेत्र' : 'Wadi / Street / Area'}
              </label>
              <input
                type="text"
                value={regForm.wadi || ''}
                onChange={(e) => setRegForm({ ...regForm, wadi: e.target.value })}
                className="w-full p-3.5 rounded-2xl border border-slate-300 text-sm font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                placeholder="e.g. Gavthan, Patil Wadi, Navpada..."
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-teal-600 hover:bg-teal-700 active:scale-98 text-white rounded-2xl font-black text-base shadow-lg shadow-teal-600/30 transition-all mt-4 cursor-pointer"
            >
              Update Profile Details
            </button>
          </form>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 1: HOSPITAL PUBLIC SERVICES & DOCTORS MODAL FOR CITIZENS / PATIENTS */}
      {/* ========================================================================= */}
      {hospitalServicesModalOpen && selectedHospitalForServices && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 animate-fadeIn my-8 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                  🏥
                </div>
                <div>
                  <span className="bg-teal-100 text-teal-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">
                    {selectedHospitalForServices.care_type || 'PUBLIC HEALTHCARE FACILITY'}
                  </span>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 mt-0.5">
                    {selectedHospitalForServices.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium flex items-center space-x-1">
                    <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                    <span>{selectedHospitalForServices.address || selectedHospitalForServices.district || 'Maharashtra'}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setHospitalServicesModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Sub-Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-200 py-3 shrink-0">
              {[
                { id: 'doctors', label: `Specialist Doctors (${hospitalDoctors.length})`, icon: Stethoscope },
                { id: 'tests', label: `Diagnostic Tests & Rates (${hospitalTests.length})`, icon: FlaskConical },
                { id: 'pharmacy', label: `Pharmacy Stock (${hospitalPharmacy.items?.length || 0})`, icon: Pill }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeHospitalServiceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveHospitalServiceTab(tab.id)}
                    className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body Content (Scrollable) */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
              {loadingHospitalServices ? (
                <div className="p-12 text-center text-slate-500">
                  <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-xs font-bold">Loading official facility records...</p>
                </div>
              ) : (
                <>
                  {/* DOCTORS TAB */}
                  {activeHospitalServiceTab === 'doctors' && (
                    <div className="space-y-3">
                      {hospitalDoctors.length > 0 ? (
                        hospitalDoctors.map(doc => (
                          <div key={doc.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="bg-teal-100 text-teal-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                  {doc.speciality}
                                </span>
                                <h4 className="text-sm font-black text-slate-900 mt-1">{doc.name}</h4>
                                <p className="text-xs text-slate-500">{doc.qualification} {doc.experience_years > 0 ? `• ${doc.experience_years} yrs exp` : ''}</p>
                              </div>
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                Available for Consultation
                              </span>
                            </div>

                            {/* Slots */}
                            {doc.availability_slots && doc.availability_slots.length > 0 && (
                              <div className="bg-white p-2.5 rounded-xl border border-slate-200 space-y-1">
                                <p className="text-[10px] font-black uppercase text-slate-400">OPD Timetable:</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                  {doc.availability_slots.map((s, i) => (
                                    <div key={i} className="text-[11px] text-slate-700 flex items-center justify-between bg-slate-50 px-2 py-1 rounded-lg">
                                      <span className="font-bold">{s.day}</span>
                                      <span className="font-mono text-teal-800">{s.start_time} - {s.end_time}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl">
                          No doctor schedules currently published for this facility.
                        </div>
                      )}
                    </div>
                  )}

                  {/* TESTS TAB */}
                  {activeHospitalServiceTab === 'tests' && (
                    <div className="space-y-3">
                      {hospitalTests.length > 0 ? (
                        hospitalTests.map(t => (
                          <div key={t.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              <span className="bg-purple-100 text-purple-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
                                {t.category}
                              </span>
                              <h4 className="text-sm font-black text-slate-900">{t.test_name}</h4>
                              {t.prep_notes && (
                                <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                                  📋 <strong>Prep:</strong> {t.prep_notes}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-black text-teal-900">₹{t.price.toFixed(2)}</p>
                              <p className="text-[10px] text-slate-500 font-semibold">⏱️ {t.turnaround_time || 'Same day'}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl">
                          No diagnostic tests catalog currently published for this facility.
                        </div>
                      )}
                    </div>
                  )}

                  {/* PHARMACY TAB */}
                  {activeHospitalServiceTab === 'pharmacy' && (
                    <div className="space-y-3">
                      {hospitalPharmacy.items && hospitalPharmacy.items.length > 0 ? (
                        hospitalPharmacy.items.map(p => (
                          <div key={p.id} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-black text-slate-900">{p.medicine_name}</h4>
                              <p className="text-[11px] text-slate-500">{p.generic_name}</p>
                            </div>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl ${
                              p.status === 'LOW_STOCK'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}>
                              {p.status === 'LOW_STOCK' ? 'Limited Availability' : 'In Stock'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl">
                          No pharmacy inventory list currently published for this facility.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-500">Government Healthcare Transparency Network</span>
              <button
                type="button"
                onClick={() => setHospitalServicesModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TRIAGE FACILITY REFERRAL MODAL (Additive Feature Flow) */}
      {/* ========================================================================= */}
      {triageReferralModalOpen && selectedFacilityForTriageReferral && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-md shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Create Facility Referral
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Pre-filled with AI Triage clinical evaluation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTriageReferralModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTriageReferral} className="space-y-3.5 text-xs font-bold">
              {/* Target Facility */}
              <div>
                <label className="text-slate-700 block mb-1">Target Healthcare Facility</label>
                <input
                  type="text"
                  readOnly
                  value={selectedFacilityForTriageReferral.hospital_name}
                  className="w-full p-3 bg-slate-100 rounded-xl border border-slate-300 text-slate-800 font-extrabold text-sm outline-none cursor-not-allowed"
                />
              </div>

              {/* Patient Info & Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Patient Name</label>
                  <input
                    type="text"
                    readOnly
                    value={patientName || 'Citizen Patient'}
                    className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Triage Priority</label>
                  <div className={`p-2.5 rounded-xl font-black text-center text-white ${
                    triageResult?.priority === 'P1' ? 'bg-red-600' : triageResult?.priority === 'P2' ? 'bg-amber-600' : 'bg-emerald-600'
                  }`}>
                    {triageResult?.triage_label || `${triageResult?.priority || 'P3'} Priority`}
                  </div>
                </div>
              </div>

              {/* Urgency & Transport */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1">Referral Urgency</label>
                  <select
                    value={triageReferralUrgency}
                    onChange={(e) => setTriageReferralUrgency(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    <option value="Immediate">Immediate (&lt; 1 Hour)</option>
                    <option value="Urgent">Urgent (&lt; 4 Hours)</option>
                    <option value="Routine">Routine (&lt; 24 Hours)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 block mb-1">Transport Mode</label>
                  <select
                    value={triageReferralTransport}
                    onChange={(e) => setTriageReferralTransport(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 rounded-xl border border-slate-300 font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
                  >
                    <option value="108 Emergency Ambulance">108 Emergency Ambulance</option>
                    <option value="PHC Vehicle / 102">PHC Vehicle / 102</option>
                    <option value="Private / Public Transport">Private / Public Transport</option>
                  </select>
                </div>
              </div>

              {/* Clinical Referral Reason */}
              <div>
                <label className="text-slate-700 block mb-1">Clinical Evaluation / Reason for Referral</label>
                <textarea
                  rows={3}
                  value={triageReferralReason}
                  onChange={(e) => setTriageReferralReason(e.target.value)}
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-300 font-medium text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                  placeholder="Clinical reasons for referral..."
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTriageReferralModalOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTriageReferral}
                  className="flex-1 py-3 bg-teal-700 hover:bg-teal-800 text-white font-black rounded-xl shadow-md flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingTriageReferral ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Confirm &amp; Refer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
