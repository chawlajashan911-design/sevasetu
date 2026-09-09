import React, { createContext, useContext, useState, useEffect } from 'react';

export const DEMO_PRESETS = {
  patient_sunita: {
    id: 'patient_sunita',
    label: 'Sunita Patil • Kharpudi PHC (P1 Critical Sample)',
    role: 'patient',
    name: 'Sunita Patil',
    age: 28,
    gender: 'Female',
    phone: '9822104512',
    village: 'Kharpudi',
    taluka: 'Khed',
    district: 'Pune',
    abha_number: '91-4829-1029-4512',
    vitals: {
      systolic_bp: '165',
      diastolic_bp: '105',
      spo2: '88',
      pulse_rate: '112',
      temperature: '101.4',
      duration_days: 2,
      symptoms: 'Continuous dry cough, Severe chest heaviness, Breathlessness on exertion'
    }
  },
  doctor_deshmukh: {
    id: 'doctor_deshmukh',
    label: 'Dr. Deshmukh • Medical Officer (MBBS)',
    role: 'doctor',
    name: 'Dr. Deshmukh',
    phone: '9822019901',
    facility: 'Kharpudi Primary Health Centre'
  },
  hospital_aundh: {
    id: 'hospital_aundh',
    label: 'Aundh District Hospital • Pune',
    role: 'hospital',
    name: 'Aundh District Hospital',
    phone: '9822019902',
    facility: 'Aundh District Hospital'
  },
  clinic_phc: {
    id: 'clinic_phc',
    label: 'Kharpudi PHC OPD Desk',
    role: 'clinic',
    name: 'PHC Medical Officer',
    phone: '9822019903',
    facility: 'Kharpudi Primary Health Centre'
  },
  asha_surekha: {
    id: 'asha_surekha',
    label: 'Surekha Tai • Community ASHA Worker',
    role: 'health_worker',
    name: 'Surekha Tai',
    phone: '9822019904',
    facility: 'Khed Health Circle'
  },
  admin_district: {
    id: 'admin_district',
    label: 'District Health Officer (DHO) • Pune',
    role: 'admin',
    name: 'Dr. Patil (DHO)',
    phone: '9822019999',
    facility: 'District Health Administration'
  }
};

const DemoContext = createContext(null);

export const DemoProvider = ({ children }) => {
  // Default is false: Live Production Mode
  const [isDemoMode, setIsDemoMode] = useState(() => {
    try {
      return localStorage.getItem('sevasetu_demo_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [activePreset, setActivePreset] = useState(null);

  const toggleDemoMode = () => {
    setIsDemoMode(prev => {
      const nextVal = !prev;
      try {
        localStorage.setItem('sevasetu_demo_mode', String(nextVal));
      } catch (e) {
        console.warn('LocalStorage error:', e);
      }
      return nextVal;
    });
  };

  const applyPreset = (presetKey) => {
    const preset = DEMO_PRESETS[presetKey];
    if (preset) {
      setActivePreset(preset);
      // Dispatch custom window event so open modals/forms can populate instantly
      window.dispatchEvent(new CustomEvent('sevasetu_apply_demo_preset', { detail: preset }));
    }
  };

  return (
    <DemoContext.Provider
      value={{
        isDemoMode,
        setIsDemoMode,
        toggleDemoMode,
        activePreset,
        applyPreset,
        presets: DEMO_PRESETS
      }}
    >
      {children}
    </DemoContext.Provider>
  );
};

export const useDemoMode = () => {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemoMode must be used within a DemoProvider');
  }
  return context;
};
