'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

// ── Types ─────────────────────────────────────────────────────────────────────
type FieldType = 'text' | 'number' | 'checkbox' | 'radio' | 'select' | 'date' | 'textarea';

type TemplateField = {
  id?: string;
  label: string;
  field_type: FieldType;
  options?: string[];
  is_required: boolean;
  order_index: number;
};

type TemplateSection = {
  id?: string;
  title: string;
  order_index: number;
  fields: TemplateField[];
};

type PhotoRequirement = {
  id?: string;
  phase: 'before' | 'during' | 'after';
  label: string;
  is_required: boolean;
  max_photos: number;
  order_index: number;
};

type WorkTypeTemplate = {
  id: string;
  name: string;
  work_type: string;
  description: string | null;
  is_active: boolean;
  sections: TemplateSection[];
  photo_requirements: PhotoRequirement[];
  created_at: string;
};

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Teks Singkat' },
  { value: 'textarea', label: 'Teks Panjang' },
  { value: 'number', label: 'Angka' },
  { value: 'date', label: 'Tanggal' },
  { value: 'checkbox', label: 'Checkbox (Ya/Tidak)' },
  { value: 'radio', label: 'Pilihan Tunggal' },
  { value: 'select', label: 'Dropdown' },
];

// ── Blank templates ───────────────────────────────────────────────────────────
function blankSection(): TemplateSection {
  return { title: '', order_index: 0, fields: [] };
}
function blankField(): TemplateField {
  return { label: '', field_type: 'text', is_required: false, order_index: 0 };
}
function blankPhotoReq(): PhotoRequirement {
  return { phase: 'before', label: '', is_required: true, max_photos: 3, order_index: 0 };
}

// ── Template Preview Modal ────────────────────────────────────────────────────
const DUMMY = {
  report_number: 'BA-2026/04/001',
  printed_at: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' }),
  technician: 'Ahmad Fauzi',
  client: 'PT. Maju Bersama',
  pic: 'Budi Santoso',
  check_in: '10 April 2026, 08:30 WITA',
  check_out: '10 April 2026, 11:45 WITA',
  duration: '3 jam 15 menit',
  location: 'Jl. Jendral Sudirman No. 45, Makassar',
};

const FIELD_PLACEHOLDER: Record<string, string> = {
  text: '___________________________',
  textarea: '_______________________________________________\n_______________________________________________',
  number: '0',
  date: '__ / __ / ____',
  checkbox: '☐',
};

