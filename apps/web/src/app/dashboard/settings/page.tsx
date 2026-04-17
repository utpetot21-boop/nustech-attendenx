'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import {
  Building2, ClipboardCheck, UmbrellaOff, Receipt, Radio,
  ShieldCheck, Briefcase, Layers, MessageCircle, HardDrive,
  Siren, Pencil, Trash2, Plus, X, Check, RefreshCw,
  Lock, ChevronDown, ChevronUp, ChevronRight, ChevronLeft,
  Settings, Users, CalendarClock, type LucideIcon,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
type AttendanceConfig = { id: string; late_tolerance_minutes: number; alfa_threshold_hours: number; objection_window_hours: number; check_in_radius_meter: number; office_lat: number | null; office_lng: number | null; effective_date: string; updated_at: string };
type LeaveConfig      = { id: string; max_leave_days_per_year: number; monthly_accrual_amount: number; holiday_work_credit: number; alfa_deduction_amount: number; objection_window_hours: number; expiry_reminder_days: number[]; effective_date: string; updated_at: string };
type ExpenseConfig    = { id: string; category: string; max_amount: number; receipt_required_above: number; is_active: boolean };
type WhatsappStatus   = { connected: boolean; phone: string | null; qr: string | null };
type CompanyProfile   = { id: string; name: string; address: string; phone: string; email: string; website: string; logo_url: string | null; updated_at: string };
type BackupRecord     = { id: string; type: 'full' | 'incremental'; status: 'running' | 'success' | 'failed'; size_bytes: number | null; file_path: string | null; checksum: string | null; error_msg: string | null; started_at: string; finished_at: string | null };
type EmergencyContact = { id: string; name: string; role: string; phone: string; priority: number; is_active: boolean };
type RoleItem         = { id: string; name: string; can_delegate: boolean; can_approve: boolean; permissions: string[]; is_system: boolean };
type DeptItem         = { id: string; name: string; code: string | null; schedule_type: string | null };
type PositionItem     = { id: string; name: string; created_at: string };

type NavKey = 'profile' | 'attendance' | 'leave' | 'leave-balance' | 'claims' | 'dispatch' | 'whatsapp' | 'backup' | 'contacts' | 'roles' | 'positions' | 'departments';
type LeaveBalance    = { id: string; user_id: string; year: number; balance_days: number; accrued_monthly: number; accrued_holiday: number; used_days: number; expired_days: number; user: { id: string; full_name: string; employee_id?: string } };
type LeaveBalanceLog = { id: string; user_id: string; type: string; amount: number; balance_after: number; notes: string | null; created_at: string };

// ── Nav config ───────────────────────────────────────────────────────────────
const NAV_GROUPS: { group: string; items: { key: NavKey; label: string; Icon: LucideIcon; color: string; bg: string }[] }[] = [
  {
    group: 'Perusahaan',
    items: [
      { key: 'profile', label: 'Profil Perusahaan', Icon: Building2, color: 'text-[#007AFF]', bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]' },
    ],
  },
  {
    group: 'Aturan',
    items: [
      { key: 'attendance',  label: 'Aturan Absensi',    Icon: ClipboardCheck, color: 'text-[#34C759]',  bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]'    },
      { key: 'leave',         label: 'Aturan Cuti',        Icon: UmbrellaOff,    color: 'text-[#32ADE6]',  bg: 'bg-[#EFF9FF] dark:bg-[rgba(50,173,230,0.15)]'   },
      { key: 'leave-balance', label: 'Saldo Cuti Manual',  Icon: CalendarClock,  color: 'text-[#34C759]',  bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]'    },
      { key: 'claims',      label: 'Batas Klaim Biaya',  Icon: Receipt,        color: 'text-[#FF3B30]',  bg: 'bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)]'    },
      { key: 'dispatch',    label: 'Dispatch & Tugas',   Icon: Radio,          color: 'text-[#AF52DE]',  bg: 'bg-[#F5F3FF] dark:bg-[rgba(175,82,222,0.15)]'   },
    ],
  },
  {
    group: 'SDM',
    items: [
      { key: 'roles',       label: 'Role Sistem',   Icon: ShieldCheck, color: 'text-[#FF9500]', bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)]' },
      { key: 'positions',   label: 'Jabatan',       Icon: Briefcase,   color: 'text-[#5856D6]', bg: 'bg-[#F0EFFE] dark:bg-[rgba(88,86,214,0.15)]'  },
      { key: 'departments', label: 'Departemen',    Icon: Layers,      color: 'text-[#636366]', bg: 'bg-[#F2F2F7] dark:bg-[rgba(99,99,102,0.20)]'  },
    ],
  },
  {
    group: 'Sistem',
    items: [
      { key: 'whatsapp', label: 'WhatsApp',          Icon: MessageCircle, color: 'text-[#34C759]',  bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]'  },
      { key: 'backup',   label: 'Backup & Restore',  Icon: HardDrive,     color: 'text-[#5856D6]',  bg: 'bg-[#F0EFFE] dark:bg-[rgba(88,86,214,0.15)]'   },
      { key: 'contacts', label: 'Kontak Darurat',    Icon: Siren,         color: 'text-[#FF3B30]',  bg: 'bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)]'   },
    ],
  },
];

