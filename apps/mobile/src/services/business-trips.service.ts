// M3: migrasi dari fetch-based apiRequest (tidak ada token interceptor)
//     ke axios api — semua request lewat interceptor refresh token
import api from './api';

export interface BusinessTrip {
  id: string;
  trip_number: string;
  user_id: string;
  destination: string;
  purpose: string;
  depart_date: string;
  return_date: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'ongoing' | 'completed' | 'cancelled';
  transport_mode: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  advance_amount: number | null;
  doc_url: string | null;
  rejection_reason: string | null;
  notes: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface CreateBusinessTripDto {
  destination: string;
  purpose: string;
  depart_date: string;
  return_date: string;
  transport_mode?: string;
  estimated_cost?: number;
  advance_amount?: number;
  notes?: string;
}

export const businessTripsService = {
  getMyTrips: async (status?: string): Promise<{ items: BusinessTrip[]; total: number }> => {
    const res = await api.get('/business-trips', { params: status ? { status } : undefined });
    return res.data;
  },

  getDetail: async (id: string): Promise<BusinessTrip> => {
    const res = await api.get(`/business-trips/${id}`);
    return res.data;
  },

  create: async (dto: CreateBusinessTripDto): Promise<BusinessTrip> => {
    const res = await api.post('/business-trips', dto);
    return res.data;
  },

  submit: async (id: string): Promise<BusinessTrip> => {
    const res = await api.post(`/business-trips/${id}/submit`);
    return res.data;
  },

  depart: async (id: string): Promise<BusinessTrip> => {
    const res = await api.post(`/business-trips/${id}/depart`);
    return res.data;
  },

  complete: async (id: string, dto: { actual_cost?: number; doc_url?: string }): Promise<BusinessTrip> => {
    const res = await api.post(`/business-trips/${id}/complete`, dto);
    return res.data;
  },

  cancel: async (id: string): Promise<void> => {
    await api.delete(`/business-trips/${id}`);
  },
};
