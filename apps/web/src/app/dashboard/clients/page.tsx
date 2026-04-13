'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Building2, Search, Plus, X, ExternalLink,
  MapPin, FileText, Clock, AlertTriangle,
  Star, CheckCircle2, AlertCircle, Shield,
  BarChart3, Calendar,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
type Client = {
  id: string;
  name: string;
  pic_name: string | null;
  pic_phone: string | null;
  pic_email: string | null;
  address: string | null;
  is_active: boolean;
  contract_type: 'regular' | 'priority' | 'emergency';
  contract_number: string | null;
  contract_start: string | null;
  contract_end: string | null;
  sla_response_hours: number;
  sla_completion_hours: number;
  monthly_visit_quota: number;
  account_manager: { full_name: string } | null;
  contract_doc_url: string | null;
  notes: string | null;
  created_at: string;
};

type SlaPerf = {
  month: string;
  visits_count: number;
  avg_response_hrs: number | null;
  avg_completion_hrs: number | null;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const CONTRACT_MAP: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  regular:   { label: 'Regular',   bg: 'bg-gray-100 dark:bg-gray-800',    text: 'text-gray-600 dark:text-gray-400',  ring: 'ring-gray-200 dark:ring-gray-700' },
  priority:  { label: 'Priority',  bg: 'bg-[#007AFF]/10',                 text: 'text-[#007AFF]',                    ring: 'ring-[#007AFF]/20' },
  emergency: { label: 'Emergency', bg: 'bg-[#FF3B30]/10',                 text: 'text-[#FF3B30]',                    ring: 'ring-[#FF3B30]/20' },
};

const inputCls =
  'w-full rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#2C2C2E] px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30';
const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

type Tab = 'all' | 'emergency' | 'priority' | 'sla';

const TABS: { key: Tab; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { key: 'all',       label: 'Semua Klien', Icon: Building2 },
  { key: 'emergency', label: 'Emergency',   Icon: AlertTriangle },
  { key: 'priority',  label: 'Priority',    Icon: Star },
  { key: 'sla',       label: 'SLA',         Icon: BarChart3 },
];

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, color,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number | string;
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

