'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import { MapPin } from 'lucide-react';

// Leaflet must be loaded client-side only
const MapComponent = dynamic(() => import('./MapComponent'), { ssr: false, loading: () => <MapSkeleton /> });

// ── Types ─────────────────────────────────────────────────────────────────────
type TechnicianStatus = {
  userId: string;
  name: string;
  department: string | null;
  avatar: string | null;
  type: 'visit' | 'office' | 'alert' | 'idle' | 'sos';
  lat: number | null;
  lng: number | null;
  visitId: string | null;
  clientName: string | null;
  lastSeen: string | null;
  sosAlertId: string | null;
};

type SosAlert = {
  id: string;
  user_id: string;
  last_lat: number;
  last_lng: number;
  battery_pct: number;
  activated_at: string;
  status: string;
  user: { full_name: string };
};

const TYPE_CONFIG: Record<string, { label: string; color: string; dotColor: string; markerColor: string }> = {
  visit:  { label: 'Kunjungan Aktif', color: 'text-blue-700',   dotColor: 'bg-blue-500',   markerColor: '#3B82F6' },
  office: { label: 'Di Kantor',       color: 'text-green-700',  dotColor: 'bg-green-500',  markerColor: '#22C55E' },
  alert:  { label: 'GPS Alert',       color: 'text-orange-600', dotColor: 'bg-orange-400', markerColor: '#F97316' },
  idle:   { label: 'Menganggur',      color: 'text-gray-500',   dotColor: 'bg-gray-400',   markerColor: '#9CA3AF' },
  sos:    { label: 'SOS',             color: 'text-red-600',    dotColor: 'bg-red-500 animate-ping', markerColor: '#EF4444' },
};