const ALL_NAV = NAV_GROUPS.flatMap((g) => g.items);

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) { return `Rp ${Number(n ?? 0).toLocaleString('id-ID')}`; }
function fmtBytes(bytes: number | null): string {
  if (!bytes) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

const CATEGORY_LABELS: Record<string, string> = { transport: 'Transport', parkir: 'Parkir', material: 'Material', konsumsi: 'Konsumsi', akomodasi: 'Akomodasi', lainnya: 'Lainnya' };
const PERM_LABELS: Record<string, string> = {
  'users:create': 'Buat User', 'users:read': 'Lihat User', 'users:update': 'Edit User', 'users:delete': 'Hapus User',
  'schedule:manage': 'Kelola Jadwal', 'attendance:manage': 'Kelola Absensi', 'attendance:own': 'Absensi Sendiri',
  'leave:approve': 'Approve Cuti', 'leave:request': 'Ajukan Cuti',
  'task:assign': 'Assign Tugas', 'task:delegate': 'Delegasi Tugas', 'task:own': 'Tugas Sendiri',
  'visit:manage': 'Kelola Kunjungan', 'visit:own': 'Kunjungan Sendiri',
  'report:view': 'Lihat Laporan', 'report:own': 'Laporan Sendiri',
  'settings:manage': 'Kelola Pengaturan',
};
const SCHED_LABELS: Record<string, string> = { shift: 'Shift', office_hours: 'Office Hours' };

// ── Shared UI Primitives ─────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function SField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">{label}</label>
      {hint && <p className="text-[11px] text-gray-400 dark:text-white/30">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition';
const numInputCls = inputCls + ' text-right w-28';

function ConfigRow({ label, value, locked }: { label: string; value: React.ReactNode; locked?: boolean }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-sm text-gray-600 dark:text-white/60">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm text-gray-900 dark:text-white">{value}</span>
        {locked && (
          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-white/30 border border-gray-200 dark:border-white/[0.08] uppercase tracking-wider">
            <Lock size={8} />Terkunci
          </span>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-gray-500 dark:text-white/40 w-36 shrink-0">{label}</span>
      <span className="font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#007AFF]' : 'bg-gray-200 dark:bg-white/20'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
    </button>
  );
}

function PanelHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-5 gap-3">
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500 dark:text-white/50 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function PrimaryBtn({ onClick, disabled, loading, children }: { onClick?: () => void; disabled?: boolean; loading?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed">
      {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : children}
    </button>
  );
}

function SecondaryBtn({ onClick, children }: { onClick?: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-5 py-2.5 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
      {children}
    </button>
  );
}

// Generic modal wrapper
function Modal({ title, Icon, onClose, children, footer }: { title: string; Icon: LucideIcon; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-md shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[10px] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)] flex items-center justify-center">
              <Icon size={15} className="text-[#007AFF]" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/20 transition">
            <X size={13} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-4">{children}</div>
        <div className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3">{footer}</div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activePanel, setActivePanel] = useState<NavKey | null>(null);
  const activeItem = activePanel ? ALL_NAV.find((n) => n.key === activePanel) : null;

  // ── HOME: card grid ────────────────────────────────────────────────────────
  if (!activePanel) {
    return (
      <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950 p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[#F2F2F7] dark:bg-white/[0.08] border border-black/[0.06] dark:border-white/[0.10] flex items-center justify-center">
            <Settings size={20} className="text-[#636366] dark:text-white/50" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Pengaturan</h1>
            <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">Kelola konfigurasi sistem</p>
          </div>
        </div>

        {/* Category groups */}
        <div className="space-y-6">
          {NAV_GROUPS.map((group) => (
            <div key={group.group}>
              <p className="text-[11px] font-bold uppercase tracking-[0.7px] text-gray-400 dark:text-white/30 mb-3 px-1">
                {group.group}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.items.map(({ key, label, Icon, color, bg }) => (
                  <button
                    key={key}
                    onClick={() => setActivePanel(key)}
                    className="group bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4 text-left hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-150"
                  >
                    <div className={`w-10 h-10 rounded-[11px] flex items-center justify-center mb-3 ${bg}`}>
                      <Icon size={20} strokeWidth={1.8} className={color} />
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{label}</p>
                      <ChevronRight size={14} className="text-gray-300 dark:text-white/20 flex-shrink-0 group-hover:text-gray-400 dark:group-hover:text-white/40 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── PANEL: full-width with back bar ────────────────────────────────────────
  const ActiveIcon = activeItem!.Icon;

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">
      {/* Sticky back bar */}
      <div className="sticky top-0 z-10 bg-white/85 dark:bg-[#1C1C1E]/85 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.07] px-4 sm:px-6 py-3 flex items-center gap-3">
        <button
          onClick={() => setActivePanel(null)}
          className="flex items-center gap-1.5 text-[#007AFF] text-sm font-medium hover:opacity-70 transition-opacity"
        >
          <ChevronLeft size={16} strokeWidth={2.5} />
          Pengaturan
        </button>
        <span className="text-gray-300 dark:text-white/20 text-sm">/</span>
        <div className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-[5px] flex items-center justify-center ${activeItem!.bg}`}>
            <ActiveIcon size={11} className={activeItem!.color} strokeWidth={2} />
          </div>
          <span className="text-sm font-semibold text-gray-700 dark:text-white/70">{activeItem!.label}</span>
        </div>
      </div>

      {/* Panel content */}
      <div className="p-4 sm:p-6 lg:p-8">
        {activePanel === 'profile'     && <ProfilePanel />}
        {activePanel === 'attendance'  && <AttendancePanel />}
        {activePanel === 'leave'         && <LeavePanel />}
        {activePanel === 'leave-balance' && <LeaveBalancePanel />}
        {activePanel === 'claims'      && <ClaimsPanel />}
        {activePanel === 'dispatch'    && <DispatchPanel />}
        {activePanel === 'whatsapp'    && <WhatsappPanel />}
        {activePanel === 'backup'      && <BackupPanel />}
        {activePanel === 'contacts'    && <ContactsPanel />}
        {activePanel === 'roles'       && <RolesPanel />}
        {activePanel === 'positions'   && <PositionsPanel />}
        {activePanel === 'departments' && <DepartmentsPanel />}
      </div>
    </div>
  );
}

// ── Profile Panel ─────────────────────────────────────────────────────────────
function ProfilePanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<CompanyProfile>>({});

  const { data: profile, isLoading } = useQuery<CompanyProfile>({
    queryKey: ['settings-profile'],
    queryFn: () => apiClient.get('/settings/profile').then((r) => r.data),
  });

  const updateMut = useMutation({
    mutationFn: (dto: Partial<CompanyProfile>) => apiClient.patch('/settings/profile', dto).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings-profile'] }); setEditing(false); toast.success('Profil perusahaan berhasil disimpan'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyimpan profil perusahaan')),
  });

  if (isLoading) return <Spinner />;

  const handleEdit = () => { setForm(profile ?? {}); setEditing(true); };

  return (
    <div className="max-w-2xl">
      <PanelHeader title="Profil Perusahaan" subtitle="Informasi dasar perusahaan untuk laporan dan dokumen"
        action={!editing && <PrimaryBtn onClick={handleEdit}><Pencil size={14} />Edit</PrimaryBtn>} />

      {editing ? (
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-5 space-y-4">
          <SField label="Nama Perusahaan">
            <input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="PT. Nustech Indonesia" />
          </SField>
          <SField label="Alamat">
            <textarea value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputCls + ' resize-none h-20'} placeholder="Jl. ..." />
          </SField>
          <div className="grid grid-cols-2 gap-4">
            <SField label="No. Telp"><input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="021-..." /></SField>
            <SField label="Email"><input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="info@..." /></SField>
          </div>
          <SField label="Website"><input value={form.website ?? ''} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputCls} placeholder="https://..." /></SField>
          <div className="flex gap-3 pt-1">
            <PrimaryBtn onClick={() => updateMut.mutate(form)} loading={updateMut.isPending}>Simpan Perubahan</PrimaryBtn>
            <SecondaryBtn onClick={() => setEditing(false)}>Batal</SecondaryBtn>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-5 space-y-3.5">
          <InfoRow label="Nama Perusahaan" value={profile?.name ?? '—'} />
          <InfoRow label="Alamat"          value={profile?.address || '—'} />
          <InfoRow label="No. Telp"        value={profile?.phone   || '—'} />
          <InfoRow label="Email"           value={profile?.email   || '—'} />
          <InfoRow label="Website"         value={profile?.website || '—'} />
          <div className="pt-2 border-t border-black/[0.05] dark:border-white/[0.06] text-xs text-gray-400 dark:text-white/25">
            Terakhir diperbarui: {profile?.updated_at ? new Date(profile.updated_at).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '—'}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Attendance Panel ──────────────────────────────────────────────────────────
function AttendancePanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<AttendanceConfig>>({});

  const { data: config, isLoading } = useQuery<AttendanceConfig>({
    queryKey: ['settings-attendance'],
    queryFn: () => apiClient.get('/settings/attendance').then((r) => r.data),
  });

  const updateMut = useMutation({
    mutationFn: (dto: Partial<AttendanceConfig>) => apiClient.patch('/settings/attendance', dto).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings-attendance'] }); setEditing(false); toast.success('Aturan absensi berhasil disimpan'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyimpan aturan absensi')),
  });

  if (isLoading) return <Spinner />;

  const handleEdit = () => { setForm(config ?? {}); setEditing(true); };

  return (
    <div className="max-w-2xl">
      <PanelHeader title="Aturan Absensi" subtitle="Toleransi, alfa, dan konfigurasi geofence"
        action={!editing && <PrimaryBtn onClick={handleEdit}><Pencil size={14} />Edit</PrimaryBtn>} />

      {editing ? (
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-5 space-y-5">
          <SField label="Toleransi Keterlambatan" hint="Menit setelah jam mulai sebelum dianggap terlambat">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={480} value={form.late_tolerance_minutes ?? 60}
                onChange={(e) => setForm({ ...form, late_tolerance_minutes: Number(e.target.value) })} className={numInputCls} />
              <span className="text-sm text-gray-500 dark:text-white/40">menit</span>
            </div>
          </SField>
          <SField label="Batas Alfa" hint="Jam setelah jam mulai → otomatis tandai alfa">
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={12} value={form.alfa_threshold_hours ?? 4}
                onChange={(e) => setForm({ ...form, alfa_threshold_hours: Number(e.target.value) })} className={numInputCls} />
              <span className="text-sm text-gray-500 dark:text-white/40">jam dari jam mulai</span>
            </div>
          </SField>
          <SField label="Window Keberatan Alfa" hint="Berapa jam karyawan boleh mengajukan keberatan alfa">
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={168} value={form.objection_window_hours ?? 24}
                onChange={(e) => setForm({ ...form, objection_window_hours: Number(e.target.value) })} className={numInputCls} />
              <span className="text-sm text-gray-500 dark:text-white/40">jam</span>
            </div>
          </SField>
          <div className="border-t border-black/[0.05] dark:border-white/[0.06] pt-5">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-white/40 mb-4">Geofence Absensi</p>
            <div className="space-y-4">
              <SField label="Radius Check-In" hint="Jarak maksimum dari kantor agar check-in valid (10–5000 meter)">
                <div className="flex items-center gap-2">
                  <input type="number" min={10} max={5000} value={form.check_in_radius_meter ?? 100}
                    onChange={(e) => setForm({ ...form, check_in_radius_meter: Number(e.target.value) })} className={numInputCls} />
                  <span className="text-sm text-gray-500 dark:text-white/40">meter</span>
                </div>
              </SField>
              <SField label="Latitude Kantor" hint="Contoh: -8.583333">
                <input type="number" step="0.000001" value={form.office_lat ?? ''}
                  onChange={(e) => setForm({ ...form, office_lat: e.target.value ? Number(e.target.value) : null })}
                  className={inputCls} placeholder="-8.583333" />
              </SField>
              <SField label="Longitude Kantor" hint="Contoh: 116.116667">
                <input type="number" step="0.000001" value={form.office_lng ?? ''}
                  onChange={(e) => setForm({ ...form, office_lng: e.target.value ? Number(e.target.value) : null })}
                  className={inputCls} placeholder="116.116667" />
              </SField>
              <div className="bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.10)] border border-[#FED7AA] dark:border-[rgba(255,149,0,0.25)] rounded-xl px-4 py-3 text-xs text-[#FF9500]">
                Jika karyawan punya lokasi kerja spesifik, koordinat lokasi itu yang dipakai. Koordinat kantor di atas sebagai fallback global.
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <PrimaryBtn onClick={() => updateMut.mutate(form)} loading={updateMut.isPending}>Simpan Perubahan</PrimaryBtn>
            <SecondaryBtn onClick={() => setEditing(false)}>Batal</SecondaryBtn>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] divide-y divide-black/[0.04] dark:divide-white/[0.05]">
          <ConfigRow label="Toleransi Keterlambatan" value={`${config?.late_tolerance_minutes ?? 60} menit`} />
          <ConfigRow label="Durasi Shift" value="8 jam" locked />
          <ConfigRow label="Batas Alfa" value={`${config?.alfa_threshold_hours ?? 4} jam dari jam mulai`} />
          <ConfigRow label="Window Keberatan Alfa" value={`${config?.objection_window_hours ?? 24} jam`} />
          <ConfigRow label="Radius Check-In" value={`${config?.check_in_radius_meter ?? 100} meter`} />
          <ConfigRow label="Koordinat Kantor" value={config?.office_lat && config?.office_lng ? `${config.office_lat}, ${config.office_lng}` : 'Belum diset'} />
        </div>
      )}
    </div>
  );
}

// ── Leave Balance Panel ───────────────────────────────────────────────────────
function LeaveBalancePanel() {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [selected, setSelected] = useState<LeaveBalance | null>(null);
  const [adjForm, setAdjForm] = useState({ amount: '', notes: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: balances = [], isLoading } = useQuery<LeaveBalance[]>({
    queryKey: ['leave-balances', year],
    queryFn: () => apiClient.get(`/leave/balances?year=${year}`).then((r) => r.data),
  });

  const { data: logs = [] } = useQuery<LeaveBalanceLog[]>({
    queryKey: ['leave-logs', selected?.user_id],
    queryFn: () => apiClient.get(`/leave/balance/${selected!.user_id}/logs`).then((r) => r.data),
    enabled: !!selected,
  });

  const adjustMut = useMutation({
    mutationFn: ({ userId, amount, notes }: { userId: string; amount: number; notes: string }) =>
      apiClient.post(`/leave/balance/${userId}/adjust`, { amount, notes, year }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      qc.invalidateQueries({ queryKey: ['leave-logs', selected?.user_id] });
      setAdjForm({ amount: '', notes: '' });
      toast.success('Penyesuaian saldo berhasil disimpan');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyesuaikan saldo')),
  });

  const deleteMut = useMutation({
    mutationFn: (logId: string) => apiClient.delete(`/leave/balance/log/${logId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leave-balances'] });
      qc.invalidateQueries({ queryKey: ['leave-logs', selected?.user_id] });
      toast.success('Log penyesuaian dihapus');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menghapus log')),
  });

  const handleAdjust = () => {
    const amount = parseFloat(adjForm.amount);
    if (isNaN(amount) || !adjForm.notes.trim() || !selected) return;
    adjustMut.mutate({ userId: selected.user_id, amount, notes: adjForm.notes });
  };

  const manualLogs = logs.filter((l) => l.type === 'manual_adjustment');

  const yearOptions = [year - 1, year, year + 1];

  return (
    <div className="max-w-3xl space-y-6">
      <PanelHeader
        title="Saldo Cuti Manual"
        subtitle="Tambah, edit, atau hapus penyesuaian saldo cuti karyawan"
      />

      {/* Year selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500 dark:text-white/50">Tahun:</span>
        <div className="flex gap-2">
          {yearOptions.map((y) => (
            <button key={y} onClick={() => setYear(y)}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition ${year === y ? 'bg-[#007AFF] text-white' : 'bg-white dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.09]'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>

      {/* Balance table */}
      {isLoading ? <Spinner /> : (
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_80px_80px_auto] text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-white/30 px-5 py-3 border-b border-black/[0.05] dark:border-white/[0.07]">
            <span>Karyawan</span><span className="text-center">Saldo</span><span className="text-center">Digunakan</span><span className="text-center">Akrual</span><span />
          </div>
          {balances.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400 dark:text-white/30">Belum ada data saldo tahun {year}</div>
          )}
          {balances.map((b) => (
            <div key={b.id} className="grid grid-cols-[1fr_80px_80px_80px_auto] items-center px-5 py-3.5 border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{b.user?.full_name ?? '—'}</p>
                {b.user?.employee_id && <p className="text-xs text-gray-400 dark:text-white/30">{b.user.employee_id}</p>}
              </div>
              <p className="text-center text-sm font-bold text-[#34C759]">{Number(b.balance_days).toFixed(1)}</p>
              <p className="text-center text-sm text-gray-500 dark:text-white/50">{Number(b.used_days).toFixed(1)}</p>
              <p className="text-center text-sm text-gray-500 dark:text-white/50">{Number(b.accrued_monthly).toFixed(1)}</p>
              <button onClick={() => { setSelected(b); setAdjForm({ amount: '', notes: '' }); }}
                className="ml-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] text-xs font-semibold transition">
                <Plus size={12} />Sesuaikan
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Adjust modal */}
      {selected && (
        <Modal title={`Saldo Cuti — ${selected.user?.full_name}`} Icon={CalendarClock} onClose={() => setSelected(null)}
          footer={
            <>
              <PrimaryBtn onClick={handleAdjust} loading={adjustMut.isPending}
                disabled={!adjForm.amount || !adjForm.notes.trim()}>
                <Check size={14} />Simpan
              </PrimaryBtn>
              <SecondaryBtn onClick={() => setSelected(null)}>Batal</SecondaryBtn>
            </>
          }>

          {/* Current balance info */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Saldo', value: `${Number(selected.balance_days).toFixed(1)} hari`, color: 'text-[#34C759]' },
              { label: 'Digunakan', value: `${Number(selected.used_days).toFixed(1)} hari`, color: 'text-[#FF9500]' },
              { label: 'Kadaluarsa', value: `${Number(selected.expired_days).toFixed(1)} hari`, color: 'text-[#FF3B30]' },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 dark:bg-white/[0.05] rounded-xl p-3 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Form tambah penyesuaian */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-white/30">Penyesuaian Baru</p>
            <SField label="Jumlah Hari" hint="Gunakan angka positif untuk tambah, negatif untuk kurangi">
              <input type="number" step="0.5" placeholder="contoh: 2 atau -1.5"
                value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })}
                className={inputCls} />
            </SField>
            <SField label="Keterangan">
              <input placeholder="Alasan penyesuaian, misal: Saldo cuti 2023 belum terinput"
                value={adjForm.notes} onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })}
                className={inputCls} />
            </SField>
          </div>

          {/* Riwayat penyesuaian manual */}
          {manualLogs.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-white/30">Riwayat Penyesuaian Manual</p>
              {manualLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${log.amount >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
                      {log.amount >= 0 ? '+' : ''}{log.amount} hari
                    </p>
                    <p className="text-xs text-gray-500 dark:text-white/40 truncate">{log.notes ?? '—'}</p>
                    <p className="text-[11px] text-gray-400 dark:text-white/25 mt-0.5">
                      {new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  {confirmDeleteId === log.id ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { deleteMut.mutate(log.id); setConfirmDeleteId(null); }}
                        disabled={deleteMut.isPending}
                        className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-[11px] font-semibold transition"
                      >
                        Hapus
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-white/[0.08] text-gray-600 dark:text-white/60 text-[11px] font-semibold transition"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(log.id)}
                      disabled={deleteMut.isPending}
                      className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 flex items-center justify-center text-red-500 transition shrink-0"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ── Leave Panel ───────────────────────────────────────────────────────────────
function LeavePanel() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<LeaveConfig>>({});

  const { data: config, isLoading } = useQuery<LeaveConfig>({
    queryKey: ['leave-config'],
    queryFn: () => apiClient.get('/leave/config').then((r) => r.data),
  });

  const updateMut = useMutation({
    mutationFn: (dto: Partial<LeaveConfig>) => apiClient.patch('/leave/config', dto).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave-config'] }); setEditing(false); toast.success('Aturan cuti berhasil disimpan'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyimpan aturan cuti')),
  });

  if (isLoading) return <Spinner />;
  const handleEdit = () => { setForm(config ?? {}); setEditing(true); };

  return (
    <div className="max-w-2xl">
      <PanelHeader title="Aturan Cuti" subtitle="Kebijakan cuti tahunan, akrual, dan notifikasi hangus"
        action={!editing && <PrimaryBtn onClick={handleEdit}><Pencil size={14} />Edit</PrimaryBtn>} />

      {editing ? (
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-5 space-y-5">
          <SField label="Maks. Cuti per Tahun">
            <div className="flex items-center gap-2">
              <input type="number" min={1} max={60} value={form.max_leave_days_per_year ?? 12}
                onChange={(e) => setForm({ ...form, max_leave_days_per_year: Number(e.target.value) })} className={numInputCls} />
              <span className="text-sm text-gray-500 dark:text-white/40">hari</span>
            </div>
          </SField>
          <SField label="Akrual Bulanan">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={5} step={0.5} value={form.monthly_accrual_amount ?? 1}
                onChange={(e) => setForm({ ...form, monthly_accrual_amount: Number(e.target.value) })} className={numInputCls} />
              <span className="text-sm text-gray-500 dark:text-white/40">hari/bulan</span>
            </div>
          </SField>
          <SField label="Kompensasi Libur Kerja">
            <div className="flex items-center gap-2">
              <input type="number" min={0} max={5} step={0.5} value={form.holiday_work_credit ?? 1}
                onChange={(e) => setForm({ ...form, holiday_work_credit: Number(e.target.value) })} className={numInputCls} />
              <span className="text-sm text-gray-500 dark:text-white/40">hari per hari libur</span>
            </div>
          </SField>
          <SField label="Reminder Hangus Cuti" hint="H-X sebelum cuti hangus, pisahkan dengan koma">
            <input value={(form.expiry_reminder_days ?? [30, 7]).join(', ')}
              onChange={(e) => { const vals = e.target.value.split(',').map((v) => parseInt(v.trim())).filter((n) => !isNaN(n)); setForm({ ...form, expiry_reminder_days: vals }); }}
              className={inputCls} placeholder="30, 7" />
          </SField>
          <div className="flex gap-3 pt-1">
            <PrimaryBtn onClick={() => updateMut.mutate(form)} loading={updateMut.isPending}>Simpan Perubahan</PrimaryBtn>
            <SecondaryBtn onClick={() => setEditing(false)}>Batal</SecondaryBtn>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] divide-y divide-black/[0.04] dark:divide-white/[0.05]">
          <ConfigRow label="Maks. Cuti per Tahun"  value={`${config?.max_leave_days_per_year ?? 12} hari`} />
          <ConfigRow label="Akrual Bulanan"         value={`${config?.monthly_accrual_amount ?? 1} hari`} />
          <ConfigRow label="Kompensasi Libur Kerja" value={`${config?.holiday_work_credit ?? 1} hari`} />
          <ConfigRow label="Reminder Hangus"        value={`H-${(config?.expiry_reminder_days ?? [30, 7]).join(' dan H-')}`} />
        </div>
      )}
    </div>
  );
}

// ── Claims Panel ──────────────────────────────────────────────────────────────
function ClaimsPanel() {
  const qc = useQueryClient();
  const [editRow,  setEditRow]  = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ max_amount: 0, receipt_required_above: 0 });

  const { data: configs = [], isLoading } = useQuery<ExpenseConfig[]>({
    queryKey: ['expense-config'],
    queryFn: () => apiClient.get('/expense-claims/config').then((r) => r.data),
  });

  const updateMut = useMutation({
    mutationFn: ({ category, ...dto }: { category: string; max_amount: number; receipt_required_above: number }) =>
      apiClient.post(`/expense-claims/config/${category}`, dto).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expense-config'] }); setEditRow(null); toast.success('Batas klaim biaya berhasil disimpan'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyimpan batas klaim biaya')),
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <PanelHeader title="Batas Klaim Biaya" subtitle="Batas nominal dan kewajiban nota per kategori" />
      <div className="space-y-3">
        {configs.map((cfg) => (
          <div key={cfg.id} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4">
            {editRow === cfg.category ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{CATEGORY_LABELS[cfg.category] ?? cfg.category}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${cfg.is_active ? 'bg-[#F0FDF4] text-[#34C759] border-[#BBF7D0]' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/[0.06]'}`}>
                    {cfg.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SField label="Batas Maksimum">
                    <input type="number" value={editForm.max_amount}
                      onChange={(e) => setEditForm({ ...editForm, max_amount: Number(e.target.value) })}
                      className={inputCls} step={10000} />
                  </SField>
                  <SField label="Wajib Nota Di Atas">
                    <input type="number" value={editForm.receipt_required_above}
                      onChange={(e) => setEditForm({ ...editForm, receipt_required_above: Number(e.target.value) })}
                      className={inputCls} step={10000} />
                  </SField>
                </div>
                <div className="flex gap-2">
                  <PrimaryBtn onClick={() => updateMut.mutate({ category: cfg.category, ...editForm })} loading={updateMut.isPending}>
                    <Check size={14} />Simpan
                  </PrimaryBtn>
                  <SecondaryBtn onClick={() => setEditRow(null)}>Batal</SecondaryBtn>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-[10px] bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.12)] flex items-center justify-center flex-shrink-0">
                    <Receipt size={16} className="text-[#FF3B30]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{CATEGORY_LABELS[cfg.category] ?? cfg.category}</p>
                    <p className="text-xs text-gray-500 dark:text-white/40">Maks {fmt(cfg.max_amount)} · Nota di atas {fmt(cfg.receipt_required_above)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${cfg.is_active ? 'bg-[#F0FDF4] text-[#34C759] border-[#BBF7D0] dark:bg-[rgba(52,199,89,0.12)]' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/[0.06]'}`}>
                    {cfg.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                  <button onClick={() => { setEditRow(cfg.category); setEditForm({ max_amount: cfg.max_amount, receipt_required_above: cfg.receipt_required_above }); }}
                    className="flex items-center gap-1 text-xs font-medium text-[#007AFF] px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.10)] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition">
                    <Pencil size={11} />Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Dispatch Panel ────────────────────────────────────────────────────────────
function DispatchPanel() {
  return (
    <div className="max-w-2xl">
      <PanelHeader title="Dispatch & Tugas" subtitle="Konfigurasi auto-dispatch dan SLA notifikasi" />
      <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] divide-y divide-black/[0.04] dark:divide-white/[0.05]">
        <ConfigRow label="Auto-dispatch"          value="Aktif" />
        <ConfigRow label="SLA Alert"              value="24 jam sebelum deadline" />
        <ConfigRow label="Maks. Tugas per Teknisi" value="5 tugas aktif" />
        <ConfigRow label="Prioritas default"      value="Normal" />
      </div>
      <p className="mt-4 text-xs text-gray-400 dark:text-white/25">Konfigurasi lanjutan dispatch tersedia di modul Tugas.</p>
    </div>
  );
}

// ── WhatsApp Panel ─────────────────────────────────────────────────────────────
function WhatsappPanel() {
  const { data: status, isLoading, refetch } = useQuery<WhatsappStatus>({
    queryKey: ['whatsapp-status'],
    queryFn: () => apiClient.get('/settings/whatsapp').then((r) => r.data),
    refetchInterval: 15000,
  });

  return (
    <div className="max-w-2xl">
      <PanelHeader title="WhatsApp" subtitle="Status koneksi bot WhatsApp untuk notifikasi otomatis" />
      <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-5 space-y-4">
        {/* Status indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isLoading ? 'bg-gray-300' : status?.connected ? 'bg-[#34C759] shadow-[0_0_6px_rgba(52,199,89,0.6)]' : 'bg-[#FF3B30]'}`} />
            <span className={`font-semibold text-sm ${status?.connected ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>
              {isLoading ? 'Memeriksa…' : status?.connected ? 'Terhubung' : 'Terputus'}
            </span>
            {status?.phone && <span className="text-xs text-gray-500 dark:text-white/40 font-mono">{status.phone}</span>}
          </div>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60 border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-1.5 transition">
            <RefreshCw size={11} />Refresh
          </button>
        </div>

        {!status?.connected && (
          <div className="border-2 border-dashed border-gray-200 dark:border-white/[0.10] rounded-2xl p-6 text-center">
            {status?.qr ? (
              <>
                <p className="text-sm text-gray-600 dark:text-white/60 mb-4">Scan QR code dengan WhatsApp Anda</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={status.qr} alt="WhatsApp QR" className="w-48 h-48 mx-auto rounded-xl border border-gray-200" />
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-3">
                  <MessageCircle size={22} className="text-gray-300 dark:text-white/20" />
                </div>
                <p className="text-sm text-gray-500 dark:text-white/40 mb-4">WhatsApp bot tidak terhubung</p>
                <button onClick={() => refetch()}
                  className="flex items-center gap-2 mx-auto px-4 py-2 bg-[#34C759] hover:bg-[#28A745] text-white rounded-xl text-sm font-semibold transition">
                  <RefreshCw size={14} />Reconnect
                </button>
              </>
            )}
          </div>
        )}

        <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-4 text-xs text-gray-500 dark:text-white/40 space-y-1.5">
          <p><span className="font-semibold text-gray-700 dark:text-white/60">Rate limit:</span> 100 pesan/jam</p>
          <p><span className="font-semibold text-gray-700 dark:text-white/60">Jeda antar pesan:</span> 2 detik</p>
          <p><span className="font-semibold text-gray-700 dark:text-white/60">Notifikasi:</span> Check-in/out, approval cuti, alpha alert, dispatch tugas</p>
        </div>
      </div>
    </div>
  );
}

// ── Backup Panel ──────────────────────────────────────────────────────────────
function BackupPanel() {
  const qc = useQueryClient();
  const [restoreConfirm, setRestoreConfirm] = useState<BackupRecord | null>(null);
  const [restoreInput,   setRestoreInput]   = useState('');

  const { data: backups = [], isLoading } = useQuery<BackupRecord[]>({
    queryKey: ['backup-history'],
    queryFn: () => apiClient.get('/settings/backups').then((r) => r.data),
    refetchInterval: 10000,
  });

  const triggerMut = useMutation({
    mutationFn: () => apiClient.post('/settings/backups/trigger').then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['backup-history'] }); toast.success('Backup dimulai'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal memulai backup')),
  });

  const lastSuccess = backups.find((b) => b.status === 'success');
  const hasRunning  = backups.some((b) => b.status === 'running');

  return (
    <div className="max-w-3xl">
      <PanelHeader title="Backup & Restore" subtitle="Kelola backup otomatis dan pemulihan data" />

      {lastSuccess && (
        <div className="bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.10)] border border-[#BBF7D0] dark:border-[rgba(52,199,89,0.25)] rounded-2xl p-4 mb-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#34C759]/20 flex items-center justify-center flex-shrink-0">
            <Check size={18} className="text-[#34C759]" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-semibold text-[#34C759] text-sm">Backup Terakhir Berhasil</p>
            <p className="text-xs text-gray-600 dark:text-white/50 mt-0.5">
              {new Date(lastSuccess.started_at).toLocaleDateString('id-ID', { dateStyle: 'long' })} · {fmtBytes(lastSuccess.size_bytes)}
              {lastSuccess.checksum && <span className="ml-2 font-mono">{lastSuccess.checksum.substring(0, 12)}…</span>}
            </p>
          </div>
        </div>
      )}

      {/* Schedule info */}
      <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-5 mb-4">
        <p className="text-sm font-semibold text-gray-700 dark:text-white/70 mb-3">Jadwal Backup Otomatis</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Full Backup',  value: '02:00 WITA (harian)' },
            { label: 'Incremental', value: '08:00, 14:00, 20:00' },
            { label: 'Enkripsi',    value: 'AES-256-GCM' },
            { label: 'Retensi',     value: '30 hari' },
          ].map((item) => (
            <div key={item.label} className="flex justify-between items-center px-4 py-2.5 bg-gray-50 dark:bg-white/[0.04] rounded-xl text-sm">
              <span className="text-gray-500 dark:text-white/40">{item.label}</span>
              <span className="font-semibold text-gray-900 dark:text-white">{item.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Manual trigger + history */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-700 dark:text-white/70">Riwayat Backup</p>
        <button onClick={() => triggerMut.mutate()} disabled={triggerMut.isPending || hasRunning}
          className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-sm font-semibold transition disabled:opacity-50">
          {(triggerMut.isPending || hasRunning)
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Backup Berjalan…</>
            : <><HardDrive size={14} />Backup Manual</>
          }
        </button>
      </div>

      <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
        {isLoading ? <Spinner /> : backups.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mb-3">
              <HardDrive size={22} className="text-gray-300 dark:text-white/20" />
            </div>
            <p className="text-sm text-gray-400 dark:text-white/25">Belum ada riwayat backup</p>
          </div>
        ) : (
          <table className="w-full text-sm min-w-[500px]">
            <thead>
              <tr className="border-b border-black/[0.05] dark:border-white/[0.07] bg-gray-50/50 dark:bg-white/[0.02]">
                {['Tgl/Waktu', 'Tipe', 'Ukuran', 'Status', 'Aksi'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/50">
                    {new Date(b.started_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} {new Date(b.started_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${b.type === 'full' ? 'bg-[#EFF6FF] text-[#007AFF] border-[#BFDBFE]' : 'bg-[#F5F3FF] text-[#5856D6] border-[#DDD6FE]'}`}>
                      {b.type === 'full' ? 'Full' : 'Incr'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/50">{fmtBytes(b.size_bytes)}</td>
                  <td className="px-4 py-3">
                    {b.status === 'success' && <span className="flex items-center gap-1 text-[11px] font-medium text-[#34C759] bg-[#F0FDF4] border border-[#BBF7D0] px-2 py-0.5 rounded-full w-fit"><Check size={9} strokeWidth={2.5} />Berhasil</span>}
                    {b.status === 'running' && <span className="flex items-center gap-1 text-[11px] font-medium text-[#FF9500] bg-[#FFF7ED] border border-[#FED7AA] px-2 py-0.5 rounded-full w-fit animate-pulse"><div className="w-1.5 h-1.5 rounded-full bg-[#FF9500]" />Berjalan</span>}
                    {b.status === 'failed'  && <span className="flex items-center gap-1 text-[11px] font-medium text-[#FF3B30] bg-[#FEF2F2] border border-[#FECACA] px-2 py-0.5 rounded-full w-fit"><X size={9} strokeWidth={2.5} />Gagal</span>}
                  </td>
                  <td className="px-4 py-3">
                    {b.status === 'success' && (
                      <button onClick={() => { setRestoreConfirm(b); setRestoreInput(''); }}
                        className="text-xs font-medium text-[#FF9500] bg-[#FFF7ED] hover:bg-[#FEF0D3] border border-[#FED7AA] rounded-xl px-2.5 py-1 transition">
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Restore modal */}
      {restoreConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setRestoreConfirm(null)}>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-black/[0.06] dark:border-white/[0.10]" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)] flex items-center justify-center mx-auto mb-4">
                <HardDrive size={24} className="text-[#FF9500]" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Konfirmasi Restore</h3>
              <p className="text-sm text-gray-500 dark:text-white/40 mt-2">
                Memulihkan database ke backup tanggal <strong>{new Date(restoreConfirm.started_at).toLocaleDateString('id-ID')}</strong>. Semua data setelah tanggal ini akan hilang.
              </p>
            </div>
            <div className="mb-4">
              <p className="text-xs text-gray-500 dark:text-white/40 mb-2 text-center">Ketik <strong>RESTORE</strong> untuk konfirmasi:</p>
              <input value={restoreInput} onChange={(e) => setRestoreInput(e.target.value)}
                className={inputCls + ' text-center font-mono tracking-widest'} placeholder="RESTORE" />
            </div>
            <div className="flex gap-3">
              <button disabled={restoreInput !== 'RESTORE'}
                className="flex-1 py-3 bg-[#FF3B30] disabled:opacity-40 hover:bg-[#E53E3E] text-white rounded-xl text-sm font-semibold transition">
                Restore Sekarang
              </button>
              <button onClick={() => setRestoreConfirm(null)}
                className="px-5 py-3 border border-black/[0.08] dark:border-white/[0.10] text-gray-600 dark:text-white/60 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Contacts Panel ────────────────────────────────────────────────────────────
function ContactsPanel() {
  const qc = useQueryClient();
  const [showForm,    setShowForm]    = useState(false);
  const [newContact,  setNewContact]  = useState({ name: '', role: '', phone: '', priority: 1 });
  const [deleteId,    setDeleteId]    = useState<string | null>(null);

  const { data: contacts = [], isLoading } = useQuery<EmergencyContact[]>({
    queryKey: ['sos-contacts'],
    queryFn: () => apiClient.get('/sos/contacts').then((r) => r.data),
  });

  const addMut = useMutation({
    mutationFn: (dto: typeof newContact) => apiClient.post('/sos/contacts', dto).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sos-contacts'] }); setShowForm(false); setNewContact({ name: '', role: '', phone: '', priority: 1 }); toast.success('Kontak darurat ditambahkan'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menambah kontak darurat')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/sos/contacts/${id}`).then((r) => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sos-contacts'] }); setDeleteId(null); toast.success('Kontak darurat dihapus'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menghapus kontak darurat')),
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="max-w-2xl">
      <PanelHeader title="Kontak Darurat" subtitle="Dihubungi saat karyawan mengaktifkan SOS"
        action={<PrimaryBtn onClick={() => setShowForm(true)}><Plus size={14} />Tambah Kontak</PrimaryBtn>} />

      <div className="space-y-2">
        {contacts.length === 0 ? (
          <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] flex flex-col items-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mb-3">
              <Siren size={22} className="text-gray-300 dark:text-white/20" />
            </div>
            <p className="text-sm text-gray-400 dark:text-white/25">Belum ada kontak darurat</p>
          </div>
        ) : contacts.map((c) => (
          <div key={c.id} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 border ${c.priority === 1 ? 'bg-[#FEF2F2] text-[#FF3B30] border-[#FECACA]' : c.priority === 2 ? 'bg-[#FFF7ED] text-[#FF9500] border-[#FED7AA]' : 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-white/[0.06]'}`}>
                P{c.priority}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{c.name}</p>
                <p className="text-xs text-gray-500 dark:text-white/40">{c.role} · {c.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${c.is_active ? 'bg-[#F0FDF4] text-[#34C759] border-[#BBF7D0]' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/[0.06]'}`}>
                {c.is_active ? 'Aktif' : 'Nonaktif'}
              </span>
              {deleteId === c.id ? (
                <div className="flex items-center gap-1">
                  <button onClick={() => deleteMut.mutate(c.id)} disabled={deleteMut.isPending}
                    className="text-xs font-semibold text-white bg-[#FF3B30] hover:bg-[#E53E3E] px-2 py-1 rounded-xl transition">
                    Hapus
                  </button>
                  <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 px-2 py-1 rounded-xl hover:bg-gray-100 transition">Batal</button>
                </div>
              ) : (
                <button onClick={() => setDeleteId(c.id)} className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-[#FF3B30] hover:bg-[#FEF2F2] transition">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <Modal title="Tambah Kontak Darurat" Icon={Siren} onClose={() => setShowForm(false)}
          footer={<>
            <SecondaryBtn onClick={() => setShowForm(false)}>Batal</SecondaryBtn>
            <button onClick={() => addMut.mutate(newContact)} disabled={addMut.isPending || !newContact.name || !newContact.phone}
              className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {addMut.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Simpan Kontak'}
            </button>
          </>}>
          <div className="grid grid-cols-2 gap-3">
            <SField label="Nama *"><input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className={inputCls} placeholder="Nama lengkap" /></SField>
            <SField label="Jabatan"><input value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} className={inputCls} placeholder="Manager, Security…" /></SField>
            <SField label="No. HP *"><input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className={inputCls} placeholder="+62…" /></SField>
            <SField label="Prioritas">
              <select value={newContact.priority} onChange={(e) => setNewContact({ ...newContact, priority: Number(e.target.value) })} className={inputCls}>
                <option value={1}>1 — Tertinggi</option>
                <option value={2}>2</option>
                <option value={3}>3 — Terendah</option>
              </select>
            </SField>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Roles Panel ───────────────────────────────────────────────────────────────
function RolesPanel() {
  const qc = useQueryClient();
  const [showForm,    setShowForm]    = useState(false);
  const [editing,     setEditing]     = useState<RoleItem | null>(null);
  const [form,        setForm]        = useState({ name: '', can_delegate: false, can_approve: false });
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);

  const { data: roles = [], isLoading } = useQuery<RoleItem[]>({
    queryKey: ['roles'],
    queryFn: () => apiClient.get('/roles').then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (dto: object) => apiClient.post('/roles', dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); closeForm(); toast.success('Role berhasil dibuat'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal membuat role')),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: object }) => apiClient.patch(`/roles/${id}`, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); closeForm(); toast.success('Role berhasil diperbarui'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal memperbarui role')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/roles/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['roles'] }); setDeleteId(null); toast.success('Role dihapus'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menghapus role')),
  });

  const toggleFlag = (r: RoleItem, flag: 'can_delegate' | 'can_approve') => updateMut.mutate({ id: r.id, dto: { [flag]: !r[flag] } });
  const openCreate = () => { setEditing(null); setForm({ name: '', can_delegate: false, can_approve: false }); setShowForm(true); };
  const openEdit   = (r: RoleItem) => { setEditing(r); setForm({ name: r.name, can_delegate: r.can_delegate, can_approve: r.can_approve }); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditing(null); };
  const submit     = () => editing ? updateMut.mutate({ id: editing.id, dto: form }) : createMut.mutate(form);

  return (
    <div className="max-w-2xl">
      <PanelHeader title="Role Sistem" subtitle="Kelola role dan hak akses karyawan"
        action={<PrimaryBtn onClick={openCreate}><Plus size={14} />Tambah Role</PrimaryBtn>} />

      {isLoading ? <Spinner /> : (
        <div className="space-y-2">
          {roles.length === 0 ? (
            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] py-10 text-center text-sm text-gray-400 dark:text-white/25">Belum ada role</div>
          ) : roles.map((r) => {
            const permLabels = (r.permissions ?? []).map((p) => PERM_LABELS[p] ?? p);
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
                <div className="px-4 py-3.5 flex items-center gap-3">
                  {/* Icon */}
                  <div className="w-9 h-9 rounded-[10px] bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.12)] flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={16} className="text-[#FF9500]" />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{r.name}</span>
                      {r.is_system && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-white/40 border border-gray-200 dark:border-white/[0.08]">
                          <Lock size={8} />Sistem
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/40 cursor-pointer select-none">
                        <Toggle checked={r.can_delegate} onChange={() => toggleFlag(r, 'can_delegate')} />
                        Delegasi
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/40 cursor-pointer select-none">
                        <Toggle checked={r.can_approve} onChange={() => toggleFlag(r, 'can_approve')} />
                        Approve Cuti
                      </label>
                      {permLabels.length > 0 && (
                        <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                          className="flex items-center gap-1 text-[11px] text-[#007AFF] hover:underline">
                          {permLabels.length} izin {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(r)} className="flex items-center gap-1 text-xs font-medium text-[#007AFF] px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.10)] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition">
                      <Pencil size={11} />Edit
                    </button>
                    {!r.is_system && (
                      deleteId === r.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteMut.mutate(r.id)} disabled={deleteMut.isPending}
                            className="text-xs font-semibold text-white bg-[#FF3B30] hover:bg-[#E53E3E] px-2 py-1.5 rounded-xl transition">Hapus</button>
                          <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition">Batal</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteId(r.id)} className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-[#FF3B30] hover:bg-[#FEF2F2] transition">
                          <Trash2 size={13} />
                        </button>
                      )
                    )}
                  </div>
                </div>
                {isExpanded && permLabels.length > 0 && (
                  <div className="px-4 pb-4 pt-1 flex flex-wrap gap-1.5 border-t border-black/[0.04] dark:border-white/[0.06]">
                    {permLabels.map((label) => (
                      <span key={label} className="text-[11px] px-2 py-0.5 rounded-full bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.12)] text-[#007AFF] border border-[#BFDBFE]">{label}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Role' : 'Tambah Role'} Icon={ShieldCheck} onClose={closeForm}
          footer={<>
            <SecondaryBtn onClick={closeForm}>Batal</SecondaryBtn>
            <button onClick={submit} disabled={(!form.name && !editing?.is_system) || createMut.isPending || updateMut.isPending}
              className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {(createMut.isPending || updateMut.isPending) ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Simpan'}
            </button>
          </>}>
          {editing?.is_system ? (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Nama Role</p>
              <div className="flex items-center gap-2 h-11 px-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-black/[0.08] dark:border-white/[0.10]">
                <span className="text-sm text-gray-700 dark:text-white/70">{editing.name}</span>
                <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 border border-gray-200">
                  <Lock size={8} />Sistem
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Nama role sistem tidak dapat diubah</p>
            </div>
          ) : (
            <SField label="Nama Role *">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="contoh: Koordinator Lapangan" className={inputCls} autoFocus />
            </SField>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider">Kemampuan</p>
            {[
              { flag: 'can_delegate' as const, label: 'Delegasi Tugas', desc: 'Dapat mendelegasikan tugas ke orang lain' },
              { flag: 'can_approve'  as const, label: 'Approve Cuti',   desc: 'Dapat menyetujui atau menolak pengajuan cuti' },
            ].map(({ flag, label, desc }) => (
              <label key={flag} className="flex items-center justify-between py-3 px-4 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-gray-50/50 dark:bg-white/[0.02] cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.04] transition">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
                  <p className="text-xs text-gray-400 dark:text-white/30">{desc}</p>
                </div>
                <Toggle checked={form[flag]} onChange={() => setForm((f) => ({ ...f, [flag]: !f[flag] }))} />
              </label>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Departments Panel ─────────────────────────────────────────────────────────
function DepartmentsPanel() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing,  setEditing]  = useState<DeptItem | null>(null);
  const [form,     setForm]     = useState({ name: '', code: '', schedule_type: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: depts = [], isLoading } = useQuery<DeptItem[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (dto: object) => apiClient.post('/departments', dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); closeForm(); toast.success('Departemen berhasil dibuat'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal membuat departemen')),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: object }) => apiClient.patch(`/departments/${id}`, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); closeForm(); toast.success('Departemen berhasil diperbarui'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal memperbarui departemen')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/departments/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['departments'] }); setDeleteId(null); toast.success('Departemen dihapus'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menghapus departemen')),
  });

  const openCreate = () => { setEditing(null); setForm({ name: '', code: '', schedule_type: '' }); setShowForm(true); };
  const openEdit   = (d: DeptItem) => { setEditing(d); setForm({ name: d.name, code: d.code ?? '', schedule_type: d.schedule_type ?? '' }); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditing(null); };
  const submit     = () => { const dto: any = { name: form.name }; if (form.code) dto.code = form.code; if (form.schedule_type) dto.schedule_type = form.schedule_type; editing ? updateMut.mutate({ id: editing.id, dto }) : createMut.mutate(dto); };

  return (
    <div className="max-w-2xl">
      <PanelHeader title="Departemen" subtitle="Kelola divisi dan departemen perusahaan"
        action={<PrimaryBtn onClick={openCreate}><Plus size={14} />Tambah Departemen</PrimaryBtn>} />

      {isLoading ? <Spinner /> : (
        <div className="space-y-2">
          {depts.length === 0 && (
            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] py-10 text-center text-sm text-gray-400 dark:text-white/25">Belum ada departemen</div>
          )}
          {depts.map((d) => (
            <div key={d.id} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[#F2F2F7] dark:bg-[rgba(99,99,102,0.15)] flex items-center justify-center flex-shrink-0">
                  <Layers size={16} className="text-[#636366]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{d.name}</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">
                    {[d.code && `Kode: ${d.code}`, d.schedule_type && SCHED_LABELS[d.schedule_type]].filter(Boolean).join(' · ') || 'Belum ada konfigurasi'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(d)} className="flex items-center gap-1 text-xs font-medium text-[#007AFF] px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.10)] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition">
                  <Pencil size={11} />Edit
                </button>
                {deleteId === d.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => deleteMut.mutate(d.id)} disabled={deleteMut.isPending}
                      className="text-xs font-semibold text-white bg-[#FF3B30] px-2 py-1.5 rounded-xl">Hapus</button>
                    <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition">Batal</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteId(d.id)} className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-[#FF3B30] hover:bg-[#FEF2F2] transition">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Departemen' : 'Tambah Departemen'} Icon={Layers} onClose={closeForm}
          footer={<>
            <SecondaryBtn onClick={closeForm}>Batal</SecondaryBtn>
            <button onClick={submit} disabled={!form.name || createMut.isPending || updateMut.isPending}
              className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {(createMut.isPending || updateMut.isPending) ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Simpan'}
            </button>
          </>}>
          <SField label="Nama Departemen *">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="contoh: IT & Engineering" autoFocus />
          </SField>
          <SField label="Kode (opsional)">
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className={inputCls} placeholder="contoh: IT" />
          </SField>
          <SField label="Tipe Jadwal Default (opsional)">
            <div className="flex rounded-xl border border-black/[0.08] dark:border-white/[0.10] overflow-hidden">
              {(['', 'office_hours', 'shift'] as const).map((v) => (
                <button key={v} type="button" onClick={() => setForm((f) => ({ ...f, schedule_type: v }))}
                  className={`flex-1 py-2.5 text-sm font-medium transition-colors ${form.schedule_type === v ? 'bg-[#007AFF] text-white' : 'bg-white dark:bg-white/[0.04] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.08]'}`}>
                  {v === '' ? '—' : v === 'office_hours' ? 'Office Hours' : 'Shift'}
                </button>
              ))}
            </div>
          </SField>
        </Modal>
      )}
    </div>
  );
}

// ── Positions Panel ───────────────────────────────────────────────────────────
function PositionsPanel() {
  const qc = useQueryClient();
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<PositionItem | null>(null);
  const [formName,  setFormName]  = useState('');
  const [deleteId,  setDeleteId]  = useState<string | null>(null);

  const { data: positions = [], isLoading } = useQuery<PositionItem[]>({
    queryKey: ['positions'],
    queryFn: () => apiClient.get('/positions').then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (dto: object) => apiClient.post('/positions', dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }); closeForm(); toast.success('Jabatan berhasil dibuat'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal membuat jabatan')),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: object }) => apiClient.patch(`/positions/${id}`, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }); closeForm(); toast.success('Jabatan berhasil diperbarui'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal memperbarui jabatan')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/positions/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positions'] }); setDeleteId(null); toast.success('Jabatan dihapus'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menghapus jabatan')),
  });

  const openCreate = () => { setEditing(null); setFormName(''); setShowForm(true); };
  const openEdit   = (p: PositionItem) => { setEditing(p); setFormName(p.name); setShowForm(true); };
  const closeForm  = () => { setShowForm(false); setEditing(null); setFormName(''); };
  const submit     = () => { const dto = { name: formName.trim() }; editing ? updateMut.mutate({ id: editing.id, dto }) : createMut.mutate(dto); };

  return (
    <div className="max-w-2xl">
      <PanelHeader title="Jabatan" subtitle="Jabatan / posisi pekerjaan karyawan (terpisah dari Role)"
        action={<PrimaryBtn onClick={openCreate}><Plus size={14} />Tambah Jabatan</PrimaryBtn>} />

      {isLoading ? <Spinner /> : (
        <div className="space-y-2">
          {positions.length === 0 && (
            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] py-10 text-center text-sm text-gray-400 dark:text-white/25">
              Belum ada jabatan. Contoh: Teknisi Lapangan, Koordinator Wilayah.
            </div>
          )}
          {positions.map((p) => (
            <div key={p.id} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[10px] bg-[#F0EFFE] dark:bg-[rgba(88,86,214,0.12)] flex items-center justify-center flex-shrink-0">
                  <Briefcase size={16} className="text-[#5856D6]" />
                </div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.name}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(p)} className="flex items-center gap-1 text-xs font-medium text-[#007AFF] px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.10)] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition">
                  <Pencil size={11} />Edit
                </button>
                {deleteId === p.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => deleteMut.mutate(p.id)} disabled={deleteMut.isPending}
                      className="text-xs font-semibold text-white bg-[#FF3B30] px-2 py-1.5 rounded-xl">Hapus</button>
                    <button onClick={() => setDeleteId(null)} className="text-xs text-gray-500 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition">Batal</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteId(p.id)} className="w-7 h-7 rounded-xl flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-[#FF3B30] hover:bg-[#FEF2F2] transition">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? 'Edit Jabatan' : 'Tambah Jabatan'} Icon={Briefcase} onClose={closeForm}
          footer={<>
            <SecondaryBtn onClick={closeForm}>Batal</SecondaryBtn>
            <button onClick={submit} disabled={!formName.trim() || createMut.isPending || updateMut.isPending}
              className="flex-1 py-3 bg-[#007AFF] text-white rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {(createMut.isPending || updateMut.isPending) ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Simpan'}
            </button>
          </>}>
          <SField label="Nama Jabatan *">
            <input value={formName} onChange={(e) => setFormName(e.target.value)} className={inputCls} placeholder="contoh: Teknisi Lapangan" autoFocus />
          </SField>
        </Modal>
      )}
    </div>
  );
}
