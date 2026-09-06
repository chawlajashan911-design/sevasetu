import React from 'react';
import { PortalType, Language } from '../types';
import { translations } from '../i18n/translations';
import { 
  User, 
  HeartHandshake, 
  Stethoscope, 
  BarChart3, 
  Wifi, 
  WifiOff, 
  AlertOctagon, 
  Languages, 
  MapPin
} from 'lucide-react';

interface NavbarProps {
  currentPortal: PortalType;
  setPortal: (p: PortalType) => void;
  language: Language;
  setLanguage: (l: Language) => void;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  pendingSyncCount: number;
  openSOS: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPortal,
  setPortal,
  language,
  setLanguage,
  isOffline,
  setIsOffline,
  pendingSyncCount,
  openSOS
}) => {
  const t = translations[language];

  const portals: { id: PortalType; label: string; shortLabel: string; icon: React.ReactNode; color: string }[] = [
    { 
      id: 'patient', 
      label: t.portal_patient, 
      shortLabel: language === 'mr' ? 'रुग्ण' : language === 'hi' ? 'मरीज' : 'Patient', 
      icon: <User className="w-5 h-5" />, 
      color: 'hover:bg-teal-50 hover:text-teal-700' 
    },
    { 
      id: 'asha', 
      label: t.portal_asha, 
      shortLabel: language === 'mr' ? 'आशा' : language === 'hi' ? 'आशा' : 'ASHA', 
      icon: <HeartHandshake className="w-5 h-5" />, 
      color: 'hover:bg-purple-50 hover:text-purple-700' 
    },
    { 
      id: 'doctor', 
      label: t.portal_doctor, 
      shortLabel: language === 'mr' ? 'डॉक्टर' : language === 'hi' ? 'डॉक्टर' : 'Doctor', 
      icon: <Stethoscope className="w-5 h-5" />, 
      color: 'hover:bg-blue-50 hover:text-blue-700' 
    },
    { 
      id: 'admin', 
      label: t.portal_admin, 
      shortLabel: language === 'mr' ? 'प्रशासन' : language === 'hi' ? 'प्रशासन' : 'Admin', 
      icon: <BarChart3 className="w-5 h-5" />, 
      color: 'hover:bg-amber-50 hover:text-amber-700' 
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      {/* Top Banner */}
      <div className="bg-slate-900 text-slate-200 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <div className="flex items-center space-x-1 font-medium text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-teal-400" />
            <span>
              {language === 'mr' 
                ? 'प्राथमिक केंद्र: खरपुडी (आंबेगाव, पुणे)' 
                : language === 'hi' 
                ? 'प्राथमिक केंद्र: खरपुडी (आम्बेगांव, पुणे)' 
                : 'Facility: Kharpudi (Ambegaon, Pune)'}
            </span>
          </div>
          <span className="hidden sm:inline text-slate-500">•</span>
          <span className="hidden sm:inline text-slate-300">
            {language === 'mr' ? 'राष्ट्रीय आरोग्य अभियान' : language === 'hi' ? 'राष्ट्रीय स्वास्थ्य मिशन' : 'National Health Mission'}
          </span>
        </div>

        <div className="flex items-center space-x-3">
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
            <span>{isOffline ? t.offline_mode : t.online_mode}</span>
            {pendingSyncCount > 0 && (
              <span className="bg-amber-400 text-slate-950 font-extrabold px-1.5 rounded-full text-[10px]">
                {pendingSyncCount}
              </span>
            )}
          </button>

          {/* Active Health Grid Badge */}
          <span className="bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded text-[11px] font-semibold">
            {t.live_badge}
          </span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setPortal('patient')}>
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-teal-500/20 font-extrabold text-xl">
              🏥
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="font-extrabold text-base sm:text-2xl text-slate-900 tracking-tight leading-none">
                  {t.app_title}
                </h1>
                <span className="bg-teal-100 text-teal-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  AI
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                {t.app_subtitle}
              </p>
            </div>
          </div>

          {/* Center Portal Switcher (Desktop) */}
          <nav className="hidden lg:flex items-center bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            {portals.map((p) => {
              const isActive = currentPortal === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPortal(p.id)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-white text-teal-900 shadow-sm ring-1 ring-slate-200'
                      : `text-slate-600 ${p.color}`
                  }`}
                >
                  {p.icon}
                  <span>{p.label}</span>
                  {p.id === 'asha' && pendingSyncCount > 0 && (
                    <span className="bg-amber-500 text-white text-xs px-1.5 py-0.2 rounded-full font-extrabold animate-bounce">
                      {pendingSyncCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Actions: Language Switcher + Big SOS Button */}
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
              className="flex items-center space-x-1.5 sm:space-x-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 active:scale-95 text-white px-3 sm:px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm shadow-md shadow-red-500/30 transition-all border border-red-500 animate-pulse"
              title="Emergency Distress Signal"
            >
              <AlertOctagon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              <span className="tracking-wide">{t.sos_btn}</span>
            </button>
          </div>
        </div>

        {/* Mobile Portal Navigation Bar */}
        <div className="lg:hidden flex items-center justify-around py-2 border-t border-slate-100 overflow-x-auto gap-1">
          {portals.map((p) => {
            const isActive = currentPortal === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setPortal(p.id)}
                className={`flex flex-col items-center justify-center px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap min-w-[72px] transition-all ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.icon}
                <span className="mt-0.5">
                  {p.shortLabel}
                </span>
                {p.id === 'asha' && pendingSyncCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] px-1 rounded-full font-bold">
                    {pendingSyncCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
