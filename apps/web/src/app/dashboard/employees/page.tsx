'use client';

import { useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { UserAvatar } from '@/components/ui/UserAvatar';
import {
  Users, UserPlus, Search, Pencil, KeyRound, UserX,
  Camera, Phone, Mail, BadgeCheck, Building2, Calendar,
  X, Check, Eye, EyeOff, type LucideIcon,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface User {
  id: string; employee_id: string; nik: string | null; full_name: string;
  email: string; phone: string; schedule_type: 'shift' | 'office_hours';
  is_active: boolean; must_change_password: boolean; avatar_url: string | null;
  gender: 'male' | 'female' | null;
  role?: { id: string; name: string };
  position?: { id: string; name: string };
  department?: { id: string; name: string };
}

interface Role       { id: string; name: string }
interface Department { id: string; name: string }
interface Position   { id: string; name: string }
interface ShiftType  { id: string; name: string; start_time: string; end_time: string }

// ── Constants ─────────────────────────────────────────────────────────────────
const SCHEDULE_LABELS: Record<string, string> = { shift: 'Shift', office_hours: 'Office Hours' };

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]',
  admin:       'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
  manager:     'bg-[#EDE9FE] text-[#6D28D9] border-[#DDD6FE]',
  senior:      'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
  hr:          'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0]',
  junior:      'bg-gray-100 text-gray-600 border-gray-200',
};

