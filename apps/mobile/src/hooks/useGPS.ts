import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { calculateDistance } from '@nustech/shared';

export interface GPSCoords {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export interface GeofenceResult {
  coords: GPSCoords;
  isWithinRadius: boolean;
  distanceMeters: number;
}

/**
 * Hook untuk mendapatkan koordinat GPS presisi tinggi (6 desimal)
 * dan memvalidasi geofence terhadap lokasi kantor.
 */
export function useGPS() {
  const [isLoading, setIsLoading] = useState(false);
  const [coords, setCoords] = useState<GPSCoords | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getLocation = useCallback(async (): Promise<GPSCoords | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Izin lokasi ditolak. Aktifkan GPS untuk check-in.');
        return null;
      }

      // L5: coba Accuracy.High dulu, fallback ke Balanced jika gagal (GPS lemah / indoor)
      let location;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      const result: GPSCoords = {
        lat: parseFloat(location.coords.latitude.toFixed(6)),
        lng: parseFloat(location.coords.longitude.toFixed(6)),
        accuracy: location.coords.accuracy,
      };

      setCoords(result);
      return result;
    } catch (err) {
      setError('Gagal mendapatkan lokasi GPS. Pastikan GPS aktif.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateGeofence = useCallback(
    async (officeLat: number, officeLng: number, radiusMeter: number): Promise<GeofenceResult | null> => {
      const gps = await getLocation();
      if (!gps) return null;

      const distanceMeters = calculateDistance(
        { lat: gps.lat, lng: gps.lng },
        { lat: officeLat, lng: officeLng },
      );

      return {
        coords: gps,
        isWithinRadius: distanceMeters <= radiusMeter,
        distanceMeters: Math.round(distanceMeters),
      };
    },
    [getLocation],
  );

  return { getLocation, validateGeofence, coords, isLoading, error };
}
