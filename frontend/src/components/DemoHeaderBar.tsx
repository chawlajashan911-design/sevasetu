// @ts-nocheck
import React, { useState } from 'react';
import { useDemoMode, DEMO_PRESETS } from '../context/DemoContext';
import { api } from '../services/api';
import { 
  ShieldCheck, 
  Sparkles, 
  ChevronDown, 
  Check, 
  Zap, 
  Layers, 
  Info,
  RotateCcw
} from 'lucide-react';

export const DemoHeaderBar = () => {
  const { isDemoMode, toggleDemoMode, applyPreset } = useDemoMode();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(null);
  const [isResetting, setIsResetting] = useState(false);

  const handleSelectPreset = (key) => {
    const preset = DEMO_PRESETS[key];
    applyPreset(key);
    setSelectedLabel(preset.label);
    setDropdownOpen(false);
  };

  const handleResetAllData = async () => {
    if (!window.confirm("Are you sure you want to delete all localhost data and reset the system to clean state?")) return;
    setIsResetting(true);
    try {
      await api.resetSystemData();
    } catch (e) {
      console.warn("Backend reset error:", e);
    }
    localStorage.clear();
    alert("✓ All localhost data, sessions, and records have been completely purged.");
    window.location.reload();
  };

  return (
    <div className={`w-full text-xs font-semibold px-3 sm:px-6 py-2 transition-all border-b z-50 ${
      isDemoMode 
        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm' 
        : 'bg-slate-950 text-slate-200 border-slate-800'
    }`}>
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Left Status Text */}
        <div className="flex items-center space-x-2">
          {isDemoMode ? (
            <div className="flex items-center space-x-1.5 font-extrabold text-slate-950">
              <span className="p-1 bg-amber-400 rounded-lg">
                <Sparkles className="w-3.5 h-3.5" />
              </span>
              <span className="tracking-wide uppercase text-[11px] bg-amber-600/30 px-2 py-0.5 rounded-full border border-amber-700/40">
                Demo Quick-Fill Mode Active
              </span>
              <span className="hidden sm:inline text-slate-800 font-medium">
                • 1-Click sample data auto-fill enabled for review
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 font-medium text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-emerald-400 uppercase text-[11px] bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40">
                Live Production Mode
              </span>
              <span className="hidden sm:inline text-slate-400">
                • Real Maharashtra Grid • Zero Mock Data • Real OTP & DB Verification
              </span>
            </div>
          )}
        </div>

        {/* Right Actions: Quick-Fill Dropdown (When Demo is ON) & Toggle Switch */}
        <div className="flex items-center space-x-3">
          {isDemoMode && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-1.5 bg-slate-900 text-amber-300 hover:bg-slate-800 px-3 py-1 rounded-xl font-bold shadow transition-all border border-amber-400/40 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate max-w-[180px] sm:max-w-xs">
                  {selectedLabel || 'Quick-Fill Sample Preset ▾'}
                </span>
                <ChevronDown className="w-3 h-3 text-amber-400" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden z-50 animate-fadeIn">
                  <div className="p-2.5 bg-slate-950 border-b border-slate-800 text-[11px] text-amber-300 font-bold flex items-center justify-between">
                    <span>Select Reviewer Profile</span>
                    <span className="text-[10px] text-slate-400">1-Click Auto-Fill</span>
                  </div>
                  <div className="p-1 max-h-60 overflow-y-auto space-y-0.5">
                    {Object.entries(DEMO_PRESETS).map(([key, item]) => (
                      <button
                        key={key}
                        onClick={() => handleSelectPreset(key)}
                        className="w-full text-left p-2 rounded-xl text-slate-200 hover:bg-amber-500/20 hover:text-white transition-colors flex items-center justify-between group cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-xs group-hover:text-amber-300">{item.label}</p>
                          <p className="text-[10px] text-slate-400">{item.phone} • {item.role.toUpperCase()}</p>
                        </div>
                        {selectedLabel === item.label && (
                          <Check className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Reset Data Button */}
          <button
            onClick={handleResetAllData}
            disabled={isResetting}
            className="flex items-center space-x-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white px-2.5 py-1 rounded-full text-[10px] font-bold border border-rose-500/40 transition-colors cursor-pointer"
            title="Delete all localhost data, clear cache, and reset database"
          >
            <RotateCcw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Reset Data</span>
          </button>

          {/* Toggle Switch */}
          <div className="flex items-center space-x-2 bg-black/20 p-0.5 rounded-full">
            <span className="text-[10px] font-bold uppercase tracking-wider pl-1">
              {isDemoMode ? 'Demo Mode' : 'Prod Mode'}
            </span>
            <button
              onClick={toggleDemoMode}
              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer ${
                isDemoMode ? 'bg-slate-950' : 'bg-slate-700'
              }`}
              title="Toggle Live Production / Demo Mode"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isDemoMode ? 'translate-x-5 bg-amber-400' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
