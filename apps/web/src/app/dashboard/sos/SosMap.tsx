'use client';

/**
 * SosMap — Leaflet map untuk halaman SOS
 * Wajib di-import dengan dynamic({ ssr: false }) karena Leaflet butuh window
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';

export interface SosMapAlert {
  id: string;
  lat: number;
  lng: number;
  name: string;
  status: string;
  activatedAt: string;
}

interface Track { lat: number; lng: number }

interface SosMapProps {
  /** Mode monitoring: tampilkan semua alert aktif sekaligus */
  alerts?: SosMapAlert[];
  /** Mode detail single alert */
  lat?: number;
  lng?: number;
  tracks?: Track[];
  isActive?: boolean;
  height?: number;
}

// Inject CSS animasi kedip sekali saja
function injectPulseCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sos-pulse-css')) return;
  const style = document.createElement('style');
  style.id = 'sos-pulse-css';
  style.textContent = `
    @keyframes sos-pulse {
      0%   { transform: scale(1);   opacity: 1; }
      50%  { transform: scale(1.6); opacity: 0; }
      100% { transform: scale(1);   opacity: 1; }
    }
    .sos-pulse-ring {
      position: absolute;
      width: 40px; height: 40px;
      border-radius: 50%;
      background: rgba(255,59,48,0.35);
      animation: sos-pulse 1.4s ease-out infinite;
      top: -4px; left: -4px;
      pointer-events: none;
    }
    .sos-pulse-ring-2 {
      animation-delay: 0.7s;
    }
  `;
  document.head.appendChild(style);
}

function makeSosIcon(name: string, isActive = true) {
  const color  = isActive ? '#FF3B30' : '#007AFF';
  const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return L.divIcon({
    html: `
      <div style="position:relative;width:32px;height:32px;">
        ${isActive ? '<div class="sos-pulse-ring"></div><div class="sos-pulse-ring sos-pulse-ring-2"></div>' : ''}
        <div style="
          width:32px;height:32px;border-radius:50%;
          background:${color};border:2.5px solid white;
          box-shadow:0 2px 10px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:800;color:white;
          position:relative;z-index:1;
        ">${initials || '!'}</div>
      </div>`,
    className: '',
    iconSize:   [32, 32],
    iconAnchor: [16, 16],
    popupAnchor:[0, -18],
  });
}

export default function SosMap({
  alerts = [],
  lat,
  lng,
  tracks = [],
  isActive = true,
  height = 280,
}: SosMapProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<L.Map | null>(null);
  const markersRef    = useRef<Map<string, L.Marker>>(new Map());
  const polylineRef   = useRef<L.Polyline | null>(null);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    injectPulseCSS();

    // Tentukan center awal
    const center: L.LatLngExpression =
      alerts.length > 0 ? [alerts[0].lat, alerts[0].lng]
      : lat && lng      ? [lat, lng]
      : [-5.135399, 119.412674]; // default Makassar

    // Di mobile, disable drag & touchZoom agar scroll halaman tidak tertangkap map
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const map = L.map(containerRef.current, {
      center,
      zoom: alerts.length > 1 ? 12 : 15,
      zoomControl: !isMobile,
      scrollWheelZoom: false,
      dragging: !isMobile,
      touchZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current   = null;
      markersRef.current.clear();
      polylineRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Update markers saat alerts berubah (mode monitoring) ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || alerts.length === 0) return;

    const existing = markersRef.current;
    const newIds   = new Set(alerts.map((a) => a.id));

    // Hapus marker yang sudah tidak ada
    existing.forEach((m, id) => {
      if (!newIds.has(id)) { m.remove(); existing.delete(id); }
    });

    // Tambah/update marker
    alerts.forEach((a) => {
      const pos: L.LatLngExpression = [a.lat, a.lng];
      const icon = makeSosIcon(a.name, a.status === 'active');
      const elapsed = Math.floor((Date.now() - new Date(a.activatedAt).getTime()) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      const popup = `
        <div style="font-family:system-ui;min-width:160px;">
          <p style="font-weight:700;font-size:13px;margin:0 0 4px">${a.name}</p>
          <p style="font-size:11px;color:#666;margin:0 0 2px">
            ${a.status === 'active' ? '🚨 Aktif' : '✅ Direspons'}
          </p>
          <p style="font-size:11px;color:#666;margin:0">
            Durasi: ${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}
          </p>
          <p style="font-size:10px;color:#999;margin:4px 0 0">
            ${Number(a.lat).toFixed(6)}, ${Number(a.lng).toFixed(6)}
          </p>
          <a href="https://www.google.com/maps?q=${a.lat},${a.lng}" target="_blank"
            style="font-size:11px;color:#007AFF;display:block;margin-top:6px;">
            Buka di Google Maps →
          </a>
        </div>`;

      if (existing.has(a.id)) {
        existing.get(a.id)!.setLatLng(pos).setIcon(icon).getPopup()?.setContent(popup);
      } else {
        const m = L.marker(pos, { icon }).addTo(map).bindPopup(popup);
        existing.set(a.id, m);
      }
    });

    // Fit bounds kalau ada banyak SOS
    if (alerts.length > 1) {
      const bounds = L.latLngBounds(alerts.map((a) => [a.lat, a.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      map.panTo([alerts[0].lat, alerts[0].lng], { animate: true });
    }
  }, [alerts]);

  // ── Update single-alert mode (detail card) ────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || alerts.length > 0 || !lat || !lng) return;

    const id = 'single';
    const pos: L.LatLngExpression = [lat, lng];
    const icon = makeSosIcon('SOS', isActive);

    if (markersRef.current.has(id)) {
      markersRef.current.get(id)!.setLatLng(pos).setIcon(icon);
    } else {
      const m = L.marker(pos, { icon }).addTo(map)
        .bindPopup(`<b>${isActive ? '🚨 SOS Aktif' : '📍 Lokasi'}</b><br>${lat.toFixed(6)}, ${lng.toFixed(6)}<br>
          <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" style="color:#007AFF;font-size:11px;">Buka di Google Maps →</a>`);
      markersRef.current.set(id, m);
    }
    map.panTo(pos, { animate: true, duration: 0.5 });

    // Polyline jejak
    if (tracks.length > 1) {
      const latlngs = tracks.map((t) => [t.lat, t.lng] as [number, number]);
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(latlngs);
      } else {
        polylineRef.current = L.polyline(latlngs, {
          color: isActive ? '#FF3B30' : '#007AFF',
          weight: 3, opacity: 0.7, dashArray: '6,4',
        }).addTo(map);
      }
    }
  }, [lat, lng, tracks, isActive, alerts.length]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: `${height}px`, borderRadius: '12px', overflow: 'hidden' }}
    />
  );
}
