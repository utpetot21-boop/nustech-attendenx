'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin, Clock, Camera, Navigation, NavigationOff, FileText,
  Activity, CheckCircle2, Pause, RefreshCw, XCircle, X,
  Calendar, ChevronRight, Building2,
  ExternalLink, Image as ImageIcon, Star, ThumbsUp, AlertCircle, Send,
} from 'lucide-react';
import { apiClient } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────
type Visit = {
  id: string;
  task_id: string | null;
  status: string;
  check_in_at: string | null;
  check_out_at: string | null;
  duration_minutes: number | null;
  gps_valid: boolean;
  gps_deviation_meter: number | null;
  work_description: string | null;
  findings: string | null;
  recommendations: string | null;
  materials_used: Record<string, unknown>[] | null;
  user: { id: string; full_name: string };
  client: { id: string; name: string };
  photos: { id: string; phase: string; watermarked_url: string | null; original_url: string }[];
  service_report: { id: string; report_number: string; status?: string; pdf_url: string | null } | null;
  review_status: string | null;
  review_rating: number | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer: { id: string; full_name: string } | null;
};

type ServiceReport = {
  id: string;
  report_number: string;
  visit_id: string;
  client_pic_name: string | null;
  is_locked: boolean;
  sent_to_client: boolean;
  pdf_url: string | null;
  created_at: string;
  visit: { user: { full_name: string }; client: { name: string } };
};

type Tab = 'visits' | 'ba' | 'onhold';

// ── Status config ──────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, {
  label: string; Icon: React.ElementType;
  bg: string; text: string; dot: string;
  ring: string; lightBg: string;
}> = {
  ongoing:     { label: 'Berjalan',       Icon: Activity,      bg: 'bg-[#EFF6FF]', lightBg: 'bg-[#EFF6FF]', text: 'text-[#1D4ED8]', dot: 'bg-[#3B82F6]', ring: 'border-[#3B82F6]/30' },
  completed:   { label: 'Selesai',        Icon: CheckCircle2,  bg: 'bg-[#F0FDF4]', lightBg: 'bg-[#F0FDF4]', text: 'text-[#166534]', dot: 'bg-[#34C759]', ring: 'border-[#34C759]/30' },
  on_hold:     { label: 'Ditunda',        Icon: Pause,         bg: 'bg-[#FFF7ED]', lightBg: 'bg-[#FFF7ED]', text: 'text-[#9A3412]', dot: 'bg-[#FF9500]', ring: 'border-[#FF9500]/30' },
  rescheduled: { label: 'Dijadwal Ulang', Icon: RefreshCw,     bg: 'bg-[#FAF5FF]', lightBg: 'bg-[#FAF5FF]', text: 'text-[#6B21A8]', dot: 'bg-[#AF52DE]', ring: 'border-[#AF52DE]/30' },
  cancelled:   { label: 'Dibatalkan',     Icon: XCircle,       bg: 'bg-[#FFF1F2]', lightBg: 'bg-[#FFF1F2]', text: 'text-[#9F1239]', dot: 'bg-[#FF3B30]', ring: 'border-[#FF3B30]/30' },
};

function durFmt(minutes: number | null): string {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? STATUS_MAP.ongoing;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${s.lightBg} ${s.text} ${s.ring}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const REVIEW_STATUS_MAP: Record<string, { label: string; color: string; bg: string; Icon: React.ElementType }> = {
  approved:        { label: 'Disetujui',    color: 'text-[#166534]', bg: 'bg-[#F0FDF4] border-[#34C759]/30', Icon: ThumbsUp },
  revision_needed: { label: 'Perlu Revisi', color: 'text-[#9A3412]', bg: 'bg-[#FFF7ED] border-[#FF9500]/30', Icon: AlertCircle },
};

function ReviewBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const r = REVIEW_STATUS_MAP[status];
  if (!r) return null;
  const { Icon } = r;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${r.bg} ${r.color}`}>
      <Icon size={10} strokeWidth={2.5} /> {r.label}
    </span>
  );
}

function StarRating({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" onClick={() => onChange?.(s)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          disabled={!onChange}
        >
          <Star
            size={20}
            strokeWidth={1.5}
            className={s <= rating ? 'text-[#FF9500] fill-[#FF9500]' : 'text-gray-300 dark:text-white/20'}
          />
        </button>
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: React.ElementType; label: string; value: string | number;
  sub?: string; color: string; bg: string;
}) {
  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${bg}`}>
          <Icon size={18} strokeWidth={1.8} className={color} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 dark:text-white/30 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Visit card (mobile) ────────────────────────────────────────────────────────
