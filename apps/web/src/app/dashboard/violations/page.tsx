'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import {
  AlertTriangle, ShieldAlert, FileWarning, CheckCircle2,
  Clock, Plus, X, ExternalLink, FileText,
  Search,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────
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

// ── Constants ──────────────────────────────────────────────────────────────
const LEVEL_MAP: Record<string, { bg: string; text: string; ring: string; activeBg: string; activeText: string }> = {
  SP1: { bg: 'bg-[#FF9500]/10', text: 'text-[#FF9500]', ring: 'ring-[#FF9500]/20', activeBg: 'bg-[#FF9500]', activeText: 'text-white' },
  SP2: { bg: 'bg-[#FF3B30]/10', text: 'text-[#FF3B30]', ring: 'ring-[#FF3B30]/20', activeBg: 'bg-[#FF3B30]', activeText: 'text-white' },
  SP3: { bg: 'bg-[#9F1239]/10', text: 'text-[#9F1239]',  ring: 'ring-[#9F1239]/20',  activeBg: 'bg-[#9F1239]',  activeText: 'text-white' },
};

const inputCls =
  'w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2E] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' });
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

type Tab = 'violations' | 'warning-letters';

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08] flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  );
}

// ── LevelBadge ────────────────────────────────────────────────────────────────
function LevelBadge({ level }: { level: 'SP1' | 'SP2' | 'SP3' }) {
  const m = LEVEL_MAP[level] ?? LEVEL_MAP.SP1;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ring-1 ${m.bg} ${m.text} ${m.ring}`}>
      {level}
    </span>
  );
}

// ── ViolationCard (mobile) ────────────────────────────────────────────────────
function ViolationCard({ v }: { v: AttendanceViolation }) {
  const empHref = `/dashboard/employees?search=${encodeURIComponent(v.user?.name ?? '')}`;
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start gap-3">
        <Link href={empHref} className="w-9 h-9 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0 hover:opacity-70 transition">
          <span className="text-xs font-bold text-[#FF3B30]">{initials(v.user?.name ?? '?')}</span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <Link href={empHref} className="font-semibold text-gray-900 dark:text-white text-sm truncate hover:text-[#007AFF] dark:hover:text-[#007AFF] transition">{v.user?.name ?? '—'}</Link>
            {v.is_resolved ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#34C759]/10 text-[#34C759] ring-1 ring-[#34C759]/20">
                <CheckCircle2 size={10} /> Selesai
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/10 text-[#FF9500] ring-1 ring-[#FF9500]/20">
                <Clock size={10} /> Aktif
              </span>
            )}
          </div>
          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-[11px] font-medium bg-[#FF3B30]/10 text-[#FF3B30]">
            {v.type.replace(/_/g, ' ')}
          </span>
          {v.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{v.description}</p>
          )}
          <p className="text-[11px] text-gray-400 mt-1">{fmtDate(v.created_at)}</p>
        </div>
      </div>
    </div>
  );
}

// ── SpCard (mobile) ───────────────────────────────────────────────────────────
function SpCard({ wl, onDetail }: { wl: WarningLetter; onDetail: () => void }) {
  const empHref = `/dashboard/employees?search=${encodeURIComponent(wl.user?.name ?? '')}`;
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start gap-3">
        <Link href={empHref} className="w-9 h-9 rounded-xl bg-[#FF9500]/10 flex items-center justify-center flex-shrink-0 hover:opacity-70 transition">
          <span className="text-xs font-bold text-[#FF9500]">{initials(wl.user?.name ?? '?')}</span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <Link href={empHref} className="font-semibold text-gray-900 dark:text-white text-sm truncate hover:text-[#007AFF] dark:hover:text-[#007AFF] transition">{wl.user?.name ?? '—'}</Link>
            <LevelBadge level={wl.level} />
          </div>
          {wl.user?.department?.name && (
            <p className="text-xs text-gray-400 mt-0.5">{wl.user.department.name}</p>
          )}
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{wl.reason}</p>
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-gray-400">{fmtDate(wl.issued_at)}</p>
            {wl.acknowledged_at ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#34C759]">
                <CheckCircle2 size={10} /> Dikonfirmasi
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-[#FF9500]">Menunggu konfirmasi</span>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onDetail}
        className="mt-3 w-full py-1.5 rounded-xl bg-[#007AFF]/10 text-[#007AFF] text-xs font-semibold"
      >
        Detail
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ViolationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('violations');
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

  const filteredVio = violations.filter((v) =>
    !search || v.user?.name.toLowerCase().includes(search.toLowerCase()),
  );
  const filteredWl = warningLetters.filter((w) =>
    !search || w.user?.name.toLowerCase().includes(search.toLowerCase()),
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'violations',     label: 'Pelanggaran',    count: unresolvedVio },
    { key: 'warning-letters', label: 'Surat Peringatan', count: totalSP },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">
      {/* Page Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Pelanggaran & SP</h1>
          <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">
            Manajemen pelanggaran absensi dan Surat Peringatan
          </p>
        </div>
        {activeTab === 'warning-letters' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0071e3] text-white rounded-xl text-sm font-semibold transition flex-shrink-0"
          >
            <Plus size={16} />
            Buat SP
          </button>
        )}
      </div>

      {/* StatCards */}
      <div className="px-4 sm:px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={AlertTriangle} label="Total Pelanggaran"   value={totalVio}          color="bg-[#FF3B30]" />
        <StatCard icon={Clock}         label="Belum Diselesaikan"  value={unresolvedVio}     color="bg-[#FF9500]" />
        <StatCard icon={FileWarning}   label="Total SP"            value={totalSP}           color="bg-[#AF52DE]" />
        <StatCard icon={ShieldAlert}   label="Belum Dikonfirmasi"  value={unacknowledgedSP}  color="bg-[#FF3B30]" />
      </div>

      {/* Tabs + Filter Bar */}
      <div className="px-4 sm:px-6 pb-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key); setSearch(''); }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition flex-shrink-0 ${
                  active
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-white dark:bg-[#1C1C1E] text-gray-600 dark:text-gray-400 border border-black/[0.08] dark:border-white/[0.1]'
                }`}
              >
                {t.label}
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 dark:text-gray-400'}`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08]">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama karyawan…"
            className="flex-1 text-sm bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Violations Tab */}
      {activeTab === 'violations' && (
        <>
          {loadingVio ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredVio.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center">
                <AlertTriangle size={28} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tidak ada pelanggaran</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {search ? 'Coba kata kunci lain' : 'Semua karyawan tertib'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="px-4 sm:px-6 pb-6 md:hidden space-y-3">
                {filteredVio.map((v) => <ViolationCard key={v.id} v={v} />)}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block px-4 sm:px-6 pb-6">
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-black/[0.04] dark:border-white/[0.06]">
                        {['Karyawan', 'Tipe', 'Keterangan', 'Tanggal', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredVio.map((v) => (
                        <tr
                          key={v.id}
                          className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] transition"
                        >
                          <td className="px-4 py-3">
                            <Link href={`/dashboard/employees?search=${encodeURIComponent(v.user?.name ?? '')}`} className="flex items-center gap-2 group">
                              <div className="w-7 h-7 rounded-xl bg-[#FF3B30]/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-[#FF3B30]">{initials(v.user?.name ?? '?')}</span>
                              </div>
                              <span className="font-medium text-gray-900 dark:text-white group-hover:text-[#007AFF] transition">{v.user?.name ?? '—'}</span>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#FF3B30]/10 text-[#FF3B30]">
                              {v.type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate text-xs">
                            {v.description ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(v.created_at)}</td>
                          <td className="px-4 py-3">
                            {v.is_resolved ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#34C759]">
                                <CheckCircle2 size={12} /> Selesai
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#FF9500]">
                                <Clock size={12} /> Aktif
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Warning Letters Tab */}
      {activeTab === 'warning-letters' && (
        <>
          {loadingWL ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredWl.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center">
                <FileWarning size={28} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tidak ada Surat Peringatan</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {search ? 'Coba kata kunci lain' : 'Belum ada SP yang diterbitkan'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="px-4 sm:px-6 pb-6 md:hidden space-y-3">
                {filteredWl.map((wl) => (
                  <SpCard key={wl.id} wl={wl} onDetail={() => setDetailWl(wl)} />
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block px-4 sm:px-6 pb-6">
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-black/[0.04] dark:border-white/[0.06]">
                        {['Karyawan', 'Level', 'Alasan', 'Terbit', 'Berlaku s/d', 'Konfirmasi', 'Dokumen'].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWl.map((wl) => (
                        <tr
                          key={wl.id}
                          className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition"
                          onClick={() => setDetailWl(wl)}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Link href={`/dashboard/employees?search=${encodeURIComponent(wl.user?.name ?? '')}`} className="flex items-center gap-2 group">
                              <div className="w-7 h-7 rounded-xl bg-[#FF9500]/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-[10px] font-bold text-[#FF9500]">{initials(wl.user?.name ?? '?')}</span>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white group-hover:text-[#007AFF] transition">{wl.user?.name ?? '—'}</p>
                                {wl.user?.department?.name && (
                                  <p className="text-[11px] text-gray-400">{wl.user.department.name}</p>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3"><LevelBadge level={wl.level} /></td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{wl.reason}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">{fmtDate(wl.issued_at)}</td>
                          <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                            {wl.valid_until ? fmtDate(wl.valid_until) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {wl.acknowledged_at ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#34C759]">
                                <CheckCircle2 size={12} /> {fmtDate(wl.acknowledged_at)}
                              </span>
                            ) : (
                              <span className="text-xs font-semibold text-[#FF9500]">Menunggu</span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {wl.doc_url ? (
                              <a
                                href={wl.doc_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#007AFF] font-semibold hover:underline"
                              >
                                <FileText size={12} /> PDF
                              </a>
                            ) : (
                              <button
                                onClick={() =>
                                  apiClient.get(`/warning-letters/${wl.id}/pdf`).then((r) => window.open(r.data.url, '_blank'))
                                }
                                className="text-xs text-gray-400 hover:text-[#007AFF] transition"
                              >
                                Generate PDF
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Warning Letter Detail Modal */}
      {detailWl && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setDetailWl(null)}
        >
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FF9500]/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-[#FF9500]">{initials(detailWl.user?.name ?? '?')}</span>
                </div>
                <div>
                  <p className="font-bold text-gray-900 dark:text-white">{detailWl.user?.name ?? '—'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <LevelBadge level={detailWl.level} />
                    {detailWl.user?.department?.name && (
                      <span className="text-xs text-gray-400">{detailWl.user.department.name}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDetailWl(null)}
                className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Diterbitkan', value: fmtDate(detailWl.issued_at) },
                  { label: 'Berlaku s/d', value: detailWl.valid_until ? fmtDate(detailWl.valid_until) : '—' },
                  { label: 'Penerbit', value: detailWl.issuer?.name },
                  { label: 'Konfirmasi', value: detailWl.acknowledged_at ? fmtDate(detailWl.acknowledged_at) : 'Belum' },
                ].map(({ label, value }) => value ? (
                  <div key={label} className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3">
                    <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                  </div>
                ) : null)}
              </div>

              {/* Alasan */}
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Alasan</p>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{detailWl.reason}</p>
              </div>

              {/* Catatan */}
              {detailWl.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Catatan</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{detailWl.notes}</p>
                </div>
              )}

              {/* Dokumen */}
              {detailWl.doc_url ? (
                <a
                  href={detailWl.doc_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 text-sm text-[#007AFF] font-semibold hover:underline"
                >
                  <FileText size={16} /> Lihat Dokumen SP
                  <ExternalLink size={12} />
                </a>
              ) : (
                <button
                  onClick={() =>
                    apiClient.get(`/warning-letters/${detailWl.id}/pdf`).then((r) => window.open(r.data.url, '_blank'))
                  }
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-[#007AFF] transition"
                >
                  <FileText size={16} /> Generate PDF
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create SP Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Buat Surat Peringatan</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center"
              >
                <X size={16} className="text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              <div>
                <label className={labelCls}>ID Karyawan</label>
                <input
                  type="text"
                  placeholder="UUID karyawan"
                  value={form.user_id}
                  onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Level SP</label>
                <div className="flex gap-2">
                  {(['SP1', 'SP2', 'SP3'] as const).map((lvl) => {
                    const m = LEVEL_MAP[lvl];
                    const active = form.level === lvl;
                    return (
                      <button
                        key={lvl}
                        onClick={() => setForm((f) => ({ ...f, level: lvl }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition ring-1 ${
                          active ? `${m.activeBg} ${m.activeText} ring-transparent` : `bg-white dark:bg-[#2C2C2E] ${m.text} ${m.ring}`
                        }`}
                      >
                        {lvl}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className={labelCls}>Alasan</label>
                <textarea
                  rows={3}
                  placeholder="Jelaskan alasan pemberian SP..."
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Berlaku s/d</label>
                  <input
                    type="date"
                    value={form.valid_until}
                    onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Ref. Pelanggaran</label>
                  <input
                    type="text"
                    placeholder="UUID violation (opsional)"
                    value={form.reference_violation_id}
                    onChange={(e) => setForm((f) => ({ ...f, reference_violation_id: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Catatan Tambahan</label>
                <textarea
                  rows={2}
                  placeholder="Catatan opsional..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-5 py-4 border-t border-black/[0.06] dark:border-white/[0.08]">
              <button
                disabled={!form.user_id || !form.reason || createSpMutation.isPending}
                onClick={() =>
                  createSpMutation.mutate({
                    user_id: form.user_id,
                    level: form.level,
                    reason: form.reason,
                    valid_until: form.valid_until || undefined,
                    notes: form.notes || undefined,
                    reference_violation_id: form.reference_violation_id || undefined,
                  })
                }
                className="flex-1 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0071e3] disabled:opacity-50 text-white text-sm font-semibold transition"
              >
                {createSpMutation.isPending ? 'Menyimpan…' : 'Terbitkan SP'}
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-sm font-semibold"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
