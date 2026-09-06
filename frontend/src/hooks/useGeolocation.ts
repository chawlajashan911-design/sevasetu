import { useState, useEffect, useCallback } from 'react';

export interface GeoLocationState {
  lat: number;
  lng: number;
  accuracy: number | null;
  villageName: string;
  error: string | null;
  loading: boolean;
}

// Demo fallback: Kharpudi Village Center, Ambegaon Taluka, Pune
const KHARPUDI_COORDS = {
  lat: 18.9950,
  lng: 73.9520,
  villageName: "Kharpudi Village, Ambegaon, Pune"
};

export function useGeolocation() {
  const [location, setLocation] = useState<GeoLocationState>({
    lat: KHARPUDI_COORDS.lat,
    lng: KHARPUDI_COORDS.lng,
    accuracy: 15,
    villageName: KHARPUDI_COORDS.villageName,
    error: null,
    loading: false
  });

  const getGPSLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        error: 'Geolocation not supported by browser. Using Kharpudi demo coordinates.'
      }));
      return;
    }

    setLocation(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          villageName: "Live GPS (Kharpudi Vicinity)",
          error: null,
          loading: false
        });
      },
      (err) => {
        console.warn("GPS Permission or signal error, falling back to Kharpudi coordinates:", err);
        setLocation({
          lat: KHARPUDI_COORDS.lat,
          lng: KHARPUDI_COORDS.lng,
          accuracy: 25,
          villageName: "Kharpudi Village (Demo Center)",
          error: null, // silent fallback for seamless demo
          loading: false
        });
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  useEffect(() => {
    getGPSLocation();
  }, [getGPSLocation]);

  // Haversine distance calculator in KM
  const calculateDistanceKm = (targetLat: number, targetLng: number): number => {
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
