'use client';

/**
 * SosMap — Leaflet map untuk halaman SOS
 * Wajib di-import dengan dynamic({ ssr: false }) karena Leaflet butuh window
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Track { lat: number; lng: number; recorded_at?: string }

interface SosMapProps {
  lat: number;
  lng: number;
  tracks?: Track[];
  isActive?: boolean;
}

// Fix default icon Leaflet (webpack/Next.js issue)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export default function SosMap({ lat, lng, tracks = [], isActive = true }: SosMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markerRef    = useRef<L.Marker | null>(null);
  const circleRef    = useRef<L.Circle | null>(null);
  const polylineRef  = useRef<L.Polyline | null>(null);

  // Init map sekali
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 15,
      zoomControl: true,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Custom icon merah untuk SOS aktif
    const sosIcon = L.divIcon({
      html: `<div style="
        width:32px;height:32px;border-radius:50%;
        background:${isActive ? '#FF3B30' : '#007AFF'};
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        font-size:14px;
      ">🚨</div>`,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const marker = L.marker([lat, lng], { icon: sosIcon })
      .addTo(map)
      .bindPopup(`<b>${isActive ? '🚨 SOS Aktif' : '📍 Lokasi SOS'}</b><br>${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    const circle = L.circle([lat, lng], {
      radius: 50,
      color: isActive ? '#FF3B30' : '#007AFF',
      fillColor: isActive ? '#FF3B30' : '#007AFF',
      fillOpacity: 0.15,
      weight: 2,
    }).addTo(map);

    // Polyline jejak pergerakan
    if (tracks.length > 1) {
      const latlngs = tracks.map((t) => [t.lat, t.lng] as [number, number]);
      const polyline = L.polyline(latlngs, {
        color: isActive ? '#FF3B30' : '#007AFF',
        weight: 3,
        opacity: 0.7,
        dashArray: '6, 4',
      }).addTo(map);
      polylineRef.current = polyline;
    }

    mapRef.current   = map;
    markerRef.current = marker;
    circleRef.current = circle;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update posisi marker saat lat/lng berubah
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return;
    const pos: L.LatLngExpression = [lat, lng];
    markerRef.current.setLatLng(pos);
    circleRef.current.setLatLng(pos);
    mapRef.current.panTo(pos, { animate: true, duration: 0.5 });

    // Update polyline
    if (tracks.length > 1) {
      const latlngs = tracks.map((t) => [t.lat, t.lng] as [number, number]);
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(latlngs);
      } else {
        polylineRef.current = L.polyline(latlngs, {
          color: isActive ? '#FF3B30' : '#007AFF',
          weight: 3, opacity: 0.7, dashArray: '6, 4',
        }).addTo(mapRef.current);
      }
    }
  }, [lat, lng, tracks, isActive]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '240px', borderRadius: '12px', overflow: 'hidden' }}
    />
  );
}
