'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { getAuthUser } from '@/lib/auth';
import {
  Users, Navigation, ListTodo, FileText,
  Siren, Bell, Check, X,
  ArrowRight, MapPin, Clock, TrendingUp,
  AlertTriangle, CheckCircle2, Timer, Briefcase,
  CalendarDays, ClipboardCheck, Receipt, UserPlus,
  Building2, ExternalLink, Megaphone,
} from 'lucide-react';

const DashboardMap = dynamic(() => import('./DashboardMap'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
type AttendanceSummary = { hadir: number; terlambat: number; alfa: number; total_aktif: number; date: string };
type Visit = { id: string; status: string; user?: { full_name: string }; client?: { name: string }; lat_checkin: number | null; lng_checkin: number | null; lat_checkout: number | null; lng_checkout: number | null };
type Task = { id: string; title: string; status: string; priority: string; assigned_user?: { full_name: string }; client?: { name: string }; pending_hold?: { id: string; reason_type: string; reason_notes: string; auto_approve_at: string | null } | null };
type SosAlert = { id: string; status: string; last_lat: number | null; last_lng: number | null; user?: { full_name: string }; created_at: string };
type ServiceReport = { id: string; report_number: string; created_at: string; visit?: { client?: { name: string } } };

// ── Helpers ───────────────────────────────────────────────────────────────────
function today() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' });
}

function getStoredUser() {
  return getAuthUser();
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'bg-[#FFF1F2] text-[#FF3B30] dark:bg-[rgba(255,59,48,0.15)] dark:text-[#FF453A]',
  high:   'bg-[#FFF7ED] text-[#FF9500] dark:bg-[rgba(255,149,0,0.15)] dark:text-[#FF9F0A]',
  normal: 'bg-[#EFF6FF] text-[#007AFF] dark:bg-[rgba(0,122,255,0.15)] dark:text-[#0A84FF]',
  low:    'bg-[#F2F2F7] text-[#636366] dark:bg-[rgba(99,99,102,0.20)] dark:text-[#8E8E93]',
};
const PRIORITY_LABEL: Record<string, string> = { urgent: 'Urgent', high: 'Tinggi', normal: 'Normal', low: 'Rendah' };
const DAY_LABELS: Record<number, string> = { 0: 'Min', 1: 'Sen', 2: 'Sel', 3: 'Rab', 4: 'Kam', 5: 'Jum', 6: 'Sab' };

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({
  href, icon: Icon, iconColor, iconBg, label, value, sub, progress, progressColor, badge,
}: {
  href: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string | number;
  sub?: string;
  progress?: number;
  progressColor?: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link href={href} className="group relative bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4 sm:p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden block">
      {/* Subtle bg glow */}
      <div className={`absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-[0.08] blur-2xl ${iconBg}`} />

      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-[11px] flex items-center justify-center ${iconBg} flex-shrink-0`}>
          <Icon size={18} className={iconColor} strokeWidth={1.9} />
        </div>
        {badge}
      </div>

      <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400 dark:text-white/40 mb-1">{label}</p>
      <p className="text-[28px] font-bold text-gray-900 dark:text-white leading-none mb-1">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-white/35">{sub}</p>}

      {progress !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${progressColor ?? 'bg-[#007AFF]'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-white/30 mt-1">{progress}%</p>
        </div>
      )}

      <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <ArrowRight size={14} className="text-gray-400" />
      </div>
    </Link>
  );
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4 sm:p-5 overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-[11px] bg-gray-100 dark:bg-white/10 animate-pulse" />
        <div className="w-14 h-5 rounded-full bg-gray-100 dark:bg-white/10 animate-pulse" />
      </div>
      <div className="w-20 h-3 rounded-full bg-gray-100 dark:bg-white/10 animate-pulse mb-2" />
      <div className="w-12 h-7 rounded-xl bg-gray-100 dark:bg-white/10 animate-pulse mb-1" />
      <div className="w-28 h-3 rounded-full bg-gray-100 dark:bg-white/10 animate-pulse" />
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({ title, href, linkLabel = 'Lihat semua' }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-[13px] font-semibold text-gray-800 dark:text-white">{title}</h2>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:text-blue-700 font-medium">
          {linkLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const qc   = useQueryClient();
  const user = getStoredUser();

  const { data: summary, isLoading: summaryLoading } = useQuery<AttendanceSummary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiClient.get('/attendance/summary/today').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: visits = [] } = useQuery<Visit[]>({
    queryKey: ['dashboard-visits'],
    queryFn: () => apiClient.get('/visits', { params: { limit: 50 } }).then((r) => {
      const d = r.data; return Array.isArray(d) ? d : (d?.items ?? []);
    }),
    refetchInterval: 30_000,
  });

  const { data: tasks } = useQuery<{ items: Task[]; total: number }>({
    queryKey: ['dashboard-tasks'],
    queryFn: () => apiClient.get('/tasks', { params: { limit: 20 } }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: sosAlerts = [] } = useQuery<SosAlert[]>({
    queryKey: ['dashboard-sos'],
    queryFn: () => apiClient.get('/sos/active').then((r) => r.data),
    refetchInterval: 15_000,
  });

  const { data: reports } = useQuery<{ items: ServiceReport[]; total: number }>({
    queryKey: ['dashboard-reports'],
    queryFn: () => apiClient.get('/service-reports', { params: { limit: 5 } }).then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: visitStats = [] } = useQuery<{ date: string; total: number; completed: number }[]>({
    queryKey: ['dashboard-visit-stats'],
    queryFn: () => apiClient.get('/reports/visits/daily', { params: { days: 7 } }).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });

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

  const { data: onHold = [] } = useQuery<Task[]>({
    queryKey: ['dashboard-on-hold'],
    queryFn: () => apiClient.get('/tasks/on-hold').then((r) => {
      const d = r.data; return Array.isArray(d) ? d : (d?.items ?? []);
    }),
    refetchInterval: 30_000,
  });

  const { data: pendingAnnouncements = [] } = useQuery<{ id: string; title: string }[]>({
    queryKey: ['dashboard-pending-announcements'],
    queryFn: () => apiClient.get('/announcements', { params: { status: 'pending_approval' } }).then((r) =>
      Array.isArray(r.data) ? r.data : [],
    ),
    refetchInterval: 30_000,
  });

  const { data: recentAnnouncements = [] } = useQuery<{ id: string; title: string; sent_at: string | null; type: string }[]>({
    queryKey: ['dashboard-recent-announcements'],
    queryFn: () => apiClient.get('/announcements', { params: { status: 'sent' } }).then((r) =>
      Array.isArray(r.data) ? r.data.slice(0, 3) : [],
    ),
    refetchInterval: 60_000,
  });

  const approveMut = useMutation({
    mutationFn: ({ taskId, holdId }: { taskId: string; holdId: string }) =>
      apiClient.post(`/tasks/${taskId}/holds/${holdId}/approve`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard-on-hold'] }); toast.success('Hold disetujui'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyetujui hold')),
  });

  const rejectMut = useMutation({
    mutationFn: ({ taskId, holdId }: { taskId: string; holdId: string }) =>
      apiClient.post(`/tasks/${taskId}/holds/${holdId}/reject`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dashboard-on-hold'] }); toast.success('Hold ditolak'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menolak hold')),
  });

  // ── Derived ────────────────────────────────────────────────────────────────
  const ongoingVisits  = visits.filter((v) => v.status === 'ongoing' || v.status === 'check_in');
  const hadirPct       = summary?.total_aktif ? Math.round((summary.hadir / summary.total_aktif) * 100) : 0;
  const todayTasks     = tasks?.items ?? [];
  const completedTasks = todayTasks.filter((t) => t.status === 'completed' || t.status === 'done').length;
  const taskPct        = todayTasks.length ? Math.round((completedTasks / todayTasks.length) * 100) : 0;
  const todayReports   = reports?.items?.filter((r) => r.created_at?.startsWith(new Date().toISOString().split('T')[0])) ?? [];
  const activeSos      = sosAlerts[0];

  const chartData = visitStats.length > 0
    ? visitStats.map((s) => ({
        day: DAY_LABELS[new Date(s.date).getDay()] ?? s.date.slice(5),
        kunjungan: s.total,
        selesai: s.completed,
      }))
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return { day: DAY_LABELS[d.getDay()], kunjungan: 0, selesai: 0 };
      });

  const mapMarkers = [
    ...ongoingVisits
      .filter((v) => v.lat_checkin && v.lng_checkin)
      .map((v) => ({
        userId: v.id, name: v.user?.full_name ?? '—', type: 'visit' as const,
        lat: v.lat_checkin!, lng: v.lng_checkin!, clientName: v.client?.name ?? null, lastSeen: null,
      })),
    ...sosAlerts
      .filter((s) => s.last_lat != null && s.last_lng != null)
      .map((s) => ({
        userId: s.id, name: s.user?.full_name ?? 'SOS', type: 'sos' as const,
        lat: Number(s.last_lat), lng: Number(s.last_lng), clientName: null, lastSeen: s.created_at,
      })),
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-5">

      {/* ── SOS Banner ──────────────────────────────────────────── */}
      {activeSos && (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/40 dark:to-rose-950/40 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0 animate-pulse">
              <Siren size={18} className="text-red-600" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-red-700 dark:text-red-400">
                SOS AKTIF — {activeSos.user?.full_name ?? 'Karyawan'}
              </p>
              <p className="text-[11px] text-red-500 dark:text-red-500 flex items-center gap-1 mt-0.5">
                <MapPin size={10} />
                {activeSos.last_lat != null ? Number(activeSos.last_lat).toFixed(5) : '—'},&nbsp;
                {activeSos.last_lng != null ? Number(activeSos.last_lng).toFixed(5) : '—'}
                <span className="mx-1">·</span>
                <Clock size={10} />
                {new Date(activeSos.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })} WITA
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link href="/dashboard/monitoring"
              className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-[12px] font-semibold hover:bg-red-700 transition-colors flex items-center gap-1.5">
              <MapPin size={12} /> Lihat Peta
            </Link>
            <button
              onClick={() => apiClient.post(`/sos/${activeSos.id}/respond`)}
              className="px-3 py-1.5 rounded-xl border border-red-300 bg-white dark:bg-transparent text-red-700 dark:text-red-400 text-[12px] font-semibold hover:bg-red-50 transition-colors">
              Tandai Respons
            </button>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
            {user?.name ? `Selamat datang, ${user.name.split(' ')[0]} 👋` : 'Dashboard'}
          </h1>
          <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5 flex items-center gap-1.5">
            <Clock size={11} />
            {today()}
          </p>
        </div>
        <Link
          href="/dashboard/tasks"
          className="self-start sm:self-auto h-9 px-4 rounded-xl text-[13px] font-semibold text-white bg-[#007AFF] hover:bg-blue-600 transition-colors flex items-center gap-1.5 shadow-[0_2px_8px_rgba(0,122,255,0.30)]"
        >
          <ListTodo size={14} />
          Buat Tugas
        </Link>
      </div>

      {/* ── Quick Actions (mobile: visible, desktop: hidden) ────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden scrollbar-hide">
        {[
          { href: '/dashboard/attendance',     icon: ClipboardCheck, label: 'Absensi',    color: 'text-[#30D158]', bg: 'bg-[#F0FDF4]' },
          { href: '/dashboard/schedule',       icon: CalendarDays,   label: 'Jadwal',     color: 'text-[#FF9500]', bg: 'bg-[#FFF7ED]' },
          { href: '/dashboard/tasks',          icon: ListTodo,       label: 'Tugas',      color: 'text-[#AF52DE]', bg: 'bg-[#FAF5FF]' },
          { href: '/dashboard/visits',         icon: Navigation,     label: 'Kunjungan',  color: 'text-[#007AFF]', bg: 'bg-[#EFF6FF]' },
          { href: '/dashboard/expense-claims', icon: Receipt,        label: 'Klaim',      color: 'text-[#FF3B30]', bg: 'bg-[#FEF2F2]' },
          { href: '/dashboard/employees',      icon: UserPlus,       label: 'Karyawan',   color: 'text-[#007AFF]', bg: 'bg-[#EFF6FF]' },
          { href: '/dashboard/clients',        icon: Building2,      label: 'Klien',      color: 'text-[#636366]', bg: 'bg-[#F2F2F7]' },
        ].map(({ href, icon: Icon, label, color, bg }) => (
          <Link key={href} href={href}
            className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 hover:shadow-sm transition-all active:scale-95">
            <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${bg}`}>
              <Icon size={16} className={color} strokeWidth={1.9} />
            </div>
            <span className="text-[10px] font-medium text-gray-600 dark:text-white/60 whitespace-nowrap">{label}</span>
          </Link>
        ))}
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              href="/dashboard/attendance"
              icon={Users}
              iconColor="text-[#30D158]"
              iconBg="bg-[#F0FDF4] dark:bg-[rgba(48,209,88,0.15)]"
              label="Hadir Hari Ini"
              value={summary ? summary.hadir : '—'}
              sub={`dari ${summary?.total_aktif ?? 0} karyawan aktif`}
              progress={hadirPct}
              progressColor="bg-[#30D158]"
              badge={
                summary?.terlambat ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded-full">
                    <Timer size={9} /> {summary.terlambat} telat
                  </span>
                ) : undefined
              }
            />
            <StatCard
              href="/dashboard/monitoring"
              icon={Navigation}
              iconColor="text-[#007AFF]"
              iconBg="bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]"
              label="Di Lapangan"
              value={ongoingVisits.length}
              sub={`${visits.filter((v) => v.status === 'check_in').length} kunjungan aktif`}
              badge={
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#007AFF] bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
                  Live
                </span>
              }
            />
            <StatCard
              href="/dashboard/tasks"
              icon={ListTodo}
              iconColor="text-[#FF9500]"
              iconBg="bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)]"
              label="Tugas Hari Ini"
              value={todayTasks.length}
              sub={`${completedTasks} selesai`}
              progress={taskPct}
              progressColor="bg-[#FF9500]"
              badge={
                onHold.length > 0 ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-full">
                    <AlertTriangle size={9} /> {onHold.length} hold
                  </span>
                ) : undefined
              }
            />
            <StatCard
              href="/dashboard/visits"
              icon={FileText}
              iconColor="text-[#5856D6]"
              iconBg="bg-[#F0EFFE] dark:bg-[rgba(88,86,214,0.15)]"
              label="Berita Acara"
              value={reports?.total ?? '—'}
              sub={`${todayReports.length} terbit hari ini`}
              badge={
                todayReports.length > 0 ? (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-violet-600 bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 rounded-full">
                    <TrendingUp size={9} /> +{todayReports.length}
                  </span>
                ) : undefined
              }
            />
          </>
        )}
      </div>

      {/* ── Map + Chart row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* MAP */}
        <div className="lg:col-span-3 bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)] flex items-center justify-center">
                <MapPin size={13} className="text-[#007AFF]" strokeWidth={2} />
              </div>
              <h2 className="text-[13px] font-semibold text-gray-800 dark:text-white">Peta Monitoring Live</h2>
            </div>
            <Link href="/dashboard/monitoring"
              className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:text-blue-700 font-medium">
              Buka penuh <ArrowRight size={11} />
            </Link>
          </div>
          <div className="h-[220px] sm:h-[260px]">
            <DashboardMap
              markers={mapMarkers}
              officeLat={attendanceConfig?.office_lat}
              officeLng={attendanceConfig?.office_lng}
              officeName={companyProfile?.name}
              officeAddress={companyProfile?.address}
            />
          </div>
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-white/[0.03] border-t border-black/[0.04] dark:border-white/[0.06] flex gap-4 text-[11px] text-gray-500 dark:text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#007AFF]" /> {ongoingVisits.length} Kunjungan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-gray-400" /> {(summary?.hadir ?? 0) - ongoingVisits.length} Kantor
            </span>
            {sosAlerts.length > 0 && (
              <span className="flex items-center gap-1.5 text-red-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> {sosAlerts.length} SOS
              </span>
            )}
          </div>
        </div>

        {/* Chart + Approval */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Bar chart */}
          <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4 flex-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-xl bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)] flex items-center justify-center">
                <TrendingUp size={13} className="text-[#34C759]" strokeWidth={2} />
              </div>
              <h2 className="text-[13px] font-semibold text-gray-800 dark:text-white">Kunjungan 7 Hari</h2>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#BFDBFE]" /> Total
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#3B82F6]" /> Selesai
              </span>
            </div>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={chartData} barSize={7} barGap={2}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 10, border: '1px solid #E5E7EB', padding: '6px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  cursor={{ fill: 'rgba(0,0,0,0.03)', radius: 4 }}
                />
                <Bar dataKey="kunjungan" fill="#BFDBFE" radius={[3, 3, 0, 0]} name="Total" />
                <Bar dataKey="selesai"   fill="#3B82F6" radius={[3, 3, 0, 0]} name="Selesai" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Approval panel */}
          {onHold.length > 0 && (
            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-amber-100 dark:border-amber-900/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                  <AlertTriangle size={13} className="text-amber-500" strokeWidth={2} />
                </div>
                <h2 className="text-[13px] font-semibold text-gray-800 dark:text-white">
                  Approval Menunggu
                  <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold rounded-full">{onHold.length}</span>
                </h2>
              </div>
              <div className="space-y-2 max-h-36 overflow-y-auto">
                {onHold.map((t) => (
                  <div key={t.id} className="flex items-center gap-2.5 bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5">
                    <div className="w-6 h-6 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                      <Briefcase size={11} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-gray-800 dark:text-white truncate">{t.title}</p>
                      <p className="text-[10px] text-gray-400 dark:text-white/35 truncate">
                        {t.assigned_user?.full_name ?? '—'}
                        {t.pending_hold?.reason_notes && (
                          <span className="ml-1 italic">· {t.pending_hold.reason_notes}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => t.pending_hold && approveMut.mutate({ taskId: t.id, holdId: t.pending_hold.id })}
                        disabled={!t.pending_hold || approveMut.isPending}
                        className="w-7 h-7 rounded-xl bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 flex items-center justify-center transition-colors disabled:opacity-40"
                        title="Setujui penundaan"
                      >
                        <Check size={13} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => t.pending_hold && rejectMut.mutate({ taskId: t.id, holdId: t.pending_hold.id })}
                        disabled={!t.pending_hold || rejectMut.isPending}
                        className="w-7 h-7 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 flex items-center justify-center transition-colors disabled:opacity-40"
                        title="Tolak penundaan"
                      >
                        <X size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom 3-col ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Dispatch & Tugas */}
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4">
          <SectionHeader title="Dispatch & Tugas" href="/dashboard/tasks" />
          {todayTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-300 dark:text-white/20">
              <ListTodo size={28} strokeWidth={1.2} />
              <p className="text-[11px] mt-2">Tidak ada tugas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-2.5 py-1.5">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 ${PRIORITY_COLOR[t.priority] ?? 'bg-gray-100 text-gray-500'}`}>
                    {PRIORITY_LABEL[t.priority] ?? t.priority}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-gray-800 dark:text-white truncate">{t.title}</p>
                    <p className="text-[10px] text-gray-400 dark:text-white/35 truncate">{t.assigned_user?.full_name ?? '—'}</p>
                  </div>
                  {(t.status === 'completed' || t.status === 'done') && (
                    <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Absensi Hari Ini */}
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4">
          <SectionHeader title="Absensi Hari Ini" href="/dashboard/attendance" />
          <div className="space-y-2.5 mb-4">
            {[
              { label: 'Hadir',      value: summary?.hadir       ?? 0, icon: CheckCircle2, color: 'text-[#30D158]', bg: 'bg-[#F0FDF4]' },
              { label: 'Terlambat',  value: summary?.terlambat   ?? 0, icon: Timer,        color: 'text-amber-500',  bg: 'bg-amber-50'   },
              { label: 'Alfa',       value: summary?.alfa        ?? 0, icon: X,            color: 'text-red-500',    bg: 'bg-red-50'     },
              { label: 'Total Aktif',value: summary?.total_aktif ?? 0, icon: Users,        color: 'text-[#007AFF]',  bg: 'bg-[#EFF6FF]'  },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="flex items-center gap-2.5">
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${bg} dark:bg-transparent`}>
                  <Icon size={12} className={color} strokeWidth={2} />
                </div>
                <span className="text-[12px] text-gray-500 dark:text-white/50 flex-1">{label}</span>
                <span className={`text-[14px] font-bold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#30D158] rounded-full transition-all duration-700" style={{ width: `${hadirPct}%` }} />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-white/30 mt-1.5 text-right">{hadirPct}% kehadiran</p>
        </div>

        {/* Notifikasi Sistem */}
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4">
          <SectionHeader title="Notifikasi Sistem" href="/dashboard/announcements" />
          <div className="space-y-2">
            {sosAlerts.length > 0 && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40">
                <div className="w-7 h-7 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                  <Siren size={13} className="text-red-600" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-red-700 dark:text-red-400">{sosAlerts.length} SOS Aktif</p>
                  <p className="text-[10px] text-red-400 truncate">{sosAlerts.map((s) => s.user?.full_name ?? '—').join(', ')}</p>
                </div>
              </div>
            )}
            {(reports?.total ?? 0) > 0 && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-900/40">
                <div className="w-7 h-7 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center flex-shrink-0">
                  <FileText size={13} className="text-violet-600" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-400">{reports?.total} Berita Acara</p>
                  <p className="text-[10px] text-violet-400">{todayReports.length} terbit hari ini</p>
                </div>
              </div>
            )}
            {onHold.length > 0 && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40">
                <div className="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={13} className="text-amber-600" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">{onHold.length} Hold menunggu</p>
                  <p className="text-[10px] text-amber-400">perlu persetujuan</p>
                </div>
              </div>
            )}
            {pendingAnnouncements.length > 0 && (
              <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40">
                <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                  <Bell size={13} className="text-blue-600" strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">{pendingAnnouncements.length} Pengumuman menunggu</p>
                  <p className="text-[10px] text-blue-400 truncate">perlu persetujuan manager</p>
                </div>
              </div>
            )}
            {recentAnnouncements.map((ann) => (
              <div key={ann.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06]">
                <div className="w-7 h-7 rounded-xl bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                  <Megaphone size={13} className="text-[#007AFF]" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 truncate">{ann.title}</p>
                  <p className="text-[10px] text-gray-400">
                    {ann.sent_at ? new Date(ann.sent_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Makassar' }) : '—'}
                  </p>
                </div>
              </div>
            ))}
            {sosAlerts.length === 0 && (reports?.total ?? 0) === 0 && onHold.length === 0 && pendingAnnouncements.length === 0 && recentAnnouncements.length === 0 && (
              <div className="flex flex-col items-center justify-center py-6 text-gray-300 dark:text-white/20">
                <Bell size={28} strokeWidth={1.2} />
                <p className="text-[11px] mt-2">Tidak ada notifikasi</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Kunjungan Aktif + Recent BA ─────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Kunjungan Aktif */}
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4">
          <SectionHeader title="Kunjungan Aktif" href="/dashboard/visits" />
          {ongoingVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-300 dark:text-white/20">
              <Navigation size={28} strokeWidth={1.2} />
              <p className="text-[11px] mt-2">Tidak ada kunjungan aktif</p>
            </div>
          ) : (
            <div className="space-y-1">
              {ongoingVisits.slice(0, 5).map((v) => (
                <div key={v.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-white/[0.04] last:border-0">
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)] flex items-center justify-center flex-shrink-0">
                    <span className="text-[11px] font-bold text-[#007AFF]">
                      {v.user?.full_name?.charAt(0) ?? '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-gray-800 dark:text-white truncate">
                      {v.user?.full_name ?? '—'}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-white/35 truncate">
                      {v.client?.name ?? 'Tanpa klien'}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-[#007AFF] bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] animate-pulse" />
                    Aktif
                  </span>
                </div>
              ))}
              {ongoingVisits.length > 5 && (
                <Link href="/dashboard/visits"
                  className="flex items-center justify-center gap-1 pt-2 text-[11px] text-[#007AFF] hover:text-blue-700 font-medium">
                  +{ongoingVisits.length - 5} lainnya <ArrowRight size={11} />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Recent Berita Acara */}
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.06] dark:border-white/10 p-4">
          <SectionHeader title="Berita Acara Terbaru" href="/dashboard/service-reports" />
          {(reports?.items?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-gray-300 dark:text-white/20">
              <FileText size={28} strokeWidth={1.2} />
              <p className="text-[11px] mt-2">Belum ada berita acara</p>
            </div>
          ) : (
            <div className="space-y-1">
              {reports?.items?.slice(0, 5).map((r) => {
                const isToday = r.created_at?.startsWith(new Date().toISOString().split('T')[0]);
                return (
                  <div key={r.id} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-white/[0.04] last:border-0">
                    <div className="w-8 h-8 rounded-xl bg-[#F0EFFE] dark:bg-[rgba(88,86,214,0.15)] flex items-center justify-center flex-shrink-0">
                      <FileText size={13} className="text-[#5856D6]" strokeWidth={1.9} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-medium text-gray-800 dark:text-white truncate">
                        {r.report_number ?? 'Draft'}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-white/35 truncate">
                        {r.visit?.client?.name ?? '—'} · {new Date(r.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Makassar' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {isToday && (
                        <span className="text-[9px] font-bold text-violet-600 bg-violet-50 dark:bg-violet-900/20 px-1.5 py-0.5 rounded-full">
                          Baru
                        </span>
                      )}
                      <ExternalLink size={11} className="text-gray-300 dark:text-white/20" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
