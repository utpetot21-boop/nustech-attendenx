'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import {
  ListTodo, Plus, LayoutGrid, List, AlertTriangle, MapPin,
  Clock, User, ArrowUpRight, CheckCircle2, CircleDot,
  PauseCircle, RefreshCw, Radio, Target, Check, X,
  ChevronDown, Calendar, Zap, Ban, Trash2, UserPlus,
} from 'lucide-react';
import { getAuthUser } from '@/lib/auth';

// ── Types ─────────────────────────────────────────────────────────────────────
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
type TaskStatus   = 'unassigned' | 'pending_confirmation' | 'assigned' | 'on_hold' | 'rescheduled' | 'completed' | 'cancelled';

interface Task {
  id: string; title: string; description?: string; type?: string;
  priority: TaskPriority; status: TaskStatus;
  client?: { id: string; name: string };
  assignee?: { id: string; full_name: string };
  dispatch_type?: 'direct' | 'broadcast';
  confirm_deadline?: string; scheduled_at?: string;
  is_emergency: boolean; escalated_from?: string; created_at: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  canceller?: { id: string; full_name: string } | null;
}

interface Delegation {
  id: string; type: 'delegate' | 'swap' | null; reason: string; status: string;
  task?: { id: string; title: string; client?: { name: string } };
  from_user?: { full_name: string }; to_user?: { full_name: string };
  swap_task_id?: string | null; created_at: string;
}

interface Client { id: string; name: string }
interface User   { id: string; full_name: string; role?: { name: string } }
interface Department { id: string; name: string }

// ── Badge maps ────────────────────────────────────────────────────────────────
const PRIORITY_MAP: Record<TaskPriority, { label: string; dot: string; bg: string; text: string; ring: string }> = {
  low:    { label: 'Rendah',    dot: 'bg-gray-400',     bg: 'bg-gray-100 dark:bg-white/[0.06]',          text: 'text-gray-500 dark:text-white/50',     ring: 'border-gray-200' },
  normal: { label: 'Normal',    dot: 'bg-[#007AFF]',    bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]', text: 'text-[#007AFF]',                     ring: 'border-[#BFDBFE]' },
  high:   { label: 'Penting',   dot: 'bg-[#FF9500]',    bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)]', text: 'text-[#FF9500]',                     ring: 'border-[#FED7AA]' },
  urgent: { label: 'Mendadak',  dot: 'bg-[#FF3B30]',    bg: 'bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)]', text: 'text-[#FF3B30] font-semibold',        ring: 'border-[#FECACA]' },
};

const STATUS_MAP: Record<TaskStatus, { label: string; Icon: typeof CircleDot; color: string; bg: string; ring: string }> = {
  unassigned:           { label: 'Belum Ditugaskan',    Icon: CircleDot,    color: 'text-gray-400',    bg: 'bg-gray-50 dark:bg-white/[0.04]',             ring: 'border-gray-200' },
  pending_confirmation: { label: 'Menunggu Konfirmasi', Icon: Clock,        color: 'text-[#FF9500]',   bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.12)]', ring: 'border-[#FED7AA]' },
  assigned:             { label: 'Ditugaskan',          Icon: CheckCircle2, color: 'text-[#007AFF]',   bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.12)]', ring: 'border-[#BFDBFE]' },
  on_hold:              { label: 'Ditunda',             Icon: PauseCircle,  color: 'text-[#FF9500]',   bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.12)]', ring: 'border-[#FED7AA]' },
  rescheduled:          { label: 'Dijadwal Ulang',      Icon: RefreshCw,    color: 'text-[#AF52DE]',   bg: 'bg-[#F5F3FF] dark:bg-[rgba(175,82,222,0.12)]',ring: 'border-[#DDD6FE]' },
  completed:            { label: 'Selesai',             Icon: CheckCircle2, color: 'text-[#34C759]',   bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.12)]', ring: 'border-[#BBF7D0]' },
  cancelled:            { label: 'Dibatalkan',          Icon: Ban,          color: 'text-[#FF3B30]',   bg: 'bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.12)]', ring: 'border-[#FECACA]' },
};

const BOARD_COLUMNS: { key: TaskStatus[]; label: string; accent: string; headerBg: string }[] = [
  { key: ['unassigned'],             label: 'Belum Ditugaskan',    accent: 'border-t-gray-400',   headerBg: 'bg-gray-50 dark:bg-white/[0.03]'              },
  { key: ['pending_confirmation'],   label: 'Menunggu Konfirmasi', accent: 'border-t-[#FF9500]',  headerBg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.07)]' },
  { key: ['assigned'],               label: 'Ditugaskan',          accent: 'border-t-[#007AFF]',  headerBg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.07)]' },
  { key: ['on_hold', 'rescheduled'], label: 'Ditunda / Dijadwal',  accent: 'border-t-[#AF52DE]',  headerBg: 'bg-[#F5F3FF] dark:bg-[rgba(175,82,222,0.07)]'},
];

