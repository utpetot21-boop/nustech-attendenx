import { api } from './api';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus =
  | 'unassigned'
  | 'pending_confirmation'
  | 'assigned'
  | 'on_hold'
  | 'rescheduled'
  | 'completed'
  | 'cancelled';

export interface TaskSummary {
  id: string;
  title: string;
  description?: string;
  type?: string;
  priority: TaskPriority;
  status: TaskStatus;
  client?: { id: string; name: string; address?: string; lat?: number | null; lng?: number | null };
  assignee?: { id: string; full_name: string };
  confirm_deadline?: string;
  scheduled_at?: string;
  is_emergency: boolean;
  escalated_from?: string;
  escalated_at?: string;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  canceller?: { id: string; full_name: string } | null;
  created_at: string;
}

export interface HoldTaskPayload {
  visit_id?: string;
  reason_type: string;
  reason_notes: string;
  evidence_urls: string[];
}

export interface DelegateTaskPayload {
  to_user_id: string;
  reason: string;
  type?: 'delegate' | 'swap';
  swap_task_id?: string;
}

export const tasksService = {
  async getMyTasks(params?: { status?: string; priority?: string; page?: number }) {
    const res = await api.get('/tasks', { params });
    return res.data as { items: TaskSummary[]; total: number };
  },

  async getDetail(id: string) {
    const res = await api.get(`/tasks/${id}`);
    return res.data as TaskSummary & {
      assignments?: { user_id: string; status: string; offered_at: string }[];
    };
  },

  async accept(id: string) {
    const res = await api.post(`/tasks/${id}/accept`);
    return res.data as TaskSummary;
  },

  async reject(id: string, reason?: string) {
    const res = await api.post(`/tasks/${id}/reject`, { reason });
    return res.data;
  },

  async cancelTask(id: string, reason: string) {
    const res = await api.post(`/tasks/${id}/cancel`, { reason });
    return res.data as TaskSummary;
  },

  async delegate(id: string, payload: DelegateTaskPayload) {
    const res = await api.post(`/tasks/${id}/delegate`, payload);
    return res.data;
  },

  async holdTask(id: string, payload: HoldTaskPayload) {
    const res = await api.post(`/tasks/${id}/hold`, payload);
    return res.data;
  },

  async getHolds(id: string) {
    const res = await api.get(`/tasks/${id}/holds`);
    return res.data as {
      id: string;
      reason_type: string;
      reason_notes: string;
      evidence_urls: string[];
      review_status: string;
      reschedule_date?: string;
      auto_approve_at: string;
      is_auto_approved: boolean;
      created_at: string;
    }[];
  },

  async createVisitTask(payload: {
    title: string;
    assigned_to: string;
    client_id?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    scheduled_at?: string;
    notes?: string;
  }) {
    const res = await api.post('/tasks', {
      ...payload,
      type: 'visit',
      dispatch_type: 'direct',
    });
    return res.data as TaskSummary;
  },

  async createTask(payload: {
    title: string;
    type?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
    client_id?: string;
    dispatch_type: 'direct' | 'broadcast';
    assigned_to?: string;
    broadcast_dept_id?: string;
    scheduled_at?: string;
    is_emergency?: boolean;
    notes?: string;
  }) {
    const res = await api.post('/tasks', payload);
    return res.data as TaskSummary;
  },
};
