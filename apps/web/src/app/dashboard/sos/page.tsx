'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { getRealtimeSocket } from '@/lib/socket';
import {
  Siren, MapPin, Phone, Battery, Clock, CheckCircle2,
  XCircle, PhoneCall, UserCheck, History, BookUser,
  Plus, X, Trash2, ShieldCheck, AlertOctagon, Radio, ExternalLink,
} from 'lucide-react';

// Leaflet butuh window — wajib dynamic import tanpa SSR
const SosMap = dynamic(() => import('./SosMap'), { ssr: false, loading: () => (
  <div className="w-full h-[240px] rounded-xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
    <p className="text-xs text-gray-400 dark:text-white/30">Memuat peta…</p>
  </div>
) });

// ── Types ─────────────────────────────────────────────────────────────────────
type SosAlert = {
  id: string; user_id: string; activated_at: string; resolved_at: string | null;
  last_lat: number | null; last_lng: number | null; last_address: string | null;
  battery_pct: number | null;
  status: 'active' | 'responded' | 'resolved' | 'cancelled';
  responded_at: string | null; notes: string | null;
  user: { full_name: string; phone?: string };
  responder?: { full_name: string };
};

type EmergencyContact = {
  id: string; name: string; role: string | null;
  phone: string; priority: number; is_active: boolean;
};

type Tab = 'active' | 'history' | 'contacts';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDt(s: string) {
  return new Date(s).toLocaleString('id-ID', {
    timeZone: 'Asia/Makassar', day: '2-digit', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  }) + ' WITA';
}

function elapsedSince(s: string) {
  const diff = Math.floor((Date.now() - new Date(s).getTime()) / 1000);
  const h   = Math.floor(diff / 3600);
  const m   = Math.floor((diff % 3600) / 60);
  const sec = diff % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function durationMin(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000);
}

