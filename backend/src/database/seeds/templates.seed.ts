import type { DataSource } from 'typeorm';
import { WorkTypeTemplateEntity } from '../../modules/templates/entities/work-type-template.entity';
import { TemplateSectionEntity } from '../../modules/templates/entities/template-section.entity';
import { TemplateFieldEntity } from '../../modules/templates/entities/template-field.entity';
import { TemplatePhotoRequirementEntity } from '../../modules/templates/entities/template-photo-requirement.entity';

export async function seedTemplates(ds: DataSource): Promise<void> {
  const templateRepo   = ds.getRepository(WorkTypeTemplateEntity);
  const sectionRepo    = ds.getRepository(TemplateSectionEntity);
  const fieldRepo      = ds.getRepository(TemplateFieldEntity);
  const photoReqRepo   = ds.getRepository(TemplatePhotoRequirementEntity);

  // Skip jika sudah ada
  const exists = await templateRepo.findOne({ where: { work_type: 'maintenance' } });
  if (exists) {
    console.log('  ⏭  Template maintenance AC sudah ada, skip.');
    return;
  }

  // ── 1. Buat template ──────────────────────────────────────────────────────
  const template = await templateRepo.save(
    templateRepo.create({
      name: 'Berita Acara Maintenance AC',
      work_type: 'maintenance',
      description: 'Formulir berita acara untuk pekerjaan maintenance unit AC',
      is_active: true,
    }),
  );

  // ── 2. Seksi & Field ──────────────────────────────────────────────────────
  const sectionsData = [
    {
      title: 'Informasi Pekerjaan',
      fields: [
        { label: 'Tanggal Pelaksanaan',   field_type: 'date',     is_required: true,  options: null },
        { label: 'Lokasi / Ruangan',       field_type: 'text',     is_required: true,  options: null },
        { label: 'Nomor Unit AC',           field_type: 'text',     is_required: true,  options: null },
        { label: 'Merk / Tipe AC',          field_type: 'text',     is_required: false, options: null },
        { label: 'PK / Kapasitas',          field_type: 'text',     is_required: false, options: null },
      ],
    },
    {
      title: 'Kondisi & Pemeriksaan',
      fields: [
        { label: 'Kondisi Awal Unit',       field_type: 'select',   is_required: true,  options: ['Baik', 'Cukup', 'Rusak'] },
        { label: 'Filter Dibersihkan',      field_type: 'checkbox', is_required: true,  options: null },
        { label: 'Refrigeran Diisi Ulang',  field_type: 'checkbox', is_required: false, options: null },
        { label: 'Kondisi Kelistrikan',     field_type: 'select',   is_required: true,  options: ['Normal', 'Ada Masalah'] },
        { label: 'Temuan / Catatan Teknis', field_type: 'textarea', is_required: false, options: null },
      ],
    },
    {
      title: 'Hasil & Rekomendasi',
      fields: [
        { label: 'Hasil Pekerjaan',                   field_type: 'select',   is_required: true,  options: ['Selesai', 'Selesai Sebagian', 'Perlu Tindak Lanjut'] },
        { label: 'Rekomendasi Tindak Lanjut',         field_type: 'textarea', is_required: false, options: null },
        { label: 'Estimasi Perawatan Berikutnya',     field_type: 'date',     is_required: false, options: null },
      ],
    },
  ];

  for (let si = 0; si < sectionsData.length; si++) {
    const sd = sectionsData[si];
    const section = await sectionRepo.save(
      sectionRepo.create({
        template_id: template.id,
        title: sd.title,
        order_index: si,
      }),
    );

    for (let fi = 0; fi < sd.fields.length; fi++) {
      const fd = sd.fields[fi];
      await fieldRepo.save(
        fieldRepo.create({
          section_id: section.id,
          label: fd.label,
          field_type: fd.field_type as any,
          options: fd.options,
          is_required: fd.is_required,
          order_index: fi,
        }),
      );
    }
  }

  // ── 3. Syarat Foto ────────────────────────────────────────────────────────
  const photoReqs = [
    { phase: 'before', label: 'Kondisi unit sebelum pekerjaan', is_required: true,  max_photos: 3, order_index: 0 },
    { phase: 'during', label: 'Proses pembersihan / perbaikan', is_required: false, max_photos: 3, order_index: 1 },
    { phase: 'after',  label: 'Kondisi unit setelah selesai',   is_required: true,  max_photos: 3, order_index: 2 },
  ];

  for (const pr of photoReqs) {
    await photoReqRepo.save(
      photoReqRepo.create({ template_id: template.id, ...pr }),
    );
  }

  console.log('  ✅ Template "Berita Acara Maintenance AC" berhasil dibuat.');
}