type FilterType = 'all' | 'visit' | 'office' | 'alert' | 'idle' | 'sos';

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MonitoringPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<TechnicianStatus | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number | undefined>(undefined);

  // Fetch office coordinates for default map center
  const { data: attendanceConfig } = useQuery<{ office_lat: number | null; office_lng: number | null }>({
    queryKey: ['settings-attendance'],
    queryFn: () => apiClient.get('/settings/attendance').then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });

  const { data: companyProfile } = useQuery<{ name: string; address: string }>({
    queryKey: ['settings-profile'],
    queryFn: () => apiClient.get('/settings/profile').then((r) => r.data),
    staleTime: 1000 * 60 * 10,
  });

  // Live location overrides from WebSocket (userId → {lat, lng, timestamp})
  const [liveLocations, setLiveLocations] = useState<
    Record<string, { lat: number; lng: number; task_id: string | null; timestamp: string }>
  >({});

  // Fetch active visits for location data
  const { data: visits = [] } = useQuery({
    queryKey: ['monitoring-visits'],
    queryFn: () => apiClient.get('/visits', { params: { status: 'ongoing', limit: 100 } }).then((r) => r.data.items ?? []),
    refetchInterval: 30000, // WebSocket handles real-time, polling as fallback
  });

  // Fetch SOS alerts
  const { data: sosAlerts = [] } = useQuery<SosAlert[]>({
    queryKey: ['sos-active'],
    queryFn: () => apiClient.get('/sos/active').then((r) => r.data),
    refetchInterval: 10000,
  });

  // WebSocket — subscribe to technician:location events
  useEffect(() => {
    // Token dari memory (in-memory auth) — tidak dari localStorage/cookie
    const token = getToken() ?? '';

    if (!token) return;

    const socket = connectSocket(token);

    const onLocation = (payload: {
      user_id: string;
      lat: number;
      lng: number;
      task_id?: string;
      timestamp?: string;
    }) => {
      setLiveLocations((prev) => ({
        ...prev,
        [payload.user_id]: {
          lat: payload.lat,
          lng: payload.lng,
          task_id: payload.task_id ?? null,
          timestamp: payload.timestamp ?? new Date().toISOString(),
        },
      }));
    };

    socket.on('technician:location', onLocation);

    return () => {
      socket.off('technician:location', onLocation);
      disconnectSocket();
    };
  }, []);

  // Build technician statuses from active visits + SOS + live WebSocket overrides
  const technicians: TechnicianStatus[] = [
    ...visits.map((v: any) => {
      const live = liveLocations[v.user?.id ?? v.user_id];
      return {
        userId: v.user?.id ?? v.user_id,
        name: v.user?.full_name ?? '—',
        department: v.user?.department?.name ?? null,
        avatar: null,
        type: 'visit' as const,
        lat: live ? live.lat : (v.check_in_lat ? Number(v.check_in_lat) : null),
        lng: live ? live.lng : (v.check_in_lng ? Number(v.check_in_lng) : null),
        visitId: v.id,
        clientName: v.client?.name ?? null,
        lastSeen: live ? live.timestamp : v.check_in_at,
        sosAlertId: null,
      };
    }),
    ...sosAlerts.map((s) => {
      const live = liveLocations[s.user_id];
      return {
        userId: s.user_id,
        name: s.user?.full_name ?? '—',
        department: null,
        avatar: null,
        type: 'sos' as const,
        lat: live ? live.lat : (s.last_lat != null ? Number(s.last_lat) : null),
        lng: live ? live.lng : (s.last_lng != null ? Number(s.last_lng) : null),
        visitId: null,
        clientName: null,
        lastSeen: live ? live.timestamp : s.activated_at,
        sosAlertId: s.id,
      };
    }),
  ];

  const filtered = technicians.filter((t) => {
    const matchFilter = filter === 'all' || t.type === filter;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.clientName?.toLowerCase().includes(search.toLowerCase()) ?? false);
    return matchFilter && matchSearch;
  });

  const stats = {
    visit: technicians.filter((t) => t.type === 'visit').length,
    office: technicians.filter((t) => t.type === 'office').length,
    alert: technicians.filter((t) => t.type === 'alert').length,
    idle: technicians.filter((t) => t.type === 'idle').length,
    sos: sosAlerts.filter((s) => s.status === 'active').length,
  };

  const handleCardClick = useCallback((t: TechnicianStatus) => {
    setSelected(t);
    if (t.lat && t.lng) {
      setMapCenter([t.lat, t.lng]);
      setMapZoom(16);
    }
  }, []);

  // Auto-zoom to SOS if any
  useEffect(() => {
    const activeSos = sosAlerts.find((s) => s.status === 'active');
    if (activeSos?.last_lat && activeSos?.last_lng) {
      setMapCenter([activeSos.last_lat, activeSos.last_lng]);
      setMapZoom(15);
    }
  }, [sosAlerts]);

  const FILTER_PILLS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Semua' },
    { key: 'visit', label: 'Kunjungan' },
    { key: 'office', label: 'Kantor' },
    { key: 'alert', label: 'Alert' },
    { key: 'idle', label: 'Idle' },
  ];

  return (
    // absolute inset-0 → mengisi <main relative> secara presisi tanpa bergantung pada h-full
    // yang bermasalah di dalam overflow-y-auto parent. overflow-hidden mencegah Leaflet bleed out.
    <div className="absolute inset-0 flex flex-col lg:flex-row overflow-hidden">
      {/* Map area — h-[360px] di mobile (cukup ruang untuk filter+stats tanpa overlap),
          flex-1 di desktop */}
      <div className="relative h-[360px] lg:h-auto lg:flex-1">
        {/* Filter pills over map — dark mode variant ditambah */}
        <div className="absolute top-4 left-4 right-28 lg:right-44 z-[400] flex gap-2 overflow-x-auto scrollbar-hide">
          {FILTER_PILLS.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setFilter(pill.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold shadow transition backdrop-blur-sm ${
                filter === pill.key
                  ? 'bg-blue-600 text-white shadow-blue-200'
                  : 'bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700/90'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Legend top-right — dark mode variant ditambah */}
        <div className="absolute top-4 right-4 z-[400] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow px-4 py-3 space-y-1.5">
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dotColor.split(' ')[0]}`} />
              <span className={`${cfg.color} dark:brightness-125`}>{cfg.label}</span>
            </div>
          ))}
        </div>

        {/* Stats bottom — dark mode variant ditambah */}
        <div className="absolute bottom-4 left-4 z-[400] bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow px-4 py-2 flex gap-3 text-sm flex-wrap">
          {[
            { label: 'Kunjungan', value: stats.visit, color: 'text-blue-600 dark:text-blue-400' },
            { label: 'Kantor',    value: stats.office, color: 'text-green-600 dark:text-green-400' },
            { label: 'Alert',     value: stats.alert,  color: 'text-orange-500 dark:text-orange-400' },
            { label: 'Idle',      value: stats.idle,   color: 'text-gray-500 dark:text-gray-400' },
            ...(stats.sos > 0 ? [{ label: '🚨 SOS', value: stats.sos, color: 'text-red-600 dark:text-red-400 font-bold animate-pulse' }] : []),
          ].map((s, i, arr) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className={`font-bold text-sm ${s.color}`}>{s.value}</span>
              <span className="text-gray-400 dark:text-gray-500 text-xs">{s.label}</span>
              {i < arr.length - 1 && <span className="text-gray-200 dark:text-gray-600 text-xs ml-1">·</span>}
            </div>
          ))}
        </div>

        <MapComponent
          technicians={filtered}
          center={mapCenter ?? (attendanceConfig?.office_lat && attendanceConfig?.office_lng ? [attendanceConfig.office_lat, attendanceConfig.office_lng] : null)}
          zoom={mapZoom ?? (attendanceConfig?.office_lat ? 15 : undefined)}
          onMarkerClick={(t) => setSelected(t)}
          officeName={companyProfile?.name}
          officeAddress={companyProfile?.address}
        />
      </div>

      {/* Right panel — full width on mobile, 280px sidebar on desktop (naik dari 220px) */}
      <aside className="flex-1 lg:flex-none lg:w-[280px] bg-white dark:bg-[#1C1C1E] border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-white/[0.07] flex flex-col z-[300] min-h-0">
        {/* Search */}
        <div className="p-3 border-b border-gray-100 dark:border-white/[0.05]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari teknisi…"
            className="w-full text-xs border border-gray-200 dark:border-white/10 rounded-xl px-2.5 py-2 focus:outline-none focus:border-blue-400 bg-gray-50 dark:bg-white/[0.05] dark:text-white dark:placeholder-white/30"
          />
        </div>

        {/* Active count */}
        <div className="px-3 py-2 border-b border-gray-100 dark:border-white/[0.05]">
          <span className="text-xs font-semibold text-gray-700 dark:text-white/60">{filtered.length} Aktif</span>
        </div>

        {/* Technician cards */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/[0.07] flex items-center justify-center mb-3">
                <MapPin size={24} className="text-gray-300 dark:text-white/20" strokeWidth={1.5} />
              </div>
              <p className="text-[13px] font-semibold text-gray-400 dark:text-white/30 text-center">
                {technicians.length === 0 ? 'Tidak ada teknisi online' : 'Tidak ada hasil'}
              </p>
              <p className="text-[11px] text-gray-300 dark:text-white/20 text-center mt-1">
                {technicians.length === 0 ? 'Data akan muncul saat teknisi aktif' : 'Coba ubah filter pencarian'}
              </p>
            </div>
          ) : (
            filtered.map((t) => {
              const cfg = TYPE_CONFIG[t.type];
              const isSelected = selected?.userId === t.userId;
              return (
                <button
                  key={t.userId}
                  onClick={() => handleCardClick(t)}
                  className={`w-full text-left px-3 py-3 border-b border-gray-50 dark:border-white/[0.04] transition ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-500/10'
                      : 'hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-white/60 flex-shrink-0">
                      {t.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-800 dark:text-white/90 truncate" title={t.name}>{t.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dotColor.split(' ')[0]}`} />
                        <span className={`text-[10px] ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      {t.clientName && (
                        <p className="text-[10px] text-gray-400 dark:text-white/30 truncate mt-0.5" title={t.clientName}>{t.clientName}</p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

function MapSkeleton() {
  return (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
      Memuat peta…
    </div>
  );
}