// ── KanbanCard ─────────────────────────────────────────────────────────────────
function KanbanCard({ task }: { task: Task }) {
  const p   = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.normal;
  const s   = STATUS_MAP[task.status]     ?? STATUS_MAP.unassigned;
  const now = new Date();
  const isOverdue = task.confirm_deadline && new Date(task.confirm_deadline) < now;

  return (
    <div className={`bg-white dark:bg-white/[0.06] rounded-2xl border p-3.5 shadow-sm hover:shadow-md transition-all duration-150 ${task.priority === 'urgent' ? 'border-l-[3px] border-l-[#FF3B30] border-black/[0.05] dark:border-white/[0.08]' : 'border-black/[0.05] dark:border-white/[0.08]'}`}>
      {/* Title row */}
      <div className="flex items-start gap-2 mb-2">
        {task.is_emergency && (
          <div className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-[#FEF2F2] flex items-center justify-center">
            <AlertTriangle size={10} className="text-[#FF3B30]" />
          </div>
        )}
        <p className="text-xs font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2 flex-1">{task.title}</p>
        <span className={`flex-shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${p.bg} ${p.text} ${p.ring}`}>
          {p.label}
        </span>
      </div>

      {/* Client */}
      {task.client && (
        <div className="flex items-center gap-1 mb-2">
          <MapPin size={10} className="text-gray-400 dark:text-white/30 flex-shrink-0" />
          <p className="text-[11px] text-gray-500 dark:text-white/40 truncate">{task.client.name}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
            <User size={9} className="text-gray-400 dark:text-white/30" />
          </div>
          <p className="text-[10px] text-gray-500 dark:text-white/40 truncate">
            {task.assignee?.full_name ?? <span className="italic text-gray-300 dark:text-white/20">Belum ada</span>}
          </p>
        </div>
        {task.confirm_deadline && (
          <div className={`flex items-center gap-0.5 flex-shrink-0 text-[10px] ${isOverdue ? 'text-[#FF3B30] font-semibold' : 'text-gray-400 dark:text-white/30'}`}>
            <Clock size={9} />
            {new Date(task.confirm_deadline).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })}
          </div>
        )}
      </div>

      {task.escalated_from && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-[#FF9500] font-medium">
          <ArrowUpRight size={10} />
          Eskalasi
        </div>
      )}
    </div>
  );
}

// ── TaskListCard (mobile / table-mode card) ───────────────────────────────────
function TaskListCard({
  task,
  onAssign,
  onCancel,
  onDelete,
}: {
  task: Task;
  onAssign?: (t: Task) => void;
  onCancel?: (t: Task) => void;
  onDelete?: (t: Task) => void;
}) {
  const p = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.normal;
  const s = STATUS_MAP[task.status]     ?? STATUS_MAP.unassigned;
  const SIcon = s.Icon;
  const isOverdue = task.confirm_deadline && new Date(task.confirm_deadline) < new Date();
  const assignable = onAssign && task.status === 'unassigned';
  const cancellable = onCancel && task.status !== 'cancelled' && task.status !== 'completed';
  const deletable = !!onDelete;

  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4 shadow-sm">
      {/* Top row */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0 ${p.bg} border ${p.ring}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${p.dot}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {task.is_emergency && <AlertTriangle size={12} className="text-[#FF3B30] flex-shrink-0 mt-0.5" />}
            <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">{task.title}</p>
          </div>
          {task.client && (
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin size={10} className="text-gray-400 dark:text-white/30" />
              <p className="text-xs text-gray-500 dark:text-white/40 truncate">{task.client.name}</p>
            </div>
          )}
        </div>
        <span className={`flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${p.bg} ${p.text} ${p.ring}`}>
          {p.label}
        </span>
      </div>

      {task.status === 'cancelled' && task.cancel_reason && (
        <div className="mb-3 p-2.5 rounded-xl bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.10)] border border-[#FECACA] dark:border-[rgba(255,59,48,0.25)]">
          <p className="text-[11px] font-semibold text-[#FF3B30] mb-0.5 flex items-center gap-1">
            <Ban size={10} /> Dibatalkan
            {task.canceller && <span className="font-normal text-gray-500 dark:text-white/40">oleh {task.canceller.full_name}</span>}
          </p>
          <p className="text-[11px] text-gray-700 dark:text-white/70 leading-relaxed">{task.cancel_reason}</p>
        </div>
      )}

      {/* Bottom pills */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Status */}
        <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${s.bg} ${s.color} ${s.ring}`}>
          <SIcon size={10} strokeWidth={2} />
          {s.label}
        </span>

        {/* Assignee */}
        {task.assignee && (
          <span className="flex items-center gap-1 text-[11px] text-gray-500 dark:text-white/40 bg-gray-50 dark:bg-white/[0.05] px-2 py-0.5 rounded-full border border-gray-200 dark:border-white/[0.08]">
            <User size={9} />
            {task.assignee.full_name}
          </span>
        )}

        {/* Deadline */}
        {task.confirm_deadline && (
          <span className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
            isOverdue
              ? 'bg-[#FEF2F2] text-[#FF3B30] border-[#FECACA] font-semibold'
              : 'bg-gray-50 dark:bg-white/[0.05] text-gray-500 dark:text-white/40 border-gray-200 dark:border-white/[0.08]'
          }`}>
            <Clock size={9} />
            {new Date(task.confirm_deadline).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' })}
          </span>
        )}

        {task.escalated_from && (
          <span className="flex items-center gap-1 text-[11px] text-[#FF9500] bg-[#FFF7ED] border border-[#FED7AA] px-2 py-0.5 rounded-full font-medium">
            <ArrowUpRight size={9} />
            Eskalasi
          </span>
        )}
      </div>

      {(assignable || cancellable || deletable) && (
        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
          {assignable && (
            <button
              onClick={() => onAssign!(task)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#007AFF] hover:bg-[#0066CC] border border-[#0066CC] px-3 py-1.5 rounded-lg transition shadow-sm"
            >
              <UserPlus size={12} />
              Tugaskan
            </button>
          )}
          {cancellable && (
            <button
              onClick={() => onCancel!(task)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[#FF3B30] bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.12)] border border-[#FECACA] dark:border-[rgba(255,59,48,0.30)] hover:bg-[#FEE2E2] dark:hover:bg-[rgba(255,59,48,0.18)] px-3 py-1.5 rounded-lg transition"
            >
              <Ban size={12} />
              Batalkan
            </button>
          )}
          {deletable && (
            <button
              onClick={() => onDelete!(task)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#DC2626] hover:bg-[#B91C1C] border border-[#B91C1C] px-3 py-1.5 rounded-lg transition shadow-sm"
            >
              <Trash2 size={12} />
              Hapus
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const qc = useQueryClient();
  const [viewMode,  setViewMode]  = useState<'board' | 'list'>('board');
  const [showForm,  setShowForm]  = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [cancelTarget, setCancelTarget] = useState<Task | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [assignTarget, setAssignTarget] = useState<Task | null>(null);
  const [assignUserId, setAssignUserId] = useState('');

  const [userRole, setUserRole] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUserRole(getAuthUser()?.role?.name);
  }, []);
  const canCancel = userRole === 'admin' || userRole === 'super_admin';
  const canDelete = userRole === 'super_admin';
  const canAssign = userRole === 'admin' || userRole === 'super_admin' || userRole === 'manager';

  const [form, setForm] = useState({
    title: '', description: '', type: 'visit', priority: 'normal' as TaskPriority,
    client_id: '', dispatch_type: 'direct' as 'direct' | 'broadcast',
    assigned_to: '', broadcast_dept_id: '', scheduled_at: '', is_emergency: false, notes: '',
  });

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks-web', filterStatus],
    queryFn: () => apiClient.get('/tasks', {
      params: { limit: 100, status: filterStatus === 'all' ? undefined : filterStatus },
    }).then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: clients = [] }  = useQuery<Client[]>({ queryKey: ['clients'],     queryFn: () => apiClient.get('/clients').then((r) => r.data.items ?? r.data) });
  const { data: users   = [] }  = useQuery<User[]>({   queryKey: ['users'],       queryFn: () => apiClient.get('/users').then((r) => r.data.items ?? r.data) });
  const { data: depts   = [] }  = useQuery<Department[]>({ queryKey: ['departments'], queryFn: () => apiClient.get('/departments').then((r) => r.data.items ?? r.data) });

  const { data: pendingDelegations = [] } = useQuery<Delegation[]>({
    queryKey: ['pending-delegations'],
    queryFn: () => apiClient.get('/tasks/delegations/pending').then((r) => r.data),
    refetchInterval: 15000,
  });

  const createMut = useMutation({
    mutationFn: () => apiClient.post('/tasks', {
      ...form,
      client_id:         form.client_id                                    || undefined,
      assigned_to:       form.dispatch_type === 'direct'    ? form.assigned_to       || undefined : undefined,
      broadcast_dept_id: form.dispatch_type === 'broadcast' ? form.broadcast_dept_id || undefined : undefined,
      scheduled_at:      form.scheduled_at || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-web'] });
      setForm((f) => ({ ...f, title: '', description: '', notes: '' }));
      setShowForm(false);
      toast.success('Tugas berhasil dibuat');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal membuat tugas')),
  });

  const approveDelegMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/tasks/delegations/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-delegations'] });
      qc.invalidateQueries({ queryKey: ['tasks-web'] });
      toast.success('Delegasi disetujui');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyetujui delegasi')),
  });

  const rejectDelegMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/tasks/delegations/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-delegations'] });
      toast.success('Delegasi ditolak');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menolak delegasi')),
  });

  const cancelMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/tasks/${id}/cancel`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-web'] });
      setCancelTarget(null);
      setCancelReason('');
      toast.success('Tugas berhasil dibatalkan');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal membatalkan tugas')),
  });

  const onCancelHandler = canCancel
    ? (t: Task) => { setCancelTarget(t); setCancelReason(''); }
    : undefined;

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-web'] });
      setDeleteTarget(null);
      setDeleteConfirm('');
      toast.success('Tugas berhasil dihapus permanen');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menghapus tugas')),
  });

  const onDeleteHandler = canDelete
    ? (t: Task) => { setDeleteTarget(t); setDeleteConfirm(''); }
    : undefined;

  const assignMut = useMutation({
    mutationFn: ({ id, user_id }: { id: string; user_id: string }) =>
      apiClient.post(`/tasks/${id}/assign`, { user_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-web'] });
      setAssignTarget(null);
      setAssignUserId('');
      toast.success('Tugas berhasil ditugaskan');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menugaskan tugas')),
  });

  const onAssignHandler = canAssign
    ? (t: Task) => { setAssignTarget(t); setAssignUserId(''); }
    : undefined;

  const tasks: Task[] = tasksData?.items ?? [];
  const total         = tasksData?.total ?? 0;

  // Stat counts
  const countByStatus = (statuses: TaskStatus[]) => tasks.filter((t) => statuses.includes(t.status)).length;
  const emergency     = tasks.filter((t) => t.is_emergency).length;
  const unassigned    = countByStatus(['unassigned']);
  const pending       = countByStatus(['pending_confirmation']);
  const completed     = countByStatus(['completed']);

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Dispatch & Tugas</h1>
            <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">{total} tugas aktif</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0066CC] active:scale-[0.97] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.35)]"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Buat Tugas</span>
            <span className="sm:hidden">Buat</span>
          </button>
        </div>

        {/* ── Summary cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Tugas',  value: total,      Icon: ListTodo,    bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)]',    color: 'text-[#007AFF]'  },
            { label: 'Belum Diisi', value: unassigned,  Icon: CircleDot,   bg: 'bg-gray-100 dark:bg-white/[0.06]',                color: 'text-gray-500 dark:text-white/50' },
            { label: 'Menunggu',    value: pending,     Icon: Clock,       bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.15)]',     color: 'text-[#FF9500]'  },
            { label: 'Darurat',     value: emergency,   Icon: Zap,         bg: 'bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)]',     color: 'text-[#FF3B30]'  },
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

        {/* ── Filter + View toggle bar ───────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1.5 flex-1">
            {[
              { value: 'all',                  label: 'Semua' },
              { value: 'unassigned',            label: 'Belum' },
              { value: 'pending_confirmation',  label: 'Menunggu' },
              { value: 'assigned',              label: 'Ditugaskan' },
              { value: 'on_hold',               label: 'Ditunda' },
              { value: 'rescheduled',           label: 'Dijadwal Ulang' },
              { value: 'completed',             label: 'Selesai' },
              { value: 'cancelled',             label: 'Dibatalkan' },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFilterStatus(value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  filterStatus === value
                    ? 'bg-[#007AFF] text-white shadow-[0_2px_6px_rgba(0,122,255,0.30)]'
                    : 'bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.10]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex bg-white dark:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.08] rounded-xl p-0.5 gap-0.5 flex-shrink-0">
            {([['board', LayoutGrid], ['list', List]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center justify-center w-8 h-7 rounded-[9px] transition-all ${
                  viewMode === mode
                    ? 'bg-[#007AFF] text-white shadow-sm'
                    : 'text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
                }`}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Delegation approvals banner ────────────────────────────────────── */}
      {pendingDelegations.length > 0 && (
        <div className="px-4 sm:px-6 mb-4">
          <div className="bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.12)] border border-[#FED7AA] dark:border-[rgba(255,149,0,0.30)] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-[8px] bg-[#FF9500]/20 flex items-center justify-center">
                <RefreshCw size={14} className="text-[#FF9500]" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {pendingDelegations.length} Permintaan Delegasi / Swap
              </p>
            </div>
            <div className="space-y-2">
              {pendingDelegations.map((d) => (
                <div key={d.id} className="bg-white/70 dark:bg-white/[0.05] rounded-xl border border-[#FED7AA] dark:border-white/[0.08] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1">{d.task?.title ?? '—'}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5">
                        {d.from_user?.full_name} → {d.to_user?.full_name}
                        <span className="ml-1.5 font-medium text-[#FF9500]">
                          {d.type === 'swap' ? '(Swap)' : '(Delegasi)'}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => approveDelegMut.mutate(d.id)}
                        disabled={approveDelegMut.isPending}
                        className="w-8 h-8 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center text-[#34C759] hover:bg-[#DCFCE7] transition"
                      >
                        <Check size={14} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => rejectDelegMut.mutate(d.id)}
                        disabled={rejectDelegMut.isPending}
                        className="w-8 h-8 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#FF3B30] hover:bg-[#FEE2E2] transition"
                      >
                        <X size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pb-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <ListTodo size={28} className="text-gray-300 dark:text-white/20" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-white/40">Tidak ada tugas</p>
            <p className="text-xs text-gray-400 dark:text-white/25 mt-1">Buat tugas baru dengan tombol di atas</p>
          </div>
        ) : viewMode === 'board' ? (
          /* ── KANBAN BOARD (desktop) / list (mobile) ── */
          <>
            {/* Desktop kanban — hidden on mobile, horizontal scroll on tablet */}
            <div className="hidden md:flex gap-4 overflow-x-auto pb-2">
              {BOARD_COLUMNS.map((col) => {
                const colTasks = tasks.filter((t) => col.key.includes(t.status));
                return (
                  <div key={col.key[0]} className={`flex-shrink-0 w-[280px] bg-white/60 dark:bg-white/[0.03] rounded-2xl border border-black/[0.05] dark:border-white/[0.07] border-t-2 ${col.accent} overflow-hidden`}>
                    {/* Column header */}
                    <div className={`px-3 py-2.5 flex items-center justify-between ${col.headerBg}`}>
                      <h3 className="text-[11px] font-bold text-gray-700 dark:text-white/70 uppercase tracking-wider">{col.label}</h3>
                      <span className="text-xs font-bold bg-white dark:bg-white/10 rounded-full px-2 py-0.5 text-gray-600 dark:text-white/60 shadow-sm">{colTasks.length}</span>
                    </div>
                    {/* Cards */}
                    <div className="p-2.5 flex flex-col gap-2 min-h-[200px]">
                      {colTasks.length === 0 ? (
                        <div className="flex items-center justify-center py-8 text-gray-300 dark:text-white/15 text-xs">Kosong</div>
                      ) : (
                        colTasks.map((t) => <KanbanCard key={t.id} task={t} />)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile list cards */}
            <div className="md:hidden space-y-3">
              {tasks.map((t) => <TaskListCard key={t.id} task={t} onAssign={onAssignHandler} onCancel={onCancelHandler} onDelete={onDeleteHandler} />)}
            </div>
          </>
        ) : (
          /* ── LIST VIEW ── */
          <div className="space-y-3">
            {tasks.map((t) => <TaskListCard key={t.id} task={t} onAssign={onAssignHandler} onCancel={onCancelHandler} onDelete={onDeleteHandler} />)}
          </div>
        )}
      </div>

      {/* ── Create Task Modal ──────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-md shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)] flex items-center justify-center">
                  <Plus size={16} className="text-[#007AFF]" />
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Buat Tugas Baru</h2>
              </div>
              <button
                onClick={() => setShowForm(false)}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/20 transition"
              >
                <X size={14} />
              </button>
            </div>

            {/* Form body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Judul *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition"
                  placeholder="Nama tugas..."
                />
              </div>

              {/* Type + Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Tipe</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] transition"
                  >
                    <option value="visit">Kunjungan</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="inspection">Inspeksi</option>
                    <option value="other">Lainnya</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Prioritas</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
                    className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] transition"
                  >
                    <option value="low">Rendah</option>
                    <option value="normal">Normal</option>
                    <option value="high">Penting</option>
                    <option value="urgent">Mendadak</option>
                  </select>
                </div>
              </div>

              {/* Client */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Klien</label>
                <select
                  value={form.client_id}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] transition"
                >
                  <option value="">— Pilih klien —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Dispatch type */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Dispatch</label>
                <div className="flex gap-2">
                  {([
                    { val: 'direct',    label: 'Direct',     Icon: Target },
                    { val: 'broadcast', label: 'Broadcast',  Icon: Radio  },
                  ] as const).map(({ val, label, Icon }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, dispatch_type: val }))}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                        form.dispatch_type === val
                          ? 'border-[#007AFF] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)] text-[#007AFF]'
                          : 'border-black/[0.08] dark:border-white/[0.10] text-gray-500 dark:text-white/50 bg-gray-50 dark:bg-white/[0.04] hover:bg-gray-100 dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assignee / Dept */}
              {form.dispatch_type === 'direct' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Teknisi *</label>
                  <select
                    value={form.assigned_to}
                    onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] transition"
                  >
                    <option value="">— Pilih teknisi —</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Departemen *</label>
                  <select
                    value={form.broadcast_dept_id}
                    onChange={(e) => setForm((f) => ({ ...f, broadcast_dept_id: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] transition"
                  >
                    <option value="">— Pilih departemen —</option>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}

              {/* Schedule */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">
                  <span className="flex items-center gap-1.5"><Calendar size={11} /> Jadwal</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                  className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] transition"
                />
              </div>

              {/* Emergency toggle */}
              <label className="flex items-center gap-3 cursor-pointer select-none bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.10)] border border-[#FECACA] dark:border-[rgba(255,59,48,0.25)] rounded-xl px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.is_emergency}
                  onChange={(e) => setForm((f) => ({ ...f, is_emergency: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#FF3B30]"
                />
                <div className="flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-[#FF3B30]" />
                  <span className="text-sm font-medium text-[#FF3B30]">Tandai sebagai Darurat</span>
                </div>
              </label>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
              >
                Batal
              </button>
              <button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !form.title}
                className="flex-1 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {createMut.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Buat & Kirim <ArrowUpRight size={14} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Task Modal ──────────────────────────────────────────────── */}
      {assignTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-md shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.15)] flex items-center justify-center">
                  <UserPlus size={16} className="text-[#007AFF]" />
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Tugaskan ke Teknisi</h2>
              </div>
              <button
                onClick={() => { setAssignTarget(null); setAssignUserId(''); }}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/20 transition"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08]">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-1">Tugas</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{assignTarget.title}</p>
                {assignTarget.client && (
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">Klien: {assignTarget.client.name}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">
                  Pilih Teknisi *
                </label>
                <select
                  value={assignUserId}
                  onChange={(e) => setAssignUserId(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition"
                >
                  <option value="">— Pilih teknisi —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.08)] border border-[#BFDBFE] dark:border-[rgba(0,122,255,0.25)]">
                <p className="text-[11px] text-[#007AFF] leading-relaxed">
                  Teknisi akan menerima notifikasi untuk mengkonfirmasi tugas ini.
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3">
              <button
                onClick={() => { setAssignTarget(null); setAssignUserId(''); }}
                className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
              >
                Batal
              </button>
              <button
                onClick={() => assignMut.mutate({ id: assignTarget.id, user_id: assignUserId })}
                disabled={assignMut.isPending || !assignUserId}
                className="flex-1 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {assignMut.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><UserPlus size={14} /> Tugaskan</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Task Modal ──────────────────────────────────────────────── */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-md shadow-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)] flex items-center justify-center">
                  <Ban size={16} className="text-[#FF3B30]" />
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Batalkan Tugas</h2>
              </div>
              <button
                onClick={() => { setCancelTarget(null); setCancelReason(''); }}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/20 transition"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08]">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-1">Tugas</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{cancelTarget.title}</p>
                {cancelTarget.assignee && (
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                    Teknisi: {cancelTarget.assignee.full_name}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">
                  Alasan Pembatalan *
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value.slice(0, 500))}
                  placeholder="Jelaskan alasan pembatalan (minimal 5 karakter)..."
                  rows={4}
                  className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#FF3B30] focus:ring-2 focus:ring-[#FF3B30]/20 transition resize-none"
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[11px] text-gray-400 dark:text-white/30">Min 5, maks 500 karakter</p>
                  <p className="text-[11px] text-gray-400 dark:text-white/30">{cancelReason.length}/500</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.08)] border border-[#FED7AA] dark:border-[rgba(255,149,0,0.25)]">
                <p className="text-[11px] text-[#FF9500] leading-relaxed">
                  ⚠ Pembatalan akan menutup penugasan aktif. Teknisi dan pembuat tugas akan menerima notifikasi.
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3">
              <button
                onClick={() => { setCancelTarget(null); setCancelReason(''); }}
                className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
              >
                Batal
              </button>
              <button
                onClick={() => cancelMut.mutate({ id: cancelTarget.id, reason: cancelReason.trim() })}
                disabled={cancelMut.isPending || cancelReason.trim().length < 5}
                className="flex-1 py-3 bg-[#FF3B30] hover:bg-[#E0352A] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(255,59,48,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {cancelMut.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Ban size={14} /> Batalkan Tugas</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Task Modal (super_admin) ──────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-[#1C1C1E] rounded-3xl w-full max-w-md shadow-2xl border border-[#DC2626]/30 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[10px] bg-[#FEF2F2] dark:bg-[rgba(220,38,38,0.15)] flex items-center justify-center">
                  <Trash2 size={16} className="text-[#DC2626]" />
                </div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Hapus Tugas Permanen</h2>
              </div>
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); }}
                className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/20 transition"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08]">
                <p className="text-[11px] font-semibold text-gray-500 dark:text-white/40 uppercase tracking-wider mb-1">Tugas yang akan dihapus</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{deleteTarget.title}</p>
                {deleteTarget.assignee && (
                  <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">
                    Teknisi: {deleteTarget.assignee.full_name}
                  </p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-[#FEF2F2] dark:bg-[rgba(220,38,38,0.10)] border border-[#DC2626]/30">
                <p className="text-[11px] font-bold text-[#DC2626] mb-1.5 flex items-center gap-1">
                  <AlertTriangle size={12} /> PERINGATAN — Tidak dapat dibatalkan
                </p>
                <ul className="text-[11px] text-gray-700 dark:text-white/70 space-y-1 list-disc pl-4 leading-relaxed">
                  <li>Tugas, penugasan, riwayat hold, dan delegasi akan dihapus permanen dari database</li>
                  <li>Kunjungan yang terhubung akan tetap ada tapi kehilangan referensi tugas</li>
                  <li>Untuk audit trail, gunakan "Batalkan" — bukan hapus</li>
                </ul>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">
                  Ketik <span className="font-mono text-[#DC2626]">HAPUS</span> untuk mengkonfirmasi
                </label>
                <input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder="HAPUS"
                  className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm font-mono text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/20 transition"
                />
              </div>
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3">
              <button
                onClick={() => { setDeleteTarget(null); setDeleteConfirm(''); }}
                className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
              >
                Batal
              </button>
              <button
                onClick={() => deleteMut.mutate(deleteTarget.id)}
                disabled={deleteMut.isPending || deleteConfirm !== 'HAPUS'}
                className="flex-1 py-3 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(220,38,38,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {deleteMut.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Trash2 size={14} /> Hapus Permanen</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
