'use client';

import { useState, useEffect } from 'react';

interface ShiftFormData {
  name: string;
  start_time: string;
  end_time: string;
  tolerance_minutes: number;
  color_hex: string;
}

interface Props {
  initial?: Partial<ShiftFormData>;
  onSubmit: (data: ShiftFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const COLOR_OPTIONS = [
  { hex: '#007AFF', label: 'Biru' },
  { hex: '#34C759', label: 'Hijau' },
  { hex: '#FF9F0A', label: 'Oranye' },
  { hex: '#FF453A', label: 'Merah' },
  { hex: '#BF5AF2', label: 'Ungu' },
  { hex: '#5AC8FA', label: 'Teal' },
];

function calculateDuration(start: string, end: string): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 24 * 60;
  return endMin - startMin;
}

export function ShiftConfigurator({ initial, onSubmit, onCancel, loading }: Props) {
  const [form, setForm] = useState<ShiftFormData>({
    name: initial?.name ?? '',
    start_time: initial?.start_time ?? '08:00',
    end_time: initial?.end_time ?? '16:00',
    tolerance_minutes: initial?.tolerance_minutes ?? 60,
    color_hex: initial?.color_hex ?? '#007AFF',
  });

  const duration = calculateDuration(form.start_time, form.end_time);
  const isValid = duration === 480;

  const set = (key: keyof ShiftFormData, value: string | number) =>
    setForm((f) => ({ ...f, [key]: value }));

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} jam` : `${h}j ${m}m`;
  };

  return (
    <div className="bg-white dark:bg-white/10 rounded-2xl border border-black/7 dark:border-white/18 p-6">
      <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-5">
        {initial ? 'Edit Shift' : 'Tambah Shift Baru'}
      </h3>

      <div className="space-y-4">
        {/* Nama */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-500 dark:text-white/60 mb-1.5">
            Nama Shift
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Contoh: Shift Pagi"
            className="w-full h-10 px-3 rounded-xl text-[14px] bg-white/85 dark:bg-white/10 border border-black/10 dark:border-white/18 text-gray-700 dark:text-white placeholder-gray-300 dark:placeholder-white/35 outline-none focus:border-[#007AFF]"
          />
        </div>

        {/* Jam mulai & selesai */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-500 dark:text-white/60 mb-1.5">
              Jam Mulai
            </label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => set('start_time', e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-[14px] bg-white/85 dark:bg-white/10 border border-black/10 dark:border-white/18 text-gray-700 dark:text-white outline-none focus:border-[#007AFF]"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-500 dark:text-white/60 mb-1.5">
              Jam Selesai
            </label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => set('end_time', e.target.value)}
              className="w-full h-10 px-3 rounded-xl text-[14px] bg-white/85 dark:bg-white/10 border border-black/10 dark:border-white/18 text-gray-700 dark:text-white outline-none focus:border-[#007AFF]"
            />
          </div>
        </div>

        {/* Validasi durasi — real-time */}
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-[13px] font-medium ${
            duration === 0
              ? 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/12 text-gray-400'
              : isValid
              ? 'bg-[#F0FDF4] dark:bg-[rgba(52,199,89,0.12)] border-[#BBF7D0] dark:border-[rgba(52,199,89,0.35)] text-[#15803D] dark:text-[#86EFAC]'
              : 'bg-[#FEF2F2] dark:bg-[rgba(255,69,58,0.12)] border-[#FECACA] dark:border-[rgba(255,69,58,0.35)] text-[#DC2626] dark:text-[#FCA5A5]'
          }`}
        >
          <span className="text-base">{duration === 0 ? '⏱' : isValid ? '✓' : '✕'}</span>
          <span>
            {duration === 0
              ? 'Atur jam mulai dan selesai'
              : isValid
              ? `Durasi ${formatDuration(duration)} ✓ Valid`
              : `Durasi ${formatDuration(duration)} — Harus tepat 8 jam (480 menit)`}
          </span>
        </div>

        {/* Toleransi */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-500 dark:text-white/60 mb-1.5">
            Toleransi Keterlambatan
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={form.tolerance_minutes}
              min={0}
              max={120}
              onChange={(e) => set('tolerance_minutes', Number(e.target.value))}
              className="w-20 h-10 px-3 rounded-xl text-[14px] bg-white/85 dark:bg-white/10 border border-black/10 dark:border-white/18 text-gray-700 dark:text-white outline-none focus:border-[#007AFF]"
            />
            <span className="text-[13px] text-gray-500 dark:text-white/60">menit</span>
          </div>
        </div>

        {/* Warna */}
        <div>
          <label className="block text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-500 dark:text-white/60 mb-1.5">
            Warna
          </label>
          <div className="flex gap-2 flex-wrap">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => set('color_hex', c.hex)}
                title={c.label}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  form.color_hex === c.hex ? 'border-gray-800 dark:border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c.hex }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 h-10 rounded-xl text-[14px] font-medium bg-white/85 dark:bg-white/12 border border-black/10 dark:border-white/20 text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/16 transition-colors"
        >
          Batal
        </button>
        <button
          type="button"
          onClick={() => isValid && !loading && onSubmit(form)}
          disabled={!isValid || !form.name.trim() || loading}
          className="flex-1 h-10 rounded-xl text-[14px] font-semibold text-white bg-[rgba(0,122,255,0.90)] border border-[rgba(0,122,255,0.60)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_2px_10px_rgba(0,122,255,0.25)] hover:bg-[rgba(0,122,255,1)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? 'Menyimpan...' : 'Simpan Shift'}
        </button>
      </div>
    </div>
  );
}
