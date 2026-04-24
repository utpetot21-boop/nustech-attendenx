'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  CheckCircle2, Clock, XCircle, Users,
  Timer, TrendingUp, Download, Search,
  MapPin, MapPinOff, ClipboardList,
  ChevronLeft, ChevronRight, Filter,
  AlertTriangle, ShieldAlert, FileWarning, Plus, X, ExternalLink, FileText,
  AlarmClock, LogOut, Hourglass, MessageSquare, CheckCheck, Ban, ChevronDown, Check,
  Pencil,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
// Method enums dari shared (backend DTO): sama persis dengan yang disimpan di DB.
type CheckinMethod  = 'face_id' | 'fingerprint' | 'pin' | 'qr' | 'gps';
type CheckoutMethod = 'face_id' | 'fingerprint' | 'pin' | 'qr' | 'gps' | 'manual';

type AttendanceRecord = {
  id: string;
  user_id: string;
  date: string;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_method: CheckinMethod | null;
  check_out_method: CheckoutMethod | null;
  late_minutes: number;
  overtime_minutes: number;
  gps_valid: boolean | null;
  tolerance_minutes: number;
  late_approved?: boolean;
  early_departure_approved?: boolean;
  shift_start?: string | null;
  shift_end?: string | null;
  check_in_lat?: number | string | null;
  check_in_lng?: number | string | null;
  check_out_gps_valid?: boolean | null;
  notes?: string | null;
  user: {
    id: string;
    full_name: string;
    employee_id?: string;
    avatar_url?: string | null;
    department?: { name: string };
  };
};

type Summary = { hadir: number; terlambat: number; alfa: number; terjadwal?: number; total_aktif: number; date: string };
type ViewMode = 'daily' | 'monthly';

// ── Config ────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string; border: string }> = {
  hadir:           { label: 'Hadir',             bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  terlambat:       { label: 'Terlambat',         bg: 'bg-amber-50 dark:bg-amber-900/20',    text: 'text-amber-700 dark:text-amber-400',    dot: 'bg-amber-400',   border: 'border-amber-200 dark:border-amber-800'   },
  alfa:            { label: 'Alfa',              bg: 'bg-red-50 dark:bg-red-900/20',        text: 'text-red-600 dark:text-red-400',        dot: 'bg-red-500',     border: 'border-red-200 dark:border-red-800'       },
  izin:            { label: 'Izin',              bg: 'bg-blue-50 dark:bg-blue-900/20',      text: 'text-blue-700 dark:text-blue-400',      dot: 'bg-blue-400',    border: 'border-blue-200 dark:border-blue-800'     },
  izin_pulang_awal:{ label: 'Izin Pulang Awal',  bg: 'bg-teal-50 dark:bg-teal-900/20',      text: 'text-teal-700 dark:text-teal-300',      dot: 'bg-teal-400',    border: 'border-teal-200 dark:border-teal-800'     },
  izin_terlambat:  { label: 'Izin Terlambat',    bg: 'bg-indigo-50 dark:bg-indigo-900/20',  text: 'text-indigo-700 dark:text-indigo-300',  dot: 'bg-indigo-400',  border: 'border-indigo-200 dark:border-indigo-800' },
  terjadwal:       { label: 'Terjadwal',         bg: 'bg-slate-50 dark:bg-white/[0.06]',    text: 'text-slate-600 dark:text-white/70',     dot: 'bg-slate-400',   border: 'border-slate-200 dark:border-white/10'    },
  sakit:           { label: 'Sakit',             bg: 'bg-purple-50 dark:bg-purple-900/20',  text: 'text-purple-700 dark:text-purple-400',  dot: 'bg-purple-400',  border: 'border-purple-200 dark:border-purple-800' },
  cuti:            { label: 'Cuti',              bg: 'bg-teal-50 dark:bg-teal-900/20',      text: 'text-teal-700 dark:text-teal-400',      dot: 'bg-teal-400',    border: 'border-teal-200 dark:border-teal-800'     },
  libur:           { label: 'Libur',             bg: 'bg-gray-100 dark:bg-white/10',        text: 'text-gray-500 dark:text-white/50',      dot: 'bg-gray-400',    border: 'border-gray-200 dark:border-white/10'     },
};

function displayStatus(r: { status: string; late_approved?: boolean; early_departure_approved?: boolean }): string {
  if (r.early_departure_approved) return 'izin_pulang_awal';
  if (r.late_approved) return 'izin_terlambat';
  return r.status;
}

const METHOD_LABEL: Record<string, string> = {
  face_id: 'Face ID',
  fingerprint: 'Fingerprint',
  pin: 'PIN',
  qr: 'QR Code',
  manual: 'Manual',
  gps: 'GPS',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toWITA(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' });
}

function fmtShiftTime(t?: string | null) {
  if (!t) return '';
  // schedule time diformat HH:MM:SS atau HH:MM → ambil HH:MM
  return t.slice(0, 5);
}

function fmtCoord(v?: number | string | null): string | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  if (!Number.isFinite(n)) return null;
  return n.toFixed(5);
}

function CheckInLocation({ r }: { r: AttendanceRecord }) {
  const lat = fmtCoord(r.check_in_lat);
  const lng = fmtCoord(r.check_in_lng);
  if (!lat || !lng) return null;
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[10px] text-[#007AFF] dark:text-[#0A84FF] hover:underline mt-0.5"
      title="Buka di Google Maps"
    >
      <MapPin size={9} />
      <span className="font-mono">{lat}, {lng}</span>
    </a>
  );
}
function today()        { return new Date().toISOString().split('T')[0]; }
function currentMonth() { return new Date().toISOString().slice(0, 7); }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'Asia/Makassar' });
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.alfa;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

function GpsBadge({ valid }: { valid: boolean | null }) {
  if (valid === null) return <span className="text-gray-300 dark:text-white/20 text-[11px]">—</span>;
  return valid
    ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full"><MapPin size={9} />Valid</span>
    : <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded-full"><MapPinOff size={9} />Offset</span>;
}

// ── Koreksi Modal ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS = ['hadir', 'terlambat', 'alfa', 'izin', 'sakit', 'dinas'] as const;
const inputCls = 'w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2E] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wide mb-1.5';

function toLocalTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar', hour12: false });
}

function buildIso(date: string, hhmm: string): string {
  // date = 'YYYY-MM-DD' (WITA date), hhmm = 'HH:MM' — hasilkan ISO dengan offset +08:00
  return `${date}T${hhmm}:00+08:00`;
}

