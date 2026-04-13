'use client';

import { useState } from 'react';

interface ShiftType {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  color_hex: string;
}

interface UserRow {
  user_id: string;
  name: string;
  employee_id: string;
  days: Record<string, { shift_id?: string; shift_name?: string; color?: string } | null>;
}

interface Props {
  weekDates: string[];
  rows: UserRow[];
  shiftTypes: ShiftType[];
  onAssign: (userId: string, date: string, shiftTypeId: string) => void;
  onRemove: (userId: string, date: string) => void;
  loading?: boolean;
}

const DAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const _n = new Date();
const TODAY = `${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}-${String(_n.getDate()).padStart(2,'0')}`;

/** Parse YYYY-MM-DD as local date to avoid UTC-midnight timezone shift */
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function AssignmentGrid({ weekDates, rows, shiftTypes, onAssign, onRemove, loading }: Props) {
  const [activeCell, setActiveCell] = useState<{ userId: string; date: string } | null>(null);

  const openCell = (userId: string, date: string) => {
    setActiveCell(prev =>
      prev?.userId === userId && prev?.date === date ? null : { userId, date }
    );
  };

  const handleAssign = (shiftId: string) => {
    if (!activeCell) return;
    onAssign(activeCell.userId, activeCell.date, shiftId);
    setActiveCell(null);
  };

  const handleRemove = () => {
    if (!activeCell) return;
    onRemove(activeCell.userId, activeCell.date);
    setActiveCell(null);
  };

  return (
    <div className="bg-white dark:bg-white/10 rounded-2xl border border-black/7 dark:border-white/18 overflow-hidden relative">
      {/* Header */}
      <div
        className="grid border-b border-black/7 dark:border-white/12 text-[11px] font-semibold uppercase tracking-[0.4px] text-gray-500 dark:text-white/60"
        style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
      >
        <div className="px-4 py-3">Karyawan</div>
        {weekDates.map((date, i) => (
          <div key={date} className="px-2 py-3 text-center">
            <span className={`block text-[10px] ${date === TODAY ? 'text-[#007AFF]' : ''}`}>
              {DAY_LABELS[i]}
            </span>
            <span className={`text-[13px] font-bold ${date === TODAY ? 'text-[#007AFF]' : 'text-gray-800 dark:text-white'}`}>
              {parseLocalDate(date).getDate()}
            </span>
          </div>
        ))}
      </div>

      {/* Rows */}
      {rows.map((row, ri) => (
        <div
          key={row.user_id}
          className={`grid ${ri < rows.length - 1 ? 'border-b border-black/5 dark:border-white/8' : ''} hover:bg-gray-50/50 dark:hover:bg-white/4 transition-colors`}
          style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
        >
          {/* User info */}
          <div className="px-4 py-2.5 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.18)] flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-[#007AFF]">
                {row.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-gray-800 dark:text-white truncate">{row.name}</p>
              <p className="text-[10px] text-gray-400 dark:text-white/40">{row.employee_id}</p>
            </div>
          </div>

          {/* Day cells */}
          {weekDates.map((date) => {
            const cell = row.days[date];
            const isActive = activeCell?.userId === row.user_id && activeCell?.date === date;
            const isToday = date === TODAY;

            return (
              <div
                key={date}
                onClick={() => openCell(row.user_id, date)}
                className={`flex items-center justify-center py-2.5 cursor-pointer transition-colors ${
                  isToday ? 'bg-[#EFF6FF]/40 dark:bg-[rgba(0,122,255,0.06)]' : ''
                } ${isActive ? 'ring-2 ring-inset ring-[#007AFF]' : 'hover:bg-gray-100/60 dark:hover:bg-white/6'}`}
              >
                {cell?.shift_id ? (
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md text-white truncate max-w-[56px]"
                    style={{ backgroundColor: cell.color ?? '#007AFF' }}
                    title={cell.shift_name}
                  >
                    {cell.shift_name?.split(' ').slice(-1)[0] ?? '?'}
                  </span>
                ) : (
                  <span className="text-[13px] text-gray-200 dark:text-white/20 select-none font-light">+</span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {rows.length === 0 && (
        <div className="py-10 text-center text-[13px] text-gray-400 dark:text-white/40">
          Tidak ada karyawan bertipe Shift
        </div>
      )}

      {/* Shift picker dropdown — centered */}
      {activeCell && (() => {
        const currentRow = rows.find(r => r.user_id === activeCell.userId);
        const currentCell = currentRow?.days[activeCell.date];
        return (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setActiveCell(null)}
            />
            <div className="fixed z-50 bg-white dark:bg-gray-800 rounded-2xl border border-black/10 dark:border-white/18 shadow-2xl p-3 min-w-[200px]"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
            >
              <p className="text-[11px] font-semibold text-gray-400 dark:text-white/50 px-1 py-1 uppercase tracking-wider mb-1">
                {parseLocalDate(activeCell.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>

              {/* Current shift info */}
              {currentCell?.shift_id && (
                <div className="flex items-center gap-2 px-2 py-1.5 mb-2 rounded-xl bg-gray-50 dark:bg-white/8 border border-black/7 dark:border-white/12">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentCell.color ?? '#007AFF' }} />
                  <span className="text-[12px] text-gray-600 dark:text-white/70 flex-1">{currentCell.shift_name}</span>
                  <span className="text-[10px] text-gray-400">aktif</span>
                </div>
              )}

              {/* Shift options */}
              <div className="space-y-0.5">
                {shiftTypes.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleAssign(s.id)}
                    disabled={loading}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] transition-colors ${
                      currentCell?.shift_id === s.id
                        ? 'bg-[#EFF6FF] dark:bg-[rgba(0,122,255,0.16)] text-[#007AFF] font-medium'
                        : 'hover:bg-gray-50 dark:hover:bg-white/8 text-gray-700 dark:text-white/80'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color_hex }} />
                    <span className="flex-1 text-left">{s.name}</span>
                    <span className="text-[11px] text-gray-400 dark:text-white/40">
                      {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                    </span>
                  </button>
                ))}
              </div>

              {/* Remove option — only if assigned */}
              {currentCell?.shift_id && (
                <>
                  <div className="my-2 border-t border-black/7 dark:border-white/12" />
                  <button
                    onClick={handleRemove}
                    disabled={loading}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[rgba(255,69,58,0.12)] transition-colors"
                  >
                    <span className="text-base leading-none">×</span>
                    <span>Hapus Assignment</span>
                  </button>
                </>
              )}
            </div>
          </>
        );
      })()}
    </div>
  );
}
