'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Briefcase, Clock, CheckCircle2, XCircle, Plus,
  MapPin, Calendar, Wallet, X, Check, ChevronRight,
  ExternalLink, Send,
  Receipt, Download, CreditCard, BarChart3,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

// ── Types ─────────────────────────────────────────────────────────────────────
type TripStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'ongoing' | 'completed' | 'cancelled';

interface BusinessTrip {
  id: string;
  trip_number: string;
  user_id: string;
  user: { id: string; name: string; employee_id: string };
  approver: { name: string } | null;
  destination: string;
  purpose: string;
  depart_date: string;
  return_date: string;
  status: TripStatus;
  transport_mode: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  advance_amount: number | null;
  doc_url: string | null;
  rejection_reason: string | null;
  notes: string | null;
  approved_at: string | null;
  created_at: string;
}

type Claim = {
  id: string;
  claim_number: string | null;
  category: string;
  amount: number;
  description: string | null;
  receipt_urls: string[];
  status: 'pending' | 'approved' | 'rejected' | 'paid';
  review_note: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
  created_at: string;
  visit_id: string | null;
  user: { full_name: string; id: string };
};

type PayrollRow = {
  full_name: string;
  department: string;
  transport: number; parkir: number; material: number;
  konsumsi: number; akomodasi: number; lainnya: number;
  total: number;
};

type ClaimTab = 'all' | 'pending' | 'approved' | 'paid' | 'payroll';
type MainTab  = 'trips' | 'claims';