// ── ContractBadge ─────────────────────────────────────────────────────────────
function ContractBadge({ type }: { type: string }) {
  const m = CONTRACT_MAP[type] ?? CONTRACT_MAP.regular;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ring-1 ${m.bg} ${m.text} ${m.ring}`}
    >
      {m.label}
    </span>
  );
}

// ── ClientCard (mobile) ───────────────────────────────────────────────────────
function ClientCard({
  client, onDetail, onEdit,
}: {
  client: Client;
  onDetail: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.08]">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-[#007AFF]">{initials(client.name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{client.name}</p>
            <ContractBadge type={client.contract_type} />
          </div>
          {client.address && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin size={11} className="text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{client.address}</p>
            </div>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <Clock size={11} />
              {client.sla_response_hours}j response
            </span>
            {client.monthly_visit_quota > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Calendar size={11} />
                {client.monthly_visit_quota}/bln
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-black/[0.04] dark:border-white/[0.06]">
        <button
          onClick={onDetail}
          className="flex-1 py-1.5 rounded-xl bg-[#007AFF]/10 text-[#007AFF] text-xs font-semibold"
        >
          Detail
        </button>
        <button
          onClick={onEdit}
          className="flex-1 py-1.5 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-xs font-semibold"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ClientsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Client | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ['clients', tab === 'emergency' || tab === 'priority' ? tab : undefined],
    queryFn: () =>
      apiClient
        .get('/clients', {
          params: tab === 'emergency' || tab === 'priority' ? { contract_type: tab } : {},
        })
        .then((r) => r.data),
  });

  const filtered = clients.filter(
    (c) => !search || c.name.toLowerCase().includes(search.toLowerCase()),
  );

  const emergency = clients.filter((c) => c.contract_type === 'emergency');
  const priority = clients.filter((c) => c.contract_type === 'priority');

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">
      {/* Page Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Klien & SLA</h1>
          <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">
            Manajemen klien dan monitoring Service Level Agreement
          </p>
        </div>
        <button
          onClick={() => { setEditClient(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0071e3] text-white rounded-xl text-sm font-semibold transition flex-shrink-0"
        >
          <Plus size={16} />
          Tambah Klien
        </button>
      </div>

      {/* StatCards */}
      <div className="px-4 sm:px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Building2}     label="Total Klien"  value={clients.length}                          color="bg-[#007AFF]" />
        <StatCard icon={AlertTriangle} label="Emergency"    value={emergency.length}                        color="bg-[#FF3B30]" />
        <StatCard icon={Star}          label="Priority"     value={priority.length}                         color="bg-[#FF9500]" />
        <StatCard icon={Shield}        label="Aktif"        value={clients.filter((c) => c.is_active).length} color="bg-[#34C759]" />
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 pb-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition flex-shrink-0 ${
                  active
                    ? 'bg-[#007AFF] text-white'
                    : 'bg-white dark:bg-[#1C1C1E] text-gray-600 dark:text-gray-400 border border-black/[0.08] dark:border-white/[0.1] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                }`}
              >
                <t.Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'sla' ? (
        <SlaDashboard clients={clients} emergency={emergency} priority={priority} />
      ) : (
        <>
          {/* Filter Bar */}
          <div className="px-4 sm:px-6 pb-4">
            <div className="flex items-center gap-3 p-3 bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08]">
              <Search size={16} className="text-gray-400 flex-shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama klien…"
                className="flex-1 text-sm bg-transparent text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center">
                <Building2 size={28} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Tidak ada klien</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {search ? 'Coba kata kunci lain' : 'Belum ada klien yang ditambahkan'}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="px-4 sm:px-6 pb-6 md:hidden space-y-3">
                {filtered.map((c) => (
                  <ClientCard
                    key={c.id}
                    client={c}
                    onDetail={() => setDetail(c)}
                    onEdit={() => { setEditClient(c); setShowForm(true); }}
                  />
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block px-4 sm:px-6 pb-6">
                <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/[0.04] dark:border-white/[0.06]">
                        {['Nama Klien', 'Kontrak', 'SLA Response', 'SLA Completion', 'Kuota/Bln', 'Aksi'].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-3 text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr
                          key={c.id}
                          className="border-b border-black/[0.03] dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer transition"
                          onClick={() => setDetail(c)}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold text-[#007AFF]">{initials(c.name)}</span>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                                {c.address && (
                                  <p className="text-xs text-gray-400 truncate max-w-[200px]">{c.address}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <ContractBadge type={c.contract_type} />
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{c.sla_response_hours} jam</td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">{c.sla_completion_hours} jam</td>
                          <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400">
                            {c.monthly_visit_quota > 0 ? (
                              `${c.monthly_visit_quota}/bln`
                            ) : (
                              <span className="text-gray-400">Tidak terbatas</span>
                            )}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setDetail(c)}
                                className="px-3 py-1 bg-[#007AFF]/10 text-[#007AFF] rounded-xl text-xs font-semibold"
                              >
                                Detail
                              </button>
                              <button
                                onClick={() => { setEditClient(c); setShowForm(true); }}
                                className="px-3 py-1 bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold"
                              >
                                Edit
                              </button>
                            </div>
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

      {/* Detail Modal */}
      {detail && (
        <ClientDetailModal
          client={detail}
          onClose={() => setDetail(null)}
          onEdit={() => { setEditClient(detail); setShowForm(true); }}
        />
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <ClientFormModal
          client={editClient}
          onClose={() => { setShowForm(false); setEditClient(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['clients'] });
            setShowForm(false);
            setEditClient(null);
          }}
        />
      )}
    </div>
  );
}

// ── Client Detail Modal ───────────────────────────────────────────────────────
function ClientDetailModal({
  client, onClose, onEdit,
}: {
  client: Client;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { data: slaPerf } = useQuery<SlaPerf>({
    queryKey: ['client-sla', client.id, currentMonth()],
    queryFn: () => apiClient.get(`/clients/${client.id}/sla`).then((r) => r.data),
  });

  const { data: slaHistory = [] } = useQuery<SlaPerf[]>({
    queryKey: ['client-sla-history', client.id],
    queryFn: () => apiClient.get(`/clients/${client.id}/sla/history`).then((r) => r.data),
  });

  const infoRows = [
    { label: 'No. Kontrak',     value: client.contract_number },
    { label: 'Account Manager', value: client.account_manager?.full_name },
    { label: 'Berlaku Mulai',   value: client.contract_start },
    { label: 'Berlaku Sampai',  value: client.contract_end },
    { label: 'PIC',             value: client.pic_name },
    { label: 'HP PIC',          value: client.pic_phone },
  ].filter((r) => r.value);

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
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-black/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-[#007AFF]">{initials(client.name)}</span>
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white">{client.name}</p>
              <div className="mt-0.5">
                <ContractBadge type={client.contract_type} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-[#007AFF] bg-[#007AFF]/10"
            >
              Edit
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center"
            >
              <X size={16} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Alamat */}
          {client.address && (
            <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
              <span>{client.address}</span>
            </div>
          )}

          {/* Info Grid */}
          {infoRows.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {infoRows.map(({ label, value }) => (
                <div key={label} className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* SLA Agreement */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              SLA Agreement
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#007AFF]/10 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[#007AFF]">{client.sla_response_hours}j</p>
                <p className="text-[10px] text-[#007AFF]/70">Response max</p>
              </div>
              <div className="bg-[#AF52DE]/10 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-[#AF52DE]">{client.sla_completion_hours}j</p>
                <p className="text-[10px] text-[#AF52DE]/70">Completion max</p>
              </div>
            </div>
            {client.monthly_visit_quota > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Kuota kunjungan: {client.monthly_visit_quota}/bulan
              </p>
            )}
          </div>

          {/* Performa SLA Bulan Ini */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Performa SLA Bulan Ini
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-0.5">Kunjungan</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{slaPerf?.visits_count ?? 0}</p>
              </div>
              <div className="bg-[#F2F2F7] dark:bg-[#2C2C2E] rounded-xl p-3">
                <p className="text-[10px] text-gray-400 mb-0.5">Avg Response</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {slaPerf?.avg_response_hrs != null ? `${slaPerf.avg_response_hrs}j` : '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Riwayat SLA */}
          {slaHistory.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
                Riwayat SLA
              </p>
              <div className="space-y-0">
                {slaHistory.slice(0, 6).map((h) => (
                  <div
                    key={h.month}
                    className="flex items-center justify-between text-xs py-2 border-b border-black/[0.04] dark:border-white/[0.05]"
                  >
                    <span className="text-gray-500 dark:text-gray-400">{h.month}</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{h.visits_count} kunjungan</span>
                    <span className="text-gray-400">
                      {h.avg_response_hrs != null ? `${h.avg_response_hrs}j` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dokumen Kontrak */}
          {client.contract_doc_url && (
            <a
              href={client.contract_doc_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-[#007AFF] font-semibold hover:underline"
            >
              <FileText size={16} />
              Lihat Dokumen Kontrak
              <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SLA Dashboard ─────────────────────────────────────────────────────────────
function SlaDashboard({
  clients, emergency, priority,
}: {
  clients: Client[];
  emergency: Client[];
  priority: Client[];
}) {
  return (
    <div className="px-4 sm:px-6 pb-6 space-y-5">
      {/* Metric StatCards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={CheckCircle2}  label="SLA OK"      value={clients.length} color="bg-[#34C759]" />
        <StatCard icon={AlertCircle}   label="At Risk"     value={0}              color="bg-[#FF9500]" />
        <StatCard icon={AlertTriangle} label="Breach"      value={0}              color="bg-[#FF3B30]" />
        <StatCard icon={Building2}     label="Total Klien" value={clients.length} color="bg-[#007AFF]" />
      </div>

      {/* By contract type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-[#FF3B30]" />
            <p className="text-sm font-semibold text-[#FF3B30]">Emergency ({emergency.length})</p>
          </div>
          {emergency.length === 0 ? (
            <p className="text-xs text-gray-400">Tidak ada klien emergency</p>
          ) : (
            <div className="space-y-0">
              {emergency.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-black/[0.04] dark:border-white/[0.05]"
                >
                  <span className="font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                  <span className="text-[#FF3B30] font-medium">{c.sla_response_hours}j response</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Star size={16} className="text-[#FF9500]" />
            <p className="text-sm font-semibold text-[#FF9500]">Priority ({priority.length})</p>
          </div>
          {priority.length === 0 ? (
            <p className="text-xs text-gray-400">Tidak ada klien priority</p>
          ) : (
            <div className="space-y-0">
              {priority.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between text-xs py-1.5 border-b border-black/[0.04] dark:border-white/[0.05]"
                >
                  <span className="font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                  <span className="text-[#007AFF] font-medium">{c.sla_response_hours}j response</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Client Form Modal ─────────────────────────────────────────────────────────
function ClientFormModal({
  client, onClose, onSaved,
}: {
  client: Client | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name:                client?.name ?? '',
    pic_name:            client?.pic_name ?? '',
    pic_phone:           client?.pic_phone ?? '',
    pic_email:           client?.pic_email ?? '',
    address:             client?.address ?? '',
    contract_type:       client?.contract_type ?? 'regular',
    contract_number:     client?.contract_number ?? '',
    contract_start:      client?.contract_start ?? '',
    contract_end:        client?.contract_end ?? '',
    sla_response_hours:  client?.sla_response_hours ?? 24,
    sla_completion_hours: client?.sla_completion_hours ?? 48,
    monthly_visit_quota: client?.monthly_visit_quota ?? 0,
    notes:               client?.notes ?? '',
  });

  const mut = useMutation({
    mutationFn: () =>
      client
        ? apiClient.patch(`/clients/${client.id}`, form).then((r) => r.data)
        : apiClient.post('/clients', form).then((r) => r.data),
    onSuccess: onSaved,
  });

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

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
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {client ? 'Edit Klien' : 'Tambah Klien Baru'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] flex items-center justify-center"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {/* Identitas */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Identitas</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Nama Perusahaan *</label>
                <input
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  className={inputCls}
                  placeholder="PT. ..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nama PIC</label>
                  <input
                    value={form.pic_name}
                    onChange={(e) => set('pic_name', e.target.value)}
                    className={inputCls}
                    placeholder="Nama PIC"
                  />
                </div>
                <div>
                  <label className={labelCls}>HP PIC</label>
                  <input
                    value={form.pic_phone}
                    onChange={(e) => set('pic_phone', e.target.value)}
                    className={inputCls}
                    placeholder="+62..."
                  />
                </div>
                <div>
                  <label className={labelCls}>Email PIC</label>
                  <input
                    type="email"
                    value={form.pic_email}
                    onChange={(e) => set('pic_email', e.target.value)}
                    className={inputCls}
                    placeholder="pic@..."
                  />
                </div>
                <div>
                  <label className={labelCls}>Tipe Kontrak</label>
                  <select
                    value={form.contract_type}
                    onChange={(e) => set('contract_type', e.target.value)}
                    className={inputCls}
                  >
                    <option value="regular">Regular</option>
                    <option value="priority">Priority</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={labelCls}>Alamat</label>
                <textarea
                  value={form.address}
                  onChange={(e) => set('address', e.target.value)}
                  className={`${inputCls} resize-none h-16`}
                  placeholder="Jl. ..."
                />
              </div>
            </div>
          </div>

          {/* Kontrak & SLA */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kontrak & SLA</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>No. Kontrak</label>
                <input
                  value={form.contract_number}
                  onChange={(e) => set('contract_number', e.target.value)}
                  className={inputCls}
                  placeholder="KTR/..."
                />
              </div>
              <div>
                <label className={labelCls}>Berlaku Mulai</label>
                <input
                  type="date"
                  value={form.contract_start}
                  onChange={(e) => set('contract_start', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Berlaku Sampai</label>
                <input
                  type="date"
                  value={form.contract_end}
                  onChange={(e) => set('contract_end', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>SLA Response (jam)</label>
                <input
                  type="number"
                  min={1}
                  value={form.sla_response_hours}
                  onChange={(e) => set('sla_response_hours', +e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>SLA Completion (jam)</label>
                <input
                  type="number"
                  min={1}
                  value={form.sla_completion_hours}
                  onChange={(e) => set('sla_completion_hours', +e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Kuota Kunjungan/Bulan</label>
                <input
                  type="number"
                  min={0}
                  value={form.monthly_visit_quota}
                  onChange={(e) => set('monthly_visit_quota', +e.target.value)}
                  className={inputCls}
                  placeholder="0 = tidak terbatas"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-4 border-t border-black/[0.06] dark:border-white/[0.08]">
          <button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !form.name.trim()}
            className="flex-1 py-2.5 rounded-xl bg-[#007AFF] hover:bg-[#0071e3] disabled:opacity-50 text-white text-sm font-semibold transition"
          >
            {mut.isPending ? 'Menyimpan…' : client ? 'Simpan Perubahan' : 'Tambah Klien'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-gray-300 text-sm font-semibold"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
