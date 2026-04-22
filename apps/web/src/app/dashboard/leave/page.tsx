'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Palmtree, Clock, CheckCircle2, XCircle, MessageSquareWarning,
  Users, Calendar, Check, X, ExternalLink, Search, ArrowLeftRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

// ── Types ─────────────────────────────────────────────────────────────────────
interface LeaveRequest {
  id: string;
  user?: { id: string; full_name: string };
  type: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason?: string;
  created_at: string;
}

interface Objection {
  id: string;
  user?: { id: string; full_name: string };
  reason: string;
  evidence_url?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface SwapRequest {
  id: string;
  type: 'with_person' | 'with_own_dayoff';
  status: 'pending_target' | 'pending_admin' | 'approved' | 'rejected' | 'cancelled';
  requester_date: string;
  target_date: string;
  notes?: string;
  reject_reason?: string;
  created_at: string;
  requester?: { id: string; full_name: string };
  target_user?: { id: string; full_name: string } | null;
  requester_shift?: { name: string; start_time: string; end_time: string } | null;
  target_shift?: { name: string; start_time: string; end_time: string } | null;
}

interface BalanceRow {
  user?: { id: string; full_name: string };
  balance_days: number;
  accrued_monthly: number;
  used_days: number;
  year: number;
}

// ── Config ────────────────────────────────────────────────────────────────────
const TYPE_MAP: Record<string, { label: string; bg: string; text: string }> = {
  cuti:  { label: 'Cuti',  bg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]' },
  izin:  { label: 'Izin',  bg: 'bg-[#FAF5FF]', text: 'text-[#6D28D9]' },
  sakit: { label: 'Sakit', bg: 'bg-[#FFF7ED]', text: 'text-[#9A3412]' },
  dinas: { label: 'Dinas', bg: 'bg-[#F0FDF4]', text: 'text-[#166534]' },
};

const STATUS_MAP: Record<string, { label: string; bg: string; text: string; dot: string; ring: string }> = {
  pending:  { label: 'Menunggu',  bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]', dot: 'bg-[#FF9500]', ring: 'border-[#FF9500]/30' },
  approved: { label: 'Disetujui', bg: 'bg-[#F0FDF4]', text: 'text-[#166534]', dot: 'bg-[#34C759]', ring: 'border-[#34C759]/30' },
  rejected: { label: 'Ditolak',   bg: 'bg-[#FFF1F2]', text: 'text-[#9F1239]', dot: 'bg-[#FF3B30]', ring: 'border-[#FF3B30]/30' },
};

const SWAP_STATUS_MAP: Record<string, { label: string; bg: string; text: string; dot: string; ring: string }> = {
  pending_target: { label: 'Menunggu Rekan',  bg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]', dot: 'bg-[#007AFF]', ring: 'border-[#007AFF]/30' },
  pending_admin:  { label: 'Menunggu Admin',  bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]', dot: 'bg-[#FF9500]', ring: 'border-[#FF9500]/30' },
  approved:       { label: 'Disetujui',       bg: 'bg-[#F0FDF4]', text: 'text-[#166534]', dot: 'bg-[#34C759]', ring: 'border-[#34C759]/30' },
  rejected:       { label: 'Ditolak',         bg: 'bg-[#FFF1F2]', text: 'text-[#9F1239]', dot: 'bg-[#FF3B30]', ring: 'border-[#FF3B30]/30' },
  cancelled:      { label: 'Dibatalkan',      bg: 'bg-gray-50 dark:bg-white/[0.04]', text: 'text-gray-400 dark:text-white/30', dot: 'bg-gray-300', ring: 'border-gray-200' },
};

function SwapStatusBadge({ status }: { status: string }) {
  const s = SWAP_STATUS_MAP[status] ?? SWAP_STATUS_MAP.pending_admin;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.bg} ${s.text} ${s.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = TYPE_MAP[type] ?? { label: type, bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${t.bg} ${t.text}`}>{t.label}</span>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: number; color: string; bg: string;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${bg} mb-3`}>
        <Icon size={18} strokeWidth={1.8} className={color} />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">{label}</p>
    </div>
  );
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

// ── Request Card (mobile) ─────────────────────────────────────────────────────
function RequestCard({ req, onApprove, onReject }: {
  req: LeaveRequest; onApprove: () => void; onReject: () => void;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-xs font-bold flex-shrink-0">
            {initials(req.user?.full_name ?? 'U')}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">{req.user?.full_name ?? '—'}</p>
            <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">
              {new Date(req.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
            </p>
          </div>
        </div>
        <StatusBadge status={req.status} />
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <TypeBadge type={req.type} />
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/40 bg-gray-50 dark:bg-white/[0.04] px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/[0.08]">
          <Calendar size={10} />
          {req.start_date} → {req.end_date}
        </span>
        <span className="text-xs text-gray-500 dark:text-white/40 bg-gray-50 dark:bg-white/[0.04] px-2.5 py-1 rounded-full border border-gray-200 dark:border-white/[0.08]">
          {req.total_days} hari
        </span>
      </div>

      {req.reason && (
        <p className="text-xs text-gray-500 dark:text-white/40 mb-3 line-clamp-2">{req.reason}</p>
      )}
      {req.reject_reason && (
        <p className="text-xs text-[#9F1239] bg-[#FFF1F2] px-3 py-2 rounded-xl mb-3">{req.reject_reason}</p>
      )}

      {req.status === 'pending' && (
        <div className="flex gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.05]">
          <button onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#34C759] hover:bg-[#2AAD4F] text-white rounded-xl text-xs font-semibold transition">
            <Check size={13} /> Setujui
          </button>
          <button onClick={onReject}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#9F1239] border border-[#FECACA] rounded-xl text-xs font-semibold transition">
            <X size={13} /> Tolak
          </button>
        </div>
      )}
    </div>
  );
}

// ── Objection Card (mobile) ───────────────────────────────────────────────────
function ObjectionCard({ obj, onApprove, onReject }: {
  obj: Objection; onApprove: () => void; onReject: () => void;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#FF9500]/10 flex items-center justify-center text-[#FF9500] text-xs font-bold flex-shrink-0">
            {initials(obj.user?.full_name ?? 'U')}
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900 dark:text-white">{obj.user?.full_name ?? '—'}</p>
            <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">
              {new Date(obj.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
            </p>
          </div>
        </div>
        <StatusBadge status={obj.status} />
      </div>
      <p className="text-xs text-gray-500 dark:text-white/40 mb-3 line-clamp-3">{obj.reason}</p>
      {obj.evidence_url && (
        <a href={obj.evidence_url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#007AFF] mb-3">
          <ExternalLink size={11} /> Lihat bukti
        </a>
      )}
      {obj.status === 'pending' && (
        <div className="flex gap-2 pt-3 border-t border-black/[0.04] dark:border-white/[0.05]">
          <button onClick={onApprove}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#34C759] hover:bg-[#2AAD4F] text-white rounded-xl text-xs font-semibold transition">
            <Check size={13} /> Setujui
          </button>
          <button onClick={onReject}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#9F1239] border border-[#FECACA] rounded-xl text-xs font-semibold transition">
            <X size={13} /> Tolak
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LeavePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'requests' | 'objections' | 'balances' | 'swaps'>('requests');
  const [searchQ, setSearchQ]         = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Reject leave request
  const [rejectId, setRejectId]       = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Reject objection
  const [rejectObjId, setRejectObjId]       = useState<string | null>(null);
  const [rejectObjReason, setRejectObjReason] = useState('');

  const [rejectSwapId, setRejectSwapId]     = useState<string | null>(null);
  const [rejectSwapReason, setRejectSwapReason] = useState('');

  const { data: requestsData, isLoading: loadingRequests } = useQuery({
    queryKey: ['leave-requests-web'],
    queryFn: () => apiClient.get('/leave/requests', { params: { limit: 50 } })
      .then((r) => r.data as { items: LeaveRequest[]; total: number }),
  });

  const { data: objections = [], isLoading: loadingObj } = useQuery({
    queryKey: ['leave-objections'],
    queryFn: () => apiClient.get('/leave/objections').then((r) => r.data as Objection[]),
    enabled: tab === 'objections',
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/leave/requests/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests-web'] }); toast.success('Pengajuan cuti disetujui'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyetujui pengajuan cuti')),
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/leave/requests/${id}/reject`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-requests-web'] }); setRejectId(null); setRejectReason(''); toast.success('Pengajuan ditolak'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menolak pengajuan cuti')),
  });
  const approveObjMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/leave/objections/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-objections'] }); toast.success('Keberatan disetujui'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyetujui keberatan')),
  });
  const rejectObjMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/leave/objections/${id}/reject`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-objections'] }); setRejectObjId(null); setRejectObjReason(''); toast.success('Keberatan ditolak'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menolak keberatan')),
  });

  const { data: swapsData, isLoading: loadingSwaps } = useQuery({
    queryKey: ['swap-requests-admin'],
    queryFn: () => apiClient.get('/schedule-swap/requests').then((r) => r.data as { items: SwapRequest[]; total: number }),
    enabled: tab === 'swaps',
  });
  const approveSwapMutation = useMutation({
    mutationFn: (id: string) => apiClient.post(`/schedule-swap/requests/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swap-requests-admin'] }); toast.success('Tukar jadwal disetujui'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyetujui tukar jadwal')),
  });
  const rejectSwapMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/schedule-swap/requests/${id}/reject`, { reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['swap-requests-admin'] }); setRejectSwapId(null); setRejectSwapReason(''); toast.success('Tukar jadwal ditolak'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menolak tukar jadwal')),
  });

  const requests     = requestsData?.items ?? [];
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  const filteredRequests = requests.filter((r) => {
    const matchSearch = !searchQ || r.user?.full_name?.toLowerCase().includes(searchQ.toLowerCase());
    const matchStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchSearch && matchStatus;
  });
  const pendingObjCount  = (objections as Objection[]).filter((o) => o.status === 'pending').length;
  const swaps            = swapsData?.items ?? [];
  const pendingSwapCount = swaps.filter((s) => s.status === 'pending_admin').length;

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Cuti & Izin</h1>
        <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">Kelola pengajuan cuti, izin, dan keberatan karyawan</p>
      </div>

      {/* StatCards */}
      <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Palmtree}      label="Total Pengajuan" value={requests.length}  color="text-[#007AFF]"  bg="bg-[#007AFF]/10" />
        <StatCard icon={Clock}         label="Menunggu"        value={pendingCount}     color="text-[#FF9500]"  bg="bg-[#FF9500]/10" />
        <StatCard icon={CheckCircle2}  label="Disetujui"       value={approvedCount}    color="text-[#34C759]"  bg="bg-[#34C759]/10" />
        <StatCard icon={XCircle}       label="Ditolak"         value={rejectedCount}    color="text-[#FF3B30]"  bg="bg-[#FF3B30]/10" />
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 mb-4">
        <div className="flex gap-1.5 bg-white dark:bg-white/[0.06] rounded-2xl p-1.5 border border-black/[0.05] dark:border-white/[0.08] w-fit">
          {([
            { key: 'requests',   label: 'Pengajuan',      count: pendingCount },
            { key: 'objections', label: 'Keberatan',      count: pendingObjCount },
            { key: 'swaps',      label: 'Tukar Jadwal',   count: pendingSwapCount },
            { key: 'balances',   label: 'Saldo Karyawan', count: 0 },
          ] as const).map(({ key, label, count }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === key
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'
              }`}>
              {label}
              {count > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === key ? 'bg-white/20 text-white' : 'bg-[#FF9500]/15 text-[#FF9500]'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-8">

        {/* ── REQUESTS ── */}
        {tab === 'requests' && (
          loadingRequests ? <LoadingSpinner /> : (
            <>
              {/* Filter Bar */}
              <div className="flex flex-wrap gap-2 mb-4 p-3 bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08]">
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                  <Search size={14} className="text-gray-400 flex-shrink-0" />
                  <input
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    placeholder="Cari karyawan…"
                    className="flex-1 text-sm bg-transparent outline-none text-gray-700 dark:text-white placeholder:text-gray-400"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        statusFilter === s
                          ? 'bg-[#007AFF] text-white'
                          : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/15'
                      }`}>
                      {{ all: 'Semua', pending: 'Pending', approved: 'Disetujui', rejected: 'Ditolak' }[s]}
                    </button>
                  ))}
                </div>
              </div>
              {filteredRequests.length === 0 ? (
                <EmptyState icon={Palmtree} label="Tidak ada pengajuan" sub={searchQ || statusFilter !== 'all' ? 'Coba ubah filter pencarian' : 'Pengajuan cuti dan izin akan muncul di sini'} />
              ) : (
              <>
              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {filteredRequests.map((req) => (
                  <RequestCard key={req.id} req={req}
                    onApprove={() => approveMutation.mutate(req.id)}
                    onReject={() => setRejectId(req.id)}
                  />
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
                <table className="w-full text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                      {['Karyawan', 'Jenis', 'Tanggal', 'Hari', 'Status', 'Aksi'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((req) => (
                      <tr key={req.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-[11px] font-bold flex-shrink-0">
                              {initials(req.user?.full_name ?? 'U')}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{req.user?.full_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3"><TypeBadge type={req.type} /></td>
                        <td className="px-4 py-3 text-gray-500 dark:text-white/50 text-xs">
                          {req.start_date} → {req.end_date}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-white/50">{req.total_days} hari</td>
                        <td className="px-4 py-3">
                          <div>
                            <StatusBadge status={req.status} />
                            {req.reject_reason && (
                              <p className="text-xs text-[#9F1239] mt-1">{req.reject_reason}</p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {req.status === 'pending' && (
                            <div className="flex gap-2">
                              <button onClick={() => approveMutation.mutate(req.id)}
                                disabled={approveMutation.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#34C759] hover:bg-[#2AAD4F] text-white rounded-xl text-xs font-semibold transition">
                                <Check size={12} /> Setujui
                              </button>
                              <button onClick={() => setRejectId(req.id)}
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
            </>
          )
        )}

        {/* ── OBJECTIONS ── */}
        {tab === 'objections' && (
          loadingObj ? <LoadingSpinner /> : (objections as Objection[]).length === 0 ? (
            <EmptyState icon={MessageSquareWarning} label="Tidak ada keberatan" sub="Keberatan dari karyawan akan muncul di sini" />
          ) : (
            <>
              {/* Mobile */}
              <div className="md:hidden space-y-3">
                {(objections as Objection[]).map((obj) => (
                  <ObjectionCard key={obj.id} obj={obj}
                    onApprove={() => approveObjMutation.mutate(obj.id)}
                    onReject={() => setRejectObjId(obj.id)}
                  />
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                      {['Karyawan', 'Alasan', 'Status', 'Aksi'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(objections as Objection[]).map((obj) => (
                      <tr key={obj.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#FF9500]/10 flex items-center justify-center text-[#FF9500] text-[11px] font-bold flex-shrink-0">
                              {initials(obj.user?.full_name ?? 'U')}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{obj.user?.full_name ?? '—'}</p>
                              <p className="text-[11px] text-gray-400 dark:text-white/30">
                                {new Date(obj.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <p className="text-sm text-gray-600 dark:text-white/60 line-clamp-2">{obj.reason}</p>
                          {obj.evidence_url && (
                            <a href={obj.evidence_url} target="_blank" rel="noreferrer"
                              className="flex items-center gap-1 text-xs text-[#007AFF] mt-1 hover:underline">
                              <ExternalLink size={11} /> Lihat bukti
                            </a>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={obj.status} /></td>
                        <td className="px-4 py-3">
                          {obj.status === 'pending' && (
                            <div className="flex gap-2">
                              <button onClick={() => approveObjMutation.mutate(obj.id)}
                                disabled={approveObjMutation.isPending}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#34C759] hover:bg-[#2AAD4F] text-white rounded-xl text-xs font-semibold transition">
                                <Check size={12} /> Setujui
                              </button>
                              <button onClick={() => setRejectObjId(obj.id)}
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
          )
        )}

        {/* ── BALANCES ── */}
        {tab === 'balances' && <BalancesTab />}

        {/* ── SWAPS ── */}
        {tab === 'swaps' && (
          loadingSwaps ? <LoadingSpinner /> : (
            <div className="space-y-3">
              {swaps.length === 0 ? (
                <EmptyState icon={ArrowLeftRight} label="Belum ada permintaan tukar jadwal" />
              ) : swaps.map((swap) => {
                const isPendingAdmin = swap.status === 'pending_admin';
                const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' });
                return (
                  <div key={swap.id} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#FF9500]/10 flex items-center justify-center flex-shrink-0">
                          <ArrowLeftRight size={15} className="text-[#FF9500]" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {swap.type === 'with_person' ? 'Tukar dengan Rekan' : 'Tukar dengan Hari Libur'}
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-white/40">
                            {new Date(swap.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                          </p>
                        </div>
                      </div>
                      <SwapStatusBadge status={swap.status} />
                    </div>

                    {/* Jadwal Detail */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <div className="bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.10)] rounded-xl p-3">
                        <p className="text-[10px] font-semibold text-[#007AFF] uppercase tracking-wide mb-1">
                          {swap.requester?.full_name ?? '—'}
                        </p>
                        <p className="text-xs font-medium text-gray-800 dark:text-white">{fmtDate(swap.requester_date)}</p>
                        {swap.requester_shift && (
                          <p className="text-[10px] text-gray-500 dark:text-white/50 mt-0.5">
                            {swap.requester_shift.name} · {swap.requester_shift.start_time.slice(0,5)}–{swap.requester_shift.end_time.slice(0,5)}
                          </p>
                        )}
                      </div>
                      <div className="bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.10)] rounded-xl p-3">
                        <p className="text-[10px] font-semibold text-[#15803D] dark:text-[#86EFAC] uppercase tracking-wide mb-1">
                          {swap.type === 'with_person' ? (swap.target_user?.full_name ?? '—') : 'Libur Sendiri'}
                        </p>
                        <p className="text-xs font-medium text-gray-800 dark:text-white">{fmtDate(swap.target_date)}</p>
                        {swap.target_shift && (
                          <p className="text-[10px] text-gray-500 dark:text-white/50 mt-0.5">
                            {swap.target_shift.name} · {swap.target_shift.start_time.slice(0,5)}–{swap.target_shift.end_time.slice(0,5)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    {swap.notes && (
                      <p className="text-xs text-gray-500 dark:text-white/40 italic mb-3">"{swap.notes}"</p>
                    )}
                    {swap.reject_reason && (
                      <p className="text-xs text-[#DC2626] mb-3">Alasan ditolak: {swap.reject_reason}</p>
                    )}

                    {/* Actions */}
                    {isPendingAdmin && (
                      <div className="flex gap-2 pt-3 border-t border-black/[0.05] dark:border-white/[0.06]">
                        <button
                          onClick={() => { setRejectSwapId(swap.id); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#FFF1F2] hover:bg-[#FFE4E6] text-[#9F1239] border border-[#FECACA] rounded-xl text-xs font-semibold transition">
                          <X size={13} /> Tolak
                        </button>
                        <button
                          onClick={() => approveSwapMutation.mutate(swap.id)}
                          disabled={approveSwapMutation.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] rounded-xl text-xs font-semibold transition disabled:opacity-50">
                          <Check size={13} /> {approveSwapMutation.isPending ? 'Memproses...' : 'Setujui & Tukar'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Reject Leave Modal */}
      {rejectId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Tolak Pengajuan</h3>
              <button onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
                <X size={16} />
              </button>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan (wajib)..."
              rows={3}
              className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#FF3B30] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectId(null); setRejectReason(''); }}
                className="flex-1 h-10 rounded-xl border border-black/10 dark:border-white/[0.12] text-sm font-medium text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                Batal
              </button>
              <button
                onClick={() => { if (rejectId && rejectReason.trim()) rejectMutation.mutate({ id: rejectId, reason: rejectReason }); }}
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                className="flex-1 h-10 rounded-xl bg-[#FF3B30] hover:bg-[#D63529] text-white text-sm font-semibold disabled:opacity-50 transition">
                {rejectMutation.isPending ? 'Menolak...' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Objection Modal */}
      {rejectObjId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Tolak Keberatan</h3>
              <button onClick={() => { setRejectObjId(null); setRejectObjReason(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
                <X size={16} />
              </button>
            </div>
            <textarea
              value={rejectObjReason}
              onChange={(e) => setRejectObjReason(e.target.value)}
              placeholder="Alasan penolakan (wajib)..."
              rows={3}
              className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#FF3B30] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectObjId(null); setRejectObjReason(''); }}
                className="flex-1 h-10 rounded-xl border border-black/10 dark:border-white/[0.12] text-sm font-medium text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                Batal
              </button>
              <button
                onClick={() => { if (rejectObjId && rejectObjReason.trim()) rejectObjMutation.mutate({ id: rejectObjId, reason: rejectObjReason }); }}
                disabled={!rejectObjReason.trim() || rejectObjMutation.isPending}
                className="flex-1 h-10 rounded-xl bg-[#FF3B30] hover:bg-[#D63529] text-white text-sm font-semibold disabled:opacity-50 transition">
                {rejectObjMutation.isPending ? 'Menolak...' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Swap Modal */}
      {rejectSwapId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#FF9500]/10 flex items-center justify-center flex-shrink-0">
                  <ArrowLeftRight size={15} className="text-[#FF9500]" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Tolak Tukar Jadwal</h3>
              </div>
              <button onClick={() => { setRejectSwapId(null); setRejectSwapReason(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
                <X size={16} />
              </button>
            </div>
            <textarea
              value={rejectSwapReason}
              onChange={(e) => setRejectSwapReason(e.target.value)}
              placeholder="Alasan penolakan (wajib)..."
              rows={3}
              className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#FF3B30] resize-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setRejectSwapId(null); setRejectSwapReason(''); }}
                className="flex-1 h-10 rounded-xl border border-black/10 dark:border-white/[0.12] text-sm font-medium text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                Batal
              </button>
              <button
                onClick={() => { if (rejectSwapId && rejectSwapReason.trim()) rejectSwapMutation.mutate({ id: rejectSwapId, reason: rejectSwapReason }); }}
                disabled={!rejectSwapReason.trim() || rejectSwapMutation.isPending}
                className="flex-1 h-10 rounded-xl bg-[#FF3B30] hover:bg-[#D63529] text-white text-sm font-semibold disabled:opacity-50 transition">
                {rejectSwapMutation.isPending ? 'Menolak...' : 'Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Balances Tab ──────────────────────────────────────────────────────────────
function BalancesTab() {
  const { data: users = [] } = useQuery({
    queryKey: ['users-leave-balance'],
    queryFn: () => apiClient.get('/users').then((r) =>
      (r.data.items ?? r.data) as { id: string; full_name: string }[]
    ),
  });

  const year = new Date().getFullYear();

  const { data: balances = [], isLoading } = useQuery({
    queryKey: ['balances-all'],
    queryFn: async () => {
      const results = await Promise.all(
        (users as { id: string; full_name: string }[]).slice(0, 30).map(async (u) => {
          try {
            const res = await apiClient.get(`/leave/balance/${u.id}?year=${year}`);
            return { ...res.data, user: u } as BalanceRow;
          } catch { return null; }
        }),
      );
      return results.filter(Boolean) as BalanceRow[];
    },
    enabled: users.length > 0,
  });

  if (isLoading) return <LoadingSpinner />;

  if (!balances.length) return (
    <EmptyState icon={Users} label="Belum ada data saldo" sub="Data saldo akan muncul setelah karyawan terdaftar" />
  );

  return (
    <>
      {/* Mobile */}
      <div className="md:hidden space-y-3">
        {balances.map((b, i) => {
          const saldo = Number(b.balance_days);
          const cls = saldo > 5 ? 'text-[#166534]' : saldo > 0 ? 'text-[#9A3412]' : 'text-[#9F1239]';
          const bg  = saldo > 5 ? 'bg-[#F0FDF4]' : saldo > 0 ? 'bg-[#FFF7ED]' : 'bg-[#FFF1F2]';
          return (
            <div key={i} className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-xs font-bold">
                    {(b.user?.full_name ?? 'U').charAt(0)}
                  </div>
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{b.user?.full_name ?? '—'}</p>
                </div>
                <span className={`text-sm font-bold px-3 py-1 rounded-full ${bg} ${cls}`}>
                  {saldo.toFixed(1)} hari
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5">
                  <p className="text-xs font-semibold text-gray-700 dark:text-white/70">{Number(b.used_days).toFixed(1)} hari</p>
                  <p className="text-[10px] text-gray-400 dark:text-white/30">Digunakan</p>
                </div>
                <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5">
                  <p className="text-xs font-semibold text-gray-700 dark:text-white/70">{b.accrued_monthly} × bulan</p>
                  <p className="text-[10px] text-gray-400 dark:text-white/30">Akrual</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop */}
      <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
              {['Karyawan', 'Saldo Tersisa', 'Digunakan', 'Akrual'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {balances.map((b, i) => {
              const saldo = Number(b.balance_days);
              const cls = saldo > 5 ? 'text-[#166534]' : saldo > 0 ? 'text-[#9A3412]' : 'text-[#9F1239]';
              return (
                <tr key={i} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-[11px] font-bold flex-shrink-0">
                        {(b.user?.full_name ?? 'U').charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white">{b.user?.full_name ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-sm">
                    <span className={cls}>{saldo.toFixed(1)} hari</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-white/60">{Number(b.used_days).toFixed(1)} hari</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-white/60">{b.accrued_monthly} × bulanan</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
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