function CorrectAttendanceModal({
  record,
  onClose,
  onSaved,
}: {
  record: AttendanceRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [checkInTime,       setCheckInTime]       = useState(toLocalTime(record.check_in_at));
  const [checkOutTime,      setCheckOutTime]       = useState(toLocalTime(record.check_out_at));
  const [status,            setStatus]            = useState(record.status);
  const [notes,             setNotes]             = useState(record.notes ?? '');
  const [correctionReason,  setCorrectionReason]  = useState('');
  const [saving,            setSaving]            = useState(false);
  const [error,             setError]             = useState('');

  const handleSave = async () => {
    if (!correctionReason.trim()) { setError('Alasan koreksi wajib diisi.'); return; }
    setSaving(true);
    setError('');
    try {
      const body: Record<string, string> = { correction_reason: correctionReason.trim() };
      if (checkInTime)  body.check_in_at  = buildIso(record.date, checkInTime);
      if (checkOutTime) body.check_out_at = buildIso(record.date, checkOutTime);
      if (status !== record.status) body.status = status;
      if (notes.trim() !== (record.notes ?? '').trim()) body.notes = notes.trim();

      await apiClient.patch(`/attendance/${record.id}/correct`, body);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Gagal menyimpan koreksi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <div className="w-7 h-7 rounded-lg bg-[#007AFF]/10 flex items-center justify-center">
                <Pencil size={13} className="text-[#007AFF]" />
              </div>
              <h3 className="text-[16px] font-bold text-gray-900 dark:text-white">Koreksi Absensi</h3>
            </div>
            <p className="text-[12px] text-gray-400 dark:text-white/40 ml-9">
              {record.user?.full_name} · {new Date(record.date).toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Asia/Makassar' })}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Jam check-in / check-out */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Jam Check-in</label>
              <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} className={inputCls} />
              {record.check_in_at && (
                <p className="text-[10px] text-gray-400 mt-1">Saat ini: {toLocalTime(record.check_in_at)} WITA</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Jam Check-out</label>
              <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} className={inputCls} />
              {record.check_out_at && (
                <p className="text-[10px] text-gray-400 mt-1">Saat ini: {toLocalTime(record.check_out_at)} WITA</p>
              )}
            </div>
          </div>

          {/* Status override */}
          <div>
            <label className={labelCls}>Status Kehadiran</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_CONFIG[s]?.label ?? s}</option>
              ))}
            </select>
          </div>

          {/* Catatan admin */}
          <div>
            <label className={labelCls}>Catatan Tambahan <span className="normal-case font-normal text-gray-400">(opsional)</span></label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan dari admin…" className={`${inputCls} resize-none`} />
          </div>

          {/* Alasan koreksi — wajib */}
          <div>
            <label className={labelCls}>Alasan Koreksi <span className="text-red-500">*</span></label>
            <textarea rows={3} value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)}
              placeholder="Jelaskan alasan perubahan data absensi ini…" className={`${inputCls} resize-none`} />
            <p className="text-[10px] text-gray-400 mt-1">Dicatat sebagai audit trail perubahan data.</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />
              <p className="text-[12px] text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-sm font-semibold disabled:opacity-50">
            Batal
          </button>
          <button onClick={handleSave} disabled={saving || !correctionReason.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0071e3] disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {saving ? 'Menyimpan…' : 'Simpan Koreksi'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Card view untuk mobile
function RecordCard({ r, showDate, onCorrect }: { r: AttendanceRecord; showDate?: boolean; onCorrect?: () => void }) {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <UserAvatar name={r.user?.full_name} avatarUrl={r.user?.avatar_url} size="md" />
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{r.user?.full_name ?? '—'}</p>
            <StatusBadge status={displayStatus(r)} />
          </div>
          <p className="text-[11px] text-gray-400 dark:text-white/35">
            {r.user?.employee_id}{r.user?.department?.name ? ` · ${r.user.department.name}` : ''}
          </p>
          {showDate && (
            <p className="text-[11px] text-gray-400 dark:text-white/35 mt-0.5">{fmtDate(r.date)}</p>
          )}
        </div>
      </div>

      {/* Time row */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3 py-2">
          <p className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-white/30 font-semibold mb-0.5">Check-in</p>
          {r.status === 'terjadwal' && !r.check_in_at ? (
            <p className="text-[12px] text-slate-500 dark:text-white/50">Terjadwal pukul <span className="font-mono font-semibold">{fmtShiftTime(r.shift_start)}</span></p>
          ) : (
            <>
              <p className="text-[13px] font-mono font-semibold text-gray-800 dark:text-white">{toWITA(r.check_in_at)}</p>
              {r.check_in_method && (
                <p className="text-[9px] text-gray-400 dark:text-white/30 mt-0.5">{METHOD_LABEL[r.check_in_method] ?? r.check_in_method}</p>
              )}
              <CheckInLocation r={r} />
            </>
          )}
        </div>
        <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl px-3 py-2">
          <p className="text-[9px] uppercase tracking-wide text-gray-400 dark:text-white/30 font-semibold mb-0.5">Check-out</p>
          <p className="text-[13px] font-mono font-semibold text-gray-800 dark:text-white">{toWITA(r.check_out_at)}</p>
          {r.check_out_method && (
            <p className="text-[9px] text-gray-400 dark:text-white/30 mt-0.5">{METHOD_LABEL[r.check_out_method] ?? r.check_out_method}</p>
          )}
          {r.check_out_at && <div className="mt-1"><GpsBadge valid={r.check_out_gps_valid ?? null} /></div>}
        </div>
      </div>

      {/* Tags row */}
      {(r.late_minutes > 0 || r.overtime_minutes > 0 || r.gps_valid !== null) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {r.late_minutes > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              <Timer size={9} /> {r.late_minutes}m telat
            </span>
          )}
          {r.overtime_minutes > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
              <TrendingUp size={9} /> {r.overtime_minutes}m lembur
            </span>
          )}
          <GpsBadge valid={r.gps_valid} />
        </div>
      )}

      {/* Tombol Koreksi */}
      {onCorrect && (
        <button onClick={onCorrect}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-semibold text-[#007AFF] bg-[#007AFF]/08 dark:bg-[#007AFF]/15 hover:bg-[#007AFF]/15 transition-colors">
          <Pencil size={11} /> Koreksi Data
        </button>
      )}
    </div>
  );
}

// ── Violations Types & Config ─────────────────────────────────────────────────
interface WarningLetter {
  id: string;
  user_id: string;
  user: { id: string; name: string; employee_id?: string; department?: { name: string } };
  level: 'SP1' | 'SP2' | 'SP3';
  reason: string;
  issued_at: string;
  valid_until: string | null;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  issuer: { name: string };
  doc_url: string | null;
  notes: string | null;
  created_at: string;
}

interface AttendanceViolation {
  id: string;
  user_id: string;
  user: { name: string };
  type: string;
  description: string | null;
  is_resolved: boolean;
  created_at: string;
}

interface CreateSpForm {
  user_id: string;
  level: 'SP1' | 'SP2' | 'SP3';
  reason: string;
  valid_until: string;
  notes: string;
  reference_violation_id: string;
}

const LEVEL_MAP: Record<string, { bg: string; text: string; ring: string; activeBg: string; activeText: string }> = {
  SP1: { bg: 'bg-[#FF9500]/10', text: 'text-[#FF9500]', ring: 'ring-[#FF9500]/20', activeBg: 'bg-[#FF9500]', activeText: 'text-white' },
  SP2: { bg: 'bg-[#FF3B30]/10', text: 'text-[#FF3B30]', ring: 'ring-[#FF3B30]/20', activeBg: 'bg-[#FF3B30]', activeText: 'text-white' },
  SP3: { bg: 'bg-[#9F1239]/10', text: 'text-[#9F1239]', ring: 'ring-[#9F1239]/20', activeBg: 'bg-[#9F1239]', activeText: 'text-white' },
};

