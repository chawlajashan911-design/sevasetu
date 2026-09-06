import React, { useState, useEffect } from 'react';
import { Language, InventoryItem, OutbreakCluster } from '../types';
import { translations } from '../i18n/translations';
import { api } from '../services/api';
import { 
  BarChart3, 
  Users, 
  AlertOctagon, 
  ArrowUpRight, 
  Pill, 
  AlertTriangle, 
  Activity, 
  MapPin, 
  CheckCircle, 
  Plus, 
  RefreshCw,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';

interface AdminPortalProps {
  language: Language;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ language }) => {
  const t = translations[language];

  const [metrics, setMetrics] = useState<any>({
    total_screened: 42,
    p1_critical_cases: 7,
    p2_urgent_cases: 15,
    p3_routine_cases: 20,
    active_referrals: 5,
    completed_referrals: 12,
    low_stock_medicines: 3,
    avg_triage_response_time_mins: 3.4
  });

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [outbreaks, setOutbreaks] = useState<OutbreakCluster[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const overview = await api.getDistrictOverview();
      setMetrics(overview.metrics);

      const invData = await api.getInventory();
      setInventory(invData.items);

      const obData = await api.getOutbreakClusters();
      setOutbreaks(obData.clusters);
    } catch (e) {
      console.error('Admin data load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRestock = async (item: InventoryItem) => {
    const newStock = item.current_stock + 100;
    await api.updateStock(item.id, newStock);
    const msg = language === 'mr' 
      ? `${item.medicine_name} साठा वाढवला: +100 ${item.unit}` 
      : language === 'hi' 
      ? `${item.medicine_name} स्टॉक बढ़ाया: +100 ${item.unit}` 
      : `Restocked ${item.medicine_name}: +100 ${item.unit}`;
    alert(msg);
    loadData();
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Admin Top Header Banner */}
      <div className="bg-gradient-to-r from-amber-800 via-stone-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-amber-600 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-lg">
              📊
            </div>
            <div>
              <span className="bg-amber-500/30 text-amber-200 text-xs font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-400/40">
                {language === 'mr' ? 'तालुका आरोग्य पाळत यंत्रणा' : language === 'hi' ? 'जिला स्वास्थ्य निगरानी प्रणाली' : 'DISTRICT HEALTH SURVEILLANCE'}
              </span>
              <h2 className="text-xl sm:text-3xl font-black mt-1">
                {t.admin_title}
              </h2>
              <p className="text-xs text-amber-200/80 font-medium">
                {t.admin_subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-2xl border border-white/20 text-xs font-bold transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t.refresh_dashboard}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Screened */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase">{t.kpi_screened}</span>
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 font-mono">
            {metrics.total_screened || 42}
          </p>
          <p className="text-[11px] text-emerald-600 font-bold flex items-center">
            <TrendingUp className="w-3 h-3 mr-1" /> +18% {language === 'mr' ? 'मागील आठवड्यापेक्षा' : language === 'hi' ? 'पिछले सप्ताह से' : 'vs last week'}
          </p>
        </div>

        {/* P1 Critical */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase">{t.kpi_critical}</span>
            <AlertOctagon className="w-5 h-5 text-red-600" />
          </div>
          <p className="text-3xl font-black text-red-600 font-mono">
            {metrics.p1_critical_cases || 7}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">
            {language === 'mr' ? '१०८ रुग्णवाहिका सज्जता सक्रिय' : language === 'hi' ? '108 एम्बुलेंस तत्पर' : '108 Ambulance Dispatch Active'}
          </span>
        </div>

        {/* Active Referrals */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase">{t.kpi_referrals}</span>
            <ArrowUpRight className="w-5 h-5 text-teal-600" />
          </div>
          <p className="text-3xl font-black text-slate-900 font-mono">
            {metrics.active_referrals || 5}
          </p>
          <span className="text-[11px] text-slate-500 font-medium">
            {language === 'mr' ? 'मंचर RH व पुणे DH कडे पाठवले' : language === 'hi' ? 'मंचर RH एवं पुणे DH को प्रेषित' : 'En Route to Specialist Facilities'}
          </span>
        </div>

        {/* Low Stock Medicines */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase">{t.kpi_medicines}</span>
            <Pill className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-amber-600 font-mono">
            {metrics.low_stock_medicines || 3}
          </p>
          <span className="text-[11px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
            {t.low_stock_warning}
          </span>
        </div>
      </div>

      {/* Main Grid: Medicine Inventory & Outbreak Surveillance Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: PHC Medicine Inventory Monitor with Low Stock Alerts */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Pill className="w-5 h-5 text-teal-600" />
              <h3 className="text-base font-black text-slate-900">
                {language === 'mr' ? 'खरपुडी PHC औषध साठा' : language === 'hi' ? 'खरपुडी PHC दवा स्टॉक' : 'PHC Medicine Inventory (Kharpudi)'}
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {language === 'mr' ? `एकूण: ${inventory.length} प्रकार` : language === 'hi' ? `कुल: ${inventory.length} दवाएं` : `Total: ${inventory.length} Items`}
            </span>
          </div>

          <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
            {inventory.map((item) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between text-xs ${
                  item.is_low_stock
                    ? 'bg-rose-50/80 border-rose-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-900 text-sm">
                      {item.medicine_name}
                    </span>
                    {item.is_low_stock && (
                      <span className="bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase animate-pulse">
                        {language === 'mr' ? 'कमी साठा' : language === 'hi' ? 'कम स्टॉक' : 'Low Stock'}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {language === 'mr' ? 'श्रेणी:' : language === 'hi' ? 'श्रेणी:' : 'Category:'} {item.category} • {language === 'mr' ? 'किमान मर्यादा:' : language === 'hi' ? 'न्यूनतम सीमा:' : 'Min Threshold:'} {item.min_threshold} {item.unit}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <span className={`text-base font-black font-mono block ${
                      item.is_low_stock ? 'text-red-700' : 'text-slate-900'
                    }`}>
                      {item.current_stock}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">{item.unit}</span>
                  </div>

                  <button
                    onClick={() => handleRestock(item)}
                    className="p-2 bg-slate-200 hover:bg-teal-600 hover:text-white rounded-xl text-slate-700 transition-colors"
                    title={language === 'mr' ? '+100 साठा जोडा' : language === 'hi' ? '+100 स्टॉक जोड़ें' : 'Add +100 Units'}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Village Outbreak Heatmap & Surveillance */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-red-600" />
              <h3 className="text-base font-black text-slate-900">
                {t.outbreak_map}
              </h3>
            </div>
            <span className="bg-red-100 text-red-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">
              {language === 'mr' ? 'पाळत ग्रीड' : language === 'hi' ? 'निगरानी ग्रिड' : 'Surveillance Grid'}
            </span>
          </div>

          <p className="text-xs text-slate-600 font-medium">
            {language === 'mr' 
              ? 'AI लक्षणांच्या आधारे क्लस्टर विश्लेषण — दूषित पाणी व डासांमुळे होणाऱ्या साथींची पूर्वसूचना.' 
              : language === 'hi' 
              ? 'AI लक्षणों के आधार पर क्लस्टर विश्लेषण — संक्रामक रोगों की पूर्व चेतावनी।' 
              : 'Symptom-cluster analysis for early waterborne and vector-borne outbreak detection.'}
          </p>

          {/* Outbreak Heatmap Visual Cluster Cards */}
          <div className="space-y-3">
            {outbreaks.map((ob) => (
              <div
                key={ob.id}
                className={`p-4 rounded-2xl border ${
                  ob.risk_level === 'High'
                    ? 'bg-red-50 border-red-300'
                    : ob.risk_level === 'Medium'
                    ? 'bg-amber-50 border-amber-300'
                    : 'bg-emerald-50 border-emerald-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <MapPin className={`w-4 h-4 ${
                        ob.risk_level === 'High' ? 'text-red-600' : 'text-amber-600'
                      }`} />
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {ob.village} ({ob.wadi})
                      </h4>
                    </div>
                    <p className="text-xs font-bold text-slate-700 mt-1">
                      {language === 'mr' ? 'साथीचा प्रकार:' : language === 'hi' ? 'रोग प्रकार:' : 'Disease:'} <strong>{ob.disease}</strong>
                    </p>
                  </div>

                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase ${
                      ob.risk_level === 'High'
                        ? 'bg-red-600 text-white'
                        : ob.risk_level === 'Medium'
                        ? 'bg-amber-500 text-white'
                        : 'bg-emerald-600 text-white'
                    }`}>
                      {ob.risk_level} Risk
                    </span>
                    <p className="text-xs font-bold text-slate-600 mt-1">
                      {ob.cases} {language === 'mr' ? 'सक्रिय रुग्ण' : language === 'hi' ? 'सक्रिय मरीज' : 'Active Cases'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 text-[11px] text-slate-600 flex justify-between items-center">
                  <span>
                    {language === 'mr' 
                      ? 'कृती: आशा कार्यकर्त्यांमार्फत क्लोरीन गोळ्या व तपासणी मोहीम' 
                      : language === 'hi' 
                      ? 'कार्यवाही: क्लोरीन गोलियां एवं घर-घर जांच अभियान' 
                      : 'Action: ASHA chlorine distribution & door-to-door checkup'}
                  </span>
                  <span className="font-bold text-teal-700">
                    {language === 'mr' ? 'सक्रिय पाळत' : language === 'hi' ? 'सक्रिय निगरानी' : 'Active Vigil'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Referral Flow Distribution */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 mt-4">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">
              {language === 'mr' ? 'रेफरल प्रवाह साखळी:' : language === 'hi' ? 'रेफरल प्रवाह श्रृंखला:' : 'Referral Flow Hierarchy:'}
            </h4>
            <div className="flex items-center justify-between text-center text-[11px] font-bold text-slate-700">
              <div className="p-2 bg-white rounded-xl border border-slate-300 flex-1">
                {language === 'mr' ? 'उप-केंद्र (0.8km)' : language === 'hi' ? 'उप-केंद्र (0.8km)' : 'Sub-Centre (0.8km)'}
              </div>
              <span className="mx-1 text-slate-400">➔</span>
              <div className="p-2 bg-teal-100 text-teal-950 rounded-xl border border-teal-300 flex-1">
                {language === 'mr' ? 'खरपुडी PHC (2.5km)' : language === 'hi' ? 'खरपुडी PHC (2.5km)' : 'Kharpudi PHC (2.5km)'}
              </div>
              <span className="mx-1 text-slate-400">➔</span>
              <div className="p-2 bg-blue-100 text-blue-950 rounded-xl border border-blue-300 flex-1">
                {language === 'mr' ? 'मंचर RH (12km)' : language === 'hi' ? 'मंचर RH (12km)' : 'Manchar RH (12km)'}
              </div>
              <span className="mx-1 text-slate-400">➔</span>
              <div className="p-2 bg-purple-100 text-purple-950 rounded-xl border border-purple-300 flex-1">
                {language === 'mr' ? 'पुणे DH (65km)' : language === 'hi' ? 'पुणे DH (65km)' : 'Pune DH (65km)'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
