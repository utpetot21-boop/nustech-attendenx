'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function sosPulseIcon() {
  const size = 52;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="26" cy="26" r="20" fill="#EF4444" opacity="0.18">
      <animate attributeName="r" from="16" to="26" dur="1.1s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.3" to="0" dur="1.1s" repeatCount="indefinite"/>
    </circle>
    <circle cx="26" cy="26" r="14" fill="#EF4444" opacity="0.25">
      <animate attributeName="r" from="12" to="18" dur="1.1s" begin="0.3s" repeatCount="indefinite"/>
      <animate attributeName="opacity" from="0.4" to="0" dur="1.1s" begin="0.3s" repeatCount="indefinite"/>
    </circle>
    <circle cx="26" cy="26" r="11" fill="#EF4444"/>
    <text x="26" y="31" text-anchor="middle" fill="white" font-size="13" font-weight="bold">!</text>
  </svg>`;
  return L.divIcon({ html: svg, iconSize: [size, size], iconAnchor: [size / 2, size / 2], className: '' });
}

export type SosTrack = { lat: number; lng: number; recorded_at: string };

export type SosMapProps = {
  alertId: string;
  lat: number;
  lng: number;
  userName: string;
  tracks: SosTrack[];
  activatedAt: string;
};

function FlyToSos({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = useRef('');
  useEffect(() => {
    const key = `${lat},${lng}`;
    if (key !== prev.current) {
      prev.current = key;
      map.flyTo([lat, lng], 15, { animate: true, duration: 1 });
    }
  }, [map, lat, lng]);
  return null;
}

export default function SOSMap({ lat, lng, userName, tracks, activatedAt }: SosMapProps) {
  const trackCoords = tracks.map((t) => ({ lat: t.lat, lng: t.lng }));
  const allCoords = trackCoords.length > 0 ? trackCoords : [{ lat, lng }];

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
      zoomControl
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <FlyToSos lat={lat} lng={lng} />

      {/* SOS pulse marker at current location */}
      <Marker position={[lat, lng]} icon={sosPulseIcon()}>
        <Popup>
          <div style={{ fontSize: 12 }}>
            <strong style={{ color: '#EF4444' }}>🚨 SOS — {userName}</strong>
            <div style={{ color: '#6B7280', marginTop: 4 }}>
              {new Date(activatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} WITA
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </div>
          </div>
        </Popup>
      </Marker>

      {/* Tracking history polyline */}
      {allCoords.length > 1 && (
        <Polyline
          positions={allCoords.map((c) => [c.lat, c.lng])}
          color="#EF4444"
          weight={3}
          opacity={0.7}
          dashArray="6, 4"
        />
      )}

      {/* Track history dots */}
      {tracks.map((t, i) => (
        <Circle
          key={i}
          center={[t.lat, t.lng]}
          radius={6}
          pathOptions={{ color: '#EF4444', fillColor: '#FCA5A5', fillOpacity: 0.8, weight: 1 }}
        />
      ))}

      {/* Origin marker (first track or initial position) */}
      {tracks.length > 0 && (
        <Marker position={[tracks[0].lat, tracks[0].lng]}>
          <Popup>
            <div style={{ fontSize: 11 }}>
              <strong>Titik awal SOS</strong>
              <div style={{ color: '#9CA3AF' }}>
                {new Date(tracks[0].recorded_at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar' })} WITA
              </div>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
