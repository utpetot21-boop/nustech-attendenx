'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ChevronLeft, ChevronRight, Clock, Users, Building2,
  RotateCcw, Plus, Pencil, Trash2, CalendarDays, CheckCircle2, X, Zap,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';
import { ShiftConfigurator } from '@/components/schedule/ShiftConfigurator';
import { AssignmentGrid } from '@/components/schedule/AssignmentGrid';

// ── Types ─────────────────────────────────────────────────────
interface ShiftType {
  id: string; name: string; start_time: string; end_time: string;
  duration_minutes: number; tolerance_minutes: number; color_hex: string; is_active: boolean;
}
interface OHConfig {
  id: string; work_days: string[]; start_time: string; end_time: string; tolerance_minutes: number;
}

// ── Date helpers (timezone-safe, always local) ────────────────
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function getWeekDates(offset = 0): string[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return localDateStr(d);
  });
}
function getWeekString(offset = 0): string {
  const dates = getWeekDates(offset);
  const monday = parseLocalDate(dates[0]);
  const year = monday.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = new Date(jan4);
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  const weekNum = Math.round((monday.getTime() - startOfWeek1.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const DAYS_MAP   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TABS = ['Konfigurasi', 'Assign Jadwal', 'Hari Libur'];
const ALL_DAYS_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const ALL_DAYS_LABEL: Record<string, string> = { Mon: 'Sen', Tue: 'Sel', Wed: 'Rab', Thu: 'Kam', Fri: 'Jum', Sat: 'Sab', Sun: 'Min' };
const _now  = new Date();
const TODAY = localDateStr(_now);

// ── Sub-components ─────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: React.ElementType; label: string; value: number; color: string; bg: string;
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
    </div>
  );
}

// ── Add Holiday Modal ──────────────────────────────────────────
function AddHolidayModal({ onClose, onSave }: { onClose: () => void; onSave: (dto: object) => void }) {
  const [form, setForm] = useState({ date: '', name: '' });
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-gray-900 dark:text-white">Tambah Hari Libur</h3>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
            <X size={16} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/40 mb-1.5">Tanggal</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full h-10 px-3 rounded-xl text-sm border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF]" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/40 mb-1.5">Nama Hari Libur</label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="contoh: Hari Raya Idul Fitri"
              className="w-full h-10 px-3 rounded-xl text-sm border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF] placeholder:text-gray-400 dark:placeholder:text-white/30" />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl text-sm font-medium border border-black/10 dark:border-white/[0.12] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
            Batal
          </button>
          <button
            onClick={() => { if (form.date && form.name) { onSave(form); onClose(); } }}
            disabled={!form.date || !form.name}
            className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-[#007AFF] hover:bg-[#0063CC] disabled:opacity-40 transition">
            Simpan
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Generate Shift Modal ───────────────────────────────────────
function GenerateShiftModal({
  shiftTypes,
  shiftUserCount,
  onClose,
  onGenerate,
  loading,
}: {
  shiftTypes: ShiftType[];
  shiftUserCount: number;
  onClose: () => void;
  onGenerate: (data: { shift_type_id: string; period: 'week' | 'month'; cycle_start_date: string }) => void;
  loading: boolean;
}) {
  const monday = (() => {
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return localDateStr(d);
  })();

  const [shiftTypeId, setShiftTypeId] = useState(shiftTypes[0]?.id ?? '');
  const [period, setPeriod]           = useState<'week' | 'month'>('week');
  const [cycleStart, setCycleStart]   = useState(monday);

  const canSubmit = !!shiftTypeId && !!cycleStart && !loading;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#1C1C1E] rounded-t-3xl sm:rounded-3xl w-full sm:max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Generate Jadwal Shift</h3>
            <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">Pola 5 hari kerja · 1 hari libur</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-white/50 hover:bg-gray-200 dark:hover:bg-white/[0.12] transition">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/40 mb-1.5">Tipe Shift</label>
            <select value={shiftTypeId} onChange={e => setShiftTypeId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF]">
              {shiftTypes.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.start_time.slice(0,5)}–{s.end_time.slice(0,5)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/40 mb-1.5">Periode</label>
            <div className="flex gap-2">
              {(['week', 'month'] as const).map(p => (
                <button key={p} type="button" onClick={() => setPeriod(p)}
                  className={`flex-1 h-9 rounded-xl text-sm font-medium border transition-colors ${
                    period === p ? 'bg-[#007AFF] text-white border-[#007AFF]'
                    : 'bg-white dark:bg-white/[0.06] text-gray-600 dark:text-white/60 border-black/10 dark:border-white/[0.12]'
                  }`}>
                  {p === 'week' ? 'Minggu Ini' : 'Bulan Ini'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/40 mb-1.5">Tanggal Acuan Siklus</label>
            <input type="date" value={cycleStart} onChange={e => setCycleStart(e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-sm border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF]" />
            <p className="text-[11px] text-gray-400 dark:text-white/35 mt-1">
              Hari libur tiap karyawan didistribusikan otomatis. Sesuaikan manual lewat klik sel di grid.
            </p>
          </div>

          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[#FFF9EC] dark:bg-[rgba(255,159,10,0.10)] border border-[#FDDFA0] dark:border-[rgba(255,159,10,0.25)]">
            <span className="text-sm mt-0.5">⚠️</span>
            <p className="text-[11px] text-[#92400E] dark:text-[#FCD34D] leading-relaxed">
              Generate akan <b>menimpa</b> jadwal shift yang sudah ada.
              {shiftUserCount > 0 && ` Berlaku untuk ${shiftUserCount} karyawan shift.`}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl text-sm font-medium border border-black/10 dark:border-white/[0.12] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
            Batal
          </button>
          <button
            onClick={() => canSubmit && onGenerate({ shift_type_id: shiftTypeId, period, cycle_start_date: cycleStart })}
            disabled={!canSubmit}
            className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-[#007AFF] hover:bg-[#0063CC] disabled:opacity-40 transition flex items-center justify-center gap-2">
            {loading ? 'Generating...' : <><Zap size={14} /> Generate</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function SchedulePage() {
  const [activeTab, setActiveTab]     = useState(0);
  const [weekOffset, setWeekOffset]   = useState(0);
  const [showForm, setShowForm]       = useState(false);
  const [editShift, setEditShift]     = useState<ShiftType | null>(null);
  const [deleteShiftId, setDeleteShiftId] = useState<string | null>(null);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [deleteHolidayId, setDeleteHolidayId] = useState<string | null>(null);
  const [showGenerateShift, setShowGenerateShift] = useState(false);
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear());
  const [ohActiveCell, setOhActiveCell] = useState<{
    userId: string; date: string; userName: string; cellType: 'work' | 'day_off' | 'national_holiday';
  } | null>(null);
  const [ohEditing, setOhEditing] = useState(false);
  const [ohForm, setOhForm] = useState({ start_time: '08:00', end_time: '16:00', work_days: ['Mon','Tue','Wed','Thu','Fri','Sat'], tolerance_minutes: 15 });
  const [ohFormError, setOhFormError] = useState('');
  const qc = useQueryClient();

  const weekDates  = getWeekDates(weekOffset);
  const weekStr    = getWeekString(weekOffset);
  const year       = holidayYear;
  const weekYear1  = parseLocalDate(weekDates[0]).getFullYear();
  const weekYear2  = parseLocalDate(weekDates[6]).getFullYear();
  const weekSpansYears = weekYear1 !== weekYear2;

  const formatWeekLabel = () => {
    const d0 = parseLocalDate(weekDates[0]);
    const d6 = parseLocalDate(weekDates[6]);
    const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return `${fmt(d0)} – ${fmt(d6)} ${d6.getFullYear()}`;
  };

  // ── Queries ──────────────────────────────────────────────────
  const { data: shifts = [] } = useQuery<ShiftType[]>({
    queryKey: ['shift-types'],
    queryFn: () => apiClient.get('/schedules/shift-types').then(r => r.data),
  });

  const { data: ohConfig } = useQuery<OHConfig | null>({
    queryKey: ['oh-global'],
    queryFn: () => apiClient.get('/schedules/office-hours/global').then(r => r.data),
  });

  const { data: teamSchedule = [] } = useQuery({
    queryKey: ['team-schedule', weekStr],
    queryFn: () => apiClient.get(`/schedules/team?week=${weekStr}`).then(r => r.data),
    enabled: activeTab === 1,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ['users-all'],
    queryFn: () => apiClient.get('/users?limit=200').then(r => {
      const d = r.data;
      if (Array.isArray(d) && Array.isArray(d[0])) return d[0];
      return d?.items ?? d?.data ?? d;
    }),
  });

  // Holidays untuk tab Assign Jadwal
  const { data: weekHolidays1 = [] } = useQuery<any[]>({
    queryKey: ['holidays', weekYear1],
    queryFn: () => apiClient.get(`/schedules/holidays?year=${weekYear1}`).then(r => r.data),
    enabled: activeTab === 1,
  });
  const { data: weekHolidays2 = [] } = useQuery<any[]>({
    queryKey: ['holidays', weekYear2],
    queryFn: () => apiClient.get(`/schedules/holidays?year=${weekYear2}`).then(r => r.data),
    enabled: activeTab === 1 && weekSpansYears,
  });

  // Holidays untuk tab Hari Libur
  const { data: holidays = [] } = useQuery<any[]>({
    queryKey: ['holidays', year],
    queryFn: () => apiClient.get(`/schedules/holidays?year=${year}`).then(r => r.data),
    enabled: activeTab === 2,
  });

  // ── Mutations ─────────────────────────────────────────────────
  const createShift = useMutation({
    mutationFn: (data: object) => apiClient.post('/schedules/shift-types', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift-types'] }); setShowForm(false); },
    onError: () => toast.error('Gagal membuat tipe shift'),
  });
  const updateShift = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) => apiClient.patch(`/schedules/shift-types/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift-types'] }); setEditShift(null); },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal memperbarui shift')),
  });
  const deleteShift = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/schedules/shift-types/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shift-types'] }); setDeleteShiftId(null); },
    onError: () => toast.error('Gagal menghapus shift'),
  });
  const assignShift = useMutation({
    mutationFn: (data: object) => apiClient.post('/schedules/assign', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-schedule', weekStr] }),
    onError: () => toast.error('Gagal assign shift'),
  });
  const unassignShift = useMutation({
    mutationFn: ({ user_id, date }: { user_id: string; date: string }) =>
      apiClient.delete('/schedules/assign', { data: { user_id, date } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-schedule', weekStr] }),
    onError: () => toast.error('Gagal hapus assignment'),
  });
  const overrideDay = useMutation({
    mutationFn: (data: { user_id: string; date: string; is_day_off: boolean }) =>
      apiClient.patch('/schedules/override', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-schedule', weekStr] });
      toast.success('Jadwal diperbarui');
    },
    onError: () => toast.error('Gagal mengubah jadwal'),
  });
  const saveOhConfig = useMutation({
    mutationFn: (dto: object) => apiClient.patch('/schedules/office-hours/global', dto),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['oh-global'] });
      setOhEditing(false);
      setOhFormError('');
      toast.success('Konfigurasi Office Hours tersimpan');
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? 'Gagal menyimpan';
      setOhFormError(Array.isArray(msg) ? msg.join(', ') : msg);
    },
  });
  const generateOHWeek = useMutation({
    mutationFn: async () => {
      let total = 0;
      for (const date of weekDates) {
        try {
          const r = await apiClient.post('/schedules/generate', { date });
          total += r.data?.generated ?? 0;
        } catch {
          // skip hari yang gagal
        }
      }
      return total;
    },
    onSuccess: (total: number) => {
      qc.invalidateQueries({ queryKey: ['team-schedule'] });
      toast.success(total > 0 ? `Jadwal minggu ini di-generate: ${total} entri baru` : 'Jadwal minggu ini sudah ter-generate');
    },
    onError: () => toast.error('Gagal generate jadwal'),
  });

  const generateOHMonth = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const r = await apiClient.post('/schedules/generate-month', { month: monthStr });
      return { total: r.data?.generated ?? 0, month: now };
    },
    onSuccess: ({ total, month }: { total: number; month: Date }) => {
      // Invalidate semua minggu yang mungkin terpengaruh
      qc.invalidateQueries({ queryKey: ['team-schedule'] });
      const label = month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      toast.success(total > 0 ? `Jadwal ${label} di-generate: ${total} entri baru` : `Jadwal ${label} sudah ter-generate`);
    },
    onError: () => toast.error('Gagal generate jadwal bulanan'),
  });
  const markShiftDayOff = useMutation({
    mutationFn: ({ user_id, date }: { user_id: string; date: string }) =>
      apiClient.post('/schedules/mark-shift-dayoff', { user_id, date }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-schedule', weekStr] }),
    onError: () => toast.error('Gagal menandai libur'),
  });

  const generateShift = useMutation({
    mutationFn: (data: { shift_type_id: string; period: 'week' | 'month'; cycle_start_date: string }) => {
      const now = new Date();
      let start_date: string;
      let end_date: string;
      if (data.period === 'week') {
        start_date = weekDates[0];
        end_date   = weekDates[6];
      } else {
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        start_date = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        end_date = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }
      return apiClient.post('/schedules/generate-shift', {
        shift_type_id: data.shift_type_id,
        start_date,
        end_date,
        cycle_start_date: data.cycle_start_date,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['team-schedule'] });
      setShowGenerateShift(false);
      toast.success(`Jadwal shift di-generate: ${res.data?.generated ?? 0} entri`);
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal generate jadwal shift')),
  });

  const createHoliday = useMutation({
    mutationFn: (dto: object) => apiClient.post('/schedules/holidays', dto),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays', year] }); toast.success('Hari libur ditambahkan'); },
    onError: () => toast.error('Gagal menambah hari libur'),
  });
  const deleteHoliday = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/schedules/holidays/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['holidays', year] }); setDeleteHolidayId(null); toast.success('Hari libur dihapus'); },
    onError: () => toast.error('Gagal menghapus hari libur'),
  });

  // ── Derived data ───────────────────────────────────────────────
  const scheduleByUser = new Map<string, Record<string, any>>();
  for (const s of teamSchedule as any[]) {
    if (!scheduleByUser.has(s.user_id)) scheduleByUser.set(s.user_id, {});
    scheduleByUser.get(s.user_id)![s.date] = {
      shift_id:   s.shift_type_id,
      shift_name: s.shift_type?.name,
      color:      s.shift_type?.color_hex,
      is_day_off: s.is_day_off,
      is_holiday: s.is_holiday,
    };
  }

  const allWeekHolidays = weekSpansYears ? [...weekHolidays1, ...weekHolidays2] : weekHolidays1;
  const holidayDates = new Set<string>(
    allWeekHolidays.filter((h: any) => h.is_active).map((h: any) => h.date as string)
  );

  const activeUsers  = (allUsers as any[]).filter(u => u.is_active);
  const ohUsers      = activeUsers.filter(u => u.schedule_type === 'office_hours');
  const shiftUsers   = activeUsers.filter(u => u.schedule_type === 'shift');
  const workDays     = ohConfig?.work_days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const shiftRows = shiftUsers.map(u => ({
    user_id:     u.id,
    name:        u.full_name,
    employee_id: u.employee_id,
    days:        scheduleByUser.get(u.id) ?? {},
  }));

  // ── Shared grid header ─────────────────────────────────────────
  const GridHeader = () => (
    <div className="grid border-b border-black/[0.05] dark:border-white/[0.08] text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/30"
      style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
      <div className="px-4 py-3">Karyawan</div>
      {weekDates.map((date, i) => (
        <div key={date} className="px-2 py-3 text-center">
          <span className={`block text-[10px] ${date === TODAY ? 'text-[#007AFF]' : ''}`}>{DAY_LABELS[i]}</span>
          <span className={`text-[13px] font-bold ${date === TODAY ? 'text-[#007AFF]' : 'text-gray-800 dark:text-white'}`}>
            {parseLocalDate(date).getDate()}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F2F7] dark:bg-gray-950">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Konfigurasi Jadwal</h1>
        <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">Atur tipe shift, assign jadwal, dan hari libur nasional</p>
      </div>

      {/* Stat Cards */}
      <div className="px-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Clock}        label="Tipe Shift"       value={shifts.length}     color="text-[#007AFF]"  bg="bg-[#007AFF]/10" />
        <StatCard icon={Users}        label="Total Aktif"      value={activeUsers.length} color="text-[#34C759]"  bg="bg-[#34C759]/10" />
        <StatCard icon={Building2}    label="Office Hours"     value={ohUsers.length}    color="text-[#AF52DE]"  bg="bg-[#AF52DE]/10" />
        <StatCard icon={RotateCcw}    label="Karyawan Shift"   value={shiftUsers.length} color="text-[#FF9500]"  bg="bg-[#FF9500]/10" />
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-6 mb-4">
        <div className="flex gap-1 bg-black/[0.06] dark:bg-white/[0.08] rounded-[12px] p-1 w-fit">
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)}
              className={`px-4 py-1.5 rounded-[10px] text-sm font-medium transition-all ${
                activeTab === i
                  ? 'bg-white dark:bg-white/[0.15] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-white/50 hover:text-gray-700 dark:hover:text-white/70'
              }`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-6 pb-8">

        {/* ── TAB 0: Konfigurasi ─────────────────────────────────── */}
        {activeTab === 0 && (
          <div className="space-y-6">

            {/* Office Hours Config */}
            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.05] dark:border-white/[0.06]">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Konfigurasi Office Hours</h2>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">Jam kerja berlaku untuk semua karyawan bertipe Office Hours</p>
                </div>
                {!ohEditing && (
                  <button
                    onClick={() => {
                      setOhForm({
                        start_time: ohConfig?.start_time ?? '08:00',
                        end_time: ohConfig?.end_time ?? '16:00',
                        work_days: ohConfig?.work_days ?? ['Mon','Tue','Wed','Thu','Fri','Sat'],
                        tolerance_minutes: ohConfig?.tolerance_minutes ?? 15,
                      });
                      setOhFormError('');
                      setOhEditing(true);
                    }}
                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 transition">
                    <Pencil size={12} /> Edit
                  </button>
                )}
              </div>

              {!ohEditing ? (
                !ohConfig ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-gray-400 dark:text-white/40 mb-3">Belum ada konfigurasi Office Hours</p>
                    <button onClick={() => { setOhFormError(''); setOhEditing(true); }}
                      className="h-9 px-4 rounded-xl text-sm font-semibold text-white bg-[#007AFF] hover:bg-[#0063CC] transition">
                      Atur Sekarang
                    </button>
                  </div>
                ) : (
                  <div className="px-5 py-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-white/50">Jam Kerja</span>
                      <span className="font-medium text-gray-800 dark:text-white">
                        {ohConfig.start_time.slice(0,5)} – {ohConfig.end_time.slice(0,5)} · Toleransi {ohConfig.tolerance_minutes} menit
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 dark:text-white/50">Hari Kerja</span>
                      <div className="flex gap-1">
                        {ALL_DAYS_ORDER.map(d => (
                          <span key={d} className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                            ohConfig.work_days.includes(d)
                              ? 'bg-[#EFF6FF] dark:bg-[#007AFF]/15 text-[#007AFF]'
                              : 'bg-gray-100 dark:bg-white/[0.06] text-gray-400 dark:text-white/30'
                          }`}>
                            {ALL_DAYS_LABEL[d]}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="px-5 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/40 mb-1.5">Jam Masuk</label>
                      <input type="time" value={ohForm.start_time}
                        onChange={e => setOhForm(f => ({ ...f, start_time: e.target.value }))}
                        className="w-full h-10 px-3 rounded-xl text-sm border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF]" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/40 mb-1.5">Jam Pulang</label>
                      <input type="time" value={ohForm.end_time}
                        onChange={e => setOhForm(f => ({ ...f, end_time: e.target.value }))}
                        className="w-full h-10 px-3 rounded-xl text-sm border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/40 mb-2">Hari Kerja</label>
                    <div className="flex gap-2 flex-wrap">
                      {ALL_DAYS_ORDER.map(d => (
                        <button key={d} type="button"
                          onClick={() => setOhForm(f => ({
                            ...f,
                            work_days: f.work_days.includes(d) ? f.work_days.filter(x => x !== d) : [...f.work_days, d],
                          }))}
                          className={`w-10 h-9 rounded-xl text-xs font-semibold border transition-colors ${
                            ohForm.work_days.includes(d)
                              ? 'bg-[#007AFF] text-white border-[#007AFF]'
                              : 'bg-white dark:bg-white/[0.06] text-gray-500 dark:text-white/50 border-black/10 dark:border-white/[0.12] hover:border-[#007AFF]'
                          }`}>
                          {ALL_DAYS_LABEL[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="w-44">
                    <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-400 dark:text-white/40 mb-1.5">Toleransi (menit)</label>
                    <input type="number" min={0} max={120} value={ohForm.tolerance_minutes}
                      onChange={e => setOhForm(f => ({ ...f, tolerance_minutes: Number(e.target.value) }))}
                      className="w-full h-10 px-3 rounded-xl text-sm border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-900 dark:text-white focus:outline-none focus:border-[#007AFF]" />
                  </div>
                  <p className="text-xs text-gray-400 dark:text-white/40">Durasi harus tepat 8 jam. Contoh: 08:00 – 16:00</p>
                  {ohFormError && <p className="text-xs text-[#FF3B30]">{ohFormError}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => setOhEditing(false)}
                      className="h-10 px-5 rounded-xl text-sm border border-black/10 dark:border-white/[0.12] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                      Batal
                    </button>
                    <button
                      onClick={() => saveOhConfig.mutate({ ...ohForm, effective_date: new Date().toISOString().split('T')[0] })}
                      disabled={saveOhConfig.isPending}
                      className="h-10 px-5 rounded-xl text-sm font-semibold text-white bg-[#007AFF] hover:bg-[#0063CC] disabled:opacity-50 transition">
                      {saveOhConfig.isPending ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tipe Shift */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tipe Shift</h2>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">Shift kerja yang dapat di-assign ke karyawan</p>
                </div>
                {!showForm && !editShift && (
                  <button onClick={() => setShowForm(true)}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold text-white bg-[#007AFF] hover:bg-[#0063CC] transition">
                    <Plus size={15} /> Tambah Shift
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {shifts.map(shift => (
                  <div key={shift.id} className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: shift.color_hex }} />
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{shift.name}</span>
                      </div>
                      {deleteShiftId === shift.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteShift.mutate(shift.id)}
                            disabled={deleteShift.isPending}
                            className="text-xs px-2 py-1 rounded-xl text-white bg-[#FF3B30] hover:bg-[#D63529] disabled:opacity-50 transition">
                            Hapus
                          </button>
                          <button onClick={() => setDeleteShiftId(null)}
                            className="text-xs px-2 py-1 rounded-xl text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button onClick={() => setEditShift(shift)}
                            className="w-7 h-7 flex items-center justify-center rounded-xl text-[#007AFF] hover:bg-[#007AFF]/10 transition">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteShiftId(shift.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-xl text-[#FF3B30] hover:bg-[#FF3B30]/10 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-white/50">Jam</span>
                        <span className="font-medium text-gray-800 dark:text-white">
                          {shift.start_time.slice(0, 5)} – {shift.end_time.slice(0, 5)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-white/50">Durasi</span>
                        <span className="flex items-center gap-1 text-[#34C759] font-medium">
                          <CheckCircle2 size={12} /> 8 jam
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-white/50">Toleransi</span>
                        <span className="text-gray-800 dark:text-white">{shift.tolerance_minutes} menit</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {showForm && (
                <div className="mt-4">
                  <ShiftConfigurator
                    onSubmit={data => createShift.mutate(data)}
                    onCancel={() => setShowForm(false)}
                    loading={createShift.isPending}
                  />
                </div>
              )}
              {editShift && (
                <div className="mt-4">
                  <ShiftConfigurator
                    initial={editShift}
                    onSubmit={data => updateShift.mutate({ id: editShift.id, data })}
                    onCancel={() => setEditShift(null)}
                    loading={updateShift.isPending}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 1: Assign Jadwal ───────────────────────────────── */}
        {activeTab === 1 && (
          <div className="space-y-6">

            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekOffset(w => w - 1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.10] transition">
                <ChevronLeft size={16} />
              </button>
              <div className="bg-white dark:bg-white/[0.06] rounded-xl border border-black/[0.05] dark:border-white/[0.08] px-4 py-2 text-sm font-medium text-gray-700 dark:text-white/80 min-w-[200px] text-center">
                {formatWeekLabel()}
              </div>
              <button onClick={() => setWeekOffset(w => w + 1)}
                className="w-9 h-9 flex items-center justify-center rounded-xl border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.10] transition">
                <ChevronRight size={16} />
              </button>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)}
                  className="text-xs text-[#007AFF] hover:underline px-1 font-medium">
                  Minggu ini
                </button>
              )}
            </div>

            {/* Office Hours Section */}
            <div>
              <div className="flex items-start justify-between mb-3 gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Office Hours</h2>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
                    {ohUsers.length} karyawan · Hari kerja: {workDays.map(d => ALL_DAYS_LABEL[d] ?? d).join(', ')} · Libur pada hari libur nasional
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => generateOHWeek.mutate()}
                    disabled={generateOHWeek.isPending || generateOHMonth.isPending}
                    className="h-9 px-3 rounded-xl text-xs font-semibold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 disabled:opacity-50 transition">
                    {generateOHWeek.isPending ? 'Generating...' : 'Generate Minggu Ini'}
                  </button>
                  <button
                    onClick={() => generateOHMonth.mutate()}
                    disabled={generateOHWeek.isPending || generateOHMonth.isPending}
                    className="h-9 px-3 rounded-xl text-xs font-semibold text-white bg-[#007AFF] hover:bg-[#0063CC] disabled:opacity-50 transition">
                    {generateOHMonth.isPending ? 'Generating...' : `Generate Bulan Ini`}
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden overflow-x-auto">
                <GridHeader />
                {ohUsers.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400 dark:text-white/40">
                    Tidak ada karyawan bertipe Office Hours
                  </div>
                ) : (
                  ohUsers.map((user, ui) => (
                    <div key={user.id}
                      className={`grid ${ui < ohUsers.length - 1 ? 'border-b border-black/[0.04] dark:border-white/[0.06]' : ''}`}
                      style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}>
                      <div className="px-4 py-2.5 flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-[#F0FDF4] dark:bg-[#34C759]/15 flex items-center justify-center flex-shrink-0">
                          <span className="text-[11px] font-bold text-[#15803D] dark:text-[#86EFAC]">
                            {user.full_name?.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-gray-800 dark:text-white truncate">{user.full_name}</p>
                          <p className="text-[10px] text-gray-400 dark:text-white/40">{user.employee_id}</p>
                        </div>
                      </div>
                      {weekDates.map(date => {
                        const entry = scheduleByUser.get(user.id)?.[date];
                        const isHoliday = holidayDates.has(date);
                        const notGenerated = !entry;
                        const isDayOff  = entry ? entry.is_day_off : !workDays.includes(DAYS_MAP[parseLocalDate(date).getDay()]);
                        const cellType  = isHoliday ? 'national_holiday' : isDayOff ? 'day_off' : notGenerated ? 'not_generated' : 'work';
                        const isToday   = date === TODAY;
                        return (
                          <div key={date}
                            onClick={() => setOhActiveCell({ userId: user.id, date, userName: user.full_name, cellType: cellType as 'work' | 'day_off' | 'national_holiday' })}
                            title="Klik untuk override jadwal"
                            className={`flex items-center justify-center py-2.5 transition-colors cursor-pointer ${
                              isToday ? 'bg-[#EFF6FF]/40 dark:bg-[#007AFF]/[0.06]' : ''
                            } hover:bg-gray-100/60 dark:hover:bg-white/[0.04]`}>
                            {cellType === 'national_holiday' ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FEF2F2] dark:bg-[#FF3B30]/15 text-[#DC2626] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#FF3B30]/30">
                                Libur
                              </span>
                            ) : cellType === 'day_off' ? (
                              <span className="text-[11px] text-gray-300 dark:text-white/20">—</span>
                            ) : cellType === 'not_generated' ? (
                              <span className="text-[11px] text-gray-200 dark:text-white/15">·</span>
                            ) : (
                              <span className="text-[10px] font-medium text-[#15803D] dark:text-[#86EFAC]">Kerja</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mt-2 px-1">
                {[
                  { label: 'Kerja', sub: '= hari kerja · klik → tandai libur', cls: 'text-[10px] font-medium text-[#15803D]' },
                  { label: '—', sub: '= libur mingguan · klik → paksa masuk', cls: 'text-[10px] text-gray-300' },
                ].map(({ label, sub, cls }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={cls}>{label}</span>
                    <span className="text-[10px] text-gray-400">{sub}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]">Libur</span>
                  <span className="text-[10px] text-gray-400">= libur nasional · klik untuk force override</span>
                </div>
              </div>
            </div>

            {/* Shift Section */}
            <div>
              <div className="flex items-start justify-between mb-3 gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Shift</h2>
                  <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">
                    {shiftUsers.length} karyawan · Klik sel untuk assign atau ganti shift · Tidak dipengaruhi hari libur nasional
                  </p>
                </div>
                {shifts.length > 0 && shiftUsers.length > 0 && (
                  <button
                    onClick={() => setShowGenerateShift(true)}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold text-white bg-[#FF9500] hover:bg-[#E08600] flex-shrink-0 transition">
                    <Zap size={13} /> Generate Shift
                  </button>
                )}
              </div>

              <AssignmentGrid
                weekDates={weekDates}
                rows={shiftRows}
                shiftTypes={shifts}
                onAssign={(userId, date, shiftTypeId) =>
                  assignShift.mutate({ user_id: userId, shift_type_id: shiftTypeId, date })
                }
                onRemove={(userId, date) => unassignShift.mutate({ user_id: userId, date })}
                onMarkDayOff={(userId, date) => markShiftDayOff.mutate({ user_id: userId, date })}
                loading={assignShift.isPending || unassignShift.isPending || markShiftDayOff.isPending}
              />

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mt-2 px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-200 text-sm font-light">+</span>
                  <span className="text-[10px] text-gray-400">= belum ada jadwal, klik untuk assign</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex flex-col items-center px-2 py-0.5 rounded-lg" style={{ backgroundColor: '#007AFF22', borderLeft: '3px solid #007AFF' }}>
                    <span className="text-[10px] font-semibold text-[#007AFF] leading-tight">Pagi</span>
                    <span className="text-[9px] text-gray-500 tabular-nums leading-tight">08:00</span>
                  </div>
                  <span className="text-[10px] text-gray-400">= klik untuk ganti atau hapus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200">Libur</span>
                  <span className="text-[10px] text-gray-400">= hari libur shift, klik untuk assign</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: Hari Libur ──────────────────────────────────── */}
        {activeTab === 2 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button onClick={() => setHolidayYear(y => y - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.10] transition">
                  <ChevronLeft size={15} />
                </button>
                <span className="text-base font-bold text-gray-900 dark:text-white w-14 text-center">{year}</span>
                <button onClick={() => setHolidayYear(y => y + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl border border-black/10 dark:border-white/[0.12] bg-white dark:bg-white/[0.06] text-gray-600 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/[0.10] transition">
                  <ChevronRight size={15} />
                </button>
                <span className="text-xs text-gray-400 dark:text-white/40 ml-1">
                  · {(holidays as any[]).filter(h => h.is_active).length} hari libur
                </span>
              </div>
              <button onClick={() => setShowAddHoliday(true)}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white bg-[#007AFF] hover:bg-[#0063CC] transition">
                <Plus size={15} /> Tambah Hari Libur
              </button>
            </div>

            <div className="bg-white dark:bg-white/[0.06] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] overflow-hidden">
              {holidays.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center mx-auto mb-4">
                    <CalendarDays size={28} className="text-gray-300 dark:text-white/20" />
                  </div>
                  <p className="text-sm font-medium text-gray-500 dark:text-white/40">Belum ada hari libur nasional</p>
                  <p className="text-xs text-gray-400 dark:text-white/25 mt-1">Klik "+ Tambah Hari Libur" untuk menambahkan</p>
                </div>
              ) : (
                (holidays as any[]).map((h, i) => (
                  <div key={h.id}
                    className={`flex items-center justify-between px-5 py-3.5 ${i !== holidays.length - 1 ? 'border-b border-black/[0.04] dark:border-white/[0.06]' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[44px]">
                        <p className="text-[11px] font-semibold uppercase text-gray-400 dark:text-white/40">
                          {parseLocalDate(h.date).toLocaleDateString('id-ID', { month: 'short' })}
                        </p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                          {parseLocalDate(h.date).getDate()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{h.name}</p>
                        <p className="text-xs text-gray-400 dark:text-white/40">
                          {parseLocalDate(h.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                        h.is_active
                          ? 'bg-[#F0FDF4] dark:bg-[#34C759]/12 text-[#15803D] dark:text-[#86EFAC] border-[#BBF7D0] dark:border-[#34C759]/30'
                          : 'bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-white/40 border-transparent'
                      }`}>
                        {h.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                      {deleteHolidayId === h.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteHoliday.mutate(h.id)}
                            disabled={deleteHoliday.isPending}
                            className="text-xs px-2 py-1 rounded-xl text-white bg-[#FF3B30] hover:bg-[#D63529] disabled:opacity-50 transition">
                            Hapus
                          </button>
                          <button onClick={() => setDeleteHolidayId(null)}
                            className="text-xs px-2 py-1 rounded-xl text-gray-500 dark:text-white/50 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition">
                            Batal
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteHolidayId(h.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-xl text-[#FF3B30] hover:bg-[#FF3B30]/10 transition">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {showAddHoliday && (
        <AddHolidayModal
          onClose={() => setShowAddHoliday(false)}
          onSave={dto => createHoliday.mutate(dto)}
        />
      )}

      {/* OH Override Popup */}
      {ohActiveCell && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOhActiveCell(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-black/[0.05] dark:border-white/[0.08] w-full max-w-xs p-5 shadow-2xl pointer-events-auto">
              <p className="text-sm font-bold text-gray-900 dark:text-white">{ohActiveCell.userName}</p>
              <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">
                {parseLocalDate(ohActiveCell.date).toLocaleDateString('id-ID', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
              <p className="text-xs mt-2">
                Status saat ini:{' '}
                <span className={
                  ohActiveCell.cellType === 'work'
                    ? 'text-[#15803D] dark:text-[#86EFAC] font-semibold'
                    : ohActiveCell.cellType === 'national_holiday'
                    ? 'text-[#DC2626] font-semibold'
                    : 'text-gray-400 dark:text-white/40'
                }>
                  {ohActiveCell.cellType === 'work' ? 'Hari Kerja'
                    : ohActiveCell.cellType === 'national_holiday' ? 'Libur Nasional'
                    : 'Libur Mingguan'}
                </span>
              </p>
              {ohActiveCell.cellType === 'national_holiday' && (
                <p className="text-[11px] text-[#DC2626]/80 bg-[#FEF2F2] dark:bg-[#FF3B30]/12 rounded-xl px-3 py-2 mt-2">
                  Ini adalah hari libur nasional. Override hanya untuk keperluan khusus.
                </p>
              )}
              <div className="flex gap-2 mt-4">
                <button onClick={() => setOhActiveCell(null)}
                  className="flex-1 h-9 rounded-xl text-sm border border-black/10 dark:border-white/[0.12] text-gray-700 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition">
                  Batal
                </button>
                {ohActiveCell.cellType === 'work' ? (
                  <button
                    disabled={overrideDay.isPending}
                    onClick={() => { overrideDay.mutate({ user_id: ohActiveCell.userId, date: ohActiveCell.date, is_day_off: true }); setOhActiveCell(null); }}
                    className="flex-1 h-9 rounded-xl text-sm font-semibold text-white bg-[#FF3B30] hover:bg-[#D63529] disabled:opacity-50 transition">
                    Tandai Libur
                  </button>
                ) : (
                  <button
                    disabled={overrideDay.isPending}
                    onClick={() => { overrideDay.mutate({ user_id: ohActiveCell.userId, date: ohActiveCell.date, is_day_off: false }); setOhActiveCell(null); }}
                    className="flex-1 h-9 rounded-xl text-sm font-semibold text-white bg-[#007AFF] hover:bg-[#0063CC] disabled:opacity-50 transition">
                    Paksa Masuk Kerja
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Generate Shift Modal */}
      {showGenerateShift && (
        <GenerateShiftModal
          shiftTypes={shifts}
          shiftUserCount={shiftUsers.length}
          onClose={() => setShowGenerateShift(false)}
          onGenerate={(data) => generateShift.mutate(data)}
          loading={generateShift.isPending}
        />
      )}
    </div>
  );
}
