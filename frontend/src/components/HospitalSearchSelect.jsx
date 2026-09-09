import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Building2, Search, MapPin, Phone, RefreshCw, X, AlertCircle } from 'lucide-react';

export const HospitalSearchSelect = ({
  selectedHospital = null,
  onSelect,
  language = 'mr',
  compact = false,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.searchHospitals(query, undefined, 25);
        setResults(data);
      } catch (err) {
        console.error('Hospital search error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  const placeholderText = language === 'mr'
    ? 'रुग्णालयाचे नाव शोधा (उदा. Civil, Sassoon, KEM, Rural Hospital)...'
    : language === 'hi'
    ? 'अस्पताल का नाम खोजें (उदा. Civil, Sassoon, KEM, Rural Hospital)...'
    : 'Search hospital name (e.g. Civil, Sassoon, KEM, Rural Hospital)...';

  return (
    <div className="space-y-2.5" ref={dropdownRef}>
      <label className="block text-xs font-bold text-slate-700 flex items-center justify-between">
        <span className="flex items-center space-x-1.5">
          <Building2 className="w-4 h-4 text-rose-600" />
          <span>
            {language === 'mr' ? 'शासकीय व नोंदणीकृत रुग्णालय निवडा' : language === 'hi' ? 'सरकारी व पंजीकृत अस्पताल चुनें' : 'Select Hospital from Government Dataset'}
          </span>
        </span>
        <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-bold border border-rose-200">
          hospital_directory.csv (MH)
        </span>
      </label>

      {/* Selected Hospital Display Card */}
      {selectedHospital ? (
        <div className="p-4 bg-rose-50/70 border-2 border-rose-400/80 rounded-2xl space-y-2 relative animate-fadeIn">
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQuery('');
              setIsOpen(true);
            }}
            className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 bg-white/80 p-1 rounded-full shadow-xs transition-colors cursor-pointer"
            title="Change Hospital"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start space-x-3 pr-6">
            <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-base shrink-0 shadow-sm">
              🏥
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-1">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-200 text-rose-900 border border-rose-300">
                  {selectedHospital.care_type || 'Hospital'}
                </span>
                {selectedHospital.category && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {selectedHospital.category}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-black text-slate-900 leading-tight">
                {selectedHospital.name}
              </h4>
              <p className="text-xs text-slate-600 font-medium flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="truncate">
                  {selectedHospital.address || `${selectedHospital.district}, Maharashtra`}
                  {selectedHospital.pincode ? ` (PIN: ${selectedHospital.pincode})` : ''}
                </span>
              </p>
            </div>
          </div>

          {/* Auto-loaded Details Grid */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-rose-200/80 text-[11px]">
            <div className="bg-white/80 p-2 rounded-xl border border-rose-150">
              <span className="text-slate-400 font-bold block text-[10px] uppercase">District & State:</span>
              <span className="font-bold text-slate-800">{selectedHospital.district || 'Maharashtra'}</span>
            </div>

            {selectedHospital.beds && Number(selectedHospital.beds) > 0 ? (
              <div className="bg-white/80 p-2 rounded-xl border border-rose-150">
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Registered Beds:</span>
                <span className="font-bold text-blue-700">🛏️ {selectedHospital.beds} Beds</span>
              </div>
            ) : (
              <div className="bg-white/80 p-2 rounded-xl border border-rose-150">
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Facility Status:</span>
                <span className="font-bold text-emerald-700">🟢 Operational</span>
              </div>
            )}

            {selectedHospital.phone && (
              <div className="bg-white/80 p-2 rounded-xl border border-rose-150 col-span-2 flex items-center space-x-1.5">
                <Phone className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span className="font-semibold text-slate-800">{selectedHospital.phone}</span>
              </div>
            )}

            {selectedHospital.specialties && (
              <div className="bg-white/80 p-2 rounded-xl border border-rose-150 col-span-2">
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Specialties:</span>
                <p className="text-slate-700 font-medium text-[10px] truncate">{selectedHospital.specialties}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Search Input and Dropdown */
        <div className="relative">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all outline-none"
              placeholder={placeholderText}
            />
            {loading ? (
              <RefreshCw className="w-4 h-4 text-rose-600 animate-spin absolute right-3.5 top-3.5" />
            ) : query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                }}
                className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            ) : null}
          </div>

          {/* Search Results Dropdown */}
          {isOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 max-h-64 overflow-y-auto divide-y divide-slate-100 animate-fadeIn">
              {results.length > 0 ? (
                results.map((hosp) => (
                  <button
                    key={hosp.id}
                    type="button"
                    onClick={() => {
                      onSelect(hosp);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    className="w-full text-left p-3 hover:bg-rose-50/70 transition-colors flex items-start space-x-2.5 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h5 className="text-xs font-extrabold text-slate-900 truncate">
                          {hosp.name}
                        </h5>
                        <span className="text-[10px] font-black px-2 py-0.2 rounded-full bg-rose-100 text-rose-800 shrink-0">
                          {hosp.district || 'MH'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {hosp.address || hosp.district}
                        {hosp.care_type ? ` • ${hosp.care_type}` : ''}
                      </p>
                      {hosp.beds && Number(hosp.beds) > 0 ? (
                        <p className="text-[10px] text-blue-700 font-bold mt-0.5">
                          🛏️ {hosp.beds} Beds
                        </p>
                      ) : null}
                    </div>
                  </button>
                ))
              ) : query.trim() ? (
                <div className="p-4 text-center text-xs text-slate-500 space-y-1">
                  <AlertCircle className="w-5 h-5 text-slate-400 mx-auto" />
                  <p className="font-bold">No hospital found in dataset for "{query}"</p>
                  <p className="text-[11px] text-slate-400">Only authentic hospitals from hospital_directory.csv are listed.</p>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  Type a hospital name or district (e.g. Pune, Thane, Civil, General, Sassoon, KEM)...
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
