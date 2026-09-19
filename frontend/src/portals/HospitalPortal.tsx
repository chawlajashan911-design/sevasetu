// @ts-nocheck
import React, { useState, useEffect, useMemo } from 'react';
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
  Bed,
  Stethoscope,
  FlaskConical,
  Pill,
  Plus,
  Trash2,
  Edit3,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  X,
  SlidersHorizontal,
  ChevronDown,
  Info
} from 'lucide-react';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TEST_CATEGORIES = ['All', 'Pathology', 'Radiology', 'Cardiology', 'Biochemistry', 'Microbiology', 'General Diagnostics'];
const DOCTOR_SPECIALITIES = [
  'All',
  'General Medicine',
  'Cardiology',
  'Obstetrics & Gynecology',
  'Pediatrics',
  'Orthopedics',
  'Neurology',
  'Dermatology',
  'Ophthalmology',
  'ENT',
  'General Surgery',
  'Pulmonology'
];

export const HospitalPortal = ({ language = 'en' }) => {
  const t = translations[language] || translations.en;

  const [activeTab, setActiveTab] = useState('doctors');

  const [currentHospital, setCurrentHospital] = useState(null);
  const [showChangeHospital, setShowChangeHospital] = useState(false);

  // Existing Portal Data
  const [referrals, setReferrals] = useState([]);
  const [triageQueue, setTriageQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Phase 1 Data: Doctors, Tests, Pharmacy
  const [doctors, setDoctors] = useState([]);
  const [tests, setTests] = useState([]);
  const [pharmacyData, setPharmacyData] = useState({ total_items: 0, low_stock_count: 0, in_stock_count: 0, items: [] });
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingTests, setLoadingTests] = useState(false);
  const [loadingPharmacy, setLoadingPharmacy] = useState(false);

  // Doctors Filter & Search State
  const [doctorSearch, setDoctorSearch] = useState('');
  const [doctorSpecialityFilter, setDoctorSpecialityFilter] = useState('All');
  const [doctorActiveOnly, setDoctorActiveOnly] = useState(false);

  // Tests Filter & Search State
  const [testSearch, setTestSearch] = useState('');
  const [testCategoryFilter, setTestCategoryFilter] = useState('All');
  const [testAvailableOnly, setTestAvailableOnly] = useState(false);

  // Pharmacy Filter, Sort & Search State
  const [pharmacySearch, setPharmacySearch] = useState('');
  const [pharmacyStatusFilter, setPharmacyStatusFilter] = useState('ALL');
  const [pharmacySortBy, setPharmacySortBy] = useState('name');
  const [pharmacySortOrder, setPharmacySortOrder] = useState('asc');

  // Modals State
  const [isDoctorModalOpen, setIsDoctorModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [doctorForm, setDoctorForm] = useState({
    name: '',
    speciality: 'General Medicine',
    qualification: '',
    experience_years: 0,
    phone: '',
    is_active: true,
    availability_slots: [{ day: 'Monday', start_time: '09:00', end_time: '13:00', label: 'Morning OPD' }]
  });

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [testForm, setTestForm] = useState({
    test_name: '',
    category: 'Pathology',
    price: '',
    prep_notes: '',
    turnaround_time: '2 hours',
    is_available: true
  });

  const [isPharmacyModalOpen, setIsPharmacyModalOpen] = useState(false);
  const [editingPharmacy, setEditingPharmacy] = useState(null);
  const [pharmacyForm, setPharmacyForm] = useState({
    medicine_name: '',
    generic_name: '',
    quantity: '',
    unit: 'strips',
    reorder_threshold: '',
    batch_number: '',
    expiry_date: ''
  });

  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null); // { type: 'doctor' | 'test' | 'pharmacy', id: number, name: string }

  // Load active hospital from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sevasetu_hospital_details');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.name) {
          setCurrentHospital(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Error loading stored hospital:', e);
    }
    // Fallback default hospital
    setCurrentHospital({
      id: 'hospital_aundh',
      name: 'Aundh District Hospital',
      district: 'Pune',
      care_type: 'DISTRICT REFERRAL & TERTIARY HOSPITAL',
      category: 'Government District Hospital',
      address: 'Aundh Camp, Pune, Maharashtra 411027',
      beds: 350,
      phone: '020-27281234'
    });
  }, []);

  const hospitalId = currentHospital?.id || 'hospital_aundh';
  const hospitalName = currentHospital?.name || 'Secondary / Tertiary Referral Hospital';
  const hospitalDistrict = currentHospital?.district || 'Maharashtra';
  const hospitalAddress = currentHospital?.address || `${hospitalDistrict}, Maharashtra`;

  // Fetch legacy hospital data (referrals, triage, appointments)
  const loadHospitalData = async () => {
    setLoading(true);
    try {
      const [refsRes, queueRes, patsRes, apptsRes] = await Promise.allSettled([
        api.getReferrals(),
        api.getDoctorQueue(),
        api.getPatients(),
        api.getAppointments()
      ]);

      setReferrals(refsRes.status === 'fulfilled' ? refsRes.value || [] : []);
      setTriageQueue(queueRes.status === 'fulfilled' ? queueRes.value || [] : []);
      setPatients(patsRes.status === 'fulfilled' ? patsRes.value || [] : []);
      setAppointments(apptsRes.status === 'fulfilled' ? apptsRes.value || [] : []);
    } catch (e) {
      console.error('Hospital data fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch Phase 1 Doctors
  const loadDoctors = async () => {
    if (!hospitalId) return;
    setLoadingDoctors(true);
    try {
      const docs = await api.getHospitalDoctors(hospitalId, {
        speciality: doctorSpecialityFilter,
        active_only: doctorActiveOnly,
        search: doctorSearch
      });
      setDoctors(docs || []);
    } catch (e) {
      console.error('Failed to load doctors:', e);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Fetch Phase 1 Diagnostic Tests
  const loadTests = async () => {
    if (!hospitalId) return;
    setLoadingTests(true);
    try {
      const tdata = await api.getHospitalTests(hospitalId, {
        category: testCategoryFilter,
        available_only: testAvailableOnly,
        search: testSearch
      });
      setTests(tdata || []);
    } catch (e) {
      console.error('Failed to load tests:', e);
    } finally {
      setLoadingTests(false);
    }
  };

  // Fetch Phase 1 Pharmacy
  const loadPharmacy = async () => {
    if (!hospitalId) return;
    setLoadingPharmacy(true);
    try {
      const pdata = await api.getHospitalPharmacy(hospitalId, {
        status: pharmacyStatusFilter,
        sort_by: pharmacySortBy,
        sort_order: pharmacySortOrder,
        search: pharmacySearch
      });
      setPharmacyData(pdata || { total_items: 0, low_stock_count: 0, in_stock_count: 0, items: [] });
    } catch (e) {
      console.error('Failed to load pharmacy:', e);
    } finally {
      setLoadingPharmacy(false);
    }
  };

  useEffect(() => {
    loadHospitalData();
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [hospitalId, doctorSpecialityFilter, doctorActiveOnly, doctorSearch]);

  useEffect(() => {
    loadTests();
  }, [hospitalId, testCategoryFilter, testAvailableOnly, testSearch]);

  useEffect(() => {
    loadPharmacy();
  }, [hospitalId, pharmacyStatusFilter, pharmacySortBy, pharmacySortOrder, pharmacySearch]);

  // Handle Hospital Switch
  const handleSelectHospital = (hosp) => {
    setCurrentHospital(hosp);
    if (hosp) {
      localStorage.setItem('sevasetu_hospital_details', JSON.stringify(hosp));
      setShowChangeHospital(false);
    } else {
      localStorage.removeItem('sevasetu_hospital_details');
    }
  };

  // --- DOCTOR ACTIONS ---
  const handleOpenAddDoctor = () => {
    setEditingDoctor(null);
    setDoctorForm({
      name: '',
      speciality: 'General Medicine',
      qualification: '',
      experience_years: 0,
      phone: '',
      is_active: true,
      availability_slots: [{ day: 'Monday', start_time: '09:00', end_time: '13:00', label: 'Morning OPD' }]
    });
    setIsDoctorModalOpen(true);
  };

  const handleOpenEditDoctor = (doc) => {
    setEditingDoctor(doc);
    setDoctorForm({
      name: doc.name,
      speciality: doc.speciality,
      qualification: doc.qualification || '',
      experience_years: doc.experience_years || 0,
      phone: doc.phone || '',
      is_active: doc.is_active,
      availability_slots: doc.availability_slots?.length ? [...doc.availability_slots] : [{ day: 'Monday', start_time: '09:00', end_time: '13:00', label: 'Morning OPD' }]
    });
    setIsDoctorModalOpen(true);
  };

  const handleSaveDoctor = async (e) => {
    e.preventDefault();
    if (!doctorForm.name.trim()) return alert('Doctor name is required');
    try {
      if (editingDoctor) {
        await api.updateHospitalDoctor(editingDoctor.id, doctorForm, hospitalId);
      } else {
        await api.createHospitalDoctor(hospitalId, {
          ...doctorForm,
          hospital_id: hospitalId,
          hospital_name: hospitalName
        });
      }
      setIsDoctorModalOpen(false);
      loadDoctors();
    } catch (err) {
      alert('Error saving doctor: ' + (err.message || 'Failed'));
    }
  };

  const handleToggleDoctorActive = async (doc) => {
    try {
      await api.updateHospitalDoctor(doc.id, { is_active: !doc.is_active }, hospitalId);
      loadDoctors();
    } catch (err) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleAddSlot = () => {
    setDoctorForm(prev => ({
      ...prev,
      availability_slots: [...prev.availability_slots, { day: 'Wednesday', start_time: '09:00', end_time: '13:00', label: 'OPD Slot' }]
    }));
  };

  const handleRemoveSlot = (index) => {
    setDoctorForm(prev => ({
      ...prev,
      availability_slots: prev.availability_slots.filter((_, idx) => idx !== index)
    }));
  };

  const handleSlotChange = (index, field, value) => {
    setDoctorForm(prev => {
      const updated = [...prev.availability_slots];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, availability_slots: updated };
    });
  };

  // --- TEST ACTIONS ---
  const handleOpenAddTest = () => {
    setEditingTest(null);
    setTestForm({
      test_name: '',
      category: 'Pathology',
      price: '',
      prep_notes: '',
      turnaround_time: '2 hours',
      is_available: true
    });
    setIsTestModalOpen(true);
  };

  const handleOpenEditTest = (test) => {
    setEditingTest(test);
    setTestForm({
      test_name: test.test_name,
      category: test.category,
      price: test.price,
      prep_notes: test.prep_notes || '',
      turnaround_time: test.turnaround_time || '2 hours',
      is_available: test.is_available
    });
    setIsTestModalOpen(true);
  };

  const handleSaveTest = async (e) => {
    e.preventDefault();
    if (!testForm.test_name.trim()) return alert('Test name is required');
    if (!testForm.price || isNaN(Number(testForm.price))) return alert('Valid price is required');
    try {
      if (editingTest) {
        await api.updateHospitalTest(editingTest.id, { ...testForm, price: Number(testForm.price) }, hospitalId);
      } else {
        await api.createHospitalTest(hospitalId, {
          ...testForm,
          price: Number(testForm.price),
          hospital_id: hospitalId,
          hospital_name: hospitalName
        });
      }
      setIsTestModalOpen(false);
      loadTests();
    } catch (err) {
      alert('Error saving test: ' + (err.message || 'Failed'));
    }
  };

  const handleToggleTestAvailable = async (test) => {
    try {
      await api.updateHospitalTest(test.id, { is_available: !test.is_available }, hospitalId);
      loadTests();
    } catch (err) {
      alert('Error updating test availability: ' + err.message);
    }
  };

  // --- PHARMACY ACTIONS ---
  const handleOpenAddPharmacy = () => {
    setEditingPharmacy(null);
    setPharmacyForm({
      medicine_name: '',
      generic_name: '',
      quantity: '',
      unit: 'strips',
      reorder_threshold: '',
      batch_number: '',
      expiry_date: ''
    });
    setIsPharmacyModalOpen(true);
  };

  const handleOpenEditPharmacy = (item) => {
    setEditingPharmacy(item);
    setPharmacyForm({
      medicine_name: item.medicine_name,
      generic_name: item.generic_name,
      quantity: item.quantity,
      unit: item.unit,
      reorder_threshold: item.reorder_threshold,
      batch_number: item.batch_number || '',
      expiry_date: item.expiry_date || ''
    });
    setIsPharmacyModalOpen(true);
  };

  const handleSavePharmacy = async (e) => {
    e.preventDefault();
    if (!pharmacyForm.medicine_name.trim()) return alert('Medicine name is required');
    if (!pharmacyForm.generic_name.trim()) return alert('Generic name is required');
    if (pharmacyForm.quantity === '' || isNaN(Number(pharmacyForm.quantity))) return alert('Valid quantity is required');
    if (pharmacyForm.reorder_threshold === '' || isNaN(Number(pharmacyForm.reorder_threshold))) return alert('Valid reorder threshold is required');

    try {
      const payload = {
        ...pharmacyForm,
        quantity: Number(pharmacyForm.quantity),
        reorder_threshold: Number(pharmacyForm.reorder_threshold)
      };
      if (editingPharmacy) {
        await api.updateHospitalPharmacyItem(editingPharmacy.id, payload, hospitalId);
      } else {
        await api.createHospitalPharmacyItem(hospitalId, {
          ...payload,
          hospital_id: hospitalId,
          hospital_name: hospitalName
        });
      }
      setIsPharmacyModalOpen(false);
      loadPharmacy();
    } catch (err) {
      alert('Error saving medicine: ' + (err.message || 'Failed'));
    }
  };

  const handleQuickAdjustStock = async (item, delta) => {
    const nextQty = Math.max(0, item.quantity + delta);
    try {
      await api.updateHospitalPharmacyItem(item.id, { quantity: nextQty }, hospitalId);
      loadPharmacy();
    } catch (err) {
      alert('Error updating stock: ' + err.message);
    }
  };

  // --- DELETE CONFIRMATION ---
  const handleConfirmDelete = async () => {
    if (!deleteConfirmItem) return;
    try {
      if (deleteConfirmItem.type === 'doctor') {
        await api.deleteHospitalDoctor(deleteConfirmItem.id, hospitalId);
        loadDoctors();
      } else if (deleteConfirmItem.type === 'test') {
        await api.deleteHospitalTest(deleteConfirmItem.id, hospitalId);
        loadTests();
      } else if (deleteConfirmItem.type === 'pharmacy') {
        await api.deleteHospitalPharmacyItem(deleteConfirmItem.id, hospitalId);
        loadPharmacy();
      }
      setDeleteConfirmItem(null);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  // Legacy status progression
  const statusLifecycle = ['Pending', 'Accepted', 'Patient Arrived', 'Completed', 'Follow-up'];
  const getNextStatus = (currentStatus) => {
    const idx = statusLifecycle.indexOf(currentStatus);
    if (idx >= 0 && idx < statusLifecycle.length - 1) return statusLifecycle[idx + 1];
    return null;
  };

  const handleUpdateStatus = async (refId, nextStatus) => {
    try {
      await api.updateReferralStatus(refId, nextStatus);
      loadHospitalData();
    } catch (e) {
      alert('Status update error: ' + (e.message || 'Error'));
    }
  };

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
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Hospital Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-600 border-2 border-rose-400 flex items-center justify-center text-white shadow-lg shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-2 flex-wrap gap-1">
                <span className="bg-rose-500/20 text-rose-300 text-xs font-black uppercase px-2.5 py-0.5 rounded-full border border-rose-500/30">
                  {currentHospital?.care_type || 'DISTRICT REFERRAL HOSPITAL'}
                </span>
                {currentHospital?.category && (
                  <span className="bg-white/10 text-slate-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                    {currentHospital.category}
                  </span>
                )}
                <span className="bg-emerald-950 text-emerald-400 text-[10px] font-mono px-2 py-0.5 rounded-md border border-emerald-800">
                  Verified Facility Node
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white">
                {hospitalName}
              </h2>
              
              <p className="text-xs text-slate-300 font-medium flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>{hospitalAddress}</span>
                {currentHospital?.pincode && <span>(PIN: {currentHospital.pincode})</span>}
              </p>

              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {currentHospital?.beds && Number(currentHospital.beds) > 0 && (
                  <span className="bg-white/10 text-slate-200 text-xs font-bold px-2.5 py-0.5 rounded-lg flex items-center space-x-1">
                    <Bed className="w-3 h-3 text-rose-300" />
                    <span>{currentHospital.beds} Operational Beds</span>
                  </span>
                )}
                {currentHospital?.phone && (
                  <span className="bg-white/10 text-slate-200 text-xs font-semibold px-2.5 py-0.5 rounded-lg flex items-center space-x-1">
                    <Phone className="w-3 h-3 text-rose-300" />
                    <span>{currentHospital.phone}</span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowChangeHospital(!showChangeHospital)}
                  className="text-[11px] font-bold underline text-rose-400 hover:text-rose-300 ml-1 cursor-pointer"
                >
                  {showChangeHospital ? 'Close Switcher' : 'Switch Hospital'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700 text-xs font-bold text-slate-200 flex items-center space-x-2">
              <Stethoscope className="w-4 h-4 text-sky-400" />
              <span>Doctors: <strong>{doctors.length}</strong></span>
            </div>
            <div className="bg-slate-800/80 px-4 py-2.5 rounded-2xl border border-slate-700 text-xs font-bold text-slate-200 flex items-center space-x-2">
              <FlaskConical className="w-4 h-4 text-purple-400" />
              <span>Diagnostic Tests: <strong>{tests.length}</strong></span>
            </div>
            <div className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center space-x-2 ${
              pharmacyData.low_stock_count > 0 
                ? 'bg-red-950/80 text-red-200 border-red-800' 
                : 'bg-slate-800/80 text-slate-200 border-slate-700'
            }`}>
              <Pill className="w-4 h-4 text-emerald-400" />
              <span>Pharmacy Items: <strong>{pharmacyData.total_items}</strong></span>
              {pharmacyData.low_stock_count > 0 && (
                <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black animate-pulse">
                  {pharmacyData.low_stock_count} Low Stock
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Change Hospital Dropdown Panel */}
        {showChangeHospital && (
          <div className="mt-5 p-4 bg-slate-800 rounded-2xl border border-slate-700 animate-fadeIn">
            <HospitalSearchSelect
              selectedHospital={currentHospital}
              onSelect={handleSelectHospital}
              language={language}
            />
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 no-scrollbar border-b border-slate-200">
        {[
          { id: 'doctors', label: "Doctors & OPD Schedules", icon: Stethoscope, count: doctors.length },
          { id: 'tests', label: "Diagnostic Tests Catalog", icon: FlaskConical, count: tests.length },
          { id: 'pharmacy', label: "Pharmacy Inventory", icon: Pill, count: pharmacyData.total_items, alertCount: pharmacyData.low_stock_count },
          { id: 'incoming_referrals', label: "Incoming Referrals", icon: Truck, count: referrals.length },
          { id: 'high_risk', label: "High-Risk Board (P1)", icon: AlertOctagon, count: highRiskCases.length },
          { id: 'patient_records', label: "Patient Dossiers", icon: FileText, count: patients.length },
          { id: 'appointments', label: "Specialist OPD Bookings", icon: Calendar, count: appointments.length }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white text-rose-900' : 'bg-slate-100 text-slate-800 border border-slate-300'
                }`}>
                  {tab.count}
                </span>
              )}
              {tab.alertCount > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-black px-1.5 py-0.2 rounded-full animate-pulse">
                  {tab.alertCount} Alert
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. DOCTORS & OPD SCHEDULES MANAGEMENT (PHASE 1)                          */}
      {/* ========================================================================= */}
      {activeTab === 'doctors' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center space-x-2">
                  <Stethoscope className="w-5 h-5 text-rose-600" />
                  <span>Doctors & OPD Timetable Management</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Configure active specialist doctors, weekly OPD duty slots, and qualifications for {hospitalName}.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={loadDoctors}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDoctors ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleOpenAddDoctor}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md shadow-rose-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Specialist Doctor</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search doctor by name, qualification..."
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <select
                  value={doctorSpecialityFilter}
                  onChange={(e) => setDoctorSpecialityFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500 outline-none"
                >
                  {DOCTOR_SPECIALITIES.map(sp => (
                    <option key={sp} value={sp}>{sp === 'All' ? 'All Specialities' : sp}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="doctorActiveOnly"
                  checked={doctorActiveOnly}
                  onChange={(e) => setDoctorActiveOnly(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="doctorActiveOnly" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Show Active Doctors Only
                </label>
              </div>
            </div>
          </div>

          {/* Doctors Grid */}
          {loadingDoctors ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
              <div className="w-8 h-8 border-4 border-rose-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs font-bold">Loading Doctors...</p>
            </div>
          ) : doctors.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doc) => (
                <div
                  key={doc.id}
                  className={`bg-white rounded-3xl p-5 border-2 transition-all flex flex-col justify-between ${
                    doc.is_active ? 'border-slate-200 hover:border-rose-300' : 'border-slate-200 bg-slate-50/70 opacity-80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="bg-rose-100 text-rose-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                          {doc.speciality}
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-1">{doc.name}</h4>
                        <p className="text-xs text-slate-500 font-medium">
                          {doc.qualification || 'MBBS'} {doc.experience_years > 0 ? `• ${doc.experience_years} yrs exp` : ''}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleDoctorActive(doc)}
                        className={`text-[10px] font-black px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                          doc.is_active 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-slate-200 text-slate-700 border border-slate-300'
                        }`}
                        title="Click to toggle active duty status"
                      >
                        {doc.is_active ? '● Active' : '○ On Leave'}
                      </button>
                    </div>

                    {doc.phone && (
                      <p className="text-xs text-slate-600 flex items-center space-x-1 font-medium">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{doc.phone}</span>
                      </p>
                    )}

                    {/* Multi-Slot Availability Schedule */}
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
                      <p className="text-[11px] font-black text-slate-700 flex items-center space-x-1">
                        <Clock className="w-3 h-3 text-rose-500" />
                        <span>Weekly OPD Availability:</span>
                      </p>
                      {doc.availability_slots && doc.availability_slots.length > 0 ? (
                        <div className="space-y-1">
                          {doc.availability_slots.map((slot, sIdx) => (
                            <div key={sIdx} className="text-[11px] text-slate-600 flex items-center justify-between bg-white px-2 py-1 rounded-lg border border-slate-100">
                              <span className="font-bold text-slate-800">{slot.day}</span>
                              <span className="font-mono text-rose-800">{slot.start_time} - {slot.end_time}</span>
                              {slot.label && <span className="text-[10px] text-slate-400">({slot.label})</span>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No specific OPD slots scheduled.</p>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-end space-x-2 pt-4 mt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenEditDoctor(doc)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmItem({ type: 'doctor', id: doc.id, name: doc.name })}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-3">
              <Stethoscope className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No doctors found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No doctors match your search or filter. Click "Add Specialist Doctor" to configure hospital staff.
              </p>
              <button
                onClick={handleOpenAddDoctor}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Doctor Now</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DIAGNOSTIC TESTS CATALOG (PHASE 1)                                    */}
      {/* ========================================================================= */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center space-x-2">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                  <span>Diagnostic & Laboratory Test Catalog</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Manage test offerings, official pricing in INR, turnaround times, and mandatory preparation notes.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={loadTests}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingTests ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleOpenAddTest}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Diagnostic Test</span>
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search test name, prep instructions..."
                  value={testSearch}
                  onChange={(e) => setTestSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <select
                  value={testCategoryFilter}
                  onChange={(e) => setTestCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                >
                  {TEST_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat === 'All' ? 'All Test Categories' : cat}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl">
                <input
                  type="checkbox"
                  id="testAvailableOnly"
                  checked={testAvailableOnly}
                  onChange={(e) => setTestAvailableOnly(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="testAvailableOnly" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Show Available Tests Only
                </label>
              </div>
            </div>
          </div>

          {/* Tests Grid */}
          {loadingTests ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs font-bold">Loading Diagnostic Tests...</p>
            </div>
          ) : tests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className={`bg-white rounded-3xl p-5 border-2 transition-all flex flex-col justify-between ${
                    test.is_available ? 'border-slate-200 hover:border-purple-300' : 'border-slate-200 bg-slate-50/70 opacity-80'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="bg-purple-100 text-purple-900 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                          {test.category}
                        </span>
                        <h4 className="text-base font-black text-slate-900 mt-1">{test.test_name}</h4>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleTestAvailable(test)}
                        className={`text-[10px] font-black px-2.5 py-1 rounded-xl transition-all cursor-pointer ${
                          test.is_available 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                            : 'bg-amber-100 text-amber-800 border border-amber-300'
                        }`}
                        title="Click to toggle availability"
                      >
                        {test.is_available ? '● Available' : '○ Unavailable'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between bg-purple-50/50 p-3 rounded-2xl border border-purple-100">
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Standard Charge</p>
                        <p className="text-lg font-black text-purple-950">₹{test.price.toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Turnaround Time</p>
                        <p className="text-xs font-black text-slate-800 flex items-center space-x-1 justify-end">
                          <Clock className="w-3 h-3 text-purple-600" />
                          <span>{test.turnaround_time || '24 hours'}</span>
                        </p>
                      </div>
                    </div>

                    {/* Prep Notes */}
                    {test.prep_notes && (
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs text-slate-700 space-y-1">
                        <p className="text-[10px] font-black uppercase text-slate-500 flex items-center space-x-1">
                          <Info className="w-3 h-3 text-purple-500" />
                          <span>Patient Preparation Notes:</span>
                        </p>
                        <p className="text-[11px] font-medium text-slate-700 leading-relaxed">{test.prep_notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="flex items-center justify-end space-x-2 pt-4 mt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleOpenEditTest(test)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmItem({ type: 'test', id: test.id, name: test.test_name })}
                      className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-3">
              <FlaskConical className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No diagnostic tests found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No tests match your filter. Click "Add Diagnostic Test" to add hospital pathology or radiology tests.
              </p>
              <button
                onClick={handleOpenAddTest}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Test Now</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PHARMACY INVENTORY & STOCK MANAGEMENT (PHASE 1)                        */}
      {/* ========================================================================= */}
      {activeTab === 'pharmacy' && (
        <div className="space-y-6">
          {/* Header Action Bar */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 flex items-center space-x-2">
                  <Pill className="w-5 h-5 text-emerald-600" />
                  <span>Hospital Pharmacy Stock & Auto-Derivation</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Real-time stock tracking with automated <strong className="text-red-700">LOW_STOCK</strong> flag when quantity &le; reorder threshold.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={loadPharmacy}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingPharmacy ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={handleOpenAddPharmacy}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Medicine Item</span>
                </button>
              </div>
            </div>

            {/* Low Stock Banner Alert */}
            {pharmacyData.low_stock_count > 0 && (
              <div className="p-4 bg-red-50 border-2 border-red-300 rounded-2xl flex items-center justify-between gap-3 text-red-950">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <h5 className="text-xs font-black text-red-900 uppercase tracking-wide">
                      Low Stock Warning Alert ({pharmacyData.low_stock_count} Items Below Reorder Threshold)
                    </h5>
                    <p className="text-xs text-red-800 font-medium">
                      Immediate replenishment required for emergency and essential drugs.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPharmacyStatusFilter('LOW_STOCK')}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-all cursor-pointer whitespace-nowrap"
                >
                  View Low Stock ({pharmacyData.low_stock_count})
                </button>
              </div>
            )}

            {/* Filter & Sort Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search brand name, generic formulation..."
                  value={pharmacySearch}
                  onChange={(e) => setPharmacySearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                {[
                  { id: 'ALL', label: 'All' },
                  { id: 'LOW_STOCK', label: 'Low Stock' },
                  { id: 'IN_STOCK', label: 'In Stock' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setPharmacyStatusFilter(tab.id)}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      pharmacyStatusFilter === tab.id
                        ? tab.id === 'LOW_STOCK'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center space-x-1">
                <select
                  value={pharmacySortBy}
                  onChange={(e) => setPharmacySortBy(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="name">Sort: Name</option>
                  <option value="quantity">Sort: Quantity</option>
                  <option value="status">Sort: Status</option>
                  <option value="last_updated">Sort: Last Updated</option>
                </select>
                <button
                  onClick={() => setPharmacySortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-200 text-slate-700 cursor-pointer"
                  title={`Toggle order: currently ${pharmacySortOrder.toUpperCase()}`}
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Pharmacy Items Table / Cards */}
          {loadingPharmacy ? (
            <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-xs font-bold">Loading Pharmacy Inventory...</p>
            </div>
          ) : pharmacyData.items.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pharmacyData.items.map((item) => {
                const isLow = item.status === 'LOW_STOCK';
                const ratio = Math.min(100, Math.round((item.quantity / Math.max(1, item.reorder_threshold * 2)) * 100));

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-3xl p-5 border-2 transition-all flex flex-col justify-between ${
                      isLow ? 'border-red-400 bg-red-50/30' : 'border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top status & name */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase flex items-center space-x-1 w-fit ${
                            isLow ? 'bg-red-600 text-white animate-pulse' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isLow ? <AlertTriangle className="w-2.5 h-2.5" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
                            <span>{isLow ? 'LOW STOCK ALERT' : 'IN STOCK'}</span>
                          </span>
                          <h4 className="text-base font-black text-slate-900 mt-1">{item.medicine_name}</h4>
                          <p className="text-xs text-slate-500 font-medium">Generic: {item.generic_name}</p>
                        </div>
                      </div>

                      {/* Stock Counts Grid */}
                      <div className={`p-3.5 rounded-2xl border ${
                        isLow ? 'bg-red-100/70 border-red-200' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-500">Current Balance</p>
                            <p className={`text-xl font-black ${isLow ? 'text-red-700' : 'text-slate-900'}`}>
                              {item.quantity} <span className="text-xs font-semibold text-slate-500">{item.unit}</span>
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold uppercase text-slate-500">Reorder Threshold</p>
                            <p className="text-xs font-extrabold text-slate-700">
                              &le; {item.reorder_threshold} {item.unit}
                            </p>
                          </div>
                        </div>

                        {/* Stock Level Bar */}
                        <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${isLow ? 'bg-red-600' : 'bg-emerald-500'}`}
                            style={{ width: `${ratio}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Batch & Expiry Info */}
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="font-bold text-slate-500">Batch:</span> {item.batch_number || 'N/A'}
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-500">Expiry:</span> {item.expiry_date || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Actions & Quick Adjust Footer */}
                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                      {/* Quick Adjust Buttons */}
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleQuickAdjustStock(item, -10)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          title="Dispense 10 units"
                        >
                          -10
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjustStock(item, 10)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          title="Restock 10 units"
                        >
                          +10
                        </button>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPharmacy(item)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold flex items-center space-x-1 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmItem({ type: 'pharmacy', id: item.id, name: item.medicine_name })}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold flex items-center cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-3">
              <Pill className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-bold text-slate-700">No pharmacy inventory records found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No medicines match your search or filter. Click "Add Medicine Item" to register hospital pharmacy stock.
              </p>
              <button
                onClick={handleOpenAddPharmacy}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Add Medicine Item</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. INCOMING REFERRALS QUEUE (EXISTING)                                    */}
      {/* ========================================================================= */}
      {activeTab === 'incoming_referrals' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-2">
              <div>
                <h3 className="text-xl font-black text-slate-900">Incoming Referrals Queue</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Update Referral Status: <strong className="text-slate-900">Pending &rarr; Accepted &rarr; Patient Arrived &rarr; Completed &rarr; Follow-up</strong>
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

                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-extrabold bg-rose-100 text-rose-950 px-3 py-1.5 rounded-xl border border-rose-300">
                            Status: {ref.status}
                          </span>

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

      {/* ========================================================================= */}
      {/* 5. HIGH-RISK BOARD (EXISTING)                                             */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* 6. PATIENT DOSSIERS (EXISTING)                                            */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* 7. SPECIALIST APPOINTMENTS (EXISTING)                                     */}
      {/* ========================================================================= */}
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

      {/* ========================================================================= */}
      {/* MODAL 1: ADD / EDIT DOCTOR & MULTI-SLOT SCHEDULE                         */}
      {/* ========================================================================= */}
      {isDoctorModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h4 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                <Stethoscope className="w-5 h-5 text-rose-600" />
                <span>{editingDoctor ? 'Edit Doctor Profile' : 'Add Specialist Doctor'}</span>
              </h4>
              <button
                onClick={() => setIsDoctorModalOpen(false)}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDoctor} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Doctor Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Shalini Deshmukh"
                    value={doctorForm.name}
                    onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Speciality *</label>
                  <select
                    value={doctorForm.speciality}
                    onChange={(e) => setDoctorForm({ ...doctorForm, speciality: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500 outline-none"
                  >
                    {DOCTOR_SPECIALITIES.filter(s => s !== 'All').map(sp => (
                      <option key={sp} value={sp}>{sp}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Qualification</label>
                  <input
                    type="text"
                    placeholder="e.g. MBBS, MD, DGO"
                    value={doctorForm.qualification}
                    onChange={(e) => setDoctorForm({ ...doctorForm, qualification: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Experience (Years)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    placeholder="e.g. 12"
                    value={doctorForm.experience_years}
                    onChange={(e) => setDoctorForm({ ...doctorForm, experience_years: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 9822001122"
                    value={doctorForm.phone}
                    onChange={(e) => setDoctorForm({ ...doctorForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Active Duty Toggle */}
              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <input
                  type="checkbox"
                  id="doctorActiveCheckbox"
                  checked={doctorForm.is_active}
                  onChange={(e) => setDoctorForm({ ...doctorForm, is_active: e.target.checked })}
                  className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="doctorActiveCheckbox" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Doctor is Currently Active for Appointments / Duty
                </label>
              </div>

              {/* Multi-Slot OPD Availability Builder */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-rose-600" />
                    <span>Weekly OPD Availability Slots</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSlot}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-rose-700 rounded-lg text-[11px] font-bold border border-rose-200 flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Slot</span>
                  </button>
                </div>

                {doctorForm.availability_slots.map((slot, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-slate-400">Slot #{idx + 1}</span>
                      {doctorForm.availability_slots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(idx)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Day</label>
                        <select
                          value={slot.day}
                          onChange={(e) => handleSlotChange(idx, 'day', e.target.value)}
                          className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                        >
                          {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">Start Time</label>
                        <input
                          type="time"
                          value={slot.start_time}
                          onChange={(e) => handleSlotChange(idx, 'start_time', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500">End Time</label>
                        <input
                          type="time"
                          value={slot.end_time}
                          onChange={(e) => handleSlotChange(idx, 'end_time', e.target.value)}
                          className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Optional Slot Label (e.g. Morning OPD / High-Risk Antenatal)"
                        value={slot.label || ''}
                        onChange={(e) => handleSlotChange(idx, 'label', e.target.value)}
                        className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px]"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDoctorModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                >
                  {editingDoctor ? 'Save Changes' : 'Create Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / EDIT DIAGNOSTIC TEST                                       */}
      {/* ========================================================================= */}
      {isTestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h4 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                <FlaskConical className="w-5 h-5 text-purple-600" />
                <span>{editingTest ? 'Edit Diagnostic Test' : 'Add Diagnostic Test'}</span>
              </h4>
              <button
                onClick={() => setIsTestModalOpen(false)}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Test Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Complete Blood Count (CBC)"
                  value={testForm.test_name}
                  onChange={(e) => setTestForm({ ...testForm, test_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
                  <select
                    value={testForm.category}
                    onChange={(e) => setTestForm({ ...testForm, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    {TEST_CATEGORIES.filter(c => c !== 'All').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Price (₹ INR) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    placeholder="e.g. 250"
                    value={testForm.price}
                    onChange={(e) => setTestForm({ ...testForm, price: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-purple-900 focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Turnaround Time</label>
                <input
                  type="text"
                  placeholder="e.g. 2 hours / Same day / 24 hours"
                  value={testForm.turnaround_time}
                  onChange={(e) => setTestForm({ ...testForm, turnaround_time: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Preparation Notes (Instructions for Citizen)</label>
                <textarea
                  rows="3"
                  placeholder="e.g. 10-12 hours fasting mandatory. Drink plenty of water before ultrasound."
                  value={testForm.prep_notes}
                  onChange={(e) => setTestForm({ ...testForm, prep_notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none"
                ></textarea>
              </div>

              <div className="flex items-center space-x-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <input
                  type="checkbox"
                  id="testAvailableCheckbox"
                  checked={testForm.is_available}
                  onChange={(e) => setTestForm({ ...testForm, is_available: e.target.checked })}
                  className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="testAvailableCheckbox" className="text-xs font-bold text-slate-800 cursor-pointer">
                  Test is Currently Available & Operational
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTestModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                >
                  {editingTest ? 'Save Changes' : 'Create Test'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD / EDIT PHARMACY MEDICINE ITEM                                 */}
      {/* ========================================================================= */}
      {isPharmacyModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h4 className="text-lg font-black text-slate-900 flex items-center space-x-2">
                <Pill className="w-5 h-5 text-emerald-600" />
                <span>{editingPharmacy ? 'Edit Medicine Stock' : 'Add Medicine Item'}</span>
              </h4>
              <button
                onClick={() => setIsPharmacyModalOpen(false)}
                className="p-1 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePharmacy} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Medicine Brand Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tab Paracetamol 650mg"
                  value={pharmacyForm.medicine_name}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, medicine_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Generic Formulation *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acetaminophen 650mg"
                  value={pharmacyForm.generic_name}
                  onChange={(e) => setPharmacyForm({ ...pharmacyForm, generic_name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 500"
                    value={pharmacyForm.quantity}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                  <select
                    value={pharmacyForm.unit}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, unit: e.target.value })}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="strips">strips</option>
                    <option value="tablets">tablets</option>
                    <option value="vials">vials</option>
                    <option value="ampoules">ampoules</option>
                    <option value="bottles">bottles</option>
                    <option value="packets">packets</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Reorder Thresh *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 100"
                    value={pharmacyForm.reorder_threshold}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, reorder_threshold: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-red-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>
              </div>

              {/* Status preview banner */}
              {pharmacyForm.quantity !== '' && pharmacyForm.reorder_threshold !== '' && (
                <div className={`p-3 rounded-xl text-xs font-bold border flex items-center justify-between ${
                  Number(pharmacyForm.quantity) <= Number(pharmacyForm.reorder_threshold)
                    ? 'bg-red-50 text-red-900 border-red-200'
                    : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                }`}>
                  <span>Derived Status Preview:</span>
                  <span className="font-black uppercase">
                    {Number(pharmacyForm.quantity) <= Number(pharmacyForm.reorder_threshold) ? '🚨 LOW_STOCK' : '✅ IN_STOCK'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Batch Number</label>
                  <input
                    type="text"
                    placeholder="e.g. BATCH-2026-X1"
                    value={pharmacyForm.batch_number}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, batch_number: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Expiry Date (YYYY-MM)</label>
                  <input
                    type="text"
                    placeholder="e.g. 2027-12"
                    value={pharmacyForm.expiry_date}
                    onChange={(e) => setPharmacyForm({ ...pharmacyForm, expiry_date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPharmacyModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                >
                  {editingPharmacy ? 'Save Changes' : 'Create Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE CONFIRMATION MODAL                                        */}
      {/* ========================================================================= */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-fadeIn space-y-4">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-base font-black text-slate-900">Delete Record Confirmation</h4>
              <p className="text-xs text-slate-500">
                Are you sure you want to permanently delete <strong>{deleteConfirmItem.name}</strong> from {hospitalName}?
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
