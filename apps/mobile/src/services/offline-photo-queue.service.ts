/**
 * Offline Photo Queue
 * Menyimpan foto yang gagal upload (karena tidak ada sinyal) ke storage lokal.
 * Diproses ulang saat app kembali ke foreground atau saat upload manual.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

function localId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const QUEUE_KEY = 'offline_photo_queue_v1';
const LOCAL_DIR = `${FileSystem.documentDirectory}visit_photos/`;

export interface OfflinePhotoRecord {
  id: string;
  visitId: string;
  phase: 'before' | 'during' | 'after';
  lat: number;
  lng: number;
  localPath: string;   // path di documentDirectory — persistent
  takenAt: string;     // ISO string waktu capture asli
  requirementId?: string;
  source: 'camera' | 'gallery';
}

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(LOCAL_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOCAL_DIR, { intermediates: true });
  }
}

/** Copy URI (dari kamera atau galeri) ke documentDirectory agar persistent */
export async function copyToLocal(uri: string): Promise<string> {
  await ensureDir();
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const dest = `${LOCAL_DIR}${localId()}.${ext}`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function getQueue(): Promise<OfflinePhotoRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflinePhotoRecord[]) : [];
  } catch {
    return [];
  }
}

export async function enqueuePhoto(
  record: Omit<OfflinePhotoRecord, 'id'>,
): Promise<string> {
  const id = localId();
  const queue = await getQueue();
  queue.push({ ...record, id });
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return id;
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.filter((r) => r.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export async function getPendingCountForVisit(visitId: string): Promise<number> {
  const queue = await getQueue();
  return queue.filter((r) => r.visitId === visitId).length;
}

/** Proses queue satu per satu. uploadFn harus throw jika upload gagal. */
export async function processQueue(
  uploadFn: (record: OfflinePhotoRecord) => Promise<void>,
): Promise<{ uploaded: number; failed: number }> {
  const queue = await getQueue();
  let uploaded = 0;
  let failed = 0;

  for (const record of queue) {
    try {
      // Verifikasi file masih ada sebelum upload
      const info = await FileSystem.getInfoAsync(record.localPath);
      if (!info.exists) {
        // File hilang (unlikely, tapi aman untuk skip)
        await removeFromQueue(record.id);
        continue;
      }
      await uploadFn(record);
      await removeFromQueue(record.id);
      // Hapus file lokal setelah berhasil upload
      await FileSystem.deleteAsync(record.localPath, { idempotent: true });
      uploaded++;
    } catch {
      failed++;
      // Tetap di queue — akan dicoba lagi next time
    }
  }

  return { uploaded, failed };
}

/** Apakah error ini disebabkan oleh tidak ada koneksi? */
export function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as Record<string, unknown>;
  const msg = String(e.message ?? '');
  const code = String(e.code ?? '');
  return (
    code === 'ERR_NETWORK' ||
    msg.includes('Network Error') ||
    msg.includes('network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('timeout')
  );
}
