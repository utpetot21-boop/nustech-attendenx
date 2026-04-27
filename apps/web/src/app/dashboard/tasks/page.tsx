'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import {
  ListTodo, Plus, AlertTriangle, MapPin,
  Clock, User, ArrowUpRight, CheckCircle2, CircleDot,
  PauseCircle, RefreshCw, Radio, Target, Check, X,
  Calendar, Zap, Ban, Trash2, UserPlus, FileText, Play, Navigation,
} from 'lucide-react';
import { getAuthUser } from '@/lib/auth';
import { VisitsTab } from './_visits-tab';

// ── Types ─────────────────────────────────────────────────────────────────────
type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
type TaskStatus   = 'unassigned' | 'pending_confirmation' | 'assigned' | 'in_progress' | 'on_hold' | 'rescheduled' | 'completed' | 'cancelled';

interface LatestVisit {
  id: string;
  status: string;
  review_status: 'approved' | 'revision_needed' | null;
  review_rating: number | null;
  check_in_at: string | null;
  check_out_at: string | null;
  duration_minutes: number | null;
}

interface LatestVisitDetail extends LatestVisit {
  check_in_address?: string | null;
  work_description?: string | null;
  findings?: string | null;
  recommendations?: string | null;
  materials_used?: { name: string; qty: string }[] | null;
  photos?: { id: string; phase: string; seq_number: number | null; watermarked_url: string; thumbnail_url: string | null; caption?: string | null; taken_at: string }[];
}

interface TaskDetail extends Task {
  notes?: string | null;
  latest_visit?: LatestVisitDetail | null;
}

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
  latest_visit?: LatestVisit | null;
}

interface OnHoldTask {
  id: string; title: string; priority: string;
  assignee?: { full_name: string } | null;
  pending_hold?: { id: string; reason_type: string; reason_notes: string; auto_approve_at: string | null } | null;
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
  unassigned:           { label: 'Belum Ditugaskan',    Icon: CircleDot,    color: 'text-gray-400',    bg: 'bg-gray-50 dark:bg-white/[0.04]',              ring: 'border-gray-200'  },
  pending_confirmation: { label: 'Menunggu Konfirmasi', Icon: Clock,        color: 'text-[#FF9500]',   bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.12)]',  ring: 'border-[#FED7AA]' },
  assigned:             { label: 'Ditugaskan',          Icon: CheckCircle2, color: 'text-[#007AFF]',   bg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.12)]',  ring: 'border-[#BFDBFE]' },
  in_progress:          { label: 'Dikerjakan',          Icon: Radio,        color: 'text-[#34C759]',   bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.12)]',  ring: 'border-[#BBF7D0]' },
  on_hold:              { label: 'Ditunda',             Icon: PauseCircle,  color: 'text-[#FF9500]',   bg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.12)]',  ring: 'border-[#FED7AA]' },
  rescheduled:          { label: 'Dijadwal Ulang',      Icon: RefreshCw,    color: 'text-[#AF52DE]',   bg: 'bg-[#F5F3FF] dark:bg-[rgba(175,82,222,0.12)]', ring: 'border-[#DDD6FE]' },
  completed:            { label: 'Selesai',             Icon: CheckCircle2, color: 'text-[#34C759]',   bg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.12)]',  ring: 'border-[#BBF7D0]' },
  cancelled:            { label: 'Dibatalkan',          Icon: Ban,          color: 'text-[#FF3B30]',   bg: 'bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.12)]',  ring: 'border-[#FECACA]' },
};

const BOARD_COLUMNS: { key: TaskStatus[]; label: string; accent: string; headerBg: string }[] = [
  { key: ['unassigned'],             label: 'Belum Ditugaskan',    accent: 'border-t-gray-400',   headerBg: 'bg-gray-50 dark:bg-white/[0.03]'               },
  { key: ['pending_confirmation'],   label: 'Menunggu Konfirmasi', accent: 'border-t-[#FF9500]',  headerBg: 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.07)]'  },
  { key: ['assigned'],               label: 'Ditugaskan',          accent: 'border-t-[#007AFF]',  headerBg: 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.07)]'  },
  { key: ['in_progress'],            label: 'Dikerjakan',          accent: 'border-t-[#34C759]',  headerBg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.07)]'  },
  { key: ['on_hold', 'rescheduled'], label: 'Ditunda / Dijadwal',  accent: 'border-t-[#AF52DE]',  headerBg: 'bg-[#F5F3FF] dark:bg-[rgba(175,82,222,0.07)]' },
  { key: ['completed'],              label: 'Selesai',             accent: 'border-t-[#34C759]',  headerBg: 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.07)]'  },
];