// ── SosStatusBadge ─────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; Icon: typeof Siren; bg: string; text: string; ring: string }> = {
  active:    { label: 'Aktif',       Icon: Siren,         bg: 'bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)]',    text: 'text-[#FF3B30]', ring: 'border-[#FECACA]' },
  responded: { label: 'Direspons',   Icon: PhoneCall,     bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]',    text: 'text-[#007AFF]', ring: 'border-[#BFDBFE]' },
  resolved:  { label: 'Selesai',     Icon: CheckCircle2,  bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]',    text: 'text-[#34C759]', ring: 'border-[#BBF7D0]' },
  cancelled: { label: 'Dibatalkan',  Icon: XCircle,       bg: 'bg-gray-100 dark:bg-white/[0.06]',                text: 'text-gray-400',  ring: 'border-gray-200'  },
};

function SosStatusBadge({ status }: { status: string }) {
  const s    = STATUS_MAP[status] ?? STATUS_MAP.cancelled;
  const Icon = s.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${s.bg} ${s.text} ${s.ring}`}>
      <Icon size={10} strokeWidth={2} />
      {s.label}
    </span>
  );
}

// ── SosCard ────────────────────────────────────────────────────────────────────
function SosCard({
  alert: a, onRespond, onResolve, resolveNote, setResolveNote,
  respondPending, resolvePending,
}: {
  alert: SosAlert;
  onRespond: () => void; onResolve: (notes?: string) => void;
  resolveNote: string; setResolveNote: (v: string) => void;
  respondPending: boolean; resolvePending: boolean;
}) {
  const isActive = a.status === 'active';

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${
      isActive
        ? 'border-[#FF3B30] bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.08)]'
        : 'border-[#BFDBFE] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.08)] dark:border-[rgba(0,122,255,0.30)]'
    }`}>
      {/* Card header */}
      <div className={`px-5 py-4 flex items-center justify-between gap-3 border-b ${
        isActive ? 'border-[#FECACA] dark:border-[rgba(255,59,48,0.20)]' : 'border-[#BFDBFE] dark:border-[rgba(0,122,255,0.20)]'
      }`}>
        <div className="flex items-center gap-3">
          {/* Animated alert icon */}
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
            isActive ? 'bg-[#FF3B30] animate-pulse' : 'bg-[#007AFF]'
          }`}>
            <Siren size={18} className="text-white" strokeWidth={2} />
          </div>
          <div>
            <p className={`font-bold text-base ${isActive ? 'text-[#FF3B30]' : 'text-[#007AFF]'}`}>
              {a.user?.full_name ?? '—'}
            </p>
            <p className="text-xs text-gray-500 dark:text-white/40">{fmtDt(a.activated_at)}</p>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`font-mono text-xl font-bold tabular-nums ${isActive ? 'text-[#FF3B30]' : 'text-[#007AFF]'}`}>
            {elapsedSince(a.activated_at)}
          </div>
          <div className="mt-1">
            <SosStatusBadge status={a.status} />
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Location */}
        <div className="bg-white/70 dark:bg-white/[0.06] rounded-xl border border-white/80 dark:border-white/[0.10] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin size={12} className="text-[#FF3B30]" />
            <p className="text-[10px] font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider">Lokasi GPS</p>
          </div>
          {a.last_lat ? (
            <div className="space-y-1">
              <p className="font-mono text-xs font-semibold text-gray-800 dark:text-white">{Number(a.last_lat).toFixed(6)}, {Number(a.last_lng).toFixed(6)}</p>
              {a.last_address && <p className="text-[11px] text-gray-500 dark:text-white/40 line-clamp-1">{a.last_address}</p>}
              <a
                href={`https://www.google.com/maps?q=${a.last_lat},${a.last_lng}`}
                target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#007AFF] hover:underline font-medium"
              >
                <ExternalLink size={10} /> Buka di Google Maps
              </a>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-white/25 italic">Belum ada lokasi</p>
          )}
        </div>

        {/* Device info */}
        <div className="bg-white/70 dark:bg-white/[0.06] rounded-xl border border-white/80 dark:border-white/[0.10] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Radio size={12} className="text-gray-400 dark:text-white/30" />
            <p className="text-[10px] font-bold text-gray-500 dark:text-white/50 uppercase tracking-wider">Info Perangkat</p>
          </div>
          <div className="space-y-1">
            {a.battery_pct !== null && (
              <div className="flex items-center gap-1.5">
                <Battery size={11} className={a.battery_pct < 20 ? 'text-[#FF3B30]' : 'text-[#34C759]'} />
                <p className={`text-xs font-medium ${a.battery_pct < 20 ? 'text-[#FF3B30]' : 'text-gray-700 dark:text-white/70'}`}>
                  Baterai {a.battery_pct}%
                </p>
              </div>
            )}
            {a.user?.phone && (
              <div className="flex items-center gap-1.5">
                <Phone size={11} className="text-gray-400 dark:text-white/30" />
                <p className="text-xs text-gray-600 dark:text-white/60 font-mono">{a.user.phone}</p>
              </div>
            )}
            {a.responder && (
              <div className="flex items-center gap-1.5">
                <UserCheck size={11} className="text-[#007AFF]" />
                <p className="text-xs text-[#007AFF]">Direspons oleh {a.responder.full_name}</p>
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Actions */}
      <div className="px-5 pb-4 space-y-2">
        {a.status === 'active' && (
          <button
            onClick={onRespond}
            disabled={respondPending}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#007AFF] hover:bg-[#0066CC] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.30)]"
          >
            {respondPending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <PhoneCall size={16} />
            }
            {respondPending ? 'Memproses…' : 'Tandai Direspons'}
          </button>
        )}
        <div className="flex gap-2">
          <input
            value={resolveNote}
            onChange={(e) => setResolveNote(e.target.value)}
            placeholder="Catatan penyelesaian (opsional)..."
            className="flex-1 bg-white/80 dark:bg-white/[0.08] border border-white/90 dark:border-white/[0.12] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#34C759] focus:ring-2 focus:ring-[#34C759]/20 transition"
          />
          <button
            onClick={() => onResolve(resolveNote || undefined)}
            disabled={resolvePending}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#34C759] hover:bg-[#28A745] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(52,199,89,0.30)]"
          >
            {resolvePending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCircle2 size={16} />
            }
            {resolvePending ? 'Memproses…' : 'Selesai'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function SosPage() {
  const qc = useQueryClient();
  const [tab,              setTab]          = useState<Tab>('active');
  const [resolveNote,      setResolveNote]  = useState('');
  const [addContact,       setAddContact]   = useState(false);
  const [newContact,       setNewContact]   = useState({ name: '', role: '', phone: '', priority: '1' });
  const [deleteContactId,  setDeleteContactId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: active = [], refetch: refetchActive } = useQuery<SosAlert[]>({
    queryKey: ['sos-active'],
    queryFn: () => apiClient.get('/sos/active').then((r) => r.data),
    refetchInterval: 10_000,
  });

  const { data: history = [] } = useQuery<SosAlert[]>({
    queryKey: ['sos-history'],
    queryFn: () => apiClient.get('/sos/history?limit=50').then((r) => r.data),
    enabled: tab === 'history',
  });

  const { data: contacts = [], refetch: refetchContacts } = useQuery<EmergencyContact[]>({
    queryKey: ['emergency-contacts'],
    queryFn: () => apiClient.get('/sos/contacts').then((r) => r.data),
    enabled: tab === 'contacts',
  });

  const respondMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/sos/${id}/respond`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sos-active'] });
      toast.success('SOS ditandai sebagai direspons');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal merespons SOS')),
  });

  const resolveMut = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => apiClient.post(`/sos/${id}/resolve`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sos-active'] });
      qc.invalidateQueries({ queryKey: ['sos-history'] });
      setResolveNote('');
      toast.success('SOS berhasil diselesaikan');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyelesaikan SOS')),
  });

  const addContactMut = useMutation({
    mutationFn: () => apiClient.post('/sos/contacts', {
      name: newContact.name, role: newContact.role || undefined,
      phone: newContact.phone, priority: parseInt(newContact.priority),
    }),
    onSuccess: () => {
      refetchContacts();
      setAddContact(false);
      setNewContact({ name: '', role: '', phone: '', priority: '1' });
      toast.success('Kontak darurat berhasil ditambahkan');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menambahkan kontak')),
  });

  const removeContactMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/sos/contacts/${id}`),
    onSuccess: () => {
      refetchContacts();
      toast.success('Kontak dihapus');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menghapus kontak')),
  });

  const handleRemoveContact = (id: string) => {
    if (deleteContactId === id) {
      removeContactMut.mutate(id);
      setDeleteContactId(null);
    } else {
      setDeleteContactId(id);
    }
  };

  // Real-time — listen via /realtime namespace (web dashboard socket)
  useEffect(() => {
    const socket = getRealtimeSocket();
    const onAdminAlert = (data: { type?: string; alertId?: string }) => {
      if (data?.type === 'sos:activated') {
        refetchActive();
      } else if (data?.type === 'sos:location_update') {
        qc.invalidateQueries({ queryKey: ['sos-active'] });
        if (data.alertId) qc.invalidateQueries({ queryKey: ['sos-tracks', data.alertId] });
      }
    };
    socket.on('admin:alert', onAdminAlert);
    return () => { socket.off('admin:alert', onAdminAlert); };
  }, []);

  const TABS: { key: Tab; label: string; Icon: typeof Siren; badge?: number }[] = [
    { key: 'active',   label: 'SOS Aktif',      Icon: Siren,      badge: active.length > 0 ? active.length : undefined },
    { key: 'history',  label: 'Riwayat',         Icon: History },
    { key: 'contacts', label: 'Kontak Darurat',  Icon: BookUser },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">SOS & Darurat</h1>
            <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">Monitoring kejadian darurat real-time</p>
          </div>
          {tab === 'contacts' && (
            <button
              onClick={() => setAddContact(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0066CC] active:scale-[0.97] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.30)]"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Tambah Kontak</span>
              <span className="sm:hidden">Tambah</span>
            </button>
          )}
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          {[
            { label: 'SOS Aktif',    value: active.length,                                       Icon: Siren,       bg: active.length > 0 ? 'bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)]' : 'bg-gray-100 dark:bg-white/[0.06]', color: active.length > 0 ? 'text-[#FF3B30]' : 'text-gray-400 dark:text-white/30' },
            { label: 'Direspons',    value: history.filter((h) => h.status === 'responded').length, Icon: PhoneCall,  bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]',    color: 'text-[#007AFF]' },
            { label: 'Kontak',       value: contacts.length,                                      Icon: BookUser,    bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]',     color: 'text-[#34C759]' },
          ].map(({ label, value, Icon, bg, color }) => (
            <div key={label} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4">
              <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center mb-3 ${bg}`}>
                <Icon size={18} strokeWidth={1.8} className={color} />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
              <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Active SOS alert banner ────────────────────────────────────────── */}
        {active.length > 0 && tab !== 'active' && (
          <button
            onClick={() => setTab('active')}
            className="w-full flex items-center gap-3 bg-[#FF3B30] text-white rounded-2xl px-4 py-3 mb-4 animate-pulse hover:bg-[#E53E3E] transition"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Siren size={16} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-sm">{active.length} SOS AKTIF</p>
              <p className="text-white/80 text-xs">{active.map((a) => a.user?.full_name).join(', ')} membutuhkan bantuan</p>
            </div>
            <AlertOctagon size={18} className="opacity-80 flex-shrink-0" />
          </button>
        )}

        {/* ── Tabs ──────────────────────────────────────────────────────────── */}
        <div className="flex gap-2">
          {TABS.map(({ key, label, Icon, badge }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === key
                  ? key === 'active' && active.length > 0
                    ? 'bg-[#FF3B30] text-white shadow-[0_2px_8px_rgba(255,59,48,0.30)]'
                    : 'bg-[#007AFF] text-white shadow-[0_2px_8px_rgba(0,122,255,0.30)]'
                  : 'bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.10]'
              }`}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
              {badge !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === key ? 'bg-white/25' : 'bg-[#FF3B30] text-white'}`}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pb-8">

        {/* Tab: Active SOS */}
        {tab === 'active' && (
          <div className="space-y-4">
            {active.length === 0 ? (
              <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)] flex items-center justify-center mb-4">
                  <ShieldCheck size={28} className="text-[#34C759]" />
                </div>
                <p className="text-sm font-semibold text-gray-700 dark:text-white/70">Semua Aman</p>
                <p className="text-xs text-gray-400 dark:text-white/30 mt-1">Tidak ada SOS aktif saat ini</p>
              </div>
            ) : (
              <>
                {/* ── Monitoring Map ─────────────────────────────────────────── */}
                <div className={`rounded-2xl overflow-hidden border-2 ${
                  active.length > 0
                    ? 'border-[#FF3B30] shadow-[0_0_0_4px_rgba(255,59,48,0.15)]'
                    : 'border-transparent'
                }`}>
                  {/* Header strip */}
                  <div className="bg-[#FF3B30] px-4 py-2.5 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                      <Siren size={11} className="text-white" />
                    </div>
                    <p className="text-white text-xs font-bold uppercase tracking-wider">
                      Peta Monitoring — {active.length} SOS Aktif
                    </p>
                    <div className="ml-auto flex items-center gap-1.5">
                      {active.map((a) => (
                        <span key={a.id} className="text-[10px] font-semibold text-white/90 bg-white/20 px-2 py-0.5 rounded-full">
                          {a.user?.full_name?.split(' ')[0] ?? '?'}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Map */}
                  <SosMap
                    alerts={active
                      .filter((a) => a.last_lat && a.last_lng)
                      .map((a) => ({
                        id: a.id,
                        lat: Number(a.last_lat),
                        lng: Number(a.last_lng),
                        name: a.user?.full_name ?? 'SOS',
                        status: a.status,
                        activatedAt: a.activated_at,
                      }))}
                    height={380}
                  />
                </div>

                {/* ── Individual SOS Cards ──────────────────────────────────── */}
                {active.map((a) => (
                  <SosCard
                    key={a.id}
                    alert={a}
                    onRespond={() => respondMut.mutate(a.id)}
                    onResolve={(notes) => resolveMut.mutate({ id: a.id, notes })}
                    resolveNote={resolveNote}
                    setResolveNote={setResolveNote}
                    respondPending={respondMut.isPending}
                    resolvePending={resolveMut.isPending}
                  />
                ))}
              </>
            )}
          </div>
        )}

        {/* Tab: History */}
        {tab === 'history' && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mb-3">
                    <History size={22} className="text-gray-300 dark:text-white/20" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-white/40">Belum ada riwayat SOS</p>
                </div>
              ) : (
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.07] bg-gray-50/50 dark:bg-white/[0.02]">
                      {['Karyawan', 'Waktu Aktif', 'Durasi', 'Lokasi', 'Status', 'Direspons oleh'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((a) => (
                      <tr key={a.id} className="border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                              <span className="text-xs font-bold text-gray-500 dark:text-white/50">{a.user?.full_name?.charAt(0) ?? '?'}</span>
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white text-sm">{a.user?.full_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/40">{fmtDt(a.activated_at)}</td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/50">
                          {a.resolved_at
                            ? <span className="font-medium">{durationMin(a.activated_at, a.resolved_at)} menit</span>
                            : <span className="text-gray-300 dark:text-white/20">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-white/40">
                          {a.last_lat ? `${Number(a.last_lat).toFixed(4)}, ${Number(a.last_lng).toFixed(4)}` : '—'}
                        </td>
                        <td className="px-4 py-3"><SosStatusBadge status={a.status} /></td>
                        <td className="px-4 py-3 text-xs text-gray-500 dark:text-white/40">{a.responder?.full_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {history.length === 0 ? (
                <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] flex flex-col items-center py-16">
                  <History size={28} className="text-gray-300 dark:text-white/20 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-white/40">Belum ada riwayat SOS</p>
                </div>
              ) : (
                history.map((a) => (
                  <div key={a.id} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                          <span className="text-xs font-bold text-gray-500 dark:text-white/50">{a.user?.full_name?.charAt(0) ?? '?'}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">{a.user?.full_name ?? '—'}</p>
                          <p className="text-[11px] text-gray-400 dark:text-white/30">{fmtDt(a.activated_at)}</p>
                        </div>
                      </div>
                      <SosStatusBadge status={a.status} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.last_lat && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-white/40 bg-gray-50 dark:bg-white/[0.05] px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/[0.08]">
                          <MapPin size={9} />{Number(a.last_lat).toFixed(4)}, {Number(a.last_lng).toFixed(4)}
                        </span>
                      )}
                      {a.resolved_at && (
                        <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-white/40 bg-gray-50 dark:bg-white/[0.05] px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/[0.08]">
                          <Clock size={9} />{durationMin(a.activated_at, a.resolved_at)} menit
                        </span>
                      )}
                      {a.responder && (
                        <span className="flex items-center gap-1 text-[11px] text-[#007AFF] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.12)] px-2 py-0.5 rounded-full border border-[#BFDBFE]">
                          <UserCheck size={9} />{a.responder.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* Tab: Emergency Contacts */}
        {tab === 'contacts' && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.07] bg-gray-50/50 dark:bg-white/[0.02]">
                    {['#', 'Nama', 'Jabatan', 'No HP', 'Status', 'Aksi'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contacts.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400 dark:text-white/25">Belum ada kontak darurat</td></tr>
                  ) : (
                    contacts.map((c) => (
                      <tr key={c.id} className="border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3">
                          <span className="w-7 h-7 rounded-full bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)] text-[#FF3B30] font-bold text-xs flex items-center justify-center border border-[#FECACA]">
                            {c.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">{c.name}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-white/40 text-xs">{c.role ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-sm text-gray-700 dark:text-white/70">{c.phone}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                            c.is_active
                              ? 'bg-[#F0FDF4] text-[#34C759] border-[#BBF7D0] dark:bg-[rgba(52,199,89,0.12)]'
                              : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/[0.05] dark:border-white/[0.08]'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-[#34C759]' : 'bg-gray-400'}`} />
                            {c.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {deleteContactId === c.id ? (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleRemoveContact(c.id)}
                                disabled={removeContactMut.isPending}
                                className="px-2.5 py-1.5 bg-[#FF3B30] hover:bg-[#D70015] text-white rounded-xl text-xs font-semibold transition"
                              >
                                Yakin?
                              </button>
                              <button
                                onClick={() => setDeleteContactId(null)}
                                className="px-2.5 py-1.5 bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-white/60 rounded-xl text-xs font-medium transition"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleRemoveContact(c.id)}
                              disabled={removeContactMut.isPending}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] dark:bg-[rgba(255,59,48,0.10)] dark:hover:bg-[rgba(255,59,48,0.18)] text-[#FF3B30] rounded-xl text-xs font-medium transition border border-[#FECACA] dark:border-[rgba(255,59,48,0.25)]"
                            >
                              <Trash2 size={12} />
                              Hapus
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {contacts.length === 0 ? (
                <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] flex flex-col items-center py-16">
                  <BookUser size={28} className="text-gray-300 dark:text-white/20 mb-3" />
                  <p className="text-sm text-gray-500 dark:text-white/40">Belum ada kontak darurat</p>
                </div>
              ) : (
                contacts.map((c) => (
                  <div key={c.id} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)] text-[#FF3B30] font-bold text-sm flex items-center justify-center border border-[#FECACA] flex-shrink-0">
                          {c.priority}
                        </span>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">{c.name}</p>
                          {c.role && <p className="text-xs text-gray-500 dark:text-white/40">{c.role}</p>}
                        </div>
                      </div>
                      {deleteContactId === c.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRemoveContact(c.id)}
                            disabled={removeContactMut.isPending}
                            className="px-2 py-1 bg-[#FF3B30] text-white rounded-lg text-[11px] font-semibold"
                          >
                            Hapus
                          </button>
                          <button
                            onClick={() => setDeleteContactId(null)}
                            className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/[0.08] flex items-center justify-center text-gray-500"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRemoveContact(c.id)}
                          className="w-8 h-8 rounded-xl bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.10)] flex items-center justify-center text-[#FF3B30] hover:bg-[#FEE2E2] transition border border-[#FECACA] dark:border-[rgba(255,59,48,0.20)]"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="flex items-center gap-1 text-xs font-mono text-gray-700 dark:text-white/60 bg-gray-50 dark:bg-white/[0.05] px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/[0.08]">
                        <Phone size={10} />{c.phone}
                      </span>
                      <span className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-medium border ${
                        c.is_active
                          ? 'bg-[#F0FDF4] text-[#34C759] border-[#BBF7D0]'
                          : 'bg-gray-100 text-gray-400 border-gray-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.is_active ? 'bg-[#34C759]' : 'bg-gray-400'}`} />
                        {c.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Add Contact Modal ──────────────────────────────────────────────────── */}
      {addContact && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setAddContact(false)}
        >
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-md shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)] flex items-center justify-center">
                  <BookUser size={15} className="text-[#FF3B30]" />
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Tambah Kontak Darurat</h2>
              </div>
              <button
                onClick={() => setAddContact(false)}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/20 transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {([
                { key: 'name',     label: 'Nama *',     placeholder: 'Nama kontak',   type: 'text'   },
                { key: 'role',     label: 'Jabatan',    placeholder: 'Jabatan / Posisi', type: 'text' },
                { key: 'phone',    label: 'No HP *',    placeholder: '08xxxxxxxxxx',  type: 'tel'    },
                { key: 'priority', label: 'Prioritas',  placeholder: '1',             type: 'number' },
              ] as const).map(({ key, label, placeholder, type }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">{label}</label>
                  <input
                    value={newContact[key]}
                    onChange={(e) => setNewContact((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    type={type}
                    min={type === 'number' ? 1 : undefined}
                    className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition"
                  />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3">
              <button
                onClick={() => setAddContact(false)}
                className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
              >
                Batal
              </button>
              <button
                onClick={() => addContactMut.mutate()}
                disabled={addContactMut.isPending || !newContact.name || !newContact.phone}
                className="flex-1 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {addContactMut.isPending
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'Simpan Kontak'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
