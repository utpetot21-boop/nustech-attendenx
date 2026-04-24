/**
 * MiniMap — 2 pins (origin + dest) + OSRM polyline
 * height: 120 for task card, 200 for detail view
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { api } from '@/services/api';
import { formatDistance, formatDuration } from '@nustech/shared';

interface Props {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  height?: number;
}

interface RouteInfo {
  distance: number;
  duration: number;
  polyline: [number, number][];
}

export default function MiniMap({ originLat, originLng, destLat, destLng, height = 120 }: Props) {
  const [route, setRoute] = useState<RouteInfo | null>(null);

  // C1: validasi koordinat — cegah NaN/Infinity masuk ke MapView
  const coordsValid = [originLat, originLng, destLat, destLng].every(
    (v) => typeof v === 'number' && isFinite(v) && v !== 0,
  );

  useEffect(() => {
    if (!coordsValid) return;
    api.get('/visits/route', {
      params: { originLat, originLng, destLat, destLng },
    })
      .then((r) => setRoute(r.data))
      .catch(() => {
        // fallback: straight line
        setRoute({ distance: 0, duration: 0, polyline: [[originLat, originLng], [destLat, destLng]] });
      });
  }, [originLat, originLng, destLat, destLng, coordsValid]);

  if (!coordsValid) {
    return (
      <View style={[styles.container, { height, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Lokasi tidak tersedia</Text>
      </View>
    );
  }

  const midLat = (originLat + destLat) / 2;
  const midLng = (originLng + destLng) / 2;
  // Math.max pastikan delta tidak 0 (saat origin = destination) dan tidak NaN
  const latDelta = Math.max(Math.abs(destLat - originLat) * 1.6, 0.01);
  const lngDelta = Math.max(Math.abs(destLng - originLng) * 1.6, 0.01);

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={{ latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {/* Origin pin */}
        <Marker coordinate={{ latitude: originLat, longitude: originLng }} pinColor="#22C55E" />
        {/* Destination pin */}
        <Marker coordinate={{ latitude: destLat, longitude: destLng }} pinColor="#3B82F6" />
        {/* Route polyline */}
        {route && route.polyline.length > 1 && (
          <Polyline
            coordinates={route.polyline.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))}
            strokeColor="#3B82F6"
            strokeWidth={2.5}
          />
        )}
      </MapView>

      {/* Distance/time overlay */}
      {route && (route.distance > 0 || route.duration > 0) && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {formatDistance(route.distance)} · {formatDuration(route.duration)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
  },
  badge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
});