// ── Visit badge helper ────────────────────────────────────────────────────────
function visitBadge(v: LatestVisit | null | undefined): { label: string; color: string } | null {
  if (!v) return null;
  if (v.status === 'ongoing') return { label: 'Kunjungan Berlangsung', color: '#007AFF' };
  if (v.review_status === 'approved') return { label: `Disetujui${v.review_rating ? ` ★${v.review_rating}` : ''}`, color: '#34C759' };
  if (v.review_status === 'revision_needed') return { label: `Perlu Revisi${v.review_rating ? ` ★${v.review_rating}` : ''}`, color: '#FF9500' };
  if (v.status === 'completed') return { label: 'Menunggu Tinjauan', color: '#5AC8FA' };
  return null;
}

// ── KanbanCard ─────────────────────────────────────────────────────────────────
function KanbanCard({ task, onDetail }: { task: Task; onDetail?: () => void }) {
  const p   = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.normal;
  const now = new Date();
  const isOverdue = task.confirm_deadline && new Date(task.confirm_deadline) < now;

  return (
    <div
      onClick={onDetail}
      className={`bg-white dark:bg-white/[0.06] rounded-2xl border p-3.5 shadow-sm hover:shadow-md transition-all duration-150 ${onDetail ? 'cursor-pointer' : ''} ${task.priority === 'urgent' ? 'border-l-[3px] border-l-[#FF3B30] border-black/[0.05] dark:border-white/[0.08]' : 'border-black/[0.05] dark:border-white/[0.08]'}`}
    >
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

      {/* Visit status badge */}
      {(() => { const vb = visitBadge(task.latest_visit); if (!vb) return null; return (
        <div className="flex items-center gap-1 mb-2" style={{ color: vb.color }}>
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: vb.color }} />
          <p className="text-[10px] font-semibold truncate">{vb.label}</p>
        </div>
      ); })()}

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
  onDetail,
}: {
  task: Task;
  onAssign?: (t: Task) => void;
  onCancel?: (t: Task) => void;
  onDelete?: (t: Task) => void;
  onDetail?: () => void;
}) {
  const p = PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.normal;
  const s = STATUS_MAP[task.status]     ?? STATUS_MAP.unassigned;
  const SIcon = s.Icon;
  const isOverdue = task.confirm_deadline && new Date(task.confirm_deadline) < new Date();
  const assignable = onAssign && task.status === 'unassigned';
  const cancellable = onCancel && task.status !== 'cancelled' && task.status !== 'completed';
  const deletable = !!onDelete;

  return (
    <div onClick={onDetail} className={`bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4 shadow-sm ${onDetail ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}>
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

        {/* Visit status badge */}
        {(() => { const vb = visitBadge(task.latest_visit); if (!vb) return null; return (
          <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border" style={{ color: vb.color, backgroundColor: vb.color + '18', borderColor: vb.color + '44' }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: vb.color }} />
            {vb.label}
          </span>
        ); })()}

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
        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]" onClick={(e) => e.stopPropagation()}>
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

// ── Task Detail Drawer ────────────────────────────────────────────────────────
function TaskDetailDrawer({
  taskId, canAssign, onClose, onInvalidate,
}: {
  taskId: string; canAssign: boolean; onClose: () => void; onInvalidate: () => void;
}) {
  const qc = useQueryClient();
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewNotes, setReviewNotes] = useState('');

  const { data: task, isLoading } = useQuery({
    queryKey: ['task-detail-web', taskId],
    queryFn: () => apiClient.get(`/tasks/${taskId}`).then((r) => r.data as TaskDetail),
    enabled: !!taskId,
  });

  const reviewMut = useMutation({
    mutationFn: ({ visitId, status }: { visitId: string; status: 'approved' | 'revision_needed' }) =>
      apiClient.post(`/visits/${visitId}/review`, { review_status: status, review_rating: reviewRating, review_notes: reviewNotes.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-detail-web', taskId] });
      onInvalidate();
      setReviewNotes(''); setReviewRating(5);
      toast.success('Tinjauan berhasil disimpan');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyimpan tinjauan')),
  });

  const p = task ? (PRIORITY_MAP[task.priority] ?? PRIORITY_MAP.normal) : null;
  const s = task ? (STATUS_MAP[task.status]   ?? STATUS_MAP.unassigned) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative z-10 w-full sm:max-w-[420px] bg-white dark:bg-[#1C1C1E] h-full flex flex-col border-l border-black/[0.06] dark:border-white/[0.10] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 dark:text-white truncate pr-3">Detail Tugas</h2>
          <button onClick={onClose} className="w-7 h-7 flex-shrink-0 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/20 transition">
            <X size={14} />
          </button>
        </div>

        {isLoading || !task ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Title + badges */}
            <div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {p && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${p.bg} ${p.text} ${p.ring}`}>{p.label}</span>}
                {s && <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${s.bg} ${s.color} ${s.ring}`}><s.Icon size={9} />{s.label}</span>}
                {task.is_emergency && <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FEF2F2] dark:bg-[rgba(255,59,48,0.15)] text-[#FF3B30] border border-[#FECACA]"><Zap size={9} />Darurat</span>}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{task.title}</h3>
              {task.description && <p className="text-sm text-gray-500 dark:text-white/50 mt-2 leading-relaxed">{task.description}</p>}
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                task.client    && { icon: MapPin,    label: 'Klien',    value: task.client.name },
                task.assignee  && { icon: User,      label: 'Teknisi',  value: task.assignee.full_name },
                task.scheduled_at && { icon: Calendar, label: 'Jadwal', value: new Date(task.scheduled_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
                { icon: Clock, label: 'Dibuat', value: new Date(task.created_at).toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', year: 'numeric' }) },
              ].filter(Boolean).map((item) => {
                const it = item as { icon: typeof MapPin; label: string; value: string };
                return (
                  <div key={it.label} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3 border border-black/[0.05] dark:border-white/[0.08]">
                    <p className="text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wider mb-1">{it.label}</p>
                    <div className="flex items-center gap-1">
                      <it.icon size={11} className="text-gray-400 dark:text-white/30 flex-shrink-0" />
                      <p className="text-xs font-semibold text-gray-800 dark:text-white truncate">{it.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Kunjungan Terkini */}
            {task.latest_visit && (
              <div className="bg-white dark:bg-white/[0.04] rounded-2xl border border-black/[0.06] dark:border-white/[0.10] overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.05] dark:border-white/[0.07] bg-gray-50 dark:bg-white/[0.03]">
                  <div className="w-6 h-6 rounded-[7px] bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.18)] flex items-center justify-center flex-shrink-0">
                    <Target size={12} className="text-[#007AFF]" />
                  </div>
                  <span className="text-xs font-bold text-gray-700 dark:text-white/70 uppercase tracking-wider">Kunjungan Terkini</span>
                </div>
                <div className="p-4 space-y-3">
                  {/* Status */}
                  {(() => { const vb = visitBadge(task.latest_visit); if (!vb) return null; return (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: vb.color }} />
                      <span className="text-xs font-semibold" style={{ color: vb.color }}>{vb.label}</span>
                    </div>
                  ); })()}

                  {/* Times */}
                  {task.latest_visit.check_in_at && (
                    <div className="flex items-center gap-2">
                      <Play size={11} className="text-gray-400 dark:text-white/30 flex-shrink-0" />
                      <span className="text-xs text-gray-600 dark:text-white/60">
                        Check-in: {new Date(task.latest_visit.check_in_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} WITA
                      </span>
                    </div>
                  )}
                  {task.latest_visit.check_out_at && (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={11} className="text-gray-400 dark:text-white/30 flex-shrink-0" />
                      <span className="text-xs text-gray-600 dark:text-white/60">
                        Check-out: {new Date(task.latest_visit.check_out_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} WITA
                        {task.latest_visit.duration_minutes ? ` · ${Math.floor(task.latest_visit.duration_minutes / 60)}j ${task.latest_visit.duration_minutes % 60}m` : ''}
                      </span>
                    </div>
                  )}

                  {/* Work description */}
                  {task.latest_visit.work_description && (
                    <div className="p-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl border border-black/[0.04] dark:border-white/[0.06]">
                      <p className="text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wider mb-1.5">Laporan Pekerjaan</p>
                      <p className="text-xs text-gray-700 dark:text-white/70 leading-relaxed">{task.latest_visit.work_description}</p>
                    </div>
                  )}

                  {/* Photos count */}
                  {task.latest_visit.photos && task.latest_visit.photos.length > 0 && (
                    <div className="flex items-center gap-2">
                      <FileText size={11} className="text-gray-400 dark:text-white/30 flex-shrink-0" />
                      <span className="text-xs text-gray-500 dark:text-white/50">{task.latest_visit.photos.length} foto terlampir</span>
                    </div>
                  )}

                  {/* Review result (already reviewed) */}
                  {task.latest_visit.review_status && (
                    <div className={`p-3 rounded-xl border text-xs font-semibold ${
                      task.latest_visit.review_status === 'approved'
                        ? 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.08)] border-[#BBF7D0] dark:border-[rgba(52,199,89,0.25)] text-[#34C759]'
                        : 'bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.08)] border-[#FED7AA] dark:border-[rgba(255,149,0,0.25)] text-[#FF9500]'
                    }`}>
                      {task.latest_visit.review_status === 'approved' ? '✓ Disetujui' : '⚠ Perlu Revisi'}
                      {task.latest_visit.review_rating ? ` · ${'★'.repeat(task.latest_visit.review_rating)}` : ''}
                    </div>
                  )}

                  {/* Manager review form */}
                  {task.latest_visit.status === 'completed' && task.latest_visit.review_status === null && canAssign && (
                    <div className="pt-3 border-t border-black/[0.05] dark:border-white/[0.07] space-y-3">
                      <p className="text-xs font-bold text-gray-700 dark:text-white/70">Tinjauan Kunjungan</p>
                      <div className="flex gap-1.5 items-center">
                        {[1,2,3,4,5].map((star) => (
                          <button key={star} onClick={() => setReviewRating(star)} className="text-2xl leading-none hover:scale-110 transition-transform" style={{ color: star <= reviewRating ? '#FF9500' : '#D1D5DB' }}>★</button>
                        ))}
                        <span className="text-xs text-gray-400 dark:text-white/30 ml-1.5">{reviewRating}/5</span>
                      </div>
                      <textarea
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        rows={3}
                        placeholder="Catatan tinjauan (opsional)..."
                        className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-white/25 focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => { if (window.confirm('Tandai perlu revisi?')) reviewMut.mutate({ visitId: task.latest_visit!.id, status: 'revision_needed' }); }}
                          disabled={reviewMut.isPending}
                          className="flex-1 py-2.5 text-xs font-semibold text-[#FF9500] bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.12)] border border-[#FED7AA] rounded-xl hover:bg-[#FFEDD5] transition disabled:opacity-50"
                        >
                          Perlu Revisi
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Setujui kunjungan ini?')) reviewMut.mutate({ visitId: task.latest_visit!.id, status: 'approved' }); }}
                          disabled={reviewMut.isPending}
                          className="flex-[1.4] py-2.5 text-xs font-semibold text-white bg-[#34C759] hover:bg-[#2DB34C] rounded-xl transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {reviewMut.isPending ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={12} />}
                          Setujui
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No visit yet */}
            {!task.latest_visit && ['assigned', 'in_progress'].includes(task.status) && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.08]">
                <Target size={13} className="text-gray-300 dark:text-white/20 flex-shrink-0" />
                <p className="text-xs text-gray-400 dark:text-white/30">Belum ada kunjungan untuk tugas ini</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
type PageTab = 'tasks' | 'visits' | 'ba';

export default function TasksPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageTab = (searchParams.get('tab') ?? 'tasks') as PageTab;
  const setPageTab = (t: PageTab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', t);
    router.push(`/dashboard/tasks?${p.toString()}`);
  };

  const [showForm,  setShowForm]  = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Task | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [assignTarget, setAssignTarget] = useState<Task | null>(null);
  const [assignMode, setAssignMode] = useState<'direct' | 'broadcast'>('direct');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDeptId, setAssignDeptId] = useState('');

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
    template_id: '',
  });

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks-web', filterStatus],
    queryFn: () => apiClient.get('/tasks', {
      params: { limit: 100, status: filterStatus === 'all' ? undefined : filterStatus },
    }).then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: clients = [] }   = useQuery<Client[]>({ queryKey: ['clients'],     queryFn: () => apiClient.get('/clients').then((r) => r.data.items ?? r.data) });
  const { data: users   = [] }   = useQuery<User[]>({   queryKey: ['users'],       queryFn: () => apiClient.get('/users').then((r) => r.data.items ?? r.data) });
  const { data: depts   = [] }   = useQuery<Department[]>({ queryKey: ['departments'], queryFn: () => apiClient.get('/departments').then((r) => r.data.items ?? r.data) });
  const { data: templates = [] } = useQuery<{ id: string; name: string; work_type: string }[]>({ queryKey: ['templates'], queryFn: () => apiClient.get('/templates').then((r) => r.data.items ?? r.data) });

  const { data: pendingDelegations = [] } = useQuery<Delegation[]>({
    queryKey: ['pending-delegations'],
    queryFn: () => apiClient.get('/tasks/delegations/pending').then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: onHoldTasks = [] } = useQuery<OnHoldTask[]>({
    queryKey: ['tasks-on-hold'],
    queryFn: () => apiClient.get('/tasks/on-hold').then((r) => {
      const d = r.data; return Array.isArray(d) ? d : (d?.items ?? []);
    }),
    refetchInterval: 15000,
    enabled: canAssign,
  });

  const approveHoldMut = useMutation({
    mutationFn: ({ taskId, holdId }: { taskId: string; holdId: string }) =>
      apiClient.post(`/tasks/${taskId}/holds/${holdId}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-on-hold'] });
      qc.invalidateQueries({ queryKey: ['tasks-web'] });
      toast.success('Penundaan disetujui — tugas dijadwal ulang');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyetujui penundaan')),
  });

  const rejectHoldMut = useMutation({
    mutationFn: ({ taskId, holdId }: { taskId: string; holdId: string }) =>
      apiClient.post(`/tasks/${taskId}/holds/${holdId}/reject`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks-on-hold'] });
      qc.invalidateQueries({ queryKey: ['tasks-web'] });
      toast.success('Penundaan ditolak — tugas kembali aktif');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menolak penundaan')),
  });

  const createMut = useMutation({
    mutationFn: () => apiClient.post('/tasks', {
      ...form,
      client_id:         form.client_id                                    || undefined,
      assigned_to:       form.dispatch_type === 'direct'    ? form.assigned_to       || undefined : undefined,
      broadcast_dept_id: form.dispatch_type === 'broadcast' ? form.broadcast_dept_id || undefined : undefined,
      scheduled_at:      form.scheduled_at || undefined,
      template_id:       form.template_id  || undefined,
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
    mutationFn: (body: { user_id?: string; dept_id?: string }) =>
      apiClient.post(`/tasks/${assignTarget!.id}/assign`, body),
    onSuccess: (_, body) => {
      qc.invalidateQueries({ queryKey: ['tasks-web'] });
      setAssignTarget(null);
      setAssignUserId('');
      setAssignDeptId('');
      toast.success(body.dept_id ? 'Tugas di-broadcast ke departemen' : 'Tugas berhasil ditugaskan');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menugaskan tugas')),
  });

  const onAssignHandler = canAssign
    ? (t: Task) => {
        setAssignTarget(t);
        setAssignMode('direct');
        setAssignUserId('');
        setAssignDeptId('');
      }
    : undefined;

  const tasks: Task[] = tasksData?.items ?? [];
  const total         = tasksData?.total ?? 0;

  // Stat counts
  const countByStatus = (statuses: TaskStatus[]) => tasks.filter((t) => statuses.includes(t.status)).length;
  const emergency     = tasks.filter((t) => t.is_emergency).length;
  const unassigned    = countByStatus(['unassigned']);
  const pending       = countByStatus(['pending_confirmation']);

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Tugas & Kunjungan</h1>
            <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">
              {pageTab === 'tasks' ? `${total} tugas aktif` : 'Monitor kunjungan & berita acara'}
            </p>
          </div>
          {pageTab === 'tasks' && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0066CC] active:scale-[0.97] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.35)]"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Buat Tugas</span>
              <span className="sm:hidden">Buat</span>
            </button>
          )}
        </div>

        {/* ── Page Tab Switcher ──────────────────────────────────────────────── */}
        <div className="flex gap-1 p-1 bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] w-fit mb-5 overflow-x-auto">
          {([
            { key: 'tasks' as const,  label: 'Tugas',        icon: ListTodo    },
            { key: 'visits' as const, label: 'Kunjungan',    icon: Navigation  },
            { key: 'ba' as const,     label: 'Berita Acara', icon: FileText    },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setPageTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                pageTab === key
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Summary cards ─────────────────────────────────────────────────── */}
        {pageTab === 'tasks' && (<>
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

        {/* ── Filter bar ────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 p-3 bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08]">
          <ListTodo size={15} className="text-gray-400 flex-shrink-0" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 bg-transparent text-sm text-gray-700 dark:text-white/80 outline-none cursor-pointer"
          >
            <option value="all">Semua Status</option>
            <option value="unassigned">Belum Ditugaskan</option>
            <option value="pending_confirmation">Menunggu Konfirmasi</option>
            <option value="assigned">Ditugaskan</option>
            <option value="in_progress">Dikerjakan</option>
            <option value="on_hold">Ditunda</option>
            <option value="rescheduled">Dijadwal Ulang</option>
            <option value="completed">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
        </>)}
      </div>

      {pageTab === 'tasks' && (<>
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
                      {d.reason && (
                        <p className="text-[11px] text-gray-400 dark:text-white/30 mt-1 italic line-clamp-2">"{d.reason}"</p>
                      )}
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

      {/* ── On Hold approvals banner ──────────────────────────────────────── */}
      {canAssign && onHoldTasks.filter((t) => t.pending_hold).length > 0 && (
        <div className="px-4 sm:px-6 mb-4">
          <div className="bg-[#FFF7ED] dark:bg-[rgba(255,149,0,0.12)] border border-[#FED7AA] dark:border-[rgba(255,149,0,0.30)] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-[8px] bg-[#FF9500]/20 flex items-center justify-center">
                <PauseCircle size={14} className="text-[#FF9500]" />
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {onHoldTasks.filter((t) => t.pending_hold).length} Permintaan Penundaan Tugas
              </p>
            </div>
            <div className="space-y-2">
              {onHoldTasks.filter((t) => t.pending_hold).map((t) => (
                <div key={t.id} className="bg-white/70 dark:bg-white/[0.05] rounded-xl border border-[#FED7AA] dark:border-white/[0.08] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1">{t.title}</p>
                      <p className="text-[11px] text-gray-500 dark:text-white/40 mt-0.5">
                        {t.assignee?.full_name ?? '—'}
                      </p>
                      {t.pending_hold?.reason_notes && (
                        <p className="text-[11px] text-gray-400 dark:text-white/30 mt-1 italic line-clamp-2">
                          &ldquo;{t.pending_hold.reason_notes}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => t.pending_hold && approveHoldMut.mutate({ taskId: t.id, holdId: t.pending_hold.id })}
                        disabled={approveHoldMut.isPending}
                        title="Setujui penundaan"
                        className="w-8 h-8 rounded-xl bg-[#F0FDF4] border border-[#BBF7D0] flex items-center justify-center text-[#34C759] hover:bg-[#DCFCE7] transition disabled:opacity-40"
                      >
                        <Check size={14} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => t.pending_hold && rejectHoldMut.mutate({ taskId: t.id, holdId: t.pending_hold.id })}
                        disabled={rejectHoldMut.isPending}
                        title="Tolak penundaan"
                        className="w-8 h-8 rounded-xl bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-center text-[#FF3B30] hover:bg-[#FEE2E2] transition disabled:opacity-40"
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
        ) : (
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
                        colTasks.map((t) => <KanbanCard key={t.id} task={t} onDetail={() => setDetailTaskId(t.id)} />)
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile list cards */}
            <div className="md:hidden space-y-3">
              {tasks.map((t) => <TaskListCard key={t.id} task={t} onAssign={onAssignHandler} onCancel={onCancelHandler} onDelete={onDeleteHandler} onDetail={() => setDetailTaskId(t.id)} />)}
            </div>
          </>
        )}
      </div>
      </>)}

      {/* ── Visits / Berita Acara Tab ──────────────────────────────────────────── */}
      {pageTab !== 'tasks' && (
        <VisitsTab
          key={pageTab}
          defaultSubTab={pageTab === 'ba' ? 'ba' : 'visits'}
          onOpenTask={(taskId) => setDetailTaskId(taskId)}
        />
      )}

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

              {/* Template BA */}
              {templates.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Template Berita Acara</label>
                  <select
                    value={form.template_id}
                    onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] transition"
                  >
                    <option value="">— Tanpa Template —</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name} ({t.work_type})</option>
                    ))}
                  </select>
                </div>
              )}

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
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Tugaskan</h2>
              </div>
              <button
                onClick={() => { setAssignTarget(null); setAssignUserId(''); setAssignDeptId(''); }}
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

              {/* Mode toggle */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">Mode Penugasan</label>
                <div className="flex gap-2">
                  {([
                    { val: 'direct',    label: 'Individu',  Icon: Target },
                    { val: 'broadcast', label: 'Departemen', Icon: Radio  },
                  ] as const).map(({ val, label, Icon }) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAssignMode(val)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                        assignMode === val
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

              {assignMode === 'direct' ? (
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
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-white/50 uppercase tracking-wider mb-1.5">
                    Pilih Departemen *
                  </label>
                  <select
                    value={assignDeptId}
                    onChange={(e) => setAssignDeptId(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.10] rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/20 transition"
                  >
                    <option value="">— Pilih departemen —</option>
                    {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.08)] border border-[#BFDBFE] dark:border-[rgba(0,122,255,0.25)]">
                <p className="text-[11px] text-[#007AFF] leading-relaxed">
                  {assignMode === 'direct'
                    ? 'Teknisi akan menerima notifikasi untuk mengkonfirmasi tugas ini.'
                    : 'Semua anggota aktif di departemen akan menerima notifikasi — siapa cepat dia dapat.'}
                </p>
              </div>
            </div>

            <div className="px-5 pb-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08] flex gap-3">
              <button
                onClick={() => { setAssignTarget(null); setAssignUserId(''); setAssignDeptId(''); }}
                className="flex-1 py-3 border border-black/[0.08] dark:border-white/[0.10] rounded-xl text-sm font-semibold text-gray-600 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
              >
                Batal
              </button>
              <button
                onClick={() => assignMut.mutate(
                  assignMode === 'direct' ? { user_id: assignUserId } : { dept_id: assignDeptId }
                )}
                disabled={
                  assignMut.isPending ||
                  (assignMode === 'direct' ? !assignUserId : !assignDeptId)
                }
                className="flex-1 py-3 bg-[#007AFF] hover:bg-[#0066CC] text-white rounded-xl text-sm font-semibold transition-all shadow-[0_2px_8px_rgba(0,122,255,0.30)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {assignMut.isPending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>{assignMode === 'direct' ? <UserPlus size={14} /> : <Radio size={14} />} Tugaskan</>
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

      {/* ── Task Detail Drawer ─────────────────────────────────────────────── */}
      {detailTaskId && (
        <TaskDetailDrawer
          taskId={detailTaskId}
          canAssign={canAssign}
          onClose={() => setDetailTaskId(null)}
          onInvalidate={() => qc.invalidateQueries({ queryKey: ['tasks-web'] })}
        />
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
