import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

export function useGeolocation() {
  const [location, setLocation] = useState({
    lat: null,
    lng: null,
    accuracy: null,
    villageName: null,
    error: null,
    loading: true,
    isOutsideMH: false,
    nearestBorderDistanceKm: 0,
    boundaryBadge: "Detecting Grid Location..."
  });

  const getGPSLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        error: "HTML5 Geolocation is not supported by this browser",
        loading: false,
        boundaryBadge: "GPS Unsupported"
      }));
      return;
    }

    setLocation(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        
        // Query backend facility proximity engine (Haversine spatial calculation)
        let isOutside = false;
        let boundaryBadge = "Maharashtra Health Grid";
        let nearestDist = 0;

        try {
          const facData = await api.getFacilities({ lat: latitude, lng: longitude, limit: 1 });
          if (facData) {
            isOutside = facData.is_outside_maharashtra || false;
            boundaryBadge = facData.boundary_badge || (isOutside ? "Outside Maharashtra" : "Maharashtra Health Grid");
            nearestDist = facData.nearest_border_distance_km || 0;
          }
        } catch (e) {
          // Local fallback boundary calculation
          isOutside = !(latitude >= 15.60 && latitude <= 22.05 && longitude >= 72.60 && longitude <= 80.95);
          boundaryBadge = isOutside ? "Outside Maharashtra State" : "Maharashtra Health Grid";
        }

        let villageName = isOutside ? `Live GPS (${boundaryBadge})` : "Live Maharashtra GPS Position";
        try {
          const savedVillage = localStorage.getItem('sevasetu_patient_village');
          if (savedVillage) {
            const parsed = JSON.parse(savedVillage);
            if (parsed.village) {
              villageName = `${parsed.village}, ${parsed.taluka || ''} (${parsed.district || ''})`.trim();
            }
          }
        } catch {
          // ignore
        }

        setLocation({
          lat: latitude,
          lng: longitude,
          accuracy: Math.round(accuracy),
          villageName,
          error: null,
          loading: false,
          isOutsideMH: isOutside,
          nearestBorderDistanceKm: nearestDist,
          boundaryBadge
        });
      },
      (err) => {
        console.warn("HTML5 Geolocation access notice:", err.message);
        
        let savedVillageName = null;
        try {
          const savedVillage = localStorage.getItem('sevasetu_patient_village');
          if (savedVillage) {
            const parsed = JSON.parse(savedVillage);
            if (parsed.village) {
              savedVillageName = `${parsed.village}, ${parsed.taluka || ''} (${parsed.district || ''})`.trim();
            }
          }
        } catch {
          // ignore
        }

        setLocation({
          lat: null,
          lng: null,
          accuracy: null,
          villageName: savedVillageName || "Location Not Available (Select Village Manually)",
          error: err.message || "GPS permission not granted",
          loading: false,
          isOutsideMH: false,
          nearestBorderDistanceKm: 0,
          boundaryBadge: "Manual Village Mode"
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    );
  }, []);

  useEffect(() => {
    getGPSLocation();
  }, [getGPSLocation]);

  // Haversine distance calculator in KM
  const calculateDistanceKm = (targetLat, targetLng) => {
    if (!location.lat || !location.lng || !targetLat || !targetLng) return null;
    const R = 6371; // Earth radius in KM
    const dLat = ((targetLat - location.lat) * Math.PI) / 180;
    const dLng = ((targetLng - location.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((location.lat * Math.PI) / 180) *
        Math.cos((targetLat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
  };

  return {
    ...location,
    refreshLocation: getGPSLocation,
    calculateDistanceKm
  };
}
