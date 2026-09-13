// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Search, MapPin, CheckCircle2, X, Loader2 } from 'lucide-react';

export const VillageSearchSelect = ({
  selectedVillage = '',
  selectedTaluka = '',
  selectedDistrict = '',
  onSelect,
  language = 'mr',
  label,
  required = false,
  placeholder,
  compact = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Localization labels
  const defaultLabel = language === 'mr' 
    ? 'तुमचे गाव निवडा (Select Your Village)' 
    : language === 'hi' 
    ? 'अपना गांव चुनें (Select Your Village)' 
    : 'Select Your Village (Maharashtra Dataset)';

  const defaultPlaceholder = language === 'mr' 
    ? 'उदा. Baramati, Ambegaon, Shirur, Haveli...' 
    : language === 'hi' 
    ? 'उदा. Baramati, Ambegaon, Shirur, Haveli...' 
    : 'Search by village name (e.g. Baramati, Ambegaon, Shirur)...';

  const talukaLabel = language === 'mr' ? 'तालुका' : language === 'hi' ? 'तालुका' : 'Taluka';
  const districtLabel = language === 'mr' ? 'जिल्हा' : language === 'hi' ? 'जिला' : 'District';

  // Debounced search with AbortController
  useEffect(() => {
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const data = await api.searchVillages(searchTerm, undefined, undefined, 20, controller.signal);
        setResults(data || []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Village search failed:', err);
        }
      } finally {
        setIsLoading(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchTerm]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectVillage = (item) => {
    onSelect({
      village: item.name,
      taluka: item.taluka,
      district: item.district,
      id: item.id
    });
    setSearchTerm('');
    setIsOpen(false);
    setResults([]);
  };

  const handleClear = () => {
    onSelect({
      village: '',
      taluka: '',
      district: ''
    });
    setSearchTerm('');
    setResults([]);
    setIsOpen(true);
  };

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      {label !== '' && (
        <label className="text-slate-700 block font-bold text-xs">
          {label || defaultLabel} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* When a village is already selected */}
      {selectedVillage ? (
        <div className="p-3.5 bg-teal-50/90 border-2 border-teal-500/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm animate-fadeIn">
          <div className="flex items-start space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-teal-950 text-sm">{selectedVillage}</span>
                <span className="bg-teal-200/80 text-teal-900 text-[10px] font-black px-2 py-0.5 rounded-md">
                  Maharashtra Verified
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs">
                <span className="bg-white/80 border border-teal-200 text-teal-800 font-semibold px-2 py-0.5 rounded-lg">
                  {talukaLabel}: <strong className="text-teal-950 font-bold">{selectedTaluka || '—'}</strong>
                </span>
                <span className="bg-white/80 border border-teal-200 text-teal-800 font-semibold px-2 py-0.5 rounded-lg">
                  {districtLabel}: <strong className="text-teal-950 font-bold">{selectedDistrict || '—'}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClear}
            className="px-2.5 py-1.5 text-xs font-bold text-teal-800 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all self-end sm:self-center flex items-center space-x-1 border border-teal-200 hover:border-red-200 cursor-pointer"
            title="Change selected village"
          >
            <X className="w-3.5 h-3.5" />
            <span>{language === 'mr' ? 'बदला' : language === 'hi' ? 'बदलें' : 'Change'}</span>
          </button>
        </div>
      ) : (
        /* Search Input Box */
        <div className="relative">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              ) : (
                <Search className="w-4 h-4 text-slate-400" />
              )}
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              placeholder={placeholder || defaultPlaceholder}
              className={`w-full pl-10 pr-10 ${
                compact ? 'py-2.5 text-xs' : 'py-3.5 text-sm'
              } rounded-2xl border border-slate-300 font-semibold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-slate-50 transition-all text-slate-900 placeholder:text-slate-400`}
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setResults([]);
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {isOpen && searchTerm.trim().length >= 2 && (
            <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 max-h-72 overflow-y-auto divide-y divide-slate-100">
              {isLoading ? (
                <div className="p-4 text-center text-slate-400 text-xs flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Searching 44,810 Maharashtra villages...</span>
                </div>
              ) : results.length > 0 ? (
                <>
                  <div className="p-2 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>{results.length} Villages Found</span>
                    <span className="text-teal-600 font-normal">Click to select</span>
                  </div>
                  {results.map((item) => (
                    <button
                      key={item.id || `${item.name}-${item.taluka}-${item.district}`}
                      type="button"
                      onClick={() => handleSelectVillage(item)}
                      className="w-full text-left p-3 hover:bg-teal-50/80 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 text-sm group-hover:text-teal-800 flex items-center space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center space-x-2 pl-5.5">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium text-[11px]">
                            {talukaLabel}: {item.taluka}
                          </span>
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium text-[11px]">
                            {districtLabel}: {item.district}
                          </span>
                        </div>
                      </div>
                      <div className="text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    </button>
                  ))}
                </>
              ) : (
                <div className="p-5 text-center text-slate-500 text-xs space-y-1">
                  <p className="font-semibold text-slate-700">No matching village found for "{searchTerm}"</p>
                  <p className="text-slate-400">Please verify spelling across Maharashtra districts & talukas.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
