// @ts-nocheck
import React from 'react';
import { translations } from '../i18n/translations';
import { 
  User, 
  Stethoscope, 
  Building2, 
  Building, 
  HeartHandshake, 
  Languages, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight,
  CheckCircle2,
  Activity
} from 'lucide-react';

export const RoleSelectionScreen = ({
  language,
  setLanguage,
  onSelectRole,
}) => {
  const t = translations[language];

  const roles = [
    {
      id: 'patient',
      number: 1,
      title: '1. 👤 Patient',
      marathiTitle: '१. 👤 रुग्ण (Patient)',
      hindiTitle: '1. 👤 मरीज (Patient)',
      badge: 'Public & Citizen Access',
      accessScope: language === 'mr' ? 'नागरिक सेवा पोर्टल' : language === 'hi' ? 'नागरिक सेवा पोर्टल' : 'Citizen Health Portal',
      desc: language === 'mr' 
        ? 'लक्षणे नोंदवा, त्वरित AI चाचणी, जवळची आरोग्य केंद्रे शोधा, अपॉइंटमेंट बुक करा व टेलिकन्सल्ट करा.'
        : language === 'hi' 
        ? 'लक्षण दर्ज करें, त्वरित AI जांच, नजदीकी स्वास्थ्य केंद्र खोजें, अपॉइंटमेंट बुक करें व टेलीपरामर्श लें।'
        : 'Enter symptoms, run deterministic AI triage, discover nearby facilities, book appointments & teleconsult.',
      icon: <User className="w-8 h-8 text-teal-600" />,
      cardBg: 'from-teal-500/10 via-emerald-500/5 to-white',
      accentBg: 'bg-teal-50 text-teal-800 border-teal-200',
      borderHover: 'hover:border-teal-500 hover:shadow-teal-500/20',
      buttonBg: 'bg-teal-600 hover:bg-teal-700 text-white',
      keyFeatures: [
        language === 'mr' ? 'लक्षणे व व्हॉइस इनपुट' : language === 'hi' ? 'लक्षण व आवाज इनपुट' : 'Symptoms Assessment & Voice Input',
        language === 'mr' ? 'आरोग्य सुविधा व अपॉइंटमेंट' : language === 'hi' ? 'स्वास्थ्य सुविधा व अपॉइंटमेंट' : 'Healthcare Facilities & Booking',
        language === 'mr' ? 'आभा (ABHA) कार्ड व रेफरल ट्रॅकर' : language === 'hi' ? 'आभा (ABHA) कार्ड व रेफरल ट्रैकर' : 'ABHA Health ID & Referral Tracker'
      ]
    },
    {
      id: 'doctor',
      number: 2,
      title: '2. 👨‍⚕️ Doctor',
      marathiTitle: '२. 👨‍⚕️ डॉक्टर / वैद्यकीय अधिकारी',
      hindiTitle: '2. 👨‍⚕️ डॉक्टर / चिकित्सा अधिकारी',
      badge: 'Clinical Medical Officer',
      accessScope: language === 'mr' ? 'वैद्यकीय अधिकारी कक्ष' : language === 'hi' ? 'चिकित्सा अधिकारी कक्ष' : 'Physician Consultation Desk',
      desc: language === 'mr' 
        ? 'आजच्या अपॉइंटमेंट्स, AI चाचणी पडताळणी, ई-प्रिस्क्रिप्शन, सल्ला नोंदी व उच्च रुग्णालयात रेफरल.'
        : language === 'hi' 
        ? 'आज की अपॉइंटमेंट्स, AI प्राथमिकता सत्यापन, ई-प्रिस्क्रिप्शन, परामर्श नोट्स व अस्पताल रेफरल।'
        : "Today's appointments, clinical triage review, consultation notes, e-prescriptions & referrals.",
      icon: <Stethoscope className="w-8 h-8 text-blue-600" />,
      cardBg: 'from-blue-500/10 via-indigo-500/5 to-white',
      accentBg: 'bg-blue-50 text-blue-800 border-blue-200',
      borderHover: 'hover:border-blue-500 hover:shadow-blue-500/20',
      buttonBg: 'bg-blue-600 hover:bg-blue-700 text-white',
      keyFeatures: [
        language === 'mr' ? 'आजच्या अपॉइंटमेंट्स व रुग्ण यादी' : language === 'hi' ? 'आज की अपॉइंटमेंट्स व मरीज सूची' : "Today's Appointments Queue",
        language === 'mr' ? 'P1/P2/P3 चाचणी पडताळणी' : language === 'hi' ? 'P1/P2/P3 प्राथमिकता सत्यापन' : 'P1/P2/P3 Triage Verification',
        language === 'mr' ? 'ई-प्रिस्क्रिप्शन व हॉस्पिटल रेफरल' : language === 'hi' ? 'ई-प्रिस्क्रिप्शन व अस्पताल रेफरल' : 'e-Prescriptions & Referrals'
      ]
    },
    {
      id: 'hospital',
      number: 3,
      title: '3. 🏥 Hospital',
      marathiTitle: '३. 🏥 रुग्णालय / रेफरल केंद्र',
      hindiTitle: '3. 🏥 अस्पताल / रेफरल केंद्र',
      badge: 'Secondary & Tertiary Care',
      accessScope: language === 'mr' ? 'रेफरल व आपत्कालीन कक्ष' : language === 'hi' ? 'रेफरल व इमरजेंसी यूनिट' : 'Referral & Emergency Care',
      desc: language === 'mr' 
        ? 'इनकमिंग रेफरल केसेस, अति-तातडीचे P1 रुग्ण, बेड/OT पूर्वतयारी व रेफरल स्थिती अद्यतन.'
        : language === 'hi' 
        ? 'इनकमिंग रेफरल केसेस, अति गंभीर P1 मरीज, पूर्व तैयारी व रेफरल स्थिति प्रबंधन।'
        : 'Manage incoming referrals, emergency arrival coordination, high-risk triage & lifecycle tracking.',
      icon: <Building2 className="w-8 h-8 text-rose-600" />,
      cardBg: 'from-rose-500/10 via-red-500/5 to-white',
      accentBg: 'bg-rose-50 text-rose-800 border-rose-200',
      borderHover: 'hover:border-rose-500 hover:shadow-rose-500/20',
      buttonBg: 'bg-rose-600 hover:bg-rose-700 text-white',
      keyFeatures: [
        language === 'mr' ? 'इनकमिंग रेफरल व्यवस्थापन' : language === 'hi' ? 'इनकमिंग रेफरल प्रबंधन' : 'Incoming Referrals Management',
        language === 'mr' ? 'अति-गंभीर P1 आपत्कालीन बोर्ड' : language === 'hi' ? 'अति गंभीर P1 इमरजेंसी बोर्ड' : 'P1 High-Risk Emergency Board',
        language === 'mr' ? '१-क्लिक स्थिती बदल (Accepted/Arrived)' : language === 'hi' ? '1-क्लिक स्थिति प्रगति' : '1-Click Lifecycle Progression'
      ]
    },
    {
      id: 'clinic',
      number: 4,
      title: '4. 🏪 Clinic / PHC',
      marathiTitle: '४. 🏪 क्लिनिक / प्राथमिक आरोग्य केंद्र',
      hindiTitle: '4. 🏪 क्लिनिक / प्राथमिक स्वास्थ्य केंद्र',
      badge: 'Primary Care Facility Desk',
      accessScope: language === 'mr' ? 'ओपीडी व प्राथमिक तपासणी केंद्र' : language === 'hi' ? 'ओपीडी व प्राथमिक स्वास्थ्य केंद्र' : 'OPD & Primary Care Desk',
      desc: language === 'mr' 
        ? 'रुग्ण ओपीडी रांग, स्थानिक अपॉइंटमेंट्स, डिजिटल आरोग्य नोंदी, प्राथमिक तपासणी व रेफरल निर्मिती.'
        : language === 'hi' 
        ? 'मरीज ओपीडी कतार, स्थानीय अपॉइंटमेंट्स, डिजिटल स्वास्थ्य रिकॉर्ड, जांच व उच्च केंद्र रेफरल।'
        : 'Live OPD patient queue, appointments, health records, smart triage & referral dispatch to higher centers.',
      icon: <Building className="w-8 h-8 text-emerald-600" />,
      cardBg: 'from-emerald-500/10 via-teal-500/5 to-white',
      accentBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      borderHover: 'hover:border-emerald-500 hover:shadow-emerald-500/20',
      buttonBg: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      keyFeatures: [
        language === 'mr' ? 'थेट रुग्ण ओपीडी रांग' : language === 'hi' ? 'लाइव मरीज ओपीडी कतार' : 'Live Patient OPD Queue',
        language === 'mr' ? 'क्लिनिक अपॉइंटमेंट व्यवस्था' : language === 'hi' ? 'क्लिनिक अपॉइंटमेंट प्रबंधन' : 'Scheduled Clinic Appointments',
        language === 'mr' ? 'तपासणी व उच्च केंद्र रेफरल' : language === 'hi' ? 'जांच व उच्च केंद्र रेफरल' : 'Consultation & Referral Creation'
      ]
    },
    {
      id: 'health_worker',
      number: 5,
      title: '5. 👩‍⚕️ Health Worker',
      marathiTitle: '५. 👩‍⚕️ आरोग्य कार्यकर्ता / आशा सेविका',
      hindiTitle: '5. 👩‍⚕️ स्वास्थ्य कार्यकर्ता / आशा दीदी',
      badge: 'Community ASHA & ANM Care',
      accessScope: language === 'mr' ? 'समुदाय आरोग्य कार्यक्षेत्र' : language === 'hi' ? 'सामुदायिक स्वास्थ्य कार्यक्षेत्र' : 'Community Field Care Unit',
      desc: language === 'mr' 
        ? 'गावातील रुग्ण तपासणी, Dexie.js ऑफलाइन सिंक, प्रोत्साहन भत्ता ट्रॅकर व रेफरल फॉलो-अप गृहभेट.'
        : language === 'hi' 
        ? 'गांव के मरीजों की जांच, Dexie.js ऑफलाइन सिंक, प्रोत्साहन राशि व रेफरल फॉलो-अप गृह भेंट।'
        : 'Village health screening, offline Dexie.js field mode, NHM incentives ledger & post-care follow-up visits.',
      icon: <HeartHandshake className="w-8 h-8 text-purple-600" />,
      cardBg: 'from-purple-500/10 via-fuchsia-500/5 to-white',
      accentBg: 'bg-purple-50 text-purple-800 border-purple-200',
      borderHover: 'hover:border-purple-500 hover:shadow-purple-500/20',
      buttonBg: 'bg-purple-600 hover:bg-purple-700 text-white',
      keyFeatures: [
        language === 'mr' ? 'गावातील रुग्ण व जोखीम वर्गीकरण' : language === 'hi' ? 'गांव के मरीज व जोखिम वर्गीकरण' : 'Village Patients & Risk Overview',
        language === 'mr' ? 'ऑफलाइन Dexie.js तपासणी व सिंक' : language === 'hi' ? 'ऑफलाइन Dexie.js जांच व सिंक' : 'Offline Dexie.js Field Screening',
        language === 'mr' ? 'रेफरल पाठपुरावा व प्रोत्साहन भत्ता' : language === 'hi' ? 'रेफरल फॉलो-अप व प्रोत्साहन राशि' : 'Follow-up Visits & NHM Earnings'
      ]
    }
  ];

  return (
    <div className="min-h-[88vh] flex flex-col justify-center items-center py-6 px-3 sm:px-6">
      {/* Top Banner & Language Switcher */}
      <div className="w-full max-w-6xl mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-md">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 text-2xl font-black">
            🏥
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {language === 'mr' ? 'सेवासेतू' : language === 'hi' ? 'सेवासेतु' : 'SevaSetu'}
              </h1>
              <span className="bg-teal-100 text-teal-800 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-teal-200">
                AI SMART HEALTH GRID
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              {t.welcome_subtitle}
            </p>
          </div>
        </div>

        {/* Multilingual Selector */}
        <div className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <Languages className="w-4 h-4 text-slate-500 ml-2 mr-1.5" />
          {['mr', 'hi', 'en'].map((l) => (
            <button
              key={l}
              onClick={() => setLanguage(l)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                language === l
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {l === 'mr' ? 'मराठी' : l === 'hi' ? 'हिंदी' : 'English'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Title Section */}
      <div className="text-center max-w-3xl mb-8">
        <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-teal-500/10 to-blue-500/10 border border-teal-500/20 px-4 py-1.5 rounded-full mb-3">
          <Sparkles className="w-4 h-4 text-teal-600 animate-pulse" />
          <span className="text-xs font-bold text-teal-800">
            {language === 'mr' ? 'भूमिका-आधारित एकात्मिक आरोग्य प्रणाली' : language === 'hi' ? 'भूमिका-आधारित एकीकृत स्वास्थ्य प्रणाली' : 'Role-Based Integrated Healthcare Platform'}
          </span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
          {t.welcome_select_role}
        </h2>
        <p className="text-sm sm:text-base text-slate-600 mt-2 font-medium">
          {t.select_role_desc}
        </p>
      </div>

      {/* 5 Role Selection Cards Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {roles.map((role) => (
          <div
            key={role.id}
            onClick={() => onSelectRole(role.id)}
            className={`group relative bg-gradient-to-br ${role.cardBg} border-2 border-slate-200/80 rounded-3xl p-6 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between ${role.borderHover} hover:-translate-y-1`}
          >
            {/* Top Row: Icon + Badge */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center border border-slate-100 group-hover:scale-105 transition-transform">
                  {role.icon}
                </div>
                <div className="text-right">
                  <span className={`inline-block text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${role.accentBg}`}>
                    {role.badge}
                  </span>
                  <p className="text-[11px] text-slate-500 font-semibold mt-1">
                    {role.accessScope}
                  </p>
                </div>
              </div>

              {/* Title */}
              <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-teal-900 transition-colors mb-3">
                {language === 'mr' ? role.marathiTitle : language === 'hi' ? role.hindiTitle : role.title}
              </h3>

              <p className="text-xs text-slate-600 font-medium leading-relaxed mb-4">
                {role.desc}
              </p>

              {/* Feature Chips */}
              <div className="space-y-1.5 mb-5">
                {role.keyFeatures.map((feat, idx) => (
                  <div key={idx} className="flex items-center space-x-2 text-[11px] text-slate-700 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectRole(role.id);
              }}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 shadow-sm transition-all group-hover:shadow-md ${role.buttonBg}`}
            >
              <span>{language === 'mr' ? 'या भूमिकेत प्रवेश करा' : language === 'hi' ? 'इस भूमिका में प्रवेश करें' : 'Open Dashboard'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ))}
      </div>

      {/* Product Architecture & Care Continuum Banner */}
      <div className="w-full max-w-6xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-lg border border-slate-700/60">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 text-lg">
              <Activity className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm sm:text-base text-teal-300">
                {language === 'mr' ? 'अखंड ग्रामीण आरोग्य सेवा साखळी' : language === 'hi' ? 'अखंड ग्रामीण स्वास्थ्य सेवा ग्रिड' : 'Continuum of Rural Healthcare Grid'}
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                {language === 'mr' 
                  ? 'नागरिक डिजिटल ट्रायज → प्राथमिक केंद्र ओपीडी → डॉक्टर तपासणी व ई-प्रिस्क्रिप्शन → उच्च रुग्णालय रेफरल → आशा गृहभेट फॉलो-अप.'
                  : language === 'hi'
                  ? 'नागरिक डिजिटल ट्रायज → प्राथमिक स्वास्थ्य केंद्र ओपीडी → डॉक्टर जांच व ई-प्रिस्क्रिप्शन → उच्च अस्पताल रेफरल → आशा गृह भेंट फॉलो-अप।'
                  : 'Citizen Digital Triage → Primary Care OPD → Clinical Decision Support → Tertiary Hospital Referrals → Community Health Worker Follow-up.'}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center space-x-2 bg-slate-800/80 px-3.5 py-1.5 rounded-xl border border-slate-700 text-xs font-bold text-teal-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ABDM & NHM Standards Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
};
