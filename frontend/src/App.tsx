// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { RoleSelectionScreen } from './components/RoleSelectionScreen';
import { useGeolocation } from './hooks/useGeolocation';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { DemoProvider } from './context/DemoContext';
import { DemoHeaderBar } from './components/DemoHeaderBar';

// Code-split portals and modals via React.lazy for optimal initial bundle delivery
const PatientPortal = React.lazy(() => import('./portals/PatientPortal').then(m => ({ default: m.PatientPortal })));
const DoctorPortal = React.lazy(() => import('./portals/DoctorPortal').then(m => ({ default: m.DoctorPortal })));
const ClinicPortal = React.lazy(() => import('./portals/ClinicPortal').then(m => ({ default: m.ClinicPortal })));
const HospitalPortal = React.lazy(() => import('./portals/HospitalPortal').then(m => ({ default: m.HospitalPortal })));
const AshaPortal = React.lazy(() => import('./portals/AshaPortal').then(m => ({ default: m.AshaPortal })));
const AdminPortal = React.lazy(() => import('./portals/AdminPortal').then(m => ({ default: m.AdminPortal })));
const DemoLoginModal = React.lazy(() => import('./components/DemoLoginModal').then(m => ({ default: m.DemoLoginModal })));
const EmergencySOSModal = React.lazy(() => import('./components/EmergencySOSModal').then(m => ({ default: m.EmergencySOSModal })));
const AbhaCardModal = React.lazy(() => import('./components/AbhaCardModal').then(m => ({ default: m.AbhaCardModal })));
const TeleconsultModal = React.lazy(() => import('./components/TeleconsultModal').then(m => ({ default: m.TeleconsultModal })));

const FallbackLoader = () => (
  <div className="flex items-center justify-center min-h-[40vh] p-8 text-center text-slate-500">
    <div className="flex flex-col items-center space-y-3">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="text-sm font-semibold">Loading Module...</p>
    </div>
  </div>
);

const AppContent = () => {
  const navigate = useNavigate();

  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('sevasetu_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [selectedRoleForLogin, setSelectedRoleForLogin] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // App Settings & Language
  const [language, setLanguage] = useState('mr'); // Default to Marathi

  // Automatic Network Status & Sync Listener (HTML5 Navigator + Events)
  const { 
    isOnline, 
    pendingCount, 
    syncSuccessMsg, 
    triggerManualSync 
  } = useNetworkStatus();

  const isOffline = !isOnline;

  // Modals state
  const [isSOSOpen, setIsSOSOpen] = useState(false);
  const [selectedPatientForAbha, setSelectedPatientForAbha] = useState(null);
  const [selectedRecordForTeleconsult, setSelectedRecordForTeleconsult] = useState(null);

  // Geolocation
  const geo = useGeolocation();

  // Role Selection & Login Handlers
  const handleSelectRole = (role) => {
    setSelectedRoleForLogin(role);
    setIsLoginModalOpen(true);
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    localStorage.setItem('sevasetu_user', JSON.stringify(user));
    setIsLoginModalOpen(false);

    // Route to corresponding portal
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
      {/* Global Header Bar: Demo Mode Toggle & Quick-Fill Presets */}
      <DemoHeaderBar />

      <React.Suspense fallback={<FallbackLoader />}>
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
                pendingSyncCount={pendingCount}
                openSOS={() => setIsSOSOpen(true)}
                triggerManualSync={triggerManualSync}
                syncSuccessMsg={syncSuccessMsg}
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
                pendingSyncCount={pendingCount}
                openSOS={() => setIsSOSOpen(true)}
                triggerManualSync={triggerManualSync}
                syncSuccessMsg={syncSuccessMsg}
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
                pendingSyncCount={pendingCount}
                openSOS={() => setIsSOSOpen(true)}
                triggerManualSync={triggerManualSync}
                syncSuccessMsg={syncSuccessMsg}
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
                pendingSyncCount={pendingCount}
                openSOS={() => setIsSOSOpen(true)}
                triggerManualSync={triggerManualSync}
                syncSuccessMsg={syncSuccessMsg}
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
                pendingSyncCount={pendingCount}
                openSOS={() => setIsSOSOpen(true)}
                triggerManualSync={triggerManualSync}
                syncSuccessMsg={syncSuccessMsg}
              />
              <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
                <AshaPortal
                  language={language}
                  isOffline={isOffline}
                  pendingSyncCount={pendingCount}
                />
              </main>
            </>
          }
        />

        {/* Route 7: SEPARATE DISTRICT ADMIN DASHBOARD (/admin) */}
        <Route
          path="/admin"
          element={
            <>
              <Navbar
                currentRole="admin"
                currentUser={currentUser}
                onLogout={handleLogout}
                language={language}
                setLanguage={setLanguage}
                isOffline={isOffline}
                pendingSyncCount={pendingCount}
                openSOS={() => setIsSOSOpen(true)}
                triggerManualSync={triggerManualSync}
                syncSuccessMsg={syncSuccessMsg}
              />
              <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
                <AdminPortal
                  language={language}
                />
              </main>
            </>
          }
        />

        {/* Aliases & Fallbacks */}
        <Route path="/asha" element={<Navigate to="/health-worker" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </React.Suspense>

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
              : 'Built according to Ayushman Bharat Digital Mission (ABDM) & NHM Standards'}
          </p>
        </div>
      </footer>

      {/* Modals wrapped in lightweight Suspense */}
      <React.Suspense fallback={null}>
        {/* Role Login Modal with ABDM Gateway & Interactive Prompt */}
        <DemoLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          role={selectedRoleForLogin}
          language={language}
          onLoginSuccess={handleLoginSuccess}
        />

        {/* Emergency SOS Modal */}
        <EmergencySOSModal
          isOpen={isSOSOpen}
          onClose={() => setIsSOSOpen(false)}
          language={language}
          gpsLocation={geo}
        />

        {/* ABHA Card Modal */}
        <AbhaCardModal
          isOpen={!!selectedPatientForAbha}
          onClose={() => setSelectedPatientForAbha(null)}
          language={language}
          patient={selectedPatientForAbha}
        />

        {/* Teleconsult Modal */}
        <TeleconsultModal
          isOpen={!!selectedRecordForTeleconsult}
          onClose={() => setSelectedRecordForTeleconsult(null)}
          language={language}
          patientRecord={selectedRecordForTeleconsult}
        />
      </React.Suspense>
    </div>
  );
};

export const App = () => {
  return (
    <DemoProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </DemoProvider>
  );
};

export default App;
