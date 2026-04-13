/**
 * Validasi koordinat GPS presisi 6 desimal
 */

export function isValidLatitude(lat: number): boolean {
  return typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lng: number): boolean {
  return typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180;
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

/**
 * Format koordinat ke 6 desimal
 */
export function formatCoordinate(value: number): number {
  return parseFloat(value.toFixed(6));
}

/**
 * Hitung jarak antara dua titik koordinat (Haversine formula)
 * @returns jarak dalam meter
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Radius bumi dalam meter
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Cek apakah koordinat user berada dalam radius geofence
 */
export function isWithinGeofence(
  userLat: number,
  userLng: number,
  centerLat: number,
  centerLng: number,
  radiusMeter: number,
): boolean {
  const distance = calculateDistance(userLat, userLng, centerLat, centerLng);
  return distance <= radiusMeter;
}
