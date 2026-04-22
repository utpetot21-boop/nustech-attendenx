'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList, Timer, Palmtree, MapPin, ShieldAlert, Receipt,
  Download, Calendar, Users, CheckCircle2, XCircle, Clock,
  TrendingUp, Wallet, AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

type ReportTab = 'attendance' | 'overtime' | 'leave' | 'visits' | 'violations' | 'claims';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function downloadBlob(url: string, filename: string) {
  apiClient.get(url, { responseType: 'blob' }).then((r) => {
    const blob = new Blob([r.data]);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  });
}

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS: { key: ReportTab; label: string; Icon: React.ElementType }[] = [
  { key: 'attendance',  label: 'Kehadiran',    Icon: ClipboardList },
  { key: 'overtime',    label: 'Lembur',       Icon: Timer         },
  { key: 'leave',       label: 'Cuti',         Icon: Palmtree      },
  { key: 'visits',      label: 'Kunjungan',    Icon: MapPin        },
  { key: 'violations',  label: 'Pelanggaran',  Icon: ShieldAlert   },
  { key: 'claims',      label: 'Klaim Biaya',  Icon: Receipt       },
];

const CLAIM_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  pending:  { label: 'Pending',   bg: 'bg-[#FF9500]/10 dark:bg-[#FF9500]/15', text: 'text-[#92400E] dark:text-[#FF9500]' },
  approved: { label: 'Disetujui', bg: 'bg-[#34C759]/10 dark:bg-[#34C759]/15', text: 'text-[#166534] dark:text-[#34C759]' },
  rejected: { label: 'Ditolak',   bg: 'bg-[#FF3B30]/10 dark:bg-[#FF3B30]/15', text: 'text-[#9F1239] dark:text-[#FF3B30]' },
  paid:     { label: 'Dibayar',   bg: 'bg-[#007AFF]/10 dark:bg-[#007AFF]/15', text: 'text-[#1D4ED8] dark:text-[#007AFF]' },
};

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: string | number; color: string; bg: string;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${bg}`}>
          <Icon size={18} strokeWidth={1.8} className={color} />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white truncate">{value}</p>
      <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">{label}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('attendance');
  const [month, setMonth] = useState<string>(currentMonth());
  const [year, setYear] = useState(new Date().getFullYear().toString());

  const { data: attendance = [], isLoading: laA } = useQuery({
    queryKey: ['report-attendance', month],
    queryFn: () => apiClient.get(`/reports/attendance?month=${month}`).then((r) => r.data as Record<string, unknown>[]),
    enabled: tab === 'attendance',
  });
  const { data: overtime = [], isLoading: laO } = useQuery({
    queryKey: ['report-overtime', month],
    queryFn: () => apiClient.get(`/reports/overtime?month=${month}`).then((r) => r.data as Record<string, unknown>[]),
    enabled: tab === 'overtime',
  });
  const { data: leave = [], isLoading: laL } = useQuery({
    queryKey: ['report-leave', year],
    queryFn: () => apiClient.get(`/reports/leave?year=${year}`).then((r) => r.data as Record<string, unknown>[]),
    enabled: tab === 'leave',
  });
  const { data: visits = [], isLoading: laV } = useQuery({
    queryKey: ['report-visits', month],
    queryFn: () => apiClient.get(`/reports/visits?month=${month}`).then((r) => r.data as Record<string, unknown>[]),
    enabled: tab === 'visits',
  });
  const { data: violations = [], isLoading: laViol } = useQuery({
    queryKey: ['report-violations', month],
    queryFn: () => apiClient.get(`/reports/violations?month=${month}`).then((r) => r.data as Record<string, unknown>[]),
    enabled: tab === 'violations',
  });
  const { data: claimsData, isLoading: laClaims } = useQuery({
    queryKey: ['report-claims', month],
    queryFn: () => apiClient.get('/expense-claims', { params: { month, limit: 200 } }).then((r) => r.data),
    enabled: tab === 'claims',
  });
  const claims: Record<string, unknown>[] = claimsData?.items ?? [];

  const isLoading = laA || laO || laL || laV || laViol || laClaims;

  // ── Dynamic StatCards per tab ─────────────────────────────────────────────
  const statsNodes = (() => {
    if (tab === 'attendance' && attendance.length) {
      const totalHadir   = attendance.reduce((s, r) => s + (Number(r.hadir) || 0), 0);
      const totalAlfa    = attendance.reduce((s, r) => s + (Number(r.alfa) || 0), 0);
      const totalLembur  = attendance.reduce((s, r) => s + (Number(r.total_overtime_minutes) || 0), 0);
      return [
        { icon: Users,        label: 'Karyawan',     value: attendance.length,                           color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
        { icon: CheckCircle2, label: 'Total Hadir',   value: totalHadir,                                  color: 'text-[#34C759]', bg: 'bg-[#34C759]/10' },
        { icon: XCircle,      label: 'Total Alfa',    value: totalAlfa,                                   color: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10' },
        { icon: Clock,        label: 'Lembur (mnt)',  value: totalLembur.toLocaleString('id-ID'),         color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
      ];
    }
    if (tab === 'overtime' && overtime.length) {
      const totalJam = overtime.reduce((s, r) => s + (Number(r.total_hours) || 0), 0);
      return [
        { icon: Users,     label: 'Karyawan',     value: overtime.length,                color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
        { icon: Timer,     label: 'Total Jam',    value: `${totalJam.toFixed(1)}j`,      color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
        { icon: TrendingUp, label: 'Rata-rata',   value: `${(totalJam / overtime.length).toFixed(1)}j`, color: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10' },
      ];
    }
    if (tab === 'leave' && leave.length) {
      const totalSaldo    = leave.reduce((s, r) => s + (Number(r.balance_days) || 0), 0);
      const totalDigunakan = leave.reduce((s, r) => s + (Number(r.used_days) || 0), 0);
      return [
        { icon: Users,        label: 'Karyawan',    value: leave.length,    color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
        { icon: Palmtree,     label: 'Saldo Cuti',  value: `${totalSaldo}h`, color: 'text-[#34C759]', bg: 'bg-[#34C759]/10' },
        { icon: Calendar,     label: 'Digunakan',   value: `${totalDigunakan}h`, color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
      ];
    }
    if (tab === 'visits' && visits.length) {
      const totalSelesai = visits.reduce((s, r) => s + (Number(r.completed) || 0), 0);
      const totalVisits  = visits.reduce((s, r) => s + (Number(r.total_visits) || 0), 0);
      return [
        { icon: Users,        label: 'Teknisi',      value: visits.length,   color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
        { icon: MapPin,       label: 'Total Visit',  value: totalVisits,     color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
        { icon: CheckCircle2, label: 'Selesai',      value: totalSelesai,    color: 'text-[#34C759]', bg: 'bg-[#34C759]/10' },
      ];
    }
    if (tab === 'violations' && violations.length) {
      const aktif    = violations.filter(r => !(r.is_resolved as boolean)).length;
      const selesai  = violations.filter(r =>  (r.is_resolved as boolean)).length;
      return [
        { icon: ShieldAlert,  label: 'Total',    value: violations.length, color: 'text-[#FF3B30]', bg: 'bg-[#FF3B30]/10' },
        { icon: AlertTriangle,label: 'Aktif',    value: aktif,             color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
        { icon: CheckCircle2, label: 'Selesai',  value: selesai,           color: 'text-[#34C759]', bg: 'bg-[#34C759]/10' },
      ];
    }
    if (tab === 'claims' && claims.length) {
      const total    = claims.reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const approved = claims.filter(r => r.status === 'approved' || r.status === 'paid').reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const pending  = claims.filter(r => r.status === 'pending').length;
      return [
        { icon: Receipt,      label: 'Total Klaim',  value: claims.length,                             color: 'text-[#007AFF]', bg: 'bg-[#007AFF]/10' },
        { icon: Wallet,       label: 'Total Nominal', value: `Rp ${(total / 1000000).toFixed(1)}jt`,  color: 'text-[#AF52DE]', bg: 'bg-[#AF52DE]/10' },
        { icon: CheckCircle2, label: 'Disetujui',    value: `Rp ${(approved / 1000000).toFixed(1)}jt`, color: 'text-[#34C759]', bg: 'bg-[#34C759]/10' },
        { icon: Clock,        label: 'Menunggu',     value: pending,                                   color: 'text-[#FF9500]', bg: 'bg-[#FF9500]/10' },
      ];
    }
    return [];
  })();

  const exportConfig: { label: string; onClick: () => void } | null =
    tab === 'attendance' ? { label: 'Export Excel', onClick: () => downloadBlob(`/reports/attendance/export/excel?month=${month}`, `kehadiran-${month}.xlsx`)      } :
    tab === 'overtime'   ? { label: 'Export Excel', onClick: () => downloadBlob(`/reports/overtime/export/excel?month=${month}`,   `lembur-${month}.xlsx`)          } :
    tab === 'leave'      ? { label: 'Export Excel', onClick: () => downloadBlob(`/reports/leave/export/excel?year=${year}`,         `saldo-cuti-${year}.xlsx`)      } :
    tab === 'visits'     ? { label: 'Export Excel', onClick: () => downloadBlob(`/reports/visits/export/excel?month=${month}`,      `kunjungan-${month}.xlsx`)      } :
    tab === 'violations' ? { label: 'Export Excel', onClick: () => downloadBlob(`/reports/violations/export/excel?month=${month}`,  `pelanggaran-${month}.xlsx`)    } :
    null;

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Laporan</h1>
          <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">Ringkasan data dan export ke Excel</p>
        </div>
        {exportConfig && (
          <button onClick={exportConfig.onClick}
            className="flex items-center gap-2 px-4 py-2 bg-[#34C759] hover:bg-[#2AAD4F] text-white rounded-xl text-sm font-semibold transition">
            <Download size={15} />
            {exportConfig.label}
          </button>
        )}
      </div>

      {/* Stat Cards — only visible when data loaded */}
      {statsNodes.length > 0 && !isLoading && (
        <div className={`px-4 sm:px-6 grid gap-3 mb-4 grid-cols-2 ${statsNodes.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
          {statsNodes.map((s) => (
            <StatCard key={s.label} icon={s.icon} label={s.label} value={s.value} color={s.color} bg={s.bg} />
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 sm:px-6 mb-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1.5 w-max">
          {TABS.map(({ key, label, Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                tab === key
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'bg-white dark:bg-white/[0.06] text-gray-500 dark:text-white/40 border border-black/[0.05] dark:border-white/[0.08] hover:text-gray-700 dark:hover:text-white/70'
              }`}>
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 sm:px-6 mb-4">
        <div className="flex flex-wrap gap-2 items-center p-3 bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08]">
          <Calendar size={15} className="text-gray-400 flex-shrink-0" />
          {tab !== 'leave' ? (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-transparent text-sm text-gray-700 dark:text-white/80 outline-none"
            />
          ) : (
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={2024}
              max={2030}
              className="bg-transparent text-sm text-gray-700 dark:text-white/80 outline-none w-20"
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'attendance' ? (
          <ReportSection rows={attendance} emptyIcon={ClipboardList} emptyLabel="Belum ada data kehadiran">
            {/* Mobile */}
            <div className="md:hidden space-y-3">
              {attendance.map((r, i) => (
                <div key={i} className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{r.full_name as string}</p>
                      <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">{r.department as string ?? '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Hadir', value: r.hadir, cls: 'text-[#166534]', bg: 'bg-[#F0FDF4]' },
                      { label: 'Terlambat', value: r.terlambat, cls: 'text-[#9A3412]', bg: 'bg-[#FFF7ED]' },
                      { label: 'Alfa', value: r.alfa, cls: 'text-[#9F1239]', bg: 'bg-[#FFF1F2]' },
                    ].map(({ label, value, cls, bg }) => (
                      <div key={label} className={`${bg} dark:bg-white/[0.04] rounded-xl p-2 text-center`}>
                        <p className={`text-base font-bold ${cls}`}>{value as string}</p>
                        <p className="text-[10px] text-gray-400 dark:text-white/30">{label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.05]">
                    <span className="text-xs text-gray-400">Izin/Sakit: {r.izin as string}</span>
                    <span className="text-xs text-gray-400">Lembur: {r.total_overtime_minutes as string} mnt</span>
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                    {['Nama', 'Departemen', 'Hadir', 'Terlambat', 'Alfa', 'Izin/Sakit/Dinas', 'Lembur (mnt)'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((r, i) => (
                    <tr key={i} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.full_name as string}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-white/50">{r.department as string ?? '—'}</td>
                      <td className="px-4 py-3 font-semibold text-[#166534]">{r.hadir as string}</td>
                      <td className="px-4 py-3 text-[#9A3412]">{r.terlambat as string}</td>
                      <td className="px-4 py-3 font-semibold text-[#9F1239]">{r.alfa as string}</td>
                      <td className="px-4 py-3 text-[#1D4ED8]">{r.izin as string}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-white/60">{r.total_overtime_minutes as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>
        ) : tab === 'overtime' ? (
          <ReportSection rows={overtime} emptyIcon={Timer} emptyLabel="Belum ada data lembur">
            <div className="md:hidden space-y-3">
              {overtime.map((r, i) => (
                <div key={i} className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5">{r.full_name as string}</p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-3">{r.department as string ?? '—'}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Hari Lembur', value: r.overtime_days, cls: 'text-gray-800 dark:text-white' },
                      { label: 'Total Menit', value: r.total_minutes, cls: 'text-gray-800 dark:text-white' },
                      { label: 'Total Jam',   value: `${r.total_hours}j`, cls: 'text-[#1D4ED8] font-bold' },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2 text-center">
                        <p className={`text-sm font-semibold ${cls}`}>{value as string}</p>
                        <p className="text-[10px] text-gray-400 dark:text-white/30">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                    {['Nama', 'Departemen', 'Hari Lembur', 'Total Menit', 'Total Jam'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overtime.map((r, i) => (
                    <tr key={i} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.full_name as string}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-white/50">{r.department as string ?? '—'}</td>
                      <td className="px-4 py-3">{r.overtime_days as string}</td>
                      <td className="px-4 py-3">{r.total_minutes as string}</td>
                      <td className="px-4 py-3 font-semibold text-[#1D4ED8]">{r.total_hours as string} jam</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>
        ) : tab === 'leave' ? (
          <ReportSection rows={leave} emptyIcon={Palmtree} emptyLabel="Belum ada data cuti">
            <div className="md:hidden space-y-3">
              {leave.map((r, i) => (
                <div key={i} className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white mb-0.5">{r.full_name as string}</p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mb-3">{r.department as string ?? '—'}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Saldo',     value: `${r.balance_days} hari`,   cls: 'text-[#166534] font-bold' },
                      { label: 'Digunakan', value: `${r.used_days}`,            cls: 'text-[#9A3412]' },
                      { label: 'Akrual',    value: `${r.accrued_monthly}`,      cls: 'text-gray-700 dark:text-white/80' },
                      { label: 'Hangus',    value: `${r.expired_days}`,         cls: 'text-[#9F1239]' },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2">
                        <p className={`text-sm font-semibold ${cls}`}>{value as string}</p>
                        <p className="text-[10px] text-gray-400 dark:text-white/30">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                    {['Nama', 'Departemen', 'Saldo', 'Digunakan', 'Akrual', 'Hangus'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leave.map((r, i) => (
                    <tr key={i} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.full_name as string}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-white/50">{r.department as string ?? '—'}</td>
                      <td className="px-4 py-3 font-bold text-[#166534]">{r.balance_days as string} hari</td>
                      <td className="px-4 py-3 text-[#9A3412]">{r.used_days as string}</td>
                      <td className="px-4 py-3">{r.accrued_monthly as string}</td>
                      <td className="px-4 py-3 text-[#9F1239]">{r.expired_days as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>
        ) : tab === 'visits' ? (
          <ReportSection rows={visits} emptyIcon={MapPin} emptyLabel="Belum ada data kunjungan">
            <div className="md:hidden space-y-3">
              {visits.map((r, i) => (
                <div key={i} className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
                  <p className="font-semibold text-sm text-gray-900 dark:text-white">{r.technician as string}</p>
                  <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5 mb-3">{r.client as string ?? '—'}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Total',    value: r.total_visits,        cls: 'text-gray-800 dark:text-white' },
                      { label: 'Selesai',  value: r.completed,           cls: 'text-[#166534] font-bold' },
                      { label: 'Avg Dur',  value: `${r.avg_duration_minutes}m`, cls: 'text-gray-800 dark:text-white' },
                    ].map(({ label, value, cls }) => (
                      <div key={label} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2 text-center">
                        <p className={`text-sm font-semibold ${cls}`}>{value as string}</p>
                        <p className="text-[10px] text-gray-400 dark:text-white/30">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                    {['Teknisi', 'Klien', 'Total', 'Selesai', 'Durasi Rata-rata', 'Foto'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visits.map((r, i) => (
                    <tr key={i} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.technician as string}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-white/50">{r.client as string ?? '—'}</td>
                      <td className="px-4 py-3">{r.total_visits as string}</td>
                      <td className="px-4 py-3 text-[#166534]">{r.completed as string}</td>
                      <td className="px-4 py-3">{r.avg_duration_minutes as string} mnt</td>
                      <td className="px-4 py-3">{r.total_photos as string}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>
        ) : tab === 'violations' ? (
          <ReportSection rows={violations} emptyIcon={ShieldAlert} emptyLabel="Belum ada data pelanggaran">
            <div className="md:hidden space-y-3">
              {violations.map((r, i) => (
                <div key={i} className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm text-gray-900 dark:text-white">{r.full_name as string}</p>
                      <span className="text-[11px] font-semibold uppercase text-[#9F1239] bg-[#FFF1F2] px-2 py-0.5 rounded-full mt-1 inline-block">
                        {r.type as string}
                      </span>
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      (r.is_resolved as boolean) ? 'bg-[#F0FDF4] text-[#166534]' : 'bg-[#FFF1F2] text-[#9F1239]'
                    }`}>
                      {(r.is_resolved as boolean) ? 'Selesai' : 'Aktif'}
                    </span>
                  </div>
                  {!!r.description && <p className="text-xs text-gray-500 dark:text-white/40 mt-1">{r.description as string}</p>}
                  <p className="text-[11px] text-gray-400 dark:text-white/30 mt-2">
                    {new Date(r.created_at as string).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                  </p>
                </div>
              ))}
            </div>
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                    {['Karyawan', 'Tipe', 'Keterangan', 'Status', 'Tanggal'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {violations.map((r, i) => (
                    <tr key={i} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.full_name as string}</td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-semibold uppercase text-[#9F1239] bg-[#FFF1F2] px-2 py-0.5 rounded-full">{r.type as string}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-white/50 max-w-xs text-xs">{r.description as string ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${(r.is_resolved as boolean) ? 'bg-[#F0FDF4] text-[#166534]' : 'bg-[#FFF1F2] text-[#9F1239]'}`}>
                          {(r.is_resolved as boolean) ? 'Selesai' : 'Aktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 dark:text-white/30 text-xs">
                        {new Date(r.created_at as string).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ReportSection>
        ) : (
          <ReportSection rows={claims} emptyIcon={Receipt} emptyLabel="Belum ada data klaim biaya">
            <div className="md:hidden space-y-3">
              {claims.map((r, i) => {
                const s = CLAIM_STATUS[(r.status as string)] ?? { label: r.status as string, bg: 'bg-gray-100', text: 'text-gray-600' };
                return (
                  <div key={i} className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-sm text-gray-900 dark:text-white">{(r.user as Record<string, unknown>)?.full_name as string ?? '—'}</p>
                        <p className="text-xs text-gray-400 dark:text-white/30 capitalize mt-0.5">{r.category as string}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">Rp {Number(r.amount).toLocaleString('id-ID')}</p>
                    {!!r.description && <p className="text-xs text-gray-500 dark:text-white/40 mt-1 truncate">{r.description as string}</p>}
                    <p className="text-[11px] text-gray-400 dark:text-white/30 mt-2">
                      {new Date(r.created_at as string).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                    {['Karyawan', 'Kategori', 'Nominal', 'Keterangan', 'Status', 'Tanggal'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claims.map((r, i) => {
                    const s = CLAIM_STATUS[(r.status as string)] ?? { label: r.status as string, bg: 'bg-gray-100', text: 'text-gray-600' };
                    return (
                      <tr key={i} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{(r.user as Record<string, unknown>)?.full_name as string ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-white/50 capitalize text-xs">{r.category as string}</td>
                        <td className="px-4 py-3 font-semibold text-gray-800 dark:text-white">Rp {Number(r.amount).toLocaleString('id-ID')}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-white/50 text-xs max-w-xs truncate">{r.description as string ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>{s.label}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-400 dark:text-white/30 text-xs">
                          {new Date(r.created_at as string).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ReportSection>
        )}
      </div>
    </div>
  );
}

// ── Helper wrapper ─────────────────────────────────────────────────────────────
function ReportSection({ rows, emptyIcon: Icon, emptyLabel, children }: {
  rows: unknown[]; emptyIcon: React.ElementType; emptyLabel: string; children: React.ReactNode;
}) {
  if (!rows.length) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
          <Icon size={28} className="text-gray-300 dark:text-white/20" />
        </div>
        <p className="text-sm font-medium text-gray-500 dark:text-white/40">{emptyLabel}</p>
        <p className="text-xs text-gray-400 dark:text-white/25 mt-1">Coba ubah filter bulan/tahun</p>
      </div>
    );
  }
  return <>{children}</>;
}
