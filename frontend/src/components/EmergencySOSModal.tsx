// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { translations } from '../i18n/translations';
import { 
  AlertOctagon, 
  PhoneCall, 
  MapPin, 
  Send, 
  X, 
  CheckCircle2, 
  Navigation,
  AlertTriangle
} from 'lucide-react';

export const EmergencySOSModal = ({
  isOpen,
  onClose,
  language,
  gpsLocation
}) => {
  const t = translations[language] || translations.en;
  const [sosSent, setSosSent] = useState(false);
  const [liveLocation, setLiveLocation] = useState(gpsLocation);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSosSent(false);
      setLiveLocation(gpsLocation);
      setLocationError('');
      if (gpsLocation?.lat == null || gpsLocation?.lng == null) {
        if (!navigator.geolocation) {
          setLocationError('GPS is not available on this device.');
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => setLiveLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
            villageName: 'Current GPS location',
          }),
          (error) => setLocationError(error.message || 'Location permission is required.'),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    }
  }, [isOpen, gpsLocation]);

  if (!isOpen) return null;

  const lat = liveLocation?.lat;
  const lng = liveLocation?.lng;
  const hasLocation = typeof lat === 'number' && typeof lng === 'number';
  const accuracy = liveLocation?.accuracy;
  const villageName = liveLocation?.villageName || 'Current GPS location';
  const isOutsideMH = liveLocation?.isOutsideMH;
  const nearestBorderDistanceKm = liveLocation?.nearestBorderDistanceKm;

  const mapsUrl = hasLocation ? `https://www.google.com/maps?q=${lat},${lng}` : '';
  const smsBody = encodeURIComponent(
    `EMERGENCY MEDICAL SOS: Immediate ambulance required at ${villageName}. Coordinates: ${hasLocation ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'unavailable'}. Maps: ${mapsUrl}`
  );
  const smsLink = `sms:108?&body=${smsBody}`;

  const handleSendSOSBroadcast = () => {
    if (!hasLocation) {
      setLocationError('Allow GPS access before sending your emergency location.');
      return;
    }
    setSosSent(true);
    window.open(smsLink, '_blank');
  };

  const handleCallAmbulance = () => {
    if (!hasLocation) {
      setLocationError('Allow GPS access before calling with your current location.');
      return;
    }
    window.open(smsLink, '_blank');
    window.location.href = 'tel:108';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border-4 border-red-500 animate-scaleUp">
        {/* Urgent Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full p-2 transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white ring-4 ring-white/30 animate-pulse">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <div>
              <span className="bg-red-950/40 text-red-100 text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                {language === 'mr' ? 'आपत्कालीन वैद्यकीय मदत' : language === 'hi' ? 'आपातकालीन चिकित्सा सहायता' : 'EMERGENCY MEDICAL DISPATCH'}
              </span>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
                {t.emergency_sos || 'Emergency SOS'}
              </h2>
            </div>
          </div>
          <p className="text-red-100 text-sm font-medium mt-1">
            {t.sos_hint || 'Pressing SOS connects directly to 108 Emergency Ambulance and alerts local PHC.'}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Out of State Badge if applicable */}
          {isOutsideMH && (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-2xl flex items-center space-x-2 text-amber-900 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {language === 'mr' 
                  ? `महाराष्ट्र सीमेबाहेरील GPS नोंदवले: जवळचे महाराष्ट्र आरोग्य केंद्र ${nearestBorderDistanceKm || 0} किमी अंतरावर आहे.`
                  : language === 'hi'
                  ? `महाराष्ट्र सीमा से बाहर GPS: निकटतम महाराष्ट्र स्वास्थ्य नोड ${nearestBorderDistanceKm || 0} किमी दूर है।`
                  : `Outside Maharashtra GPS: Nearest MH Health Node is ~${nearestBorderDistanceKm || 0} km away.`}
              </span>
            </div>
          )}

          {/* GPS Coordinates Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                <MapPin className="w-4 h-4 text-red-600" />
                <span>
                  {language === 'mr' ? 'स्थान (GPS Location):' : language === 'hi' ? 'स्थान (GPS Location):' : 'Captured GPS Location:'}
                </span>
              </div>
              <span className={`${hasLocation ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'} text-[11px] font-extrabold px-2 py-0.5 rounded-full flex items-center space-x-1`}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping mr-1"></span>
                {hasLocation ? 'GPS Locked' : 'Waiting for GPS'}
              </span>
            </div>
            
            <p className="text-base font-extrabold text-slate-800">
              {villageName}
            </p>
            <p className="text-xs font-mono text-slate-500 mt-0.5">
              {hasLocation ? `Lat: ${lat.toFixed(6)} | Lng: ${lng.toFixed(6)} (Accuracy ±${accuracy || 'unknown'}m)` : 'Current GPS coordinates are required.'}
            </p>
            
            <a
              href={mapsUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 text-xs text-teal-700 hover:text-teal-900 font-bold mt-2 hover:underline"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>
                {language === 'mr' ? 'नकाशावर ठिकाण पहा' : language === 'hi' ? 'मानचित्र पर स्थान देखें' : 'View on Google Maps'}
              </span>
            </a>
          </div>

          {/* Direct Action Buttons - Large and High Contrast */}
          <div className="space-y-3">
            {/* Call 108 Emergency Ambulance */}
            <button
              onClick={handleCallAmbulance}
              disabled={!hasLocation}
              className="w-full flex items-center justify-center space-x-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 disabled:cursor-not-allowed active:scale-98 text-white p-4 rounded-2xl font-black text-base sm:text-lg shadow-lg shadow-red-600/30 transition-all"
            >
              <PhoneCall className="w-6 h-6 animate-bounce" />
              <span>
                {language === 'mr' ? '१०८ रुग्णवाहिका डायल करा' : language === 'hi' ? '108 एम्बुलेंस डायल करें' : 'Call 108 Ambulance'}
              </span>
            </button>

            {/* Broadcast GPS SMS to 108 & PHC */}
            <button
              onClick={handleSendSOSBroadcast}
              className="w-full flex items-center justify-center space-x-3 bg-slate-900 hover:bg-slate-800 active:scale-98 text-white p-3.5 rounded-2xl font-bold text-sm transition-all cursor-pointer"
            >
              <Send className="w-5 h-5 text-teal-400" />
              <span>
                {language === 'mr' ? 'GPS लोकेशन SMS पाठवा' : language === 'hi' ? 'GPS लोकेशन SMS भेजें' : 'Send GPS Location SMS'}
              </span>
            </button>
          </div>

          {locationError && (
            <div className="bg-amber-50 border border-amber-300 p-3 rounded-xl text-amber-900 text-xs font-semibold">
              {locationError}
            </div>
          )}

          {/* Quick Direct Contacts to Emergency Helplines */}
          <div className="border-t border-slate-200 pt-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              {language === 'mr' ? 'स्थानिक आपत्कालीन संपर्क:' : language === 'hi' ? 'स्थानीय आपातकालीन संपर्क:' : 'Local Emergency Helplines:'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <a
                href="tel:108"
                className="flex items-center justify-between p-2.5 bg-teal-50 hover:bg-teal-100 rounded-xl border border-teal-200 font-semibold text-teal-950 transition-colors"
              >
                <span>{language === 'mr' ? '१०८ आपत्कालीन रुग्णवाहिका:' : language === 'hi' ? '108 आपातकालीन एम्बुलेंस:' : '108 Emergency Ambulance:'}</span>
                <span className="font-mono font-bold text-teal-800">108</span>
              </a>
              <a
                href="tel:104"
                className="flex items-center justify-between p-2.5 bg-purple-50 hover:bg-purple-100 rounded-xl border border-purple-200 font-semibold text-purple-950 transition-colors"
              >
                <span>{language === 'mr' ? '१०४ आरोग्य सल्ला हेल्पलाइन:' : language === 'hi' ? '104 स्वास्थ्य सलाह हेल्पलाइन:' : '104 Health Helpline:'}</span>
                <span className="font-mono font-bold text-purple-800">104</span>
              </a>
            </div>
          </div>

          {sosSent && (
            <div className="bg-emerald-50 border border-emerald-300 p-3 rounded-xl flex items-center space-x-2 text-emerald-900 text-xs font-bold animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                {language === 'mr' ? 'आपत्कालीन संदेश पाठवला गेला आहे.' : language === 'hi' ? 'आपातकालीन अलर्ट भेज दिया गया है।' : 'Emergency distress alert broadcasted.'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
