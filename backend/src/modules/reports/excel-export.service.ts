import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

@Injectable()
export class ExcelExportService {
  /**
   * Generic helper: takes array-of-objects + optional column order
   * Returns xlsx Buffer
   */
  toBuffer(
    data: Record<string, unknown>[],
    sheetName = 'Sheet1',
    headers?: string[],
  ): Buffer {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });

    // Auto column width
    const colWidths = (headers ?? Object.keys(data[0] ?? {})).map((key) => {
      const maxLen = Math.max(
        key.length,
        ...data.map((r) => String(r[key] ?? '').length),
      );
      return { wch: Math.min(maxLen + 2, 40) };
    });
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  exportAttendance(rows: Record<string, unknown>[]): Buffer {
    const mapped = rows.map((r) => ({
      'Nama Karyawan': r['full_name'],
      'Departemen': r['department'],
      'Hadir': r['hadir'],
      'Terlambat': r['terlambat'],
      'Alfa': r['alfa'],
      'Izin/Sakit/Dinas': r['izin'],
      'Total Lembur (mnt)': r['total_overtime_minutes'],
    }));
    return this.toBuffer(mapped, 'Kehadiran');
  }

  exportOvertime(rows: Record<string, unknown>[]): Buffer {
    const summary = rows.map((r) => ({
      'Nama': r['full_name'],
      'Departemen': r['department'],
      'Hari Lembur': r['overtime_days'],
      'Total Menit': r['total_minutes'],
      'Total Jam': r['total_hours'],
    }));
    return this.toBuffer(summary, 'Lembur');
  }

  exportLeaveBalances(rows: Record<string, unknown>[]): Buffer {
    const mapped = rows.map((r) => ({
      'Nama': r['full_name'],
      'Departemen': r['department'],
      'Tahun': r['year'],
      'Saldo (hari)': r['balance_days'],
      'Terpakai': r['used_days'],
      'Akrual Bulanan': r['accrued_monthly'],
      'Komp. Libur': r['accrued_holiday'],
      'Hangus': r['expired_days'],
    }));
    return this.toBuffer(mapped, 'Saldo Cuti');
  }
}
