import { useState, useEffect, useCallback } from 'react';

// Neutral fallback center coordinates: Maharashtra State Grid
const MAHARASHTRA_CENTER = {
  lat: 18.5204,
  lng: 73.8567,
  villageName: "Maharashtra State Grid"
};

export function useGeolocation() {
  const [location, setLocation] = useState({
    lat: MAHARASHTRA_CENTER.lat,
    lng: MAHARASHTRA_CENTER.lng,
    accuracy: null,
    villageName: MAHARASHTRA_CENTER.villageName,
    error: null,
    loading: false
  });

  const getGPSLocation = useCallback(() => {
    // Village-based selection is prioritized per requirements; no forced browser GPS prompt
    try {
      const savedVillage = localStorage.getItem('sevasetu_patient_village');
      if (savedVillage) {
        const parsed = JSON.parse(savedVillage);
        if (parsed.lat && parsed.lng) {
          setLocation({
            lat: parsed.lat,
            lng: parsed.lng,
            accuracy: 10,
            villageName: `${parsed.village || ''}, ${parsed.taluka || ''}, ${parsed.district || ''}`.trim(),
            error: null,
            loading: false
          });
          return;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    getGPSLocation();
  }, [getGPSLocation]);

  // Haversine distance calculator in KM
  const calculateDistanceKm = (targetLat, targetLng) => {
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
