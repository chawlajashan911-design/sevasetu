// @ts-nocheck
import React from 'react';
import { translations } from '../i18n/translations';
import { X, QrCode, ShieldCheck, Download, Share2, HeartPulse } from 'lucide-react';

export const AbhaCardModal = ({
  isOpen,
  onClose,
  language,
  patient
}) => {
  const t = translations[language] || translations.en;

  if (!isOpen) return null;

  if (!patient || (!patient.name && !patient.phone && !patient.abha_number && !patient.abha_id)) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
        <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center mx-auto mb-4 text-2xl text-amber-700">
            🪪
          </div>
          <h3 className="font-extrabold text-slate-900 text-lg mb-2">
            {language === 'mr' ? 'कोणतीही आभा नोंद आढळली नाही' : language === 'hi' ? 'कोई आभा रिकॉर्ड नहीं मिला' : 'No ABHA Record Linked'}
          </h3>
          <p className="text-xs text-slate-600 mb-6 leading-relaxed">
            {language === 'mr' 
              ? 'कृपया आपले अधिकृत आयुष्मान भारत डिजिटल आरोग्य खाते (ABHA ID) तयार करण्यासाठी नागरिक नोंदणी पूर्ण करा किंवा मोबाईल क्रमांकासह लॉगिन करा.' 
              : language === 'hi'
              ? 'कृपया अपना आधिकारिक आयुष्मान भारत डिजिटल स्वास्थ्य खाता (ABHA ID) बनाने के लिए नागरिक पंजीकरण पूरा करें या मोबाइल नंबर से लॉगिन करें।'
              : 'Please complete citizen registration or log in with your mobile number to view or generate your official Ayushman Bharat Digital Health ID (ABHA) card.'}
          </p>
          <button
            onClick={onClose}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
          >
            {language === 'mr' ? 'बंद करा / नोंदणी करा' : language === 'hi' ? 'बंद करें / पंजीकरण करें' : 'Close & Register Patient'}
          </button>
        </div>
      </div>
    );
  }

  const abhaNumber = patient.abha_number || patient.abha_id || 'Pending Generation';
  const name = patient.name || (patient.phone ? `Citizen (${patient.phone})` : 'Registered Citizen');
  const age = patient.age || '—';
  const gender = patient.gender || '—';
  const phone = patient.phone || '—';
  const villageLocation = [patient.village, patient.taluka, patient.district].filter(Boolean).join(', ') || 'Primary Health Centre Area';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h3 className="font-extrabold text-slate-900 text-base">
              {t.abha_card || 'ABHA Digital Health ID'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The ABHA Card Design */}
        <div className="p-6">
          <div className="rounded-2xl bg-gradient-to-br from-teal-800 via-teal-900 to-slate-900 text-white p-5 shadow-xl relative overflow-hidden border border-teal-600/30">
            {/* Background Emblem Watermark */}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 pointer-events-none">
              <HeartPulse className="w-full h-full text-white" />
            </div>

            {/* Top Bar: National Health Authority & Ayushman Bharat */}
            <div className="flex items-center justify-between pb-3 border-b border-teal-700/50">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-teal-900 font-bold text-xs shadow">
                  🇮🇳
                </div>
                <div>
                  <h4 className="text-[11px] font-bold tracking-wider uppercase text-teal-200">
                    National Health Authority (NHA)
                  </h4>
                  <p className="text-[10px] text-teal-300 font-medium leading-none">
                    Ayushman Bharat Digital Mission (ABDM)
                  </p>
                </div>
              </div>
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-400/40">
                VERIFIED
              </span>
            </div>

            {/* Middle Content */}
            <div className="grid grid-cols-3 gap-3 my-4 items-center">
              {/* Photo Placeholder */}
              <div className="w-20 h-24 bg-teal-950/60 rounded-xl border border-teal-600/40 flex flex-col items-center justify-center text-center p-1">
                <div className="w-10 h-10 rounded-full bg-teal-700/50 flex items-center justify-center text-teal-200 text-lg mb-1">
                  👤
                </div>
                <span className="text-[9px] text-teal-300 font-semibold leading-tight">
                  {language === 'mr' ? 'प्रमाणित फोटो' : language === 'hi' ? 'सत्यापित फोटो' : 'Verified Photo'}
                </span>
              </div>

              {/* Patient Details */}
              <div className="col-span-2 space-y-1">
                <div>
                  <span className="text-[10px] text-teal-300 uppercase tracking-wider block font-semibold">
                    {t.name || 'Name'}:
                  </span>
                  <p className="text-sm font-extrabold tracking-wide text-white leading-tight">
                    {name}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] text-teal-300 block font-medium">{t.age || 'Age'}:</span>
                    <p className="text-xs font-bold">{age} {language === 'mr' ? 'वर्षे' : language === 'hi' ? 'वर्ष' : 'Yrs'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-teal-300 block font-medium">{t.gender || 'Gender'}:</span>
                    <p className="text-xs font-bold">{gender}</p>
                  </div>
                </div>

                <div className="pt-0.5">
                  <span className="text-[10px] text-teal-300 block font-medium">{t.village || 'Location'}:</span>
                  <p className="text-xs font-semibold text-teal-100 truncate">{villageLocation}</p>
                </div>
              </div>
            </div>

            {/* Bottom ABHA Number & QR Code */}
            <div className="bg-teal-950/80 p-3 rounded-xl border border-teal-700/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-teal-400 uppercase tracking-widest font-bold block">
                  {language === 'mr' ? 'आभा क्रमांक (ABHA No.):' : language === 'hi' ? 'आभा संख्या (ABHA No.):' : 'ABHA Number:'}
                </span>
                <p className="text-sm sm:text-base font-mono font-black text-amber-300 tracking-wider">
                  {abhaNumber}
                </p>
                <span className="text-[10px] text-teal-300 font-mono">
                  {name.split(' ')[0].toLowerCase()}.{phone.slice(-4)}@abdm
                </span>
              </div>

              {/* QR Code Placeholder with FHIR data link */}
              <div className="bg-white p-1 rounded-lg shadow flex flex-col items-center">
                <QrCode className="w-12 h-12 text-slate-900" />
                <span className="text-[7px] text-slate-600 font-bold uppercase tracking-tighter">FHIR R4</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={() => alert(language === 'mr' ? "आभा कार्ड PDF स्वरूपात डाउनलोड झाले." : language === 'hi' ? "आभा कार्ड PDF रूप में डाउनलोड हुआ।" : "ABHA Card downloaded as PDF.")}
              className="flex items-center justify-center space-x-2 bg-teal-700 hover:bg-teal-800 active:scale-95 text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{language === 'mr' ? 'कार्ड डाउनलोड करा' : language === 'hi' ? 'कार्ड डाउनलोड करें' : 'Download Card'}</span>
            </button>
            <button
              onClick={() => alert(language === 'mr' ? "आरोग्य नोंद लिंक SMS द्वारे पाठवली." : language === 'hi' ? "स्वास्थ्य रिकॉर्ड लिंक SMS द्वारा भेजी गई।" : "Health record link shared via SMS.")}
              className="flex items-center justify-center space-x-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 py-2.5 rounded-xl font-bold text-xs border border-slate-300 transition-all cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-slate-600" />
              <span>{language === 'mr' ? 'शेअर करा' : language === 'hi' ? 'शेयर करें' : 'Share ABHA'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
