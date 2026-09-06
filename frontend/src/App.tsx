import React, { useState, useEffect } from 'react';
import { PortalType, Language, Patient, TriageRecord } from './types';
import { Navbar } from './components/Navbar';
import { PatientPortal } from './portals/PatientPortal';
import { AshaPortal } from './portals/AshaPortal';
import { DoctorPortal } from './portals/DoctorPortal';
import { AdminPortal } from './portals/AdminPortal';
import { EmergencySOSModal } from './components/EmergencySOSModal';
import { AbhaCardModal } from './components/AbhaCardModal';
import { TeleconsultModal } from './components/TeleconsultModal';
import { useGeolocation } from './hooks/useGeolocation';
import { getPendingSyncCount } from './db/dexie';

export const App: React.FC = () => {
  const [currentPortal, setCurrentPortal] = useState<PortalType>('patient');
  const [language, setLanguage] = useState<Language>('mr'); // Default to Marathi for Maharashtra demo
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Modals state
  const [isSOSOpen, setIsSOSOpen] = useState<boolean>(false);
  const [selectedPatientForAbha, setSelectedPatientForAbha] = useState<Patient | null>(null);
  const [selectedRecordForTeleconsult, setSelectedRecordForTeleconsult] = useState<TriageRecord | null>(null);

  // Geolocation
  const geo = useGeolocation();

  // Polling / listening for pending sync count
  useEffect(() => {
    const updateCount = async () => {
      const count = await getPendingSyncCount();
      setPendingSyncCount(count);
    };
    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-teal-500 selection:text-white font-sans">
      {/* Global Navigation Bar with Portal Switcher & Multilingual Controls */}
      <Navbar
        currentPortal={currentPortal}
        setPortal={setCurrentPortal}
        language={language}
        setLanguage={setLanguage}
        isOffline={isOffline}
        setIsOffline={setIsOffline}
        pendingSyncCount={pendingSyncCount}
        openSOS={() => setIsSOSOpen(true)}
      />

      {/* Main App Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {currentPortal === 'patient' && (
          <PatientPortal
            language={language}
            openSOS={() => setIsSOSOpen(true)}
            openAbha={(p) => setSelectedPatientForAbha(p)}
            gpsLocation={geo}
            isOffline={isOffline}
          />
        )}

        {currentPortal === 'asha' && (
          <AshaPortal
            language={language}
            isOffline={isOffline}
            setIsOffline={setIsOffline}
            pendingSyncCount={pendingSyncCount}
            setPendingSyncCount={setPendingSyncCount}
          />
        )}

        {currentPortal === 'doctor' && (
          <DoctorPortal
            language={language}
            openTeleconsult={(r) => setSelectedRecordForTeleconsult(r)}
          />
        )}

        {currentPortal === 'admin' && (
          <AdminPortal
            language={language}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            <strong>{language === 'mr' ? 'सेवासेतू' : language === 'hi' ? 'सेवासेतु' : 'SevaSetu'}</strong> • {language === 'mr' ? 'ग्रामीण आरोग्य AI प्रणाली' : language === 'hi' ? 'ग्रामीण स्वास्थ्य AI प्रणाली' : 'Rural Smart Healthcare Grid'}
          </p>
          <p className="text-slate-400">
            {language === 'mr' 
              ? 'प्राथमिक केंद्र: खरपुडी, आंबेगाव, पुणे • ऑफलाइन-सक्षम' 
              : language === 'hi' 
              ? 'प्राथमिक केंद्र: खरपुडी, आम्बेगांव, पुणे • ऑफलाइन-सक्षम' 
              : 'Facility: Kharpudi, Ambegaon, Pune • Offline-Ready'}
          </p>
        </div>
      </footer>

      {/* Modals */}
      <EmergencySOSModal
        isOpen={isSOSOpen}
        onClose={() => setIsSOSOpen(false)}
        language={language}
        gpsLocation={geo}
      />

      <AbhaCardModal
        isOpen={!!selectedPatientForAbha}
        onClose={() => setSelectedPatientForAbha(null)}
        language={language}
        patient={selectedPatientForAbha}
      />

      <TeleconsultModal
        isOpen={!!selectedRecordForTeleconsult}
        onClose={() => setSelectedRecordForTeleconsult(null)}
        language={language}
        patientRecord={selectedRecordForTeleconsult}
      />
    </div>
  );
};

export default App;
