import { Injectable, Logger } from '@nestjs/common';

export interface OsrmRoute {
  distance: number;  // meters
  duration: number;  // seconds
  polyline: [number, number][];  // [lat, lng] pairs decoded
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Decode Google Encoded Polyline Algorithm Format to [lat, lng][]
 * OSRM returns geometry as encoded polyline by default
 */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

@Injectable()
export class OsrmService {
  private readonly logger = new Logger(OsrmService.name);
  private readonly baseUrl = 'https://router.project-osrm.org';

  /**
   * Get driving route between two points.
   * IMPORTANT: OSRM uses lng,lat order (not lat,lng)!
   */
  async getRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<OsrmRoute> {
    try {
      // OSRM expects: /driving/lng,lat;lng,lat
      const url = `${this.baseUrl}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'NustechAttendenX/1.0' },
        signal: AbortSignal.timeout(5000),
      });

      if (!resp.ok) throw new Error(`OSRM HTTP ${resp.status}`);

      const data = (await resp.json()) as {
        code: string;
        routes?: Array<{
          distance: number;
          duration: number;
          geometry: string;
        }>;
      };

      if (data.code !== 'Ok' || !data.routes?.length) {
        throw new Error(`OSRM code: ${data.code}`);
      }

      const route = data.routes[0];
      return {
        distance: route.distance,
        duration: route.duration,
        polyline: decodePolyline(route.geometry),
      };
    } catch (err) {
      this.logger.warn(`OSRM failed (${originLat},${originLng})→(${destLat},${destLng}): ${err} — using haversine fallback`);
      const dist = haversine(originLat, originLng, destLat, destLng);
      // Estimate: avg 40 km/h for urban driving
      const duration = (dist / 1000 / 40) * 3600;
      return {
        distance: dist,
        duration,
        polyline: [[originLat, originLng], [destLat, destLng]],
      };
    }
  }

  /**
   * Get straight-line distance only (fast, no network call)
   */
  haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
  ): number {
    return haversine(lat1, lng1, lat2, lng2);
  }
}