const vioInputCls = 'w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2E] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30';
const vioLabelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

function fmtShortDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' });
}

// ── Employee Combobox (untuk form Buat SP) ────────────────────────────────────
interface EmployeeOption {
  id: string;
  full_name: string;
  employee_id?: string;
  department?: { name: string } | null;
}

function EmployeeCombobox({
  value,
  onChange,
  placeholder = 'Cari nama atau NIK karyawan…',
}: {
  value: string;
  onChange: (id: string, emp: EmployeeOption | null) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<EmployeeOption | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: users = [], isLoading } = useQuery<EmployeeOption[]>({
    queryKey: ['users-combobox', query],
    queryFn: () =>
      apiClient.get(`/users?search=${encodeURIComponent(query)}&limit=50`).then((r) => {
        const d = r.data;
        if (Array.isArray(d) && Array.isArray(d[0])) return d[0] as EmployeeOption[];
        return (d?.items ?? d?.data ?? d ?? []) as EmployeeOption[];
      }),
    staleTime: 30_000,
    enabled: open,
  });

  // Resolve label ketika value berubah dari luar (misal reset form)
  useEffect(() => {
    if (!value) setSelected(null);
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const displayText = selected
    ? `${selected.full_name}${selected.employee_id ? ` · ${selected.employee_id}` : ''}`
    : '';

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${vioInputCls} flex items-center justify-between text-left`}
      >
        <span className={displayText ? 'text-gray-900 dark:text-white' : 'text-gray-400'}>
          {displayText || 'Pilih karyawan…'}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-[#1C1C1E] border border-black/[0.08] dark:border-white/[0.1] rounded-xl shadow-xl max-h-72 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-black/[0.05] dark:border-white/[0.08]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-gray-50 dark:bg-[#2C2C2E] border border-transparent focus:border-[#007AFF]/30 focus:outline-none text-gray-900 dark:text-white placeholder:text-gray-400"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <p className="px-3 py-6 text-xs text-center text-gray-400">Memuat…</p>
            ) : users.length === 0 ? (
              <p className="px-3 py-6 text-xs text-center text-gray-400">
                {query ? 'Tidak ada karyawan cocok' : 'Ketik untuk mencari'}
              </p>
            ) : (
              users.map((u) => {
                const active = u.id === value;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onChange(u.id, u);
                      setSelected(u);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition ${
                      active
                        ? 'bg-[#007AFF]/10 text-[#007AFF]'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{u.full_name}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {u.employee_id ?? '—'}
                        {u.department?.name ? ` · ${u.department.name}` : ''}
                      </p>
                    </div>
                    {active && <Check size={14} className="text-[#007AFF] flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function LevelBadge({ level }: { level: 'SP1' | 'SP2' | 'SP3' }) {
  const m = LEVEL_MAP[level] ?? LEVEL_MAP.SP1;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ${m.bg} ${m.text} ${m.ring}`}>
      {level}
    </span>
  );
}