const EMPTY_CREATE = {
  name: '', email: '', phone: '', nik: '', gender: '' as '' | 'male' | 'female',
  role_id: '', position_id: '', department_id: '',
  schedule_type: 'office_hours', default_shift_type_id: '', initial_password: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const inputCls = 'w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition';
const labelCls = 'block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5';

// ── EmployeeCard (mobile) ─────────────────────────────────────────────────────
function EmployeeCard({
  user, onEdit, onReset, onDeactivate, deactivatingId,
}: {
  user: User;
  onEdit: () => void;
  onReset: () => void;
  onDeactivate: () => void;
  deactivatingId: string | null;
}) {
  const roleColor = ROLE_COLORS[user.role?.name ?? ''] ?? ROLE_COLORS.junior;

  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4 shadow-sm">
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <UserAvatar name={user.full_name} avatarUrl={user.avatar_url} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.full_name}</p>
              <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">{user.employee_id}{user.nik ? ` · NIK ${user.nik}` : ''}</p>
            </div>
            <span className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${user.is_active ? 'bg-[#F0FDF4] text-[#34C759] border-[#BBF7D0]' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/[0.06]'}`}>
              {user.is_active ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
        </div>
      </div>

      {/* Info pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {user.role && (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${roleColor}`}>{user.role.name}</span>
        )}
        {user.position && (
          <span className="text-[11px] text-gray-500 dark:text-white/40 bg-gray-50 dark:bg-white/[0.05] px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/[0.08]">
            {user.position.name}
          </span>
        )}
        <span className="text-[11px] text-gray-500 dark:text-white/40 bg-gray-50 dark:bg-white/[0.05] px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/[0.08] flex items-center gap-1">
          <Calendar size={9} />{SCHEDULE_LABELS[user.schedule_type]}
        </span>
      </div>

      {/* Contact */}
      <div className="space-y-1 mb-3">
        <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/40">
          <Mail size={10} />{user.email}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-white/40">
          <Phone size={10} />{user.phone}
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.05]">
        <button onClick={onEdit}
          className="flex items-center gap-1 text-xs font-medium text-[#007AFF] px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.10)] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition">
          <Pencil size={11} />Edit
        </button>
        {user.is_active && (
          <>
            <button onClick={onReset}
              className="flex items-center gap-1 text-xs font-medium text-[#FF9500] px-2.5 py-1.5 rounded-xl bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.10)] border border-[#FED7AA] hover:bg-[#FEF0D3] transition">
              <KeyRound size={11} />Reset PW
            </button>
            {deactivatingId === user.id ? (
              <div className="flex gap-1 ml-auto">
                <button onClick={onDeactivate} className="text-xs font-semibold text-white bg-[#FF3B30] px-2.5 py-1.5 rounded-xl">Nonaktifkan</button>
                <button className="text-xs text-gray-500 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition">Batal</button>
              </div>
            ) : (
              <button onClick={onDeactivate}
                className="flex items-center gap-1 text-xs font-medium text-[#FF3B30] px-2.5 py-1.5 rounded-xl bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.10)] border border-[#FECACA] hover:bg-[#FEE2E2] transition ml-auto">
                <UserX size={11} />Nonaktifkan
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const searchParams = useSearchParams();
  const [search,         setSearch]         = useState(searchParams.get('search') ?? '');
  const [filterStatus,   setFilterStatus]   = useState<'all' | 'active' | 'inactive'>('all');
  const [showCreate,     setShowCreate]     = useState(false);
  const [createStep,     setCreateStep]     = useState<1 | 2>(1);
  const [showPassword,   setShowPassword]   = useState(false);
  const [createForm,     setCreateForm]     = useState(EMPTY_CREATE);
  const [editingUser,    setEditingUser]    = useState<User | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState<Partial<{ full_name: string; email: string; phone: string; nik: string; gender: string; role_id: string; position_id: string; department_id: string; schedule_type: string; is_active: boolean }>>({});

  const qc = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users', search],
    queryFn: () => apiClient.get(`/users?search=${encodeURIComponent(search)}`).then((r) => {
      const d = r.data;
      if (Array.isArray(d) && Array.isArray(d[0])) return d[0];
      return d?.items ?? d?.data ?? d;
    }),
    staleTime: 30_000, // 30 detik — data karyawan tidak sering berubah
  });

  const { data: nextIdData } = useQuery<{ employee_id: string }>({
    queryKey: ['next-employee-id'],
    queryFn: () => apiClient.get('/users/next-employee-id').then((r) => r.data),
    enabled: showCreate,
    staleTime: 0,
  });

  const { data: roles       = [] } = useQuery<Role[]>({       queryKey: ['roles'],       queryFn: () => apiClient.get('/roles').then((r) => r.data) });
  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ['departments'], queryFn: () => apiClient.get('/departments').then((r) => r.data) });
  const { data: positions   = [] } = useQuery<Position[]>({   queryKey: ['positions'],   queryFn: () => apiClient.get('/positions').then((r) => r.data) });
  const { data: shiftTypes  = [] } = useQuery<ShiftType[]>({  queryKey: ['shift-types'], queryFn: () => apiClient.get('/schedules/shift-types').then((r) => r.data) });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createUser = useMutation({
    mutationFn: (data: object) => apiClient.post('/users', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); setShowPassword(false); setCreateForm(EMPTY_CREATE); toast.success('Karyawan berhasil ditambahkan'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal membuat karyawan')),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: object }) => apiClient.patch(`/users/${id}`, dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditingUser(null); toast.success('Data karyawan berhasil diperbarui'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal memperbarui data karyawan')),
  });

  const deactivateUser = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setDeactivatingId(null); toast.success('Karyawan dinonaktifkan'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menonaktifkan karyawan')),
  });

  const resetPasswordMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/users/${id}/reset-password`),
    onSuccess: () => toast.success('Password berhasil direset ke ID Karyawan'),
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal mereset password')),
  });

  const uploadAvatarMut = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return apiClient.post(`/users/${id}/avatar`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['users'] }); setEditAvatarPreview(res.data.avatar_url); toast.success('Foto profil berhasil diperbarui'); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal mengunggah foto')),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const setCreateField = (k: string, v: string) => setCreateForm((f) => ({ ...f, [k]: v }));

  const openEdit = (user: User) => {
    setEditingUser(user);
    setEditAvatarPreview(user.avatar_url ?? null);
    setEditForm({ full_name: user.full_name, email: user.email, phone: user.phone, nik: user.nik ?? '', gender: (user as any).gender ?? '', role_id: user.role?.id ?? '', position_id: user.position?.id ?? '', department_id: user.department?.id ?? '', schedule_type: user.schedule_type, is_active: user.is_active });
  };

  const submitCreate = () => {
    const payload: any = { ...createForm, full_name: createForm.name };
    delete payload.name;
    if (!payload.default_shift_type_id) delete payload.default_shift_type_id;
    if (!payload.nik) delete payload.nik;
    if (!payload.gender) delete payload.gender;
    if (!payload.position_id) delete payload.position_id;
    if (!payload.department_id) delete payload.department_id;
    if (!payload.initial_password) delete payload.initial_password;
    createUser.mutate(payload);
  };

  const submitEdit = () => {
    if (!editingUser) return;
    const dto: any = { ...editForm };
    if (!dto.nik) dto.nik = null;
    if (!dto.position_id) dto.position_id = null;
    if (!dto.department_id) dto.department_id = null;
    updateUser.mutate({ id: editingUser.id, dto });
  };

  // Filtered list
  const filtered = users.filter((u) =>
    (filterStatus === 'all' || (filterStatus === 'active' ? u.is_active : !u.is_active))
  );

  const totalActive   = users.filter((u) => u.is_active).length;
  const totalInactive = users.filter((u) => !u.is_active).length;

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Data Karyawan</h1>
            <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">{totalActive} karyawan aktif</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0066CC] active:scale-[0.97] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.35)]"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Tambah Karyawan</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Total',    value: users.length,  Icon: Users,      bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]',    color: 'text-[#007AFF]'  },
            { label: 'Aktif',    value: totalActive,   Icon: BadgeCheck,  bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.15)]',    color: 'text-[#34C759]'  },
            { label: 'Nonaktif', value: totalInactive, Icon: UserX,       bg: 'bg-gray-100 dark:bg-white/[0.06]',                color: 'text-gray-400 dark:text-white/30' },
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

        {/* ── Filter bar ──────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white/30" />
            <input
              type="search"
              placeholder="Cari nama, email, ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#007AFF] transition"
            />
          </div>
          {/* Status pills */}
          {([
            { value: 'all',      label: 'Semua' },
            { value: 'active',   label: 'Aktif' },
            { value: 'inactive', label: 'Nonaktif' },
          ] as const).map(({ value, label }) => (
            <button key={value} onClick={() => setFilterStatus(value)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                filterStatus === value
                  ? 'bg-[#007AFF] text-white shadow-[0_2px_6px_rgba(0,122,255,0.30)]'
                  : 'bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.10]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pb-8">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-36 h-3.5 rounded-full bg-gray-100 dark:bg-white/10" />
                  <div className="w-24 h-3 rounded-full bg-gray-100 dark:bg-white/10" />
                </div>
                <div className="w-16 h-6 rounded-full bg-gray-100 dark:bg-white/10" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <Users size={28} className="text-gray-300 dark:text-white/20" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-white/40">Tidak ada karyawan</p>
            <p className="text-xs text-gray-400 dark:text-white/25 mt-1">Tambah karyawan dengan tombol di atas</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden shadow-sm">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-black/[0.05] dark:border-white/[0.07] bg-gray-50/50 dark:bg-white/[0.02]">
                    {['Karyawan', 'Email / HP', 'Role', 'Jabatan', 'Jadwal', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const roleColor = ROLE_COLORS[user.role?.name ?? ''] ?? ROLE_COLORS.junior;
                    return (
                      <tr key={user.id} className="border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={user.full_name} avatarUrl={user.avatar_url} size="sm" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">{user.full_name}</p>
                              <p className="text-[11px] text-gray-400 dark:text-white/30">{user.employee_id}{user.nik ? ` · ${user.nik}` : ''}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-gray-600 dark:text-white/60">{user.email}</p>
                          <p className="text-xs text-gray-400 dark:text-white/30">{user.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          {user.role && <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${roleColor}`}>{user.role.name}</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/60">
                          {user.position?.name ?? <span className="text-gray-300 dark:text-white/20">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-white/40">
                            <Calendar size={10} />{SCHEDULE_LABELS[user.schedule_type]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${user.is_active ? 'bg-[#F0FDF4] text-[#34C759] border-[#BBF7D0]' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/[0.06]'}`}>
                            {user.is_active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(user)}
                              className="flex items-center gap-1 text-xs font-medium text-[#007AFF] px-2.5 py-1.5 rounded-xl bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.10)] border border-[#BFDBFE] hover:bg-[#DBEAFE] transition">
                              <Pencil size={11} />Edit
                            </button>
                            {user.is_active && (
                              <>
                                <button onClick={() => resetPasswordMut.mutate(user.id)}
                                  className="flex items-center gap-1 text-xs font-medium text-[#FF9500] px-2.5 py-1.5 rounded-xl bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.10)] border border-[#FED7AA] hover:bg-[#FEF0D3] transition">
                                  <KeyRound size={11} />Reset
                                </button>
                                {deactivatingId === user.id ? (
                                  <div className="flex gap-1">
                                    <button onClick={() => deactivateUser.mutate(user.id)} disabled={deactivateUser.isPending}
                                      className="text-xs font-semibold text-white bg-[#FF3B30] px-2.5 py-1.5 rounded-xl transition">Nonaktifkan</button>
                                    <button onClick={() => setDeactivatingId(null)} className="text-xs text-gray-500 px-2 py-1.5 rounded-xl hover:bg-gray-100 transition">Batal</button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeactivatingId(user.id)}
                                    className="flex items-center gap-1 text-xs font-medium text-[#FF3B30] px-2.5 py-1.5 rounded-xl bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.10)] border border-[#FECACA] hover:bg-[#FEE2E2] transition">
                                    <UserX size={11} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {filtered.map((user) => (
                <EmployeeCard
                  key={user.id}
                  user={user}
                  onEdit={() => openEdit(user)}
                  onReset={() => resetPasswordMut.mutate(user.id)}
                  onDeactivate={() => deactivatingId === user.id ? deactivateUser.mutate(user.id) : setDeactivatingId(user.id)}
                  deactivatingId={deactivatingId}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modal: Tambah Karyawan ────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-md shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)] flex items-center justify-center">
                  <UserPlus size={15} className="text-[#007AFF]" />
                </div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Tambah Karyawan Baru</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-[#007AFF] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.14)] px-2.5 py-1 rounded-xl">
                  {nextIdData?.employee_id ?? '…'}
                </span>
                {/* Step dots */}
                <div className="flex items-center gap-1">
                  {([1, 2] as const).map((s) => (
                    <div key={s} className={`h-1.5 rounded-full transition-all duration-200 ${
                      s === createStep ? 'w-5 bg-[#007AFF]' : s < createStep ? 'w-2.5 bg-[#34C759]' : 'w-2.5 bg-gray-200 dark:bg-white/20'
                    }`} />
                  ))}
                  <span className="text-[10px] text-gray-400 dark:text-white/30 ml-1">{createStep}/2</span>
                </div>
                <button onClick={() => { setShowCreate(false); setShowPassword(false); setCreateForm(EMPTY_CREATE); setCreateStep(1); }}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-200 transition">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {createStep === 1 ? (
                // ─ Step 1: Info Dasar & Akses ─
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400 dark:text-white/30">Info Dasar</p>
                  {[
                    { key: 'name',  label: 'Nama Lengkap', placeholder: 'Ahmad Fauzi',         type: 'text'  },
                    { key: 'email', label: 'Email',         placeholder: 'ahmad@perusahaan.id', type: 'email' },
                    { key: 'phone', label: 'No. HP',        placeholder: '08123456789',         type: 'tel'   },
                    { key: 'nik',   label: 'NIK (opsional)', placeholder: '3201234567890001',   type: 'text'  },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label className={labelCls}>{label}</label>
                      <input type={type} value={(createForm as any)[key]} onChange={(e) => setCreateField(key, e.target.value)} placeholder={placeholder} className={inputCls} />
                    </div>
                  ))}
                  <div>
                    <label className={labelCls}>Jenis Kelamin</label>
                    <div className="flex rounded-xl border border-black/[0.08] dark:border-white/[0.10] overflow-hidden">
                      {([{ v: 'male', label: 'Laki-laki' }, { v: 'female', label: 'Perempuan' }] as const).map(({ v, label }) => (
                        <button key={v} type="button" onClick={() => setCreateField('gender', createForm.gender === v ? '' : v)}
                          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${createForm.gender === v ? 'bg-[#007AFF] text-white' : 'bg-white dark:bg-white/[0.04] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.08]'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Role Sistem</label>
                    <select value={createForm.role_id} onChange={(e) => setCreateField('role_id', e.target.value)} className={inputCls}>
                      <option value="">Pilih role</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                // ─ Step 2: Posisi & Jadwal ─
                <>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-gray-400 dark:text-white/30">Posisi & Jadwal</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Jabatan</label>
                      <select value={createForm.position_id} onChange={(e) => setCreateField('position_id', e.target.value)} className={inputCls}>
                        <option value="">Pilih jabatan</option>
                        {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Departemen</label>
                      <select value={createForm.department_id} onChange={(e) => setCreateField('department_id', e.target.value)} className={inputCls}>
                        <option value="">Pilih departemen</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Tipe Jadwal</label>
                    <div className="flex rounded-xl border border-black/[0.08] dark:border-white/[0.10] overflow-hidden">
                      {(['office_hours', 'shift'] as const).map((v) => (
                        <button key={v} type="button"
                          onClick={() => { setCreateField('schedule_type', v); if (v === 'office_hours') setCreateField('default_shift_type_id', ''); }}
                          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${createForm.schedule_type === v ? 'bg-[#007AFF] text-white' : 'bg-white dark:bg-white/[0.04] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.08]'}`}>
                          {v === 'office_hours' ? 'Office Hours' : 'Shift'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {createForm.schedule_type === 'shift' && (
                    <div>
                      <label className={labelCls}>Shift Default (opsional)</label>
                      <select value={createForm.default_shift_type_id} onChange={(e) => setCreateField('default_shift_type_id', e.target.value)} className={inputCls}>
                        <option value="">Pilih shift default…</option>
                        {shiftTypes.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className={labelCls}>Password Awal <span className="normal-case font-normal text-gray-400">(opsional)</span></label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={createForm.initial_password}
                        onChange={(e) => setCreateField('initial_password', e.target.value)}
                        placeholder="Kosongkan = ID Karyawan (auto)"
                        className={`${inputCls} pr-24`}
                      />
                      <button type="button" onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/70 transition">
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {createForm.initial_password && createForm.initial_password.length < 6 && (
                      <p className="text-[11px] text-[#FF3B30] mt-1">Minimal 6 karakter</p>
                    )}
                    <p className="text-[11px] text-gray-400 dark:text-white/30 mt-1">Karyawan wajib mengganti password saat login pertama</p>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3">
              {createStep === 1 ? (
                <>
                  <button onClick={() => { setShowCreate(false); setShowPassword(false); setCreateForm(EMPTY_CREATE); setCreateStep(1); }}
                    className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                    Batal
                  </button>
                  <button onClick={() => setCreateStep(2)}
                    disabled={!createForm.name || !createForm.email || !createForm.phone || !createForm.role_id}
                    className="flex-1 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    Lanjut →
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setCreateStep(1)}
                    className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                    ← Kembali
                  </button>
                  <button onClick={submitCreate}
                    disabled={createUser.isPending || (!!createForm.initial_password && createForm.initial_password.length < 6)}
                    className="flex-1 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {createUser.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Buat Akun'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Edit Karyawan ──────────────────────────────────────────── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-md shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)] flex items-center justify-center">
                  <Pencil size={14} className="text-[#007AFF]" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Edit Karyawan</h3>
                  <p className="text-[11px] text-gray-400 dark:text-white/30">{editingUser.employee_id}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${editForm.is_active ? 'bg-[#F0FDF4] text-[#34C759] border-[#BBF7D0]' : 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-white/[0.06]'}`}>
                  {editForm.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
                <button onClick={() => { setEditingUser(null); setEditAvatarPreview(null); }}
                  className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-200 transition">
                  <X size={13} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Avatar upload */}
              <div className="flex flex-col items-center py-2">
                <div
                  className="relative w-20 h-20 rounded-full cursor-pointer group"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <div className="w-full h-full rounded-full bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.18)] flex items-center justify-center overflow-hidden border-2 border-dashed border-transparent group-hover:border-[#007AFF] transition-colors">
                    {editAvatarPreview
                      ? <img src={editAvatarPreview} alt="" className="w-full h-full object-cover" />
                      : <span className="text-3xl font-bold text-[#007AFF]">{editingUser.full_name?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() ?? '?'}</span>
                    }
                  </div>
                  <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="flex flex-col items-center gap-1">
                      <Camera size={16} className="text-white" />
                      <span className="text-white text-[10px] font-semibold">{uploadAvatarMut.isPending ? 'Mengunggah…' : 'Ganti'}</span>
                    </div>
                  </div>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { const file = e.target.files?.[0]; if (!file || !editingUser) return; uploadAvatarMut.mutate({ id: editingUser.id, file }); e.target.value = ''; }} />
                <p className="text-[11px] text-gray-400 dark:text-white/30 mt-2">JPG/PNG/WEBP · Maks 2 MB</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nama Lengkap</label>
                  <input value={editForm.full_name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>NIK</label>
                  <input value={editForm.nik ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, nik: e.target.value }))} placeholder="opsional" className={inputCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={editForm.email ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>No. HP</label>
                <input type="tel" value={editForm.phone ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
              </div>

              <div>
                <label className={labelCls}>Jenis Kelamin</label>
                <div className="flex rounded-xl border border-black/[0.08] dark:border-white/[0.10] overflow-hidden">
                  {([{ v: 'male', label: 'Laki-laki' }, { v: 'female', label: 'Perempuan' }] as const).map(({ v, label }) => (
                    <button key={v} type="button" onClick={() => setEditForm((f) => ({ ...f, gender: f.gender === v ? '' : v }))}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${editForm.gender === v ? 'bg-[#007AFF] text-white' : 'bg-white dark:bg-white/[0.04] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.08]'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Role Sistem</label>
                  <select value={editForm.role_id ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, role_id: e.target.value }))} className={inputCls}>
                    <option value="">Pilih role</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Jabatan</label>
                  <select value={editForm.position_id ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, position_id: e.target.value }))} className={inputCls}>
                    <option value="">Tanpa jabatan</option>
                    {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Departemen</label>
                <select value={editForm.department_id ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, department_id: e.target.value }))} className={inputCls}>
                  <option value="">Tanpa departemen</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls}>Tipe Jadwal</label>
                <div className="flex rounded-xl border border-black/[0.08] dark:border-white/[0.10] overflow-hidden">
                  {(['office_hours', 'shift'] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setEditForm((f) => ({ ...f, schedule_type: v }))}
                      className={`flex-1 py-2.5 text-sm font-medium transition-colors ${editForm.schedule_type === v ? 'bg-[#007AFF] text-white' : 'bg-white dark:bg-white/[0.04] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.08]'}`}>
                      {v === 'office_hours' ? 'Office Hours' : 'Shift'}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between py-3 px-4 rounded-xl border border-black/[0.08] dark:border-white/[0.10] bg-gray-50/50 dark:bg-white/[0.02] cursor-pointer">
                <span className="text-sm font-medium text-gray-900 dark:text-white">Status Karyawan Aktif</span>
                <button type="button" onClick={() => setEditForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${editForm.is_active ? 'bg-[#34C759]' : 'bg-gray-200 dark:bg-white/20'}`}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${editForm.is_active ? 'translate-x-[18px]' : 'translate-x-[2px]'}`} />
                </button>
              </label>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3">
              <button onClick={() => { setEditingUser(null); setEditAvatarPreview(null); }}
                className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                Batal
              </button>
              <button onClick={submitEdit}
                disabled={updateUser.isPending || !editForm.full_name || !editForm.email || !editForm.phone || !editForm.role_id}
                className="flex-1 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {updateUser.isPending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
