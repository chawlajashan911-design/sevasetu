import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Language, Patient, TriageRecord, UserRole, AuthUser } from './types';
import { Navbar } from './components/Navbar';
import { RoleSelectionScreen } from './components/RoleSelectionScreen';
import { DemoLoginModal } from './components/DemoLoginModal';
import { PatientPortal } from './portals/PatientPortal';
import { DoctorPortal } from './portals/DoctorPortal';
import { ClinicPortal } from './portals/ClinicPortal';
import { HospitalPortal } from './portals/HospitalPortal';
import { AshaPortal } from './portals/AshaPortal';
import { AdminPortal } from './portals/AdminPortal';
import { EmergencySOSModal } from './components/EmergencySOSModal';
import { AbhaCardModal } from './components/AbhaCardModal';
import { TeleconsultModal } from './components/TeleconsultModal';
import { useGeolocation } from './hooks/useGeolocation';
import { getPendingSyncCount } from './db/dexie';

const AppContent: React.FC = () => {
  const navigate = useNavigate();

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    const saved = localStorage.getItem('sevasetu_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [selectedRoleForLogin, setSelectedRoleForLogin] = useState<UserRole | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // App Settings
  const [language, setLanguage] = useState<Language>('mr'); // Default to Marathi
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Modals state
  const [isSOSOpen, setIsSOSOpen] = useState<boolean>(false);
  const [selectedPatientForAbha, setSelectedPatientForAbha] = useState<Patient | null>(null);
  const [selectedRecordForTeleconsult, setSelectedRecordForTeleconsult] = useState<TriageRecord | null>(null);

  // Geolocation
  const geo = useGeolocation();

  // Poll sync count
  useEffect(() => {
    const updateCount = async () => {
      const count = await getPendingSyncCount();
      setPendingSyncCount(count);
    };
    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  // Role Selection & Login Handlers
  const handleSelectRole = (role: UserRole) => {
    setSelectedRoleForLogin(role);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    localStorage.setItem('sevasetu_user', JSON.stringify(user));
    setIsLoginModalOpen(false);

    // Route to the corresponding separate page
    if (user.role === 'patient') navigate('/patient');
    else if (user.role === 'doctor') navigate('/doctor');
    else if (user.role === 'hospital') navigate('/hospital');
    else if (user.role === 'clinic') navigate('/clinic');
    else if (user.role === 'health_worker') navigate('/health-worker');
    else if (user.role === 'admin') navigate('/admin');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedRoleForLogin(null);
    localStorage.removeItem('sevasetu_user');
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col selection:bg-teal-500 selection:text-white font-sans">
      <Routes>
        {/* Route 1: Welcome & Role Selection Page */}
        <Route
          path="/"
          element={
            <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
              <RoleSelectionScreen
                language={language}
                setLanguage={setLanguage}
                onSelectRole={handleSelectRole}
              />
            </main>
          }
        />

        {/* Route 2: SEPARATE PATIENT DASHBOARD (/patient) */}
        <Route
          path="/patient"
          element={
            <>
              <Navbar
                currentRole="patient"
                currentUser={currentUser}
                onLogout={handleLogout}
                language={language}
                setLanguage={setLanguage}
                isOffline={isOffline}
                setIsOffline={setIsOffline}
                pendingSyncCount={pendingSyncCount}
                openSOS={() => setIsSOSOpen(true)}
              />
              <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
                <PatientPortal
                  language={language}
                  openSOS={() => setIsSOSOpen(true)}
                  openAbha={(p) => setSelectedPatientForAbha(p)}
                  gpsLocation={geo}
                  isOffline={isOffline}
                />
              </main>
            </>
          }
        />

        {/* Route 3: SEPARATE DOCTOR DASHBOARD (/doctor) */}
        <Route
          path="/doctor"
          element={
            <>
              <Navbar
                currentRole="doctor"
                currentUser={currentUser}
                onLogout={handleLogout}
                language={language}
                setLanguage={setLanguage}
                isOffline={isOffline}
                setIsOffline={setIsOffline}
                pendingSyncCount={pendingSyncCount}
                openSOS={() => setIsSOSOpen(true)}
              />
              <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
                <DoctorPortal
                  language={language}
                  openTeleconsult={(r) => setSelectedRecordForTeleconsult(r)}
                />
              </main>
            </>
          }
        />

        {/* Route 4: SEPARATE CLINIC / PHC DASHBOARD (/clinic) */}
        <Route
          path="/clinic"
          element={
            <>
              <Navbar
                currentRole="clinic"
                currentUser={currentUser}
                onLogout={handleLogout}
                language={language}
                setLanguage={setLanguage}
                isOffline={isOffline}
                setIsOffline={setIsOffline}
                pendingSyncCount={pendingSyncCount}
                openSOS={() => setIsSOSOpen(true)}
              />
              <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
                <ClinicPortal
                  language={language}
                  openTeleconsult={(r) => setSelectedRecordForTeleconsult(r)}
                />
              </main>
            </>
          }
        />

        {/* Route 5: SEPARATE HOSPITAL DASHBOARD (/hospital) */}
        <Route
          path="/hospital"
          element={
            <>
              <Navbar
                currentRole="hospital"
                currentUser={currentUser}
                onLogout={handleLogout}
                language={language}
                setLanguage={setLanguage}
                isOffline={isOffline}
                setIsOffline={setIsOffline}
                pendingSyncCount={pendingSyncCount}
                openSOS={() => setIsSOSOpen(true)}
              />
              <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
                <HospitalPortal
                  language={language}
                />
              </main>
            </>
          }
        />

        {/* Route 6: SEPARATE HEALTH WORKER DASHBOARD (/health-worker) */}
        <Route
          path="/health-worker"
          element={
            <>
              <Navbar
                currentRole="health_worker"
                currentUser={currentUser}
                onLogout={handleLogout}
                language={language}
                setLanguage={setLanguage}
                isOffline={isOffline}
                setIsOffline={setIsOffline}
                pendingSyncCount={pendingSyncCount}
                openSOS={() => setIsSOSOpen(true)}
              />
              <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
                <AshaPortal
                  language={language}
                  isOffline={isOffline}
                  setIsOffline={setIsOffline}
                  pendingSyncCount={pendingSyncCount}
                  setPendingSyncCount={setPendingSyncCount}
                />
              </main>
            </>
          }
        />

        {/* Aliases & Fallbacks */}
        <Route path="/asha" element={<Navigate to="/health-worker" replace />} />
        <Route path="/admin" element={<Navigate to="/hospital" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Global Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            <strong>{language === 'mr' ? 'सेवासेतू' : language === 'hi' ? 'सेवासेतु' : 'SevaSetu'}</strong> • {language === 'mr' ? 'स्मार्ट ग्रामीण आरोग्य व क्लिनिकल ट्रायज प्रणाली' : language === 'hi' ? 'स्मार्ट ग्रामीण स्वास्थ्य एवं क्लिनिकल ट्रायज प्रणाली' : 'Smart Rural Healthcare & Clinical Triage System'}
          </p>
          <p className="text-slate-400">
            {language === 'mr' 
              ? 'राष्ट्रीय डिजिटल आरोग्य अभियान (ABDM) व राष्ट्रीय आरोग्य अभियान (NHM) मानकांनुसार' 
              : language === 'hi' 
              ? 'राष्ट्रीय डिजिटल स्वास्थ्य मिशन (ABDM) एवं राष्ट्रीय स्वास्थ्य मिशन (NHM) मानकों के अनुसार' 
              : 'Aligned with Ayushman Bharat Digital Mission (ABDM) & National Health Mission (NHM) Standards'}
          </p>
        </div>
      </footer>

      {/* Demo Login Modal */}
      <DemoLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        role={selectedRoleForLogin}
        language={language}
        onLoginSuccess={handleLoginSuccess}
      />

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

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
