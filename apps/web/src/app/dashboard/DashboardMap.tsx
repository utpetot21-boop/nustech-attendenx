'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const COLORS: Record<string, string> = {
  visit: '#3B82F6', office: '#22C55E', alert: '#F97316', idle: '#9CA3AF', sos: '#EF4444',
};

function makeIcon(color: string, isSos = false) {
  const size = isSos ? 44 : 32;
  const inner = isSos
    ? `<circle cx="22" cy="22" r="14" fill="${color}" opacity="0.25"><animate attributeName="r" from="14" to="20" dur="1.2s" repeatCount="indefinite"/><animate attributeName="opacity" from="0.35" to="0" dur="1.2s" repeatCount="indefinite"/></circle><circle cx="22" cy="22" r="9" fill="${color}"/><text x="22" y="27" text-anchor="middle" fill="white" font-size="11" font-weight="bold">!</text>`
    : `<circle cx="16" cy="16" r="11" fill="${color}"/><circle cx="16" cy="16" r="5" fill="white" opacity="0.9"/>`;
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${inner}</svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    className: '',
  });
}

export type MapMarker = {
  userId: string;
  name: string;
  type: 'visit' | 'office' | 'alert' | 'idle' | 'sos';
  lat: number;
  lng: number;
  clientName: string | null;
  lastSeen: string | null;
};

function AutoBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();
  const boundsRef = useRef('');

  useEffect(() => {
    const valid = markers.filter((m) => m.lat && m.lng);
    const key = valid.map((m) => `${m.lat},${m.lng}`).join('|');
    if (!valid.length || key === boundsRef.current) return;
    boundsRef.current = key;

    const sos = valid.filter((m) => m.type === 'sos');
    if (sos.length === 1) {
      map.flyTo([sos[0].lat, sos[0].lng], 14, { animate: true, duration: 1 });
    } else if (valid.length === 1) {
      map.flyTo([valid[0].lat, valid[0].lng], 13);
    } else {
      const bounds = L.latLngBounds(valid.map((m) => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }, [map, markers]);

  return null;
}

function makeOfficeIcon() {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="38" viewBox="0 0 28 38">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 24 14 24S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="#EA4335" stroke="white" stroke-width="2"/>
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>`,
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    className: '',
  });
}

export default function DashboardMap({
  markers,
  officeLat,
  officeLng,
  officeName,
  officeAddress,
}: {
  markers: MapMarker[];
  officeLat?: number | null;
  officeLng?: number | null;
  officeName?: string | null;
  officeAddress?: string | null;
}) {
  const center: [number, number] =
    officeLat && officeLng ? [officeLat, officeLng] : [-8.5833, 116.1167];

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom={false}
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <AutoBounds markers={markers} />
      {officeLat && officeLng && (
        <Marker position={[officeLat, officeLng]} icon={makeOfficeIcon()}>
          <Popup>
            <div style={{ fontSize: 12, lineHeight: 1.6, minWidth: 140 }}>
              <strong style={{ color: '#1D4ED8' }}>{officeName ?? 'Kantor'}</strong>
              {officeAddress && <div style={{ color: '#6B7280', marginTop: 2 }}>{officeAddress}</div>}
              <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>
                {Number(officeLat).toFixed(6)}, {Number(officeLng).toFixed(6)}
              </div>
            </div>
          </Popup>
        </Marker>
      )}
      {markers.map((m) => (
        <Marker key={m.userId} position={[m.lat, m.lng]} icon={makeIcon(COLORS[m.type] ?? '#9CA3AF', m.type === 'sos')}>
          <Popup>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>
              <strong>{m.name}</strong>
              {m.clientName && <div style={{ color: '#6B7280' }}>{m.clientName}</div>}
              <div style={{ color: m.type === 'sos' ? '#EF4444' : '#3B82F6', fontWeight: 600, textTransform: 'capitalize' }}>{m.type}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
