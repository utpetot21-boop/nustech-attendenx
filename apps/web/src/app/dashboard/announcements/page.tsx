'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { getAuthUser } from '@/lib/auth';
import {
  Megaphone, Plus, X, CheckCircle2, FileEdit, Pin,
  Send, Trash2, Info, AlertTriangle, Sun,
  BookOpen, Search, Bell, MessageCircle, Clock, ThumbsUp, ThumbsDown,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Announcement = {
  id: string;
  title: string;
  body: string;
  type: 'info' | 'urgent' | 'holiday' | 'policy';
  target_type: 'all' | 'department' | 'individual';
  target_dept_id: string | null;
  is_pinned: boolean;
  pinned_until: string | null;
  send_push: boolean;
  send_whatsapp: boolean;
  attachment_url: string | null;
  status: 'draft' | 'pending_approval' | 'rejected' | 'sent';
  sent_at: string | null;
  created_at: string;
  rejection_reason: string | null;
  creator: { full_name: string };
  approver?: { full_name: string } | null;
};

type ReadStats = { read: number; total: number; read_pct: number };

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_MAP: Record<
  string,
  { label: string; Icon: React.ComponentType<{ size?: number | string; className?: string }>; bg: string; text: string; ring: string; cardBorder: string }
> = {
  info:    { label: 'Info',      Icon: Info,          bg: 'bg-[#007AFF]/10',  text: 'text-[#007AFF]',  ring: 'ring-[#007AFF]/20',  cardBorder: 'border-l-[#007AFF]' },
  urgent:  { label: 'Urgent',    Icon: AlertTriangle, bg: 'bg-[#FF3B30]/10',  text: 'text-[#FF3B30]',  ring: 'ring-[#FF3B30]/20',  cardBorder: 'border-l-[#FF3B30]' },
  holiday: { label: 'Libur',     Icon: Sun,           bg: 'bg-[#34C759]/10',  text: 'text-[#34C759]',  ring: 'ring-[#34C759]/20',  cardBorder: 'border-l-[#34C759]' },
  policy:  { label: 'Kebijakan', Icon: BookOpen,      bg: 'bg-[#AF52DE]/10',  text: 'text-[#AF52DE]',  ring: 'ring-[#AF52DE]/20',  cardBorder: 'border-l-[#AF52DE]' },
};

const inputCls =
  'w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2E] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' });
}

type TabKey = 'all' | 'sent' | 'draft' | 'pending_approval' | 'rejected';
const TABS_ADMIN: { key: TabKey; label: string }[] = [
  { key: 'all',              label: 'Semua' },
  { key: 'draft',            label: 'Draft' },
  { key: 'pending_approval', label: 'Menunggu' },
  { key: 'rejected',         label: 'Ditolak' },
  { key: 'sent',             label: 'Terkirim' },
];
const TABS_MANAGER: { key: TabKey; label: string }[] = [
  { key: 'all',              label: 'Semua' },
  { key: 'pending_approval', label: 'Perlu Disetujui' },
  { key: 'sent',             label: 'Terkirim' },
  { key: 'draft',            label: 'Draft' },
];

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

// ── TypeBadge ─────────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const m = TYPE_MAP[type] ?? TYPE_MAP.info;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${m.bg} ${m.text} ${m.ring}`}>
      <m.Icon size={10} />
      {m.label}
    </span>
  );
}