function TemplatePreviewModal({ template, onClose }: { template: WorkTypeTemplate; onClose: () => void }) {
  const phaseLabel: Record<string, string> = { before: 'Sebelum', during: 'Saat Pengerjaan', after: 'Setelah' };
  const { data: company } = useQuery<{ name: string; address: string }>({
    queryKey: ['company-profile'],
    queryFn: () => apiClient.get('/settings/profile').then((r) => r.data),
  });
  const companyName = company?.name ?? 'Nustech';
  const companyAddress = company?.address ?? '';

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden">

        {/* Modal toolbar */}
        <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700">Preview — {template.name}</span>
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">Data Dummy</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        {/* PDF-like content */}
        <div className="p-8 font-sans text-[12px] text-gray-800 leading-relaxed">

          {/* Header */}
          <div className="flex items-start justify-between border-b-2 border-blue-600 pb-3 mb-4">
            <div>
              <div className="text-[18px] font-bold text-blue-700 tracking-wide">{companyName}</div>
              {companyAddress && <div className="text-[10px] text-gray-500">{companyAddress}</div>}
            </div>
            <div className="text-right">
              <div className="text-[15px] font-bold text-blue-700">{DUMMY.report_number}</div>
              <div className="text-[10px] text-gray-500">{DUMMY.printed_at}</div>
            </div>
          </div>

          {/* Judul */}
          <div className="text-center mb-5">
            <div className="text-[14px] font-bold uppercase tracking-wider">{template.name}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">Dokumen ini merupakan bukti resmi pelaksanaan kunjungan lapangan</div>
          </div>

          {/* Informasi Kunjungan */}
          <PreviewSection title="Informasi Kunjungan">
            <table className="w-full text-[11px]">
              <tbody>
                {[
                  ['Teknisi', DUMMY.technician],
                  ['Klien / Perusahaan', DUMMY.client],
                  ['PIC Klien', DUMMY.pic],
                  ['Check-in', DUMMY.check_in],
                  ['Check-out', DUMMY.check_out],
                  ['Durasi', DUMMY.duration],
                  ['Lokasi', DUMMY.location],
                ].map(([label, val]) => (
                  <tr key={label}>
                    <td className="py-1 text-gray-500 w-[38%]">{label}</td>
                    <td className="py-1 text-gray-500 w-[4%]">:</td>
                    <td className="py-1 font-medium">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PreviewSection>

          {/* Seksi dinamis dari template */}
          {template.sections.map((section) => (
            <PreviewSection key={section.id ?? section.title} title={section.title}>
              <div className="space-y-3">
                {section.fields.map((field, fi) => (
                  <div key={fi} className="flex gap-3 items-start">
                    <div className="w-[38%] text-gray-600 text-[11px] pt-0.5">
                      {field.label}
                      {field.is_required && <span className="text-red-500 ml-0.5">*</span>}
                    </div>
                    <div className="flex-1 text-[11px]">
                      {field.field_type === 'checkbox' && (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-4 h-4 border border-gray-400 rounded-sm inline-block" />
                          <span className="text-gray-400">Ya / Tidak</span>
                        </span>
                      )}
                      {field.field_type === 'textarea' && (
                        <div className="border border-gray-300 rounded px-2 py-1.5 min-h-[48px] bg-gray-50 text-gray-300 text-[10px]">
                          Tulis di sini...
                        </div>
                      )}
                      {(field.field_type === 'select' || field.field_type === 'radio') && field.options?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {field.options.map((opt, oi) => (
                            <span key={oi} className={`px-2 py-0.5 rounded border text-[10px] ${oi === 0 ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-500'}`}>
                              {oi === 0 && '◉ '}{oi !== 0 && '○ '}{opt}
                            </span>
                          ))}
                        </div>
                      ) : (field.field_type === 'select' || field.field_type === 'radio') ? (
                        <span className="text-gray-400 italic text-[10px]">— belum ada opsi —</span>
                      ) : null}
                      {!['checkbox', 'textarea', 'select', 'radio'].includes(field.field_type) && (
                        <div className="border-b border-gray-400 pb-0.5 text-gray-300 text-[10px]">
                          {FIELD_PLACEHOLDER[field.field_type] ?? '___________'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {section.fields.length === 0 && (
                  <p className="text-[10px] text-gray-400 italic">Tidak ada field di seksi ini</p>
                )}
              </div>
            </PreviewSection>
          ))}

          {/* Syarat Foto */}
          {template.photo_requirements.length > 0 && (
            <PreviewSection title="Dokumentasi Foto">
              <div className="space-y-4">
                {template.photo_requirements.map((req, ri) => {
                  const phaseColors: Record<string, string> = {
                    before: 'bg-orange-50 border-orange-200 text-orange-700',
                    during: 'bg-blue-50 border-blue-200 text-blue-700',
                    after:  'bg-green-50 border-green-200 text-green-700',
                  };
                  return (
                    <div key={req.id ?? ri} className={`rounded-xl border p-3 ${phaseColors[req.phase] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide">
                          {req.label}
                          {req.is_required && <span className="text-red-500 ml-0.5">*</span>}
                        </span>
                        <span className="text-[9px] font-medium opacity-60">
                          {phaseLabel[req.phase]} · maks. {req.max_photos} foto
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        {Array.from({ length: Math.min(req.max_photos, 4) }).map((_, i) => (
                          <div key={i} className="w-12 h-12 bg-white/60 border border-dashed border-current/30 rounded-lg flex flex-col items-center justify-center opacity-60">
                            <span className="text-base">📷</span>
                          </div>
                        ))}
                        {req.max_photos > 4 && (
                          <div className="w-12 h-12 bg-white/40 border border-dashed border-current/20 rounded-lg flex items-center justify-center opacity-50">
                            <span className="text-[10px] font-bold">+{req.max_photos - 4}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </PreviewSection>
          )}

          {/* Tanda Tangan */}
          <div className="flex gap-4 mt-6">
            {[
              { title: 'Teknisi', name: DUMMY.technician, role: 'Teknisi Lapangan' },
              { title: 'Perwakilan Klien', name: DUMMY.pic, role: `PIC ${DUMMY.client}` },
            ].map(({ title, name, role }) => (
              <div key={title} className="flex-1 border border-gray-200 rounded-xl p-3 text-center">
                <div className="text-[10px] font-bold uppercase text-gray-500 mb-2">{title}</div>
                <div className="h-16 flex items-center justify-center text-[10px] text-gray-300 italic border border-dashed border-gray-300 rounded mb-2">
                  Area Tanda Tangan
                </div>
                <div className="border-t border-gray-200 pt-1.5">
                  <div className="text-[11px] font-semibold">{name}</div>
                  <div className="text-[9px] text-gray-500">{role}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-between mt-5 pt-3 border-t border-gray-200 text-[9px] text-gray-400">
            <span>Dicetak: {DUMMY.printed_at}</span>
            <span>{DUMMY.report_number} — Nustech AttendenX</span>
            <span>⚠ Draft — Belum Final</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 border-l-[3px] border-blue-600 px-2 py-1 mb-2 text-gray-700">
        {title}
      </div>
      {children}
    </div>
  );
}

// ── Options Editor ────────────────────────────────────────────────────────────
function OptionsEditor({ options, onChange }: { options: string[]; onChange: (opts: string[]) => void }) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (!v || options.includes(v)) return;
    onChange([...options, v]);
    setInput('');
  };

  return (
    <div className="pl-1">
      <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">Opsi Pilihan</p>
      <div className="flex flex-wrap gap-1 mb-1">
        {options.map((opt, i) => (
          <span key={i} className="flex items-center gap-1 bg-white border border-gray-200 rounded px-2 py-0.5 text-xs text-gray-700">
            {opt}
            <button
              type="button"
              onClick={() => onChange(options.filter((_, idx) => idx !== i))}
              className="text-gray-400 hover:text-red-500 leading-none"
            >
              &times;
            </button>
          </span>
        ))}
        {options.length === 0 && (
          <span className="text-[10px] text-gray-400 italic">Belum ada opsi</span>
        )}
      </div>
      <div className="flex gap-1">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Ketik opsi lalu Enter"
          className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400"
        />
        <button
          type="button"
          onClick={add}
          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-xs font-medium"
        >
          + Tambah
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TemplatesPage() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<WorkTypeTemplate | null>(null);
  const [previewing, setPreviewing] = useState<WorkTypeTemplate | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery<WorkTypeTemplate[]>({
    queryKey: ['templates', showAll],
    queryFn: () =>
      apiClient.get('/templates', { params: showAll ? { all: 'true' } : {} }).then((r) => r.data),
  });

  const toggleActiveMut = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/templates/${id}/toggle-active`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Status template diperbarui');
    },
    onError: (err) => toast.error(getErrorMessage(err, 'Gagal mengubah status template')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/templates/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      setConfirmDeleteId(null);
      toast.success('Template berhasil dihapus');
    },
    onError: (err) => {
      setConfirmDeleteId(null);
      toast.error(getErrorMessage(err, 'Gagal menghapus template'));
    },
  });

  const openCreate = () => {
    setEditing(null);
    setShowModal(true);
  };

  const openEdit = (t: WorkTypeTemplate) => {
    setEditing(t);
    setShowModal(true);
  };

  const fieldCount = (t: WorkTypeTemplate) =>
    t.sections.reduce((sum, s) => sum + s.fields.length, 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] sm:text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Template Berita Acara</h1>
          <p className="text-[12px] text-gray-400 dark:text-white/40 mt-0.5">
            Template formulir dinamis per jenis pekerjaan
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded"
            />
            Tampilkan nonaktif
          </label>
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition"
          >
            + Buat Template
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Memuat…</div>
      ) : templates.length === 0 ? (
        <div className="text-sm text-gray-400 py-12 text-center">
          Belum ada template. Klik "Buat Template" untuk memulai.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Nama Template</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Jenis Pekerjaan</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Seksi</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Field</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Foto</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t) => (
                <tr key={t.id} className={`hover:bg-gray-50 transition ${!t.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">{t.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {t.work_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">{t.sections.length}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{fieldCount(t)}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{t.photo_requirements.length}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleActiveMut.mutate(t.id)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {t.is_active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={() => setPreviewing(t)}
                        className="text-gray-500 hover:text-gray-800 text-xs font-medium"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => openEdit(t)}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        Edit
                      </button>
                      {confirmDeleteId === t.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMut.mutate(t.id)}
                            disabled={deleteMut.isPending}
                            className="text-red-600 hover:text-red-800 text-xs font-semibold"
                          >
                            {deleteMut.isPending ? '...' : 'Ya, Hapus'}
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            Batal
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(t.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-medium"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <TemplateFormModal
          initial={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            qc.invalidateQueries({ queryKey: ['templates'] });
          }}
        />
      )}

      {/* Preview Modal */}
      {previewing && (
        <TemplatePreviewModal
          template={previewing}
          onClose={() => setPreviewing(null)}
        />
      )}
    </div>
  );
}

// ── Template Form Modal ───────────────────────────────────────────────────────
function TemplateFormModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: WorkTypeTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [workType, setWorkType] = useState(initial?.work_type ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [sections, setSections] = useState<TemplateSection[]>(
    initial?.sections.length ? initial.sections : [blankSection()],
  );
  const [photoReqs, setPhotoReqs] = useState<PhotoRequirement[]>(
    initial?.photo_requirements.length ? initial.photo_requirements : [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !workType.trim()) {
      setError('Nama dan jenis pekerjaan wajib diisi.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        work_type: workType.trim(),
        description: description.trim() || undefined,
        sections: sections.map((s, si) => ({
          title: s.title,
          order_index: si,
          fields: s.fields.map((f, fi) => ({
            label: f.label,
            field_type: f.field_type,
            options: f.options?.length ? f.options : undefined,
            is_required: f.is_required,
            order_index: fi,
          })),
        })),
        photo_requirements: photoReqs.map((p, pi) => ({
          phase: p.phase,
          label: p.label,
          is_required: p.is_required,
          max_photos: p.max_photos,
          order_index: pi,
        })),
      };

      if (initial) {
        await apiClient.put(`/templates/${initial.id}`, payload);
      } else {
        await apiClient.post('/templates', payload);
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Gagal menyimpan template.');
    } finally {
      setSaving(false);
    }
  };

  // ── Section helpers ─────────────────────────────────────────────────────────
  const addSection = () => setSections([...sections, blankSection()]);
  const removeSection = (i: number) => setSections(sections.filter((_, idx) => idx !== i));
  const updateSection = (i: number, patch: Partial<TemplateSection>) =>
    setSections(sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const addField = (si: number) =>
    updateSection(si, { fields: [...sections[si].fields, blankField()] });
  const removeField = (si: number, fi: number) =>
    updateSection(si, { fields: sections[si].fields.filter((_, idx) => idx !== fi) });
  const updateField = (si: number, fi: number, patch: Partial<TemplateField>) =>
    updateSection(si, {
      fields: sections[si].fields.map((f, idx) => (idx === fi ? { ...f, ...patch } : f)),
    });

  // ── Photo req helpers ───────────────────────────────────────────────────────
  const addPhotoReq = () => setPhotoReqs([...photoReqs, blankPhotoReq()]);
  const removePhotoReq = (i: number) => setPhotoReqs(photoReqs.filter((_, idx) => idx !== i));
  const updatePhotoReq = (i: number, patch: Partial<PhotoRequirement>) =>
    setPhotoReqs(photoReqs.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-bold text-gray-900">
            {initial ? 'Edit Template' : 'Buat Template Baru'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Nama Template *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Maintenance AC"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Jenis Pekerjaan *</label>
              <input
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                placeholder="Contoh: maintenance"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Deskripsi</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Deskripsi singkat (opsional)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {/* Sections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">Seksi & Field Formulir</h3>
              <button
                onClick={addSection}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Tambah Seksi
              </button>
            </div>

            {sections.map((section, si) => (
              <div key={si} className="border border-gray-200 rounded-xl p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    value={section.title}
                    onChange={(e) => updateSection(si, { title: e.target.value })}
                    placeholder={`Judul Seksi ${si + 1}`}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-sm font-medium focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={() => addField(si)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                  >
                    + Field
                  </button>
                  {sections.length > 1 && (
                    <button
                      onClick={() => removeSection(si)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Hapus
                    </button>
                  )}
                </div>

                {section.fields.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">Belum ada field. Klik "+ Field".</p>
                ) : (
                  <div className="space-y-2">
                    {section.fields.map((field, fi) => (
                      <div key={fi} className="bg-gray-50 rounded-xl px-3 py-2 space-y-2">
                        {/* Row 1: label, type, wajib, hapus */}
                        <div className="flex items-center gap-2">
                          <input
                            value={field.label}
                            onChange={(e) => updateField(si, fi, { label: e.target.value })}
                            placeholder="Label field"
                            className="flex-1 bg-transparent text-xs border-b border-gray-300 focus:outline-none focus:border-blue-400 pb-0.5"
                          />
                          <select
                            value={field.field_type}
                            onChange={(e) => {
                              const ft = e.target.value as FieldType;
                              updateField(si, fi, {
                                field_type: ft,
                                options: ['select', 'radio'].includes(ft) ? (field.options ?? []) : undefined,
                              });
                            }}
                            className="text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none"
                          >
                            {FIELD_TYPES.map((ft) => (
                              <option key={ft.value} value={ft.value}>{ft.label}</option>
                            ))}
                          </select>
                          <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={field.is_required}
                              onChange={(e) => updateField(si, fi, { is_required: e.target.checked })}
                            />
                            Wajib
                          </label>
                          <button
                            onClick={() => removeField(si, fi)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            &times;
                          </button>
                        </div>
                        {/* Row 2: opsi pilihan (hanya muncul untuk select / radio) */}
                        {['select', 'radio'].includes(field.field_type) && (
                          <OptionsEditor
                            options={field.options ?? []}
                            onChange={(opts) => updateField(si, fi, { options: opts })}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Photo requirements */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-800">Syarat Foto</h3>
              <button
                onClick={addPhotoReq}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Tambah Syarat Foto
              </button>
            </div>

            {photoReqs.length === 0 ? (
              <p className="text-xs text-gray-400 italic">
                Menggunakan batas foto default (5–20 per fase).
              </p>
            ) : (
              <div className="space-y-2">
                {photoReqs.map((pr, pi) => (
                  <div key={pi} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                    <select
                      value={pr.phase}
                      onChange={(e) => updatePhotoReq(pi, { phase: e.target.value as 'before' | 'during' | 'after' })}
                      className="text-xs border border-gray-200 rounded px-1.5 py-1"
                    >
                      <option value="before">Before</option>
                      <option value="during">During</option>
                      <option value="after">After</option>
                    </select>
                    <input
                      value={pr.label}
                      onChange={(e) => updatePhotoReq(pi, { label: e.target.value })}
                      placeholder="Label syarat foto"
                      className="flex-1 bg-transparent text-xs border-b border-gray-300 focus:outline-none focus:border-blue-400 pb-0.5"
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                      Max:
                      <input
                        type="number"
                        value={pr.max_photos}
                        onChange={(e) => updatePhotoReq(pi, { max_photos: +e.target.value })}
                        min={1}
                        max={30}
                        className="w-10 text-center border border-gray-200 rounded px-1 text-xs"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={pr.is_required}
                        onChange={(e) => updatePhotoReq(pi, { is_required: e.target.checked })}
                      />
                      Wajib
                    </label>
                    <button
                      onClick={() => removePhotoReq(pi)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : initial ? 'Simpan Perubahan' : 'Buat Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
