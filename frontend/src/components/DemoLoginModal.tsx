import React, { useState, useEffect } from 'react';
import { UserRole, Language, AuthUser, Facility } from '../types';
import { translations } from '../i18n/translations';
import { VillageSearchSelect } from './VillageSearchSelect';
import { HospitalSearchSelect } from './HospitalSearchSelect';
import { api } from '../services/api';
import { 
  X, 
  ShieldCheck, 
  Phone, 
  KeyRound, 
  Sparkles, 
  ArrowRight, 
  User, 
  Stethoscope, 
  Building2, 
  Building, 
  HeartHandshake, 
  MapPin,
  CheckCircle2
} from 'lucide-react';

interface DemoLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole | null;
  language: Language;
  onLoginSuccess: (user: AuthUser) => void;
}

export const DemoLoginModal: React.FC<DemoLoginModalProps> = ({
  isOpen,
  onClose,
  role,
  language,
  onLoginSuccess,
}) => {
  if (!isOpen || !role) return null;

  const t = translations[language];

  // Role Personas configuration (clean without fake demo data)
  const roleConfigs: Record<UserRole, {
    defaultName: string;
    phone: string;
    defaultFacility: string;
    badge: string;
    roleLabel: string;
    icon: React.ReactNode;
    color: string;
    buttonColor: string;
  }> = {
    patient: {
      defaultName: language === 'mr' ? 'नागरिक / रुग्ण' : language === 'hi' ? 'नागरिक / मरीज' : 'Citizen / Patient',
      phone: '9822104512',
      defaultFacility: 'Maharashtra Rural Circle',
      badge: 'Citizen Access • Patient Portal',
      roleLabel: language === 'mr' ? 'रुग्ण प्रवेश' : language === 'hi' ? 'मरीज प्रवेश' : 'Patient Login',
      icon: <User className="w-7 h-7 text-teal-600" />,
      color: 'from-teal-600 to-emerald-600',
      buttonColor: 'bg-teal-600 hover:bg-teal-700'
    },
    doctor: {
      defaultName: 'Medical Officer (MBBS)',
      phone: '9822019901',
      defaultFacility: 'Primary Health Centre',
      badge: 'Clinical Medical Officer',
      roleLabel: language === 'mr' ? 'वैद्यकीय अधिकारी कक्ष' : language === 'hi' ? 'चिकित्सा अधिकारी कक्ष' : 'Doctor Portal Login',
      icon: <Stethoscope className="w-7 h-7 text-blue-600" />,
      color: 'from-blue-600 to-indigo-700',
      buttonColor: 'bg-blue-600 hover:bg-blue-700'
    },
    hospital: {
      defaultName: 'Hospital Referral Desk',
      phone: '9822019902',
      defaultFacility: 'Government Hospital Network',
      badge: 'Secondary & Tertiary Care',
      roleLabel: language === 'mr' ? 'रुग्णालय डॅशबोर्ड प्रवेश' : language === 'hi' ? 'अस्पताल डैशबोर्ड प्रवेश' : 'Hospital Portal Login',
      icon: <Building2 className="w-7 h-7 text-rose-600" />,
      color: 'from-rose-600 to-red-700',
      buttonColor: 'bg-rose-600 hover:bg-rose-700'
    },
    clinic: {
      defaultName: 'PHC Staff / OPD Desk',
      phone: '9822019903',
      defaultFacility: 'Primary Health Centre / Sub-Centre',
      badge: 'Primary Health Care Facility',
      roleLabel: language === 'mr' ? 'क्लिनिक / प्राथमिक केंद्र' : language === 'hi' ? 'क्लिनिक / प्राथमिक स्वास्थ्य केंद्र' : 'Clinic / PHC Portal Login',
      icon: <Building className="w-7 h-7 text-emerald-600" />,
      color: 'from-emerald-600 to-teal-700',
      buttonColor: 'bg-emerald-600 hover:bg-emerald-700'
    },
    health_worker: {
      defaultName: 'Community Health Worker (ASHA / ANM)',
      phone: '9822019904',
      defaultFacility: 'Field Health Circle',
      badge: 'Community Health Mobilizer',
      roleLabel: language === 'mr' ? 'आरोग्य कार्यकर्ता / आशा सेविका' : language === 'hi' ? 'स्वास्थ्य कार्यकर्ता / आशा दीदी' : 'Health Worker Login',
      icon: <HeartHandshake className="w-7 h-7 text-purple-600" />,
      color: 'from-purple-600 to-fuchsia-700',
      buttonColor: 'bg-purple-600 hover:bg-purple-700'
    },
    admin: {
      defaultName: 'District Health Officer',
      phone: '9822019999',
      defaultFacility: 'District Health Administration',
      badge: 'District Health Administration',
      roleLabel: 'District Admin Login',
      icon: <Building2 className="w-7 h-7 text-amber-600" />,
      color: 'from-amber-600 to-orange-700',
      buttonColor: 'bg-amber-600 hover:bg-amber-700'
    }
  };

  const config = roleConfigs[role] || roleConfigs.patient;

  const [inputPhone, setInputPhone] = useState<string>(config.phone);
  const [inputOtp, setInputOtp] = useState<string>('123456');
  const [customName, setCustomName] = useState<string>('');
  
  // Patient Village Selection state
  const [patientVillage, setPatientVillage] = useState<string>('Wagholi');
  const [patientTaluka, setPatientTaluka] = useState<string>('Haveli');
  const [patientDistrict, setPatientDistrict] = useState<string>('Pune');

  // Hospital Selection state (from hospital_directory.csv)
  const [selectedHospital, setSelectedHospital] = useState<Facility | null>(null);

  // Initialize from existing local storage if available
  useEffect(() => {
    try {
      const savedVillage = localStorage.getItem('sevasetu_patient_village');
      if (savedVillage) {
        const parsed = JSON.parse(savedVillage);
        if (parsed.village) setPatientVillage(parsed.village);
        if (parsed.taluka) setPatientTaluka(parsed.taluka);
        if (parsed.district) setPatientDistrict(parsed.district);
      }

      const savedHospital = localStorage.getItem('sevasetu_hospital_details');
      if (savedHospital) {
        const parsedHosp = JSON.parse(savedHospital);
        if (parsedHosp?.name) setSelectedHospital(parsedHosp);
      }
    } catch (e) {
      console.error('Error loading stored session details:', e);
    }
  }, []);

  const handleQuickLogin = () => {
    let activeFacility = config.defaultFacility;
    let activeName = customName.trim() || config.defaultName;
    let activeDistrict = patientDistrict;

    if (role === 'patient') {
      activeFacility = `${patientVillage}, ${patientTaluka} (${patientDistrict})`;
      localStorage.setItem('sevasetu_patient_village', JSON.stringify({
        village: patientVillage,
        taluka: patientTaluka,
        district: patientDistrict
      }));
    } else if (role === 'hospital') {
      if (selectedHospital) {
        activeFacility = selectedHospital.name;
        activeName = selectedHospital.name;
        activeDistrict = selectedHospital.district || patientDistrict;
        localStorage.setItem('sevasetu_hospital_details', JSON.stringify(selectedHospital));
      }
    }

    const userObj: AuthUser = {
      role: role,
      name: activeName,
      phone: (role === 'hospital' && selectedHospital?.phone) ? selectedHospital.phone : (inputPhone || config.phone),
      facility: activeFacility,
      badge: (role === 'hospital' && selectedHospital?.care_type) ? `${selectedHospital.care_type} • ${selectedHospital.district}` : config.badge,
      village: role === 'patient' ? patientVillage : undefined,
      taluka: role === 'patient' ? patientTaluka : undefined,
      district: role === 'patient' ? patientDistrict : (selectedHospital?.district || undefined)
    };

    onLoginSuccess(userObj);
    onClose();
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuickLogin();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-scaleUp max-h-[92vh] flex flex-col">
        {/* Modal Top Header */}
        <div className={`bg-gradient-to-r ${config.color} text-white p-6 relative shrink-0`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 rounded-full p-1.5 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center shrink-0">
              {config.icon}
            </div>
            <div>
              <span className="bg-white/20 text-white text-[11px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                {t.demo_login_title}
              </span>
              <h3 className="text-xl font-black mt-0.5">
                {config.roleLabel}
              </h3>
              <p className="text-xs text-white/80 font-medium">
                {role === 'hospital' && selectedHospital ? selectedHospital.name : config.defaultFacility}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Hospital Selection from Authentic Government Dataset */}
          {role === 'hospital' && (
            <div className="p-3.5 bg-rose-50/50 rounded-2xl border border-rose-200/80 space-y-2">
              <HospitalSearchSelect
                selectedHospital={selectedHospital}
                onSelect={(hosp) => setSelectedHospital(hosp)}
                language={language}
              />
            </div>
          )}

          {/* Patient Village Selection from Authentic Maharashtra Dataset */}
          {role === 'patient' && (
            <div className="p-3 bg-teal-50/60 rounded-2xl border border-teal-200/80">
              <VillageSearchSelect
                selectedVillage={patientVillage}
                selectedTaluka={patientTaluka}
                selectedDistrict={patientDistrict}
                onSelect={(val) => {
                  setPatientVillage(val.village);
                  setPatientTaluka(val.taluka);
                  setPatientDistrict(val.district);
                }}
                language={language}
                compact={true}
              />
            </div>
          )}

          {/* Optional Name / Title Field */}
          {role !== 'hospital' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'mr' ? 'नाव / पद' : language === 'hi' ? 'नाम / पद' : 'Name / Designation'}
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all outline-none"
                placeholder={config.defaultName}
              />
            </div>
          )}

          {/* Quick 1-Click Login Button */}
          <div className="pt-1">
            <button
              onClick={handleQuickLogin}
              type="button"
              className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm text-white shadow-md flex items-center justify-center space-x-2 transition-all active:scale-98 ${config.buttonColor}`}
            >
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin" />
              <span>
                {language === 'mr' ? 'थेट डॅशबोर्ड उघडा' : language === 'hi' ? 'सीधे डैशबोर्ड खोलें' : 'Login to Dashboard'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-[11px] text-center text-slate-400 font-semibold mt-1.5">
              {language === 'mr' ? 'कोणताही पासवर्ड किंवा SMS गरज नाही • OTP 123456' : language === 'hi' ? 'कोई पासवर्ड या SMS की आवश्यकता नहीं • OTP 123456' : 'Instant access • OTP 123456'}
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center space-x-2 text-slate-300 text-xs font-bold pt-1">
            <hr className="flex-1 border-slate-200" />
            <span className="text-slate-400 font-semibold uppercase text-[10px]">
              {language === 'mr' ? 'किंवा मोबाईल ने' : language === 'hi' ? 'या मोबाइल द्वारा' : 'Or via Phone Number'}
            </span>
            <hr className="flex-1 border-slate-200" />
          </div>

          {/* Form */}
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.phone}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="tel"
                  value={inputPhone}
                  onChange={(e) => setInputPhone(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all"
                  placeholder="9822000000"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'mr' ? 'OTP (123456)' : language === 'hi' ? 'OTP (123456)' : 'OTP (123456)'}
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={inputOtp}
                  onChange={(e) => setInputOtp(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-teal-500 focus:bg-white tracking-widest"
                  placeholder="123456"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <span>{language === 'mr' ? 'प्रवेश करा' : language === 'hi' ? 'प्रवेश करें' : 'Confirm & Proceed'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
