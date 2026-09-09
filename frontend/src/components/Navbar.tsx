import React from 'react';
import { Language, AuthUser, UserRole } from '../types';
import { translations } from '../i18n/translations';
import { 
  User, 
  HeartHandshake, 
  Stethoscope, 
  Building2,
  Building,
  Wifi, 
  WifiOff, 
  AlertOctagon, 
  Languages, 
  MapPin,
  LogOut
} from 'lucide-react';

interface NavbarProps {
  currentRole: UserRole;
  currentUser: AuthUser | null;
  onLogout: () => void;
  language: Language;
  setLanguage: (l: Language) => void;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  pendingSyncCount: number;
  openSOS: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  currentUser,
  onLogout,
  language,
  setLanguage,
  isOffline,
  setIsOffline,
  pendingSyncCount,
  openSOS
}) => {
  const t = translations[language];

  const roleMeta: Record<UserRole, {
    label: string;
    labelMr: string;
    labelHi: string;
    badge: string;
    badgeColor: string;
    icon: React.ReactNode;
    facility: string;
  }> = {
    patient: {
      label: 'Patient Portal',
      labelMr: 'रुग्ण डॅशबोर्ड',
      labelHi: 'मरीज डैशबोर्ड',
      badge: 'CITIZEN ACCESS',
      badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
      icon: <User className="w-5 h-5 text-teal-600" />,
      facility: 'Citizen / Rural Healthcare'
    },
    doctor: {
      label: 'Doctor Consultation Desk',
      labelMr: 'वैद्यकीय अधिकारी कक्ष',
      labelHi: 'चिकित्सा अधिकारी कक्ष',
      badge: 'DOCTOR ACCESS',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      icon: <Stethoscope className="w-5 h-5 text-blue-600" />,
      facility: 'Primary Health Centre / Sub-District Hospital'
    },
    hospital: {
      label: 'Referral Hospital Portal',
      labelMr: 'रेफरल रुग्णालय डॅशबोर्ड',
      labelHi: 'रेफरल अस्पताल डैशबोर्ड',
      badge: 'HOSPITAL ACCESS',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      icon: <Building2 className="w-5 h-5 text-rose-600" />,
      facility: 'Maharashtra Referral Hospital Network'
    },
    clinic: {
      label: 'Clinic / PHC Portal',
      labelMr: 'क्लिनिक / प्राथमिक केंद्र',
      labelHi: 'क्लिनिक / प्राथमिक स्वास्थ्य केंद्र',
      badge: 'CLINIC ACCESS',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      icon: <Building className="w-5 h-5 text-emerald-600" />,
      facility: 'Primary Health Centre (PHC)'
    },
    health_worker: {
      label: 'Community Health Worker Desk',
      labelMr: 'आरोग्य कार्यकर्ता / आशा सेविका',
      labelHi: 'स्वास्थ्य कार्यकर्ता / आशा दीदी',
      badge: 'ASHA / ANM ACCESS',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      icon: <HeartHandshake className="w-5 h-5 text-purple-600" />,
      facility: 'Community Health Sub-Centre'
    },
    admin: {
      label: 'Admin Portal',
      labelMr: 'प्रशासन डॅशबोर्ड',
      labelHi: 'प्रशासन डैशबोर्ड',
      badge: 'ADMIN ACCESS',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      icon: <Building2 className="w-5 h-5 text-amber-600" />,
      facility: 'Maharashtra Public Health Administration'
    }
  };

  const meta = roleMeta[currentRole] || roleMeta.patient;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      {/* Top Banner */}
      <div className="bg-slate-900 text-slate-200 text-xs px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <div className="flex items-center space-x-1 font-medium text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">
              {meta.facility} • {language === 'mr' ? 'आरोग्य ग्रिड' : language === 'hi' ? 'स्वास्थ्य ग्रिड' : 'Health Grid'}
            </span>
          </div>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden sm:inline text-teal-300 font-semibold text-[11px]">
            {t.demo_badge}
          </span>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Offline / Online Switcher */}
          <button
            onClick={() => setIsOffline(!isOffline)}
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all ${
              isOffline 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 ring-1 ring-amber-400/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
            title="Toggle Offline/Online Mode"
          >
            {isOffline ? <WifiOff className="w-3 h-3 text-amber-300 animate-pulse" /> : <Wifi className="w-3 h-3 text-emerald-300" />}
            <span className="hidden xs:inline">{isOffline ? t.offline_mode : t.online_mode}</span>
            {pendingSyncCount > 0 && (
              <span className="bg-amber-400 text-slate-950 font-extrabold px-1.5 rounded-full text-[10px]">
                {pendingSyncCount}
              </span>
            )}
          </button>

          {/* User Profile Badge */}
          {currentUser && (
            <div className="hidden sm:flex items-center space-x-1.5 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full text-xs font-medium text-slate-200">
              <span className="w-2 h-2 rounded-full bg-teal-400"></span>
              <span className="font-bold text-teal-300">{currentUser.name}</span>
            </div>
          )}

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className="flex items-center space-x-1 bg-red-500/20 hover:bg-red-500/30 text-rose-300 border border-rose-500/40 px-3 py-0.5 rounded-full text-xs font-extrabold transition-all cursor-pointer"
            title="Logout and return to Role Selection"
          >
            <LogOut className="w-3 h-3" />
            <span>{t.logout}</span>
          </button>
        </div>
      </div>

      {/* Main Bar with Role Identification Only */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          {/* Brand Logo & Current Role Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 font-extrabold text-xl">
              🏥
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-base sm:text-xl text-slate-900 tracking-tight leading-none">
                  {t.app_title}
                </h1>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${meta.badgeColor}`}>
                  {meta.badge}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-semibold mt-0.5 flex items-center space-x-1">
                <span>{language === 'mr' ? meta.labelMr : language === 'hi' ? meta.labelHi : meta.label}</span>
                <span>•</span>
                <span className="text-teal-700 font-bold">{currentUser?.name || meta.facility}</span>
              </p>
            </div>
          </div>

          {/* Right Actions: Language Selector + Emergency SOS */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Language Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <Languages className="w-4 h-4 text-slate-500 ml-1.5 mr-1 hidden sm:inline" />
              {(['mr', 'hi', 'en'] as Language[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLanguage(l)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    language === l
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {l === 'mr' ? 'मराठी' : l === 'hi' ? 'हिंदी' : 'English'}
                </button>
              ))}
            </div>

            {/* Emergency SOS Button */}
            <button
              onClick={openSOS}
              className="flex items-center space-x-1.5 sm:space-x-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:scale-95 text-white px-3 sm:px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm shadow-md shadow-red-500/30 transition-all border border-red-500 animate-pulse shrink-0"
              title="Emergency Distress Signal"
            >
              <AlertOctagon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span className="tracking-wide">{t.sos_btn}</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