function ViolationCard({ v }: { v: AttendanceViolation }) {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[#FF3B30]">{initials(v.user?.name ?? '?')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{v.user?.name ?? '—'}</p>
            {v.is_resolved
              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#34C759]/10 text-[#34C759] ring-1 ring-[#34C759]/20"><CheckCircle2 size={10} /> Selesai</span>
              : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/10 text-[#FF9500] ring-1 ring-[#FF9500]/20"><Clock size={10} /> Aktif</span>
            }
          </div>
          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FF3B30]/10 text-[#FF3B30]">
            {v.type.replace(/_/g, ' ')}
          </span>
          {v.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{v.description}</p>}
          <p className="text-[11px] text-gray-400 mt-1">{fmtShortDate(v.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

function SpCard({ wl, onDetail }: { wl: WarningLetter; onDetail: () => void }) {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#FF9500]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-[#FF9500]">{initials(wl.user?.name ?? '?')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{wl.user?.name ?? '—'}</p>
            <LevelBadge level={wl.level} />
          </div>
          {wl.user?.department?.name && <p className="text-xs text-gray-400 mt-0.5">{wl.user.department.name}</p>}
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{wl.reason}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-gray-400">{fmtShortDate(wl.issued_at)}</p>
            {wl.acknowledged_at
              ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#34C759]"><CheckCircle2 size={10} /> Dikonfirmasi</span>
              : <span className="text-[11px] font-semibold text-[#FF9500]">Menunggu konfirmasi</span>
            }
          </div>
        </div>
      </div>
      <button onClick={onDetail} className="mt-3 w-full py-1.5 rounded-xl bg-[#007AFF]/10 text-[#007AFF] text-xs font-semibold">
        Detail
      </button>
    </div>
  );
}

// ── Pelanggaran Section (embedded from /violations) ────────────────────────────
function PelanggaranSection() {
  const queryClient = useQueryClient();
  type VioTab = 'violations' | 'warning-letters';
  const [activeTab, setActiveTab] = useState<VioTab>('violations');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [detailWl, setDetailWl] = useState<WarningLetter | null>(null);
  const [form, setForm] = useState<CreateSpForm>({
    user_id: '', level: 'SP1', reason: '', valid_until: '', notes: '', reference_violation_id: '',
  });

  const { data: violations = [], isLoading: loadingVio } = useQuery<AttendanceViolation[]>({
    queryKey: ['violations'],
    queryFn: () => apiClient.get('/violations').then((r) => r.data).catch(() => []),
    refetchInterval: 60_000,
  });

  const { data: warningLetters = [], isLoading: loadingWL } = useQuery<WarningLetter[]>({
    queryKey: ['warning-letters'],
    queryFn: () => apiClient.get('/warning-letters').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const createSpMutation = useMutation({
    mutationFn: (dto: Partial<CreateSpForm>) => apiClient.post('/warning-letters', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warning-letters'] });
      setShowCreateModal(false);
      setForm({ user_id: '', level: 'SP1', reason: '', valid_until: '', notes: '', reference_violation_id: '' });
      toast.success('Surat Peringatan berhasil dibuat');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal membuat Surat Peringatan')),
  });

  const totalVio = violations.length;
  const unresolvedVio = violations.filter((v) => !v.is_resolved).length;
  const totalSP = warningLetters.length;
  const unacknowledgedSP = warningLetters.filter((w) => !w.acknowledged_at).length;

  const filteredVio = violations.filter((v) => !search || v.user?.name.toLowerCase().includes(search.toLowerCase()));
  const filteredWl  = warningLetters.filter((w) => !search || w.user?.name.toLowerCase().includes(search.toLowerCase()));

  const VIO_TABS: { key: VioTab; label: string; count: number }[] = [
    { key: 'violations',      label: 'Pelanggaran',      count: unresolvedVio },
    { key: 'warning-letters', label: 'Surat Peringatan', count: totalSP },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-white">Pelanggaran &amp; SP</h2>
          <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">Pelanggaran absensi dan Surat Peringatan karyawan</p>
        </div>
        {activeTab === 'warning-letters' && (
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0071e3] text-white rounded-xl text-sm font-semibold transition flex-shrink-0">
            <Plus size={16} /> Buat SP
          </button>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: AlertTriangle, label: 'Total Pelanggaran',  value: totalVio,         color: 'bg-[#FF3B30]' },
          { icon: Clock,         label: 'Belum Diselesaikan', value: unresolvedVio,    color: 'bg-[#FF9500]' },
          { icon: FileWarning,   label: 'Total SP',           value: totalSP,          color: 'bg-[#AF52DE]' },
          { icon: ShieldAlert,   label: 'Belum Dikonfirmasi', value: unacknowledgedSP, color: 'bg-[#FF3B30]' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08] flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
              <Icon size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="space-y-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {VIO_TABS.map((t) => (
            <button key={t.key} onClick={() => { setActiveTab(t.key); setSearch(''); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition flex-shrink-0 ${
                activeTab === t.key
                  ? 'bg-[#007AFF] text-white'
                  : 'bg-white dark:bg-[#1C1C1E] text-gray-600 dark:text-gray-400 border border-black/[0.08] dark:border-white/[0.1]'
              }`}>
              {t.label}
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-white/20' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 dark:text-gray-400'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08]">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama karyawan…"
            className="flex-1 text-sm bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none" />
        </div>
      </div>

      {/* Violations tab */}
      {activeTab === 'violations' && (
        loadingVio ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredVio.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center"><AlertTriangle size={28} className="text-gray-400" /></div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tidak ada pelanggaran</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{search ? 'Coba kata kunci lain' : 'Semua karyawan tertib'}</p>
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3">{filteredVio.map((v) => <ViolationCard key={v.id} v={v} />)}</div>
            <div className="hidden md:block bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr className="border-b border-black/[0.04] dark:border-white/[0.06]">
                    {['Karyawan', 'Tipe', 'Keterangan', 'Tanggal', 'Status'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredVio.map((v) => (
                    <tr key={v.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-[#FF3B30]">{initials(v.user?.name ?? '?')}</span>
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{v.user?.name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#FF3B30]/10 text-[#FF3B30]">{v.type.replace(/_/g, ' ')}</span></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate text-xs">{v.description ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtShortDate(v.created_at)}</td>
                      <td className="px-4 py-3">
                        {v.is_resolved
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#34C759]"><CheckCircle2 size={12} /> Selesai</span>
                          : <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF9500]"><Clock size={12} /> Aktif</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {/* Warning Letters tab */}
      {activeTab === 'warning-letters' && (
        loadingWL ? (
          <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredWl.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center"><FileWarning size={28} className="text-gray-400" /></div>
            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tidak ada Surat Peringatan</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{search ? 'Coba kata kunci lain' : 'Belum ada SP yang diterbitkan'}</p>
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3">{filteredWl.map((wl) => <SpCard key={wl.id} wl={wl} onDetail={() => setDetailWl(wl)} />)}</div>
            <div className="hidden md:block bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-black/[0.04] dark:border-white/[0.06]">
                    {['Karyawan', 'Level', 'Alasan', 'Terbit', 'Berlaku s/d', 'Konfirmasi', 'Dokumen'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWl.map((wl) => (
                    <tr key={wl.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition" onClick={() => setDetailWl(wl)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#FF9500]/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-[#FF9500]">{initials(wl.user?.name ?? '?')}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{wl.user?.name ?? '—'}</p>
                            {wl.user?.department?.name && <p className="text-[11px] text-gray-400">{wl.user.department.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><LevelBadge level={wl.level} /></td>
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{wl.reason}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtShortDate(wl.issued_at)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{wl.valid_until ? fmtShortDate(wl.valid_until) : '—'}</td>
                      <td className="px-4 py-3">
                        {wl.acknowledged_at
                          ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#34C759]"><CheckCircle2 size={12} /> {fmtShortDate(wl.acknowledged_at)}</span>
                          : <span className="text-xs font-semibold text-[#FF9500]">Menunggu</span>
                        }
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {wl.doc_url
                          ? <a href={wl.doc_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#007AFF] font-semibold hover:underline"><FileText size={12} /> PDF</a>
                          : <button onClick={() => apiClient.get(`/warning-letters/${wl.id}/pdf`).then((r) => window.open(r.data.url, '_blank'))} className="text-xs text-gray-400 hover:text-[#007AFF] transition">Generate PDF</button>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}

      {/* WL Detail Modal */}
      {detailWl && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={() => setDetailWl(null)}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF9500]/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#FF9500]">{initials(detailWl.user?.name ?? '?')}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{detailWl.user?.name ?? '—'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <LevelBadge level={detailWl.level} />
                    {detailWl.user?.department?.name && <span className="text-xs text-gray-400">{detailWl.user.department.name}</span>}
                  </div>
                </div>
              </div>
              <button onClick={() => setDetailWl(null)} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Diterbitkan', value: fmtShortDate(detailWl.issued_at) },
                  { label: 'Berlaku s/d', value: detailWl.valid_until ? fmtShortDate(detailWl.valid_until) : '—' },
                  { label: 'Penerbit',    value: detailWl.issuer?.name },
                  { label: 'Konfirmasi',  value: detailWl.acknowledged_at ? fmtShortDate(detailWl.acknowledged_at) : 'Belum' },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                  </div>
                ) : null)}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Alasan</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{detailWl.reason}</p>
              </div>
              {detailWl.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Catatan</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{detailWl.notes}</p>
                </div>
              )}
              {detailWl.doc_url
                ? <a href={detailWl.doc_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-[#007AFF] font-semibold hover:underline"><FileText size={16} /> Lihat Dokumen SP <ExternalLink size={12} /></a>
                : <button onClick={() => apiClient.get(`/warning-letters/${detailWl.id}/pdf`).then((r) => window.open(r.data.url, '_blank'))} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#007AFF] transition"><FileText size={16} /> Generate PDF</button>
              }
            </div>
          </div>
        </div>
      )}

      {/* Create SP Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Buat Surat Peringatan</h3>
              <button onClick={() => setShowCreateModal(false)} className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center"><X size={16} className="text-gray-500" /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div>
                <label className={vioLabelCls}>Karyawan</label>
                <EmployeeCombobox
                  value={form.user_id}
                  onChange={(id) => setForm((f) => ({ ...f, user_id: id }))}
                />
              </div>
              <div>
                <label className={vioLabelCls}>Level SP</label>
                <div className="flex gap-2">
                  {(['SP1', 'SP2', 'SP3'] as const).map((lvl) => {
                    const m = LEVEL_MAP[lvl];
                    const active = form.level === lvl;
                    return (
                      <button key={lvl} onClick={() => setForm((f) => ({ ...f, level: lvl }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition ring-1 ${active ? `${m.activeBg} ${m.activeText} ring-transparent` : `bg-white dark:bg-[#2C2C2E] ${m.text} ${m.ring}`}`}>
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div><label className={vioLabelCls}>Alasan</label><textarea rows={3} placeholder="Jelaskan alasan pemberian SP..." value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className={`${vioInputCls} resize-none`} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={vioLabelCls}>Berlaku s/d</label><input type="date" value={form.valid_until} onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))} className={vioInputCls} /></div>
                <div><label className={vioLabelCls}>Ref. Pelanggaran</label><input type="text" placeholder="UUID violation (opsional)" value={form.reference_violation_id} onChange={(e) => setForm((f) => ({ ...f, reference_violation_id: e.target.value }))} className={vioInputCls} /></div>
              </div>
              <div><label className={vioLabelCls}>Catatan Tambahan</label><textarea rows={2} placeholder="Catatan opsional..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={`${vioInputCls} resize-none`} /></div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                disabled={!form.user_id || !form.reason || createSpMutation.isPending}
                onClick={() => createSpMutation.mutate({ user_id: form.user_id, level: form.level, reason: form.reason, valid_until: form.valid_until || undefined, notes: form.notes || undefined, reference_violation_id: form.reference_violation_id || undefined })}
                className="flex-1 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0071e3] disabled:opacity-50 text-white text-sm font-semibold transition">
                {createSpMutation.isPending ? 'Menyimpan…' : 'Terbitkan SP'}
              </button>
              <button onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-sm font-semibold">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attendance Request Types ──────────────────────────────────────────────────
type AttendanceRequestType   = 'late_arrival' | 'early_departure';
type AttendanceRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface AttendanceRequest {
  id: string;
  user_id: string;
  date: string;
  type: AttendanceRequestType;
  reason: string;
  estimated_time: string | null;
  status: AttendanceRequestStatus;
  reviewed_by: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  user?: { id: string; full_name: string; employee_id?: string; avatar_url?: string | null; department?: { name: string } };
}

const REQ_STATUS_CFG: Record<AttendanceRequestStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  pending:   { label: 'Menunggu',  bg: 'bg-amber-50 dark:bg-amber-900/20',   text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-400',  border: 'border-amber-200 dark:border-amber-800'   },
  approved:  { label: 'Disetujui', bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-200 dark:border-emerald-800' },
  rejected:  { label: 'Ditolak',   bg: 'bg-red-50 dark:bg-red-900/20',       text: 'text-red-600 dark:text-red-400',       dot: 'bg-red-500',    border: 'border-red-200 dark:border-red-800'       },
  cancelled: { label: 'Dibatalkan',bg: 'bg-gray-100 dark:bg-white/10',       text: 'text-gray-500 dark:text-white/50',     dot: 'bg-gray-400',   border: 'border-gray-200 dark:border-white/10'     },
};

function ReqStatusBadge({ status }: { status: AttendanceRequestStatus }) {
  const s = REQ_STATUS_CFG[status] ?? REQ_STATUS_CFG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Permohonan Section ────────────────────────────────────────────────────────
function PermohonanSection() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter,   setTypeFilter]   = useState<string>('');
  const [dateFilter,   setDateFilter]   = useState('');
  const [search,       setSearch]       = useState('');
  const [reviewModal,  setReviewModal]  = useState<{ req: AttendanceRequest; action: 'approve' | 'reject' } | null>(null);
  const [reviewNote,   setReviewNote]   = useState('');

  const { data: requests = [], isLoading } = useQuery<AttendanceRequest[]>({
    queryKey: ['admin-attendance-requests', statusFilter, typeFilter, dateFilter],
    queryFn: () => {
      const q = new URLSearchParams();
      if (statusFilter) q.set('status', statusFilter);
      if (typeFilter)   q.set('type',   typeFilter);
      if (dateFilter)   q.set('date',   dateFilter);
      return apiClient.get(`/attendance-requests/admin/list?${q}`).then((r) => r.data?.items ?? r.data ?? []);
    },
    refetchInterval: 30_000,
  });

  const { data: pendingCount } = useQuery<{ count: number }>({
    queryKey: ['attendance-requests-pending-count'],
    queryFn: () => apiClient.get('/attendance-requests/admin/pending-count').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/attendance-requests/${id}/approve`, { reviewer_note: note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-requests-pending-count'] });
      setReviewModal(null);
      setReviewNote('');
      toast.success('Permohonan disetujui');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyetujui permohonan')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/attendance-requests/${id}/reject`, { reviewer_note: note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-attendance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-requests-pending-count'] });
      setReviewModal(null);
      setReviewNote('');
      toast.success('Permohonan ditolak');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menolak permohonan')),
  });

  const filtered = requests.filter((r) =>
    !search || r.user?.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingReqs  = requests.filter((r) => r.status === 'pending').length;
  const approvedReqs = requests.filter((r) => r.status === 'approved').length;
  const rejectedReqs = requests.filter((r) => r.status === 'rejected').length;

  const isReviewing = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-[20px] font-bold text-gray-900 dark:text-white">Permohonan Izin Absen</h2>
        <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">Izin terlambat &amp; izin pulang awal dari karyawan</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Hourglass,    label: 'Menunggu',      value: pendingReqs,              color: 'text-amber-500',   bg: 'bg-amber-50 dark:bg-amber-900/20'   },
          { icon: CheckCircle2, label: 'Disetujui',     value: approvedReqs,             color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20'},
          { icon: XCircle,      label: 'Ditolak',       value: rejectedReqs,             color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-900/20'       },
          { icon: ClipboardList,label: 'Total Hari ini',value: pendingCount?.count ?? 0, color: 'text-[#007AFF]',   bg: 'bg-blue-50 dark:bg-blue-900/20'     },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08] flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
              <Icon size={18} className={color} strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <p className={`text-2xl font-bold leading-none ${color}`}>{value}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-3 flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 flex-shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari karyawan…"
            className="w-full h-9 pl-8 pr-3 rounded-lg text-[12px] bg-gray-50 dark:bg-white/10 border border-black/[0.07] dark:border-white/12 text-gray-700 dark:text-white placeholder-gray-300 dark:placeholder-white/25 focus:outline-none" />
        </div>
        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
          className="h-9 px-2.5 rounded-lg text-[12px] bg-gray-50 dark:bg-white/10 border border-black/[0.07] dark:border-white/12 text-gray-700 dark:text-white focus:outline-none flex-shrink-0" />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 px-2.5 rounded-lg text-[12px] bg-gray-50 dark:bg-white/10 border border-black/[0.07] dark:border-white/12 text-gray-700 dark:text-white focus:outline-none flex-shrink-0">
          <option value="">Semua Tipe</option>
          <option value="late_arrival">Izin Terlambat</option>
          <option value="early_departure">Izin Pulang Awal</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-2.5 rounded-lg text-[12px] bg-gray-50 dark:bg-white/10 border border-black/[0.07] dark:border-white/12 text-gray-700 dark:text-white focus:outline-none flex-shrink-0">
          <option value="">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
        </select>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center">
            <ClipboardList size={28} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tidak ada permohonan</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{search ? 'Coba kata kunci lain' : 'Belum ada pengajuan izin'}</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((req) => (
              <div key={req.id} className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${req.type === 'late_arrival' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-purple-50 dark:bg-purple-900/20'}`}>
                    {req.type === 'late_arrival'
                      ? <AlarmClock size={16} className="text-amber-500" strokeWidth={1.8} />
                      : <LogOut     size={16} className="text-purple-500" strokeWidth={1.8} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">{req.user?.full_name ?? '—'}</p>
                      <ReqStatusBadge status={req.status} />
                    </div>
                    <p className="text-[11px] text-gray-400">{req.type === 'late_arrival' ? 'Izin Terlambat' : 'Izin Pulang Awal'} · {fmtShortDate(req.date)}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{req.reason}</p>
                    {req.estimated_time && <p className="text-[11px] text-gray-400 mt-0.5">Est. {req.estimated_time.slice(0,5)} WITA</p>}
                    {req.reviewer_note && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 italic">&quot;{req.reviewer_note}&quot;</p>}
                  </div>
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => { setReviewModal({ req, action: 'approve' }); setReviewNote(''); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#34C759]/10 text-[#34C759] text-[12px] font-semibold border border-[#34C759]/20 hover:bg-[#34C759]/20 transition">
                      <CheckCheck size={13} /> Setujui
                    </button>
                    <button onClick={() => { setReviewModal({ req, action: 'reject' }); setReviewNote(''); }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-[12px] font-semibold border border-red-200 dark:border-red-800 hover:bg-red-100 transition">
                      <Ban size={13} /> Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
            <table className="w-full text-sm min-w-[780px]">
              <thead>
                <tr className="border-b border-black/[0.04] dark:border-white/[0.06]">
                  {['Karyawan', 'Tanggal', 'Tipe', 'Alasan', 'Est. Waktu', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => (
                  <tr key={req.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-[#007AFF]">{initials(req.user?.full_name ?? '?')}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white text-[12px]">{req.user?.full_name ?? '—'}</p>
                          {req.user?.department?.name && <p className="text-[10px] text-gray-400">{req.user.department.name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtShortDate(req.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${req.type === 'late_arrival' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600' : 'bg-purple-50 dark:bg-purple-900/20 text-purple-600'}`}>
                        {req.type === 'late_arrival' ? <AlarmClock size={9} /> : <LogOut size={9} />}
                        {req.type === 'late_arrival' ? 'Terlambat' : 'Pulang Awal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 max-w-[200px]">
                      <p className="truncate">{req.reason}</p>
                      {req.reviewer_note && <p className="text-[10px] text-gray-400 italic mt-0.5 truncate">&quot;{req.reviewer_note}&quot;</p>}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                      {req.estimated_time ? req.estimated_time.slice(0,5) : '—'}
                    </td>
                    <td className="px-4 py-3"><ReqStatusBadge status={req.status} /></td>
                    <td className="px-4 py-3">
                      {req.status === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => { setReviewModal({ req, action: 'approve' }); setReviewNote(''); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#34C759]/10 text-[#34C759] text-[11px] font-semibold hover:bg-[#34C759]/20 transition">
                            <CheckCheck size={11} /> Setujui
                          </button>
                          <button onClick={() => { setReviewModal({ req, action: 'reject' }); setReviewNote(''); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-500 text-[11px] font-semibold hover:bg-red-100 transition">
                            <Ban size={11} /> Tolak
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => !isReviewing && setReviewModal(null)}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-white/20 mx-auto mt-3 mb-1 sm:hidden" />
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${reviewModal.action === 'approve' ? 'bg-[#34C759]/10' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  {reviewModal.action === 'approve'
                    ? <CheckCheck size={18} className="text-[#34C759]" />
                    : <Ban        size={18} className="text-red-500"   />}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {reviewModal.action === 'approve' ? 'Setujui Permohonan' : 'Tolak Permohonan'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{reviewModal.req.user?.full_name ?? '—'} · {fmtShortDate(reviewModal.req.date)}</p>
                </div>
              </div>
              <button onClick={() => setReviewModal(null)} disabled={isReviewing}
                className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center">
                <X size={15} className="text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Request summary */}
              <div className="bg-gray-50 dark:bg-[#2C2C2E] rounded-xl p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Tipe</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    {reviewModal.req.type === 'late_arrival' ? 'Izin Terlambat' : 'Izin Pulang Awal'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Alasan</span>
                  <span className="font-semibold text-gray-700 dark:text-gray-300 text-right max-w-[60%] line-clamp-2">{reviewModal.req.reason}</span>
                </div>
                {reviewModal.req.estimated_time && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Est. Waktu</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{reviewModal.req.estimated_time.slice(0,5)} WITA</span>
                  </div>
                )}
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Catatan Reviewer
                  {reviewModal.action === 'reject' && <span className="text-red-500 ml-1">*</span>}
                  {reviewModal.action === 'approve' && <span className="text-gray-400 font-normal ml-1">(opsional)</span>}
                </label>
                <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-[#2C2C2E] rounded-xl border border-black/[0.07] dark:border-white/[0.1]">
                  <MessageSquare size={15} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <textarea
                    rows={3}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder={reviewModal.action === 'reject' ? 'Tuliskan alasan penolakan…' : 'Catatan opsional…'}
                    className="flex-1 text-sm bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 px-5 pb-6 sm:pb-5">
              <button onClick={() => setReviewModal(null)} disabled={isReviewing}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-sm font-semibold disabled:opacity-50">
                Batal
              </button>
              <button
                disabled={isReviewing || (reviewModal.action === 'reject' && !reviewNote.trim())}
                onClick={() => {
                  if (reviewModal.action === 'approve') {
                    approveMutation.mutate({ id: reviewModal.req.id, note: reviewNote });
                  } else {
                    rejectMutation.mutate({ id: reviewModal.req.id, note: reviewNote });
                  }
                }}
                className={`flex-2 flex-1 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-50 transition ${
                  reviewModal.action === 'approve' ? 'bg-[#34C759] hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                }`}>
                {isReviewing
                  ? (reviewModal.action === 'approve' ? 'Menyetujui…' : 'Menolak…')
                  : (reviewModal.action === 'approve' ? 'Setujui' : 'Tolak')
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type PageTab = 'absensi' | 'permohonan' | 'pelanggaran';

export default function AttendancePage() {
  const queryClient = useQueryClient();
  const [activeTab,     setActiveTab]     = useState<PageTab>('absensi');
  const [viewMode,      setViewMode]      = useState<ViewMode>('daily');
  const [date,          setDate]          = useState(today());
  const [month,         setMonth]         = useState(currentMonth());
  const [statusFilter,  setStatusFilter]  = useState('');
  const [search,        setSearch]        = useState('');
  const [showFilters,   setShowFilters]   = useState(false);
  const [correctModal,  setCorrectModal]  = useState<AttendanceRecord | null>(null);
  const [deptId,        setDeptId]        = useState('');

  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: pendingCount } = useQuery<{ count: number }>({
    queryKey: ['attendance-requests-pending-count'],
    queryFn: () => apiClient.get('/attendance-requests/admin/pending-count').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const PAGE_TABS: { key: PageTab; label: string; badge?: number }[] = [
    { key: 'absensi',      label: 'Monitoring Absensi' },
    { key: 'permohonan',   label: 'Permohonan Izin', badge: pendingCount?.count || 0 },
    { key: 'pelanggaran',  label: 'Pelanggaran & SP' },
  ];

  // Derived statuses difilter client-side karena kolom DB tetap 'hadir'/'terlambat'
  const isDerivedFilter = statusFilter === 'izin_pulang_awal' || statusFilter === 'izin_terlambat';
  const serverStatus = statusFilter && !isDerivedFilter ? statusFilter : undefined;

  const params = viewMode === 'daily'
    ? { date, status: serverStatus }
    : { month, status: serverStatus };

  const { data: records = [], isLoading } = useQuery<AttendanceRecord[]>({
    queryKey: ['admin-attendance', viewMode, date, month, serverStatus],
    queryFn: () => apiClient.get('/attendance/admin/list', { params }).then((r) => r.data),
  });

  const { data: summary } = useQuery<Summary>({
    queryKey: ['attendance-summary-today'],
    queryFn: () => apiClient.get('/attendance/summary/today').then((r) => r.data),
    refetchInterval: 60_000,
  });

  const selectedDeptName = departments.find((d) => d.id === deptId)?.name;

  const filtered = records.filter((r) => {
    if (search && !r.user?.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (isDerivedFilter && displayStatus(r) !== statusFilter) return false;
    if (deptId && selectedDeptName && r.user?.department?.name !== selectedDeptName) return false;
    return true;
  });

  // "Hadir" = benar-benar check-in hari itu (termasuk yang terlambat / pulang awal),
  // "Terlambat" adalah subset dari yang hadir.
  const stats = {
    hadir:     records.filter((r) => !!r.check_in_at).length,
    terlambat: records.filter((r) => r.status === 'terlambat').length,
    alfa:      records.filter((r) => r.status === 'alfa').length,
    terjadwal: records.filter((r) => r.status === 'terjadwal').length,
  };

  const hadirPct = summary?.total_aktif
    ? Math.round((summary.hadir / summary.total_aktif) * 100) : 0;

  // Navigate date
  const shiftDate = (n: number) => {
    const d = new Date(date); d.setDate(d.getDate() + n);
    setDate(d.toISOString().split('T')[0]);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5">

      {/* ── Page Header + Tab Bar ────────────────────────────────── */}
      <div>
        <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
          Absensi
        </h1>
        <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">
          Monitoring, permohonan izin, dan pelanggaran karyawan
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide border-b border-black/[0.06] dark:border-white/[0.08] pb-0">
        {PAGE_TABS.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? 'border-[#007AFF] text-[#007AFF]'
                : 'border-transparent text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70'
            }`}>
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-[#007AFF] text-white' : 'bg-red-500 text-white'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Permohonan ──────────────────────────────────────── */}
      {activeTab === 'permohonan' && <PermohonanSection />}

      {/* ── Tab: Pelanggaran ─────────────────────────────────────── */}
      {activeTab === 'pelanggaran' && <PelanggaranSection />}

      {/* ── Tab: Monitoring Absensi ──────────────────────────────── */}
      {activeTab === 'absensi' && (<>

      {/* ── Header actions ───────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-gray-100 dark:bg-white/10 rounded-xl p-1">
            {(['daily', 'monthly'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                  viewMode === v
                    ? 'bg-white dark:bg-white/20 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-white/50 hover:text-gray-700'
                }`}>
                {v === 'daily' ? 'Harian' : 'Bulanan'}
              </button>
            ))}
          </div>
          {/* Export */}
          <a href={`${process.env.NEXT_PUBLIC_API_URL ?? ''}/reports/attendance/export/excel?month=${month}${deptId ? `&dept_id=${deptId}` : ''}`}
            target="_blank" rel="noreferrer"
            className="h-9 px-3 rounded-xl text-[12px] font-semibold text-white bg-[#30D158] hover:bg-green-600 transition-colors flex items-center gap-1.5">
            <Download size={13} /> Export
          </a>
        </div>
      </div>

      {/* ── Summary Cards ─────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Hadir',         value: summary.hadir,       icon: CheckCircle2, iconColor: 'text-[#30D158]', iconBg: 'bg-[#F0FDF4] dark:bg-[rgba(48,209,88,0.15)]',   progress: hadirPct,    progressColor: 'bg-[#30D158]' },
            { label: 'Terlambat',     value: summary.terlambat,   icon: Clock,        iconColor: 'text-amber-500',  iconBg: 'bg-amber-50 dark:bg-amber-900/20',              progress: null,        progressColor: '' },
            { label: 'Alfa',          value: summary.alfa,        icon: XCircle,      iconColor: 'text-red-500',    iconBg: 'bg-red-50 dark:bg-red-900/20',                  progress: null,        progressColor: '' },
            { label: 'Total Tercatat',value: summary.total_aktif, icon: Users,        iconColor: 'text-[#007AFF]',  iconBg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]',   progress: null,        progressColor: '' },
          ].map(({ label, value, icon: Icon, iconColor, iconBg, progress, progressColor }) => (
            <div key={label} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${iconBg}`}>
                  <Icon size={16} className={iconColor} strokeWidth={1.9} />
                </div>
                <p className={`text-[26px] font-bold ${iconColor}`}>{value}</p>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-white/40 font-medium">{label}</p>
              {progress !== null && (
                <div className="mt-2">
                  <div className="h-1 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${progress}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-white/30 mt-0.5">{progress}% kehadiran</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Filter Bar ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-3 sm:p-4">
        {/* flex-wrap agar tidak overflow di viewport medium ketika semua kontrol muat dalam satu baris */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">

          {/* Date/Month navigator */}
          {viewMode === 'daily' ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => shiftDate(-1)}
                className="w-8 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors">
                <ChevronLeft size={15} />
              </button>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="h-9 px-2.5 rounded-lg text-[12px] bg-gray-50 dark:bg-white/10 border border-black/[0.07] dark:border-white/12 text-gray-700 dark:text-white focus:outline-none focus:border-[#007AFF] cursor-pointer" />
              <button onClick={() => shiftDate(1)}
                className="w-8 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 transition-colors">
                <ChevronRight size={15} />
              </button>
            </div>
          ) : (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              className="h-9 px-2.5 rounded-lg text-[12px] bg-gray-50 dark:bg-white/10 border border-black/[0.07] dark:border-white/12 text-gray-700 dark:text-white focus:outline-none focus:border-[#007AFF] flex-shrink-0" />
          )}

          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari karyawan…"
              className="w-full h-9 pl-8 pr-3 rounded-lg text-[12px] bg-gray-50 dark:bg-white/10 border border-black/[0.07] dark:border-white/12 text-gray-700 dark:text-white placeholder-gray-300 dark:placeholder-white/25 focus:outline-none focus:border-[#007AFF]" />
          </div>

          {/* Status filter + dept filter + filter toggle */}
          <div className="flex gap-2">
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)}
              className="h-9 px-2.5 rounded-lg text-[12px] bg-gray-50 dark:bg-white/10 border border-black/[0.07] dark:border-white/12 text-gray-700 dark:text-white focus:outline-none focus:border-[#007AFF] flex-shrink-0">
              <option value="">Semua Dept</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg text-[12px] bg-gray-50 dark:bg-white/10 border border-black/[0.07] dark:border-white/12 text-gray-700 dark:text-white focus:outline-none focus:border-[#007AFF] flex-shrink-0">
              <option value="">Semua Status</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <button onClick={() => setShowFilters((v) => !v)}
              className={`h-9 px-3 rounded-lg text-[12px] font-medium flex items-center gap-1.5 border transition-colors flex-shrink-0 ${
                showFilters
                  ? 'bg-[#007AFF] text-white border-[#007AFF]'
                  : 'bg-gray-50 dark:bg-white/10 border-black/[0.07] dark:border-white/12 text-gray-500 dark:text-white/50 hover:bg-gray-100'
              }`}>
              <Filter size={12} /> Filter
            </button>
            {/* Export — di sini agar tetap terlihat saat row wrap di viewport medium */}
            <a href={`${process.env.NEXT_PUBLIC_API_URL ?? ''}/reports/attendance/export/excel?month=${month}${deptId ? `&dept_id=${deptId}` : ''}`}
              target="_blank" rel="noreferrer"
              className="h-9 px-3 rounded-lg text-[12px] font-semibold text-white bg-[#30D158] hover:bg-green-600 transition-colors flex items-center gap-1.5 flex-shrink-0">
              <Download size={13} /> Excel
            </a>
          </div>
        </div>

        {/* Stats inline */}
        {records.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-50 dark:border-white/[0.05]">
            <span className="text-[11px] text-gray-400 dark:text-white/35">{filtered.length} record</span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
              <CheckCircle2 size={11} /> {stats.hadir} hadir
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-500">
              <Clock size={11} /> {stats.terlambat} terlambat
            </span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-red-500">
              <XCircle size={11} /> {stats.alfa} alfa
            </span>
            {stats.terjadwal > 0 && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-white/60">
                <Clock size={11} /> {stats.terjadwal} terjadwal
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300 dark:text-white/20 gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 dark:border-white/10 border-t-[#007AFF] rounded-full animate-spin" />
          <p className="text-[12px]">Memuat data absensi…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300 dark:text-white/20">
          <ClipboardList size={36} strokeWidth={1.2} />
          <p className="text-[13px] mt-3 font-medium">Tidak ada data absensi</p>
          {statusFilter && (
            <p className="text-[11px] mt-1 text-gray-400 dark:text-white/25">
              Filter: {STATUS_CONFIG[statusFilter]?.label ?? statusFilter}
            </p>
          )}
          {search && (
            <button onClick={() => setSearch('')} className="mt-3 text-[11px] text-[#007AFF] hover:underline">
              Hapus pencarian
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 overflow-x-auto overflow-hidden">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-black/[0.05] dark:border-white/[0.07]">
                  {[
                    ...(viewMode === 'monthly' ? ['Tanggal'] : []),
                    'Karyawan', 'Departemen', 'Check-in', 'Check-out', 'Terlambat', 'Lembur',
                    ...(viewMode === 'daily' ? ['GPS'] : ['Metode']),
                    'Status', '',
                  ].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/35 bg-white dark:bg-[#1C1C1E]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-black/[0.04] dark:border-white/[0.04] hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors last:border-0">
                    {viewMode === 'monthly' && (
                      <td className="px-4 py-3 text-[11px] text-gray-500 dark:text-white/40 whitespace-nowrap">
                        {fmtDate(r.date)}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={r.user?.full_name} avatarUrl={r.user?.avatar_url} size="sm" />
                        <div>
                          <p className="text-[12px] font-medium text-gray-800 dark:text-white">{r.user?.full_name ?? '—'}</p>
                          {r.user?.employee_id && <p className="text-[10px] text-gray-400 dark:text-white/30">{r.user.employee_id}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-gray-500 dark:text-white/40">
                      {r.user?.department?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'terjadwal' && !r.check_in_at ? (
                        <p className="text-[11px] text-slate-500 dark:text-white/50">Terjadwal <span className="font-mono font-semibold">{fmtShiftTime(r.shift_start)}</span></p>
                      ) : (
                        <>
                          <p className="text-[12px] font-mono text-gray-700 dark:text-white/80">{toWITA(r.check_in_at)}</p>
                          {r.check_in_method && (
                            <p className="text-[9px] text-gray-400 dark:text-white/30 mt-0.5">{METHOD_LABEL[r.check_in_method] ?? r.check_in_method}</p>
                          )}
                          <CheckInLocation r={r} />
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[12px] font-mono text-gray-700 dark:text-white/80">{toWITA(r.check_out_at)}</p>
                      {r.check_out_method && (
                        <p className="text-[9px] text-gray-400 dark:text-white/30 mt-0.5">{METHOD_LABEL[r.check_out_method] ?? r.check_out_method}</p>
                      )}
                      {r.check_out_at && <div className="mt-1"><GpsBadge valid={r.check_out_gps_valid ?? null} /></div>}
                    </td>
                    <td className="px-4 py-3">
                      {r.late_minutes > 0
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full"><Timer size={9}/>{r.late_minutes}m</span>
                        : <span className="text-gray-300 dark:text-white/20 text-[11px]">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {r.overtime_minutes > 0
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full"><TrendingUp size={9}/>{r.overtime_minutes}m</span>
                        : <span className="text-gray-300 dark:text-white/20 text-[11px]">—</span>
                      }
                    </td>
                    {viewMode === 'daily'
                      ? <td className="px-4 py-3"><GpsBadge valid={r.gps_valid} /></td>
                      : <td className="px-4 py-3 text-[11px] text-gray-400 dark:text-white/35 capitalize">{r.check_in_method ? (METHOD_LABEL[r.check_in_method] ?? r.check_in_method) : '—'}</td>
                    }
                    <td className="px-4 py-3"><StatusBadge status={displayStatus(r)} /></td>
                    <td className="px-2 py-3">
                      <button onClick={() => setCorrectModal(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold text-[#007AFF] hover:bg-[#007AFF]/10 transition-colors">
                        <Pencil size={10} /> Koreksi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="md:hidden space-y-2.5">
            {filtered.map((r) => (
              <RecordCard key={r.id} r={r} showDate={viewMode === 'monthly'} onCorrect={() => setCorrectModal(r)} />
            ))}
          </div>
        </>
      )}

      {/* ── Legend ───────────────────────────────────────────────── */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-3 pb-2">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                statusFilter === key
                  ? `${cfg.bg} ${cfg.text} ${cfg.border}`
                  : 'bg-transparent border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/35 hover:border-gray-300'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </button>
          ))}
        </div>
      )}
      </>)}

      {/* ── Modal Koreksi Absensi ─────────────────────────────────── */}
      {correctModal && (
        <CorrectAttendanceModal
          record={correctModal}
          onClose={() => setCorrectModal(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['admin-attendance'] });
            toast.success('Data absensi berhasil dikoreksi');
          }}
        />
      )}
    </div>
  );
}
