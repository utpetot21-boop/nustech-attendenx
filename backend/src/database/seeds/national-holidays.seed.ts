import type { DataSource } from 'typeorm';

import { NationalHolidayEntity } from '../../modules/schedule/entities/national-holiday.entity';


// ── Hari Libur Nasional & Cuti Bersama Indonesia 2026 ─────────────────────────
// Sumber: SKB 3 Menteri tentang Hari Libur Nasional dan Cuti Bersama 2026
// Data resmi (diverifikasi pengguna)
const HOLIDAYS_2026 = [
  // Januari
  { date: '2026-01-01', name: 'Tahun Baru Masehi 2026', is_collective_leave: false },
  { date: '2026-01-16', name: 'Isra Mikraj Nabi Muhammad SAW', is_collective_leave: false },

  // Februari
  { date: '2026-02-16', name: 'Cuti Bersama Tahun Baru Imlek', is_collective_leave: true },
  { date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili', is_collective_leave: false },

  // Maret — Nyepi + Idul Fitri 1447H
  { date: '2026-03-18', name: 'Cuti Bersama Nyepi', is_collective_leave: true },
  { date: '2026-03-19', name: 'Hari Suci Nyepi — Tahun Baru Saka 1948', is_collective_leave: false },
  { date: '2026-03-20', name: 'Cuti Bersama Idul Fitri 1447 H', is_collective_leave: true },
  { date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 H — Hari Pertama', is_collective_leave: false },
  { date: '2026-03-22', name: 'Hari Raya Idul Fitri 1447 H — Hari Kedua', is_collective_leave: false },
  { date: '2026-03-23', name: 'Cuti Bersama Idul Fitri 1447 H', is_collective_leave: true },
  { date: '2026-03-24', name: 'Cuti Bersama Idul Fitri 1447 H', is_collective_leave: true },

  // April
  { date: '2026-04-03', name: 'Wafat Yesus Kristus', is_collective_leave: false },
  { date: '2026-04-05', name: 'Kebangkitan Yesus Kristus (Paskah)', is_collective_leave: false },

  // Mei
  { date: '2026-05-01', name: 'Hari Buruh Internasional', is_collective_leave: false },
  { date: '2026-05-14', name: 'Kenaikan Yesus Kristus', is_collective_leave: false },
  { date: '2026-05-15', name: 'Cuti Bersama Kenaikan Yesus Kristus', is_collective_leave: true },
  { date: '2026-05-27', name: 'Hari Raya Idul Adha 1447 H', is_collective_leave: false },
  { date: '2026-05-28', name: 'Cuti Bersama Idul Adha', is_collective_leave: true },
  { date: '2026-05-31', name: 'Hari Raya Waisak 2570 BE', is_collective_leave: false },

  // Juni
  { date: '2026-06-01', name: 'Hari Lahir Pancasila', is_collective_leave: false },
  { date: '2026-06-16', name: 'Tahun Baru Islam 1448 H', is_collective_leave: false },

  // Agustus
  { date: '2026-08-17', name: 'Hari Proklamasi Kemerdekaan Republik Indonesia', is_collective_leave: false },
  { date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW', is_collective_leave: false },

  // Desember
  { date: '2026-12-24', name: 'Cuti Bersama Natal', is_collective_leave: true },
  { date: '2026-12-25', name: 'Hari Raya Natal', is_collective_leave: false },
];

export async function seedNationalHolidays(dataSource: DataSource): Promise<void> {
  const holidayRepo = dataSource.getRepository(NationalHolidayEntity);

  // Hapus seluruh data 2025 & 2026 lalu insert ulang dengan data yang benar
  await holidayRepo.delete({ year: 2025 }); // bersihkan data lama 2025
  await holidayRepo.delete({ year: 2026 });

  const allHolidays = [...HOLIDAYS_2026];
  let seeded = 0;

  for (const holiday of allHolidays) {
    const year = parseInt(holiday.date.split('-')[0], 10);
    await holidayRepo.save(
      holidayRepo.create({
        date: holiday.date,
        name: holiday.name,
        year,
        is_active: true,
        is_collective_leave: holiday.is_collective_leave,
      }),
    );
    seeded++;
  }

  console.log(`✅ National holidays: ${seeded} entri disimpan (2025 dihapus, 2026 diperbarui dari awal)`);
}