// ── AnnouncementCard ──────────────────────────────────────────────────────────
function AnnouncementCard({
  ann, onClick,
}: {
  ann: Announcement;
  onClick: () => void;
}) {
  const m = TYPE_MAP[ann.type] ?? TYPE_MAP.info;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] border-l-4 ${m.cardBorder} p-4 hover:shadow-sm transition`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={ann.type} />
          {ann.is_pinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/10 text-[#FF9500] ring-1 ring-[#FF9500]/20">
              <Pin size={10} /> Pin
            </span>
          )}
          {ann.status === 'draft' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700">
              <FileEdit size={10} /> Draft
            </span>
          )}
          {ann.status === 'pending_approval' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/10 text-[#FF9500] ring-1 ring-[#FF9500]/20">
              <Clock size={10} /> Menunggu
            </span>
          )}
          {ann.status === 'rejected' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF3B30]/10 text-[#FF3B30] ring-1 ring-[#FF3B30]/20">
              <X size={10} /> Ditolak
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-400 flex-shrink-0">
          {fmtDate(ann.sent_at ?? ann.created_at)}
        </span>
      </div>
      <p className="font-semibold text-gray-900 dark:text-white text-sm mb-1 line-clamp-1">{ann.title}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{ann.body}</p>
      <p className="text-[11px] text-gray-400 mt-2">{ann.creator?.full_name ?? '—'}</p>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AnnouncementsPage() {
  const qc = useQueryClient();
  const authUser = getAuthUser();
  const roleName = authUser?.role?.name ?? '';
  const canApprove = authUser?.role?.permissions?.includes('announcement:approve') ?? false;
  const isAdmin = roleName === 'admin';
  const TABS = canApprove ? TABS_MANAGER : TABS_ADMIN;

  const [tab, setTab] = useState<TabKey>(canApprove ? 'pending_approval' : 'all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteAnnId, setDeleteAnnId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'info' as Announcement['type'],
    target_type: 'all' as Announcement['target_type'],
    target_dept_id: '',
    target_user_ids: [] as string[],
    is_pinned: false,
    pinned_until: '',
    send_push: true,
    send_whatsapp: false,
  });

  const resetForm = () => setForm({
    title: '', body: '', type: 'info', target_type: 'all',
    target_dept_id: '', target_user_ids: [],
    is_pinned: false, pinned_until: '', send_push: true, send_whatsapp: false,
  });

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ['announcements'],
    queryFn: () => apiClient.get('/announcements').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const { data: readStats } = useQuery<ReadStats>({
    queryKey: ['ann-reads', selected?.id],
    queryFn: () => apiClient.get(`/announcements/${selected!.id}/reads`).then((r) => r.data),
    enabled: !!selected && selected.status === 'sent',
  });

  const createMut = useMutation({
    mutationFn: (mode: 'draft' | 'send' | 'submit') => {
      const payload: Record<string, unknown> = { ...form };
      if (!payload.pinned_until) delete payload.pinned_until;
      if (payload.target_type !== 'department') delete payload.target_dept_id;
      if (payload.target_type !== 'individual') delete payload.target_user_ids;
      if (payload.target_type === 'individual' && (payload.target_user_ids as string[]).length === 0) delete payload.target_user_ids;
      return apiClient.post('/announcements', payload).then(async (r) => {
        if (mode === 'send') await apiClient.post(`/announcements/${r.data.id}/send`);
        if (mode === 'submit') await apiClient.post(`/announcements/${r.data.id}/submit`);
        return r.data;
      });
    },
    onSuccess: (_, mode) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setShowCreate(false);
      resetForm();
      const msg = mode === 'send' ? 'Pengumuman dikirim' : mode === 'submit' ? 'Pengumuman diajukan untuk review' : 'Draft disimpan';
      toast.success(msg);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyimpan pengumuman')),
  });

  const submitMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/announcements/${id}/submit`).then((r) => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setSelected((prev) => prev ? { ...prev, status: data.status } : null);
      setShowCreate(false);
      resetForm();
      toast.success('Pengumuman diajukan untuk review');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal mengajukan pengumuman')),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/announcements/${id}/send`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setSelected((prev) => prev ? { ...prev, status: 'sent' } : null);
      toast.success('Pengumuman berhasil dikirim');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal mengirim pengumuman')),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/announcements/${id}/approve`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setSelected(null);
      toast.success('Pengumuman disetujui');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menyetujui pengumuman')),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/announcements/${id}/reject`, { reason }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setSelected(null);
      setShowRejectInput(false);
      setRejectReason('');
      toast.success('Pengumuman ditolak');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menolak pengumuman')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/announcements/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setSelected(null);
      setDeleteAnnId(null);
      toast.success('Pengumuman dihapus');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal menghapus pengumuman')),
  });

  const filtered = announcements
    .filter((a) => tab === 'all' || a.status === tab)
    .filter((a) => !search || a.title.toLowerCase().includes(search.toLowerCase()));

  const pinned = filtered.filter((a) => a.is_pinned && a.status === 'sent');
  const rest = filtered.filter((a) => !(a.is_pinned && a.status === 'sent'));
  const ordered = [...pinned, ...rest];

  const totalSent    = announcements.filter((a) => a.status === 'sent').length;
  const totalPending = announcements.filter((a) => a.status === 'pending_approval').length;
  const totalPin     = announcements.filter((a) => a.is_pinned).length;

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">
      {/* Page Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Pengumuman</h1>
          <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">
            Kelola dan kirim pengumuman ke karyawan
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0071e3] text-white rounded-xl text-sm font-semibold transition flex-shrink-0"
        >
          <Plus size={16} />
          Buat Pengumuman
        </button>
      </div>

      {/* StatCards */}
      <div className="px-4 sm:px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Megaphone}    label="Total"        value={announcements.length} color="bg-[#007AFF]" />
        <StatCard icon={CheckCircle2} label="Terkirim"     value={totalSent}            color="bg-[#34C759]" />
        <StatCard icon={Clock}        label="Menunggu"     value={totalPending}         color="bg-[#FF9500]" />
        <StatCard icon={Pin}          label="Dipinkan"     value={totalPin}             color="bg-[#AF52DE]" />
      </div>

      {/* Tabs + Filter Bar */}
      <div className="px-4 sm:px-6 pb-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const active = tab === t.key;
            const badge = t.key === 'pending_approval' ? totalPending : 0;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition flex-shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-white dark:bg-[#1C1C1E] text-gray-600 dark:text-gray-400 border border-black/[0.08] dark:border-white/[0.1]'
                }`}
              >
                {t.label}
                {badge > 0 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-[#FF3B30] text-white'}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08]">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari judul pengumuman…"
            className="flex-1 text-sm bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : ordered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center">
            <Megaphone size={28} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tidak ada pengumuman</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {search ? 'Coba kata kunci lain' : 'Belum ada pengumuman yang dibuat'}
          </p>
        </div>
      ) : (
        <div className="px-4 sm:px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ordered.map((a) => (
            <AnnouncementCard key={a.id} ann={a} onClick={() => setSelected(a)} />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <DetailModal
          ann={selected}
          readStats={readStats}
          canApprove={canApprove}
          isAdmin={isAdmin}
          sendPending={sendMut.isPending}
          approvePending={approveMut.isPending}
          rejectPending={rejectMut.isPending}
          submitPending={submitMut.isPending}
          deletePending={deleteMut.isPending}
          deleteAnnId={deleteAnnId}
          showRejectInput={showRejectInput}
          rejectReason={rejectReason}
          onRejectReasonChange={setRejectReason}
          onClose={() => { setSelected(null); setShowRejectInput(false); setRejectReason(''); }}
          onSend={() => sendMut.mutate(selected.id)}
          onSubmit={() => submitMut.mutate(selected.id)}
          onApprove={() => approveMut.mutate(selected.id)}
          onRejectRequest={() => setShowRejectInput(true)}
          onRejectCancel={() => { setShowRejectInput(false); setRejectReason(''); }}
          onRejectConfirm={() => rejectMut.mutate({ id: selected.id, reason: rejectReason })}
          onDeleteRequest={() => setDeleteAnnId(selected.id)}
          onDeleteCancel={() => setDeleteAnnId(null)}
          onDeleteConfirm={() => deleteMut.mutate(selected.id)}
        />
      )}

      {/* Create Modal */}
      {showCreate && (
        <CreateModal
          form={form}
          setForm={setForm}
          isAdmin={isAdmin}
          pending={createMut.isPending}
          onClose={() => { setShowCreate(false); resetForm(); }}
          onSend={() => createMut.mutate(isAdmin ? 'submit' : 'send')}
          onDraft={() => createMut.mutate('draft')}
        />
      )}
    </div>
  );
}

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({
  ann, readStats, canApprove, isAdmin,
  sendPending, approvePending, rejectPending, submitPending, deletePending,
  deleteAnnId, showRejectInput, rejectReason,
  onRejectReasonChange, onClose, onSend, onSubmit, onApprove,
  onRejectRequest, onRejectCancel, onRejectConfirm,
  onDeleteRequest, onDeleteCancel, onDeleteConfirm,
}: {
  ann: Announcement;
  readStats?: ReadStats;
  canApprove: boolean;
  isAdmin: boolean;
  sendPending: boolean;
  approvePending: boolean;
  rejectPending: boolean;
  submitPending: boolean;
  deletePending: boolean;
  deleteAnnId: string | null;
  showRejectInput: boolean;
  rejectReason: string;
  onRejectReasonChange: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
  onSubmit: () => void;
  onApprove: () => void;
  onRejectRequest: () => void;
  onRejectCancel: () => void;
  onRejectConfirm: () => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
}) {
  const m = TYPE_MAP[ann.type] ?? TYPE_MAP.info;
  const confirmingDelete = deleteAnnId === ann.id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] border-l-4 rounded-t-3xl sm:rounded-t-3xl ${m.cardBorder}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <TypeBadge type={ann.type} />
                {ann.is_pinned && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FF9500]/10 text-[#FF9500] ring-1 ring-[#FF9500]/20">
                    <Pin size={10} /> Pin
                  </span>
                )}
                {ann.status === 'sent' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 bg-[#34C759]/10 text-[#34C759] ring-[#34C759]/20">
                    <CheckCircle2 size={10} /> Terkirim
                  </span>
                )}
                {ann.status === 'draft' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 dark:text-gray-400 ring-gray-200 dark:ring-gray-700">
                    <FileEdit size={10} /> Draft
                  </span>
                )}
                {ann.status === 'pending_approval' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 bg-[#FF9500]/10 text-[#FF9500] ring-[#FF9500]/20">
                    <Clock size={10} /> Menunggu Persetujuan
                  </span>
                )}
                {ann.status === 'rejected' && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 bg-[#FF3B30]/10 text-[#FF3B30] ring-[#FF3B30]/20">
                    <X size={10} /> Ditolak
                  </span>
                )}
              </div>
              <p className="font-bold text-gray-900 dark:text-white">{ann.title}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center flex-shrink-0"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Content */}
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">{ann.body}</p>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-0.5">Dibuat oleh</p>
              <p className="font-semibold text-gray-900 dark:text-white">{ann.creator?.full_name ?? '—'}</p>
            </div>
            <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3">
              <p className="text-[10px] text-gray-400 mb-0.5">{ann.status === 'sent' ? 'Dikirim' : 'Dibuat'}</p>
              <p className="font-semibold text-gray-900 dark:text-white">
                {fmtDate(ann.sent_at ?? ann.created_at)}
              </p>
            </div>
          </div>

          {/* Rejection reason */}
          {ann.status === 'rejected' && ann.rejection_reason && (
            <div className="bg-[#FF3B30]/10 rounded-xl p-3 border border-[#FF3B30]/20">
              <p className="text-[10px] text-[#FF3B30] font-semibold uppercase tracking-wider mb-1">Alasan Penolakan</p>
              <p className="text-xs text-[#FF3B30]/80">{ann.rejection_reason}</p>
            </div>
          )}

          {/* Channel badges */}
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold ${ann.send_push ? 'bg-[#007AFF]/10 text-[#007AFF]' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-400 line-through'}`}>
              <Bell size={12} /> Push
            </span>
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-semibold ${ann.send_whatsapp ? 'bg-[#34C759]/10 text-[#34C759]' : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-400 line-through'}`}>
              <MessageCircle size={12} /> WhatsApp
            </span>
          </div>

          {/* Read stats */}
          {ann.status === 'sent' && readStats && (
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Statistik Baca
              </p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-[#34C759]/10 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-[#34C759]">{readStats.read}</p>
                  <p className="text-[10px] text-[#34C759]/70 mt-0.5">Sudah Baca</p>
                </div>
                <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-600 dark:text-gray-300">
                    {readStats.total - readStats.read}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Belum Baca</p>
                </div>
              </div>
              {readStats.total > 0 && (
                <>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                      <span>{readStats.read_pct}% sudah baca</span>
                      <span>{readStats.read}/{readStats.total}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-[#2C2C2E] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#34C759] rounded-full transition-all"
                        style={{ width: `${readStats.read_pct}%` }}
                      />
                    </div>
                  </div>
                  {readStats.read < readStats.total && (
                    <button className="w-full py-2 rounded-xl bg-[#007AFF]/10 text-[#007AFF] text-xs font-semibold flex items-center justify-center gap-2">
                      <Bell size={13} />
                      Kirim Reminder ke {readStats.total - readStats.read} orang
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Inline delete confirm */}
          {confirmingDelete && (
            <div className="bg-[#FF3B30]/10 rounded-2xl p-4 border border-[#FF3B30]/20">
              <p className="text-sm font-semibold text-[#FF3B30] mb-1">Hapus pengumuman ini?</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Tindakan ini tidak dapat dibatalkan.</p>
              <div className="flex gap-2">
                <button
                  onClick={onDeleteConfirm}
                  disabled={deletePending}
                  className="flex-1 py-2 rounded-xl bg-[#FF3B30] text-white text-xs font-semibold disabled:opacity-50"
                >
                  {deletePending ? 'Menghapus…' : 'Ya, Hapus'}
                </button>
                <button
                  onClick={onDeleteCancel}
                  className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-xs font-semibold"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!confirmingDelete && (
          <div className="px-5 py-4 border-t border-black/[0.06] dark:border-white/[0.08]">
            {/* Reject input */}
            {showRejectInput ? (
              <div className="space-y-2">
                <input
                  value={rejectReason}
                  onChange={(e) => onRejectReasonChange(e.target.value)}
                  placeholder="Tulis alasan penolakan…"
                  className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2E] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF3B30]/30"
                />
                <div className="flex gap-2">
                  <button
                    onClick={onRejectConfirm}
                    disabled={!rejectReason.trim() || rejectPending}
                    className="flex-1 py-2.5 rounded-xl bg-[#FF3B30] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {rejectPending ? 'Menolak…' : 'Konfirmasi Tolak'}
                  </button>
                  <button
                    onClick={onRejectCancel}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-sm font-semibold"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {/* Manager: approve + reject for pending */}
                {canApprove && ann.status === 'pending_approval' && (
                  <>
                    <button
                      onClick={onApprove}
                      disabled={approvePending}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#34C759] hover:bg-[#2fb350] text-white text-sm font-semibold disabled:opacity-50 transition"
                    >
                      <ThumbsUp size={14} />
                      {approvePending ? 'Menyetujui…' : 'Setujui & Kirim'}
                    </button>
                    <button
                      onClick={onRejectRequest}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-sm font-semibold"
                    >
                      <ThumbsDown size={14} />
                      Tolak
                    </button>
                  </>
                )}
                {/* Manager: direct send for draft */}
                {canApprove && ann.status === 'draft' && (
                  <button
                    onClick={onSend}
                    disabled={sendPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0071e3] text-white text-sm font-semibold disabled:opacity-50 transition"
                  >
                    <Send size={14} />
                    {sendPending ? 'Mengirim…' : 'Kirim Sekarang'}
                  </button>
                )}
                {/* Admin: submit for approval (draft or rejected) */}
                {isAdmin && (ann.status === 'draft' || ann.status === 'rejected') && (
                  <button
                    onClick={onSubmit}
                    disabled={submitPending}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0071e3] text-white text-sm font-semibold disabled:opacity-50 transition"
                  >
                    <Send size={14} />
                    {submitPending ? 'Mengajukan…' : (ann.status === 'rejected' ? 'Ajukan Ulang' : 'Ajukan ke Manager')}
                  </button>
                )}
                <button
                  onClick={onDeleteRequest}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#FF3B30]/10 text-[#FF3B30] text-sm font-semibold"
                >
                  <Trash2 size={14} />
                  Hapus
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

type CreateFormState = {
  title: string; body: string; type: Announcement['type'];
  target_type: Announcement['target_type'];
  target_dept_id: string; target_user_ids: string[];
  is_pinned: boolean; pinned_until: string;
  send_push: boolean; send_whatsapp: boolean;
};

// ── Create Modal ──────────────────────────────────────────────────────────────
function CreateModal({
  form, setForm, isAdmin, pending, onClose, onSend, onDraft,
}: {
  form: CreateFormState;
  setForm: React.Dispatch<React.SetStateAction<CreateFormState>>;
  isAdmin: boolean;
  pending: boolean;
  onClose: () => void;
  onSend: () => void;
  onDraft: () => void;
}) {
  const set = <K extends keyof CreateFormState>(k: K, v: CreateFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [userSearch, setUserSearch] = useState('');

  const { data: departments = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: users = [] } = useQuery<{ id: string; full_name: string; department?: { name: string } }[]>({
    queryKey: ['users-colleagues'],
    queryFn: () => apiClient.get('/users/colleagues').then((r) => r.data?.items ?? r.data ?? []),
    staleTime: 5 * 60_000,
    enabled: form.target_type === 'individual',
  });

  const filteredUsers = useMemo(() =>
    users.filter((u) =>
      !userSearch || u.full_name.toLowerCase().includes(userSearch.toLowerCase())
    ), [users, userSearch]);

  const toggleUser = (id: string) => {
    set('target_user_ids', form.target_user_ids.includes(id)
      ? form.target_user_ids.filter((x) => x !== id)
      : [...form.target_user_ids, id]
    );
  };

  const selectedUsers = users.filter((u) => form.target_user_ids.includes(u.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Buat Pengumuman</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Judul */}
          <div>
            <label className={labelCls}>Judul *</label>
            <input
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className={inputCls}
              placeholder="Judul pengumuman…"
            />
          </div>

          {/* Isi */}
          <div>
            <label className={labelCls}>Isi Pengumuman *</label>
            <textarea
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              className={`${inputCls} resize-none h-28`}
              placeholder="Tulis isi pengumuman di sini…"
            />
          </div>

          {/* Tipe */}
          <div>
            <label className={labelCls}>Tipe</label>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(TYPE_MAP).map(([key, m]) => {
                const active = form.type === key;
                return (
                  <button
                    key={key}
                    onClick={() => set('type', key as Announcement['type'])}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ring-1 transition ${
                      active ? `${m.bg} ${m.text} ${m.ring}` : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-gray-400 ring-gray-200 dark:ring-gray-700'
                    }`}
                  >
                    <m.Icon size={12} />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Kirim ke */}
          <div>
            <label className={labelCls}>Kirim ke</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { key: 'all', label: 'Semua karyawan' },
                { key: 'department', label: 'Departemen' },
                { key: 'individual', label: 'Individu' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    set('target_type', t.key as Announcement['target_type']);
                    setForm((f) => ({ ...f, target_type: t.key as Announcement['target_type'], target_dept_id: '', target_user_ids: [] }));
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold ring-1 transition ${
                    form.target_type === t.key
                      ? 'bg-[#007AFF]/10 text-[#007AFF] ring-[#007AFF]/20'
                      : 'bg-white dark:bg-[#2C2C2E] text-gray-500 dark:text-gray-400 ring-gray-200 dark:ring-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Department picker */}
          {form.target_type === 'department' && (
            <div>
              <label className={labelCls}>Pilih Departemen *</label>
              <select
                value={form.target_dept_id}
                onChange={(e) => set('target_dept_id', e.target.value)}
                className={inputCls}
              >
                <option value="">— Pilih departemen —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Individual multi-picker */}
          {form.target_type === 'individual' && (
            <div>
              <label className={labelCls}>
                Pilih Karyawan *
                {form.target_user_ids.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#007AFF]/10 text-[#007AFF]">
                    {form.target_user_ids.length} dipilih
                  </span>
                )}
              </label>

              {/* Selected tags */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedUsers.map((u) => (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#007AFF]/10 text-[#007AFF] text-xs font-semibold"
                    >
                      {u.full_name}
                      <button
                        onClick={() => toggleUser(u.id)}
                        className="hover:text-[#FF3B30] transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Search box */}
              <div className="relative mb-1.5">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Cari nama karyawan…"
                  className={`${inputCls} pl-9`}
                />
              </div>

              {/* Scrollable list */}
              <div className="max-h-44 overflow-y-auto rounded-xl border border-black/[0.08] dark:border-white/[0.1] divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Tidak ditemukan</p>
                ) : (
                  filteredUsers.map((u) => {
                    const checked = form.target_user_ids.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleUser(u.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${
                          checked ? 'bg-[#007AFF]/08' : 'bg-white dark:bg-[#2C2C2E] hover:bg-gray-50 dark:hover:bg-[#3A3A3C]'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition ${
                          checked ? 'bg-[#007AFF] border-[#007AFF]' : 'border-gray-300 dark:border-gray-600'
                        }`}>
                          {checked && <CheckCircle2 size={10} className="text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{u.full_name}</p>
                          {u.department?.name && (
                            <p className="text-[11px] text-gray-400 truncate">{u.department.name}</p>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Opsi */}
          <div>
            <label className={labelCls}>Opsi</label>
            <div className="space-y-3">
              {[
                { key: 'send_push',     label: 'Push notification', Icon: Bell,           checked: form.send_push,     onChange: (v: boolean) => set('send_push', v) },
                { key: 'send_whatsapp', label: 'WhatsApp',          Icon: MessageCircle,  checked: form.send_whatsapp, onChange: (v: boolean) => set('send_whatsapp', v) },
                { key: 'is_pinned',     label: 'Pin pengumuman',    Icon: Pin,            checked: form.is_pinned,     onChange: (v: boolean) => set('is_pinned', v) },
              ].map(({ key, label, Icon, checked, onChange }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => onChange(!checked)}
                    className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-[#007AFF]' : 'bg-gray-200 dark:bg-gray-700'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow mt-0.5 transition-transform ${checked ? 'translate-x-4.5 ml-0.5' : 'ml-0.5'}`} />
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Icon size={14} className="text-gray-400" />
                    {label}
                  </div>
                </label>
              ))}

              {form.is_pinned && (
                <div className="ml-12">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pin sampai tanggal</label>
                  <input
                    type="date"
                    value={form.pinned_until}
                    onChange={(e) => set('pinned_until', e.target.value)}
                    className={`${inputCls} w-48`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Preview */}
          {(form.title || form.body) && (
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Preview Tampilan Mobile
              </p>
              <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-2xl p-3">
                {/* Push notification preview */}
                {form.send_push && (
                  <div className="bg-white dark:bg-[#3A3A3C] rounded-xl p-3 mb-2 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${TYPE_MAP[form.type]?.bg ?? 'bg-[#007AFF]/10'}`}>
                        {(() => { const Icon = TYPE_MAP[form.type]?.Icon ?? Info; return <Icon size={16} className={TYPE_MAP[form.type]?.text ?? 'text-[#007AFF]'} />; })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">AttendenX</p>
                          <p className="text-[10px] text-gray-400">sekarang</p>
                        </div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1">
                          {form.title || 'Judul pengumuman…'}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                          {form.body || 'Isi pengumuman…'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {/* Card preview */}
                <div className={`bg-white dark:bg-[#1C1C1E] rounded-xl border-l-4 ${TYPE_MAP[form.type]?.cardBorder ?? 'border-l-[#007AFF]'} p-3`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <TypeBadge type={form.type} />
                    <span className="text-[10px] text-gray-400">hari ini</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white line-clamp-1 mb-0.5">
                    {form.title || 'Judul pengumuman…'}
                  </p>
                  <p className="text-[11px] text-gray-400 line-clamp-2">
                    {form.body || 'Isi pengumuman akan tampil di sini…'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            onClick={onSend}
            disabled={
              pending || !form.title.trim() || !form.body.trim() ||
              (form.target_type === 'department' && !form.target_dept_id) ||
              (form.target_type === 'individual' && form.target_user_ids.length === 0)
            }
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0071e3] disabled:opacity-50 text-white text-sm font-semibold transition"
          >
            <Send size={14} />
            {pending
              ? (isAdmin ? 'Mengajukan…' : 'Mengirim…')
              : (isAdmin ? 'Ajukan ke Manager' : 'Kirim Sekarang')}
          </button>
          <button
            onClick={onDraft}
            disabled={pending || !form.title.trim() || !form.body.trim()}
            className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-sm font-semibold disabled:opacity-50"
          >
            Simpan Draft
          </button>
        </div>
      </div>
    </div>
  );
}
