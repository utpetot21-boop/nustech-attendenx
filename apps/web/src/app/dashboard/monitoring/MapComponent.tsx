'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon path di Next.js/webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

type TechnicianStatus = {
  userId:     string;
  name:       string;
  type:       'visit' | 'office' | 'alert' | 'idle' | 'sos';
  lat:        number | null;
  lng:        number | null;
  clientName: string | null;
  lastSeen:   string | null;
};

// Warna per status — merah sebagai warna utama/default
const MARKER_COLORS: Record<string, string> = {
  visit:  '#EA4335', // merah Google Maps
  office: '#34A853', // hijau
  alert:  '#FBBC04', // kuning/orange
  idle:   '#9CA3AF', // abu
  sos:    '#EA4335', // merah darurat
};

// ── Google Maps-style teardrop pin ────────────────────────────────────────────
function makePinIcon(color: string) {
  // Teardrop: lingkaran atas, runcing ke bawah — persis seperti pin Google Maps
  const w = 28, h = 42;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <filter id="shadow" x="-30%" y="-20%" width="160%" height="160%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.35)"/>
        </filter>
      </defs>
      <!-- Badan pin teardrop -->
      <path
        d="M14 1C7.1 1 1.5 6.6 1.5 13.5c0 4.4 2.2 8.3 5.5 10.7L14 41l7-16.8c3.3-2.4 5.5-6.3 5.5-10.7C26.5 6.6 20.9 1 14 1z"
        fill="${color}"
        filter="url(#shadow)"
      />
      <!-- Highlight spekuler kiri atas (efek 3D) -->
      <path
        d="M14 1C7.1 1 1.5 6.6 1.5 13.5c0 2 .5 3.9 1.3 5.6C5.3 8.5 9.2 4.5 14 4.5s8.7 4 11.2 10.6c.8-1.7 1.3-3.6 1.3-5.6C26.5 6.6 20.9 1 14 1z"
        fill="rgba(255,255,255,0.25)"
      />
      <!-- Titik tengah transparan -->
      <circle cx="14" cy="14" r="5.5" fill="white" opacity="0"/>
    </svg>
  `.trim();

  return L.divIcon({
    html:         svg,
    className:    '',
    iconSize:     [w, h],
    iconAnchor:   [w / 2, h],      // titik jangkar di ujung bawah pin
    popupAnchor:  [0, -(h + 4)],
  });
}

// ── SOS pin — teardrop merah dengan pulse ─────────────────────────────────────
function makeSosPinIcon() {
  const color = '#EA4335';
  const w = 56, h = 72;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <!-- Pulse ring animasi -->
      <circle cx="28" cy="20" r="18" fill="${color}" opacity="0.2">
        <animate attributeName="r"       from="18" to="28" dur="1.2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.3" to="0"  dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="28" cy="20" r="14" fill="${color}" opacity="0.15">
        <animate attributeName="r"       from="14" to="22" dur="1.2s" begin="0.3s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.25" to="0" dur="1.2s" begin="0.3s" repeatCount="indefinite"/>
      </circle>
      <!-- Badan teardrop SOS -->
      <path
        d="M28 4C19 4 12 11 12 20c0 5.5 2.8 10.4 7 13.4L28 56l9-22.6c4.2-3 7-7.9 7-13.4C44 11 37 4 28 4z"
        fill="${color}"
      />
      <!-- Highlight -->
      <path
        d="M28 4C19 4 12 11 12 20c0 2.5.6 4.8 1.6 6.9C17 16 22.1 11.2 28 11.2s11 4.8 14.4 15.7c1-.4 1.6-2.1 1.6-6.9C44 11 37 4 28 4z"
        fill="rgba(255,255,255,0.25)"
      />
      <!-- Tanda seru -->
      <text x="28" y="25" text-anchor="middle" fill="white" font-size="13" font-weight="900" font-family="Arial">!</text>
    </svg>
  `.trim();

  return L.divIcon({
    html:        svg,
    className:   '',
    iconSize:    [w, h],
    iconAnchor:  [w / 2, h - 12],
    popupAnchor: [0, -(h - 8)],
  });
}

// ── Office pin — teardrop merah outline putih, titik putih tengah ─────────────
function makeOfficePinIcon() {
  const w = 28, h = 38;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <path
        d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 24 14 24S28 23.333 28 14C28 6.268 21.732 0 14 0z"
        fill="#EA4335" stroke="white" stroke-width="2"
      />
      <circle cx="14" cy="14" r="5" fill="white"/>
    </svg>
  `.trim();

  return L.divIcon({
    html:        svg,
    className:   '',
    iconSize:    [w, h],
    iconAnchor:  [w / 2, h],
    popupAnchor: [0, -(h + 4)],
  });
}

// ── Fly to center saat props berubah ──────────────────────────────────────────
function MapFlyTo({ center, zoom }: { center: [number, number] | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom ?? 14, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

export default function MapComponent({
  technicians,
  center,
  zoom,
  onMarkerClick,
  officeName,
  officeAddress,
}: {
  technicians:   TechnicianStatus[];
  center:        [number, number] | null;
  zoom?:         number;
  onMarkerClick: (t: TechnicianStatus) => void;
  officeName?:   string | null;
  officeAddress?: string | null;
}) {
  const defaultCenter: [number, number] = center ?? [-8.5833, 116.1167];
  const withCoords = technicians.filter((t) => t.lat !== null && t.lng !== null);

  return (
    <MapContainer
      center={defaultCenter}
      zoom={zoom ?? 14}
      style={{ width: '100%', height: '100%' }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {center && <MapFlyTo center={center} zoom={zoom} />}

      {/* Marker kantor */}
      <Marker position={defaultCenter} icon={makeOfficePinIcon()}>
        <Popup>
          <div style={{ fontSize: 12, lineHeight: 1.6, minWidth: 150 }}>
            <strong style={{ color: '#1D4ED8', fontSize: 13 }}>{officeName ?? 'Kantor'}</strong>
            {officeAddress && <div style={{ color: '#6B7280', marginTop: 2 }}>{officeAddress}</div>}
            <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>
              {Number(defaultCenter[0]).toFixed(6)}, {Number(defaultCenter[1]).toFixed(6)}
            </div>
          </div>
        </Popup>
      </Marker>

      {/* Marker teknisi */}
      {withCoords.map((t) => (
        <Marker
          key={t.userId}
          position={[t.lat!, t.lng!]}
          icon={t.type === 'sos' ? makeSosPinIcon() : makePinIcon(MARKER_COLORS[t.type] ?? '#EA4335')}
          eventHandlers={{ click: () => onMarkerClick(t) }}
        >
          <Popup>
            <div style={{ fontSize: 12, lineHeight: 1.6, minWidth: 140 }}>
              <strong style={{ fontSize: 13 }}>{t.name}</strong>
              {t.clientName && <div style={{ color: '#6B7280', marginTop: 2 }}>{t.clientName}</div>}
              <div style={{ color: '#9CA3AF', fontSize: 11, marginTop: 4 }}>
                {t.lat?.toFixed(6)}, {t.lng?.toFixed(6)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