// ── Config ────────────────────────────────────────────────────────────────────
const TRIP_STATUS: Record<TripStatus, { label: string; bg: string; text: string; dot: string; ring: string }> = {
  draft:            { label: 'Draft',       bg: 'bg-gray-100 dark:bg-white/[0.08]',                      text: 'text-gray-500 dark:text-white/40',   dot: 'bg-gray-300',    ring: 'border-gray-200 dark:border-white/20'      },
  pending_approval: { label: 'Menunggu',    bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)]',           text: 'text-[#FF9500] dark:text-[#FF9F0A]', dot: 'bg-[#FF9500]',   ring: 'border-[#FF9500]/30'                       },
  approved:         { label: 'Disetujui',   bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]',           text: 'text-[#007AFF] dark:text-[#0A84FF]', dot: 'bg-[#007AFF]',   ring: 'border-[#007AFF]/30'                       },
  rejected:         { label: 'Ditolak',     bg: 'bg-[#FFF1F2] dark:bg-[rgba(255,59,48,0.15)]',           text: 'text-[#FF3B30] dark:text-[#FF453A]', dot: 'bg-[#FF3B30]',   ring: 'border-[#FF3B30]/30'                       },
  ongoing:          { label: 'Berlangsung', bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]',           text: 'text-[#34C759] dark:text-[#30D158]', dot: 'bg-[#34C759]',   ring: 'border-[#34C759]/30'                       },
  completed:        { label: 'Selesai',     bg: 'bg-[#F5F3FF] dark:bg-[rgba(175,82,222,0.15)]',          text: 'text-[#AF52DE] dark:text-[#BF5AF2]', dot: 'bg-[#AF52DE]',   ring: 'border-[#AF52DE]/30'                       },
  cancelled:        { label: 'Dibatalkan',  bg: 'bg-gray-100 dark:bg-white/[0.08]',                      text: 'text-gray-400 dark:text-white/30',   dot: 'bg-gray-300',    ring: 'border-gray-200 dark:border-white/20'      },
};

const CLAIM_STATUS: Record<string, { label: string; bg: string; text: string; dot: string; ring: string }> = {
  pending:  { label: 'Pending',   bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)]',  text: 'text-[#FF9500] dark:text-[#FF9F0A]', dot: 'bg-[#FF9500]', ring: 'border-[#FF9500]/30' },
  approved: { label: 'Disetujui', bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]',  text: 'text-[#34C759] dark:text-[#30D158]', dot: 'bg-[#34C759]', ring: 'border-[#34C759]/30' },
  rejected: { label: 'Ditolak',   bg: 'bg-[#FFF1F2] dark:bg-[rgba(255,59,48,0.15)]',  text: 'text-[#FF3B30] dark:text-[#FF453A]', dot: 'bg-[#FF3B30]', ring: 'border-[#FF3B30]/30' },
  paid:     { label: 'Dibayar',   bg: 'bg-[#F5F3FF] dark:bg-[rgba(175,82,222,0.15)]', text: 'text-[#AF52DE] dark:text-[#BF5AF2]', dot: 'bg-[#AF52DE]', ring: 'border-[#AF52DE]/30' },
};

const CATEGORY_MAP: Record<string, { label: string; bg: string; text: string }> = {
  transport: { label: 'Transport', bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]',  text: 'text-[#007AFF] dark:text-[#0A84FF]' },
  parkir:    { label: 'Parkir',    bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]',  text: 'text-[#34C759] dark:text-[#30D158]' },
  material:  { label: 'Material',  bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)]',  text: 'text-[#FF9500] dark:text-[#FF9F0A]' },
  konsumsi:  { label: 'Konsumsi',  bg: 'bg-[#FAF5FF] dark:bg-[rgba(175,82,222,0.15)]', text: 'text-[#AF52DE] dark:text-[#BF5AF2]' },
  akomodasi: { label: 'Akomodasi', bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.12)]',  text: 'text-[#FF9500] dark:text-[#FF9F0A]' },
  lainnya:   { label: 'Lainnya',   bg: 'bg-gray-100 dark:bg-white/[0.08]',              text: 'text-gray-600 dark:text-white/50'   },
};

const PAYROLL_COLS = ['transport', 'parkir', 'material', 'konsumsi', 'akomodasi', 'lainnya'] as const;

const TRIP_FORM_EMPTY = {
  destination: '', purpose: '', depart_date: '', return_date: '',
  transport_mode: '', estimated_cost: '', advance_amount: '', notes: '',
};

const inputCls = 'w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' });
}
function fmtCurrency(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}
function fmtAmount(n: number) {
  return `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`;
}
function initials(name: string) {
  return (name ?? '').split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Shared Sub-components ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string | number; color: string; bg: string;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${bg} mb-3`}>
        <Icon size={18} strokeWidth={1.8} className={color} />
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
      <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, label, sub }: { icon: React.ElementType; label: string; sub?: string }) {
  return (
    <div className="text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
        <Icon size={28} className="text-gray-300 dark:text-white/20" />
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-white/40">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-white/25 mt-1">{sub}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Trip Sub-components ───────────────────────────────────────────────────────
function TripStatusBadge({ status }: { status: TripStatus }) {
  const s = TRIP_STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function TripCard({ trip, onClick, onApprove, onReject }: {
  trip: BusinessTrip; onClick: () => void; onApprove: () => void; onReject: () => void;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-xs font-bold flex-shrink-0">
            {initials(trip.user?.name ?? 'U')}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">{trip.user?.name ?? '—'}</p>
            <p className="text-[11px] text-gray-400 dark:text-white/30 font-mono">{trip.trip_number}</p>
          </div>
        </div>
        <TripStatusBadge status={trip.status} />
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <MapPin size={12} className="text-gray-400 flex-shrink-0" />
        <p className="text-sm text-gray-700 dark:text-white/80 font-medium truncate">{trip.destination}</p>
      </div>
      <div className="flex items-center gap-1.5 mb-3">
        <Calendar size={12} className="text-gray-400 flex-shrink-0" />
        <p className="text-xs text-gray-500 dark:text-white/50">{fmtDate(trip.depart_date)} – {fmtDate(trip.return_date)}</p>
      </div>
      {trip.estimated_cost && (
        <div className="flex items-center gap-1.5 mb-3">
          <Wallet size={12} className="text-gray-400 flex-shrink-0" />
          <p className="text-xs text-gray-500 dark:text-white/50">{fmtCurrency(trip.estimated_cost)}</p>
        </div>
      )}
      <div className="flex gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.05]">
        <button onClick={onClick}
          className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 dark:bg-white/[0.08] hover:bg-gray-200 dark:hover:bg-white/[0.12] text-gray-700 dark:text-white/70 rounded-xl text-xs font-semibold transition">
          Detail <ChevronRight size={12} />
        </button>
        {trip.status === 'pending_approval' && (
          <>
            <button onClick={onApprove}
              className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#34C759] hover:bg-[#2AAD4F] text-white rounded-xl text-xs font-semibold transition">
              <Check size={12} /> Setujui
            </button>
            <button onClick={onReject}
              className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#9F1239] border border-[#FECACA] rounded-xl text-xs font-semibold transition">
              <X size={12} /> Tolak
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Claim Sub-components ──────────────────────────────────────────────────────
function ClaimStatusBadge({ status }: { status: string }) {
  const s = CLAIM_STATUS[status] ?? CLAIM_STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const c = CATEGORY_MAP[category] ?? { label: category, bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>{c.label}</span>
  );
}

function ClaimCard({ c, onDetail, onApprove, onPaid }: {
  c: Claim; onDetail: () => void; onApprove: () => void; onPaid: () => void;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#AF52DE]/10 flex items-center justify-center text-[#AF52DE] text-xs font-bold flex-shrink-0">
            {initials(c.user?.full_name ?? 'U')}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">{c.user?.full_name ?? '—'}</p>
            {c.claim_number && (
              <span className="font-mono text-[11px] text-[#007AFF] bg-[#EFF6FF] px-1.5 py-0.5 rounded mt-0.5 inline-block">
                {c.claim_number}
              </span>
            )}
          </div>
        </div>
        <ClaimStatusBadge status={c.status} />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <CategoryBadge category={c.category} />
        <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-50 dark:bg-white/[0.04] px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/[0.08]">
          <Calendar size={10} />
          {new Date(c.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
        </span>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white mb-1">{fmtAmount(c.amount)}</p>
      {c.description && <p className="text-xs text-gray-400 dark:text-white/30 line-clamp-1 mb-3">{c.description}</p>}
      <div className="flex gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.05]">
        <button onClick={onDetail}
          className="flex-1 py-2 bg-gray-100 dark:bg-white/[0.06] hover:bg-gray-200 dark:hover:bg-white/[0.10] text-gray-700 dark:text-white/70 rounded-xl text-xs font-semibold transition">
          Detail
        </button>
        {c.status === 'pending' && (
          <button onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#34C759] hover:bg-[#2AAD4F] text-white rounded-xl text-xs font-semibold transition">
            <Check size={12} /> Setujui
          </button>
        )}
        {c.status === 'approved' && (
          <button onClick={onPaid}
            className="flex-1 flex items-center justify-center gap-1 py-2 bg-[#AF52DE] hover:bg-[#9B41CA] text-white rounded-xl text-xs font-semibold transition">
            <CreditCard size={12} /> Bayar
          </button>
        )}
      </div>
    </div>
  );
}

function PayrollSection({ rows }: { rows: PayrollRow[] }) {
  if (!rows.length) return (
    <EmptyState icon={BarChart3} label="Tidak ada data payroll" sub="Data rekap akan muncul setelah ada klaim yang disetujui" />
  );
  const totals = PAYROLL_COLS.reduce((acc, col) => {
    acc[col] = rows.reduce((s, r) => s + Number(r[col] ?? 0), 0);
    return acc;
  }, {} as Record<string, number>);
  const grandTotal = rows.reduce((s, r) => s + Number(r.total ?? 0), 0);
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
      <table className="w-full text-sm min-w-[700px]">
        <thead>
          <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">Karyawan</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">Dept</th>
            {PAYROLL_COLS.map((c) => (
              <th key={c} className="text-right px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide capitalize">{c}</th>
            ))}
            <th className="text-right px-4 py-3 text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.full_name}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-white/50">{r.department ?? '—'}</td>
              {PAYROLL_COLS.map((c) => (
                <td key={c} className="px-4 py-3 text-right text-gray-600 dark:text-white/60 text-xs">
                  {r[c] ? `Rp ${Number(r[c]).toLocaleString('id-ID')}` : '—'}
                </td>
              ))}
              <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                Rp {Number(r.total ?? 0).toLocaleString('id-ID')}
              </td>
            </tr>
          ))}
          <tr className="bg-gray-50 dark:bg-white/[0.04] border-t-2 border-black/[0.08] dark:border-white/[0.12]">
            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white" colSpan={2}>TOTAL</td>
            {PAYROLL_COLS.map((c) => (
              <td key={c} className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-white/70">
                Rp {totals[c].toLocaleString('id-ID')}
              </td>
            ))}
            <td className="px-4 py-3 text-right font-bold text-[#007AFF]">
              Rp {grandTotal.toLocaleString('id-ID')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Surat Tugas Section ───────────────────────────────────────────────────────
function SuratTugasSection() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<BusinessTrip | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [form, setForm] = useState(TRIP_FORM_EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: ['business-trips', filterStatus],
    queryFn: () =>
      apiClient.get('/business-trips', {
        params: { limit: '50', ...(filterStatus ? { status: filterStatus } : {}) },
      }).then((r) => r.data),
  });
  const trips: BusinessTrip[] = data?.items ?? [];
  const total: number = data?.total ?? 0;

  const createMut = useMutation({
    mutationFn: (body: typeof TRIP_FORM_EMPTY) =>
      apiClient.post('/business-trips', {
        ...body,
        estimated_cost: body.estimated_cost ? +body.estimated_cost : undefined,
        advance_amount: body.advance_amount ? +body.advance_amount : undefined,
        transport_mode: body.transport_mode || undefined,
        notes: body.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-trips'] });
      setShowCreate(false);
      setForm(TRIP_FORM_EMPTY);
      toast.success('Surat tugas berhasil dibuat');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal membuat surat tugas')),
  });

  const actionMut = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: object }) =>
      apiClient.post(`/business-trips/${id}/${action}`, body ?? {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-trips'] });
      setSelected(null);
      setShowRejectModal(false);
      setRejectReason('');
      toast.success('Berhasil');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal melakukan aksi')),
  });

  const pendingCount   = trips.filter((t) => t.status === 'pending_approval').length;
  const approvedCount  = trips.filter((t) => t.status === 'approved' || t.status === 'ongoing').length;
  const completedCount = trips.filter((t) => t.status === 'completed').length;
  const rejectedCount  = trips.filter((t) => t.status === 'rejected').length;

  const TRIP_FILTERS = [
    { value: '', label: 'Semua' },
    { value: 'pending_approval', label: 'Menunggu' },
    { value: 'approved', label: 'Disetujui' },
    { value: 'ongoing', label: 'Berlangsung' },
    { value: 'completed', label: 'Selesai' },
    { value: 'rejected', label: 'Ditolak' },
  ];

  return (
    <>
      {/* Sub-header */}
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-white/50">{total} total surat tugas</p>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0063CC] text-white rounded-xl text-sm font-semibold transition">
          <Plus size={15} /> Buat Surat Tugas
        </button>
      </div>

      {/* StatCards */}
      <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Briefcase}    label="Menunggu"  value={pendingCount}   color="text-[#FF9500]"  bg="bg-[#FF9500]/10" />
        <StatCard icon={CheckCircle2} label="Disetujui" value={approvedCount}  color="text-[#007AFF]"  bg="bg-[#007AFF]/10" />
        <StatCard icon={Briefcase}    label="Selesai"   value={completedCount} color="text-[#AF52DE]"  bg="bg-[#AF52DE]/10" />
        <StatCard icon={XCircle}      label="Ditolak"   value={rejectedCount}  color="text-[#FF3B30]"  bg="bg-[#FF3B30]/10" />
      </div>

      {/* Filter chips */}
      <div className="px-4 sm:px-6 mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1.5 w-max">
          {TRIP_FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilterStatus(f.value)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                filterStatus === f.value
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'bg-white dark:bg-white/[0.06] text-gray-500 dark:text-white/40 border border-black/[0.05] dark:border-white/[0.08] hover:text-gray-700 dark:hover:text-white/70'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 pb-8">
        {isLoading ? <Spinner /> : trips.length === 0 ? (
          <EmptyState icon={Briefcase} label="Tidak ada surat tugas" sub='Klik "Buat Surat Tugas" untuk membuat baru' />
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip}
                  onClick={() => setSelected(trip)}
                  onApprove={() => actionMut.mutate({ id: trip.id, action: 'approve' })}
                  onReject={() => { setSelected(trip); setShowRejectModal(true); }}
                />
              ))}
            </div>
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                    {['No. ST', 'Karyawan', 'Tujuan', 'Tanggal', 'Est. Biaya', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {trips.map((trip) => (
                    <tr key={trip.id}
                      className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer transition-colors"
                      onClick={() => setSelected(trip)}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-[#007AFF] bg-[#EFF6FF] px-2 py-1 rounded-xl">{trip.trip_number}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-[11px] font-bold flex-shrink-0">
                            {initials(trip.user?.name ?? 'U')}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{trip.user?.name}</p>
                            <p className="text-[11px] text-gray-400 dark:text-white/30">{trip.user?.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-white/80 max-w-[160px] truncate">{trip.destination}</td>
                      <td className="px-4 py-3 text-gray-400 dark:text-white/30 text-xs">
                        {fmtDate(trip.depart_date)} – {fmtDate(trip.return_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-white/60 text-sm">
                        {trip.estimated_cost ? fmtCurrency(trip.estimated_cost) : '—'}
                      </td>
                      <td className="px-4 py-3"><TripStatusBadge status={trip.status} /></td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {trip.status === 'pending_approval' && (
                          <div className="flex gap-1.5">
                            <button onClick={() => actionMut.mutate({ id: trip.id, action: 'approve' })}
                              disabled={actionMut.isPending}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#34C759] hover:bg-[#2AAD4F] disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition">
                              <Check size={12} /> Setujui
                            </button>
                            <button onClick={() => { setSelected(trip); setShowRejectModal(true); }}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#9F1239] border border-[#FECACA] rounded-xl text-xs font-semibold transition">
                              <X size={12} /> Tolak
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selected && !showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-sm font-bold">
                  {initials(selected.user?.name ?? 'U')}
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{selected.user?.name ?? '—'}</p>
                  <p className="font-mono text-xs text-gray-400 dark:text-white/30">{selected.trip_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TripStatusBadge status={selected.status} />
                <button onClick={() => setSelected(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Tujuan',       value: selected.destination },
                  { label: 'Transportasi', value: selected.transport_mode ?? '—' },
                  { label: 'Tgl Pergi',    value: fmtDate(selected.depart_date) },
                  { label: 'Tgl Kembali',  value: fmtDate(selected.return_date) },
                  { label: 'Est. Biaya',   value: selected.estimated_cost ? fmtCurrency(selected.estimated_cost) : '—' },
                  { label: 'Uang Muka',    value: selected.advance_amount ? fmtCurrency(selected.advance_amount) : '—' },
                  { label: 'Biaya Aktual', value: selected.actual_cost ? fmtCurrency(selected.actual_cost) : '—' },
                  { label: 'Disetujui',    value: selected.approved_at ? fmtDate(selected.approved_at) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                    <p className="text-[11px] text-gray-400 dark:text-white/30 mb-1">{label}</p>
                    <p className="text-xs font-medium text-gray-700 dark:text-white/80">{value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                <p className="text-[11px] text-gray-400 dark:text-white/30 mb-1">Tujuan Penugasan</p>
                <p className="text-xs text-gray-700 dark:text-white/80 leading-relaxed">{selected.purpose}</p>
              </div>
              {selected.notes && (
                <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 dark:text-white/30 mb-1">Catatan</p>
                  <p className="text-xs text-gray-700 dark:text-white/80">{selected.notes}</p>
                </div>
              )}
              {selected.rejection_reason && (
                <div className="bg-[#FFF1F2] dark:bg-[#FF3B30]/10 border border-[#FECACA] dark:border-[#FF3B30]/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-[#9F1239] dark:text-[#FF3B30]/80 mb-1">Alasan Penolakan</p>
                  <p className="text-xs text-[#9F1239] dark:text-[#FF3B30]/70">{selected.rejection_reason}</p>
                </div>
              )}
              {selected.doc_url && (
                <a href={selected.doc_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full h-10 border border-[#007AFF] text-[#007AFF] rounded-xl text-sm font-semibold hover:bg-[#EFF6FF] transition">
                  <ExternalLink size={14} /> Lihat Dokumen
                </a>
              )}
              <div className="flex gap-2 pt-2">
                {selected.status === 'pending_approval' && (
                  <>
                    <button onClick={() => actionMut.mutate({ id: selected.id, action: 'approve' })}
                      disabled={actionMut.isPending}
                      className="flex-1 flex items-center justify-center gap-1.5 h-11 bg-[#34C759] hover:bg-[#2AAD4F] disabled:opacity-50 text-white font-semibold rounded-2xl transition">
                      <Check size={15} /> Setujui
                    </button>
                    <button onClick={() => setShowRejectModal(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-11 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#9F1239] border border-[#FECACA] font-semibold rounded-2xl transition">
                      <X size={15} /> Tolak
                    </button>
                  </>
                )}
                {selected.status === 'draft' && (
                  <button onClick={() => actionMut.mutate({ id: selected.id, action: 'submit' })}
                    disabled={actionMut.isPending}
                    className="flex-1 flex items-center justify-center gap-2 h-11 bg-[#007AFF] hover:bg-[#0063CC] text-white font-semibold rounded-2xl transition">
                    <Send size={14} /> Ajukan Persetujuan
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selected && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Tolak Surat Tugas</h3>
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
                <X size={16} />
              </button>
            </div>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan (opsional)" rows={3}
              className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#FF3B30] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                className="flex-1 h-10 rounded-xl border border-black/10 dark:border-white/[0.12] text-sm font-medium text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                Batal
              </button>
              <button onClick={() => actionMut.mutate({ id: selected.id, action: 'reject', body: { reason: rejectReason } })}
                disabled={actionMut.isPending || !rejectReason.trim()}
                className="flex-1 h-10 rounded-xl bg-[#FF3B30] hover:bg-[#D63529] disabled:opacity-50 text-white text-sm font-semibold transition">
                {actionMut.isPending ? 'Menolak...' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#007AFF]/10 flex items-center justify-center">
                  <Briefcase size={18} className="text-[#007AFF]" />
                </div>
                <h2 className="font-bold text-gray-900 dark:text-white">Buat Surat Tugas Baru</h2>
              </div>
              <button onClick={() => setShowCreate(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {[
                { label: 'Tujuan / Kota', key: 'destination', placeholder: 'Contoh: Makassar, Sulawesi Selatan' },
                { label: 'Tujuan Penugasan', key: 'purpose', placeholder: 'Deskripsi tugas yang dikerjakan' },
              ].map((f) => (
                <div key={f.key}>
                  <label className={labelCls}>{f.label}</label>
                  <input value={(form as any)[f.key]}
                    onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className={inputCls} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tgl Berangkat</label>
                  <input type="date" value={form.depart_date}
                    onChange={(e) => setForm((p) => ({ ...p, depart_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Tgl Kembali</label>
                  <input type="date" value={form.return_date}
                    onChange={(e) => setForm((p) => ({ ...p, return_date: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Moda Transportasi</label>
                <input value={form.transport_mode}
                  onChange={(e) => setForm((p) => ({ ...p, transport_mode: e.target.value }))}
                  placeholder="Pesawat, Kapal, Darat, dll." className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Est. Biaya (Rp)</label>
                  <input type="number" value={form.estimated_cost}
                    onChange={(e) => setForm((p) => ({ ...p, estimated_cost: e.target.value }))}
                    placeholder="0" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Uang Muka (Rp)</label>
                  <input type="number" value={form.advance_amount}
                    onChange={(e) => setForm((p) => ({ ...p, advance_amount: e.target.value }))}
                    placeholder="0" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Catatan</label>
                <textarea value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Catatan tambahan (opsional)" rows={2}
                  className={`${inputCls} resize-none`} />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 h-11 rounded-2xl border border-black/10 dark:border-white/[0.12] text-sm font-medium text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                  Batal
                </button>
                <button onClick={() => createMut.mutate(form)} disabled={createMut.isPending}
                  className="flex-1 h-11 rounded-2xl bg-[#007AFF] hover:bg-[#0063CC] text-white text-sm font-semibold transition disabled:opacity-50">
                  Simpan sebagai Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Klaim Biaya Section ───────────────────────────────────────────────────────
function KlaimBiayaSection() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<ClaimTab>('all');
  const [month, setMonth] = useState(currentMonth());
  const [detail, setDetail] = useState<Claim | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  const { data: claims = [], isLoading } = useQuery<Claim[]>({
    queryKey: ['expense-claims', tab, month],
    queryFn: () =>
      apiClient.get(`/expense-claims${tab !== 'payroll' && tab !== 'all' ? `?status=${tab}` : ''}&month=${month}`
        .replace('?&', '?'))
        .then((r) => r.data),
    enabled: tab !== 'payroll',
  });

  const { data: payroll = [] } = useQuery<PayrollRow[]>({
    queryKey: ['payroll', month],
    queryFn: () => apiClient.get(`/expense-claims/payroll?month=${month}`).then((r) => r.data),
    enabled: tab === 'payroll',
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: string; note?: string }) =>
      apiClient.post(`/expense-claims/${id}/review`, { action, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-claims'] });
      setDetail(null);
      setShowReject(false);
      setRejectNote('');
    },
  });

  const downloadPayroll = () => {
    apiClient.get(`/expense-claims/payroll/export?month=${month}`, { responseType: 'blob' }).then((r) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([r.data]));
      a.download = `payroll-klaim-${month}.xlsx`;
      a.click();
    });
  };

  const pendingCount  = claims.filter((c) => c.status === 'pending').length;
  const totalApproved = claims.filter((c) => ['approved', 'paid'].includes(c.status)).reduce((s, c) => s + c.amount, 0);
  const totalMonth    = claims.reduce((s, c) => s + c.amount, 0);

  const CLAIM_TABS: { key: ClaimTab; label: string; Icon: React.ElementType; count?: number }[] = [
    { key: 'all',      label: 'Semua',         Icon: Receipt      },
    { key: 'pending',  label: 'Pending',       Icon: Clock,       count: pendingCount },
    { key: 'approved', label: 'Disetujui',     Icon: CheckCircle2 },
    { key: 'paid',     label: 'Dibayar',       Icon: CreditCard   },
    { key: 'payroll',  label: 'Rekap Payroll', Icon: BarChart3    },
  ];

  return (
    <>
      {/* Sub-header */}
      <div className="px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-white/[0.06] rounded-xl border border-black/[0.05] dark:border-white/[0.08]">
          <Calendar size={14} className="text-gray-400 flex-shrink-0" />
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="bg-transparent text-sm text-gray-700 dark:text-white/80 outline-none" />
        </div>
        {tab === 'payroll' && (
          <button onClick={downloadPayroll}
            className="flex items-center gap-2 px-4 py-2 bg-[#34C759] hover:bg-[#2AAD4F] text-white rounded-xl text-sm font-semibold transition">
            <Download size={15} /> Export Excel
          </button>
        )}
      </div>

      {/* StatCards */}
      {tab !== 'payroll' && (
        <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard icon={Receipt}      label="Total Klaim"     value={claims.length}       color="text-[#007AFF]"  bg="bg-[#007AFF]/10" />
          <StatCard icon={Clock}        label="Pending Review"  value={pendingCount}         color="text-[#FF9500]"  bg="bg-[#FF9500]/10" />
          <StatCard icon={CheckCircle2} label="Total Disetujui" value={fmtAmount(totalApproved)} color="text-[#34C759]"  bg="bg-[#34C759]/10" />
          <StatCard icon={Wallet}       label="Total Bulan Ini" value={fmtAmount(totalMonth)}    color="text-[#AF52DE]"  bg="bg-[#AF52DE]/10" />
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 sm:px-6 mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1.5 w-max">
          {CLAIM_TABS.map(({ key, label, Icon, count }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                tab === key
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'bg-white dark:bg-white/[0.06] text-gray-500 dark:text-white/40 border border-black/[0.05] dark:border-white/[0.08] hover:text-gray-700 dark:hover:text-white/70'
              }`}>
              <Icon size={14} />
              {label}
              {count !== undefined && count > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === key ? 'bg-white/20 text-white' : 'bg-[#FF9500]/15 text-[#FF9500]'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 pb-8">
        {tab === 'payroll' ? (
          <PayrollSection rows={payroll} />
        ) : isLoading ? (
          <Spinner />
        ) : claims.length === 0 ? (
          <EmptyState icon={Receipt} label="Tidak ada klaim" sub="Klaim biaya akan muncul di sini" />
        ) : (
          <>
            <div className="md:hidden space-y-3">
              {claims.map((c) => (
                <ClaimCard key={c.id} c={c}
                  onDetail={() => { setDetail(c); setShowReject(false); setRejectNote(''); }}
                  onApprove={() => reviewMut.mutate({ id: c.id, action: 'approve' })}
                  onPaid={() => reviewMut.mutate({ id: c.id, action: 'paid' })}
                />
              ))}
            </div>
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                    {['No Klaim', 'Karyawan', 'Tanggal', 'Kategori', 'Nominal', 'Status', 'Aksi'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claims.map((c) => (
                    <tr key={c.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-bold text-[#007AFF] bg-[#EFF6FF] px-2 py-1 rounded-xl">
                          {c.claim_number ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#AF52DE]/10 flex items-center justify-center text-[#AF52DE] text-[11px] font-bold flex-shrink-0">
                            {initials(c.user?.full_name ?? 'U')}
                          </div>
                          <span className="font-medium text-gray-900 dark:text-white">{c.user?.full_name ?? '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 dark:text-white/30 text-xs">
                        {new Date(c.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Makassar' })}
                      </td>
                      <td className="px-4 py-3"><CategoryBadge category={c.category} /></td>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">{fmtAmount(c.amount)}</td>
                      <td className="px-4 py-3"><ClaimStatusBadge status={c.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => { setDetail(c); setShowReject(false); setRejectNote(''); }}
                            className="px-3 py-1.5 bg-gray-100 dark:bg-white/[0.08] hover:bg-gray-200 dark:hover:bg-white/[0.12] text-gray-700 dark:text-white/70 rounded-xl text-xs font-semibold transition">
                            Detail
                          </button>
                          {c.status === 'pending' && (
                            <>
                              <button onClick={() => reviewMut.mutate({ id: c.id, action: 'approve' })}
                                disabled={reviewMut.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#34C759] hover:bg-[#2AAD4F] disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition">
                                <Check size={12} /> Setujui
                              </button>
                              <button onClick={() => { setDetail(c); setShowReject(true); setRejectNote(''); }}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#9F1239] border border-[#FECACA] rounded-xl text-xs font-semibold transition">
                                <X size={12} /> Tolak
                              </button>
                            </>
                          )}
                          {c.status === 'approved' && (
                            <button onClick={() => reviewMut.mutate({ id: c.id, action: 'paid' })}
                              className="flex items-center gap-1 px-3 py-1.5 bg-[#AF52DE] hover:bg-[#9B41CA] text-white rounded-xl text-xs font-semibold transition">
                              <CreditCard size={12} /> Bayar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] flex-shrink-0">
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{detail.claim_number ?? 'Detail Klaim'}</p>
                <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{detail.user?.full_name ?? '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                <ClaimStatusBadge status={detail.status} />
                <button onClick={() => { setDetail(null); setShowReject(false); setRejectNote(''); }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: 'Kategori',    value: <CategoryBadge category={detail.category} /> },
                  { label: 'Nominal',     value: <span className="text-sm font-bold text-gray-900 dark:text-white">{fmtAmount(detail.amount)}</span> },
                  { label: 'Tanggal',     value: new Date(detail.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' }) },
                  { label: 'Terkait Visit', value: detail.visit_id ? 'Ya' : 'Tidak' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                    <p className="text-[11px] text-gray-400 dark:text-white/30 mb-1">{label}</p>
                    {typeof value === 'string'
                      ? <p className="text-sm font-medium text-gray-700 dark:text-white/80">{value}</p>
                      : value}
                  </div>
                ))}
              </div>
              {detail.description && (
                <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 dark:text-white/30 mb-1">Keterangan</p>
                  <p className="text-sm text-gray-700 dark:text-white/80">{detail.description}</p>
                </div>
              )}
              {detail.review_note && (
                <div className="bg-[#FFF7ED] dark:bg-[#FF9500]/10 border border-[#FF9500]/20 rounded-xl p-3">
                  <p className="text-[11px] text-[#9A3412] dark:text-[#FF9500]/80 mb-1">Catatan Review</p>
                  <p className="text-sm text-[#9A3412] dark:text-[#FF9500]/90">{detail.review_note}</p>
                </div>
              )}
              {detail.receipt_urls.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide mb-2">Foto Nota</p>
                  <div className="flex gap-2 flex-wrap">
                    {detail.receipt_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="group relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="Nota" className="w-20 h-20 object-cover rounded-xl border border-black/[0.08] group-hover:opacity-90 transition" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {detail.status === 'pending' && (
                <div className="space-y-3 pt-2">
                  {showReject && (
                    <textarea placeholder="Alasan penolakan (wajib)..." value={rejectNote}
                      onChange={(e) => setRejectNote(e.target.value)} rows={3}
                      className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#FF3B30] resize-none"
                    />
                  )}
                  <div className="flex gap-2">
                    {!showReject ? (
                      <>
                        <button onClick={() => reviewMut.mutate({ id: detail.id, action: 'approve' })}
                          disabled={reviewMut.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 h-10 bg-[#34C759] hover:bg-[#2AAD4F] text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
                          <Check size={14} /> Setujui
                        </button>
                        <button onClick={() => setShowReject(true)}
                          className="flex-1 flex items-center justify-center gap-1.5 h-10 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#9F1239] border border-[#FECACA] rounded-xl text-sm font-semibold transition">
                          <X size={14} /> Tolak
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setShowReject(false)}
                          className="flex-1 h-10 border border-black/10 dark:border-white/[0.12] text-sm font-medium text-gray-700 dark:text-white/70 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                          Batal
                        </button>
                        <button disabled={!rejectNote.trim() || reviewMut.isPending}
                          onClick={() => reviewMut.mutate({ id: detail.id, action: 'reject', note: rejectNote })}
                          className="flex-1 h-10 bg-[#FF3B30] hover:bg-[#D63529] text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition">
                          Konfirmasi Tolak
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
              {detail.status === 'approved' && (
                <button onClick={() => reviewMut.mutate({ id: detail.id, action: 'paid' })}
                  disabled={reviewMut.isPending}
                  className="w-full flex items-center justify-center gap-2 h-10 bg-[#AF52DE] hover:bg-[#9B41CA] text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
                  <CreditCard size={14} /> Tandai Sudah Dibayar
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KeuanganPage() {
  const [mainTab, setMainTab] = useState<MainTab>('trips');

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">
      {/* Page header */}
      <div className="px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Keuangan</h1>
          <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">Surat tugas dinas &amp; klaim biaya lapangan</p>
        </div>
      </div>

      {/* Main tab switcher */}
      <div className="px-4 sm:px-6 mb-2">
        <div className="flex gap-1 p-1 bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] w-fit">
          <button onClick={() => setMainTab('trips')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              mainTab === 'trips'
                ? 'bg-[#007AFF] text-white shadow-sm'
                : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70'
            }`}>
            <Briefcase size={15} /> Surat Tugas
          </button>
          <button onClick={() => setMainTab('claims')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
              mainTab === 'claims'
                ? 'bg-[#007AFF] text-white shadow-sm'
                : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70'
            }`}>
            <Receipt size={15} /> Klaim Biaya
          </button>
        </div>
      </div>

      {mainTab === 'trips' ? <SuratTugasSection /> : <KlaimBiayaSection />}
    </div>
  );
}