function VisitCard({ v, onClick }: { v: Visit; onClick: () => void }) {
  const photoCount = v.photos?.length ?? 0;
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08] hover:shadow-sm transition-shadow"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-xs font-bold flex-shrink-0">
          {initials(v.user?.full_name ?? 'U')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{v.user?.full_name ?? '—'}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Building2 size={11} className="text-gray-400 flex-shrink-0" />
            <p className="text-xs text-gray-500 dark:text-white/50 truncate">{v.client?.name ?? '—'}</p>
          </div>
        </div>
        <StatusBadge status={v.status} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5 text-center">
          <Clock size={12} className="text-gray-400 mx-auto mb-1" />
          <p className="text-xs font-semibold text-gray-700 dark:text-white/80">
            {v.check_in_at ? new Date(v.check_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' }) : '—'}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-white/30">Check-in</p>
        </div>
        <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5 text-center">
          <Clock size={12} className="text-gray-400 mx-auto mb-1" />
          <p className="text-xs font-semibold text-gray-700 dark:text-white/80">{durFmt(v.duration_minutes)}</p>
          <p className="text-[10px] text-gray-400 dark:text-white/30">Durasi</p>
        </div>
        <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-2.5 text-center">
          <Camera size={12} className={photoCount >= 16 ? 'text-[#34C759] mx-auto mb-1' : 'text-[#FF9500] mx-auto mb-1'} />
          <p className={`text-xs font-semibold ${photoCount >= 16 ? 'text-[#166534]' : 'text-[#9A3412]'}`}>{photoCount}/16</p>
          <p className="text-[10px] text-gray-400 dark:text-white/30">Foto</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
        <div className="flex items-center gap-1.5 flex-wrap">
          {v.gps_valid
            ? <span className="flex items-center gap-1 text-[11px] text-[#166534] bg-[#F0FDF4] px-2 py-0.5 rounded-full"><Navigation size={10} /> GPS Valid</span>
            : <span className="flex items-center gap-1 text-[11px] text-[#9A3412] bg-[#FFF7ED] px-2 py-0.5 rounded-full"><NavigationOff size={10} /> GPS Alert</span>
          }
          {v.service_report && (
            <span className="flex items-center gap-1 text-[11px] text-[#1D4ED8] bg-[#EFF6FF] px-2 py-0.5 rounded-full">
              <FileText size={10} /> BA
            </span>
          )}
          {v.status === 'completed' && !v.review_status && (
            <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">Belum Direview</span>
          )}
          <ReviewBadge status={v.review_status} />
        </div>
        <ChevronRight size={14} className="text-gray-300 dark:text-white/20" />
      </div>
    </button>
  );
}

// ── BA card (mobile) ───────────────────────────────────────────────────────────
function BaCard({ ba }: { ba: ServiceReport }) {
  const [confirmSend, setConfirmSend] = useState(false);
  const qc = useQueryClient();

  const sendMut = useMutation({
    mutationFn: () => apiClient.post(`/service-reports/${ba.id}/send`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-reports-all'] });
      setConfirmSend(false);
    },
  });

  return (
    <div className="bg-white dark:bg-white/[0.06] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="font-mono text-xs font-bold text-[#007AFF] bg-[#EFF6FF] px-2 py-1 rounded-xl">
            {ba.report_number}
          </span>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
          ba.is_locked ? 'bg-[#F0FDF4] text-[#166534]' : 'bg-[#FFFBEB] text-[#92400E]'
        }`}>
          {ba.is_locked ? 'Final' : 'Tunggu TTD'}
        </span>
      </div>
      <p className="font-semibold text-gray-900 dark:text-white text-sm">{ba.visit?.user?.full_name ?? '—'}</p>
      <div className="flex items-center gap-1 mt-0.5 mb-3">
        <Building2 size={11} className="text-gray-400" />
        <p className="text-xs text-gray-500 dark:text-white/50">{ba.visit?.client?.name ?? '—'}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Calendar size={11} />
          {new Date(ba.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {ba.sent_to_client ? (
            <span className="flex items-center gap-1 text-xs text-[#166534] bg-[#F0FDF4] px-2.5 py-1 rounded-xl font-semibold">
              <CheckCircle2 size={11} /> Terkirim
            </span>
          ) : ba.is_locked && (
            confirmSend ? (
              <div className="flex items-center gap-1">
                <button onClick={() => sendMut.mutate()} disabled={sendMut.isPending}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[#34C759] text-white rounded-xl text-xs font-semibold hover:bg-[#28A348] disabled:opacity-60 transition">
                  {sendMut.isPending ? 'Mengirim...' : 'Ya, Kirim'}
                </button>
                <button onClick={() => setConfirmSend(false)}
                  className="px-2 py-1.5 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60 rounded-xl text-xs font-semibold hover:bg-gray-200 transition">
                  Batal
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmSend(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#FF9500]/10 text-[#FF9500] rounded-xl text-xs font-semibold hover:bg-[#FF9500]/20 transition">
                <Send size={11} /> Kirim
              </button>
            )
          )}
          {ba.pdf_url && (
            <a href={ba.pdf_url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 bg-[#007AFF] text-white rounded-xl text-xs font-semibold hover:bg-[#0063CC] transition">
              <FileText size={12} /> PDF
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Detail Modal ───────────────────────────────────────────────────────────────
function DetailModal({ visit, onClose, onReviewed }: { visit: Visit; onClose: () => void; onReviewed: (updated: Visit) => void }) {
  const [photoTab, setPhotoTab] = useState<'before' | 'during' | 'after'>('before');
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(visit.review_rating ?? 5);
  const [reviewStatus, setReviewStatus] = useState(visit.review_status ?? 'approved');
  const [reviewNotes, setReviewNotes] = useState(visit.review_notes ?? '');
  const qc = useQueryClient();

  const reviewMut = useMutation({
    mutationFn: () => apiClient.post(`/visits/${visit.id}/review`, {
      review_status: reviewStatus,
      review_rating: reviewRating,
      review_notes: reviewNotes.trim() || undefined,
    }).then((r) => r.data),
    onSuccess: (updated: Visit) => {
      qc.invalidateQueries({ queryKey: ['admin-visits'] });
      onReviewed(updated);
    },
  });

  const photosByPhase = {
    before: visit.photos?.filter((p) => p.phase === 'before') ?? [],
    during: visit.photos?.filter((p) => p.phase === 'during') ?? [],
    after:  visit.photos?.filter((p) => p.phase === 'after') ?? [],
  };
  const photoCount = visit.photos?.length ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-sm font-bold">
              {initials(visit.user?.full_name ?? 'U')}
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">{visit.user?.full_name ?? '—'}</p>
              <p className="text-xs text-gray-500 dark:text-white/50">{visit.client?.name ?? '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={visit.status} />
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { label: 'Check-in', value: visit.check_in_at ? new Date(visit.check_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' }) : '—', Icon: Clock },
              { label: 'Durasi', value: durFmt(visit.duration_minutes), Icon: Clock },
              { label: 'Foto', value: `${photoCount}/16`, Icon: Camera, valueClass: photoCount >= 16 ? 'text-[#166534]' : 'text-[#9A3412]' },
              {
                label: 'GPS',
                value: visit.gps_valid
                  ? 'Valid'
                  : (visit.gps_deviation_meter && visit.gps_deviation_meter > 100_000)
                    ? 'Lokasi klien belum dikonfigurasi'
                    : visit.gps_deviation_meter
                      ? `Deviasi ${(visit.gps_deviation_meter / 1000).toFixed(1)} km`
                      : 'Alert',
                Icon: visit.gps_valid ? Navigation : NavigationOff,
                valueClass: visit.gps_valid ? 'text-[#166534]' : 'text-[#9A3412]',
              },
            ].map(({ label, value, Icon, valueClass }) => (
              <div key={label} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon size={12} className="text-gray-400" />
                  <p className="text-[11px] text-gray-400 dark:text-white/30">{label}</p>
                </div>
                <p className={`text-sm font-semibold ${valueClass ?? 'text-gray-700 dark:text-white/80'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Photos */}
          <div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide mb-2">Foto Kunjungan</p>
            <div className="flex gap-1 mb-3 bg-gray-100 dark:bg-white/[0.06] rounded-xl p-1">
              {(['before', 'during', 'after'] as const).map((phase) => (
                <button key={phase} onClick={() => setPhotoTab(phase)}
                  className={`flex-1 py-1.5 rounded-[10px] text-[11px] font-semibold transition ${
                    photoTab === phase
                      ? 'bg-white dark:bg-white/[0.12] text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-white/40'
                  }`}>
                  {phase === 'before' ? 'Sebelum' : phase === 'during' ? 'Proses' : 'Sesudah'}
                  <span className="ml-1 opacity-60">({photosByPhase[phase].length})</span>
                </button>
              ))}
            </div>
            {photosByPhase[photoTab].length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 bg-gray-50 dark:bg-white/[0.03] rounded-xl">
                <ImageIcon size={24} className="text-gray-300 dark:text-white/20 mb-2" />
                <p className="text-xs text-gray-400 dark:text-white/30">Belum ada foto</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {photosByPhase[photoTab].map((photo) => {
                  const url = photo.watermarked_url ?? photo.original_url;
                  return (
                    <button key={photo.id} onClick={() => setLightbox(url)}
                      className="aspect-square overflow-hidden rounded-xl group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-200" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Report */}
          {(visit.work_description || visit.findings || visit.recommendations) && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">Laporan Pekerjaan</p>
              {[
                { key: 'work_description', label: 'Deskripsi Pekerjaan', value: visit.work_description },
                { key: 'findings', label: 'Temuan', value: visit.findings },
                { key: 'recommendations', label: 'Rekomendasi', value: visit.recommendations },
              ].filter((f) => f.value).map(({ key, label, value }) => (
                <div key={key} className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                  <p className="text-[11px] text-gray-400 dark:text-white/30 mb-1">{label}</p>
                  <p className="text-xs text-gray-700 dark:text-white/70 leading-relaxed">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Service Report / BA */}
          {visit.service_report && (
            <div className="bg-[#EFF6FF] dark:bg-[#007AFF]/10 border border-[#3B82F6]/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={14} className="text-[#007AFF]" />
                <p className="text-xs font-semibold text-[#1D4ED8] dark:text-[#60A5FA]">Berita Acara</p>
              </div>
              {visit.service_report.report_number && (
                <p className="font-mono text-sm font-bold text-[#007AFF] mb-3">{visit.service_report.report_number}</p>
              )}
              {visit.service_report.pdf_url ? (
                <a href={visit.service_report.pdf_url} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#007AFF] hover:bg-[#0063CC] text-white rounded-xl text-sm font-semibold transition">
                  <ExternalLink size={14} /> Lihat PDF
                </a>
              ) : (
                <p className="text-xs text-[#1D4ED8]/60 dark:text-[#60A5FA]/60 text-center py-1">
                  PDF belum digenerate — tanda tangan klien diperlukan
                </p>
              )}
            </div>
          )}

          {/* ── Review / Evaluasi (hanya untuk kunjungan selesai) ── */}
          {visit.status === 'completed' && (
            <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">
                  Evaluasi Kunjungan
                </p>
                {visit.review_status && (
                  <ReviewBadge status={visit.review_status} />
                )}
              </div>

              {visit.review_status ? (
                /* Sudah direview — tampilkan read-only */
                <div className="space-y-3">
                  <div className="flex items-center gap-3 bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                    <StarRating rating={visit.review_rating ?? 0} />
                    <span className="text-sm font-semibold text-gray-700 dark:text-white/80">
                      {visit.review_rating}/5
                    </span>
                  </div>
                  {visit.review_notes && (
                    <div className="bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3">
                      <p className="text-[11px] text-gray-400 dark:text-white/30 mb-1">Catatan</p>
                      <p className="text-xs text-gray-700 dark:text-white/70 leading-relaxed">{visit.review_notes}</p>
                    </div>
                  )}
                  {visit.reviewer && (
                    <p className="text-[11px] text-gray-400 dark:text-white/30 text-right">
                      Oleh {visit.reviewer.full_name} · {visit.reviewed_at ? new Date(visit.reviewed_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  )}
                </div>
              ) : (
                /* Belum direview — tampilkan form */
                <div className="space-y-3">
                  {/* Rating */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-white/40 mb-2">Rating Kualitas Kerja</p>
                    <StarRating rating={reviewRating} onChange={setReviewRating} />
                  </div>

                  {/* Status */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-white/40 mb-2">Keputusan</p>
                    <div className="flex gap-2">
                      {[
                        { value: 'approved', label: 'Setujui', icon: ThumbsUp, activeClass: 'bg-[#F0FDF4] border-[#34C759] text-[#166534]' },
                        { value: 'revision_needed', label: 'Perlu Revisi', icon: AlertCircle, activeClass: 'bg-[#FFF7ED] border-[#FF9500] text-[#9A3412]' },
                      ].map(({ value, label, icon: Icon, activeClass }) => (
                        <button key={value} type="button"
                          onClick={() => setReviewStatus(value)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border-2 transition ${
                            reviewStatus === value ? activeClass : 'border-gray-200 dark:border-white/10 text-gray-400 dark:text-white/30 hover:border-gray-300'
                          }`}>
                          <Icon size={13} strokeWidth={2} /> {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Catatan untuk teknisi (opsional)…"
                    rows={3}
                    className="w-full bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-gray-700 dark:text-white/80 placeholder:text-gray-400 dark:placeholder:text-white/25 resize-none outline-none focus:border-[#007AFF] dark:focus:border-[#007AFF] transition"
                  />

                  <button
                    onClick={() => reviewMut.mutate()}
                    disabled={reviewMut.isPending}
                    className="w-full py-3 bg-[#007AFF] hover:bg-[#0063CC] disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                  >
                    {reviewMut.isPending ? 'Menyimpan…' : 'Simpan Evaluasi'}
                  </button>
                  {reviewMut.isError && (
                    <p className="text-xs text-[#FF3B30] text-center">Gagal menyimpan evaluasi. Coba lagi.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[60] p-4" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Preview" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function VisitsPage() {
  const [tab, setTab] = useState<Tab>('visits');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [detail, setDetail] = useState<Visit | null>(null);
  const [confirmSendId, setConfirmSendId] = useState<string | null>(null);
  const handleReviewed = (updated: Visit) => setDetail(updated);
  const qc = useQueryClient();

  const sendBaMut = useMutation({
    mutationFn: (id: string) => apiClient.post(`/service-reports/${id}/send`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-reports-all'] });
      setConfirmSendId(null);
    },
  });

  const { data: result, isLoading } = useQuery({
    queryKey: ['admin-visits', statusFilter, dateFilter],
    queryFn: () =>
      apiClient.get('/visits', {
        params: { status: statusFilter || undefined, date: dateFilter || undefined, limit: 100 },
      }).then((r) => r.data),
    enabled: tab === 'visits' || tab === 'onhold',
    refetchInterval: 30_000,
  });

  const visits: Visit[] = result?.items ?? [];
  const onHoldVisits = visits.filter((v) => v.status === 'on_hold');
  const ongoingCount = visits.filter((v) => v.status === 'ongoing').length;
  const completedCount = visits.filter((v) => v.status === 'completed').length;

  const { data: serviceReports = [], isLoading: baLoading } = useQuery<ServiceReport[]>({
    queryKey: ['service-reports-all'],
    queryFn: () => apiClient.get('/service-reports').then((r) => r.data),
    enabled: tab === 'ba',
    refetchInterval: 30_000,
  });

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'visits', label: 'Semua Kunjungan' },
    { key: 'ba', label: 'Berita Acara' },
    { key: 'onhold', label: 'On Hold', count: onHoldVisits.length },
  ];

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Kunjungan</h1>
          <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">Monitor kunjungan lapangan teknisi</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard icon={MapPin}       label="Total Kunjungan" value={visits.length}   color="text-[#007AFF]" bg="bg-[#007AFF]/10" />
        <StatCard icon={Activity}     label="Berjalan"        value={ongoingCount}    color="text-[#34C759]" bg="bg-[#34C759]/10" />
        <StatCard icon={CheckCircle2} label="Selesai"         value={completedCount}  color="text-[#166534]" bg="bg-[#34C759]/15" />
        <StatCard icon={Pause}        label="Ditunda"         value={onHoldVisits.length} color="text-[#FF9500]" bg="bg-[#FF9500]/10" />
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 mb-4">
        <div className="flex gap-1.5 bg-white dark:bg-white/[0.06] rounded-2xl p-1.5 border border-black/[0.05] dark:border-white/[0.08] w-fit">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setDetail(null); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t.key
                  ? 'bg-[#007AFF] text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/70'
              }`}>
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? 'bg-white/20 text-white' : 'bg-[#FF9500]/15 text-[#FF9500]'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      {(tab === 'visits' || tab === 'onhold') && (
        <div className="px-4 sm:px-6 mb-4">
          <div className="flex flex-wrap gap-2 items-center p-3 bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08]">
            <div className="flex items-center gap-2 flex-1 min-w-[180px]">
              <Calendar size={15} className="text-gray-400 flex-shrink-0" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-full bg-transparent text-sm text-gray-700 dark:text-white/80 outline-none placeholder:text-gray-400 dark:placeholder:text-white/30"
              />
            </div>
            {tab === 'visits' && (
              <>
                <div className="w-px h-5 bg-gray-200 dark:bg-white/10" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-sm text-gray-700 dark:text-white/80 outline-none cursor-pointer"
                >
                  <option value="">Semua Status</option>
                  <option value="ongoing">Berjalan</option>
                  <option value="completed">Selesai</option>
                  <option value="on_hold">Ditunda</option>
                  <option value="rescheduled">Dijadwal Ulang</option>
                  <option value="cancelled">Dibatalkan</option>
                </select>
              </>
            )}
            {(statusFilter || dateFilter) && (
              <>
                <div className="w-px h-5 bg-gray-200 dark:bg-white/10" />
                <button onClick={() => { setStatusFilter(''); setDateFilter(''); }}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 dark:hover:text-white/60 transition">
                  <X size={13} /> Reset
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="px-4 sm:px-6 pb-8">

        {/* ── Semua Kunjungan ── */}
        {tab === 'visits' && (
          isLoading ? <LoadingSpinner /> : visits.length === 0 ? (
            <EmptyState icon={MapPin} label="Belum ada kunjungan" sub="Data kunjungan akan muncul di sini" />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {visits.map((v) => <VisitCard key={v.id} v={v} onClick={() => setDetail(v)} />)}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                      {['Teknisi', 'Klien', 'Check-in', 'Durasi', 'Foto', 'GPS', 'Status', 'Review', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => {
                      const photoCount = v.photos?.length ?? 0;
                      return (
                        <tr key={v.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-[11px] font-bold flex-shrink-0">
                                {initials(v.user?.full_name ?? 'U')}
                              </div>
                              <span className="font-medium text-gray-900 dark:text-white text-sm">{v.user?.full_name ?? '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-white/60 text-sm">{v.client?.name ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-500 dark:text-white/50 text-xs">
                            {v.check_in_at ? new Date(v.check_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Makassar' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-500 dark:text-white/50 text-xs">{durFmt(v.duration_minutes)}</td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1 text-xs font-semibold ${photoCount >= 16 ? 'text-[#166534]' : 'text-[#9A3412]'}`}>
                              <Camera size={12} />
                              {photoCount}/16
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {v.gps_valid
                              ? <span className="flex items-center gap-1 text-[11px] text-[#166534] bg-[#F0FDF4] px-2 py-0.5 rounded-full w-fit"><Navigation size={10} /> Valid</span>
                              : <span className="flex items-center gap-1 text-[11px] text-[#9A3412] bg-[#FFF7ED] px-2 py-0.5 rounded-full w-fit"><NavigationOff size={10} /> Alert</span>
                            }
                          </td>
                          <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                          <td className="px-4 py-3">
                            {v.status === 'completed' ? (
                              v.review_status ? <ReviewBadge status={v.review_status} /> : (
                                <span className="text-[11px] text-gray-400 bg-gray-100 dark:bg-white/[0.06] px-2 py-0.5 rounded-full">Belum</span>
                              )
                            ) : <span className="text-gray-300 dark:text-white/20">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => setDetail(v)}
                              className="px-3 py-1.5 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] rounded-xl text-xs font-semibold transition">
                              Detail
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}

        {/* ── Berita Acara ── */}
        {tab === 'ba' && (
          baLoading ? <LoadingSpinner /> : serviceReports.length === 0 ? (
            <EmptyState icon={FileText} label="Belum ada Berita Acara" sub="Berita acara akan muncul setelah kunjungan selesai" />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {serviceReports.map((ba) => <BaCard key={ba.id} ba={ba} />)}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                      {['No. BA', 'Teknisi', 'Klien', 'Tanggal', 'Status', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {serviceReports.map((ba) => (
                      <tr key={ba.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs font-bold text-[#007AFF] bg-[#EFF6FF] px-2.5 py-1 rounded-xl">
                            {ba.report_number}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{ba.visit?.user?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-white/60">{ba.visit?.client?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-white/50 text-xs">
                          {new Date(ba.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Makassar' })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            ba.is_locked
                              ? 'bg-[#F0FDF4] text-[#166534]'
                              : 'bg-[#FFFBEB] text-[#92400E]'
                          }`}>
                            {ba.is_locked ? 'Final' : 'Tunggu TTD'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {ba.sent_to_client ? (
                              <span className="flex items-center gap-1 text-xs text-[#166534] bg-[#F0FDF4] px-2.5 py-1 rounded-xl font-semibold whitespace-nowrap">
                                <CheckCircle2 size={11} /> Terkirim
                              </span>
                            ) : ba.is_locked && (
                              confirmSendId === ba.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => sendBaMut.mutate(ba.id)}
                                    disabled={sendBaMut.isPending}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-[#34C759] text-white rounded-xl text-xs font-semibold hover:bg-[#28A348] disabled:opacity-60 transition whitespace-nowrap">
                                    {sendBaMut.isPending ? 'Mengirim...' : 'Ya, Kirim'}
                                  </button>
                                  <button onClick={() => setConfirmSendId(null)}
                                    className="px-2 py-1.5 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/60 rounded-xl text-xs font-semibold hover:bg-gray-200 transition">
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmSendId(ba.id)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[#FF9500]/10 text-[#FF9500] rounded-xl text-xs font-semibold hover:bg-[#FF9500]/20 transition whitespace-nowrap">
                                  <Send size={11} /> Kirim ke Klien
                                </button>
                              )
                            )}
                            {ba.pdf_url && (
                              <a href={ba.pdf_url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] rounded-xl text-xs font-semibold transition w-fit whitespace-nowrap">
                                <ExternalLink size={12} /> PDF
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}

        {/* ── On Hold ── */}
        {tab === 'onhold' && (
          isLoading ? <LoadingSpinner /> : onHoldVisits.length === 0 ? (
            <EmptyState icon={CheckCircle2} label="Tidak ada yang ditunda" sub="Semua kunjungan berjalan lancar" iconColor="text-[#34C759]" iconBg="bg-[#34C759]/10" />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {onHoldVisits.map((v) => <VisitCard key={v.id} v={v} onClick={() => setDetail(v)} />)}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-x-auto overflow-hidden">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-black/[0.05] dark:border-white/[0.06]">
                      {['Teknisi', 'Klien', 'Tanggal Check-in', 'Durasi', 'Status', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {onHoldVisits.map((v) => (
                      <tr key={v.id} className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF] text-[11px] font-bold flex-shrink-0">
                              {initials(v.user?.full_name ?? 'U')}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">{v.user?.full_name ?? '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-white/60">{v.client?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 dark:text-white/50 text-xs">
                          {v.check_in_at ? new Date(v.check_in_at).toLocaleDateString('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Makassar' }) : '—'}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-white/50 text-xs">{durFmt(v.duration_minutes)}</td>
                        <td className="px-4 py-3"><StatusBadge status={v.status} /></td>
                        <td className="px-4 py-3">
                          <button onClick={() => setDetail(v)}
                            className="px-3 py-1.5 bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] rounded-xl text-xs font-semibold transition">
                            Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}
      </div>

      {/* Detail Modal */}
      {detail && <DetailModal visit={detail} onClose={() => setDetail(null)} onReviewed={handleReviewed} />}
    </div>
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

function EmptyState({ icon: Icon, label, sub, iconColor = 'text-gray-300 dark:text-white/20', iconBg = 'bg-gray-100 dark:bg-white/[0.06]' }: {
  icon: React.ElementType; label: string; sub?: string; iconColor?: string; iconBg?: string;
}) {
  return (
    <div className="text-center py-16">
      <div className={`w-16 h-16 rounded-2xl ${iconBg} flex items-center justify-center mx-auto mb-4`}>
        <Icon size={28} className={iconColor} />
      </div>
      <p className="text-sm font-medium text-gray-500 dark:text-white/40">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-white/25 mt-1">{sub}</p>}
    </div>
  );
}
