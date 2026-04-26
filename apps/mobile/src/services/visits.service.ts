import { api } from './api';
import { C } from '@/constants/tokens';

export const VISIT_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  ongoing:     { label: 'Berlangsung',    color: C.blue,   bg: C.blue   + '18' },
  completed:   { label: 'Selesai',        color: C.green,  bg: C.green  + '18' },
  on_hold:     { label: 'Ditunda',        color: C.orange, bg: C.orange + '18' },
  rescheduled: { label: 'Dijadwal Ulang', color: C.purple, bg: C.purple + '18' },
  cancelled:   { label: 'Dibatalkan',     color: C.red,    bg: C.red    + '18' },
};

export interface VisitCheckInPayload {
  task_id: string;
  client_id: string;
  lat: number;
  lng: number;
}

export interface AddPhotoPayload {
  phase: 'before' | 'during' | 'after';
  lat: number;
  lng: number;
  caption?: string;
  photoUri: string; // local file URI from camera or gallery
  requirement_id?: string;
  source?: 'camera' | 'gallery';
  taken_at?: string; // ISO string — waktu asli capture (untuk offline queue)
}

export interface CheckOutPayload {
  work_description: string;
  findings?: string;
  recommendations?: string;
  materials_used?: { name: string; qty: string }[];
}

export interface VisitSummary {
  id: string;
  task_id: string;
  client_id: string;
  client: { id: string; name: string; pic_name?: string };
  check_in_at: string;
  check_out_at: string | null;
  status: 'ongoing' | 'completed' | 'on_hold' | 'rescheduled' | 'cancelled';
  gps_valid: boolean;
  gps_deviation_meter: number | null;
  duration_minutes: number | null;
  created_at: string;
  review_status: 'approved' | 'revision_needed' | null;
  review_rating: number | null;
  review_notes: string | null;
  reviewed_at: string | null;
  reviewer: { id: string; full_name: string } | null;
}

export interface PhotoCount {
  count: number;
  min: number;
  max: number;
}

export interface PhotoRequirementCount {
  id: string;
  label: string;
  phase: string;
  max_photos: number;
  is_required: boolean;
  count: number;
}

export interface PhotoCounts {
  has_requirements: boolean;
  requirements: PhotoRequirementCount[];
  before: PhotoCount;
  during: PhotoCount;
  after: PhotoCount;
}

export const visitsService = {
  async checkIn(payload: VisitCheckInPayload) {
    const res = await api.post('/visits/check-in', payload);
    return res.data as VisitSummary;
  },

  async addPhoto(visitId: string, payload: AddPhotoPayload) {
    const formData = new FormData();
    formData.append('phase', payload.phase);
    formData.append('lat', String(payload.lat));
    formData.append('lng', String(payload.lng));
    if (payload.caption) formData.append('caption', payload.caption);
    if (payload.requirement_id) formData.append('requirement_id', payload.requirement_id);
    if (payload.source) formData.append('source', payload.source);
    if (payload.taken_at) formData.append('taken_at', payload.taken_at);

    // Append the photo file
    const filename = payload.photoUri.split('/').pop() ?? 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const mimeType = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
    formData.append('photo', {
      uri: payload.photoUri,
      name: filename,
      type: mimeType,
    } as unknown as Blob);

    const res = await api.post(`/visits/${visitId}/photos`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000, // P2-7: foto bisa besar — beri 60 detik sebelum timeout
    });
    return res.data;
  },

  async checkOut(visitId: string, payload: CheckOutPayload) {
    const res = await api.post(`/visits/${visitId}/check-out`, payload);
    return res.data as VisitSummary;
  },

  async getMyVisits(params?: { page?: number; limit?: number; status?: string }) {
    const res = await api.get('/visits/me', { params });
    return res.data as { items: VisitSummary[]; total: number; page: number };
  },

  async getDetail(visitId: string) {
    const res = await api.get(`/visits/${visitId}`);
    return res.data as VisitSummary & {
      template_id?: string | null;
      check_in_address?: string;
      check_in_district?: string;
      check_in_province?: string;
      work_description?: string;
      findings?: string;
      recommendations?: string;
      materials_used?: { name: string; qty: string }[];
      photos?: {
        id: string;
        phase: 'before' | 'during' | 'after';
        seq_number: number;
        watermarked_url: string;
        thumbnail_url: string;
        caption?: string;
        taken_at: string;
      }[];
    };
  },

  async getPhotoCounts(visitId: string) {
    const res = await api.get(`/visits/${visitId}/photo-counts`);
    return res.data as PhotoCounts;
  },
};
